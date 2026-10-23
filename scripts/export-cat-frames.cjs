// Run the reviewed Canvas compositor in an isolated, installed Chrome instance.
// First: python3 output/cat-interaction-preview/serve-preview.py (local preview sources, not in the repository)
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'petgyebu-frame-export-'));
const destination = path.join(__dirname, '../assets/images/pets/cat-interaction');
try {
  const html = execFileSync(chrome, [
    '--headless', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    `--user-data-dir=${profile}`, '--dump-dom', '--virtual-time-budget=5000',
    'http://127.0.0.1:8765/?export=frames',
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
  const match = html.match(/<script id="exported-cat-frames" type="application\/json">([^<]+)<\/script>/);
  if (!match) throw new Error('No exported frames. Check the local preview server and compositor.');
  const frames = JSON.parse(match[1]);
  if (Object.keys(frames).length !== 12) throw new Error('Expected four states × three frames.');
  fs.mkdirSync(destination, { recursive: true });
  for (const state of ['stable', 'caution', 'warning', 'budget-reached']) {
    for (const pose of ['open', 'half', 'closed']) {
      const name = `cat-${state}-${pose}.png`;
      const png = Buffer.from(frames[name], 'base64');
      if (png.readUInt32BE(16) !== 744 || png.readUInt32BE(20) !== 576) throw new Error(`Unexpected dimensions: ${name}`);
      fs.writeFileSync(path.join(destination, name), png);
      console.log(`${name}: ${png.length} bytes, 744×576`);
    }
  }
} finally {
  fs.rmSync(profile, { recursive: true, force: true });
}
