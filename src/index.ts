/**
 * TraudeZ99-3 — Leveraged Trading Bot
 *
 * Entry point for the trading bot application.
 */

import { TradingEngine, TradingEngineConfig } from "./core/engine";

async function main(): Promise<void> {
  const config: TradingEngineConfig = {
    exchange: process.env.EXCHANGE ?? "binance",
    symbols: (process.env.SYMBOLS ?? "BTC/USDT").split(","),
    leverage: Number(process.env.LEVERAGE ?? 1),
    maxRiskPerTrade: Number(process.env.MAX_RISK ?? 0.01),
    dryRun: process.env.DRY_RUN !== "false",
  };

  console.log("TraudeZ99-3 Trading Bot");
  console.log(`Exchange: ${config.exchange}`);
  console.log(`Symbols: ${config.symbols.join(", ")}`);
  console.log(`Leverage: ${config.leverage}x`);
  console.log(`Max risk per trade: ${(config.maxRiskPerTrade * 100).toFixed(1)}%`);
  console.log(`Dry run: ${config.dryRun}`);

  const engine = new TradingEngine(config);

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await engine.stop();
    process.exit(0);
  });

  await engine.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
