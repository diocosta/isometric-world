#!/usr/bin/env node
// Builds data/world.json: the Earth from 78°N to 56°S as a grid of 1° cells,
// each with a biome letter and a height level, for the isometric renderer.
//
// Source: Natural Earth 1:50m vectors (public domain), fetched from the
// nvkelso/natural-earth-vector repository and cached in tools/.cache.
// Coastlines, lakes, glaciers, deserts, mountain ranges and plateaus come from
// the data; forests, steppe and savanna are painted with broad climate bands
// and a little noise, because Natural Earth has no land-cover vectors.
//
// Usage: node tools/build-world.mjs        (no npm dependencies)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CACHE = join(here, '.cache');
const OUT = join(here, '..', 'data', 'world.json');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

const LON0 = -180; // west edge of column 0
const LAT0 = 78; // north edge of row 0
const COLS = 360;
const ROWS = 134; // 78°N .. 56°S
const SS = 4; // samples per cell edge (4 × 4 = 16 samples per cell)

async function layer(name) {
  const file = join(CACHE, `${name}.geojson`);
  if (!existsSync(file)) {
    await mkdir(CACHE, { recursive: true });
    const res = await fetch(NE + name + '.geojson', {
      headers: { 'user-agent': 'isometric-world-build (+https://github.com/diocosta/isometric-world)' },
    });
    if (!res.ok) throw new Error(`Download failed for ${name}: HTTP ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

// Scanline-fill polygons into a sample mask, then count samples per cell.
function coverage(features) {
  const W = COLS * SS;
  const H = ROWS * SS;
  const mask = new Uint8Array(W * H);
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const rings of polys) fillPolygon(mask, W, H, rings);
  }
  const cov = new Float32Array(COLS * ROWS);
  for (let j = 0; j < H; j++) {
    const r = (j / SS) | 0;
    for (let i = 0; i < W; i++) if (mask[j * W + i]) cov[r * COLS + ((i / SS) | 0)] += 1 / (SS * SS);
  }
  return cov;
}

function fillPolygon(mask, W, H, rings) {
  let latMin = 90;
  let latMax = -90;
  for (const ring of rings) for (const [, lat] of ring) {
    if (lat < latMin) latMin = lat;
    if (lat > latMax) latMax = lat;
  }
  const j0 = Math.max(0, Math.floor((LAT0 - latMax) * SS - 0.5));
  const j1 = Math.min(H - 1, Math.ceil((LAT0 - latMin) * SS - 0.5));
  const xs = [];
  for (let j = j0; j <= j1; j++) {
    const lat = LAT0 - (j + 0.5) / SS;
    xs.length = 0;
    for (const ring of rings) {
      for (let k = 0, n = ring.length; k < n - 1; k++) {
        const [x1, y1] = ring[k];
        const [x2, y2] = ring[k + 1];
        if ((y1 <= lat && y2 > lat) || (y2 <= lat && y1 > lat)) {
          xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - LON0) * SS - 0.5));
      const i1 = Math.min(W, Math.ceil((xs[k + 1] - LON0) * SS - 0.5));
      for (let i = i0; i < i1; i++) mask[j * W + i] = 1;
    }
  }
}

// Small deterministic value noise, so the climate bands get organic edges.
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y, scale, seed) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x, y, seed) => 0.6 * noise(x, y, 9, seed) + 0.4 * noise(x, y, 3.5, seed + 7);

const inBox = (lat, lon, [la0, la1, lo0, lo1]) => lat >= la0 && lat <= la1 && lon >= lo0 && lon <= lo1;
const anyBox = (lat, lon, boxes) => boxes.some((b) => inBox(lat, lon, b));

// [latMin, latMax, lonMin, lonMax]
const JUNGLE = [
  [-16, 7, -80, -44], // Amazon
  [7, 19, -93, -76], // Central America
  [-7, 6, 8, 31], // Congo basin
  [4, 9, -14, -2], // West African coast
  [-11, 21, 92, 156], // Southeast Asia, Indonesia, New Guinea
  [-25, -12, 47.5, 51], // eastern Madagascar
  [-19, -11, 143, 147], // Queensland coast
  [8, 22, 72, 77], // Western Ghats coast
  [21, 28, 88, 97], // Bengal and Assam
];
const SAVANNA = [
  [-26, 15, -18, 52], // Sub-Saharan Africa
  [-21, -3, -62, -40], // Cerrado and caatinga
  [3, 11, -74, -60], // Llanos
  [-21, -10, 118, 148], // northern Australia
  [14, 31, 67, 88], // Indian plains
  [16, 30, -114, -97], // dry Mexico
  [0, 12, 40, 52], // Horn of Africa
  [25, 38, 44, 70], // Iran and Afghanistan
  [36, 44, -121, -111], // Great Basin
];
const STEPPE = [
  [31, 53, -113, -96], // Great Plains and prairies
  [-41, -28, -66, -56], // Pampas
  [-52, -38, -73, -63], // Patagonia
  [44, 55, 30, 90], // Pontic and Kazakh steppe
  [41, 50, 90, 122], // Mongolia
  [-36, -24, 135, 150], // inland eastern Australia
];
const ARID = [
  [-31, -20, 118, 146], // Australian interior
  [13, 31, 35, 58], // Arabian peninsula
];
const TEMPERATE = [
  [42, 61, -11, 42], // Europe
  [29, 50, -96, -60], // eastern North America
  [40, 56, -130, -120], // Pacific Northwest
  [22, 46, 100, 146], // China, Korea, Japan
  [-50, -36, -76, -71], // southern Chile
  [-47, -34, 166, 179], // New Zealand
  [-44, -27, 144, 154], // southeast Australia
  [-31, -15, -51, -39], // Atlantic forest
  [-34, -24, 27, 33], // South African east coast
];

const HIGH_RANGE =
  /HIMALAYA|KARAKORAM|PAMIR|HINDU KUSH|KUNLUN|TIAN SHAN|ANDES|CORDILLERA|CORD\.|ALPS|ROCKY MOUNTAINS|ALASKA RANGE|CAUCASUS|CHUGACH|COAST MOUNTAINS|SIERRA NEVADA|ALTUN|QUILIAN/i;
const MID_RANGE =
  /ATLAS|ZAGROS|ELBURZ|ALTAY|SAYAN|BROOKS|MACKENZIE|SIERRA MADRE|NEW GUINEA|DRAKENSBERG|KJØLEN|PYRENEES|CARPATHIAN|APPENNINI|CASCADE|TIBESTI|AHAGGAR|HEJAZ|ASIR|VERKHOYANSK|STANOVOY|SELWYN|TORNGAT|YABLONOVYY|HANGAYN|SIKHOTE/i;
const HIGH_PLATEAU = /TIBET|ALTIPLANO/i;
const DRY_NOT_DESERT = /PUNJAB|CAATINGA/i;

function nameOf(f) {
  const p = f.properties || {};
  return String(p.NAME || p.name || p.NAME_EN || '');
}
function classOf(f) {
  const p = f.properties || {};
  return String(p.FEATURECLA || p.featurecla || '');
}

async function main() {
  const [land, lakes, regions, glaciers] = await Promise.all(
    ['ne_50m_land', 'ne_50m_lakes', 'ne_50m_geography_regions_polys', 'ne_50m_glaciated_areas'].map(layer),
  );
  const R = regions.features;
  const pick = (test) => R.filter((f) => test(classOf(f), nameOf(f)));

  const cov = {
    land: coverage(land.features),
    lake: coverage(lakes.features.filter((f) => (f.properties.scalerank ?? 0) <= 4)),
    ice: coverage(glaciers.features),
    desert: coverage(pick((c, n) => c === 'Desert' && !DRY_NOT_DESERT.test(n))),
    dry: coverage(pick((c, n) => c === 'Desert' && DRY_NOT_DESERT.test(n))),
    highRange: coverage(pick((c, n) => c === 'Range/mtn' && HIGH_RANGE.test(n))),
    midRange: coverage(pick((c, n) => c === 'Range/mtn' && MID_RANGE.test(n))),
    hills: coverage(pick((c, n) => c === 'Range/mtn' && !HIGH_RANGE.test(n) && !MID_RANGE.test(n))),
    highPlateau: coverage(pick((c, n) => c === 'Plateau' && HIGH_PLATEAU.test(n))),
    plateau: coverage(pick((c, n) => (c === 'Plateau' || c === 'Foothills') && !HIGH_PLATEAU.test(n))),
    tundra: coverage(pick((c) => c === 'Tundra')),
  };

  const N = COLS * ROWS;
  const biome = new Array(N).fill('~');
  const height = new Uint8Array(N);
  const isLand = new Uint8Array(N);
  for (let i = 0; i < N; i++) isLand[i] = cov.land[i] >= 0.34 && cov.lake[i] < 0.5 ? 1 : 0;

  // Distance from the coast, in cells, for ice-sheet domes.
  const inland = new Uint8Array(N);
  for (let pass = 0; pass < 3; pass++) {
    const prev = inland.slice();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (!isLand[i]) continue;
      let all = true;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cc = (c + dc + COLS) % COLS;
        const rr = r + dr;
        if (rr < 0 || rr >= ROWS) continue;
        const j = rr * COLS + cc;
        if (!isLand[j] || (pass > 0 && prev[j] < pass)) all = false;
      }
      if (all) inland[i] = pass + 1;
    }
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (!isLand[i]) continue;
      const lat = LAT0 - (r + 0.5);
      const lon = LON0 + (c + 0.5);
      const n = fbm(c, r, 1);
      // Wobble the climate boxes so their edges are not straight lines.
      const la = lat + (fbm(c, r, 2) - 0.5) * 5;
      const lo = lon + (fbm(c, r, 3) - 0.5) * 7;

      let b = 'g';
      let h = 1;
      if (Math.abs(la) >= 66.5 || cov.tundra[i] > 0.3 || inBox(la, lo, [57, 90, -100, -74])) b = 'u';
      else if ((la > 50 && la < 68 && lo > -168 && lo < -54) || (la > 54 && la < 68 && lo > 22) || inBox(la, lo, [58, 70, 4, 32])) b = 't';
      else if (anyBox(la, lo, JUNGLE)) b = 'j';
      else if (anyBox(la, lo, ARID)) b = n > 0.62 ? 's' : 'd';
      else if (anyBox(la, lo, STEPPE)) b = 'p';
      else if (anyBox(la, lo, SAVANNA)) b = n > 0.68 ? 'g' : 's';
      else if (anyBox(la, lo, TEMPERATE)) b = n > 0.47 ? 'f' : 'g';
      if (b === 't' && inBox(la, lo, [49, 55, -115, -96])) b = 'p'; // Canadian prairies
      if (cov.dry[i] > 0.3) b = 's';
      if (cov.desert[i] > 0.3) b = 'd';

      if (cov.highPlateau[i] > 0.35) {
        b = 'h';
        h = 3;
      } else if (cov.plateau[i] > 0.4) {
        h = 2;
      }
      if (cov.hills[i] > 0.3) h = Math.max(h, 2);
      if (cov.midRange[i] > 0.3) {
        b = 'm';
        h = 3;
      }
      if (cov.highRange[i] > 0.25) {
        b = 'm';
        h = n > 0.5 ? 4 : 3;
      }
      if (cov.ice[i] > 0.4 || (lat >= 75 && n > 0.45)) {
        b = 'i';
        h = Math.max(h, inland[i] >= 2 ? 3 : 2);
      }
      if (b === 'm' && h >= 4) b = 'n'; // snow-capped peak
      biome[i] = b;
      height[i] = h;
    }
  }

  const rle = (chars) => {
    let out = '';
    for (let i = 0; i < chars.length; ) {
      let j = i;
      while (j < chars.length && chars[j] === chars[i]) j++;
      out += (j - i) + chars[i];
      i = j;
    }
    return out;
  };

  const counts = {};
  for (const b of biome) counts[b] = (counts[b] || 0) + 1;

  const world = {
    about:
      'Isometric World terrain: 1° cells from 78°N to 56°S, row by row from the north-west corner. ' +
      'Generated by tools/build-world.mjs from Natural Earth (public domain).',
    cols: COLS,
    rows: ROWS,
    lonWest: LON0,
    latNorth: LAT0,
    cellDegrees: 1,
    biomes: {
      '~': 'water',
      g: 'grassland',
      f: 'temperate forest',
      j: 'rainforest',
      t: 'boreal forest',
      p: 'steppe and prairie',
      s: 'savanna and dry grass',
      d: 'desert',
      u: 'tundra',
      i: 'ice',
      h: 'high plateau',
      m: 'mountains',
      n: 'snowy peaks',
    },
    // Run-length encoded, e.g. "12~3g" = 12 water cells then 3 grassland cells.
    biome: rle(biome),
    // Heights use letters so the run lengths stay readable: a = 0 (sea level) … e = 4.
    height: rle(Array.from(height, (h) => 'abcde'[h])),
  };
  await writeFile(OUT, JSON.stringify(world) + '\n');
  console.log(`Wrote ${OUT}`);
  console.log('Cells by biome:', counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
