import { env } from './config/index.js';
import { createChildLogger } from './utils/logger.js';
import { initDatabase, closeDatabase } from './persistence/index.js';
import { createExchangeClient, type IExchangeClient } from './exchange/index.js';
import { FeedManager } from './data/index.js';
import { EventBus } from './engine/index.js';
import type { Timeframe } from './utils/types.js';

const log = createChildLogger('main');

let client: IExchangeClient | null = null;
let feedManager: FeedManager | null = null;

async function main() {
  log.info(
    {
      mode: env.TRADING_MODE,
      exchange: env.DEFAULT_EXCHANGE,
      pairs: env.TRADING_PAIRS,
      timeframe: env.DEFAULT_TIMEFRAME,
      strategy: env.DEFAULT_STRATEGY,
    },
    'TraudeZ99-3 starting',
  );

  // Initialize database
  await initDatabase('./data/tradez99.db');
  log.info('Database initialized');

  // Create exchange client
  const credentials =
    env.BINANCE_API_KEY && env.BINANCE_API_SECRET
      ? { apiKey: env.BINANCE_API_KEY, apiSecret: env.BINANCE_API_SECRET }
      : undefined;

  client = createExchangeClient(env.DEFAULT_EXCHANGE, credentials);
  log.info({ exchange: client.name, authenticated: client.isAuthenticated }, 'Exchange client created');

  // Create event bus and feed manager
  const eventBus = new EventBus();
  feedManager = new FeedManager(client, eventBus);

  // Subscribe to candle events
  eventBus.on('candle', (candle) => {
    log.info(
      {
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        close: candle.close,
        volume: candle.volume,
        time: new Date(candle.timestamp).toISOString(),
      },
      'Candle update',
    );
  });

  // Monitor connection status
  client.onConnectionStatusChange((status) => {
    log.info({ status }, 'Connection status changed');
  });

  // Add feeds for configured trading pairs
  for (const symbol of env.TRADING_PAIRS) {
    await feedManager.addFeed({
      symbol,
      timeframe: env.DEFAULT_TIMEFRAME as Timeframe,
      backfillOnStart: false, // Set to true to backfill historical data
      persistCandles: true,
    });
  }

  // Start streaming market data
  await feedManager.startAll();
  log.info('Market data streaming started');

  // Log feed status periodically
  const statusInterval = setInterval(() => {
    const statuses = feedManager?.getStatus() ?? [];
    for (const status of statuses) {
      log.debug(
        {
          symbol: status.symbol,
          streaming: status.isStreaming,
          candleCount: status.candleCount,
          lastPrice: status.lastCandle?.close,
        },
        'Feed status',
      );
    }
  }, 60000);

  log.info('Bot initialized successfully. Streaming market data...');

  // Graceful shutdown
  const shutdown = async () => {
    log.info('Shutting down...');
    clearInterval(statusInterval);

    if (feedManager) {
      await feedManager.stopAll();
    }

    if (client) {
      await client.close();
    }

    closeDatabase();
    log.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  log.fatal({ error }, 'Unhandled error during startup');
  process.exit(1);
});
