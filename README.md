# FindBlueteeth Tool

手机蓝牙雷达查找器：扫描附近蓝牙设备，以雷达形式呈现，越靠近提示音越大，支持连接与多设备追踪。

> 目标平台：iPhone 16 Pro Max（iOS），代码同时兼容 Android。
> 技术栈：React Native + Expo（dev build）+ TypeScript + react-native-ble-plx +
> react-native-svg + react-native-reanimated + react-native-sound。

## 功能说明

1. **扫描蓝牙设备**：扫描附近 BLE 设备，显示名称、RSSI（信号强度）与估算距离。
2. **雷达呈现**：扫动动画 + 同心圆距离环 + 设备点，设备越近越靠圆心。
   雷达只呈现距离，不做假方向（RSSI 无法测向，见「已知限制」）。
3. **越近越响**：连续提示音，音量随「最近设备」的距离实时变化，越近越大。
4. **连接与多设备追踪**：可连接设备，同时追踪多个设备，上限 8 个（`MAX_TRACKED_DEVICES`）。

## 技术栈

| 层 | 选型 | 版本 |
|----|------|------|
| 框架 | Expo SDK | ~52.0.0 |
| 运行时 | React Native | 0.76.6（`newArchEnabled: false`） |
| 语言 | TypeScript（strict） | ~5.3.3 |
| 蓝牙 | react-native-ble-plx | 3.5.1 |
| 雷达 UI | react-native-svg / react-native-reanimated | 15.8.0 / ~3.16.1 |
| 提示音 | react-native-sound | 0.11.2 |
| 测试 | jest + jest-expo | ^29.7.0 / ~52.0.0 |

## 目录结构

```
docs/architecture.md        架构设计文档（必读）
App.tsx                     入口
src/types.ts                全局领域类型（ScannedDevice / DistanceLevel / RadarDot）
src/config.ts               扫描策略与追踪参数（含 8 台追踪上限）
src/theme.ts                全局配色
src/ble/                    BLE 服务（BleService 接口 + react-native-ble-plx 实现）
src/distance/               距离估算（纯函数，可单测）
src/radar/                  雷达 UI（几何纯函数 + svg/reanimated 渲染）
src/audio/                  提示音（react-native-sound 封装 + 类型声明）
src/hooks/                  useRadarScanner 组合根
src/screens/                界面（HomeScreen / DeviceList）
scripts/generate-beep.js    生成提示音资源
assets/beep.wav             提示音资源（已生成，可重新生成）
docs/build-distribution.md  构建与分发说明（TestFlight / Ad Hoc）
```

## 前置要求

- Node.js >= 18（`package.json` 的 `engines` 已声明）
- iOS 构建需要 macOS + Xcode，或使用 EAS 云构建（无需本地 Mac）
- 由于依赖原生蓝牙模块，**Expo Go 无法运行本项目**，必须使用 dev build / prebuild

## 快速开始（Mac 本地）

```bash
# 1. 安装依赖
npm install

# 2. 生成提示音资源（纯 Node，无网络；仓库已含 beep.wav，可跳过或重新生成）
npm run generate-beep

# 3. 生成原生工程并安装 Pods
npx expo prebuild
npx pod-install

# 4. 类型检查 + 纯逻辑单测
npm run typecheck
npm test

# 5. 运行到真机（蓝牙必须真机调试，模拟器不支持 BLE）
npx expo run:ios --device
```

## 在 Windows 上构建（EAS 云构建）

Windows 无法本地构建 iOS，改用 Expo EAS 云构建。需要 Expo 账号（iOS 构建还需
Apple 开发者账号以完成签名与设备注册）。

```bash
npm install
npm run generate-beep

# 安装 EAS CLI 并登录（需 Expo 账号）
npm i -g eas-cli
eas login

# 构建 dev client（开发调试用，distribution: internal）
eas build --profile development --platform ios

# 构建正式包（App Store / TestFlight 用）
eas build --profile production --platform ios
```

- `development`：生成带 expo-dev-client 的调试包，装到真机后用 `npx expo start --dev-client` 联调。
- `production`：生成 App Store 分发包，配合 `eas submit --platform ios` 上传。
- 构建与分发、TestFlight / Ad Hoc 的完整步骤见 [docs/build-distribution.md](docs/build-distribution.md)。

## 分发到 iPhone

两种主流方式，都需要 Apple 开发者账号（$99/年）。

| 方式 | 适用 | 是否需要上架/审核 |
|------|------|------------------|
| TestFlight | 正式内测/公测，可最终上架 App Store | 外部测试员需 Beta App Review |
| Ad Hoc | 小范围真机验证，直接装 ipa | 不需要，但每账号每年限 100 台设备 |

**TestFlight 要点**：

1. 在 App Store Connect 创建 App，Bundle ID 用 `com.findblueteeth.tool`（与 `app.json` 一致）。
2. `eas build --profile production --platform ios` 生成正式包。
3. `eas submit --platform ios` 上传到 App Store Connect。
4. 在 TestFlight 添加测试人员：内部测试员（≤100 人，无需审核）或外部测试员（需 Beta App Review）。
5. 测试人员在 iPhone 装 TestFlight App，通过邀请链接/兑换码安装。

**Ad Hoc 要点**：

1. 收集测试机 UDID 并注册到开发者后台（或用 `eas device:create` 自动注册）。
2. `eas build --profile preview --platform ios` 生成 Ad Hoc 包（`distribution: internal`）。
3. 构建完成后用 EAS 提供的安装链接/二维码分发；测试机 UDID 必须已注册才能安装。
4. 也可导出 .ipa 走 Diawi 或自建分发页。

## 权限说明

- **iOS**：权限文案已在 `app.json` 的 `ios.infoPlist` 配置
  （`NSBluetoothAlwaysUsageDescription` / `NSBluetoothPeripheralUsageDescription`）。
  扫描时系统自动弹窗；`npx expo prebuild` 会将其写入 Info.plist。
- **Android**：清单权限已在 `app.json` 的 `android.permissions` 声明；运行时由
  `src/ble/BleManagerImpl.ts` 的 `requestAndroidPermissions()` 按 API 级别请求：
  - Android 12+（API 31+）：`BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT`
  - Android < 12：`BLUETOOTH` / `BLUETOOTH_ADMIN` / `ACCESS_FINE_LOCATION`

## 已知限制（重要）

1. **必须安装 App，无法「扫码即用」**：iPhone 的 Safari / Chrome 均不支持
   Web Bluetooth，本项目是原生 App，只能通过 TestFlight / Ad Hoc 安装到 iPhone，
   不能像 Web 页面一样扫码打开即用。
2. **只能测距，测不了方向**：RSSI 只能估算距离、不能判断方位。雷达上设备点的
   角度是「稳定伪角度」（由设备 id 哈希生成，仅用于避免多个点重叠），
   **不代表真实方位**，UI 上也不标注方向。
3. **距离仅供参考**：RSSI 测距受多径效应、遮挡、人体吸收等因素影响，误差较大。
   实际距离建议按经验校准：修改 `src/distance/rssiToDistance.ts` 中
   `DEFAULT_CALIBRATION` 的 `txPowerAt1m`（1m 处参考 RSSI，默认 -59）与
   `pathLossExponent`（路径损耗指数，默认 2.5，室内遮挡可取 2.5~3.0）。
4. **iOS 广播不重复上报**：CoreBluetooth 在不指定服务 UUID 时不重复回调同一设备，
   因此通过周期重扫（`SCAN_REFRESH_MS = 4s`）与已连接设备 RSSI 轮询
   （`CONNECTED_RSSI_POLL_MS = 1s`）来持续更新距离；超过 `DEVICE_STALE_MS = 10s`
   未更新的设备会被淘汰。
5. **newArchEnabled = false**：`react-native-sound`（2020 年后未更新）在旧架构
   原生模块上最稳定；ble-plx / svg / reanimated 均同时支持新旧架构。若未来迁移
   新架构，需评估替换 react-native-sound（如 expo-audio）。
6. **react-native-sound 类型**：无官方类型，社区 @types 已过时，本项目在
   `src/audio/react-native-sound.d.ts` 提供最小类型声明。

## 如何测试

### 单元测试与类型检查（无需真机、无需网络）

```bash
# 纯逻辑单测：距离算法 / 中值+EMA 滤波 / DistanceEstimator
npm test

# 类型检查
npm run typecheck
```

### 真机功能验证清单

安装后按以下清单逐项验证：

1. **扫描**：点击「开始扫描」，允许蓝牙权限，观察雷达出现设备点、提示音响起，
   列表显示名称 / RSSI / 估算距离。
2. **音量随距离变化**：靠近 / 远离一个蓝牙设备（如手环、耳机），提示音应随之
   变大 / 变小，雷达点朝圆心（靠近）/ 边缘（远离）移动，音量条随之增减。
3. **连接**：点击设备「连接」，成功后设备标记为已连接；再次点击可断开。
4. **追踪 8 台上限**：依次「追踪」设备，追踪到第 8 台后再追踪第 9 台，
   应出现错误提示「最多同时追踪 8 个设备」，且不再新增追踪。
5. **蓝牙关闭引导**：扫描过程中关闭手机蓝牙，界面应显示「蓝牙未开启」引导，
   「开始扫描」按钮置灰；重新开启蓝牙后引导消失、可继续扫描。
6. **权限拒绝提示**：在系统设置中拒绝蓝牙权限后点「开始扫描」，应显示权限被拒
   的提示（iOS 显示「蓝牙权限未授权」引导，Android 显示「蓝牙权限被拒绝」错误），
   并按提示去设置开启后重试。

## 约定

- 模块依赖方向：`screens → hooks → ble/distance/radar/audio → types`。
  `distance`、`radar/radarGeometry` 为纯函数，不得 import 原生模块或 UI。
- 上层不得直接 `import 'react-native-ble-plx'`，只能依赖 `src/ble` 暴露的 `BleService` 接口。
- 所有跨模块数据用 `src/types.ts` 中的类型；新增字段先更新 `docs/architecture.md`。
- 提交信息遵循 Conventional Commits（`feat:` / `fix:` / `docs:` / `refactor:`）。
