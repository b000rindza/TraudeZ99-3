import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('database');

let db: SqlJsDatabase | null = null;
let dbPath: string | null = null;

const SCHEMA = `
  -- OHLCV candlestick data
  CREATE TABLE IF NOT EXISTS candles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(exchange, symbol, timeframe, timestamp)
  );

  CREATE INDEX IF NOT EXISTS idx_candles_lookup ON candles(exchange, symbol, timeframe);
  CREATE INDEX IF NOT EXISTS idx_candles_timestamp ON candles(timestamp);

  -- Individual trade data
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    price REAL NOT NULL,
    amount REAL NOT NULL,
    side TEXT NOT NULL,
    trade_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_trades_lookup ON trades(exchange, symbol);
  CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);

  -- Ticker snapshots
  CREATE TABLE IF NOT EXISTS tickers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    bid REAL NOT NULL,
    ask REAL NOT NULL,
    last REAL NOT NULL,
    volume_24h REAL NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tickers_lookup ON tickers(exchange, symbol);

  -- Data sync status tracking
  CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    last_synced_at INTEGER,
    oldest_candle INTEGER,
    newest_candle INTEGER,
    candle_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle',
    error_message TEXT,
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(exchange, symbol, timeframe)
  );
`;

export async function initDatabase(path?: string): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs();
  dbPath = path ?? './data/tradez99.db';

  if (existsSync(dbPath)) {
    log.info({ path: dbPath }, 'Loading existing database');
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    log.info({ path: dbPath }, 'Creating new database');
    db = new SQL.Database();
  }

  // Run schema migrations
  db.run(SCHEMA);
  saveDatabase();

  log.info('Database initialized');
  return db;
}

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function saveDatabase(): void {
  if (!db || !dbPath) return;

  const data = db.export();
  const buffer = Buffer.from(data);

  // Ensure directory exists
  const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
  if (dir && !existsSync(dir)) {
    const { mkdirSync } = require('node:fs');
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(dbPath, buffer);
  log.debug({ path: dbPath }, 'Database saved');
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    dbPath = null;
    log.info('Database closed');
  }
}
