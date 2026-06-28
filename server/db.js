const { Pool } = require('pg');

const DEFAULT_ROOM_CODE = process.env.ROOM_CODE || 'IPL2026';
let pool = null;
let defaultRoomId = 1;

function isEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function needsSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'true') return true;
  if (process.env.DATABASE_SSL === 'false') return false;
  const url = connectionString || process.env.DATABASE_URL || '';
  return (
    process.env.NODE_ENV === 'production' ||
    url.includes('neon.tech') ||
    url.includes('render.com') ||
    url.includes('supabase.co')
  );
}

function getPool() {
  if (!isEnabled()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: needsSsl() ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

async function migrateLegacyAuctionState(client) {
  const { rows } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'auction_state' AND column_name = 'id'
  `);
  if (!rows.length) return;

  const legacy = await client.query('SELECT payload FROM auction_state WHERE id = 1');
  if (!legacy.rows.length) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS auction_state_new (
      room_id INTEGER PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(
    `INSERT INTO auction_state_new (room_id, payload, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (room_id) DO UPDATE SET payload = EXCLUDED.payload`,
    [defaultRoomId, legacy.rows[0].payload]
  );
  await client.query('DROP TABLE auction_state');
  await client.query('ALTER TABLE auction_state_new RENAME TO auction_state');
}

async function migrateRtmApprovalStatus(client) {
  await client.query(`
    ALTER TABLE rtm_lists ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'draft'
  `);
  await client.query(`
    ALTER TABLE rtm_lists ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ
  `);

  const { rows } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'rtm_lists' AND column_name = 'submitted'
  `);
  if (rows.length) {
    await client.query(`
      UPDATE rtm_lists
      SET status = CASE WHEN submitted = true THEN 'accepted' ELSE 'draft' END
      WHERE status = 'draft' OR status IS NULL
    `);
  }
}

async function init() {
  if (!isEnabled()) {
    console.log('DATABASE_URL not set — auction state kept in memory only');
    return false;
  }

  const client = await getPool().connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        code VARCHAR(32) UNIQUE NOT NULL,
        name VARCHAR(128) NOT NULL DEFAULT 'Main Auction',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS auction_state (
        room_id INTEGER PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
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
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trades_room_id ON trades(room_id);
    `);

    await client.query(`
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
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rtm_team ON rtm_lists(room_id, team_id);
    `);

    await migrateRtmApprovalStatus(client);

    const roomResult = await client.query(
      `INSERT INTO rooms (code, name)
       VALUES ($1, 'Main Auction')
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [DEFAULT_ROOM_CODE.toUpperCase()]
    );
    defaultRoomId = roomResult.rows[0].id;

    await migrateLegacyAuctionState(client);

    console.log(`Postgres connected (Neon-compatible) — room code: ${DEFAULT_ROOM_CODE}`);
    return true;
  } finally {
    client.release();
  }
}

function getDefaultRoomId() {
  return defaultRoomId;
}

function getDefaultRoomCode() {
  return DEFAULT_ROOM_CODE.toUpperCase();
}

async function validateRoomCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;

  if (!isEnabled()) {
    return normalized === getDefaultRoomCode()
      ? { id: defaultRoomId, code: normalized, name: 'Main Auction' }
      : null;
  }

  const { rows } = await getPool().query(
    'SELECT id, code, name FROM rooms WHERE UPPER(code) = $1',
    [normalized]
  );
  return rows[0] || null;
}

async function loadState(roomId = defaultRoomId) {
  if (!isEnabled()) return null;

  const { rows } = await getPool().query(
    'SELECT payload FROM auction_state WHERE room_id = $1',
    [roomId]
  );
  if (!rows.length) return null;
  return rows[0].payload;
}

async function saveState(payload, roomId = defaultRoomId) {
  if (!isEnabled()) return;

  await getPool().query(
    `INSERT INTO auction_state (room_id, payload, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (room_id) DO UPDATE
     SET payload = EXCLUDED.payload, updated_at = now()`,
    [roomId, JSON.stringify(payload)]
  );
}

async function loadTrades(roomId = defaultRoomId) {
  if (!isEnabled()) return [];

  const { rows } = await getPool().query(
    `SELECT id, room_id, proposer_team_id, receiver_team_id,
            offered_player_id, requested_player_id, status,
            created_at, resolved_at, resolved_by
     FROM trades WHERE room_id = $1
     ORDER BY created_at DESC`,
    [roomId]
  );
  return rows.map(formatTradeRow);
}

async function insertTrade(trade, roomId = defaultRoomId) {
  if (!isEnabled()) {
    return {
      id: `local-${Date.now()}`,
      roomId,
      proposerTeamId: trade.proposerTeamId,
      receiverTeamId: trade.receiverTeamId,
      offeredPlayerId: trade.offeredPlayerId,
      requestedPlayerId: trade.requestedPlayerId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null
    };
  }

  const { rows } = await getPool().query(
    `INSERT INTO trades (
       room_id, proposer_team_id, receiver_team_id,
       offered_player_id, requested_player_id, status
     ) VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id, room_id, proposer_team_id, receiver_team_id,
               offered_player_id, requested_player_id, status,
               created_at, resolved_at, resolved_by`,
    [
      roomId,
      trade.proposerTeamId,
      trade.receiverTeamId,
      trade.offeredPlayerId,
      trade.requestedPlayerId
    ]
  );
  return formatTradeRow(rows[0]);
}

async function updateTradeStatus(id, status, resolvedBy, roomId = defaultRoomId) {
  if (!isEnabled()) return null;

  const { rows } = await getPool().query(
    `UPDATE trades
     SET status = $1, resolved_at = now(), resolved_by = $2
     WHERE id = $3 AND room_id = $4
     RETURNING id, room_id, proposer_team_id, receiver_team_id,
               offered_player_id, requested_player_id, status,
               created_at, resolved_at, resolved_by`,
    [status, resolvedBy, id, roomId]
  );
  return rows[0] ? formatTradeRow(rows[0]) : null;
}

async function clearTrades(roomId = defaultRoomId) {
  if (!isEnabled()) return;
  await getPool().query('DELETE FROM trades WHERE room_id = $1', [roomId]);
}

function formatRtmRow(row) {
  let status = row.status;
  if (!status && row.submitted !== undefined) {
    status = row.submitted ? 'accepted' : 'draft';
  }
  return {
    id: row.id,
    roomId: row.room_id,
    teamId: row.team_id,
    playerId: row.player_id,
    status: status || 'draft',
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at
  };
}

async function loadRtmEntries(roomId = defaultRoomId) {
  if (!isEnabled()) return [];

  const { rows } = await getPool().query(
    `SELECT id, room_id, team_id, player_id, status, submitted_at, reviewed_at, created_at
     FROM rtm_lists WHERE room_id = $1
     ORDER BY created_at ASC`,
    [roomId]
  );
  return rows.map(formatRtmRow);
}

async function insertRtmEntry(roomId, teamId, playerId, status = 'draft') {
  if (!isEnabled()) {
    return {
      id: `local-rtm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      teamId,
      playerId,
      status,
      submittedAt: null,
      reviewedAt: null,
      createdAt: new Date().toISOString()
    };
  }

  const { rows } = await getPool().query(
    `INSERT INTO rtm_lists (room_id, team_id, player_id, status)
     VALUES ($1, $2, $3, $4)
     RETURNING id, room_id, team_id, player_id, status, submitted_at, reviewed_at, created_at`,
    [roomId, teamId, playerId, status]
  );
  return formatRtmRow(rows[0]);
}

async function removeRtmEntry(roomId, teamId, playerId) {
  if (!isEnabled()) return true;

  const { rowCount } = await getPool().query(
    `DELETE FROM rtm_lists
     WHERE room_id = $1 AND team_id = $2 AND player_id = $3
       AND status IN ('draft', 'rejected')`,
    [roomId, teamId, playerId]
  );
  return rowCount > 0;
}

async function submitRtmTeam(roomId, teamId) {
  if (!isEnabled()) return;

  await getPool().query(
    `UPDATE rtm_lists
     SET status = 'pending', submitted_at = now(), reviewed_at = NULL
     WHERE room_id = $1 AND team_id = $2 AND status IN ('draft', 'rejected')`,
    [roomId, teamId]
  );
}

async function acceptRtmTeam(roomId, teamId) {
  if (!isEnabled()) return;

  await getPool().query(
    `UPDATE rtm_lists
     SET status = 'accepted', reviewed_at = now()
     WHERE room_id = $1 AND team_id = $2 AND status = 'pending'`,
    [roomId, teamId]
  );
}

async function rejectRtmTeam(roomId, teamId) {
  if (!isEnabled()) return;

  await getPool().query(
    `UPDATE rtm_lists
     SET status = 'rejected', reviewed_at = now()
     WHERE room_id = $1 AND team_id = $2 AND status = 'pending'`,
    [roomId, teamId]
  );
}

async function clearRtmEntries(roomId = defaultRoomId) {
  if (!isEnabled()) return;
  await getPool().query('DELETE FROM rtm_lists WHERE room_id = $1', [roomId]);
}

function formatTradeRow(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    proposerTeamId: row.proposer_team_id,
    receiverTeamId: row.receiver_team_id,
    offeredPlayerId: row.offered_player_id,
    requestedPlayerId: row.requested_player_id,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by
  };
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  init,
  loadState,
  saveState,
  loadTrades,
  insertTrade,
  updateTradeStatus,
  clearTrades,
  loadRtmEntries,
  insertRtmEntry,
  removeRtmEntry,
  submitRtmTeam,
  acceptRtmTeam,
  rejectRtmTeam,
  clearRtmEntries,
  validateRoomCode,
  getDefaultRoomId,
  getDefaultRoomCode,
  close,
  isEnabled
};
