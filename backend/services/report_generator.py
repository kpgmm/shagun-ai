"""PDF report generation for Shagun AI.

Style: Clean, minimal — white backgrounds, red accent headings,
green amounts, full-grid table with light gray borders.
Uses Arial (Windows) / DejaVuSans (Linux) for ₹ symbol support.
"""
import io
import os
from datetime import datetime, timezone
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Font registration (needed for ₹ symbol) ────────────────────────────────
_FONT_CANDIDATES = [
    ("C:/Windows/Fonts/arial.ttf",    "C:/Windows/Fonts/arialbd.ttf"),
    ("C:/Windows/Fonts/calibri.ttf",  "C:/Windows/Fonts/calibrib.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
     "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/dejavu/DejaVuSans.ttf",
     "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
]

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

for _normal, _bold in _FONT_CANDIDATES:
    if os.path.exists(_normal) and os.path.exists(_bold):
        try:
            pdfmetrics.registerFont(TTFont("_ShagunNormal", _normal))
            pdfmetrics.registerFont(TTFont("_ShagunBold", _bold))
            FONT = "_ShagunNormal"
            FONT_BOLD = "_ShagunBold"
            break
        except Exception:
            continue

# ── Color palette ──────────────────────────────────────────────────────────
RED       = colors.HexColor("#CC2200")   # title, column headers
GREEN     = colors.HexColor("#16A34A")   # monetary values
DARK      = colors.HexColor("#111827")   # body text
MUTED     = colors.HexColor("#6B7280")   # labels, footer
BORDER    = colors.HexColor("#D1D5DB")   # table grid and box borders
LIGHT_BG  = colors.HexColor("#F9FAFB")   # summary box background

PAGE_W, PAGE_H = A4
MARGIN = 1.8 * cm
USABLE_W = PAGE_W - 2 * MARGIN


# ── Style helpers ──────────────────────────────────────────────────────────
def _s(name, **kwargs) -> ParagraphStyle:
    return ParagraphStyle(name, **kwargs)


STYLES = {
    "title": _s("title",
        fontName=FONT_BOLD, fontSize=22, textColor=RED,
        alignment=TA_CENTER, spaceAfter=4, leading=28),
    "subtitle": _s("subtitle",
        fontName=FONT, fontSize=10, textColor=MUTED,
        alignment=TA_CENTER, spaceAfter=2),
    "generated": _s("generated",
        fontName=FONT, fontSize=9, textColor=MUTED,
        alignment=TA_CENTER, spaceAfter=0),
    "section": _s("section",
        fontName=FONT_BOLD, fontSize=10, textColor=RED,
        spaceBefore=14, spaceAfter=5, leading=13),
    "info_label": _s("info_label",
        fontName=FONT, fontSize=9, textColor=MUTED, leading=14),
    "info_value": _s("info_value",
        fontName=FONT_BOLD, fontSize=9, textColor=DARK, leading=14),
    "stat_label": _s("stat_label",
        fontName=FONT, fontSize=8, textColor=MUTED,
        alignment=TA_CENTER, leading=11),
    "stat_value": _s("stat_value",
        fontName=FONT_BOLD, fontSize=13, textColor=GREEN,
        alignment=TA_CENTER, leading=17),
    "stat_value_dark": _s("stat_value_dark",
        fontName=FONT_BOLD, fontSize=13, textColor=DARK,
        alignment=TA_CENTER, leading=17),
    "th": _s("th",
        fontName=FONT_BOLD, fontSize=9, textColor=RED, leading=12),
    "td": _s("td",
        fontName=FONT, fontSize=8, textColor=DARK, leading=11),
    "td_bold": _s("td_bold",
        fontName=FONT_BOLD, fontSize=8, textColor=DARK, leading=11),
    "td_amount": _s("td_amount",
        fontName=FONT_BOLD, fontSize=8, textColor=GREEN,
        alignment=TA_RIGHT, leading=11),
    "footer": _s("footer",
        fontName=FONT, fontSize=8, textColor=MUTED,
        alignment=TA_CENTER),
}


# ── Layout helpers ─────────────────────────────────────────────────────────
def _hr() -> HRFlowable:
    return HRFlowable(width=USABLE_W, thickness=0.5, color=BORDER,
                      spaceAfter=6, spaceBefore=2)


def _spacer(h: float = 8) -> Spacer:
    return Spacer(1, h)


def _fmt_date(dt) -> str:
    if dt is None:
        return "—"
    if hasattr(dt, "strftime"):
        return dt.strftime("%d %b %Y")
    return str(dt)


def _fmt_inr(amount: float) -> str:
    """Format as Indian rupee string, e.g. Rs.1,001"""
    return f"₹{int(amount):,}"


def _info_table(rows: list[tuple[str, str]]) -> Table:
    """Simple two-column key/value table, no borders."""
    col_label = USABLE_W * 0.28
    col_val   = USABLE_W * 0.72
    data = [
        [Paragraph(lbl, STYLES["info_label"]),
         Paragraph(val, STYLES["info_value"])]
        for lbl, val in rows
    ]
    t = Table(data, colWidths=[col_label, col_val])
    t.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _stat_box(items: list[tuple[str, str]], green_indices: set = None) -> Table:
    """
    Horizontal summary box with a light gray border.
    items: list of (label, value) pairs.
    green_indices: set of indices whose value should be green (default all green).
    """
    if green_indices is None:
        green_indices = set(range(len(items)))

    n = len(items)
    col_w = USABLE_W / n

    top_row = []
    bot_row = []
    for i, (lbl, val) in enumerate(items):
        val_style = STYLES["stat_value"] if i in green_indices else STYLES["stat_value_dark"]
        top_row.append(Paragraph(val, val_style))
        bot_row.append(Paragraph(lbl, STYLES["stat_label"]))

    t = Table([top_row, bot_row], colWidths=[col_w] * n)
    t.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT_BG),
    ]))
    return t


def _entries_table(entries: list, activity_lookup: Optional[dict]) -> Table:
    """
    Full entries table with clean grid.
    activity_lookup: {str(ObjectId) -> name} — if provided, Activity column is shown.
    """
    has_act = activity_lookup is not None

    if has_act:
        headers  = ["#", "Guest Name", "Village", "Amount", "Mode", "Activity"]
        col_pcts = [0.05, 0.22, 0.17, 0.14, 0.09, 0.33]
    else:
        headers  = ["#", "Guest Name", "Village", "Amount", "Mode"]
        col_pcts = [0.06, 0.30, 0.26, 0.22, 0.16]

    col_widths = [USABLE_W * p for p in col_pcts]

    # Header row
    rows = [[Paragraph(h, STYLES["th"]) for h in headers]]

    # Data rows
    for i, e in enumerate(entries, 1):
        aid = e.get("activity_id")
        act_name = activity_lookup.get(str(aid), "General") if (has_act and aid) else ("General" if has_act else None)
        is_gift = e.get("mode") == "gift"
        amount_cell = (
            Paragraph(e.get("gift_item") or "Gift", STYLES["td"])
            if is_gift
            else Paragraph(_fmt_inr(e["amount"]), STYLES["td_amount"])
        )

        row = [
            Paragraph(str(i),            STYLES["td"]),
            Paragraph(e.get("name", ""), STYLES["td_bold"]),
            Paragraph(e.get("village", "") or "—", STYLES["td"]),
            amount_cell,
            Paragraph(e.get("mode", "").upper(), STYLES["td"]),
        ]
        if has_act:
            row.append(Paragraph(act_name or "—", STYLES["td"]))
        rows.append(row)

    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        # Full grid
        ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
        # Header row styling
        ("LINEBELOW",     (0, 0), (-1, 0),  1.0, RED),
        # Padding
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        # Amount column right-aligned
        ("ALIGN",         (3, 0), (3, -1),  "RIGHT"),
    ]))
    return t


# ── Public API ─────────────────────────────────────────────────────────────
def generate_event_pdf(
    event: dict,
    entries: list,
    rsvp: dict,
    activities: Optional[list] = None,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN,  bottomMargin=MARGIN,
        title=f"Shagun Report – {event.get('name', '')}",
    )
    story = []

    # Title
    event_type = event.get("type", "").replace("_", " ").title()
    story.append(Paragraph("Shagun Report", STYLES["title"]))
    story.append(Paragraph(f"{event.get('name', '')}  ·  {event_type}", STYLES["subtitle"]))
    generated = datetime.now(timezone.utc).strftime("%d %b %Y")
    story.append(Paragraph(f"Generated on {generated}", STYLES["generated"]))
    story.append(_spacer(12))
    story.append(_hr())

    # Event details
    story.append(Paragraph("Event Details", STYLES["section"]))
    story.append(_info_table([
        ("Date",    _fmt_date(event.get("event_date"))),
        ("Host",    event.get("host_name", "—")),
        ("Village", event.get("host_village", "—")),
        ("Status",  event.get("status", "—").capitalize()),
    ]))
    story.append(_spacer(12))

    # Financial summary — all entry amounts included; gifts shown separately
    gift_entries = [e for e in entries if e.get("mode") == "gift"]
    total      = sum(e["amount"] for e in entries)
    total_upi  = sum(e["amount"] for e in entries if e.get("mode") == "upi")
    total_cash = sum(e["amount"] for e in entries if e.get("mode") == "cash")
    total_gift = sum(e["amount"] for e in gift_entries)
    story.append(Paragraph("Financial Summary", STYLES["section"]))
    stat_items = [
        ("Total Collected",  _fmt_inr(total)),
        ("UPI",              _fmt_inr(total_upi)),
        ("Cash",             _fmt_inr(total_cash)),
        ("Total Entries",    str(len(entries))),
    ]
    if gift_entries:
        gift_label = f"{len(gift_entries)} item(s)"
        if total_gift > 0:
            gift_label += f" / {_fmt_inr(total_gift)}"
        stat_items.append(("Gifts", gift_label))
    story.append(_stat_box(stat_items, green_indices={0, 1, 2}))
    story.append(_spacer(10))

    # RSVP box
    if rsvp and rsvp.get("total", 0) > 0:
        story.append(Paragraph("Guest RSVP Summary", STYLES["section"]))
        story.append(_stat_box([
            ("Total Invited", str(rsvp.get("total", 0))),
            ("Coming",        str(rsvp.get("coming", 0))),
            ("Not Coming",    str(rsvp.get("not_coming", 0))),
            ("Pending",       str(rsvp.get("pending", 0))),
        ], green_indices={1}))
        story.append(_spacer(10))

    # Entries table
    story.append(Paragraph(f"All Entries  ({len(entries)} records)", STYLES["section"]))
    if entries:
        activity_lookup: Optional[dict] = None
        if activities:
            activity_lookup = {str(a["_id"]): a.get("name", "Unknown") for a in activities}
        story.append(_entries_table(entries, activity_lookup))
    else:
        story.append(Paragraph("No entries recorded for this event.", STYLES["info_label"]))

    # Footer
    story.append(_spacer(14))
    story.append(_hr())
    story.append(Paragraph("Generated by Shagun AI", STYLES["footer"]))

    doc.build(story)
    return buf.getvalue()


def generate_activity_pdf(
    activity: dict,
    entries: list,
    event_name: str,
) -> bytes:
    buf = io.BytesIO()
    act_type = (
        activity.get("custom_type_name")
        or activity.get("type", "").replace("_", " ").title()
    )
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN,  bottomMargin=MARGIN,
        title=f"Activity Report – {activity.get('name', '')}",
    )
    story = []

    # Title
    story.append(Paragraph("Activity Report", STYLES["title"]))
    story.append(Paragraph(f"{activity.get('name', '')}  ·  {act_type}", STYLES["subtitle"]))
    generated = datetime.now(timezone.utc).strftime("%d %b %Y")
    story.append(Paragraph(f"Generated on {generated}", STYLES["generated"]))
    story.append(_spacer(12))
    story.append(_hr())

    # Activity details
    story.append(Paragraph("Activity Details", STYLES["section"]))
    story.append(_info_table([
        ("Event",           event_name),
        ("Type",            act_type),
        ("Date",            _fmt_date(activity.get("date"))),
        ("Time",            activity.get("time") or "—"),
        ("Guests Assigned", str(len(activity.get("guest_ids", [])))),
    ]))
    story.append(_spacer(12))

    # Financial summary — all amounts included; gifts broken out separately
    gift_entries_act = [e for e in entries if e.get("mode") == "gift"]
    total      = sum(e["amount"] for e in entries)
    total_upi  = sum(e["amount"] for e in entries if e.get("mode") == "upi")
    total_cash = sum(e["amount"] for e in entries if e.get("mode") == "cash")
    total_gift_act = sum(e["amount"] for e in gift_entries_act)
    story.append(Paragraph("Financial Summary", STYLES["section"]))
    act_stat_items = [
        ("Total Collected",  _fmt_inr(total)),
        ("UPI",              _fmt_inr(total_upi)),
        ("Cash",             _fmt_inr(total_cash)),
        ("Total Entries",    str(len(entries))),
    ]
    if gift_entries_act:
        gift_act_label = f"{len(gift_entries_act)} item(s)"
        if total_gift_act > 0:
            gift_act_label += f" / {_fmt_inr(total_gift_act)}"
        act_stat_items.append(("Gifts", gift_act_label))
    story.append(_stat_box(act_stat_items, green_indices={0, 1, 2}))
    story.append(_spacer(10))

    # Entries table
    story.append(Paragraph(f"Entries  ({len(entries)} records)", STYLES["section"]))
    if entries:
        story.append(_entries_table(entries, activity_lookup=None))
    else:
        story.append(Paragraph("No entries recorded for this activity.", STYLES["info_label"]))

    # Footer
    story.append(_spacer(14))
    story.append(_hr())
    story.append(Paragraph("Generated by Shagun AI", STYLES["footer"]))

    doc.build(story)
    return buf.getvalue()
