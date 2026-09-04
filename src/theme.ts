/** 全局配色。雷达与音量条统一从这里取色，避免魔法值散落。 */
export const Theme = {
  colors: {
    background: '#0B0F1A',
    panel: '#141A2A',
    radarBg: '#0D1220',
    ring: 'rgba(64, 220, 160, 0.18)',
    ringText: 'rgba(138, 148, 166, 0.9)',
    sweep: 'rgba(64, 220, 160, 0.22)',
    crosshair: 'rgba(64, 220, 160, 0.35)',
    text: '#E6EDF3',
    textDim: '#8A94A6',
    accent: '#40DCA0',
    danger: '#FF4D4D',
    // 距离档位 → 点颜色（越近越暖、越远越冷）
    dotImmediate: '#FF4D4D',
    dotNear: '#FFA726',
    dotMid: '#FFD54F',
    dotFar: '#40DCA0',
    dotOutOfRange: '#4A5568',
    dotUnknown: '#4A5568',
  },
} as const;
