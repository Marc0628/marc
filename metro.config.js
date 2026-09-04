// Expo SDK 52 默认 metro 配置即可满足本项目，无需自定义。
// 保留此文件以便后续需要时扩展（例如 monorepo、额外 asset 扩展名、路径别名）。
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
