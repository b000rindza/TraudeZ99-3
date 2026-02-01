import { z } from 'zod';
import { config } from 'dotenv';

config();

const envSchema = z.object({
  // General
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Exchange API keys (optional — not needed for public data)
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  KRAKEN_API_KEY: z.string().optional(),
  KRAKEN_API_SECRET: z.string().optional(),
  COINBASE_API_KEY: z.string().optional(),
  COINBASE_API_SECRET: z.string().optional(),

  // Database
  DATABASE_URL: z.string().default('file:./dev.db'),

  // Trading
  TRADING_MODE: z.enum(['paper', 'live']).default('paper'),
  DEFAULT_EXCHANGE: z.enum(['binance', 'kraken', 'coinbase']).default('binance'),
  TRADING_PAIRS: z
    .string()
    .default('BTC/USDT')
    .transform((s) => s.split(',')),
  DEFAULT_TIMEFRAME: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),

  // Strategy
  DEFAULT_STRATEGY: z.string().default('sma-cross'),

  // Risk
  MAX_POSITION_SIZE_PCT: z.coerce.number().min(0.1).max(100).default(5),
  DAILY_LOSS_LIMIT_PCT: z.coerce.number().min(0.1).max(100).default(3),
  MAX_OPEN_POSITIONS: z.coerce.number().int().min(1).max(100).default(3),
  COOLDOWN_LOSSES: z.coerce.number().int().min(1).default(3),
  COOLDOWN_DURATION_MIN: z.coerce.number().min(1).default(60),

  // Alerts
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),

  // Server
  HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
