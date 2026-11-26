const { createOxyMetroConfig } = require('@oxy.so/app-preset/metro');
const { withBloomLanguage } = require('@oxy.so/bloom-language-compiler/metro');

// The Bloom language compiler (`@oxy.so/bloom-language-compiler`): a pre-pass in
// front of the preset's transform worker (react-native-css's, which wraps
// Expo's), on every platform including the web export, so the Babel config
// stays the preset's. It checks every chain against the language spec, hoists
// static chains and marks `view()` bodies `"use memo"`. Modules that never
// import `@oxy.so/bloom-language` pass through unchanged.
module.exports = withBloomLanguage(
  createOxyMetroConfig(__dirname, { staticHydrationBoundary: true }),
);
