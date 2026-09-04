import {
  BleManager,
  type ScanOptions,
  type State,
} from 'react-native-ble-plx';
import { PermissionsAndroid, Platform, type Permission } from 'react-native';

import type { BleService, BluetoothState, OnDeviceDiscovered, OnStateChange } from './types';
import { mapPlxDeviceToScannedDevice } from './mapDevice';

const PLX_STATE_TO_BLUETOOTH_STATE: Record<State, BluetoothState> = {
  PoweredOn: 'poweredOn',
  PoweredOff: 'poweredOff',
  Unauthorized: 'unauthorized',
  Unsupported: 'unsupported',
  Resetting: 'resetting',
  Unknown: 'unknown',
};

/**
 * BleService 的生产实现，内部持有单例 react-native-ble-plx 的 BleManager。
 *
 * TODO(实现说明)：
 * - 连接后如需读写特征值，需在 connect() 里对 device 调用
 *   discoverAllServicesAndCharacteristics()，并按服务 UUID 建立订阅。
 * - iOS 端 CoreBluetooth 限制：不指定具体 serviceUUID 时，同一设备不会重复回调，
 *   因此「连续 RSSI」要依赖 readRssiForDevice 轮询（已连接设备）或周期重扫（未连接设备）。
 * - Android 12+ 的 BLUETOOTH_SCAN/BLUETOOTH_CONNECT 与 Android < 12 的
 *   ACCESS_FINE_LOCATION 都要在扫描前请求，见 requestAndroidPermissions()。
 */
export class BleManagerImpl implements BleService {
  private readonly manager = new BleManager();
  private isScanning = false;
  /** 是否已确认拿到 Android 运行时权限，用于重扫路径跳过重复请求。 */
  private permissionsGranted = false;
  private stateSubscription: { remove: () => void } | null = null;
  private readonly stateListeners = new Set<OnStateChange>();
  private currentState: BluetoothState = 'unknown';

  initialize(): void {
    if (this.stateSubscription) return;
    this.stateSubscription = this.manager.onStateChange(
      (state) => {
        this.currentState = PLX_STATE_TO_BLUETOOTH_STATE[state];
        this.stateListeners.forEach((cb) => cb(this.currentState));
      },
      true, // 立即回调一次当前状态
    );
  }

  state(): BluetoothState {
    return this.currentState;
  }

  onStateChange(cb: OnStateChange): () => void {
    this.stateListeners.add(cb);
    cb(this.currentState);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  async requestPermissions(): Promise<boolean> {
    // iOS：扫描时系统会自动弹出蓝牙权限弹窗，无需手动处理（权限文案在 app.json 的 infoPlist）。
    if (Platform.OS !== 'android') return true;
    // Android 已授权后跳过重复的运行时权限请求（重扫每 4s 会经过这里，避免无谓 IPC）。
    if (this.permissionsGranted) return true;
    const ok = await this.requestAndroidPermissions();
    if (ok) this.permissionsGranted = true;
    return ok;
  }

  async startScan(onDevice: OnDeviceDiscovered, options?: ScanOptions): Promise<void> {
    const ok = await this.requestPermissions();
    if (!ok) throw new Error('蓝牙权限被拒绝，请在系统设置中允许蓝牙与定位权限');

    // ble-plx 3.x 的 startDeviceScan 返回 Promise<void>（无订阅对象），
    // 开始新扫描前先停掉已有扫描，再等待本次扫描启动（串行化 stop→start 避免竞态）。
    await this.stopScan();

    await this.manager.startDeviceScan(null, options ?? null, (error, device) => {
      if (error) {
        // TODO(实现说明)：区分错误类型（权限、蓝牙关闭、超时）并向上层上报。
        console.warn('[ble] scan error', error.message);
        return;
      }
      if (device) onDevice(mapPlxDeviceToScannedDevice(device));
    });
    this.isScanning = true;
  }

  async stopScan(): Promise<void> {
    await this.manager.stopDeviceScan().catch(() => {
      /* 忽略停止扫描的异步错误，保持幂等 */
    });
    this.isScanning = false;
  }

  async connect(deviceId: string): Promise<void> {
    const device = await this.manager.connectToDevice(deviceId, { timeout: 10_000 });
    // TODO(实现说明)：此处可调用 device.discoverAllServicesAndCharacteristics()，
    // 再按需 subscribe 特征值，以读取电池电量、自定义数据等。
    await device.discoverAllServicesAndCharacteristics();
  }

  async disconnect(deviceId: string): Promise<void> {
    const connected = await this.manager.isDeviceConnected(deviceId);
    if (connected) {
      await this.manager.cancelDeviceConnection(deviceId);
    }
  }

  async disconnectAll(): Promise<void> {
    const devices = await this.manager.connectedDevices([]);
    await Promise.all(devices.map((d) => this.manager.cancelDeviceConnection(d.id)));
  }

  async isConnected(deviceId: string): Promise<boolean> {
    return this.manager.isDeviceConnected(deviceId);
  }

  async readRssi(deviceId: string): Promise<number | null> {
    try {
      const device = await this.manager.readRSSIForDevice(deviceId);
      return device.rssi;
    } catch (e) {
      return null;
    }
  }

  destroy(): void {
    this.stopScan();
    this.stateSubscription?.remove();
    this.stateSubscription = null;
    this.stateListeners.clear();
    this.manager.destroy();
  }

  private async requestAndroidPermissions(): Promise<boolean> {
    const apiLevel = Number(Platform.Version);

    // Android 12+（API 31+）需要运行时蓝牙权限；旧版本需要传统蓝牙 + 定位权限。
    const permissions: Permission[] =
      apiLevel >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ];

    const result = await PermissionsAndroid.requestMultiple(permissions);
    return Object.values(result).every(
      (status) => status === PermissionsAndroid.RESULTS.GRANTED,
    );
  }
}
