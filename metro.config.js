// Metro config — add CSV to asset extensions for replay files
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow bundling .csv files as assets
config.resolver.assetExts.push('csv');

module.exports = config;
