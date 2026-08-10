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
  },
  testMatch: ['<rootDir>/__tests__/**/*.(test|spec).(ts|tsx)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // `@oxyhq/core`, `@oxyhq/protocol` and `@oxyhq/contracts` are deliberately
    // NOT mapped. In OxyHQServices they pointed at workspace SOURCE, which then
    // forced protocol to be mapped too (core's own imports had to resolve from
    // source, and CI built nothing). Here all three are ordinary published
    // dependencies: jest-resolve honours `exports`, core declares no `browser`
    // condition, so jsdom's `browser` condition does not match and jest's
    // `require` wins → dist/cjs/index.js, plain CJS that ts-jest never needs to
    // see. `main` gives the same answer if a resolver ignores `exports`.
    //
    // Do NOT "fix" a resolution problem here by mapping to
    // `<rootDir>/node_modules/@oxyhq/core/src/index.ts`: that path is INSIDE
    // node_modules, so `transformIgnorePatterns` skips ts-jest and jest chokes
    // on raw TypeScript. The monorepo's mapper worked only because
    // `../core/src/` sat outside node_modules.
    // Native modules the app imports but that cannot load under Node. The
    // `@oxyhq/services` stub also stands in for the SDK's `expo-notifications`
    // adapter, so no `expo-*` module is reachable from a test at all.
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
    '^@oxyhq/services$': '<rootDir>/__mocks__/oxyhq-services.ts',
    // The push adapter ships behind its own entry point. It maps to the SAME
    // stub as the barrel so a test asserting on a notification mock sees the one
    // `jest.fn()` instance whichever specifier the code under test imported.
    '^@oxyhq/services/notifications$': '<rootDir>/__mocks__/oxyhq-services.ts',
    '^@expo/vector-icons(/.*)?$': '<rootDir>/__mocks__/expo-vector-icons.tsx',
  },
  testTimeout: 10000,
};
