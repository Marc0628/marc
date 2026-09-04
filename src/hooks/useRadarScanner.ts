import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { RadarDot, ScannedDevice } from '../types';
import { AudioManager } from '../audio';
import { getBleService } from '../ble';
import type { BleService, BluetoothState } from '../ble';
import { BLE_SCAN_OPTIONS, CONNECTED_RSSI_POLL_MS, DEVICE_STALE_MS, MAX_TRACKED_DEVICES, SCAN_REFRESH_MS } from '../config';
import { DistanceEstimator, distanceToVolume } from '../distance';
import { DEFAULT_RADAR_CONFIG, colorForLevel, deviceToDot } from '../radar';

export interface RadarScannerState {
  /** 当前可见设备列表（按距离升序）。 */
  devices: ScannedDevice[];
  /** 用于雷达渲染的点。 */
  dots: RadarDot[];
  /** 距离最近的设备。 */
  nearest: ScannedDevice | null;
  /** 当前被追踪的设备 id。 */
  trackedIds: string[];
  isScanning: boolean;
  bluetoothState: BluetoothState;
  /** 当前提示音音量（0 ~ 1）。 */
  currentVolume: number;
  error: string | null;
}

export interface RadarScannerActions {
  startScan: () => Promise<void>;
  stopScan: () => void;
  connect: (deviceId: string) => Promise<void>;
  disconnect: (deviceId: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
  toggleTrack: (deviceId: string) => Promise<void>;
  clearDevices: () => void;
  /** 关闭当前错误提示（error 为 null 时由 UI 隐藏）。 */
  clearError: () => void;
}

function shortId(id: string): string {
  return id.length > 6 ? id.slice(0, 6) : id;
}

function displayLabel(device: ScannedDevice): string {
  return device.name ?? device.localName ?? shortId(device.id);
}

/** 把扫描启动异常翻译成用户可读、可操作的提示；权限被拒时单独给更明确的引导。 */
function scanErrorToMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('蓝牙权限被拒绝')) {
    return '蓝牙权限被拒绝：无法开始扫描。请在系统设置中允许本应用使用蓝牙后，重新点击「开始扫描」。';
  }
  return '扫描启动失败：' + message;
}

/**
 * 组合根 hook：把 ble / distance / radar / audio 四个模块串起来。
 *
 * 数据流：
 *   BLE 扫描 → mapDevice → DistanceEstimator.update → devices map
 *     ├─ 最近设备 → distanceToVolume → AudioManager.setVolume
 *     └─ deviceToDot → RadarView
 *
 * TODO(实现说明)：
 * - 若需要把「扫描到的设备」持久化或跨页面共享，可把 devices 提升到 Context/store。
 */
export function useRadarScanner(): RadarScannerState & RadarScannerActions {
  const bleRef = useRef<BleService | null>(null);
  const estimatorRef = useRef<DistanceEstimator | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  if (!bleRef.current) bleRef.current = getBleService();
  if (!estimatorRef.current) estimatorRef.current = new DistanceEstimator();
  if (!audioRef.current) audioRef.current = new AudioManager();

  const [devicesMap, setDevicesMap] = useState<Record<string, ScannedDevice>>({});
  const [trackedIds, setTrackedIds] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>('unknown');
  const [currentVolume, setCurrentVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 初始化：订阅蓝牙状态 + 加载提示音
  useEffect(() => {
    const ble = bleRef.current!;
    const audio = audioRef.current!;

    ble.initialize();
    const unsubscribe = ble.onStateChange(setBluetoothState);
    audio.load().catch((e) => setError('音频初始化失败：' + String(e)));

    return () => {
      unsubscribe();
      ble.destroy();
      audio.release();
    };
  }, []);

  const handleDevice = useCallback((raw: ScannedDevice) => {
    const enriched = estimatorRef.current!.update(raw);
    setDevicesMap((prev) => ({ ...prev, [enriched.id]: enriched }));
  }, []);

  const startScan = useCallback(async () => {
    const ble = bleRef.current!;
    try {
      await ble.startScan(handleDevice, BLE_SCAN_OPTIONS);
      setIsScanning(true);
      audioRef.current!.startBeep();
    } catch (e) {
      setError(scanErrorToMessage(e));
      setIsScanning(false);
    }
  }, [handleDevice]);

  const stopScan = useCallback(() => {
    bleRef.current!.stopScan();
    setIsScanning(false);
    audioRef.current!.stopBeep();
    setCurrentVolume(0);
  }, []);

  // 蓝牙关闭 / 权限被收回时自动停止扫描，避免重扫无限失败、提示音残留
  useEffect(() => {
    if (bluetoothState === 'poweredOn' || !isScanning) return;
    stopScan();
  }, [bluetoothState, isScanning, stopScan]);

  // 淘汰长时间未更新的设备
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setDevicesMap((prev) => {
        const next: Record<string, ScannedDevice> = {};
        let changed = false;
        for (const [id, device] of Object.entries(prev)) {
          if (now - device.lastSeenAt < DEVICE_STALE_MS) {
            next[id] = device;
          } else {
            changed = true;
            estimatorRef.current!.removeDevice(id);
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // iOS 需要周期重扫刷新 RSSI（CoreBluetooth 不重复上报广播）
  useEffect(() => {
    if (!isScanning) return;
    const timer = setInterval(() => {
      // startScan 内部会先 await stopScan 再启动，串行化 stop→start，避免竞态
      bleRef.current!.startScan(handleDevice, BLE_SCAN_OPTIONS).catch(() => {
        /* 重扫失败保持静默，下个周期重试 */
      });
    }, SCAN_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isScanning, handleDevice]);

  // 已连接设备轮询 RSSI，保证距离持续更新
  useEffect(() => {
    if (trackedIds.length === 0) return;
    const timer = setInterval(() => {
      trackedIds.forEach(async (id) => {
        const rssi = await bleRef.current!.readRssi(id);
        if (rssi === null || rssi === undefined) return;
        setDevicesMap((prev) => {
          const device = prev[id];
          if (!device) return prev;
          const enriched = estimatorRef.current!.update({ ...device, rssi, lastSeenAt: Date.now() });
          return { ...prev, [id]: enriched };
        });
      });
    }, CONNECTED_RSSI_POLL_MS);
    return () => clearInterval(timer);
  }, [trackedIds]);

  const devices = useMemo(
    () =>
      Object.values(devicesMap).sort(
        (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
      ),
    [devicesMap],
  );

  const nearest = useMemo(() => {
    let result: ScannedDevice | null = null;
    for (const device of devices) {
      if (device.distanceMeters === null) continue;
      if (result === null || device.distanceMeters < (result.distanceMeters ?? Infinity)) {
        result = device;
      }
    }
    return result;
  }, [devices]);

  // 最近设备 → 音量（音量只在扫描期间播放）
  useEffect(() => {
    const volume = isScanning && nearest ? distanceToVolume(nearest.distanceMeters) : 0;
    audioRef.current!.setVolume(volume);
    setCurrentVolume(volume);
  }, [isScanning, nearest]);

  const dots = useMemo<RadarDot[]>(
    () =>
      devices.map((device) =>
        deviceToDot(device, displayLabel(device), colorForLevel(device.distanceLevel), DEFAULT_RADAR_CONFIG),
      ),
    [devices],
  );

  const connect = useCallback(async (deviceId: string) => {
    try {
      await bleRef.current!.connect(deviceId);
      setDevicesMap((prev) =>
        prev[deviceId] ? { ...prev, [deviceId]: { ...prev[deviceId], isConnected: true } } : prev,
      );
    } catch (e) {
      setError('连接失败：' + String(e));
    }
  }, []);

  const disconnect = useCallback(async (deviceId: string) => {
    try {
      await bleRef.current!.disconnect(deviceId);
      setDevicesMap((prev) =>
        prev[deviceId] ? { ...prev, [deviceId]: { ...prev[deviceId], isConnected: false } } : prev,
      );
    } catch (e) {
      setError('断开失败：' + String(e));
    }
  }, []);

  const disconnectAll = useCallback(async () => {
    await bleRef.current!.disconnectAll();
    setDevicesMap((prev) => {
      const next: Record<string, ScannedDevice> = {};
      for (const [id, device] of Object.entries(prev)) {
        next[id] = { ...device, isConnected: false };
      }
      return next;
    });
  }, []);

  const toggleTrack = useCallback(async (deviceId: string) => {
    const isTracked = trackedIds.includes(deviceId);
    if (isTracked) {
      // 取消追踪：仅移除追踪标记，不断开连接（连接由「连接/断开」按钮管理）。
      setTrackedIds((prev) => prev.filter((id) => id !== deviceId));
      return;
    }
    // 新增追踪前检查上限，超出时拒绝并通过 error 通道提示。
    if (trackedIds.length >= MAX_TRACKED_DEVICES) {
      setError(`最多同时追踪 ${MAX_TRACKED_DEVICES} 个设备`);
      return;
    }
    // 追踪必须建立在连接之上：readRSSIForDevice 只能读已连接设备，未连接时追踪是空操作。
    try {
      if (!(await bleRef.current!.isConnected(deviceId))) {
        await bleRef.current!.connect(deviceId);
        setDevicesMap((prev) =>
          prev[deviceId] ? { ...prev, [deviceId]: { ...prev[deviceId], isConnected: true } } : prev,
        );
      }
      setTrackedIds((prev) => [...prev, deviceId]);
    } catch (e) {
      setError('连接失败，无法追踪：' + String(e));
    }
  }, [trackedIds]);

  const clearError = useCallback(() => setError(null), []);

  const clearDevices = useCallback(() => {
    setDevicesMap({});
    estimatorRef.current!.reset();
  }, []);

  return {
    devices,
    dots,
    nearest,
    trackedIds,
    isScanning,
    bluetoothState,
    currentVolume,
    error,
    startScan,
    stopScan,
    connect,
    disconnect,
    disconnectAll,
    toggleTrack,
    clearDevices,
    clearError,
  };
}
