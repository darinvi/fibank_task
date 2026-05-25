import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from pydantic import ValidationError

from app.chain import run_chat
from app.database import delete_invoice, get_invoice, get_invoice_image, list_invoices, save_invoice, update_invoice
from app.invoice_agent_chain import run_invoice_agent
from app.invoice_chain import run_invoice_extraction
from app.json_validator import InvoiceValidationError, validate_invoice_json
from app.schemas import (
    ChatRequest,
    ChatResponse,
    InvoiceAgentRequest,
    InvoiceAgentResponse,
    InvoiceExtraction,
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

MAX_INVOICE_IMAGE_SIZE = 10 * 1024 * 1024


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
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(image_bytes) > MAX_INVOICE_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be 10 MB or smaller")

    try:
        raw_json = run_invoice_extraction(image_bytes, file.content_type)
        validated_data = validate_invoice_json(raw_json)
        extraction = InvoiceExtraction.model_validate(validated_data)
        return save_invoice(extraction, image_bytes, file.content_type)
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


@app.get("/invoices/{invoice_id}/image")
def get_invoice_image_by_id(invoice_id: int):
    try:
        image = get_invoice_image(invoice_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if image is None:
        raise HTTPException(status_code=404, detail="Invoice image not found")

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
