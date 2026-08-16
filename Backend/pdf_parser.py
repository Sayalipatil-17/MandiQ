"""
pdf_parser.py — Extract tabular mandi price data from agmarknet PDF reports.

Handles the exact format from https://agmarknet.gov.in/alltypeofreports
Columns: State | District | Market | Commodity Group | Commodity | Date | Arrival Qty | Unit | Modal Price | Unit
"""

import re
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

import pdfplumber

log = logging.getLogger("mandiq.parser")

# ─── Date parsing ──────────────────────────────────────────────────────────────
_DATE_FORMATS = ["%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"]

def _parse_date(raw: str) -> Optional[str]:
    raw = raw.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


# ─── Number parsing ────────────────────────────────────────────────────────────
def _parse_num(raw: str) -> Optional[float]:
    if not raw:
        return None
    cleaned = raw.replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


# ─── Row normaliser ────────────────────────────────────────────────────────────
def _normalise_row(cells: List[str]) -> Optional[Dict[str, Any]]:
    """
    Expected column order (agmarknet report):
      0: State | 1: District | 2: Market | 3: Commodity Group |
      4: Commodity | 5: Date | 6: Arrival Qty | 7: Arrival Unit |
      8: Modal Price | 9: Price Unit
    """
    cells = [str(c).strip() if c else "" for c in cells]

    # Skip header / note rows
    if len(cells) < 8:
        return None
    if "state" in cells[0].lower() or "note" in cells[0].lower():
        return None
    if not cells[5]:          # no date
        return None

    date = _parse_date(cells[5])
    if not date:
        return None

    arrival = _parse_num(cells[6])
    price   = _parse_num(cells[8]) if len(cells) > 8 else None

    if price is None:
        return None

    return {
        "state":     cells[0] or "Unknown",
        "district":  cells[1] or "Unknown",
        "market":    cells[2] or "Unknown",
        "group":     cells[3] or "Vegetables",
        "commodity": cells[4] or "Unknown",
        "date":      date,
        "arrival_qty":    arrival,
        "arrival_unit":   cells[7] if len(cells) > 7 else "Metric Tonnes",
        "modal_price":    price,
        "price_unit":     cells[9] if len(cells) > 9 else "Rs./Quintal",
    }


# ─── Regex fallback for text-based pages ─────────────────────────────────────
_ROW_RE = re.compile(
    r"(?P<commodity>\w[\w\s]+?)\s+"
    r"(?P<date>\d{2}-\d{2}-\d{4})\s+"
    r"(?P<arrival>[\d,]+\.?\d*)\s+Metric\s+Tonnes\s+"
    r"(?P<price>[\d,]+\.?\d*)\s+Rs\./Quintal",
    re.IGNORECASE,
)

def _parse_text_fallback(text: str) -> List[Dict[str, Any]]:
    records = []
    for m in _ROW_RE.finditer(text):
        date = _parse_date(m.group("date"))
        price = _parse_num(m.group("price"))
        arrival = _parse_num(m.group("arrival"))
        if date and price:
            records.append({
                "state":      "NCT of Delhi",
                "district":   "Delhi",
                "market":     "Azadpur APMC",
                "group":      "Vegetables",
                "commodity":  m.group("commodity").strip().title(),
                "date":       date,
                "arrival_qty": arrival,
                "arrival_unit": "Metric Tonnes",
                "modal_price": price,
                "price_unit": "Rs./Quintal",
            })
    return records


# ─── Main parser ──────────────────────────────────────────────────────────────
def parse_mandi_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Parse an agmarknet PDF and return a list of price records.
    Tries table extraction first; falls back to regex on raw text.
    """
    records: List[Dict[str, Any]] = []
    seen: set = set()       # dedup by (commodity, date, market)

    log.info(f"Parsing PDF: {pdf_path}")

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            # ── Try table extraction ──────────────────────────────────────────
            tables = page.extract_tables(
                table_settings={
                    "vertical_strategy":   "lines",
                    "horizontal_strategy": "lines",
                    "intersection_tolerance": 5,
                }
            )

            page_records = []
            for table in (tables or []):
                for row in table:
                    rec = _normalise_row(row)
                    if rec:
                        page_records.append(rec)

            # ── Fallback: raw text regex ──────────────────────────────────────
            if not page_records:
                text = page.extract_text() or ""
                page_records = _parse_text_fallback(text)

            # ── Also try words-based extraction for tricky PDFs ───────────────
            if not page_records:
                page_records = _extract_from_words(page)

            for rec in page_records:
                key = (rec["commodity"], rec["date"], rec["market"])
                if key not in seen:
                    seen.add(key)
                    records.append(rec)

            log.info(f"  Page {page_num}: {len(page_records)} records")

    log.info(f"Total unique records parsed: {len(records)}")
    return records


def _extract_from_words(page) -> List[Dict[str, Any]]:
    """Word-coordinate-based extraction for borderless tables."""
    words = page.extract_words(x_tolerance=3, y_tolerance=3)
    if not words:
        return []

    # Group words by y-coordinate (rows)
    rows_by_y: Dict[int, List] = {}
    for w in words:
        y_bucket = round(w["top"] / 5) * 5      # 5pt tolerance
        rows_by_y.setdefault(y_bucket, []).append(w)

    records = []
    for y, row_words in sorted(rows_by_y.items()):
        row_words.sort(key=lambda w: w["x0"])
        row_text = " ".join(w["text"] for w in row_words)

        date_m = re.search(r"\d{2}-\d{2}-\d{4}", row_text)
        price_m = re.search(r"([\d,]+\.?\d*)\s+Rs", row_text)
        arrival_m = re.search(r"([\d,]+\.?\d*)\s+Metric", row_text)

        if date_m and price_m:
            date = _parse_date(date_m.group())
            price = _parse_num(price_m.group(1))
            arrival = _parse_num(arrival_m.group(1)) if arrival_m else None

            # Try to extract commodity name (words before date)
            pre_date = row_text[:date_m.start()].strip()
            commodity_parts = pre_date.split()
            commodity = " ".join(
                w for w in commodity_parts
                if not any(c.isdigit() for c in w)
            ).strip()
            commodity = commodity[-30:] if len(commodity) > 30 else commodity

            if date and price and commodity:
                records.append({
                    "state":      "Unknown",
                    "district":   "Unknown",
                    "market":     "Azadpur APMC",
                    "group":      "Vegetables",
                    "commodity":  commodity.title(),
                    "date":       date,
                    "arrival_qty": arrival,
                    "arrival_unit": "Metric Tonnes",
                    "modal_price": price,
                    "price_unit": "Rs./Quintal",
                })
    return records
