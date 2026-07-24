#!/usr/bin/env python3
"""
Extractor for the ADR "Lok Sabha Elections 2024 — winning candidates" report PDF.

Usage: extract_adr.py <path-to-report.pdf>
Emits JSON on stdout:
  meta      — parser version, page count
  summary   — the report's own printed figures (reconciliation anchors) + serious-case criteria
  winners   — all winners from the assets annexure (sno, name, state, constituency, party, age, pageRef)
  convicted — the printed winners-with-declared-convictions table
  caseBlocks— per-winner criminal annexure blocks with numbered case entries (pending/convicted)

Extraction is layout-based (pdfplumber). Raw text is preserved for every case
entry; downstream code treats these records as machine_checked, never verified.
"""

import json
import re
import sys

import pdfplumber

PARSER_VERSION = "1.1.0"

FOOTER_RE = re.compile(
    r"^(Data in this Kit is presented|source of this analysis|Page \d+ of \d+|Website: ?-?www)", re.I
)


def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def page_text(page):
    return page.extract_text() or ""


def extract_summary(pdf):
    t4 = page_text(pdf.pages[3])
    t6 = page_text(pdf.pages[5])
    t7 = page_text(pdf.pages[6])
    t11 = page_text(pdf.pages[10])

    summary = {"rawSummaryPage": clean(t4)[:2000], "pageRefs": {"summary": 4, "criteria": 6, "history": 7, "partySerious": 11}}

    m = re.search(r"all (\d{3}) winning candidates", t4 + " " + t6)
    summary["analyzed"] = int(m.group(1)) if m else None
    m = re.search(r"(\d{3}) \((\d{1,2})%\) winning candidates have declared criminal cases", t6)
    if m:
        summary["withCases"] = int(m.group(1))
        summary["withCasesPct"] = int(m.group(2))
    hist = re.findall(r"^(20\d\d) (\d{3}) (\d{2,3}) (\d{1,2})% (\d{2,3}) (\d{1,2})%", t7, re.M)
    summary["history"] = [
        {
            "year": int(y),
            "analyzed": int(a),
            "withCases": int(c),
            "withCasesPct": int(cp),
            "withSerious": int(s),
            "withSeriousPct": int(sp),
        }
        for (y, a, c, cp, s, sp) in hist
    ]
    for h in summary["history"]:
        if h["year"] == 2024:
            summary["withSerious"] = h["withSerious"]
            summary["withSeriousPct"] = h["withSeriousPct"]

    # Serious-criteria box (numbered list, interleaved with body text on p6)
    crit = re.findall(r"\d\.\s+((?:Offence|If|Assault|Crimes?)[^\n]*(?:\n(?![0-9]\.)[^\n]*)?)", t6)
    summary["seriousCriteriaRaw"] = [clean(c) for c in crit][:8]

    # Party-wise serious sentence => party seat totals (reconciliation anchors)
    seats = {}
    for n, pct, d, party in re.findall(
        r"(\d{1,3})\s*\((\d{1,2})%\)\s*out of\s*(\d{1,3})\s*[Ww]inning candidates (?:from|fielded by)\s+([A-Za-z()& ]+?)(?:,| and |\s+have)", t11
    ):
        seats[clean(party)] = {"seats": int(d), "withSerious": int(n), "withSeriousPct": int(pct)}
    summary["partySeatAnchors"] = seats
    return summary


WINNERS_HEADER = re.compile(r"S\.No\.\s+Name\s+State\s+Constituency\s+Party\s+Age", re.I)


def extract_winners(pdf):
    winners = []
    started = False
    for idx in range(30, 120):
        page = pdf.pages[idx]
        txt = page_text(page)
        if not WINNERS_HEADER.search(txt.replace("\n", " ")[:400]):
            if started:
                break
            continue
        started = True
        for table in page.extract_tables():
            for row in table:
                cells = [clean(str(c)) if c else "" for c in row]
                if not cells or not re.fullmatch(r"\d{1,3}", cells[0] or ""):
                    continue
                # columns: sno, name, state, constituency, party, age, movable, immovable, total, pan
                if len(cells) < 6:
                    continue
                winners.append(
                    {
                        "sno": int(cells[0]),
                        "name": cells[1],
                        "state": cells[2],
                        "constituency": cells[3],
                        "party": cells[4],
                        "age": int(cells[5]) if re.fullmatch(r"\d{2,3}", cells[5]) else None,
                        "pageRef": idx + 1,
                    }
                )
    return winners


def extract_convicted(pdf):
    rows = []
    for idx in (6, 7):
        txt = page_text(pdf.pages[idx])
        in_section = "declared convicted cases" in txt or idx == 7
        if not in_section:
            continue
        for line in txt.split("\n"):
            m = re.match(r"^(\d{1,2}) (.+?) (\d{1,3}) (\d{1,3}) (\d{1,3})$", clean(line))
            if m and int(m.group(1)) <= 27:
                rows.append(
                    {
                        "sno": int(m.group(1)),
                        "nameStatePcParty": m.group(2),
                        "totalCases": int(m.group(3)),
                        "convictedCases": int(m.group(4)),
                        "seriousIpc": int(m.group(5)),
                        "pageRef": idx + 1,
                    }
                )
    # de-dup by sno keeping first occurrence
    seen = {}
    for r in rows:
        seen.setdefault(r["sno"], r)
    return [seen[k] for k in sorted(seen)]


CASES_HEADER = "S.No. Winner Information"
CASE_ENTRY_RE = re.compile(r"^(\d{1,3})\.\s+(.*)$")
WINNER_START_RE = re.compile(r"^(?:(\d{1,3})\s+)?Name\s*:\s*(.+)$")
FIELD_RES = {
    "state": re.compile(r"^State\s*:\s*(.+)$", re.I),
    "constituency": re.compile(r"^Constituency\s*:\s*(.+)$", re.I),
    "party": re.compile(r"^Party\s*:\s*(.+)$", re.I),
    "totalCases": re.compile(r"^Total Cases\s*:\s*(\d+)", re.I),
    "seriousIpc": re.compile(r"^Serious IPC\s*:\s*(\d+)", re.I),
    "otherIpc": re.compile(r"^Other IPC\s*:\s*(\d+)", re.I),
}


def parse_case_entry(raw):
    entry = {"raw": clean(raw)}

    def grab(pattern):
        m = re.search(pattern, raw, re.I | re.S)
        return clean(m.group(1)) if m else None

    entry["ipcSectionsRaw"] = grab(r"IPC Sections?\s*-\s*(.*?)(?:,\s*Other Details|$)")
    entry["otherDetailsRaw"] = grab(r"Other Details\s*-\s*(.*?)(?:,?\s*Case No\.|$)")
    entry["caseNoRaw"] = grab(r"Case No\.?\s*-\s*(.*?)(?:,\s*Court|$)")
    entry["courtRaw"] = grab(r"Court\s*-\s*(.*?)(?:,\s*FIR No\.|,\s*Punishment|$)")
    entry["firRaw"] = grab(r"FIR No\.?\s*-\s*(.*?)(?:,?\s*Charges? Framed|,\s*Punishment|$)")
    entry["chargesFramed"] = grab(r"Charges? Framed\s*-\s*(\w+)")
    entry["appealFiled"] = grab(r"Appeal Filed\s*-\s*(\w+)")
    entry["punishmentRaw"] = grab(r"Punishment:?\s*-\s*(.*?)(?:,\s*Date of Order of Conviction|,\s*Appeal Filed|$)")
    entry["convictionDateRaw"] = grab(r"Date of Order of Conviction\s*-\s*(.*?)(?:,\s*Appeal|$)")
    entry["appealDetailsRaw"] = grab(r"Details of Appeal\s*-\s*(.*)$")
    return entry


def extract_case_blocks(pdf):
    blocks = []
    current = None
    mode = None
    entry_lines = None

    def flush_entry():
        nonlocal entry_lines
        if current is not None and entry_lines:
            text = " ".join(entry_lines)
            target = current["pending"] if mode == "pending" else current["convicted"]
            target.append(parse_case_entry(text))
        entry_lines = None

    def flush_block():
        nonlocal current, mode
        flush_entry()
        if current is not None:
            blocks.append(current)
        current, mode = None, None

    for idx in range(100, len(pdf.pages)):
        page = pdf.pages[idx]
        head = page_text(page)[:200]
        if CASES_HEADER not in head.replace("\n", " "):
            if current is not None:
                flush_block()
            continue
        left = page.crop((0, 0, page.width * 0.56, page.height)).extract_text() or ""
        for rawline in left.split("\n"):
            line = clean(rawline)
            if not line or FOOTER_RE.match(line) or line.startswith("S.No. Winner Information"):
                continue
            m = WINNER_START_RE.match(line)
            if m:
                flush_block()
                current = {
                    "sno": int(m.group(1)) if m.group(1) else None,
                    "name": clean(m.group(2)),
                    "state": None,
                    "constituency": None,
                    "party": None,
                    "totalCases": None,
                    "seriousIpc": None,
                    "otherIpc": None,
                    "pending": [],
                    "convicted": [],
                    "pageRef": idx + 1,
                }
                mode = None
                continue
            if current is None:
                continue
            matched_field = False
            for key, fre in FIELD_RES.items():
                fm = fre.match(line)
                if fm:
                    val = clean(fm.group(1))
                    current[key] = int(val) if key in ("totalCases", "seriousIpc", "otherIpc") else val
                    matched_field = True
                    break
            if matched_field:
                continue
            # Marker lines can carry BOTH sections on one physical line, e.g.
            # "Cases (Pending) -----No Cases---- Cases (Convicted)".
            # The LAST marker on the line governs what follows; a trailing
            # "No Cases" after it means neither.
            markers = [(m.start(), "pending") for m in re.finditer(r"Cases \(Pending\)", line, re.I)]
            markers += [(m.start(), "convicted") for m in re.finditer(r"Cases \(Convicted\)", line, re.I)]
            if markers:
                flush_entry()
                pos, last_mode = max(markers)
                tail = line[pos:]
                mode = None if re.search(r"No Cases", tail, re.I) else last_mode
                continue
            if re.search(r"^-*\s*No Cases\s*-*$", line, re.I):
                flush_entry()
                continue
            em = CASE_ENTRY_RE.match(line)
            if em and mode in ("pending", "convicted"):
                flush_entry()
                entry_lines = [em.group(2)]
                continue
            if entry_lines is not None:
                entry_lines.append(line)
    flush_block()
    return blocks


def main():
    path = sys.argv[1]
    with pdfplumber.open(path) as pdf:
        out = {
            "meta": {"parserVersion": PARSER_VERSION, "pages": len(pdf.pages)},
            "summary": extract_summary(pdf),
            "winners": extract_winners(pdf),
            "convicted": extract_convicted(pdf),
            "caseBlocks": extract_case_blocks(pdf),
        }
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
