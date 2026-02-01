import { env } from './config/index.js';
import { createChildLogger } from './utils/logger.js';

const log = createChildLogger('main');

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

  log.info('Bot initialized successfully. Waiting for market data...');

  // Graceful shutdown
  const shutdown = () => {
    log.info('Shutting down...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  log.fatal({ error }, 'Unhandled error during startup');
  process.exit(1);
});
