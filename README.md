# TraudeZ99-3

A modular, strategy-agnostic cryptocurrency trading bot built with Node.js and TypeScript.

## Features

- **Multi-exchange support** — Binance, Kraken, Coinbase via [ccxt](https://github.com/ccxt/ccxt)
- **Pluggable strategies** — Write your own or use built-in strategies
- **Backtesting** — Test strategies against historical data before risking capital
- **Paper trading** — Simulate trades against live data with no real money
- **Risk management** — Position limits, daily loss caps, kill switch
- **Monitoring** — Prometheus metrics, Telegram/Discord alerts, health checks
- **Type-safe** — Written in strict TypeScript with zod-validated configuration

## Quick Start

```bash
git clone https://github.com/b000rindza/TraudeZ99-3.git
cd TraudeZ99-3
npm install
cp .env.example .env   # Edit with your settings
npm run build
npm start              # Starts in paper trading mode
```

See [QUICKSTART.md](./QUICKSTART.md) for the full setup guide.

## Documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](./QUICKSTART.md) | Get running in minutes |
| [GUIDE.md](./GUIDE.md) | Comprehensive development guide |
| [ROADMAP.md](./ROADMAP.md) | Development phases and milestones |

## Project Status

This project is under active development. See [ROADMAP.md](./ROADMAP.md) for the current phase and planned features.

| Phase | Status |
|-------|--------|
| Phase 0 — Foundation | In Progress |
| Phase 1 — Market Data | Planned |
| Phase 2 — Strategy Engine | Planned |
| Phase 3 — Order Management | Planned |
| Phase 4 — Risk Management | Planned |
| Phase 5 — Monitoring | Planned |
| Phase 6 — Deployment | Planned |

## License

[GNU General Public License v3](./LICENSE)
