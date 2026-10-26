const { PNG } = require('pngjs');

const WIDTH = 465;
const HEIGHT = 360;

// Exact pixel-area integration in premultiplied alpha; transparent RGB cannot bleed.
function resizeArea(source, width = WIDTH, height = HEIGHT) {
  const output = new PNG({ width, height });
  const sx = source.width / width;
  const sy = source.height / height;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sums = [0, 0, 0, 0];
    for (let iy = Math.floor(y * sy); iy < Math.ceil((y + 1) * sy); iy++) {
      for (let ix = Math.floor(x * sx); ix < Math.ceil((x + 1) * sx); ix++) {
        const weight = (Math.min((x + 1) * sx, ix + 1) - Math.max(x * sx, ix))
          * (Math.min((y + 1) * sy, iy + 1) - Math.max(y * sy, iy));
        if (weight <= 0 || ix >= source.width || iy >= source.height) continue;
        const i = (iy * source.width + ix) * 4;
        const alphaWeight = source.data[i + 3] * weight;
        for (let c = 0; c < 3; c++) sums[c] += source.data[i + c] * alphaWeight;
        sums[3] += alphaWeight;
      }
    }
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) output.data[i + c] = sums[3] ? Math.round(sums[c] / sums[3]) : 0;
    output.data[i + 3] = Math.round(sums[3] / (sx * sy));
  }
  return output;
}

const isBlush = (d, i) => d[i + 3] > 200 && d[i] > 230
  && d[i] - d[i + 1] > 12 && d[i] - 2 * d[i + 1] + d[i + 2] > 2;

function preparePetFrames(frames, pet) {
  const output = {};
  for (const state of ['stable', 'caution', 'warning', 'budget-reached']) {
    let original;
    for (const pose of ['open', 'half', 'closed']) {
      const name = `${pet}-${state}-${pose}.png`;
      const source = PNG.sync.read(Buffer.from(frames[name], 'base64'));
      if (source.width !== 744 || source.height !== 576) throw new Error(`Expected 744×576 compositor source: ${name}`);
      const frame = resizeArea(source);
      if (pose === 'open') original = frame;
      else for (let i = 0; i < frame.data.length; i += 4) {
        // Keep silhouette/opacity and original dog blush exact after filtering.
        frame.data[i + 3] = original.data[i + 3];
        if (pet === 'dog' && isBlush(original.data, i)) original.data.copy(frame.data, i, i, i + 4);
      }
      output[name] = PNG.sync.write(frame);
    }
  }
  return output;
}

module.exports = { resizeArea, preparePetFrames };
