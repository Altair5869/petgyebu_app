/** @jest-environment node */
const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const { removeDonorBlush, restoreOriginalBlush } = require('../eye-compositor.js');

test('caution closed-eye crop must not introduce donor cheek stripes or face outline', () => {
  const original = read(path.join(__dirname, '../../../assets/images/pets/cat-caution@3x.png'));
  const source = read(path.join(__dirname, '../cat-caution-blink-source-v2.png'));
  const pixels = { width: original.width, height: original.height, data: new Uint8ClampedArray(original.data) };
  const samples = [[1685, 490], [1695, 530]]; // Extra orange stripe and dark face outline.
  for (const [sx, sy] of samples) {
    const x = Math.round(229 + (sx - 1570) * 51 / 125);
    const y = Math.round(157 + (sy - 425) * 54 / 120);
    const i = (y * original.width + x) * 4;
    const donor = (sy * source.width + sx) * 4;
    pixels.data.set(source.data.subarray(donor, donor + 4), i);
  }
  restoreOriginalBlush(pixels, original, true);
  for (const [x, y] of [[276, 186], [280, 204]]) {
    const i = (y * original.width + x) * 4;
    assert.deepEqual([...pixels.data.slice(i, i + 4)], [...original.data.slice(i, i + 4)], 'Only original cheek markings may remain');
  }
});

test('caution cheek guard leaves the original eye erasure and the new closed-eye stroke intact', () => {
  const original = read(path.join(__dirname, '../../../assets/images/pets/cat-caution@3x.png'));
  const source = read(path.join(__dirname, '../cat-caution-blink-source-v2.png'));
  for (const scale of [1, 2]) {
    const width = original.width * scale;
    const height = original.height * scale;
    const base = { width, height, data: new Uint8ClampedArray(width * height * 4) };
    const pixels = { width, height, data: new Uint8ClampedArray(base.data.length) };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const from = (Math.floor(y / scale) * original.width + Math.floor(x / scale)) * 4;
      base.data.set(original.data.subarray(from, from + 4), i);
      pixels.data.set([252, 240, 227, 255], i);
    }
    restoreOriginalBlush(pixels, base, true);
    // The original open eye must stay erased, including its rightmost outline.
    for (let y = 157; y < 197; y++) for (let x = 229; x < 274; x++) {
      const from = (y * original.width + x) * 4;
      if (original.data[from] < 190 && original.data[from + 1] < 155 && original.data[from + 2] < 140) {
        const i = (y * scale * width + x * scale) * 4;
        assert.deepEqual([...pixels.data.slice(i, i + 4)], [252, 240, 227, 255]);
      }
    }
    // Actual closed lid, excluding the separate donor face outline at x >= 1680.
    const lid = [];
    for (let sy = 465; sy < 505; sy++) for (let sx = 1570; sx < 1670; sx++) {
      const from = (sy * source.width + sx) * 4;
      if (source.data[from] >= 150 || source.data[from + 1] >= 110) continue;
      const x = Math.round((229 + (sx - 1570) * 51 / 125) * scale);
      const y = Math.round((157 + (sy - 425) * 54 / 120) * scale);
      const i = (y * width + x) * 4;
      pixels.data.set([80, 40, 20, 255], i);
      lid.push(i);
    }
    restoreOriginalBlush(pixels, base, true);
    assert.ok(lid.length > 100);
    for (const i of lid) assert.deepEqual([...pixels.data.slice(i, i + 4)], [80, 40, 20, 255]);
  }
});

// Actual v2 source crops used by the preview. These tests inspect PNG pixels,
// not a browser render, interpolation, or the perceived transition quality.
const fixtures = [
  ['stable', [[365, 351, 165, 150], [620, 407, 150, 143], [1380, 370, 160, 146], [1630, 424, 150, 143]]],
  ['caution', [[471, 346, 142, 136], [669, 400, 130, 120], [1367, 363, 142, 136], [1570, 425, 125, 120]]],
  ['warning', [[274, 342, 154, 145], [528, 339, 160, 149], [1278, 353, 154, 145], [1535, 350, 160, 149]]],
  ['budget-reached', [[271, 350, 160, 145], [543, 345, 174, 150], [1304, 363, 160, 145], [1568, 358, 174, 150]]],
];
const read = (file) => PNG.sync.read(fs.readFileSync(file));
const strongPink = (data, i) => data[i] > 240 && data[i] - data[i + 1] > 25
  && data[i + 1] - data[i + 2] < 20 && data[i + 3] > 230;

for (const [state, crops] of fixtures) {
  test(`${state}: donor blush is removed without holes or changes to dark eye strokes`, () => {
    const source = read(path.join(__dirname, `../cat-${state}-blink-source-v2.png`));
    for (const [sx, sy, width, height] of crops) {
      const pixels = { width, height, data: new Uint8ClampedArray(width * height * 4) };
      for (let y = 0; y < height; y++) {
        const offset = ((sy + y) * source.width + sx) * 4;
        pixels.data.set(source.data.subarray(offset, offset + width * 4), y * width * 4);
      }
      const before = new Uint8ClampedArray(pixels.data);
      removeDonorBlush(pixels);
      let cheeks = 0;
      let strokes = 0;
      for (let i = 0; i < before.length; i += 4) {
        assert.equal(pixels.data[i + 3], before[i + 3], 'No transparent holes may reveal old outlines');
        if (before[i] < 150 && before[i + 1] < 110 && before[i + 2] < 100) {
          assert.deepEqual(pixels.data.slice(i, i + 4), before.slice(i, i + 4));
          strokes++;
        }
        if (i / 4 / width >= height * 0.35 && strongPink(before, i)) {
          assert.ok(!strongPink(pixels.data, i), 'Donor cheek must not appear at its shifted position');
          cheeks++;
        }
      }
      assert.ok(cheeks > 20, 'Fixture must contain the reported donor blush');
      assert.ok(strokes > 20, 'Fixture must contain actual eyelid/eye artwork');
    }
  });

  test(`${state}: original blush RGBA stays exact; original dark eye outlines are not restored`, () => {
    const original = read(path.join(__dirname, `../../../assets/images/pets/cat-${state}@3x.png`));
    const pixels = { data: new Uint8ClampedArray(original.data.length) };
    for (let i = 0; i < pixels.data.length; i += 4) pixels.data.set([252, 240, 227, 255], i);
    restoreOriginalBlush(pixels, original);
    let cheeks = 0;
    for (let y = 160; y < 240; y++) for (let x = 85; x < 285; x++) {
      const i = (y * original.width + x) * 4;
      if (strongPink(original.data, i)) {
        assert.deepEqual([...pixels.data.slice(i, i + 4)], [...original.data.slice(i, i + 4)]);
        cheeks++;
      }
      if (original.data[i] < 150 && original.data[i + 1] < 110 && original.data[i + 2] < 100) {
        assert.deepEqual([...pixels.data.slice(i, i + 4)], [252, 240, 227, 255]);
      }
    }
    assert.ok(cheeks > 300);
  });
}
