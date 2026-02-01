/**
 * Shared type definitions for the trading bot.
 */

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type PositionSide = "long" | "short";

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timestamp: number;
}

export interface Position {
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  quantity: number;
  leverage: number;
  unrealizedPnl: number;
  timestamp: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  symbol: string;
  side: OrderSide;
  strength: number; // 0 to 1
  strategy: string;
  timestamp: number;
}

export interface RiskParameters {
  maxLeverage: number;
  maxRiskPerTrade: number;
  maxDrawdown: number;
  dailyLossLimit: number;
  trailingStopPct?: number;
}
