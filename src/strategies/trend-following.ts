/**
 * Trend Following Strategy
 *
 * Uses moving average crossovers and MACD to identify sustained trends.
 * Enters leveraged positions in the direction of the trend.
 *
 * Roadmap phase: 3-4
 */

import { Candle, Signal } from "../core/types";
import { Strategy } from "./base";

export class TrendFollowingStrategy implements Strategy {
  readonly name = "TrendFollowing";

  private shortPeriod: number;
  private longPeriod: number;
  private closes: number[] = [];

  constructor(shortPeriod = 20, longPeriod = 50) {
    this.shortPeriod = shortPeriod;
    this.longPeriod = longPeriod;
  }

  initialize(candles: Candle[]): void {
    this.closes = candles.map((c) => c.close);
  }

  onCandle(candle: Candle): Signal | null {
    this.closes.push(candle.close);

    if (this.closes.length < this.longPeriod) {
      return null;
    }

    const shortMA = this.sma(this.closes, this.shortPeriod);
    const longMA = this.sma(this.closes, this.longPeriod);

    // TODO: Add MACD confirmation
    // TODO: Add ADX filter for trend strength

    if (shortMA > longMA) {
      return {
        symbol: candle.symbol ?? "",
        side: "buy",
        strength: Math.min((shortMA - longMA) / longMA, 1),
        strategy: this.name,
        timestamp: candle.timestamp,
      };
    } else if (shortMA < longMA) {
      return {
        symbol: candle.symbol ?? "",
        side: "sell",
        strength: Math.min((longMA - shortMA) / longMA, 1),
        strategy: this.name,
        timestamp: candle.timestamp,
      };
    }

    return null;
  }

  updateParameters(params: Record<string, number>): void {
    if (params.shortPeriod) this.shortPeriod = params.shortPeriod;
    if (params.longPeriod) this.longPeriod = params.longPeriod;
  }

  private sma(data: number[], period: number): number {
    const slice = data.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  }
}
