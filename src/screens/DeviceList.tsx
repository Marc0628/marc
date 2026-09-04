import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ScannedDevice } from '../types';
import { Theme } from '../theme';
import { colorForLevel } from '../radar';

interface Props {
  devices: ScannedDevice[];
  trackedIds: string[];
  onConnect: (deviceId: string) => void;
  onDisconnect: (deviceId: string) => void;
  onToggleTrack: (deviceId: string) => void;
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

function label(device: ScannedDevice): string {
  return device.name ?? device.localName ?? shortId(device.id);
}

/** 设备列表：显示名称、RSSI、估算距离，并提供连接/追踪操作。 */
export function DeviceList({ devices, trackedIds, onConnect, onDisconnect, onToggleTrack }: Props) {
  if (devices.length === 0) {
    return <Text style={styles.empty}>暂无设备，点击「开始扫描」</Text>;
  }

  return (
    <FlatList
      style={styles.list}
      data={devices}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const tracked = trackedIds.includes(item.id);
        const distance = item.distanceMeters != null ? `${item.distanceMeters.toFixed(1)}m` : '--';
        return (
          <View style={styles.row}>
            <View style={[styles.badge, { backgroundColor: colorForLevel(item.distanceLevel) }]} />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {label(item)}
              </Text>
              <Text style={styles.meta}>
                RSSI {item.rssi} dBm · 约 {distance}
                {tracked ? ' · 追踪中' : ''}
              </Text>
            </View>
            <Pressable
              style={[styles.button, tracked && styles.buttonActive]}
              onPress={() => onToggleTrack(item.id)}
            >
              <Text style={styles.buttonText}>{tracked ? '取消追踪' : '追踪'}</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => (item.isConnected ? onDisconnect(item.id) : onConnect(item.id))}
            >
              <Text style={styles.buttonText}>{item.isConnected ? '断开' : '连接'}</Text>
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    color: Theme.colors.textDim,
    textAlign: 'center',
    padding: 16,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.ring,
  },
  badge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  name: {
    color: Theme.colors.text,
    fontSize: 15,
  },
  meta: {
    color: Theme.colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  button: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.colors.ring,
  },
  buttonActive: {
    borderColor: Theme.colors.accent,
  },
  buttonText: {
    color: Theme.colors.text,
    fontSize: 12,
  },
});
