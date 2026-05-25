-- Read-only view for the invoice Q&A agent (one row per line item).
CREATE OR REPLACE VIEW invoice_agent_data AS
SELECT
    i.id AS invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.issuer_name,
    i.issuer_id,
    i.receiver_name,
    i.receiver_id,
    i.total_amount,
    i.currency,
    i.created_at AS invoice_created_at,
    li.id AS line_item_id,
    li.description AS line_item_description,
    li.quantity AS line_item_quantity,
    li.unit_price AS line_item_unit_price,
    li.amount AS line_item_amount
FROM invoices i
LEFT JOIN invoice_line_items li ON li.invoice_id = i.id;

-- Dedicated login role with SELECT on the view only (no access to base tables).
CREATE ROLE invoice_agent_reader WITH LOGIN PASSWORD 'invoice_agent';

GRANT CONNECT ON DATABASE fibank TO invoice_agent_reader;
GRANT USAGE ON SCHEMA public TO invoice_agent_reader;
GRANT SELECT ON invoice_agent_data TO invoice_agent_reader;

REVOKE ALL ON TABLE invoices FROM invoice_agent_reader;
REVOKE ALL ON TABLE invoice_line_items FROM invoice_agent_reader;
REVOKE ALL ON TABLE invoice_images FROM invoice_agent_reader;
