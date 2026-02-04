import type { IExchangeClient } from '../exchange/types.js';
import type { Candle } from './types.js';
import {
  upsertCandles,
  getNewestCandleTimestamp,
  getOldestCandleTimestamp,
  updateSyncStatus,
  getCandleCount,
} from '../persistence/index.js';
import { createChildLogger } from '../utils/logger.js';
import type { Timeframe } from '../utils/types.js';

const log = createChildLogger('backfill');

export interface BackfillOptions {
  /** Exchange client to fetch from. */
  client: IExchangeClient;
  /** Trading pair symbol (e.g., "BTC/USDT"). */
  symbol: string;
  /** Candle timeframe. */
  timeframe: Timeframe;
  /** Start timestamp (Unix ms). If not provided, fetches from earliest available. */
  since?: number;
  /** End timestamp (Unix ms). If not provided, fetches until now. */
  until?: number;
  /** Maximum candles per request (exchange-dependent). */
  batchSize?: number;
  /** Delay between requests in ms (for rate limiting). */
  delayMs?: number;
  /** Callback for progress updates. */
  onProgress?: (progress: BackfillProgress) => void;
}

export interface BackfillProgress {
  symbol: string;
  timeframe: Timeframe;
  fetchedCandles: number;
  totalCandles: number;
  oldestTimestamp: number;
  newestTimestamp: number;
  percentComplete: number;
}

export interface BackfillResult {
  success: boolean;
  symbol: string;
  timeframe: Timeframe;
  candlesFetched: number;
  oldestCandle: number | null;
  newestCandle: number | null;
  error?: string;
}

/** Timeframe durations in milliseconds. */
const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

/**
 * Backfill historical candle data from an exchange.
 * Fetches candles in batches and stores them in the database.
 */
export async function backfillCandles(options: BackfillOptions): Promise<BackfillResult> {
  const {
    client,
    symbol,
    timeframe,
    since,
    until = Date.now(),
    batchSize = 1000,
    delayMs = 100,
    onProgress,
  } = options;

  log.info({ symbol, timeframe, since, until }, 'Starting backfill');

  updateSyncStatus({
    exchange: client.id,
    symbol,
    timeframe,
    status: 'syncing',
    errorMessage: null,
  });

  try {
    // Determine the starting point
    let fetchSince = since;
    if (!fetchSince) {
      // Check if we have existing data and can resume
      const oldest = getOldestCandleTimestamp(client.id, symbol, timeframe);
      const newest = getNewestCandleTimestamp(client.id, symbol, timeframe);

      if (newest) {
        // We have existing data - fetch forward from newest
        fetchSince = newest + TIMEFRAME_MS[timeframe];
        log.info(
          { existingOldest: oldest, existingNewest: newest, resumeFrom: fetchSince },
          'Resuming backfill from existing data',
        );
      } else {
        // No existing data - start from 1 year ago
        fetchSince = until - 365 * 24 * 60 * 60 * 1000;
        log.info({ startFrom: fetchSince }, 'Starting fresh backfill');
      }
    }

    let totalFetched = 0;
    let currentSince = fetchSince;
    let lastCandle: Candle | null = null;

    // Estimate total candles for progress reporting
    const estimatedTotal = Math.ceil((until - fetchSince) / TIMEFRAME_MS[timeframe]);

    while (currentSince < until) {
      // Fetch a batch of candles
      const candles = await client.fetchOHLCV({
        symbol,
        timeframe,
        since: currentSince,
        limit: batchSize,
      });

      if (candles.length === 0) {
        log.debug({ currentSince }, 'No more candles to fetch');
        break;
      }

      // Store candles in database
      const inserted = upsertCandles(candles);
      totalFetched += candles.length;

      // Update progress
      lastCandle = candles[candles.length - 1];
      const oldestFetched = candles[0];

      if (onProgress) {
        onProgress({
          symbol,
          timeframe,
          fetchedCandles: totalFetched,
          totalCandles: estimatedTotal,
          oldestTimestamp: oldestFetched.timestamp,
          newestTimestamp: lastCandle.timestamp,
          percentComplete: Math.min(100, (totalFetched / estimatedTotal) * 100),
        });
      }

      log.debug(
        {
          batch: candles.length,
          inserted,
          total: totalFetched,
          newest: new Date(lastCandle.timestamp).toISOString(),
        },
        'Fetched candle batch',
      );

      // Move to next batch
      currentSince = lastCandle.timestamp + TIMEFRAME_MS[timeframe];

      // Rate limit delay
      if (candles.length === batchSize && currentSince < until) {
        await sleep(delayMs);
      }
    }

    // Update sync status with final state
    const finalOldest = getOldestCandleTimestamp(client.id, symbol, timeframe);
    const finalNewest = getNewestCandleTimestamp(client.id, symbol, timeframe);
    const finalCount = getCandleCount(client.id, symbol, timeframe);

    updateSyncStatus({
      exchange: client.id,
      symbol,
      timeframe,
      status: 'idle',
      lastSyncedAt: Date.now(),
      oldestCandle: finalOldest,
      newestCandle: finalNewest,
      candleCount: finalCount,
    });

    log.info(
      { symbol, timeframe, totalFetched, finalCount },
      'Backfill complete',
    );

    return {
      success: true,
      symbol,
      timeframe,
      candlesFetched: totalFetched,
      oldestCandle: finalOldest,
      newestCandle: finalNewest,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error({ symbol, timeframe, error }, 'Backfill failed');

    updateSyncStatus({
      exchange: client.id,
      symbol,
      timeframe,
      status: 'error',
      errorMessage,
    });

    return {
      success: false,
      symbol,
      timeframe,
      candlesFetched: 0,
      oldestCandle: null,
      newestCandle: null,
      error: errorMessage,
    };
  }
}

/**
 * Backfill historical data going backwards (from oldest existing to further back in time).
 * Useful for extending historical data range.
 */
export async function backfillBackwards(options: BackfillOptions): Promise<BackfillResult> {
  const {
    client,
    symbol,
    timeframe,
    batchSize = 1000,
    delayMs = 100,
    onProgress,
  } = options;

  const oldest = getOldestCandleTimestamp(client.id, symbol, timeframe);
  if (!oldest) {
    return backfillCandles(options);
  }

  // How far back to go (default 1 year before oldest)
  const targetSince = options.since ?? oldest - 365 * 24 * 60 * 60 * 1000;

  log.info(
    { symbol, timeframe, oldest, targetSince },
    'Starting backwards backfill',
  );

  updateSyncStatus({
    exchange: client.id,
    symbol,
    timeframe,
    status: 'syncing',
    errorMessage: null,
  });

  try {
    let totalFetched = 0;
    let currentUntil = oldest;
    const estimatedTotal = Math.ceil((oldest - targetSince) / TIMEFRAME_MS[timeframe]);

    while (currentUntil > targetSince) {
      // Calculate the fetch start point
      const fetchSince = Math.max(
        targetSince,
        currentUntil - batchSize * TIMEFRAME_MS[timeframe],
      );

      const candles = await client.fetchOHLCV({
        symbol,
        timeframe,
        since: fetchSince,
        limit: batchSize,
      });

      if (candles.length === 0) {
        log.debug({ currentUntil }, 'No more historical candles available');
        break;
      }

      // Filter candles that are before our current oldest
      const newCandles = candles.filter((c) => c.timestamp < currentUntil);

      if (newCandles.length === 0) {
        break;
      }

      const inserted = upsertCandles(newCandles);
      totalFetched += newCandles.length;

      const oldestFetched = newCandles[0];
      currentUntil = oldestFetched.timestamp;

      if (onProgress) {
        onProgress({
          symbol,
          timeframe,
          fetchedCandles: totalFetched,
          totalCandles: estimatedTotal,
          oldestTimestamp: oldestFetched.timestamp,
          newestTimestamp: oldest,
          percentComplete: Math.min(100, (totalFetched / estimatedTotal) * 100),
        });
      }

      log.debug(
        {
          batch: newCandles.length,
          inserted,
          total: totalFetched,
          oldest: new Date(oldestFetched.timestamp).toISOString(),
        },
        'Fetched historical batch',
      );

      await sleep(delayMs);
    }

    // Update sync status
    const finalOldest = getOldestCandleTimestamp(client.id, symbol, timeframe);
    const finalNewest = getNewestCandleTimestamp(client.id, symbol, timeframe);
    const finalCount = getCandleCount(client.id, symbol, timeframe);

    updateSyncStatus({
      exchange: client.id,
      symbol,
      timeframe,
      status: 'idle',
      lastSyncedAt: Date.now(),
      oldestCandle: finalOldest,
      newestCandle: finalNewest,
      candleCount: finalCount,
    });

    log.info(
      { symbol, timeframe, totalFetched, finalCount },
      'Backwards backfill complete',
    );

    return {
      success: true,
      symbol,
      timeframe,
      candlesFetched: totalFetched,
      oldestCandle: finalOldest,
      newestCandle: finalNewest,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error({ symbol, timeframe, error }, 'Backwards backfill failed');

    updateSyncStatus({
      exchange: client.id,
      symbol,
      timeframe,
      status: 'error',
      errorMessage,
    });

    return {
      success: false,
      symbol,
      timeframe,
      candlesFetched: 0,
      oldestCandle: null,
      newestCandle: null,
      error: errorMessage,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
