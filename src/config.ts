import type { ScanOptions } from 'react-native-ble-plx';

/** 应用级配置：扫描策略与追踪参数。 */

/** BLE 扫描参数：allowDuplicates 用于拿到连续 RSSI 更新（Android 有效；iOS 见 README 限制说明）。 */
export const BLE_SCAN_OPTIONS: ScanOptions = { allowDuplicates: true };

/** 设备超过该毫秒数未更新即视为离开并淘汰。 */
export const DEVICE_STALE_MS = 10_000;

/**
 * iOS 的 CoreBluetooth 在不指定具体服务 UUID 时不会重复上报同一设备广播，
 * 因此需要周期性地 stop + start 扫描来刷新 RSSI。Android 无需，但统一执行也无害。
 */
export const SCAN_REFRESH_MS = 4_000;

/** 已连接/追踪设备读取 RSSI 的轮询间隔。 */
export const CONNECTED_RSSI_POLL_MS = 1_000;

/** 同时追踪的设备数量上限。 */
export const MAX_TRACKED_DEVICES = 8;
