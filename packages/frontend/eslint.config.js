// Minimal ESLint: only rules Biome (root `biome.json`) cannot check. Biome owns
// formatting and every other lint rule; `bun run lint` at the root runs both.
//
// - eslint-plugin-expo: `no-env-var-destructuring` / `no-dynamic-env-var` catch
//   `process.env.EXPO_PUBLIC_*` reads that Metro silently fails to inline (the
//   bundle ships `undefined`, nothing errors). `use-dom-exports` guards
//   'use dom' components.
// - eslint-plugin-react-hooks: the React Compiler rules (refs, purity,
//   set-state-in-effect, immutability, ...). Biome has no equivalent.
//   `rules-of-hooks` and `exhaustive-deps` are left to Biome's
//   `useHookAtTopLevel` and `useExhaustiveDependencies`.
const { defineConfig } = require('eslint/config');
const tsParser = require('@typescript-eslint/parser');
const expo = require('eslint-plugin-expo');
const reactHooks = require('eslint-plugin-react-hooks');

const {
  'react-hooks/rules-of-hooks': _rulesOfHooks,
  'react-hooks/exhaustive-deps': _exhaustiveDeps,
  ...reactCompilerRules
} = reactHooks.configs.recommended.rules;

module.exports = defineConfig([
  {
    ignores: ['dist/*', 'android/*', '.expo/*'],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { expo, 'react-hooks': reactHooks },
    rules: {
      'expo/use-dom-exports': 'error',
      'expo/no-env-var-destructuring': 'error',
      'expo/no-dynamic-env-var': 'error',
      ...reactCompilerRules,
    },
  },
]);
