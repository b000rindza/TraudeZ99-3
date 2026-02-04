import { Exchange, type OHLCV } from 'ccxt';
import type { Candle, OrderBook, Ticker, Trade } from '../data/types.js';
import type { ExchangeId, Timeframe } from '../utils/types.js';
import { createChildLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import type {
  Balance,
  CandleHandler,
  ConnectionStatus,
  ConnectionStatusHandler,
  ExchangeCredentials,
  FetchOHLCVOptions,
  IExchangeClient,
  MarketInfo,
  SubscribeCandlesOptions,
  TradeHandler,
} from './types.js';

/**
 * Base exchange client using ccxt.
 * Provides common functionality for all exchanges.
 * Subclasses can override methods for exchange-specific behavior.
 */
export abstract class BaseExchangeClient implements IExchangeClient {
  abstract readonly id: ExchangeId;
  abstract readonly name: string;

  protected readonly log;
  protected readonly exchange: Exchange;
  protected connectionStatus: ConnectionStatus = 'disconnected';
  protected statusHandlers: ConnectionStatusHandler[] = [];
  protected candleHandlers: Map<string, CandleHandler> = new Map();
  protected tradeHandlers: Map<string, TradeHandler> = new Map();
  protected wsConnections: Map<string, unknown> = new Map();

  constructor(
    ExchangeClass: typeof Exchange,
    credentials?: ExchangeCredentials,
  ) {
    this.log = createChildLogger(this.constructor.name);

    const config: {
      enableRateLimit?: boolean;
      apiKey?: string;
      secret?: string;
      password?: string;
    } = {
      enableRateLimit: true,
    };

    if (credentials) {
      config.apiKey = credentials.apiKey;
      config.secret = credentials.apiSecret;
      if (credentials.password) {
        config.password = credentials.password;
      }
    }

    this.exchange = new ExchangeClass(config);
  }

  get isAuthenticated(): boolean {
    return Boolean(this.exchange.apiKey && this.exchange.secret);
  }

  // ─── Market Data (REST) ───────────────────────────────────────────────

  async fetchMarkets(): Promise<MarketInfo[]> {
    const markets = await withRetry(
      () => this.exchange.loadMarkets(),
      'fetchMarkets',
    );

    return Object.values(markets)
      .filter((m): m is NonNullable<typeof m> => m !== undefined)
      .map((m) => ({
        symbol: m.symbol ?? '',
        base: m.base ?? '',
        quote: m.quote ?? '',
        active: m.active ?? true,
        precision: {
          amount: typeof m.precision?.amount === 'number' ? m.precision.amount : 8,
          price: typeof m.precision?.price === 'number' ? m.precision.price : 8,
        },
        limits: {
          amount: {
            min: typeof m.limits?.amount?.min === 'number' ? m.limits.amount.min : 0,
            max: typeof m.limits?.amount?.max === 'number' ? m.limits.amount.max : Infinity,
          },
          price: {
            min: typeof m.limits?.price?.min === 'number' ? m.limits.price.min : 0,
            max: typeof m.limits?.price?.max === 'number' ? m.limits.price.max : Infinity,
          },
          cost: {
            min: typeof m.limits?.cost?.min === 'number' ? m.limits.cost.min : 0,
            max: typeof m.limits?.cost?.max === 'number' ? m.limits.cost.max : Infinity,
          },
        },
      }));
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    const ticker = await withRetry(
      () => this.exchange.fetchTicker(symbol),
      `fetchTicker:${symbol}`,
    );

    return {
      exchange: this.id,
      symbol,
      timestamp: ticker.timestamp ?? Date.now(),
      bid: typeof ticker.bid === 'number' ? ticker.bid : 0,
      ask: typeof ticker.ask === 'number' ? ticker.ask : 0,
      last: typeof ticker.last === 'number' ? ticker.last : 0,
      volume24h: typeof ticker.baseVolume === 'number' ? ticker.baseVolume : 0,
    };
  }

  async fetchOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const book = await withRetry(
      () => this.exchange.fetchOrderBook(symbol, limit),
      `fetchOrderBook:${symbol}`,
    );

    return {
      exchange: this.id,
      symbol,
      timestamp: book.timestamp ?? Date.now(),
      bids: book.bids.map((b) => [Number(b[0]), Number(b[1])] as [number, number]),
      asks: book.asks.map((a) => [Number(a[0]), Number(a[1])] as [number, number]),
    };
  }

  async fetchOHLCV(options: FetchOHLCVOptions): Promise<Candle[]> {
    const { symbol, timeframe, since, limit } = options;

    const ohlcv = await withRetry(
      () => this.exchange.fetchOHLCV(symbol, timeframe, since, limit),
      `fetchOHLCV:${symbol}:${timeframe}`,
    );

    return this.normalizeOHLCV(ohlcv, symbol, timeframe);
  }

  async fetchTrades(symbol: string, limit = 100): Promise<Trade[]> {
    const trades = await withRetry(
      () => this.exchange.fetchTrades(symbol, undefined, limit),
      `fetchTrades:${symbol}`,
    );

    return trades.map((t) => ({
      exchange: this.id,
      symbol,
      timestamp: t.timestamp ?? Date.now(),
      price: typeof t.price === 'number' ? t.price : Number(t.price),
      amount: typeof t.amount === 'number' ? t.amount : Number(t.amount),
      side: (t.side ?? 'buy') as 'buy' | 'sell',
    }));
  }

  // ─── Streaming (WebSocket) ────────────────────────────────────────────

  async subscribeCandles(
    options: SubscribeCandlesOptions,
    handler: CandleHandler,
  ): Promise<void> {
    const key = `${options.symbol}:${options.timeframe}`;
    this.candleHandlers.set(key, handler);
    await this.startCandleStream(options);
  }

  async unsubscribeCandles(symbol: string, timeframe: Timeframe): Promise<void> {
    const key = `${symbol}:${timeframe}`;
    this.candleHandlers.delete(key);
    await this.stopCandleStream(symbol, timeframe);
  }

  async subscribeTrades(symbol: string, handler: TradeHandler): Promise<void> {
    this.tradeHandlers.set(symbol, handler);
    await this.startTradeStream(symbol);
  }

  async unsubscribeTrades(symbol: string): Promise<void> {
    this.tradeHandlers.delete(symbol);
    await this.stopTradeStream(symbol);
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  onConnectionStatusChange(handler: ConnectionStatusHandler): void {
    this.statusHandlers.push(handler);
  }

  protected setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.log.info({ status }, 'Connection status changed');
      for (const handler of this.statusHandlers) {
        handler(status);
      }
    }
  }

  // ─── Account (Authenticated) ──────────────────────────────────────────

  async fetchBalance(): Promise<Balance> {
    if (!this.isAuthenticated) {
      throw new Error('Cannot fetch balance without authentication');
    }

    const balance = await withRetry(
      () => this.exchange.fetchBalance(),
      'fetchBalance',
    );

    const result: Balance = {};
    for (const [asset, data] of Object.entries(balance)) {
      if (typeof data === 'object' && data !== null && 'free' in data) {
        const b = data as { free?: number; used?: number; total?: number };
        const total = typeof b.total === 'number' ? b.total : 0;
        if (total > 0) {
          result[asset] = {
            asset,
            free: typeof b.free === 'number' ? b.free : 0,
            used: typeof b.used === 'number' ? b.used : 0,
            total,
          };
        }
      }
    }

    return result;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  async close(): Promise<void> {
    this.candleHandlers.clear();
    this.tradeHandlers.clear();
    this.statusHandlers = [];
    await this.closeAllStreams();
    this.setConnectionStatus('disconnected');
    this.log.info('Exchange client closed');
  }

  // ─── Protected Helpers ────────────────────────────────────────────────

  protected normalizeOHLCV(
    ohlcv: OHLCV[],
    symbol: string,
    timeframe: Timeframe,
  ): Candle[] {
    return ohlcv.map((bar) => ({
      exchange: this.id,
      symbol,
      timeframe,
      timestamp: Number(bar[0]),
      open: Number(bar[1]),
      high: Number(bar[2]),
      low: Number(bar[3]),
      close: Number(bar[4]),
      volume: Number(bar[5]),
    }));
  }

  // ─── Abstract Methods (Exchange-Specific) ─────────────────────────────

  protected abstract startCandleStream(options: SubscribeCandlesOptions): Promise<void>;
  protected abstract stopCandleStream(symbol: string, timeframe: Timeframe): Promise<void>;
  protected abstract startTradeStream(symbol: string): Promise<void>;
  protected abstract stopTradeStream(symbol: string): Promise<void>;
  protected abstract closeAllStreams(): Promise<void>;
}
