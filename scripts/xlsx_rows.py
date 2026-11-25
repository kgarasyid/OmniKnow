"""Read cached XLSX cells from a named worksheet without changing the workbook."""
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile


def xlsx_sheet_names(path):
    with zipfile.ZipFile(path) as book:
        return [node.attrib["name"] for node in ET.fromstring(book.read("xl/workbook.xml")).iterfind(".//{*}sheet")]


def xlsx_rows(path, sheet_name):
    with zipfile.ZipFile(path) as book:
        strings = []
        if "xl/sharedStrings.xml" in book.namelist():
            strings = ["".join(t.text or "" for t in node.iterfind(".//{*}t"))
                       for node in ET.fromstring(book.read("xl/sharedStrings.xml"))]
        sheets = ET.fromstring(book.read("xl/workbook.xml")).iterfind(".//{*}sheet")
        sheet = next((item for item in sheets
                      if item.get("name", "").strip().casefold() == sheet_name.casefold()), None)
        if sheet is None:
            raise ValueError(f"Missing worksheet {sheet_name}")
        sheet_id = next(value for key, value in sheet.attrib.items() if key.endswith("}id"))
        relations = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
        target = next(rel.get("Target") for rel in relations if rel.get("Id") == sheet_id)
        sheet_path = target.lstrip("/") if target.startswith("/") else posixpath.join("xl", target)
        root = ET.fromstring(book.read(sheet_path))

    for row in root.iterfind(".//{*}row"):
        values = {}
        for cell in row:
            value = cell.findtext("{*}v", "")
            kind = cell.get("t")
            if kind == "s":
                value = strings[int(value)]
            elif kind == "inlineStr":
                value = "".join(t.text or "" for t in cell.iterfind(".//{*}t"))
            values[re.sub(r"\d", "", cell.get("r"))] = value.strip()
        yield values


def xlsx_records(path, sheet_name, required, optional=()):
    rows = iter(xlsx_rows(path, sheet_name))
    headers = {name.casefold(): column for column, name in next(rows, {}).items()}
    if set(required) - headers.keys():
        raise ValueError(f"Missing required headers in {sheet_name}")
    columns = {name: headers[name] for name in (*required, *optional) if name in headers}
    for row in rows:
        yield {name: row.get(column, "") for name, column in columns.items()}
