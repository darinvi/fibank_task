import base64
from functools import lru_cache

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI

EXTRACTION_PROMPT = """Extract all invoice fields from the provided image.

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

ALLOWED_MEDIA_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


@lru_cache
def get_invoice_extractor():
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0).bind(
        response_format={"type": "json_object"}
    )
    return llm | StrOutputParser()


def run_invoice_extraction(image_bytes: bytes, media_type: str) -> str:
    if media_type not in ALLOWED_MEDIA_TYPES:
        raise ValueError(f"Unsupported image type: {media_type}")

    encoded_image = base64.b64encode(image_bytes).decode("utf-8")
    image_url = f"data:{media_type};base64,{encoded_image}"

    message = HumanMessage(
        content=[
            {"type": "text", "text": EXTRACTION_PROMPT},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]
    )

    extractor = get_invoice_extractor()
    return extractor.invoke(
        [
            SystemMessage(
                content=(
                    "You are an expert at reading invoices, extracting structured data accurately, "
                    "and categorizing line items into sensible spending categories. "
                    "Always respond with valid JSON."
                )
            ),
            message,
        ]
    )
