"""Load local attendance and assessment records for server-side aggregation."""
from bisect import bisect_right
from collections import Counter
from datetime import date, datetime, timedelta
import json
import math
from pathlib import Path
import re
import sys

from xlsx_rows import xlsx_records, xlsx_sheet_names

MONTHS = {
    name: f"{number:02d}" for number, name in enumerate(
        ("januari", "februari", "maret", "april", "mei", "juni", "juli",
         "agustus", "september", "oktober", "november", "desember"), 1)
}
MONTHS.update(sept="09", okt="10")
CHANNELS = {"grapari": "GraPARI", "call center": "Call Center",
            "contact center": "Call Center", "ecare": "E-Care", "e-care": "E-Care"}
MOBILE_TICKET_REGIONS = {
    "Area 1": {"sumbagsel", "sumbagteng", "sumbagut"},
    "Area 2": {"centraljakarta", "eastjakarta", "westjakarta", "jakartabanten", "easternjabotabek", "jabar", "jawabarat"},
    "Area 3": {"jateng", "jatengdiy", "jatim", "balinusra"},
    "Area 4": {"kalimantan", "sulawesi", "papuamaluku"},
}
TRAINING_SHEETS = ("1.A. Recap Pre-post Test Online", "2.A.Recap Pre-post Test Offline")
TRAINING_HEADERS = ("nik siad", "unit grapari", "regional", "area", "unit type", "batch",
                    "kehadiran", "submit pre test", "nilai pre test", "submit post test",
                    "nilai post test", "training", "tanggal", "jenis training", "metode")
TRAINING_OPTIONAL_HEADERS = ("fungsi kerja", "submit survey", "nama")
TRYOUT_HEADERS = ("player name", "total questions attempted", "accuracy",
                  "yet to be graded", "ungraded", "started at")


def score(text):
    try:
        value = float(text)
        return value if math.isfinite(value) and 0 <= value <= 100 else None
    except ValueError:
        return None


def training_day(value):
    if re.fullmatch(r"\d+(?:\.\d+)?", value):
        return (date(1899, 12, 30) + timedelta(days=int(float(value)))).isoformat()
    return date.fromisoformat(value[:10]).isoformat()


def same_name(first, second):
    return re.sub(r"[^a-z0-9]", "", first.casefold()) == re.sub(r"[^a-z0-9]", "", second.casefold())


def placements(folder, ids, latest_needed):
    if not folder or not ids:
        return {}
    snapshots = {}
    columns = ("nik siad", "ctp", "business model", "area", "regional", "unit id", "unit name")
    for path in sorted(folder.glob("*.xlsx")):
        match = re.fullmatch(r"ASK_(\d{4}-\d{2})\.xlsx", path.name, re.I)
        legacy = re.fullmatch(r"Data Attitude Skill Knowledge - ([a-z]+) (\d{4})\.xlsx", path.name, re.I)
        month = match[1] if match else None
        if legacy and legacy[1].casefold() in MONTHS:
            month = f"{legacy[2]}-{MONTHS[legacy[1].casefold()]}"
        if not month or month > latest_needed:
            continue
        snapshot = {}
        for row in xlsx_records(path, "Data ASK", columns):
            if row["nik siad"] not in ids:
                continue
            channel = CHANNELS.get(row["ctp"].casefold(), "")
            model = row["business model"].upper()
            snapshot[row["nik siad"]] = {
                "channel": channel,
                "model": model if channel == "GraPARI" and model in {"MOMO", "TOMO"} else "",
                "area": row["area"] if channel == "GraPARI" else "",
                "region": row["regional"], "unit": row["unit name"], "unitId": row["unit id"],
            }
        snapshots[month] = snapshot
    return snapshots


def read_training_rows(folder):
    if not folder:
        return []
    path = folder / "Report Training.xlsx"
    sheets = ("Online", "Offline")
    if not path.is_file():
        path = folder / "Recap Report Training.xlsx"
        sheets = TRAINING_SHEETS
    return [row for sheet in sheets
            for row in xlsx_records(path, sheet, TRAINING_HEADERS, TRAINING_OPTIONAL_HEADERS)
            if all(row[key] for key in ("nik siad", "tanggal", "training")) and row["kehadiran"].upper() == "V"]


def ticket_day(value):
    try:
        if "/" in value:
            first, second, year = map(int, value.split()[0].split("/"))
            if first > 12:
                return date(year, second, first).isoformat()
            if second > 12:
                return date(year, first, second).isoformat()
            # Both date orders occur in these workbooks.
            return date(year, first, second).isoformat() if first == second else ""
        return training_day(value)
    except (ValueError, OverflowError):
        return ""


def mobile_bad_ticket_rows(path):
    if not path.is_file():
        return
    fields = ("case_id", "tgl_tiket", "created_date", "bad_ticket", "case_type_3",
              "creator", "unit_name", "unit_type", "regional", "ctp")
    for sheet in xlsx_sheet_names(path):
        label = re.fullmatch(r"BT ([a-z]+)", sheet.strip(), re.I)
        if not label or label[1].casefold() not in MONTHS:
            continue
        for row in xlsx_records(path, sheet, fields):
            report_date = ticket_day(row["tgl_tiket"])
            if not row["case_id"] or not report_date or report_date[5:7] != MONTHS[label[1].casefold()]:
                continue
            ctp = " ".join(row["ctp"].casefold().split())
            region = row["regional"]
            unit = " ".join(row["unit_name"].split()).upper()
            site, area = "", ""
            if ctp == "grapari":
                channel = "GraPARI"
                region_key = re.sub(r"[^a-z0-9]", "", region.casefold())
                area = next((name for name, regions in MOBILE_TICKET_REGIONS.items() if region_key in regions), "Area lain")
            elif ctp in {"site 1 bandung", "site 2 semarang"}:
                site, region = ("Site 1 · Bandung", "Jabar") if ctp == "site 1 bandung" else ("Site 2 · Semarang", "Jateng-DIY")
                is_ecare = re.match(r"^E[ -]*CARE\b", unit)
                channel = "E-Care" if is_ecare else "Call Center"
                if not is_ecare and row["unit_type"].casefold() != "callcenter":
                    continue
            else:
                continue
            category = row["bad_ticket"].removeprefix("#").replace("_", " ").capitalize() or "Kategori belum tercatat"
            yield (report_date, row["case_id"], channel, area, region, unit, site, category,
                   row["case_type_3"], row["creator"], ticket_day(row["created_date"]))


def load_bad_tickets(folder, hard_skill, mobile_path):
    sources = (
        ("1. Bad Ticket Grapari All Area (Feb-Okt 2026) (1).xlsx", "Raw All Grapari"),
        ("2. Bad Ticket all BUKAN Grapari (Feb-Okt 2026).xlsx", "All CTP (non GraPARI)"),
    )
    months = dict(zip("JAN FEB MAR APR MEI JUN JUL AGT SEP OKT NOV DES".split(), range(1, 13)))
    headers = ("periode input", "ticket id", "klasifikasi unit creator", "unit name creator", "kategori bad tiket")
    channels = {**CHANNELS, "e care": "E-Care"}
    fields = ("month", "channel", "area", "region", "unit", "site", "category", "symptom", "service")
    trained, names = {}, {}
    for record in sorted(hard_skill, key=lambda row: row["date"]):
        if record["material"] == "Bad Ticket":
            key = (record["channel"], record["id"].strip())
            trained.setdefault(key, record["date"])
            if record.get("name"):
                names[key] = record["name"]
    observations = Counter()
    agent_tickets = {}
    mobile_dates = {}

    def add_ticket(dimensions, ticket_id, agent, created):
        month, channel = dimensions[:2]
        observations[dimensions] += 1
        if channel not in {"GraPARI", "Call Center", "E-Care"} or not re.fullmatch(r"\d{8}", agent):
            return
        key = (channel, agent)
        training_date = trained.get(key, "")
        matched = bool(training_date and created)
        after = matched and created > training_date
        service = dimensions[-1]
        ticket_key = (*key, service, ticket_id)
        existing = agent_tickets.get(ticket_key)
        if existing is None or month < existing[0]:
            agent_tickets[ticket_key] = (*dimensions[:6], agent, names.get(key, ""), matched, after, service)

    for filename, sheet in sources:
        if not folder:
            break
        path = folder / filename
        if not path.is_file():
            continue
        if sheet == "Raw All Grapari":
            try:
                for member in xlsx_records(path, "SIAD 31102026", ("nik", "full_name")):
                    if member["nik"] and member["full_name"]:
                        names.setdefault(("GraPARI", member["nik"]), member["full_name"])
            except ValueError:
                # The roster is optional; ranks can still show a masked SIAD.
                pass
        for row in xlsx_records(path, sheet, headers, ("area", "region", "siad creator", "create date", "kip_symptomp")):
            match = re.fullmatch(r"([A-Z]{3})\s+(\d{4})", row["periode input"].upper())
            channel = channels.get(" ".join(row["klasifikasi unit creator"].lower().split()))
            if not match or match[1] not in months or not channel or not row["ticket id"]:
                continue
            month = f"{match[2]}-{months[match[1]]:02d}"
            unit = " ".join(row["unit name creator"].split()).upper()
            city = re.search(r"\b(BANDUNG|SEMARANG)\b", unit) if channel != "GraPARI" else None
            site = {"BANDUNG": "Site 1 · Bandung", "SEMARANG": "Site 2 · Semarang"}[city[1]] if city else ""
            region = {"BANDUNG": "Jabar", "SEMARANG": "Jateng-DIY"}[city[1]] if city else row.get("region", "")
            area = row.get("area", "").title()
            dimensions = (month, channel, area, region, unit, site,
                          row["kategori bad tiket"] or "Kategori belum tercatat",
                          row.get("kip_symptomp", ""), "Fixed")
            add_ticket(dimensions, row["ticket id"], row.get("siad creator", ""), ticket_day(row.get("create date", "")))
    seen = set()
    for day, ticket_id, channel, area, region, unit, site, category, symptom, agent, created in mobile_bad_ticket_rows(mobile_path):
        month = day[:7]
        key = (month, ticket_id)
        if key in seen:
            continue
        seen.add(key)
        mobile_dates[month] = max(mobile_dates.get(month, ""), day)
        add_ticket((month, channel, area, region, unit, site, category, symptom, "Mobile"), ticket_id, agent, created)
    agents = Counter(agent_tickets.values())
    return ([{**dict(zip(fields, key)), "count": count} for key, count in observations.items()],
            [{**dict(zip((*fields[:6], "agent", "name", "matched", "after", "service"), key)), "count": count}
             for key, count in agents.items()], mobile_dates)


def read_local_report(filename):
    path = Path(__file__).resolve().parents[1] / "private-data" / filename
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, ValueError):
        print(f"Could not read local report {filename}.", file=sys.stderr)
        return None


def training_sessions(rows, key_for, batch_for):
    prepared = [(row, key_for(row), batch_for(row["batch"])) for row in rows]
    batches = {}
    for _, key, batch in prepared:
        if batch:
            batches.setdefault(key, set()).add(batch)
    for row, key, batch in prepared:
        candidates = batches.get(key, set())
        yield row, key, batch or (next(iter(candidates)) if len(candidates) == 1 else "")


def merge_training_scores(existing, record, key, conflicts):
    for kind in ("pre", "post"):
        previous, incoming = existing[kind], record[kind]
        if previous is not None and incoming is not None and previous != incoming:
            conflicts.add((key, kind))
        if previous is None:
            existing[kind] = incoming


def training_scores(row):
    return {
        "pre": score(row["nilai pre test"]) if row["submit pre test"].upper() == "V" else None,
        "post": score(row["nilai post test"]) if row["submit post test"].upper() == "V" else None,
    }


def load_training(rows):
    records = {}
    conflicting_scores = set()

    def session_parts(row):
        return (training_day(row["tanggal"]), row["training"].casefold(), row["metode"].casefold())

    for row, (day, event, method), batch in training_sessions(rows, session_parts, lambda batch: batch):
        title = row["training"]
        session = (day, event, batch, method)
        key = (row["nik siad"], session)
        program = "Bad Ticket" if "bad ticket" in title.casefold() else (
            "ACS Booster" if re.search(r"\bacs\b.*booster", title, re.I) else "")
        area = row["area"]
        channel = CHANNELS.get(row["unit type"].casefold(), "")
        if not channel and area.casefold().startswith("area "):
            channel = "GraPARI"
        record = {
            "id": row["nik siad"], "date": day, "session": session,
            "title": title, "type": row["jenis training"], "program": program,
            "channel": channel, "area": area if channel == "GraPARI" else "",
            "region": row["regional"], "unit": row["unit grapari"],
            **training_scores(row),
        }
        if key in records:
            merge_training_scores(records[key], record, key, conflicting_scores)
        else:
            records[key] = record
    for key, kind in conflicting_scores:
        records[key][kind] = None
    return list(records.values())


def load_hard_skill(rows):
    def clean(value):
        return " ".join(value.split())

    def session_parts(row):
        return (training_day(row["tanggal"]), clean(row["training"]).casefold(), clean(row["metode"]).casefold())

    def material_for(event, title):
        if "bad ticket" in event:
            return "Bad Ticket"
        if re.search(r"\bacs\s+i?booster\b", event):
            return "ACS iBooster"
        return title

    eligible = [row for row in rows if clean(row["jenis training"]).casefold() == "hard skill"]
    records = {}
    conflicting_scores = set()
    batch_labels = {clean(row["batch"]).casefold(): clean(row["batch"]) for row in eligible if row["batch"]}
    for row, (day, event, method), batch in training_sessions(eligible, session_parts, lambda label: clean(label).casefold()):
        session = (day, event, method, batch)
        key = (row["nik siad"], session)
        area_label = clean(row["area"])
        area_match = re.fullmatch(r"area\s*0*([1-4])", area_label, re.I)
        site_match = re.fullmatch(r"(?:contact\s*center|call\s*center|site)\s*0*([1-2])", area_label, re.I)
        area = f"Area {area_match[1]}" if area_match else ""
        site = f"Site {site_match[1]}" if site_match else ""
        channel = CHANNELS.get(clean(row["unit type"]).casefold()) or ("GraPARI" if area else "")
        title = clean(row["training"])
        record = {
            "id": row["nik siad"], "date": day, "session": session,
            "name": clean(row.get("nama", "")),
            "material": material_for(event, title), "title": title,
            "batch": batch_labels.get(batch, ""), "method": method.capitalize(),
            "channel": channel, "area": area, "site": site,
            "region": clean(row["regional"]), "unit": clean(row["unit grapari"]),
            "function": clean(row.get("fungsi kerja", "")),
            "surveySubmitted": row.get("submit survey", "").upper() == "V",
            **training_scores(row),
        }
        if key in records:
            existing = records[key]
            merge_training_scores(existing, record, key, conflicting_scores)
            existing["surveySubmitted"] |= record["surveySubmitted"]
            for field in ("channel", "area", "site", "region", "unit", "function"):
                if not existing[field]:
                    existing[field] = record[field]
        else:
            records[key] = record
    for key, kind in conflicting_scores:
        records[key][kind] = None
    return list(records.values())


def load_tryout(folder):
    if not folder:
        return []
    pattern = r"TryOut_W(\d+)_([a-z]+)(\d{4})_(Basic|Intermediate|Advance|Expert)_Susulan(\d*)-.+\.xlsx"
    records = []
    sessions = set()
    for path in sorted(folder.glob("*.xlsx")):
        match = re.fullmatch(pattern, path.name, re.I)
        if not match or match[2].casefold() not in MONTHS:
            continue
        week, month, year, level, followup = match.groups()
        period = f"{year}-{MONTHS[month.casefold()]}"
        session = (period, int(week), level.title(), followup)
        if session in sessions:
            raise ValueError("Multiple Tryout exports for one slot")
        sessions.add(session)
        for row in xlsx_records(path, "Participant Data", TRYOUT_HEADERS):
            if not row["total questions attempted"] or int(row["total questions attempted"]) < 1:
                continue
            day = datetime.strptime(row["started at"], "%a %d %b %Y,%I:%M %p").date().isoformat()
            if not day.startswith(period):
                raise ValueError("Tryout event does not match the export month")
            nik = set(re.findall(r"(?<!\d)\d{8}(?!\d)", row["player name"]))
            accuracy = score(row["accuracy"][:-1]) if row["accuracy"].endswith("%") else None
            pending = any(row[column] not in ("", "0") for column in ("yet to be graded", "ungraded"))
            records.append({
                "id": nik.pop() if len(nik) == 1 else "", "date": day,
                "session": session, "week": int(week), "level": level.title(),
                "score": accuracy if not pending else None,
            })
    if not sessions:
        raise ValueError("No matching Tryout exports")
    return records


def attach_locations(training, tryout, ask_folder):
    all_rows = training + tryout
    if not all_rows:
        return
    snapshots = placements(ask_folder, {row["id"] for row in all_rows if row["id"]},
                           max(row["date"][:7] for row in all_rows))
    months = sorted(snapshots)
    for row in all_rows:
        current = bisect_right(months, row["date"][:7])
        placement = snapshots[months[current - 1]].get(row["id"], {}) if current else {}
        shared_site = row.get("site") and not row.get("channel")
        if shared_site and placement.get("channel") not in {"Call Center", "E-Care"}:
            placement = {}
        if row.get("channel") and row["channel"] != placement.get("channel"):
            placement = {}
        # The event location takes precedence. Only borrow the unit code when the names agree.
        if row.get("unit") and not same_name(row["unit"], placement.get("unit", "")):
            placement = {**placement, "unitId": "", "model": ""}
        for key in ("channel", "model", "area", "region", "unit", "unitId"):
            row[key] = row.get(key) or placement.get(key, "")
        if shared_site and not row["channel"]:
            row["channel"] = "Call Center"


if __name__ == "__main__":
    training_folder, tryout_folder, ask_folder = (Path(value) if value else None for value in sys.argv[1:])
    training_rows = read_training_rows(training_folder)
    training, tryout = load_training(training_rows), load_tryout(tryout_folder)
    hard_skill = load_hard_skill(training_rows)
    attach_locations(training + hard_skill, tryout, ask_folder)
    mobile_path = Path(__file__).resolve().parents[1] / "private-data" / "Data Bad Ticket All CTP Mobile.xlsx"
    bad_tickets, bad_ticket_agents, mobile_dates = load_bad_tickets(training_folder, hard_skill, mobile_path)
    print(json.dumps({"training": training, "tryout": tryout, "hardSkill": hard_skill,
                      "badTickets": bad_tickets, "badTicketAgents": bad_ticket_agents, "mobileTicketDates": mobile_dates,
                      "contactCenterTickets": read_local_report("contact-center-ticket-report.json"),
                      "badTicketSlides": read_local_report("bad-ticket-slides.json"),
                      "hardSkillPerformance": read_local_report("hard-skill-performance.json"),
                      "hasTraining": bool(training_folder), "hasTryout": bool(tryout_folder)}))
