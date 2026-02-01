import { EventEmitter } from 'node:events';
import type { Candle, Trade, OrderBook } from '../data/types.js';
import type { Signal } from '../strategy/interface.js';

/** Typed events emitted by the bot. */
export interface BotEvents {
  candle: Candle;
  trade: Trade;
  orderBook: OrderBook;
  signal: Signal;
  error: Error;
}

/**
 * Central event bus for inter-module communication.
 * Wraps Node.js EventEmitter with typed events.
 */
export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<K extends keyof BotEvents>(event: K, data: BotEvents[K]): void {
    this.emitter.emit(event, data);
  }

  on<K extends keyof BotEvents>(event: K, handler: (data: BotEvents[K]) => void): void {
    this.emitter.on(event, handler);
  }

  off<K extends keyof BotEvents>(event: K, handler: (data: BotEvents[K]) => void): void {
    this.emitter.off(event, handler);
  }

  once<K extends keyof BotEvents>(event: K, handler: (data: BotEvents[K]) => void): void {
    this.emitter.once(event, handler);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
