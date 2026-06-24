CREATE TABLE order_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    confirm_time TEXT NOT NULL DEFAULT '16:00'
);
INSERT INTO order_settings (id) VALUES (1);
