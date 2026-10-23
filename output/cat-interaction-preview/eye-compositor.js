/* Preview-only compositing: donor cheeks must not replace the original blush. */
((root) => {
  const isBlush = (data, i) => data[i + 3] > 200 && data[i] > 230
    && data[i] - data[i + 1] > 12 && data[i] - 2 * data[i + 1] + data[i + 2] > 2;
  const isSkin = (data, i) => data[i + 3] > 200 && data[i] > 235
    && data[i + 1] > 220 && data[i + 2] > 200
    && data[i] - 2 * data[i + 1] + data[i + 2] <= 0;

  function removeDonorBlush(pixels) {
    const { width, height, data } = pixels;
    const source = new Uint8ClampedArray(data);
    // Only the lower eye area can contain cheeks. Do not touch eyelids above it.
    for (let y = Math.floor(height * 0.35); y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (!isBlush(source, i)) continue;
        // Use nearby clean skin from the same source; never make the old eye
        // visible by cutting a transparent hole through the replacement patch.
        let skin = -1;
        for (let distance = 1; distance < Math.max(width, height) && skin < 0; distance++) {
          for (const [sx, sy] of [[x - distance, y], [x + distance, y], [x, y - distance]]) {
            if (sx < 0 || sx >= width || sy < 0) continue;
            const candidate = (sy * width + sx) * 4;
            if (isSkin(source, candidate)) { skin = candidate; break; }
          }
        }
        if (skin >= 0) data.set(source.subarray(skin, skin + 3), i);
      }
    }
  }

  function restoreOriginalBlush(pixels, original, cautionClosed = false) {
    // Exact RGBA copy preserves the original cheek position, edge and opacity.
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (isBlush(original.data, i)) pixels.data.set(original.data.subarray(i, i + 4), i);
    }
    if (!cautionClosed) return;
    // This source crop also contains a shifted orange stripe and face outline.
    // Preserve the original lower-right cheek geometrically, regardless of hue.
    // In @3x coordinates both old eye outline and new closed lid stay below
    // x + 0.55*y = 372. Start restoring at 374, feather to 376 (outside both).
    const scaleX = pixels.width / 372;
    const scaleY = pixels.height / 288;
    for (let y = Math.floor(154 * scaleY); y < Math.ceil(214 * scaleY); y++) {
      for (let x = Math.floor(226 * scaleX); x < Math.ceil(283 * scaleX); x++) {
        const amount = Math.max(0, Math.min(1, ((x + 0.5) / scaleX + 0.55 * (y + 0.5) / scaleY - 374) / 2));
        if (amount === 0) continue;
        const i = (y * pixels.width + x) * 4;
        for (let channel = 0; channel < 4; channel++) {
          pixels.data[i + channel] = Math.round(pixels.data[i + channel] * (1 - amount) + original.data[i + channel] * amount);
        }
      }
    }
  }

  const api = { removeDonorBlush, restoreOriginalBlush };
  if (typeof module !== 'undefined') module.exports = api;
  else root.CatEyeCompositor = api;
})(globalThis);
