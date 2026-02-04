import { getDatabase, saveDatabase } from '../database.js';
import type { Candle } from '../../data/types.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('candle-repo');

export interface CandleQuery {
  exchange: string;
  symbol: string;
  timeframe: string;
  since?: number; // Unix timestamp ms
  until?: number; // Unix timestamp ms
  limit?: number;
}

export interface SyncStatus {
  exchange: string;
  symbol: string;
  timeframe: string;
  lastSyncedAt: number | null;
  oldestCandle: number | null;
  newestCandle: number | null;
  candleCount: number;
  status: 'idle' | 'syncing' | 'error';
  errorMessage: string | null;
}

/**
 * Insert or update candles in the database (upsert).
 * Returns the number of candles inserted/updated.
 */
export function upsertCandles(candles: Candle[]): number {
  if (candles.length === 0) return 0;

  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO candles (exchange, symbol, timeframe, timestamp, open, high, low, close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(exchange, symbol, timeframe, timestamp) DO UPDATE SET
      open = excluded.open,
      high = excluded.high,
      low = excluded.low,
      close = excluded.close,
      volume = excluded.volume
  `);

  let count = 0;
  for (const candle of candles) {
    stmt.run([
      candle.exchange,
      candle.symbol,
      candle.timeframe,
      candle.timestamp,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
    ]);
    count++;
  }
  stmt.free();

  // Save periodically (every 1000 candles) or at end
  if (count > 0) {
    saveDatabase();
    log.debug({ count, symbol: candles[0].symbol }, 'Upserted candles');
  }

  return count;
}

/**
 * Query candles from the database.
 */
export function queryCandles(query: CandleQuery): Candle[] {
  const db = getDatabase();
  const conditions: string[] = [
    'exchange = ?',
    'symbol = ?',
    'timeframe = ?',
  ];
  const params: (string | number)[] = [query.exchange, query.symbol, query.timeframe];

  if (query.since !== undefined) {
    conditions.push('timestamp >= ?');
    params.push(query.since);
  }

  if (query.until !== undefined) {
    conditions.push('timestamp <= ?');
    params.push(query.until);
  }

  let sql = `SELECT * FROM candles WHERE ${conditions.join(' AND ')} ORDER BY timestamp ASC`;

  if (query.limit !== undefined) {
    sql += ` LIMIT ${query.limit}`;
  }

  const stmt = db.prepare(sql);
  stmt.bind(params);

  const candles: Candle[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    candles.push({
      exchange: row.exchange as string,
      symbol: row.symbol as string,
      timeframe: row.timeframe as string,
      timestamp: row.timestamp as number,
      open: row.open as number,
      high: row.high as number,
      low: row.low as number,
      close: row.close as number,
      volume: row.volume as number,
    } as Candle);
  }
  stmt.free();

  return candles;
}

/**
 * Get the newest candle timestamp for a given symbol/timeframe.
 */
export function getNewestCandleTimestamp(
  exchange: string,
  symbol: string,
  timeframe: string,
): number | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT MAX(timestamp) as newest FROM candles
    WHERE exchange = ? AND symbol = ? AND timeframe = ?
  `);
  stmt.bind([exchange, symbol, timeframe]);

  let newest: number | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    newest = row.newest as number | null;
  }
  stmt.free();

  return newest;
}

/**
 * Get the oldest candle timestamp for a given symbol/timeframe.
 */
export function getOldestCandleTimestamp(
  exchange: string,
  symbol: string,
  timeframe: string,
): number | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT MIN(timestamp) as oldest FROM candles
    WHERE exchange = ? AND symbol = ? AND timeframe = ?
  `);
  stmt.bind([exchange, symbol, timeframe]);

  let oldest: number | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    oldest = row.oldest as number | null;
  }
  stmt.free();

  return oldest;
}

/**
 * Get candle count for a given symbol/timeframe.
 */
export function getCandleCount(
  exchange: string,
  symbol: string,
  timeframe: string,
): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM candles
    WHERE exchange = ? AND symbol = ? AND timeframe = ?
  `);
  stmt.bind([exchange, symbol, timeframe]);

  let count = 0;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    count = row.count as number;
  }
  stmt.free();

  return count;
}

/**
 * Update sync status for a symbol/timeframe.
 */
export function updateSyncStatus(status: Partial<SyncStatus> & Pick<SyncStatus, 'exchange' | 'symbol' | 'timeframe'>): void {
  const db = getDatabase();

  db.run(`
    INSERT INTO sync_status (exchange, symbol, timeframe, last_synced_at, oldest_candle, newest_candle, candle_count, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(exchange, symbol, timeframe) DO UPDATE SET
      last_synced_at = COALESCE(excluded.last_synced_at, sync_status.last_synced_at),
      oldest_candle = COALESCE(excluded.oldest_candle, sync_status.oldest_candle),
      newest_candle = COALESCE(excluded.newest_candle, sync_status.newest_candle),
      candle_count = COALESCE(excluded.candle_count, sync_status.candle_count),
      status = COALESCE(excluded.status, sync_status.status),
      error_message = excluded.error_message,
      updated_at = strftime('%s', 'now')
  `, [
    status.exchange,
    status.symbol,
    status.timeframe,
    status.lastSyncedAt ?? null,
    status.oldestCandle ?? null,
    status.newestCandle ?? null,
    status.candleCount ?? 0,
    status.status ?? 'idle',
    status.errorMessage ?? null,
  ]);

  saveDatabase();
}

/**
 * Get sync status for a symbol/timeframe.
 */
export function getSyncStatus(
  exchange: string,
  symbol: string,
  timeframe: string,
): SyncStatus | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM sync_status
    WHERE exchange = ? AND symbol = ? AND timeframe = ?
  `);
  stmt.bind([exchange, symbol, timeframe]);

  let status: SyncStatus | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    status = {
      exchange: row.exchange as string,
      symbol: row.symbol as string,
      timeframe: row.timeframe as string,
      lastSyncedAt: row.last_synced_at as number | null,
      oldestCandle: row.oldest_candle as number | null,
      newestCandle: row.newest_candle as number | null,
      candleCount: row.candle_count as number,
      status: row.status as 'idle' | 'syncing' | 'error',
      errorMessage: row.error_message as string | null,
    };
  }
  stmt.free();

  return status;
}
