import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFitTempo } from '../generate-voiceover.mjs';

test('computeFitTempo', () => {
  assert.deepEqual(computeFitTempo(3, 4), { tempo: 1, overflowSec: 0 });
  assert.deepEqual(computeFitTempo(4.2, 4), { tempo: 1.05, overflowSec: 0 });
  const r = computeFitTempo(5, 4);
  assert.equal(r.tempo, 1.15);
  assert.ok(Math.abs(r.overflowSec - 0.348) < 0.01);
});
