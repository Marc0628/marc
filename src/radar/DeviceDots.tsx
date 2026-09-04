import React from 'react';
import { Circle, Text as SvgText } from 'react-native-svg';

import type { RadarDot } from '../types';
import { Theme } from '../theme';

interface Props {
  /** 已含像素坐标的点（由 RadarView 计算后传入）。 */
  dots: (RadarDot & { x: number; y: number })[];
  dotRadiusPx: number;
}

/** 设备点 + 已连接设备的标签。作为 <Svg> 的子元素使用。 */
export function DeviceDots({ dots, dotRadiusPx }: Props) {
  return (
    <>
      {dots.map((dot) => (
        <React.Fragment key={dot.deviceId}>
          <Circle cx={dot.x} cy={dot.y} r={dotRadiusPx} fill={dot.color} />
          {/* 已连接设备加一个外圈高亮，便于识别追踪目标 */}
          {dot.isConnected ? (
            <Circle
              cx={dot.x}
              cy={dot.y}
              r={dotRadiusPx + 3}
              stroke={Theme.colors.accent}
              strokeWidth={1.5}
              fill="none"
            />
          ) : null}
          {dot.isConnected ? (
            <SvgText
              x={dot.x + dotRadiusPx + 4}
              y={dot.y - 4}
              fontSize={10}
              fill={Theme.colors.text}
            >
              {dot.label}
            </SvgText>
          ) : null}
        </React.Fragment>
      ))}
    </>
  );
}
