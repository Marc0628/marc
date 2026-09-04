import type { DistanceLevel } from '../types';
import { Theme } from '../theme';

/** 距离档位 → 点颜色。越近越暖（红/橙），越远越冷（绿/灰）。 */
export function colorForLevel(level: DistanceLevel): string {
  switch (level) {
    case 'immediate':
      return Theme.colors.dotImmediate;
    case 'near':
      return Theme.colors.dotNear;
    case 'mid':
      return Theme.colors.dotMid;
    case 'far':
      return Theme.colors.dotFar;
    case 'out-of-range':
    case 'unknown':
    default:
      return Theme.colors.dotOutOfRange;
  }
}
