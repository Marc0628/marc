import React, { useEffect } from 'react';
import { Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { G, Path } from 'react-native-svg';
import Animated from 'react-native-reanimated';

import { Theme } from '../theme';

const AnimatedG = Animated.createAnimatedComponent(G);

interface Props {
  cx: number;
  cy: number;
  r: number;
}

/**
 * 雷达扫动动画：一个 30° 扇形绕圆心匀速旋转。
 * 用 reanimated 驱动 SVG <G> 的 rotation/origin，避免 JS 每帧 setState。
 *
 * TODO(实现说明)：
 * - 若设备性能敏感，可把扇形替换为一条径向扫描线，减少填充面积。
 * - 扫动周期当前 2400ms，可在 config 中参数化。
 */
export function RadarSweep({ cx, cy, r }: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2400, easing: Easing.linear }),
      -1, // 无限循环
      false, // 不往返
    );
  }, [rotation]);

  const animatedProps = useAnimatedProps(() => ({
    rotation: rotation.value,
    originX: cx,
    originY: cy,
  }));

  // 30° 扇形（顶点在圆心，从正上方开始）
  const sweepPath = `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${
    cx + r * Math.sin(Math.PI / 6)
  } ${cy - r * Math.cos(Math.PI / 6)} Z`;

  return (
    <AnimatedG animatedProps={animatedProps}>
      <Path d={sweepPath} fill={Theme.colors.sweep} />
    </AnimatedG>
  );
}
