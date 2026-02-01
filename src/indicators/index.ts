/**
 * Technical Indicator Library
 *
 * Roadmap phase: 3
 */

/** Simple Moving Average */
export function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    result.push(slice.reduce((s, v) => s + v, 0) / period);
  }
  return result;
}

/** Exponential Moving Average */
export function ema(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  result.push(data.slice(0, period).reduce((s, v) => s + v, 0) / period);

  for (let i = period; i < data.length; i++) {
    const prev = result[result.length - 1];
    result.push((data[i] - prev) * multiplier + prev);
  }
  return result;
}

/** Relative Strength Index */
export function rsi(data: number[], period = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);

    if (i >= period) {
      const avgGain =
        gains.slice(i - period, i).reduce((s, v) => s + v, 0) / period;
      const avgLoss =
        losses.slice(i - period, i).reduce((s, v) => s + v, 0) / period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    }
  }
  return result;
}

/** Average True Range */
export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number[] {
  const trueRanges: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  return sma(trueRanges, period);
}

/** Bollinger Bands */
export function bollingerBands(
  data: number[],
  period = 20,
  stdMultiplier = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(data, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < middle.length; i++) {
    const slice = data.slice(i, i + period);
    const variance =
      slice.reduce((s, v) => s + (v - middle[i]) ** 2, 0) / period;
    const std = Math.sqrt(variance);

    upper.push(middle[i] + stdMultiplier * std);
    lower.push(middle[i] - stdMultiplier * std);
  }

  return { upper, middle, lower };
}
