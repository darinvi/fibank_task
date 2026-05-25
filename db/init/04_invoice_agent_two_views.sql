-- Migration for existing databases: replace flattened view with two normalized views.
DROP VIEW IF EXISTS invoice_agent_data;

CREATE OR REPLACE VIEW invoice_agent_invoices AS
SELECT
    id AS invoice_id,
    invoice_number,
    invoice_date,
    issuer_name,
    issuer_id,
    receiver_name,
    receiver_id,
    total_amount,
    currency,
    created_at
FROM invoices;

CREATE OR REPLACE VIEW invoice_agent_line_items AS
SELECT
    id AS line_item_id,
    invoice_id,
    description,
    category,
    quantity,
    unit_price,
    amount
FROM invoice_line_items;

GRANT SELECT ON invoice_agent_invoices TO invoice_agent_reader;
GRANT SELECT ON invoice_agent_line_items TO invoice_agent_reader;
