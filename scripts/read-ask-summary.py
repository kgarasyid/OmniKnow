"""Read cached ASK scores and emit monthly aggregates without agent identifiers."""
import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

MONTHS = {"agustus": "08", "sept": "09", "okt": "10"}
SEGMENTS = ("Walk In Mitra", "Walk In TOMO", "Call In", "E-Care")
DIMENSIONS = ("attitude", "skill", "knowledge")
REQUIRED = ("nik siad", "job", "ctp", "business model", "kuadran ask", "area", "regional", "unit id", "unit name", *DIMENSIONS)


def empty_group():
    return {"total": 0, "high": [0, 0, 0], "quadrants": {}}


def location_keys(location):
    return (json.dumps(location[:depth], ensure_ascii=False, separators=(",", ":"))
            for depth in (2, 3, 5))


def summarize(path, include_details):
    with zipfile.ZipFile(path) as book:
        strings = []
        if "xl/sharedStrings.xml" in book.namelist():
            strings = ["".join(t.text or "" for t in node.iterfind(".//{*}t"))
                       for node in ET.fromstring(book.read("xl/sharedStrings.xml"))]
        sheets = ET.fromstring(book.read("xl/workbook.xml")).iterfind(".//{*}sheet")
        sheet = next(s for s in sheets if s.get("name", "").strip().casefold() == "data ask")
        sheet_id = next(value for key, value in sheet.attrib.items() if key.endswith("}id"))
        relations = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
        target = next(rel.get("Target") for rel in relations if rel.get("Id") == sheet_id)
        root = ET.fromstring(book.read(target.lstrip("/") if target.startswith("/") else "xl/" + target))

    def cells(row):
        values = {}
        for cell in row:
            value = cell.findtext("{*}v", "")
            kind = cell.get("t")
            if kind == "s":
                value = strings[int(value)]
            elif kind == "inlineStr":
                value = "".join(t.text or "" for t in cell.iterfind(".//{*}t"))
            values[re.sub(r"\d", "", cell.get("r"))] = value.strip()
        return values

    rows = iter(root.iterfind(".//{*}row"))
    headers = {name.casefold(): col for col, name in cells(next(rows)).items()}
    required = (*REQUIRED, "employee name") if include_details else REQUIRED
    if not all(name in headers for name in required):
        raise ValueError("Missing ASK headers")
    groups = {name: empty_group() for name in SEGMENTS}
    excluded = incomplete = unassigned = 0
    seen = set()
    placements = {}
    locations = {}
    for row in rows:
        values = cells(row)
        def field(name):
            return values.get(headers[name], "")
        agent = field("nik siad")
        if not agent:
            continue
        if agent in seen:
            raise ValueError("Duplicate ASK ID")
        seen.add(agent)
        quadrant = field("kuadran ask")
        if field("job").casefold() in {"non agent", "cs sar"} or quadrant.casefold() == "non kuadran":
            excluded += 1
            continue
        try:
            scores = [float(field(key)) for key in DIMENSIONS]
        except ValueError:
            scores = []
        if len(scores) != 3 or not all(math.isfinite(score) and 0 <= score <= 100 for score in scores):
            incomplete += 1
            continue
        ctp = field("ctp").casefold()
        model = field("business model").casefold()
        segment = {
            ("grapari", "momo"): "Walk In Mitra",
            ("grapari", "tomo"): "Walk In TOMO",
        }.get((ctp, model)) if ctp == "grapari" else {
            "call center": "Call In", "ecare": "E-Care", "e-care": "E-Care",
        }.get(ctp)
        if segment is None:
            unassigned += 1
            continue
        label = quadrant.upper()
        if not re.fullmatch(r"(?:HAHAKO|HALOKO|LOHAKO|LOLOKO) \((?:HA|LA)\)", label):
            label = "BELUM TERSEDIA"
        channel = {"grapari": "GraPARI", "call center": "Call Center"}.get(ctp, "E-Care")
        area = (field("area") or "Area belum tersedia") if channel == "GraPARI" else ""
        region = field("regional") or "Region belum tersedia"
        unit_name = field("unit name") or "Unit belum tersedia"
        location = (channel, area, region, field("unit id"), unit_name)
        placements[agent] = (segment, label, location, field("employee name") if include_details else "", scores if include_details else None)
        buckets = [groups[segment]]
        for key in location_keys(location):
            by_segment = locations.setdefault(key, {})
            buckets.append(by_segment.setdefault(segment, empty_group()))
        for group in buckets:
            group["total"] += 1
            for index, score in enumerate(scores):
                group["high"][index] += score >= 80
            group["quadrants"][label] = group["quadrants"].get(label, 0) + 1
    return {"groups": groups, "locations": locations, "excluded": excluded,
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
        months[period], placements[period] = summarize(path, include_details)
    if not months:
        raise ValueError("No ASK workbooks found")
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
            for name, label, location, _, _ in latest.values():
                counts[name][label] = counts[name].get(label, 0) + 1
                for key in location_keys(location):
                    bucket = scoped.setdefault(key, {}).setdefault(name, {})
                    bucket[label] = bucket.get(label, 0) + 1
            summary["latestLocationQuadrants"][mode] = scoped
            summary["latestQuadrants"][mode] = counts
    return {"summary": months, "placements": placements} if include_details else months


if __name__ == "__main__":
    print(json.dumps(read_months(Path(sys.argv[1]), "--details" in sys.argv[2:])))
