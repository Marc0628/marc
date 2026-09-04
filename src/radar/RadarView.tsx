import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import type { RadarDot } from '../types';
import { Theme } from '../theme';
import { DeviceDots } from './DeviceDots';
import { DistanceRings } from './DistanceRings';
import { RadarSweep } from './RadarSweep';
import { DEFAULT_RADAR_CONFIG, polarToCartesian, type RadarGeometryConfig } from './radarGeometry';

interface Props {
  dots: RadarDot[];
  /** 外框边长（px）。雷达绘制半径 = size/2 - 边缘留白。 */
  size?: number;
  config?: Partial<RadarGeometryConfig>;
}

/**
 * 雷达组件：同心环 + 扫动动画 + 设备点。
 * 只做「渲染」，设备状态由 useRadarScanner 计算后传入，保持无副作用、易复用。
 *
 * 注意：不做假方向 —— 设备点按稳定伪角度排布，纯为可读性，不代表方位。
 */
export function RadarView({ dots, size = 320, config }: Props) {
  const merged: RadarGeometryConfig = useMemo(
    () => ({ ...DEFAULT_RADAR_CONFIG, ...config }),
    [config],
  );

  const cx = size / 2;
  const cy = size / 2;

  // 把归一化距离 + 伪角度换算为像素坐标
  const positioned = useMemo(
    () =>
      dots.map((dot) => {
        const { x, y } = polarToCartesian(cx, cy, dot.r * merged.radarRadiusPx, dot.angleDeg);
        return { ...dot, x, y };
      }),
    [dots, cx, cy, merged.radarRadiusPx],
  );

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* 背景圆 */}
        <Circle cx={cx} cy={cy} r={merged.radarRadiusPx} fill={Theme.colors.radarBg} />
        <Circle
          cx={cx}
          cy={cy}
          r={merged.radarRadiusPx}
          stroke={Theme.colors.crosshair}
          strokeWidth={1}
          fill="none"
        />
        {/* 十字准线 */}
        <Line x1={cx} y1={cy - merged.radarRadiusPx} x2={cx} y2={cy + merged.radarRadiusPx} stroke={Theme.colors.crosshair} strokeWidth={0.5} />
        <Line x1={cx - merged.radarRadiusPx} y1={cy} x2={cx + merged.radarRadiusPx} y2={cy} stroke={Theme.colors.crosshair} strokeWidth={0.5} />

        <DistanceRings config={merged} cx={cx} cy={cy} />
        <RadarSweep cx={cx} cy={cy} r={merged.radarRadiusPx} />
        <DeviceDots dots={positioned} dotRadiusPx={merged.dotRadiusPx} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
