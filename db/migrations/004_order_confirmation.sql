ALTER TABLE orders ADD COLUMN email TEXT;
ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE orders ADD COLUMN token TEXT;

-- Historické objednávky považuj za již vyřízené, ať se netváří jako nepotvrzené.
UPDATE orders SET status = 'confirmed';

-- Náhodný token pro potvrzovací odkaz; nullable sloupec povolí více NULL u historických řádků.
CREATE UNIQUE INDEX orders_token_key ON orders (token);
