-- Run in Neon SQL Editor (or any Postgres) before first deploy.
-- Requires: DATABASE_URL pointing at your Neon project.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL DEFAULT 'Main Auction',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auction_state (
  room_id INTEGER PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  proposer_team_id VARCHAR(8) NOT NULL,
  receiver_team_id VARCHAR(8) NOT NULL,
  offered_player_id VARCHAR(64) NOT NULL,
  requested_player_id VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(32)
);

CREATE INDEX IF NOT EXISTS idx_trades_room_id ON trades(room_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(room_id, status);

CREATE TABLE IF NOT EXISTS rtm_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  team_id VARCHAR(8) NOT NULL,
  player_id VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'rejected', 'accepted')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_rtm_team ON rtm_lists(room_id, team_id);

-- Default room (override code via ROOM_CODE env on app boot if row missing)
INSERT INTO rooms (code, name)
VALUES ('IPL2026', 'Main Auction')
ON CONFLICT (code) DO NOTHING;
