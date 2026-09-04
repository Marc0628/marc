# FindBlueteeth Tool 架构设计文档

- 版本：0.1.0
- 目标平台：iPhone 16 Pro Max（iOS），代码同时兼容 Android
- 技术栈：React Native + Expo（dev build）+ TypeScript + react-native-ble-plx +
  react-native-svg + react-native-reanimated + react-native-sound

---

## 1. 概述与目标

一个蓝牙雷达查找器：扫描附近 BLE 设备，以「雷达」形式呈现（扫动动画 + 同心圆距离环），
越靠近设备提示音越大，支持连接与多设备追踪。

核心约束：**RSSI 只能测距、不能测向**，因此系统不提供方向信息，雷达点的角度是
「稳定伪角度」，仅用于布局可读性，UI 上不得暗示方向。

---

## 2. 模块划分与依赖方向

采用「模块化单体」：单 App、单进程，但按职责切分为可独立测试的模块。

```
screens（UI 编排）
   │
   ▼
hooks/useRadarScanner（组合根，唯一编排点）
   │
   ├──▶ ble        （扫描/连接，BleService 接口）
   ├──▶ distance   （RSSI→距离→档位/音量，纯函数）
   ├──▶ radar      （几何纯函数 + svg/reanimated 渲染）
   └──▶ audio      （循环提示音 + 实时音量）
   │
   ▼
types.ts（全局领域类型，最底层，不依赖任何模块）
```

依赖方向规则（上层 → 下层，禁止反向）：

- `screens` 只依赖 `hooks`、`types`、`radar`、`theme`。
- `hooks` 依赖 `ble`/`distance`/`radar`/`audio`，是唯一把各模块串起来的地方。
- `distance` 与 `radar/radarGeometry` 是**纯函数**，不 import 原生模块、不 import UI。
- `ble`、`audio` 是**原生边界**，把原生库封装在接口后，便于测试注入 mock。
- 上层不得直接 `import 'react-native-ble-plx'` 或 `import Sound from 'react-native-sound'`。

---

## 3. 各模块职责与接口

### 3.1 types（`src/types.ts`）

全局领域类型，是跨模块的数据契约。

```ts
export interface ScannedDevice {
  id: string;
  name: string | null;
  localName: string | null;
  rssi: number;                 // 最新 RSSI（dBm，负值）
  txPowerLevel: number | null;  // 发射功率，缺省用 -59
  manufacturerData: string | null;
  serviceUUIDs: string[] | null;
  isConnectable: boolean | null;
  lastSeenAt: number;           // epoch ms，用于超时淘汰
  distanceMeters: number | null;// distance 模块填充
  distanceLevel: DistanceLevel; // distance 模块填充
  isConnected: boolean;
}

export type DistanceLevel =
  | 'immediate' | 'near' | 'mid' | 'far' | 'out-of-range' | 'unknown';

export interface RadarDot {
  deviceId: string;
  label: string;
  r: number;            // 0（圆心）~ 1（边缘）
  angleDeg: number;     // 稳定伪角度，不代表方向
  distanceLevel: DistanceLevel;
  distanceMeters: number | null;
  rssi: number;
  isConnected: boolean;
  color: string;
}
```

### 3.2 ble-manager（`src/ble/`）

职责：封装 react-native-ble-plx，向上暴露平台无关的 `BleService` 接口。

```ts
export type BluetoothState =
  | 'poweredOn' | 'poweredOff' | 'unauthorized' | 'unsupported' | 'resetting' | 'unknown';

export interface BleService {
  initialize(): void;
  state(): BluetoothState;
  onStateChange(cb: (s: BluetoothState) => void): () => void;
  requestPermissions(): Promise<boolean>;
  startScan(onDevice: (d: ScannedDevice) => void, options?: ScanOptions): Promise<void>;
  stopScan(): void;
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  disconnectAll(): Promise<void>;
  isConnected(deviceId: string): Promise<boolean>;
  readRssi(deviceId: string): Promise<number | null>;
  destroy(): void;
}
```

实现：`BleManagerImpl`（持有单例 `new BleManager()`）、`mapPlxDeviceToScannedDevice`
（纯函数，把 plx `Device` 归一化为 `ScannedDevice`）、`createBleService` / `getBleService`
（工厂 + 惰性单例，便于测试注入 mock）。

权限：

- iOS：扫描时系统自动弹窗，文案来自 `app.json` 的 `ios.infoPlist`。
- Android：`requestAndroidPermissions()` 按 API 级别请求
  `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT`（API 31+）或 `BLUETOOTH`/`BLUETOOTH_ADMIN`/`ACCESS_FINE_LOCATION`（旧版）。

### 3.3 distance（`src/distance/`）

职责：RSSI → 距离 → 档位 → 音量。**全部纯函数，可独立单测。**

```ts
export interface DistanceCalibration {
  txPowerAt1m: number;       // 默认 -59
  pathLossExponent: number;  // n，默认 2.5（2 ~ 3）
  minDistanceM: number;      // 0.1
  maxDistanceM: number;      // 30
}

export function rssiToDistanceMeters(rssi: number, txPowerAt1m?, n?): number | null;
export function clampDistance(d: number | null, cal?): number | null;
export function distanceToLevel(d: number | null): DistanceLevel;
export function distanceToVolume(d: number | null, cal?): number;      // 0..1
export function rssiToVolume(rssi: number, txPowerAt1m?, n?): number;

export class RssiFilter {
  push(rssi: number): number;  // 中值滤波(窗口5) + EMA(α=0.35)
  get value(): number | null;
  reset(): void;
}

export class DistanceEstimator {
  constructor(cal?: DistanceCalibration);
  estimate(rssi: number, txPowerAt1m: number | null): number | null; // 无状态瞬时值
  update(device: ScannedDevice): ScannedDevice; // 按设备滤波后填充距离/档位
  removeDevice(id: string): void;
  reset(): void;
}
```

### 3.4 radar-ui（`src/radar/`）

职责：把 `ScannedDevice` 渲染为雷达。分两层：

- 纯几何（`radarGeometry.ts`）：`distanceToRadiusFraction`、`pseudoAngleDeg`、
  `polarToCartesian`、`deviceToDot` —— 可单测。
- 渲染（`RadarView` / `DistanceRings` / `RadarSweep` / `DeviceDots`）：
  svg 画环 + reanimated 驱动扫动扇形 + 设备点。

```ts
export interface RadarGeometryConfig {
  maxRadiusM: number;       // 30
  ringDistancesM: number[]; // [0.5, 2, 8, 30]
  radarRadiusPx: number;    // 140
  dotRadiusPx: number;      // 6
}
export function distanceToRadiusFraction(d: number | null, maxRadiusM: number): number;
export function pseudoAngleDeg(deviceId: string): number;
export function polarToCartesian(cx, cy, radius, angleDeg): { x, y };
export function deviceToDot(device, label, color, config?): RadarDot;
export function colorForLevel(level: DistanceLevel): string;
```

### 3.5 audio-manager（`src/audio/`）

职责：循环提示音 + 实时音量。封装 react-native-sound。

```ts
export interface AudioController {
  load(): Promise<void>;              // 加载 assets/beep.wav，setNumberOfLoops(-1)
  startBeep(): void;
  stopBeep(): void;
  setVolumeByDistance(d: number | null): void;
  setVolume(v: number): void;         // 0..1
  isPlaying(): boolean;
  release(): void;
}
```

实现要点：`Sound.setCategory('Playback', true)` 使静音键开启时仍出声、不打断其他音频。

### 3.6 screens / hooks（`src/screens/`、`src/hooks/`）

- `useRadarScanner`（组合根 hook）：持有 `BleService`、`DistanceEstimator`、`AudioManager`，
  串联数据流，暴露状态与动作。
- `HomeScreen`：雷达 + 音量指示 + 扫描控制 + 设备列表。
- `DeviceList`：设备列表（名称/RSSI/距离 + 连接/追踪操作）。

---

## 4. 数据流

```
BLE 广播（原生）
  └─▶ BleManagerImpl.startScan 回调
        └─▶ mapPlxDeviceToScannedDevice（归一化）
              └─▶ DistanceEstimator.update（RssiFilter 滤波 → 距离 → 档位）
                    └─▶ devices map（useRadarScanner 状态）
                          ├─▶ nearest（最近设备）→ distanceToVolume → AudioManager.setVolume
                          ├─▶ deviceToDot → RadarView（渲染点）
                          └─▶ DeviceList（列表展示 + 连接/追踪）
```

两条「实时刷新」旁路（针对 iOS 广播不重复上报的限制）：

1. 周期重扫：`SCAN_REFRESH_MS`（4s）stop + start 扫描，刷新未连接设备的 RSSI。
2. 已连接/追踪设备：`CONNECTED_RSSI_POLL_MS`（1s）轮询 `readRssiForDevice`。

设备淘汰：超过 `DEVICE_STALE_MS`（10s）未更新的设备被移除，并清理其 RssiFilter。

---

## 5. RSSI → 距离 → 音量映射算法

### 5.1 距离估算（对数路径损耗模型）

```
d = 10 ^ ((TxPower - RSSI) / (10 * n))
```

| 参数 | 默认 | 说明 |
|------|------|------|
| TxPower | -59 dBm | 距发射源 1m 处的 RSSI |
| n | 2.5 | 路径损耗指数，自由空间 2.0，室内遮挡 2.5 ~ 3.0 |
| RSSI | 负值 | 滤波后的接收信号强度 |

- RSSI ≥ 0 或非有限值 → 距离视为 null（广播缺 rssi 时 plx 会返回 null，归一化后为 0）。
- 距离 clamp 到 `[0.1, 30]` m。

### 5.2 距离档位（用于 UI 上色 + 音量分档兜底）

| 档位 | 距离范围 |
|------|----------|
| immediate | < 0.5m |
| near | 0.5 ~ 2m |
| mid | 2 ~ 8m |
| far | 8 ~ 30m |
| out-of-range | ≥ 30m |
| unknown | 无有效 RSSI |

### 5.3 音量映射（连续，对数空间线性）

```
volume = (log10(max) - log10(d)) / (log10(max) - log10(min))
       = (log10(30) - log10(d)) / (log10(30) - log10(0.1))   （clamp 到 0..1）
```

- 对数空间：近端音量变化细腻、远端平缓，符合人耳距离感知。
- 音量由**所有设备中距离最近者**驱动：`nearest = min(distanceMeters)`，
  `AudioManager.setVolumeByDistance(nearest.distanceMeters)`。
- 无设备 / 距离 null / 未扫描 → 音量 0（静音）。
- 抖动抑制：`RssiFilter`（中值滤波窗口 5 + EMA α=0.35）先平滑 RSSI 再进公式。

---

## 6. 错误处理

| 场景 | 处理 |
|------|------|
| 蓝牙权限被拒 | `requestPermissions()` 返回 false → 抛错，`useRadarScanner` 置 `error` 并提示 |
| 蓝牙关闭 | `onStateChange` 推送 `poweredOff`，UI 显示引导 |
| 蓝牙不支持 | 状态 `unsupported`，UI 显示「本机不支持蓝牙」 |
| 扫描错误 | 回调 `error` 分支记录 warn，不中断扫描 |
| 连接失败/超时 | `connect()` 抛错，hook 捕获并置 `error` |
| RSSI 缺失/非法 | distance 模块返回 null，档位 `unknown`，音量归零 |
| 音频加载失败 | `AudioManager.load()` reject，hook 置 `error`，其余功能不受影响 |
| 原生资源泄漏 | `useRadarScanner` 卸载时调用 `ble.destroy()` + `audio.release()` |

---

## 7. iOS / Android 权限配置

iOS（`app.json` → `ios.infoPlist`）：

- `NSBluetoothAlwaysUsageDescription`：扫描/连接/追踪设备的用途说明。
- `NSBluetoothPeripheralUsageDescription`：维持已连接设备通信的用途说明。
- （`npx expo prebuild` 会把这些写入生成的 Info.plist）

Android（`app.json` → `android.permissions`）：

- `BLUETOOTH`、`BLUETOOTH_ADMIN`（Android < 12）
- `BLUETOOTH_SCAN`、`BLUETOOTH_CONNECT`（Android 12+）
- `ACCESS_FINE_LOCATION`（Android < 12 的 BLE 扫描必需）

---

## 8. 关键设计决策（ADR 摘要）

### ADR-001：距离仅由 RSSI 估算，不做假方向
- 决策：雷达点角度用设备 id 哈希的稳定伪角度，仅避免重叠；UI 明确不标注方向。
- 背景：RSSI 无法测向，做假方向会误导用户。
- 影响：无法实现「箭头指向设备」，但换来诚实、可解释的体验。

### ADR-002：模块化单体，单 App 多模块
- 决策：客户端无分布式收益，不拆服务；用接口边界 + 依赖方向保证可维护与可测。
- 影响：变更局部化，`distance` 与 `radar/radarGeometry` 纯函数可独立单测。

### ADR-003：react-native-sound + newArchEnabled=false
- 决策：沿用指定的 react-native-sound（2020 年后未更新），关闭新架构以最大化旧原生模块稳定性。
- 备选：expo-audio / react-native-audio-api（新架构友好），但非本需求指定。
- 影响：短期稳定；未来若迁移新架构需替换音频库。

### ADR-004：音量用对数空间连续映射 + RSSI 滤波
- 决策：`volume = (log10(max)-log10(d))/(log10(max)-log10(min))`，前置中值+EMA 滤波。
- 影响：音量平滑、近端可感；滤波引入少量延迟（约百毫秒级，可接受）。

### ADR-005：BLE/音频封装为接口，依赖注入
- 决策：`BleService` / `AudioController` 接口 + 工厂/惰性单例，hook 默认注入真实实现。
- 影响：纯逻辑可脱离真机测试；未来可换底层库不改上层。

---

## 9. 测试策略

- 单元测试：`distance` 模块全部纯函数、`RssiFilter`、`DistanceEstimator`（jest-expo，
  见 `src/distance/__tests__/rssiToDistance.test.ts`）。
- 集成/真机：BLE 扫描、连接、音量随距离变化，需真机验证（模拟器不支持 BLE）。
- 验收标准：`npm test` 通过；`npm run typecheck` 通过；真机扫描到设备、音量随距离变化。

---

## 10. 演进方向（非本期）

- 后台 BLE 扫描（iOS `UIBackgroundModes: bluetooth-central`）。
- 越近蜂鸣频率越高（在音量之外叠加 rate 维度）。
- 按服务 UUID 过滤设备类型（如只追踪耳机/手环）。
- 连接后读取电池电量等 GATT 特征值。
