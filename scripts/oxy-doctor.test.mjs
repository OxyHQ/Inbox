import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeferredBloomUpdate } from './oxy-doctor.mjs';

const approved = {
  severity: 'warning', code: 'outdated', package: '@oxy.so/bloom',
  manifest: 'packages/frontend/package.json', section: 'dependencies',
  range: '4.34.3', latest: '4.35.0',
};

test('only the approved maintenance update is deferred', () => {
  assert.equal(isDeferredBloomUpdate(approved, ['4.34.3'], '4.34.3'), true);
  for (const change of [
    { severity: 'error' }, { code: 'duplicate-version' },
    { package: '@oxy.so/services' }, { latest: '4.35.1' },
    { manifest: 'another/package.json' }, { section: 'peerDependencies' },
    { range: '^4.34.3' },
  ]) {
    assert.equal(isDeferredBloomUpdate({ ...approved, ...change }, ['4.34.3'], '4.34.3'), false);
  }
});

test('missing, drifting or duplicate locked versions and overrides fail closed', () => {
  for (const versions of [[], ['4.34.0'], ['4.34.3', '4.35.0']]) {
    assert.equal(isDeferredBloomUpdate(approved, versions, '4.34.3'), false);
  }
  for (const override of [undefined, '^4.34.3', '4.35.0']) {
    assert.equal(isDeferredBloomUpdate(approved, ['4.34.3'], override), false);
  }
});
