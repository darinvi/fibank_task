-- Invoice-level view (one row per invoice).
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

-- Line-item view (one row per line item).
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

-- Dedicated login role with SELECT on the views only (no access to base tables).
CREATE ROLE invoice_agent_reader WITH LOGIN PASSWORD 'invoice_agent';

GRANT CONNECT ON DATABASE fibank TO invoice_agent_reader;
GRANT USAGE ON SCHEMA public TO invoice_agent_reader;
GRANT SELECT ON invoice_agent_invoices TO invoice_agent_reader;
GRANT SELECT ON invoice_agent_line_items TO invoice_agent_reader;

REVOKE ALL ON TABLE invoices FROM invoice_agent_reader;
REVOKE ALL ON TABLE invoice_line_items FROM invoice_agent_reader;
REVOKE ALL ON TABLE invoice_images FROM invoice_agent_reader;
