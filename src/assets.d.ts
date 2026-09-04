/**
 * Metro 会把音频资源 require 成一个数字 asset id。
 * 这里声明 TS 模块类型，供 `import beep from '../../assets/beep.wav'` 使用。
 */
declare module '*.wav' {
  const asset: number;
  export default asset;
}

declare module '*.mp3' {
  const asset: number;
  export default asset;
}
