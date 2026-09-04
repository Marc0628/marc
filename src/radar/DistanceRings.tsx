import React from 'react';
import { Circle, Text as SvgText } from 'react-native-svg';

import { Theme } from '../theme';
import type { RadarGeometryConfig } from './radarGeometry';

interface Props {
  config: RadarGeometryConfig;
  cx: number;
  cy: number;
}

/** 同心圆距离环 + 距离刻度文字。作为 <Svg> 的子元素使用。 */
export function DistanceRings({ config, cx, cy }: Props) {
  return (
    <>
      {config.ringDistancesM.map((distanceM) => {
        const r = (distanceM / config.maxRadiusM) * config.radarRadiusPx;
        return (
          <React.Fragment key={distanceM}>
            <Circle
              cx={cx}
              cy={cy}
              r={r}
              stroke={Theme.colors.ring}
              strokeWidth={1}
              fill="none"
            />
            <SvgText
              x={cx + r}
              y={cy + 3}
              fontSize={9}
              fill={Theme.colors.ringText}
            >
              {`${distanceM}m`}
            </SvgText>
          </React.Fragment>
        );
      })}
    </>
  );
}
