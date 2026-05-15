-- db/migrations/003_action_posters.sql
CREATE TABLE action_posters (
  id          SERIAL PRIMARY KEY,
  filename    TEXT NOT NULL,
  position    INTEGER NOT NULL,
  alt_text    TEXT NOT NULL DEFAULT 'Plakát akce',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_action_posters_position ON action_posters (position);
