import type { Signal } from '../strategy/interface.js';

export interface RiskCheckResult {
  approved: boolean;
  rule: string;
  reason: string;
}

export interface RiskRule {
  readonly name: string;
  check(signal: Signal, context: RiskContext): RiskCheckResult;
}

export interface RiskContext {
  portfolioValue: number;
  dailyPnl: number;
  openPositionCount: number;
  consecutiveLosses: number;
  killSwitchActive: boolean;
}
