/**
 * Risk Manager
 *
 * Enforces position sizing, leverage limits, drawdown protection,
 * and stop-loss management across all strategies.
 *
 * Roadmap phase: 2
 */

import { RiskParameters, Order, Position } from "../core/types";

export class RiskManager {
  private params: RiskParameters;
  private equity: number;
  private peakEquity: number;
  private dailyPnl: number;

  constructor(params: RiskParameters, initialEquity: number) {
    this.params = params;
    this.equity = initialEquity;
    this.peakEquity = initialEquity;
    this.dailyPnl = 0;
  }

  /** Calculate the maximum position size for a given trade */
  calculatePositionSize(
    entryPrice: number,
    stopLossPrice: number
  ): number {
    const riskAmount = this.equity * this.params.maxRiskPerTrade;
    const riskPerUnit = Math.abs(entryPrice - stopLossPrice);

    if (riskPerUnit === 0) return 0;

    return riskAmount / riskPerUnit;
  }

  /** Check if a new order passes all risk checks */
  validateOrder(order: Order, openPositions: Position[]): {
    allowed: boolean;
    reason?: string;
  } {
    // Check daily loss limit
    if (this.dailyPnl <= -this.params.dailyLossLimit * this.equity) {
      return { allowed: false, reason: "Daily loss limit reached" };
    }

    // Check max drawdown
    const currentDrawdown =
      (this.peakEquity - this.equity) / this.peakEquity;
    if (currentDrawdown >= this.params.maxDrawdown) {
      return { allowed: false, reason: "Max drawdown limit reached" };
    }

    // Check leverage limits
    const totalExposure = openPositions.reduce(
      (sum, p) => sum + p.quantity * p.entryPrice,
      0
    );
    const newExposure = totalExposure + order.quantity * (order.price ?? 0);
    const effectiveLeverage = newExposure / this.equity;

    if (effectiveLeverage > this.params.maxLeverage) {
      return { allowed: false, reason: "Max leverage exceeded" };
    }

    return { allowed: true };
  }

  /** Update equity after a trade closes */
  updateEquity(pnl: number): void {
    this.equity += pnl;
    this.dailyPnl += pnl;

    if (this.equity > this.peakEquity) {
      this.peakEquity = this.equity;
    }
  }

  /** Reset daily P&L counter (call at start of each trading day) */
  resetDailyPnl(): void {
    this.dailyPnl = 0;
  }

  getEquity(): number {
    return this.equity;
  }

  getCurrentDrawdown(): number {
    return (this.peakEquity - this.equity) / this.peakEquity;
  }
}
