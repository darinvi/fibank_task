from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class InvoiceAgentRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Question about stored invoices")
    session_id: str | None = Field(
        None,
        description="Optional UUID thread id; omit to start a new persisted conversation",
    )


class InvoiceAgentResponse(BaseModel):
    reply: str
    session_id: str


class Party(BaseModel):
    name: str | None = Field(None, description="Company or person name")
    id: str | None = Field(None, description="Company ID, VAT number, or personal ID")


class LineItem(BaseModel):
    description: str | None = Field(None, description="Item or service description")
    category: str | None = Field(
        None,
        description="Spending category, e.g. Dairy, Bakery, Beverages, Household, Meat",
    )
    quantity: float | None = Field(None, description="Quantity")
    unit_price: float | None = Field(None, description="Price per unit")
    amount: float | None = Field(None, description="Line total amount")


class SavedLineItem(LineItem):
    id: int = Field(..., description="Database identifier for the line item")


class InvoiceExtraction(BaseModel):
    invoice_number: str | None = Field(None, description="Invoice or document number")
    invoice_date: str | None = Field(None, description="Invoice date as shown on the document")
    issuer: Party = Field(description="Party that issued the invoice")
    receiver: Party = Field(description="Party that receives the invoice")
    line_items: list[LineItem] = Field(default_factory=list, description="Invoice line items")
    subtotal_amount: float | None = Field(None, description="Invoice subtotal before tax, fees, or discounts")
    tax_amount: float | None = Field(None, description="Tax or VAT amount shown on the invoice")
    total_amount: float | None = Field(None, description="Invoice total amount due")
    currency: str | None = Field(None, description="ISO 4217 currency code when possible, e.g. EUR, USD")


class SavedInvoice(InvoiceExtraction):
    id: int = Field(..., description="Database identifier for the saved invoice")
    line_items: list[SavedLineItem] = Field(default_factory=list, description="Invoice line items")
    raw_llm_response: dict[str, Any] | None = Field(
        None,
        description="Unmodified JSON object returned by the LLM during extraction",
    )


class SavedExpenseReportPdf(BaseModel):
    id: int = Field(..., description="Database identifier for the generated expense report PDF")
    invoice_id: int = Field(..., description="Source invoice identifier")
    filename: str = Field(..., description="Suggested download filename")
    created_at: datetime = Field(..., description="When the PDF was generated")
    invoice_number: str | None = Field(None, description="Source invoice number for display")
    invoice_date: str | None = Field(None, description="Source invoice date for display")
    issuer_name: str | None = Field(None, description="Source invoice issuer for display")
