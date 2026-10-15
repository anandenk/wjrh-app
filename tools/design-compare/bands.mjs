// Measures a 3x screenshot in points, so the design's and the app's shots can be compared to the pixel.
//
//   node bands.mjs rows <png> [x]                 runs of one color down column x (default 6): bars, rows, docks
//   node bands.mjs text <png> <x0> <x1> <y0> <y1>  vertical bands that contain light (text) pixels in that box
//
// Example: the top of the Schedule text, in the design and in the app, should give the same numbers.
import sharp from 'sharp';

const [mode, file, ...rest] = process.argv.slice(2);
const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
const at = (x, y) => {
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
};

if (mode === 'rows') {
  const x = Number(rest[0] ?? 6) * 3;
  const same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 24;
  let start = 0;
  let cur = at(x, 0);
  const runs = [];
  for (let y = 1; y <= info.height; y++) {
    const c = y < info.height ? at(x, y) : null;
    if (!c || !same(c, cur)) {
      if (y - start >= 9) runs.push(`${(start / 3).toFixed(1)}-${(y / 3).toFixed(1)} rgb(${cur.join(',')})`);
      start = y;
      cur = c;
    }
  }
  console.log(runs.join('\n'));
} else if (mode === 'text') {
  const [x0, x1, y0, y1] = rest.map(Number);
  const light = (x, y) => at(x, y).reduce((a, b) => a + b, 0) > 560;
  const bands = [];
  let inBand = false;
  let start = 0;
  for (let y = Math.round(y0 * 3); y < Math.round(y1 * 3); y++) {
    let any = false;
    for (let x = Math.round(x0 * 3); x < Math.round(x1 * 3) && !any; x++) any = light(x, y);
    if (any && !inBand) { inBand = true; start = y; }
    if (!any && inBand) { inBand = false; bands.push(`${(start / 3).toFixed(1)}-${(y / 3).toFixed(1)}`); }
  }
  console.log(bands.join('  '));
} else {
  console.error('usage: bands.mjs rows <png> [x]  |  bands.mjs text <png> x0 x1 y0 y1');
  process.exit(1);
}
