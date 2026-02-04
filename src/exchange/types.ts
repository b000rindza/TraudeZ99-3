import type { Candle, OrderBook, Ticker, Trade } from '../data/types.js';
import type { ExchangeId, Timeframe } from '../utils/types.js';

/** Exchange credentials for authenticated endpoints. */
export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  password?: string; // Some exchanges require this
}

/** Balance for a single asset. */
export interface AssetBalance {
  asset: string;
  free: number;
  used: number;
  total: number;
}

/** Full account balance across all assets. */
export interface Balance {
  [asset: string]: AssetBalance;
}

/** Exchange market info for a trading pair. */
export interface MarketInfo {
  symbol: string;
  base: string;
  quote: string;
  active: boolean;
  precision: {
    amount: number;
    price: number;
  };
  limits: {
    amount: { min: number; max: number };
    price: { min: number; max: number };
    cost: { min: number; max: number };
  };
}

/** Options for fetching OHLCV data. */
export interface FetchOHLCVOptions {
  symbol: string;
  timeframe: Timeframe;
  since?: number; // Unix timestamp in ms
  limit?: number; // Max candles to fetch
}

/** Options for subscribing to candle streams. */
export interface SubscribeCandlesOptions {
  symbol: string;
  timeframe: Timeframe;
}

/** Connection status for WebSocket. */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Event handler for connection status changes. */
export type ConnectionStatusHandler = (status: ConnectionStatus) => void;

/** Event handler for candle updates. */
export type CandleHandler = (candle: Candle) => void;

/** Event handler for trade updates. */
export type TradeHandler = (trade: Trade) => void;

/**
 * Unified exchange client interface.
 * All exchange adapters must implement this interface.
 */
export interface IExchangeClient {
  /** Unique exchange identifier. */
  readonly id: ExchangeId;

  /** Human-readable exchange name. */
  readonly name: string;

  /** Whether the client is authenticated (has API keys). */
  readonly isAuthenticated: boolean;

  // ─── Market Data (REST) ───────────────────────────────────────────────

  /** Fetch available markets/trading pairs. */
  fetchMarkets(): Promise<MarketInfo[]>;

  /** Fetch current ticker for a symbol. */
  fetchTicker(symbol: string): Promise<Ticker>;

  /** Fetch order book for a symbol. */
  fetchOrderBook(symbol: string, limit?: number): Promise<OrderBook>;

  /** Fetch OHLCV candles. */
  fetchOHLCV(options: FetchOHLCVOptions): Promise<Candle[]>;

  /** Fetch recent trades. */
  fetchTrades(symbol: string, limit?: number): Promise<Trade[]>;

  // ─── Streaming (WebSocket) ────────────────────────────────────────────

  /** Subscribe to real-time candle updates. */
  subscribeCandles(options: SubscribeCandlesOptions, handler: CandleHandler): Promise<void>;

  /** Unsubscribe from candle updates. */
  unsubscribeCandles(symbol: string, timeframe: Timeframe): Promise<void>;

  /** Subscribe to real-time trade updates. */
  subscribeTrades(symbol: string, handler: TradeHandler): Promise<void>;

  /** Unsubscribe from trade updates. */
  unsubscribeTrades(symbol: string): Promise<void>;

  /** Get current connection status. */
  getConnectionStatus(): ConnectionStatus;

  /** Register handler for connection status changes. */
  onConnectionStatusChange(handler: ConnectionStatusHandler): void;

  // ─── Account (Authenticated) ──────────────────────────────────────────

  /** Fetch account balance. Requires authentication. */
  fetchBalance(): Promise<Balance>;

  // ─── Lifecycle ────────────────────────────────────────────────────────

  /** Close all connections and clean up resources. */
  close(): Promise<void>;
}
