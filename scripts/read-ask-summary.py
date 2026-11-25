"""Read cached ASK scores and emit monthly aggregates without agent identifiers."""
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from itertools import chain
import json
import math
from pathlib import Path
import re
import sys
from xlsx_rows import xlsx_records, xlsx_rows, xlsx_sheet_names

MONTHS = {"agustus": "08", "sept": "09", "okt": "10"}
SOURCE_MONTHS = {
    alias: month
    for month, aliases in enumerate((
        ("jan", "januari", "january"),
        ("feb", "februari", "february"),
        ("mar", "maret", "march"),
        ("apr", "april"),
        ("mei", "may"),
        ("jun", "juni", "june"),
        ("jul", "juli", "july"),
        ("agu", "ags", "agt", "agustus", "aug", "august"),
        ("sep", "sept", "september"),
        ("okt", "oktober", "oct", "october"),
        ("nov", "november"),
        ("des", "desember", "dec", "december"),
    ), 1)
    for alias in aliases
}
SOURCE_BUCKETS = ("tappingCurrent", "tappingPrior", "rollup", "other", "unclassified")
SEGMENTS = ("Walk In Mitra", "Walk In TOMO", "Call In", "E-Care")
DIMENSIONS = ("attitude", "skill", "knowledge")
REQUIRED = ("nik siad", "job", "ctp", "business model", "kuadran ask", "area", "regional", "unit id", "unit name", *DIMENSIONS)
WEIGHTS = (4, 3, 3)
PRIORITY_PARAMETERS = {"etika pelayanan": 0.35, "holding time": 0.10, "edukasi layanan": 0.20}


# Published findings from slides 4–5 of Monthly Update ASK, September 2026.
SEPTEMBER_FINDINGS = {
    "national": [
        ["Etika Pelayanan", "Responsiveness", "Penampilan"],
        ["Holding Time", "Gali Informasi", "Kejelasan Informasi"],
        ["Edukasi Layanan", "Solusi dan Konfirmasi", "Cross Selling (Non Komplain)"],
    ],
    "attitudeBySegment": {
        "Walk In Mitra": [["Etika Pelayanan", 80.7], ["Responsiveness", 96.6], ["Penampilan", 97.1]],
        "Walk In TOMO": [["Etika Pelayanan", 78.1], ["Responsiveness", 96.9], ["Penampilan", 97.8]],
        "Call In": [["Etika Pelayanan", 64.7], ["Responsiveness", 97.4]],
        "E-Care": [["Etika Pelayanan", 88.3], ["Responsiveness", 90.1]],
    },
}


def empty_group():
    return {"total": 0, "scoreSum": 0, "dimensionSums": [0, 0, 0],
            "high": [0, 0, 0], "quadrants": {}, "talentPool": {}}


def location_keys(location):
    return (json.dumps(location[:depth], ensure_ascii=False, separators=(",", ":"))
            for depth in (2, 3, 5))


def tapping_month(value):
    value = value.strip()
    try:
        if re.fullmatch(r"\d+(?:\.\d+)?", value):
            return (date(1899, 12, 30) + timedelta(days=int(float(value)))).isoformat()[:7]
        if re.match(r"^\d{4}-\d{2}-\d{2}", value):
            return date.fromisoformat(value[:10]).isoformat()[:7]
        numeric = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})", value)
        words = re.fullmatch(r"(?:[^,]+,\s*)?(\d{1,2})[- ]([A-Za-z]+)[- ](\d{4}|\d{2})", value)
        if numeric or words:
            day, month, year = (numeric or words).groups()
            number = int(month) if numeric else SOURCE_MONTHS.get(month.casefold(), 0)
            return date(int(year) + (2000 if len(year) == 2 else 0), number, int(day)).isoformat()[:7]
    except (ValueError, OverflowError):
        pass
    return ""


def tapping_parameters(path, period, roster):
    totals = {}
    for sheet in xlsx_sheet_names(path):
        key = sheet.strip().casefold()
        if re.match(r"^sq mitra(?:\s*\(|$)", key):
            channel, dates = "GraPARI", ("tanggal interaksi",)
        elif key == "ecare":
            channel, dates = "E-Care", ("tanggal penilaian",)
        elif key in {"call center", "callcenter", "cc"}:
            channel, dates = "Call Center", ("tgl penilaian", "tanggal penilaian", "tanggal")
        else:
            continue
        rows = iter(xlsx_rows(path, sheet))
        initial = [next(rows, {}) for _ in range(3)]
        headers = [{column: value.casefold() for column, value in row.items()} for row in initial]
        by_name = lambda name: [column for row in headers for column, label in row.items() if label == name]
        params = [(label, columns[0], weight) for label, weight in PRIORITY_PARAMETERS.items()
                  if (columns := by_name(label))]
        ids = [column for label in ("nik siad seharusnya", "nik siad (seharusnya)", "nik siad",
                                    "nik csr", "nik csdm", "nik") for column in by_name(label)]
        dates = next((cols for name in dates if (cols := by_name(name))), [])
        if not params or not ids or not dates:
            continue
        for row in chain(initial, rows):
            if tapping_month(row.get(dates[0], "")) != period:
                continue
            location = next((match for column in ids if (match := roster.get(row.get(column, "")))
                             and match[0] == channel), None)
            if not location:
                continue
            for label, column, weight in params:
                try:
                    score = float(row.get(column, ""))
                except ValueError:
                    continue
                if not 0 <= score <= weight:
                    continue
                for key in location_keys(location):
                    metric = totals.setdefault(key, {}).setdefault(label, {"count": 0, "gapSum": 0})
                    metric["count"] += 1
                    metric["gapSum"] += (weight - score) / weight
    return totals


def talent_pool_band(row, weighted_score):
    final_score = weighted_score
    if "skor akhir" in row:
        try:
            final_score = Decimal(row["skor akhir"].replace(",", "."))
        except InvalidOperation:
            return "unclassified"
        if not final_score.is_finite():
            return "unclassified"
    # Older exports without Skor Akhir use the weighted scores.
    return next((band for minimum, band in ((80, "excellent"), (70, "good"), (60, "core"))
                 if final_score >= minimum), "growth")


def count_latest_bands(placements):
    talent_groups, talent_locations = {}, {}
    for segment, _, location, _, _, talent in placements:
        counts = talent_groups.setdefault(segment, {})
        counts[talent] = counts.get(talent, 0) + 1
        for key in location_keys(location):
            counts = talent_locations.setdefault(key, {}).setdefault(segment, {})
            counts[talent] = counts.get(talent, 0) + 1
    return {"latestTalentPool": talent_groups, "latestLocationTalentPool": talent_locations}


def assessment_source(note, year, month):
    note = note.strip().casefold()
    if re.match(r"^(?:(?:roll[\s-]*up|nilai)\s+)?(?:tl|spv)\b", note):
        return "rollup"
    if re.match(r"^(?:nilai\s+)?tapping\s+team\b", note):
        return "other"
    if not re.match(r"^(?:nilai\s+)?tapping\b", note):
        return "unclassified"
    match = re.search(r"\b([a-z]+)\.?(?:[\s'’]+([0-9]{2}|[0-9]{4}))?\s*$", note)
    if not match or match[1] not in SOURCE_MONTHS:
        return "unclassified"
    source_month = SOURCE_MONTHS[match[1]]
    source_year = int(match[2]) if match[2] else None
    if source_year is not None and source_year < 100:
        source_year += 2000
    if source_month == month and source_year in (None, year):
        return "tappingCurrent"
    prior_year, prior_month = (year, month - 1) if month > 1 else (year - 1, 12)
    if source_month == prior_month and source_year in (None, prior_year):
        return "tappingPrior"
    return "other"


def read_tryout_scores(row, columns):
    scores = []
    session_columns = [key for key in columns if key in row]
    for key in session_columns or ["nilai to"]:
        try:
            score = float(row.get(key, ""))
        except ValueError:
            continue
        if 0 <= score <= 100:
            scores.append(score)
    return scores


def band_for_score(score):
    return "high" if score >= 90 else "mid" if score >= 80 else "low"


def summarize(path, period, include_details):
    year, month = map(int, period.split("-"))
    required = (*REQUIRED, "employee name") if include_details else REQUIRED
    suffixes = ["", *(f" {alias}" for alias, number in SOURCE_MONTHS.items() if number == month)]
    tryout_columns = tuple(f"to {slot}{suffix}" for slot in (1, 2, 3) for suffix in suffixes)
    optional = ("skor akhir", "notes qa", "nilai to", *tryout_columns)
    groups = {name: empty_group() for name in SEGMENTS}
    csr_counts = dict.fromkeys((*SEGMENTS, "GraPARI model belum tercatat", "CTP belum terpetakan"), 0)
    excluded = incomplete = unassigned = 0
    seen = set()
    placements = {}
    roster = {}
    locations = {}
    csr_locations = {}
    tryout_scores = {}
    tryout_locations = {}
    for row in xlsx_records(path, "Data ASK", required, optional=optional):
        field = row.__getitem__
        agent = field("nik siad")
        if not agent:
            continue
        if agent in seen:
            raise ValueError("Duplicate ASK ID")
        seen.add(agent)
        quadrant = field("kuadran ask")
        if field("job").casefold() in {"non agent", "cs sar"}:
            excluded += 1
            continue
        ctp = field("ctp").casefold()
        model = field("business model").casefold()
        segment = {
            ("grapari", "momo"): "Walk In Mitra",
            ("grapari", "tomo"): "Walk In TOMO",
        }.get((ctp, model)) if ctp == "grapari" else {
            "call center": "Call In", "ecare": "E-Care", "e-care": "E-Care",
        }.get(ctp)
        csr_bucket = segment or ("GraPARI model belum tercatat" if ctp == "grapari" else "CTP belum terpetakan")
        csr_counts[csr_bucket] += 1
        channel = {"grapari": "GraPARI", "call center": "Call Center"}.get(ctp, "E-Care")
        area = (field("area") or "Area belum tersedia") if channel == "GraPARI" else ""
        region = field("regional") or "Region belum tersedia"
        unit_name = field("unit name") or "Unit belum tersedia"
        location = (channel, area, region, field("unit id"), unit_name)
        mapped_ctp = ctp in {"grapari", "call center", "ecare", "e-care"}
        scoped_keys = list(location_keys(location)) if mapped_ctp else []
        if scoped_keys:
            roster[agent] = location
        for key in scoped_keys:
            bucket = csr_locations.setdefault(key, {})
            bucket[csr_bucket] = bucket.get(csr_bucket, 0) + 1
        # TO is independent of ASK eligibility. Include valid scores from the full CSR roster.
        scores_to = read_tryout_scores(row, tryout_columns)
        if scores_to:
            results = {"count": len(scores_to), "sum": sum(scores_to), "high": 0, "mid": 0, "low": 0}
            for score in scores_to:
                results[band_for_score(score)] += 1
            for bucket in (tryout_scores, *(tryout_locations.setdefault(key, {}) for key in scoped_keys)):
                group = bucket.setdefault(csr_bucket, dict.fromkeys(results, 0))
                for key, value in results.items():
                    group[key] += value
        if quadrant.casefold() == "non kuadran":
            excluded += 1
            continue
        try:
            scores = [float(field(key)) for key in DIMENSIONS]
        except ValueError:
            scores = []
        if len(scores) != 3 or not all(math.isfinite(score) and 0 <= score <= 100 for score in scores):
            incomplete += 1
            continue
        if segment is None:
            unassigned += 1
            continue
        label = quadrant.upper()
        if not re.fullmatch(r"(?:HAHAKO|HALOKO|LOHAKO|LOLOKO) \((?:HA|LA)\)", label):
            label = "BELUM TERSEDIA"
        weighted_score = sum(Decimal(field(key)) * weight for key, weight in zip(DIMENSIONS, WEIGHTS)) / 10
        talent = talent_pool_band(row, weighted_score)
        placements[agent] = (segment, label, location, field("employee name") if include_details else "",
                             scores if include_details else None, talent)
        buckets = [groups[segment]]
        for key in scoped_keys:
            by_segment = locations.setdefault(key, {})
            buckets.append(by_segment.setdefault(segment, empty_group()))
        final_score = float(weighted_score)
        source = assessment_source(row["notes qa"], year, month) if "notes qa" in row else None
        for group in buckets:
            group["total"] += 1
            group["scoreSum"] += final_score
            if source is not None:
                counts = group.setdefault("sources", dict.fromkeys(SOURCE_BUCKETS, 0))
                counts[source] += 1
            for index, score in enumerate(scores):
                group["dimensionSums"][index] += score
                group["high"][index] += score >= 80
            group["quadrants"][label] = group["quadrants"].get(label, 0) + 1
            group["talentPool"][talent] = group["talentPool"].get(talent, 0) + 1
    return {"groups": groups, "locations": locations, "csrCounts": csr_counts, "csrLocations": csr_locations,
            "tryoutScores": tryout_scores, "tryoutLocations": tryout_locations,
            "tappingParameters": tapping_parameters(path, period, roster), "excluded": excluded,
            "incomplete": incomplete, "unassigned": unassigned}, placements


def read_months(folder, include_details=False):
    months = {}
    placements = {}
    for path in sorted(folder.glob("*.xlsx")):
        match = re.fullmatch(r"ASK_(\d{4}-(?:0[1-9]|1[0-2]))\.xlsx", path.name, re.I)
        legacy = re.fullmatch(r"Data Attitude Skill Knowledge - (Agustus|Sept|Okt) (\d{4})\.xlsx", path.name, re.I)
        if match:
            period = match[1]
        elif legacy:
            period = f"{legacy[2]}-{MONTHS[legacy[1].casefold()]}"
        else:
            continue
        if period in months:
            raise ValueError("Multiple ASK workbooks for one month")
        months[period], placements[period] = summarize(path, period, include_details)
    if not months:
        raise ValueError("No ASK workbooks found")
    september = months.get("2026-09")
    if september and [(group["total"], *group["high"]) for group in september["groups"].values()] == [
        (1255, 1214, 1198, 1159), (1539, 1429, 1432, 1335),
        (1123, 552, 953, 816), (1151, 762, 878, 852),
    ]:
        september["parameterFindings"] = SEPTEMBER_FINDINGS
    for period, summary in months.items():
        year, month = period.split("-")
        number = int(month)
        starts = {"quarter": ((number - 1) // 3) * 3 + 1,
                  "semester": ((number - 1) // 6) * 6 + 1, "ytd": 1}
        summary["latestQuadrants"] = {}
        summary["latestLocationQuadrants"] = {}
        for mode, start in starts.items():
            latest = {}
            end = min(12, start + ({"quarter": 2, "semester": 5, "ytd": number - 1}[mode]))
            for available in sorted(placements):
                if f"{year}-{start:02d}" <= available <= f"{year}-{end:02d}":
                    latest.update(placements[available])
            counts = {name: {} for name in SEGMENTS}
            scoped = {}
            for name, label, location, *_ in latest.values():
                counts[name][label] = counts[name].get(label, 0) + 1
                for key in location_keys(location):
                    bucket = scoped.setdefault(key, {}).setdefault(name, {})
                    bucket[label] = bucket.get(label, 0) + 1
            summary["latestLocationQuadrants"][mode] = scoped
            summary["latestQuadrants"][mode] = counts
            if mode == "ytd":
                summary.update(count_latest_bands(latest.values()))
    return {"summary": months, "placements": placements} if include_details else months


if __name__ == "__main__":
    print(json.dumps(read_months(Path(sys.argv[1]), "--details" in sys.argv[2:])))
