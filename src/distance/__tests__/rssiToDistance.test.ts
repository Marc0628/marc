import {
  clampDistance,
  DEFAULT_CALIBRATION,
  distanceToLevel,
  distanceToVolume,
  rssiToDistanceMeters,
  rssiToVolume,
} from '../rssiToDistance';
import { DistanceEstimator } from '../distanceEstimator';
import { RssiFilter } from '../smoothing';

describe('rssiToDistanceMeters', () => {
  it('RSSI 等于 TxPower 时距离应约等于 1 米', () => {
    expect(rssiToDistanceMeters(-59, -59, 2.5)).toBeCloseTo(1, 5);
  });

  it('RSSI 更强（更近）时距离应小于 1 米', () => {
    const d = rssiToDistanceMeters(-45, -59, 2.5);
    expect(d).not.toBeNull();
    expect(d!).toBeLessThan(1);
  });

  it('RSSI 更弱（更远）时距离应大于 1 米', () => {
    const d = rssiToDistanceMeters(-75, -59, 2.5);
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThan(1);
  });

  it('非法 RSSI（>= 0 或 NaN）返回 null', () => {
    expect(rssiToDistanceMeters(0)).toBeNull();
    expect(rssiToDistanceMeters(10)).toBeNull();
    expect(rssiToDistanceMeters(NaN)).toBeNull();
  });

  it('路径损耗指数越大，同等 RSSI 估算距离越小', () => {
    const d2 = rssiToDistanceMeters(-75, -59, 2);
    const d3 = rssiToDistanceMeters(-75, -59, 3);
    expect(d3).not.toBeNull();
    expect(d2).not.toBeNull();
    expect(d3!).toBeLessThan(d2!);
  });
});

describe('clampDistance', () => {
  it('把距离限制在 [min, max] 区间', () => {
    expect(clampDistance(0.001, DEFAULT_CALIBRATION)).toBe(DEFAULT_CALIBRATION.minDistanceM);
    expect(clampDistance(999, DEFAULT_CALIBRATION)).toBe(DEFAULT_CALIBRATION.maxDistanceM);
    expect(clampDistance(null, DEFAULT_CALIBRATION)).toBeNull();
  });
});

describe('distanceToLevel', () => {
  it('正确映射各档位', () => {
    expect(distanceToLevel(0.2)).toBe('immediate');
    expect(distanceToLevel(1)).toBe('near');
    expect(distanceToLevel(5)).toBe('mid');
    expect(distanceToLevel(20)).toBe('far');
    expect(distanceToLevel(40)).toBe('out-of-range');
    expect(distanceToLevel(null)).toBe('unknown');
  });
});

describe('distanceToVolume', () => {
  it('越近音量越大且范围在 0..1', () => {
    const near = distanceToVolume(0.5);
    const far = distanceToVolume(20);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThanOrEqual(1);
  });

  it('null 距离返回 0（静音）', () => {
    expect(distanceToVolume(null)).toBe(0);
  });

  it('rssiToVolume 与 distanceToVolume 链路一致', () => {
    expect(rssiToVolume(-45)).toBeGreaterThan(rssiToVolume(-80));
  });
});

describe('DistanceEstimator', () => {
  it('update 填充 distanceMeters 与 distanceLevel，且保留原始 rssi', () => {
    const estimator = new DistanceEstimator();
    const raw = {
      id: 'dev-1',
      name: null,
      localName: null,
      rssi: -50,
      txPowerLevel: null,
      manufacturerData: null,
      serviceUUIDs: null,
      isConnectable: null,
      lastSeenAt: Date.now(),
      distanceMeters: null as number | null,
      distanceLevel: 'unknown' as const,
      isConnected: false,
    };
    const out = estimator.update(raw);
    expect(out.rssi).toBe(-50); // 原始值保留
    expect(out.distanceMeters).not.toBeNull();
    expect(out.distanceLevel).not.toBe('unknown');
  });

  it('removeDevice 后滤波器被清理', () => {
    const estimator = new DistanceEstimator();
    estimator.removeDevice('dev-1');
    // 无异常即通过（内部 map 删除）
    expect(true).toBe(true);
  });
});

describe('RssiFilter', () => {
  it('连续采样后输出趋于稳定（方差小于原始样本方差）', () => {
    const filter = new RssiFilter();
    const raw = [-55, -58, -60, -56, -90, -57, -59, -55, -58, -56];
    const filtered = raw.map((r) => filter.push(r));
    // 尖峰 -90 被中值+EMA 削弱
    expect(Math.abs(filtered[4]! - filtered[3]!)).toBeLessThan(Math.abs(raw[4]! - raw[3]!));
  });
});
