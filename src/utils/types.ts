/**
 * Shared type definitions used across the application.
 */

export type TradingMode = 'paper' | 'live';

export type ExchangeId = 'binance' | 'kraken' | 'coinbase';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type Side = 'buy' | 'sell';

export type OrderType = 'market' | 'limit' | 'stop-loss' | 'take-profit';

export type OrderStatus = 'pending' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'failed';

export type SignalAction = 'BUY' | 'SELL' | 'HOLD';
