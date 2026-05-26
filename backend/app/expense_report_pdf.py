from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.expense_report import (
    CategorySummaryRow,
    ExpenseReportData,
    build_expense_report_data,
    expense_report_filename,
    format_report_amount,
    get_category_color,
)
from app.schemas import SavedInvoice

FONT = "Courier"
FONT_SIZE = 9
TITLE_SIZE = 11
LINE_HEIGHT_MM = 4.5
PIE_CHART_SIZE_MM = 32
PIE_CHART_GAP_MM = 4
SUMMARY_BLOCK_PADDING_MM = 2
SWATCH_SIZE_MM = 2.5
SWATCH_GAP_MM = 1.5
SWATCH_BASELINE_OFFSET_MM = 2.8
MARGIN_MM = 18
LOGO_MAX_WIDTH_MM = 65
LOGO_MAX_HEIGHT_MM = 14
PIE_CHART_SIZE_PX = 240

LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "expense-report-logo.png"


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    normalized = hex_color.lstrip("#")
    value = int(normalized, 16)
    return (value >> 16) & 255, (value >> 8) & 255, value & 255


def _fit_logo_box(
    natural_width: float,
    natural_height: float,
    max_width: float,
    max_height: float,
) -> tuple[float, float]:
    if natural_width <= 0 or natural_height <= 0:
        return max_width, max_height

    scale = min(max_width / natural_width, max_height / natural_height)
    return natural_width * scale, natural_height * scale


def _get_logo_dimensions(pixel_width: int, pixel_height: int) -> tuple[float, float]:
    fitted_width, _ = _fit_logo_box(
        pixel_width,
        pixel_height,
        LOGO_MAX_WIDTH_MM,
        LOGO_MAX_HEIGHT_MM,
    )
    aspect = pixel_width / pixel_height
    width_mm = fitted_width
    height_mm = width_mm / aspect
    return width_mm, height_mm


def _render_category_pie_chart(data: list[CategorySummaryRow], size_px: int = PIE_CHART_SIZE_PX) -> Image.Image | None:
    if not data:
        return None

    image = Image.new("RGBA", (size_px, size_px), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    center = size_px / 2
    radius = size_px / 2 - 2
    total = sum(max(row.amount, 0) for row in data)

    if total <= 0:
        draw.ellipse(
            (center - radius, center - radius, center + radius, center + radius),
            fill="#e2e8f0",
            outline="#cbd5e1",
            width=1,
        )
        return image

    start_angle = -90

    for index, row in enumerate(data):
        amount = max(row.amount, 0)
        if amount <= 0:
            continue

        slice_angle = (amount / total) * 360
        end_angle = start_angle + slice_angle
        color = _hex_to_rgb(get_category_color(index))

        if slice_angle >= 359.999:
            draw.ellipse(
                (center - radius, center - radius, center + radius, center + radius),
                fill=color,
                outline="#ffffff",
                width=2,
            )
        else:
            draw.pieslice(
                (center - radius, center - radius, center + radius, center + radius),
                start=start_angle,
                end=end_angle,
                fill=color,
                outline="#ffffff",
                width=2,
            )

        start_angle = end_angle

    return image


def _truncate_text(pdf: canvas.Canvas, text: str, max_width_mm: float, font_name: str, font_size: int) -> str:
    if pdf.stringWidth(text, font_name, font_size) <= max_width_mm * mm:
        return text

    truncated = text
    while truncated and pdf.stringWidth(f"{truncated}...", font_name, font_size) > max_width_mm * mm:
        truncated = truncated[:-1]
    return f"{truncated}..." if truncated else "..."


def _draw_summary_row(
    pdf: canvas.Canvas,
    x_mm: float,
    y_mm: float,
    width_mm: float,
    label: str,
    amount: str,
    color: str | None,
    page_height_mm: float,
) -> None:
    content_x = x_mm

    if color:
        r, g, b = _hex_to_rgb(color)
        pdf.setFillColorRGB(r / 255, g / 255, b / 255)
        swatch_y = page_height_mm - y_mm + SWATCH_BASELINE_OFFSET_MM - SWATCH_SIZE_MM
        pdf.rect(content_x * mm, swatch_y * mm, SWATCH_SIZE_MM * mm, SWATCH_SIZE_MM * mm, fill=1, stroke=0)
        content_x += SWATCH_SIZE_MM + SWATCH_GAP_MM

    pdf.setFont(FONT, FONT_SIZE)
    pdf.setFillColorRGB(0, 0, 0)
    pdf.drawString(content_x * mm, (page_height_mm - y_mm) * mm, label)

    amount_width_mm = pdf.stringWidth(amount, FONT, FONT_SIZE) / mm
    amount_x = x_mm + width_mm - amount_width_mm
    label_width_mm = pdf.stringWidth(f"{label} ", FONT, FONT_SIZE) / mm
    dots_start = content_x + label_width_mm
    dots_end = amount_x - 2
    dot_width_mm = pdf.stringWidth(".", FONT, FONT_SIZE) / mm
    dot_count = max(0, int((dots_end - dots_start) / dot_width_mm)) if dot_width_mm > 0 else 0

    if dot_count > 0:
        pdf.drawString(dots_start * mm, (page_height_mm - y_mm) * mm, "." * dot_count)

    pdf.drawString(amount_x * mm, (page_height_mm - y_mm) * mm, amount)


def _draw_horizontal_rule(pdf: canvas.Canvas, x_mm: float, y_mm: float, width_mm: float, page_height_mm: float) -> None:
    y_pt = (page_height_mm - y_mm) * mm
    pdf.line(x_mm * mm, y_pt, (x_mm + width_mm) * mm, y_pt)


def generate_expense_report_pdf(invoice: SavedInvoice) -> tuple[bytes, str]:
    report = build_expense_report_data(invoice)
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    page_width_mm = A4[0] / mm
    page_height_mm = A4[1] / mm
    content_width_mm = page_width_mm - MARGIN_MM * 2
    y = MARGIN_MM

    if LOGO_PATH.is_file():
        logo_image = Image.open(LOGO_PATH)
        width_mm, height_mm = _get_logo_dimensions(logo_image.width, logo_image.height)
        pdf.drawImage(
            ImageReader(logo_image),
            MARGIN_MM * mm,
            (page_height_mm - y - height_mm) * mm,
            width=width_mm * mm,
            height=height_mm * mm,
            preserveAspectRatio=True,
            mask="auto",
        )
        y += height_mm + 4

    pdf.setFont(f"{FONT}-Bold", TITLE_SIZE)
    pdf.drawCentredString(page_width_mm / 2 * mm, (page_height_mm - y) * mm, "EXPENSE REPORT")
    y += 3
    _draw_horizontal_rule(pdf, MARGIN_MM, y, content_width_mm, page_height_mm)
    y += LINE_HEIGHT_MM

    pdf.setFont(FONT, FONT_SIZE)
    pdf.drawString(MARGIN_MM * mm, (page_height_mm - y) * mm, f"Vendor: {report.vendor}")
    y += LINE_HEIGHT_MM
    pdf.drawString(MARGIN_MM * mm, (page_height_mm - y) * mm, f"Date: {report.date}")
    y += LINE_HEIGHT_MM
    pdf.drawString(MARGIN_MM * mm, (page_height_mm - y) * mm, f"Invoice#: {report.invoice_number}")
    y += 3
    _draw_horizontal_rule(pdf, MARGIN_MM, y, content_width_mm, page_height_mm)
    y += LINE_HEIGHT_MM + 1

    columns = [
        ("#", 8, "right"),
        ("Item", 52, "left"),
        ("Category", 34, "left"),
        ("Qty", 14, "right"),
        ("Amount", 22, "right"),
    ]

    pdf.setFont(f"{FONT}-Bold", FONT_SIZE)
    column_x = MARGIN_MM
    for label, width, align in columns:
        x = column_x + (width - 1 if align == "right" else 0)
        if align == "right":
            pdf.drawRightString(x * mm, (page_height_mm - y) * mm, label)
        else:
            pdf.drawString(column_x * mm, (page_height_mm - y) * mm, label)
        column_x += width

    y += 2
    _draw_horizontal_rule(pdf, MARGIN_MM, y, content_width_mm, page_height_mm)
    y += LINE_HEIGHT_MM

    pdf.setFont(FONT, FONT_SIZE)
    for row in report.line_items:
        if y > page_height_mm - MARGIN_MM - 40:
            pdf.showPage()
            y = MARGIN_MM

        values = [
            str(row.index),
            row.item,
            row.category,
            row.qty,
            format_report_amount(row.amount),
        ]

        column_x = MARGIN_MM
        for index, (_, width, align) in enumerate(columns):
            value = values[index]
            if align == "left":
                value = _truncate_text(pdf, value, width - 1, FONT, FONT_SIZE)

            x = column_x + (width - 1 if align == "right" else 0)
            if align == "right":
                pdf.drawRightString(x * mm, (page_height_mm - y) * mm, value)
            else:
                pdf.drawString(column_x * mm, (page_height_mm - y) * mm, value)
            column_x += width

        y += LINE_HEIGHT_MM

    y += 2
    _draw_horizontal_rule(pdf, MARGIN_MM, y, content_width_mm, page_height_mm)
    y += LINE_HEIGHT_MM + 1

    pdf.setFont(f"{FONT}-Bold", FONT_SIZE)
    pdf.drawString(MARGIN_MM * mm, (page_height_mm - y) * mm, "CATEGORY SUMMARY")
    y += LINE_HEIGHT_MM
    _draw_horizontal_rule(pdf, MARGIN_MM, y, content_width_mm, page_height_mm)
    y += LINE_HEIGHT_MM

    pdf.setFont(FONT, FONT_SIZE)
    summary_start_y = y
    has_category_summary = len(report.category_summary) > 0
    pie_chart_image = _render_category_pie_chart(report.category_summary) if has_category_summary else None
    show_pie_chart = pie_chart_image is not None and has_category_summary
    summary_rows_height = len(report.category_summary) * LINE_HEIGHT_MM
    summary_block_height = (
        max(PIE_CHART_SIZE_MM, summary_rows_height) + SUMMARY_BLOCK_PADDING_MM * 2
        if show_pie_chart
        else summary_rows_height
    )
    pie_y = summary_start_y + (summary_block_height - PIE_CHART_SIZE_MM) / 2
    summary_y = summary_start_y + (summary_block_height - summary_rows_height) / 2

    if show_pie_chart and pie_chart_image is not None:
        pdf.drawImage(
            ImageReader(pie_chart_image),
            MARGIN_MM * mm,
            (page_height_mm - pie_y - PIE_CHART_SIZE_MM) * mm,
            width=PIE_CHART_SIZE_MM * mm,
            height=PIE_CHART_SIZE_MM * mm,
            mask="auto",
        )

    summary_text_x = MARGIN_MM + (PIE_CHART_SIZE_MM + PIE_CHART_GAP_MM if show_pie_chart else 0)
    summary_text_width = content_width_mm - (summary_text_x - MARGIN_MM)
    row_y = summary_y

    for index, row in enumerate(report.category_summary):
        _draw_summary_row(
            pdf,
            summary_text_x,
            row_y,
            summary_text_width,
            row.category,
            format_report_amount(row.amount),
            get_category_color(index),
            page_height_mm,
        )
        row_y += LINE_HEIGHT_MM

    if has_category_summary:
        y = summary_start_y + summary_block_height

    y += 1
    _draw_horizontal_rule(pdf, MARGIN_MM, y, content_width_mm, page_height_mm)
    y += LINE_HEIGHT_MM

    pdf.setFont(FONT, FONT_SIZE)
    pdf.drawString(MARGIN_MM * mm, (page_height_mm - y) * mm, f"Subtotal: {format_report_amount(report.subtotal)}")
    y += LINE_HEIGHT_MM
    pdf.drawString(MARGIN_MM * mm, (page_height_mm - y) * mm, f"Tax: {format_report_amount(report.tax)}")
    y += LINE_HEIGHT_MM + 1
    pdf.setFont(f"{FONT}-Bold", FONT_SIZE)
    pdf.drawString(MARGIN_MM * mm, (page_height_mm - y) * mm, f"TOTAL: {format_report_amount(report.total)}")
    y += 3
    _draw_horizontal_rule(pdf, MARGIN_MM, y, content_width_mm, page_height_mm)

    pdf.save()
    return buffer.getvalue(), expense_report_filename(invoice)
