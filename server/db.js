const { Pool } = require('pg');

const ROW_ID = 1;
let pool = null;

function isEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!isEnabled()) return null;
  if (!pool) {
    const ssl =
      process.env.DATABASE_SSL === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL?.includes('render.com'));
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: ssl ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

async function init() {
  if (!isEnabled()) {
    console.log('DATABASE_URL not set — auction state kept in memory only');
    return false;
  }

  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS auction_state (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    console.log('Postgres connected — auction state will persist');
    return true;
  } finally {
    client.release();
  }
}

async function loadState() {
  if (!isEnabled()) return null;

  const { rows } = await getPool().query(
    'SELECT payload FROM auction_state WHERE id = $1',
    [ROW_ID]
  );
  if (!rows.length) return null;
  return rows[0].payload;
}

async function saveState(payload) {
  if (!isEnabled()) return;

  await getPool().query(
    `INSERT INTO auction_state (id, payload, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id) DO UPDATE
     SET payload = EXCLUDED.payload, updated_at = now()`,
    [ROW_ID, JSON.stringify(payload)]
  );
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { init, loadState, saveState, close, isEnabled };
