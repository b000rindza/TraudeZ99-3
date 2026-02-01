import type { Candle, Trade, OrderBook } from '../data/types.js';
import type { SignalAction } from '../utils/types.js';

/** A strategy's recommendation to buy, sell, or hold. */
export interface Signal {
  action: SignalAction;
  symbol: string;
  confidence: number; // 0.0 – 1.0
  reason: string;
  metadata?: Record<string, unknown>;
}

/** Configuration passed to a strategy at initialization. */
export type StrategyConfig = Record<string, unknown>;

/** Contract that all trading strategies must implement. */
export interface IStrategy {
  readonly name: string;
  readonly version: string;
  readonly description: string;

  /** Called once before the strategy starts receiving data. */
  initialize(config: StrategyConfig): Promise<void>;

  /** Called once when the strategy is stopped. */
  dispose(): Promise<void>;

  /** Called on every new candle. Return a signal or null. */
  onCandle(candle: Candle): Signal | null;

  /** Called on every trade (optional). */
  onTrade?(trade: Trade): Signal | null;

  /** Called on order book updates (optional). */
  onOrderBook?(book: OrderBook): Signal | null;
}
