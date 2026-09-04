import type { ScanOptions } from 'react-native-ble-plx';
import type { ScannedDevice } from '../types';

/** 归一化后的蓝牙状态（屏蔽 react-native-ble-plx 的 State 枚举，便于上层与测试替换）。 */
export type BluetoothState =
  | 'poweredOn'
  | 'poweredOff'
  | 'unauthorized'
  | 'unsupported'
  | 'resetting'
  | 'unknown';

export type OnStateChange = (state: BluetoothState) => void;
export type OnDeviceDiscovered = (device: ScannedDevice) => void;

/**
 * BLE 服务边界接口。
 * 上层（hooks/screens）只依赖这个接口，不直接 import react-native-ble-plx，
 * 从而可以在测试中注入 mock 实现。
 */
export interface BleService {
  /** 初始化 manager、订阅系统蓝牙状态。幂等，可重复调用。 */
  initialize(): void;
  /** 当前蓝牙状态。 */
  state(): BluetoothState;
  /** 订阅蓝牙状态变化；返回取消订阅函数。 */
  onStateChange(cb: OnStateChange): () => void;
  /** 请求系统权限（iOS 在扫描时自动弹窗，Android 需手动请求运行时权限）。 */
  requestPermissions(): Promise<boolean>;
  /** 开始扫描；每发现/更新一台设备回调一次 onDevice。 */
  startScan(onDevice: OnDeviceDiscovered, options?: ScanOptions): Promise<void>;
  /** 停止扫描（异步，等待底层停止完成后再返回）。 */
  stopScan(): Promise<void>;
  /** 连接设备。 */
  connect(deviceId: string): Promise<void>;
  /** 断开设备。 */
  disconnect(deviceId: string): Promise<void>;
  /** 断开所有已连接设备。 */
  disconnectAll(): Promise<void>;
  /** 判断设备是否已连接。 */
  isConnected(deviceId: string): Promise<boolean>;
  /** 读取设备最新 RSSI（dBm）；失败返回 null。 */
  readRssi(deviceId: string): Promise<number | null>;
  /** 释放原生资源（扫描、连接、订阅）。 */
  destroy(): void;
}
