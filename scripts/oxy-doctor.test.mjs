import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeferredBloomUpdate } from './oxy-doctor.mjs';

const approved = {
  severity: 'warning', code: 'outdated', package: '@oxy.so/bloom',
  manifest: 'packages/frontend/package.json', section: 'dependencies',
  range: '4.34.1', latest: '4.35.0',
};

test('only the approved maintenance update is deferred', () => {
  assert.equal(isDeferredBloomUpdate(approved, ['4.34.1'], '4.34.1'), true);
  for (const change of [
    { severity: 'error' }, { code: 'duplicate-version' },
    { package: '@oxy.so/services' }, { latest: '4.35.1' },
    { manifest: 'another/package.json' }, { section: 'peerDependencies' },
    { range: '^4.34.1' },
  ]) {
    assert.equal(isDeferredBloomUpdate({ ...approved, ...change }, ['4.34.1'], '4.34.1'), false);
  }
});

test('missing, drifting or duplicate locked versions and overrides fail closed', () => {
  for (const versions of [[], ['4.34.0'], ['4.34.1', '4.35.0']]) {
    assert.equal(isDeferredBloomUpdate(approved, versions, '4.34.1'), false);
  }
  for (const override of [undefined, '^4.34.1', '4.35.0']) {
    assert.equal(isDeferredBloomUpdate(approved, ['4.34.1'], override), false);
  }
});
