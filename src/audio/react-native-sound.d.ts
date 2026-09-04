/**
 * react-native-sound（0.11.2）无官方 TypeScript 类型；
 * 社区 @types/react-native-sound 自 2020 年起未维护，与 RN 0.76 存在偏差。
 * 这里按本项目实际用到的 API 面做最小声明，保证类型安全。
 */
declare module 'react-native-sound' {
  export type AudioCategory =
    | 'Ambient'
    | 'SoloAmbient'
    | 'Playback'
    | 'Record'
    | 'PlayAndRecord'
    | 'AudioProcessing'
    | 'MultiRoute';

  export default class Sound {
    static MAIN_BUNDLE: string;
    static DOCUMENT: string;
    static LIBRARY: string;
    static CACHES: string;

    /** 设置音频会话类别（如 'Playback' 可在静音键开启时仍出声）。 */
    static setCategory(category: AudioCategory, mixWithOthers?: boolean): void;
    static setMode(mode: string): void;
    static setActive(active: boolean): void;

    constructor(fileName: string | number, callback?: (error: any) => void);
    constructor(fileName: string | number, basePath?: string, callback?: (error: any) => void);

    isLoaded(): boolean;
    /** 是否正在播放。 */
    isPlaying(): boolean;
    play(onEnd?: (success: boolean) => void): void;
    pause(callback?: () => void): void;
    stop(callback?: () => void): void;
    release(): void;

    /** 设置音量，0 ~ 1。 */
    setVolume(volume: number): void;
    getVolume(): number;
    /** -1 表示无限循环。 */
    setNumberOfLoops(count: number): void;
    setCategory(category: AudioCategory, mixWithOthers?: boolean): void;
    setPan(pan: number): void;
    setSpeed(speed: number): void;

    getDuration(): number;
    getCurrentTime(callback: (seconds: number, isPlaying: boolean) => void): void;
    setCurrentTime(seconds: number): void;
  }
}
