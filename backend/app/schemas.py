from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message to send to the chain")


class ChatResponse(BaseModel):
    reply: str


class Party(BaseModel):
    name: str | None = Field(None, description="Company or person name")
    id: str | None = Field(None, description="Company ID, VAT number, or personal ID")


class LineItem(BaseModel):
    description: str | None = Field(None, description="Item or service description")
    quantity: float | None = Field(None, description="Quantity")
    unit_price: float | None = Field(None, description="Price per unit")
    amount: float | None = Field(None, description="Line total amount")


class InvoiceExtraction(BaseModel):
    invoice_number: str | None = Field(None, description="Invoice or document number")
    invoice_date: str | None = Field(None, description="Invoice date as shown on the document")
    issuer: Party = Field(description="Party that issued the invoice")
    receiver: Party = Field(description="Party that receives the invoice")
    line_items: list[LineItem] = Field(default_factory=list, description="Invoice line items")
    total_amount: float | None = Field(None, description="Invoice total amount")
    currency: str | None = Field(None, description="ISO 4217 currency code when possible, e.g. EUR, USD")
