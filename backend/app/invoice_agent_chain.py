import json
import os
import uuid
from decimal import Decimal
from functools import lru_cache
from typing import Any

import psycopg
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

MAX_MEMORY_MESSAGES = 5
VIEW_NAME = "invoice_agent_data"
MAX_QUERY_ROWS = 100

SYSTEM_PROMPT = f"""You are an assistant that answers questions about stored invoices.
Use the PostgreSQL view `{VIEW_NAME}` to query invoice data.
Write SELECT queries, execute them with the query tool, and answer based on the results.
Only query `{VIEW_NAME}`; do not reference other tables or views.
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
    """Run a PostgreSQL SELECT query against the invoice_agent_data view."""
    return _execute_query(sql_query)


@lru_cache
def get_invoice_agent():
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    return create_react_agent(
        llm,
        [query_invoice_database],
        prompt=SYSTEM_PROMPT,
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
