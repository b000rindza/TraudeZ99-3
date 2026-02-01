/**
 * Exchange Client Interface
 *
 * Abstract interface for exchange connectivity.
 * Implementations will wrap specific exchange APIs (via ccxt or custom clients).
 *
 * Roadmap phase: 1
 */

import { Order, Position, Candle } from "../core/types";

export interface ExchangeCredentials {
  apiKey: string;
  secret: string;
  passphrase?: string;
}

export interface ExchangeClient {
  /** Connect to the exchange */
  connect(): Promise<void>;

  /** Disconnect from the exchange */
  disconnect(): Promise<void>;

  /** Get current account balance */
  getBalance(): Promise<{ total: number; available: number; margin: number }>;

  /** Place an order */
  placeOrder(order: Omit<Order, "id" | "timestamp">): Promise<Order>;

  /** Cancel an order */
  cancelOrder(orderId: string, symbol: string): Promise<void>;

  /** Get open positions */
  getPositions(): Promise<Position[]>;

  /** Fetch historical candles */
  getCandles(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<Candle[]>;

  /** Subscribe to real-time price updates */
  onPrice(
    symbol: string,
    callback: (price: number, timestamp: number) => void
  ): void;

  /** Subscribe to real-time candle updates */
  onCandle(
    symbol: string,
    timeframe: string,
    callback: (candle: Candle) => void
  ): void;
}
