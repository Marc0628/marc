/**
 * distance 模块 —— 纯函数核心，无任何原生依赖，可独立单元测试。
 *
 * 距离估算公式（对数路径损耗模型）：
 *   d = 10 ^ ((TxPower - RSSI) / (10 * n))
 *   - TxPower：距发射源 1m 处的 RSSI，默认 -59 dBm
 *   - n：路径损耗指数，自由空间 2.0，室内遮挡 2.5 ~ 3.0
 *   - RSSI：滤波后的接收信号强度，恒为负值
 */
import type { DistanceLevel } from '../types';

export interface DistanceCalibration {
  /** 1m 处的参考 RSSI（dBm）。 */
  txPowerAt1m: number;
  /** 路径损耗指数 n（2.0 ~ 3.0）。 */
  pathLossExponent: number;
  /** 距离下限（米），防止过近导致除零/异常。 */
  minDistanceM: number;
  /** 距离上限（米），超过视为 out-of-range。 */
  maxDistanceM: number;
}

export const DEFAULT_CALIBRATION: DistanceCalibration = {
  txPowerAt1m: -59,
  pathLossExponent: 2.5,
  minDistanceM: 0.1,
  maxDistanceM: 30,
};

/** 距离档位阈值（米）。与 DEFAULT_CALIBRATION.maxDistanceM 对齐。 */
export const LEVEL_THRESHOLDS = {
  immediate: 0.5,
  near: 2,
  mid: 8,
  far: 30,
} as const;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(value, hi));
}

/**
 * 将 RSSI 换算为距离（米）。
 * @returns 距离（米）；RSSI 非法（>= 0 或非有限值）时返回 null。
 */
export function rssiToDistanceMeters(
  rssi: number,
  txPowerAt1m: number = DEFAULT_CALIBRATION.txPowerAt1m,
  pathLossExponent: number = DEFAULT_CALIBRATION.pathLossExponent,
): number | null {
  // RSSI 在 BLE 语境下恒为负；0 或正值说明该样本不可用（广播缺失 rssi 时的兜底值）。
  if (!Number.isFinite(rssi) || rssi >= 0) return null;

  const n = pathLossExponent > 0 ? pathLossExponent : DEFAULT_CALIBRATION.pathLossExponent;
  const exponent = (txPowerAt1m - rssi) / (10 * n);
  return Math.pow(10, exponent);
}

/** 把距离 clamp 到 [minDistanceM, maxDistanceM]；null 原样返回。 */
export function clampDistance(
  distanceM: number | null,
  cal: DistanceCalibration = DEFAULT_CALIBRATION,
): number | null {
  if (distanceM === null || !Number.isFinite(distanceM)) return null;
  return clamp(distanceM, cal.minDistanceM, cal.maxDistanceM);
}

/** 距离 → 档位。null / 非有限值 → 'unknown'。 */
export function distanceToLevel(distanceM: number | null): DistanceLevel {
  if (distanceM === null || !Number.isFinite(distanceM)) return 'unknown';
  if (distanceM < LEVEL_THRESHOLDS.immediate) return 'immediate';
  if (distanceM < LEVEL_THRESHOLDS.near) return 'near';
  if (distanceM < LEVEL_THRESHOLDS.mid) return 'mid';
  if (distanceM < LEVEL_THRESHOLDS.far) return 'far';
  return 'out-of-range';
}

/**
 * 距离 → 音量（0 ~ 1），在「对数空间」做线性映射：
 *   volume = (log10(max) - log10(d)) / (log10(max) - log10(min))
 * 这样近端变化更细腻、远端变化更平缓，符合人耳对距离的感知。
 * @param distanceM 估算距离（米）；null 返回 0（静音）。
 */
export function distanceToVolume(
  distanceM: number | null,
  cal: DistanceCalibration = DEFAULT_CALIBRATION,
): number {
  if (distanceM === null || !Number.isFinite(distanceM)) return 0;
  const d = clamp(distanceM, cal.minDistanceM, cal.maxDistanceM);
  const t =
    (Math.log10(cal.maxDistanceM) - Math.log10(d)) /
    (Math.log10(cal.maxDistanceM) - Math.log10(cal.minDistanceM));
  return clamp(t, 0, 1);
}

/** 便捷函数：RSSI 直接 → 音量（内部先算距离）。 */
export function rssiToVolume(
  rssi: number,
  txPowerAt1m: number = DEFAULT_CALIBRATION.txPowerAt1m,
  pathLossExponent: number = DEFAULT_CALIBRATION.pathLossExponent,
): number {
  return distanceToVolume(rssiToDistanceMeters(rssi, txPowerAt1m, pathLossExponent));
}
