#!/usr/bin/env node
// Checks data/projects.json before it ships: required fields, formats, duplicate ids and links,
// and places whose entries disagree about where they are.
//
// Usage:
//   node tools/check-data.mjs           check the file (exits 1 on errors)
//   node tools/check-data.mjs --links   also fetch every link and report the ones that fail

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, '..', 'data', 'projects.json');

const TECHNIQUES = new Set(['ai', 'data', '3d', 'classic']);
const STATUSES = new Set(['wip', 'code']);
const SCOPES = new Set(['city', 'region', 'country']);
const KNOWN = new Set([
  'id', 'name', 'url', 'place', 'country', 'lat', 'lon', 'scope', 'by', 'byUrl',
  'launched', 'technique', 'status', 'about', 'tags', 'links',
]);

const errors = [];
const warnings = [];

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function checkProject(p, i, seen) {
  const where = `projects[${i}]${p && p.id ? ` (${p.id})` : ''}`;
  const err = (msg) => errors.push(`${where}: ${msg}`);
  if (!p || typeof p !== 'object') return err('is not an object');

  for (const key of ['id', 'name', 'url', 'place', 'country', 'technique', 'about']) {
    if (typeof p[key] !== 'string' || !p[key].trim()) err(`"${key}" is missing or empty`);
  }
  for (const key of Object.keys(p)) if (!KNOWN.has(key)) warnings.push(`${where}: unknown field "${key}"`);

  if (typeof p.id === 'string' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)) err('"id" must be lowercase words joined by hyphens');
  if (seen.ids.has(p.id)) err(`"id" repeats ${seen.ids.get(p.id)}`);
  else seen.ids.set(p.id, where);

  if (typeof p.url === 'string') {
    if (!isHttpUrl(p.url)) err('"url" must be an http(s) link');
    const key = p.url.replace(/\/$/, '').toLowerCase();
    if (seen.urls.has(key)) err(`"url" is already used by ${seen.urls.get(key)}`);
    else seen.urls.set(key, where);
  }
  if (p.byUrl !== undefined && !isHttpUrl(p.byUrl)) err('"byUrl" must be an http(s) link');
  if (p.byUrl !== undefined && !p.by) err('"byUrl" is set but "by" is missing');

  if (typeof p.lat !== 'number' || p.lat < -90 || p.lat > 90) err('"lat" must be a number from -90 to 90');
  if (typeof p.lon !== 'number' || p.lon < -180 || p.lon > 180) err('"lon" must be a number from -180 to 180');
  if (typeof p.lat === 'number' && (p.lat > 78 || p.lat < -56)) warnings.push(`${where}: lies outside the map (78°N to 56°S)`);

  if (p.technique !== undefined && !TECHNIQUES.has(p.technique)) err(`"technique" must be one of ${[...TECHNIQUES].join(', ')}`);
  if (p.status !== undefined && !STATUSES.has(p.status)) err(`"status" must be one of ${[...STATUSES].join(', ')}`);
  if (p.scope !== undefined && !SCOPES.has(p.scope)) err(`"scope" must be one of ${[...SCOPES].join(', ')}`);
  if (p.launched !== undefined && !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(p.launched)) {
    err('"launched" must look like 2026, 2026-10 or 2026-10-20');
  }
  if (typeof p.about === 'string' && (p.about.length < 20 || p.about.length > 320)) err('"about" should be one or two sentences (20 to 320 characters)');

  if (p.tags !== undefined && (!Array.isArray(p.tags) || p.tags.some((t) => typeof t !== 'string' || !t.trim()))) {
    err('"tags" must be a list of words');
  }
  if (p.links !== undefined) {
    if (!Array.isArray(p.links)) err('"links" must be a list');
    else p.links.forEach((l, j) => {
      if (!l || typeof l.label !== 'string' || !l.label.trim() || !isHttpUrl(l.url)) err(`"links[${j}]" needs a "label" and an http(s) "url"`);
    });
  }
}

async function checkLinks(data) {
  const urls = new Map();
  const add = (url, where) => url && urls.set(url, where);
  data.projects.forEach((p) => {
    add(p.url, p.id);
    add(p.byUrl, `${p.id} (maker)`);
    (p.links || []).forEach((l) => add(l.url, `${p.id} (${l.label})`));
  });
  (data.atlases || []).forEach((a) => add(a.url, a.name));

  const failed = [];
  const queue = [...urls];
  async function worker() {
    while (queue.length) {
      const [url, where] = queue.shift();
      try {
        const res = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(20000),
          headers: { 'user-agent': 'isometric-world-linkcheck (+https://github.com/diocosta/isometric-world)' },
        });
        // Some hosts turn away scripts (403/429) while working fine in a browser; report those softly.
        if (res.status >= 400) failed.push(`${res.status} ${url} (${where})`);
      } catch (e) {
        failed.push(`ERR ${url} (${where}): ${e.cause?.code || e.name}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`Fetched ${urls.size} links; ${failed.length} did not answer with a page:`);
  for (const f of failed.sort()) console.log(`  ${f}`);
}

async function main() {
  let data;
  try {
    data = JSON.parse(await readFile(FILE, 'utf8'));
  } catch (e) {
    console.error(`data/projects.json is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(data.projects)) {
    console.error('data/projects.json needs a "projects" list');
    process.exit(1);
  }
  const seen = { ids: new Map(), urls: new Map() };
  data.projects.forEach((p, i) => checkProject(p, i, seen));

  // Entries for the same place should agree on where it is.
  const places = new Map();
  for (const p of data.projects) {
    const key = `${p.place}|${p.country}`;
    const first = places.get(key);
    if (!first) places.set(key, p);
    else if (Math.abs(first.lat - p.lat) > 1.5 || Math.abs(first.lon - p.lon) > 1.5) {
      warnings.push(`${p.id}: "${p.place}" is more than 1.5° away from ${first.id}; check the coordinates`);
    }
  }
  (data.atlases || []).forEach((a, i) => {
    if (!a.name || !isHttpUrl(a.url) || !a.about) errors.push(`atlases[${i}]: needs "name", "url" and "about"`);
  });

  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  const countries = new Set(data.projects.map((p) => p.country));
  console.log(`${data.projects.length} maps in ${places.size} places and ${countries.size} countries: ${errors.length} errors, ${warnings.length} warnings.`);

  if (process.argv.includes('--links')) await checkLinks(data);
  if (errors.length) process.exit(1);
}

main();
