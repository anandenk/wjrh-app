// Puts design and app screenshots side by side (each at half size) in one image.
//
//   node compare.mjs <out.png> <design-dir> <app-dir> <name> [<name> ...]
//
// Each <name> is a file (without .png) that exists in both directories, e.g. "schedule-top".
import sharp from 'sharp';

const [out, designDir, appDir, ...names] = process.argv.slice(2);
const HALF = 603; // half of a 1206 px wide (402 pt at 3x) screenshot
const GAP = 6;

const layers = [];
let x = 0;
let height = 0;
for (const name of names) {
  for (const dir of [designDir, appDir]) {
    const buf = await sharp(`${dir}/${name}.png`).resize({ width: HALF }).png().toBuffer();
    height = Math.max(height, (await sharp(buf).metadata()).height);
    layers.push({ input: buf, left: x, top: 0 });
    x += HALF + GAP;
  }
  x += GAP * 3;
}
await sharp({ create: { width: x, height, channels: 3, background: '#888888' } }).composite(layers).png().toFile(out);
console.log('wrote', out, '(design on the left, app on the right, for each name)');
