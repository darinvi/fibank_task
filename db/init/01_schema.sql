CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number TEXT,
    invoice_date TEXT,
    issuer_name TEXT,
    issuer_id TEXT,
    receiver_name TEXT,
    receiver_id TEXT,
    total_amount NUMERIC(12, 2),
    currency CHAR(3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    description TEXT,
    category TEXT,
    quantity NUMERIC(12, 4),
    unit_price NUMERIC(12, 2),
    amount NUMERIC(12, 2)
);

CREATE INDEX invoice_line_items_invoice_id_idx ON invoice_line_items (invoice_id);

CREATE TABLE invoice_images (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL UNIQUE REFERENCES invoices (id) ON DELETE CASCADE,
    data BYTEA NOT NULL,
    media_type TEXT NOT NULL
);
