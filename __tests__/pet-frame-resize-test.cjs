/** @jest-environment node */
const { PNG } = require('pngjs');
const { resizeArea } = require('../scripts/resize-pet-frames.cjs');
const fs = require('node:fs');
const path = require('node:path');

test('area filtering integrates fractional source coverage', () => {
  const input = new PNG({ width: 4, height: 1 });
  [0, 100, 200, 255].forEach((v, x) => input.data.set([v, v, v, 255], x * 4));
  const output = resizeArea(input, 3, 1);
  expect([...output.data]).toEqual([25,25,25,255, 150,150,150,255, 241,241,241,255]);
});

test('transparent source RGB cannot tint the silhouette', () => {
  const input = new PNG({ width: 2, height: 1 });
  input.data.set([255,0,0,0, 0,0,255,255]);
  expect([...resizeArea(input, 1, 1).data]).toEqual([0,0,255,128]);
});

function opaqueBounds(png) {
  const box = [png.width, png.height, 0, 0];
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    if (png.data[(y * png.width + x) * 4 + 3] < 128) continue;
    box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x + 1); box[3] = Math.max(box[3], y + 1);
  }
  return box.map((v, axis) => v / (axis % 2 ? png.height : png.width));
}

test.each(['cat', 'dog'].flatMap((pet) => ['stable', 'caution', 'warning', 'budget-reached'].map((state) => [pet, state])))('%s %s keeps the static fallback registration', (pet, state) => {
  const read = (file) => PNG.sync.read(fs.readFileSync(path.join(__dirname, '../assets/images/pets', file)));
  const original = opaqueBounds(read(`${pet}-${state}@3x.png`));
  const frame = opaqueBounds(read(`${pet}-interaction/${pet}-${state}-open.png`));
  frame.forEach((edge, axis) => {
    // Only raster edge rounding may differ, by at most one destination pixel.
    expect(Math.abs(edge - original[axis])).toBeLessThanOrEqual(1 / (axis % 2 ? 360 : 465));
  });
});
