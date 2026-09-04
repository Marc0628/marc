# 构建与分发说明（iOS）

本文档说明如何把 FindBlueteeth Tool 构建并分发到 iPhone。目标平台为 iPhone 16 Pro Max，
Bundle ID 为 `com.findblueteeth.tool`（与 `app.json` 一致）。

> 前置：iOS 构建必须签名，因此无论本地还是云构建，都需要 Apple Developer 账号
> （$99/年）。仅 `eas login`（Expo 账号）不足以完成 iOS 签名。

## 1. 构建类型速览

`eas.json` 定义了三个 profile：

| Profile | `distribution` | 产物 | 用途 |
|---------|----------------|------|------|
| `development` | internal | dev client（含 expo-dev-client） | 开发调试，配合 `npx expo start --dev-client` |
| `preview` | internal | Ad Hoc ipa | 内测，直接装到已注册设备 |
| `production` | 默认（App Store） | App Store archive | TestFlight / 上架 |

> 说明：iOS 的 `distribution: internal` 本质上就是 Ad Hoc 类型——安装设备必须
> 注册到构建所用的 Provisioning Profile 中，否则无法安装。

## 2. 一次性准备

1. 注册并登录 EAS CLI：

   ```bash
   npm i -g eas-cli
   eas login
   ```

2. 配置 Apple 账号（首次构建时 EAS 会引导，或运行 `eas credentials`）：

   ```bash
   eas credentials
   ```

   选择 iOS，按提示登录 Apple Developer 账号。EAS 可代为管理证书与 Provisioning
   Profile（推荐），也可使用已有证书。

3. 在 Apple Developer 后台 / App Store Connect 创建 App（仅 TestFlight / 上架需要），
   Bundle ID 填 `com.findblueteeth.tool`。

## 3. 构建 dev client（开发调试）

```bash
eas build --profile development --platform ios
```

构建完成后，把 dev client 安装到 iPhone，再在项目目录运行：

```bash
npx expo start --dev-client
```

用 iPhone 上的 dev client 扫描终端二维码即可联调（改动实时热更新）。

## 4. TestFlight 分发（正式内测 / 公测）

步骤：

1. **建包**：生成 App Store 分发包。

   ```bash
   eas build --profile production --platform ios
   ```

2. **上传**：上传到 App Store Connect。

   ```bash
   eas submit --platform ios
   ```

   （也可手动用 Xcode Organizer 或 Transporter 上传生成的 archive。）

3. **TestFlight 添加测试人员**（App Store Connect → 你的 App → TestFlight）：
   - **内部测试员**：最多 100 人，上传构建后即可测，无需审核。
   - **外部测试员**：首次提交需通过 TestFlight 的 Beta App Review，通过后可用
     公开链接或邮件邀请，最多 10,000 人。

4. **测试人员安装**：iPhone 安装 TestFlight App，打开邀请链接或输入兑换码安装。

## 5. Ad Hoc 内测（不上架，直接装 ipa）

适用于小范围真机验证，不走 TestFlight / App Store。

限制：每个 Apple 开发者账号每年最多注册 100 台测试设备（按 UDID）。

步骤：

1. **注册测试设备**：在测试机浏览器打开项目，运行以下命令（需先安装 dev client 或
   使用 expo-dev-client 的注册页）：

   ```bash
   eas device:create
   ```

   或用 `eas device:add` 手动输入设备 UDID（UDID 可通过 Xcode / Finder / 第三方工具获取）。

2. **构建 Ad Hoc 包**：

   ```bash
   eas build --profile preview --platform ios
   ```

3. **分发**：构建完成后，EAS 会生成安装链接与二维码。测试机点开链接即可安装
   （前提：该设备 UDID 已注册进构建的 Provisioning Profile）。
   也可下载 .ipa 后通过 Diawi、自建分发页或企业网盘分发。

## 6. 常见问题

- **「设备未注册」安装失败**：Ad Hoc / internal 包要求设备 UDID 在 Provisioning
  Profile 中。先 `eas device:create` 注册设备，再重新构建。
- **签名失败 / 证书缺失**：运行 `eas credentials` 检查并重新配置 Apple 账号。
- **`eas build` 需要 Apple 账号**：iOS 构建必须签名，仅有 Expo 账号不够，需绑定
  Apple Developer 账号。
- **想改 Bundle ID**：同步修改 `app.json` 的 `ios.bundleIdentifier` 与
  `android.package`，并在 Apple 后台创建对应 App ID。

## 7. 参考

- 架构与模块说明：[architecture.md](architecture.md)
- README：[../README.md](../README.md)
