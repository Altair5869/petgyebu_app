/** @jest-environment node */
const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const states = ['stable', 'caution', 'warning', 'budget-reached'];
// Original @3x eye bounds + compositor feather. One output pixel covers filtering.
const regions = [
  [[141,145,206,212], [226,165,288,228]],
  [[145,133,209,197], [226,154,283,214]],
  [[91,122,154,192], [191,118,256,188]],
  [[92,118,155,188], [192,115,259,187]],
];
const read = (state, pose) => PNG.sync.read(fs.readFileSync(path.join(__dirname,
  `../assets/images/pets/cat-interaction/cat-${state}-${pose}.png`)));

test.each(states)('%s packaged frames keep canvas size, body and paws fixed', (state) => {
  const open = read(state, 'open');
  assert.equal(open.width, 465);
  assert.equal(open.height, 360);
  for (const pose of ['half', 'closed']) {
    const frame = read(state, pose);
    assert.equal(frame.width, open.width);
    assert.equal(frame.height, open.height);
    assert.deepEqual(frame.data.subarray(Math.ceil(460 * 360 / 576) * 465 * 4), open.data.subarray(Math.ceil(460 * 360 / 576) * 465 * 4), 'Body and paws must remain pixel-identical');
    for (let y = 0; y < 360; y++) for (let x = 0; x < 465; x++) {
      const i = (y * 465 + x) * 4;
      assert.equal(frame.data[i + 3], open.data[i + 3], 'Silhouette and opacity must stay fixed');
      const inside = regions[states.indexOf(state)].some(([l,t,r,b]) =>
        x >= Math.floor(l * 1.25) - 1 && x < Math.ceil(r * 1.25) + 1
        && y >= Math.floor(t * 1.25) - 1 && y < Math.ceil(b * 1.25) + 1);
      if (!inside) assert.ok(frame.data.subarray(i, i + 4).equals(open.data.subarray(i, i + 4)), `Outside eye changed at ${x},${y}`);
    }
    assert.notDeepEqual(frame.data, open.data, 'Reaction must have its own eye artwork');
  }
});
