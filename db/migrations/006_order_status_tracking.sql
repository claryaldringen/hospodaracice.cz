ALTER TABLE orders ADD COLUMN status_changed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN status_source TEXT;
