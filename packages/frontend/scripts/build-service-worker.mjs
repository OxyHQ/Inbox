#!/usr/bin/env bun
import { fileURLToPath } from 'node:url';

// Keep registration as a classic worker; bundle the shared routing table rather
// than requiring module-worker support or an independently cached script import.
const result = await Bun.build({
  entrypoints: [fileURLToPath(new URL('../worker/service-worker.js', import.meta.url))],
  outdir: fileURLToPath(new URL('../public/', import.meta.url)),
  naming: 'sw.js',
  target: 'browser',
  format: 'iife',
});
if (!result.success) throw new AggregateError(result.logs, 'Service worker build failed');
