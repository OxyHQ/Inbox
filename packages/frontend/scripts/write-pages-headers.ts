#!/usr/bin/env bun
/**
 * Writes the Cloudflare Pages `_headers` file into `public/`, which
 * `expo export` then copies verbatim into `dist/`.
 *
 * The policy is NOT defined here. `buildOxyPagesHeaders` is the single source
 * of truth for the Oxy CSP baseline — the Cloudflare Insights beacon (both the
 * script origin and the reporting origin), api.oxy.so, wss://api.oxy.so and
 * cloud.oxy.so — and it lives in `@oxyhq/core/server`, so this origin cannot
 * drift from every other Oxy document origin. Extensions that are genuinely
 * this app's (worker-src for public/sw.js, img-src blob:/https: for remote mail
 * images) stay declarative in `oxy.pages-headers.json`.
 *
 * In OxyHQServices this step was `bun ../core/scripts/writePagesHeaders.ts
 * public`, reaching across a package boundary into a file @oxyhq/core does not
 * publish (its `files` is ["NOTICE","dist","src"] — `scripts/` is not in it).
 * Same twenty lines, against the published entry point instead. Vendoring
 * `securityHeaders.ts` was rejected: a local copy re-creates exactly the
 * per-app policy drift that module exists to prevent, and the divergence is
 * invisible until someone opens a production console.
 *
 * Paths resolve from THIS FILE rather than from cwd, so
 * `bun packages/frontend/scripts/write-pages-headers.ts` works from the repo
 * root too.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOxyPagesHeaders, type OxyPagesHeadersOptions } from '@oxyhq/core/server';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(projectRoot, process.argv[2] ?? 'public');
const configPath = resolve(projectRoot, 'oxy.pages-headers.json');

const config: OxyPagesHeadersOptions = existsSync(configPath)
  ? (JSON.parse(readFileSync(configPath, 'utf8')) as OxyPagesHeadersOptions)
  : {};

const outputPath = resolve(outputDir, '_headers');
mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, buildOxyPagesHeaders(config), 'utf8');
process.stdout.write(`Wrote ${outputPath}\n`);
