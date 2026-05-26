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
- total_amount (final amount due, including tax, fees, or discounts when shown)
- currency (prefer ISO 4217 codes such as EUR, USD, BGN)

For each line item, assign a spending category based on the item description.
Use short, human-readable category names such as Dairy, Bakery, Beverages, Meat, Produce,
Household, Personal Care, Electronics, Office, Services, or Other when nothing else fits.
Correct obvious OCR or spelling errors in item descriptions when possible.
Use null for any field that is not present or cannot be read clearly.
For numeric fields, return numbers only (no currency symbols).
If quantity or unit price is missing for a line item, still include the line with null values.
Return JSON only, with no markdown or extra text."""

PDF_MEDIA_TYPE = "application/pdf"

SYSTEM_INSTRUCTIONS = (
    "You are an expert at reading invoices, extracting structured data accurately, "
    "and categorizing line items into sensible spending categories. "
    "Always respond with valid JSON."
)


@lru_cache
def get_openai_client() -> OpenAI:
    return OpenAI()


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
