import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('rate-limiter');

export interface RateLimiterConfig {
  /** Maximum requests per window. */
  maxRequests: number;
  /** Time window in milliseconds. */
  windowMs: number;
  /** Whether to queue requests when rate limited (vs. rejecting). */
  queueRequests?: boolean;
  /** Maximum queue size (if queueRequests is true). */
  maxQueueSize?: number;
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit. */
  failureThreshold: number;
  /** Time in ms to wait before attempting to close the circuit. */
  resetTimeoutMs: number;
  /** Number of successful requests needed to close the circuit. */
  successThreshold?: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

/**
 * Rate limiter with sliding window algorithm.
 * Prevents exceeding API rate limits.
 */
export class RateLimiter {
  private requests: number[] = [];
  private queue: QueuedRequest<unknown>[] = [];
  private processing = false;

  constructor(private readonly config: RateLimiterConfig) {}

  /**
   * Execute a function with rate limiting.
   * If rate limit is exceeded, either queues or rejects based on config.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Clean up old requests outside the window
    const now = Date.now();
    this.requests = this.requests.filter(
      (time) => now - time < this.config.windowMs,
    );

    // Check if we're under the limit
    if (this.requests.length < this.config.maxRequests) {
      this.requests.push(now);
      return fn();
    }

    // Rate limited
    if (this.config.queueRequests) {
      if (
        this.config.maxQueueSize &&
        this.queue.length >= this.config.maxQueueSize
      ) {
        throw new Error('Rate limit queue full');
      }

      return new Promise<T>((resolve, reject) => {
        this.queue.push({
          execute: fn as () => Promise<unknown>,
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        this.processQueue();
      });
    }

    throw new Error('Rate limit exceeded');
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      this.requests = this.requests.filter(
        (time) => now - time < this.config.windowMs,
      );

      if (this.requests.length >= this.config.maxRequests) {
        // Wait until we have capacity
        const oldestRequest = this.requests[0];
        const waitTime = this.config.windowMs - (now - oldestRequest) + 10;
        await sleep(waitTime);
        continue;
      }

      const request = this.queue.shift();
      if (request) {
        this.requests.push(Date.now());
        try {
          const result = await request.execute();
          request.resolve(result);
        } catch (error) {
          request.reject(error);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Get current rate limit status.
   */
  getStatus(): { requestsInWindow: number; queueSize: number; available: number } {
    const now = Date.now();
    const requestsInWindow = this.requests.filter(
      (time) => now - time < this.config.windowMs,
    ).length;

    return {
      requestsInWindow,
      queueSize: this.queue.length,
      available: Math.max(0, this.config.maxRequests - requestsInWindow),
    };
  }
}

/**
 * Circuit breaker for handling service failures.
 * Opens circuit after failures, preventing cascading failures.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailure: number | null = null;
  private readonly successThreshold: number;

  constructor(private readonly config: CircuitBreakerConfig) {
    this.successThreshold = config.successThreshold ?? 1;
  }

  /**
   * Execute a function with circuit breaker protection.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        log.info('Circuit breaker entering half-open state');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = 'closed';
        this.successes = 0;
        log.info('Circuit breaker closed');
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    this.successes = 0;

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      log.warn(
        { failures: this.failures },
        'Circuit breaker opened due to failures',
      );
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailure) return true;
    return Date.now() - this.lastFailure >= this.config.resetTimeoutMs;
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset the circuit breaker.
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
    log.info('Circuit breaker manually reset');
  }
}

/**
 * Combined rate limiter and circuit breaker.
 */
export class ProtectedClient {
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;

  constructor(
    rateLimiterConfig: RateLimiterConfig,
    circuitBreakerConfig: CircuitBreakerConfig,
  ) {
    this.rateLimiter = new RateLimiter(rateLimiterConfig);
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig);
  }

  /**
   * Execute a function with both rate limiting and circuit breaker protection.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.rateLimiter.execute(() => this.circuitBreaker.execute(fn));
  }

  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }

  getCircuitState() {
    return this.circuitBreaker.getState();
  }

  resetCircuit() {
    this.circuitBreaker.reset();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Default configurations for common exchanges
export const EXCHANGE_RATE_LIMITS: Record<string, RateLimiterConfig> = {
  binance: {
    maxRequests: 1200,
    windowMs: 60 * 1000,
    queueRequests: true,
    maxQueueSize: 100,
  },
  kraken: {
    maxRequests: 15,
    windowMs: 3 * 1000,
    queueRequests: true,
    maxQueueSize: 50,
  },
  coinbase: {
    maxRequests: 10,
    windowMs: 1000,
    queueRequests: true,
    maxQueueSize: 50,
  },
};
