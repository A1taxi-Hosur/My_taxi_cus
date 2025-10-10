const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure TypeScript file extensions
config.resolver.sourceExts.push('ts', 'tsx');

// Configure platform extensions
config.resolver.platforms = ['web', 'ios', 'android', 'native'];

module.exports = config;