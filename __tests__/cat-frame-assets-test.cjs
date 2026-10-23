/** @jest-environment node */
const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const states = ['stable', 'caution', 'warning', 'budget-reached'];
const read = (state, pose) => PNG.sync.read(fs.readFileSync(path.join(__dirname,
  `../assets/images/pets/cat-interaction/cat-${state}-${pose}.png`)));

test.each(states)('%s packaged frames keep canvas size, body and paws fixed', (state) => {
  const open = read(state, 'open');
  assert.equal(open.width, 744);
  assert.equal(open.height, 576);
  for (const pose of ['half', 'closed']) {
    const frame = read(state, pose);
    assert.equal(frame.width, open.width);
    assert.equal(frame.height, open.height);
    assert.deepEqual(frame.data.subarray(460 * 744 * 4), open.data.subarray(460 * 744 * 4), 'Body and paws must remain pixel-identical');
    assert.notDeepEqual(frame.data, open.data, 'Reaction must have its own eye artwork');
  }
});
