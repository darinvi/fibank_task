"""LangGraph checkpointer lifecycle for invoice agent conversation memory."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

if TYPE_CHECKING:
    from langgraph.checkpoint.postgres import PostgresSaver

_pool: ConnectionPool | None = None
_checkpointer: PostgresSaver | None = None


def _get_checkpoint_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured (required for agent memory)")
    return database_url


def get_checkpointer() -> PostgresSaver:
    if _checkpointer is None:
        raise RuntimeError("Agent memory is not initialized; call init_agent_memory() on startup")
    return _checkpointer


def init_agent_memory() -> None:
    """Create the Postgres connection pool, checkpointer tables, and saver instance."""
    global _pool, _checkpointer

    if _checkpointer is not None:
        return

    from langgraph.checkpoint.postgres import PostgresSaver

    _pool = ConnectionPool(
        conninfo=_get_checkpoint_database_url(),
        max_size=int(os.getenv("AGENT_CHECKPOINT_POOL_SIZE", "10")),
        kwargs={
            "autocommit": True,
            "prepare_threshold": 0,
            "row_factory": dict_row,
        },
    )
    _checkpointer = PostgresSaver(_pool)
    _checkpointer.setup()


def shutdown_agent_memory() -> None:
    """Release checkpointer resources on application shutdown."""
    global _pool, _checkpointer

    _checkpointer = None

    if _pool is not None:
        _pool.close()
        _pool = None
