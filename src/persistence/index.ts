export { initDatabase, getDatabase, saveDatabase, closeDatabase } from './database.js';
export {
  upsertCandles,
  queryCandles,
  getNewestCandleTimestamp,
  getOldestCandleTimestamp,
  getCandleCount,
  updateSyncStatus,
  getSyncStatus,
} from './repositories/candles.js';
export type { CandleQuery, SyncStatus } from './repositories/candles.js';
