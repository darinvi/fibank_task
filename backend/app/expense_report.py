from __future__ import annotations

from dataclasses import dataclass

from app.schemas import SavedInvoice, SavedLineItem

CATEGORY_CHART_COLORS = (
    "#334155",
    "#2563eb",
    "#0891b2",
    "#059669",
    "#d97706",
    "#dc2626",
    "#7c3aed",
    "#db2777",
)


def get_category_color(index: int) -> str:
    return CATEGORY_CHART_COLORS[index % len(CATEGORY_CHART_COLORS)]


@dataclass(frozen=True)
class CategorySummaryRow:
    category: str
    amount: float


@dataclass(frozen=True)
class ExpenseReportLineItem:
    index: int
    item: str
    category: str
    qty: str
    amount: float


@dataclass(frozen=True)
class ExpenseReportData:
    vendor: str
    date: str
    invoice_number: str
    line_items: list[ExpenseReportLineItem]
    category_summary: list[CategorySummaryRow]
    subtotal: float
    tax: float | None
    total: float


def format_report_amount(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value:.2f}"


def _display_field(value: str | None) -> str:
    trimmed = (value or "").strip()
    return trimmed if trimmed else "—"


def _sum_line_items(line_items: list[SavedLineItem]) -> float:
    return sum(item.amount or 0 for item in line_items)


def build_category_summary(line_items: list[SavedLineItem]) -> list[CategorySummaryRow]:
    totals: dict[str, float] = {}

    for item in line_items:
        category = (item.category or "").strip() or "Uncategorized"
        totals[category] = totals.get(category, 0) + (item.amount or 0)

    return sorted(
        (CategorySummaryRow(category=category, amount=amount) for category, amount in totals.items()),
        key=lambda row: row.category,
    )


def _resolve_tax_amount(invoice: SavedInvoice, subtotal: float) -> float | None:
    if invoice.tax_amount is not None:
        return invoice.tax_amount
    if invoice.total_amount is not None:
        return invoice.total_amount - subtotal
    return None


def _resolve_total_amount(invoice: SavedInvoice, subtotal: float, tax: float | None) -> float:
    if invoice.total_amount is not None:
        return invoice.total_amount
    if tax is not None:
        return subtotal + tax
    return subtotal


def build_expense_report_data(invoice: SavedInvoice) -> ExpenseReportData:
    subtotal = invoice.subtotal_amount if invoice.subtotal_amount is not None else _sum_line_items(invoice.line_items)
    tax = _resolve_tax_amount(invoice, subtotal)
    total = _resolve_total_amount(invoice, subtotal, tax)

    return ExpenseReportData(
        vendor=_display_field(invoice.issuer.name),
        date=_display_field(invoice.invoice_date),
        invoice_number=_display_field(invoice.invoice_number),
        line_items=[
            ExpenseReportLineItem(
                index=index + 1,
                item=_display_field(item.description),
                category=_display_field(item.category),
                qty="—" if item.quantity is None else str(item.quantity),
                amount=item.amount or 0,
            )
            for index, item in enumerate(invoice.line_items)
        ],
        category_summary=build_category_summary(invoice.line_items),
        subtotal=subtotal,
        tax=tax,
        total=total,
    )


def expense_report_filename(invoice: SavedInvoice) -> str:
    number = (invoice.invoice_number or "").strip()
    if number:
        safe = "".join(char if char.isalnum() or char in "._-" else "_" for char in number)
    else:
        safe = f"invoice-{invoice.id}"
    return f"expense-report-{safe}.pdf"
