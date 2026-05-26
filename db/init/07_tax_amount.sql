-- Add tax amount to invoices (existing databases).
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2);

DROP VIEW IF EXISTS invoice_agent_invoices;

CREATE VIEW invoice_agent_invoices AS
SELECT
    id AS invoice_id,
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
    created_at
FROM invoices;

GRANT SELECT ON invoice_agent_invoices TO invoice_agent_reader;
