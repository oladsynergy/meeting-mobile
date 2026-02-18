const { getDefaultConfig } = require('expo/metro-config');
const { Path } = require('metro-core');

const config = getDefaultConfig(__dirname);

// Exclude react-native-webrtc on web platform
config.resolver.blockList = [
  /react-native-webrtc/,
];

module.exports = config;
