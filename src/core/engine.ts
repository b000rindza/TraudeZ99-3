/**
 * Core trading engine - orchestrates strategy execution, order management, and position tracking.
 */

export interface TradingEngineConfig {
  exchange: string;
  symbols: string[];
  leverage: number;
  maxRiskPerTrade: number; // as a fraction of equity (e.g., 0.01 = 1%)
  dryRun: boolean;
}

export class TradingEngine {
  private config: TradingEngineConfig;
  private running = false;

  constructor(config: TradingEngineConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(`Trading engine started: ${this.config.symbols.join(", ")}`);
    // TODO: Initialize exchange connection
    // TODO: Load strategies
    // TODO: Start market data feeds
    // TODO: Begin strategy evaluation loop
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log("Trading engine stopped");
    // TODO: Cancel open orders
    // TODO: Close connections
  }

  isRunning(): boolean {
    return this.running;
  }
}
