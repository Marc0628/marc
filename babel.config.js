module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated 的 babel 插件必须放在 plugins 数组最后（官方硬性要求）。
      // 若未来升级到 reanimated 4.x，请改为 'react-native-worklets/plugin'。
      'react-native-reanimated/plugin',
    ],
  };
};
