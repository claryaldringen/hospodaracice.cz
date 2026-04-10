CREATE TABLE opening_hours (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    text TEXT NOT NULL DEFAULT ''
);
INSERT INTO opening_hours (text) VALUES ('');

CREATE TABLE delivery_villages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE weekly_menu (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    data JSONB NOT NULL DEFAULT '{"days":[]}'::jsonb
);
INSERT INTO weekly_menu (data) VALUES ('{"days":[]}'::jsonb);

CREATE TABLE menu_images (
    type TEXT PRIMARY KEY,
    full_text TEXT NOT NULL DEFAULT '',
    alt_text TEXT NOT NULL DEFAULT ''
);

CREATE TABLE gallery (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    filename TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reservations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    seats INTEGER NOT NULL,
    date TEXT NOT NULL,
    time_from TEXT NOT NULL,
    time_to TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reservations_date ON reservations (date);
CREATE INDEX idx_reservations_token ON reservations (token);

CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    village TEXT NOT NULL,
    note TEXT,
    day TEXT NOT NULL,
    date TEXT NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_date ON orders (date);

-- _migrations table is created by the migration runner (db/migrate.ts)
