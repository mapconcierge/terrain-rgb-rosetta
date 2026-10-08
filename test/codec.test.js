import test from 'node:test';
import assert from 'node:assert/strict';
import { runSelfCheck } from '../src/selfcheck.js';

test('検算がすべて通る', () => {
  const r = runSelfCheck();
  const failed = r.results.filter((x) => !x.ok).map((x) => x.name);
  assert.deepEqual(failed, []);
});
