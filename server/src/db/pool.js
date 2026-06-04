'use strict';

const { Pool } = require('pg');

const rawConnectionString = process.env.DATABASE_URL || '';

// Managed providers like Neon require TLS. We set `ssl` explicitly below, so we
// strip `sslmode`/`channel_binding` from the URL — otherwise the pg driver
// parses `sslmode=require` and prints a noisy deprecation warning on every boot.
function cleanConnectionString(raw) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

const needsSsl =
  /sslmode=require/i.test(rawConnectionString) || /\.neon\.tech/i.test(rawConnectionString);

const pool = new Pool({
  connectionString: cleanConnectionString(rawConnectionString),
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error(`[${new Date().toISOString()}] Unexpected PG pool error:`, err.message);
});

module.exports = pool;
