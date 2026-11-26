#!/usr/bin/env node
/**
 * `tsc --noEmit`, failing on every error except those inside two SDKs' own
 * SOURCE, which this app type-checks only because they ship it.
 *
 * Expo's tsconfig base resolves the `react-native` export condition, and
 * `@oxy.so/services` 14 and `@gemies/sdk` 9 publish raw `.tsx` under it (Gemies
 * ships nothing else), so tsc checks their files like the app's and
 * `skipLibCheck` does not cover them. Both still hand `className` to Bloom
 * components, a prop Bloom 23 removed (Bloom `docs/no-nativewind.mdx`), so
 * their own sources fail to type-check against the Bloom this app installs.
 * Inbox cannot change those files; the errors are theirs, not this app's.
 *
 * Anything else fails the check exactly as plain tsc would, including an
 * Inbox call into either SDK with the wrong types. Remove this script (and
 * point `typecheck` back at `tsc --noEmit`) once the app is on `@oxy.so/services`
 * 15 and a Gemies SDK built for it, which pass no `className`
 * (docs/dependencies.md).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const SDK_SOURCES = [
  /(^|\/)node_modules\/@oxy\.so\/services\/src\//,
  /(^|\/)node_modules\/@gemies\/sdk\/src\//,
];

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const run = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false'], {
  encoding: 'utf8',
});
if (run.error) throw run.error;

const output = `${run.stdout}${run.stderr}`;
// tsc prints each diagnostic as `file(line,col): error TSnnnn: …`, with any
// continuation lines indented beneath it.
const diagnostics = output.split(/\n(?=\S)/).filter((entry) => entry.trim() !== '');
const ignored = diagnostics.filter((entry) =>
  SDK_SOURCES.some((source) => source.test(entry.split('(')[0])),
);
const failing = diagnostics.filter((entry) => !ignored.includes(entry));

if (failing.length > 0) process.stdout.write(`${failing.join('\n')}\n`);
if (ignored.length > 0) {
  console.log(
    `typecheck: ${ignored.length} error(s) inside @oxy.so/services or @gemies/sdk source ignored (see scripts/typecheck.mjs)`,
  );
}
if (failing.length > 0 || (run.status !== 0 && diagnostics.length === 0)) {
  console.error(`typecheck: ${failing.length} error(s)`);
  process.exit(run.status || 1);
}
console.log('typecheck: 0 errors in the app');
