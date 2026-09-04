import type { ScannedDevice } from '../types';
import { RssiFilter } from './smoothing';
import {
  clampDistance,
  DEFAULT_CALIBRATION,
  distanceToLevel,
  rssiToDistanceMeters,
  type DistanceCalibration,
} from './rssiToDistance';

/**
 * 每设备维护一个 RssiFilter，把「原始 RSSI」转成「滤波后 RSSI → 距离 → 档位」。
 * 无原生依赖、无全局状态，可直接单测。
 */
export class DistanceEstimator {
  private readonly filters = new Map<string, RssiFilter>();

  constructor(private readonly cal: DistanceCalibration = { ...DEFAULT_CALIBRATION }) {}

  /**
   * 估算单次 RSSI 对应的距离（无状态，不经过滤波）。
   * 供需要瞬时值的场景使用。
   */
  estimate(rssi: number, txPowerAt1m: number | null): number | null {
    const d = rssiToDistanceMeters(
      rssi,
      txPowerAt1m ?? this.cal.txPowerAt1m,
      this.cal.pathLossExponent,
    );
    return clampDistance(d, this.cal);
  }

  /**
   * 用设备最新 RSSI 更新其距离字段。
   * 注意：返回对象的 `rssi` 保留原始值（用于展示），距离计算基于滤波后的值。
   */
  update(device: ScannedDevice): ScannedDevice {
    const filter = this.getFilter(device.id);
    const filteredRssi = filter.push(device.rssi);
    const distance = this.estimate(filteredRssi, device.txPowerLevel);

    return {
      ...device,
      distanceMeters: distance,
      distanceLevel: distanceToLevel(distance),
    };
  }

  /** 设备离开后清理其滤波器，避免内存泄漏。 */
  removeDevice(deviceId: string): void {
    this.filters.delete(deviceId);
  }

  reset(): void {
    this.filters.clear();
  }

  private getFilter(deviceId: string): RssiFilter {
    let filter = this.filters.get(deviceId);
    if (!filter) {
      filter = new RssiFilter();
      this.filters.set(deviceId, filter);
    }
    return filter;
  }
}
