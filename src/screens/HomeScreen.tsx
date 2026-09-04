import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useRadarScanner } from '../hooks/useRadarScanner';
import { RadarView } from '../radar';
import { Theme } from '../theme';
import { DeviceList } from './DeviceList';

/**
 * 主界面：雷达 + 音量指示 + 扫描控制 + 设备列表。
 * 状态全部来自 useRadarScanner（组合根），本组件只做布局与交互转发。
 *
 * 蓝牙不可用时显示引导文案并禁用「开始扫描」；错误提示可点击关闭。
 */
export function HomeScreen() {
  const scanner = useRadarScanner();
  const { bluetoothState, isScanning, currentVolume, nearest } = scanner;

  const bluetoothReady = bluetoothState === 'poweredOn';
  // 蓝牙不可用时禁用「开始扫描」（若已在扫描中则保留「停止扫描」入口）。
  const startDisabled = !bluetoothReady && !isScanning;

  const bluetoothGuideTitle =
    bluetoothState === 'unsupported' ? '蓝牙不可用' : '蓝牙未开启';
  const bluetoothGuideText =
    bluetoothState === 'unsupported'
      ? '本机不支持蓝牙，无法使用雷达查找功能。'
      : bluetoothState === 'unauthorized'
        ? '蓝牙权限未授权，请在系统设置中允许本应用使用蓝牙。'
        : '请先在系统设置中开启蓝牙，然后返回继续扫描。';

  const nearestText = nearest
    ? `${nearest.name ?? nearest.localName ?? nearest.id.slice(0, 6)} · 约 ${nearest.distanceMeters?.toFixed(1)}m`
    : '暂无目标';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>蓝牙雷达查找器</Text>

      <View style={styles.radarWrap}>
        <RadarView dots={scanner.dots} size={320} />
      </View>

      <View style={styles.statusPanel}>
        <Text style={styles.statusText}>蓝牙：{bluetoothState}</Text>
        <Text style={styles.statusText}>最近设备：{nearestText}</Text>
        <View style={styles.volumeRow}>
          <Text style={styles.statusText}>音量</Text>
          <View style={styles.volumeTrack}>
            <View style={[styles.volumeFill, { width: `${Math.round(currentVolume * 100)}%` }]} />
          </View>
        </View>
      </View>

      {!bluetoothReady ? (
        <View style={styles.bluetoothGuide}>
          <Text style={styles.bluetoothGuideTitle}>{bluetoothGuideTitle}</Text>
          <Text style={styles.bluetoothGuideText}>{bluetoothGuideText}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.scanButton, isScanning && styles.scanButtonActive, startDisabled && styles.scanButtonDisabled]}
        disabled={startDisabled}
        onPress={isScanning ? scanner.stopScan : scanner.startScan}
      >
        <Text style={styles.scanButtonText}>{isScanning ? '停止扫描' : '开始扫描'}</Text>
      </Pressable>

      {scanner.error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{scanner.error}</Text>
          <Pressable onPress={scanner.clearError} hitSlop={10} style={styles.errorClose}>
            <Text style={styles.errorCloseText}>关闭</Text>
          </Pressable>
        </View>
      ) : null}

      <DeviceList
        devices={scanner.devices}
        trackedIds={scanner.trackedIds}
        onConnect={scanner.connect}
        onDisconnect={scanner.disconnect}
        onToggleTrack={scanner.toggleTrack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    color: Theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 12,
  },
  radarWrap: {
    alignItems: 'center',
  },
  statusPanel: {
    backgroundColor: Theme.colors.panel,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  statusText: {
    color: Theme.colors.textDim,
    fontSize: 13,
    marginBottom: 4,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volumeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.radarBg,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent,
  },
  scanButton: {
    marginTop: 12,
    backgroundColor: Theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  scanButtonActive: {
    backgroundColor: Theme.colors.danger,
  },
  scanButtonDisabled: {
    // 蓝牙未就绪时置灰，提示不可点击（不改变布局，仅降透明度）
    opacity: 0.4,
  },
  scanButtonText: {
    color: Theme.colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  bluetoothGuide: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Theme.colors.panel,
    borderLeftWidth: 3,
    // 橙色警示边，与红色错误区分
    borderLeftColor: Theme.colors.dotNear,
  },
  bluetoothGuideTitle: {
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  bluetoothGuideText: {
    color: Theme.colors.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
  errorBanner: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: Theme.colors.panel,
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    color: Theme.colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  errorClose: {
    marginLeft: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  errorCloseText: {
    color: Theme.colors.textDim,
    fontSize: 12,
  },
});
