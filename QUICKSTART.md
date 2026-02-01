# TraudeZ99-3 — Quick Start Guide

> Get the trading bot running in under 5 minutes.

---

## Prerequisites

- **Node.js** 20 or later — [Download](https://nodejs.org/)
- **npm** 10 or later (comes with Node.js)
- **Git** — [Download](https://git-scm.com/)
- An exchange account with an API key (Binance recommended for getting started)

---

## 1. Clone & Install

```bash
git clone https://github.com/b000rindza/TraudeZ99-3.git
cd TraudeZ99-3
npm install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Required — choose your exchange
DEFAULT_EXCHANGE=binance

# Required — your trading pairs
TRADING_PAIRS=BTC/USDT,ETH/USDT

# Required — start in paper mode (no real money)
TRADING_MODE=paper

# Optional — add API keys for live data
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
```

> **Important:** Start with `TRADING_MODE=paper`. Do not switch to `live` until you have thoroughly tested your strategy.

## 3. Build & Verify

```bash
npm run build       # Compile TypeScript
npm run lint        # Check code quality
npm run test        # Run test suite
```

## 4. Run the Bot

```bash
# Paper trading (default, safe)
npm start

# Or explicitly:
TRADING_MODE=paper npm start
```

## 5. Run a Backtest

```bash
# Test a strategy against historical data
npm run backtest -- --strategy sma-cross --symbol BTC/USDT --from 2025-01-01 --to 2025-12-31
```

---

## Project Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start the bot |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Start in development mode (hot reload) |
| `npm run test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:int` | Run integration tests only |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Run Prettier |
| `npm run backtest` | Run backtester |
| `npm run migrate` | Run database migrations |

---

## Directory Overview

```
src/
├── config/      → Environment & settings
├── exchange/    → Exchange API adapters
├── data/        → Market data ingestion
├── strategy/    → Trading strategies & indicators
├── engine/      → Core bot orchestration
├── risk/        → Risk management rules
├── orders/      → Order execution & tracking
├── persistence/ → Database layer
├── monitoring/  → Metrics, health, alerts
└── utils/       → Logger, retry, math helpers
```

---

## Configuration Reference

### Trading Modes

| Mode | Description | API Keys Needed |
|------|-------------|-----------------|
| `paper` | Simulated trades against live data | Read-only (or none for public data) |
| `live` | Real trades with real money | Read + Trade permissions |

### Risk Defaults

| Setting | Default | Env Variable |
|---------|---------|-------------|
| Max position size | 5% of portfolio | `MAX_POSITION_SIZE_PCT` |
| Daily loss limit | 3% | `DAILY_LOSS_LIMIT_PCT` |
| Max open positions | 3 | `MAX_OPEN_POSITIONS` |

---

## Writing Your First Strategy

1. Create a new file: `src/strategy/builtin/my-strategy.ts`

2. Implement the strategy interface:

```typescript
import { IStrategy, Signal } from '../interface';
import { Candle } from '../../data/types';

export class MyStrategy implements IStrategy {
  name = 'my-strategy';
  version = '1.0.0';
  description = 'My first custom strategy';

  async initialize() {
    // Setup indicators, load state, etc.
  }

  onCandle(candle: Candle): Signal | null {
    // Your logic here
    // Return { action: 'BUY', symbol: candle.symbol, confidence: 0.8, reason: '...' }
    // or null to do nothing
    return null;
  }

  async dispose() {
    // Cleanup
  }
}
```

3. Register it in the strategy registry

4. Backtest it before paper trading; paper trade before going live

---

## Monitoring

### Logs

Logs are written to stdout in structured JSON format. Set the level via `LOG_LEVEL`:

```bash
LOG_LEVEL=debug npm start    # Verbose
LOG_LEVEL=info npm start     # Normal (default)
```

### Telegram Alerts

To receive trade notifications on Telegram:

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get your chat ID via [@userinfobot](https://t.me/userinfobot)
3. Add to `.env`:

```bash
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=your_chat_id
```

### Health Check

```bash
curl http://localhost:3000/health
# → { "status": "ok", "uptime": 3600, "mode": "paper" }
```

---

## Docker Deployment

```bash
# Quick start with Docker Compose
docker compose up -d

# View logs
docker compose logs -f bot

# Stop
docker compose down
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Missing required env var` | Copy `.env.example` to `.env` and fill in values |
| `Cannot connect to exchange` | Check API key and internet connection |
| `No candle data` | Verify `TRADING_PAIRS` format (e.g., `BTC/USDT`) |
| `Build fails` | Run `npm ci` to clean-install dependencies |
| `Tests fail` | Ensure Node.js 20+ with `node --version` |

---

## Safety Checklist

Before switching to live trading, ensure:

- [ ] Strategy has been backtested with satisfactory results
- [ ] Strategy has been paper-traded for at least 1 week
- [ ] Risk limits are configured (`MAX_POSITION_SIZE_PCT`, `DAILY_LOSS_LIMIT_PCT`)
- [ ] Kill switch is tested and working
- [ ] Telegram alerts are configured and receiving messages
- [ ] API keys have **no withdrawal permissions**
- [ ] API keys have IP whitelist enabled (if supported)
- [ ] You are prepared to lose 100% of the allocated capital

---

## Next Steps

- Read the full [Development Guide](./GUIDE.md) for architecture details
- Check the [Roadmap](./ROADMAP.md) for upcoming features
- Browse `src/strategy/builtin/` for example strategies

---

*This is a living document. Features described here may not yet be implemented — see [ROADMAP.md](./ROADMAP.md) for current status.*
