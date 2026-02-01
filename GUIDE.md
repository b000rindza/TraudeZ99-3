# TraudeZ99-3 — Comprehensive Development Guide

> Everything you need to understand, develop, and extend the TraudeZ99-3 trading bot.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Configuration](#configuration)
5. [Exchange Integration](#exchange-integration)
6. [Market Data Pipeline](#market-data-pipeline)
7. [Strategy Development](#strategy-development)
8. [Backtesting](#backtesting)
9. [Order Management](#order-management)
10. [Risk Management](#risk-management)
11. [Persistence Layer](#persistence-layer)
12. [Monitoring & Alerting](#monitoring--alerting)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [Security](#security)
16. [Troubleshooting](#troubleshooting)
17. [Glossary](#glossary)

---

## Architecture Overview

TraudeZ99-3 follows a **modular, event-driven architecture**. Each subsystem is a self-contained module that communicates through a central event bus.

```
┌─────────────────────────────────────────────────────┐
│                    Event Bus                        │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────┤
│      │      │      │      │      │      │          │
│ Data │ Strat│Engine│ Risk │ OMS  │ Mon  │Persistence│
│ Feed │ egy  │      │ Mgmt │      │ itor │          │
│      │      │      │      │      │      │          │
└──┬───┴──────┴──┬───┴──┬───┴──┬───┴──────┴──────────┘
   │             │      │      │
   ▼             ▼      ▼      ▼
Exchange APIs  Indicators  Orders  Database
```

### Data Flow

1. **Market data** arrives from exchange WebSocket/REST APIs
2. **Data module** normalizes it into canonical format and emits events
3. **Strategy engine** consumes data events, runs indicators, emits signals
4. **Risk manager** validates signals against rules
5. **Order management** executes approved signals on the exchange
6. **Persistence** logs every event, order, and fill
7. **Monitoring** tracks metrics and sends alerts

---

## Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20+ | Async-first, large ecosystem |
| Language | TypeScript 5.x | Type safety, better tooling |
| Exchange connectivity | ccxt | Unified API for 100+ exchanges |
| Database (dev) | SQLite | Zero-config local development |
| Database (prod) | PostgreSQL | Reliability, concurrency |
| ORM | Prisma | Type-safe queries, migrations |
| Testing | Vitest | Fast, native TypeScript |
| Logging | pino | High-performance structured logs |
| Config validation | zod | Runtime type checking for env vars |
| Linting | ESLint + Prettier | Consistent code style |
| CI/CD | GitHub Actions | Automated quality gates |
| Containerization | Docker | Reproducible deployments |
| Metrics | Prometheus client | Industry-standard monitoring |
| Alerts | Telegram Bot API | Instant mobile notifications |

---

## Project Structure

```
TraudeZ99-3/
├── src/
│   ├── config/              # Configuration & environment
│   │   ├── env.ts           # Zod-validated env vars
│   │   ├── exchanges.ts     # Exchange-specific settings
│   │   └── index.ts         # Config barrel export
│   │
│   ├── exchange/            # Exchange client adapters
│   │   ├── base.ts          # Abstract exchange client
│   │   ├── binance.ts       # Binance-specific adapter
│   │   ├── kraken.ts        # Kraken-specific adapter
│   │   └── index.ts
│   │
│   ├── data/                # Market data ingestion
│   │   ├── feed.ts          # WebSocket price feed manager
│   │   ├── historical.ts    # Historical data loader
│   │   ├── normalizer.ts    # Raw → canonical format
│   │   └── types.ts         # Candle, Trade, OrderBook types
│   │
│   ├── strategy/            # Trading strategies
│   │   ├── interface.ts     # IStrategy contract
│   │   ├── registry.ts      # Strategy registration & lookup
│   │   ├── indicators/      # Technical indicators
│   │   │   ├── sma.ts
│   │   │   ├── ema.ts
│   │   │   ├── rsi.ts
│   │   │   └── index.ts
│   │   └── builtin/         # Example strategies
│   │       ├── sma-cross.ts
│   │       └── rsi-revert.ts
│   │
│   ├── engine/              # Core orchestration
│   │   ├── bot.ts           # Main bot lifecycle
│   │   ├── scheduler.ts     # Cron / interval scheduling
│   │   └── event-bus.ts     # Typed event emitter
│   │
│   ├── risk/                # Risk management
│   │   ├── manager.ts       # Risk rule evaluation
│   │   ├── rules/           # Individual risk rules
│   │   │   ├── max-position.ts
│   │   │   ├── daily-loss.ts
│   │   │   └── kill-switch.ts
│   │   └── types.ts
│   │
│   ├── orders/              # Order management system
│   │   ├── executor.ts      # Send orders to exchange
│   │   ├── tracker.ts       # Position & order state
│   │   ├── paper.ts         # Paper trading simulator
│   │   └── types.ts         # Order, Fill, Position types
│   │
│   ├── persistence/         # Database layer
│   │   ├── prisma/          # Prisma schema & migrations
│   │   │   └── schema.prisma
│   │   ├── repositories/    # Data access objects
│   │   │   ├── trades.ts
│   │   │   ├── candles.ts
│   │   │   └── snapshots.ts
│   │   └── index.ts
│   │
│   ├── monitoring/          # Observability
│   │   ├── metrics.ts       # Prometheus metrics
│   │   ├── health.ts        # Health check endpoint
│   │   ├── alerts/          # Notification channels
│   │   │   ├── telegram.ts
│   │   │   └── discord.ts
│   │   └── index.ts
│   │
│   ├── utils/               # Shared utilities
│   │   ├── logger.ts        # Pino logger setup
│   │   ├── retry.ts         # Retry with backoff
│   │   ├── math.ts          # Financial math helpers
│   │   └── types.ts         # Global shared types
│   │
│   └── index.ts             # Application entry point
│
├── tests/                   # Test files (mirrors src/)
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── strategies/              # User strategy config files (YAML)
├── scripts/                 # Utility scripts (backfill, migrate)
├── docker/                  # Dockerfiles, compose
├── .github/                 # GitHub Actions workflows
│
├── .env.example             # Environment variable template
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── ROADMAP.md
├── GUIDE.md                 # (this file)
├── QUICKSTART.md
├── README.md
└── LICENSE
```

---

## Configuration

### Environment Variables

All configuration is loaded from environment variables, validated at startup with `zod`.

```bash
# .env.example

# General
NODE_ENV=development
LOG_LEVEL=info

# Exchange API Keys (NEVER commit real keys)
BINANCE_API_KEY=
BINANCE_API_SECRET=
KRAKEN_API_KEY=
KRAKEN_API_SECRET=

# Database
DATABASE_URL=file:./dev.db          # SQLite for dev
# DATABASE_URL=postgresql://...     # PostgreSQL for prod

# Trading
TRADING_MODE=paper                  # paper | live
DEFAULT_EXCHANGE=binance
TRADING_PAIRS=BTC/USDT,ETH/USDT

# Risk
MAX_POSITION_SIZE_PCT=5             # Max 5% of portfolio per position
DAILY_LOSS_LIMIT_PCT=3              # Halt at 3% daily loss
MAX_OPEN_POSITIONS=3

# Alerts
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### Configuration Schema

<!-- TODO: Add zod schema example once implemented -->

Configuration is validated at startup. The bot will refuse to start if required variables are missing or invalid.

---

## Exchange Integration

### Supported Exchanges

| Exchange | REST | WebSocket | Status |
|----------|------|-----------|--------|
| Binance | Planned | Planned | Phase 1 |
| Kraken | Planned | Planned | Phase 1 |
| Coinbase Advanced | Planned | Planned | Phase 1 |

### Exchange Abstraction

All exchanges implement the `IExchangeClient` interface:

```typescript
interface IExchangeClient {
  // Market data
  fetchOHLCV(symbol: string, timeframe: string, since?: number): Promise<Candle[]>;
  fetchOrderBook(symbol: string, limit?: number): Promise<OrderBook>;
  fetchTicker(symbol: string): Promise<Ticker>;

  // Streaming
  subscribeCandles(symbol: string, timeframe: string): AsyncIterable<Candle>;
  subscribeTrades(symbol: string): AsyncIterable<Trade>;

  // Trading
  createOrder(order: NewOrder): Promise<Order>;
  cancelOrder(id: string, symbol: string): Promise<void>;
  fetchOpenOrders(symbol?: string): Promise<Order[]>;
  fetchBalance(): Promise<Balance>;
}
```

### ccxt Integration

We use [ccxt](https://github.com/ccxt/ccxt) as the foundation for exchange connectivity. Our adapters wrap ccxt to add:
- Automatic rate-limit handling
- Connection resilience with reconnect logic
- Canonical data normalization
- Typed responses

---

## Market Data Pipeline

### Data Types

```typescript
// Canonical candle format
interface Candle {
  exchange: string;
  symbol: string;
  timeframe: string;
  timestamp: number;     // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Canonical trade format
interface Trade {
  exchange: string;
  symbol: string;
  timestamp: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
}

// Order book snapshot
interface OrderBook {
  exchange: string;
  symbol: string;
  timestamp: number;
  bids: [price: number, amount: number][];
  asks: [price: number, amount: number][];
}
```

### Data Flow

1. **Raw data** arrives via WebSocket or REST polling
2. **Normalizer** converts exchange-specific format to canonical types
3. **Event bus** distributes data to all subscribers
4. **Persistence** optionally stores data for backtesting

---

## Strategy Development

### Strategy Interface

Every strategy implements the `IStrategy` interface:

```typescript
interface IStrategy {
  readonly name: string;
  readonly version: string;
  readonly description: string;

  // Lifecycle
  initialize(config: StrategyConfig): Promise<void>;
  dispose(): Promise<void>;

  // Data hooks — return signals or null
  onCandle(candle: Candle): Signal | null;
  onTrade?(trade: Trade): Signal | null;
  onOrderBook?(book: OrderBook): Signal | null;
}

interface Signal {
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  confidence: number;      // 0.0 – 1.0
  reason: string;
  metadata?: Record<string, unknown>;
}
```

### Writing a Custom Strategy

<!-- TODO: Add step-by-step tutorial once strategy engine is implemented -->

1. Create a file in `src/strategy/builtin/` or a separate strategies directory
2. Implement `IStrategy`
3. Register it in the strategy registry
4. Configure parameters in a YAML file under `strategies/`

### Example: SMA Crossover

```typescript
class SmaCrossStrategy implements IStrategy {
  name = 'sma-cross';
  version = '1.0.0';
  description = 'Simple Moving Average crossover strategy';

  private shortSma: SMA;
  private longSma: SMA;

  async initialize(config: StrategyConfig) {
    this.shortSma = new SMA(config.shortPeriod ?? 10);
    this.longSma = new SMA(config.longPeriod ?? 50);
  }

  onCandle(candle: Candle): Signal | null {
    this.shortSma.update(candle.close);
    this.longSma.update(candle.close);

    if (!this.shortSma.isReady || !this.longSma.isReady) return null;

    if (this.shortSma.value > this.longSma.value && this.shortSma.prev <= this.longSma.prev) {
      return { action: 'BUY', symbol: candle.symbol, confidence: 0.7, reason: 'SMA golden cross' };
    }
    if (this.shortSma.value < this.longSma.value && this.shortSma.prev >= this.longSma.prev) {
      return { action: 'SELL', symbol: candle.symbol, confidence: 0.7, reason: 'SMA death cross' };
    }
    return null;
  }

  async dispose() {}
}
```

---

## Backtesting

### How It Works

The backtester replays historical candle data through a strategy in chronological order, simulating order fills at historical prices.

<!-- TODO: Add backtesting engine details once implemented -->

### Metrics Reported

| Metric | Description |
|--------|-------------|
| Total Return | Overall percentage gain/loss |
| Sharpe Ratio | Risk-adjusted return |
| Max Drawdown | Largest peak-to-trough decline |
| Win Rate | Percentage of profitable trades |
| Profit Factor | Gross profit / gross loss |
| Average Trade | Mean P&L per trade |
| Trade Count | Total number of trades executed |

### Running a Backtest

```bash
# Example (once implemented)
npm run backtest -- --strategy sma-cross --symbol BTC/USDT --from 2025-01-01 --to 2025-12-31
```

---

## Order Management

### Order Types

| Type | Description |
|------|-------------|
| Market | Execute immediately at best available price |
| Limit | Execute at specified price or better |
| Stop-Loss | Trigger market sell when price drops to level |
| Take-Profit | Trigger market sell when price rises to level |

### Paper Trading

Paper trading mode simulates order fills against real-time market data without placing actual orders. This is the **default mode** and should be used extensively before enabling live trading.

<!-- TODO: Add paper trading engine details once implemented -->

### Order Lifecycle

```
Signal → Risk Check → [APPROVED] → Submit → Exchange ACK → Partial Fill → Full Fill
                    → [REJECTED] → Log reason → Alert
```

---

## Risk Management

### Risk Rules

Each rule is evaluated independently before any order is placed. **All rules must pass** for an order to be approved.

| Rule | Description | Default |
|------|-------------|---------|
| Max Position Size | Maximum % of portfolio per position | 5% |
| Daily Loss Limit | Halt trading if daily loss exceeds threshold | 3% |
| Max Open Positions | Maximum concurrent open positions | 3 |
| Kill Switch | Emergency halt — manual or automatic | Off |
| Cooldown | Pause after N consecutive losses | 3 losses → 1h pause |

### Kill Switch

The kill switch can be triggered:
- **Manually** via API endpoint or CLI command
- **Automatically** when daily loss limit is breached
- **On startup** if the previous shutdown was unclean

When activated, it:
1. Cancels all open orders
2. Optionally closes all positions (configurable)
3. Sends an alert via all configured channels
4. Prevents new orders until manually reset

---

## Persistence Layer

### Database Schema

<!-- TODO: Add Prisma schema once implemented -->

**Key tables:**

| Table | Purpose |
|-------|---------|
| `candles` | Historical OHLCV data |
| `trades` | Executed trades with fills |
| `orders` | Order lifecycle records |
| `positions` | Open and closed positions |
| `snapshots` | Periodic portfolio snapshots |
| `risk_events` | Risk rule trigger log |
| `signals` | All strategy signals |

### Migrations

```bash
npx prisma migrate dev     # Development
npx prisma migrate deploy  # Production
```

---

## Monitoring & Alerting

### Metrics (Prometheus)

| Metric | Type | Description |
|--------|------|-------------|
| `bot_trades_total` | Counter | Total trades executed |
| `bot_pnl_total` | Gauge | Cumulative P&L |
| `bot_open_positions` | Gauge | Current open positions |
| `bot_exchange_latency_ms` | Histogram | Exchange API latency |
| `bot_errors_total` | Counter | Error count by type |

### Alerts (Telegram)

The bot sends Telegram messages for:
- Trade executed (buy/sell with details)
- Risk rule triggered
- Kill switch activated
- Connection lost/restored
- Daily performance summary

### Health Check

```
GET /health → { status: "ok", uptime: 3600, positions: 2, mode: "paper" }
```

---

## Testing

### Test Structure

```
tests/
├── unit/              # Pure logic tests (no I/O)
│   ├── strategy/
│   ├── risk/
│   └── utils/
├── integration/       # Tests with database/exchange mocks
│   ├── exchange/
│   └── orders/
└── fixtures/          # Test data (candle CSVs, mock responses)
```

### Running Tests

```bash
npm run test            # Run all tests
npm run test:unit       # Unit tests only
npm run test:int        # Integration tests only
npm run test:coverage   # With coverage report
```

### Testing Guidelines

- **Strategies** must have backtest-based regression tests
- **Risk rules** must have edge-case tests (boundary values, overflow)
- **Exchange adapters** use recorded HTTP fixtures (no live calls in CI)
- **All PRs** must pass CI before merge

---

## Deployment

### Docker (Recommended)

```bash
# Build
docker build -t tradez99 .

# Run
docker compose up -d
```

### Docker Compose Stack

```yaml
services:
  bot:       # The trading bot
  postgres:  # Database
  grafana:   # Dashboards (optional)
  prometheus: # Metrics collection (optional)
```

### Manual

```bash
npm ci --production
npm run build
NODE_ENV=production node dist/index.js
```

---

## Security

### API Key Safety

- **Never** commit API keys to git
- Use `.env` files locally (already in `.gitignore`)
- Use secrets managers in production (Vault, AWS Secrets Manager, etc.)
- Use **read-only API keys** for data-only operations
- Enable **IP whitelisting** on exchange API keys when possible
- Use **separate API keys** for paper trading vs. live trading

### Principle of Least Privilege

Configure exchange API keys with the minimum permissions needed:

| Mode | Permissions Needed |
|------|--------------------|
| Data only | Read market data |
| Paper trading | Read market data |
| Live trading | Read market data + Create/cancel orders |
| Withdrawal | **NEVER** enable withdrawal permissions |

### Dependency Security

```bash
npm audit                 # Check for known vulnerabilities
npm audit fix             # Auto-fix where possible
```

---

## Troubleshooting

### Common Issues

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| Bot won't start | Missing env vars | Check `.env` against `.env.example` |
| No market data | API key invalid | Verify key on exchange website |
| WebSocket disconnects | Network instability | Bot auto-reconnects; check logs |
| Orders rejected | Insufficient balance | Check exchange balance |
| Risk rule blocks all orders | Limits too tight | Review risk config |
| Database errors | Missing migration | Run `npx prisma migrate dev` |

### Log Levels

```
fatal → error → warn → info → debug → trace
```

Set via `LOG_LEVEL` environment variable. Use `debug` during development, `info` in production.

---

## Glossary

| Term | Definition |
|------|-----------|
| **OHLCV** | Open, High, Low, Close, Volume — standard candle format |
| **Timeframe** | Candle duration (1m, 5m, 15m, 1h, 4h, 1d) |
| **Signal** | A strategy's recommendation to buy, sell, or hold |
| **Paper trading** | Simulated trading without real money |
| **Drawdown** | Peak-to-trough decline in portfolio value |
| **Sharpe ratio** | Risk-adjusted return metric |
| **Slippage** | Difference between expected and actual fill price |
| **Kill switch** | Emergency mechanism to halt all trading |
| **Backtest** | Running a strategy against historical data |
| **ccxt** | CryptoCurrency eXchange Trading library |

---

*This guide is a living document. Sections marked with `TODO` will be expanded as features are implemented.*
