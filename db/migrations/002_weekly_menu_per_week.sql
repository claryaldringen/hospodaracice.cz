-- DESTRUCTIVE: drops single-row weekly_menu and recreates as per-week archive.
-- The currently uploaded weekly menu (if any) is lost; admin must re-upload via
-- the new week selector. Orphaned weekly.webp file on disk is left untouched.

DROP TABLE IF EXISTS weekly_menu;

CREATE TABLE weekly_menu (
    week_start DATE PRIMARY KEY,
    data JSONB NOT NULL,
    full_text TEXT NOT NULL DEFAULT '',
    alt_text TEXT NOT NULL DEFAULT ''
);

DELETE FROM menu_images WHERE type = 'weekly';
