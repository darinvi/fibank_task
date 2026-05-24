import base64
from functools import lru_cache

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.schemas import InvoiceExtraction

EXTRACTION_PROMPT = """Extract all invoice fields from the provided image.

Return structured data for:
- invoice_number
- invoice_date (use the date as printed on the invoice)
- issuer: company name and company ID (VAT, registration number, or similar)
- receiver: company/person name and ID
- line_items: each with description, quantity, unit_price, and amount
- total_amount
- currency (prefer ISO 4217 codes such as EUR, USD, BGN)

Use null for any field that is not present or cannot be read clearly.
For numeric fields, return numbers only (no currency symbols).
If quantity or unit price is missing for a line item, still include the line with null values."""

ALLOWED_MEDIA_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


@lru_cache
def get_invoice_extractor():
    llm = ChatOpenAI(model="gpt-5", temperature=0)
    return llm.with_structured_output(InvoiceExtraction)


def run_invoice_extraction(image_bytes: bytes, media_type: str) -> InvoiceExtraction:
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
                content="You are an expert at reading invoices and extracting structured data accurately."
            ),
            message,
        ]
    )
