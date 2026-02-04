import ccxt from 'ccxt';
import type { Timeframe } from '../utils/types.js';
import { BaseExchangeClient } from './base.js';
import type { ExchangeCredentials, SubscribeCandlesOptions } from './types.js';

// WebSocket message types
interface BinanceKlineMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    o: string; // Open price
    c: string; // Close price
    h: string; // High price
    l: string; // Low price
    v: string; // Base asset volume
    x: boolean; // Is this kline closed?
  };
}

interface BinanceTradeMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  t: number; // Trade ID
  p: string; // Price
  q: string; // Quantity
  T: number; // Trade time
  m: boolean; // Is the buyer the market maker?
}

// Timeframe mapping for Binance WebSocket
const TIMEFRAME_WS_MAP: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

/**
 * Binance exchange client implementation.
 */
export class BinanceClient extends BaseExchangeClient {
  readonly id = 'binance' as const;
  readonly name = 'Binance';

  private wsBaseUrl = 'wss://stream.binance.com:9443/ws';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  constructor(credentials?: ExchangeCredentials) {
    super(ccxt.binance, credentials);
  }

  // ─── WebSocket Streaming ──────────────────────────────────────────────

  protected async startCandleStream(options: SubscribeCandlesOptions): Promise<void> {
    const { symbol, timeframe } = options;
    const key = `candle:${symbol}:${timeframe}`;

    if (this.wsConnections.has(key)) {
      this.log.debug({ symbol, timeframe }, 'Candle stream already active');
      return;
    }

    const wsSymbol = symbol.replace('/', '').toLowerCase();
    const wsInterval = TIMEFRAME_WS_MAP[timeframe];
    const streamName = `${wsSymbol}@kline_${wsInterval}`;
    const wsUrl = `${this.wsBaseUrl}/${streamName}`;

    await this.connectWebSocket(key, wsUrl, (data: BinanceKlineMessage) => {
      if (data.e === 'kline') {
        const k = data.k;
        const handler = this.candleHandlers.get(`${symbol}:${timeframe}`);
        if (handler) {
          handler({
            exchange: this.id,
            symbol,
            timeframe,
            timestamp: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          });
        }
      }
    });
  }

  protected async stopCandleStream(symbol: string, timeframe: Timeframe): Promise<void> {
    const key = `candle:${symbol}:${timeframe}`;
    await this.closeWebSocket(key);
  }

  protected async startTradeStream(symbol: string): Promise<void> {
    const key = `trade:${symbol}`;

    if (this.wsConnections.has(key)) {
      this.log.debug({ symbol }, 'Trade stream already active');
      return;
    }

    const wsSymbol = symbol.replace('/', '').toLowerCase();
    const streamName = `${wsSymbol}@trade`;
    const wsUrl = `${this.wsBaseUrl}/${streamName}`;

    await this.connectWebSocket(key, wsUrl, (data: BinanceTradeMessage) => {
      if (data.e === 'trade') {
        const handler = this.tradeHandlers.get(symbol);
        if (handler) {
          handler({
            exchange: this.id,
            symbol,
            timestamp: data.T,
            price: parseFloat(data.p),
            amount: parseFloat(data.q),
            side: data.m ? 'sell' : 'buy', // If buyer is maker, it's a sell
          });
        }
      }
    });
  }

  protected async stopTradeStream(symbol: string): Promise<void> {
    const key = `trade:${symbol}`;
    await this.closeWebSocket(key);
  }

  protected async closeAllStreams(): Promise<void> {
    const keys = Array.from(this.wsConnections.keys());
    for (const key of keys) {
      await this.closeWebSocket(key);
    }
  }

  // ─── WebSocket Management ─────────────────────────────────────────────

  private async connectWebSocket<T>(
    key: string,
    url: string,
    messageHandler: (data: T) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Dynamic import for WebSocket (works in Node.js)
        const WebSocket = require('ws');
        const ws = new WebSocket(url);

        ws.on('open', () => {
          this.log.info({ key, url }, 'WebSocket connected');
          this.reconnectAttempts = 0;
          this.setConnectionStatus('connected');
          resolve();
        });

        ws.on('message', (data: Buffer) => {
          try {
            const parsed = JSON.parse(data.toString()) as T;
            messageHandler(parsed);
          } catch (err) {
            this.log.warn({ key, error: err }, 'Failed to parse WebSocket message');
          }
        });

        ws.on('close', () => {
          this.log.info({ key }, 'WebSocket closed');
          this.wsConnections.delete(key);
          this.handleReconnect(key, url, messageHandler);
        });

        ws.on('error', (error: Error) => {
          this.log.error({ key, error }, 'WebSocket error');
          if (!this.wsConnections.has(key)) {
            reject(error);
          }
        });

        this.wsConnections.set(key, ws);
      } catch (error) {
        this.log.error({ key, error }, 'Failed to create WebSocket');
        reject(error);
      }
    });
  }

  private async closeWebSocket(key: string): Promise<void> {
    const ws = this.wsConnections.get(key);
    if (ws) {
      (ws as { close: () => void }).close();
      this.wsConnections.delete(key);
      this.log.debug({ key }, 'WebSocket closed');
    }
  }

  private handleReconnect<T>(
    key: string,
    url: string,
    messageHandler: (data: T) => void,
  ): void {
    // Only reconnect if we still have a handler for this stream
    const isCandle = key.startsWith('candle:');
    const isTrade = key.startsWith('trade:');

    let shouldReconnect = false;
    if (isCandle) {
      const parts = key.replace('candle:', '').split(':');
      shouldReconnect = this.candleHandlers.has(`${parts[0]}:${parts[1]}`);
    } else if (isTrade) {
      const symbol = key.replace('trade:', '');
      shouldReconnect = this.tradeHandlers.has(symbol);
    }

    if (!shouldReconnect) {
      this.log.debug({ key }, 'Not reconnecting - no handler registered');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log.error({ key }, 'Max reconnect attempts reached');
      this.setConnectionStatus('disconnected');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.log.info(
      { key, attempt: this.reconnectAttempts, delay },
      'Scheduling reconnect',
    );

    this.setConnectionStatus('reconnecting');

    setTimeout(() => {
      this.connectWebSocket(key, url, messageHandler).catch((error) => {
        this.log.error({ key, error }, 'Reconnect failed');
      });
    }, delay);
  }
}
