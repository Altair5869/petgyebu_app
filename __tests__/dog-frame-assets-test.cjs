/** @jest-environment node */
const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

// Independent bounds around the original eyes, including a 3px feather margin.
const regions = {
  stable: [[138,149,188,181], [226,171,274,204]],
  caution: [[159,178,215,237], [247,200,300,255]],
  warning: [[122,145,180,206], [215,157,269,214]],
  'budget-reached': [[126,170,181,225], [212,182,266,238]],
};
const read = (state, pose) => PNG.sync.read(fs.readFileSync(path.join(__dirname,
  `../assets/images/pets/dog-interaction/dog-${state}-${pose}.png`)));
const blush = (d, i) => d[i + 3] > 200 && d[i] > 230 && d[i] - d[i + 1] > 12 && d[i] - 2 * d[i + 1] + d[i + 2] > 2;

test.each(Object.keys(regions))('%s frames preserve every pixel outside the eyes and original blush', (state) => {
  const open = read(state, 'open');
  assert.equal(open.width, 744);
  assert.equal(open.height, 576);
  for (const pose of ['half', 'closed']) {
    const frame = read(state, pose);
    assert.equal(frame.width, open.width);
    assert.equal(frame.height, open.height);
    let changed = 0;
    for (let y = 0; y < open.height; y++) for (let x = 0; x < open.width; x++) {
      const i = (y * open.width + x) * 4;
      const inside = regions[state].some(([l,t,r,b]) => x >= l * 2 && x < r * 2 && y >= t * 2 && y < b * 2);
      assert.equal(frame.data[i + 3], open.data[i + 3], 'Silhouette and opacity must stay fixed');
      if (!inside || blush(open.data, i)) {
        assert.ok(frame.data.subarray(i, i + 4).equals(open.data.subarray(i, i + 4)), `Original pixel changed at ${x},${y}`);
      } else if (!frame.data.subarray(i, i + 4).equals(open.data.subarray(i, i + 4))) changed++;
      // Warm fur / antialiased brown eyelids can pass the loose restoration mask.
      // Saturated pink distinguishes an actual second cheek from those neutral edges.
      const extraPink = blush(frame.data, i) && frame.data[i] - 2 * frame.data[i + 1] + frame.data[i + 2] > 20;
      assert.ok(!extraPink || blush(open.data, i), `Extra cheek appeared at ${x},${y}`);
    }
    assert.ok(changed > 100, 'Reaction must contain different eye artwork');
  }
});
