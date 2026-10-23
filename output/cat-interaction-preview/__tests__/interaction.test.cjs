/** @jest-environment node */
// Interaction smoke check. Does not render a browser or simulate native touch.
const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function preview() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  const setTimeout = (fn, ms) => {
    timers.set(++id, { fn, at: now + ms });
    return id;
  };
  const tick = (ms) => {
    const end = now + ms;
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = end;
  };
  const target = () => ({
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    emit(type, event = {}) { this.listeners[type]?.(event); },
  });
  const nodes = new Map();
  const get = (key) => {
    if (!nodes.has(key)) nodes.set(key, Object.assign(target(), {
      checked: false, style: {}, classList: { toggle() {} }, setAttribute() {},
      setPointerCapture(pointer) { this.capture = pointer; },
      hasPointerCapture(pointer) { return this.capture === pointer; },
      releasePointerCapture() { this.capture = null; },
      width: 744, height: 576, draws: [],
      getContext() {
        if (this.context) return this.context;
        const surface = this;
        this.context = {
          clearRect() { surface.draws = []; },
          save() {}, restore() {},
          getImageData(x, y, width, height) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; },
          putImageData() {},
          translate(...values) { surface.maskCenter = values; },
          scale(...values) { surface.maskRadius = values; },
          createRadialGradient() {
            surface.stops = [];
            return { addColorStop(...stop) { surface.stops.push(stop); } };
          },
          createLinearGradient(...axis) {
            const gradient = { axis, stops: [], addColorStop(...stop) { this.stops.push(stop); } };
            (surface.gradients ??= []).push(gradient);
            return gradient;
          },
          fillRect(...rect) {
            surface.maskMode = this.globalCompositeOperation;
            (surface.maskRects ??= []).push(rect);
          },
          drawImage(image, ...args) {
            surface.lastImage = image.src;
            surface.draws.push({ src: image.src, image, args });
          },
        };
        return this.context;
      },
    }));
    return nodes.get(key);
  };
  get('idle').checked = true;
  let surfaceCount = 0;
  const document = Object.assign(target(), {
    getElementById: get, hasFocus: () => true, hidden: false,
    createElement() { const surface = get(`surface-${++surfaceCount}`); surface.src = 'prepared-frame'; return surface; },
  });
  const reduced = Object.assign(target(), { matches: false });
  const window = Object.assign(target(), { matchMedia: () => reduced });
  class Image {
    set src(value) {
      this.url = value;
      const png = fs.readFileSync(path.resolve(__dirname, '..', value));
      this.width = png.readUInt32BE(16);
      this.height = png.readUInt32BE(20);
      queueMicrotask(() => this.onload());
    }
    get src() { return this.url; }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../preview.js'), 'utf8'), {
    document, window, Image, setTimeout, clearTimeout: (key) => timers.delete(key), Math, Promise,
    CatEyeCompositor: require('../eye-compositor.js'),
  });
  await new Promise((resolve) => setImmediate(resolve));
  const enable = () => { get('draft').checked = true; get('draft').emit('change'); };
  const select = (state) => { get('budget').value = String(state); get('budget').emit('change'); };
  return { get, enable, select, tick, timers, document, window, reduced };
}

test('all four original emotions recover after petting; changes during a response use the latest state', async () => {
  const { get, enable, select, tick } = await preview();
  assert.match(get('cat').lastImage, /cat-stable@3x/);
  enable();
  for (const [row, file] of ['stable', 'caution', 'warning', 'budget-reached'].entries()) {
    select(row);
    get('pet').emit('click');
    tick(1090);
    assert.match(get('cat').lastImage, new RegExp(`cat-${file}@3x`));
  }
  select(0);
  get('pet').emit('click');
  tick(120);
  select(1);
  select(2);
  select(3);
  tick(970);
  assert.match(get('cat').lastImage, /cat-budget-reached@3x/);
  assert.match(get('trace').textContent, /최신 예산 상태: 예산 도달/);
});

test('pointer release and cancellation recover; secondary input does not start a response', async () => {
  const { get, enable, select, tick } = await preview();
  enable();
  select(2);
  get('head').emit('pointerdown', { isPrimary: false, button: 0, pointerId: 8 });
  assert.match(get('cat').lastImage, /cat-warning@3x/);
  for (const ending of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    get('head').emit('pointerdown', { isPrimary: true, button: 0, pointerId: 7, preventDefault() {} });
    tick(150);
    assert.equal(get('cat').lastImage, 'prepared-frame');
    get('head').emit(ending, { pointerId: 7 });
    tick(240);
    assert.match(get('cat').lastImage, /cat-warning@3x/);
  }
});

test('budget reached and reduced motion suppress idle; blur and hiding cancel active responses', async () => {
  const { get, enable, select, tick, timers, reduced, window, document } = await preview();
  enable();
  select(3);
  assert.equal(timers.size, 0);
  select(0);
  reduced.matches = true;
  reduced.emit('change');
  get('blink').emit('click');
  assert.equal(timers.size, 0);
  get('pet').emit('click');
  tick(850);
  assert.match(get('cat').lastImage, /cat-stable@3x/);
  reduced.matches = false;
  reduced.emit('change');
  get('pet').emit('click');
  window.emit('blur');
  assert.equal(timers.size, 0);
  assert.match(get('cat').lastImage, /cat-stable@3x/);
  window.emit('focus');
  assert.equal(timers.size, 1);
  get('pet').emit('click');
  document.hidden = true;
  document.emit('visibilitychange');
  assert.equal(timers.size, 0);
  assert.match(get('cat').lastImage, /cat-stable@3x/);
});

test('reset cancels pending frames and restores the current original', async () => {
  const { get, enable, tick, timers } = await preview();
  enable();
  get('pet').emit('click');
  get('reset').emit('click');
  tick(2000);
  assert.equal(get('draft').checked, false);
  assert.equal(timers.size, 0);
  assert.match(get('cat').lastImage, /cat-stable@3x/);
});

test('prepared reaction frames preserve the original cat bounds and mask updates to two eyes', async () => {
  const { get, enable, select, tick } = await preview();
  enable();
  for (const row of [0, 1, 2, 3]) {
    select(row);
    const base = get('cat').draws[0];
    get('pet').emit('click');
    for (const delay of [0, 100, 750, 120]) {
      tick(delay);
      const displayed = get('cat').draws[0];
      assert.equal(get('cat').draws.length, 1, 'Playback uses one prepared frame');
      assert.deepEqual(displayed.args, [0, 0, 744, 576]);
      const [original, ...patches] = displayed.image.draws;
      assert.equal(original.src, base.src, 'The full cat must remain the original image');
      assert.deepEqual(original.args, [0, 0, 744, 576], 'The full cat position and size must remain fixed');
      assert.equal(patches.length, 2);
      for (const patch of patches) {
        const eyeDraw = patch.image.draws[0];
        const state = ['stable', 'caution', 'warning', 'budget-reached'][row];
        assert.equal(eyeDraw.src, `cat-${state}-blink-source-v2.png`, 'Every state must use its own refined eye source');
        const [sx, sy, sw, sh] = eyeDraw.args;
        assert.ok(sx >= 0 && sy >= 0 && sx + sw <= eyeDraw.image.width && sy + sh <= eyeDraw.image.height, 'Eye crops must fit the actual PNG dimensions');
        assert.equal(patch.image.maskMode, 'destination-in');
        const [x, y, w, h] = patch.image.draws[0].args.slice(4);
        const gradients = patch.image.gradients ?? [];
        assert.equal(gradients.length, 2, 'Horizontal and vertical masks must cover the full original eye, including its corners');
        for (const [axis, gradient] of gradients.entries()) {
          const length = axis === 0 ? w : h;
          assert.deepEqual(gradient.stops[0], [0, 'rgba(255,255,255,0)']);
          assert.deepEqual(gradient.stops.at(-1), [1, 'rgba(255,255,255,0)']);
          assert.deepEqual(gradient.stops[1], [6 / length, '#fff']);
          assert.deepEqual(gradient.stops[2], [1 - 6 / length, '#fff']);
          assert.deepEqual(patch.image.maskRects[axis], [x, y, w, h]);
        }
        assert.ok(w <= 142 && h <= 152, 'Only small eye patches plus a skin margin may change');
        assert.ok(x > 170 && y >= 230 && x + w <= 576 && y + h < 460, 'Patches stay inside the face, away from the silhouette and paws');
      }
    }
    tick(120);
    assert.equal(get('cat').draws.length, 1);
  }
});
