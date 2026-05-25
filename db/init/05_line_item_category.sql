-- Add spending category to line items (existing databases).
ALTER TABLE invoice_line_items
    ADD COLUMN IF NOT EXISTS category TEXT;

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

GRANT SELECT ON invoice_agent_line_items TO invoice_agent_reader;
