// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  // eslint-plugin-react 7.37 (via eslint-config-expo) detects the React version
  // with `context.getFilename()`, which ESLint 10 removed: left on 'detect',
  // every file crashes the run. Naming the version skips the detection. Keep it
  // in step with the root `overrides` pin of react.
  {
    settings: { react: { version: '19.2' } },
  },
]);
