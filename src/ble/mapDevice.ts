import type { Device } from 'react-native-ble-plx';
import type { ScannedDevice } from '../types';

/**
 * 把 react-native-ble-plx 的 Device 归一化为领域类型 ScannedDevice。
 * 纯函数，隔离原生类型的细节（null 字段、base64 厂商数据等）。
 */
export function mapPlxDeviceToScannedDevice(device: Device): ScannedDevice {
  return {
    id: device.id,
    name: device.name ?? device.localName ?? null,
    localName: device.localName ?? null,
    // 广播可能缺失 rssi，用 0 兜底；distance 模块会把 >= 0 的 RSSI 视为非法并忽略。
    rssi: device.rssi ?? 0,
    txPowerLevel: device.txPowerLevel ?? null,
    manufacturerData: device.manufacturerData ?? null,
    serviceUUIDs: device.serviceUUIDs ?? null,
    isConnectable: device.isConnectable ?? null,
    lastSeenAt: Date.now(),
    distanceMeters: null,
    distanceLevel: 'unknown',
    isConnected: false,
  };
}
