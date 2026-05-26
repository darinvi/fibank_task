import os
from decimal import Decimal
from typing import Any

import psycopg
from psycopg.types.json import Json

from app.schemas import InvoiceExtraction, SavedExpenseReportPdf, SavedInvoice, SavedLineItem


def _get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return database_url


def _to_float(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _build_saved_invoice(
    invoice_row: tuple[Any, ...],
    line_item_rows: list[tuple[Any, ...]],
) -> SavedInvoice:
    (
        invoice_id,
        invoice_number,
        invoice_date,
        issuer_name,
        issuer_id,
        receiver_name,
        receiver_id,
        subtotal_amount,
        tax_amount,
        total_amount,
        currency,
        raw_llm_response,
    ) = invoice_row

    line_items = [
        SavedLineItem(
            id=row[0],
            description=row[1],
            category=row[2],
            quantity=_to_float(row[3]),
            unit_price=_to_float(row[4]),
            amount=_to_float(row[5]),
        )
        for row in line_item_rows
    ]

    return SavedInvoice(
        id=invoice_id,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        issuer={"name": issuer_name, "id": issuer_id},
        receiver={"name": receiver_name, "id": receiver_id},
        line_items=line_items,
        subtotal_amount=_to_float(subtotal_amount),
        tax_amount=_to_float(tax_amount),
        total_amount=_to_float(total_amount),
        currency=currency,
        raw_llm_response=raw_llm_response if isinstance(raw_llm_response, dict) else None,
    )


def _fetch_line_items(cur: psycopg.Cursor, invoice_id: int) -> list[tuple[Any, ...]]:
    cur.execute(
        """
        SELECT id, description, category, quantity, unit_price, amount
        FROM invoice_line_items
        WHERE invoice_id = %s
        ORDER BY id
        """,
        (invoice_id,),
    )
    return cur.fetchall()


def save_invoice(
    extraction: InvoiceExtraction,
    image_bytes: bytes,
    media_type: str,
    raw_llm_response: dict[str, Any],
) -> SavedInvoice:
    with psycopg.connect(_get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO invoices (
                    invoice_number,
                    invoice_date,
                    issuer_name,
                    issuer_id,
                    receiver_name,
                    receiver_id,
                    subtotal_amount,
                    tax_amount,
                    total_amount,
                    currency,
                    raw_llm_response
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    extraction.invoice_number,
                    extraction.invoice_date,
                    extraction.issuer.name,
                    extraction.issuer.id,
                    extraction.receiver.name,
                    extraction.receiver.id,
                    extraction.subtotal_amount,
                    extraction.tax_amount,
                    extraction.total_amount,
                    extraction.currency,
                    Json(raw_llm_response),
                ),
            )
            invoice_id = cur.fetchone()[0]

            for item in extraction.line_items:
                cur.execute(
                    """
                    INSERT INTO invoice_line_items (
                        invoice_id,
                        description,
                        category,
                        quantity,
                        unit_price,
                        amount
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        invoice_id,
                        item.description,
                        item.category,
                        item.quantity,
                        item.unit_price,
                        item.amount,
                    ),
                )

            cur.execute(
                """
                INSERT INTO invoice_images (invoice_id, data, media_type)
                VALUES (%s, %s, %s)
                """,
                (invoice_id, image_bytes, media_type),
            )

        conn.commit()

    invoice = get_invoice(invoice_id)
    if invoice is None:
        raise RuntimeError("Failed to load saved invoice")
    return invoice


def list_invoices() -> list[SavedInvoice]:
    with psycopg.connect(_get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    invoice_number,
                    invoice_date,
                    issuer_name,
                    issuer_id,
                    receiver_name,
                    receiver_id,
                    subtotal_amount,
                    tax_amount,
                    total_amount,
                    currency,
                    raw_llm_response
                FROM invoices
                ORDER BY created_at DESC, id DESC
                """
            )
            invoice_rows = cur.fetchall()

            return [
                _build_saved_invoice(row, _fetch_line_items(cur, row[0]))
                for row in invoice_rows
            ]


def get_invoice(invoice_id: int) -> SavedInvoice | None:
    with psycopg.connect(_get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    invoice_number,
                    invoice_date,
                    issuer_name,
                    issuer_id,
                    receiver_name,
                    receiver_id,
                    subtotal_amount,
                    tax_amount,
                    total_amount,
                    currency,
                    raw_llm_response
                FROM invoices
                WHERE id = %s
                """,
                (invoice_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None

            return _build_saved_invoice(row, _fetch_line_items(cur, invoice_id))


def get_invoice_image(invoice_id: int) -> tuple[bytes, str] | None:
    with psycopg.connect(_get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT data, media_type
                FROM invoice_images
                WHERE invoice_id = %s
                """,
                (invoice_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            return row[0], row[1]


def update_invoice(invoice_id: int, extraction: InvoiceExtraction) -> SavedInvoice | None:
    with psycopg.connect(_get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE invoices
                SET
                    invoice_number = %s,
                    invoice_date = %s,
                    issuer_name = %s,
                    issuer_id = %s,
                    receiver_name = %s,
                    receiver_id = %s,
                    subtotal_amount = %s,
                    tax_amount = %s,
                    total_amount = %s,
                    currency = %s
                WHERE id = %s
                """,
                (
                    extraction.invoice_number,
                    extraction.invoice_date,
                    extraction.issuer.name,
                    extraction.issuer.id,
                    extraction.receiver.name,
                    extraction.receiver.id,
                    extraction.subtotal_amount,
                    extraction.tax_amount,
                    extraction.total_amount,
                    extraction.currency,
                    invoice_id,
                ),
            )
            if cur.rowcount == 0:
                return None

            cur.execute(
                "DELETE FROM invoice_line_items WHERE invoice_id = %s",
                (invoice_id,),
            )

            for item in extraction.line_items:
                cur.execute(
                    """
                    INSERT INTO invoice_line_items (
                        invoice_id,
                        description,
                        category,
                        quantity,
                        unit_price,
                        amount
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        invoice_id,
                        item.description,
                        item.category,
                        item.quantity,
                        item.unit_price,
                        item.amount,
                    ),
                )

        conn.commit()

    return get_invoice(invoice_id)


def delete_invoice(invoice_id: int) -> bool:
    with psycopg.connect(_get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM invoices WHERE id = %s", (invoice_id,))
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted


def _build_saved_expense_report_pdf(row: tuple[Any, ...]) -> SavedExpenseReportPdf:
    return SavedExpenseReportPdf(
        id=row[0],
        invoice_id=row[1],
        filename=row[2],
        created_at=row[3],
        invoice_number=row[4],
        invoice_date=row[5],
        issuer_name=row[6],
    )


def save_expense_report_pdf(
    invoice_id: int,
    pdf_bytes: bytes,
    filename: str,
    media_type: str,
) -> SavedExpenseReportPdf:
    with psycopg.connect(_get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO expense_report_pdfs (invoice_id, filename, data, media_type)
                VALUES (%s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (invoice_id, filename, pdf_bytes, media_type),
            )
            pdf_id, created_at = cur.fetchone()

            cur.execute(
                """
                SELECT invoice_number, invoice_date, issuer_name
                FROM invoices
                WHERE id = %s
                """,
                (invoice_id,),
            )
            invoice_row = cur.fetchone()
        conn.commit()

    invoice_number, invoice_date, issuer_name = invoice_row or (None, None, None)
    return SavedExpenseReportPdf(
        id=pdf_id,
        invoice_id=invoice_id,
        filename=filename,
        created_at=created_at,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        issuer_name=issuer_name,
    )


def list_expense_report_pdfs() -> list[SavedExpenseReportPdf]:
    with psycopg.connect(_get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    erp.id,
                    erp.invoice_id,
                    erp.filename,
                    erp.created_at,
                    i.invoice_number,
                    i.invoice_date,
                    i.issuer_name
                FROM expense_report_pdfs erp
                INNER JOIN invoices i ON i.id = erp.invoice_id
                ORDER BY erp.created_at DESC, erp.id DESC
                """
            )
            return [_build_saved_expense_report_pdf(row) for row in cur.fetchall()]


def get_expense_report_pdf_data(pdf_id: int) -> tuple[bytes, str, str] | None:
    with psycopg.connect(_get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT data, media_type, filename
                FROM expense_report_pdfs
                WHERE id = %s
                """,
                (pdf_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            return row[0], row[1], row[2]


def delete_expense_report_pdf(pdf_id: int) -> bool:
    with psycopg.connect(_get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM expense_report_pdfs WHERE id = %s", (pdf_id,))
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted
