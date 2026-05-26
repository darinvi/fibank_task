import json
import os
import uuid
from decimal import Decimal
from functools import lru_cache
from typing import Any

import psycopg
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.tools import tool
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI

MAX_MEMORY_MESSAGES = 5
INVOICE_VIEW = "invoice_agent_invoices"
LINE_ITEM_VIEW = "invoice_agent_line_items"
MAX_QUERY_ROWS = 100

SYSTEM_PROMPT = f"""You are an assistant that answers questions about stored invoices.
Query data using these PostgreSQL views only:
- `{INVOICE_VIEW}`: one row per invoice
  Columns: invoice_id, invoice_number, invoice_date, issuer_name, issuer_id, receiver_name, receiver_id, subtotal_amount, total_amount, currency, created_at
- `{LINE_ITEM_VIEW}`: one row per line item
  Columns: line_item_id, invoice_id, description, category, quantity, unit_price, amount

Join on invoice_id when you need both invoice and line-item fields.
For invoice counts or combined invoice totals, query `{INVOICE_VIEW}` and aggregate subtotal_amount or total_amount as appropriate.
Use subtotal_amount for pre-tax or pre-fee sums; use total_amount for final amounts due.
For line-item sums or item details, query `{LINE_ITEM_VIEW}` and aggregate amount.
Do not reference base tables or other views.
Write SELECT queries, execute them with the query tool, and answer based on the results.
If the question cannot be answered from the data, say so clearly.
Be concise and include relevant numbers from the query results."""

_sessions: dict[str, list[BaseMessage]] = {}


def _get_agent_database_url() -> str:
    database_url = os.getenv("INVOICE_AGENT_DATABASE_URL")
    if database_url:
        return database_url

    user = os.getenv("INVOICE_AGENT_DB_USER", "invoice_agent_reader")
    password = os.getenv("INVOICE_AGENT_DB_PASSWORD", "invoice_agent")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "fibank")
    return f"postgresql://{user}:{password}@{host}:{port}/{db_name}"


def _serialize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    return value


def _execute_query(sql: str) -> str:
    normalized = sql.strip().rstrip(";")
    if not normalized.upper().startswith("SELECT"):
        return "Error: Only SELECT queries are allowed."

    try:
        with psycopg.connect(_get_agent_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute(normalized)
                if cur.description is None:
                    return "Query executed successfully with no rows returned."

                columns = [desc.name for desc in cur.description]
                rows = cur.fetchmany(MAX_QUERY_ROWS + 1)
                truncated = len(rows) > MAX_QUERY_ROWS
                rows = rows[:MAX_QUERY_ROWS]

                payload = {
                    "columns": columns,
                    "row_count": len(rows),
                    "truncated": truncated,
                    "rows": [
                        {column: _serialize_value(row[index]) for index, column in enumerate(columns)}
                        for row in rows
                    ],
                }
                return json.dumps(payload, default=str)
    except psycopg.Error as exc:
        return f"Database error: {exc}"


@tool
def query_invoice_database(sql_query: str) -> str:
    """Run a PostgreSQL SELECT query against invoice_agent_invoices and/or invoice_agent_line_items."""
    return _execute_query(sql_query)


@lru_cache
def get_invoice_agent():
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0)
    return create_agent(
        llm,
        [query_invoice_database],
        system_prompt=SYSTEM_PROMPT,
    )


def _extract_final_reply(messages: list[BaseMessage]) -> str:
    for message in reversed(messages):
        if not isinstance(message, AIMessage):
            continue

        content = message.content
        if isinstance(content, str) and content.strip():
            return content.strip()
        if isinstance(content, list):
            text_parts = [
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            ]
            combined = "\n".join(part for part in text_parts if part).strip()
            if combined:
                return combined

    raise RuntimeError("Agent did not produce a reply")


def run_invoice_agent(message: str, session_id: str | None = None) -> tuple[str, str]:
    sid = session_id or str(uuid.uuid4())
    history = list(_sessions.get(sid, []))

    agent = get_invoice_agent()
    result = agent.invoke({"messages": [*history, HumanMessage(content=message)]})
    reply = _extract_final_reply(result["messages"])

    updated_history = [*history, HumanMessage(content=message), AIMessage(content=reply)]
    _sessions[sid] = updated_history[-MAX_MEMORY_MESSAGES:]

    return reply, sid
