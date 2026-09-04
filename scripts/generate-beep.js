/**
 * 生成 assets/beep.wav —— 一段短促的提示音（纯 Node，无任何依赖）。
 * 用法：node scripts/generate-beep.js
 *
 * 参数：正弦波 + 淡入淡出包络，避免爆音；循环播放时形成「滴、滴、滴」效果。
 * 如需更换音效，直接用同名文件替换 assets/beep.wav 即可。
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050; // Hz
const TONE_FREQ = 880; // 提示音频率（Hz）
const TONE_SEC = 0.18; // 音长
const GAP_SEC = 0.32; // 音间隔（静音）
const AMPLITUDE = 0.5; // 幅度 0..1

function generateWav() {
  const toneSamples = Math.floor(SAMPLE_RATE * TONE_SEC);
  const gapSamples = Math.floor(SAMPLE_RATE * GAP_SEC);
  const totalSamples = toneSamples + gapSamples;
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = totalSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF 头
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  // fmt 子块
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM 子块大小
  buffer.writeUInt16LE(1, 20); // PCM 格式
  buffer.writeUInt16LE(1, 22); // 单声道
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28); // 字节率
  buffer.writeUInt16LE(bytesPerSample, 32); // 块对齐
  buffer.writeUInt16LE(16, 34); // 位深
  // data 子块
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const fadeSamples = Math.floor(SAMPLE_RATE * 0.005); // 5ms 淡入淡出
  for (let i = 0; i < totalSamples; i++) {
    let sample = 0;
    if (i < toneSamples) {
      const t = i / SAMPLE_RATE;
      const envIn = Math.min(1, i / fadeSamples);
      const envOut = Math.min(1, (toneSamples - i) / fadeSamples);
      const env = Math.max(0, Math.min(envIn, envOut));
      sample = AMPLITUDE * Math.sin(2 * Math.PI * TONE_FREQ * t) * env;
    }
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'beep.wav');
fs.writeFileSync(outFile, generateWav());
console.log('已生成 ' + outFile);
