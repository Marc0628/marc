import type { RadarDot, ScannedDevice } from '../types';

/**
 * 雷达几何 —— 纯函数，无原生/UI 依赖，可单测。
 * 核心约束：RSSI 只能测距、不能测向。angleDeg 是「稳定伪角度」，
 * 仅用于避免多个设备点重叠，绝不代表真实方位，UI 上也不得暗示方向。
 */
export interface RadarGeometryConfig {
  /** 外环对应距离（米）。 */
  maxRadiusM: number;
  /** 同心环的距离（米），从内到外。 */
  ringDistancesM: number[];
  /** 雷达绘制半径（px），用于把归一化距离换算为像素。 */
  radarRadiusPx: number;
  /** 设备点半径（px）。 */
  dotRadiusPx: number;
}

export const DEFAULT_RADAR_CONFIG: RadarGeometryConfig = {
  maxRadiusM: 30,
  ringDistancesM: [0.5, 2, 8, 30],
  radarRadiusPx: 140,
  dotRadiusPx: 6,
};

/** 距离（米）→ 归一化半径比例（0~1）。未知距离置为 1（最外圈）。 */
export function distanceToRadiusFraction(distanceM: number | null, maxRadiusM: number): number {
  if (distanceM === null || !Number.isFinite(distanceM)) return 1;
  const clamped = Math.max(0, Math.min(distanceM, maxRadiusM));
  return clamped / maxRadiusM;
}

/** 稳定伪角度（0~359）。由设备 id 哈希而来，保证同一设备位置稳定，不代表方向。 */
export function pseudoAngleDeg(deviceId: string): number {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i++) {
    hash = (hash * 31 + deviceId.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export interface Point {
  x: number;
  y: number;
}

/** 极坐标 → 直角坐标（SVG 坐标系，y 轴向下）。 */
export function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

/**
 * 由领域设备构建雷达点（不含像素坐标，像素坐标由 RadarView 依据自身尺寸计算）。
 */
export function deviceToDot(
  device: ScannedDevice,
  label: string,
  color: string,
  config: RadarGeometryConfig = DEFAULT_RADAR_CONFIG,
): RadarDot {
  return {
    deviceId: device.id,
    label,
    r: distanceToRadiusFraction(device.distanceMeters, config.maxRadiusM),
    angleDeg: pseudoAngleDeg(device.id),
    distanceLevel: device.distanceLevel,
    distanceMeters: device.distanceMeters,
    rssi: device.rssi,
    isConnected: device.isConnected,
    color,
  };
}
