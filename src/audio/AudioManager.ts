import Sound from 'react-native-sound';

import beepAsset from '../../assets/beep.wav';
import { distanceToVolume } from '../distance';

/** 音频控制接口：上层只依赖它，便于测试注入 mock。 */
export interface AudioController {
  /** 加载循环提示音（幂等）。 */
  load(): Promise<void>;
  /** 开始播放循环提示音。 */
  startBeep(): void;
  /** 停止提示音。 */
  stopBeep(): void;
  /** 根据最近设备距离设置音量（0 ~ 1）。 */
  setVolumeByDistance(distanceMeters: number | null): void;
  /** 直接设置音量（0 ~ 1）。 */
  setVolume(volume: number): void;
  /** 是否正在播放。 */
  isPlaying(): boolean;
  /** 释放音频资源。 */
  release(): void;
}

/**
 * 连续提示音实现：加载一段短 beep 并 setNumberOfLoops(-1) 无限循环，
 * 用 setVolume() 实时调音量。音量随「最近设备」的距离变化（由调用方传入）。
 *
 * TODO(实现说明)：
 * - beep 资源由 `node scripts/generate-beep.js` 生成到 assets/beep.wav；
 *   如需换音效，替换该文件即可（保持同名）。
 * - 若将来要做「越近蜂鸣频率越高」，可在 setVolumeByDistance 之外增加
 *   setRateByDistance()，通过 setSpeed() 或按距离定时 start/stop 实现。
 */
export class AudioManager implements AudioController {
  private sound: Sound | null = null;
  /** 标记是否已 release，防止异步加载回调在 release 之后把孤儿 sound 挂回实例。 */
  private released = false;
  /** 记录「待播放」意图：加载完成前就点了开始扫描时，加载完成后自动补播。 */
  private wantPlay = false;

  load(): Promise<void> {
    if (this.sound?.isLoaded()) return Promise.resolve();
    this.released = false;

    return new Promise<void>((resolve, reject) => {
      // Playback 类别：静音键开启时仍能出声（查找器场景需要）；mixWithOthers 不打断其他音频。
      Sound.setCategory('Playback', true);

      const sound = new Sound(beepAsset, (error) => {
        if (error) {
          reject(new Error('提示音加载失败：' + String(error)));
          return;
        }
        // 加载回调是异步的：若期间已 release()（如组件快速卸载），立即释放，避免资源泄漏。
        if (this.released) {
          sound.release();
          return;
        }
        this.sound = sound;
        sound.setNumberOfLoops(-1); // 无限循环
        sound.setVolume(0); // 初始静音，扫描后再按距离调
        // 若加载完成前就已请求播放，则补播，避免本轮扫描完全无声
        if (this.wantPlay) {
          sound.play();
        }
        resolve();
      });
    });
  }

  startBeep(): void {
    this.wantPlay = true;
    if (!this.sound?.isLoaded()) return;
    this.sound.play();
  }

  stopBeep(): void {
    this.wantPlay = false;
    this.sound?.stop();
  }

  setVolumeByDistance(distanceMeters: number | null): void {
    this.setVolume(distanceToVolume(distanceMeters));
  }

  setVolume(volume: number): void {
    if (!this.sound) return;
    const clamped = Math.max(0, Math.min(1, volume));
    this.sound.setVolume(clamped);
  }

  isPlaying(): boolean {
    return this.sound?.isPlaying() ?? false;
  }

  release(): void {
    this.released = true;
    this.sound?.release();
    this.sound = null;
  }
}
