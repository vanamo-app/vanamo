// Vanamo-Baum – erzeugt von werkstatt/modul.py aus der Testseite. Nicht von Hand ändern: neu bauen.
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';


const __img = (n) => new URL('img/' + n, import.meta.url).href;
const HUD = '<div id="loading">Der Baum wird gepflanzt …</div>\n<div class="top" id="fps" aria-live="off">– fps</div>\n<div class="hud">\n  <div class="row">\n    <span class="title">Vanamo-Baum</span>\n    <span class="stagelbl" id="stagelbl">Stufe – von –</span>\n  </div>\n  <div class="row">\n    <input type="range" id="slider" min="0" max="10" step="1" value="10" aria-label="Stufe">\n  </div>\n  <div class="row">\n    <button class="primary" id="next">Nächste Stufe wachsen</button>\n    <button id="next2">Zwei Stufen auf einmal</button>\n    <button id="play">Alle Stufen durchwachsen</button>\n    <button id="reset">Stufe 1</button>\n    <button id="jayrun">Eichelhäher kommt</button>\n    <button id="sqrun">Eichhörnchen kommt</button>\n    <button id="sqzoom">Eichhörnchen ansehen</button>\n    <div class="seasons" role="group" aria-label="Jahreszeit">\n      <button data-season="fruehling" aria-pressed="false">Frühling</button>\n      <button data-season="sommer" aria-pressed="true">Sommer</button>\n      <button data-season="herbst" aria-pressed="false">Herbst</button>\n      <button data-season="winter" aria-pressed="false">Winter</button>\n    </div>\n  </div>\n  <div class="row">\n    <label for="year" class="stagelbl">Vanamo-Jahr</label>\n    <input type="range" id="year" min="0" max="112" step="0.25" value="42">\n    <button id="yearplay">Jahr abspielen</button>\n  </div>\n  <div class="row"><span class="stagelbl" id="yearlbl">Tag –</span></div>\n</div>';

/**
 * Baut den Vanamo-Baum in `host` (ein Element mit fester Größe; die Leinwand füllt es aus).
 * opt.stage   Stufe 0–10 zum Start            opt.day    Tag im Vanamo-Jahr (0–112)
 * opt.page    true: Mausrad scrollt die Seite (Zoomen nur mit Strg/Zwei-Finger), kein Test-Zubehör
 * opt.frameY  Höhe des Bildziels relativ zum Ausschnitt (Testseite 1/3; kleiner = Baum tiefer im Bild)
 * opt.maxDpr  höchstes Pixelverhältnis (Handy: weniger Pixel, flüssiger)
 * opt.night   true/false: Nacht fest (sonst folgt der Baum html[data-theme-mode=dark])
 * opt.nightFx false: keine Glühwürmchen/Eiskristalle (Platzhalter-Bilder)
 * opt.opaque  true: Seitenfarbe als Hintergrund statt durchsichtig (Platzhalter-Bilder)
 * opt.seed    false: in Stufe 0 liegt noch keine Eichel (der Häher bringt sie: jay())
 */
export function createBaum(host, OPT = {}) {
const __ui = document.createElement('div'); __ui.hidden = true; __ui.innerHTML = HUD;
const $id = (id) => __ui.querySelector('#' + id);
const W = () => Math.max(1, host.clientWidth), H = () => Math.max(1, host.clientHeight);
const MAX_DPR = OPT.maxDpr || 2;
let FRAME_Y = OPT.frameY ?? 1 / 3;
const __zoomBase0 = OPT.page ? (OPT.zoom || 1) : 1; let __zoomBase = __zoomBase0, __zoomMax = OPT.page ? __zoomBase0 : 1.25;
let __loop = null, __running = false, __resumed = false, __readyRes;
// ---- gebackene Daten (data/ neben dem Modul)
const __baked = { tree: null };
const __data = (n) => new URL('data/' + n, import.meta.url).href;
async function __atlas(name) {
  const r = await fetch(__data(name)); if (!r.ok) throw new Error(name);
  const bmp = await createImageBitmap(await r.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const S = bmp.height, c = document.createElement('canvas'); c.width = bmp.width; c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
  const rgb = g.getImageData(0, 0, S, S).data, al = g.getImageData(S, 0, S, S).data, out = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) { out[i * 4] = rgb[i * 4]; out[i * 4 + 1] = rgb[i * 4 + 1]; out[i * 4 + 2] = rgb[i * 4 + 2]; out[i * 4 + 3] = al[i * 4]; }
  return out;
}
async function __treeData() {
  const r = await fetch(__data('baum.bin')); if (!r.ok) throw new Error('baum.bin');
  const buf = await r.arrayBuffer(), dv = new DataView(buf), hl = dv.getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  let off = 4 + hl; off = (off + 3) & ~3;
  const arr = (T, n) => { const a = new T(buf, off, n); off += n * T.BYTES_PER_ELEMENT; return a; };
  const N = head.N;
  const vecs = (f) => { const a = []; for (let i = 0; i < N; i++) a.push(new THREE.Vector3(f[i * 3], f[i * 3 + 1], f[i * 3 + 2])); return a; };
  const hideAt = arr(Float32Array, N), pos = vecs(arr(Float32Array, N * 3)), deadAt = arr(Float32Array, N), parent = arr(Int32Array, N),
    birth = arr(Float32Array, N), dir = vecs(arr(Float32Array, N * 3)), sLen = arr(Float32Array, N);
  return { rnd: head.rnd, tree: { hideAt, pos, deadAt, parent, birth, dir, sLen, layerStart: head.layerStart, Tmax: head.Tmax, N } };
}
async function __bakedLoad(day) {
  if (OPT.baked === false) return;
  const st = yearState(day), sns = [...new Set([st.from, st.to])];
  season = st.from;          // gleich mit der richtigen Jahreszeit bauen (sonst würde erst der Sommer gemalt)
  const jobs = [__treeData().then(t => { __baked.tree = t; })];
  // Falllaub (Herbst-Wiese) liegt im Herbst und am Anfang des Winters
  if (sns.includes('herbst') || sns.includes('winter')) jobs.push(__atlas('wiese-herbst.webp').then(d => { meadowAtlasCache.herbst = d; }));
  for (const sn of sns) {
    jobs.push(__atlas('blatt-' + sn + '.webp').then(d => { leafAtlasCache[sn] = d; }));
    jobs.push(__atlas('wiese-' + sn + '.webp').then(d => { meadowAtlasCache[sn] = d; }));
  }
  const res = await Promise.allSettled(jobs);
  if (res.some(r => r.status === 'rejected')) console.warn('Baum: vorab gerechnete Daten fehlen teilweise – rechne selbst');
}
const __ready = new Promise((r) => { __readyRes = r; });
const V = THREE.Vector3;
const reduceMotion = OPT.reduceMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ Zufall
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const __rnd0 = mulberry32(20261017); let __rndN = 0;
const rnd = () => { __rndN++; return __rnd0(); };
const rr = (a, b) => a + (b - a) * rnd();
function randUnit() { const z = rr(-1, 1), t = rr(0, Math.PI * 2), s = Math.sqrt(1 - z * z); return new V(s * Math.cos(t), z, s * Math.sin(t)); }

// ------------------------------------------------------------------ Baum wachsen lassen (Space Colonization)
// Die Krone wächst in Schichten: jede Schicht ist die Kronenhülle in größerem Maßstab.
// Äste wachsen zu Lichtpunkten (Attraktoren) in Laubklumpen auf der Hülle.
function smooth01(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
function __growTree() {
  // Stieleiche nach Referenz: Höhe ~9, Krone ~1,35x so breit wie hoch, am breitesten bei ~0,6 H,
  // seitlich bis ~0,3 H herab; Gabelung in mehrere Hauptäste bei ~0,44 H
  const CROWN_C = new V(0, 5.5, 0);
  const FORK = 3.7;
  const crownR = (s) => { const w = 0.7 + 0.3 * smooth01((s - 0.3) / 0.6);       // jung: rund, alt: breit
    return { x: 6.0 * w, z: 5.0 * w, up: 3.5, down: 3.0 }; };
  const LAYERS = [0.2, 0.32, 0.45, 0.58, 0.72, 0.86, 1.0];
  const D = 0.13, DI = 2.4, DK = 0.32;
  const pos = [], parent = [], birth = [], dir = [], dead = [], deadAt = [], nChild = [];
  const isTrunk = [], limbBaseY = [], limbLen = [], lowLimb = [];
  const TRUNK_CLEAR_MAX = 2.9;
  let TRUNK_CLEAR = 0.5;            // wächst mit dem Baum mit (junger Baum: Krone fast bis unten)   // spätere freie Stammhöhe: darunter nur kurze Seitenästchen
  const lowCap = (y) => 0.3 + 0.55 * Math.min(1, y / TRUNK_CLEAR_MAX);   // max. Länge dieser Ästchen
  const cell = DI, grid = new Map();
  const key = (x, y, z) => x + ',' + y + ',' + z;
  function addNode(p, par, b, d, trunk = false) {
    const i = pos.length; pos.push(p); parent.push(par); birth.push(b); dir.push(d); dead.push(0); deadAt.push(1e9); nChild.push(0); if (par >= 0) nChild[par]++;
    isTrunk.push(trunk);
    if (par < 0 || trunk) { limbBaseY.push(1e9); limbLen.push(0); lowLimb.push(false); }
    else if (isTrunk[par]) { limbBaseY.push(pos[par].y); limbLen.push(D); lowLimb.push(pos[par].y < TRUNK_CLEAR); }   // bei Entstehung festgelegt
    else { limbBaseY.push(limbBaseY[par]); limbLen.push(limbLen[par] + D); lowLimb.push(lowLimb[par]); }
    const k = key(Math.floor(p.x / cell), Math.floor(p.y / cell), Math.floor(p.z / cell));
    let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i);
    return i;
  }
  // darf an diesem Knoten noch etwas wachsen? (unten am Stamm nur kurze Ästchen)
  function blocked(n) {
    if (isTrunk[n]) return pos[n].y < TRUNK_CLEAR && nChild[n] >= 2;
    return limbBaseY[n] < TRUNK_CLEAR && limbLen[n] + D > lowCap(limbBaseY[n]);
  }
  function nearest(p, growOnly = false) {
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell);
    let best = -1, bd = DI * DI;
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (let z = cz - 1; z <= cz + 1; z++) {
      const a = grid.get(key(x, y, z)); if (!a) continue;
      for (const i of a) { if (dead[i] || (growOnly && (i === trunkTip || blocked(i)))) continue; const d2 = pos[i].distanceToSquared(p); if (d2 < bd) { bd = d2; best = i; } }
    }
    return [best, Math.sqrt(bd)];
  }
  // Attraktoren einer Schicht: Laubklumpen auf der (unregelmäßigen) Kronenhülle
  function layerPoints(s) {
    const pts = [];
    const nClump = Math.round(8 + 44 * s), perClump = Math.round(12 + 30 * s);
    const R = crownR(s);
    for (let c = 0; c < nClump; c++) {
      let u; do { u = randUnit(); } while (u.y < -0.55);
      const bulge = rr(0.8, 1.03);
      const cc = new V(u.x * R.x, u.y * (u.y > 0 ? R.up : R.down), u.z * R.z).multiplyScalar(bulge * s).add(CROWN_C.clone().multiplyScalar(s));
      const rad = rr(0.55, 0.95) * (0.55 + 0.45 * s);
      for (let k = 0; k < perClump; k++) {
        const q = randUnit().multiplyScalar(rad * Math.cbrt(rnd()));
        q.y *= 0.8;
        pts.push(cc.clone().add(q));
      }
    }
    return pts.filter(p => p.y > 2.5 * s * Math.min(1, s / 0.5) + 0.25 && !(s > 0.5 && Math.hypot(p.x, p.z) < 2.6 * s && p.y < 5.2 * s));   // innen unten offen: dort sieht man die Hauptäste
  }
  const root = addNode(new V(0, 0, 0), -1, 0, new V(0, 1, 0), true);
  let trunkTip = root;
  let att = [], layer = 0, layerStart = [0], layerInit = 0, iter = 0;
  att = layerPoints(LAYERS[0]); layerInit = att.length;
  TRUNK_CLEAR = Math.min(TRUNK_CLEAR_MAX, CROWN_C.y * LAYERS[0] * 0.45);
  let sinceLayer = 0, stall = 0;
  while (iter < 900) {
    iter++; sinceLayer++;
    let grewNow = 0;
    const acc = new Map();
    const keep = [];
    for (const a of att) {
      const [n0, d0] = nearest(a);
      if (n0 >= 0 && d0 < DK) continue;             // erreicht -> Punkt verbraucht
      keep.push(a);
      const [n, d] = nearest(a, true);              // Licht geht nur an Knoten, die noch wachsen dürfen
      if (n < 0) continue;
      const v = a.clone().sub(pos[n]).normalize();
      const e = acc.get(n); if (e) { e.add(v); e.n++; } else { v.n = 1; acc.set(n, v); }
    }
    att = keep;
    for (const [n, v] of acc) {
      if (n === trunkTip) continue;                                          // Leittrieb wächst eigens
      if (blocked(n)) continue;  // untere Ästchen bleiben klein
      const d = v.clone().normalize();
      // Eiche: dicke Äste steigen schräg auf und biegen erst außen ab (Lichtzug nach oben, Schwung)
      const upB = 0.06 + 0.22 * Math.max(0, 1 - Math.hypot(pos[n].x, pos[n].z) / 4.5);
      d.add(dir[n].clone().multiplyScalar(0.55)).add(new V(0, upB, 0)).add(randUnit().multiplyScalar(0.2)).normalize();
      const p = pos[n].clone().addScaledVector(d, D);
      const [m, dm] = nearest(p);
      if (m >= 0 && dm < D * 0.45) continue;      // keine doppelten Triebe
      addNode(p, n, iter, d); grewNow++;
    }
    // Leittrieb: wächst nach oben bis etwa zur Kronenmitte der aktuellen Schicht
    const leaderTarget = Math.min(CROWN_C.y * LAYERS[layer] * 0.95, FORK);   // alt: Leittrieb endet an der Gabelung
    if (pos[trunkTip].y < leaderTarget) {
      let pull = new V(0, 1, 0);
      if (att.length) pull = att.reduce((q, a) => q.add(a), new V()).multiplyScalar(1 / att.length).sub(pos[trunkTip]).normalize();
      const y = pos[trunkTip].y;
      const sway = new V(Math.sin(y * 0.75 + 0.6) * 0.22, 0, Math.cos(y * 0.55 + 1.9) * 0.16);   // sanfter S-Schwung
      const d = pull.lerp(new V(0, 1, 0), 0.8).add(sway).add(randUnit().multiplyScalar(0.05)).normalize();
      trunkTip = addNode(pos[trunkTip].clone().addScaledVector(d, D), trunkTip, iter, d, true);
    }
    // Stufe zu Ende, wenn die Punkte verbraucht sind oder nichts mehr wächst
    stall = (grewNow < 2 && pos[trunkTip].y >= leaderTarget) ? stall + 1 : 0;
    if (att.length < layerInit * 0.06 || stall >= 3 || sinceLayer > 45) {
      stall = 0;
      layer++;
      if (layer >= LAYERS.length) break;
      layerStart.push(iter);
      att = att.concat(layerPoints(LAYERS[layer])); layerInit = att.length; sinceLayer = 0;
      TRUNK_CLEAR = Math.min(TRUNK_CLEAR_MAX, CROWN_C.y * LAYERS[layer] * 0.45);
    }
  }
  const N = pos.length;
  // Glätten (Knicke raus), Wurzel fest
  const firstChild = new Int32Array(N).fill(-1);
  for (let i = 1; i < N; i++) if (firstChild[parent[i]] < 0) firstChild[parent[i]] = i;
  for (let pass = 0; pass < 10; pass++) {
    const np = pos.map(p => p.clone());
    for (let i = 1; i < N; i++) {
      const c = firstChild[i]; if (c < 0) continue;
      if (pass >= 3 && pos[i].y > 2.6) continue;   // Stamm extra glätten
      np[i] = pos[i].clone().multiplyScalar(0.5).addScaledVector(pos[parent[i]], 0.25).addScaledVector(pos[c], 0.25);
    }
    for (let i = 1; i < N; i++) pos[i] = np[i];
  }
  // Länge entlang der Äste (für die Rinde)
  const sLen = new Float32Array(N);
  for (let i = 1; i < N; i++) sLen[i] = sLen[parent[i]] + pos[i].distanceTo(pos[parent[i]]);
  // Stillgelegte Äste welken einzeln: jeder zu seiner Zeit, von der Spitze zur Basis
  const hideAt = new Float32Array(N).fill(1e9);
  const life = new Float32Array(N), depth = new Float32Array(N), maxDepth = new Float32Array(N), droot = new Int32Array(N).fill(-1);
  for (let i = 1; i < N; i++) {
    if (deadAt[i] > 1e8) continue;
    const pp = parent[i];
    if (pp < 0 || deadAt[pp] !== deadAt[i]) { droot[i] = i; life[i] = rr(6, 30); depth[i] = 0; }
    else { droot[i] = droot[pp]; depth[i] = depth[pp] + pos[i].distanceTo(pos[pp]); }
    if (droot[i] >= 0 && depth[i] > maxDepth[droot[i]]) maxDepth[droot[i]] = depth[i];
  }
  for (let i = 1; i < N; i++) {
    const r = droot[i]; if (r < 0) continue;
    hideAt[i] = deadAt[i] + life[r] - 1.5 * (depth[i] / Math.max(maxDepth[r], 1e-3));
  }
  layerStart.push(iter);
  return { hideAt, pos, deadAt: Float32Array.from(deadAt), parent: Int32Array.from(parent), birth: Float32Array.from(birth), dir, sLen, layerStart, Tmax: iter + 12, N };
}

// Wachstum: gebacken laden oder selbst rechnen (die Zufallsfolge läuft danach in beiden Fällen gleich weiter)
let __lastTreeRnd = 0;
function growTree() {
  const B = __baked.tree;
  if (B) { for (let i = 0; i < B.rnd; i++) rnd(); return B.tree; }
  const r0 = __rndN, t = __growTree(); __lastTreeRnd = __rndN - r0; return t;
}

// ------------------------------------------------------------------ Texturen
const PAL2 = {
  fruehling: { c: ['#a8d45a', '#bfe070', '#93c84c', '#d2ec8e', '#b3da62', '#c8e47e'], acc: ['#e3ee9c', '#9fd07a'], twig: '#6b5a4a' },
  sommer:    { c: ['#78ad3a', '#8fbf44', '#5f9932', '#a9cc54', '#6aa23c', '#4f8a36'], acc: ['#3d7a5e', '#c4d860'], twig: '#5c4840' },
  herbst:    { c: ['#e8742e', '#f09448', '#e05a38', '#f2ae4c', '#dc8448', '#ca4a30'], acc: ['#7c3e6a', '#94507a'], twig: '#5a3e46' },
  winter:    { c: ['#888888'], acc: ['#888888'], twig: '#555555' },
};
function shadeHex(h, k, toward) {
  const c = new THREE.Color(h); const t = new THREE.Color(toward || '#000000');
  return k < 1 ? c.lerp(t, 1 - k) : c.lerp(new THREE.Color(toward || '#fff6c8'), k - 1);
}
function css(c) { return '#' + c.getHexString(); }
function paintLeafAtlas(season) {
  const S = 1024, H2 = S / 2, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const P = PAL2[season] || PAL2.sommer;
  const shadowHue = season === 'herbst' ? '#3a1f2e' : season === 'sommer' ? '#173226' : '#2c4a22';
  for (let cell = 0; cell < 4; cell++) {
    const r2 = mulberry32(31 + cell * 17);
    const ox = (cell % 2) * H2, oy = (cell >> 1) * H2;
    g.save(); g.translate(ox, oy);
    g.beginPath(); g.rect(4, 4, H2 - 8, H2 - 8); g.clip();
    // Zweig: Hauptstiel von unten Mitte, 2–3 Seitenzweige
    const twig = [];
    const bx = H2 * 0.5, by = H2 * 0.99;
    const tipx = H2 * (0.44 + 0.12 * r2()), tipy = H2 * 0.24;
    twig.push([bx, by, H2 * (0.5 + (r2() - .5) * .1), H2 * 0.55, tipx, tipy, 5.5]);
    const nb = 3;
    for (let b = 0; b < nb; b++) {
      const t = 0.3 + 0.45 * b / Math.max(1, nb - 1) + (r2() - .5) * .08;
      const sx = bx + (H2 * 0.5 - bx) * t * 2 * 0 + (tipx - bx) * t, sy = by + (tipy - by) * t;
      const side = b % 2 ? 1 : -1;
      const ex = sx + side * H2 * (0.26 + 0.08 * r2()), ey = sy - H2 * (0.16 + 0.1 * r2());
      twig.push([sx, sy, (sx + ex) / 2 + side * 8, (sy + ey) / 2 + 14, ex, ey, 3.2]);
    }
    g.strokeStyle = P.twig; g.lineCap = 'round';
    for (const [x0, y0, cx, cy, x1, y1, w] of twig) { g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke(); }
    // Blätter entlang der Zweige
    const leaves = [];
    for (const [x0, y0, cx, cy, x1, y1, w] of twig) {
      const n = w > 4 ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const t = 0.25 + 0.75 * i / (n - 1);
        const qx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, qy = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
        const tx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx), ty = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
        const a0 = Math.atan2(ty, tx);
        const side = i % 2 ? 1 : -1;
        const ang = i === n - 1 ? a0 : a0 + side * (0.75 + 0.35 * r2());
        const len = H2 * (0.14 + 0.05 * r2()) * (w > 4 ? 1 : 0.92);
        let col = P.c[Math.floor(r2() * P.c.length)];
        if (r2() < 0.13) col = P.acc[Math.floor(r2() * P.acc.length)];
        leaves.push({ x: qx, y: qy, ang, len, w: len * (0.36 + 0.08 * r2()), col, bend: (r2() - .5) * .3 });
      }
    }
    leaves.sort(() => r2() - 0.5);
    for (const L of leaves) {
      g.save(); g.translate(L.x, L.y); g.rotate(L.ang);
      g.strokeStyle = P.twig; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(L.len * 0.1, 0); g.stroke();
      g.translate(L.len * 0.08, 0);
      const len = L.len, w = L.w, bd = L.bend * w;
      const path = new Path2D();
      path.moveTo(0, 0);
      path.bezierCurveTo(len * 0.18, -w * 1.15, len * 0.68, -w * 1.0 + bd, len, bd * 1.4);
      path.bezierCurveTo(len * 0.68, w * 1.0 + bd, len * 0.18, w * 1.15, 0, 0);
      const grad = g.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, css(shadeHex(L.col, 0.55, shadowHue)));
      grad.addColorStop(0.45, css(shadeHex(L.col, 0.92, shadowHue)));
      grad.addColorStop(1, css(shadeHex(L.col, 1.22)));
      g.fillStyle = grad; g.fill(path);
      g.save(); g.clip(path);
      // eine Blatthälfte etwas dunkler (gefaltet), Rand innen heller
      g.fillStyle = 'rgba(30,10,30,0.13)'; g.fillRect(0, 0, len * 1.1, w * 1.3);
      g.strokeStyle = css(shadeHex(L.col, 1.35)); g.globalAlpha = 0.55; g.lineWidth = 3.2; g.stroke(path); g.globalAlpha = 1;
      // Adern
      const vein = css(shadeHex(L.col, 0.5, shadowHue));
      g.strokeStyle = vein; g.globalAlpha = 0.75; g.lineWidth = 1.7;
      g.beginPath(); g.moveTo(1, 0); g.quadraticCurveTo(len * 0.5, bd * 0.6, len * 0.93, bd * 1.3); g.stroke();
      g.lineWidth = 1.0; g.globalAlpha = 0.55;
      for (let k = 1; k <= 4; k++) {
        const x = len * (0.12 + k * 0.17), y0 = bd * (x / len) * 1.1;
        g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + len * 0.08, y0 - w * 0.35, x + len * 0.17, y0 - w * 0.62); g.stroke();
        g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + len * 0.08, y0 + w * 0.35, x + len * 0.17, y0 + w * 0.62); g.stroke();
      }
      g.globalAlpha = 1; g.restore();
      // feine dunkle Kontur (Comic)
      g.strokeStyle = css(shadeHex(L.col, 0.42, shadowHue)); g.globalAlpha = 0.35; g.lineWidth = 1.2; g.stroke(path); g.globalAlpha = 1;
      g.restore();
    }
    g.restore();
  }
  window.__atlasCanvas = c;
  // Farbe in die durchsichtigen Pixel verlängern (kein fremder Saum beim Filtern)
  const id = g.getImageData(0, 0, S, S), d = id.data;
  const col = new Float32Array(S * S * 3), has = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) if (d[i * 4 + 3] > 8) { has[i] = 1; col[i * 3] = d[i * 4]; col[i * 3 + 1] = d[i * 4 + 1]; col[i * 3 + 2] = d[i * 4 + 2]; }
  for (let pass = 0; pass < 10; pass++) {
    const nh = has.slice();
    for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
      const i = y * S + x; if (has[i]) continue;
      let r = 0, gg = 0, b = 0, n = 0;
      for (const j of [i - 1, i + 1, i - S, i + S]) if (has[j]) { r += col[j * 3]; gg += col[j * 3 + 1]; b += col[j * 3 + 2]; n++; }
      if (n) { col[i * 3] = r / n; col[i * 3 + 1] = gg / n; col[i * 3 + 2] = b / n; nh[i] = 1; }
    }
    has.set(nh);
  }
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, o = ((S - 1 - y) * S + x) * 4;
    data[o] = col[i * 3]; data[o + 1] = col[i * 3 + 1]; data[o + 2] = col[i * 3 + 2]; data[o + 3] = d[i * 4 + 3];
  }
  return data;
}
function leafTexture() {
  const S = 1024;
  const t = new THREE.DataTexture(leafAtlasData(season), S, S, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true; t.userData.season = season;
  return t;
}
// weicher Comic-Verlauf: drei Helligkeitsstufen mit sanften Übergängen
const toonRamp = (() => { const d = new Uint8Array([88, 88, 88, 255, 160, 160, 160, 255, 222, 222, 222, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
function groundTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.72, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-atop';
  const r2 = mulberry32(3);
  for (let i = 0; i < 5000; i++) { const v = 170 + r2() * 85 | 0; g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.fillRect(r2() * S, r2() * S, 1, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------ Szene
const stageEl = host;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !OPT.opaque, premultipliedAlpha: true });   // undurchsichtig: keine hellen Säume an weichen Blatträndern
renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_DPR));
renderer.setSize(W(), H()); renderer.setClearColor(0x000000, OPT.opaque ? 1 : 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
stageEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Hintergrund = Seitenfarbe (folgt hellem/dunklem Design)
function syncBg() { if (!OPT.opaque) { scene.background = null; return; } scene.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f6f3ea'); }
syncBg();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncBg);
new MutationObserver(syncBg).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
const camera = new THREE.PerspectiveCamera(32, W() / H(), 0.1, 200);
camera.position.set(9.5, 5.2, 20.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3.5, 0); controls.enableDamping = true; controls.enablePan = false;
controls.enableZoom = false; controls.minDistance = 0.5; controls.maxDistance = 60; controls.maxPolarAngle = Math.PI * 0.53;
controls.update();
// Auf Touch-Geräten kein Drehen (wie später in der App)
// Drehen nur seitlich und begrenzt: ±24° um die Vorderansicht (Höhe bestimmt die Bildregie, nicht die Maus)
const AZ0 = Math.atan2(camera.position.x, camera.position.z), AZ_RANGE = 0.42;
controls.minAzimuthAngle = AZ0 - AZ_RANGE; controls.maxAzimuthAngle = AZ0 + AZ_RANGE;
controls.rotateSpeed = 0.5;

const __hemi = new THREE.HemisphereLight(0xe8eef4, 0x6a7240, 1.25); scene.add(__hemi);
const sun = new THREE.DirectionalLight(0xfff4e2, 2.7);
sun.position.set(-10, 12, 2.5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 13, bottom: -3, near: 1, far: 40 });
sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.06; sun.shadow.radius = 5; sun.shadow.blurSamples = 16;   // weiche Schattenränder
scene.add(sun);
const SUN_DIR = sun.position.clone().normalize();
// ---- Nacht: Werte bei Tag (0) und Nacht (1) – Nacht = Vorschlag A, einen Tick heller
const __NIGHT = {
  hemiSky: [0xe8eef4, 0x41558f], hemiGround: [0x6a7240, 0x0d1220], hemiI: [1.25, 1.2],
  sunC: [0xfff4e2, 0xc4d4ff], sunI: [2.7, 1.95], exp: [1.05, 1.04],
  fill: [0.2, 0.04], back: [1, 0.25], glowMul: [1, 0.2],
  pics: [1, 0.13],   // gemalte Bilder (Eichhörnchen, Häher, Eichel): kein Licht – nachts so dunkel wie das Laub im Schatten
  sat: 0.4, tint: [0.6, 0.72, 1.12],
};
const __nightS = { k: 0, target: 0, ready: false, glowDay: 0.1, last: 0 };
const __NG = { uNight: { value: 0 }, uNightSat: { value: __NIGHT.sat }, uNightTint: { value: new THREE.Vector3(...__NIGHT.tint) } };
const __GRADE = `
 { vec3 nc0 = gl_FragColor.rgb; float nl0 = dot(nc0, vec3(.299, .587, .114));
   gl_FragColor.rgb = mix(nc0, mix(vec3(nl0), nc0, uNightSat) * uNightTint, uNight); }`;
// Nachtfärbung in ein Material einhängen (vor dem ersten Übersetzen – danach kostet der Wechsel nichts mehr)
function __nightify(m) {
  if (!m || m.userData.__night || m.isMeshDepthMaterial || m.isMeshDistanceMaterial || m.isShaderMaterial || m.colorWrite === false) return false;
  m.userData.__night = true;
  const orig = m.onBeforeCompile;
  m.onBeforeCompile = function (sh, r) {
    if (orig) orig.call(this, sh, r);
    Object.assign(sh.uniforms, __NG);
    sh.fragmentShader = 'uniform float uNight; uniform float uNightSat; uniform vec3 uNightTint;\n' +
      sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>' + __GRADE);
  };
  m.needsUpdate = true;
  return true;
}
const __nightPics = [];   // gemalte Bilder (MeshBasic ohne Tone Mapping): reagieren nicht aufs Licht → nachts per Farbe abdunkeln
function __nightPic(m) {
  if (!m || m.userData.__pic || !m.isMeshBasicMaterial || m.toneMapped !== false || m.colorWrite === false || !m.map) return;
  m.userData.__pic = m.color.clone(); __nightPics.push(m);
  m.color.copy(m.userData.__pic).multiplyScalar(__mix(...__NIGHT.pics, __nightS.k));
}
function __nightAll(extra = []) {
  let n = 0;
  scene.traverse(o => { for (const x of [].concat(o.material || [])) { if (__nightify(x)) n++; __nightPic(x); } });
  for (const x of extra) if (__nightify(x)) n++;
  return n;
}
const __isNight = () => document.documentElement.dataset.themeMode === 'dark';
const __mix = (a, b, k) => a + (b - a) * k;
const __cA = new THREE.Color(), __cB = new THREE.Color();
const __mixC = (target, pair, k) => target.copy(__cA.setHex(pair[0])).lerp(__cB.setHex(pair[1]), k);
function __nightApply() {
  if (!__nightS.ready) return;
  const k = __nightS.k, N = __NIGHT;
  __mixC(__hemi.color, N.hemiSky, k); __mixC(__hemi.groundColor, N.hemiGround, k); __hemi.intensity = __mix(...N.hemiI, k);
  __mixC(sun.color, N.sunC, k); sun.intensity = __mix(...N.sunI, k);
  renderer.toneMappingExposure = __mix(...N.exp, k);
  groundUniforms.uFill.value = __mix(...N.fill, k);
  leafUniforms.uBack.value = __mix(...N.back, k);
  leafUniforms.uGlow.value = __nightS.glowDay * __mix(...N.glowMul, k);
  __NG.uNight.value = k;
  const pf = __mix(...N.pics, k); for (const m of __nightPics) m.color.copy(m.userData.__pic).multiplyScalar(pf);
}
// Saisonanteil (0–1) für Glühwürmchen/Eiskristalle, mit weichem Übergang in der Wechselzeit
const __seasonW = (sn) => !yearSt ? 0 : (yearSt.from === sn ? 1 - yearSt.u : 0) + (yearSt.to === sn ? yearSt.u : 0);
// einmal je Bild: Übergang weiterführen, Nachtwesen steuern
function __nightTick(now) {
  const dt = Math.min(0.1, Math.max(0, (now - (__nightS.last || now)) / 1000)); __nightS.last = now;
  if (__nightS.k !== __nightS.target) {
    const step = dt / 1.2, d = __nightS.target - __nightS.k;
    __nightS.k = Math.abs(d) <= step ? __nightS.target : __nightS.k + Math.sign(d) * step;
    __nightApply();
  }
  if (__nightFx) __nightFx.update(__nightS.k);
}
// ---- Glühwürmchen (Sommer) und Eiskristalle (Winter): Punkte, ganz im Grafikprogramm bewegt (kein Rechnen pro Bild)
let __nightFx = null;
function __makeNightFx() {
  const r = mulberry32(90210);
  const ptsUni = { uScale: { value: 1 }, uPR: { value: 1 } };
  function cloud(n, place, vs, fs, uni) {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { const p = place(); pos.set(p, i * 3); seed.set([r(), r(), r(), r()], i * 4); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ uTime: leafUniforms.uTime, uAmt: { value: 0 }, uMove: { value: reduceMotion ? 0 : 1 } }, ptsUni, uni),
      vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
      // nur Licht dazu, die Deckkraft der Leinwand bleibt (sonst dunkle Ringe auf hellem Grund, z. B. beim Übergang)
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 30; scene.add(pts);
    return pts;
  }
  const disc = (rMax) => { const a = r() * 6.283, d = Math.sqrt(r()) * rMax; return [Math.cos(a) * d, Math.sin(a) * d]; };
  // Glühwürmchen: schweben dicht über der Wiese und unter der Krone, leuchten langsam auf und verlöschen wieder
  const fire = cloud(40, () => { const [x, z] = disc(4.6); return [x, 0.12 + Math.pow(r(), 1.8) * 2.6, z]; }, `
    attribute vec4 aSeed; uniform float uTime, uAmt, uMove, uScale, uPR; varying float vA;
    void main(){
      float t = uTime, ph = aSeed.x * 6.2832;
      vec3 p = position + uMove * vec3(sin(t * (.18 + .2 * aSeed.y) + ph) * .75 + sin(t * .61 + ph * 2.) * .16,
                                        sin(t * (.25 + .2 * aSeed.z) + ph * 1.3) * .3,
                                        cos(t * (.16 + .2 * aSeed.w) + ph) * .75);
      p.y = max(p.y, .08);
      vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
      float b = sin(t * (.45 + .45 * aSeed.y) + ph * 3.) * .5 + .5;
      vA = uAmt * (.08 + .92 * smoothstep(.45, .95, b));
      gl_PointSize = clamp(.34 * uScale / -mv.z, 6., 40.) * uPR;
    }`, `
    varying float vA;
    void main(){ vec2 c = gl_PointCoord * 2. - 1.; float d = length(c); if (d > 1.) discard;
      float core = smoothstep(.22, .0, d), halo = pow(1. - d, 2.2) * .55;
      gl_FragColor = vec4(mix(vec3(.8, 1., .38), vec3(1., 1., .85), core) * (core * 1.3 + halo), vA); }`, {});
  // Eiskristalle: winzig, sinken langsam und treiben seitlich, funkeln ab und zu kurz auf
  const ice = cloud(90, () => { const [x, z] = disc(6.2); return [x, r() * 10.5, z]; }, `
    attribute vec4 aSeed; uniform float uTime, uAmt, uMove, uScale, uPR; varying float vA; varying float vS;
    void main(){
      float t = uTime, ph = aSeed.x * 6.2832;
      vec3 p = position;
      p.y = mod(p.y - uMove * t * (.06 + .08 * aSeed.y), 10.5);
      p.x += uMove * (sin(t * (.12 + .1 * aSeed.z) + ph) * .9 + sin(t * .4 + ph * 2.) * .12);
      p.z += uMove * cos(t * (.1 + .1 * aSeed.w) + ph) * .9;
      vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
      float tw = pow(sin(t * (.7 + 1.1 * aSeed.w) + ph * 5.) * .5 + .5, 10.);
      vS = tw;
      vA = uAmt * (.35 + .65 * tw) * smoothstep(0., .8, p.y) * smoothstep(10.5, 9.4, p.y);
      gl_PointSize = clamp(.07 * uScale / -mv.z * (1. + 2.2 * tw), 2., 16.) * uPR;
    }`, `
    varying float vA; varying float vS;
    void main(){ vec2 c = gl_PointCoord * 2. - 1.; float d = length(c);
      float dotv = smoothstep(.4, .0, d);
      float arms = (max(0., 1. - abs(c.x) * 9.) * max(0., 1. - abs(c.y)) + max(0., 1. - abs(c.y) * 9.) * max(0., 1. - abs(c.x))) * vS;
      float a = max(dotv, arms); if (a < .01) discard;
      gl_FragColor = vec4(vec3(.82, .9, 1.) * a, vA); }`, {});
  const tanF = () => Math.tan(camera.fov * Math.PI / 360);
  return {
    fire, ice,
    update(k) {
      const sw = k > 0.001 ? __seasonW('sommer') : 0, ww = k > 0.001 ? __seasonW('winter') : 0;
      fire.material.uniforms.uAmt.value = k * sw; fire.visible = k * sw > 0.002;
      ice.material.uniforms.uAmt.value = k * ww; ice.visible = k * ww > 0.002;
      if (fire.visible || ice.visible) { ptsUni.uScale.value = H() / (2 * tanF()); ptsUni.uPR.value = renderer.getPixelRatio(); }
    },
  };
}



// ------------------------------------------------------------------ Shader-Bausteine
const NOISE = /* glsl */`
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
float h31(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
float vnoise3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }
float fbm3(vec3 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*vnoise3(p); p*=2.03; a*=.5; } return s / .875; }
`;
const TUBE = /* glsl */`
attribute vec3 aStart; attribute vec3 aEnd; attribute vec2 aRad; attribute vec2 aS; attribute vec4 aRef; attribute vec4 aPrev;
uniform float uBend; uniform float uBendH;
varying vec3 vBark; varying vec3 vRestP;
vec3 gTU, gTV;
void tubeFrame(out vec3 P, out vec3 Nrm){
  vec3 dv = aEnd - aStart; float len = length(dv);
  vec3 ax = len > 1e-6 ? dv/len : vec3(0.,1.,0.);
  // durchgehende Ausrichtung entlang des Astes (mitgeführter Bezugsvektor) -> Rinde ohne Versatz
  vec3 rf = aRef.xyz - dot(aRef.xyz, ax) * ax;
  if (dot(rf, rf) < 1e-6) rf = abs(ax.y) < .99 ? cross(vec3(0.,1.,0.), ax) : vec3(1.,0.,0.);
  vec3 bu = normalize(rf); vec3 bv = cross(bu, ax);          // gleiche Händigkeit wie die Zylinder-Geometrie
  float h = position.y; vec2 cs = position.xz;
  vec3 radial = bu*cs.x + bv*cs.y;
  // drei Ringe: h=0 Ansatz im Elternast (etwas dünner, liegt innen), h=.5 Segmentanfang, h=1 Segmentende
  float ext = aRad.x * aRef.w;   // nur bei fast gerader Fortsetzung weit in den Elternast
  float t, r, s;
  vec3 p0;
  if (h < .25 && aPrev.w > .5) {   // Fortsetzung: hinterer Ring = Endring des Elternstücks
    vec3 pa = normalize(aPrev.xyz); vec3 rp = aRef.xyz - dot(aRef.xyz, pa) * pa;
    if (dot(rp, rp) < 1e-6) rp = bu;
    vec3 bu2 = normalize(rp); radial = bu2*cs.x + cross(bu2, pa)*cs.y;
    p0 = aStart; r = aRad.x; s = aS.x; t = 0.; }
  else if (h < .25) { p0 = aStart - ax*ext; r = aRad.x * .93; s = aS.x - ext; t = 0.; }
  else { t = clamp((h - .5) * 2., 0., 1.); p0 = mix(aStart, aEnd, t); r = mix(aRad.x, aRad.y, t); s = mix(aS.x, aS.y, t); }
  float ang = atan(cs.y, cs.x);
  vec3 q0 = p0 + radial*r;
  float wang = atan(q0.z, q0.x);                                // weltfester Winkel um den Stammfuß
  float fl = exp(-max(p0.y, 0.)*2.4) * smoothstep(.025, .12, r);
  r *= 1. + fl*(1.05 + .75*pow(max(sin(wang*5. + 1.3), 0.), 1.5) + .15*sin(wang*3. - .7));      // Wurzelanlauf, rund auslaufend
  vec3 q = p0 + radial*r;
  float knob = smoothstep(.05, .28, r);              // nur dicke Äste und Stamm
  r *= 1. + knob*(.08*sin(q.x*5.1 + q.y*2.3)*sin(q.z*4.7 - q.y*1.7) + .045*sin(q.y*9.3 + q.x*7.1 + q.z*3.3));
  P = p0 + radial*r; Nrm = radial; vRestP = P;
  P += vec3(.907, 0., -.42) * uBend * pow(clamp(p0.y / uBendH, 0., 1.3), 2.);   // Böe
  gTU = cross(ax, radial); gTV = ax;
  float rb = max(r, .012) * 7.;
  vBark = vec3(cs.x * rb, cs.y * rb, s * 2.2);   // Umfang in echter Größe, nahtlos
}
`;
// Rinde: Foto-Textur „Bark Willow“ von Poly Haven (CC0), auf 1K verkleinert
const BARK_C = __img("09120124f0.jpg");
const BARK_N = __img("492bd57c21.jpg");
function barkTex(url, srgb) {
  const t = new THREE.TextureLoader().load(url, () => { shadowDirty = true; });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const tubeUniforms = { uHoleA: { value: new V() }, uHoleN: { value: new V(0, 0, 1) }, uHoleR: { value: new V(1, 0, 0) }, uHoleU: { value: new V(0, 1, 0) }, uHoleS: { value: new V(0.105, 0.14, 0) }, uBare: { value: 0 }, uBend: { value: 0 }, uBendH: { value: 1 }, uRelief: { value: 1 }, uSnow: { value: 0 }, uBarkC: { value: barkTex(BARK_C, true) }, uBarkN: { value: barkTex(BARK_N, false) },
  uSkew: { value: -0.55 } };
function tubeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, tubeUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + TUBE)
      .replace('#include <common>', '#include <common>\nvarying vec3 vTU; varying vec3 vTV; varying float vUpN;')
      .replace('#include <beginnormal_vertex>', 'vec3 tP, tN; tubeFrame(tP, tN); vec3 objectNormal = tN; vTU = normalize(normalMatrix * gTU); vTV = normalize(normalMatrix * gTV); vUpN = tN.y;')
      .replace('#include <begin_vertex>', 'vec3 transformed = tP;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBark; varying vec3 vRestP; uniform vec3 uHoleA; uniform vec3 uHoleN; uniform vec3 uHoleR; uniform vec3 uHoleU; uniform vec3 uHoleS; varying vec3 vTU; varying vec3 vTV; varying float vUpN; uniform float uRelief; uniform float uSnow; uniform float uBare; uniform sampler2D uBarkC; uniform sampler2D uBarkN; uniform float uSkew;\n' + NOISE + `
vec3 h33(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
// Voronoi: x = Abstand zur nächsten Zelle, y = zur zweitnächsten, z = Zufallswert der Zelle
vec3 voro3(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8., d2 = 8., id = 0.;
  for(int z=-1;z<=1;z++) for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec3 g = vec3(x,y,z); vec3 o = h33(i+g);
    vec3 r = g + o*.85 - f; float d = dot(r,r);
    if(d < d1){ d2 = d1; d1 = d; id = o.x; } else if(d < d2) d2 = d; }
  return vec3(sqrt(d1), sqrt(d2), id); }
struct BarkS { vec3 c; vec3 n; };
BarkS barkSample(float K, float L){
  vec2 cs = normalize(vBark.xy + 1e-6);
  float ang = atan(cs.y, cs.x) / 6.2831853;
  float sv = vBark.z / 2.2 / L;
  vec2 uvA = vec2(ang * K, sv), uvB = vec2(fract(ang + 1.) * K, sv);
  vec2 dxA = dFdx(uvA), dyA = dFdy(uvA), dxB = dFdx(uvB), dyB = dFdy(uvB);
  bool useB = abs(dxB.x) + abs(dyB.x) < abs(dxA.x) + abs(dyA.x);
  mat2 sk = mat2(1., 0., uSkew, 1.);                 // Scherung: Rindenfasern laufen senkrecht, Naht bleibt nahtlos
  vec2 uv = sk * uvA, gx = sk * (useB ? dxB : dxA), gy = sk * (useB ? dyB : dyA);
  BarkS o; o.c = textureGrad(uBarkC, uv, gx, gy).rgb; o.n = textureGrad(uBarkN, uv, gx, gy).xyz * 2. - 1.; return o; }
vec2 barkWarp(vec3 p){ return vec2(fbm3(vec3(p.xy*.6, p.z*.06)), fbm3(vec3(p.xy*.6 + 5.2, p.z*.06))); }
// Eichenborke: q.x = Längsfurche (0..1, 1 = Mitte), q.y = Abstand zur Plattenkante, q.z = Zufall der Platte
vec3 barkQ(vec3 p){ vec2 wv = barkWarp(p);
  float fr = 1. - abs(fbm3(vec3(p.xy*1.4 + wv*1.1, p.z*.06))*2. - 1.);
  float cr = 1. - abs(fbm3(vec3(p.xy*2.6 + wv*1.6 + 3.3, p.z*.55))*2. - 1.);   // kurze, verzweigte Risse in den Platten
  float pid = fbm3(vec3(p.xy*1.1 + 7.7, p.z*.25));
  return vec3(fr, 1. - cr, pid); }
float barkHf(vec3 p){ vec3 q = barkQ(p);
  float gap = smoothstep(.74, .9, q.x);
  float plate = smoothstep(.02, .14, q.y);
  return plate * (1. - gap) * .85 + fbm3(vec3(p.xy*5., p.z*1.6)) * .15; }
`)
      .replace('#include <map_fragment>', `
        // Rinde aus der Foto-Textur: dicke Äste grob (3 Kacheln rundum), dünne feiner (1 Kachel), weich überblendet
        float rr0 = length(vBark.xy) / 7.;
        float wT = smoothstep(.05, .16, rr0);
        BarkS b1 = barkSample(1., .38), b3 = barkSample(3., 1.1);
        vec3 bc = mix(b1.c, b3.c, wT);
        vec3 gBarkN = normalize(mix(b1.n, b3.n, wT));
        float lum = dot(bc, vec3(.3333));
        bc = mix(bc, vec3(lum), .4) * 3.0;                          // etwas grauer und heller, passend zum gemalten Laub
        float n = clamp(lum * 4., 0., 1.);
        bc *= .9 + .15*smoothstep(-.2,.6,vUpN);
        float young = (1. - smoothstep(.016, .04, rr0)) * step(vBark.z, 1500.);   // dünne, junge Triebe sind grün (Wohnast nicht)
        diffuseColor.rgb *= mix(bc, mix(vec3(.24, .38, .07), vec3(.36, .29, .22), uBare), young);
        // Schnee auf allem, was nach oben zeigt
        float snowF = uSnow * smoothstep(.35, .75, vUpN + (n - .5) * .5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.92, .94, .97), snowF);
        // Baumloch: dunkle Öffnung (oben tiefer im Schatten, unten etwas heller), darum ein heller, glatterer Wulst
        float holeE = 9.; vec2 holeD = vec2(0.);
        if (uHoleS.z > .001) { vec3 hp = vRestP - uHoleA;
          if (dot(hp, uHoleN) > 0.) { holeD = vec2(dot(hp, uHoleR) / uHoleS.x, dot(hp, uHoleU) / uHoleS.y); holeE = length(holeD); } }
        float holeIn = (1. - smoothstep(.9, 1.0, holeE)) * uHoleS.z;
        float holeRim = smoothstep(.92, 1.06, holeE) * (1. - smoothstep(1.5, 2.3, holeE)) * uHoleS.z;
        // Wulst: heller, wärmer und glatter (überwallte Rinde), oben links im Licht stärker
        float rimLit = .75 + .25 * clamp(-holeD.x * .6 + holeD.y * .8, -1., 1.);
        float ridge = .55 + .45 * cos((holeE - 1.12) * 9.);                 // zwei, drei Ringe überwallter Rinde
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(lum) * vec3(3.4, 3.15, 2.9), .3) * (1. + .16 * rimLit * ridge), holeRim * .6);
        // Öffnung: ganz dunkel, unten sieht man ein Stück der Innenwand (heller), oben liegt sie im Schatten
        vec3 holeC = mix(vec3(.05, .034, .024), vec3(.12, .08, .055), smoothstep(.2, -.9, holeD.y));
        float wall = smoothstep(.7, .97, holeE) * smoothstep(.15, -.55, holeD.y);
        holeC = mix(holeC, vec3(.25, .17, .11), wall * .8);
        holeC = mix(holeC, vec3(.012, .008, .006), smoothstep(.75, .98, holeE) * smoothstep(-.1, .6, holeD.y));   // Schatten unter dem oberen Rand
        diffuseColor.rgb = mix(diffuseColor.rgb, holeC, holeIn);`)
      .replace('#include <normal_fragment_maps>', `
        // Relief aus der Normal-Textur der Rinde
        { vec3 tn = gBarkN; tn.xy *= mix(.6, 1.2, uRelief);
          normal = normalize(-normalize(vTU) * tn.x + normalize(vTV) * tn.y + normal * max(tn.z, .2)); }
        // Wulst am Lochrand: innen zur Öffnung hin geneigt, außen nach außen abfallend; innen ohne Rindenrelief
        if (holeRim + holeIn > .001) {
          vec3 dV = normalize(mat3(viewMatrix) * (uHoleR * holeD.x + uHoleU * holeD.y) + 1e-5);
          float k = sin((holeE - 1.0) * 9.) * holeRim;                       // Wülste: abwechselnd zur Öffnung hin und weg
          normal = normalize(normal * (1. - .3 * holeRim) + dV * k * .75);
          normal = normalize(mix(normal, normalize(mat3(viewMatrix) * uHoleN), holeIn * .7)); }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness;');
  };
  return m;
}
function tubeDepthMaterial() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + TUBE)
      .replace('#include <begin_vertex>', 'vec3 tP, tN; tubeFrame(tP, tN); vec3 transformed = tP;');
  };
  return m;
}
const leafUniforms = { uCrownC: { value: new V(0, 4, 0) }, uCrownR: { value: new V(3, 2.5, 3) }, uSun: { value: SUN_DIR }, uTime: { value: 0 }, uWind: { value: reduceMotion ? 0 : 1 }, uGust: { value: 0 }, uGustX: { value: -9 }, uSeasonU: { value: 0 }, uSeasonMode: { value: 0 }, uDropU: { value: 0 }, uLeafB: { value: null }, uBend: tubeUniforms.uBend, uBendH: tubeUniforms.uBendH, uLeafScale: { value: 1 }, uDensity: { value: 1 }, uGlow: { value: 0.1 }, uSunView: { value: new V() }, uBack: { value: 1 } };
const LEAFV = /* glsl */`
attribute float aGrow; attribute vec3 aCol; attribute float aPhase; attribute vec2 aUVo;
uniform vec3 uCrownC; uniform vec3 uCrownR; uniform vec3 uSun; uniform float uTime; uniform float uWind; uniform float uLeafScale; uniform float uDensity; uniform float uGust; uniform float uGustX; uniform float uBend; uniform float uBendH; uniform float uSeasonU; uniform float uSeasonMode; uniform float uDropU;
varying float vMix;
varying vec3 vLeafCol; varying float vSunSide;
`;
// gemeinsamer Blatt-Code (Farbdurchgang und Tiefen-Vorabdurchgang müssen exakt gleich rechnen)
const SEASON_GLSL = `
        // Jahreszeit je Büschel: außen und oben früher, innen später, dazu Zufall
        //   Modus 1 = Farbe wechselt (Atlas A -> B), 2 = Laub fällt, 3 = Laub treibt aus
        float sgrow = 1.; vMix = 0.;
        #ifdef USE_INSTANCING
        if (uSeasonMode > .5 || uDropU > 0.) {
          vec3 dcs = ((modelMatrix * instanceMatrix * vec4(0., .5, 0., 1.)).xyz - uCrownC) / uCrownR;
          float outer = clamp(length(dcs) + .3 * dcs.y, 0., 1.3);
          float thrR = fract(aPhase * 3.71), thrO = 1. - smoothstep(.2, 1.1, outer);
          if (uSeasonMode > .5) {
            float thr = uSeasonMode < 1.5 ? .5 * thrR + .5 * thrO : .82 * thrR + .18 * thrO;   // Austrieb: überall gleichmäßig
            float sp = clamp((uSeasonU - thr * .75) / .25, 0., 1.);
            if (uSeasonMode < 1.5) vMix = sp; else sgrow = sp;
          }
          // Laubfall über den ganzen Herbst: Büschel verschwindet in einem Augenblick (die Blätter fallen als eigene Blätter herab)
          if (uDropU > 0.) sgrow *= 1. - step(( .82 * thrR + .18 * thrO) * .98 + .01, uDropU);
        }
        #endif`;
const LEAF_BEGIN = `
        float keep = step(fract(aPhase * 7.13), uDensity);
        // Jahreszeit je Büschel: außen und oben früher, innen später, dazu Zufall
        //   Modus 1 = Farbe wechselt (Atlas A -> B), 2 = Laub fällt, 3 = Laub treibt aus
        float sgrow = 1.; vMix = 0.;
        #ifdef USE_INSTANCING
        if (uSeasonMode > .5 || uDropU > 0.) {
          vec3 dcs = ((modelMatrix * instanceMatrix * vec4(0., .5, 0., 1.)).xyz - uCrownC) / uCrownR;
          float outer = clamp(length(dcs) + .3 * dcs.y, 0., 1.3);
          float thrR = fract(aPhase * 3.71), thrO = 1. - smoothstep(.2, 1.1, outer);
          if (uSeasonMode > .5) {
            float thr = uSeasonMode < 1.5 ? .5 * thrR + .5 * thrO : .82 * thrR + .18 * thrO;   // Austrieb: überall gleichmäßig
            float sp = clamp((uSeasonU - thr * .75) / .25, 0., 1.);
            if (uSeasonMode < 1.5) vMix = sp; else sgrow = sp;
          }
          // Laubfall über den ganzen Herbst: Büschel verschwindet in einem Augenblick (die Blätter fallen als eigene Blätter herab)
          if (uDropU > 0.) sgrow *= 1. - step(( .82 * thrR + .18 * thrO) * .98 + .01, uDropU);
        }
        #endif
        keep *= sgrow;
        float gw = 0., bnd = 0.; vec3 gl = vec3(0.);
        #ifdef USE_INSTANCING
        { mat4 mI = modelMatrix * instanceMatrix; vec3 nW = normalize(mat3(mI) * vec3(0., 0., 1.));
          vec3 cW = (mI * vec4(0., .5, 0., 1.)).xyz;
          keep *= smoothstep(.05, .24, abs(dot(nW, normalize(cameraPosition - cW))));
          float gx = cW.x * .907 - cW.z * .42;                       // Lage quer zur Startansicht
          gw = uGust * exp(-pow((gx - uGustX) / 2.6, 2.));
          gl = transpose(mat3(mI)) * vec3(.907, .05, -.42) / max(dot(mI[0].xyz, mI[0].xyz), 1e-4);
          bnd = uBend * pow(clamp(cW.y / uBendH, 0., 1.3), 2.); }   // Windrichtung im Blatt-Raum
        #endif
        vec3 transformed = position * aGrow * uLeafScale * keep;
        float sw = (sin(uTime*1.6 + aPhase) * .04 + sin(uTime*2.6 + aPhase*1.7) * .01) * (1. + gw * 1.6);
        transformed += gl * gw * aGrow * uWind * keep * min(1., uLeafScale * 2.) * (.11 + .04 * sin(uTime * 6. + aPhase * 3.));      // Böe: Laub weicht als Ganzes aus, ohne zu verzerren
        transformed.x += sw * position.y * uWind * aGrow * uLeafScale * keep;
        transformed.z += sw * .6 * position.y * uWind * aGrow * uLeafScale * keep;
        transformed += gl * bnd;                                                   // Böe biegt den ganzen Baum, Laub geht mit
        vMapUv = vMapUv * .5 + aUVo;`;
const LEAF_ALPHA = `
        // Abdeckung in kleinen Mip-Stufen erhalten, sonst flimmern ferne Blätter
        vec2 tsz = vec2(512.);
        float lod = log2(max(max(length(dFdx(vMapUv*tsz)), length(dFdy(vMapUv*tsz))), 1.));
        diffuseColor.a *= 1. + lod * .28;
        if (diffuseColor.a < alphaTest) discard;`;
// Tiefen-Vorabdurchgang: schreibt nur, welches Blatt vorne liegt. Danach wird jeder Bildpunkt nur einmal beleuchtet.
function leafPrepassMaterial(tex) {
  const m = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, colorWrite: false,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, leafUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + LEAFV)
      .replace('#include <begin_vertex>', LEAF_BEGIN);
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', LEAF_ALPHA);
  };
  return m;
}
function leafMaterial(tex, lambert = false) {
  // Lambert: einfacheres Lichtmodell, für matte Blätter optisch fast gleich, aber deutlich günstiger
  const m = new THREE.MeshToonMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, gradientMap: toonRamp });
  m.depthWrite = false;   // Tiefe kommt aus dem Vorabdurchgang; verdeckte Blätter werden früh verworfen
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, leafUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + LEAFV + NOISE)
      .replace('#include <beginnormal_vertex>', `
        vec3 wpI = (modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
        vec3 dc = (wpI - uCrownC) / uCrownR;
        vec3 nW = normalize(dc + vec3(0., .35, 0.));
        vec3 objectNormal = normalize(transpose(mat3(instanceMatrix)) * nW);
        float depth = clamp(length(dc), 0., 1.25);
        float sunF = dot(normalize(dc), uSun)*.5 + .5;
        float clump = vnoise3(wpI * .55) * .6 + vnoise3(wpI * 1.3 + 7.) * .4;
        float shade = mix(.42, 1., smoothstep(.35, 1.0, depth + (clump - .5) * .5)) * mix(.85, 1.1, sunF) * (.85 + .3 * clump);
        vLeafCol = aCol * shade;
        vSunSide = smoothstep(.5, 1.05, depth) * (.35 + .65 * sunF);`)
      .replace('#include <begin_vertex>', LEAF_BEGIN);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeafCol; varying float vSunSide; uniform float uGlow; uniform vec3 uSunView; uniform float uBack; varying float vMix; uniform sampler2D uLeafB;')
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <map_fragment>', '#include <map_fragment>\n if (vMix > .001) diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * texture2D(uLeafB, vMapUv).rgb, vMix);\n diffuseColor.rgb *= vLeafCol;')
      .replace('#include <alphatest_fragment>', LEAF_ALPHA)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * uGlow;
        // Gegenlicht: Sonne scheint durch die Blätter, wenn sie hinter ihnen steht; außen am Kronenrand am stärksten
        vec3 Vv = normalize(vViewPosition);
        float back = pow(max(dot(-Vv, uSunView), 0.), 2.) ;
        float rim = pow(1. - abs(dot(Vv, normal)), 2.);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.25, 1.3, .75) * (back * .6 + rim * .3) * vSunSide * uBack;`);
  };
  return m;
}
function leafDepthMaterial(tex) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, leafUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGrow; attribute float aPhase; attribute vec2 aUVo; uniform float uLeafScale; uniform float uDensity; uniform vec3 uCrownC; uniform vec3 uCrownR; uniform float uSeasonU; uniform float uSeasonMode; uniform float uDropU;')
      .replace('#include <begin_vertex>', `float vMix;` + SEASON_GLSL + `
        vec3 transformed = position * aGrow * uLeafScale * step(fract(aPhase * 7.13), uDensity) * sgrow; vMapUv = vMapUv * .5 + aUVo;`);
  };
  return m;
}

// ------------------------------------------------------------------ Wiese im Comic-Stil
// Gemalter Atlas (wie das Laub): Grasbüschel, hohe Gräser, Blumen, Pilze, Falllaub.
// Büschel und Blumen sind Karten, die sich zur Kamera drehen (nur um die senkrechte Achse) und im Wind wiegen.
const MR = 6.4;                                   // Radius der Wiese; ab ~55 % läuft sie unregelmäßig weich in den Hintergrund aus
const mrnd = mulberry32(4242);                    // eigener Zufall: der Baum bleibt unverändert
const mrr = (a, b) => a + (b - a) * mrnd();
const groundUniforms = {
  uG1: { value: new THREE.Color() }, uG2: { value: new THREE.Color() }, uG3: { value: new THREE.Color() },
  uSnow: { value: 0 }, uBgS: { value: new THREE.Vector3(0.965, 0.953, 0.918) },
  uAO: { value: new THREE.Vector4(0, 0, 1, 0) }, uTrunkR: { value: 0.2 },
  uTime: leafUniforms.uTime, uWind: leafUniforms.uWind,
  uFill: { value: 0.2 }, uEdgeA: { value: OPT.opaque ? 0 : 1 },                          // Aufhellung: Schatten unter der Krone bleiben hell und farbig (Comic)
  uSeason: { value: new THREE.Vector4(0, 1, 0, 0) }, uSeasonB: { value: new THREE.Vector4(0, 1, 0, 0) }, uMeadowU: { value: 0 }, uMeadowB: { value: null }, uFallen: { value: 0 },
  uTuftH: { value: 1 }, uTuftKeep: { value: 1 },
};
const MEADOW_GLSL = /* glsl */`
uniform vec3 uBgS; uniform vec4 uAO; uniform float uTrunkR; uniform float uFill; uniform float uEdgeA;
float edgeFade(vec3 wp){
  float wob = (vnoise(wp.xz * .55 + 11.) - .5) * 1.5 + (vnoise(wp.xz * 1.7 + 3.) - .5) * .45;   // unregelmäßiger, gemalter Rand
  return smoothstep(${(MR * 0.56).toFixed(2)}, ${(MR * 0.98).toFixed(2)}, length(wp.xz) + wob);
}
float groundAO(vec3 wp){
  float dC = length(wp.xz - uAO.xy) / max(uAO.z, .01);
  float dT = length(wp.xz);
  return (1. - uAO.w * .22 * (1. - smoothstep(.0, 1.05, dC))) * (1. - .25 * (1. - smoothstep(.0, uTrunkR, dT)));
}`;
// Ausblenden zum Rand: erst nach Tone Mapping und Farbraum, damit es exakt die Seitenfarbe trifft
const EDGE_OUT = `#include <dithering_fragment>\n { float ef = edgeFade(vMWP); if (uEdgeA > .5) gl_FragColor *= 1. - ef; else gl_FragColor.rgb = mix(gl_FragColor.rgb, uBgS, ef); }`;

// ---------- gemalter Wiesen-Atlas: 4×4 Felder à 256 px
// 0–5 Grasbüschel · 6–7 hohe Gräser mit Rispen · 8 Margeriten · 9 Hahnenfuß · 10 Vergissmeinnicht
// 11 Moosglöckchen (vanamo) · 12 Pusteblume · 13 Löwenzahn · 14 Pilze · 15 vier Falllaub-Blätter
const MCELL = 256, MATLAS = 1024;
const TUFT_PAL = {
  fruehling: { base: '#4a8a30', mid: '#8cc848', tip: '#d8ee8c', seed: '#c2da84', stem: '#6aa83a' },
  sommer:    { base: '#3c7a30', mid: '#76b342', tip: '#c6e070', seed: '#e2d692', stem: '#5e9a34' },
  herbst:    { base: '#4e7e30', mid: '#94ae44', tip: '#f2cc66', seed: '#f0c070', stem: '#7a9a3a' },
  winter:    { base: '#9a8e66', mid: '#c4b88c', tip: '#ece4c8', seed: '#dccfa4', stem: '#a89c74' },
};
const SHADOW_INK = { fruehling: '#1e3a1c', sommer: '#16301f', herbst: '#2e3a1c', winter: '#5a4e3c' };
let inkNow = SHADOW_INK.sommer;
function mcol(h, k) { return css(shadeHex(h, k, inkNow)); }
function paintMeadowAtlas(season) {
  const c = document.createElement('canvas'); c.width = c.height = MATLAS;
  const g = c.getContext('2d');
  const P = TUFT_PAL[season] || TUFT_PAL.sommer;
  inkNow = SHADOW_INK[season] || SHADOW_INK.sommer;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // ein Grashalm: gebogen, spitz, Verlauf Ansatz dunkel -> Spitze hell, eine Hälfte etwas dunkler, feine Kontur
  function blade(x, y, len, w, ang, k, pal = P) {
    const ax = Math.sin(ang * 0.35), ay = -Math.cos(ang * 0.35);
    const tx = x + Math.sin(ang) * len, ty = y - Math.cos(ang) * len * (0.9 + 0.1 * Math.cos(ang));
    const cx = x + ax * len * 0.55, cy = y + ay * len * 0.55;
    const p = new Path2D();
    p.moveTo(x - w, y); p.quadraticCurveTo(cx - w * 0.55, cy, tx, ty); p.quadraticCurveTo(cx + w * 0.55, cy, x + w, y); p.closePath();
    const gr = g.createLinearGradient(x, y, tx, ty);
    gr.addColorStop(0, mcol(pal.base, 0.95 * k)); gr.addColorStop(0.45, mcol(pal.mid, k)); gr.addColorStop(1, mcol(pal.tip, Math.min(1.15, k * 1.08)));
    g.fillStyle = gr; g.fill(p);
    g.save(); g.clip(p); g.translate(w * 0.55 * Math.sign(ang || 1), 0);
    g.fillStyle = 'rgba(20,40,30,0.16)'; g.fill(p); g.restore();
    g.strokeStyle = mcol(pal.base, 0.5); g.globalAlpha = 0.26; g.lineWidth = 1.1; g.stroke(p); g.globalAlpha = 1;
  }
  function tuft(ox, oy, r2, n, H, spread, wid) {
    const bx = ox + MCELL / 2, by = oy + MCELL - 4;
    const bl = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n * 2 - 1 + (r2() - 0.5) * 0.25;
      const len = H * (1 - 0.45 * Math.abs(t)) * (0.7 + 0.35 * r2());
      bl.push({ x: bx + t * MCELL * 0.13 * spread + (r2() - 0.5) * 10, len, ang: t * 0.72 * spread + (r2() - 0.5) * 0.25, w: wid * (0.8 + 0.4 * r2()) });
    }
    bl.sort((a, b) => b.len - a.len);
    bl.forEach((b, i) => blade(b.x, by, b.len, b.w, b.ang, 0.86 + 0.22 * i / Math.max(1, n - 1)));
  }
  function stem(x0, y0, x1, y1, bend, w, col) {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1); g.stroke();
  }
  function ellipsePath(x, y, rx, ry, rot) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; }
  function contour(p, col, a = 0.45, lw = 1.2) { g.strokeStyle = col; g.globalAlpha = a; g.lineWidth = lw; g.stroke(p); g.globalAlpha = 1; }
  function daisy(x, y, s, r2) {
    const n = 15;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + r2() * 0.1, px = x + Math.cos(a) * s * 0.55, py = y + Math.sin(a) * s * 0.55 * 0.6;
      const p = ellipsePath(px, py, s * 0.5, s * 0.15, Math.atan2(Math.sin(a) * 0.6, Math.cos(a)));
      const gr = g.createRadialGradient(x, y, 0, x, y, s);
      gr.addColorStop(0, '#e6e2d4'); gr.addColorStop(0.6, '#fffdf6'); gr.addColorStop(1, k % 4 ? '#fffdf6' : '#fbdde6');
      g.fillStyle = gr; g.fill(p); contour(p, '#8c8c7c', 0.4, 1);
    }
    const cp = ellipsePath(x, y, s * 0.3, s * 0.22, 0);
    const cg = g.createRadialGradient(x - s * 0.08, y - s * 0.08, 0, x, y, s * 0.32);
    cg.addColorStop(0, '#ffe46a'); cg.addColorStop(1, '#e09a1c'); g.fillStyle = cg; g.fill(cp); contour(cp, '#9a6410', 0.5, 1);
  }
  function cupFlower(x, y, s, col, light, ink) {      // Hahnenfuß: glänzende, runde Schalenblüte
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.62, px = x + Math.cos(a) * s * 0.42, py = y + Math.sin(a) * s * 0.3 + s * 0.08;
      const p = ellipsePath(px, py, s * 0.42, s * 0.36, a + Math.PI / 2);
      const gr = g.createLinearGradient(px, py - s * 0.4, px, py + s * 0.4);
      gr.addColorStop(0, light); gr.addColorStop(1, col); g.fillStyle = gr; g.fill(p); contour(p, ink, 0.5, 1);
    }
    g.fillStyle = 'rgba(255,255,230,0.7)'; g.beginPath(); g.ellipse(x - s * 0.15, y - s * 0.25, s * 0.1, s * 0.06, -0.4, 0, 6.283); g.fill();
  }
  function forgetMeNot(x, y, s) {
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 - Math.PI / 2, p = ellipsePath(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.42, s * 0.42, s * 0.38, 0);
      const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, '#d8e6ff'); gr.addColorStop(0.5, '#8fb2f4'); gr.addColorStop(1, '#5b84de');
      g.fillStyle = gr; g.fill(p); contour(p, '#34508e', 0.4, 1);
    }
    g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(x, y, s * 0.26, 0, 6.283); g.fill();
    g.fillStyle = '#f2c230'; g.beginPath(); g.arc(x, y, s * 0.13, 0, 6.283); g.fill();
  }
  function bell(x, y, s, ang) {                         // hängendes Glöckchen, Öffnung nach unten
    g.save(); g.translate(x, y); g.rotate(ang);
    const p = new Path2D();
    p.moveTo(-s * 0.18, 0); p.bezierCurveTo(-s * 0.3, s * 0.35, -s * 0.5, s * 0.75, -s * 0.55, s); p.quadraticCurveTo(0, s * 1.12, s * 0.55, s);
    p.bezierCurveTo(s * 0.5, s * 0.75, s * 0.3, s * 0.35, s * 0.18, 0); p.closePath();
    const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#fbe3ea'); gr.addColorStop(1, '#ec8fb0');
    g.fillStyle = gr; g.fill(p);
    g.save(); g.clip(p); g.strokeStyle = 'rgba(190,60,110,0.35)'; g.lineWidth = 1.2;
    for (const k of [-0.25, 0, 0.25]) { g.beginPath(); g.moveTo(k * s * 0.4, s * 0.1); g.lineTo(k * s * 1.4, s * 1.05); g.stroke(); }
    g.restore(); contour(p, '#9a3c64', 0.5, 1.1);
    g.restore();
  }
  function clock(x, y, s, r2) {                         // Pusteblume
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x, y, s, 0, 6.283); g.fill();
    for (let k = 0; k < 90; k++) {
      const a = r2() * 6.283, d = s * (0.92 + 0.12 * r2()), ex = x + Math.cos(a) * d, ey = y + Math.sin(a) * d;
      g.strokeStyle = 'rgba(250,250,244,0.95)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + Math.cos(a) * s * 0.2, y + Math.sin(a) * s * 0.2); g.lineTo(ex, ey); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex, ey, 2.2, 0, 6.283); g.fill();
    }
    g.strokeStyle = 'rgba(120,120,110,0.28)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, s * 1.04, 0, 6.283); g.stroke();
    g.fillStyle = '#a89a78'; g.beginPath(); g.arc(x, y, s * 0.16, 0, 6.283); g.fill();
  }
  function dandelionHead(x, y, s) {
    for (let ring = 0; ring < 3; ring++) {
      const R = s * (1 - ring * 0.28), n = 18 - ring * 4;
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.283 + ring * 0.3, p = ellipsePath(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.38, R * 0.48, R * 0.1, Math.atan2(Math.sin(a) * 0.7, Math.cos(a)));
        g.fillStyle = ring === 0 ? '#f5b81c' : ring === 1 ? '#ffcf2e' : '#ffe15a'; g.fill(p); contour(p, '#a8700a', 0.3, 0.8);
      }
    }
  }
  function mushroom(x, y, s, cap, capL, dots) {
    const sp = new Path2D(); sp.moveTo(x - s * 0.18, y); sp.quadraticCurveTo(x - s * 0.24, y - s * 0.5, x - s * 0.14, y - s * 0.8);
    sp.lineTo(x + s * 0.14, y - s * 0.8); sp.quadraticCurveTo(x + s * 0.24, y - s * 0.5, x + s * 0.18, y); sp.closePath();
    const sg = g.createLinearGradient(x - s * 0.2, 0, x + s * 0.2, 0); sg.addColorStop(0, '#f7f0de'); sg.addColorStop(1, '#cdbf9e');
    g.fillStyle = sg; g.fill(sp); contour(sp, '#6e5a3a', 0.45);
    const cp = new Path2D(); cp.moveTo(x - s * 0.62, y - s * 0.72); cp.bezierCurveTo(x - s * 0.6, y - s * 1.35, x + s * 0.6, y - s * 1.35, x + s * 0.62, y - s * 0.72);
    cp.quadraticCurveTo(x, y - s * 0.6, x - s * 0.62, y - s * 0.72); cp.closePath();
    const cg = g.createRadialGradient(x - s * 0.2, y - s * 1.15, 0, x, y - s * 0.9, s * 0.75); cg.addColorStop(0, capL); cg.addColorStop(1, cap);
    g.fillStyle = cg; g.fill(cp);
    if (dots) { g.fillStyle = '#fff8ec'; for (const [dx, dy, r] of [[-0.3, -0.95, 0.07], [0.05, -1.08, 0.09], [0.32, -0.9, 0.06], [-0.05, -0.85, 0.05]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 6.283); g.fill(); } }
    contour(cp, '#4a2a1a', 0.5);
  }
  function fallenLeaf(x, y, len, ang, col) {              // Mandelblatt wie in der Krone, flach von oben
    g.save(); g.translate(x, y); g.rotate(ang); g.translate(-len / 2, 0);
    const w = len * 0.4, p = new Path2D();
    p.moveTo(0, 0); p.bezierCurveTo(len * 0.18, -w * 1.15, len * 0.68, -w, len, 0); p.bezierCurveTo(len * 0.68, w, len * 0.18, w * 1.15, 0, 0);
    const gr = g.createLinearGradient(0, 0, len, 0);
    gr.addColorStop(0, css(shadeHex(col, 0.6, '#3a1f2e'))); gr.addColorStop(0.5, col); gr.addColorStop(1, css(shadeHex(col, 1.2)));
    g.fillStyle = gr; g.fill(p);
    g.save(); g.clip(p); g.fillStyle = 'rgba(40,10,30,0.14)'; g.fillRect(0, 0, len, w * 1.3);
    g.strokeStyle = css(shadeHex(col, 0.55, '#3a1f2e')); g.globalAlpha = 0.7; g.lineWidth = 2;
    g.beginPath(); g.moveTo(2, 0); g.lineTo(len * 0.92, 0); g.stroke();
    g.lineWidth = 1.2; for (let k = 1; k <= 4; k++) { const vx = len * (0.12 + k * 0.17); g.beginPath(); g.moveTo(vx, 0); g.lineTo(vx + len * 0.15, -w * 0.6); g.moveTo(vx, 0); g.lineTo(vx + len * 0.15, w * 0.6); g.stroke(); }
    g.restore(); g.globalAlpha = 1; contour(p, css(shadeHex(col, 0.4, '#3a1f2e')), 0.4);
    g.strokeStyle = '#5a3e2e'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(-len * 0.12, 0); g.stroke();
    g.restore();
  }
  const baseGrass = (ox, oy, r2, n = 7, H = 70) => tuft(ox, oy, r2, n, H, 1.25, 7);
  for (let cell = 0; cell < 16; cell++) {
    const ox = (cell % 4) * MCELL, oy = (cell >> 2) * MCELL, r2 = mulberry32(900 + cell * 31);
    g.save(); g.beginPath(); g.rect(ox + 5, oy + 5, MCELL - 10, MCELL - 10); g.clip();
    const cx = ox + MCELL / 2, by = oy + MCELL - 4;
    if (cell < 6) {                                   // Grasbüschel: von flach und breit bis hoch und schmal
      const H = [130, 165, 200, 150, 230, 115][cell], n = [11, 13, 15, 12, 16, 10][cell], sp = [1.35, 1.15, 1.0, 1.25, 0.9, 1.5][cell];
      tuft(ox, oy, r2, n, H, sp, [9, 8.5, 8, 9, 7.5, 9.5][cell]);
    } else if (cell < 8) {                            // hohe Gräser mit Rispen
      for (let s = 0; s < 3; s++) {
        const x0 = cx + (s - 1) * 22 + (r2() - 0.5) * 10, x1 = x0 + (s - 1) * 30 + (r2() - 0.5) * 30, y1 = oy + 18 + r2() * 40 + (cell === 7 ? 25 : 0);
        stem(x0, by, x1, y1, (r2() - 0.5) * 30, 2.4, mcol(P.stem, 0.9));
        for (let k = 0; k < 9; k++) {
          const t = k / 9, px = x1 + (x0 - x1) * t * 0.35, py = y1 + (by - y1) * t * 0.35, side = k % 2 ? 1 : -1;
          const sp = ellipsePath(px + side * 5, py + 2, 3.6, 8.5, side * 0.5);
          g.fillStyle = mcol(P.seed, 0.85 + 0.25 * (1 - t)); g.fill(sp); contour(sp, mcol(P.base, 0.5), 0.35, 0.9);
        }
      }
      baseGrass(ox, oy, r2, 9, 95);
    } else if (cell === 8) {                          // Margeriten / Gänseblümchen
      for (const [dx, h, s] of [[-40, 150, 30], [28, 185, 34], [62, 120, 26]]) { stem(cx + dx * 0.4, by, cx + dx, by - h, dx * 0.2, 3.4, mcol(P.stem, 0.85)); }
      baseGrass(ox, oy, r2, 8, 80);
      for (const [dx, h, s] of [[-40, 150, 30], [28, 185, 34], [62, 120, 26]]) daisy(cx + dx, by - h, s, r2);
    } else if (cell === 9) {                          // Hahnenfuß
      for (const [dx, h] of [[-38, 165], [20, 200], [55, 140]]) stem(cx + dx * 0.3, by, cx + dx, by - h, dx * 0.3, 3, mcol(P.stem, 0.85));
      baseGrass(ox, oy, r2, 8, 85);
      for (const [dx, h, s] of [[-38, 165, 26], [20, 200, 30], [55, 140, 23]]) cupFlower(cx + dx, by - h, s, '#f4b40c', '#fff07a', '#9a6a00');
    } else if (cell === 10) {                         // Vergissmeinnicht
      const heads = [[-44, 120], [-18, 150], [10, 135], [36, 165], [58, 118], [-2, 175], [24, 110]];
      for (const [dx, h] of heads) stem(cx + dx * 0.25, by, cx + dx, by - h + 8, dx * 0.15, 2.6, mcol(P.stem, 0.85));
      baseGrass(ox, oy, r2, 9, 80);
      for (const [dx, h] of heads) forgetMeNot(cx + dx, by - h, 13 + r2() * 3);
    } else if (cell === 11) {                         // Moosglöckchen (vanamo): Gabel mit zwei hängenden Glöckchen, kleine runde Blätter
      for (const [dx, h] of [[-36, 150], [30, 185]]) {
        const tx = cx + dx, ty = by - h;
        stem(cx + dx * 0.4, by, tx, ty, dx * 0.2, 2.6, '#8a5a3a');
        stem(tx, ty, tx - 18, ty + 6, -4, 2, '#8a5a3a'); stem(tx, ty, tx + 18, ty + 6, 4, 2, '#8a5a3a');
        bell(tx - 18, ty + 6, 26, 0.25); bell(tx + 18, ty + 6, 26, -0.25);
      }
      for (let k = 0; k < 9; k++) { const p = ellipsePath(cx + (k - 4) * 15, by - 8 - r2() * 14, 10, 7.5, r2()); g.fillStyle = mcol('#3f7a3a', 0.85 + 0.3 * r2()); g.fill(p); contour(p, '#1e3a20', 0.4); }
    } else if (cell === 12) {                         // Pusteblumen
      for (const [dx, h] of [[-30, 170], [36, 205]]) stem(cx + dx * 0.3, by, cx + dx, by - h, dx * 0.2, 3, mcol('#8fb04a', 0.9));
      baseGrass(ox, oy, r2, 7, 70);
      clock(cx - 30, by - 170, 34, r2); clock(cx + 36, by - 205, 38, r2);
    } else if (cell === 13) {                         // Löwenzahn: Blattrosette und gelbe Köpfe
      for (let k = 0; k < 7; k++) blade(cx + (k - 3) * 6, by, 70 + r2() * 30, 11, (k - 3) * 0.42, 0.9, { base: '#2e6a2a', mid: '#5f9e34', tip: '#8cc44a' });
      for (const [dx, h] of [[-30, 140], [32, 170]]) stem(cx + dx * 0.3, by, cx + dx, by - h, dx * 0.2, 3.4, mcol('#8fb04a', 0.9));
      dandelionHead(cx - 30, by - 140, 30); dandelionHead(cx + 32, by - 170, 34);
    } else if (cell === 14) {                         // Pilze (Herbst)
      baseGrass(ox, oy, r2, 6, 55);
      mushroom(cx - 38, by - 4, 70, '#8a4a22', '#d0904e', false);
      mushroom(cx + 26, by - 2, 88, '#7a3e1c', '#c4844a', false);
      mushroom(cx + 70, by - 2, 46, '#c8321e', '#ff7a4a', true);
    } else {                                          // vier einzelne Falllaub-Blätter (Draufsicht)
      const cols = ['#e05a2a', '#f2a63a', '#c8402a', '#b8742e'];
      for (let k = 0; k < 4; k++) fallenLeaf(ox + (k % 2) * 128 + 64, oy + (k >> 1) * 128 + 64, 100, -0.6 + r2() * 0.3, cols[k]);
    }
    g.restore();
  }
  return dilateAtlas(g, MATLAS);
}
// Farbe in die durchsichtigen Pixel verlängern (kein dunkler Saum beim Filtern), Zeilen für WebGL umdrehen
function dilateAtlas(g, S) {
  const d = g.getImageData(0, 0, S, S).data;
  const col = new Float32Array(S * S * 3), has = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) if (d[i * 4 + 3] > 8) { has[i] = 1; col[i * 3] = d[i * 4]; col[i * 3 + 1] = d[i * 4 + 1]; col[i * 3 + 2] = d[i * 4 + 2]; }
  for (let pass = 0; pass < 6; pass++) {
    const nh = has.slice();
    for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
      const i = y * S + x; if (has[i]) continue;
      let r = 0, gg = 0, b = 0, n = 0, j;
      j = i - 1; if (has[j]) { r += col[j * 3]; gg += col[j * 3 + 1]; b += col[j * 3 + 2]; n++; }
      j = i + 1; if (has[j]) { r += col[j * 3]; gg += col[j * 3 + 1]; b += col[j * 3 + 2]; n++; }
      j = i - S; if (has[j]) { r += col[j * 3]; gg += col[j * 3 + 1]; b += col[j * 3 + 2]; n++; }
      j = i + S; if (has[j]) { r += col[j * 3]; gg += col[j * 3 + 1]; b += col[j * 3 + 2]; n++; }
      if (n) { col[i * 3] = r / n; col[i * 3 + 1] = gg / n; col[i * 3 + 2] = b / n; nh[i] = 1; }
    }
    has.set(nh);
  }
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, o = ((S - 1 - y) * S + x) * 4;
    data[o] = col[i * 3]; data[o + 1] = col[i * 3 + 1]; data[o + 2] = col[i * 3 + 2]; data[o + 3] = d[i * 4 + 3];
  }
  return data;
}
const meadowAtlasCache = {};
const meadowTex = (() => {
  const t = new THREE.DataTexture(new Uint8Array(MATLAS * MATLAS * 4), MATLAS, MATLAS, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return t;
})();
function setMeadowAtlas(s) {
  if (meadowTex.userData.season === s) return;
  meadowTex.image.data = meadowAtlasCache[s] || (meadowAtlasCache[s] = paintMeadowAtlas(s));
  meadowTex.userData.season = s; meadowTex.needsUpdate = true;
}
const cellUV = (k) => [(k % 4) * 0.25, (3 - (k >> 2)) * 0.25];

// ---------- Boden: gemalte, weiche Farbflächen, hell
const groundMat = new THREE.MeshLambertMaterial();
groundMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, groundUniforms);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMWP;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vMWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vMWP; uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uG3; uniform float uSnow;\n' + NOISE + MEADOW_GLSL)
    .replace('#include <map_fragment>', `
      vec2 q = vMWP.xz;
      float n1 = fbm(q * .42), n2 = fbm(q * 1.35 + 7.), n3 = vnoise(vec2(q.x * 7., q.y * 2.2) + n2 * 4.);
      // große, weich begrenzte Farbflächen wie mit dem Pinsel gesetzt
      float light = smoothstep(.47, .53, n1 + (n2 - .5) * .45);
      vec3 gc = mix(uG2, uG3, light * .85);
      float dark = smoothstep(.6, .66, n2 + (n1 - .5) * .35);
      gc = mix(gc, uG1, dark * .55);
      gc *= .95 + .08 * n3;                                        // feine Pinselstriche
      float nzs = n2 * .6 + n1 * .4;
      float sn = smoothstep(nzs - .07, nzs + .07, uSnow * 1.3 - .1) * (.82 + .18 * smoothstep(.4, .6, n2));
      gc = mix(gc, mix(vec3(.80, .86, .95), vec3(.97, .98, 1.), light), sn);
      diffuseColor.rgb *= gc * groundAO(vMWP);`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uFill;')
    .replace('#include <dithering_fragment>', EDGE_OUT);
};
const ground = new THREE.Mesh(new THREE.CircleGeometry(MR * 1.02, 96), groundMat);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// ---------- Karten: Grasbüschel, Gräser, Blumen, Pilze
// Jahreszeiten-Maske je Karte (Frühling, Sommer, Herbst, Winter)
const FLOWER_MIX = {
  fruehling: [['daisy', 20], ['blue', 22], ['butter', 12], ['vanamo', 14], ['dandel', 14]],
  sommer:    [['daisy', 22], ['butter', 16], ['vanamo', 12], ['clock', 8], ['blue', 6], ['tall', 24]],
  herbst:    [['mush', 10], ['tall', 30], ['daisy', 5]],
  winter:    [['tall', 26]],
};
const KIND_CELL = { tall: [6, 7], daisy: [8], butter: [9], blue: [10], vanamo: [11], clock: [12], dandel: [13], mush: [14] };
const KIND_SIZE = { tall: [0.42, 0.6], daisy: [0.27, 0.34], butter: [0.26, 0.33], blue: [0.24, 0.3], vanamo: [0.26, 0.32], clock: [0.3, 0.38], dandel: [0.25, 0.31], mush: [0.22, 0.3] };
const SEASONS = ['fruehling', 'sommer', 'herbst', 'winter'];
const meadow = (() => {
  const items = [];
  // Blumen in Grüppchen; zuerst, damit sie beim Ausdünnen (Qualität) erhalten bleiben
  SEASONS.forEach((sName, si) => {
    for (const [kind, cnt] of FLOWER_MIX[sName]) {
      for (let grp = 0; grp < Math.max(1, Math.round(cnt / 4)); grp++) {
        const a = mrr(0, 6.283), r = mrr(1.0, MR * 0.6);
        for (let i = 0; i < Math.min(4, cnt); i++) {
          const aa = a + mrr(-0.3, 0.3) / Math.max(r, 1), rr2 = Math.max(0.9, r + mrr(-0.35, 0.35));
          const [s0, s1] = KIND_SIZE[kind], s = mrr(s0, s1), cells = KIND_CELL[kind];
          const mask = [0, 0, 0, 0]; mask[si] = 1;
          items.push({ x: Math.cos(aa) * rr2, z: Math.sin(aa) * rr2, w: s, h: s, cell: cells[(mrnd() * cells.length) | 0], mask, tint: mrr(0.92, 1.06), tuft: 0 });
        }
      }
    }
  });
  const nFlowers = items.length;
  // Grasbüschel: überall, in Flecken dichter, zum Stamm hin kleiner, zum Rand dünner
  const tufts = [];
  for (let k = 0; k < 5000 && tufts.length < 1700; k++) {
    const r = Math.sqrt(mrnd()) * MR * 0.86, a = mrr(0, 6.283);
    if (r < 0.22) continue;
    const fade = 1 - smooth((r - MR * 0.4) / (MR * 0.4));
    const patch = smooth(0.5 + 0.9 * Math.sin(a * 3 + r * 1.7) * Math.sin(r * 2.3 - a));   // offene Rasenflecken dazwischen
    if (mrnd() > fade * (0.2 + 0.8 * patch)) continue;
    const near = 0.45 + 0.55 * smooth((r - 0.25) / 1.0);
    const s = mrr(0.24, 0.42) * near * (0.75 + 0.25 * fade) * (0.85 + 0.3 * patch);
    tufts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, w: s * (mrnd() < 0.5 ? -1 : 1), h: s, cell: (mrnd() * 6) | 0, mask: [1, 1, 1, 1], tint: mrr(0.86, 1.1), tuft: 1 });
  }
  for (let i = tufts.length - 1; i > 0; i--) { const j = (mrnd() * (i + 1)) | 0; [tufts[i], tufts[j]] = [tufts[j], tufts[i]]; }
  items.push(...tufts);
  const N = items.length;
  const base = new THREE.PlaneGeometry(1, 1); base.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv')); g.setAttribute('normal', base.getAttribute('normal'));
  const aOff = new Float32Array(N * 3), aSize = new Float32Array(N * 2), aCell = new Float32Array(N * 2), aPhase = new Float32Array(N), aMask = new Float32Array(N * 4), aTint = new Float32Array(N * 2);
  items.forEach((it, i) => {
    aOff.set([it.x, -0.015, it.z], i * 3); aSize.set([it.w, it.h], i * 2); aCell.set(cellUV(it.cell), i * 2);
    aPhase[i] = mrr(0, 6.283); aMask.set(it.mask, i * 4); aTint.set([it.tint, it.tuft], i * 2);
  });
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 3));
  g.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 2));
  g.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2));
  g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
  g.setAttribute('aMask', new THREE.InstancedBufferAttribute(aMask, 4));
  g.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 2));
  g.instanceCount = N;
  g.userData = { total: N, nFlowers };
  const m = new THREE.MeshLambertMaterial({ map: meadowTex, alphaTest: 0.5, side: THREE.DoubleSide });
  m.alphaToCoverage = true;                      // weiche, gemalte Kanten bei Kantenglättung
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, groundUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aOff; attribute vec2 aSize; attribute vec2 aCell; attribute float aPhase; attribute vec4 aMask; attribute vec2 aTint;
uniform vec4 uSeason; uniform vec4 uSeasonB; uniform float uMeadowU; uniform float uTuftH; uniform float uTuftKeep; uniform float uTime; uniform float uWind;
varying vec3 vMWP; varying vec2 vLoc; varying float vTint; varying float vTuft; varying float vSel;`)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = uv * .25 + aCell;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0., 1., 0.);')     // Licht wie der Boden: weich, gleichmäßig
      .replace('#include <begin_vertex>', `
        vSel = step(fract(aPhase * 5.31) * .9 + .05, uMeadowU);
        float on = mix(dot(aMask, uSeason), dot(aMask, uSeasonB), vSel) * mix(1., step(fract(aPhase * 3.71), uTuftKeep), aTint.y);
        vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); camR.y = 0.;
        camR = normalize(camR + vec3(1e-5, 0., 0.));
        float hS = mix(1., uTuftH, aTint.y);
        vec2 sz = aSize * on;
        vec3 transformed = aOff + camR * position.x * sz.x + vec3(0., position.y * sz.y * hS, 0.);
        float sw = (sin(uTime * 1.4 + aPhase + aOff.x * .5) * .07 + sin(uTime * 2.3 + aPhase * 1.7) * .025) * uWind;
        transformed.xz += vec2(sw, sw * .5) * position.y * position.y * abs(sz.y);
        vLoc = vec2(position.x + .5, position.y); vTint = aTint.x; vTuft = aTint.y;`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vMWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMWP; varying vec2 vLoc; varying float vTint; varying float vTuft; varying float vSel; uniform sampler2D uMeadowB; uniform float uSnow; uniform vec3 uG2; uniform vec3 uG3;\n' + NOISE + MEADOW_GLSL)
      .replace('#include <map_fragment>', `vec4 sdcM = vSel > .5 ? texture2D(uMeadowB, vMapUv) : texture2D(map, vMapUv); diffuseColor *= sdcM;
        float lod = log2(max(max(length(dFdx(vMapUv * 1024.)), length(dFdy(vMapUv * 1024.))), 1.));
        diffuseColor.rgb *= vTint * groundAO(vMWP);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93, .95, .99), uSnow * vTuft * .2);
        // Ansatz geht in die Bodenfarbe über (im Winter: steckt im Schnee); ferne Büschel werden zur weichen Struktur
        vec3 gcol = mix(mix(uG2, uG3, .35), vec3(.9, .93, .98), uSnow) * groundAO(vMWP);
        diffuseColor.rgb = mix(gcol, diffuseColor.rgb, smoothstep(.0, .16 + .3 * uSnow * vTuft, vLoc.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, gcol * 1.04, smoothstep(1.5, 3.5, lod) * .6 * vTuft);`)
      .replace('#include <alphatest_fragment>', `
        diffuseColor.a *= 1. + lod * .3;   // Abdeckung in kleinen Mip-Stufen erhalten, sonst verschwinden ferne Büschel
        #include <alphatest_fragment>`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uFill;')
      .replace('#include <dithering_fragment>', EDGE_OUT);
  };
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.castShadow = false; mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
})();
function meadowCount(dens) { const u = meadow.geometry.userData; return u.nFlowers + Math.floor((u.total - u.nFlowers) * (0.45 + 0.55 * dens)); }
// Rand der Wiese = exakte Seitenfarbe (sRGB), folgt hellem/dunklem Design
function syncMeadowBg() {
  const c = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f6f3ea'), t = { r: 0, g: 0, b: 0 };
  c.getRGB(t, THREE.SRGBColorSpace); groundUniforms.uBgS.value.set(t.r, t.g, t.b);
}
syncMeadowBg();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncMeadowBg);
new MutationObserver(syncMeadowBg).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// Steinchen: weich schattiert wie die Krone (3 Stufen)
(() => {
  const g = new THREE.IcosahedronGeometry(1, 2), m = new THREE.MeshToonMaterial({ color: 0xc4bcab, gradientMap: toonRamp });
  const st = new THREE.InstancedMesh(g, m, 7), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 7; i++) {
    const a = mrr(0, 6.283), r = mrr(1.4, MR * 0.55), s = mrr(0.07, 0.16);
    q.setFromEuler(new THREE.Euler(mrr(-0.2, 0.2), mrr(0, 3), mrr(-0.2, 0.2)));
    m4.compose(new V(Math.cos(a) * r, s * 0.12, Math.sin(a) * r), q, new V(s * mrr(1.1, 1.5), s * mrr(0.55, 0.75), s * mrr(0.9, 1.2)));
    st.setMatrixAt(i, m4);
  }
  st.receiveShadow = true; st.castShadow = true; scene.add(st);
})();

// Herbstlaub am Boden: flache, gemalte Blätter (gleiche Form wie in der Krone)
const fallen = (() => {
  const N = 260, base = new THREE.PlaneGeometry(1, 1); base.rotateX(-Math.PI / 2);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv')); g.setAttribute('normal', base.getAttribute('normal'));
  const aOff = new Float32Array(N * 4), aCell = new Float32Array(N * 2);
  for (let k = 0; k < N; k++) {
    const r = Math.pow(mrnd(), 0.7) * MR * 0.62, a = mrr(0, 6.283), sub = (mrnd() * 4) | 0;
    aOff.set([Math.cos(a) * r, 0.006 + mrnd() * 0.004, Math.sin(a) * r, mrr(0.18, 0.27) * (r < 4.5 ? 1 : 0.8)], k * 4);
    aCell.set([0.75 + (sub % 2) * 0.125, 0.125 - (sub >> 1) * 0.125], k * 2);
  }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 4));
  g.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2));
  g.instanceCount = N;
  const m = new THREE.MeshLambertMaterial({ map: meadowTex, alphaTest: 0.5 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, groundUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aOff; attribute vec2 aCell; varying vec3 vMWP; uniform float uFallen;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = uv * .125 + aCell;')
      .replace('#include <begin_vertex>', `
        float ra = fract(aOff.x * 12.9898 + aOff.z * 78.233) * 6.283, cr = cos(ra), sr = sin(ra);
        float fOn = step(fract(aOff.x * 7.7 + aOff.z * 3.3) * .96 + .02, uFallen);
        vec3 transformed = vec3(position.x * cr - position.z * sr, 0., position.x * sr + position.z * cr) * aOff.w * fOn + aOff.xyz;`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vMWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMWP;\n' + NOISE + MEADOW_GLSL)
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= groundAO(vMWP);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uFill;')
      .replace('#include <dithering_fragment>', EDGE_OUT);
  };
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.visible = false;
  scene.add(mesh); return mesh;
})();

const MEADOW_SEASON = {
  fruehling: { g: ['#5f9a34', '#8ec44c', '#b4dc6a'], h: 0.85, keep: 1, snow: 0 },
  sommer:    { g: ['#4b8a32', '#78b042', '#a4cc58'], h: 1.0, keep: 1, snow: 0 },
  herbst:    { g: ['#5e8a34', '#8eac48', '#c2c262'], h: 0.95, keep: 1, snow: 0 },
  winter:    { g: ['#7d8a6a', '#a8b096', '#c8ccb8'], h: 0.8, keep: 0.05, snow: 1 },
};
function applyMeadowSeason() {
  const S = MEADOW_SEASON[season];
  groundUniforms.uG1.value.set(S.g[0]); groundUniforms.uG2.value.set(S.g[1]); groundUniforms.uG3.value.set(S.g[2]);
  groundUniforms.uTuftH.value = S.h; groundUniforms.uTuftKeep.value = S.keep; groundUniforms.uSnow.value = S.snow;
  const si = SEASONS.indexOf(season); groundUniforms.uSeason.value.set(si === 0 ? 1 : 0, si === 1 ? 1 : 0, si === 2 ? 1 : 0, si === 3 ? 1 : 0);
  setMeadowAtlas(season);
  fallen.visible = season === 'herbst';
  tubeUniforms.uSnow.value = S.snow;
}

// Samen (Eichel-artig) und Keimling
// Keimling und junge Blätter: ein natürliches, gewölbtes Blatt (für Keimling und das junge Bäumchen)
const LEAF_COLS = {
  fruehling: ['#5f9a34', '#a9d866', '#c4e88a'], sommer: ['#3f7a26', '#86bd4c', '#a8d470'],
  herbst: ['#b8561e', '#eda04a', '#f4c070'], winter: ['#6b6b5a', '#8a8a78', '#9a9a88'],
};
const youngLeafGeo = (() => {
  const nu = 10, nv = 6, P = [], I = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, w = Math.sin(Math.PI * Math.pow(u, 0.72)) * 0.34 * (1 - 0.1 * u);
    for (let j = 0; j <= nv; j++) {
      const v = j / nv * 2 - 1;
      P.push(v * w, u, -0.16 * u * u + 0.22 * v * v * w);       // nach hinten gebogen, zur Mittelrippe gefaltet
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b2 = a + nv + 1;
    I.push(a, b2, a + 1, a + 1, b2, b2 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(P.length), 3));
  g.setIndex(I); g.computeVertexNormals();
  return g;
})();
function colorYoungLeaves(season) {
  const [b, t, r] = (LEAF_COLS[season] || LEAF_COLS.sommer).map(h => new THREE.Color(h));
  const p = youngLeafGeo.getAttribute('position'), c = youngLeafGeo.getAttribute('color'), nv = 6, col = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    const u = Math.floor(k / (nv + 1)) / 10, v = (k % (nv + 1)) / nv * 2 - 1;
    col.copy(b).lerp(t, 0.15 + 0.75 * Math.pow(u, 0.8) * (1 - 0.35 * Math.abs(v)));
    col.lerp(r, Math.max(0, 1 - Math.abs(v) * 7) * 0.45);           // helle Mittelrippe
    c.setXYZ(k, col.r, col.g, col.b);
  }
  c.needsUpdate = true;
}
colorYoungLeaves('sommer');
const sproutLeafMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 });

// Keimling: ein glatter Stängel, der sich oben in zwei Blattstiele teilt; später ein zweites Blattpaar
const seedling = (() => {
  const grp = new THREE.Group(); scene.add(grp);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x86a83e, roughness: 0.6 });
  const AZ = 0.434, R = new V(Math.cos(AZ), 0, -Math.sin(AZ)), F = new V(Math.sin(AZ), 0, Math.cos(AZ)), UP = new V(0, 1, 0);
  let lastKey = '';
  const tmpM = new THREE.Matrix4();
  function clear() { for (const o of [...grp.children]) { grp.remove(o); if (o.geometry !== youngLeafGeo) o.geometry.dispose(); } }
  function leaf(at, dir, front, size) {
    const y = dir.clone().normalize(), z = front.clone().addScaledVector(y, -front.dot(y)).normalize(), x = new V().crossVectors(y, z);
    const m = new THREE.Mesh(youngLeafGeo, sproutLeafMat);
    tmpM.makeBasis(x, y, z); m.quaternion.setFromRotationMatrix(tmpM);
    m.position.copy(at); m.scale.setScalar(size); m.castShadow = true; grp.add(m);
  }
  function pair(top, side, size, rad, tilt) {
    for (const sg of [-1, 1]) {
      const out = side.clone().multiplyScalar(sg);
      const L = size * 0.32;                                          // Blattstiel
      const c = new THREE.QuadraticBezierCurve3(top.clone(), top.clone().addScaledVector(UP, L * 0.55), top.clone().addScaledVector(out, L).addScaledVector(UP, L * 0.75));
      const t = new THREE.Mesh(new THREE.TubeGeometry(c, 8, rad, 6, false), stemMat); t.castShadow = true; grp.add(t);
      const dir = out.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt));
      leaf(c.getPoint(1), dir, F.clone().multiplyScalar(0.55).addScaledVector(UP, 0.8), size);
    }
  }
  function update(P, treeTop, topPos) {
    const key = P.toFixed(4) + '|' + (treeTop || 0).toFixed(3);
    if (key === lastKey) return; lastKey = key;
    clear();
    const s = Math.min(1, Math.max(0, P / 2));
    const hS = 0.1 + 0.3 * s;
    const overtaken = P > 2 && treeTop > hS - 0.02;
    const fade = P > 2 ? 1 - smooth((treeTop - 1.0) / 0.8) : 1;       // Keimblätter bleiben, bis das Bäumchen genug eigene Blätter hat
    if (fade <= 0.02) return;
    const rad = 0.0042 + 0.0035 * s;
    let top;
    if (!overtaken) {
      const c = new THREE.CatmullRomCurve3([new V(0, 0, 0), new V(0.002, hS * 0.4, 0.001), new V(0.006, hS * 0.78, 0), new V(0.004, hS, 0)]);
      const st = new THREE.Mesh(new THREE.TubeGeometry(c, 20, rad, 8, false), stemMat); st.castShadow = true; grp.add(st);
      top = c.getPoint(1);
    } else top = topPos.clone();
    // erstes Blattpaar (Keimblätter), wächst mit
    pair(top, R, (0.07 + 0.05 * s) * fade, rad * 0.7, 0.55);
    // zweites Blattpaar: ab der Hälfte, auf einem kurzen Stück Stängel darüber, gegen das erste verdreht
    const g2 = smooth((s - 0.4) / 0.6) * fade;
    if (g2 > 0.02) {
      const top2 = top.clone().addScaledVector(UP, 0.035 * g2);
      const ext = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(top, top2), 2, rad * 0.85, 8, false), stemMat); grp.add(ext);
      const side2 = R.clone().applyAxisAngle(UP, 0.95);
      pair(top2, side2, 0.085 * g2, rad * 0.6, 0.85);
      // Triebspitze
      leaf(top2, UP.clone().addScaledVector(F, 0.15), F, 0.03 * g2);
    }
  }
  return { update, group: grp };
})();

// ------------------------------------------------------------------ Aufbau
const PAL = {
  fruehling: ['#b4d95a', '#c6e472', '#a2d04c', '#d3ec8c', '#9ccb48', '#bfe066'],
  sommer: ['#5a8a26', '#6f9e2e', '#86b23a', '#4a7a22', '#9cc444', '#3f6b1e'],
  herbst: ['#c2361b', '#e0601c', '#f08a1d', '#f3b62a', '#a82a18', '#e94e1b'],
  winter: ['#888888'],
};
let T = 0, Tshown = -1, season = 'sommer'; let leadA = null, leadV = null;
let youngMesh, youngNode; const youngU = { value: 0 };
let leafPre, leafMats, tree, tubeGeo, tubeMesh, leafMesh, leafNode, leafBirthJit, stages, treeKnots;

function build() {
  const t0 = performance.now();
  tree = growTree();
  const { N, pos, parent, sLen } = tree;
  // Äste: ein Röhrensegment je Knoten (Elternknoten -> Knoten)
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 14, 2, true); cyl.translate(0, 0.5, 0);
  tubeGeo = new THREE.InstancedBufferGeometry();
  tubeGeo.index = cyl.index; tubeGeo.setAttribute('position', cyl.getAttribute('position'));
  tubeGeo.setAttribute('aStart', new THREE.InstancedBufferAttribute(new Float32Array((N + 400) * 3), 3));
  tubeGeo.setAttribute('aEnd', new THREE.InstancedBufferAttribute(new Float32Array((N + 400) * 3), 3));
  tubeGeo.setAttribute('aRad', new THREE.InstancedBufferAttribute(new Float32Array((N + 400) * 2), 2));
  tubeGeo.setAttribute('aRef', new THREE.InstancedBufferAttribute(new Float32Array((N + 400) * 4), 4));
  tubeGeo.setAttribute('aPrev', new THREE.InstancedBufferAttribute(new Float32Array((N + 400) * 4), 4));
  // Bezugsvektor je Knoten: vom Elternknoten mitgeführt (Rotation minimierender Rahmen)
  const ref = new Float32Array(N * 3), extF = new Float32Array(N); ref[0] = 1;
  for (let i = 1; i < N; i++) {
    const pp = parent[i], d = pos[i].clone().sub(pos[pp]).normalize();
    const rv = new V(ref[pp * 3], ref[pp * 3 + 1], ref[pp * 3 + 2]);
    rv.addScaledVector(d, -rv.dot(d));
    if (rv.lengthSq() < 1e-6) rv.set(1, 0, 0).addScaledVector(d, -d.x);
    rv.normalize(); ref[i * 3] = rv.x; ref[i * 3 + 1] = rv.y; ref[i * 3 + 2] = rv.z;
    const gp = parent[pp];
    const cosA = gp >= 0 ? d.dot(pos[pp].clone().sub(pos[gp]).normalize()) : 1;
    extF[i] = 0.12 + 0.78 * smooth((cosA - 0.75) / 0.22);
  }
  tubeGeo.userData.ref = ref; tubeGeo.userData.ext = extF;
  const aS = new Float32Array((N + 400) * 2);
  for (let i = 1; i < N; i++) { aS[i * 2] = sLen[parent[i]]; aS[i * 2 + 1] = sLen[i]; }
  tubeGeo.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 2));
  tubeGeo.instanceCount = 0;
  tubeMesh = new THREE.Mesh(tubeGeo, tubeMaterial());
  tubeMesh.customDepthMaterial = tubeDepthMaterial();
  tubeMesh.castShadow = tubeMesh.receiveShadow = true; tubeMesh.frustumCulled = false;
  scene.add(tubeMesh);

  // Laub: Zweiglein-Karten an den Knoten
  const tex = leafTexture();
  const plane = new THREE.PlaneGeometry(1, 1); plane.translate(0, 0.5, 0);
  const nodesWithLeaves = [];
  for (let i = 8; i < N; i++) { if (rnd() < 0.42) nodesWithLeaves.push(i); }
  const L = nodesWithLeaves.length;
  leafMats = { std: leafMaterial(tex), lam: leafMaterial(tex, true) };
  leafMesh = new THREE.InstancedMesh(plane, leafMats.std, L);
  leafMesh.customDepthMaterial = leafDepthMaterial(tex);
  leafMesh.castShadow = leafMesh.receiveShadow = true; leafMesh.frustumCulled = false;
  leafNode = Int32Array.from(nodesWithLeaves);
  leafBirthJit = new Float32Array(L);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V(), up = new V(0, 1, 0);
  const aGrow = new Float32Array(L), aPhase = new Float32Array(L), aCol = new Float32Array(L * 3), aUVo = new Float32Array(L * 2);
  for (let k = 0; k < L; k++) { aUVo[k * 2] = rnd() < 0.5 ? 0 : 0.5; aUVo[k * 2 + 1] = rnd() < 0.5 ? 0 : 0.5; }
  for (let k = 0; k < L; k++) {
    const i = leafNode[k];
    // Karte zeigt grob nach außen (Blätter lesbar, wenige Streifen von der Kante), Zweig wächst entlang des Astes
    const out = pos[i].clone().sub(new V(0, 5.2, 0)); out.y *= 0.6; out.normalize().add(new V(0, 0.25, 0));
    const nrm = out.add(randUnit().multiplyScalar(0.75)).normalize();
    const u = tree.dir[i].clone().add(new V(0, 0.5, 0)).add(randUnit().multiplyScalar(0.5));
    u.addScaledVector(nrm, -u.dot(nrm)); if (u.lengthSq() < 1e-4) u.set(0, 1, 0).addScaledVector(nrm, -nrm.y); u.normalize();
    const xb = new V().crossVectors(u, nrm);
    q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xb, u, nrm));
    const s = rr(1.5, 2.0);
    sc.set(s, s, s);
    m4.compose(pos[i].clone().add(randUnit().multiplyScalar(0.08)), q, sc);
    leafMesh.setMatrixAt(k, m4);
    aPhase[k] = rr(0, 6.28);
    leafBirthJit[k] = rr(0, 5);
  }
  leafMesh.geometry.setAttribute('aGrow', new THREE.InstancedBufferAttribute(aGrow, 1));
  leafMesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
  leafMesh.geometry.setAttribute('aCol', new THREE.InstancedBufferAttribute(aCol, 3));
  leafMesh.geometry.setAttribute('aUVo', new THREE.InstancedBufferAttribute(aUVo, 2));
  leafMesh.userData.tex = tex;
  scene.add(leafMesh);
  leafPre = new THREE.InstancedMesh(leafMesh.geometry, leafPrepassMaterial(tex), L);
  leafPre.instanceMatrix = leafMesh.instanceMatrix;
  leafPre.frustumCulled = false; leafPre.castShadow = false; leafPre.receiveShadow = false;
  leafPre.renderOrder = -1; leafMesh.renderOrder = 1;
  scene.add(leafPre);
  const ym = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 });
  ym.onBeforeCompile = (sh) => {
    sh.uniforms.uYoung = youngU;
    for (const k of ['uTime', 'uWind', 'uGust', 'uGustX', 'uBend', 'uBendH']) sh.uniforms[k] = leafUniforms[k];
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGrow; uniform float uYoung;')
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; uniform float uGust; uniform float uGustX; uniform float uBend; uniform float uBendH;')
      .replace('#include <begin_vertex>', `vec3 transformed = position * aGrow * uYoung;
        #ifdef USE_INSTANCING
        { vec3 w0 = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz; float sc2 = max(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), 1e-4);
          float gx = w0.x * .907 - w0.z * .42, gw = uGust * exp(-pow((gx - uGustX) / 2.6, 2.)), ph = w0.x * 3.1 + w0.z * 2.3 + w0.y * 1.7;
          float sw = (sin(uTime * 2.2 + ph) * .1 + sin(uTime * 3.7 + ph * 1.3) * .04) * (1. + gw * 2.5) * uWind;
          transformed.x += sw * position.y * aGrow * uYoung; transformed.z += sw * .6 * position.y * aGrow * uYoung;
          vec3 dl = transpose(mat3(instanceMatrix)) * vec3(.907, .05, -.42) / sc2;
          transformed += dl * (gw * uWind * .05 * aGrow * uYoung / .17 + uBend * pow(clamp(w0.y / uBendH, 0., 1.3), 2.)); }
        #endif`);
  };
  // je Zweigknoten zwei Blätter, wechselständig, schräg nach oben
  const YN = [], ym4 = new THREE.Matrix4(), yq = new THREE.Quaternion(), ys = new V(1, 1, 1);
  for (let i = 1; i < N; i++) YN.push(i, i);
  youngNode = Int32Array.from(YN);
  const yg = youngLeafGeo.clone(); yg.setAttribute('color', youngLeafGeo.getAttribute('color'));
  yg.setAttribute('aGrow', new THREE.InstancedBufferAttribute(new Float32Array(YN.length), 1));
  youngMesh = new THREE.InstancedMesh(yg, ym, YN.length);
  for (let k = 0; k < YN.length; k++) {
    const i = YN[k], d = tree.dir[i].clone().normalize();
    let side = new V().crossVectors(d, new V(0, 1, 0)); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
    side.applyAxisAngle(d, (k % 2 ? 0 : Math.PI) + rr(-0.6, 0.6));
    const ax = side.clone().multiplyScalar(0.8).addScaledVector(d, 0.45).add(new V(0, 0.35, 0)).normalize();
    const fr = new V(0, 1, 0).addScaledVector(randUnit(), 0.5); fr.addScaledVector(ax, -fr.dot(ax)).normalize();
    const xb = new V().crossVectors(ax, fr);
    yq.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xb, ax, fr));
    const p = pos[tree.parent[i]].clone().lerp(pos[i], rr(0.3, 1));
    ys.setScalar(rr(0.8, 1.2));
    ym4.compose(p, yq, ys); youngMesh.setMatrixAt(k, ym4);
  }
  youngMesh.frustumCulled = false; youngMesh.castShadow = true;
  { const yd = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    yd.onBeforeCompile = (sh) => {
      sh.uniforms.uYoung = youngU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGrow; uniform float uYoung;')
        .replace('#include <begin_vertex>', 'vec3 transformed = position * aGrow * uYoung;');
    };
    youngMesh.customDepthMaterial = yd; }
  scene.add(youngMesh);
  applySeason();

  stages = tree.layerStart.slice(1);            // Ende jeder Schicht = eine Stufe
  stages[stages.length - 1] = tree.Tmax;
  // 9 Stufen nur mit dem Baum: Start als kleines Bäumchen, die längsten Abschnitte werden geteilt
  const ST = [19, 33, 37, 46, 55, 66, 100, 122, 140, 195].map(t => Math.min(t, tree.Tmax)); ST[ST.length - 1] = tree.Tmax;
  treeKnots = [0, ...ST];                        // Index = Stufe; Stufe 0 = Eichel im Gras, noch kein Baum
  tree.H = Math.max(...pos.map(p => p.y));
}

let aColDone = false;
function applySeason() {
  if (!aColDone) {   // einmalig (verbraucht Zufall genau wie vorher, damit der Baum gleich bleibt)
    aColDone = true;
    const a = leafMesh.geometry.getAttribute('aCol');
    for (let k = 0; k < a.count; k++) { const v = 0.9 + rnd() * 0.2; a.setXYZ(k, v, v * (0.97 + rnd() * 0.06), v); }
    a.needsUpdate = true;
  }
  applyYear(yearDay);
}
function applySeasonAlt() {
  leafMesh.visible = season !== 'winter';
  if (leafPre) leafPre.visible = leafMesh.visible;
  applyLeafQuality();
  __nightS.glowDay = season === 'fruehling' ? 0.2 : season === 'herbst' ? 0.12 : 0.09; leafUniforms.uGlow.value = __nightS.glowDay; __nightApply();
  Tshown = -1;
  applyMeadowSeason();
  colorYoungLeaves(season);
  Tshown = -1;
}

// Zustand für Wachstumsgrad T berechnen
let leafClear = null; const _lc = new V();
let WOHN_SEGS = null, wohnOn = false, WOHN_LEAF = null, WOHN_LEAF_ATTR = null;   // Wohnast-Röhren (hängen an den Ästen des Baums)
// Der Wohnast wächst mit dem Baum: ab Stufe 4 treibt er aus, mit Stufe 10 ist er fertig (Zweiglein und Laub zuletzt) – Feinabstimmung folgt
// Wohnast nach Stufen: treibt ab Stufe 4 aus; bei Stufe 6 gerade lang genug für Liegeplatz und Eichel (Liegestelle schon
// in ihrer endgültigen Dicke, passend zu den gemalten Beinlücken); bis Stufe 10 länger und zum Stamm hin dicker,
// ab Stufe 6 kommen Zweiglein, zuletzt Laub
const WOHN_S0 = 0.24, WOHN_L6 = (2.35 - WOHN_S0) / (3.15 - WOHN_S0);   // Ast beginnt in der Stammmitte (s = 0,24)
function wohnGrow() { return P < 6 ? WOHN_L6 * smooth((P - 4) / 2) : WOHN_L6 + (1 - WOHN_L6) * smooth((P - 6) / 4); }
function wohnLeaf() { return smooth((P - 7.6) / 1.4); }
function wohnR(sm) {   // Radius des Hauptasts an der Stelle sm (Weglänge ab Stammachse)
  const ex = 0.03 + 0.045 * smooth((P - 6) / 4), young = 0.45 + 0.55 * smooth((P - 4) / 2);
  const r = sm < 1.35 ? 0.035 + ex * (1 - sm / 1.35) ** 2 : sm <= 2.2 ? 0.035 : sm >= 3.1 ? 0.005 : Math.max(0.006, 0.035 - (sm - 2.2) * 0.032);
  return r * young;
}
const R_TIP = 0.0135, EXP = 2.0, DEAD_LIFE = 45;
let rE, rad, mY, term, crownBase = 0, shadowDirty = true, crownW = 0, grownTop = 0;
const grownTopPos = new V();
function updateTree() {
  if (T === Tshown) return;
  Tshown = T;
  const { N, pos, parent, birth } = tree;
  if (!rE) { rE = new Float32Array(N); rad = new Float32Array(N); }
  const acc = new Float32Array(N), frac = new Float32Array(N);
  if (!mY) { mY = new Float32Array(N); term = new Uint8Array(N); }
  mY.fill(-1e9);
  for (let i = N - 1; i >= 0; i--) {
    const f = Math.min(1, Math.max(0, T - birth[i]));
    frac[i] = f;
    if (i > 0 && f <= 0) { rE[i] = 0; continue; }
    term[i] = acc[i] === 0 ? 1 : 0;   // Zweigspitze (kein sichtbares Kind)
    const v = Math.max(acc[i], f) + (i === 0 ? 0.0001 : 0);
    rE[i] = v;
    if (pos[i].y > mY[i]) mY[i] = pos[i].y;
    if (i > 0) { acc[parent[i]] += v; if (mY[i] > mY[parent[i]]) mY[parent[i]] = mY[i]; }
  }
  // untere Äste sterben ab, wenn der Baum höher wird (Kronenansatz bei ~38 % der Höhe)
  crownBase = Math.min(mY[0] * 0.4, 2.8);
  const youngK = 0.5 + 0.5 * smooth(mY[0] / 7);                        // junges Bäumchen schlank, Stamm wird mit dem Alter dick
  for (let i = 0; i < N; i++) { const b = R_TIP * Math.pow(Math.max(rE[i], 1e-4), 1 / EXP) + 0.004 * Math.sqrt(rE[i]) * 0.2; rad[i] = b * (1 + 0.55 * smooth(b / 0.18)) * youngK; }
  const aStart = tubeGeo.getAttribute('aStart'), aEnd = tubeGeo.getAttribute('aEnd'), aRad = tubeGeo.getAttribute('aRad');
  const Rf = tubeGeo.getAttribute('aRef').array, refA = tubeGeo.userData.ref, extA = tubeGeo.userData.ext;
  const S = aStart.array, E = aEnd.array, R = aRad.array, Sarr = tubeGeo.getAttribute('aS').array;
  // sichtbare Segmente nach vorn packen (Knoten sind nach Geburt sortiert)
  let n = 0; grownTop = 0; grownTopPos.set(0, 0, 0);
  const Pv = tubeGeo.getAttribute('aPrev').array;
  if (!leadA) { leadA = new Int32Array(N); leadV = new Float32Array(N); }
  leadA.fill(-1); leadV.fill(-1);
  for (let i = 1; i < N; i++) { if (frac[i] <= 0) continue; const pp = parent[i]; if (rE[i] > leadV[pp]) { leadV[pp] = rE[i]; leadA[pp] = i; } }
  const srcS = tubeGeo.userData.sAll || (tubeGeo.userData.sAll = Sarr.slice());
  for (let i = 1; i < N; i++) {
    const f = frac[i]; if (f <= 0) continue;
    const low = smooth((mY[i] - crownBase) / 0.35);   // untere Ästchen: werden dünn, dann weg
    if (low <= 0.02) continue;
    const p = pos[parent[i]], c = pos[i];
    S[n * 3] = p.x; S[n * 3 + 1] = p.y; S[n * 3 + 2] = p.z;
    E[n * 3] = p.x + (c.x - p.x) * f; E[n * 3 + 1] = p.y + (c.y - p.y) * f; E[n * 3 + 2] = p.z + (c.z - p.z) * f;
    if (E[n * 3 + 1] > grownTop) { grownTop = E[n * 3 + 1]; grownTopPos.set(E[n * 3], E[n * 3 + 1], E[n * 3 + 2]); }
    R[n * 2] = rad[parent[i]] * (low < 1 && !(mY[parent[i]] - crownBase > 0.35 + 1e-3) ? low : 1); R[n * 2 + 1] = (f < 1 ? rad[i] * (0.4 + 0.6 * f) : rad[i]) * low * (term[i] ? 0.3 : 1);   // Spitzen laufen spitz aus
    Sarr[n * 2] = srcS[i * 2]; Sarr[n * 2 + 1] = srcS[i * 2 + 1];
    Rf[n * 4] = refA[i * 3]; Rf[n * 4 + 1] = refA[i * 3 + 1]; Rf[n * 4 + 2] = refA[i * 3 + 2]; Rf[n * 4 + 3] = extA[i];
    { const pp = parent[i], gp = pp > 0 ? parent[pp] : -1;
      if (gp >= 0 && leadA[pp] === i) { const q = pos[gp]; Pv[n * 4] = p.x - q.x; Pv[n * 4 + 1] = p.y - q.y; Pv[n * 4 + 2] = p.z - q.z; Pv[n * 4 + 3] = 1; }
      else Pv[n * 4 + 3] = 0; }
    n++;
  }
  const gw = WOHN_SEGS ? wohnGrow() : 0;
  if (gw > 0.001) for (const g of WOHN_SEGS) {
    // Hauptast wächst in die Länge (gw); Zweiglein erst ab Stufe 6, jedes, sobald der Hauptast an seiner Stelle ist
    const grow = g.base === 0 ? gw : (WOHN_S0 + gw * (3.15 - WOHN_S0) >= g.base * 3.15 ? smooth((P - 6 - g.base * 1.6) / 1.4) : 0);
    if (grow <= g.u0 + 1e-4) continue;
    const f = Math.min(1, (grow - g.u0) / (g.u1 - g.u0));
    let thick = g.base === 0 ? 1 : Math.max(0.35, Math.min(1, grow)) * (0.6 + 0.4 * smooth((P - 6) / 4));
    if (g.base === 0) { g._r0 = wohnR(g.s0 - 1000 + WOHN_S0); g._r1 = wohnR(g.s1 - 1000 + WOHN_S0); }
    S[n * 3] = g.a.x; S[n * 3 + 1] = g.a.y; S[n * 3 + 2] = g.a.z;
    E[n * 3] = g.a.x + (g.b.x - g.a.x) * f; E[n * 3 + 1] = g.a.y + (g.b.y - g.a.y) * f; E[n * 3 + 2] = g.a.z + (g.b.z - g.a.z) * f;
    const tip = grow < 0.999 && grow <= g.u1 + 1e-4;     // wachsende Spitze läuft spitz aus
    const r0u = g.base === 0 ? g._r0 : g.r0 * thick, r1u = g.base === 0 ? g._r1 : g.r1 * thick;
    R[n * 2] = r0u; R[n * 2 + 1] = tip ? Math.max(0.006, r1u * 0.75) : r1u;   // wachsende Spitze stumpf, nicht spitz
    Sarr[n * 2] = g.s0; Sarr[n * 2 + 1] = g.s0 + (g.s1 - g.s0) * f;
    Rf[n * 4] = g.ref.x; Rf[n * 4 + 1] = g.ref.y; Rf[n * 4 + 2] = g.ref.z; Rf[n * 4 + 3] = g.ext; Pv[n * 4 + 3] = 0; n++;
  }
  if (WOHN_LEAF_ATTR) { const lv = wohnLeaf(); WOHN_LEAF.fill(lv); WOHN_LEAF_ATTR.needsUpdate = true; }
  tubeGeo.instanceCount = n;
  aStart.needsUpdate = aEnd.needsUpdate = aRad.needsUpdate = true; tubeGeo.getAttribute('aRef').needsUpdate = true; tubeGeo.getAttribute('aS').needsUpdate = true; tubeGeo.getAttribute('aPrev').needsUpdate = true;

  // Laub: sprießt nach dem Zweig, fällt innen ab, sobald der Ast älter/dicker ist
  const g = leafMesh.geometry.getAttribute('aGrow');
  const ga = g.array;
  let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9, vis = 0;
  for (let k = 0; k < ga.length; k++) {
    const i = leafNode[k];
    const sprout = smooth((T - birth[i] - 0.1 - leafBirthJit[k] * 0.2) / 2.0);
    const alive = tree.hideAt[i] > 1e8;
    const shed = (alive ? 1 - smooth((rE[i] - 2.5) / 7) : 1) * smooth((tree.hideAt[i] - T) / 1.5);
    const lowL = smooth((mY[i] - crownBase - 0.15) / 0.3);
    if (lowL <= 0) { ga[k] = 0; continue; }
    let v = sprout * shed * lowL;
    if (leafClear) {   // Fenster im Laub vor dem Bewohner, damit man ihn sieht
      const d = _lc.copy(pos[i]).sub(leafClear.p), along = d.dot(leafClear.dir);
      const perp = d.addScaledVector(leafClear.dir, -along).length();
      if (along > (leafClear.front ?? -0.8)) v *= smooth((perp - leafClear.r) / 0.5);
    }
    ga[k] = v;
    if (v > 0.3) { const p = pos[i]; vis++;
      if (p.x < mnx) mnx = p.x; if (p.y < mny) mny = p.y; if (p.z < mnz) mnz = p.z;
      if (p.x > mxx) mxx = p.x; if (p.y > mxy) mxy = p.y; if (p.z > mxz) mxz = p.z; }
  }
  g.needsUpdate = true;
  if (vis > 5) {
    leafUniforms.uCrownC.value.set((mnx + mxx) / 2, (mny + mxy) / 2, (mnz + mxz) / 2);
    leafUniforms.uCrownR.value.set(Math.max(0.5, (mxx - mnx) / 2), Math.max(0.5, (mxy - mny) / 2), Math.max(0.5, (mxz - mnz) / 2));
  }
  const hNow = mY[0] / tree.H;
  leafScaleBase = Math.min(1, grownTop / 5.0) * smooth((grownTop - 1.6) / 1.6) * (1 - 0.38 * springK);
  youngU.value = 0.13 * (1 - smooth((grownTop - 2.2) / 1.4)) * yearLeafK;        // einzelne Blätter am jungen Bäumchen, gehen in die Büschel über
  youngMesh.visible = youngU.value > 0.001;
  if (youngMesh.visible) {
    const ya = youngMesh.geometry.getAttribute('aGrow'), yv = ya.array;
    for (let k = 0; k < yv.length; k++) {
      const i = youngNode[k];
      if (frac[i] <= 0) { yv[k] = 0; continue; }
      yv[k] = smooth((T - birth[i] - 0.05) / 1.2) * (1 - smooth((rE[i] - 3) / 6)) * smooth((mY[i] - crownBase - 0.1) / 0.3);
    }
    ya.needsUpdate = true;
  }
  applyLeafQuality();
  crownW = vis > 5 ? Math.max(mxx - mnx, mxz - mnz) : 0;
  groundUniforms.uAO.value.set((mnx + mxx) / 2 * 0.6, (mnz + mxz) / 2 * 0.6, Math.max(0.5, crownW * 0.55), vis > 5 ? smooth(crownW / 3) : 0);
  groundUniforms.uTrunkR.value = Math.max(0.12, rad[0] * 7);
  updateLabel();
  shadowDirty = true;
}
function smooth(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }


// ------------------------------------------------------------------ Bewohner-Test: schlafendes Eichhörnchen (gemalt, 2D) im 3D-Baum
// Zwei gemalte Teile (Körper mit Ast, Schwanz), zur Kamera gedreht; Schwanz pendelt um den Ansatz, Körper atmet.
const SQ = {"img": {"body": __img("d829a92f72.webp"), "tail": __img("13341d9aaa.webp")}, "meta": {"aspect": 0.9239543726235742, "pivot": [0.7870722433460076, 0.22633744855967078], "branchY": 0.38271604938271603, "head": [0.20532319391634982, 0.13991769547325103], "branchThick": 0.07034220532319392, "tilt": 0.0}};
const squirrel = (() => {
  const W = 1.0, H = W * SQ.meta.aspect, ax = 0.5, ay = SQ.meta.branchY;
  const grp = new THREE.Group(); grp.visible = false; scene.add(grp); grp.renderOrder = 20;
  const loader = new THREE.TextureLoader();
  const breath = { value: 0 };
  function mat(url, breathe) {
    const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthTest: true, depthWrite: false });
    m.color.setScalar(0.94);
    if (breathe) m.onBeforeCompile = (sh) => {
      sh.uniforms.uBreath = breath;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uBreath;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.y += uBreath * max(transformed.y, 0.);');
    };
    return m;
  }
  // Körper: Ursprung = Punkt auf dem gemalten Ast unter dem Bauch
  const bodyGeo = new THREE.PlaneGeometry(W, H, 1, 16); bodyGeo.translate((0.5 - ax) * W, (ay - 0.5) * H, 0);
  const body = new THREE.Mesh(bodyGeo, mat(SQ.img.body, true)); grp.add(body);
  // Schwanz: dreht sich um den Ansatz an der Hüfte
  const px = (SQ.meta.pivot[0] - ax) * W, py = (ay - SQ.meta.pivot[1]) * H;
  const tailPivot = new THREE.Group(); tailPivot.position.set(px, py, 0.004); grp.add(tailPivot);
  const tailGeo = new THREE.PlaneGeometry(W, H); tailGeo.translate((0.5 - ax) * W - px, (ay - 0.5) * H - py, 0);
  const tail = new THREE.Mesh(tailGeo, mat(SQ.img.tail, false)); tailPivot.add(tail);
  // „z“ steigen vom Kopf auf
  const zc = document.createElement('canvas'); zc.width = zc.height = 64;
  const zg = zc.getContext('2d'); zg.fillStyle = '#5a4a3e'; zg.font = 'italic 600 52px Georgia, serif'; zg.textAlign = 'center'; zg.textBaseline = 'middle'; zg.fillText('z', 32, 34);
  const zt = new THREE.CanvasTexture(zc); zt.colorSpace = THREE.SRGBColorSpace;
  const zs = [0, 1, 2].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zt, transparent: true, depthWrite: false, toneMapped: false })); grp.add(s); return s; });
  const head = new V((SQ.meta.head[0] - ax) * W, (ay - SQ.meta.head[1]) * H, 0.01);
  let placed = false;
  const anchor = new V();
  // Ast suchen: dick genug, unten in der Krone, zur Kamera hin, auf dem Bildschirm etwa waagerecht
  function pick() {
    const { N, pos, parent } = tree, cands = [];
    const cam = new V(camera.position.x, 0, camera.position.z).normalize();
    const a2 = new V(), b2 = new V();
    for (let i = 1; i < N; i++) {
      const p = parent[i]; const r = rad[i];
      if (!(r > 0.035 && r < 0.11)) continue;
      const a = pos[p], b = pos[i];
      if (a.y < 2.8 || a.y > 4.4) continue;
      const front = a.x * cam.x + a.z * cam.z, lat = Math.hypot(a.x, a.z);
      if (front < 0.0 || lat < 0.8 || lat > 3.8) continue;
      const axv = b.clone().sub(a).normalize(), tcv = camera.position.clone().sub(a).normalize();
      if (Math.abs(axv.dot(tcv)) > 0.45 || Math.abs(axv.y) > 0.5) continue;   // quer zur Blickrichtung, eher waagerecht
      a2.copy(a).project(camera); b2.copy(b).project(camera);
      const dx = (b2.x - a2.x) * W(), dy = (b2.y - a2.y) * H();
      const horiz = Math.abs(dx) / (Math.hypot(dx, dy) + 1e-6);
      if (horiz < 0.75) continue;
      cands.push({ i, score: front * 1.2 + lat * 0.2 - Math.abs(a.y - 3.3) * 0.8 + horiz, ang: Math.atan2(dy, Math.abs(dx)) * Math.sign(dx || 1) });
    }
    cands.sort((u, v) => v.score - u.score);
    window.__sqCands = cands;
    return cands;
  }
  // Fester Wohnplatz: eigener, tief angesetzter Seitenast unter der Krone, quer zur Blickrichtung
  let ast = null, astCurve = null;
  const astR = (t) => { const s = t * 2.7; return s < 1.35 ? 0.035 + 0.075 * (1 - s / 1.35) ** 2 : s <= 2.2 ? 0.035 : Math.max(0.006, 0.035 - (s - 2.2) * 0.032); };   // dick am Stamm, an der Liegestelle Ø 0,07 (passt zu den Lücken in den Beinen)
  // Der Wohnast wächst wie ein echter Ast des Baums: gleiche Röhren, gleiche Rinde, gleiches Licht (Röhrensegmente
  // werden an die Äste des Baums angehängt), mit Zweiglein und Laub an der Spitze.
  function buildAst() {
    const d = new V(Math.sin(AZ0), 0, Math.cos(AZ0)), r = new V(Math.cos(AZ0), 0, -Math.sin(AZ0)), up = new V(0, 1, 0);
    const dir = r.clone().multiplyScalar(window.__astSide ?? 1).addScaledVector(d, 0.15).normalize();
    const p0 = new V(0, window.__astY ?? 1.45, 0);
    // Hauptast: bis s = 2,2 genau die Linie, auf der das Eichhörnchen läuft und liegt; danach biegt er sanft nach oben
    // natürlicher Ansatz (wie in bake.py ast_bow): kommt etwas tiefer aus dem Stamm, schwingt nach oben in die Linie, leicht zur Seite
    const bowY = (s) => s < 1.2 ? -0.10 * (1 - s / 1.2) ** 2 : 0, bowZ = (s) => s < 1.2 ? 0.06 * Math.sin(Math.PI * s / 1.2) ** 2 : 0;
    const mainAt = (s) => p0.clone().addScaledVector(dir, s).addScaledVector(d, bowZ(s)).add(new V(0, 0.2 * s / 2.7 + bowY(s) + (s > 2.2 ? 0.42 * ((s - 2.2) / 0.95) ** 2 : 0), 0));
    astCurve = { getPointAt: (t) => mainAt(t * 2.7), getTangentAt: (t) => mainAt(t * 2.7 + 0.01).sub(mainAt(t * 2.7)).normalize() };
    const segs = [];
    const rng = mulberry32(4711), rnd2 = (a, b) => a + (b - a) * rng();
    function chain(pts, radii, s0, ext0, base = 0) {
      let ref = null, s = s0; let tot = 0;
      for (let i = 0; i < pts.length - 1; i++) tot += pts[i].distanceTo(pts[i + 1]);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dd = b.clone().sub(a).normalize();
        if (!ref) { ref = Math.abs(dd.y) < 0.9 ? new V().crossVectors(dd, up).normalize() : new V(1, 0, 0); }
        ref.addScaledVector(dd, -ref.dot(dd)).normalize();
        const len = a.distanceTo(b);
        segs.push({ a, b, r0: radii[i], r1: radii[i + 1], s0: s, s1: s + len, ref: ref.clone(), ext: i === 0 ? ext0 : 0.9,
          u0: (s - s0) / tot, u1: (s - s0 + len) / tot, base });
        s += len;
      }
    }
    const mainS = []; for (let s = WOHN_S0; s <= 3.15 + 1e-6; s += 0.075) mainS.push(s);
    chain(mainS.map(mainAt), mainS.map(s => s >= 3.1 ? 0.005 : astR(s / 2.7)), 1000, 0.12);   // s ab 1000: Rinde statt grüner Trieb
    // Zweiglein: wachsen vom Hauptast weg (nach hinten/oben, weg vom Liegeplatz)
    const leafSpots = [];
    function twig(sBase, way, len, r0, bend) {
      const base = mainAt(sBase), w = way.clone().normalize(), pts = [], rad = [];
      const n = Math.max(3, Math.round(len / 0.08));
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        pts.push(base.clone().addScaledVector(w, len * u).add(new V(0, bend * u * u, 0)).addScaledVector(d, -0.04 * Math.sin(u * 3)));
        rad.push(r0 * (1 - u) + 0.0035 * u);
      }
      chain(pts, rad, sBase * 3, 0.12, sBase / 3.15);
      leafSpots.push({ p: pts[n], dir: pts[n].clone().sub(pts[n - 1]).normalize() }, { p: pts[Math.round(n * 0.6)], dir: w });
    }
    twig(2.25, dir.clone().multiplyScalar(0.55).addScaledVector(up, 0.75).addScaledVector(d, -0.35), 0.75, 0.011, 0.08);
    twig(2.75, dir.clone().multiplyScalar(0.8).addScaledVector(up, 0.15).addScaledVector(d, 0.45), 0.55, 0.008, 0.12);
    twig(1.3, dir.clone().multiplyScalar(0.25).addScaledVector(up, 0.55).addScaledVector(d, -0.8), 0.32, 0.007, 0.05);
    twig(2.95, dir.clone().multiplyScalar(0.5).addScaledVector(up, 0.4).addScaledVector(d, -0.6), 0.4, 0.006, 0.06);
    const tip = mainAt(3.15); leafSpots.push({ p: tip, dir: tip.clone().sub(mainAt(3.0)).normalize() }, { p: mainAt(2.85), dir: dir.clone().addScaledVector(up, 0.6) });
    WOHN_SEGS = segs; Tshown = -1;
    // Laubkarten wie im Baum (gleiches Material, gleicher Vorab-Tiefendurchgang)
    const M = leafSpots.length, pl = new THREE.PlaneGeometry(1, 1); pl.translate(0, 0.5, 0);
    const aG = new Float32Array(M).fill(1), aP = new Float32Array(M), aC = new Float32Array(M * 3).fill(1), aU = new Float32Array(M * 2);
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion();
    const wl = new THREE.InstancedMesh(pl, leafMesh.material, M), wp = new THREE.InstancedMesh(pl, leafPre.material, M);
    WOHN_LEAF = aG;
    leafSpots.forEach((L, k) => {
      aP[k] = (k * 3 + 1 + 0.01 * k) / 7.13; aU[k * 2] = rng() < 0.5 ? 0 : 0.5; aU[k * 2 + 1] = rng() < 0.5 ? 0 : 0.5;
      const out = L.p.clone().sub(new V(0, 5.2, 0)); out.y *= 0.6; out.normalize().add(new V(0, 0.25, 0));
      const nrm = out.add(randUnit().multiplyScalar(0.6)).normalize();
      const u = L.dir.clone().add(new V(0, 0.5, 0)).add(randUnit().multiplyScalar(0.4));
      u.addScaledVector(nrm, -u.dot(nrm)); if (u.lengthSq() < 1e-4) u.set(0, 1, 0).addScaledVector(nrm, -nrm.y); u.normalize();
      const xb = new V().crossVectors(u, nrm);
      q4.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xb, u, nrm));
      const sc = rnd2(1.05, 1.35);
      m4.compose(L.p, q4, new V(sc, sc, sc)); wl.setMatrixAt(k, m4);
    });
    pl.setAttribute('aGrow', new THREE.InstancedBufferAttribute(aG, 1)); pl.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aP, 1));
    pl.setAttribute('aCol', new THREE.InstancedBufferAttribute(aC, 3)); pl.setAttribute('aUVo', new THREE.InstancedBufferAttribute(aU, 2));
    wp.instanceMatrix = wl.instanceMatrix;
    wl.customDepthMaterial = leafMesh.customDepthMaterial; wl.castShadow = true; wl.receiveShadow = leafMesh.receiveShadow;
    wl.frustumCulled = wp.frustumCulled = false; wl.renderOrder = 1; wp.renderOrder = -1;
    scene.add(wp); scene.add(wl);
    ast = { set visible(v) { wl.visible = wp.visible = v && leafMesh.visible && wohnLeaf() > 0.01; wl.material = leafMesh.material; } };
    WOHN_LEAF_ATTR = pl.getAttribute('aGrow');
  }
  function place() {
    if (!ast) buildAst();
    if (window.SEQ) {
      const S = SEQ.sleep;
      grp.userData.ref = stageToWorld(S.org[0], S.org[1], S.z); grp.userData.base = new V(-S.scale, S.scale, S.scale); grp.userData.zd = S.zd ?? S.z;
      grp.position.copy(grp.userData.ref);
      grp.quaternion.copy(STAGE_Q).multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 0, 1), S.rot));
      grp.scale.copy(grp.userData.base);
      placed = true; return;
    }
    const t = window.__sqT ?? 0.66, c = astCurve.getPointAt(t);
    let ax = astCurve.getTangentAt(t).normalize();
    const camR = new V(1, 0, 0).applyQuaternion(camera.quaternion);
    if (ax.dot(camR) < 0) ax.negate();
    const toCam = camera.position.clone().sub(c).normalize();
    const nrm = toCam.clone().addScaledVector(ax, -toCam.dot(ax)).normalize();
    const up = new V().crossVectors(nrm, ax).normalize();
    grp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, up, nrm))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 0, 1), -SQ.meta.tilt));
    // Bildebene genau auf der Astachse, nur um den Astradius nach vorn: die Lücken im Bild zeigen den echten Ast
    grp.position.copy(c).addScaledVector(nrm, astR(t));
    placed = true;
  }
  const qz = new THREE.Quaternion(), zAxis = new V(0, 0, 1);
  function frame(dt, t) {
    const show = P > 5.95 && season !== 'winter' && !moveIn;   // vor dem Einzug ist der Ast leer
    if (show && !placed) place();
    grp.visible = show && placed && !(window.__seqActive && window.__seqActive());
    if (!ast) buildAst();
    if (ast) ast.visible = true;
    if (!grp.visible) return;
    const calm = reduceMotion ? 0 : 1;
    breath.value = calm * 0.022 * (0.5 + 0.5 * Math.sin(t * 1.5));
    tailPivot.rotation.z = calm * (0.035 * Math.sin(t * 0.9) + 0.02 * Math.sin(t * 2.3 + 1) * leafUniforms.uWind.value);
    zs.forEach((s, k) => {
      const u = ((t * 0.28 + k / 3) % 1);
      s.visible = calm > 0;
      s.position.set(head.x - 0.05 - u * 0.12 + 0.03 * Math.sin(u * 6 + k), head.y + 0.08 + u * 0.35, head.z);
      const sc = 0.07 + u * 0.06; s.scale.set(sc, sc, 1);
      s.material.opacity = Math.sin(Math.PI * u) * 0.85;
    });
  }
  grp.traverse(o => { o.renderOrder = 21; });
  const late = () => { if (grp.visible && grp.userData.ref) depthPlace(grp, grp.userData.ref, grp.userData.base, grp.userData.zd); };
  window.__sq = { grp, get placed() { return placed; } };
  return { frame, late, group: grp, place, get ast() { return ast; } };
})();


// ------------------------------------------------------------------ Eichhörnchen-Abfolge: Wiese → Stamm → Ast → Eichel → schlafen
// Gebackene Abfolge (seq.json): je Probe Bild, Mitte (x, y) in der Bühne, Tiefe z, Drehung, Dauer in ms.
// Bühne = senkrechte Ebene durch die Stammachse, zur Startansicht (AZ0) gedreht; die Tiere drehen sich nicht mit.
const SEQ = window.SEQ = {"F":0.5,"frames":{"g4":{"w":0.7333,"h":0.3347},"g5":{"w":0.6857,"h":0.3347},"g6":{"w":0.6449,"h":0.532},"g7":{"w":0.5782,"h":0.5224},"g8":{"w":0.7034,"h":0.4775},"k0":{"w":0.273,"h":0.7882},"k1":{"w":0.3265,"h":0.7719},"k2":{"w":0.2912,"h":0.8036},"k3":{"w":0.2957,"h":0.7673},"k4":{"w":0.2676,"h":0.7673},"h0":{"w":0.4934,"h":0.5179},"h1":{"w":0.5605,"h":0.5751},"h2":{"w":0.6023,"h":0.3782},"h3":{"w":0.6231,"h":0.2757},"h4":{"w":0.4834,"h":0.5161},"t0":{"w":0.4795,"h":0.5109},"t1":{"w":0.4517,"h":0.484},"t2":{"w":0.3987,"h":0.3511},"t3":{"w":0.396,"h":0.3942},"t4":{"w":0.414,"h":0.3592},"n0":{"w":0.4149,"h":0.3574},"n1":{"w":0.3916,"h":0.3502},"n2":{"w":0.38,"h":0.3619},"n3":{"w":0.3827,"h":0.3546},"n4":{"w":0.3966,"h":0.3581},"n5":{"w":0.414,"h":0.3583},"l0":{"w":0.4008,"h":0.3682},"l1":{"w":0.4341,"h":0.393},"l2":{"w":0.5484,"h":0.4093},"l3":{"w":0.4923,"h":0.4668},"l4":{"w":0.4632,"h":0.4065},"l5m":{"w":0.4171,"h":0.4497},"eichel":{"w":0.0952,"h":0.071}},"samples":[["g4",-4.4524,0.1864,2.25,0,30],["g4",-4.4016,0.1864,2.25,0,30],["g4",-4.3508,0.1864,2.25,0,30],["g5",-4.3088,0.2068,2.25,0,30],["g5",-4.258,0.2068,2.25,0,30],["g5",-4.2073,0.2068,2.25,0,30],["g6",-4.1286,0.2728,2.25,0,30],["g6",-4.1213,0.2728,2.25,0,30],["g6",-4.1141,0.2728,2.25,0,30],["g7",-4.0667,0.2599,2.25,0,30],["g7",-4.0381,0.2599,2.25,0,30],["g7",-4.0095,0.2599,2.25,0,30],["g8",-4.0395,0.2361,2.25,0,30],["g8",-3.9887,0.2361,2.25,0,30],["g8",-3.9379,0.2361,2.25,0,30],["g4",-3.8878,0.1864,2.25,0,30],["g4",-3.837,0.1864,2.25,0,30],["g4",-3.7862,0.1864,2.25,0,30],["g5",-3.7442,0.2068,2.25,0,30],["g5",-3.6934,0.2068,2.25,0,30],["g5",-3.6426,0.2068,2.25,0,30],["g6",-3.564,0.2728,2.25,0,30],["g6",-3.5567,0.2728,2.25,0,30],["g6",-3.5494,0.2728,2.25,0,30],["g7",-3.502,0.2599,2.25,0,30],["g7",-3.4735,0.2599,2.25,0,30],["g7",-3.4449,0.2599,2.25,0,30],["g8",-3.4748,0.2361,2.25,0,30],["g8",-3.424,0.2361,2.25,0,30],["g8",-3.3733,0.2361,2.25,0,30],["g4",-3.3231,0.1864,2.25,0,30],["g4",-3.2723,0.1864,2.25,0,30],["g4",-3.2216,0.1864,2.25,0,30],["g5",-3.1796,0.2068,2.25,0,30],["g5",-3.1288,0.2068,2.25,0,30],["g5",-3.078,0.2068,2.25,0,30],["g6",-2.9993,0.2728,2.25,0,30],["g6",-2.9921,0.2728,2.25,0,30],["g6",-2.9848,0.2728,2.25,0,30],["g7",-2.9374,0.2599,2.25,0,30],["g7",-2.9089,0.2599,2.25,0,30],["g7",-2.8803,0.2599,2.25,0,30],["g8",-2.9102,0.2361,2.25,0,30],["g8",-2.8594,0.2361,2.25,0,30],["g8",-2.8086,0.2361,2.25,0,30],["g4",-2.7585,0.1864,2.25,0,30],["g4",-2.7077,0.1864,2.25,0,30],["g4",-2.6569,0.1864,2.25,0,30],["g5",-2.615,0.2068,2.25,0,30],["g5",-2.5642,0.2068,2.25,0,30],["g5",-2.5134,0.2068,2.25,0,30],["g6",-2.4347,0.2728,2.25,0,30],["g6",-2.4275,0.2728,2.25,0,30],["g6",-2.4202,0.2728,2.25,0,30],["g7",-2.3728,0.2599,2.25,0,30],["g7",-2.3442,0.2599,2.25,0,30],["g7",-2.3157,0.2599,2.25,0,30],["g8",-2.3456,0.2361,2.25,0,30],["g8",-2.2948,0.2361,2.25,0,30],["g8",-2.244,0.2361,2.25,0,30],["g4",-2.1939,0.1864,2.25,0,30],["g4",-2.1431,0.1864,2.25,0,30],["g4",-2.0923,0.1864,2.25,0,30],["g5",-2.0504,0.2068,2.25,0,30],["g5",-1.9996,0.2068,2.25,0,30],["g5",-1.9488,0.2068,2.25,0,30],["g6",-1.8701,0.2728,2.25,0,30],["g6",-1.8628,0.2728,2.25,0,30],["g6",-1.8556,0.2728,2.25,0,30],["g7",-1.8082,0.2599,2.25,0,30],["g7",-1.7796,0.2599,2.25,0,30],["g7",-1.751,0.2599,2.25,0,30],["g8",-1.781,0.2361,2.25,0,30],["g8",-1.7302,0.2361,2.25,0,30],["g8",-1.6794,0.2361,2.25,0,30],["g4",-1.6293,0.1864,2.25,0,30],["g4",-1.5785,0.1864,2.25,0,30],["g4",-1.5277,0.1864,2.25,0,30],["g5",-1.4857,0.2068,2.25,0,30],["g5",-1.4349,0.2068,2.25,0,30],["g5",-1.3842,0.2068,2.25,0,30],["g6",-1.3055,0.2728,2.25,0,30],["g6",-1.2982,0.2728,2.25,0,30],["g6",-1.291,0.2728,2.25,0,30],["g7",-1.2436,0.2599,2.25,0,30],["g7",-1.215,0.2599,2.25,0,30],["g7",-1.1864,0.2599,2.25,0,30],["g8",-1.2164,0.2361,2.25,0,30],["g8",-1.1656,0.2361,2.25,0,30],["g8",-1.1148,0.2361,2.25,0,30],["g4",-1.0647,0.1864,2.25,0,30],["g4",-1.0139,0.1864,2.25,0,30],["g4",-0.9631,0.1864,2.25,0,30],["g5",-0.9211,0.2068,2.25,0,30],["g5",-0.8703,0.2068,2.25,0,30],["g5",-0.8195,0.2068,2.25,0,30],["g6",-0.7408,0.2728,2.25,0,30],["g6",-0.7336,0.2728,2.25,0,30],["g6",-0.7263,0.2728,2.25,0,30],["g7",-0.6789,0.2599,2.25,0,30],["g7",-0.6504,0.2599,2.25,0,30],["g7",-0.6218,0.2599,2.25,0,30],["g7",-0.6108,0.2743,2.25,0.1164,40],["g7",-0.5839,0.3085,2.25,0.4072,40],["g7",-0.5493,0.3483,2.25,0.7854,40],["g7",-0.5133,0.383,2.25,1.1636,40],["g7",-0.4836,0.4069,2.25,1.4544,40],["g7",-0.471,0.4159,2.25,1.5708,40],["k0",-0.4356,0.3932,2.013,0,40],["k0",-0.4356,0.4096,1.964,0,40],["k1",-0.4624,0.5109,1.68,0,40],["k1",-0.4624,0.5249,1.648,0,40],["k2",-0.4447,0.5879,1.545,0,40],["k2",-0.4447,0.6053,1.511,0,40],["k3",-0.4469,0.7222,1.287,0,40],["k3",-0.4469,0.7349,1.269,0,40],["k4",-0.4329,0.8071,1.174,0,40],["k4",-0.4329,0.8146,1.165,0,40],["k0",-0.4338,0.8476,1.134,-0.1117,40],["k0",-0.4297,0.85,1.097,-0.378,40],["k0",-0.425,0.8534,0.991,-0.696,40],["k0",-0.4209,0.8567,0.894,-0.9623,40],["k0",-0.4192,0.8582,0.914,-1.074,40],["g4",-0.4376,0.8669,0.919,0.4968,30],["g4",-0.3968,0.8971,0.917,0.4968,30],["g4",-0.356,0.9274,0.915,0.4968,30],["g5",-0.3327,0.9713,0.903,0.4968,30],["g5",-0.2918,1.0015,0.901,0.4968,30],["g5",-0.251,1.0317,0.899,0.4968,30],["g6",-0.2171,1.1333,0.904,0.4968,30],["g6",-0.2113,1.1376,0.903,0.4968,30],["g6",-0.2055,1.1419,0.903,0.4968,30],["g7",-0.1582,1.154,0.907,0.4968,30],["g7",-0.1352,1.171,0.905,0.4968,30],["g7",-0.1122,1.188,0.903,0.4968,30],["g8",-0.1294,1.1562,0.903,0.4968,30],["g8",-0.0885,1.1864,0.9,0.4968,30],["g8",-0.0477,1.2166,0.898,0.4968,30],["g4",0.0162,1.2028,0.891,0.4968,30],["g4",0.057,1.2331,0.889,0.4968,30],["g4",0.0978,1.2633,0.885,0.4968,30],["g5",0.1212,1.3072,0.877,0.4968,30],["g5",0.162,1.3374,0.877,0.4968,30],["g5",0.2028,1.3677,0.875,0.4968,30],["g6",0.2367,1.4692,0.879,0.4968,30],["g6",0.2425,1.4735,0.879,0.4968,30],["g6",0.2484,1.4778,0.878,0.4968,30],["g7",0.2956,1.4899,0.879,0.4968,30],["g7",0.3186,1.5069,0.877,0.4968,30],["g7",0.3416,1.5239,0.875,0.4968,30],["g8",0.3245,1.4921,0.878,0.4968,30],["g8",0.3653,1.5223,0.875,0.4968,30],["g8",0.4061,1.5525,0.871,0.4968,30],["g4",0.4701,1.5398,0.865,0.4935,30],["g4",0.5148,1.5914,0.853,0.4243,30],["g4",0.566,1.6587,0.829,0.3015,30],["g5",0.6189,1.7196,0.807,0.173,30],["g5",0.6843,1.7463,0.794,0.0869,30],["g5",0.7372,1.752,0.786,0.0748,30],["g6",0.8108,1.8224,0.765,0.0748,30],["h0",0.8171,1.7944,0.745,0.0,40],["h0",0.83,1.8183,0.736,0.0011,40],["h0",0.866,1.8386,0.717,0.0041,40],["h1",0.9321,1.8749,0.696,0.0088,40],["h1",1.0028,1.888,0.648,0.0148,40],["h1",1.085,1.8975,0.578,0.0218,40],["h2",1.1799,1.8924,0.504,0.0294,40],["h2",1.2738,1.8947,0.366,0.0374,40],["h2",1.3677,1.8932,0.323,0.0453,40],["h2",1.4577,1.8881,0.336,0.053,40],["h3",1.5,1.8857,0.344,0.0599,40],["h3",1.5707,1.8729,0.355,0.0659,40],["h3",1.626,1.8564,0.363,0.0706,40],["h4",1.7307,1.8703,0.368,0.0737,40],["h4",1.7435,1.853,0.37,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["t0",1.7252,1.8494,0.367,0.0748,240],["t1",1.7078,1.8355,0.363,0.0748,140],["t2",1.6541,1.7648,0.351,0.0748,140],["t3",1.6485,1.786,0.349,0.0748,140],["t4",1.6561,1.769,0.352,0.0748,120],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n5",1.656,1.7695,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["l0",1.6455,1.7737,0.349,0.0748,520],["l1",1.6613,1.7859,0.354,0.0748,240],["l2",1.6852,1.7944,0.366,0.0748,240],["l3",1.7078,1.7004,0.366,0.0748,280],["l4",1.7515,1.554,0.37,0.0748,450],["l5m",1.7299,1.5328,0.363,0.0748,600]],"idx":{"pick":186,"drop":207,"sleep":213},"acorn":{"rest":[1.9018,1.6439],"z":0.303,"drop":[1.8253,1.752],"dropAng":55,"dropScale":1.0215},"sleep":{"org":[1.7402,1.5849],"rot":0.07476316277051329,"z":0.303,"zd":0.386,"scale":0.5},"zref":0.303,"ast":{"sit":1.62},"total_ms":12010};
// gleiche Abfolge, je Baumstufe an Stammdicke und Weg über den Stamm angepasst (gebacken mit bake.py STAGE=6…10)
const SEQS = {"6":{"samples":[["g4",-4.4524,0.1864,2.25,0,30],["g4",-4.4016,0.1864,2.25,0,30],["g4",-4.3508,0.1864,2.25,0,30],["g5",-4.3088,0.2068,2.25,0,30],["g5",-4.258,0.2068,2.25,0,30],["g5",-4.2073,0.2068,2.25,0,30],["g6",-4.1286,0.2728,2.25,0,30],["g6",-4.1213,0.2728,2.25,0,30],["g6",-4.1141,0.2728,2.25,0,30],["g7",-4.0667,0.2599,2.25,0,30],["g7",-4.0381,0.2599,2.25,0,30],["g7",-4.0095,0.2599,2.25,0,30],["g8",-4.0395,0.2361,2.25,0,30],["g8",-3.9887,0.2361,2.25,0,30],["g8",-3.9379,0.2361,2.25,0,30],["g4",-3.8878,0.1864,2.25,0,30],["g4",-3.837,0.1864,2.25,0,30],["g4",-3.7862,0.1864,2.25,0,30],["g5",-3.7442,0.2068,2.25,0,30],["g5",-3.6934,0.2068,2.25,0,30],["g5",-3.6426,0.2068,2.25,0,30],["g6",-3.564,0.2728,2.25,0,30],["g6",-3.5567,0.2728,2.25,0,30],["g6",-3.5494,0.2728,2.25,0,30],["g7",-3.502,0.2599,2.25,0,30],["g7",-3.4735,0.2599,2.25,0,30],["g7",-3.4449,0.2599,2.25,0,30],["g8",-3.4748,0.2361,2.25,0,30],["g8",-3.424,0.2361,2.25,0,30],["g8",-3.3733,0.2361,2.25,0,30],["g4",-3.3231,0.1864,2.25,0,30],["g4",-3.2723,0.1864,2.25,0,30],["g4",-3.2216,0.1864,2.25,0,30],["g5",-3.1796,0.2068,2.25,0,30],["g5",-3.1288,0.2068,2.25,0,30],["g5",-3.078,0.2068,2.25,0,30],["g6",-2.9993,0.2728,2.25,0,30],["g6",-2.9921,0.2728,2.25,0,30],["g6",-2.9848,0.2728,2.25,0,30],["g7",-2.9374,0.2599,2.25,0,30],["g7",-2.9089,0.2599,2.25,0,30],["g7",-2.8803,0.2599,2.25,0,30],["g8",-2.9102,0.2361,2.25,0,30],["g8",-2.8594,0.2361,2.25,0,30],["g8",-2.8086,0.2361,2.25,0,30],["g4",-2.7585,0.1864,2.25,0,30],["g4",-2.7077,0.1864,2.25,0,30],["g4",-2.6569,0.1864,2.25,0,30],["g5",-2.615,0.2068,2.25,0,30],["g5",-2.5642,0.2068,2.25,0,30],["g5",-2.5134,0.2068,2.25,0,30],["g6",-2.4347,0.2728,2.25,0,30],["g6",-2.4275,0.2728,2.25,0,30],["g6",-2.4202,0.2728,2.25,0,30],["g7",-2.3728,0.2599,2.25,0,30],["g7",-2.3442,0.2599,2.25,0,30],["g7",-2.3157,0.2599,2.25,0,30],["g8",-2.3456,0.2361,2.25,0,30],["g8",-2.2948,0.2361,2.25,0,30],["g8",-2.244,0.2361,2.25,0,30],["g4",-2.1939,0.1864,2.25,0,30],["g4",-2.1431,0.1864,2.25,0,30],["g4",-2.0923,0.1864,2.25,0,30],["g5",-2.0504,0.2068,2.25,0,30],["g5",-1.9996,0.2068,2.25,0,30],["g5",-1.9488,0.2068,2.25,0,30],["g6",-1.8701,0.2728,2.25,0,30],["g6",-1.8628,0.2728,2.25,0,30],["g6",-1.8556,0.2728,2.25,0,30],["g7",-1.8082,0.2599,2.25,0,30],["g7",-1.7796,0.2599,2.25,0,30],["g7",-1.751,0.2599,2.25,0,30],["g8",-1.781,0.2361,2.25,0,30],["g8",-1.7302,0.2361,2.25,0,30],["g8",-1.6794,0.2361,2.25,0,30],["g4",-1.6293,0.1864,2.25,0,30],["g4",-1.5785,0.1864,2.25,0,30],["g4",-1.5277,0.1864,2.25,0,30],["g5",-1.4857,0.2068,2.25,0,30],["g5",-1.4349,0.2068,2.25,0,30],["g5",-1.3842,0.2068,2.25,0,30],["g6",-1.3055,0.2728,2.25,0,30],["g6",-1.2982,0.2728,2.25,0,30],["g6",-1.291,0.2728,2.25,0,30],["g7",-1.2436,0.2599,2.25,0,30],["g7",-1.215,0.2599,2.25,0,30],["g7",-1.1864,0.2599,2.25,0,30],["g8",-1.2164,0.2361,2.25,0,30],["g8",-1.1656,0.2361,2.25,0,30],["g8",-1.1148,0.2361,2.25,0,30],["g4",-1.0647,0.1864,2.25,0,30],["g4",-1.0139,0.1864,2.25,0,30],["g4",-0.9631,0.1864,2.25,0,30],["g5",-0.9211,0.2068,2.25,0,30],["g5",-0.8703,0.2068,2.25,0,30],["g5",-0.8195,0.2068,2.25,0,30],["g6",-0.7408,0.2728,2.25,0,30],["g6",-0.7336,0.2728,2.25,0,30],["g6",-0.7263,0.2728,2.25,0,30],["g7",-0.6789,0.2599,2.25,0,30],["g7",-0.6504,0.2599,2.25,0,30],["g7",-0.6218,0.2599,2.25,0,30],["g8",-0.6517,0.2361,2.25,0,30],["g8",-0.6009,0.2361,2.25,0,30],["g8",-0.5501,0.2361,2.25,0,30],["g4",-0.5,0.1864,2.25,0,30],["g4",-0.4492,0.1864,2.25,0,30],["g4",-0.3984,0.1864,2.25,0,30],["g5",-0.3565,0.2068,2.25,0,30],["g5",-0.3057,0.2068,2.25,0,30],["g5",-0.2549,0.2068,2.25,0,30],["g6",-0.1762,0.2728,2.25,0,30],["g6",-0.169,0.2728,2.25,0,30],["g6",-0.1617,0.2728,2.25,0,30],["g7",-0.1143,0.2599,2.25,0,30],["g7",-0.0858,0.2599,2.25,0,30],["g7",-0.0572,0.2599,2.25,0,30],["g7",-0.0567,0.2743,2.25,0.1164,40],["g7",-0.0562,0.3085,2.25,0.4072,40],["g7",-0.0559,0.3483,2.25,0.7854,40],["g7",-0.0542,0.383,2.25,1.1636,40],["g7",-0.0509,0.4069,2.25,1.4544,40],["g7",-0.0489,0.4159,2.25,1.5708,40],["k0",-0.0135,0.3932,0.954,0,40],["k0",-0.0135,0.4096,0.933,0,40],["k1",-0.0402,0.5109,0.811,0,40],["k1",-0.0402,0.5249,0.797,0,40],["k2",-0.0225,0.5879,0.753,0,40],["k2",-0.0225,0.6053,0.739,0,40],["k3",-0.0248,0.7222,0.645,0,40],["k3",-0.0248,0.7349,0.638,0,40],["k4",-0.0108,0.8071,0.601,0,40],["k4",-0.0108,0.8146,0.597,0,40],["k0",-0.0122,0.8486,0.589,-0.0677,40],["k0",-0.0092,0.8531,0.588,-0.2291,40],["k0",-0.0058,0.8587,0.571,-0.4218,40],["k0",-0.0029,0.8635,0.543,-0.5833,40],["k0",-0.0017,0.8656,0.527,-0.651,40],["g4",-0.0221,0.866,0.533,0.9198,30],["g4",-0.0048,0.9138,0.51,0.9198,30],["g4",0.0124,0.9615,0.491,0.9198,30],["g5",0.0081,1.0146,0.458,0.9198,30],["g5",0.0254,1.0624,0.445,0.9198,30],["g5",0.0426,1.1102,0.433,0.9198,30],["g6",0.0243,1.2201,0.435,0.9198,30],["g6",0.0268,1.227,0.434,0.9198,30],["g6",0.0292,1.2338,0.432,0.9198,30],["g7",0.0663,1.2647,0.433,0.9198,30],["g7",0.076,1.2916,0.43,0.9198,30],["g7",0.0857,1.3184,0.427,0.9198,30],["g8",0.0789,1.2843,0.425,0.9198,30],["g8",0.0961,1.3325,0.42,0.9186,30],["g8",0.1091,1.42,0.408,0.8027,30],["g4",0.158,1.5068,0.391,0.566,30],["g4",0.2164,1.6047,0.364,0.3045,30],["g4",0.2917,1.666,0.343,0.1145,30],["g5",0.3384,1.7032,0.333,0.0748,30],["g5",0.3891,1.7098,0.329,0.0748,30],["g5",0.4397,1.716,0.334,0.0748,30],["g6",0.5132,1.7899,0.327,0.0748,30],["g6",0.5205,1.7907,0.329,0.0748,30],["g6",0.5277,1.7915,0.33,0.0748,30],["g7",0.5759,1.7825,0.337,0.0748,30],["g7",0.6044,1.7857,0.331,0.0748,30],["g7",0.6329,1.7887,0.328,0.0748,30],["g8",0.6049,1.7636,0.339,0.0748,30],["g8",0.6555,1.7688,0.333,0.0748,30],["g8",0.7062,1.7736,0.327,0.0748,30],["g4",0.7598,1.7286,0.324,0.0748,30],["h0",0.7707,1.7086,0.274,0.0,40],["h0",0.7842,1.7338,0.26,0.0011,40],["h0",0.8222,1.7576,0.236,0.0041,40],["h1",0.8912,1.7992,0.248,0.0088,40],["h1",0.9656,1.8192,0.259,0.0148,40],["h1",1.0521,1.8368,0.272,0.0218,40],["h2",1.1518,1.8404,0.29,0.0294,40],["h2",1.2506,1.8518,0.305,0.0374,40],["h2",1.3494,1.8595,0.32,0.0453,40],["h2",1.4441,1.8631,0.334,0.053,40],["h3",1.4908,1.8687,0.343,0.0599,40],["h3",1.5652,1.8628,0.354,0.0659,40],["h3",1.6234,1.8516,0.363,0.0706,40],["h4",1.73,1.8691,0.368,0.0737,40],["h4",1.7435,1.853,0.37,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["t0",1.7252,1.8494,0.367,0.0748,240],["t1",1.7078,1.8355,0.363,0.0748,140],["t2",1.6541,1.7648,0.351,0.0748,140],["t3",1.6485,1.786,0.349,0.0748,140],["t4",1.6561,1.769,0.352,0.0748,120],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n5",1.656,1.7695,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["l0",1.6455,1.7737,0.349,0.0748,520],["l1",1.6613,1.7859,0.354,0.0748,240],["l2",1.6852,1.7944,0.366,0.0748,240],["l3",1.7078,1.7004,0.366,0.0748,280],["l4",1.7515,1.554,0.37,0.0748,450],["l5m",1.7299,1.5328,0.363,0.0748,600]],"idx":{"pick":195,"drop":216,"sleep":222}},"7":{"samples":[["g4",-4.4524,0.1864,2.25,0,30],["g4",-4.4016,0.1864,2.25,0,30],["g4",-4.3508,0.1864,2.25,0,30],["g5",-4.3088,0.2068,2.25,0,30],["g5",-4.258,0.2068,2.25,0,30],["g5",-4.2073,0.2068,2.25,0,30],["g6",-4.1286,0.2728,2.25,0,30],["g6",-4.1213,0.2728,2.25,0,30],["g6",-4.1141,0.2728,2.25,0,30],["g7",-4.0667,0.2599,2.25,0,30],["g7",-4.0381,0.2599,2.25,0,30],["g7",-4.0095,0.2599,2.25,0,30],["g8",-4.0395,0.2361,2.25,0,30],["g8",-3.9887,0.2361,2.25,0,30],["g8",-3.9379,0.2361,2.25,0,30],["g4",-3.8878,0.1864,2.25,0,30],["g4",-3.837,0.1864,2.25,0,30],["g4",-3.7862,0.1864,2.25,0,30],["g5",-3.7442,0.2068,2.25,0,30],["g5",-3.6934,0.2068,2.25,0,30],["g5",-3.6426,0.2068,2.25,0,30],["g6",-3.564,0.2728,2.25,0,30],["g6",-3.5567,0.2728,2.25,0,30],["g6",-3.5494,0.2728,2.25,0,30],["g7",-3.502,0.2599,2.25,0,30],["g7",-3.4735,0.2599,2.25,0,30],["g7",-3.4449,0.2599,2.25,0,30],["g8",-3.4748,0.2361,2.25,0,30],["g8",-3.424,0.2361,2.25,0,30],["g8",-3.3733,0.2361,2.25,0,30],["g4",-3.3231,0.1864,2.25,0,30],["g4",-3.2723,0.1864,2.25,0,30],["g4",-3.2216,0.1864,2.25,0,30],["g5",-3.1796,0.2068,2.25,0,30],["g5",-3.1288,0.2068,2.25,0,30],["g5",-3.078,0.2068,2.25,0,30],["g6",-2.9993,0.2728,2.25,0,30],["g6",-2.9921,0.2728,2.25,0,30],["g6",-2.9848,0.2728,2.25,0,30],["g7",-2.9374,0.2599,2.25,0,30],["g7",-2.9089,0.2599,2.25,0,30],["g7",-2.8803,0.2599,2.25,0,30],["g8",-2.9102,0.2361,2.25,0,30],["g8",-2.8594,0.2361,2.25,0,30],["g8",-2.8086,0.2361,2.25,0,30],["g4",-2.7585,0.1864,2.25,0,30],["g4",-2.7077,0.1864,2.25,0,30],["g4",-2.6569,0.1864,2.25,0,30],["g5",-2.615,0.2068,2.25,0,30],["g5",-2.5642,0.2068,2.25,0,30],["g5",-2.5134,0.2068,2.25,0,30],["g6",-2.4347,0.2728,2.25,0,30],["g6",-2.4275,0.2728,2.25,0,30],["g6",-2.4202,0.2728,2.25,0,30],["g7",-2.3728,0.2599,2.25,0,30],["g7",-2.3442,0.2599,2.25,0,30],["g7",-2.3157,0.2599,2.25,0,30],["g8",-2.3456,0.2361,2.25,0,30],["g8",-2.2948,0.2361,2.25,0,30],["g8",-2.244,0.2361,2.25,0,30],["g4",-2.1939,0.1864,2.25,0,30],["g4",-2.1431,0.1864,2.25,0,30],["g4",-2.0923,0.1864,2.25,0,30],["g5",-2.0504,0.2068,2.25,0,30],["g5",-1.9996,0.2068,2.25,0,30],["g5",-1.9488,0.2068,2.25,0,30],["g6",-1.8701,0.2728,2.25,0,30],["g6",-1.8628,0.2728,2.25,0,30],["g6",-1.8556,0.2728,2.25,0,30],["g7",-1.8082,0.2599,2.25,0,30],["g7",-1.7796,0.2599,2.25,0,30],["g7",-1.751,0.2599,2.25,0,30],["g8",-1.781,0.2361,2.25,0,30],["g8",-1.7302,0.2361,2.25,0,30],["g8",-1.6794,0.2361,2.25,0,30],["g4",-1.6293,0.1864,2.25,0,30],["g4",-1.5785,0.1864,2.25,0,30],["g4",-1.5277,0.1864,2.25,0,30],["g5",-1.4857,0.2068,2.25,0,30],["g5",-1.4349,0.2068,2.25,0,30],["g5",-1.3842,0.2068,2.25,0,30],["g6",-1.3055,0.2728,2.25,0,30],["g6",-1.2982,0.2728,2.25,0,30],["g6",-1.291,0.2728,2.25,0,30],["g7",-1.2436,0.2599,2.25,0,30],["g7",-1.215,0.2599,2.25,0,30],["g7",-1.1864,0.2599,2.25,0,30],["g8",-1.2164,0.2361,2.25,0,30],["g8",-1.1656,0.2361,2.25,0,30],["g8",-1.1148,0.2361,2.25,0,30],["g4",-1.0647,0.1864,2.25,0,30],["g4",-1.0139,0.1864,2.25,0,30],["g4",-0.9631,0.1864,2.25,0,30],["g5",-0.9211,0.2068,2.25,0,30],["g5",-0.8703,0.2068,2.25,0,30],["g5",-0.8195,0.2068,2.25,0,30],["g6",-0.7408,0.2728,2.25,0,30],["g6",-0.7336,0.2728,2.25,0,30],["g6",-0.7263,0.2728,2.25,0,30],["g7",-0.6789,0.2599,2.25,0,30],["g7",-0.6504,0.2599,2.25,0,30],["g7",-0.6218,0.2599,2.25,0,30],["g8",-0.6517,0.2361,2.25,0,30],["g8",-0.6009,0.2361,2.25,0,30],["g8",-0.5501,0.2361,2.25,0,30],["g4",-0.5,0.1864,2.25,0,30],["g4",-0.4492,0.1864,2.25,0,30],["g4",-0.3984,0.1864,2.25,0,30],["g5",-0.3565,0.2068,2.25,0,30],["g5",-0.3057,0.2068,2.25,0,30],["g5",-0.2549,0.2068,2.25,0,30],["g6",-0.1762,0.2728,2.25,0,30],["g6",-0.169,0.2728,2.25,0,30],["g6",-0.1617,0.2728,2.25,0,30],["g7",-0.1143,0.2599,2.25,0,30],["g7",-0.0858,0.2599,2.25,0,30],["g7",-0.0572,0.2599,2.25,0,30],["g7",-0.0621,0.2743,2.25,0.1164,40],["g7",-0.0752,0.3085,2.25,0.4072,40],["g7",-0.0925,0.3483,2.25,0.7854,40],["g7",-0.1085,0.383,2.25,1.1636,40],["g7",-0.1187,0.4069,2.25,1.4544,40],["g7",-0.1221,0.4159,2.25,1.5708,40],["k0",-0.0867,0.3932,1.199,0,40],["k0",-0.0867,0.4096,1.172,0,40],["k1",-0.1134,0.5109,1.015,0,40],["k1",-0.1134,0.5249,0.998,0,40],["k2",-0.0958,0.5879,0.942,0,40],["k2",-0.0958,0.6053,0.923,0,40],["k3",-0.098,0.7222,0.803,0,40],["k3",-0.098,0.7349,0.794,0,40],["k4",-0.084,0.8071,0.744,0,40],["k4",-0.084,0.8146,0.739,0,40],["k0",-0.0852,0.8483,0.726,-0.0811,40],["k0",-0.0818,0.8523,0.718,-0.2744,40],["k0",-0.0779,0.8572,0.685,-0.5052,40],["k0",-0.0746,0.8616,0.636,-0.6986,40],["k0",-0.0732,0.8635,0.608,-0.7797,40],["g4",-0.0933,0.8666,0.618,0.7911,30],["g4",-0.0678,0.9105,0.598,0.7911,30],["g4",-0.0423,0.9544,0.581,0.7911,30],["g5",-0.0375,1.0064,0.549,0.7911,30],["g5",-0.012,1.0503,0.541,0.7911,30],["g5",0.0135,1.0942,0.535,0.7911,30],["g6",0.0117,1.2044,0.539,0.7911,30],["g6",0.0153,1.2107,0.538,0.7911,30],["g6",0.019,1.2169,0.537,0.7911,30],["g7",0.06,1.2427,0.54,0.7911,30],["g7",0.0744,1.2674,0.537,0.7911,30],["g7",0.0887,1.2921,0.535,0.7911,30],["g8",0.0789,1.2584,0.533,0.7911,30],["g8",0.1044,1.3024,0.529,0.7911,30],["g8",0.1299,1.3463,0.524,0.7911,30],["g4",0.1903,1.3548,0.518,0.7911,30],["g4",0.2132,1.4193,0.511,0.7249,30],["g4",0.239,1.5213,0.494,0.5397,30],["g5",0.2774,1.6309,0.46,0.3157,30],["g5",0.354,1.6918,0.437,0.1344,30],["g5",0.4153,1.7147,0.427,0.0748,30],["g6",0.4889,1.7884,0.432,0.0748,30],["g6",0.4961,1.7892,0.432,0.0748,30],["g6",0.5033,1.7901,0.433,0.0748,30],["g7",0.5515,1.781,0.444,0.0748,30],["g7",0.58,1.7841,0.442,0.0748,30],["g7",0.6085,1.7872,0.437,0.0748,30],["g8",0.5805,1.762,0.443,0.0748,30],["g8",0.6311,1.7671,0.442,0.0748,30],["g8",0.6818,1.7719,0.434,0.0748,30],["g4",0.7354,1.7269,0.415,0.0748,30],["g4",0.7861,1.7312,0.393,0.0748,30],["h0",0.797,1.7112,0.347,0.0,40],["h0",0.8101,1.7363,0.325,0.0011,40],["h0",0.847,1.76,0.265,0.0041,40],["h1",0.9144,1.8015,0.252,0.0088,40],["h1",0.9866,1.8213,0.263,0.0148,40],["h1",1.0707,1.8386,0.275,0.0218,40],["h2",1.1677,1.842,0.293,0.0294,40],["h2",1.2637,1.8531,0.307,0.0374,40],["h2",1.3597,1.8605,0.322,0.0453,40],["h2",1.4518,1.8639,0.335,0.053,40],["h3",1.496,1.8692,0.344,0.0599,40],["h3",1.5683,1.8631,0.354,0.0659,40],["h3",1.6248,1.8518,0.363,0.0706,40],["h4",1.7304,1.8691,0.368,0.0737,40],["h4",1.7435,1.853,0.37,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["t0",1.7252,1.8494,0.367,0.0748,240],["t1",1.7078,1.8355,0.363,0.0748,140],["t2",1.6541,1.7648,0.351,0.0748,140],["t3",1.6485,1.786,0.349,0.0748,140],["t4",1.6561,1.769,0.352,0.0748,120],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n5",1.656,1.7695,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["l0",1.6455,1.7737,0.349,0.0748,520],["l1",1.6613,1.7859,0.354,0.0748,240],["l2",1.6852,1.7944,0.366,0.0748,240],["l3",1.7078,1.7004,0.366,0.0748,280],["l4",1.7515,1.554,0.37,0.0748,450],["l5m",1.7299,1.5328,0.363,0.0748,600]],"idx":{"pick":196,"drop":217,"sleep":223}},"8":{"samples":[["g4",-4.4524,0.1864,2.25,0,30],["g4",-4.4016,0.1864,2.25,0,30],["g4",-4.3508,0.1864,2.25,0,30],["g5",-4.3088,0.2068,2.25,0,30],["g5",-4.258,0.2068,2.25,0,30],["g5",-4.2073,0.2068,2.25,0,30],["g6",-4.1286,0.2728,2.25,0,30],["g6",-4.1213,0.2728,2.25,0,30],["g6",-4.1141,0.2728,2.25,0,30],["g7",-4.0667,0.2599,2.25,0,30],["g7",-4.0381,0.2599,2.25,0,30],["g7",-4.0095,0.2599,2.25,0,30],["g8",-4.0395,0.2361,2.25,0,30],["g8",-3.9887,0.2361,2.25,0,30],["g8",-3.9379,0.2361,2.25,0,30],["g4",-3.8878,0.1864,2.25,0,30],["g4",-3.837,0.1864,2.25,0,30],["g4",-3.7862,0.1864,2.25,0,30],["g5",-3.7442,0.2068,2.25,0,30],["g5",-3.6934,0.2068,2.25,0,30],["g5",-3.6426,0.2068,2.25,0,30],["g6",-3.564,0.2728,2.25,0,30],["g6",-3.5567,0.2728,2.25,0,30],["g6",-3.5494,0.2728,2.25,0,30],["g7",-3.502,0.2599,2.25,0,30],["g7",-3.4735,0.2599,2.25,0,30],["g7",-3.4449,0.2599,2.25,0,30],["g8",-3.4748,0.2361,2.25,0,30],["g8",-3.424,0.2361,2.25,0,30],["g8",-3.3733,0.2361,2.25,0,30],["g4",-3.3231,0.1864,2.25,0,30],["g4",-3.2723,0.1864,2.25,0,30],["g4",-3.2216,0.1864,2.25,0,30],["g5",-3.1796,0.2068,2.25,0,30],["g5",-3.1288,0.2068,2.25,0,30],["g5",-3.078,0.2068,2.25,0,30],["g6",-2.9993,0.2728,2.25,0,30],["g6",-2.9921,0.2728,2.25,0,30],["g6",-2.9848,0.2728,2.25,0,30],["g7",-2.9374,0.2599,2.25,0,30],["g7",-2.9089,0.2599,2.25,0,30],["g7",-2.8803,0.2599,2.25,0,30],["g8",-2.9102,0.2361,2.25,0,30],["g8",-2.8594,0.2361,2.25,0,30],["g8",-2.8086,0.2361,2.25,0,30],["g4",-2.7585,0.1864,2.25,0,30],["g4",-2.7077,0.1864,2.25,0,30],["g4",-2.6569,0.1864,2.25,0,30],["g5",-2.615,0.2068,2.25,0,30],["g5",-2.5642,0.2068,2.25,0,30],["g5",-2.5134,0.2068,2.25,0,30],["g6",-2.4347,0.2728,2.25,0,30],["g6",-2.4275,0.2728,2.25,0,30],["g6",-2.4202,0.2728,2.25,0,30],["g7",-2.3728,0.2599,2.25,0,30],["g7",-2.3442,0.2599,2.25,0,30],["g7",-2.3157,0.2599,2.25,0,30],["g8",-2.3456,0.2361,2.25,0,30],["g8",-2.2948,0.2361,2.25,0,30],["g8",-2.244,0.2361,2.25,0,30],["g4",-2.1939,0.1864,2.25,0,30],["g4",-2.1431,0.1864,2.25,0,30],["g4",-2.0923,0.1864,2.25,0,30],["g5",-2.0504,0.2068,2.25,0,30],["g5",-1.9996,0.2068,2.25,0,30],["g5",-1.9488,0.2068,2.25,0,30],["g6",-1.8701,0.2728,2.25,0,30],["g6",-1.8628,0.2728,2.25,0,30],["g6",-1.8556,0.2728,2.25,0,30],["g7",-1.8082,0.2599,2.25,0,30],["g7",-1.7796,0.2599,2.25,0,30],["g7",-1.751,0.2599,2.25,0,30],["g8",-1.781,0.2361,2.25,0,30],["g8",-1.7302,0.2361,2.25,0,30],["g8",-1.6794,0.2361,2.25,0,30],["g4",-1.6293,0.1864,2.25,0,30],["g4",-1.5785,0.1864,2.25,0,30],["g4",-1.5277,0.1864,2.25,0,30],["g5",-1.4857,0.2068,2.25,0,30],["g5",-1.4349,0.2068,2.25,0,30],["g5",-1.3842,0.2068,2.25,0,30],["g6",-1.3055,0.2728,2.25,0,30],["g6",-1.2982,0.2728,2.25,0,30],["g6",-1.291,0.2728,2.25,0,30],["g7",-1.2436,0.2599,2.25,0,30],["g7",-1.215,0.2599,2.25,0,30],["g7",-1.1864,0.2599,2.25,0,30],["g8",-1.2164,0.2361,2.25,0,30],["g8",-1.1656,0.2361,2.25,0,30],["g8",-1.1148,0.2361,2.25,0,30],["g4",-1.0647,0.1864,2.25,0,30],["g4",-1.0139,0.1864,2.25,0,30],["g4",-0.9631,0.1864,2.25,0,30],["g5",-0.9211,0.2068,2.25,0,30],["g5",-0.8703,0.2068,2.25,0,30],["g5",-0.8195,0.2068,2.25,0,30],["g6",-0.7408,0.2728,2.25,0,30],["g6",-0.7336,0.2728,2.25,0,30],["g6",-0.7263,0.2728,2.25,0,30],["g7",-0.6789,0.2599,2.25,0,30],["g7",-0.6504,0.2599,2.25,0,30],["g7",-0.6218,0.2599,2.25,0,30],["g8",-0.6517,0.2361,2.25,0,30],["g8",-0.6009,0.2361,2.25,0,30],["g8",-0.5501,0.2361,2.25,0,30],["g4",-0.5,0.1864,2.25,0,30],["g4",-0.4492,0.1864,2.25,0,30],["g4",-0.3984,0.1864,2.25,0,30],["g5",-0.3565,0.2068,2.25,0,30],["g5",-0.3057,0.2068,2.25,0,30],["g5",-0.2549,0.2068,2.25,0,30],["g6",-0.1762,0.2728,2.25,0,30],["g6",-0.169,0.2728,2.25,0,30],["g6",-0.1617,0.2728,2.25,0,30],["g7",-0.1143,0.2599,2.25,0,30],["g7",-0.0858,0.2599,2.25,0,30],["g7",-0.0572,0.2599,2.25,0,30],["g7",-0.0694,0.2743,2.25,0.1164,40],["g7",-0.1005,0.3085,2.25,0.4072,40],["g7",-0.1414,0.3483,2.25,0.7854,40],["g7",-0.1809,0.383,2.25,1.1636,40],["g7",-0.2092,0.4069,2.25,1.4544,40],["g7",-0.2198,0.4159,2.25,1.5708,40],["k0",-0.1845,0.3932,1.479,0,40],["k0",-0.1845,0.4096,1.444,0,40],["k1",-0.2112,0.5109,1.246,0,40],["k1",-0.2112,0.5249,1.224,0,40],["k2",-0.1935,0.5879,1.153,0,40],["k2",-0.1935,0.6053,1.129,0,40],["k3",-0.1958,0.7222,0.976,0,40],["k3",-0.1958,0.7349,0.964,0,40],["k4",-0.1817,0.8071,0.899,0,40],["k4",-0.1817,0.8146,0.893,0,40],["k0",-0.1829,0.848,0.875,-0.0935,40],["k0",-0.1791,0.8514,0.858,-0.3165,40],["k0",-0.1748,0.8558,0.803,-0.5827,40],["k0",-0.1711,0.8597,0.727,-0.8056,40],["k0",-0.1696,0.8615,0.685,-0.8992,40],["g4",-0.1893,0.8669,0.699,0.6716,30],["g4",-0.1568,0.9059,0.686,0.6716,30],["g4",-0.1244,0.945,0.679,0.6716,30],["g5",-0.1115,0.9946,0.663,0.6716,30],["g5",-0.0791,1.0336,0.658,0.6716,30],["g5",-0.0466,1.0727,0.655,0.6716,30],["g6",-0.0334,1.1808,0.659,0.6716,30],["g6",-0.0288,1.1864,0.659,0.6716,30],["g6",-0.0241,1.192,0.658,0.6716,30],["g7",0.02,1.2124,0.662,0.6716,30],["g7",0.0382,1.2344,0.659,0.6716,30],["g7",0.0565,1.2564,0.657,0.6716,30],["g8",0.0438,1.2233,0.657,0.6716,30],["g8",0.0762,1.2624,0.653,0.6716,30],["g8",0.1087,1.3015,0.65,0.6716,30],["g4",0.1715,1.3012,0.643,0.6716,30],["g4",0.2039,1.3403,0.639,0.6716,30],["g4",0.2364,1.3794,0.635,0.6716,30],["g5",0.2492,1.4289,0.628,0.6716,30],["g5",0.282,1.4842,0.622,0.6232,30],["g5",0.3205,1.5729,0.607,0.4729,30],["g6",0.3873,1.727,0.588,0.2863,30],["g6",0.3997,1.7355,0.583,0.2606,30],["g6",0.4121,1.7435,0.579,0.2358,30],["g7",0.4663,1.7469,0.583,0.212,30],["g7",0.5126,1.7686,0.572,0.1323,30],["g7",0.5526,1.7822,0.565,0.0838,30],["g8",0.5267,1.7589,0.559,0.0748,30],["g8",0.5774,1.7638,0.564,0.0748,30],["g8",0.628,1.7684,0.563,0.0748,30],["g4",0.6817,1.7233,0.546,0.0748,30],["g4",0.7324,1.7276,0.534,0.0748,30],["g4",0.783,1.7316,0.517,0.0748,30],["h0",0.7939,1.7117,0.501,0.0,40],["h0",0.8071,1.7368,0.486,0.0011,40],["h0",0.8441,1.7605,0.452,0.0041,40],["h1",0.9116,1.8019,0.406,0.0088,40],["h1",0.9842,1.8217,0.272,0.0148,40],["h1",1.0686,1.8389,0.275,0.0218,40],["h2",1.1658,1.8423,0.293,0.0294,40],["h2",1.2622,1.8533,0.307,0.0374,40],["h2",1.3585,1.8607,0.321,0.0453,40],["h2",1.4509,1.864,0.335,0.053,40],["h3",1.4954,1.8693,0.344,0.0599,40],["h3",1.568,1.8631,0.354,0.0659,40],["h3",1.6247,1.8518,0.363,0.0706,40],["h4",1.7303,1.8691,0.368,0.0737,40],["h4",1.7435,1.853,0.37,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["t0",1.7252,1.8494,0.367,0.0748,240],["t1",1.7078,1.8355,0.363,0.0748,140],["t2",1.6541,1.7648,0.351,0.0748,140],["t3",1.6485,1.786,0.349,0.0748,140],["t4",1.6561,1.769,0.352,0.0748,120],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n5",1.656,1.7695,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["l0",1.6455,1.7737,0.349,0.0748,520],["l1",1.6613,1.7859,0.354,0.0748,240],["l2",1.6852,1.7944,0.366,0.0748,240],["l3",1.7078,1.7004,0.366,0.0748,280],["l4",1.7515,1.554,0.37,0.0748,450],["l5m",1.7299,1.5328,0.363,0.0748,600]],"idx":{"pick":197,"drop":218,"sleep":224}},"9":{"samples":[["g4",-4.4524,0.1864,2.25,0,30],["g4",-4.4016,0.1864,2.25,0,30],["g4",-4.3508,0.1864,2.25,0,30],["g5",-4.3088,0.2068,2.25,0,30],["g5",-4.258,0.2068,2.25,0,30],["g5",-4.2073,0.2068,2.25,0,30],["g6",-4.1286,0.2728,2.25,0,30],["g6",-4.1213,0.2728,2.25,0,30],["g6",-4.1141,0.2728,2.25,0,30],["g7",-4.0667,0.2599,2.25,0,30],["g7",-4.0381,0.2599,2.25,0,30],["g7",-4.0095,0.2599,2.25,0,30],["g8",-4.0395,0.2361,2.25,0,30],["g8",-3.9887,0.2361,2.25,0,30],["g8",-3.9379,0.2361,2.25,0,30],["g4",-3.8878,0.1864,2.25,0,30],["g4",-3.837,0.1864,2.25,0,30],["g4",-3.7862,0.1864,2.25,0,30],["g5",-3.7442,0.2068,2.25,0,30],["g5",-3.6934,0.2068,2.25,0,30],["g5",-3.6426,0.2068,2.25,0,30],["g6",-3.564,0.2728,2.25,0,30],["g6",-3.5567,0.2728,2.25,0,30],["g6",-3.5494,0.2728,2.25,0,30],["g7",-3.502,0.2599,2.25,0,30],["g7",-3.4735,0.2599,2.25,0,30],["g7",-3.4449,0.2599,2.25,0,30],["g8",-3.4748,0.2361,2.25,0,30],["g8",-3.424,0.2361,2.25,0,30],["g8",-3.3733,0.2361,2.25,0,30],["g4",-3.3231,0.1864,2.25,0,30],["g4",-3.2723,0.1864,2.25,0,30],["g4",-3.2216,0.1864,2.25,0,30],["g5",-3.1796,0.2068,2.25,0,30],["g5",-3.1288,0.2068,2.25,0,30],["g5",-3.078,0.2068,2.25,0,30],["g6",-2.9993,0.2728,2.25,0,30],["g6",-2.9921,0.2728,2.25,0,30],["g6",-2.9848,0.2728,2.25,0,30],["g7",-2.9374,0.2599,2.25,0,30],["g7",-2.9089,0.2599,2.25,0,30],["g7",-2.8803,0.2599,2.25,0,30],["g8",-2.9102,0.2361,2.25,0,30],["g8",-2.8594,0.2361,2.25,0,30],["g8",-2.8086,0.2361,2.25,0,30],["g4",-2.7585,0.1864,2.25,0,30],["g4",-2.7077,0.1864,2.25,0,30],["g4",-2.6569,0.1864,2.25,0,30],["g5",-2.615,0.2068,2.25,0,30],["g5",-2.5642,0.2068,2.25,0,30],["g5",-2.5134,0.2068,2.25,0,30],["g6",-2.4347,0.2728,2.25,0,30],["g6",-2.4275,0.2728,2.25,0,30],["g6",-2.4202,0.2728,2.25,0,30],["g7",-2.3728,0.2599,2.25,0,30],["g7",-2.3442,0.2599,2.25,0,30],["g7",-2.3157,0.2599,2.25,0,30],["g8",-2.3456,0.2361,2.25,0,30],["g8",-2.2948,0.2361,2.25,0,30],["g8",-2.244,0.2361,2.25,0,30],["g4",-2.1939,0.1864,2.25,0,30],["g4",-2.1431,0.1864,2.25,0,30],["g4",-2.0923,0.1864,2.25,0,30],["g5",-2.0504,0.2068,2.25,0,30],["g5",-1.9996,0.2068,2.25,0,30],["g5",-1.9488,0.2068,2.25,0,30],["g6",-1.8701,0.2728,2.25,0,30],["g6",-1.8628,0.2728,2.25,0,30],["g6",-1.8556,0.2728,2.25,0,30],["g7",-1.8082,0.2599,2.25,0,30],["g7",-1.7796,0.2599,2.25,0,30],["g7",-1.751,0.2599,2.25,0,30],["g8",-1.781,0.2361,2.25,0,30],["g8",-1.7302,0.2361,2.25,0,30],["g8",-1.6794,0.2361,2.25,0,30],["g4",-1.6293,0.1864,2.25,0,30],["g4",-1.5785,0.1864,2.25,0,30],["g4",-1.5277,0.1864,2.25,0,30],["g5",-1.4857,0.2068,2.25,0,30],["g5",-1.4349,0.2068,2.25,0,30],["g5",-1.3842,0.2068,2.25,0,30],["g6",-1.3055,0.2728,2.25,0,30],["g6",-1.2982,0.2728,2.25,0,30],["g6",-1.291,0.2728,2.25,0,30],["g7",-1.2436,0.2599,2.25,0,30],["g7",-1.215,0.2599,2.25,0,30],["g7",-1.1864,0.2599,2.25,0,30],["g8",-1.2164,0.2361,2.25,0,30],["g8",-1.1656,0.2361,2.25,0,30],["g8",-1.1148,0.2361,2.25,0,30],["g4",-1.0647,0.1864,2.25,0,30],["g4",-1.0139,0.1864,2.25,0,30],["g4",-0.9631,0.1864,2.25,0,30],["g5",-0.9211,0.2068,2.25,0,30],["g5",-0.8703,0.2068,2.25,0,30],["g5",-0.8195,0.2068,2.25,0,30],["g6",-0.7408,0.2728,2.25,0,30],["g6",-0.7336,0.2728,2.25,0,30],["g6",-0.7263,0.2728,2.25,0,30],["g7",-0.6789,0.2599,2.25,0,30],["g7",-0.6504,0.2599,2.25,0,30],["g7",-0.6218,0.2599,2.25,0,30],["g8",-0.6517,0.2361,2.25,0,30],["g8",-0.6009,0.2361,2.25,0,30],["g8",-0.5812,0.2472,2.25,0.1164,40],["g8",-0.5309,0.2747,2.25,0.4072,40],["g8",-0.4635,0.3099,2.25,0.7854,40],["g8",-0.3937,0.3454,2.25,1.1636,40],["g8",-0.3386,0.3734,2.25,1.4544,40],["g8",-0.3163,0.3848,2.25,1.5708,40],["k0",-0.3027,0.3932,1.757,0,40],["k0",-0.3027,0.4096,1.715,0,40],["k1",-0.3294,0.5109,1.474,0,40],["k1",-0.3294,0.5249,1.447,0,40],["k2",-0.3117,0.5879,1.36,0,40],["k2",-0.3117,0.6053,1.331,0,40],["k3",-0.314,0.7222,1.142,0,40],["k3",-0.314,0.7349,1.127,0,40],["k4",-0.2999,0.8071,1.047,0,40],["k4",-0.2999,0.8146,1.04,0,40],["k0",-0.3009,0.8478,1.015,-0.1038,40],["k0",-0.297,0.8507,0.988,-0.3513,40],["k0",-0.2924,0.8545,0.909,-0.6467,40],["k0",-0.2885,0.858,0.801,-0.8942,40],["k0",-0.2868,0.8596,0.795,-0.998,40],["g4",-0.3059,0.867,0.801,0.5728,30],["g4",-0.2684,0.9013,0.797,0.5728,30],["g4",-0.231,0.9356,0.793,0.5728,30],["g5",-0.212,0.9823,0.78,0.5728,30],["g5",-0.1746,1.0166,0.778,0.5728,30],["g5",-0.1372,1.0509,0.776,0.5728,30],["g6",-0.112,1.1558,0.78,0.5728,30],["g6",-0.1067,1.1607,0.78,0.5728,30],["g6",-0.1013,1.1656,0.78,0.5728,30],["g7",-0.0553,1.1814,0.783,0.5728,30],["g7",-0.0342,1.2007,0.781,0.5728,30],["g7",-0.0131,1.22,0.779,0.5728,30],["g8",-0.0283,1.1876,0.779,0.5728,30],["g8",0.0091,1.2219,0.775,0.5728,30],["g8",0.0466,1.2562,0.773,0.5728,30],["g4",0.1103,1.2485,0.765,0.5728,30],["g4",0.1478,1.2828,0.764,0.5728,30],["g4",0.1852,1.3171,0.761,0.5728,30],["g5",0.2042,1.3638,0.753,0.5728,30],["g5",0.2416,1.3981,0.75,0.5728,30],["g5",0.2791,1.4324,0.748,0.5728,30],["g6",0.3042,1.5373,0.752,0.5728,30],["g6",0.3095,1.5422,0.752,0.5728,30],["g6",0.3149,1.5471,0.751,0.5728,30],["g7",0.361,1.5629,0.747,0.5728,30],["g7",0.3824,1.5832,0.743,0.5697,30],["g7",0.4074,1.6125,0.738,0.5365,30],["g8",0.3956,1.602,0.74,0.4749,30],["g8",0.4507,1.6843,0.72,0.3267,30],["g8",0.5258,1.7345,0.699,0.1776,30],["g4",0.5987,1.7155,0.679,0.084,30],["g4",0.6509,1.7222,0.672,0.0748,30],["g4",0.7016,1.7262,0.666,0.0748,30],["g5",0.7419,1.7498,0.638,0.0748,30],["g5",0.7925,1.7535,0.622,0.0748,30],["h0",0.8131,1.7187,0.625,0.0,40],["h0",0.826,1.7437,0.613,0.0011,40],["h0",0.8622,1.7671,0.586,0.0041,40],["h1",0.9286,1.8081,0.549,0.0088,40],["h1",0.9995,1.8273,0.468,0.0148,40],["h1",1.0822,1.8439,0.387,0.0218,40],["h2",1.1775,1.8465,0.294,0.0294,40],["h2",1.2718,1.8568,0.308,0.0374,40],["h2",1.3661,1.8635,0.323,0.0453,40],["h2",1.4565,1.8661,0.336,0.053,40],["h3",1.4992,1.8707,0.344,0.0599,40],["h3",1.5702,1.8639,0.355,0.0659,40],["h3",1.6257,1.8522,0.363,0.0706,40],["h4",1.7306,1.8692,0.368,0.0737,40],["h4",1.7435,1.853,0.37,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["t0",1.7252,1.8494,0.367,0.0748,240],["t1",1.7078,1.8355,0.363,0.0748,140],["t2",1.6541,1.7648,0.351,0.0748,140],["t3",1.6485,1.786,0.349,0.0748,140],["t4",1.6561,1.769,0.352,0.0748,120],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n5",1.656,1.7695,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["l0",1.6455,1.7737,0.349,0.0748,520],["l1",1.6613,1.7859,0.354,0.0748,240],["l2",1.6852,1.7944,0.366,0.0748,240],["l3",1.7078,1.7004,0.366,0.0748,280],["l4",1.7515,1.554,0.37,0.0748,450],["l5m",1.7299,1.5328,0.363,0.0748,600]],"idx":{"pick":186,"drop":207,"sleep":213}},"10":{"samples":[["g4",-4.4524,0.1864,2.25,0,30],["g4",-4.4016,0.1864,2.25,0,30],["g4",-4.3508,0.1864,2.25,0,30],["g5",-4.3088,0.2068,2.25,0,30],["g5",-4.258,0.2068,2.25,0,30],["g5",-4.2073,0.2068,2.25,0,30],["g6",-4.1286,0.2728,2.25,0,30],["g6",-4.1213,0.2728,2.25,0,30],["g6",-4.1141,0.2728,2.25,0,30],["g7",-4.0667,0.2599,2.25,0,30],["g7",-4.0381,0.2599,2.25,0,30],["g7",-4.0095,0.2599,2.25,0,30],["g8",-4.0395,0.2361,2.25,0,30],["g8",-3.9887,0.2361,2.25,0,30],["g8",-3.9379,0.2361,2.25,0,30],["g4",-3.8878,0.1864,2.25,0,30],["g4",-3.837,0.1864,2.25,0,30],["g4",-3.7862,0.1864,2.25,0,30],["g5",-3.7442,0.2068,2.25,0,30],["g5",-3.6934,0.2068,2.25,0,30],["g5",-3.6426,0.2068,2.25,0,30],["g6",-3.564,0.2728,2.25,0,30],["g6",-3.5567,0.2728,2.25,0,30],["g6",-3.5494,0.2728,2.25,0,30],["g7",-3.502,0.2599,2.25,0,30],["g7",-3.4735,0.2599,2.25,0,30],["g7",-3.4449,0.2599,2.25,0,30],["g8",-3.4748,0.2361,2.25,0,30],["g8",-3.424,0.2361,2.25,0,30],["g8",-3.3733,0.2361,2.25,0,30],["g4",-3.3231,0.1864,2.25,0,30],["g4",-3.2723,0.1864,2.25,0,30],["g4",-3.2216,0.1864,2.25,0,30],["g5",-3.1796,0.2068,2.25,0,30],["g5",-3.1288,0.2068,2.25,0,30],["g5",-3.078,0.2068,2.25,0,30],["g6",-2.9993,0.2728,2.25,0,30],["g6",-2.9921,0.2728,2.25,0,30],["g6",-2.9848,0.2728,2.25,0,30],["g7",-2.9374,0.2599,2.25,0,30],["g7",-2.9089,0.2599,2.25,0,30],["g7",-2.8803,0.2599,2.25,0,30],["g8",-2.9102,0.2361,2.25,0,30],["g8",-2.8594,0.2361,2.25,0,30],["g8",-2.8086,0.2361,2.25,0,30],["g4",-2.7585,0.1864,2.25,0,30],["g4",-2.7077,0.1864,2.25,0,30],["g4",-2.6569,0.1864,2.25,0,30],["g5",-2.615,0.2068,2.25,0,30],["g5",-2.5642,0.2068,2.25,0,30],["g5",-2.5134,0.2068,2.25,0,30],["g6",-2.4347,0.2728,2.25,0,30],["g6",-2.4275,0.2728,2.25,0,30],["g6",-2.4202,0.2728,2.25,0,30],["g7",-2.3728,0.2599,2.25,0,30],["g7",-2.3442,0.2599,2.25,0,30],["g7",-2.3157,0.2599,2.25,0,30],["g8",-2.3456,0.2361,2.25,0,30],["g8",-2.2948,0.2361,2.25,0,30],["g8",-2.244,0.2361,2.25,0,30],["g4",-2.1939,0.1864,2.25,0,30],["g4",-2.1431,0.1864,2.25,0,30],["g4",-2.0923,0.1864,2.25,0,30],["g5",-2.0504,0.2068,2.25,0,30],["g5",-1.9996,0.2068,2.25,0,30],["g5",-1.9488,0.2068,2.25,0,30],["g6",-1.8701,0.2728,2.25,0,30],["g6",-1.8628,0.2728,2.25,0,30],["g6",-1.8556,0.2728,2.25,0,30],["g7",-1.8082,0.2599,2.25,0,30],["g7",-1.7796,0.2599,2.25,0,30],["g7",-1.751,0.2599,2.25,0,30],["g8",-1.781,0.2361,2.25,0,30],["g8",-1.7302,0.2361,2.25,0,30],["g8",-1.6794,0.2361,2.25,0,30],["g4",-1.6293,0.1864,2.25,0,30],["g4",-1.5785,0.1864,2.25,0,30],["g4",-1.5277,0.1864,2.25,0,30],["g5",-1.4857,0.2068,2.25,0,30],["g5",-1.4349,0.2068,2.25,0,30],["g5",-1.3842,0.2068,2.25,0,30],["g6",-1.3055,0.2728,2.25,0,30],["g6",-1.2982,0.2728,2.25,0,30],["g6",-1.291,0.2728,2.25,0,30],["g7",-1.2436,0.2599,2.25,0,30],["g7",-1.215,0.2599,2.25,0,30],["g7",-1.1864,0.2599,2.25,0,30],["g8",-1.2164,0.2361,2.25,0,30],["g8",-1.1656,0.2361,2.25,0,30],["g8",-1.1148,0.2361,2.25,0,30],["g4",-1.0647,0.1864,2.25,0,30],["g4",-1.0139,0.1864,2.25,0,30],["g4",-0.9631,0.1864,2.25,0,30],["g5",-0.9211,0.2068,2.25,0,30],["g5",-0.8703,0.2068,2.25,0,30],["g5",-0.8195,0.2068,2.25,0,30],["g6",-0.7408,0.2728,2.25,0,30],["g6",-0.7336,0.2728,2.25,0,30],["g6",-0.7263,0.2728,2.25,0,30],["g7",-0.6789,0.2599,2.25,0,30],["g7",-0.6504,0.2599,2.25,0,30],["g7",-0.6218,0.2599,2.25,0,30],["g7",-0.6108,0.2743,2.25,0.1164,40],["g7",-0.5839,0.3085,2.25,0.4072,40],["g7",-0.5493,0.3483,2.25,0.7854,40],["g7",-0.5133,0.383,2.25,1.1636,40],["g7",-0.4836,0.4069,2.25,1.4544,40],["g7",-0.471,0.4159,2.25,1.5708,40],["k0",-0.4356,0.3932,2.013,0,40],["k0",-0.4356,0.4096,1.964,0,40],["k1",-0.4624,0.5109,1.68,0,40],["k1",-0.4624,0.5249,1.648,0,40],["k2",-0.4447,0.5879,1.545,0,40],["k2",-0.4447,0.6053,1.511,0,40],["k3",-0.4469,0.7222,1.287,0,40],["k3",-0.4469,0.7349,1.268,0,40],["k4",-0.4329,0.8071,1.174,0,40],["k4",-0.4329,0.8146,1.164,0,40],["k0",-0.4338,0.8476,1.134,-0.1119,40],["k0",-0.4297,0.85,1.096,-0.3788,40],["k0",-0.425,0.8534,0.99,-0.6972,40],["k0",-0.4209,0.8567,0.882,-0.9641,40],["k0",-0.4192,0.8581,0.902,-1.076,40],["g4",-0.4376,0.8669,0.906,0.4948,30],["g4",-0.3968,0.8971,0.905,0.4948,30],["g4",-0.3559,0.9273,0.903,0.4948,30],["g5",-0.3325,0.9712,0.891,0.4948,30],["g5",-0.2917,1.0014,0.89,0.4948,30],["g5",-0.2508,1.0316,0.887,0.4948,30],["g6",-0.2168,1.1331,0.892,0.4948,30],["g6",-0.211,1.1374,0.891,0.4948,30],["g6",-0.2051,1.1418,0.891,0.4948,30],["g7",-0.1578,1.1538,0.895,0.4948,30],["g7",-0.1348,1.1707,0.893,0.4948,30],["g7",-0.1119,1.1877,0.891,0.4948,30],["g8",-0.1291,1.156,0.891,0.4948,30],["g8",-0.0882,1.1862,0.888,0.4948,30],["g8",-0.0474,1.2164,0.886,0.4948,30],["g4",0.0164,1.2025,0.879,0.4948,30],["g4",0.0573,1.2327,0.877,0.4948,30],["g4",0.0981,1.2629,0.874,0.4948,30],["g5",0.1215,1.3068,0.866,0.4948,30],["g5",0.1624,1.337,0.865,0.4948,30],["g5",0.2032,1.3672,0.864,0.4948,30],["g6",0.2373,1.4687,0.867,0.4948,30],["g6",0.2431,1.473,0.867,0.4948,30],["g6",0.2489,1.4774,0.867,0.4948,30],["g7",0.2962,1.4894,0.868,0.4948,30],["g7",0.3192,1.5063,0.866,0.4948,30],["g7",0.3422,1.5233,0.864,0.4948,30],["g8",0.325,1.4916,0.867,0.4948,30],["g8",0.3658,1.5218,0.864,0.4948,30],["g8",0.4067,1.552,0.86,0.4948,30],["g4",0.471,1.5417,0.853,0.4834,30],["g4",0.517,1.5979,0.84,0.3987,30],["g4",0.5707,1.6636,0.821,0.2712,30],["g5",0.6255,1.7216,0.794,0.1485,30],["g5",0.6885,1.7453,0.766,0.0785,30],["g5",0.7398,1.75,0.756,0.0748,30],["g6",0.8134,1.8215,0.74,0.0748,30],["h0",0.8197,1.7935,0.719,0.0,40],["h0",0.8326,1.8174,0.699,0.0011,40],["h0",0.8685,1.8378,0.669,0.0041,40],["h1",0.9344,1.8741,0.651,0.0088,40],["h1",1.0049,1.8873,0.618,0.0148,40],["h1",1.0869,1.8969,0.564,0.0218,40],["h2",1.1815,1.8919,0.47,0.0294,40],["h2",1.2751,1.8942,0.312,0.0374,40],["h2",1.3687,1.8929,0.323,0.0453,40],["h2",1.4584,1.8879,0.336,0.053,40],["h3",1.5005,1.8855,0.344,0.0599,40],["h3",1.571,1.8728,0.355,0.0659,40],["h3",1.6261,1.8564,0.363,0.0706,40],["h4",1.7307,1.8703,0.368,0.0737,40],["h4",1.7435,1.853,0.37,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["h4",1.727,1.8524,0.368,0.0748,40],["t0",1.7252,1.8494,0.367,0.0748,240],["t1",1.7078,1.8355,0.363,0.0748,140],["t2",1.6541,1.7648,0.351,0.0748,140],["t3",1.6485,1.786,0.349,0.0748,140],["t4",1.6561,1.769,0.352,0.0748,120],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n2",1.664,1.7719,0.351,0.0748,170],["n3",1.6665,1.7694,0.351,0.0748,170],["n1",1.6694,1.7655,0.352,0.0748,170],["n4",1.6553,1.7704,0.351,0.0748,170],["n5",1.656,1.7695,0.352,0.0748,170],["n0",1.6556,1.769,0.352,0.0748,170],["l0",1.6455,1.7737,0.349,0.0748,520],["l1",1.6613,1.7859,0.354,0.0748,240],["l2",1.6852,1.7944,0.366,0.0748,240],["l3",1.7078,1.7004,0.366,0.0748,280],["l4",1.7515,1.554,0.37,0.0748,450],["l5m",1.7299,1.5328,0.363,0.0748,600]],"idx":{"pick":186,"drop":207,"sleep":213}}};
const SEQIMG = {"g4": __img("66dd306a10.webp"), "g5": __img("d33352d023.webp"), "g6": __img("bc6d8f9d35.webp"), "g7": __img("51afc7a8d0.webp"), "g8": __img("fb8c0a9916.webp"), "k0": __img("9925660ebe.webp"), "k1": __img("1d6e164ff0.webp"), "k2": __img("15d8a2e9e3.webp"), "k3": __img("ae34ff7657.webp"), "k4": __img("c83275e74f.webp"), "h0": __img("4b9ab31171.webp"), "h1": __img("632c7caf58.webp"), "h2": __img("b712795ee2.webp"), "h3": __img("6bf27420a8.webp"), "h4": __img("43d116f8db.webp"), "t0": __img("7164ca094a.webp"), "t1": __img("fcae8ad8f5.webp"), "t2": __img("c5268a1559.webp"), "t3": __img("9933bbcc10.webp"), "t4": __img("3b55868e37.webp"), "n0": __img("378601e019.webp"), "n1": __img("1c30e00d79.webp"), "n2": __img("1fbe1e1ea3.webp"), "n3": __img("4e297f1e62.webp"), "n4": __img("1f3a75de1c.webp"), "n5": __img("74546933cd.webp"), "l0": __img("063c3bbc4e.webp"), "l1": __img("fb15886261.webp"), "l2": __img("400bc71408.webp"), "l3": __img("d19dd321a5.webp"), "l4": __img("449cfd5c85.webp"), "l5m": __img("161f4d5c4d.webp"), "eichel": __img("115417fc97.webp")};
const STAGE_R = new V(Math.cos(AZ0), 0, -Math.sin(AZ0)), STAGE_U = new V(0, 1, 0), STAGE_D = new V(Math.sin(AZ0), 0, Math.cos(AZ0));
const STAGE_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(STAGE_R, STAGE_U, STAGE_D));
function depthPlace(obj, ref, base, zd) {
  const c = camera.position, d = ref.clone().sub(c), den = d.dot(STAGE_D);
  const t = Math.abs(den) > 1e-6 ? Math.max(0.05, (zd - c.dot(STAGE_D)) / den) : 1;
  obj.position.copy(c).addScaledVector(d, t); obj.scale.copy(base).multiplyScalar(t);
}
function stageToWorld(x, y, z) { return new V().addScaledVector(STAGE_R, x).addScaledVector(STAGE_U, y).addScaledVector(STAGE_D, z); }
const seqPlayer = (() => {
  const loader = new THREE.TextureLoader(), tex = {};
  for (const k in SEQIMG) { const t = loader.load(SEQIMG[k]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; tex[k] = t; }
  const mk = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex.k0, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthTest: true, depthWrite: false, toneMapped: false }));
    m.material.color.setScalar(0.94); m.renderOrder = 22; m.visible = false; scene.add(m); return m; };
  const spr = mk(), nut = mk(); nut.material.map = tex.eichel; nut.renderOrder = 23;
  let S, start, TOTAL, tPick, tDrop;
  function useSeq(st) {   // Abfolge der aktuellen Baumstufe
    const q = SEQS[st] || SEQ; S = q.samples; start = []; let acc = 0;
    for (const s of S) { start.push(acc); acc += s[5]; }
    TOTAL = acc; tPick = start[q.idx.pick]; tDrop = start[q.idx.drop];
  }
  useSeq(10);
  let t0 = -1, nutState = 'rest', nutP = null, playing = false;
  const q = new THREE.Quaternion(), zA = new V(0, 0, 1);
  // Das Bild sieht immer so aus, als läge es in der Bühnenebene (ZREF); für die Verdeckung wird es entlang der
  // Sichtstrahlen auf seine echte Tiefe z geschoben und dabei passend skaliert (gleich großes Bild, richtige Tiefe).
  function setQuad(m, key, x, y, z, rot, scale = 1) {
    const f = SEQ.frames[key]; m.material.map = tex[key];
    m.userData.ref = stageToWorld(x, y, SEQ.zref); m.userData.x = x; m.userData.zd = z;
    m.userData.base = new V(f.w * scale, f.h * scale, 1);
    m.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, rot));
  }
  function late() { for (const m of [spr, nut]) if (m.visible && m.userData.ref) depthPlace(m, m.userData.ref, m.userData.base, m.userData.zd); }
  const A = SEQ.acorn;
  function restNut() { setQuad(nut, 'eichel', A.rest[0], A.rest[1], A.z, SEQ.sleep.rot); }
  function groundNut(p) { setQuad(nut, 'eichel', p.x, p.y, p.zd ?? SEQ.zref, p.a, A.dropScale); }
  // Eichel nach dem Fallen: liegt im Gras
  let nutGround = null;
  function play() { if (reduceMotion) return; useSeq(Math.min(10, Math.max(6, Math.round(P)))); t0 = performance.now(); playing = true; nutGround = null; }
  function active() { return t0 >= 0; }
  function frame(dt) {
    const show = P > 5.95 && season !== 'winter';
    if (!show) { spr.visible = nut.visible = false; return; }
    if (t0 < 0) {   // keine Abfolge: Eichel liegt (falls schon gefallen) im Gras
      spr.visible = false; nut.visible = !!nutGround; if (nutGround) groundNut(nutGround); return;
    }
    const t = window.__seqFix != null ? window.__seqFix : performance.now() - t0 - 1500;   // erst heranzoomen, dann kommt es angelaufen
    if (t < 0) { spr.visible = false; restNut(); nut.visible = true; playing = true; return; }
    if (t >= TOTAL) { spr.visible = false; playing = false; if (nutGround) { groundNut(nutGround); nut.visible = true; } if (t >= TOTAL + 2600 && window.__seqFix == null) t0 = -1; return; }
    playing = true;
    let i = 0, lo = 0, hi = S.length - 1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (start[m] <= t) { i = m; lo = m + 1; } else hi = m - 1; }
    const s = S[i];
    setQuad(spr, s[0], s[1], s[2], s[3], s[4]); spr.visible = true;
    // Eichel: liegt auf dem Ast, bis sie aufgehoben wird; fällt beim Hinlegen aus den Pfoten ins Gras
    if (t < tPick) { restNut(); nut.visible = true; }
    else if (t < tDrop) nut.visible = false;
    else {
      const u = (t - tDrop) / 1000;
      // einfache Wurfbahn mit einem kleinen Aufprall im Gras
      const g = 5.5, vx = 0.22, vy = 0.35, y0 = A.drop[1], floor = 0.035;
      const tHit = (vy + Math.sqrt(vy * vy + 2 * g * (y0 - floor))) / g;
      let x, y, a;
      if (u < tHit) { x = A.drop[0] + vx * u; y = y0 + vy * u - g * u * u / 2; a = A.dropAng * Math.PI / 180 - 4.0 * u; }
      else {
        const v2 = 0.25 * g * tHit - vy * 0.25, u2 = u - tHit, t2 = 2 * v2 / g;
        x = A.drop[0] + vx * tHit + 0.08 * Math.min(u2, t2 + 0.6);
        y = floor + (u2 < t2 ? v2 * u2 - g * u2 * u2 / 2 : 0);
        const aHit = A.dropAng * Math.PI / 180 - 4.0 * tHit; a = aHit - 1.6 * Math.min(u2, t2 + 0.3);
      }
      const zd = A.z + Math.min(0.9, u * 1.2);
      nutGround = { x, y, zd, a }; groundNut(nutGround); nut.visible = true;
    }
  }
  return { play, frame, late, active, get playing() { return t0 >= 0 && playing; }, get total() { return TOTAL; }, sprite: spr, nut };
})();
window.__seqActive = () => seqPlayer.playing;
window.__sqLate = () => { seqPlayer.late(); squirrel.late(); winterFx.late(); };
// Fenster im Laub vor Wohnast und Liegeplatz
// Laubfenster nur, solange die Kamera nah dran ist (sonst hängen riesige Blätter direkt vor der Linse)
let leafWin = false;
function setLeafWindow(on) {
  if (on === leafWin) return; leafWin = on;
  leafClear = on ? { p: stageToWorld(0.6, 1.7, 0.3), dir: STAGE_D.clone(), r: 2.6, front: 0.2 } : null;
  Tshown = -1;
}
// Kamera während der Abfolge: nah heran, folgt dem Eichhörnchen sanft, am Ende zurück
const seqCam = { k: 0, x: -1.2 };
const zoom = { user: 1, userNow: 1, seq: 1, seqNow: 1 };
if (OPT.zoom) zoom.user = zoom.userNow = OPT.zoom;
function zoomBy(f) {
  if (seqPlayer.active()) zoom.seq = Math.min(2.4, Math.max(0.4, zoom.seq * f));
  else zoom.user = Math.min(__zoomMax, Math.max(0.2, zoom.user * f));
}
renderer.domElement.addEventListener('wheel', (e) => { if (OPT.page && !e.ctrlKey) return; e.preventDefault(); zoomBy(Math.exp(e.deltaY * (e.deltaMode ? 0.04 : 0.0012))); }, { passive: false });
{ let pinch = 0;
  const dist2 = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  renderer.domElement.addEventListener('touchstart', (e) => { if (e.touches.length === 2) pinch = dist2(e.touches); }, { passive: true });
  renderer.domElement.addEventListener('touchmove', (e) => { if (e.touches.length === 2 && pinch > 0) { const d2 = dist2(e.touches); zoomBy(pinch / d2); pinch = d2; e.preventDefault(); } }, { passive: false });
  renderer.domElement.addEventListener('touchend', () => { pinch = 0; }, { passive: true });
}
window.__zoom = zoom;

// Heranzoomen zum Bewohner (bei neuer Stufe oder per Knopf)
let sqZoom = null; const camSave = new V(), quatSave = new THREE.Quaternion();
function focusSquirrel() { if (squirrel.group.visible) sqZoom = { t0: performance.now(), dur: window.__sqDur || (reduceMotion ? 2500 : 6500) }; }
window.__sqFrame = (dt, t) => {
  seqPlayer.frame(dt);      // zuerst: entscheidet, ob das Schlafbild schon sichtbar ist (kein Flackern beim Wechsel)
  squirrel.frame(dt, t);
  camSave.copy(camera.position); quatSave.copy(camera.quaternion);
  // Abfolge: Kamera nah an Stamm und Ast
  const want = seqPlayer.active() ? 1 : 0;
  seqCam.k += (want - seqCam.k) * Math.min(1, dt * (want ? 1.6 : 1.1));
  visitCamFrame(dt);
  setLeafWindow(seqCam.k > 0.03 || !!sqZoom || visitCam.k > 0.03);
  if (seqCam.k > 0.002) {
    if (seqPlayer.active() && seqPlayer.sprite.visible) {
      const sx = seqPlayer.sprite.userData.x ?? -2;
      const aim = Math.min(1.15, Math.max(-1.6, sx + 0.35));
      seqCam.x += (aim - seqCam.x) * Math.min(1, dt * 1.2);
      if (window.__seqFix != null) { seqCam.x = aim; seqCam.k = 1; }
    }
    const el = 0.10, D = (window.__seqD || 5.6) * zoom.seqNow;
    const azNow = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    const dir = new V(Math.sin(azNow) * Math.cos(el), Math.sin(el), Math.cos(azNow) * Math.cos(el));
    const tgt = stageToWorld(seqCam.x, 0.95 + 0.35 * Math.min(1, Math.max(0, (seqCam.x + 0.5) / 1.2)), 0);
    const k = seqCam.k * seqCam.k * (3 - 2 * seqCam.k) * 0.45;   // Einzug: Kamera nur leicht heran (Nutzer 23.10.)
    camera.position.lerp(tgt.clone().addScaledVector(dir, D), k);
    camera.lookAt(controls.target.clone().lerp(tgt, k));
  }
  if (!sqZoom) return;
  const e = (performance.now() - sqZoom.t0) / sqZoom.dur;
  if (e >= 1) { sqZoom = null; return; }
  const ease = (x) => x * x * (3 - 2 * x);
  const k = e < 0.25 ? ease(e / 0.25) : e > 0.75 ? ease((1 - e) / 0.25) : 1;
  const target = (squirrel.group.userData.ref || squirrel.group.position).clone().add(new V(0, 0.05, 0));
  const dir = new V(Math.sin(AZ0 + 0.12), 0.16, Math.cos(AZ0 + 0.12)).normalize();   // immer aus der vorderen, freien Richtung
  const near = target.clone().addScaledVector(dir, 3.0);
  camera.position.lerp(near, k);
  const look = controls.target.clone().lerp(target, k);
  camera.lookAt(look);
};
window.__sqAfter = () => { camera.position.copy(camSave); camera.quaternion.copy(quatSave); };

// ------------------------------------------------------------------ Qualitätsstufen (automatisch nach fps)
const QUALITY = [
  // Schärfe zuletzt opfern: erst Schatten, Blattzahl, Relief – Pixeldichte nie unter 1,25
  { lambert: false, px: 2.0,  leafRecv: true,  leafCast: true,  shadows: true,  map: 2048, relief: 1, dens: 1.0,  shadowEvery: 1 },
  { lambert: true, px: 2.0,  leafRecv: false, leafCast: true,  shadows: true,  map: 1024, relief: 1, dens: 1.0,  shadowEvery: 4 },
  { lambert: true, px: 1.75, leafRecv: false, leafCast: true,  shadows: true,  map: 1024, relief: 0, dens: 0.75, shadowEvery: 6 },
  { lambert: true, px: 1.5,  leafRecv: false, leafCast: false, shadows: true,  map: 1024, relief: 0, dens: 0.6,  shadowEvery: 8 },
  { lambert: true, px: 1.25, leafRecv: false, leafCast: false, shadows: false, map: 1024, relief: 0, dens: 0.5,  shadowEvery: 8 },
];
let qLevel = 0, leafScaleBase = 1;
function applyLeafQuality() {
  const q = QUALITY[qLevel], sd = 1 - 0.22 * springK;
  leafUniforms.uDensity.value = sd * q.dens;
  leafUniforms.uLeafScale.value = leafScaleBase / Math.sqrt(q.dens);   // weniger, dafür größere Blätter: Krone bleibt dicht
}
function saveQ() { try { localStorage.setItem('vanamoBaumQ4', String(qLevel)); } catch (e) {} }
function setQuality(l) {
  qLevel = l; const q = QUALITY[l];
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.px, MAX_DPR));
  renderer.setSize(W(), H());
  const lm = q.lambert ? leafMats.lam : leafMats.std;
  if (leafMesh.material !== lm) leafMesh.material = lm;
  if (leafMesh.receiveShadow !== q.leafRecv) { leafMesh.receiveShadow = q.leafRecv; leafMats.std.needsUpdate = leafMats.lam.needsUpdate = true; }
  leafMesh.castShadow = q.leafCast;
  if (renderer.shadowMap.enabled !== q.shadows) {
    renderer.shadowMap.enabled = q.shadows;
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  }
  if (sun.shadow.mapSize.x !== q.map) { sun.shadow.mapSize.set(q.map, q.map); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  tubeUniforms.uRelief.value = q.relief;
  meadow.geometry.instanceCount = meadowCount(q.dens);
  applyLeafQuality();
  shadowDirty = true;
}


// ------------------------------------------------------------------ Stufenübergang (Schritt 2)
// Ablauf: Windstoß (~1 s) -> Baum wächst fließend zur Zielstufe (Kamera fährt mit) -> Blätter segeln herab / Schnee rieselt
const stageFx = (() => {
  // fallende Blätter: einzelne gewölbte Blätter (gleiche Form und Farben wie die jungen Blätter)
  const NL = 220;
  // eigene Blattform mit hellem, neutralem Verlauf; die Farbe kommt je Blatt aus der Jahreszeit
  const fallGeo = youngLeafGeo.clone();
  { const pa = fallGeo.getAttribute('position'), col = new Float32Array(pa.count * 3);
    for (let k = 0; k < pa.count; k++) { const u = Math.floor(k / 7) / 10, v = (k % 7) / 6 * 2 - 1;
      const l = 0.72 + 0.28 * Math.pow(u, 0.8) * (1 - 0.35 * Math.abs(v)) + Math.max(0, 1 - Math.abs(v) * 7) * 0.12;
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = Math.min(1, l); }
    fallGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const FALL_COLS = { fruehling: ['#9fcf5a', '#b6da6a', '#8cc04c'], sommer: ['#b4c44e', '#c9c45a', '#9cba48', '#d6be5c'],
    herbst: ['#d9601e', '#eb9a2a', '#c8401a', '#f2bf3e', '#b5562a'] };
  const lmat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 });
  const lmesh = new THREE.InstancedMesh(fallGeo, lmat, NL); lmesh.setColorAt(0, new THREE.Color()); lmesh.count = 0; lmesh.frustumCulled = false; scene.add(lmesh);
  // Schnee: weiche Flocken
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sg2 = sc.getContext('2d');
  const gr = sg2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.42, 'rgba(250,252,255,1)'); gr.addColorStop(0.62, 'rgba(175,188,208,.6)'); gr.addColorStop(1, 'rgba(175,188,208,0)');   // feiner bläulicher Rand: auch vor hellem Grund sichtbar
  sg2.fillStyle = gr; sg2.fillRect(0, 0, 64, 64);
  const NS = 320, sgeo = new THREE.BufferGeometry(), spos = new Float32Array(NS * 3).fill(-99);
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const smat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(sc), size: 0.07, transparent: true, depthWrite: false, color: 0xffffff, toneMapped: false });
  const snow = new THREE.Points(sgeo, smat); snow.frustumCulled = false; snow.visible = false; snow.renderOrder = 3; scene.add(snow);
  let leaves = [], flakes = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), sv = new V();
  function spots(n, high) {     // Startpunkte: sichtbares Laub bzw. (Winter) Äste im oberen Teil der Krone
    // nur vorn am Kronenrand (zur Kamera hin), damit man sie gleich sieht und sie nicht im Laub verschwinden
    const out = [], { pos } = tree, c = leafUniforms.uCrownC.value, toCam = camera.position.clone().sub(c).setY(0).normalize(), d = new V();
    const cr = leafUniforms.uCrownR.value;
    // vorn (zur Kamera) und außen auf der Kronenhülle
    const front = (p) => { d.copy(p).sub(c); const shell = Math.hypot(d.x / cr.x, d.y / cr.y, d.z / cr.z); d.y *= 0.5;
      return shell > 0.72 ? d.dot(toCam) / (d.length() + 1e-6) : -1; };
    const ok = [];
    if (!high) {
      const ga = leafMesh.geometry.getAttribute('aGrow').array;
      for (let k = 0; k < ga.length; k++) if (ga[k] > 0.5 && !seasonGone(k) && pos[leafNode[k]].y < c.y && front(pos[leafNode[k]]) > 0.4) ok.push(leafNode[k]);
    } else {
      for (let i = 1; i < tree.N; i++) if (tree.birth[i] < T - 1 && pos[i].y > grownTop * 0.45 && rad[i] > 0.012 && front(pos[i]) > 0.2) ok.push(i);
    }
    for (let i = 0; i < n && ok.length; i++) { const p = pos[ok[Math.floor(Math.random() * ok.length)]].clone();
      const outv = p.clone().sub(c).setY(0).normalize();             // etwas vor und unter den Kronenrand: dort sieht man sie sofort
      out.push(p.addScaledVector(toCam, 0.45).addScaledVector(outv, 0.25).add(new V(0, -0.25, 0))); }
    return out;
  }
  function spawn() {
    const big = Math.min(1, grownTop / 9);
    if (season === 'winter') {
      for (const p of spots(Math.round(5 + 7 * big), true)) {
        const nF = 22 + Math.floor(Math.random() * 14), delay = Math.random() * 0.9;
        for (let k = 0; k < nF && flakes.length < NS; k++) flakes.push({
          p: p.clone().add(new V((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.25)),
          v: new V((Math.random() - 0.5) * 0.3, -0.2 - Math.random() * 0.4, (Math.random() - 0.5) * 0.3), t: -delay - Math.random() * 0.25, ph: Math.random() * 6.28 });
      }
      smat.size = 0.22 + 0.14 * big;
    } else {
      const n = Math.round((season === 'herbst' ? 10 : 5) + (season === 'herbst' ? 12 : 6) * big);
      const pal = FALL_COLS[season] || FALL_COLS.sommer;
      for (const p of spots(n, false)) leaves.push({ col: new THREE.Color(pal[Math.floor(Math.random() * pal.length)]), p, t: -Math.random() * 1.4, ph: Math.random() * 6.28, sp: 0.8 + Math.random() * 0.6,
        ax: new V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), ang: Math.random() * 6.28,
        size: 0.42 * Math.max(0.3, leafScaleBase) * (0.8 + Math.random() * 0.4), land: -1 });
      leaves = leaves.slice(-NL);
    }
  }
  function frame(dt, time) {
    // Blätter: trudeln mit Pendelbewegung herab, liegen kurz im Gras und verschwinden dann
    let n = 0;
    for (const L of leaves) {
      L.t += dt; if (L.t < 0) continue;
      if (L.land < 0) {
        const fall = 0.7 * L.sp;
        L.p.y -= fall * dt * Math.min(1, L.t * 2);
        L.p.x += Math.sin(time * 1.8 * L.sp + L.ph) * 0.6 * dt + 0.15 * dt;
        L.p.z += Math.cos(time * 1.3 * L.sp + L.ph) * 0.35 * dt;
        L.ang += dt * 2.4 * L.sp;
        if (L.p.y <= 0.03) { L.p.y = 0.03; L.land = L.t; }
      }
      const gone = L.land >= 0 ? smooth((L.t - L.land - 1.6) / 0.8) : 0;
      if (gone >= 1) continue;
      q.setFromAxisAngle(L.ax, L.ang);
      if (L.land >= 0) q.setFromEuler(e3.set(-Math.PI / 2 + 0.2 * Math.sin(L.ph), L.ph, 0));   // flach im Gras
      sv.setScalar(L.size * (1 - gone));
      m4.compose(L.p, q, sv); lmesh.setColorAt(n, L.col); lmesh.setMatrixAt(n++, m4);
    }
    leaves = leaves.filter(L => !(L.land >= 0 && L.t - L.land > 2.4));
    lmesh.count = n; lmesh.instanceMatrix.needsUpdate = true; if (lmesh.instanceColor) lmesh.instanceColor.needsUpdate = true;
    // Schnee: fällt erst als Klumpen, zerstäubt dann und schwebt aus
    let m = 0;
    for (const F of flakes) {
      F.t += dt; if (F.t < 0) { continue; }
      F.v.y = Math.max(-1.1, F.v.y - 1.6 * dt);
      F.v.x *= 1 - 0.8 * dt; F.v.z *= 1 - 0.8 * dt;
      F.p.addScaledVector(F.v, dt);
      F.p.x += Math.sin(time * 2 + F.ph) * 0.08 * dt;
    }
    flakes = flakes.filter(F => F.p.y > 0.02 && F.t < 4);
    for (const F of flakes) { if (F.t < 0) continue; spos[m * 3] = F.p.x; spos[m * 3 + 1] = F.p.y; spos[m * 3 + 2] = F.p.z; m++; }
    for (let i = m; i < NS; i++) spos[i * 3 + 1] = -99;
    sgeo.attributes.position.needsUpdate = true; sgeo.setDrawRange(0, Math.max(m, 0));
    snow.visible = m > 0;
  }
  function leafAt(p, palName) {   // ein Blatt löst sich an dieser Stelle
    const pal = FALL_COLS[palName] || FALL_COLS.herbst;
    leaves.push({ col: new THREE.Color(pal[Math.floor(Math.random() * pal.length)]), p, t: 0, ph: Math.random() * 6.28, sp: 0.8 + Math.random() * 0.6,
      ax: new V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), ang: Math.random() * 6.28,
      size: 0.42 * Math.max(0.3, leafScaleBase) * (0.8 + Math.random() * 0.4), land: -1 });
    if (leaves.length > NL) leaves.splice(0, leaves.length - NL);
  }
  function drift(n) {   // ein paar einzelne Herbstblätter, z. B. während das Laub im Spätherbst fällt
    const pal = FALL_COLS.herbst;
    for (const p of spots(n, false)) leaves.push({ col: new THREE.Color(pal[Math.floor(Math.random() * pal.length)]), p, t: 0, ph: Math.random() * 6.28, sp: 0.8 + Math.random() * 0.6,
      ax: new V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), ang: Math.random() * 6.28,
      size: 0.42 * Math.max(0.3, leafScaleBase) * (0.8 + Math.random() * 0.4), land: -1 });
    leaves = leaves.slice(-NL);
  }
  function clear() { leaves = []; flakes = []; lmesh.count = 0; snow.visible = false; }
  window.__fxS = () => [flakes.length, flakes.filter(F => F.t >= 0).length, smat.size];
  window.__fxL = () => leaves.map(L => { const v = L.p.clone().project(camera); return [+L.p.x.toFixed(2), +L.p.y.toFixed(2), +L.p.z.toFixed(2), +L.t.toFixed(2), +L.size.toFixed(2), Math.round((v.x * .5 + .5) * W()), Math.round((.5 - v.y * .5) * H())]; });
  return { spawn, frame, clear, drift, leafAt };
})();

// ------------------------------------------------------------------ Vanamo-Jahr: 4 × 28 Tage, Wechselzeit 10 Tage um jede Grenze
// Tag 0 = Frühlingsbeginn. Ein neuer Baum startet bei Tag 5 (Ende der Wechselzeit Winter -> Frühling, also gleich grün).
const YEAR_LEN = 112, SEASON_LEN = 28, SWITCH_DAYS = 10, YEAR_START = 5;
const SNAMES = ['fruehling', 'sommer', 'herbst', 'winter'];
let yearDay = 42, yearSt = null, springK = 0, yearLeafK = 1;
function yearState(d) {
  d = ((d % YEAR_LEN) + YEAR_LEN) % YEAR_LEN;
  const x = d / SEASON_LEN, k = Math.round(x), half = SWITCH_DAYS / 2 / SEASON_LEN;
  if (Math.abs(x - k) < half) {
    const from = SNAMES[(k + 3) % 4], to = SNAMES[k % 4], u = (x - k + half) / (2 * half);
    return { d, from, to, u, dom: u < 0.5 ? from : to };
  }
  const sn = SNAMES[Math.floor(x) % 4];
  return { d, from: sn, to: sn, u: 0, dom: sn };
}
const leafAtlasCache = {};
const leafAtlasData = (sn) => leafAtlasCache[sn] || (leafAtlasCache[sn] = paintLeafAtlas(sn));
let leafTexB = null;
function setLeafAtlas(A, B) {
  const tx = leafMesh.userData.tex;
  if (tx.userData.season !== A) { tx.image.data = leafAtlasData(A); tx.userData.season = A; tx.needsUpdate = true; }
  if (!leafTexB) {
    leafTexB = new THREE.DataTexture(leafAtlasData(B), tx.image.width, tx.image.height, THREE.RGBAFormat);
    leafTexB.colorSpace = THREE.SRGBColorSpace; leafTexB.anisotropy = 8; leafTexB.magFilter = THREE.LinearFilter;
    leafTexB.minFilter = THREE.LinearMipmapLinearFilter; leafTexB.generateMipmaps = true; leafTexB.needsUpdate = true;
    leafTexB.userData.season = B; leafUniforms.uLeafB.value = leafTexB;
  } else if (leafTexB.userData.season !== B) { leafTexB.image.data = leafAtlasData(B); leafTexB.userData.season = B; leafTexB.needsUpdate = true; }
}
let meadowTexB = null, meadowTexH = null;
function meadowTexFor(sn) {
  const t = new THREE.DataTexture(meadowAtlasCache[sn] || (meadowAtlasCache[sn] = paintMeadowAtlas(sn)), meadowTex.image.width, meadowTex.image.height, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true; t.userData.season = sn; return t;
}
function setMeadowB(sn) {
  if (!meadowTexB) { meadowTexB = meadowTexFor(sn); groundUniforms.uMeadowB.value = meadowTexB; }
  else if (meadowTexB.userData.season !== sn) { meadowTexB.image.data = meadowAtlasCache[sn] || (meadowAtlasCache[sn] = paintMeadowAtlas(sn)); meadowTexB.userData.season = sn; meadowTexB.needsUpdate = true; }
}
const youngColCache = {};
function youngCols(sn) { if (!youngColCache[sn]) { colorYoungLeaves(sn); youngColCache[sn] = youngLeafGeo.getAttribute('color').array.slice(); } return youngColCache[sn]; }
const SEASON_P = {
  fruehling: { glow: 0.2,  spring: 1, h: 0.85, keep: 1,    snow: 0, bare: 0, fallen: 0 },
  sommer:    { glow: 0.09, spring: 0, h: 1.0,  keep: 1,    snow: 0, bare: 0, fallen: 0 },
  herbst:    { glow: 0.12, spring: 0, h: 0.95, keep: 1,    snow: 0, bare: 0, fallen: 0.55 },
  winter:    { glow: 0.09, spring: 0, h: 0.8,  keep: 0.05, snow: 1, bare: 1, fallen: 0 },
};
// Laubfall: beginnt mit der Herbstfärbung (Tag 58), der Baum wird den ganzen Herbst über lichter, mit Winterbeginn (Tag 89) ist er kahl
const DROP_START = 58, DROP_END = 89;
function dropQ(d) {
  d = ((d % YEAR_LEN) + YEAR_LEN) % YEAR_LEN;
  if (d >= DROP_START && d < DROP_END) return Math.pow((d - DROP_START) / (DROP_END - DROP_START), 0.6);   // dichte Krone: anfangs mehr, sonst sieht man das Lichterwerden erst spät
  if (d >= DROP_END && d < 107) return 1;
  return 0;
}
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
let yearKey = '';
function applyYear(d) {
  const st = yearState(d); yearSt = st;
  const key = st.from + st.to + st.u.toFixed(4) + '|' + st.d.toFixed(3);
  if (key === yearKey) return; yearKey = key;
  const { from, to, u } = st, A0 = SEASON_P[from], B0 = SEASON_P[to];
  const lerp = (k) => A0[k] + (B0[k] - A0[k]) * u;
  const colorMix = from !== to && from !== 'winter' && to !== 'winter';
  const drop = from === 'herbst' && to === 'winter', sprout = from === 'winter' && to === 'fruehling';
  const bareAll = from === 'winter' && to === 'winter';
  season = st.dom;
  // Laub
  const A = from === 'winter' ? 'fruehling' : from;
  setLeafAtlas(A, colorMix ? to : A);
  leafUniforms.uSeasonU.value = u;
  leafUniforms.uSeasonMode.value = colorMix ? 1 : sprout ? 3 : 0;
  const dq = sprout ? 0 : dropQ(st.d); leafUniforms.uDropU.value = dq;
  leafMesh.visible = !bareAll; if (leafPre) leafPre.visible = leafMesh.visible;
  __nightS.glowDay = lerp('glow'); leafUniforms.uGlow.value = __nightS.glowDay; __nightApply();
  springK = sprout ? 1 : lerp('spring');
  yearLeafK = bareAll ? 0 : sprout ? smooth(u / 0.9) : 1 - dq;
  // Blättchen des jungen Bäumchens: Farben überblenden
  const cA = youngCols(A), cB = youngCols(colorMix ? to : A), ca = youngLeafGeo.getAttribute('color');
  for (let i = 0; i < ca.array.length; i++) ca.array[i] = cA[i] + (cB[i] - cA[i]) * (colorMix ? u : 0);
  ca.needsUpdate = true;
  // Wiese: Büschel einzeln, Boden fließend
  setMeadowAtlas(from); setMeadowB(to);
  const iA = SNAMES.indexOf(from), iB = SNAMES.indexOf(to);
  groundUniforms.uSeason.value.set(iA === 0 ? 1 : 0, iA === 1 ? 1 : 0, iA === 2 ? 1 : 0, iA === 3 ? 1 : 0);
  groundUniforms.uSeasonB.value.set(iB === 0 ? 1 : 0, iB === 1 ? 1 : 0, iB === 2 ? 1 : 0, iB === 3 ? 1 : 0);
  groundUniforms.uMeadowU.value = from === to ? 0 : u;
  const gA = MEADOW_SEASON[from].g, gB = MEADOW_SEASON[to].g;
  [groundUniforms.uG1, groundUniforms.uG2, groundUniforms.uG3].forEach((U, i) => U.value.copy(_c1.set(gA[i]).lerp(_c2.set(gB[i]), u)));
  groundUniforms.uTuftH.value = lerp('h'); groundUniforms.uTuftKeep.value = lerp('keep');
  // Schnee kommt erst, wenn das Laub weitgehend unten ist; im Frühling schmilzt er früh
  const snow = drop ? smooth((u - 0.62) / 0.38) : sprout ? 1 - smooth(u / 0.6) : A0.snow;
  groundUniforms.uSnow.value = snow; tubeUniforms.uSnow.value = snow;
  tubeUniforms.uBare.value = sprout ? 1 - smooth(u / 0.7) : bareAll || drop ? 1 : smooth((st.d - 30) / 26);
  // Falllaub am Boden: sammelt sich im Herbst, verschwindet unter dem Schnee
  // Falllaub am Boden wächst mit dem Laubfall, verschwindet unter dem Schnee
  let fl = Math.min(1, dq * 1.1) * (drop ? 1 - smooth((u - 0.6) / 0.35) : bareAll ? 0 : 1);
  if (!meadowTexH && fl > 0.001) { meadowTexH = meadowTexFor('herbst'); fallen.material.map = meadowTexH; fallen.material.needsUpdate = true; }
  groundUniforms.uFallen.value = fl; fallen.visible = fl > 0.001 && !!meadowTexH;
  applyLeafQuality();
  Tshown = -1; shadowDirty = true;
  updateYearLabel();
}
const SEASON_DE = { fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst', winter: 'Winter' };
function updateYearLabel() {
  const el = $id('yearlbl'); if (!el || !yearSt) return;
  const st = yearSt, day = Math.floor(st.d) + 1;
  el.textContent = st.from === st.to ? `Tag ${day} · ${SEASON_DE[st.from]}` : `Tag ${day} · ${SEASON_DE[st.from]} → ${SEASON_DE[st.to]} (${Math.round(st.u * 100)} %)`;
  const sl = $id('year'); if (sl && document.activeElement !== sl) sl.value = st.d;
  __ui.querySelectorAll('[data-season]').forEach(x => x.setAttribute('aria-pressed', x.dataset.season === st.dom ? 'true' : 'false'));
}
let yearPlay = false;
// Schwelle je Laubbüschel – exakt wie im Shader (SEASON_GLSL), damit das fallende Blatt dort startet, wo das Büschel verschwindet
const _m4y = new THREE.Matrix4(), _cvy = new V();
const fract = (x) => x - Math.floor(x), sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let cardThr = null, cardThrKey = '';
function cardThresholds() {
  const c = leafUniforms.uCrownC.value, r = leafUniforms.uCrownR.value;
  const key = [T, c.x, c.y, c.z, r.x, r.y, r.z].map(v => v.toFixed(3)).join('|');
  if (cardThrKey === key) return cardThr;
  const ph = leafMesh.geometry.getAttribute('aPhase').array, n = ph.length;
  if (!cardThr || cardThr.length !== n) cardThr = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    leafMesh.getMatrixAt(k, _m4y); _cvy.set(0, 0.5, 0).applyMatrix4(_m4y);
    const dx = (_cvy.x - c.x) / r.x, dy = (_cvy.y - c.y) / r.y, dz = (_cvy.z - c.z) / r.z;
    const outer = Math.min(1.3, Math.max(0, Math.hypot(dx, dy, dz) + 0.3 * dy));
    cardThr[k] = 0.82 * fract(ph[k] * 3.71) + 0.18 * (1 - sstep(0.2, 1.1, outer));
  }
  cardThrKey = key; return cardThr;
}
const dropU = (thr) => thr * 0.98 + 0.01;                  // Moment, in dem das Büschel beim Laubfall verschwindet (wie im Shader)
// Ist dieses Büschel gerade (jahreszeitlich) weg? -> dort keine Blätter mehr starten lassen
function seasonGone(k) {
  if (!yearSt) return false;
  const { from, to, u } = yearSt;
  if (from === 'winter' && to === 'winter') return true;
  const dq = leafUniforms.uDropU.value;
  if (dq > 0) return dq > dropU(cardThresholds()[k]);
  if (from === 'winter' && to === 'fruehling') return u < cardThresholds()[k] * 0.75 + 0.12;
  return false;
}
let driftAcc = 0, prevDropU = null;
function yearFrame(dt) {
  if (yearPlay) { yearDay = (yearDay + dt * YEAR_LEN / 40) % YEAR_LEN; applyYear(yearDay); }
  if (!yearSt || reduceMotion) return;
  const { from, to, u } = yearSt, drop = from === 'herbst' && to === 'winter';
  // Laubfall: jedes Büschel, dessen Zeit gerade gekommen ist, lässt an seiner Stelle ein Blatt fallen
  const dq = leafUniforms.uDropU.value;
  if (dq > 0 && dq < 1 && leafMesh.visible) {
    if (prevDropU != null && dq > prevDropU && dq - prevDropU < 0.15) {
      const thr = cardThresholds(), ga = leafMesh.geometry.getAttribute('aGrow').array, ph = leafMesh.geometry.getAttribute('aPhase').array, dens = leafUniforms.uDensity.value;
      const hit = [];
      for (let k = 0; k < thr.length; k++) {
        if (ga[k] < 0.3 || fract(ph[k] * 7.13) > dens) continue;
        const cu = dropU(thr[k]); if (cu > prevDropU && cu <= dq) hit.push(k);
      }
      for (let i = hit.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [hit[i], hit[j]] = [hit[j], hit[i]]; }
      for (const k of hit.slice(0, 20)) {
        leafMesh.getMatrixAt(k, _m4y);
        for (let j = 0; j < 2; j++) { _cvy.set((Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.6, 0).applyMatrix4(_m4y); stageFx.leafAt(_cvy.clone(), 'herbst'); }
      }
    }
    prevDropU = dq;
  } else prevDropU = null;
  // durchgehend ein paar Blätter im Herbst
  let rate = 0;
  if (dq > 0 && dq < 1) rate = 0.6 * (1 - sstep(0.85, 1, dq));
  else if (from === 'sommer' && to === 'herbst') rate = 0.3 * sstep(0.3, 1, u);
  driftAcc += dt * rate;
  while (driftAcc > 1) { driftAcc -= 1; stageFx.drift(1); }
}

let trans = null, moveIn = 0;   // moveIn 1: Übergang über Stufe 6 läuft, Eichhörnchen zieht danach ein
const nowMs = () => window.__vt ?? performance.now();   // Testuhr für Prüf-Skripte
// Übergang zur Zielstufe; mehrere Stufen auf einmal = ein einziger, etwas längerer Übergang
function startTransition(target) {
  target = Math.min(NSTAGE, Math.max(1, Math.round(target)));
  const from = Math.max(0, Math.round(P));
  if (target <= from) return;
  anim = null;
  if (reduceMotion) { P = target; trans = null; return; }
  const n = target - from;
  const grow = from === 0 ? 5200 + 1000 * Math.min(3, n - 1) : 3000 + 1000 * Math.min(3, n - 1);
  trans = { t0: nowMs(), from, target, grow, start: 800, fell: false };
  if (from < 6 && target >= 6) moveIn = 1;
  trans.end = trans.start + grow + 2600;
}
function startMoveIn() {
  moveIn = 0;
  if (season === 'winter') { winterFx.start(true); return; }   // Winter-Einzug: gleich ins Astloch (winter.js)
  seqCam.x = -1.3; zoom.seq = zoom.seqNow = 1; seqPlayer.play();
}
function transFrame(now, dt) {
  const baseWind = reduceMotion ? 0 : 1;
  if (trans) {
    const e = now - trans.t0;
    // Windstoß: setzt ein, zieht in ~1,8 s quer durch den Baum, klingt während des Wachsens ab
    const g = smooth(e / 500) * (1 - smooth((e - 1300) / 1600));
    leafUniforms.uGust.value = g;
    leafUniforms.uGustX.value = -8 + 16 * Math.min(1, e / 1900);
    leafUniforms.uWind.value = baseWind * (1 + 0.9 * g);
    tubeUniforms.uBend.value = baseWind * g * 0.03 * Math.max(0.6, grownTop) * (0.85 + 0.15 * Math.sin(e / 170));
    tubeUniforms.uBendH.value = Math.max(0.5, grownTop);
    // Wachsen: weich an- und auslaufend
    const u = Math.min(1, Math.max(0, (e - trans.start) / trans.grow));
    const k = trans.from === 0 ? 1 - Math.pow(1 - u, 2.2) : u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    P = trans.from + (trans.target - trans.from) * k;
    if (!trans.fell && e > trans.start + trans.grow * 0.65) { trans.fell = true; stageFx.spawn(); }
    if (e > trans.end) { P = trans.target; trans = null; leafUniforms.uGust.value = 0; tubeUniforms.uBend.value = 0; leafUniforms.uWind.value = baseWind; if (moveIn === 1) startMoveIn(); }
  }
  // Testuhr: Zeitschritt aus der Uhr selbst (Screenshots erzeugen Zusatzbilder)
  const dtv = window.__vt != null ? Math.max(0, (now - (transFrame.last ?? now)) / 1000) : dt;
  transFrame.last = now;
  yearFrame(dtv);
  stageFx.frame(dtv, now / 1000);
  jayFx.frame();
  visitFx.frame();
  holeFx.frame();
  winterFx.frame();
}
window.__trans = () => trans;


// ------------------------------------------------------------------ Start: der Eichelhäher bringt die Eichel (Stufe 0)
// Er fliegt von links ins Bild, senkt sich, lässt die Eichel fallen und steigt nach rechts wieder auf (ca. 7 s).
// Die Eichel fällt genau an die Stelle des Baums, hüpft einmal und bleibt im Gras liegen. Die Kamera bleibt ruhig.
const JAY = {"meta":[{"w":380,"h":265,"beak":[365.7,171.7],"tail":[14.3,194.8]},{"w":380,"h":258,"beak":[365.7,164.5],"tail":[14.3,187.6]},{"w":380,"h":182,"beak":[365.7,88.2],"tail":[14.3,111.5]},{"w":380,"h":226,"beak":[365.9,132.0],"tail":[14.1,155.0]},{"w":380,"h":241,"beak":[366.0,45.4],"tail":[14.0,75.4]},{"w":380,"h":243,"beak":[365.9,149.8],"tail":[14.1,172.2]}],"uris":[__img("415ae0b0c6.webp"),__img("5fc4cecd27.webp"),__img("97a06c55f1.webp"),__img("3e5ee7e46f.webp"),__img("a3a73673aa.webp"),__img("c3d343f138.webp")]};
// Eichelhäher als Gliederpuppe: Körper + zwei biegsame Flügel (gemalt, Stil B2).
// Einheiten: Schnabel bis Schwanzspitze = 1. Ursprung = Schulter. x nach vorn (zum Schnabel), y nach oben, z zum Betrachter.
// Der Flügel ist ein Gitter; jede Reihe entlang der Flügellänge bekommt eigene Hebung (e) und Pfeilung (σ):
//  – Schlag: Grund-Hebung e0 zwischen oben und unten, Abschlag etwas länger als Aufschlag
//  – Nachschleppen: die Spitze folgt der Bewegung verzögert (Flügel biegt sich)
//  – Aufschlag: die Hand klappt halb ein und schwenkt nach hinten (wie bei echten Singvögeln/Rabenvögeln)
//  – Gleiten: nach einigen Schlägen kurz mit halb erhobenen Flügeln gleiten
// Körper (optional „lebendig“): hebt sich beim Abschlag minimal, nickt kaum, Schwanz schwingt verzögert mit.
const JAY_META = { body: { w: 1469, h: 473, shoulder: [901, 171], beak: [1443, 165], tail: [26, 406] },
  wing: { w: 990, h: 2026, base: [568, 1980], top: 24, scale: 0.43 } };

const D = Math.PI / 180;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function createJayPuppet(THREE, tex, opt = {}) {
  const M = JAY_META, PX = 1 / (M.body.beak[0] - M.body.tail[0]);
  const P = Object.assign({
    freq: 3.0,            // Flügelschläge pro Sekunde
    up: 72, down: -42,    // Hebung oben / unten (Grad)
    down55: 0.56,         // Anteil des Abschlags am Schlag
    lag: 30,              // Nachschleppen der Spitze (Grad bei voller Geschwindigkeit)
    fold: 58,             // Einklappen der Hand beim Aufschlag (Grad Pfeilung)
    sweep: -10,           // Grund-Pfeilung (nach hinten)
    beats: 3, glide: 0.45, // Schläge je Folge, Gleitdauer (s)
    glideE: 18,           // Hebung beim Gleiten
    lively: true,         // Körper/Schwanz schwingen mit
    lift: 0.010, pitch: 1.2, tail: 3.5,
    tilt: 0,              // Blick leicht von oben (Grad): Flügel verschwindet mitten im Schlag nicht, hinterer Flügel lugt über dem Rücken hervor
    depthTest: false, order: 1, tone: 1,   // im Baum: Tiefe prüfen, Zeichenreihenfolge, Grundhelligkeit
    blur: 0,              // Bewegungsunschärfe: so viele blasse Nachbilder der Flügel (0 = aus)
    blurDt: 0.016,        // Abstand der Nachbilder (s)
    blurA: [0.32, 0.18, 0.09],   // Deckkraft der Nachbilder
    trail: 0,             // Körper: ein blasses Nachbild so weit hinter dem Körper (Puppen-Einheiten, 0 = aus)
  }, opt);

  const grp = new THREE.Group();
  const mat = (map, dark = 1, opacity = 1) => { const m = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: opacity < 1 ? 0.01 : 0.04, opacity, side: THREE.DoubleSide, depthWrite: false, depthTest: P.depthTest, toneMapped: false });
    m.color.setScalar(dark * P.tone); return m; };

  // ---- Körper: Gitter entlang x (Schwanz biegt sich)
  const bw = M.body.w * PX, bh = M.body.h * PX, bx0 = -M.body.shoulder[0] * PX, by0 = M.body.shoulder[1] * PX;
  const bodyGeo = new THREE.PlaneGeometry(bw, bh, 16, 1); bodyGeo.translate(bx0 + bw / 2, by0 - bh / 2, 0);
  const bodyBase = bodyGeo.attributes.position.array.slice();
  const body = new THREE.Mesh(bodyGeo, mat(tex.body)); body.renderOrder = P.order + 3;
  const tailRoot = (M.body.tail[0] + (M.body.shoulder[0] - M.body.tail[0]) * 0.42) * PX + bx0;   // ab hier ist es Schwanz
  const tailRootY = by0 - M.body.tail[1] * PX * 0.82;

  // ---- Flügel: Gitter NS (Länge) × NC (Tiefe)
  const NS = 16, NC = 4;
  const ws = M.wing.scale * PX, WL = (M.wing.base[1] - M.wing.top) * ws;
  function wingGeo() {
    const g = new THREE.BufferGeometry(), pos = new Float32Array((NS + 1) * (NC + 1) * 3), uv = new Float32Array((NS + 1) * (NC + 1) * 2), idx = [];
    const sc = new Float32Array((NS + 1) * (NC + 1) * 2);   // je Ecke: s (entlang Länge), c (quer, Welt-Einheiten)
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NC; j++) {
      const k = i * (NC + 1) + j, py = M.wing.h * (1 - i / NS), px = M.wing.w * j / NC;
      uv[k * 2] = j / NC; uv[k * 2 + 1] = i / NS;
      sc[k * 2] = (M.wing.base[1] - py) / (M.wing.base[1] - M.wing.top); sc[k * 2 + 1] = (px - M.wing.base[0]) * ws;
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NC; j++) { const a = i * (NC + 1) + j, b = a + 1, c = a + NC + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.userData.sc = sc; return g;
  }
  // Reihenfolge: hintere Nachbilder, hinterer Flügel, Körper-Nachbild, Körper, vordere Nachbilder, vorderer Flügel
  const near = new THREE.Mesh(wingGeo(), mat(tex.wing)); near.renderOrder = P.order + 5;
  const far = new THREE.Mesh(wingGeo(), mat(tex.wing, 0.6)); far.renderOrder = P.order + 1;
  far.position.set(0.028, 0.022, 0); far.scale.setScalar(0.9);
  const ghosts = [];
  for (let j = 0; j < P.blur; j++) {
    const a = P.blurA[j] ?? P.blurA[P.blurA.length - 1] * 0.5;
    const gn = new THREE.Mesh(wingGeo(), mat(tex.wing, 1, a)); gn.renderOrder = P.order + 4;
    const gf = new THREE.Mesh(wingGeo(), mat(tex.wing, 0.6, a)); gf.renderOrder = P.order; gf.position.copy(far.position); gf.scale.copy(far.scale);
    ghosts.push({ n: gn, f: gf, dt: (j + 1) * P.blurDt });
  }
  const bodyGhost = P.trail ? new THREE.Mesh(bodyGeo, mat(tex.body, 1, 0.22)) : null;
  if (bodyGhost) { bodyGhost.renderOrder = P.order + 2; bodyGhost.position.x = -P.trail; }
  const bodyPivot = new THREE.Group(); bodyPivot.add(body, near, far, ...ghosts.flatMap(g => [g.n, g.f]), ...(bodyGhost ? [bodyGhost] : [])); grp.add(bodyPivot);

  // Schlag-Grundkurve: u ∈ [0,1) – 0 = oben; Abschlag bis P.down55, dann Aufschlag
  function stroke(u) {
    const d = P.down55;
    if (u < d) { const k = u / d; return { e: P.up + (P.down - P.up) * (0.5 - 0.5 * Math.cos(Math.PI * k)), v: -Math.sin(Math.PI * k), upF: 0 }; }
    const k = (u - d) / (1 - d); return { e: P.down + (P.up - P.down) * (0.5 - 0.5 * Math.cos(Math.PI * k)), v: Math.sin(Math.PI * k), upF: Math.sin(Math.PI * k) };
  }
  // Wing-Gitter aus Hebung/Pfeilung je Reihe
  const tmp = { x: 0, y: 0, z: 0 };
  function bendWing(mesh, e0, v, upF, glide, side = 1) {
    const ct = Math.cos(P.tilt * D), st = Math.sin(P.tilt * D);
    const g = mesh.geometry, pos = g.attributes.position.array, sc = g.userData.sc;
    // Reihen entlang der Länge integrieren
    let x = 0, y = 0, z = 0;
    const rows = [];
    for (let i = 0; i <= NS; i++) {
      const s = i / NS;
      const e = (e0 - v * P.lag * s * s * (1 - glide)) * D;
      const sig = (P.sweep - upF * P.fold * sm(0.35, 1, s) * (1 - glide)) * D;
      if (i > 0) { const ds = WL / NS; x += Math.sin(sig) * ds; y += Math.cos(sig) * Math.sin(e) * ds; z += side * Math.cos(sig) * Math.cos(e) * ds; }
      rows.push([x, y, z, sig, e]);
    }
    const s0 = (M.wing.h - M.wing.base[1]) / (M.wing.base[1] - M.wing.top);   // Rand unter der Basis
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NC; j++) {
      const k = i * (NC + 1) + j, c = sc[k * 2 + 1];
      const [rx, ry, rz, sig, e] = rows[i];
      const off = i === 0 ? -s0 * WL : 0;    // unterste Reihe liegt etwas unter der Schulter (Deckfedern)
      const ox = Math.sin(sig) * off, oy = Math.cos(sig) * Math.sin(e) * off, oz = side * Math.cos(sig) * Math.cos(e) * off;
      const X = rx + ox + Math.cos(sig) * c, Y = ry + oy - Math.sin(sig) * Math.sin(e) * c, Z = rz + oz - side * Math.sin(sig) * Math.cos(e) * c;
      pos[k * 3] = X;
      pos[k * 3 + 1] = Y * ct - Z * st;     // Projektion mit leichtem Blick von oben (nähere Teile rutschen nach unten)
      pos[k * 3 + 2] = 0;
    }
    g.attributes.position.needsUpdate = true;
  }
  function bendBody(tailAng) {
    const pos = bodyGeo.attributes.position.array;
    const c = Math.cos(tailAng), s = Math.sin(tailAng);
    for (let k = 0; k < pos.length; k += 3) {
      const x = bodyBase[k], y = bodyBase[k + 1];
      const w = 1 - sm(tailRoot - 0.18, tailRoot, x);     // 0 vorn, 1 am Schwanz
      const dx = x - tailRoot, dy = y - tailRootY, a = tailAng * w;
      pos[k] = tailRoot + dx * Math.cos(a) - dy * Math.sin(a); pos[k + 1] = tailRootY + dx * Math.sin(a) + dy * Math.cos(a);
    }
    bodyGeo.attributes.position.needsUpdate = true;
  }

  // Zeitlauf: Folge aus P.beats Schlägen, dann Gleiten
  let phase = 0, lastT = null, glideT = -1, beatCount = 0, glideW = 0, lift = 0;
  // c (optional, für Landen/Abheben): { hold: 0–1 Gleiten erzwingen (0 = nur schlagen), e: Hebung beim Gleiten (Grad), freq: Tempo-Faktor }
  function update(t, c) {
    const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    if (glideT >= 0) { glideT += dt; if (glideT > P.glide) glideT = -1; }
    const gTarget = c && c.hold != null ? c.hold : glideT >= 0 ? 1 : 0; glideW += (gTarget - glideW) * Math.min(1, dt * 9);
    const gE = c && c.e != null ? c.e : P.glideE;
    const prev = phase; phase += dt * P.freq * (c && c.freq || 1) * (1 - glideW);
    if (Math.floor(phase) > Math.floor(prev)) { beatCount++; if (P.beats > 0 && beatCount % P.beats === 0 && P.glide > 0) glideT = 0; }
    const st = stroke(phase % 1);
    const e0 = st.e + (gE - st.e) * glideW;
    bendWing(near, e0, st.v, st.upF, glideW, 1); bendWing(far, e0 + 4, st.v, st.upF, glideW, -1);
    // Nachbilder: dieselbe Puppe einen Augenblick früher – im Gleiten (kein Schlag) fallen sie mit dem Flügel zusammen
    for (const g of ghosts) {
      const sg = stroke(((phase - g.dt * P.freq * (1 - glideW)) % 1 + 1) % 1), eg = sg.e + (gE - sg.e) * glideW;
      bendWing(g.n, eg, sg.v, sg.upF, glideW, 1); bendWing(g.f, eg + 4, sg.v, sg.upF, glideW, -1);
      g.n.visible = g.f.visible = glideW < 0.95;
    }
    if (P.lively) {
      lift += ((-st.v) * P.lift * (1 - glideW) - lift) * Math.min(1, dt * 10);
      bodyPivot.position.y = lift; bodyPivot.rotation.z = -lift / P.lift * P.pitch * D * 0.6;
      bendBody(Math.sin(phase * Math.PI * 2 - 1.3) * P.tail * D * (1 - glideW * 0.6));
    }
  }
  update(0);
  const beak = [(M.body.beak[0] - M.body.shoulder[0]) * PX, (M.body.shoulder[1] - M.body.beak[1]) * PX];   // Schnabelspitze (Puppen-Einheiten)
  [body, near, far, ...ghosts.flatMap(g => [g.n, g.f]), ...(bodyGhost ? [bodyGhost] : [])].forEach(m => { m.frustumCulled = false; });
  return { group: grp, update, params: P, beak, reset() { phase = 0; lastT = null; glideT = -1; beatCount = 0; glideW = 0; lift = 0; }, setLively(on) { P.lively = on; if (!on) { bodyPivot.position.y = 0; bodyPivot.rotation.z = 0; bendBody(0); } } };
}

const jayFx = (() => {
  const loader = new THREE.TextureLoader();
  const ldT = (n) => { const t = loader.load(__img(n)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const jtex = { body: ldT('0706e7d87e.webp'), wing: ldT('ba6ae2ad2e.webp') };
  const mk = (map, order) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    m.material.color.setScalar(0.94); m.renderOrder = order; m.visible = false; scene.add(m); return m;
  };
  const nutTex = loader.load(SEQIMG.eichel); nutTex.colorSpace = THREE.SRGBColorSpace;
  const nut = mk(nutTex, 28);
  const jayP = createJayPuppet(THREE, jtex, { depthTest: true, order: 24, tone: 0.94,
    // Fassung 2 (22.10.): im Baum ist der Häher klein – Bewegung übertrieben, leicht von oben gesehen
    up: 82, down: -52, lag: 42, fold: 68, lift: 0.032, pitch: 3.5, tail: 9, tilt: 24,
    blur: 3, trail: 0.03 }), jay = jayP.group;
  jay.visible = false; scene.add(jay);   // Bewegungsunschärfe: blur/trail oben (22.10.)
  // Schatten auf der Wiese: weicher Fleck, entlang des Sonnen-/Mondlichts auf den Boden geworfen
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    // runder, weicher Verlauf über das ganze Bild (die flache Ellipse entsteht durch die Skalierung der Fläche)
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 63); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, color: 0x18220e, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  shadow.renderOrder = 23; shadow.visible = false; shadow.userData.__night = true; scene.add(shadow);
  const SHQ = STAGE_Q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new V(1, 0, 0), -Math.PI / 2)), shP = new V();
  const ORDER = [0, 1, 2, 4, 3, 5];            // ein Flügelschlag: oben, halb, waagerecht, unten, hoch, oben
  const LEN = 0.62;                           // Schnabel bis Schwanzspitze in Welt-Einheiten (etwa so groß wie das Eichhörnchen)
  const M0 = JAY.meta[0], PX = LEN / (M0.beak[0] - M0.tail[0]);
  const NW = SEQ.frames.eichel.w * 1.3, NH = SEQ.frames.eichel.h * 1.3;
  const SPEED = 1.05, X0 = -3.1, ZJ = 0.7, ZN = 0.18, G = 6.5;
  const yAt = (x) => 0.68 + 0.05 * (x + 0.35) ** 2;               // flacher Bogen: kommt höher an, senkt sich, steigt wieder
  const slope = (x) => 0.1 * (x + 0.35);
  const REST = { x: 0.02, y: NH * 0.42, rot: 0.15 };              // liegt im Gras an der Stelle des Baums
  // Eichel im Schnabel: etwas vor und unter der Schnabelspitze
  const HOLD = { dx: -0.01, dy: -0.035, rot: -0.35 };
  // Loslassen so, dass sie genau an der Baumstelle landet (vorab ausrechnen)
  let xRel = -0.6;
  (function solve() {
    for (let it = 0; it < 40; it++) {
      const y0 = yAt(xRel) + HOLD.dy, vx = SPEED * 0.55, vy = SPEED * slope(xRel);
      const tHit = (vy + Math.sqrt(vy * vy + 2 * G * (y0 - REST.y))) / G;
      const land = xRel + HOLD.dx + vx * tHit + 0.05;            // + kurzes Nachrollen nach dem Aufprall
      xRel += (REST.x - land) * 0.8;
    }
  })();
  const tRel = (xRel - X0) / SPEED;
  const DUR = (3.3 - X0) / SPEED * 1000;                          // bis er rechts aus dem Bild ist
  let t0 = -1, state = OPT.seed === false ? 'none' : 'lying', onLand = null;                                   // 'lying' = Eichel liegt (Stufe 0 / 1), 'none'
  const q = new THREE.Quaternion(), zA = new V(0, 0, 1);
  function put(m, x, y, z, w, h, rot) {
    m.position.copy(stageToWorld(x, y, z));
    m.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, rot));
    m.scale.set(w, h, 1);
  }
  function landed() { if (state === 'lying') return; state = 'lying'; const f = onLand; onLand = null; if (f) setTimeout(f, 0); }
  function seed(on) { t0 = -1; onLand = null; state = on ? 'lying' : 'none'; }   // bricht einen laufenden Flug ab
  function play(cb) {
    state = 'none'; onLand = cb || null;
    if (reduceMotion) { t0 = -1; landed(); return; }
    jayP.reset(); t0 = nowMs();
  }
  function frame() {
    const showNut = P < 1.98;                                     // Eichel bleibt an der Stammbasis bis Stufe 2
    const tt = t0 >= 0 ? (nowMs() - t0) / 1000 : 1e9;
    if (t0 >= 0 && tt > DUR / 1000 + 0.5) { t0 = -1; landed(); }
    // Häher
    if (t0 >= 0 && tt * 1000 < DUR) {
      const x = X0 + SPEED * tt, y = yAt(x), pitch = Math.atan(slope(x)) * 0.7;
      jayP.update(tt);
      // Puppe so legen, dass die Schnabelspitze auf dem Weg liegt (Ursprung der Puppe = Schulter)
      const bx = jayP.beak[0] * LEN, by = jayP.beak[1] * LEN, c = Math.cos(pitch), sn = Math.sin(pitch);
      jay.position.copy(stageToWorld(x - (c * bx - sn * by), y - (sn * bx + c * by), ZJ));
      jay.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, pitch));
      jay.scale.setScalar(LEN);
      jay.visible = true;
      // Schatten: fast senkrecht unter dem Vogel, nur leicht in Lichtrichtung versetzt (der echte Lichtwinkel würde ihn
      // in der flachen Nahansicht so weit wegwerfen, dass man ihn nicht mehr dem Vogel zuordnet); am Wiesenrand ausgeblendet
      jay.updateMatrixWorld(); shP.set(0.05, 0, 0).applyMatrix4(jay.matrixWorld);
      const hh = Math.max(0.05, shP.y); shP.addScaledVector(SUN_DIR, -0.22 * hh / SUN_DIR.y); shP.y = 0.02;
      const edge = 1 - Math.min(1, Math.max(0, (Math.hypot(shP.x, shP.z) - MR * 0.42) / (MR * 0.3)));
      shadow.position.copy(shP); shadow.quaternion.copy(SHQ); shadow.scale.set(LEN * (1.15 + hh * 0.3), LEN * (0.42 + hh * 0.12), 1);
      shadow.material.opacity = 0.5 * edge * (1 - 0.45 * __nightS.k) / (1 + hh * 0.6); shadow.visible = edge > 0.01;
      // Eichel im Schnabel bis zum Loslassen, dann Wurf
      if (tt < tRel) { put(nut, x + HOLD.dx, y + HOLD.dy, ZJ + 0.01, NW, NH, HOLD.rot + pitch); nut.visible = true; return; }
    } else { jay.visible = false; shadow.visible = false; }
    if (t0 >= 0 && tt >= tRel) {
      const u = tt - tRel, x1 = xRel + HOLD.dx, y1 = yAt(xRel) + HOLD.dy, vx = SPEED * 0.55, vy = SPEED * slope(xRel);
      const tHit = (vy + Math.sqrt(vy * vy + 2 * G * (y1 - REST.y))) / G;
      let x, y, rot, z = ZJ + (ZN - ZJ) * Math.min(1, u / tHit);
      if (u < tHit) { x = x1 + vx * u; y = y1 + vy * u - G * u * u / 2; rot = HOLD.rot - 3.2 * u; }
      else {                                                       // ein kleiner Hüpfer, kurz nachrollen, liegen
        const u2 = u - tHit, vb = 0.55, tb = 2 * vb / G;
        const xh = x1 + vx * tHit;
        x = xh + 0.05 * Math.min(1, u2 / (tb + 0.25));
        y = REST.y + (u2 < tb ? vb * u2 - G * u2 * u2 / 2 : 0);
        const rh = HOLD.rot - 3.2 * tHit; rot = rh + (REST.rot - rh) * Math.min(1, u2 / (tb + 0.3));
        if (u2 > tb + 0.3) { x = REST.x; rot = REST.rot; landed(); }
      }
      put(nut, x, y, z, NW, NH, rot); nut.visible = true; return;
    }
    // ohne Ablauf: Eichel liegt (Stufe 0 und am jungen Bäumchen bis Stufe 2)
    nut.visible = showNut && state === 'lying';
    if (nut.visible) put(nut, REST.x, REST.y, ZN, NW, NH, REST.rot);
  }
  return { play, frame, seed, get active() { return t0 >= 0; } };
})();

// ------------------------------------------------------------------ Eichelhäher-Besuch (ab Stufe 1)
// Ablauf (ca. 12 s): fliegt mit einer Eichel im Schnabel von der Seite herein, gleitet hinunter und landet vor dem
// Bäumchen, hüpft zweimal näher, legt die Eichel ab und pickt sie in die Erde, schaut sich um (dreht sich einmal um)
// und fliegt zur anderen Seite davon. Flug = Gliederpuppe (wie beim Start), am Boden zwei gemalte Haltungen
// (stehend / pickend, Füße an derselben Stelle) mit hartem Schnitt. Die Uhr läuft nur, solange der Baum läuft.
const visitFx = (() => {
  const loader = new THREE.TextureLoader();
  const ldT = (n) => { const t = loader.load(__img(n)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const tex = { body: ldT('0706e7d87e.webp'), wing: ldT('ba6ae2ad2e.webp'), stand: ldT('19769fdeee.webp'), peck: ldT('709f75c97e.webp') };
  const nutTex = loader.load(SEQIMG.eichel); nutTex.colorSpace = THREE.SRGBColorSpace;
  const plane = (map, order) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    m.material.color.setScalar(0.94); m.renderOrder = order; m.visible = false; scene.add(m); return m;
  };
  const stand = plane(tex.stand, 26), nut = plane(nutTex, 29);
  const pup = createJayPuppet(THREE, { body: tex.body, wing: tex.wing }, { depthTest: true, order: 24, tone: 0.94,
    up: 82, down: -52, lag: 42, fold: 68, lift: 0.032, pitch: 3.5, tail: 9, tilt: 24, blur: 3, trail: 0.03 }), fly = pup.group;
  fly.visible = false; scene.add(fly);
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 63); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, color: 0x18220e, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  shadow.renderOrder = 23; shadow.visible = false; shadow.userData.__night = true; scene.add(shadow);
  const SHQ = STAGE_Q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new V(1, 0, 0), -Math.PI / 2)), shP = new V();
  const LEN = 0.62;                                   // Flugpuppe: Schnabel bis Schwanzspitze (wie beim Start)
  // Stehbilder 749 × 567 px; Maßstab so, dass Auge–Schnabel so lang ist wie bei der Flugpuppe
  const IMG = { w: 749, h: 567, feet: [522, 561], beakS: [726, 50], beakP: [690, 470], shoulder: [560, 235] }, K = 0.000678;
  const SW = IMG.w * K, SH = IMG.h * K;
  const SHO = [(IMG.shoulder[0] - IMG.feet[0]) * K, (IMG.feet[1] - IMG.shoulder[1]) * K];   // Schulter über den Füßen
  const NW = SEQ.frames.eichel.w * 1.3, NH = SEQ.frames.eichel.h * 1.3;
  const HOLD = { dx: -0.01, dy: -0.035, rot: -0.35 };
  const Z = 0.42;                                     // vor dem Baum (dort ist das Gras kurz)
  const TA = 2.8, TB = 6.6, TC = 2.6;                 // Anflug, am Boden, Abflug (s)
  const HOPS = [0.65, 1.25], HOP = 0.3, HOPX = 0.12;
  const PECKS = [[2.1, 2.45], [2.6, 2.8], [2.95, 3.15], [3.3, 3.5]], SINK = [0, 0.3, 0.65, 1.25];
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const q = new THREE.Quaternion(), zA = new V(0, 0, 1);
  let active = false, vt = 0, last = 0, dir = 1, xF = -1, focusX = null;   // focusX: dorthin rückt die Kamera (null = nicht)
  function put(m, x, y, z, w, h, rot) {
    m.position.copy(stageToWorld(x, y, z)); m.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, rot)); m.scale.set(w, h, 1); m.visible = true;
  }
  function hide() { fly.visible = stand.visible = nut.visible = shadow.visible = false; }
  // Schatten: fast senkrecht unter dem Vogel (wie beim Start), am Wiesenrand ausgeblendet
  function shade(x, h, wk = 1) {
    shP.copy(stageToWorld(x, Math.max(0.05, h), Z)); const hh = Math.max(0.05, h);
    shP.addScaledVector(SUN_DIR, -0.22 * hh / SUN_DIR.y); shP.y = 0.02;
    const edge = 1 - Math.min(1, Math.max(0, (Math.hypot(shP.x, shP.z) - MR * 0.42) / (MR * 0.3)));
    shadow.position.copy(shP); shadow.quaternion.copy(SHQ);
    shadow.scale.set(LEN * (0.62 + hh * 0.5) * wk, LEN * (0.22 + hh * 0.18) * wk, 1);
    shadow.material.opacity = 0.5 * edge * (1 - 0.45 * __nightS.k) / (1 + hh * 0.9); shadow.visible = edge > 0.01;
  }
  // Flugpuppe mit der Schulter an (x, y), Blickrichtung dir, Neigung th (Bogenmaß, Nase hoch = dir · th > 0)
  function flyAt(x, y, th, t, c, withNut) {
    pup.update(t, c);
    fly.position.copy(stageToWorld(x, y, Z)); fly.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, th));
    fly.scale.set(dir * LEN, LEN, LEN); fly.visible = true; stand.visible = false;
    if (withNut) {
      const bx = dir * pup.beak[0] * LEN, by = pup.beak[1] * LEN, c2 = Math.cos(th), s2 = Math.sin(th);
      put(nut, x + c2 * bx - s2 * by + dir * HOLD.dx, y + s2 * bx + c2 * by + HOLD.dy, Z + 0.01, dir * NW, NH, dir * HOLD.rot + th);
    } else nut.visible = false;
    shade(x, y - 0.12);
  }
  // Stehbild: Füße bei (fx, fy), schaut nach face (±1), sy = Stauchen (an den Füßen)
  function standAt(fx, fy, face, peck, sy = 1) {
    stand.material.map = peck ? tex.peck : tex.stand;
    const cx = fx + face * (IMG.w / 2 - IMG.feet[0]) * K, cy = fy + (IMG.feet[1] - IMG.h / 2) * K * sy;
    put(stand, cx, cy, Z, face * SW, SH * sy, 0); fly.visible = false;
  }
  const beakAt = (fx, fy, face, peck, sy = 1) => { const b = peck ? IMG.beakP : IMG.beakS; return [fx + face * (b[0] - IMG.feet[0]) * K, fy + (IMG.feet[1] - b[1]) * K * sy]; };
  function nutInBeak(bx, by, face) { put(nut, bx + face * HOLD.dx, by + HOLD.dy, Z + 0.01, face * NW, NH, face * HOLD.rot); }

  function approach(t) {
    const u = t / TA, S0x = -dir * 3.4, S0y = 1.15, S1x = xF + dir * SHO[0], S1y = SHO[1];
    const at = (u) => [S0x + (S1x - S0x) * (1 - Math.pow(1 - u, 1.8)), S1y + (S0y - S1y) * Math.pow(1 - u, 2.2)];
    const [x, y] = at(u), [xa, ya] = at(Math.max(0, u - 0.01)), [xb, yb] = at(Math.min(1, u + 0.01));
    const vx = (xb - xa) || dir * 1e-6, vy = yb - ya;
    const flare = sm(0.72, 1, u);
    const th = Math.max(-0.45, Math.min(0.45, Math.atan(vy / vx) * 0.7)) + dir * 0.32 * flare;
    flyAt(x, y, th, t, u > 0.62 ? { hold: 1, e: 18 + 52 * flare } : null, true);
    focusX = u > 0.4 ? xF + dir * HOPX : null;
  }
  function ground(t) {
    let hx = 0, hy = 0, sy = 1;
    for (const h0 of HOPS) { const p = Math.min(1, Math.max(0, (t - h0) / HOP)); hx += sm(0, 1, p); if (p > 0 && p < 1) { hy = 0.06 * Math.sin(Math.PI * p); sy = 1.03; } }
    if (t < 0.35) sy = 1 - 0.07 * Math.sin(Math.PI * t / 0.35);                    // Aufsetzen
    if (t > TB - 0.5) sy = 1 - 0.09 * sm(TB - 0.5, TB - 0.12, t);                  // Ducken vor dem Abflug
    const fx = xF + dir * HOPX * hx, fy = 0.01 + hy;
    const face = t > 4.4 && t < 5.4 ? -dir : dir;                                   // schaut sich um
    const pk = PECKS.findIndex(([a, b]) => t >= a && t < b), peck = pk >= 0;
    standAt(fx, fy, face, peck, sy); focusX = xF + dir * HOPX;
    shade(fx, 0.06 + hy, 0.85 - hy);
    // Eichel: im Schnabel bis zum ersten Picken, dann am Boden; jedes weitere Picken drückt sie tiefer in die Erde
    const [gx] = beakAt(xF + dir * HOPX * HOPS.length, 0.01, dir, true);
    if (t < PECKS[0][0] + 0.12) { const [bx, by] = beakAt(fx, fy, face, peck, sy); nutInBeak(bx, by, face); }
    else {
      let d = SINK[0];
      for (let i = 1; i < PECKS.length; i++) { const [a, b] = PECKS[i]; d += (SINK[i] - SINK[i - 1]) * sm(a, b, t); }
      if (d < 1.2) put(nut, gx + dir * 0.012, NH * (0.42 - d), Z + 0.02, dir * NW, NH, dir * 0.15); else nut.visible = false;
    }
  }
  function leave(t) {
    const fx = xF + dir * HOPX * HOPS.length, S2x = fx + dir * SHO[0], S2y = SHO[1] * 0.92;
    const x = S2x + dir * (0.35 * t + 0.75 * t * t), y = S2y + 0.45 * t + 0.05 * t * t;
    const vx = dir * (0.35 + 1.5 * t), vy = 0.45 + 0.1 * t;
    const th = Math.atan(vy / vx) * 0.6 * sm(-0.05, 0.25, t);
    flyAt(x, y, th, t, t < 0.9 ? { hold: 0, freq: 1.5 } : null, false);
    focusX = t < 0.5 ? fx : null;
  }
  function play(o = {}) {
    if (reduceMotion || active) return false;
    dir = o.dir ?? (Math.random() < 0.5 ? 1 : -1);
    xF = -dir * (o.x ?? 0.62 + Math.random() * 0.14);                               // landet auf der Seite, von der er kommt, nah am Stamm
    vt = 0; last = nowMs(); pup.reset(); active = true; return true;
  }
  let phase = '';
  function frame() {
    const now = nowMs();
    if (!active) { last = now; return; }
    vt += Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    const t = window.__visitT ?? vt;
    const ph = t < TA ? 'a' : t < TA + TB ? 'b' : 'c';
    if (ph !== phase) { phase = ph; if (ph !== 'b') pup.reset(); }               // Puppe beginnt Anflug und Abflug von vorn
    if (t < TA) approach(t);
    else if (t < TA + TB) ground(t - TA);
    else if (t < TA + TB + TC) leave(t - TA - TB);
    else { active = false; phase = ''; focusX = null; hide(); }
  }
  function stop() { active = false; phase = ''; focusX = null; hide(); }
  return { play, frame, stop, get active() { return active; }, get focus() { return active ? focusX : null; }, DUR: TA + TB + TC };
})();

// Kamera während des Besuchs: rückt sanft ein wenig näher an den Häher und am Ende zurück
const visitCam = { k: 0, x: 0 };
function visitCamFrame(dt) {
  const f = visitFx.focus, want = f != null ? 1 : 0;
  if (f != null && visitCam.k < 0.01) visitCam.x = f;
  visitCam.k += (want - visitCam.k) * Math.min(1, dt * (want ? 0.9 : 0.7));
  if (window.__visitCamK != null) visitCam.k = window.__visitCamK;
  if (visitCam.k < 0.002) return;
  if (f != null) visitCam.x += (f - visitCam.x) * Math.min(1, dt * 1.2);
  const t = controls.target, offs = camera.position.clone().sub(t), dist = offs.length();
  const tgt = stageToWorld(visitCam.x * 0.75, 0.32, 0.25);
  const near = tgt.clone().addScaledVector(offs.normalize(), Math.min(dist, 4.2));
  const k = visitCam.k * visitCam.k * (3 - 2 * visitCam.k) * 0.35;   // nur leicht heran (Nutzer 23.10.)
  camera.position.lerp(near, k);
  camera.lookAt(t.clone().lerp(tgt, k));
}

// Baumloch: Lage am Stamm (einmal aus der Stammachse), sichtbar ab Stufe 6
const holeFx = (() => {
  // Astloch: klein, an der rechten Stammseite (Wohnast-Seite), etwas über der Kletterstelle. Für die Eule später größer:
  // z. B. { y: 2.2, ang: 15°, rx: 0.105, ry: 0.14 }
  const H = { y: 1.25, ang: 24 * Math.PI / 180, rx: 0.068, ry: 0.074 };   // fast rund, so breit wie der Körper des Eichhörnchens
  let placed = false, seg = null; const A = new V(), U = new V(), N = new V(), Rr = new V();
  function place() {
    if (!tree || !tree.pos || !rad) return;
    const kids = {}; for (let i = 1; i < tree.parent.length; i++) (kids[tree.parent[i]] = kids[tree.parent[i]] || []).push(i);
    let i = 0, prev = null;
    for (let k = 0; k < 400; k++) {
      const c = kids[i]; if (!c || !c.length) break;
      const j = c.reduce((a, b) => rad[b] > rad[a] ? b : a);
      if (tree.pos[i].y <= H.y && tree.pos[j].y >= H.y) { prev = [i, j]; break; }
      i = j;
    }
    if (!prev) return;
    const a = tree.pos[prev[0]], b = tree.pos[prev[1]], u = (H.y - a.y) / Math.max(1e-6, b.y - a.y); seg = [prev[0], prev[1], u];
    A.copy(a).lerp(b, u); U.copy(b).sub(a).normalize();
    N.copy(STAGE_D).multiplyScalar(Math.cos(H.ang)).addScaledVector(STAGE_R, Math.sin(H.ang));
    N.addScaledVector(U, -N.dot(U)).normalize(); Rr.crossVectors(U, N).normalize();
    tubeUniforms.uHoleA.value.copy(A); tubeUniforms.uHoleN.value.copy(N); tubeUniforms.uHoleR.value.copy(Rr); tubeUniforms.uHoleU.value.copy(U);
    tubeUniforms.uHoleS.value.set(H.rx, H.ry, 0);
    placed = true; window.__hole = { A: A.toArray(), N: N.toArray(), U: U.toArray(), R: Rr.toArray() };
  }
  function frame() {
    if (!placed) place();
    tubeUniforms.uHoleS.value.z = placed ? smooth((P - 5.5) / 0.5) : 0;
  }
  // Stammradius an der Lochhöhe (wächst mit der Stufe; dazu der Wurzelanlauf wie im Rinden-Shader, grob)
  function radius() { if (!seg || !rad) return 0.3; return (rad[seg[0]] * (1 - seg[2]) + rad[seg[1]] * seg[2]) * (1 + Math.exp(-H.y * 2.4) * 1.1); }
  return { frame, radius, get placed() { return placed; }, A, N, U, R: Rr, H };
})();

// ------------------------------------------------------------------ Eichhörnchen im Winter: Astloch, Ausflüge (23.10.)
// Im Winter wohnt das Eichhörnchen im kleinen Astloch an der rechten Stammseite (holeFx). Ab und zu kommt es heraus,
// klettert den Stamm hinunter, läuft aus dem Bild, kommt nach kurzer Zeit mit einer Eichel zurück und verschwindet
// wieder im Loch. Wächst der Baum im Winter auf Stufe 6, ist der Einzug dieser Rückweg (ohne Hinweg).
// Bilder und Wege: dieselben wie beim Einzug (gebackene Abfolge SEQS je Stufe: Lauf über die Wiese, Klettern); vom
// Ende des Kletterns klettert es weiter, leicht schräg, bis zum Loch (schmale Kletterbilder bleiben auf der Stammseite,
// die breiten Laufbilder ragten am Stammrand ins Leere). Am Loch (Nutzer 23.10. abends: „soll ins Loch gehen, nicht
// drunter krabbeln“): was schon hinter der Lochmitte ist, sieht man nur noch in der Öffnung, dort wird es zum Inneren
// hin dunkel; was darüber hinaus ragt, verdeckt die Rinde am oberen Lochrand. Heraus genauso, nur andersherum.
// Die Kamera zoomt dabei nicht (Nutzer). Uhr läuft nur, solange der Baum läuft.
const winterFx = (() => {
  const loader = new THREE.TextureLoader(), tex = {};
  for (const k of ['g4', 'g5', 'g6', 'g7', 'g8', 'k0', 'k1', 'k2', 'k3', 'k4', 'eichel']) { const t = loader.load(SEQIMG[k]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; tex[k] = t; }
  // Öffnung, wie man sie sieht: das dunkle Loch samt innerem Wulstring (so passt der Körper hindurch); seitlich durch die
  // Stammrundung etwas schmaler
  const OPEN = () => ({ x: holeFx.H.rx * 1.05, y: holeFx.H.ry * 1.12 });
  // Schnitt am Loch: uHc Lochmitte (Bild-Koordinaten 0…1), uHs Bildgröße, uHk cos/sin der Drehung, uHr Öffnung (Halbachsen),
  // uHm Richtung (+1 hinein: vorn = Bild-oben, −1 heraus: Bild ist kopfüber, „drin“ liegt bei Bild-unten), 0 = kein Schnitt
  const hc = { value: new THREE.Vector2() }, hs = { value: new THREE.Vector2(1, 1) }, hk = { value: new THREE.Vector2(1, 0) },
    hr = { value: new THREE.Vector2(1, 1) }, hm = { value: 0 };
  const mk = (order, clipped) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex.k0, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthTest: true, depthWrite: false, toneMapped: false }));
    // eigener Programm-Schlüssel: die Nachtfärbung hüllt onBeforeCompile ein, sonst teilte sich das Bild das Programm ohne Schnitt
    if (clipped) m.material.customProgramCacheKey = () => 'winterClip2';
    if (clipped) m.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uHc: hc, uHs: hs, uHk: hk, uHr: hr, uHm: hm });
      sh.fragmentShader = 'uniform vec2 uHc; uniform vec2 uHs; uniform vec2 uHk; uniform vec2 uHr; uniform float uHm;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
  if (uHm != 0.) {
    vec2 o = (vMapUv - uHc) * uHs;                                   // vom Lochmittelpunkt, Bild-Achsen
    vec2 wv = vec2(uHk.x * o.x - uHk.y * o.y, uHk.y * o.x + uHk.x * o.y); // Bühnen-Achsen
    float e = length(wv / uHr);                                       // < 1: in der Öffnung
    float w = uHm * o.y / uHr.y;                                      // > 0: schon hinter der Lochmitte (im Stamm)
    if (w > 0. && e >= 1.) discard;                                   // hinter der Rinde über dem Loch
    // zum Inneren hin dunkel; vorn läuft das am Lochrand aus (dort geht das Bild in den Teil vor der Rinde über)
    float deep = smoothstep(-.6, .45, w) * mix(1. - smoothstep(.8, 1., e), 1., smoothstep(-.2, .2, w));
    diffuseColor.rgb *= mix(1., .05, deep);
  }`);
    };
    m.material.color.setScalar(0.94); m.renderOrder = order; m.visible = false; scene.add(m); return m;
  };
  const spr = mk(22, true), nut = mk(23, false); nut.material.map = tex.eichel;
  // Nasenspitze je Bild (Anteil von Breite/Höhe, von oben links) – dort trägt es die Eichel
  const NOSE = { g4: [0.97, 0.43], g5: [0.97, 0.45], g6: [0.96, 0.67], g7: [0.96, 0.6], g8: [0.97, 0.52],
    k0: [0.97, 0.18], k1: [0.9, 0.12], k2: [0.63, 0.05], k3: [0.8, 0.07], k4: [0.85, 0.07] };
  const CLIMBF = ['k0', 'k1', 'k2', 'k3', 'k4'], SPEED = 0.9, FR = 70;   // weiter klettern bis zum Loch: u/s, ms je Bild
  const HEADX = 0;      // Versatz der Körperachse zur Bildmitte (Anteil der Breite, + = Bild-rechts): Kopf rechts, Rumpf links davon – Mitte passt
  const q = new THREE.Quaternion(), zA = new V(0, 0, 1);
  let path = null, mode = '', vt = 0, last = 0, next = -1, away = 0, hole = null;
  // Pfad: Einzugs-Abfolge bis zum Ende des Kletterns, dann schräg zum Loch und hindurch
  function build(st) {
    const q0 = SEQS[st] || SEQ, S = q0.samples;
    let end = 0; for (let i = 0; i < S.length; i++) { if (S[i][0][0] === 'k') end = i; else if (end && S[i][0][0] !== 'k') break; }
    const pts = S.slice(0, end + 1).map(s => ({ k: s[0], x: s[1], y: s[2], z: s[3], r: s[4], d: s[5] }));
    const H = holeStage(); if (!H) return null;
    const a0 = pts[pts.length - 1], f = SEQ.frames.k2, O = OPEN();
    // Kopf voran (Bild-oben) in Richtung Loch; Bildmitte so versetzt, dass der Kopf durch die Lochmitte geht
    const ang = Math.atan2(H.y - a0.y, H.x - a0.x), rot = ang - Math.PI / 2, c = Math.cos(ang), s = Math.sin(ang);
    const head = f.h * 0.46, side = f.w * HEADX;                          // Bild-rechts = (s, −c)
    const hx = H.x - s * side, hy = H.y + c * side;                       // Linie der Bildmitte
    const dx0 = hx - c * head - a0.x, dy0 = hy - s * head - a0.y;
    // bis auch die Schwanzspitze hinter dem oberen Lochrand ist
    const len = Math.hypot(dx0, dy0) + f.h * 1.0 + O.y * 1.15, ux = dx0 / Math.hypot(dx0, dy0), uy = dy0 / Math.hypot(dx0, dy0);
    const n = Math.max(2, Math.round(len / SPEED * 1000 / FR));
    // Tiefe: immer etwas vor der Rinde (sonst verdeckt der Stamm das Bild; das Hineinkriechen macht der Schnitt am Loch)
    const zEnd = Math.max(H.z + 0.16, a0.z - 0.05);
    for (let i = 1; i <= n; i++) {
      const d = i / n * len;
      pts.push({ k: CLIMBF[i % 5], x: a0.x + ux * d, y: a0.y + uy * d, z: a0.z + (zEnd - a0.z) * Math.min(1, d / Math.max(1e-3, len - f.h)), r: rot, d: FR, diag: true });
    }
    let t = 0; for (const p of pts) { p.t = t; t += p.d; }
    return { pts, total: t, H, ang };
  }
  // Lochmitte in Bühnen-Koordinaten (x entlang STAGE_R, y Höhe, z entlang STAGE_D), auf der Rinde
  function holeStage() {
    if (!holeFx.placed) return null;
    const r = holeFx.radius() * 1.04, w = holeFx.A.clone().addScaledVector(holeFx.N, r);
    return { x: w.dot(STAGE_R), y: w.y, z: w.dot(STAGE_D) };
  }
  function setQuad(m, key, x, y, z, rot, mirror) {
    const f = SEQ.frames[key]; m.material.map = tex[key];
    m.userData.ref = stageToWorld(x, y, SEQ.zref); m.userData.zd = z;
    m.userData.base = new V(f.w * (mirror ? -1 : 1), f.h, 1);
    m.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, rot)); m.visible = true;
  }
  function late() { for (const m of [spr, nut]) if (m.visible && m.userData.ref) depthPlace(m, m.userData.ref, m.userData.base, m.userData.zd); }
  // Stelle t (ms) im Pfad: vorwärts = Rückweg (mit Eichel), rückwärts = Hinweg
  function at(t) {
    const P2 = path.pts; let lo = 0, hi = P2.length - 1, i = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (P2[m].t <= t) { i = m; lo = m + 1; } else hi = m - 1; }
    return P2[i];
  }
  function show(p, back, withNut) {
    // rückwärts: Laufbilder gespiegelt (läuft nach links), Kletterbilder kopfvoran nach unten – gedreht UND gespiegelt
    // (= senkrecht gekippt), so bleibt der Bauch zum Stamm bzw. nach unten (Nutzer 23.10.: nur gedreht lag es „auf dem
    // Rücken“) und passt zum Übergang ins Laufen unten (gespiegeltes Laufbild, hochgedreht)
    const k = p.k, climb = k[0] === 'k';
    const mirror = back, rot = back && climb ? p.r + Math.PI : p.r;
    setQuad(spr, k, p.x, p.y, p.z, rot, mirror);
    hm.value = 0;
    const O = OPEN(), c = Math.cos(rot), s = Math.sin(rot), dir = back ? -1 : 1;
    if (p.diag) {
      // Am Loch: Lochmitte in Bild-Koordinaten; ganz hinter dem oberen Rand → gar nicht mehr zeichnen
      const f = SEQ.frames[k], dx = path.H.x - p.x, dy = path.H.y - p.y;
      const sx = mirror ? -1 : 1;                                         // gespiegelt: Bild-x läuft gegen Bild-rechts
      const u = sx * (c * dx + s * dy) / f.w + 0.5, v = (-s * dx + c * dy) / f.h + 0.5;
      hc.value.set(u, v); hs.value.set(sx * f.w, f.h); hk.value.set(c, s); hr.value.set(O.x, O.y); hm.value = dir;
      const outer = back ? (1 - v) * f.h : v * f.h;                       // äußerstes Ende (Schwanz bzw. Kopf) bis zur Lochmitte
      if (outer < -O.y * 1.02) spr.visible = false;
    }
    if (withNut) {
      const f = SEQ.frames[k], nz = NOSE[k] || [0.95, 0.5], sx = mirror ? -1 : 1;
      const nx = (nz[0] - 0.5) * f.w * sx, ny = (0.5 - nz[1]) * f.h;
      const ex = p.x + c * nx - s * ny, ey = p.y + s * nx + c * ny - 0.02;
      let shade = 1, hidden = false;
      if (p.diag) {
        // Eichel an der Nase: wie das Bild – in der Öffnung dunkler, dahinter weg
        const ox = ex - path.H.x, oy = ey - path.H.y, w = dir * (-s * ox + c * oy) / O.y, e = Math.hypot(ox / O.x, oy / O.y);
        hidden = w > 0.55 || (w > 0 && e > 0.85);
        const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
        const deep = sm(-0.6, 0.45, w) * (w < 0 ? 1 - sm(0.8, 1, e) : 1);
        shade = 1 - 0.95 * deep;
      }
      if (hidden) nut.visible = false;
      else { const fe = SEQ.frames.eichel; nut.material.map = tex.eichel; nut.material.color.setScalar(0.94 * shade);
        nut.userData.ref = stageToWorld(ex, ey, SEQ.zref); nut.userData.zd = p.z - 0.01;
        nut.userData.base = new V(fe.w, fe.h, 1); nut.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, rot - 0.3)); nut.visible = true; }
    } else nut.visible = false;
  }
  function hide() { spr.visible = nut.visible = false; hm.value = 0; }
  const can = () => P > 5.95 && season === 'winter' && !reduceMotion && !__isNight() && !trans && !moveIn && !jayFx.active && !visitFx.active && !seqPlayer.active();
  // Ausflug: 'out' (aus dem Loch, aus dem Bild), Pause, 'in' (mit Eichel zurück ins Loch)
  function start(onlyIn) {
    path = build(Math.min(10, Math.max(6, Math.round(P)))); if (!path) return false;
    mode = onlyIn ? 'in' : 'out'; vt = 0; last = nowMs(); return true;
  }
  function frame() {
    const now = nowMs(), dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    if (!mode) {
      hide();
      if (next < 0) next = 15 + Math.random() * 25;                       // erster Ausflug nach 15–40 s
      if (can()) { next -= dt; if (next <= 0 && !window.__winterHold) { start(false); next = 90 + Math.random() * 90; } }
      return;
    }
    if (P < 5.95 || season !== 'winter') { mode = ''; hide(); return; }
    vt += dt * 1000; const t = window.__winterT ?? vt;
    if (mode === 'out') {
      if (t >= path.total) { mode = 'away'; away = 4000 + Math.random() * 4000; vt = 0; hide(); return; }
      show(at(path.total - t), true, false);
    } else if (mode === 'away') {
      hide(); if (t >= away) { mode = 'in'; vt = 0; }
    } else if (mode === 'in') {
      if (t >= path.total) { mode = ''; hide(); return; }
      show(at(t), false, true);
    }
  }
  return { frame, late, start, stop() { mode = ''; hide(); }, get active() { return !!mode; }, get mode() { return mode; }, get total() { return path ? path.total : 0; } };
})();
window.__winterFx = winterFx;   // für Prüf-Skripte
// ------------------------------------------------------------------ Bedienung
const slider = $id('slider');
const stageLbl = $id('stagelbl');
// Regler-Position u (0..1) <-> Wachstum T des Baums: jede Baumstufe bekommt gleich viel Platz
function knots() { return treeKnots; }
function uToT(u) { const k = knots(), x = u * (k.length - 1), i = Math.min(k.length - 2, Math.floor(x)); return k[i] + (k[i + 1] - k[i]) * (x - i); }
function tToU(t) { const k = knots(); for (let i = 0; i < k.length - 1; i++) if (t <= k[i + 1]) return (i + (t - k[i]) / Math.max(1e-6, k[i + 1] - k[i])) / (k.length - 1); return 1; }
// P = Stufe 1..10 (feste, vorberechnete Baumstufen; Werte dazwischen nur während eines Übergangs)
const NSTAGE = 10;
let P = 10;
function PtoT(p) { return uToT(Math.min(1, Math.max(0, p / NSTAGE))); }
function updateLabel() {
  const k = Math.min(NSTAGE, Math.max(0, Math.round(P)));
  stageLbl.textContent = `Stufe ${k} von ${NSTAGE}`;
  slider.value = Math.round(Math.max(0, P));
}
let anim = null;
function animateTo(target, ms, linear = false) {
  const from = P, t0 = performance.now();
  anim = (now) => {
    const u = Math.min(1, (now - t0) / ms);
    const e = linear ? u : (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
    P = from + (target - from) * e;
    if (u >= 1) { P = target; anim = null; }
  };
}
$id('next').onclick = () => startTransition(Math.round(P) + 1);
$id('next2').onclick = () => startTransition(Math.round(P) + 2);
$id('play').onclick = () => { trans = null; P = 1; animateTo(NSTAGE, reduceMotion ? 600 : 24000, true); };
$id('sqzoom').onclick = () => focusSquirrel();
$id('jayrun').onclick = () => { anim = null; trans = null; P = 0; jayFx.play(); };
$id('sqrun').onclick = () => { seqCam.x = -1.3; zoom.seq = zoom.seqNow = 1; seqPlayer.play(); };
$id('reset').onclick = () => { anim = null; trans = null; stageFx.clear(); P = 1; };
slider.oninput = () => { anim = null; trans = null; P = +slider.value; };
__ui.querySelectorAll('[data-season]').forEach(b => b.onclick = () => {
  yearDay = { fruehling: 14, sommer: 42, herbst: 70, winter: 98 }[b.dataset.season]; applyYear(yearDay);
});
$id('year').oninput = (e) => { yearDay = +e.target.value; applyYear(yearDay); };
$id('yearplay').onclick = (e) => { yearPlay = !yearPlay; e.target.textContent = yearPlay ? 'Anhalten' : 'Jahr abspielen'; };
const __ro = new ResizeObserver(() => { camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H()); if (!__running && __loop) renderer.render(scene, camera); });
__ro.observe(host);

// ------------------------------------------------------------------ Start
setTimeout(async () => {
  await __bakedLoad(yearDay);
  build();
  T = PtoT(P);
  updateTree();
  // Alle Grafikprogramme für alle Qualitätsstufen vorab übersetzen (sonst ruckelt jeder Wechsel sekundenlang)
  __nightFx = OPT.nightFx === false ? null : __makeNightFx(); __nightAll([leafMats.std, leafMats.lam]); __nightApply(); if (__nightFx) __nightFx.update(__nightS.k);
  for (let l = QUALITY.length - 1; l >= 0; l--) { setQuality(l); await renderer.compileAsync(scene, camera); }
  // zuletzt gefundene Stufe dieses Geräts (nur hier im Browser gespeichert)
  let savedQ = 0; try { savedQ = Math.min(QUALITY.length - 1, Math.max(0, parseInt(localStorage.getItem('vanamoBaumQ4') || '0', 10) || 0)); } catch (e) {}
  setQuality(savedQ);
  $id('loading').hidden = true;
  const clock = new THREE.Clock(); let frameH = -1;
  // FPS-Anzeige: Mittel über eine halbe Sekunde
  const fpsEl = $id('fps');
  let fFrames = 0, fT0 = performance.now(), fWorst = 0, fLast = performance.now(), frameNo = 0, lowCount = 0, highCount = 0, settleUntil = performance.now() + 2000;
  let probing = -1, probeUntil = 0;              // gerade ausprobierte höhere Stufe
  // Zu langsame Stufen werden vorübergehend gesperrt: 20 s, beim nächsten Mal 60 s, dann 180 s … (nur in dieser Sitzung)
  const blockUntil = new Array(QUALITY.length).fill(0), blockHits = new Array(QUALITY.length).fill(0);
  const isBlocked = (l, t) => t < blockUntil[l];
  renderer.shadowMap.autoUpdate = false;
  __loop = (now) => {
    if (__resumed) { __resumed = false; clock.getDelta(); fFrames = 0; fT0 = fLast = performance.now(); settleUntil = fT0 + 1500; }
    if (anim) anim(performance.now());
    const dtC = Math.min(0.1, clock.getDelta());
    transFrame(nowMs(), dtC);
    T = PtoT(P);
    leafUniforms.uTime.value = window.__vt != null ? window.__vt / 1000 : clock.elapsedTime;
    leafUniforms.uSunView.value.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
    __nightTick(performance.now()); if ((frameNo & 63) === 0) __nightAll();
    updateTree();
    updateLabel();
    // Ausschnitt folgt der Größe: nah beim Samen, weit beim großen Baum
    const treeTop = P > 2 && mY ? mY[0] : 0;
    // Kamera steht fast fest: nur am Anfang nah am Keimling, bis Stufe 4 sanft hinaus auf den Platz für den ausgewachsenen Baum
    const Hfull = Math.max(tree.H * 1.05, 9);
    const plantH = Math.max(0.25, grownTop);
    const Ht = window.__camRule === 'fest' ? Hfull : window.__camRule === 'alt' ? Math.min(Hfull, Math.max(0.5, plantH * 2.1))
      : Math.min(Hfull, Hfull * Math.pow(Math.min(1, plantH / tree.H), 0.55));
    frameH += (Ht - frameH) * Math.min(1, dtC * 2);
    if (window.__snapFrame || frameH < 0) frameH = Ht;

    const aspK = camera.aspect < 1 ? Math.pow(1 / camera.aspect, 0.75) : 1;
    // Baumfuß bei ~30 % Bildhöhe (über der Bedienleiste), Spitze bei ~90 %
    zoom.userNow += (zoom.user - zoom.userNow) * Math.min(1, dtC * 8); zoom.seqNow += (zoom.seq - zoom.seqNow) * Math.min(1, dtC * 8);
    const zIn = frameH > 3 ? smooth((1 - zoom.userNow) / 0.8) : 0;      // beim Hineinzoomen etwas tiefer zielen (Stamm, Wohnast)
    const dist = (frameH * 2.9 + 0.5) * aspK * zoom.userNow;
    const elev = 0.42 + (0.1 - 0.42) * smooth(frameH / 4);
    const offs = camera.position.clone().sub(controls.target); const az = Math.atan2(offs.x, offs.z);
    controls.target.set(0, frameH * FRAME_Y + (1.9 - frameH * FRAME_Y) * zIn * 0.7, 0);
    camera.position.set(Math.sin(az) * Math.cos(elev) * dist, controls.target.y + Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
    if (window.__camOv) { camera.position.fromArray(window.__camOv.p); controls.target.fromArray(window.__camOv.t); camera.lookAt(controls.target); } else if (window.__closeCam) { camera.position.set(1.6, 1.4, 4.2); controls.target.set(0, 1.1, 0); camera.lookAt(controls.target); } else controls.update();
    if (window.__sqFrame) window.__sqFrame(dtC, clock.elapsedTime);
    frameNo++;
    if (shadowDirty || frameNo % QUALITY[qLevel].shadowEvery === 0) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    if (window.__sqLate) window.__sqLate();
    renderer.render(scene, camera);
    if (window.__sqAfter) window.__sqAfter();
    const nowF = performance.now(), dtF = nowF - fLast; fLast = nowF;
    fFrames++; if (dtF > fWorst) fWorst = dtF;
    if (nowF - fT0 >= 500) {
      const fps = fFrames * 1000 / (nowF - fT0);
      fpsEl.textContent = `${fps.toFixed(0)} fps · ${(1000 / fps).toFixed(1)} ms (max ${fWorst.toFixed(0)}) · Pixel ×${renderer.getPixelRatio().toFixed(2)} · Qualität ${QUALITY.length - qLevel}/${QUALITY.length}`;
      // Automatik: zu langsam -> gleich so viele Stufen herunter wie nötig; viel Luft -> eine Stufe hoch probieren
      if (anim || trans) settleUntil = Math.max(settleUntil, nowF + 1000);   // während des Wachsens nicht messen (Astberechnung kostet extra)
      if (nowF > settleUntil && !document.hidden && !window.__noAuto) {
        // ab ~30 fps wirkt der langsam wachsende Baum flüssig; kurze Einbrüche abwarten (erst nach ~5 s überwiegend zu langsam herunter)
        lowCount = fps < 30 ? lowCount + 1 : Math.max(0, lowCount - 2);
        highCount = fps > 35 ? highCount + 1 : 0;
        if (lowCount >= 10 && qLevel < QUALITY.length - 1) {
          const failedProbe = probing === qLevel;
          blockHits[qLevel]++;
          const until = nowF + 20000 * Math.pow(3, blockHits[qLevel] - 1);
          for (let b = 0; b <= qLevel; b++) blockUntil[b] = Math.max(blockUntil[b], until);   // diese und alle höheren Stufen vorerst nicht
          probing = -1;
          // jede Stufe bringt grob 30 % mehr fps -> nötige Schritte abschätzen (nach gescheiterter Probe genau 1 zurück)
          const steps = failedProbe ? 1 : Math.min(2, Math.max(1, Math.ceil(Math.log(34 / Math.max(fps, 1)) / Math.log(1.3))));   // höchstens 2 Stufen auf einmal
          setQuality(Math.min(QUALITY.length - 1, qLevel + steps)); saveQ();
          lowCount = highCount = 0; settleUntil = nowF + 1000;
        } else if (highCount >= 6 && qLevel > 0 && !isBlocked(qLevel - 1, nowF)) {
          setQuality(qLevel - 1); probing = qLevel; probeUntil = nowF + 5000;   // 3 s über 35 fps: eine Stufe höher probieren
          lowCount = highCount = 0; settleUntil = nowF + 1000;
        }
        if (probing >= 0 && nowF > probeUntil) { probing = -1; saveQ(); }   // Probe bestanden
      }
      fFrames = 0; fT0 = nowF; fWorst = 0;
    }
  };
  if (!OPT.paused) { renderer.setAnimationLoop(__loop); __running = true; } else renderer.render(scene, camera);
  window.__tree = () => ({ pos: tree.pos.map(p => [p.x, p.y, p.z]), rad: Array.from(rad), parent: Array.from(tree.parent) }); window.__leaf = leafMesh; window.__scene = scene; window.__m = () => ({ grownTop, crownW, r0: rad ? rad[0] : 0, T, P, H: tree.H, ks: treeKnots });
  window.__baum = { jay: () => { anim = null; trans = null; P = 0; jayFx.play(); }, go: t => startTransition(t), setDay: d => { yearDay = d; applyYear(d); }, year: () => yearSt, play: v => { yearPlay = v; },
    setP: v => { anim = null; P = v; }, setT: v => { anim = null; P = tToU(v) * NSTAGE; }, get stages() { return stages; }, get Tmax() { return tree.Tmax; }, setSeason: s => __ui.querySelector(`[data-season=${s}]`).click(), setQ: l => setQuality(l), focus: () => focusSquirrel(), az: d => { const t = controls.target, r = camera.position.clone().sub(t), h = Math.hypot(r.x, r.z), a = AZ0 + d; camera.position.set(t.x + Math.sin(a) * h, camera.position.y, t.z + Math.cos(a) * h); }, place: () => squirrel.place(), seq: (ms) => { if (ms == null) { window.__seqFix = null; } else { if (!seqPlayer.active()) seqPlayer.play(); window.__seqFix = ms; } }, seqPlay: () => seqPlayer.play(), seqTotal: () => seqPlayer.total };
  __readyRes();
}, 30);

if (OPT.stage != null) P = OPT.stage;
if (OPT.day != null) yearDay = OPT.day;
// Nacht: beim Start sofort im richtigen Zustand; danach weich dem Tag/Nacht-Knopf folgen
__nightS.k = __nightS.target = (OPT.night ?? __isNight()) ? 1 : 0; __nightS.ready = true; __nightApply();
function __nightFollow(on, instant) {
  __nightS.target = on ? 1 : 0;
  if (instant || !__running || reduceMotion) { __nightS.k = __nightS.target; __nightApply(); if (__nightFx) __nightFx.update(__nightS.k); if (!__running && __loop) renderer.render(scene, camera); }
}
const __nightMO = new MutationObserver(() => { if (OPT.night == null) __nightFollow(__isNight()); });
__nightMO.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-mode', 'data-theme'] });

// ------------------------------------------------------------------ Schnittstelle für die App
const __api = {
  ready: __ready,
  canvas: renderer.domElement,
  /** Stufe direkt setzen (ohne Übergang) */
  setStage(n) { anim = null; trans = null; moveIn = 0; P = n; visitFx.stop(); },
  /** zur Stufe n wachsen – mit Windstoß und fallenden Blättern (mehrere Stufen = ein längerer Übergang) */
  grow(n) { startTransition(n); },
  get stage() { return P; },
  /** Tag im Vanamo-Jahr (0–112) */
  setDay(d) { yearDay = d; applyYear(d); },
  /** der Eichelhäher bringt die Eichel (Stufe 0); onLand: sobald sie im Gras liegt */
  jay(onLand) { anim = null; trans = null; P = 0; visitFx.stop(); jayFx.play(onLand); },
  /** Eichel im Gras zeigen (true) oder noch nicht (false, vor dem Häher) */
  seed(on) { jayFx.seed(!!on); },
  /** Besuch des Eichelhähers (ab Stufe 1, ca. 12 s); false, wenn er gerade nicht kommen kann. o: { dir: ±1, x } */
  visit(o) { return P >= 0.98 && !trans && !jayFx.active ? visitFx.play(o) : false; },
  /** läuft gerade ein Übergang, der Start oder ein Besuch? */
  get busy() { return !!trans || !!anim || !!moveIn || jayFx.active || visitFx.active || seqPlayer.active() || winterFx.active; },
  /** Test: Ausflug des Eichhörnchens im Winter jetzt starten (true: nur der Rückweg ins Loch) */
  winterTrip(onlyIn) { return winterFx.start(!!onlyIn); },
  /** anhalten: die Leinwand zeigt weiter das letzte Bild (Standbild) */
  pause() { if (__running) { renderer.setAnimationLoop(null); __running = false; } },
  resume() { if (!__running && __loop) { __resumed = true; renderer.setAnimationLoop(__loop); __running = true; } },
  get running() { return __running; },
  /** Nacht ein/aus (sonst folgt der Baum html[data-theme-mode]); instant: ohne Überblenden */
  setNight(on, instant = false) { __nightFollow(!!on, instant); },
  get night() { return __nightS.k; },
  dispose() { this.pause(); __ro.disconnect(); __nightMO.disconnect(); renderer.dispose(); renderer.domElement.remove(); },
  /** ein Bild rechnen und die Leinwand sofort an cb geben (z. B. zum Abzeichnen fürs Milchglas) */
  capture(cb) { renderer.render(scene, camera); cb(renderer.domElement); },
  /** zoomen: f < 1 näher heran, f > 1 weiter weg (nie weiter als der Startausschnitt) */
  zoomBy(f) { zoomBy(f); },
  /** wie weit hineingezoomt: 1 = Startausschnitt, kleiner = näher */
  get zoom() { return zoom.user / __zoomBase; },
  /** Ausschnitt umstellen: { zoom, frameY } (Grundzoom = weitester Ausschnitt; kleiner = näher); ohne Angaben = Start */
  setFrame(o = {}) {
    FRAME_Y = o.frameY ?? (OPT.frameY ?? 1 / 3);
    __zoomBase = o.zoom ?? __zoomBase0; __zoomMax = OPT.page ? __zoomBase : 1.25;
    zoom.user = __zoomBase; if (o.instant) zoom.userNow = __zoomBase;
    if (!__running && __loop) { __loop(performance.now()); }
  },
  /** genau ein Bild rechnen (für Prüf-Skripte/Videos mit der Testuhr window.__vt) */
  step() { if (__loop) __loop(performance.now()); },
};
window.__baumApi = __api;   // für Prüf-Skripte
window.__baumCam = () => ({ p: camera.position.toArray(), t: controls.target.toArray() });   // für platzhalter.mjs
// Für backen.mjs: Wachstum und alle Atlanten selbst rechnen und herausgeben
window.__baumBake = () => {
  const t = tree, N = t.N, f3 = (a) => { const o = new Float32Array(N * 3); a.forEach((v, i) => { o[i * 3] = v.x; o[i * 3 + 1] = v.y; o[i * 3 + 2] = v.z; }); return o; };
  const atl = {}; for (const sn of SNAMES) { atl['blatt-' + sn] = leafAtlasData(sn); atl['wiese-' + sn] = meadowAtlasCache[sn] || (meadowAtlasCache[sn] = paintMeadowAtlas(sn)); }
  return { head: { N, rnd: __lastTreeRnd, layerStart: t.layerStart, Tmax: t.Tmax },
    arrays: [t.hideAt, f3(t.pos), t.deadAt, t.parent, t.birth, f3(t.dir), t.sLen], atl, S: { blatt: 1024, wiese: MATLAS } };
};
return __api;
}
