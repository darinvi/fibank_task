import base64
from functools import lru_cache

from openai import OpenAI

EXTRACTION_PROMPT = """Extract all invoice fields from the provided PDF.

Return a single JSON object with exactly these keys:
- invoice_number
- invoice_date (use the date as printed on the invoice)
- issuer: object with "name" and "id" (company name and VAT/registration number)
- receiver: object with "name" and "id" (company/person name and ID)
- line_items: array of objects, each with "description", "category", "quantity", "unit_price", and "amount"
- subtotal_amount (amount before tax, fees, or discounts; often the sum of line items)
- tax_amount (tax or VAT amount explicitly shown on the invoice; null if not shown)
- total_amount (final amount due, including tax, fees, or discounts when shown)
- currency (prefer ISO 4217 codes such as EUR, USD, BGN)

For each line item, assign a specific spending category from the item description and invoice context
(issuer, industry, and surrounding line items).
Use short, human-readable Title Case names (1-3 words). Common examples include Dairy, Bakery,
Beverages, Meat, Produce, Household, Personal Care, Electronics, Office, Services, Fuel, Automotive,
Software, Shipping, Medical, Travel, and Utilities—but these are examples, not a fixed list.
When an item does not match an example, infer the best-fit category from context instead of defaulting
to Other. Examples: printer toner → Office Supplies; motor oil → Automotive; cloud hosting → Software;
delivery fee → Shipping; restaurant meal → Dining.
Use Other only as a last resort when the item is too vague to classify even with invoice context
(e.g. "Misc charge" with no other clues).
Correct obvious OCR or spelling errors in item descriptions when possible.
Use null for any field that is not present or cannot be read clearly.
For numeric fields, return numbers only (no currency symbols).
If quantity or unit price is missing for a line item, still include the line with null values.
Return JSON only, with no markdown or extra text."""

PDF_MEDIA_TYPE = "application/pdf"

SYSTEM_INSTRUCTIONS = (
    "You are an expert at reading invoices, extracting structured data accurately, "
    "and categorizing each line item into a specific, contextual spending category. "
    "Infer sensible categories from item descriptions and invoice context; avoid defaulting to Other. "
    "Always respond with valid JSON."
)


OPENAI_REQUEST_TIMEOUT_SEC = 180


@lru_cache
def get_openai_client() -> OpenAI:
    return OpenAI(timeout=OPENAI_REQUEST_TIMEOUT_SEC)


def run_invoice_extraction(pdf_bytes: bytes, filename: str = "invoice.pdf") -> str:
    encoded_pdf = base64.b64encode(pdf_bytes).decode("utf-8")
    file_data = f"data:{PDF_MEDIA_TYPE};base64,{encoded_pdf}"

    client = get_openai_client()
    response = client.responses.create(
        model="gpt-5-mini",
        instructions=SYSTEM_INSTRUCTIONS,
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": EXTRACTION_PROMPT},
                    {
                        "type": "input_file",
                        "filename": filename,
                        "file_data": file_data,
                    },
                ],
            }
        ],
        text={"format": {"type": "json_object"}},
    )

    output_text = response.output_text
    if not output_text:
        raise RuntimeError("Model returned no extraction output")
    return output_text
