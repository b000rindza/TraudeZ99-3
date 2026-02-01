import type { ExchangeId, OrderStatus, OrderType, Side } from '../utils/types.js';

export interface NewOrder {
  exchange: ExchangeId;
  symbol: string;
  side: Side;
  type: OrderType;
  amount: number;
  price?: number; // Required for limit orders
  stopPrice?: number; // Required for stop-loss / take-profit
}

export interface Order extends NewOrder {
  id: string;
  status: OrderStatus;
  filledAmount: number;
  averagePrice: number;
  createdAt: number;
  updatedAt: number;
}

export interface Position {
  exchange: ExchangeId;
  symbol: string;
  side: Side;
  amount: number;
  averageEntry: number;
  unrealizedPnl: number;
  openedAt: number;
}

export interface Fill {
  orderId: string;
  price: number;
  amount: number;
  fee: number;
  feeCurrency: string;
  timestamp: number;
}
