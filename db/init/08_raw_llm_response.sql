ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS raw_llm_response JSONB;
