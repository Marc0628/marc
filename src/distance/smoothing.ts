/**
 * RSSI 滤波：BLA 的 RSSI 抖动很大（多径、遮挡、人体吸收），
 * 直接喂给距离公式会让雷达点与音量来回跳。这里用「中值滤波 + EMA」双级平滑。
 */
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export class RssiFilter {
  private window: number[] = [];
  private ema: number | null = null;

  constructor(
    private readonly windowSize = 5,
    private readonly alpha = 0.35,
  ) {}

  /** 压入一个原始 RSSI，返回滤波后的 RSSI。 */
  push(rssi: number): number {
    if (!Number.isFinite(rssi) || rssi >= 0) {
      // 非法样本：保持当前估计不变
      return this.ema ?? rssi;
    }
    this.window.push(rssi);
    if (this.window.length > this.windowSize) this.window.shift();

    const median = medianOf(this.window);
    if (this.ema === null) {
      this.ema = median;
    } else {
      this.ema = this.alpha * median + (1 - this.alpha) * this.ema;
    }
    return this.ema;
  }

  /** 当前滤波后的 RSSI；无样本时为 null。 */
  get value(): number | null {
    return this.ema;
  }

  reset(): void {
    this.window = [];
    this.ema = null;
  }
}
