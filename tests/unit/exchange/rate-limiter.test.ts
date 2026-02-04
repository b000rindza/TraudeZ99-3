import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter, CircuitBreaker } from '../../../src/exchange/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit', async () => {
    const limiter = new RateLimiter({
      maxRequests: 3,
      windowMs: 1000,
    });

    const results = await Promise.all([
      limiter.execute(async () => 1),
      limiter.execute(async () => 2),
      limiter.execute(async () => 3),
    ]);

    expect(results).toEqual([1, 2, 3]);
  });

  it('rejects requests over the limit when queueRequests is false', async () => {
    const limiter = new RateLimiter({
      maxRequests: 2,
      windowMs: 1000,
      queueRequests: false,
    });

    await limiter.execute(async () => 1);
    await limiter.execute(async () => 2);

    await expect(limiter.execute(async () => 3)).rejects.toThrow('Rate limit exceeded');
  });

  it('queues requests when queueRequests is true', async () => {
    const limiter = new RateLimiter({
      maxRequests: 1,
      windowMs: 100,
      queueRequests: true,
    });

    const promise1 = limiter.execute(async () => 1);
    const promise2 = limiter.execute(async () => 2);

    // First request should complete immediately
    expect(await promise1).toBe(1);

    // Advance time to allow second request
    vi.advanceTimersByTime(110);
    expect(await promise2).toBe(2);
  });

  it('reports correct status', async () => {
    const limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000,
      queueRequests: true,
    });

    await limiter.execute(async () => 1);
    await limiter.execute(async () => 2);

    const status = limiter.getStatus();
    expect(status.requestsInWindow).toBe(2);
    expect(status.available).toBe(3);
    expect(status.queueSize).toBe(0);
  });
});

describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
    });

    expect(breaker.getState()).toBe('closed');
  });

  it('opens after failure threshold is reached', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    });

    const failingFn = async () => {
      throw new Error('fail');
    };

    await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('closed');

    await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('open');
  });

  it('rejects requests when open', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
    });

    await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(breaker.getState()).toBe('open');

    await expect(breaker.execute(async () => 'ok')).rejects.toThrow('Circuit breaker is open');
  });

  it('resets to closed after success in half-open state', async () => {
    vi.useFakeTimers();

    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 100,
      successThreshold: 1,
    });

    // Trigger open state
    await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(breaker.getState()).toBe('open');

    // Wait for reset timeout
    vi.advanceTimersByTime(110);

    // Should enter half-open and then close on success
    const result = await breaker.execute(async () => 'success');
    expect(result).toBe('success');
    expect(breaker.getState()).toBe('closed');

    vi.useRealTimers();
  });

  it('can be manually reset', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 100000, // Very long timeout
    });

    await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(breaker.getState()).toBe('open');

    breaker.reset();
    expect(breaker.getState()).toBe('closed');

    // Should work again
    const result = await breaker.execute(async () => 'ok');
    expect(result).toBe('ok');
  });
});
