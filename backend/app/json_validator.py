import json
from typing import Any

PARTY_FIELDS = ("name", "id")
LINE_ITEM_FIELDS = ("description", "category", "quantity", "unit_price", "amount")
EXTRACTION_FIELDS = (
    "invoice_number",
    "invoice_date",
    "issuer",
    "receiver",
    "line_items",
    "subtotal_amount",
    "total_amount",
    "currency",
)


class InvoiceValidationError(ValueError):
    pass


def _ensure_keys(data: dict[str, Any], keys: tuple[str, ...]) -> None:
    for key in keys:
        if key not in data:
            data[key] = None


def validate_invoice_json(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise InvoiceValidationError(f"Invalid JSON: {exc.msg}") from exc

    if not isinstance(parsed, dict):
        raise InvoiceValidationError("Invoice extraction must be a JSON object")

    _ensure_keys(parsed, EXTRACTION_FIELDS)

    for party_field in ("issuer", "receiver"):
        party = parsed.get(party_field)
        if not isinstance(party, dict):
            party = {}
        _ensure_keys(party, PARTY_FIELDS)
        parsed[party_field] = party

    line_items = parsed.get("line_items")
    if not isinstance(line_items, list):
        line_items = []

    for item in line_items:
        if isinstance(item, dict):
            _ensure_keys(item, LINE_ITEM_FIELDS)

    parsed["line_items"] = line_items
    return parsed
