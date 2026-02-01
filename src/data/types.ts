import type { ExchangeId, Side, Timeframe } from '../utils/types.js';

/** Canonical OHLCV candle format. */
export interface Candle {
  exchange: ExchangeId;
  symbol: string;
  timeframe: Timeframe;
  timestamp: number; // Unix milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Canonical trade format. */
export interface Trade {
  exchange: ExchangeId;
  symbol: string;
  timestamp: number;
  price: number;
  amount: number;
  side: Side;
}

/** Order book snapshot. */
export interface OrderBook {
  exchange: ExchangeId;
  symbol: string;
  timestamp: number;
  bids: [price: number, amount: number][];
  asks: [price: number, amount: number][];
}

/** Ticker summary. */
export interface Ticker {
  exchange: ExchangeId;
  symbol: string;
  timestamp: number;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
}
