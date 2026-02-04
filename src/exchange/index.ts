// Exchange adapters
export { BaseExchangeClient } from './base.js';
export { BinanceClient } from './binance.js';
export { KrakenClient } from './kraken.js';

// Types
export type {
  IExchangeClient,
  ExchangeCredentials,
  Balance,
  AssetBalance,
  MarketInfo,
  FetchOHLCVOptions,
  SubscribeCandlesOptions,
  ConnectionStatus,
  ConnectionStatusHandler,
  CandleHandler,
  TradeHandler,
} from './types.js';

// Rate limiting
export {
  RateLimiter,
  CircuitBreaker,
  ProtectedClient,
  EXCHANGE_RATE_LIMITS,
} from './rate-limiter.js';
export type { RateLimiterConfig, CircuitBreakerConfig } from './rate-limiter.js';

// Factory function for creating exchange clients
import type { ExchangeId } from '../utils/types.js';
import type { ExchangeCredentials, IExchangeClient } from './types.js';
import { BinanceClient } from './binance.js';
import { KrakenClient } from './kraken.js';

export function createExchangeClient(
  exchangeId: ExchangeId,
  credentials?: ExchangeCredentials,
): IExchangeClient {
  switch (exchangeId) {
    case 'binance':
      return new BinanceClient(credentials);
    case 'kraken':
      return new KrakenClient(credentials);
    case 'coinbase':
      throw new Error('Coinbase adapter not yet implemented');
    default:
      throw new Error(`Unknown exchange: ${exchangeId}`);
  }
}
