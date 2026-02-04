import type { IExchangeClient, CandleHandler, TradeHandler } from '../exchange/types.js';
import type { Candle } from './types.js';
import { backfillCandles, type BackfillProgress } from './backfill.js';
import { upsertCandles, queryCandles, getSyncStatus } from '../persistence/index.js';
import { EventBus } from '../engine/event-bus.js';
import { createChildLogger } from '../utils/logger.js';
import type { Timeframe } from '../utils/types.js';

const log = createChildLogger('feed-manager');

export interface FeedConfig {
  /** Trading pair symbol. */
  symbol: string;
  /** Candle timeframe. */
  timeframe: Timeframe;
  /** Whether to backfill historical data on start. */
  backfillOnStart?: boolean;
  /** Whether to persist candles to database. */
  persistCandles?: boolean;
  /** Custom handler for candle updates (in addition to event bus). */
  onCandle?: CandleHandler;
  /** Custom handler for trade updates (in addition to event bus). */
  onTrade?: TradeHandler;
}

export interface FeedStatus {
  symbol: string;
  timeframe: Timeframe;
  isStreaming: boolean;
  lastCandle: Candle | null;
  candleCount: number;
  oldestCandle: number | null;
  newestCandle: number | null;
}

/**
 * Manages market data feeds for multiple symbols.
 * Coordinates backfilling, streaming, and persistence.
 */
export class FeedManager {
  private feeds: Map<string, FeedConfig> = new Map();
  private activeStreams: Set<string> = new Set();
  private lastCandles: Map<string, Candle> = new Map();

  constructor(
    private readonly client: IExchangeClient,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Add a new data feed.
   */
  async addFeed(config: FeedConfig): Promise<void> {
    const key = this.feedKey(config.symbol, config.timeframe);

    if (this.feeds.has(key)) {
      log.warn({ symbol: config.symbol, timeframe: config.timeframe }, 'Feed already exists');
      return;
    }

    this.feeds.set(key, config);
    log.info({ symbol: config.symbol, timeframe: config.timeframe }, 'Feed added');

    // Optionally backfill historical data
    if (config.backfillOnStart) {
      await this.backfill(config.symbol, config.timeframe);
    }
  }

  /**
   * Remove a data feed.
   */
  async removeFeed(symbol: string, timeframe: Timeframe): Promise<void> {
    const key = this.feedKey(symbol, timeframe);

    if (this.activeStreams.has(key)) {
      await this.stopStream(symbol, timeframe);
    }

    this.feeds.delete(key);
    this.lastCandles.delete(key);
    log.info({ symbol, timeframe }, 'Feed removed');
  }

  /**
   * Start streaming real-time data for a feed.
   */
  async startStream(symbol: string, timeframe: Timeframe): Promise<void> {
    const key = this.feedKey(symbol, timeframe);
    const config = this.feeds.get(key);

    if (!config) {
      throw new Error(`Feed not found: ${symbol}:${timeframe}`);
    }

    if (this.activeStreams.has(key)) {
      log.debug({ symbol, timeframe }, 'Stream already active');
      return;
    }

    await this.client.subscribeCandles(
      { symbol, timeframe },
      (candle) => this.handleCandle(config, candle),
    );

    this.activeStreams.add(key);
    log.info({ symbol, timeframe }, 'Stream started');
  }

  /**
   * Stop streaming real-time data for a feed.
   */
  async stopStream(symbol: string, timeframe: Timeframe): Promise<void> {
    const key = this.feedKey(symbol, timeframe);

    if (!this.activeStreams.has(key)) {
      return;
    }

    await this.client.unsubscribeCandles(symbol, timeframe);
    this.activeStreams.delete(key);
    log.info({ symbol, timeframe }, 'Stream stopped');
  }

  /**
   * Start all configured feeds.
   */
  async startAll(): Promise<void> {
    const startPromises: Promise<void>[] = [];

    for (const [, config] of this.feeds) {
      startPromises.push(this.startStream(config.symbol, config.timeframe));
    }

    await Promise.all(startPromises);
    log.info({ count: this.feeds.size }, 'All feeds started');
  }

  /**
   * Stop all active streams.
   */
  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    for (const key of this.activeStreams) {
      const [symbol, timeframe] = key.split(':');
      stopPromises.push(this.stopStream(symbol, timeframe as Timeframe));
    }

    await Promise.all(stopPromises);
    log.info('All feeds stopped');
  }

  /**
   * Backfill historical data for a feed.
   */
  async backfill(
    symbol: string,
    timeframe: Timeframe,
    onProgress?: (progress: BackfillProgress) => void,
  ): Promise<void> {
    log.info({ symbol, timeframe }, 'Starting backfill');

    const result = await backfillCandles({
      client: this.client,
      symbol,
      timeframe,
      onProgress,
    });

    if (result.success) {
      log.info(
        { symbol, timeframe, candlesFetched: result.candlesFetched },
        'Backfill complete',
      );
    } else {
      log.error({ symbol, timeframe, error: result.error }, 'Backfill failed');
    }
  }

  /**
   * Get historical candles from the database.
   */
  getCandles(
    symbol: string,
    timeframe: Timeframe,
    options?: { since?: number; until?: number; limit?: number },
  ): Candle[] {
    return queryCandles({
      exchange: this.client.id,
      symbol,
      timeframe,
      since: options?.since,
      until: options?.until,
      limit: options?.limit,
    });
  }

  /**
   * Get the most recent candle for a feed.
   */
  getLastCandle(symbol: string, timeframe: Timeframe): Candle | null {
    const key = this.feedKey(symbol, timeframe);
    return this.lastCandles.get(key) ?? null;
  }

  /**
   * Get status for all feeds.
   */
  getStatus(): FeedStatus[] {
    const statuses: FeedStatus[] = [];

    for (const [key, config] of this.feeds) {
      const syncStatus = getSyncStatus(this.client.id, config.symbol, config.timeframe);
      const lastCandle = this.lastCandles.get(key) ?? null;

      statuses.push({
        symbol: config.symbol,
        timeframe: config.timeframe,
        isStreaming: this.activeStreams.has(key),
        lastCandle,
        candleCount: syncStatus?.candleCount ?? 0,
        oldestCandle: syncStatus?.oldestCandle ?? null,
        newestCandle: syncStatus?.newestCandle ?? null,
      });
    }

    return statuses;
  }

  /**
   * Subscribe to trade updates for a symbol.
   */
  async subscribeTrades(symbol: string, handler?: TradeHandler): Promise<void> {
    await this.client.subscribeTrades(symbol, (trade) => {
      // Emit to event bus
      this.eventBus.emit('trade', trade);

      // Call custom handler if provided
      if (handler) {
        handler(trade);
      }
    });

    log.info({ symbol }, 'Subscribed to trades');
  }

  /**
   * Unsubscribe from trade updates for a symbol.
   */
  async unsubscribeTrades(symbol: string): Promise<void> {
    await this.client.unsubscribeTrades(symbol);
    log.info({ symbol }, 'Unsubscribed from trades');
  }

  // ─── Private Methods ──────────────────────────────────────────────────

  private feedKey(symbol: string, timeframe: Timeframe): string {
    return `${symbol}:${timeframe}`;
  }

  private handleCandle(config: FeedConfig, candle: Candle): void {
    const key = this.feedKey(config.symbol, config.timeframe);

    // Update last candle
    this.lastCandles.set(key, candle);

    // Persist if configured
    if (config.persistCandles) {
      upsertCandles([candle]);
    }

    // Emit to event bus
    this.eventBus.emit('candle', candle);

    // Call custom handler if provided
    if (config.onCandle) {
      config.onCandle(candle);
    }

    log.trace(
      {
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        close: candle.close,
        time: new Date(candle.timestamp).toISOString(),
      },
      'Candle received',
    );
  }
}
