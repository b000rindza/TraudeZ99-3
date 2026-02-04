import ccxt from 'ccxt';
import type { Timeframe } from '../utils/types.js';
import { BaseExchangeClient } from './base.js';
import type { ExchangeCredentials, SubscribeCandlesOptions } from './types.js';

// Kraken WebSocket message types
interface KrakenOHLCMessage {
  channelID: number;
  data: [
    string, // time
    string, // etime (end time)
    string, // open
    string, // high
    string, // low
    string, // close
    string, // vwap
    string, // volume
    number, // count
  ];
  channelName: string;
  pair: string;
}

interface KrakenTradeMessage {
  channelID: number;
  data: [
    string, // price
    string, // volume
    string, // time
    string, // side (b/s)
    string, // orderType
    string, // misc
  ][];
  channelName: string;
  pair: string;
}

// Timeframe mapping for Kraken
const TIMEFRAME_KRAKEN_MAP: Record<Timeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

/**
 * Kraken exchange client implementation.
 */
export class KrakenClient extends BaseExchangeClient {
  readonly id = 'kraken' as const;
  readonly name = 'Kraken';

  private wsUrl = 'wss://ws.kraken.com';
  private ws: unknown = null;
  private subscriptions: Map<string, { channelId: number; handler: (data: unknown) => void }> =
    new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(credentials?: ExchangeCredentials) {
    super(ccxt.kraken, credentials);
  }

  // ─── WebSocket Streaming ──────────────────────────────────────────────

  protected async startCandleStream(options: SubscribeCandlesOptions): Promise<void> {
    const { symbol, timeframe } = options;
    const key = `candle:${symbol}:${timeframe}`;

    if (this.subscriptions.has(key)) {
      this.log.debug({ symbol, timeframe }, 'Candle stream already active');
      return;
    }

    await this.ensureWebSocketConnected();

    const krakenPair = this.toKrakenPair(symbol);
    const interval = TIMEFRAME_KRAKEN_MAP[timeframe];

    const subscribeMsg = {
      event: 'subscribe',
      pair: [krakenPair],
      subscription: {
        name: 'ohlc',
        interval,
      },
    };

    this.sendWebSocketMessage(subscribeMsg);

    this.subscriptions.set(key, {
      channelId: 0, // Will be set when we receive subscription confirmation
      handler: (data: unknown) => {
        const msg = data as KrakenOHLCMessage;
        const handler = this.candleHandlers.get(`${symbol}:${timeframe}`);
        if (handler && Array.isArray(msg.data)) {
          const [time, , open, high, low, close, , volume] = msg.data;
          handler({
            exchange: this.id,
            symbol,
            timeframe,
            timestamp: parseFloat(time) * 1000,
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close),
            volume: parseFloat(volume),
          });
        }
      },
    });
  }

  protected async stopCandleStream(symbol: string, timeframe: Timeframe): Promise<void> {
    const key = `candle:${symbol}:${timeframe}`;
    const sub = this.subscriptions.get(key);

    if (sub && this.ws) {
      const krakenPair = this.toKrakenPair(symbol);
      const interval = TIMEFRAME_KRAKEN_MAP[timeframe];

      const unsubscribeMsg = {
        event: 'unsubscribe',
        pair: [krakenPair],
        subscription: {
          name: 'ohlc',
          interval,
        },
      };

      this.sendWebSocketMessage(unsubscribeMsg);
    }

    this.subscriptions.delete(key);
  }

  protected async startTradeStream(symbol: string): Promise<void> {
    const key = `trade:${symbol}`;

    if (this.subscriptions.has(key)) {
      this.log.debug({ symbol }, 'Trade stream already active');
      return;
    }

    await this.ensureWebSocketConnected();

    const krakenPair = this.toKrakenPair(symbol);

    const subscribeMsg = {
      event: 'subscribe',
      pair: [krakenPair],
      subscription: { name: 'trade' },
    };

    this.sendWebSocketMessage(subscribeMsg);

    this.subscriptions.set(key, {
      channelId: 0,
      handler: (data: unknown) => {
        const msg = data as KrakenTradeMessage;
        const handler = this.tradeHandlers.get(symbol);
        if (handler && Array.isArray(msg.data)) {
          for (const trade of msg.data) {
            const [price, volume, time, side] = trade;
            handler({
              exchange: this.id,
              symbol,
              timestamp: parseFloat(time) * 1000,
              price: parseFloat(price),
              amount: parseFloat(volume),
              side: side === 'b' ? 'buy' : 'sell',
            });
          }
        }
      },
    });
  }

  protected async stopTradeStream(symbol: string): Promise<void> {
    const key = `trade:${symbol}`;
    const sub = this.subscriptions.get(key);

    if (sub && this.ws) {
      const krakenPair = this.toKrakenPair(symbol);

      const unsubscribeMsg = {
        event: 'unsubscribe',
        pair: [krakenPair],
        subscription: { name: 'trade' },
      };

      this.sendWebSocketMessage(unsubscribeMsg);
    }

    this.subscriptions.delete(key);
  }

  protected async closeAllStreams(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      (this.ws as { close: () => void }).close();
      this.ws = null;
    }

    this.subscriptions.clear();
  }

  // ─── WebSocket Management ─────────────────────────────────────────────

  private async ensureWebSocketConnected(): Promise<void> {
    if (this.ws) return;

    return new Promise((resolve, reject) => {
      try {
        const WebSocket = require('ws');
        const ws = new WebSocket(this.wsUrl);

        ws.on('open', () => {
          this.log.info('Kraken WebSocket connected');
          this.ws = ws;
          this.reconnectAttempts = 0;
          this.setConnectionStatus('connected');
          this.startPingInterval();
          resolve();
        });

        ws.on('message', (data: Buffer) => {
          this.handleWebSocketMessage(data);
        });

        ws.on('close', () => {
          this.log.info('Kraken WebSocket closed');
          this.ws = null;
          this.handleReconnect();
        });

        ws.on('error', (error: Error) => {
          this.log.error({ error }, 'Kraken WebSocket error');
          if (!this.ws) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleWebSocketMessage(data: Buffer): void {
    try {
      const msg = JSON.parse(data.toString());

      // Handle system events
      if (msg.event) {
        if (msg.event === 'systemStatus') {
          this.log.debug({ status: msg.status }, 'Kraken system status');
        } else if (msg.event === 'subscriptionStatus') {
          this.log.debug(
            { pair: msg.pair, status: msg.status },
            'Subscription status',
          );
        } else if (msg.event === 'pong') {
          // Heartbeat response
        }
        return;
      }

      // Handle data messages (array format)
      if (Array.isArray(msg) && msg.length >= 4) {
        const channelName = msg[msg.length - 2];
        const pair = msg[msg.length - 1];

        // Find matching subscription
        for (const [key, sub] of this.subscriptions) {
          if (key.includes(this.fromKrakenPair(pair))) {
            if (
              (key.startsWith('candle:') && channelName.startsWith('ohlc')) ||
              (key.startsWith('trade:') && channelName === 'trade')
            ) {
              sub.handler({
                channelID: msg[0],
                data: msg[1],
                channelName,
                pair,
              });
              break;
            }
          }
        }
      }
    } catch (err) {
      this.log.warn({ error: err }, 'Failed to parse Kraken WebSocket message');
    }
  }

  private sendWebSocketMessage(msg: unknown): void {
    if (this.ws) {
      (this.ws as { send: (data: string) => void }).send(JSON.stringify(msg));
    }
  }

  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.ws) {
        this.sendWebSocketMessage({ event: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  private handleReconnect(): void {
    if (this.subscriptions.size === 0) {
      this.log.debug('Not reconnecting - no active subscriptions');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log.error('Max reconnect attempts reached');
      this.setConnectionStatus('disconnected');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.log.info({ attempt: this.reconnectAttempts, delay }, 'Scheduling reconnect');
    this.setConnectionStatus('reconnecting');

    setTimeout(async () => {
      try {
        await this.ensureWebSocketConnected();
        // Re-subscribe to all active subscriptions
        for (const [key] of this.subscriptions) {
          if (key.startsWith('candle:')) {
            const [, symbol, timeframe] = key.split(':');
            await this.startCandleStream({
              symbol,
              timeframe: timeframe as Timeframe,
            });
          } else if (key.startsWith('trade:')) {
            const symbol = key.replace('trade:', '');
            await this.startTradeStream(symbol);
          }
        }
      } catch (error) {
        this.log.error({ error }, 'Reconnect failed');
      }
    }, delay);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private toKrakenPair(symbol: string): string {
    // Convert BTC/USD to XBT/USD for Kraken
    return symbol.replace('BTC', 'XBT').replace('/', '');
  }

  private fromKrakenPair(pair: string): string {
    // Convert XBT/USD back to BTC/USD
    return pair.replace('XBT', 'BTC');
  }
}
