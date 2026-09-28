import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fetchLatestVersion, findRepositoryRoot, inspectRepository, lockfileVersions } from '@oxy.so/doctor';

// The approved 4.34.1 maintenance release isolates this migration from 4.35.0.
// Reassess and remove this exception when adopting the next Bloom release.
export function isDeferredBloomUpdate(finding, lockedVersions, override) {
  return finding.severity === 'warning'
    && finding.code === 'outdated'
    && finding.package === '@oxy.so/bloom'
    && finding.manifest === 'packages/frontend/package.json'
    && finding.section === 'dependencies'
    && finding.range === '4.34.1'
    && finding.latest === '4.35.0'
    && override === '4.34.1'
    && lockedVersions.length === 1
    && lockedVersions[0] === '4.34.1';
}

async function main() {
  const root = await findRepositoryRoot();
  const report = await inspectRepository(root, fetchLatestVersion);
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const lockfile = await readFile(resolve(root, 'bun.lock'), 'utf8').catch(() => '');
  const versions = [...new Set(lockfileVersions(lockfile, '@oxy.so/bloom'))];
  let failures = 0;
  console.log(`Oxy Doctor: ${report.packages} first-party packages across ${report.manifests} manifests`);
  for (const finding of report.findings) {
    if (isDeferredBloomUpdate(finding, versions, manifest.overrides?.['@oxy.so/bloom'])) {
      console.log(`Deferred: ${finding.message} — approved maintenance pin; see docs/bloom-migration.md`);
    } else {
      console.error(finding.message);
      failures += 1;
    }
  }
  if (report.findings.length === 0) console.log('✓ No dependency-health findings');
  if (failures > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error('Oxy Doctor failed:', error);
    process.exitCode = 2;
  });
}
