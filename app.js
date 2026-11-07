/* Isometric World
   An isometric Earth with a pin for every isometric city map we could find.
   No build step: one <canvas>, plain JavaScript and two JSON files in data/. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ settings
  const DATA_URL = 'data/projects.json';
  const WORLD_URL = 'data/world.json';
  const BASE_TW = 16; // tile width (px) of the cached terrain picture
  const LEVEL = 0.17; // height of one terrain level, in tile widths
  const SLAB = 1.5; // depth of the earth slab under the board, in tile widths
  const MIN_TW = 1.5;
  const MAX_TW = 190;
  const CITY_TW = 10; // tile width (CSS px) from which places turn into little cities
  const DIRECT_TW = 46; // tile width (device px) from which terrain is drawn live
  const BIOMES = '~gfjtpsduihmnc'; // c = city ground, added at runtime
  const B = Object.fromEntries([...BIOMES].map((ch, i) => [ch, i]));
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');

  const TECHNIQUES = [
    { id: 'ai', label: 'AI-painted' },
    { id: 'data', label: 'Drawn from data' },
    { id: '3d', label: '3D diorama' },
    { id: 'classic', label: 'Classic' },
  ];
  const TECH_LABEL = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t.label]));
  const STATUS_LABEL = { wip: 'In progress', code: 'Code only' };

  // Terrain colours are read by the canvas, so they live here; the UI colours live in style.css.
  const PALETTES = {
    light: {
      water: ['#9ad7df', '#7cc3d9', '#65aecf', '#5299c1', '#4a8db7'],
      wave: 'rgba(255,255,255,0.45)',
      foam: 'rgba(255,255,255,0.8)',
      sand: '#ecdcab',
      fields: ['#a9c86d', '#cbca7d', '#b8d07c', '#d8c886', '#9dc46b', '#c4b46f'],
      tuft: ['rgba(52,96,36,0.38)', 'rgba(255,255,225,0.4)'],
      pave: '#d6d2c8',
      road: '#9e9b94',
      bshadow: 'rgba(25,38,48,0.2)',
      boardShadow: 'rgba(24,52,68,0.5)',
      cloud: { body: '#ffffff', under: '#dce6ee', alpha: 0.93, shadow: 'rgba(30,58,74,0.12)' },
      top: {
        g: '#93c46a', f: '#82b864', j: '#64a556', t: '#97b98c', p: '#c9cd84', s: '#d6c681', d: '#ebd297',
        u: '#bcc7ac', i: '#eef4f8', h: '#c1ac8c', m: '#a69887', n: '#a69887', c: '#c6c8ad',
      },
      side: {
        earth: ['#a97f57', '#8e6847'],
        rock: ['#8c7d6c', '#756757'],
        ice: ['#d3e1eb', '#b9cbd9'],
        sand: ['#d6b076', '#bc975f'],
        city: ['#b7ad9e', '#9c9282'],
      },
      slab: ['#64abcd', '#a37854', '#8a6343', '#6e5036'],
      peak: ['#c8beb1', '#a69a8c', '#8d8275', '#b6aa9c'],
      snow: ['#ffffff', '#e4ebf2'],
      tree: { f: ['#4f8d3f', '#6aa956'], j: ['#2f7b3b', '#47944d'], t: ['#4a7a58', '#649470'], s: ['#7b8e3a', '#97a74c'] },
      trunk: '#6d4b30',
      dune: 'rgba(176,135,74,0.55)',
      city: {
        roof: ['#f1ece2', '#e4ddcf', '#dcd3c3'],
        wall: [
          ['#f4f0e8', '#d9d1c3'],
          ['#d98f6b', '#b86f51'],
          ['#b9d7e6', '#8eb6cc'],
        ],
        window: '#5f6f7b',
        litShare: 0,
      },
      glow: null,
      pin: '#d6402b',
      pinStroke: '#ffffff',
      pinDim: '#9aa9b0',
      shadow: 'rgba(22,34,42,0.25)',
      label: { bg: 'rgba(247,248,245,0.93)', line: 'rgba(22,34,42,0.18)', ink: '#16222a', count: '#d6402b', dim: '#7d8b92' },
    },
    dark: {
      water: ['#1e4b69', '#173d58', '#12314a', '#0e283e', '#0b2134'],
      wave: 'rgba(160,200,230,0.18)',
      foam: 'rgba(160,205,235,0.38)',
      sand: '#6b6347',
      fields: ['#3e5b37', '#56583a', '#48603b', '#5d5b3d', '#3b5634', '#504b34'],
      tuft: ['rgba(0,0,0,0.28)', 'rgba(200,225,185,0.12)'],
      pave: '#3b3e42',
      road: '#28292d',
      bshadow: 'rgba(0,0,0,0.32)',
      boardShadow: 'rgba(0,0,0,0.65)',
      cloud: { body: '#3a4a5d', under: '#2a3848', alpha: 0.5, shadow: null },
      top: {
        g: '#35573a', f: '#2f5035', j: '#244629', t: '#3a5446', p: '#535839', s: '#5d5638', d: '#74643f',
        u: '#4b5448', i: '#a4b4c3', h: '#5e5243', m: '#544a40', n: '#544a40', c: '#3d423d',
      },
      side: {
        earth: ['#3f2f22', '#33271d'],
        rock: ['#463d35', '#3a322b'],
        ice: ['#8396a8', '#6f8295'],
        sand: ['#5f4f33', '#52442c'],
        city: ['#2f3236', '#26292d'],
      },
      slab: ['#163a55', '#3a2b1f', '#30231a', '#251b14'],
      peak: ['#6a5e52', '#544a40', '#463d35', '#5e5348'],
      snow: ['#c9d4df', '#aab7c4'],
      tree: { f: ['#213f27', '#2b5232'], j: ['#183a20', '#22492a'], t: ['#1f392b', '#2a4a37'], s: ['#4a5524', '#5a662d'] },
      trunk: '#2a1f17',
      dune: 'rgba(30,20,10,0.35)',
      city: {
        roof: ['#4b5663', '#424c58', '#3a434e'],
        wall: [
          ['#3b4551', '#2c343d'],
          ['#4a3a35', '#3a2d29'],
          ['#2f4250', '#253541'],
        ],
        window: '#ffcf6a',
        litShare: 0.62,
      },
      glow: 'rgba(255,186,90,',
      pin: '#ffbf47',
      pinStroke: '#1b1305',
      pinDim: '#4c5d6a',
      shadow: 'rgba(0,0,0,0.45)',
      label: { bg: 'rgba(15,25,35,0.9)', line: 'rgba(255,255,255,0.14)', ink: '#e6edf1', count: '#ffbf47', dim: '#6d7f8c' },
    },
  };

  // ------------------------------------------------------------------ state
  const state = {
    data: null,
    world: null,
    places: [],
    placeById: new Map(),
    rot: 0,
    cam: { x: 0, y: 0, tw: 4 },
    W: 0,
    H: 0,
    dpr: 1,
    theme: 'light',
    filter: 'all',
    query: '',
    sort: 'count',
    selected: null,
    hover: null,
    cache: null,
    pins: [],
    labels: new Map(),
    popSize: { w: 350, h: 320 },
    returnFocus: null,
    anim: null,
    raf: 0,
    pointer: null,
    fitted: false,
  };

  const $ = (id) => document.getElementById(id);
  const canvas = $('world');
  const ctx = canvas.getContext('2d');
  const stage = $('stage');

  // ------------------------------------------------------------------ helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const palette = () => PALETTES[state.theme];

  function hash2(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function seeded(str) {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  // Lighten (f > 0) or darken (f < 0) a #rrggbb colour.
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16;
    let g = (n >> 8) & 255;
    let b = n & 255;
    if (f >= 0) {
      r += (255 - r) * f;
      g += (255 - g) * f;
      b += (255 - b) * f;
    } else {
      r *= 1 + f;
      g *= 1 + f;
      b *= 1 + f;
    }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  function hostOf(url) {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/\/$/, '');
      return u.hostname.replace(/^www\./, '') + (path && path !== '/' ? path : '');
    } catch {
      return url;
    }
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function formatDate(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    if (d) return `${+d} ${MONTHS[+m - 1]} ${y}`;
    if (m) return `${MONTHS[+m - 1]} ${y}`;
    return y;
  }

  function formatLatLon(lat, lon, digits = 2) {
    const la = `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? 'N' : 'S'}`;
    const lo = `${Math.abs(lon).toFixed(digits)}°${lon >= 0 ? 'E' : 'W'}`;
    return `${la} ${lo}`;
  }

  // ------------------------------------------------------------------ the world grid
  function buildWorld(w) {
    const N = w.cols * w.rows;
    const biome = new Uint8Array(N);
    const height = new Uint8Array(N);
    let i = 0;
    for (const m of w.biome.matchAll(/(\d+)(\D)/g)) {
      const n = +m[1];
      biome.fill(B[m[2]] ?? B.g, i, i + n);
      i += n;
    }
    i = 0;
    for (const m of w.height.matchAll(/(\d+)(\D)/g)) {
      const n = +m[1];
      height.fill(Math.max(0, 'abcde'.indexOf(m[2])), i, i + n);
      i += n;
    }
    return { cols: w.cols, rows: w.rows, lon0: w.lonWest, lat0: w.latNorth, biome, height, depth: new Uint8Array(N) };
  }

  // Distance from each water cell to the nearest land, for shallow-to-deep colours.
  function computeDepth(w) {
    const { cols, rows, biome, depth } = w;
    depth.fill(0);
    let frontier = [];
    for (let i = 0; i < cols * rows; i++) if (biome[i] !== B['~']) frontier.push(i);
    for (let d = 1; d <= 5 && frontier.length; d++) {
      const next = [];
      for (const i of frontier) {
        const c = i % cols;
        const r = (i / cols) | 0;
        const nb = [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, r > 0 ? i - cols : -1, r < rows - 1 ? i + cols : -1];
        for (const j of nb) {
          if (j >= 0 && biome[j] === B['~'] && depth[j] === 0) {
            depth[j] = d;
            next.push(j);
          }
        }
      }
      frontier = next;
    }
    for (let i = 0; i < cols * rows; i++) if (biome[i] === B['~'] && depth[i] === 0) depth[i] = 6;
  }

  // ------------------------------------------------------------------ places
  function buildPlaces(projects) {
    const w = state.world;
    const byKey = new Map();
    for (const p of projects) {
      const key = `${p.place}|${p.country}`;
      let pl = byKey.get(key);
      if (!pl) {
        pl = { name: p.place, country: p.country, scope: p.scope || 'city', projects: [], lat: 0, lon: 0 };
        byKey.set(key, pl);
      }
      pl.projects.push(p);
    }
    const used = new Set();
    const places = [];
    for (const pl of byKey.values()) {
      let id = slug(pl.name);
      if (used.has(id)) id = `${id}-${slug(pl.country)}`;
      used.add(id);
      pl.id = id;
      pl.lat = pl.projects.reduce((a, p) => a + p.lat, 0) / pl.projects.length;
      pl.lon = pl.projects.reduce((a, p) => a + p.lon, 0) / pl.projects.length;
      pl.c = clamp(Math.floor(pl.lon - w.lon0), 0, w.cols - 1);
      pl.r = clamp(Math.floor(w.lat0 - pl.lat), 0, w.rows - 1);
      pl.cell = pl.r * w.cols + pl.c;
      pl.x = pl.c + 0.5; // the little city sits in the middle of its 1° tile
      pl.y = pl.r + 0.5;
      pl.projects.sort((a, b) => (a.launched || '9999').localeCompare(b.launched || '9999') || a.name.localeCompare(b.name));
      pl.newest = pl.projects.reduce((a, p) => ((p.launched || '') > a ? p.launched : a), '');
      pl.rank = CITY[id]?.rank ?? 3;
      pl.hay = pl.projects.map((p) => norm(`${pl.name} ${pl.country} ${p.name} ${p.by || ''} ${hostOf(p.url)} ${(p.tags || []).join(' ')}`));
      // City ground: paved, flat and never under water.
      w.biome[pl.cell] = B.c;
      w.height[pl.cell] = clamp(w.height[pl.cell], 1, 2);
      places.push(pl);
    }
    return places;
  }

  function projectMatches(pl, i) {
    const p = pl.projects[i];
    if (state.filter !== 'all' && p.technique !== state.filter) return false;
    const q = norm(state.query.trim());
    return !q || pl.hay[i].includes(q);
  }
  const matchCount = (pl) => pl.projects.reduce((n, _, i) => n + (projectMatches(pl, i) ? 1 : 0), 0);

  // ------------------------------------------------------------------ rotation and projection
  // Grid coordinates: x grows east (1 unit = 1° of longitude), y grows south (1° of latitude).
  // The view can turn in quarter steps; (u, v) are the turned grid axes. Iso units are tile widths.
  const dims = (k = state.rot) => (k % 2 ? [state.world.rows, state.world.cols] : [state.world.cols, state.world.rows]);

  function rot(x, y, k = state.rot) {
    const { cols, rows } = state.world;
    switch (k) {
      case 1: return [rows - y, x];
      case 2: return [cols - x, rows - y];
      case 3: return [y, cols - x];
      default: return [x, y];
    }
  }

  function unrot(u, v, k = state.rot) {
    const { cols, rows } = state.world;
    switch (k) {
      case 1: return [v, rows - u];
      case 2: return [cols - u, rows - v];
      case 3: return [cols - v, u];
      default: return [u, v];
    }
  }

  function toIso(x, y, lift) {
    const [u, v] = rot(x, y);
    return [(u - v) / 2, (u + v) / 4 - lift];
  }

  function isoToScreen(X, Y) {
    const c = state.cam;
    return [(X - c.x) * c.tw + state.W / 2, (Y - c.y) * c.tw + state.H / 2];
  }

  function screenToGrid(sx, sy, lift = LEVEL) {
    const c = state.cam;
    const X = (sx - state.W / 2) / c.tw + c.x;
    const Y = (sy - state.H / 2) / c.tw + c.y + lift;
    return unrot(2 * Y + X, 2 * Y - X);
  }

  // ------------------------------------------------------------------ terrain drawing
  function material(b) {
    if (b === B.d) return 'sand';
    if (b === B.i) return 'ice';
    if (b === B.m || b === B.n || b === B.h) return 'rock';
    return 'earth';
  }

  // Colours with three subtle variants per biome, so the ground reads as tiles.
  function makeSwatches(P) {
    const top = {};
    for (const ch of BIOMES) {
      if (ch === '~') continue;
      const base = P.top[ch];
      top[B[ch]] = [shade(base, -0.025), base, shade(base, 0.025)];
    }
    const water = P.water.map((c) => [c, shade(c, 0.012)]);
    return { top, water };
  }

  // Draws the turned grid cells [iu0, iu1) × [iv0, iv1). Iso point (X, Y) lands on (ox + X·s, oy + Y·s).
  function drawTerrain(g, s, ox, oy, iu0, iu1, iv0, iv1) {
    const w = state.world;
    const P = palette();
    const SW = makeSwatches(P);
    const k = state.rot;
    const [U, V] = dims();
    const { cols, biome, height, depth } = w;
    const L = LEVEL * s;

    const index = (iu, iv) => {
      if (iu < 0 || iv < 0 || iu >= U || iv >= V) return -1;
      const [x, y] = unrot(iu + 0.5, iv + 0.5, k);
      return Math.floor(y) * cols + Math.floor(x);
    };
    const hOf = (i) => (i < 0 ? 0 : height[i]);

    const paths = new Map();
    const pathFor = (color) => {
      let p = paths.get(color);
      if (!p) {
        p = new Path2D();
        paths.set(color, p);
      }
      return p;
    };
    const flush = () => {
      for (const [color, p] of paths) {
        g.fillStyle = color;
        g.fill(p);
      }
      paths.clear();
    };
    const diamond = (p, iu, iv, h) => {
      const x = ox + ((iu - iv) / 2) * s;
      const y = oy + ((iu + iv) / 4) * s - h * L;
      p.moveTo(x, y);
      p.lineTo(x + s / 2, y + s / 4);
      p.lineTo(x, y + s / 2);
      p.lineTo(x - s / 2, y + s / 4);
      p.closePath();
    };
    // Faces hang under the front two edges of a tile, from hTop down to hBot (in levels).
    const face = (p, iu, iv, hTop, hBot, right) => {
      const x = ox + ((iu - iv) / 2) * s;
      const y = oy + ((iu + iv) / 4) * s;
      const xs = x + (right ? s / 2 : -s / 2);
      const ys = y + s / 4;
      const xb = x;
      const yb = y + s / 2;
      p.moveTo(xs, ys - hTop * L);
      p.lineTo(xb, yb - hTop * L);
      p.lineTo(xb, yb - hBot * L);
      p.lineTo(xs, ys - hBot * L);
      p.closePath();
    };

    const isoPt = (u, v, h) => [ox + ((u - v) / 2) * s, oy + ((u + v) / 4) * s - h * L];
    // A rectangle in grid space (x east, y south), drawn flat at level h.
    const gridQuad = (p, x0, y0, x1, y1, h) => {
      const [ua, va] = rot(x0, y0, k);
      const [ub, vb] = rot(x1, y1, k);
      const u0 = Math.min(ua, ub);
      const u1 = Math.max(ua, ub);
      const v0 = Math.min(va, vb);
      const v1 = Math.max(va, vb);
      const a = isoPt(u0, v0, h);
      const b = isoPt(u1, v0, h);
      const c = isoPt(u1, v1, h);
      const d = isoPt(u0, v1, h);
      p.moveTo(a[0], a[1]);
      p.lineTo(b[0], b[1]);
      p.lineTo(c[0], c[1]);
      p.lineTo(d[0], d[1]);
      p.closePath();
    };
    // The same in turned-grid space, for strips along a tile's edges.
    const turnedQuad = (p, u0, v0, u1, v1, h) => {
      const a = isoPt(u0, v0, h);
      const b = isoPt(u1, v0, h);
      const c = isoPt(u1, v1, h);
      const d = isoPt(u0, v1, h);
      p.moveTo(a[0], a[1]);
      p.lineTo(b[0], b[1]);
      p.lineTo(c[0], c[1]);
      p.lineTo(d[0], d[1]);
      p.closePath();
    };
    const wet = (j) => j < 0 || biome[j] === B['~'];
    const detail = s >= 40;
    const BEACHY = new Set([B.g, B.f, B.j, B.p, B.s, B.d]);
    const FARMS = new Set([B.g, B.p]);
    const TUFTED = new Set([B.g, B.p, B.s, B.f, B.j, B.t, B.u]);
    const latOf = (r) => w.lat0 - (r + 0.5);
    const farmland = (c, r) => FARMS.has(biome[r * cols + c]) && Math.abs(latOf(r)) > 10 && Math.abs(latOf(r)) < 60 && hash2(c, r, 3) < 0.6;

    // Patchwork of four fields, with hedges between them.
    const farm = (c, r, h, pathOf) => {
      const m = 0.04;
      for (let q = 0; q < 4; q++) {
        const qx = (q & 1) * 0.5;
        const qy = (q >> 1) * 0.5;
        const color = P.fields[Math.floor(hash2(c * 2 + (q & 1), r * 2 + (q >> 1), 9) * P.fields.length)];
        gridQuad(pathOf(color), c + qx + m, r + qy + m, c + qx + 0.5 - m, r + qy + 0.5 - m, h);
      }
    };
    const tuftsOn = (c, r, h, paths2) => {
      const l = s * 0.03;
      for (let n = 0; n < 5; n++) {
        const [u, v] = rot(c + 0.12 + hash2(c, r, 50 + n) * 0.76, r + 0.12 + hash2(c, r, 60 + n) * 0.76, k);
        const [x, y] = isoPt(u, v, h);
        const t = paths2[n & 1];
        t.moveTo(x - l * 0.6, y);
        t.lineTo(x - l * 0.25, y - l * 1.1);
        t.moveTo(x, y);
        t.lineTo(x + l * 0.05, y - l * 1.5);
        t.moveTo(x + l * 0.6, y);
        t.lineTo(x + l * 0.3, y - l * 1.05);
      }
    };
    const strokeTufts = (paths2) => {
      g.lineCap = 'round';
      g.lineWidth = Math.max(0.8, s * 0.009);
      g.strokeStyle = P.tuft[0];
      g.stroke(paths2[0]);
      g.strokeStyle = P.tuft[1];
      g.stroke(paths2[1]);
    };

    // Pass 1: the sea, batched by colour, with small wave glints.
    const waves = new Path2D();
    const glint = detail ? 0.8 : 0.88;
    for (let iv = iv0; iv < iv1; iv++) {
      for (let iu = iu0; iu < iu1; iu++) {
        const i = index(iu, iv);
        if (i < 0 || biome[i] !== B['~']) continue;
        const c = i % cols;
        const r = (i / cols) | 0;
        const hv = hash2(c, r);
        diamond(pathFor(SW.water[Math.min(depth[i], 5) - 1][hv < 0.5 ? 0 : 1]), iu, iv, 0);
        if (depth[i] >= 2 && hv > glint) {
          const x = ox + ((iu - iv) / 2) * s + (hash2(c, r, 2) - 0.5) * s * 0.3;
          const y = oy + ((iu + iv) / 4 + 0.25) * s + (hash2(c, r, 4) - 0.5) * s * 0.12;
          const ww = s * 0.11;
          waves.moveTo(x - ww, y);
          waves.quadraticCurveTo(x - ww / 2, y - ww * 0.45, x, y);
          waves.quadraticCurveTo(x + ww / 2, y - ww * 0.45, x + ww, y);
        }
      }
    }
    flush();
    g.strokeStyle = P.wave;
    g.lineWidth = Math.max(0.8, s * 0.022);
    g.lineCap = 'round';
    g.stroke(waves);

    // Pass 2: lowland (level 1) with fields, beaches and surf, batched by colour.
    const fields = new Map();
    const fieldPath = (color) => {
      let p = fields.get(color);
      if (!p) {
        p = new Path2D();
        fields.set(color, p);
      }
      return p;
    };
    const sand = new Path2D();
    const foam = new Path2D();
    const tufts = [new Path2D(), new Path2D()];
    const surf = (iu, iv, right) => {
      const x = ox + ((iu - iv) / 2) * s;
      const y = oy + ((iu + iv) / 4) * s;
      const d = s * 0.035;
      foam.moveTo(x + (right ? s / 2 : -s / 2), y + s / 4 + d);
      foam.lineTo(x, y + s / 2 + d);
    };
    for (let iv = iv0; iv < iv1; iv++) {
      for (let iu = iu0; iu < iu1; iu++) {
        const i = index(iu, iv);
        if (i < 0 || height[i] !== 1) continue;
        const b = biome[i];
        const c = i % cols;
        const r = (i / cols) | 0;
        const hv = hash2(c, r, 1);
        diamond(pathFor(SW.top[b][hv < 0.33 ? 0 : hv < 0.66 ? 1 : 2]), iu, iv, 1);
        const beachy = BEACHY.has(b) && Math.abs(latOf(r)) < 56 && hash2(c, r, 7) < 0.85;
        const sides = beachy ? P.side.sand : P.side[material(b)];
        const jR = index(iu + 1, iv);
        const jL = index(iu, iv + 1);
        const hr = hOf(jR);
        const hl = hOf(jL);
        if (hr < 1) {
          face(pathFor(sides[1]), iu, iv, 1, hr, true);
          if (wet(jR)) surf(iu, iv, true);
        }
        if (hl < 1) {
          face(pathFor(sides[0]), iu, iv, 1, hl, false);
          if (wet(jL)) surf(iu, iv, false);
        }
        if (farmland(c, r)) farm(c, r, 1, fieldPath);
        if (beachy) {
          const m = 0.2;
          if (wet(index(iu, iv - 1))) turnedQuad(sand, iu, iv, iu + 1, iv + m, 1);
          if (wet(jR)) turnedQuad(sand, iu + 1 - m, iv, iu + 1, iv + 1, 1);
          if (wet(jL)) turnedQuad(sand, iu, iv + 1 - m, iu + 1, iv + 1, 1);
          if (wet(index(iu - 1, iv))) turnedQuad(sand, iu, iv, iu + m, iv + 1, 1);
        }
        if (detail && TUFTED.has(b)) tuftsOn(c, r, 1, tufts);
      }
    }
    flush();
    for (const [color, p] of fields) {
      g.fillStyle = color;
      g.fill(p);
    }
    g.fillStyle = P.sand;
    g.fill(sand);
    if (detail) strokeTufts(tufts);
    g.strokeStyle = P.foam;
    g.lineWidth = Math.max(1, s * 0.03);
    g.lineCap = 'round';
    g.stroke(foam);

    // Pass 3: everything that stands up (hills, mountains, ice, trees), back to front.
    const tree = (x, y, kind, size) => {
      const [dark, light] = P.tree[kind];
      if (kind === 't') {
        const hgt = size * 2.3;
        g.fillStyle = dark;
        g.beginPath();
        g.moveTo(x, y - hgt);
        g.lineTo(x + size * 0.85, y);
        g.lineTo(x - size * 0.85, y);
        g.closePath();
        g.fill();
        g.fillStyle = light;
        g.beginPath();
        g.moveTo(x, y - hgt);
        g.lineTo(x - size * 0.85, y);
        g.lineTo(x - size * 0.1, y);
        g.closePath();
        g.fill();
        return;
      }
      if (kind === 's') {
        g.fillStyle = P.trunk;
        g.fillRect(x - size * 0.08, y - size * 1.1, Math.max(1, size * 0.16), size * 1.1);
        g.fillStyle = dark;
        g.beginPath();
        g.ellipse(x, y - size * 1.15, size * 1.05, size * 0.38, 0, 0, Math.PI * 2);
        g.fill();
        return;
      }
      g.fillStyle = P.trunk;
      g.fillRect(x - size * 0.1, y - size * 0.8, Math.max(1, size * 0.2), size * 0.8);
      g.fillStyle = dark;
      g.beginPath();
      g.ellipse(x, y - size * 1.25, size * 0.95, size * 0.85, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = light;
      g.beginPath();
      g.ellipse(x - size * 0.28, y - size * 1.45, size * 0.48, size * 0.42, 0, 0, Math.PI * 2);
      g.fill();
    };

    // One to three peaks per mountain tile, of different sizes, so ranges read as ridges.
    const peaks = (c, r, h, snowy) => {
      const count = 1 + Math.floor(hash2(c, r, 70) * 2.6);
      const list = [];
      for (let n = 0; n < count; n++) {
        const spread = count > 1 ? 0.5 : 0.14;
        const fx = 0.5 + (hash2(c, r, 71 + n) - 0.5) * spread;
        const fy = 0.5 + (hash2(c, r, 81 + n) - 0.5) * spread;
        const half = (count > 1 ? 0.25 : 0.4) * (0.8 + hash2(c, r, 91 + n) * 0.4);
        const ph = (snowy ? 0.36 : 0.22) * (0.65 + hash2(c, r, 101 + n) * 0.75) * (count > 1 ? 0.85 : 1);
        const [u, v] = rot(c + fx, r + fy, k);
        list.push({ u, v, half, ph });
      }
      list.sort((p, q) => p.u + p.v - (q.u + q.v));
      const capped = snowy || Math.abs(latOf(r)) > 42;
      for (const { u, v, half, ph } of list) {
        const T = isoPt(u - half, v - half, h);
        const Rt = isoPt(u + half, v - half, h);
        const Bt = isoPt(u + half, v + half, h);
        const Lf = isoPt(u - half, v + half, h);
        const base = isoPt(u, v, h);
        const A = [base[0], base[1] - ph * s];
        tri(g, Lf, T, A, P.peak[3]);
        tri(g, T, Rt, A, P.peak[2]);
        tri(g, Lf, Bt, A, P.peak[0]);
        tri(g, Bt, Rt, A, P.peak[1]);
        if (capped && ph > 0.2) {
          const cap = (q) => [lerp(A[0], q[0], 0.42), lerp(A[1], q[1], 0.42)];
          const cL = cap(Lf);
          const cB = cap(Bt);
          const cR = cap(Rt);
          tri(g, A, cL, [cB[0], cB[1] - s * 0.025], P.snow[0]);
          tri(g, A, [cB[0], cB[1] - s * 0.025], cR, P.snow[1]);
        }
      }
    };

    const fill = (draw, color) => {
      const p = new Path2D();
      draw(p);
      g.fillStyle = color;
      g.fill(p);
    };

    const treeSize = s * 0.085;
    for (let iv = iv0; iv < iv1; iv++) {
      for (let iu = iu0; iu < iu1; iu++) {
        const i = index(iu, iv);
        if (i < 0) continue;
        const b = biome[i];
        if (b === B['~']) continue;
        const h = height[i];
        const c = i % cols;
        const r = (i / cols) | 0;
        if (h >= 2) {
          const hv = hash2(c, r, 1);
          const beachy = BEACHY.has(b) && Math.abs(latOf(r)) < 56 && hash2(c, r, 7) < 0.85;
          const sides = beachy ? P.side.sand : P.side[material(b)];
          fill((p) => diamond(p, iu, iv, h), SW.top[b][hv < 0.33 ? 0 : hv < 0.66 ? 1 : 2]);
          const jR = index(iu + 1, iv);
          const jL = index(iu, iv + 1);
          const hr = hOf(jR);
          const hl = hOf(jL);
          if (hr < h) fill((p) => face(p, iu, iv, h, hr, true), wet(jR) ? sides[1] : P.side[material(b)][1]);
          if (hl < h) fill((p) => face(p, iu, iv, h, hl, false), wet(jL) ? sides[0] : P.side[material(b)][0]);
          if (beachy) {
            const m = 0.2;
            const strip = new Path2D();
            if (wet(index(iu, iv - 1))) turnedQuad(strip, iu, iv, iu + 1, iv + m, h);
            if (wet(jR)) turnedQuad(strip, iu + 1 - m, iv, iu + 1, iv + 1, h);
            if (wet(jL)) turnedQuad(strip, iu, iv + 1 - m, iu + 1, iv + 1, h);
            if (wet(index(iu - 1, iv))) turnedQuad(strip, iu, iv, iu + m, iv + 1, h);
            g.fillStyle = P.sand;
            g.fill(strip);
          }
          if (wet(jR) || wet(jL)) {
            const x = ox + ((iu - iv) / 2) * s;
            const y = oy + ((iu + iv) / 4) * s;
            const d = s * 0.035;
            g.strokeStyle = P.foam;
            g.lineWidth = Math.max(1, s * 0.03);
            g.lineCap = 'round';
            g.beginPath();
            if (wet(jR)) {
              g.moveTo(x + s / 2, y + s / 4 + d);
              g.lineTo(x, y + s / 2 + d);
            }
            if (wet(jL)) {
              g.moveTo(x - s / 2, y + s / 4 + d);
              g.lineTo(x, y + s / 2 + d);
            }
            g.stroke();
          }
          if (farmland(c, r)) {
            const local = new Map();
            farm(c, r, h, (color) => local.get(color) || local.set(color, new Path2D()).get(color));
            for (const [color, p] of local) {
              g.fillStyle = color;
              g.fill(p);
            }
          }
          if (detail && TUFTED.has(b)) {
            const local = [new Path2D(), new Path2D()];
            tuftsOn(c, r, h, local);
            strokeTufts(local);
          }
          if (b === B.m || b === B.n) peaks(c, r, h, b === B.n);
        }
        const kind = b === B.f ? 'f' : b === B.j ? 'j' : b === B.t ? 't' : b === B.s ? 's' : '';
        if (kind) {
          const density = kind === 'j' ? 0.95 : kind === 't' ? 0.55 : kind === 'f' ? 0.75 : 0.16;
          const count = kind === 'j' ? 2 : kind === 's' ? 1 : 2;
          for (let n = 0; n < count; n++) {
            if (hash2(c, r, 10 + n) > density) continue;
            const fx = 0.22 + hash2(c, r, 20 + n) * 0.56;
            const fy = 0.22 + hash2(c, r, 30 + n) * 0.56;
            const [u, v] = rot(c + fx, r + fy, k);
            const x = ox + ((u - v) / 2) * s;
            const y = oy + ((u + v) / 4) * s - h * L;
            tree(x, y, kind, treeSize * (0.85 + hash2(c, r, 40 + n) * 0.4));
          }
        } else if (b === B.d && hash2(c, r, 11) < 0.28) {
          const [u, v] = rot(c + 0.5, r + 0.5, k);
          const x = ox + ((u - v) / 2) * s;
          const y = oy + ((u + v) / 4) * s - h * L;
          g.strokeStyle = P.dune;
          g.lineWidth = Math.max(0.8, s * 0.04);
          g.beginPath();
          g.moveTo(x - s * 0.16, y + s * 0.02);
          g.quadraticCurveTo(x - s * 0.05, y - s * 0.07, x + s * 0.06, y);
          g.moveTo(x - s * 0.02, y + s * 0.09);
          g.quadraticCurveTo(x + s * 0.08, y + s * 0.01, x + s * 0.18, y + s * 0.07);
          g.stroke();
        }
      }
    }
  }

  // The earth slab under the board's two front edges, with a band of sea at the top.
  function drawSlab(g, s, ox, oy) {
    const P = palette();
    const [U, V] = dims();
    const w = state.world;
    const pt = (u, v, depthTW) => [ox + ((u - v) / 2) * s, oy + ((u + v) / 4 + depthTW) * s];
    const bands = [
      [0, 0.32, P.slab[0]],
      [0.32, 0.72, P.slab[1]],
      [0.72, 1.1, P.slab[2]],
      [1.1, SLAB, P.slab[3]],
    ];
    const quad = (a, b, c, d, color) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.lineTo(c[0], c[1]);
      g.lineTo(d[0], d[1]);
      g.closePath();
      g.fill();
    };
    for (const [d0, d1, color] of bands) {
      // right face along u = U, left face along v = V; the right one is in shade
      quad(pt(U, 0, d0), pt(U, V, d0), pt(U, V, d1), pt(U, 0, d1), shade(color, -0.16));
      quad(pt(0, V, d0), pt(U, V, d0), pt(U, V, d1), pt(0, V, d1), color);
    }
    // Under coastal land at the board's edge, the top band is earth, not sea.
    const earth = P.side.earth;
    for (let iv = 0; iv < V; iv++) {
      const [x, y] = unrot(U - 0.5, iv + 0.5);
      if (w.biome[Math.floor(y) * w.cols + Math.floor(x)] !== B['~']) {
        quad(pt(U, iv, 0), pt(U, iv + 1, 0), pt(U, iv + 1, 0.32), pt(U, iv, 0.32), earth[1]);
      }
    }
    for (let iu = 0; iu < U; iu++) {
      const [x, y] = unrot(iu + 0.5, V - 0.5);
      if (w.biome[Math.floor(y) * w.cols + Math.floor(x)] !== B['~']) {
        quad(pt(iu, V, 0), pt(iu + 1, V, 0), pt(iu + 1, V, 0.32), pt(iu, V, 0.32), earth[0]);
      }
    }
  }

  function buildCache() {
    const [U, V] = dims();
    const s = BASE_TW;
    const side = 44; // room for the board's shadow
    const below = 90;
    const top = 1.6; // room above sea level for the highest peaks, in tile widths
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(((U + V) / 2) * s + side * 2);
    cv.height = Math.ceil(((U + V) / 4 + top + SLAB) * s + 8 + below);
    const g = cv.getContext('2d');
    const ox = side + (V / 2) * s;
    const oy = 8 + top * s;
    // The board floats a little above the page: a soft shadow under its silhouette.
    const pt = (u, v, d) => [ox + ((u - v) / 2) * s, oy + ((u + v) / 4 + d) * s];
    g.save();
    g.shadowColor = palette().boardShadow;
    g.shadowBlur = 36;
    g.shadowOffsetY = 30;
    g.fillStyle = palette().slab[3];
    g.beginPath();
    [pt(0, 0, 0), pt(U, 0, 0), pt(U, 0, SLAB), pt(U, V, SLAB), pt(0, V, SLAB), pt(0, V, 0)].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.restore();
    drawSlab(g, s, ox, oy);
    drawTerrain(g, s, ox, oy, 0, U, 0, V);
    state.cache = { canvas: cv, ox, oy, s };
  }

  // ------------------------------------------------------------------ little cities
  // Every place is drawn as a tiny city: generic buildings in a local style, plus a landmark
  // built from simple isometric solids. Local coordinates: dx, dy in grid units (one tile = 1)
  // from the middle of the place's tile; z and heights in tile widths above the ground.

  // Map hierarchy: 1 = megacity, 2 = major city, 3 = smaller city, 4 = town or small region.
  // Bigger places get bigger little cities, pins, glows and labels, and win label collisions.
  const RANK_SCALE = { 1: 1, 2: 0.86, 3: 0.7, 4: 0.56 };
  const RANK_DENSITY = { 1: 6, 2: 2, 3: -3, 4: -6 };
  const RANK_TALL = { 1: 1.25, 2: 1, 3: 0.8, 4: 0.65 };
  const RANK_PIN = { 1: 1.2, 2: 1, 3: 0.85, 4: 0.75 };
  const RANK_GLOW = { 1: 1.5, 2: 1.15, 3: 0.85, 4: 0.6 };
  const RANK_FONT = { 1: 20, 2: 17.5, 3: 15.5, 4: 14 };

  const STYLES = {
    glass: { walls: ['#a2c0d3', '#88a9bf', '#bdd0dc', '#d7dee3', '#7a97ad'], min: 0.2, max: 0.6, n: 14, a: 0.06 },
    concrete: { walls: ['#d9d3c7', '#c8c1b3', '#e7e1d5', '#b8b1a3', '#a9b9c4'], min: 0.15, max: 0.48, n: 15, a: 0.06 },
    paris: { walls: ['#efe5cf', '#e8dcc1', '#f3ebdb'], roofs: ['#7c8897', '#6f7b8a'], min: 0.12, max: 0.16, n: 17, a: 0.068 },
    oldtown: { walls: ['#efe0c2', '#ead1a6', '#f4e9d5', '#e1c497'], roofs: ['#c4613c', '#b4573a', '#cf7a4e'], min: 0.07, max: 0.16, n: 17, a: 0.066 },
    brick: { walls: ['#b8644b', '#a5573f', '#c77a5c', '#93503c', '#d4c7b0'], roofs: ['#5b5450', '#4f4946'], min: 0.1, max: 0.26, n: 15, a: 0.06 },
    canal: { walls: ['#8f4a37', '#b8644b', '#3f3a37', '#e9e2d4', '#5f6f63', '#c99a6b'], roofs: ['#3f3a37', '#55504c'], min: 0.12, max: 0.17, n: 22, a: 0.034, b: 0.06, steep: true, step: 0.11 },
    colorful: { walls: ['#ecbf4f', '#e07a5f', '#81b29a', '#f2cc8f', '#6fa8cc', '#d97aa8'], roofs: ['#c4613c', '#b4573a'], min: 0.07, max: 0.19, n: 16, a: 0.062 },
    whitemed: { walls: ['#f6f3ec', '#eee8dc', '#f1ead7', '#e9dfc9'], min: 0.06, max: 0.14, n: 16, a: 0.066 },
    nordic: { walls: ['#d9a441', '#c4572d', '#e8c07d', '#b9583b', '#efe2c4'], roofs: ['#6aa58e', '#5b9580', '#7a6e66'], min: 0.1, max: 0.2, n: 14, a: 0.062 },
    pastel: { walls: ['#f2d0a9', '#e9c46a', '#a8dadc', '#f4a261', '#ece8df', '#c9e4ca'], min: 0.08, max: 0.3, n: 14, a: 0.06 },
    tropical: { walls: ['#ece8df', '#f2d0a9', '#a2c0d3', '#d9d3c7', '#c9e4ca'], min: 0.1, max: 0.46, n: 14, a: 0.06, palms: 4 },
    smalltown: { walls: ['#f4f0e7', '#ead9b5', '#dbe5ec', '#f1d4c5'], roofs: ['#b5573a', '#7e6b5d', '#c4613c'], min: 0.045, max: 0.075, n: 12, a: 0.055, trees: 7 },
    modernist: { walls: ['#f4f4f2', '#e8e8e4'], min: 0.06, max: 0.2, n: 6, a: 0.07 },
    asia: { walls: ['#d5dde3', '#b9c9d6', '#e8ecef', '#9fb4c4', '#f0e6dc'], min: 0.2, max: 0.66, n: 16, a: 0.055 },
    ottoman: { walls: ['#efe4cf', '#e6d6b8', '#f2ead9'], roofs: ['#c4613c', '#b55737'], min: 0.06, max: 0.13, n: 15, a: 0.064 },
    steppe: { walls: ['#f1ece0', '#e3dccb', '#d6e2e8', '#c9d9e0'], min: 0.1, max: 0.3, n: 13, a: 0.062 },
    sprawl: { walls: ['#f1e6d2', '#e7d3b5', '#dfe6ea', '#f4efe6'], min: 0.04, max: 0.08, n: 15, a: 0.06, palms: 6 },
    woods: { walls: ['#a7744f', '#8f6748'], roofs: ['#5b4b3f'], min: 0.04, max: 0.05, n: 3, a: 0.04, trees: 18, conifers: true },
    lowmodern: { walls: ['#e9e4da', '#d8d3c8', '#c9d4db'], min: 0.05, max: 0.11, n: 9, a: 0.066, trees: 6 },
  };

  // Records the parts of a city; drawScene() replays them for the current rotation and zoom.
  function recorder() {
    const items = [];
    const blocked = [];
    let anchor = null;
    const blockRect = (x0, y0, x1, y1) => blocked.push([x0, y0, x1, y1]);
    const blockR = (x, y, r) => blockRect(x - r, y - r, x + r, y + r);
    const push = (t, dx, dy, o) => items.push({ t, dx, dy, o, at: anchor || [dx, dy] });
    const K = {
      group(dx, dy, fn) {
        anchor = [dx, dy];
        fn();
        anchor = null;
      },
      clear: blockR,
      flat(dx, dy, w, d, color) {
        items.push({ t: 'flat', dx, dy, o: { w, d, color }, at: [dx, dy], flat: true });
        blockRect(dx - w / 2, dy - d / 2, dx + w / 2, dy + d / 2);
      },
      box(dx, dy, w, d, h, o = {}) {
        push('box', dx, dy, { w, d, h, ...o });
        blockRect(dx - w / 2 - 0.03, dy - d / 2 - 0.03, dx + w / 2 + 0.03, dy + d / 2 + 0.03);
      },
      pyr(dx, dy, w, d, h, o = {}) {
        push('pyr', dx, dy, { w, d, h, ...o });
        blockRect(dx - w / 2 - 0.03, dy - d / 2 - 0.03, dx + w / 2 + 0.03, dy + d / 2 + 0.03);
      },
      cyl(dx, dy, r, h, o = {}) { push('cyl', dx, dy, { r, h, ...o }); blockR(dx, dy, r + 0.03); },
      cone(dx, dy, r, h, o = {}) { push('cone', dx, dy, { r, h, ...o }); blockR(dx, dy, r + 0.03); },
      dome(dx, dy, r, o = {}) { push('dome', dx, dy, { r, ...o }); blockR(dx, dy, r + 0.03); },
      bowl(dx, dy, r, o = {}) { push('bowl', dx, dy, { r, ...o }); blockR(dx, dy, r + 0.03); },
      sphere(dx, dy, r, o = {}) { push('sphere', dx, dy, { r, ...o }); },
      ring(dx, dy, r, h, o = {}) { push('ring', dx, dy, { r, h, ...o }); blockR(dx, dy, r + 0.03); },
      hill(dx, dy, r, h, o = {}) { push('hill', dx, dy, { r, h, ...o }); blockR(dx, dy, r); },
      line(pts, o = {}) { push('line', pts[0][0], pts[0][1], { pts, ...o }); },
      wheel(dx, dy, r, o = {}) { push('wheel', dx, dy, { r, ...o }); blockR(dx, dy, 0.07); },
      bridge(x0, y0, x1, y1, o = {}) {
        items.push({ t: 'bridge', dx: (x0 + x1) / 2, dy: (y0 + y1) / 2, o: { x0, y0, x1, y1, ...o }, at: [(x0 + x1) / 2, (y0 + y1) / 2] });
      },
      tree(dx, dy, kind = 'f', size = 1) { push('tree', dx, dy, { kind, size }); blockR(dx, dy, 0.035); },
      figure(dx, dy, z, h, color, kind = 'statue') { push('figure', dx, dy, { z, h, color, kind }); },
      balloon(dx, dy, z, r, color) { push('balloon', dx, dy, { z, r, color }); },
      gem(dx, dy, s, o = {}) { push('gem', dx, dy, { s, ...o }); blockR(dx, dy, s); },
      plane(dx, dy, z) { push('plane', dx, dy, { z }); },
      cow(dx, dy) { push('cow', dx, dy, {}); blockR(dx, dy, 0.03); },
      light(dx, dy, z) { items.push({ t: 'light', dx, dy, o: { z }, at: [dx, dy], last: true }); },
    };
    return { K, items, blocked };
  }

  // ---- composite landmarks
  const domeTop = (r) => (r * 0.95) / Math.SQRT2;

  function tvTower(K, dx, dy, o) {
    const z = o.z || 0;
    const h = o.h;
    const top = z + h + (o.antenna ?? 0.3);
    K.group(dx, dy, () => {
      if (o.legs) for (const [lx, ly] of [[-0.06, -0.03], [0.06, -0.03], [0, 0.06]]) K.line([[dx + lx, dy + ly, z], [dx, dy, z + h * 0.32]], { color: o.color, w: 2.4 });
      K.cyl(dx, dy, o.r || 0.024, h, { z, color: o.color });
      const pz = z + h * (o.podAt || 0.8);
      if (o.pod === 'sphere') K.sphere(dx, dy, o.podR || 0.07, { z: pz, color: o.podColor || o.color });
      else K.cyl(dx, dy, o.podR || 0.065, 0.045, { z: pz, color: o.podColor || o.color });
      K.line([[dx, dy, z + h], [dx, dy, top]], { color: o.antennaColor || o.color, w: 2 });
      K.light(dx, dy, top);
    });
  }

  function lattice(K, dx, dy, o) {
    const { h, base: b, color } = o;
    K.group(dx, dy, () => {
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        K.line([[dx + sx * b, dy + sy * b, 0], [dx + sx * b * 0.5, dy + sy * b * 0.5, h * 0.28], [dx + sx * b * 0.2, dy + sy * b * 0.2, h * 0.6], [dx, dy, h]], { color, w: 3.2 });
      }
      K.box(dx, dy, b * 1.3, b * 1.3, 0.02, { z: h * 0.28, color: o.deck || color });
      K.box(dx, dy, b * 0.6, b * 0.6, 0.018, { z: h * 0.6, color: o.deck || color });
      K.line([[dx, dy, h], [dx, dy, h + 0.12]], { color, w: 1.6 });
      K.light(dx, dy, h + 0.12);
    });
  }

  function mosque(K, dx, dy, o) {
    const w = o.w || 0.22;
    const r = o.dome || 0.1;
    K.group(dx, dy, () => {
      K.box(dx, dy, w, w, 0.09, { color: o.color });
      K.box(dx, dy, w * 0.62, w * 0.62, 0.05, { z: 0.09, color: o.color });
      K.dome(dx, dy, r, { z: 0.14, color: o.domeColor });
      K.line([[dx, dy, 0.14 + domeTop(r)], [dx, dy, 0.14 + domeTop(r) + 0.05]], { color: '#d9b44a', w: 1.6 });
    });
    const m = w * 0.66;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]].slice(0, o.minarets || 4)) {
      const mx = dx + sx * m;
      const my = dy + sy * m;
      K.group(mx, my, () => {
        K.cyl(mx, my, 0.014, o.mh, { color: o.color });
        K.cone(mx, my, 0.018, 0.08, { z: o.mh, color: o.domeColor });
      });
    }
  }

  function churchTower(K, dx, dy, o) {
    K.group(dx, dy, () => {
      K.box(dx, dy, o.w || 0.06, o.w || 0.06, o.h, { color: o.color });
      if (o.spire) K.cone(dx, dy, (o.w || 0.06) * 0.55, o.spire, { z: o.h, color: o.spireColor || o.color });
      else K.pyr(dx, dy, (o.w || 0.06) * 1.05, (o.w || 0.06) * 1.05, o.cap || 0.08, { z: o.h, color: o.spireColor || o.color });
    });
  }

  function stepped(K, dx, dy, tiers, o) {
    K.group(dx, dy, () => {
      let z = 0;
      for (const [w, h] of tiers) {
        K.box(dx, dy, w, w, h, { z, color: o.color, windows: o.windows });
        z += h;
      }
      if (o.spire) {
        K.line([[dx, dy, z], [dx, dy, z + o.spire]], { color: o.spireColor || o.color, w: 2 });
        K.light(dx, dy, z + o.spire);
      }
    });
  }

  function palms(K, spots) {
    for (const [x, y] of spots) K.tree(x, y, 'palm', 1);
  }

  const WATER = 'water';
  const SAND = '#ead8a6';
  const PARK = '#7fb35e';
  const ROAD = '#8f8e88';
  const PLAZA = '#ddd5c3';

  // One entry per place id (the slug of its name): a building style and a landmark.
  const CITY = {
    'new-york': { rank: 1, style: 'glass', tall: 1.3, landmark: 'Empire State Building and the Statue of Liberty', mark(K) {
      K.flat(0.27, 0.3, 0.3, 0.24, WATER);
      stepped(K, -0.03, -0.05, [[0.13, 0.42], [0.09, 0.16], [0.05, 0.1]], { color: '#d4cbb8', spire: 0.2, windows: true });
      K.group(0.27, 0.32, () => {
        K.box(0.27, 0.32, 0.06, 0.06, 0.05, { color: '#b8a888' });
        K.figure(0.27, 0.32, 0.05, 0.13, '#6aa58f', 'torch');
      });
    } },
    london: { rank: 1, style: 'brick', landmark: 'Elizabeth Tower, the Shard and the London Eye', mark(K) {
      K.flat(0, 0.33, 0.9, 0.09, WATER);
      churchTower(K, -0.2, 0.16, { w: 0.06, h: 0.42, color: '#c8a76b', cap: 0.12, spireColor: '#47584b' });
      K.pyr(0.14, -0.12, 0.15, 0.15, 0.95, { color: '#a9c6d6' });
      K.light(0.14, -0.12, 0.95);
      K.wheel(0.12, 0.22, 0.12, { color: '#e9ecef' });
    } },
    paris: { rank: 1, style: 'paris', landmark: 'Eiffel Tower over Haussmann roofs', mark(K) {
      K.flat(0, 0.3, 0.9, 0.07, WATER);
      K.flat(0, 0.03, 0.3, 0.3, PARK);
      lattice(K, 0, 0.03, { h: 0.95, base: 0.11, color: '#8b6c4e' });
    } },
    rome: { rank: 2, style: 'oldtown', landmark: 'the Colosseum and the dome of St. Peter’s', mark(K) {
      K.ring(0, 0.02, 0.19, 0.15, { color: '#d9c39b', inner: '#8f7553' });
      K.group(-0.26, -0.24, () => {
        K.box(-0.26, -0.24, 0.13, 0.13, 0.08, { color: '#e3d8c3' });
        K.dome(-0.26, -0.24, 0.065, { z: 0.08, color: '#cfc6b5' });
      });
    } },
    berlin: { rank: 2, style: 'concrete', landmark: 'the Fernsehturm and the Brandenburg Gate', mark(K) {
      tvTower(K, 0.03, -0.03, { h: 0.95, pod: 'sphere', podR: 0.075, color: '#e0e3e6', podColor: '#c3c9cf', antennaColor: '#d9534f', antenna: 0.32 });
      K.group(-0.24, 0.22, () => {
        K.box(-0.24, 0.22, 0.18, 0.045, 0.12, { color: '#ddd0ae', cols: 5 });
        K.box(-0.24, 0.22, 0.2, 0.06, 0.03, { z: 0.12, color: '#ddd0ae' });
        K.box(-0.24, 0.22, 0.04, 0.025, 0.03, { z: 0.15, color: '#5f8f7c' });
      });
    } },
    toronto: { rank: 2, style: 'glass', tall: 1.2, landmark: 'the CN Tower and the Rogers Centre', mark(K) {
      K.flat(0, 0.34, 0.9, 0.1, WATER);
      tvTower(K, 0, -0.02, { h: 1.2, podAt: 0.78, podR: 0.08, color: '#d9d4ca', antenna: 0.42 });
      K.dome(0.25, 0.18, 0.13, { color: '#e3e7ea', squash: 0.45 });
    } },
    'san-francisco': { rank: 2, style: 'glass', tall: 0.9, landmark: 'the Golden Gate Bridge and the Transamerica Pyramid', mark(K) {
      K.flat(0.1, 0.34, 0.8, 0.14, WATER);
      K.pyr(-0.12, -0.1, 0.1, 0.1, 0.85, { color: '#eef0f0' });
      K.light(-0.12, -0.1, 0.85);
      K.bridge(-0.4, 0.34, 0.4, 0.34, { kind: 'suspension', z: 0.05, h: 0.42, color: '#c8432f' });
    } },
    'sao-paulo': { rank: 1, style: 'concrete', tall: 1.25, landmark: 'MASP on Avenida Paulista and the Banespa tower', mark(K) {
      K.group(0.22, 0.22, () => {
        K.box(0.22, 0.22, 0.22, 0.08, 0.05, { z: 0.09, color: '#6f7378' });
        K.box(0.1, 0.22, 0.025, 0.09, 0.16, { color: '#d0342c' });
        K.box(0.34, 0.22, 0.025, 0.09, 0.16, { color: '#d0342c' });
        K.box(0.22, 0.22, 0.27, 0.09, 0.025, { z: 0.14, color: '#d0342c' });
      });
      stepped(K, -0.1, -0.12, [[0.1, 0.42], [0.065, 0.14]], { color: '#d8cfbb', spire: 0.18 });
    } },
    'rio-de-janeiro': { rank: 1, style: 'pastel', tall: 0.9, landmark: 'Christ the Redeemer on Corcovado and Sugarloaf Mountain', mark(K) {
      K.flat(0.05, 0.36, 0.86, 0.08, SAND);
      K.group(-0.2, -0.18, () => {
        K.hill(-0.2, -0.18, 0.19, 0.27, { color: '#4f8d4a' });
        K.figure(-0.2, -0.18, 0.27, 0.13, '#f4f4f2', 'cross');
      });
      K.hill(0.26, 0.2, 0.1, 0.2, { color: '#7a876c' });
      palms(K, [[-0.1, 0.3], [0.05, 0.3], [0.18, 0.3]]);
    } },
    barcelona: { rank: 2, style: 'oldtown', landmark: 'the Sagrada Família', mark(K) {
      K.group(0, 0, () => {
        K.box(0, 0, 0.17, 0.11, 0.1, { color: '#cdb98f' });
        for (const [x, y, h] of [[-0.055, -0.03, 0.45], [-0.02, 0.035, 0.5], [0.02, -0.035, 0.5], [0.055, 0.03, 0.45]]) K.cone(x, y, 0.022, h, { z: 0.1, color: '#cdb98f' });
        K.cone(0, 0, 0.03, 0.72, { z: 0.1, color: '#d6c39b' });
        K.light(0, 0, 0.82);
      });
    } },
    istanbul: { rank: 1, style: 'ottoman', landmark: 'a domed mosque with minarets and the Galata Tower', mark(K) {
      K.flat(0.31, 0.12, 0.12, 0.8, WATER);
      mosque(K, -0.04, -0.02, { w: 0.22, dome: 0.11, mh: 0.46, color: '#e3dbc9', domeColor: '#8796a5' });
      K.group(0.17, -0.27, () => {
        K.cyl(0.17, -0.27, 0.035, 0.25, { color: '#cfbf9f' });
        K.cone(0.17, -0.27, 0.042, 0.13, { z: 0.25, color: '#5d6b78' });
      });
    } },
    edirne: { rank: 3, style: 'ottoman', landmark: 'the Selimiye Mosque', mark(K) {
      mosque(K, 0, 0, { w: 0.24, dome: 0.13, mh: 0.62, color: '#e8dfcc', domeColor: '#8b98a6' });
    } },
    turkiye: { rank: 3, style: 'smalltown', landmark: 'balloons over the fairy chimneys of Cappadocia', mark(K) {
      for (const [x, y, h] of [[-0.06, 0.2, 0.18], [0.06, 0.26, 0.14], [-0.2, 0.26, 0.16], [0.18, 0.18, 0.12]]) K.cone(x, y, 0.04, h, { color: '#d8c3a0' });
      K.balloon(-0.16, -0.1, 0.55, 0.075, '#d9534f');
      K.balloon(0.12, -0.2, 0.72, 0.065, '#f0ad4e');
      K.balloon(0.22, 0.06, 0.48, 0.07, '#5bc0de');
    } },
    prague: { rank: 2, style: 'oldtown', landmark: 'Prague Castle, St. Vitus Cathedral and Charles Bridge', mark(K) {
      K.flat(0.13, 0.1, 0.12, 0.84, WATER);
      K.group(-0.16, -0.14, () => {
        K.box(-0.16, -0.12, 0.26, 0.1, 0.1, { color: '#ece2cc', roof: '#a0603f', roofH: 0.05 });
        K.cone(-0.1, -0.17, 0.026, 0.4, { z: 0.08, color: '#55625c' });
        K.cone(-0.19, -0.17, 0.02, 0.3, { z: 0.08, color: '#55625c' });
      });
      K.bridge(0.0, 0.22, 0.27, 0.22, { kind: 'arch', z: 0.05, color: '#8a7f70' });
    } },
    czechia: { rank: 3, style: 'smalltown', landmark: 'a castle on a hill', mark(K) {
      K.group(0, 0, () => {
        K.hill(0, 0, 0.22, 0.14, { color: '#5f9654', flat: true });
        K.box(0, 0, 0.14, 0.08, 0.09, { z: 0.14, color: '#e6dcc7', roof: '#9c5a3c', roofH: 0.05 });
        K.box(0.05, -0.02, 0.05, 0.05, 0.2, { z: 0.14, color: '#e6dcc7', roof: '#9c5a3c', roofH: 0.06 });
      });
    } },
    vienna: { rank: 2, style: 'oldtown', landmark: 'St. Stephen’s Cathedral and the Riesenrad', mark(K) {
      K.group(0, 0.04, () => {
        K.box(0, 0.04, 0.2, 0.09, 0.14, { color: '#d6cbb6', roof: '#4a7b74', roofH: 0.12 });
        K.box(0.075, 0.04, 0.05, 0.05, 0.2, { color: '#cfc3ad' });
        K.cone(0.075, 0.04, 0.036, 0.5, { z: 0.2, color: '#a99c86' });
      });
      K.wheel(0.28, -0.24, 0.13, { color: '#c0392b' });
    } },
    warsaw: { rank: 2, style: 'concrete', landmark: 'the Palace of Culture and Science', mark(K) {
      K.flat(0, 0, 0.36, 0.36, PLAZA);
      stepped(K, 0, 0, [[0.2, 0.18], [0.13, 0.22], [0.08, 0.2], [0.05, 0.1]], { color: '#d8c8a2', spire: 0.22 });
    } },
    stockholm: { rank: 2, style: 'nordic', landmark: 'Stockholm City Hall on the water', mark(K) {
      K.flat(0, 0.27, 0.9, 0.12, WATER);
      K.flat(0.27, -0.12, 0.11, 0.5, WATER);
      K.group(-0.08, -0.04, () => {
        K.box(-0.1, -0.04, 0.24, 0.14, 0.1, { color: '#b0563c' });
        K.box(-0.02, -0.09, 0.06, 0.06, 0.42, { color: '#b0563c' });
        K.box(-0.02, -0.09, 0.07, 0.07, 0.04, { z: 0.42, color: '#6aa58e' });
        K.cone(-0.02, -0.09, 0.02, 0.08, { z: 0.46, color: '#6aa58e' });
        K.sphere(-0.02, -0.09, 0.012, { z: 0.56, color: '#f2c14e' });
      });
    } },
    amsterdam: { rank: 2, style: 'canal', landmark: 'canal houses and the Westerkerk', mark(K) {
      K.flat(0, -0.11, 0.9, 0.055, WATER);
      K.flat(0, 0.13, 0.9, 0.055, WATER);
      churchTower(K, 0.3, 0.01, { w: 0.06, h: 0.22, spire: 0.24, color: '#9a6a4f', spireColor: '#4b6f8f' });
    } },
    rotterdam: { rank: 3, style: 'glass', landmark: 'the Erasmus Bridge and the Cube Houses', mark(K) {
      K.flat(0, 0.2, 0.9, 0.14, WATER);
      K.bridge(-0.12, 0.04, -0.12, 0.38, { kind: 'cable', z: 0.05, h: 0.5, at: 0.35, color: '#f1f1ef' });
      for (const [x, y] of [[0.14, -0.16], [0.22, -0.1], [0.3, -0.04]]) K.gem(x, y, 0.045, { z: 0.08, color: '#f2c94c' });
      tvTower(K, -0.3, -0.22, { h: 0.5, podR: 0.05, podAt: 0.7, color: '#dfe3e6', antenna: 0.15 });
    } },
    utrecht: { rank: 3, style: 'brick', landmark: 'the Dom Tower', mark(K) {
      K.flat(0.2, 0, 0.06, 0.86, WATER);
      K.group(0, 0, () => {
        K.box(0, 0, 0.09, 0.09, 0.42, { color: '#c2b08c' });
        K.cyl(0, 0, 0.046, 0.16, { z: 0.42, color: '#c2b08c' });
        K.cone(0, 0, 0.034, 0.12, { z: 0.58, color: '#6d6a5f' });
      });
    } },
    leuven: { rank: 3, style: 'brick', landmark: 'the Gothic town hall', mark(K) {
      K.group(0, 0.02, () => {
        K.box(0, 0.02, 0.22, 0.09, 0.17, { color: '#cdb88f', roof: '#55524f', roofH: 0.08 });
        for (let i = 0; i < 6; i++) K.cone(-0.09 + i * 0.036, 0.065, 0.012, 0.08, { z: 0.17, color: '#cdb88f' });
      });
      churchTower(K, 0.02, -0.25, { w: 0.08, h: 0.2, color: '#b9a682', cap: 0.06, spireColor: '#55524f' });
    } },
    luxembourg: { rank: 3, style: 'oldtown', landmark: 'the Adolphe Bridge over the Pétrusse valley', mark(K) {
      K.flat(0, 0.06, 0.9, 0.16, PARK);
      K.bridge(-0.04, -0.06, -0.04, 0.2, { kind: 'arch', z: 0.07, color: '#cfc7b6', spans: 1 });
      K.group(0.22, -0.22, () => {
        K.box(0.22, -0.22, 0.12, 0.07, 0.12, { color: '#d8cfbd' });
        for (const x of [0.18, 0.22, 0.26]) K.cone(x, -0.25, 0.016, 0.24, { z: 0.12, color: '#4d5761' });
      });
    } },
    lisbon: { rank: 2, style: 'colorful', landmark: 'the Belém Tower and a yellow tram', mark(K) {
      K.flat(0, 0.35, 0.9, 0.1, WATER);
      K.group(0.25, 0.27, () => {
        K.box(0.25, 0.27, 0.11, 0.11, 0.1, { color: '#efe7d4' });
        K.box(0.25, 0.25, 0.07, 0.07, 0.17, { z: 0.1, color: '#efe7d4' });
        K.dome(0.25, 0.25, 0.025, { z: 0.27, color: '#efe7d4' });
      });
      K.box(-0.08, 0.0, 0.08, 0.035, 0.035, { color: '#f2c230' });
    } },
    valencia: { rank: 3, style: 'oldtown', landmark: 'the City of Arts and Sciences and the Micalet', mark(K) {
      K.flat(0.18, 0.2, 0.36, 0.16, '#86cbe0');
      K.dome(0.14, 0.2, 0.11, { color: '#f4f6f7', squash: 0.55 });
      K.dome(0.3, 0.17, 0.06, { color: '#f4f6f7', squash: 0.8 });
      K.group(-0.12, -0.12, () => {
        K.cyl(-0.12, -0.12, 0.036, 0.32, { color: '#d8c7a5' });
        K.cone(-0.12, -0.12, 0.03, 0.06, { z: 0.32, color: '#b9a37f' });
      });
    } },
    malaga: { rank: 3, style: 'whitemed', landmark: 'the bullring, the cathedral and the lighthouse', mark(K) {
      K.flat(0.1, 0.36, 0.8, 0.08, WATER);
      K.ring(0.18, 0.12, 0.1, 0.06, { color: '#f2ede2', inner: '#c98b4f' });
      K.group(-0.12, -0.1, () => {
        K.box(-0.12, -0.1, 0.16, 0.1, 0.14, { color: '#d9c7a6' });
        K.box(-0.06, -0.12, 0.06, 0.06, 0.18, { z: 0.14, color: '#d9c7a6' });
        K.dome(-0.06, -0.12, 0.03, { z: 0.32, color: '#d9c7a6' });
      });
      K.group(0.34, -0.24, () => {
        K.cyl(0.34, -0.24, 0.025, 0.25, { color: '#f4f4f4' });
        K.cyl(0.34, -0.24, 0.027, 0.04, { z: 0.25, color: '#c0392b' });
        K.light(0.34, -0.24, 0.3);
      });
      palms(K, [[-0.15, 0.25], [0.0, 0.27]]);
    } },
    athens: { rank: 2, style: 'whitemed', landmark: 'the Parthenon on the Acropolis', mark(K) {
      K.group(0, 0, () => {
        K.hill(0, 0, 0.25, 0.16, { color: '#bba57d', flat: true });
        K.box(0, 0, 0.17, 0.08, 0.075, { z: 0.16, color: '#efe6d2', cols: 7 });
        K.pyr(0, 0, 0.17, 0.08, 0.035, { z: 0.235, color: '#e6dcc4' });
      });
    } },
    belgrade: { rank: 3, style: 'concrete', landmark: 'Kalemegdan fortress where the Sava meets the Danube', mark(K) {
      K.flat(-0.3, 0.06, 0.12, 0.7, WATER);
      K.flat(0, -0.31, 0.9, 0.11, WATER);
      K.group(-0.12, -0.14, () => {
        K.box(-0.08, -0.17, 0.22, 0.04, 0.07, { color: '#b9ae96' });
        K.box(-0.19, -0.06, 0.04, 0.2, 0.07, { color: '#b9ae96' });
        K.cyl(-0.19, -0.17, 0.035, 0.1, { color: '#a99f88' });
      });
      K.group(0.18, 0.15, () => {
        K.box(0.18, 0.15, 0.13, 0.13, 0.1, { color: '#f0ece4' });
        K.dome(0.18, 0.15, 0.07, { z: 0.1, color: '#5f9b80' });
      });
    } },
    tirana: { rank: 3, style: 'colorful', landmark: 'the Pyramid of Tirana and the clock tower', mark(K) {
      K.flat(-0.02, 0.0, 0.3, 0.3, PLAZA);
      K.pyr(0.18, 0.16, 0.24, 0.24, 0.13, { color: '#d8d3c8' });
      churchTower(K, -0.15, -0.1, { w: 0.05, h: 0.3, color: '#d6c39d', cap: 0.07, spireColor: '#9c5a3c' });
    } },
    tashkent: { rank: 2, style: 'steppe', landmark: 'the Tashkent TV Tower and a blue dome', mark(K) {
      tvTower(K, -0.02, -0.06, { h: 1.0, legs: true, podAt: 0.62, podR: 0.07, color: '#d9dde0', antenna: 0.25 });
      K.group(0.24, 0.2, () => {
        K.box(0.24, 0.2, 0.14, 0.14, 0.08, { color: '#efe7d6' });
        K.dome(0.24, 0.2, 0.06, { z: 0.08, color: '#3d8fc4' });
      });
    } },
    seoul: { rank: 1, style: 'asia', landmark: 'N Seoul Tower on Namsan and Lotte World Tower', mark(K) {
      K.flat(0, 0.36, 0.9, 0.08, WATER);
      K.group(-0.18, -0.13, () => {
        K.hill(-0.18, -0.13, 0.18, 0.18, { color: '#4b8a4d' });
        tvTower(K, -0.18, -0.13, { z: 0.18, h: 0.42, podR: 0.05, podAt: 0.75, color: '#ececec', antenna: 0.18 });
      });
      K.pyr(0.2, 0.14, 0.1, 0.1, 1.05, { color: '#cfd8de' });
      K.light(0.2, 0.14, 1.05);
    } },
    tokyo: { rank: 1, style: 'asia', tall: 1.1, landmark: 'Tokyo Tower and the Skytree', mark(K) {
      lattice(K, -0.02, 0, { h: 0.85, base: 0.1, color: '#e0533d', deck: '#f4f4f4' });
      tvTower(K, 0.28, -0.24, { h: 1.25, r: 0.03, podAt: 0.72, podR: 0.05, color: '#e6ecef', antenna: 0.12 });
    } },
    mumbai: { rank: 1, style: 'tropical', tall: 1.1, landmark: 'the Gateway of India', mark(K) {
      K.flat(0, 0.38, 0.9, 0.08, WATER);
      K.group(0, 0.25, () => {
        K.box(0, 0.25, 0.18, 0.07, 0.13, { color: '#d4b48a', arches: 1 });
        for (const x of [-0.075, 0.075]) {
          K.cyl(x, 0.25, 0.02, 0.06, { z: 0.13, color: '#d4b48a' });
          K.dome(x, 0.25, 0.02, { z: 0.19, color: '#d4b48a' });
        }
        K.dome(0, 0.25, 0.03, { z: 0.13, color: '#d4b48a' });
      });
    } },
    bengaluru: { rank: 1, style: 'concrete', trees: 8, landmark: 'the Vidhana Soudha in a garden city', mark(K) {
      K.group(0, 0, () => {
        K.box(0, 0, 0.3, 0.12, 0.1, { color: '#dcc9a8', cols: 9 });
        K.box(0, 0, 0.1, 0.08, 0.06, { z: 0.1, color: '#dcc9a8' });
        K.dome(0, 0, 0.045, { z: 0.16, color: '#d9c39b' });
      });
    } },
    'ho-chi-minh-city': { rank: 1, style: 'asia', landmark: 'the Bitexco Financial Tower by the Saigon River', mark(K) {
      K.flat(-0.32, 0.05, 0.1, 0.86, WATER);
      K.group(0, 0, () => {
        K.cyl(0, 0, 0.055, 0.75, { color: '#a9c8da' });
        K.cyl(0.05, 0, 0.04, 0.012, { z: 0.58, color: '#ececec' });
        K.cone(0, 0, 0.02, 0.1, { z: 0.75, color: '#a9c8da' });
        K.light(0, 0, 0.85);
      });
    } },
    singapore: { rank: 2, style: 'asia', landmark: 'Marina Bay Sands and the Supertrees', mark(K) {
      K.flat(0, 0.3, 0.6, 0.12, WATER);
      K.group(0, 0.02, () => {
        for (const x of [-0.12, 0, 0.12]) K.box(x, 0.02, 0.05, 0.1, 0.45, { color: '#dfe6ea', windows: true });
        K.box(0, 0.02, 0.38, 0.07, 0.025, { z: 0.45, color: '#cfd8dd' });
      });
      for (const [x, y] of [[-0.24, 0.22], [-0.3, 0.12], [-0.18, 0.3]]) K.tree(x, y, 'super', 1.2);
    } },
    lagos: { rank: 1, style: 'tropical', landmark: 'the Third Mainland Bridge over the lagoon', mark(K) {
      K.flat(0, 0.3, 0.9, 0.14, WATER);
      K.bridge(-0.42, 0.3, 0.42, 0.3, { kind: 'beam', z: 0.04, color: '#cfcfcf' });
    } },
    abidjan: { rank: 2, style: 'tropical', landmark: 'St. Paul’s Cathedral by the Ébrié Lagoon', mark(K) {
      K.flat(0, 0.33, 0.9, 0.1, WATER);
      K.group(0.14, 0.12, () => {
        K.box(0.14, 0.14, 0.14, 0.1, 0.06, { color: '#f2f0ea' });
        K.line([[0.17, 0.18, 0], [0.06, 0.06, 0.45]], { color: '#f2f0ea', w: 4 });
        K.line([[0.04, 0.08, 0.38], [0.1, 0.02, 0.4]], { color: '#f2f0ea', w: 2.4 });
      });
    } },
    'mexico-city': { rank: 1, style: 'concrete', landmark: 'the Angel of Independence and Torre Latinoamericana', mark(K) {
      K.group(0, 0, () => {
        K.box(0, 0, 0.08, 0.08, 0.05, { color: '#e8e3d6' });
        K.cyl(0, 0, 0.022, 0.45, { z: 0.05, color: '#efe9dc' });
        K.figure(0, 0, 0.5, 0.08, '#e3b341', 'angel');
      });
      stepped(K, 0.22, -0.2, [[0.08, 0.48]], { color: '#9fb7c8', spire: 0.08, windows: true });
    } },
    leon: { rank: 3, style: 'pastel', landmark: 'the Arco de la Calzada', mark(K) {
      K.group(0, 0.05, () => {
        K.box(0, 0.05, 0.26, 0.06, 0.14, { color: '#d39a5e', arches: 3 });
        K.box(0, 0.05, 0.08, 0.06, 0.05, { z: 0.14, color: '#d39a5e' });
      });
    } },
    'buenos-aires': { rank: 1, style: 'concrete', landmark: 'the Obelisco on Avenida 9 de Julio', mark(K) {
      K.flat(0, 0, 0.9, 0.12, ROAD);
      K.group(0, 0, () => {
        K.box(0, 0, 0.05, 0.05, 0.62, { color: '#f4f1e8' });
        K.pyr(0, 0, 0.05, 0.05, 0.06, { z: 0.62, color: '#f4f1e8' });
        K.light(0, 0, 0.68);
      });
    } },
    neuquen: { rank: 3, style: 'pastel', landmark: 'a little plane flying over the city', mark(K) {
      K.flat(0.05, 0.34, 0.9, 0.08, WATER);
      K.group(-0.05, -0.05, () => {
        K.line([[-0.05, -0.05, 0], [-0.05, -0.05, 0.3]], { color: '#d8d8d8', w: 1.6 });
        K.box(-0.02, -0.05, 0.05, 0.004, 0.035, { z: 0.26, color: '#75aadb' });
      });
      K.plane(0.18, -0.2, 0.6);
    } },
    brasilia: { rank: 2, style: 'modernist', landmark: 'the National Congress', mark(K) {
      K.flat(0, 0.32, 0.5, 0.1, WATER);
      K.group(0, 0.1, () => {
        K.box(0, 0.12, 0.46, 0.12, 0.03, { color: '#efefec' });
        K.box(-0.025, -0.06, 0.035, 0.09, 0.5, { color: '#f2f2ee' });
        K.box(0.025, -0.06, 0.035, 0.09, 0.5, { color: '#f2f2ee' });
        K.dome(-0.14, 0.12, 0.06, { z: 0.03, color: '#f4f4f2' });
        K.bowl(0.14, 0.12, 0.08, { z: 0.03, color: '#f4f4f2' });
      });
    } },
    goiania: { rank: 3, style: 'pastel', trees: 6, landmark: 'an art deco clock tower among parks', mark(K) {
      K.flat(0.2, 0.2, 0.26, 0.26, PARK);
      churchTower(K, 0, 0, { w: 0.06, h: 0.26, color: '#e9d2a5', cap: 0.05, spireColor: '#c4a26b' });
    } },
    'juiz-de-fora': { rank: 3, style: 'pastel', landmark: 'the Christ on Morro do Imperador', mark(K) {
      K.group(-0.2, -0.2, () => {
        K.hill(-0.2, -0.2, 0.17, 0.2, { color: '#4f8d4a' });
        K.figure(-0.2, -0.2, 0.2, 0.09, '#f2f2f2', 'cross');
      });
    } },
    'joao-pessoa': { rank: 3, style: 'pastel', landmark: 'the Cabo Branco lighthouse and the beach', mark(K) {
      K.flat(0.36, 0, 0.1, 0.9, WATER);
      K.flat(0.27, 0, 0.08, 0.9, SAND);
      K.group(0.24, 0.22, () => {
        K.pyr(0.24, 0.22, 0.06, 0.06, 0.32, { color: '#f4f4f4' });
        K.light(0.24, 0.22, 0.3);
      });
      palms(K, [[0.24, -0.2], [0.26, -0.05], [0.25, 0.08]]);
    } },
    orindiuva: { rank: 4, style: 'smalltown', landmark: 'the town church', mark(K) {
      churchTower(K, 0, -0.06, { w: 0.045, h: 0.18, color: '#f6f4ee', cap: 0.06, spireColor: '#b5573a' });
      K.box(0, 0.02, 0.08, 0.12, 0.08, { color: '#f6f4ee', roof: '#b5573a', roofH: 0.05 });
    } },
    imperatriz: { rank: 3, style: 'smalltown', landmark: 'the cathedral by the Tocantins River', mark(K) {
      K.flat(-0.33, 0, 0.12, 0.9, WATER);
      K.group(0.05, 0.05, () => {
        K.box(0.05, 0.05, 0.14, 0.1, 0.09, { color: '#efe7d6', roof: '#9c5a3c', roofH: 0.05 });
        K.box(0.0, 0.0, 0.035, 0.035, 0.18, { color: '#efe7d6', roof: '#9c5a3c', roofH: 0.04 });
        K.box(0.1, 0.0, 0.035, 0.035, 0.18, { color: '#efe7d6', roof: '#9c5a3c', roofH: 0.04 });
      });
    } },
    'los-angeles': { rank: 1, style: 'sprawl', landmark: 'palm trees, the Hollywood sign and the U.S. Bank Tower', mark(K) {
      K.group(0.05, -0.08, () => {
        K.cyl(0.05, -0.08, 0.05, 0.68, { color: '#c9d3da' });
        K.cyl(0.05, -0.08, 0.056, 0.03, { z: 0.68, color: '#e6e9eb' });
        K.light(0.05, -0.08, 0.72);
      });
      K.group(-0.27, -0.27, () => {
        K.hill(-0.27, -0.27, 0.15, 0.12, { color: '#9a9a6a' });
        K.box(-0.27, -0.2, 0.13, 0.008, 0.025, { z: 0.07, color: '#ffffff' });
      });
    } },
    detroit: { rank: 2, style: 'glass', landmark: 'the Renaissance Center on the Detroit River', mark(K) {
      K.flat(0, 0.34, 0.9, 0.1, WATER);
      K.group(0, 0.06, () => {
        for (const [x, y] of [[-0.1, -0.04], [0.1, -0.04], [-0.1, 0.16], [0.1, 0.16]]) K.cyl(x, y, 0.04, 0.42, { color: '#8fa3b1' });
        K.cyl(0, 0.06, 0.06, 0.72, { color: '#a9b6bf' });
        K.light(0, 0.06, 0.72);
      });
    } },
    atlanta: { rank: 2, style: 'glass', landmark: 'the Westin Peachtree Plaza and Bank of America Plaza', mark(K) {
      K.cyl(-0.12, 0, 0.05, 0.62, { color: '#b4a07d' });
      K.group(0.13, -0.06, () => {
        K.box(0.13, -0.06, 0.08, 0.08, 0.72, { color: '#9a8f86', windows: true });
        K.pyr(0.13, -0.06, 0.08, 0.08, 0.12, { z: 0.72, color: '#d9b44a' });
        K.line([[0.13, -0.06, 0.84], [0.13, -0.06, 0.92]], { color: '#d9b44a', w: 1.6 });
      });
    } },
    philadelphia: { rank: 2, style: 'brick', landmark: 'City Hall and William Penn', mark(K) {
      K.group(0, 0, () => {
        K.box(0, 0, 0.2, 0.2, 0.13, { color: '#e2d8c4' });
        K.box(0, 0, 0.07, 0.07, 0.32, { z: 0.13, color: '#e2d8c4' });
        K.dome(0, 0, 0.032, { z: 0.45, color: '#9fb39f' });
        K.figure(0, 0, 0.47, 0.06, '#7d8a6a', 'statue');
      });
    } },
    knoxville: { rank: 3, style: 'smalltown', landmark: 'the Sunsphere', mark(K) {
      K.flat(0, 0.34, 0.9, 0.09, WATER);
      K.group(0, 0, () => {
        for (const [x, y] of [[-0.03, -0.03], [0.03, -0.03], [0.03, 0.03], [-0.03, 0.03]]) K.line([[x, y, 0], [0, 0, 0.4]], { color: '#5d6d7e', w: 1.6 });
        K.cyl(0, 0, 0.016, 0.4, { color: '#5d6d7e' });
        K.sphere(0, 0, 0.06, { z: 0.46, color: '#e8b84a' });
      });
    } },
    'lake-tahoe': { rank: 4, style: 'woods', landmark: 'the lake, pines and the Sierra', mark(K) {
      K.flat(0.06, 0.06, 0.5, 0.6, WATER);
      K.hill(-0.28, -0.28, 0.16, 0.28, { color: '#8c8f7a', snow: true });
    } },
    'athens-georgia': { rank: 4, style: 'smalltown', landmark: 'the Arch and a columned chapel', mark(K) {
      K.group(0, 0.22, () => {
        for (const x of [-0.05, 0, 0.05]) K.box(x, 0.22, 0.012, 0.012, 0.08, { color: '#2f3337' });
        K.box(0, 0.22, 0.13, 0.018, 0.016, { z: 0.08, color: '#2f3337' });
      });
      K.group(-0.05, -0.08, () => {
        K.box(-0.05, -0.08, 0.14, 0.09, 0.08, { color: '#f2efe6', cols: 5 });
        K.pyr(-0.05, -0.08, 0.14, 0.09, 0.035, { z: 0.08, color: '#e9e4d8' });
      });
    } },
    vancouver: { rank: 2, style: 'glass', landmark: 'the sails of Canada Place and the North Shore mountains', mark(K) {
      K.flat(0.1, 0.3, 0.8, 0.16, WATER);
      K.group(0.15, 0.27, () => {
        K.box(0.15, 0.27, 0.1, 0.24, 0.03, { color: '#e9e6df' });
        for (let i = 0; i < 5; i++) K.cone(0.15, 0.18 + i * 0.045, 0.024, 0.07, { z: 0.03, color: '#ffffff' });
      });
      K.hill(-0.24, -0.3, 0.16, 0.2, { color: '#5d7f61', snow: true });
    } },
    victoria: { rank: 3, style: 'smalltown', landmark: 'the Legislature on the Inner Harbour', mark(K) {
      K.flat(0, 0.3, 0.86, 0.14, WATER);
      K.group(0, 0.02, () => {
        K.box(0, 0.02, 0.3, 0.09, 0.09, { color: '#d8cba9' });
        K.box(0, 0.02, 0.08, 0.08, 0.06, { z: 0.09, color: '#d8cba9' });
        K.dome(0, 0.02, 0.045, { z: 0.15, color: '#6fa58e' });
        K.figure(0, 0.02, 0.15 + domeTop(0.045), 0.04, '#d9b44a', 'statue');
      });
    } },
    ottawa: { rank: 3, style: 'oldtown', landmark: 'the Peace Tower and Parliament Hill', mark(K) {
      K.flat(0, -0.31, 0.9, 0.12, WATER);
      K.group(0, 0.05, () => {
        K.box(0, 0.08, 0.28, 0.1, 0.09, { color: '#cbbd9c', roof: '#5f9b80', roofH: 0.05 });
        K.box(0, 0.0, 0.06, 0.06, 0.36, { color: '#cbbd9c' });
        K.pyr(0, 0.0, 0.065, 0.065, 0.1, { z: 0.36, color: '#5f9b80' });
        K.line([[0, 0, 0.46], [0, 0, 0.52]], { color: '#d9d9d9', w: 1.2 });
      });
    } },
    montreal: { rank: 2, style: 'concrete', landmark: 'the Olympic Stadium and the cross on Mount Royal', mark(K) {
      K.group(0.12, 0.12, () => {
        K.ring(0.12, 0.14, 0.15, 0.07, { color: '#e9e7e2', inner: '#7e8a96' });
        K.line([[0.0, 0.14, 0.0], [0.07, 0.04, 0.55]], { color: '#e9e7e2', w: 5 });
      });
      K.group(-0.25, -0.25, () => {
        K.hill(-0.25, -0.25, 0.16, 0.13, { color: '#4f8d4a' });
        K.figure(-0.25, -0.25, 0.13, 0.08, '#f4f4f2', 'cross');
      });
    } },
    'milton-keynes': { rank: 3, style: 'lowmodern', landmark: 'the grid roads, a roundabout and the Concrete Cows', mark(K) {
      K.flat(0, 0, 0.9, 0.035, ROAD);
      K.flat(0, 0, 0.035, 0.9, ROAD);
      K.ring(0, 0, 0.07, 0.01, { color: '#8f8e88', inner: '#79b05a' });
      for (const [x, y] of [[0.22, 0.22], [0.28, 0.17], [0.17, 0.29]]) K.cow(x, y);
    } },
    frankfurt: { rank: 2, style: 'glass', tall: 1.2, landmark: 'the skyscrapers of “Mainhattan”', mark(K) {
      K.flat(0, 0.33, 0.9, 0.09, WATER);
      stepped(K, -0.1, -0.06, [[0.08, 0.85]], { color: '#b9c8d2', spire: 0.1, windows: true });
      K.cyl(0.06, -0.18, 0.045, 0.7, { color: '#7fa3bb' });
      K.group(0.2, 0.05, () => {
        K.box(0.2, 0.05, 0.07, 0.07, 0.68, { color: '#c9a68e', windows: true });
        K.pyr(0.2, 0.05, 0.07, 0.07, 0.08, { z: 0.68, color: '#a64b3a' });
      });
    } },
  };

  // Places without an entry get a style from their country and a generic landmark.
  function specFor(pl) {
    const spec = CITY[pl.id];
    if (spec) return spec;
    const rnd = seeded(`${pl.id}:spec`);
    const pick = Math.floor(rnd() * 3);
    return {
      style: ['oldtown', 'concrete', 'pastel'][pick],
      landmark: ['a church spire', 'a TV tower', 'a clock tower'][pick],
      mark(K) {
        if (pick === 0) churchTower(K, 0, 0, { w: 0.06, h: 0.2, spire: 0.3, color: '#e6dcc7', spireColor: '#55625c' });
        else if (pick === 1) tvTower(K, 0, 0, { h: 0.8, podR: 0.06, color: '#dfe3e6' });
        else churchTower(K, 0, 0, { w: 0.06, h: 0.32, cap: 0.08, color: '#d6c39d', spireColor: '#9c5a3c' });
      },
    };
  }

  function buildScene(pl) {
    const spec = specFor(pl);
    const style = STYLES[spec.style] || STYLES.concrete;
    const { K, items, blocked } = recorder();
    spec.mark(K);
    const rnd = seeded(`${pl.id}:buildings`);
    const free = (x, y, r) => Math.abs(x) < 0.42 && Math.abs(y) < 0.42 && !blocked.some(([x0, y0, x1, y1]) => x + r > x0 && x - r < x1 && y + r > y0 && y - r < y1);
    const step = style.step || 0.16;
    const half = Math.floor(0.36 / step);
    const slots = [];
    for (let i = -half; i <= half; i++) for (let j = -half; j <= half; j++) slots.push([i * step + (rnd() - 0.5) * 0.02, j * step + (rnd() - 0.5) * 0.02]);
    const ranked = slots.map((s) => [s, Math.hypot(s[0], s[1]) + rnd() * 0.22]).sort((p, q) => p[1] - q[1]);
    const n = clamp(style.n + RANK_DENSITY[pl.rank] + pl.projects.length, 3, 28);
    const tall = (spec.tall || 1) * RANK_TALL[pl.rank];
    let placed = 0;
    for (const [[x, y]] of ranked) {
      if (placed >= n) break;
      const a = style.a * (0.85 + rnd() * 0.3);
      const b = (style.b || style.a) * (0.85 + rnd() * 0.3);
      if (!free(x, y, Math.max(a, b) * 0.9)) continue;
      const h = (style.min + Math.pow(rnd(), 1.4) * (style.max - style.min)) * tall * (placed < 3 ? 1.25 : 1);
      const wall = style.walls[Math.floor(rnd() * style.walls.length)];
      const o = { color: wall, seed: Math.floor(rnd() * 1e6) };
      if (style.roofs) {
        o.roof = style.roofs[Math.floor(rnd() * style.roofs.length)];
        o.roofH = style.steep ? b * 1.3 : Math.min(a, b) * 0.75;
      } else if (h > 0.16) {
        o.windows = true;
      }
      K.box(x, y, a * 2, b * 2, h, o);
      placed++;
    }
    const sprinkle = (count, kind) => {
      for (let t = 0, tries = 0; t < count && tries < 80; tries++) {
        const x = (rnd() - 0.5) * 0.8;
        const y = (rnd() - 0.5) * 0.8;
        if (!free(x, y, 0.035)) continue;
        K.tree(x, y, kind, 0.85 + rnd() * 0.35);
        t++;
      }
    };
    sprinkle((style.trees || 0) + (spec.trees || 0), style.conifers ? 't' : 'f');
    sprinkle(style.palms || 0, 'palm');
    scaleScene(items, RANK_SCALE[pl.rank]);
    const streets = spec.style === 'woods' || pl.scope !== 'city' ? 'none' : spec.style === 'canal' ? 'pave' : 'grid';
    return { items, landmark: spec.landmark || '', streets, k: RANK_SCALE[pl.rank] };
  }

  // Shrinks a whole little city (footprint, heights and landmark) for smaller places.
  function scaleScene(items, k) {
    if (k === 1) return;
    const keys = ['w', 'd', 'h', 'r', 'z', 's', 'roofH', 'size', 'x0', 'y0', 'x1', 'y1'];
    for (const it of items) {
      it.dx *= k;
      it.dy *= k;
      it.at = [it.at[0] * k, it.at[1] * k];
      for (const key of keys) if (typeof it.o[key] === 'number') it.o[key] *= k;
      if (it.o.pts) it.o.pts = it.o.pts.map(([x, y, z]) => [x * k, y * k, z * k]);
    }
  }

  // ---- drawing the recorded parts
  const nightCache = new Map();
  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
  }
  // In the dark theme everything is dimmed towards the night sky.
  function tone(c) {
    if (state.theme !== 'dark') return c;
    let v = nightCache.get(c);
    if (!v) {
      v = mixHex(c, '#0e1c2b', 0.6);
      nightCache.set(c, v);
    }
    return v;
  }
  const faceCache = new Map();
  function faces(c) {
    const key = `${state.theme}${c}`;
    let f = faceCache.get(key);
    if (!f) {
      const t = tone(c);
      f = { top: shade(t, 0.16), left: shade(t, 0), right: shade(t, -0.2), back: shade(t, -0.08) };
      faceCache.set(key, f);
    }
    return f;
  }

  function tri(g, a, b, c, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.lineTo(c[0], c[1]);
    g.closePath();
    g.fill();
  }

  // Fill a path twice: whole in the lit colour, right half in the shaded one.
  function shaded(g, cx, build, f, R) {
    g.fillStyle = f.left;
    g.beginPath();
    build();
    g.fill();
    g.save();
    g.beginPath();
    g.rect(cx, -1e4, 2e4, 3e4);
    g.clip();
    g.fillStyle = f.right;
    g.beginPath();
    build();
    g.fill();
    g.restore();
  }

  function boxCorners(R, it) {
    const { pl } = R;
    const { w, d } = it.o;
    const [u0, v0] = rot(pl.x + it.dx - w / 2, pl.y + it.dy - d / 2);
    const [u1, v1] = rot(pl.x + it.dx + w / 2, pl.y + it.dy + d / 2);
    return [Math.min(u0, u1), Math.max(u0, u1), Math.min(v0, v1), Math.max(v0, v1)];
  }

  const DRAW = {
    flat(R, it) {
      const { w, d, color } = it.o;
      const [uA, uB, vA, vB] = boxCorners(R, it);
      const P3 = (u, v) => isoToScreen((u - v) / 2, (u + v) / 4 - R.lift - 0.004);
      const fill = color === WATER ? R.P.water[1] : tone(color);
      poly(R.g, [P3(uA, vA), P3(uB, vA), P3(uB, vB), P3(uA, vB)], fill);
      void w;
      void d;
    },

    box(R, it) {
      const { g } = R;
      const o = it.o;
      const z = o.z || 0;
      const [uA, uB, vA, vB] = boxCorners(R, it);
      const P3 = (u, v, zz) => isoToScreen((u - v) / 2, (u + v) / 4 - R.lift - zz);
      const t = [P3(uA, vA, z + o.h), P3(uB, vA, z + o.h), P3(uB, vB, z + o.h), P3(uA, vB, z + o.h)];
      const gR = [P3(uB, vA, z), P3(uB, vB, z)];
      const gL = [P3(uA, vB, z), P3(uB, vB, z)];
      const f = faces(o.color);
      poly(g, [t[1], t[2], gR[1], gR[0]], f.right);
      poly(g, [t[3], t[2], gL[1], gL[0]], f.left);
      poly(g, t, f.top);
      R.mark(t[0][1]);
      if (R.detail && o.cols) columns(R, o, t, gR, gL);
      if (R.detail && o.arches) archways(R, o, t, gR, gL);
      if (o.windows && R.tw >= 26) windowsOn(R, o, t, gR, gL);
      if (o.roof) {
        const A = P3((uA + uB) / 2, (vA + vB) / 2, z + o.h + o.roofH);
        const rf = faces(o.roof);
        tri(g, t[3], t[0], A, rf.back);
        tri(g, t[0], t[1], A, rf.top);
        tri(g, t[3], t[2], A, rf.left);
        tri(g, t[2], t[1], A, rf.right);
        R.mark(A[1]);
      }
    },

    pyr(R, it) {
      const { g } = R;
      const o = it.o;
      const z = o.z || 0;
      const [uA, uB, vA, vB] = boxCorners(R, it);
      const P3 = (u, v, zz) => isoToScreen((u - v) / 2, (u + v) / 4 - R.lift - zz);
      const T = P3(uA, vA, z);
      const Rt = P3(uB, vA, z);
      const Bt = P3(uB, vB, z);
      const L = P3(uA, vB, z);
      const A = P3((uA + uB) / 2, (vA + vB) / 2, z + o.h);
      const f = faces(o.color);
      tri(g, L, T, A, f.back);
      tri(g, T, Rt, A, f.top);
      tri(g, L, Bt, A, f.left);
      tri(g, Bt, Rt, A, f.right);
      R.mark(A[1]);
    },

    cyl(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const z = o.z || 0;
      const [cx, cy0] = R.S(it.dx, it.dy, z);
      const cy1 = cy0 - o.h * tw;
      const rx = Math.max(0.6, (o.r * tw) / Math.SQRT2);
      const ry = rx / 2;
      const f = faces(o.color);
      shaded(g, cx, () => {
        g.moveTo(cx - rx, cy1);
        g.lineTo(cx - rx, cy0);
        g.ellipse(cx, cy0, rx, ry, 0, Math.PI, 0, true);
        g.lineTo(cx + rx, cy1);
        g.closePath();
      }, f, R);
      g.fillStyle = f.top;
      g.beginPath();
      g.ellipse(cx, cy1, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      R.mark(cy1 - ry);
    },

    cone(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const z = o.z || 0;
      const [cx, cy0] = R.S(it.dx, it.dy, z);
      const cyA = cy0 - o.h * tw;
      const rx = Math.max(0.6, (o.r * tw) / Math.SQRT2);
      const ry = rx / 2;
      shaded(g, cx, () => {
        g.moveTo(cx, cyA);
        g.lineTo(cx - rx, cy0);
        g.ellipse(cx, cy0, rx, ry, 0, Math.PI, 0, true);
        g.closePath();
      }, faces(o.color), R);
      R.mark(cyA);
    },

    dome(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const z = o.z || 0;
      const [cx, cy0] = R.S(it.dx, it.dy, z);
      const rx = Math.max(0.8, (o.r * tw) / Math.SQRT2);
      const ry = rx / 2;
      const hy = rx * 0.95 * (o.squash || 1);
      const f = faces(o.color);
      shaded(g, cx, () => {
        g.moveTo(cx - rx, cy0);
        g.ellipse(cx, cy0, rx, ry, 0, Math.PI, 0, true);
        g.ellipse(cx, cy0, rx, hy, 0, 0, Math.PI, true);
        g.closePath();
      }, f, R);
      g.fillStyle = f.top;
      g.beginPath();
      g.ellipse(cx - rx * 0.32, cy0 - hy * 0.6, rx * 0.3, hy * 0.22, -0.5, 0, Math.PI * 2);
      g.fill();
      R.mark(cy0 - hy);
    },

    bowl(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const z = o.z || 0;
      const [cx, cy0] = R.S(it.dx, it.dy, z);
      const rx = Math.max(0.8, (o.r * tw) / Math.SQRT2);
      const ry = rx / 2;
      const rim = cy0 - rx * 0.55;
      const f = faces(o.color);
      g.fillStyle = f.right;
      g.beginPath();
      g.moveTo(cx - rx, rim);
      g.ellipse(cx, rim, rx, rx * 0.55 + ry * 0.4, 0, Math.PI, 0, true);
      g.closePath();
      g.fill();
      g.fillStyle = f.top;
      g.beginPath();
      g.ellipse(cx, rim, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = f.back;
      g.beginPath();
      g.ellipse(cx, rim + ry * 0.15, rx * 0.8, ry * 0.7, 0, 0, Math.PI * 2);
      g.fill();
      R.mark(rim - ry);
    },

    sphere(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const [cx, cy] = R.S(it.dx, it.dy, o.z || 0);
      const r = Math.max(1, o.r * tw);
      const f = faces(o.color);
      shaded(g, cx + r * 0.25, () => g.arc(cx, cy, r, 0, Math.PI * 2), f, R);
      g.fillStyle = f.top;
      g.beginPath();
      g.arc(cx - r * 0.35, cy - r * 0.35, r * 0.35, 0, Math.PI * 2);
      g.fill();
      R.mark(cy - r);
    },

    ring(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const z = o.z || 0;
      const [cx, cy0] = R.S(it.dx, it.dy, z);
      const cy1 = cy0 - o.h * tw;
      const rx = Math.max(1, (o.r * tw) / Math.SQRT2);
      const ry = rx / 2;
      const f = faces(o.color);
      shaded(g, cx, () => {
        g.moveTo(cx - rx, cy1);
        g.lineTo(cx - rx, cy0);
        g.ellipse(cx, cy0, rx, ry, 0, Math.PI, 0, true);
        g.lineTo(cx + rx, cy1);
        g.closePath();
      }, f, R);
      g.fillStyle = f.top;
      g.beginPath();
      g.ellipse(cx, cy1, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = tone(o.inner || '#8f7553');
      g.beginPath();
      g.ellipse(cx, cy1, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
      g.fill();
      if (R.detail && o.h * tw > 5) {
        g.fillStyle = faces(o.inner || '#8f7553').right;
        for (let k = 1; k < 10; k++) {
          const a = (k / 10) * Math.PI;
          const x = cx + Math.cos(a) * rx * 0.94;
          const y = cy0 - o.h * tw * 0.55 + Math.sin(a) * ry * 0.94;
          g.fillRect(x - tw * 0.008, y - tw * 0.02, Math.max(1, tw * 0.016), Math.max(1.5, tw * 0.04));
        }
      }
      R.mark(cy1 - ry);
    },

    hill(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const [cx, cy0] = R.S(it.dx, it.dy, 0);
      const rx = o.r * tw * 0.95;
      const ry = rx / 2;
      const hh = o.h * tw;
      const f = faces(o.color);
      if (o.flat) {
        shaded(g, cx, () => {
          g.moveTo(cx - rx, cy0);
          g.ellipse(cx, cy0, rx, ry, 0, Math.PI, 0, true);
          g.lineTo(cx + rx * 0.62, cy0 - hh);
          g.lineTo(cx - rx * 0.62, cy0 - hh);
          g.closePath();
        }, f, R);
        g.fillStyle = f.top;
        g.beginPath();
        g.ellipse(cx, cy0 - hh, rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2);
        g.fill();
      } else {
        shaded(g, cx, () => {
          g.moveTo(cx - rx, cy0);
          g.ellipse(cx, cy0, rx, ry, 0, Math.PI, 0, true);
          g.bezierCurveTo(cx + rx * 0.98, cy0 - hh * 0.55, cx + rx * 0.5, cy0 - hh, cx, cy0 - hh);
          g.bezierCurveTo(cx - rx * 0.5, cy0 - hh, cx - rx * 0.98, cy0 - hh * 0.55, cx - rx, cy0);
          g.closePath();
        }, f, R);
        if (o.snow) {
          g.fillStyle = tone('#f6f8fa');
          g.beginPath();
          g.moveTo(cx, cy0 - hh);
          g.bezierCurveTo(cx + rx * 0.2, cy0 - hh, cx + rx * 0.3, cy0 - hh * 0.8, cx + rx * 0.34, cy0 - hh * 0.68);
          g.lineTo(cx, cy0 - hh * 0.74);
          g.lineTo(cx - rx * 0.34, cy0 - hh * 0.68);
          g.bezierCurveTo(cx - rx * 0.3, cy0 - hh * 0.8, cx - rx * 0.2, cy0 - hh, cx, cy0 - hh);
          g.fill();
        }
      }
      R.mark(cy0 - hh);
    },

    line(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const pts = o.pts.map(([x, y, z]) => R.S(x, y, z));
      g.strokeStyle = tone(o.color);
      g.lineWidth = clamp(((o.w || 2) * tw) / 34, 0.8, (o.w || 2) * 2.2);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      R.mark(Math.min(...pts.map((p) => p[1])));
    },

    wheel(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const r = o.r * tw;
      const [gx, gy] = R.S(it.dx, it.dy, 0);
      const hx = gx;
      const hy = gy - r - tw * 0.03;
      const c = tone(o.color);
      g.strokeStyle = c;
      g.lineWidth = Math.max(0.8, tw * 0.02);
      g.beginPath();
      g.moveTo(hx - r * 0.45, gy);
      g.lineTo(hx, hy);
      g.lineTo(hx + r * 0.45, gy);
      g.stroke();
      g.beginPath();
      g.arc(hx, hy, r, 0, Math.PI * 2);
      g.stroke();
      if (R.detail) {
        g.lineWidth = Math.max(0.5, tw * 0.008);
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          g.moveTo(hx, hy);
          g.lineTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r);
        }
        g.stroke();
        g.fillStyle = c;
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          g.fillRect(hx + Math.cos(a) * r - 1, hy + Math.sin(a) * r - 1, 2.2, 2.2);
        }
      }
      R.mark(hy - r);
    },

    bridge(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const z = o.z || 0.04;
      const at = (t, zz) => R.S(lerp(o.x0, o.x1, t), lerp(o.y0, o.y1, t), zz);
      const c = tone(o.color);
      const deckW = Math.max(1.2, tw * 0.045);
      const a = at(0, z);
      const b = at(1, z);
      g.lineCap = 'butt';
      if (o.kind === 'arch' || o.kind === 'beam') {
        const spans = o.spans || (o.kind === 'beam' ? 10 : 4);
        g.strokeStyle = faces(o.color).right;
        g.lineWidth = Math.max(1, tw * 0.03);
        g.beginPath();
        for (let k = 0; k <= spans; k++) {
          const [px, py] = at(k / spans, z);
          const [, gy] = at(k / spans, 0);
          g.moveTo(px, py);
          g.lineTo(px, gy);
        }
        g.stroke();
        if (o.kind === 'arch') {
          g.lineWidth = Math.max(1, tw * 0.025);
          g.beginPath();
          for (let k = 0; k < spans; k++) {
            const [x0, y0] = at(k / spans, 0);
            const [x1, y1] = at((k + 1) / spans, 0);
            const [mx, my] = at((k + 0.5) / spans, z * 1.6);
            g.moveTo(x0, y0);
            g.quadraticCurveTo(mx, my, x1, y1);
          }
          g.stroke();
        }
      }
      g.strokeStyle = c;
      g.lineWidth = deckW;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
      let top = Math.min(a[1], b[1]);
      if (o.kind === 'suspension') {
        const towers = [0.22, 0.78];
        g.lineWidth = Math.max(1.2, tw * 0.035);
        g.beginPath();
        for (const t of towers) {
          const [x, y0] = at(t, 0);
          const [, y1] = at(t, z + o.h);
          g.moveTo(x, y0);
          g.lineTo(x, y1);
          top = Math.min(top, y1);
        }
        g.stroke();
        g.lineWidth = Math.max(0.7, tw * 0.012);
        const p0 = at(0, z + 0.03);
        const t1 = at(0.22, z + o.h);
        const mid = at(0.5, z + 0.02);
        const t2 = at(0.78, z + o.h);
        const p1 = at(1, z + 0.03);
        g.beginPath();
        g.moveTo(p0[0], p0[1]);
        g.lineTo(t1[0], t1[1]);
        g.quadraticCurveTo(mid[0], mid[1] - (t1[1] - mid[1]) * 0.15, t2[0], t2[1]);
        g.lineTo(p1[0], p1[1]);
        g.stroke();
      } else if (o.kind === 'cable') {
        const t0 = o.at ?? 0.35;
        const [px, py0] = at(t0, 0);
        const [, py1] = at(t0, z + o.h);
        g.lineWidth = Math.max(1.4, tw * 0.04);
        g.beginPath();
        g.moveTo(px, py0);
        g.lineTo(px, py1);
        g.stroke();
        g.lineWidth = Math.max(0.5, tw * 0.008);
        g.beginPath();
        for (const dt of [-0.28, -0.18, -0.08, 0.12, 0.24, 0.36, 0.48]) {
          const t = clamp(t0 + dt, 0, 1);
          const [x, y] = at(t, z);
          g.moveTo(px, py1 + (py0 - py1) * 0.08);
          g.lineTo(x, y);
        }
        g.stroke();
        top = Math.min(top, py1);
      }
      R.mark(top);
    },

    tree(R, it) {
      const { g, tw } = R;
      const { kind, size } = it.o;
      if (!R.detail && kind !== 'super') return;
      const [x, y] = R.S(it.dx, it.dy, 0);
      const s = tw * 0.05 * size;
      const P = R.P;
      if (kind === 'palm') {
        g.strokeStyle = tone('#8a6a45');
        g.lineWidth = Math.max(0.8, s * 0.35);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + s * 0.6, y - s * 2, x + s * 0.3, y - s * 3.6);
        g.stroke();
        g.strokeStyle = tone('#3f8f4a');
        g.lineWidth = Math.max(0.8, s * 0.32);
        const tx = x + s * 0.3;
        const ty = y - s * 3.6;
        g.beginPath();
        for (const [ax, ay] of [[-1.6, 0.6], [1.6, 0.6], [-1.1, -0.5], [1.1, -0.5], [0, -1]]) {
          g.moveTo(tx, ty);
          g.quadraticCurveTo(tx + ax * s * 0.7, ty + ay * s * 0.7 - s * 0.4, tx + ax * s, ty + ay * s + s * 0.3);
        }
        g.stroke();
        R.mark(ty - s);
        return;
      }
      if (kind === 'super') {
        g.fillStyle = tone('#7b4f8f');
        g.beginPath();
        g.moveTo(x - s * 0.25, y);
        g.lineTo(x + s * 0.25, y);
        g.lineTo(x + s * 1.1, y - s * 3);
        g.lineTo(x - s * 1.1, y - s * 3);
        g.closePath();
        g.fill();
        g.fillStyle = tone('#a46cc0');
        g.beginPath();
        g.ellipse(x, y - s * 3, s * 1.2, s * 0.45, 0, 0, Math.PI * 2);
        g.fill();
        R.mark(y - s * 3.4);
        return;
      }
      const [dark, light] = (kind === 't' ? P.tree.t : P.tree.f);
      if (kind === 't') {
        tri(g, [x, y - s * 3], [x + s, y], [x - s, y], dark);
        tri(g, [x, y - s * 3], [x - s, y], [x - s * 0.1, y], light);
        R.mark(y - s * 3);
        return;
      }
      g.fillStyle = P.trunk;
      g.fillRect(x - s * 0.12, y - s * 0.9, Math.max(1, s * 0.24), s * 0.9);
      g.fillStyle = dark;
      g.beginPath();
      g.ellipse(x, y - s * 1.45, s * 1.05, s * 0.95, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = light;
      g.beginPath();
      g.ellipse(x - s * 0.3, y - s * 1.7, s * 0.5, s * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      R.mark(y - s * 2.4);
    },

    figure(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const [x, y0] = R.S(it.dx, it.dy, o.z);
      const h = o.h * tw;
      const c = tone(o.color);
      g.strokeStyle = c;
      g.fillStyle = c;
      g.lineCap = 'round';
      g.lineWidth = Math.max(1.2, h * 0.16);
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y0 - h * 0.85);
      if (o.kind === 'cross') {
        g.moveTo(x - h * 0.42, y0 - h * 0.68);
        g.lineTo(x + h * 0.42, y0 - h * 0.68);
      } else if (o.kind === 'torch') {
        g.moveTo(x, y0 - h * 0.7);
        g.lineTo(x + h * 0.22, y0 - h * 1.2);
      } else if (o.kind === 'angel') {
        g.moveTo(x, y0 - h * 0.7);
        g.lineTo(x - h * 0.35, y0 - h * 0.95);
        g.moveTo(x, y0 - h * 0.7);
        g.lineTo(x + h * 0.35, y0 - h * 0.95);
      }
      g.stroke();
      g.beginPath();
      g.arc(x, y0 - h * 0.92, Math.max(0.8, h * 0.11), 0, Math.PI * 2);
      g.fill();
      if (o.kind === 'torch') {
        g.fillStyle = tone('#f0b429');
        g.beginPath();
        g.arc(x + h * 0.24, y0 - h * 1.26, Math.max(0.9, h * 0.1), 0, Math.PI * 2);
        g.fill();
      }
      R.mark(y0 - h * 1.3);
    },

    balloon(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const [x, y] = R.S(it.dx, it.dy, o.z);
      const r = Math.max(1.5, o.r * tw);
      const f = faces(o.color);
      g.strokeStyle = tone('#6b5a45');
      g.lineWidth = Math.max(0.5, r * 0.08);
      g.beginPath();
      g.moveTo(x - r * 0.45, y + r * 0.7);
      g.lineTo(x - r * 0.18, y + r * 1.35);
      g.moveTo(x + r * 0.45, y + r * 0.7);
      g.lineTo(x + r * 0.18, y + r * 1.35);
      g.stroke();
      g.fillStyle = tone('#8a6a45');
      g.fillRect(x - r * 0.2, y + r * 1.3, r * 0.4, r * 0.3);
      shaded(g, x + r * 0.2, () => g.ellipse(x, y, r, r * 1.12, 0, 0, Math.PI * 2), f, R);
      g.fillStyle = f.top;
      g.beginPath();
      g.ellipse(x, y, r * 0.3, r * 1.1, 0, 0, Math.PI * 2);
      g.fill();
      // its shadow on the ground
      const [sx, sy] = R.S(it.dx, it.dy, 0);
      g.fillStyle = R.P.shadow;
      g.beginPath();
      g.ellipse(sx, sy, r * 0.8, r * 0.35, 0, 0, Math.PI * 2);
      g.fill();
      R.mark(y - r * 1.12);
    },

    gem(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const [x, y] = R.S(it.dx, it.dy, (o.z || 0) + o.s);
      const r = Math.max(1.5, o.s * tw);
      const f = faces(o.color);
      g.strokeStyle = tone('#8b8b8b');
      g.lineWidth = Math.max(0.8, r * 0.18);
      const [, gy] = R.S(it.dx, it.dy, 0);
      g.beginPath();
      g.moveTo(x, y + r);
      g.lineTo(x, gy);
      g.stroke();
      poly(g, [[x, y - r], [x + r, y - r / 2], [x, y], [x - r, y - r / 2]], f.top);
      poly(g, [[x - r, y - r / 2], [x, y], [x, y + r], [x - r, y + r / 2]], f.left);
      poly(g, [[x, y], [x + r, y - r / 2], [x + r, y + r / 2], [x, y + r]], f.right);
      R.mark(y - r);
    },

    plane(R, it) {
      const { g, tw } = R;
      const o = it.o;
      const [x, y] = R.S(it.dx, it.dy, o.z);
      const [sx, sy] = R.S(it.dx, it.dy, 0);
      const s = tw * 0.07;
      g.fillStyle = R.P.shadow;
      g.beginPath();
      g.ellipse(sx, sy, s * 1.3, s * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = tone('#f4f4f4');
      g.lineCap = 'round';
      g.lineWidth = Math.max(1.2, s * 0.35);
      g.beginPath();
      g.moveTo(x - s * 1.4, y + s * 0.7);
      g.lineTo(x + s * 1.4, y - s * 0.7);
      g.moveTo(x - s * 0.9, y - s * 0.6);
      g.lineTo(x + s * 0.5, y + s * 0.5);
      g.moveTo(x - s * 1.4, y + s * 0.7);
      g.lineTo(x - s * 1.3, y + s * 0.05);
      g.stroke();
      R.mark(y - s);
    },

    cow(R, it) {
      if (R.tw < 30) return;
      const { g, tw } = R;
      const [x, y] = R.S(it.dx, it.dy, 0);
      const s = tw * 0.012;
      g.fillStyle = tone('#f4f4f2');
      g.fillRect(x - s * 2.2, y - s * 2.2, s * 4.4, s * 1.8);
      g.fillStyle = tone('#2b2b2b');
      g.fillRect(x - s * 0.6, y - s * 2.2, s * 1.4, s * 1);
      g.fillRect(x + s * 2.2, y - s * 2.6, s * 1.2, s * 1.2);
      g.fillRect(x - s * 1.8, y - s * 0.4, s * 0.5, s * 0.8);
      g.fillRect(x + s * 1.4, y - s * 0.4, s * 0.5, s * 0.8);
    },

    light(R, it) {
      if (!R.P.glow) return;
      const { g } = R;
      const [x, y] = R.S(it.dx, it.dy, it.o.z);
      g.fillStyle = 'rgba(255,90,70,0.35)';
      g.beginPath();
      g.arc(x, y, 4.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ff7a5c';
      g.beginPath();
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.fill();
    },
  };

  function columns(R, o, t, gR, gL) {
    const { g, tw } = R;
    const n = o.cols;
    g.strokeStyle = faces(o.color).right;
    g.lineWidth = Math.max(0.6, tw * 0.007);
    g.beginPath();
    for (const [ta, tb, ga, gb] of [[t[3], t[2], gL[0], gL[1]], [t[1], t[2], gR[0], gR[1]]]) {
      for (let k = 1; k < n; k++) {
        const f = k / n;
        const x0 = lerp(ta[0], tb[0], f);
        const y0 = lerp(ta[1], tb[1], f);
        const x1 = lerp(ga[0], gb[0], f);
        const y1 = lerp(ga[1], gb[1], f);
        g.moveTo(lerp(x0, x1, 0.12), lerp(y0, y1, 0.12));
        g.lineTo(lerp(x0, x1, 0.92), lerp(y0, y1, 0.92));
      }
    }
    g.stroke();
  }

  function archways(R, o, t, gR, gL) {
    const { g } = R;
    g.fillStyle = faces(o.color).right;
    for (const [ta, tb, ga, gb] of [[t[3], t[2], gL[0], gL[1]], [t[1], t[2], gR[0], gR[1]]]) {
      const n = o.arches;
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n;
        const xb = lerp(ga[0], gb[0], f);
        const yb = lerp(ga[1], gb[1], f);
        const xt = lerp(ta[0], tb[0], f);
        const yt = lerp(ta[1], tb[1], f);
        const hgt = (yb - yt) * 0.62;
        const wid = (Math.abs(gb[0] - ga[0]) / n) * 0.42;
        g.beginPath();
        g.moveTo(xb - wid, yb);
        g.lineTo(xb - wid, yb - hgt * 0.6);
        g.ellipse(xb, yb - hgt * 0.6, wid, hgt * 0.4, 0, Math.PI, 0, false);
        g.lineTo(xb + wid, yb);
        g.closePath();
        g.fill();
        void xt;
      }
    }
  }

  function windowsOn(R, o, t, gR, gL) {
    const { g, tw, P } = R;
    const floors = Math.max(1, Math.floor(o.h / 0.075));
    const size = Math.max(1.2, tw * 0.02);
    const rnd = seeded(String(o.seed || 7));
    for (const [ta, tb, ga, gb] of [[t[1], t[2], gR[0], gR[1]], [t[3], t[2], gL[0], gL[1]]]) {
      for (let k = 0; k < floors; k++) {
        const fy = (k + 0.55) / (floors + 0.3);
        for (const along of [0.3, 0.7]) {
          const lit = rnd() < P.city.litShare;
          if (P.city.litShare && !lit) continue;
          const xTop = lerp(ta[0], tb[0], along);
          const yTop = lerp(ta[1], tb[1], along);
          const xBot = lerp(ga[0], gb[0], along);
          const yBot = lerp(ga[1], gb[1], along);
          g.fillStyle = P.city.window;
          g.fillRect(lerp(xTop, xBot, fy) - size / 2, lerp(yTop, yBot, fy) - size / 2, size, size);
        }
      }
    }
  }

  // Draws one place; returns the screen y of the top of its skyline.
  function drawScene(g, pl, lift, active) {
    const scene = pl.scene || (pl.scene = buildScene(pl));
    const tw = state.cam.tw;
    const S = (dx, dy, z) => {
      const [u, v] = rot(pl.x + dx, pl.y + dy);
      return isoToScreen((u - v) / 2, (u + v) / 4 - lift - z);
    };
    const order = scene.items.map((it, i) => {
      let d;
      if (it.flat) d = -1e9;
      else if (it.t === 'light') d = 1e9;
      else {
        const [u, v] = rot(pl.x + it.at[0], pl.y + it.at[1]);
        d = u + v;
      }
      return { it, i, d };
    });
    order.sort((a, b) => a.d - b.d || a.i - b.i);
    let top = Infinity;
    const P = palette();
    const R = { g, S, tw, P, lift, pl, detail: tw >= 18, mark: (y) => { if (y < top) top = y; } };
    g.save();
    if (!active) g.globalAlpha = 0.5;
    if (scene.streets !== 'none') cityGround(g, S, scene, P, tw);
    let shaded = false;
    for (const { it } of order) {
      if (!shaded && !it.flat) {
        shaded = true;
        if (tw >= 13) castShadows(g, pl, lift, scene.items, P);
      }
      DRAW[it.t](R, it);
    }
    g.restore();
    return top;
  }

  // Pavement under the city and, closer in, a grid of streets between the building plots.
  function cityGround(g, S, scene, P, tw) {
    const k = scene.k;
    const e = 0.45 * k;
    poly(g, [S(-e, -e, 0), S(e, -e, 0), S(e, e, 0), S(-e, e, 0)], P.pave);
    if (scene.streets !== 'grid' || tw < 22) return;
    const half = 0.016 * k;
    const road = new Path2D();
    const strip = (x0, y0, x1, y1) => {
      const pts = [S(x0, y0, 0), S(x1, y0, 0), S(x1, y1, 0), S(x0, y1, 0)];
      road.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < 4; i++) road.lineTo(pts[i][0], pts[i][1]);
      road.closePath();
    };
    for (const t of [-0.24, -0.08, 0.08, 0.24]) {
      strip(t * k - half, -e, t * k + half, e);
      strip(-e, t * k - half, e, t * k + half);
    }
    g.fillStyle = P.road;
    g.fill(road);
  }

  // Shadows fall away from the light (towards the bottom right of the screen) on the ground.
  function castShadows(g, pl, lift, items, P) {
    const path = new Path2D();
    const P3 = (u, v) => isoToScreen((u - v) / 2, (u + v) / 4 - lift);
    for (const it of items) {
      const o = it.o;
      if ((o.z || 0) > 0.02) continue;
      let hx;
      let hy;
      if (it.t === 'box' || it.t === 'pyr') {
        hx = o.w / 2;
        hy = o.d / 2;
      } else if (it.t === 'cyl' || it.t === 'cone') {
        hx = o.r;
        hy = o.r;
      } else continue;
      const [u0, v0] = rot(pl.x + it.dx - hx, pl.y + it.dy - hy);
      const [u1, v1] = rot(pl.x + it.dx + hx, pl.y + it.dy + hy);
      const uA = Math.min(u0, u1);
      const vA = Math.min(v0, v1);
      const vB = Math.max(v0, v1);
      const uB = Math.max(u0, u1) + o.h * (it.t === 'pyr' || it.t === 'cone' ? 0.35 : 0.55);
      const pts = [P3(uA, vA), P3(uB, vA), P3(uB, vB), P3(uA, vB)];
      path.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < 4; i++) path.lineTo(pts[i][0], pts[i][1]);
      path.closePath();
    }
    g.fillStyle = P.bshadow;
    g.fill(path);
  }

  function poly(g, pts, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fill();
  }

  // A pin is a tiny isometric cube floating over the place.
  function drawPin(g, x, y, r, color, stroke) {
    g.lineJoin = 'round';
    g.strokeStyle = stroke;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r, y - r / 2);
    g.lineTo(x + r, y + r / 2);
    g.lineTo(x, y + r);
    g.lineTo(x - r, y + r / 2);
    g.lineTo(x - r, y - r / 2);
    g.closePath();
    g.stroke();
    poly(g, [[x, y - r], [x + r, y - r / 2], [x, y], [x - r, y - r / 2]], shade(color, 0.3));
    poly(g, [[x - r, y - r / 2], [x, y], [x, y + r], [x - r, y + r / 2]], color);
    poly(g, [[x, y], [x + r, y - r / 2], [x + r, y + r / 2], [x, y + r]], shade(color, -0.22));
  }

  function drawPlaces(g) {
    const P = palette();
    const { W, H } = state;
    const tw = state.cam.tw;
    const asCity = tw >= CITY_TW;
    const list = [];
    for (const pl of state.places) {
      const lift = state.world.height[pl.cell] * LEVEL;
      const [X, Y] = toIso(pl.x, pl.y, lift);
      const [sx, sy] = isoToScreen(X, Y);
      if (sx < -160 || sx > W + 160 || sy < -60 || sy > H + 260) continue;
      const [u, v] = rot(pl.x, pl.y);
      list.push({ pl, sx, sy, lift, depth: u + v, active: matchCount(pl) > 0 });
    }
    list.sort((a, b) => a.depth - b.depth);

    if (P.glow) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const it of list) {
        if (!it.active) continue;
        const rad = clamp(tw * 1.5, 9, 80) * (0.8 + Math.min(5, it.pl.projects.length) * 0.08) * RANK_GLOW[it.pl.rank];
        const grad = g.createRadialGradient(it.sx, it.sy, 0, it.sx, it.sy, rad);
        grad.addColorStop(0, `${P.glow}0.55)`);
        grad.addColorStop(0.35, `${P.glow}0.22)`);
        grad.addColorStop(1, `${P.glow}0)`);
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(it.sx, it.sy, rad, rad * 0.6, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    const pins = [];
    for (const it of list) {
      const { pl } = it;
      const selected = state.selected === pl;
      const hovered = state.hover === pl;
      if (selected) {
        const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([dx, dy]) => isoToScreen(...toIso(pl.c + dx, pl.r + dy, it.lift)));
        g.strokeStyle = P.pin;
        g.lineWidth = 2;
        g.beginPath();
        corners.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.stroke();
      }
      let base = it.sy;
      if (asCity) base = Math.min(it.sy, drawScene(g, pl, it.lift, it.active));
      const size = clamp(2.2 + tw * 0.55, 3.2, 5.5) * RANK_PIN[pl.rank];
      const r = selected ? size + 2.5 : hovered ? size + 1.5 : it.active ? size : size * 0.65;
      const gap = asCity ? 9 : clamp(3 + tw * 1.4, 5, 11);
      const hx = it.sx;
      const hy = base - gap - r;
      if (!asCity) {
        g.fillStyle = P.shadow;
        g.beginPath();
        g.ellipse(it.sx, it.sy, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = it.active ? P.pin : P.pinDim;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(it.sx, base - 1);
      g.lineTo(hx, hy + r);
      g.stroke();
      drawPin(g, hx, hy, r, it.active ? P.pin : P.pinDim, P.pinStroke);
      pins.push({ pl, x: hx, y: hy, r, gx: it.sx, gy: it.sy, active: it.active, selected, hovered });
    }
    drawLabels(g, pins);
    state.pins = pins;
  }

  // How important a label is: its rank, nudged up for places with many maps.
  const labelRank = (pl) => Math.max(1, pl.rank - (pl.projects.length >= 3 ? 1 : 0));
  // Which ranks get labels at the current zoom (smaller places appear as you zoom in).
  const labelCutoff = (tw) => (tw < 3 ? 1 : tw < 7 ? 2 : tw < 16 ? 3 : 4);

  function drawLabels(g, pins) {
    const P = palette();
    const cutoff = labelCutoff(state.cam.tw);
    const order = pins
      .filter((p) => p.selected || p.hovered || (p.active && labelRank(p.pl) <= cutoff))
      .sort(
        (a, b) =>
          b.selected - a.selected ||
          b.hovered - a.hovered ||
          labelRank(a.pl) - labelRank(b.pl) ||
          a.pl.rank - b.pl.rank ||
          b.pl.projects.length - a.pl.projects.length ||
          a.pl.name.localeCompare(b.pl.name),
      );
    const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const taken = [];
    // Pins of places at least as important as a label are obstacles for it.
    const heads = pins.map((p) => ({ pl: p.pl, rank: p.pl.rank, box: [p.x - p.r - 2, p.y - p.r - 2, p.x + p.r + 2, p.y + p.r + 2] }));
    state.labels = new Map();
    g.textBaseline = 'middle';
    for (const pin of order) {
      const pl = pin.pl;
      const count = String(matchCount(pl));
      const country = pl.scope === 'country';
      const name = country ? pl.name.toUpperCase() : pl.name;
      const size = country ? 15 : RANK_FONT[pl.rank];
      g.font = `400 ${size}px "Jersey 10", ui-monospace, monospace`;
      const nameW = g.measureText(name).width;
      const countW = g.measureText(count).width;
      const w = nameW + countW + size * 0.95;
      const h = Math.round(size * 1.18);
      const spots = [
        [pin.x - w / 2, pin.y - pin.r - 7 - h],
        [pin.x + pin.r + 7, pin.y - h / 2],
        [pin.x - pin.r - 7 - w, pin.y - h / 2],
        [pin.x - w / 2, pin.y + pin.r + 7],
      ];
      const forced = pin.selected || pin.hovered;
      const lr = labelRank(pl);
      let spot = null;
      for (const [x, y] of forced ? spots.slice(0, 1) : spots) {
        const box = [x - 3, y - 3, x + w + 3, y + h + 3];
        if (forced || (!taken.some((t) => overlaps(box, t)) && !heads.some((hd) => hd.pl !== pl && hd.rank <= lr && overlaps(box, hd.box)))) {
          spot = [x, y, box];
          break;
        }
      }
      if (!spot) continue;
      const [x, y, box] = spot;
      taken.push(box);
      state.labels.set(pl, box);
      g.fillStyle = P.label.bg;
      g.strokeStyle = pin.selected ? P.pin : P.label.line;
      g.lineWidth = pin.selected ? 1.5 : 1;
      g.beginPath();
      g.roundRect(x, y, w, h, Math.min(6, h / 3.5));
      g.fill();
      g.stroke();
      g.fillStyle = country ? P.label.dim : P.label.ink;
      g.fillText(name, x + size * 0.38, y + h / 2 + 1);
      g.fillStyle = P.label.count;
      g.fillText(count, x + size * 0.6 + nameW, y + h / 2 + 1);
    }
  }

  // ------------------------------------------------------------------ clouds
  // A few puffy clouds float over the board when zoomed out, and drift slowly east.
  let clouds = null;
  function buildClouds() {
    const rnd = seeded('clouds');
    const { cols, rows } = state.world;
    clouds = Array.from({ length: 22 }, () => {
      const size = 2.4 + rnd() * 3;
      const puffs = Array.from({ length: 4 + Math.floor(rnd() * 4) }, () => ({
        dx: (rnd() - 0.5) * size * 1.7,
        dy: (rnd() - 0.5) * size * 0.9,
        r: size * (0.34 + rnd() * 0.32),
      }));
      return { x: rnd() * cols, y: 6 + rnd() * (rows - 12), z: 2.6 + rnd() * 0.9, speed: 0.12 + rnd() * 0.18, puffs };
    });
  }

  const cloudFade = () => clamp((26 - state.cam.tw) / 14, 0, 1);

  function drawClouds(g, now) {
    const fade = cloudFade();
    if (fade <= 0 || !state.world) return false;
    if (!clouds) buildClouds();
    const P = palette();
    const { cols } = state.world;
    const tw = state.cam.tw;
    const t = motionQuery.matches ? 0 : now / 1000;
    const placed = clouds.map((cl) => {
      const x = (((cl.x + t * cl.speed) % cols) + cols) % cols;
      const [X, Y] = toIso(x, cl.y, LEVEL);
      return { cl, x, depth: Y };
    });
    placed.sort((a, b) => a.depth - b.depth);
    const puffAt = (cl, x, p, lift) => isoToScreen(...toIso(x + p.dx, cl.y + p.dy, lift));
    g.save();
    if (P.cloud.shadow) {
      // Shadows land on the ground, pushed away from the light.
      g.globalAlpha = fade;
      g.fillStyle = P.cloud.shadow;
      g.beginPath();
      for (const { cl, x } of placed) {
        const shift = cl.z * 0.8 * tw;
        for (const p of cl.puffs) {
          const [sx, sy] = puffAt(cl, x, p, LEVEL);
          const rx = p.r * tw * 0.6;
          g.moveTo(sx + shift * 0.5 + rx, sy + shift * 0.25);
          g.ellipse(sx + shift * 0.5, sy + shift * 0.25, rx, rx * 0.5, 0, 0, Math.PI * 2);
        }
      }
      g.fill();
    }
    g.globalAlpha = fade * P.cloud.alpha;
    for (const { cl, x } of placed) {
      const pts = cl.puffs.map((p) => {
        const [sx, sy] = puffAt(cl, x, p, LEVEL);
        return [sx, sy - cl.z * tw, p.r * tw * 0.6];
      });
      g.fillStyle = P.cloud.under;
      g.beginPath();
      for (const [x0, y0, r] of pts) {
        g.moveTo(x0 + r, y0 + r * 0.22);
        g.arc(x0, y0 + r * 0.22, r, 0, Math.PI * 2);
      }
      g.fill();
      g.fillStyle = P.cloud.body;
      g.beginPath();
      for (const [x0, y0, r] of pts) {
        g.moveTo(x0 + r * 0.92, y0);
        g.arc(x0, y0, r * 0.92, 0, Math.PI * 2);
      }
      g.fill();
    }
    g.restore();
    return true;
  }

  // ------------------------------------------------------------------ frame
  function visibleCells() {
    const [U, V] = dims();
    const { W, H } = state;
    const corners = [];
    for (const [sx, sy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      for (const lift of [-SLAB, 2]) {
        const c = state.cam;
        const X = (sx - W / 2) / c.tw + c.x;
        const Y = (sy - H / 2) / c.tw + c.y + lift;
        corners.push([2 * Y + X, 2 * Y - X]);
      }
    }
    const us = corners.map((p) => p[0]);
    const vs = corners.map((p) => p[1]);
    return [
      clamp(Math.floor(Math.min(...us)) - 1, 0, U),
      clamp(Math.ceil(Math.max(...us)) + 1, 0, U),
      clamp(Math.floor(Math.min(...vs)) - 1, 0, V),
      clamp(Math.ceil(Math.max(...vs)) + 1, 0, V),
    ];
  }

  function render() {
    const { W, H, dpr, cam } = state;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state.world || !state.cache) return;
    const devTW = cam.tw * dpr;
    const ox = (W / 2 - cam.x * cam.tw) * dpr;
    const oy = (H / 2 - cam.y * cam.tw) * dpr;
    if (devTW >= DIRECT_TW) {
      drawSlab(ctx, devTW, ox, oy);
      drawTerrain(ctx, devTW, ox, oy, ...visibleCells());
    } else {
      const c = state.cache;
      const f = devTW / c.s;
      // Only copy the part of the cached picture that is on screen.
      const sx0 = Math.max(0, (0 - (ox - c.ox * f)) / f);
      const sy0 = Math.max(0, (0 - (oy - c.oy * f)) / f);
      const sx1 = Math.min(c.canvas.width, (canvas.width - (ox - c.ox * f)) / f);
      const sy1 = Math.min(c.canvas.height, (canvas.height - (oy - c.oy * f)) / f);
      if (sx1 > sx0 && sy1 > sy0) {
        ctx.imageSmoothingEnabled = f < 1;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          c.canvas,
          sx0, sy0, sx1 - sx0, sy1 - sy0,
          ox - c.ox * f + sx0 * f, oy - c.oy * f + sy0 * f, (sx1 - sx0) * f, (sy1 - sy0) * f,
        );
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.cloudsShown = drawClouds(ctx, performance.now());
    drawPlaces(ctx);
    updateOverlays();
  }

  function requestRender() {
    if (!state.raf) state.raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    state.raf = 0;
    if (state.anim && !state.anim(now)) {
      state.anim = null;
      $('place-pop').classList.remove('traveling');
    }
    render();
    if (state.anim) requestRender();
    else if (state.cloudsShown && !motionQuery.matches && !document.hidden && !state.cloudTimer) {
      state.cloudTimer = setTimeout(() => {
        state.cloudTimer = 0;
        requestRender();
      }, 90);
    }
  }

  // ------------------------------------------------------------------ overlays that follow the map
  const narrow = () => state.W <= 700;

  function pinOf(pl) {
    const p = state.pins.find((q) => q.pl === pl);
    if (p) return p;
    const lift = state.world.height[pl.cell] * LEVEL;
    const [x, y] = isoToScreen(...toIso(pl.x, pl.y, lift));
    return { x, y: y - 20, r: 6, gx: x, gy: y };
  }

  function updateOverlays() {
    const ring = $('ring');
    const sel = state.selected && state.pins.find((p) => p.pl === state.selected);
    if (sel) {
      ring.hidden = false;
      ring.style.left = `${sel.gx}px`;
      ring.style.top = `${sel.gy}px`;
      ring.style.setProperty('--ring', `${Math.max(26, state.cam.tw * 0.72)}px`);
    } else {
      ring.hidden = true;
    }
    placePopup();
    hoverPreview();
    // Compass: where north points on screen.
    const [ax, ay] = toIso(100, 60, 0);
    const [bx, by] = toIso(100, 59, 0);
    const deg = (Math.atan2(bx - ax, -(by - ay)) * 180) / Math.PI;
    $('compass-needle').style.transform = `rotate(${deg}deg)`;
    const rad = (deg * Math.PI) / 180;
    $('compass-n').style.transform = `translate(${Math.sin(rad) * 13.5}px, ${-Math.cos(rad) * 13.5}px)`;
  }

  // The city card sits beside its city on wide screens and docks to the bottom on phones.
  function placePopup() {
    const pop = $('place-pop');
    if (!state.selected || pop.hidden) {
      setSheet(0);
      return;
    }
    if (narrow()) {
      pop.classList.add('docked');
      pop.classList.remove('on-left', 'on-right');
      setSheet(state.popSize.h);
      return;
    }
    setSheet(0);
    pop.classList.remove('docked');
    const pin = pinOf(state.selected);
    const { w, h } = state.popSize;
    const pad = 12;
    const gap = 22;
    let left;
    let side = '';
    if (pin.x + gap + w <= state.W - pad) {
      left = pin.x + gap;
      side = 'on-right';
    } else if (pin.x - gap - w >= pad) {
      left = pin.x - gap - w;
      side = 'on-left';
    } else {
      left = clamp(pin.x - w / 2, pad, state.W - w - pad);
    }
    const minTop = 70;
    const top = clamp(pin.y - h * 0.35, minTop, Math.max(minTop, state.H - h - pad));
    pop.classList.toggle('on-right', side === 'on-right');
    pop.classList.toggle('on-left', side === 'on-left');
    pop.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    pop.style.setProperty('--notch-y', `${clamp(pin.y - top, 20, h - 20)}px`);
  }

  function setSheet(px) {
    const v = `${Math.round(px)}px`;
    if (stage.style.getPropertyValue('--sheet') !== v) stage.style.setProperty('--sheet', v);
  }

  let tipFor = null;
  function hoverPreview() {
    const tip = $('tooltip');
    const pl = state.hover;
    if (!pl || pl === state.selected || state.pointer !== 'mouse') {
      tip.hidden = true;
      tipFor = null;
      return;
    }
    const pin = pinOf(pl);
    const key = `${pl.id}|${state.filter}|${state.query}`;
    if (tipFor !== key) {
      tipFor = key;
      const n = matchCount(pl);
      const dots = pl.projects.map((p) => `<i class="sw-${p.technique}"></i>`).join('');
      const names = pl.projects.slice(0, 3).map((p) => esc(p.name)).join(', ') + (pl.projects.length > 3 ? ', …' : '');
      tip.innerHTML = `<strong>${esc(pl.name)}</strong><span class="tip-dots">${dots}</span><span class="tip-sub">${esc(pl.country)} · ${n} ${n === 1 ? 'map' : 'maps'}: ${names}</span>`;
    }
    tip.style.left = `${clamp(pin.x, 140, state.W - 140)}px`;
    tip.style.top = `${pin.y - pin.r}px`;
    tip.hidden = false;
  }

  // ------------------------------------------------------------------ camera
  function boardBounds() {
    const [U, V] = dims();
    return { x0: -V / 2, x1: U / 2, y0: -1, y1: (U + V) / 4 + SLAB };
  }

  function clampCam() {
    const b = boardBounds();
    const c = state.cam;
    c.tw = clamp(c.tw, MIN_TW, MAX_TW);
    c.x = clamp(c.x, b.x0, b.x1);
    c.y = clamp(c.y, b.y0, b.y1);
  }

  function fitTw() {
    const b = boardBounds();
    return clamp(Math.min((state.W - 48) / (b.x1 - b.x0), (state.H - 64) / (b.y1 - b.y0)), MIN_TW, MAX_TW);
  }

  function homeView(animate) {
    const b = boardBounds();
    // Phones are narrow, so start a little closer than "whole board" there.
    const target = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, tw: fitTw() * (state.W < 600 ? 1.6 : 1) };
    if (animate) flyTo(target);
    else Object.assign(state.cam, target);
  }

  function zoomAt(sx, sy, factor) {
    const c = state.cam;
    const X = (sx - state.W / 2) / c.tw + c.x;
    const Y = (sy - state.H / 2) / c.tw + c.y;
    c.tw = clamp(c.tw * factor, MIN_TW, MAX_TW);
    c.x = X - (sx - state.W / 2) / c.tw;
    c.y = Y - (sy - state.H / 2) / c.tw;
    clampCam();
    requestRender();
  }

  function flyTo(to, ms = 900) {
    const from = { ...state.cam };
    if (motionQuery.matches) {
      Object.assign(state.cam, to);
      clampCam();
      requestRender();
      return false;
    }
    const dist = Math.hypot(to.x - from.x, to.y - from.y) * Math.min(from.tw, to.tw);
    const bump = clamp(Math.log(1 + dist / Math.max(1, state.W)) * 1.1, 0, 1.6);
    const t0 = performance.now();
    state.anim = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      state.cam.tw = Math.exp(lerp(Math.log(from.tw), Math.log(to.tw), e) - bump * Math.sin(Math.PI * e));
      state.cam.x = lerp(from.x, to.x, e);
      state.cam.y = lerp(from.y, to.y, e);
      clampCam();
      return t < 1;
    };
    requestRender();
    return true;
  }

  // Where to put the camera so the city lands beside its card, not under it.
  function viewFor(pl) {
    const lift = state.world.height[pl.cell] * LEVEL;
    const [X, Y] = toIso(pl.x, pl.y, lift);
    const tw = Math.max(state.cam.tw, narrow() ? 100 : 125);
    const px = narrow() ? state.W / 2 : state.W * 0.34;
    const py = narrow() ? Math.max(170, (state.H - Math.min(state.H * 0.55, state.popSize.h || state.H * 0.5)) * 0.62) : state.H * 0.6;
    return { x: X - (px - state.W / 2) / tw, y: Y - (py - state.H / 2) / tw, tw };
  }

  function turn(dir) {
    if (!state.world) return;
    const [gx, gy] = screenToGrid(state.W / 2, state.H / 2);
    state.rot = (state.rot + dir + 4) % 4;
    buildCache();
    const [X, Y] = toIso(gx, gy, LEVEL);
    state.cam.x = X;
    state.cam.y = Y;
    clampCam();
    requestRender();
  }

  // ------------------------------------------------------------------ city card, places list and search
  function select(pl, { focus = false, highlight = null, fly = true } = {}) {
    const pop = $('place-pop');
    if (!pl) {
      closePlace();
      return;
    }
    if (!state.selected && !pop.contains(document.activeElement)) state.returnFocus = document.activeElement;
    state.selected = pl;
    renderDetail(pl);
    closePlaces(false);
    pop.hidden = false;
    $('place-detail').scrollTop = 0;
    if (fly && flyTo(viewFor(pl))) pop.classList.add('traveling');
    if (location.hash !== `#${pl.id}`) history.replaceState(null, '', `#${pl.id}`);
    if (focus) $('place-title')?.focus({ preventScroll: true });
    if (highlight) {
      const el = $('place-detail').querySelector(`[data-map="${highlight}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
      }
    }
    requestRender();
  }

  function closePlace(restoreFocus = true) {
    const pop = $('place-pop');
    const hadFocus = pop.contains(document.activeElement);
    state.selected = null;
    pop.hidden = true;
    pop.classList.remove('traveling');
    if (location.hash) history.replaceState(null, '', location.href.split('#')[0]);
    if (restoreFocus && hadFocus) (state.returnFocus && document.contains(state.returnFocus) ? state.returnFocus : canvas).focus({ preventScroll: true });
    state.returnFocus = null;
    requestRender();
  }

  function openPlaces() {
    const panel = $('places-pop');
    if (narrow() && state.selected) closePlace(false);
    hideResults();
    panel.hidden = false;
    $('open-places').setAttribute('aria-expanded', 'true');
    renderFilters();
    renderList();
    $('list-title').focus({ preventScroll: true });
  }

  function closePlaces(restoreFocus = true) {
    const panel = $('places-pop');
    if (panel.hidden) return;
    const hadFocus = panel.contains(document.activeElement);
    panel.hidden = true;
    $('open-places').setAttribute('aria-expanded', 'false');
    if (restoreFocus && hadFocus) $('open-places').focus();
  }

  function renderFilters() {
    const q = norm(state.query.trim());
    const counts = { all: 0 };
    for (const pl of state.places) {
      pl.projects.forEach((p, i) => {
        if (q && !pl.hay[i].includes(q)) return;
        counts.all++;
        counts[p.technique] = (counts[p.technique] || 0) + 1;
      });
    }
    const chips = [{ id: 'all', label: 'All' }, ...TECHNIQUES];
    $('filters').innerHTML = chips
      .map((t) => {
        const sw = t.id === 'all' ? '' : `<span class="sw sw-${t.id}" aria-hidden="true"></span>`;
        return `<button type="button" class="chip" data-filter="${t.id}" aria-pressed="${state.filter === t.id}">${sw}${esc(t.label)} <span class="n">${counts[t.id] || 0}</span></button>`;
      })
      .join('');
  }

  function sortedPlaces() {
    const list = state.places.map((pl) => ({ pl, n: matchCount(pl) })).filter((x) => x.n > 0);
    const byName = (a, b) => a.pl.name.localeCompare(b.pl.name);
    if (state.sort === 'name') list.sort(byName);
    else if (state.sort === 'new') list.sort((a, b) => (b.pl.newest || '').localeCompare(a.pl.newest || '') || byName(a, b));
    else list.sort((a, b) => b.n - a.n || a.pl.rank - b.pl.rank || byName(a, b));
    return list;
  }

  function renderList() {
    const list = sortedPlaces();
    $('places').innerHTML = list
      .map(({ pl, n }) => {
        const dots = pl.projects
          .filter((_, i) => projectMatches(pl, i))
          .map((p) => `<i class="sw-${p.technique}" title="${esc(TECH_LABEL[p.technique])}"></i>`)
          .join('');
        const label = `${pl.name}, ${pl.country}: ${n} ${n === 1 ? 'map' : 'maps'}`;
        return `<li><button type="button" class="place-row" data-place="${pl.id}" aria-label="${esc(label)}">
          <span class="pr-text"><span class="pr-name">${esc(pl.name)}</span><span class="pr-country">${esc(pl.country)}</span></span>
          <span class="pr-dots" aria-hidden="true">${dots}</span>
          <span class="pr-count" aria-hidden="true">${n}</span></button></li>`;
      })
      .join('');
    const empty = $('empty');
    empty.hidden = list.length > 0;
    empty.textContent = 'No maps use this technique yet.';
    const total = list.reduce((a, x) => a + x.n, 0);
    $('list-title').textContent = state.filter !== 'all' ? `${list.length} ${list.length === 1 ? 'place' : 'places'}, ${total} ${total === 1 ? 'map' : 'maps'}` : 'Places';
    $('places-count').textContent = String(list.length);
  }

  function renderDetail(pl) {
    const n = pl.projects.length;
    const scope = pl.scope === 'country' ? 'Whole country' : pl.scope === 'region' ? 'Region' : '';
    const scene = pl.scene || (pl.scene = buildScene(pl));
    const maps = pl.projects
      .map((p) => {
        const by = p.by ? (p.byUrl ? `by <a href="${esc(p.byUrl)}" target="_blank" rel="noopener">${esc(p.by)}</a>` : `by ${esc(p.by)}`) : 'Maker not credited';
        const when = p.launched ? ` · ${p.launched.length > 4 ? 'launched ' : 'since '}${formatDate(p.launched)}` : '';
        const status = p.status ? ` <span class="badge">${STATUS_LABEL[p.status] || esc(p.status)}</span>` : '';
        const links = (p.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');
        const tags = (p.tags || []).map((t) => `<span>${esc(t)}</span>`).join('');
        return `<li class="map" data-map="${esc(p.id)}">
          <div class="map-title"><h3><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a></h3>
          <span class="tech tech-${p.technique}">${esc(TECH_LABEL[p.technique] || p.technique)}</span>${status}</div>
          <span class="host">${esc(hostOf(p.url))}</span>
          <p class="meta">${by}${when}</p>
          <p class="about">${esc(p.about)}</p>
          ${links ? `<p class="extra">${links}</p>` : ''}
          ${tags ? `<p class="tags">${tags}</p>` : ''}
        </li>`;
      })
      .join('');
    $('place-detail').innerHTML = `<div class="place-head">
        <h2 id="place-title" tabindex="-1">${esc(pl.name)}</h2>
        <p class="where">${esc(pl.country)}${scope ? ` · ${scope}` : ''} · <span class="geo">${formatLatLon(pl.lat, pl.lon)}</span> · ${n} ${n === 1 ? 'map' : 'maps'}</p>
        ${scene.landmark ? `<p class="landmark">On this map: ${esc(scene.landmark)}</p>` : ''}
      </div>
      <ol class="maps">${maps}</ol>`;
  }

  // Search suggestions: places first, then maps and makers.
  let results = [];
  let active = -1;

  function updateResults() {
    const input = $('search');
    state.query = input.value;
    renderFilters();
    if (!$('places-pop').hidden) renderList();
    requestRender();
    const q = norm(input.value.trim());
    if (!q) {
      hideResults();
      return;
    }
    const scoreOf = (s) => (s.startsWith(q) ? 0 : s.includes(` ${q}`) ? 1 : 2);
    const found = [];
    for (const pl of state.places) {
      const s = norm(`${pl.name} ${pl.country}`);
      if (s.includes(q)) found.push({ pl, score: scoreOf(norm(pl.name)) });
    }
    for (const pl of state.places) {
      pl.projects.forEach((p) => {
        const s = norm(`${p.name} ${p.by || ''} ${hostOf(p.url)}`);
        if (s.includes(q)) found.push({ pl, p, score: 3 + scoreOf(norm(p.name)) });
      });
    }
    found.sort((a, b) => a.score - b.score || a.pl.rank - b.pl.rank || (a.p ? a.p.name : a.pl.name).localeCompare(b.p ? b.p.name : b.pl.name));
    results = found.slice(0, 8);
    active = results.length ? 0 : -1;
    paintResults(input.value.trim());
  }

  function paintResults(text) {
    const list = $('results');
    if (!results.length) {
      list.innerHTML = `<li class="r-empty" role="option" aria-disabled="true">No maps match “${esc(text)}”.</li>`;
    } else {
      list.innerHTML = results
        .map((r, i) => {
          const name = r.p ? r.p.name : r.pl.name;
          const sub = r.p ? `${r.p.by ? `by ${r.p.by} · ` : ''}${r.pl.name}` : `${r.pl.country} · ${r.pl.projects.length} ${r.pl.projects.length === 1 ? 'map' : 'maps'}`;
          return `<li role="option" id="result-${i}" data-i="${i}" aria-selected="${i === active}"><span class="r-name">${esc(name)}</span><span class="r-kind">${r.p ? 'map' : 'place'}</span><span class="r-sub">${esc(sub)}</span></li>`;
        })
        .join('');
    }
    list.hidden = false;
    const input = $('search');
    input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', `result-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function hideResults() {
    $('results').hidden = true;
    $('search').setAttribute('aria-expanded', 'false');
    $('search').removeAttribute('aria-activedescendant');
  }

  function chooseResult(i) {
    const r = results[i];
    if (!r) return;
    const input = $('search');
    input.value = '';
    state.query = '';
    hideResults();
    renderFilters();
    select(r.pl, { focus: true, highlight: r.p ? r.p.id : null });
  }

  // ------------------------------------------------------------------ input
  function pick(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const p of state.pins) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < p.r + 9 && d < bestD) {
        best = p;
        bestD = d;
      }
      if (state.cam.tw >= CITY_TW) {
        const dg = Math.hypot(p.gx - x, (p.gy - y) * 1.6);
        if (dg < state.cam.tw * 0.5 && dg < bestD) {
          best = p;
          bestD = dg;
        }
      }
    }
    if (best) return best.pl;
    for (const [pl, b] of state.labels) if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return pl;
    return null;
  }

  function setHover(pl) {
    if (state.hover === pl) return;
    state.hover = pl;
    canvas.classList.toggle('over-pin', !!pl);
    requestRender();
  }

  function showCoords(sx, sy) {
    if (!state.world) return;
    const [gx, gy] = screenToGrid(sx, sy);
    const lon = state.world.lon0 + gx;
    const lat = state.world.lat0 - gy;
    $('coords').textContent = lon >= -180 && lon <= 180 && lat <= state.world.lat0 && lat >= state.world.lat0 - state.world.rows ? formatLatLon(lat, lon, 1) : '';
  }

  const pointers = new Map();
  let drag = null;
  let pinch = null;

  canvas.addEventListener('pointerdown', (e) => {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    state.pointer = e.pointerType;
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    state.anim = null;
    $('place-pop').classList.remove('traveling');
    hideResults();
    if (pointers.size === 1) {
      drag = { x: e.offsetX, y: e.offsetY, cx: state.cam.x, cy: state.cam.y, moved: false };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), tw: state.cam.tw };
      drag = null;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    state.pointer = e.pointerType;
    const prev = pointers.get(e.pointerId);
    if (prev) {
      prev.x = e.offsetX;
      prev.y = e.offsetY;
    }
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.tw * (d / Math.max(1, pinch.d))) / state.cam.tw);
      return;
    }
    if (drag) {
      const dx = e.offsetX - drag.x;
      const dy = e.offsetY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        canvas.classList.add('dragging');
        setHover(null);
      }
      if (drag.moved) {
        state.cam.x = drag.cx - dx / state.cam.tw;
        state.cam.y = drag.cy - dy / state.cam.tw;
        clampCam();
        requestRender();
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      setHover(pick(e.offsetX, e.offsetY));
      showCoords(e.offsetX, e.offsetY);
    }
  });

  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && e.type === 'pointerup' && !drag.moved) {
      const hit = pick(e.offsetX, e.offsetY);
      if (hit) select(hit);
      else {
        closePlaces(false);
        if (state.selected) closePlace(false);
      }
    }
    if (pointers.size === 0) {
      drag = null;
      canvas.classList.remove('dragging');
    } else if (pointers.size === 1 && !drag) {
      const [p] = [...pointers.values()];
      drag = { x: p.x, y: p.y, cx: state.cam.x, cy: state.cam.y, moved: true };
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !drag) setHover(null);
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      state.anim = null;
      $('place-pop').classList.remove('traveling');
      const unit = e.deltaMode === 1 ? 0.05 : 0.0016;
      zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * unit));
    },
    { passive: false },
  );

  canvas.addEventListener('dblclick', (e) => {
    state.anim = null;
    zoomAt(e.offsetX, e.offsetY, 2);
  });

  canvas.addEventListener('keydown', (e) => {
    const step = 90 / state.cam.tw;
    const keys = {
      ArrowLeft: () => (state.cam.x -= step),
      ArrowRight: () => (state.cam.x += step),
      ArrowUp: () => (state.cam.y -= step),
      ArrowDown: () => (state.cam.y += step),
    };
    if (keys[e.key]) {
      e.preventDefault();
      state.anim = null;
      keys[e.key]();
      clampCam();
      requestRender();
    } else if (e.key === 'Enter' && state.hover) {
      select(state.hover, { focus: true });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('results').hidden) hideResults();
      else if (!$('places-pop').hidden) closePlaces();
      else if (state.selected) closePlace();
      else return;
      e.preventDefault();
      return;
    }
    if (e.target.closest('input, select, textarea, dialog')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === '+' || k === '=') zoomAt(state.W / 2, state.H / 2, 1.5);
    else if (k === '-' || k === '_') zoomAt(state.W / 2, state.H / 2, 1 / 1.5);
    else if (k === 'q') turn(-1);
    else if (k === 'e') turn(1);
    else if (k === '0') homeView(true);
    else if (k === 'r') surprise();
    else if (k === '/') {
      e.preventDefault();
      $('search').focus();
    }
  });

  function surprise() {
    const pool = state.places.filter((pl) => matchCount(pl) > 0 && pl !== state.selected);
    if (pool.length) select(pool[Math.floor(Math.random() * pool.length)]);
  }

  $('zoom-in').addEventListener('click', () => zoomAt(state.W / 2, state.H / 2, 1.6));
  $('zoom-out').addEventListener('click', () => zoomAt(state.W / 2, state.H / 2, 1 / 1.6));
  $('turn-left').addEventListener('click', () => turn(-1));
  $('turn-right').addEventListener('click', () => turn(1));
  $('home').addEventListener('click', () => {
    if (state.selected) closePlace(false);
    homeView(true);
  });
  $('surprise').addEventListener('click', surprise);
  $('close-place').addEventListener('click', () => closePlace());

  // On phones the city card is a bottom sheet: drag its handle down to close it.
  let grabY = null;
  const grab = $('grab');
  grab.addEventListener('pointerdown', (e) => {
    grabY = e.clientY;
    try {
      grab.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone */
    }
  });
  grab.addEventListener('pointermove', (e) => {
    if (grabY !== null) $('place-pop').style.translate = `0 ${Math.max(0, e.clientY - grabY)}px`;
  });
  const releaseGrab = (e) => {
    if (grabY === null) return;
    const dy = e.clientY - grabY;
    grabY = null;
    $('place-pop').style.translate = '';
    if (dy > 60) closePlace();
  };
  grab.addEventListener('pointerup', releaseGrab);
  grab.addEventListener('pointercancel', releaseGrab);
  $('open-places').addEventListener('click', () => ($('places-pop').hidden ? openPlaces() : closePlaces()));
  $('close-places').addEventListener('click', () => closePlaces());

  $('places').addEventListener('click', (e) => {
    const row = e.target.closest('[data-place]');
    if (row) select(state.placeById.get(row.dataset.place), { focus: true });
  });
  $('places').addEventListener('mouseover', (e) => {
    const row = e.target.closest('[data-place]');
    state.pointer = 'list';
    setHover(row ? state.placeById.get(row.dataset.place) : null);
  });
  $('places').addEventListener('mouseleave', () => setHover(null));

  $('filters').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    renderFilters();
    renderList();
    if (state.selected) renderDetail(state.selected);
    requestRender();
  });

  $('sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderList();
  });

  const searchInput = $('search');
  searchInput.addEventListener('input', updateResults);
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) updateResults();
  });
  searchInput.addEventListener('blur', () => setTimeout(hideResults, 120));
  searchInput.addEventListener('keydown', (e) => {
    if ($('results').hidden || !results.length) {
      if (e.key === 'Enter') updateResults();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      paintResults(searchInput.value.trim());
    } else if (e.key === 'Enter') {
      e.preventDefault();
      chooseResult(Math.max(0, active));
    }
  });
  $('results').addEventListener('pointerdown', (e) => {
    const li = e.target.closest('[data-i]');
    if (!li) return;
    e.preventDefault();
    chooseResult(+li.dataset.i);
  });

  const about = $('about');
  const openAbout = () => about.showModal();
  $('open-about').addEventListener('click', openAbout);
  $('about-button').addEventListener('click', openAbout);
  about.addEventListener('click', (e) => {
    if (e.target === about) about.close();
  });

  window.addEventListener('hashchange', () => {
    const pl = state.placeById.get(decodeURIComponent(location.hash.slice(1)));
    if (pl && pl !== state.selected) select(pl);
  });

  // ------------------------------------------------------------------ size and theme
  function resize() {
    const rect = stage.getBoundingClientRect();
    state.W = Math.max(1, rect.width);
    state.H = Math.max(1, rect.height);
    state.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(state.W * state.dpr);
    canvas.height = Math.round(state.H * state.dpr);
    if (!state.world) return;
    if (!state.fitted) {
      homeView(false);
      state.fitted = true;
    }
    clampCam();
    requestRender();
  }
  new ResizeObserver(resize).observe(stage);
  new ResizeObserver(() => {
    const pop = $('place-pop');
    state.popSize = { w: pop.offsetWidth, h: pop.offsetHeight };
    requestRender();
  }).observe($('place-pop'));

  function currentTheme() {
    const forced = document.documentElement.dataset.theme;
    if (forced === 'dark' || forced === 'light') return forced;
    return darkQuery.matches ? 'dark' : 'light';
  }
  function applyTheme() {
    const t = currentTheme();
    if (t === state.theme && state.cache) return;
    state.theme = t;
    if (state.world) {
      buildCache();
      requestRender();
    }
  }
  darkQuery.addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ------------------------------------------------------------------ start
  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return res.json();
  }

  async function start() {
    state.theme = currentTheme();
    let data;
    let worldData;
    try {
      [data, worldData] = await Promise.all([getJSON(DATA_URL), getJSON(WORLD_URL)]);
    } catch (err) {
      const box = $('loading');
      box.classList.add('error');
      box.textContent =
        location.protocol === 'file:'
          ? 'Browsers do not let pages read files straight from your disk. Serve this folder instead, for example with “python3 -m http.server”, then open http://localhost:8000.'
          : `The map data did not load (${err.message}). Reload the page to try again.`;
      $('stats').textContent = '';
      return;
    }
    state.data = data;
    state.world = buildWorld(worldData);
    state.places = buildPlaces(data.projects);
    for (const pl of state.places) state.placeById.set(pl.id, pl);
    computeDepth(state.world);
    buildCache();

    const countries = new Set(data.projects.map((p) => p.country));
    $('stats').textContent = `${data.projects.length} maps · ${state.places.length} places · ${countries.size} countries`;
    const updated = formatDate(data.updated);
    $('updated').textContent = `Updated ${updated}`;
    $('about-updated').textContent = updated;
    $('atlases').innerHTML = (data.atlases || [])
      .map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a>: ${esc(a.about)}</li>`)
      .join('');

    $('loading').hidden = true;
    resize();
    renderFilters();
    renderList();
    const fromHash = state.placeById.get(decodeURIComponent(location.hash.slice(1)));
    if (fromHash) select(fromHash);
    document.fonts?.load('18px "Jersey 10"').then(requestRender, () => {});
  }

  start();
})();
