CREATE TABLE IF NOT EXISTS expense_report_pdfs (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    data BYTEA NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'application/pdf',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS expense_report_pdfs_invoice_id_idx ON expense_report_pdfs (invoice_id);
CREATE INDEX IF NOT EXISTS expense_report_pdfs_created_at_idx ON expense_report_pdfs (created_at DESC);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'invoice_agent_reader') THEN
        REVOKE ALL ON TABLE expense_report_pdfs FROM invoice_agent_reader;
    END IF;
END
$$;
