import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fetchLatestVersion, findRepositoryRoot, inspectRepository } from '@oxy.so/doctor';

async function main() {
  const root = await findRepositoryRoot();
  const report = await inspectRepository(root, fetchLatestVersion);
  let failures = 0;
  console.log(`Oxy Doctor: ${report.packages} first-party packages across ${report.manifests} manifests`);
  for (const finding of report.findings) {
    console.error(finding.message);
    failures += 1;
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
