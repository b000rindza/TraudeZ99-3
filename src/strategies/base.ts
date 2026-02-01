/**
 * Base strategy interface that all trading strategies must implement.
 */

import { Candle, Signal } from "../core/types";

export interface StrategyConfig {
  name: string;
  symbols: string[];
  timeframe: string;
  parameters: Record<string, number>;
}

export interface Strategy {
  readonly name: string;

  /** Initialize the strategy with historical data */
  initialize(candles: Candle[]): void;

  /** Process a new candle and optionally return a trading signal */
  onCandle(candle: Candle): Signal | null;

  /** Update strategy parameters at runtime */
  updateParameters(params: Record<string, number>): void;
}
