/**
 * Mean Reversion Strategy
 *
 * Bets on price returning to the mean using Bollinger Bands and RSI.
 * Effective in range-bound markets with leverage on reversals.
 *
 * Roadmap phase: 3-4
 */

import { Candle, Signal } from "../core/types";
import { Strategy } from "./base";

export class MeanReversionStrategy implements Strategy {
  readonly name = "MeanReversion";

  private period: number;
  private stdMultiplier: number;
  private rsiPeriod: number;
  private closes: number[] = [];

  constructor(period = 20, stdMultiplier = 2, rsiPeriod = 14) {
    this.period = period;
    this.stdMultiplier = stdMultiplier;
    this.rsiPeriod = rsiPeriod;
  }

  initialize(candles: Candle[]): void {
    this.closes = candles.map((c) => c.close);
  }

  onCandle(candle: Candle): Signal | null {
    this.closes.push(candle.close);

    if (this.closes.length < this.period) {
      return null;
    }

    const { upper, lower, middle } = this.bollingerBands();
    const price = candle.close;

    // TODO: Add RSI confirmation
    // TODO: Add volume confirmation

    if (price <= lower) {
      return {
        symbol: candle.symbol ?? "",
        side: "buy",
        strength: Math.min((lower - price) / (middle - lower), 1),
        strategy: this.name,
        timestamp: candle.timestamp,
      };
    } else if (price >= upper) {
      return {
        symbol: candle.symbol ?? "",
        side: "sell",
        strength: Math.min((price - upper) / (upper - middle), 1),
        strategy: this.name,
        timestamp: candle.timestamp,
      };
    }

    return null;
  }

  updateParameters(params: Record<string, number>): void {
    if (params.period) this.period = params.period;
    if (params.stdMultiplier) this.stdMultiplier = params.stdMultiplier;
    if (params.rsiPeriod) this.rsiPeriod = params.rsiPeriod;
  }

  private bollingerBands(): {
    upper: number;
    lower: number;
    middle: number;
  } {
    const slice = this.closes.slice(-this.period);
    const middle = slice.reduce((s, v) => s + v, 0) / this.period;
    const variance =
      slice.reduce((s, v) => s + (v - middle) ** 2, 0) / this.period;
    const std = Math.sqrt(variance);

    return {
      upper: middle + this.stdMultiplier * std,
      lower: middle - this.stdMultiplier * std,
      middle,
    };
  }
}
