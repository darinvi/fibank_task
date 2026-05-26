import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from pydantic import ValidationError

from app.chain import run_chat
from app.database import (
    delete_expense_report_pdf,
    delete_invoice,
    get_expense_report_pdf_data,
    get_invoice,
    get_invoice_image,
    list_expense_report_pdfs,
    list_invoices,
    save_expense_report_pdf,
    save_invoice,
    update_invoice,
)
from app.invoice_agent_chain import run_invoice_agent
from app.expense_report_pdf import generate_expense_report_pdf
from app.invoice_chain import run_invoice_extraction
from app.json_validator import InvoiceValidationError, validate_invoice_json
from app.schemas import (
    ChatRequest,
    ChatResponse,
    InvoiceAgentRequest,
    InvoiceAgentResponse,
    InvoiceExtraction,
    SavedExpenseReportPdf,
    SavedInvoice,
)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Fibank LangChain Backend")

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_INVOICE_PDF_SIZE = 10 * 1024 * 1024
PDF_MEDIA_TYPE = "application/pdf"


def _is_pdf_upload(file: UploadFile) -> bool:
    if file.content_type == PDF_MEDIA_TYPE:
        return True
    filename = (file.filename or "").lower()
    return filename.endswith(".pdf")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    try:
        reply = run_chat(request.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ChatResponse(reply=reply)


@app.post("/invoices/ask", response_model=InvoiceAgentResponse)
def ask_about_invoices(request: InvoiceAgentRequest):
    try:
        reply, session_id = run_invoice_agent(request.message, request.session_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return InvoiceAgentResponse(reply=reply, session_id=session_id)


@app.post("/invoices/extract", response_model=SavedInvoice)
async def extract_invoice(file: UploadFile = File(...)):
    if not _is_pdf_upload(file):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(pdf_bytes) > MAX_INVOICE_PDF_SIZE:
        raise HTTPException(status_code=400, detail="PDF must be 10 MB or smaller")

    filename = file.filename or "invoice.pdf"

    try:
        raw_json = run_invoice_extraction(pdf_bytes, filename)
        validated_data = validate_invoice_json(raw_json)
        extraction = InvoiceExtraction.model_validate(validated_data)
        raw_llm_response = json.loads(raw_json)
        return save_invoice(extraction, pdf_bytes, PDF_MEDIA_TYPE, raw_llm_response)
    except InvoiceValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/invoices", response_model=list[SavedInvoice])
def get_invoices():
    try:
        return list_invoices()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/invoices/{invoice_id}", response_model=SavedInvoice)
def get_invoice_by_id(invoice_id: int):
    try:
        invoice = get_invoice(invoice_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return invoice


@app.get("/expense-reports", response_model=list[SavedExpenseReportPdf])
def get_expense_reports():
    try:
        return list_expense_report_pdfs()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/expense-reports/{pdf_id}")
def get_expense_report_pdf_by_id(pdf_id: int):
    try:
        pdf = get_expense_report_pdf_data(pdf_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if pdf is None:
        raise HTTPException(status_code=404, detail="Expense report PDF not found")

    pdf_bytes, media_type, filename = pdf
    return Response(
        content=pdf_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@app.delete("/expense-reports/{pdf_id}", status_code=204)
def remove_expense_report_pdf(pdf_id: int):
    try:
        deleted = delete_expense_report_pdf(pdf_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Expense report PDF not found")


@app.post("/invoices/{invoice_id}/expense-report", response_model=SavedExpenseReportPdf, status_code=201)
def create_expense_report_pdf(invoice_id: int):
    try:
        invoice = get_invoice(invoice_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    try:
        pdf_bytes, filename = generate_expense_report_pdf(invoice)
        return save_expense_report_pdf(invoice_id, pdf_bytes, filename, PDF_MEDIA_TYPE)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/invoices/{invoice_id}/image")
def get_invoice_image_by_id(invoice_id: int):
    try:
        image = get_invoice_image(invoice_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if image is None:
        raise HTTPException(status_code=404, detail="Invoice PDF not found")

    image_bytes, media_type = image
    return Response(content=image_bytes, media_type=media_type)


@app.patch("/invoices/{invoice_id}", response_model=SavedInvoice)
def patch_invoice(invoice_id: int, payload: InvoiceExtraction):
    try:
        updated = update_invoice(invoice_id, payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if updated is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return updated


@app.delete("/invoices/{invoice_id}", status_code=204)
def remove_invoice(invoice_id: int):
    try:
        deleted = delete_invoice(invoice_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")
