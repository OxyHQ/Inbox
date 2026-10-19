/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        diagnostics: false,
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          isolatedModules: true,
          target: 'es2020',
          lib: ['es2020', 'dom'],
        },
      },
    ],
    '^.+\\.js$': [
      'ts-jest',
      {
        diagnostics: false,
        tsconfig: {
          allowJs: true,
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          isolatedModules: true,
          target: 'es2020',
        },
      },
    ],
  },
  // htmlparser2 12 and the dom* / entities packages it pulls in ship ESM only
  // ("type": "module"), which jest's CommonJS runtime cannot `require`, and
  // `@alia.onl/sdk` ships raw TypeScript source. Let ts-jest down-compile
  // exactly those packages; everything else in node_modules stays
  // untransformed, as before.
  transformIgnorePatterns: [
    '/node_modules/(?!(htmlparser2|domhandler|domutils|domelementtype|dom-serializer|entities|@alia\\.onl/sdk)/)',
  ],
  testMatch: ['<rootDir>/__tests__/**/*.(test|spec).(ts|tsx)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // `@oxy.so/core`, `@oxy.so/protocol` and `@oxy.so/contracts` are deliberately
    // NOT mapped. In OxyHQServices they pointed at workspace SOURCE, which then
    // forced protocol to be mapped too (core's own imports had to resolve from
    // source, and CI built nothing). Here all three are ordinary published
    // dependencies: jest-resolve honours `exports`, core declares no `browser`
    // condition, so jsdom's `browser` condition does not match and jest's
    // `require` wins → dist/cjs/index.js, plain CJS that ts-jest never needs to
    // see. `main` gives the same answer if a resolver ignores `exports`.
    //
    // Do NOT "fix" a resolution problem here by mapping to
    // `<rootDir>/node_modules/@oxy.so/core/src/index.ts`: that path is INSIDE
    // node_modules, so `transformIgnorePatterns` skips ts-jest and jest chokes
    // on raw TypeScript. The monorepo's mapper worked only because
    // `../core/src/` sat outside node_modules.
    // Native modules the app imports but that cannot load under Node. The
    // `@oxy.so/services` stub also stands in for the SDK's `expo-notifications`
    // adapter, so no `expo-*` module is reachable from a test at all.
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
    '^@oxy.so/services$': '<rootDir>/__mocks__/oxyhq-services.ts',
    // The push adapter ships behind its own entry point. It maps to the SAME
    // stub as the barrel so a test asserting on a notification mock sees the one
    // `jest.fn()` instance whichever specifier the code under test imported.
    '^@oxy.so/services/notifications$': '<rootDir>/__mocks__/oxyhq-services.ts',
    // App code imports the lean `ui/client` / `ui` entries (the root barrel
    // registers every account screen at import, which kept them in web first
    // paint). Same stub, so a test's `jest.mock('@oxy.so/services', ...)` —
    // keyed by the resolved path — still replaces whichever entry the code used.
    '^@oxy.so/services/ui(/client)?$': '<rootDir>/__mocks__/oxyhq-services.ts',
    '^@oxy.so/bloom/tab-bar$': '<rootDir>/__mocks__/bloom-tab-bar.tsx',
    '^@expo/vector-icons(/.*)?$': '<rootDir>/__mocks__/expo-vector-icons.tsx',
  },
  testTimeout: 10000,
};
