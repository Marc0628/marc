/**
 * 全局共享的领域类型。
 * 这些类型是各模块之间传递数据的「契约」，改动前先看 docs/architecture.md 的数据流一节。
 */

/** 一个被扫描到的蓝牙设备（已从 BLE 原生对象归一化）。 */
export interface ScannedDevice {
  /** 设备唯一标识（BLE 通常为 MAC / UUID；iOS 上为系统生成的 UUID）。 */
  id: string;
  /** 广播名称 / GAP 名称，可能为 null。 */
  name: string | null;
  /** 本地名称（localName），可能为 null。 */
  localName: string | null;
  /** 最新一次 RSSI（dBm），恒为负值；非法时为 0（由上层忽略）。 */
  rssi: number;
  /** 广告中的发射功率（TxPower，dBm）；缺失时用默认 -59。 */
  txPowerLevel: number | null;
  /** 厂商数据（base64），可选。 */
  manufacturerData: string | null;
  /** 广播的服务 UUID 列表，可选。 */
  serviceUUIDs: string[] | null;
  /** 是否可连接，可选。 */
  isConnectable: boolean | null;
  /** 最后一次被观测到的 epoch 毫秒，用于超时淘汰。 */
  lastSeenAt: number;
  /** 估算距离（米），由 distance 模块填充；未知时为 null。 */
  distanceMeters: number | null;
  /** 距离档位，由 distance 模块填充。 */
  distanceLevel: DistanceLevel;
  /** 是否已连接。 */
  isConnected: boolean;
}

/**
 * 距离档位：用于 UI 上色、雷达环与音量分档兜底。
 * 阈值见 src/distance/rssiToDistance.ts 的 LEVEL_THRESHOLDS。
 */
export type DistanceLevel =
  | 'immediate' // 极近：< 0.5m
  | 'near' // 近：0.5 ~ 2m
  | 'mid' // 中：2 ~ 8m
  | 'far' // 远：8 ~ 30m
  | 'out-of-range' // 超范围：>= 30m（或信号不可用）
  | 'unknown'; // 未知（无有效 RSSI）

/**
 * 雷达上的一个点。
 * 注意：RSSI 只能测距、不能测向，`angleDeg` 是「稳定伪角度」，
 * 仅用于避免多个点重叠，不代表真实方位。
 */
export interface RadarDot {
  deviceId: string;
  /** 显示名（name 或 id 前缀）。 */
  label: string;
  /** 到圆心的归一化距离，0（圆心）~ 1（雷达边缘）。 */
  r: number;
  /** 稳定伪角度（0~359），仅用于布局，不代表方向。 */
  angleDeg: number;
  distanceLevel: DistanceLevel;
  distanceMeters: number | null;
  rssi: number;
  isConnected: boolean;
  /** 按距离档位决定的颜色。 */
  color: string;
}
