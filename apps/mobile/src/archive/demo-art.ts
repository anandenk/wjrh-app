// DEMO ONLY (EXPO_PUBLIC_DEMO_ARCHIVES=1). Original placeholder cover art for the "Recently played" rows, drawn from
// the track's title and artist, so a demo shows a varied wall of covers without borrowing anyone's artwork. The same
// track always gets the same picture. Ten styles times twelve palettes; the details of each are drawn from the seed.
//
// This file only describes the picture as plain shapes (no React), so it can be tested; src/components/generated-cover.tsx
// draws them. Shapes are batched into paths so one cover is a handful of elements, not hundreds.

export const COVER_W = 320;
export const COVER_H = 96; // about the shape of a recent-track row, which shows a wide slice of its cover

export type CoverShape =
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill: string; opacity?: number }
  | { k: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; opacity?: number }
  | { k: 'path'; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number };

export const STYLES = [
  'sunburst',
  'rings',
  'stripes',
  'halftone',
  'waves',
  'bauhaus',
  'horizon',
  'quilt',
  'equalizer',
  'rainbow',
] as const;
export type CoverStyle = (typeof STYLES)[number];

type Palette = { bg: string; a: string; b: string; c: string };

export const PALETTES: readonly Palette[] = [
  { bg: '#1F3A5F', a: '#F2B134', b: '#ED553B', c: '#F7F0E3' }, // navy, marigold
  { bg: '#0B5563', a: '#F28F6B', b: '#F7D488', c: '#E8F1F2' }, // teal, coral
  { bg: '#3B1F4B', a: '#E86A92', b: '#FFC857', c: '#7FDBDA' }, // plum, pink
  { bg: '#1B4332', a: '#95D5B2', b: '#F4A259', c: '#FEFAE0' }, // forest, orange
  { bg: '#F4E3C1', a: '#D1432F', b: '#264653', c: '#E9A23B' }, // cream, tomato
  { bg: '#14213D', a: '#4CC9F0', b: '#F72585', c: '#FCA311' }, // midnight, cyan
  { bg: '#4F5D2F', a: '#E9C46A', b: '#E76F51', c: '#F4F1DE' }, // olive, gold
  { bg: '#CDB4DB', a: '#FF6F91', b: '#3D348B', c: '#FFF1E6' }, // lilac, pink
  { bg: '#7F2A1D', a: '#F5B971', b: '#2A9D8F', c: '#FFE8D6' }, // rust, teal
  { bg: '#0F0F14', a: '#EDEDED', b: '#E63946', c: '#8D99AE' }, // ink, red
  { bg: '#8ECAE6', a: '#FFB703', b: '#023047', c: '#FB8500' }, // sky, amber
  { bg: '#FFD6E0', a: '#7C3AED', b: '#00A896', c: '#FF9F1C' }, // blush, violet
];

export type GeneratedCover = {
  style: CoverStyle;
  /** Index into PALETTES. */
  palette: number;
  background: string;
  shapes: CoverShape[];
};

/** What the picture is drawn from: the same track gives the same string whatever its case or spacing. */
export function coverSeed(title: string | null | undefined, artist: string | null | undefined): string {
  return `${(title ?? '').trim().toLowerCase()}|${(artist ?? '').trim().toLowerCase()}`;
}

// FNV-1a: a small, steady string hash.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: a small seeded random number generator, so a picture's details repeat exactly.
function rngFrom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const W = COVER_W;
const H = COVER_H;
const n1 = (n: number) => Math.round(n * 10) / 10;
const between = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);
const pickInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const polygon = (points: [number, number][]) => `M${points.map(([x, y]) => `${n1(x)} ${n1(y)}`).join(' L')} Z`;
const disc = (cx: number, cy: number, r: number) =>
  `M${n1(cx - r)} ${n1(cy)} a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0 a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0 Z`;

type Builder = (rng: Rng, p: Palette) => CoverShape[];

const BUILDERS: Record<CoverStyle, Builder> = {
  // Rays fanning out from a sun.
  sunburst(rng, p) {
    const cx = W * between(rng, 0.62, 0.87);
    const cy = H * between(rng, 0.35, 0.65);
    const wedges = 2 * pickInt(rng, 6, 10);
    const step = (Math.PI * 2) / wedges;
    const start = rng() * Math.PI * 2;
    const reach = 420;
    let d = '';
    for (let i = 0; i < wedges; i += 2) {
      const a0 = start + i * step;
      const a1 = a0 + step;
      d += `${polygon([
        [cx, cy],
        [cx + Math.cos(a0) * reach, cy + Math.sin(a0) * reach],
        [cx + Math.cos(a1) * reach, cy + Math.sin(a1) * reach],
      ])} `;
    }
    const r = between(rng, 13, 24);
    return [
      { k: 'path', d, fill: p.a },
      { k: 'circle', cx, cy, r: r + 7, fill: p.bg },
      { k: 'circle', cx, cy, r, fill: p.b },
      { k: 'circle', cx, cy, r: r + 7, stroke: p.c, sw: 2 },
    ];
  },

  // Concentric bands, like a speaker cone or a record's grooves.
  rings(rng, p) {
    const cx = W * between(rng, 0.6, 0.9);
    const cy = H * between(rng, 0.2, 0.8);
    const gap = between(rng, 7, 12);
    const colors = [p.a, p.b, p.c, p.bg];
    const shapes: CoverShape[] = [];
    for (let i = 16; i >= 1; i--) shapes.push({ k: 'circle', cx, cy, r: n1(i * gap), fill: colors[i % 4] });
    return shapes;
  },

  // Slanted bands.
  stripes(rng, p) {
    const band = between(rng, 12, 28);
    const gap = band * between(rng, 0.3, 1);
    const skew = H * between(rng, 0.4, 0.9) * (rng() < 0.5 ? 1 : -1);
    const colors = [p.a, p.b, p.c];
    const shapes: CoverShape[] = [];
    let x = -Math.abs(skew) - band;
    for (let i = 0; x < W + Math.abs(skew); i++) {
      shapes.push({
        k: 'path',
        d: polygon([
          [x, 0],
          [x + band, 0],
          [x + band - skew, H],
          [x - skew, H],
        ]),
        fill: colors[i % 3],
      });
      x += band + gap;
    }
    return shapes;
  },

  // A grid of dots that swell towards the right, like a printed photo.
  halftone(rng, p) {
    const cols = 16;
    const rows = 5;
    const sx = W / cols;
    const sy = H / rows;
    const phase = rng() * 6.28;
    let d = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = (c + 0.5) / cols;
        const radius = sy * 0.62 * Math.pow(t, 1.3) * (0.55 + 0.45 * Math.sin(r * 0.9 + c * 0.35 + phase));
        if (radius > 0.8) d += `${disc((c + 0.5) * sx, (r + 0.5) * sy, radius)} `;
      }
    }
    return [
      { k: 'circle', cx: W * between(rng, 0.7, 0.9), cy: H * 0.5, r: H * between(rng, 0.45, 0.65), fill: p.b },
      { k: 'path', d, fill: p.c },
      { k: 'path', d, fill: p.a, opacity: 0.55 },
    ];
  },

  // Layers of rolling water.
  waves(rng, p) {
    const layers = pickInt(rng, 4, 5);
    const colors = [p.a, p.b, p.c, p.a, p.b];
    const shapes: CoverShape[] = [];
    for (let l = 0; l < layers; l++) {
      const baseY = H * (0.22 + (l * 0.7) / layers);
      const amp = between(rng, 5, 13);
      const freq = between(rng, 0.02, 0.05);
      const phase = rng() * 6.28;
      let d = `M0 ${H}`;
      for (let x = 0; x <= W; x += 8) d += ` L${x} ${n1(baseY + amp * Math.sin(x * freq + phase))}`;
      shapes.push({ k: 'path', d: `${d} L${W} ${H} Z`, fill: colors[l] });
    }
    return shapes;
  },

  // A few flat shapes overlapping, in the manner of a Bauhaus poster.
  bauhaus(rng, p) {
    const tx = W * between(rng, 0.3, 0.6);
    return [
      { k: 'circle', cx: W * between(rng, 0.55, 0.9), cy: H * between(rng, 0.3, 0.7), r: H * between(rng, 0.38, 0.62), fill: p.a },
      { k: 'rect', x: W * between(rng, 0.35, 0.75), y: -4, w: between(rng, 36, 84), h: H * between(rng, 0.5, 1.05), fill: p.b, opacity: 0.92 },
      {
        k: 'path',
        d: polygon([
          [tx, H + 2],
          [tx + between(rng, 40, 80), H + 2],
          [tx + between(rng, 5, 60), H * between(rng, 0.1, 0.5)],
        ]),
        fill: p.c,
        opacity: 0.95,
      },
      { k: 'circle', cx: W * between(rng, 0.45, 0.85), cy: H * between(rng, 0.2, 0.8), r: between(rng, 9, 19), stroke: p.bg, sw: 4, fill: p.c },
    ];
  },

  // A sun low over layered hills.
  horizon(rng, p) {
    const hills = (base: number, wobble: number): [number, number][] => {
      const pts: [number, number][] = [[0, H + 2]];
      for (let x = 0; x <= W + 40; x += 40) pts.push([x, H * (base + wobble * rng())]);
      pts.push([W + 40, H + 2]);
      return pts;
    };
    return [
      { k: 'circle', cx: W * between(rng, 0.55, 0.85), cy: H * between(rng, 0.38, 0.6), r: H * between(rng, 0.3, 0.45), fill: p.a },
      { k: 'path', d: polygon(hills(0.5, 0.3)), fill: p.b, opacity: 0.9 },
      { k: 'path', d: polygon(hills(0.7, 0.2)), fill: p.c },
    ];
  },

  // Patchwork squares.
  quilt(rng, p) {
    const cell = 24;
    const colors = [p.a, p.b, p.c, p.bg];
    const groups: Record<string, string> = {};
    const dots: CoverShape[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < Math.ceil(W / cell); c++) {
        const color = colors[Math.floor(rng() * colors.length)];
        groups[color] = `${groups[color] ?? ''}M${c * cell} ${r * cell} h${cell} v${cell} h${-cell} Z `;
        if (rng() < 0.18) dots.push({ k: 'circle', cx: c * cell + cell / 2, cy: r * cell + cell / 2, r: cell * 0.32, fill: colors[(colors.indexOf(color) + 2) % 4] });
      }
    }
    return [...Object.entries(groups).map(([fill, d]): CoverShape => ({ k: 'path', d, fill })), ...dots];
  },

  // Sound-level bars, mirrored about the middle.
  equalizer(rng, p) {
    const bars = Math.floor(W / 18);
    const phase = rng() * 6.28;
    const colors = [p.a, p.b, p.c];
    const groups = ['', '', ''];
    for (let i = 0; i < bars; i++) {
      const h = H * (0.18 + 0.78 * Math.abs(Math.sin(i * 0.5 + phase)) * (0.45 + 0.55 * rng()));
      groups[i % 3] += `M${i * 18 + 3} ${n1((H - h) / 2)} h12 v${n1(h)} h-12 Z `;
    }
    return [
      { k: 'circle', cx: W * between(rng, 0.65, 0.9), cy: H * 0.5, r: H * between(rng, 0.5, 0.7), stroke: p.c, sw: 3, opacity: 0.8 },
      ...groups.map((d, i): CoverShape => ({ k: 'path', d, fill: colors[i] })),
    ];
  },

  // Thick arcs rising from the bottom edge.
  rainbow(rng, p) {
    const cx = W * between(rng, 0.55, 0.88);
    const cy = H * between(rng, 1, 1.2);
    const gap = H * between(rng, 0.12, 0.17);
    const colors = [p.a, p.b, p.c, p.a, p.b, p.c, p.a, p.b];
    const shapes: CoverShape[] = [];
    for (let i = 8; i >= 1; i--) shapes.push({ k: 'circle', cx, cy, r: n1(i * gap), stroke: colors[i - 1], sw: n1(gap * 0.72) });
    shapes.push({ k: 'circle', cx: cx - gap * between(rng, 2, 4), cy: H * between(rng, 0.2, 0.4), r: between(rng, 7, 13), fill: p.c });
    return shapes;
  },
};

/** The picture for a seed (see `coverSeed`): same seed, same picture. */
export function generateCover(seed: string): GeneratedCover {
  const h = hash(seed);
  const style = STYLES[h % STYLES.length];
  const palette = Math.floor(h / STYLES.length) % PALETTES.length;
  const rng = rngFrom(h ^ 0x9e3779b9);
  const colors = PALETTES[palette];
  return { style, palette, background: colors.bg, shapes: BUILDERS[style](rng, colors) };
}
