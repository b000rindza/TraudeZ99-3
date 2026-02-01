/**
 * Backtesting Runner
 *
 * Replays historical data through strategies to evaluate performance.
 *
 * Roadmap phase: 5
 */

import { Candle } from "../core/types";
import { Strategy } from "../strategies/base";
import { RiskManager } from "../risk/manager";

export interface BacktestResult {
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  equityCurve: { timestamp: number; equity: number }[];
}

export class BacktestRunner {
  private strategy: Strategy;
  private riskManager: RiskManager;
  private initialEquity: number;

  constructor(
    strategy: Strategy,
    riskManager: RiskManager,
    initialEquity: number
  ) {
    this.strategy = strategy;
    this.riskManager = riskManager;
    this.initialEquity = initialEquity;
  }

  /** Run a backtest over historical candle data */
  run(candles: Candle[]): BacktestResult {
    // TODO: Implement full backtest loop
    // 1. Initialize strategy with warmup period
    // 2. Iterate through candles
    // 3. Generate signals via strategy.onCandle()
    // 4. Validate signals through risk manager
    // 5. Simulate order execution with slippage/fees
    // 6. Track equity curve and trade history
    // 7. Calculate performance metrics

    console.log(
      `Backtesting ${this.strategy.name} over ${candles.length} candles`
    );

    return {
      totalReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
      totalTrades: 0,
      profitFactor: 0,
      equityCurve: [],
    };
  }
}
