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
const __nightPics = [], __picMeshes = new Set();   // gemalte Bilder (__picMeshes: die Figuren dazu, für den Baumschatten)
// (MeshBasic ohne Tone Mapping): reagieren nicht aufs Licht → nachts per Farbe abdunkeln
function __nightPic(m) {
  if (!m || m.userData.__pic || !m.isMeshBasicMaterial || m.toneMapped !== false || m.colorWrite === false || !m.map) return;
  m.userData.__pic = m.color.clone(); __nightPics.push(m);
  m.color.copy(m.userData.__pic).multiplyScalar(__mix(1, m.userData.__picN ?? __NIGHT.pics[1], __nightS.k));   // __picN: eigener Nachtwert (Fledermäuse)
}
function __nightAll(extra = []) {
  let n = 0;
  scene.traverse(o => { for (const x of [].concat(o.material || [])) { if (__nightify(x)) n++; __nightPic(x); if (x && x.userData.__pic && o.isMesh) __picMeshes.add(o); } });
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
  for (const m of __nightPics) m.color.copy(m.userData.__pic).multiplyScalar(__mix(1, m.userData.__picN ?? N.pics[1], k));
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
const tubeUniforms = { uSpA: { value: new V() }, uSpN: { value: new V(0, 0, 1) }, uSpR: { value: new V(1, 0, 0) }, uSpU: { value: new V(0, 1, 0) }, uSpS: { value: new THREE.Vector4(0.045, 0.05, 0, 0) },
  uAnA: { value: new V() }, uAnN: { value: new V(0, 0, 1) }, uAnR: { value: new V(1, 0, 0) }, uAnU: { value: new V(0, 1, 0) }, uAnS: { value: new V(0.009, 0.032, 0) },
  uHoleA: { value: new V() }, uHoleN: { value: new V(0, 0, 1) }, uHoleR: { value: new V(1, 0, 0) }, uHoleU: { value: new V(0, 1, 0) }, uHoleS: { value: new V(0.105, 0.14, 0) }, uBare: { value: 0 }, uBend: { value: 0 }, uBendH: { value: 1 }, uRelief: { value: 1 }, uSnow: { value: 0 }, uBarkC: { value: barkTex(BARK_C, true) }, uBarkN: { value: barkTex(BARK_N, false) },
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

// Buntspecht (28.10.): Höhle uSp* (Mitte auf der Stammachse, Normale, rechts, oben; uSpS = rx, ry, Bau 0…1, Alter 0…1) und
// Rindenspalte der Schmiede uAn* (Punkt auf der Rinde; uAnS = halbe Breite, halbe Höhe, sichtbar)
uniform vec3 uSpA; uniform vec3 uSpN; uniform vec3 uSpR; uniform vec3 uSpU; uniform vec4 uSpS;
uniform vec3 uAnA; uniform vec3 uAnN; uniform vec3 uAnR; uniform vec3 uAnU; uniform vec3 uAnS;
float gSpIn;
float spHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float spNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(spHash(i), spHash(i + vec2(1., 0.)), f.x), mix(spHash(i + vec2(0., 1.)), spHash(i + vec2(1., 1.)), f.x), f.y); }
vec3 spechtRinde(vec3 col, vec3 P) {
  gSpIn = 0.;
  if (uSpS.z > .001) {
    vec3 hp = P - uSpA;
    vec2 d = vec2(dot(hp, uSpR) / uSpS.x, dot(hp, uSpU) / uSpS.y);
    if (dot(hp, uSpN) > 0. && abs(d.x) < 1.8 && d.y > -4.6 && d.y < 1.8) {   // nur in der Nähe der Höhle rechnen
      float e = length(d);
      float pr = uSpS.z, age = uSpS.w;
      float n = spNoise(d * 2.6 + 3.1), n2 = spNoise(d * 7.5 + 9.7), n3 = spNoise(vec2(d.x * 13., d.y * 2.2) + 1.3);
      vec3 wood = mix(vec3(.78, .65, .47), vec3(.47, .42, .36), age);          // frisch hell → verwittert graubraun
      wood *= .8 + .32 * n3;                                                 // Holzfasern (senkrecht)
      // Rinde abgeschlagen: anfangs einzelne Hackspuren, dann geschlossene Fläche, die mit dem Loch wächst
      float cr = mix(.5, 1.22, smoothstep(0., .35, pr));
      float chip = (1. - smoothstep(cr - .1, cr, e + (n - .5) * .3)) * smoothstep(0., .03, pr);
      chip *= mix(step(.5, n2), 1., smoothstep(.08, .3, pr));
      chip *= 1. - .7 * age;                                                 // mit den Wochen wächst der Rand wieder zu
      col = mix(col, wood, chip);
      // Mulde → Loch: wird größer und tiefer
      float hr = mix(.25, 1., smoothstep(.1, .8, pr));
      float depth = smoothstep(.16, .85, pr);
      float he = e + (n - .5) * .16 * (1. - smoothstep(.7, 1., pr));         // fertig: runder
      float inner = 1. - smoothstep(hr * .86, hr, he);
      vec2 dd = d / hr;
      vec3 cav = mix(wood * .55, vec3(.045, .03, .02), depth);
      cav = mix(cav, wood * .42, smoothstep(.2, -.9, dd.y) * .55 * depth);    // unten sieht man die Innenwand
      cav *= mix(1., .35, smoothstep(.55, .98, he / hr) * smoothstep(-.1, .6, dd.y) * depth);   // Schatten unter dem oberen Rand
      float inn = inner * smoothstep(0., .1, pr);
      col = mix(col, cav, inn);
      // heller frischer Rand direkt um die Öffnung
      float rim = smoothstep(hr * .92, hr * 1.0, he) * (1. - smoothstep(hr + .05, hr + .16, he));
      col = mix(col, wood * 1.06, rim * depth * (1. - .55 * age));
      // alt: dunkle Spur unter dem Eingang (der Vogel schlüpft dort ein und aus)
      float stain = smoothstep(.3, -1.7, d.y) * smoothstep(-4.5, -2.4, d.y) * (1. - smoothstep(.35, .95, abs(d.x))) * step(1., e) * age;
      col *= 1. - .22 * stain;
      gSpIn = max(chip * .5, inn);
    }
  }
  // Schmiede: kurze Rindenspalte
  if (uAnS.z > .001) {
    vec3 ap = P - uAnA;
    if (dot(ap, uAnN) > -.05) {
      vec2 d = vec2(dot(ap, uAnR) / uAnS.x, dot(ap, uAnU) / uAnS.y);
      if (abs(d.y) < 1.4 && abs(d.x) < 3.) {
        float n = spNoise(vec2(d.y * 6., 1.7));
        float wdt = (1. - d.y * d.y) * (.55 + .45 * n);
        float slit = (1. - smoothstep(wdt * .7, wdt, abs(d.x + (n - .5) * .3))) * step(abs(d.y), 1.);
        float lip = (1. - smoothstep(wdt, wdt * 2.4, abs(d.x))) * (1. - smoothstep(.8, 1.3, abs(d.y)));
        col = mix(col, col * 1.25 + .03, lip * .5 * uAnS.z);                    // abgewetzte Kante
        col = mix(col, vec3(.04, .03, .02), slit * uAnS.z);
      }
    }
  }
  return col;
}
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
        diffuseColor.rgb = mix(diffuseColor.rgb, holeC, holeIn);
        diffuseColor.rgb = spechtRinde(diffuseColor.rgb, vRestP);   // Buntspecht: Höhle und Schmiede`)
      .replace('#include <normal_fragment_maps>', `
        // Relief aus der Normal-Textur der Rinde
        { vec3 tn = gBarkN; tn.xy *= mix(.6, 1.2, uRelief);
          normal = normalize(-normalize(vTU) * tn.x + normalize(vTV) * tn.y + normal * max(tn.z, .2)); }
        // Wulst am Lochrand: innen zur Öffnung hin geneigt, außen nach außen abfallend; innen ohne Rindenrelief
        if (holeRim + holeIn > .001) {
          vec3 dV = normalize(mat3(viewMatrix) * (uHoleR * holeD.x + uHoleU * holeD.y) + 1e-5);
          float k = sin((holeE - 1.0) * 9.) * holeRim;                       // Wülste: abwechselnd zur Öffnung hin und weg
          normal = normalize(normal * (1. - .3 * holeRim) + dV * k * .75);
          normal = normalize(mix(normal, normalize(mat3(viewMatrix) * uHoleN), holeIn * .7)); }
        if (gSpIn > .001) normal = normalize(mix(normal, normalize(mat3(viewMatrix) * uSpN), gSpIn * .6));   // Spechthöhle: innen glatt`)
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
const leafUniforms = { uCrownC: { value: new V(0, 4, 0) }, uCrownR: { value: new V(3, 2.5, 3) }, uSun: { value: SUN_DIR }, uTime: { value: 0 }, uWind: { value: reduceMotion ? 0 : 1 }, uGust: { value: 0 }, uGustX: { value: -9 }, uSeasonU: { value: 0 }, uSeasonMode: { value: 0 }, uDropU: { value: 0 }, uLeafB: { value: null }, uBend: tubeUniforms.uBend, uBendH: tubeUniforms.uBendH, uLeafScale: { value: 1 }, uDensity: { value: 1 }, uGlow: { value: 0.1 }, uSunView: { value: new V() }, uBack: { value: 1 }, uFakeSh: { value: 0 }, uFakeK: { value: 1.0 }, uFakeA: { value: -0.12 }, uFakeW: { value: 0.28 }, uFakeN: { value: 1.0 } };
window.__leafU = leafUniforms;   // Prüfhilfe (Laub-Uniforms)
const LEAFV = /* glsl */`
attribute float aGrow; attribute vec3 aCol; attribute float aPhase; attribute vec2 aUVo;
uniform vec3 uCrownC; uniform vec3 uCrownR; uniform vec3 uSun; uniform float uTime; uniform float uWind; uniform float uLeafScale; uniform float uDensity; uniform float uGust; uniform float uGustX; uniform float uBend; uniform float uBendH; uniform float uSeasonU; uniform float uSeasonMode; uniform float uDropU;
varying float vMix;
varying vec3 vLeafCol; varying float vSunSide; varying float vFakeSh; uniform float uFakeK; uniform float uFakeA; uniform float uFakeW; uniform float uFakeN;
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
      .replace('#include <begin_vertex>', LEAF_BEGIN + `
        { vec3 wv = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;
          vec3 q = (wv - uCrownC) / uCrownR, sN = normalize(uSun / uCrownR);
          float b = dot(q, sN), c = dot(q, q) - 1., disc = b * b - c, od = 0.;
          if (disc > 0.) { float sq = sqrt(disc); od = max(0., -b + sq) - max(0., -b - sq); }
          float gap = vnoise3(wv * 1.6 + 11.) * .6 + vnoise3(wv * 3.7 + 3.) * .4;
          vFakeSh = 1. - uFakeK * smoothstep(uFakeA, uFakeA + uFakeW, od + (gap - .5) * uFakeN); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFakeSh; uniform float uFakeSh;\nvarying vec3 vLeafCol; varying float vSunSide; uniform float uGlow; uniform vec3 uSunView; uniform float uBack; varying float vMix; uniform sampler2D uLeafB;')
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <map_fragment>', '#include <map_fragment>\n if (vMix > .001) diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * texture2D(uLeafB, vMapUv).rgb, vMix);\n diffuseColor.rgb *= vLeafCol;')
      .replace('#include <alphatest_fragment>', LEAF_ALPHA)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= mix(1., vFakeSh, uFakeSh);'))
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
  uNodP1: { value: new THREE.Vector4(1e3, 1e3, 1e3, 1e3) }, uNodP2: { value: new THREE.Vector4(1e3, 1e3, 1e3, 1e3) }, uNodA: { value: new THREE.Vector4() },   // Blüten unter einer Hummel nicken
  uG1: { value: new THREE.Color() }, uG2: { value: new THREE.Color() }, uG3: { value: new THREE.Color() },
  uSnow: { value: 0 }, uBgS: { value: new THREE.Vector3(0.965, 0.953, 0.918) },
  uAO: { value: new THREE.Vector4(0, 0, 1, 0) }, uTrunkR: { value: 0.2 },
  uTime: leafUniforms.uTime, uWind: leafUniforms.uWind,
  uFill: { value: 0.2 }, uEdgeA: { value: OPT.opaque ? 0 : 1 },                          // Aufhellung: Schatten unter der Krone bleiben hell und farbig (Comic)
  uSeason: { value: new THREE.Vector4(0, 1, 0, 0) }, uSeasonB: { value: new THREE.Vector4(0, 1, 0, 0) }, uMeadowU: { value: 0 }, uMeadowB: { value: null }, uFallen: { value: 0 },
  uTuftH: { value: 1 }, uTuftKeep: { value: 1 },
  uCrownC: leafUniforms.uCrownC, uCrownR: leafUniforms.uCrownR, uSunD: leafUniforms.uSun, uFakeGround: { value: 0 }, uFakeGK: { value: 0.6 },
};
window.__groundU = groundUniforms;   // Prüfhilfe (Boden-Uniforms)
const MEADOW_GLSL = /* glsl */`
uniform vec3 uBgS; uniform vec4 uAO; uniform float uTrunkR; uniform float uFill; uniform float uEdgeA;
float edgeFade(vec3 wp){
  float wob = (vnoise(wp.xz * .55 + 11.) - .5) * 1.5 + (vnoise(wp.xz * 1.7 + 3.) - .5) * .45;   // unregelmäßiger, gemalter Rand
  return smoothstep(${(MR * 0.56).toFixed(2)}, ${(MR * 0.98).toFixed(2)}, length(wp.xz) + wob);
}
uniform vec3 uCrownC; uniform vec3 uCrownR; uniform vec3 uSunD; uniform float uFakeGround; uniform float uFakeGK;
float groundAO(vec3 wp){
  float dC = length(wp.xz - uAO.xy) / max(uAO.z, .01);
  float dT = length(wp.xz);
  float ao = (1. - uAO.w * .22 * (1. - smoothstep(.0, 1.05, dC))) * (1. - .25 * (1. - smoothstep(.0, uTrunkR, dT)));
  if (uFakeGround > .5 && uAO.w > .01) {
    vec3 q = (wp - uCrownC) / uCrownR, sN = normalize(uSunD / uCrownR);
    float b = dot(q, sN), c = dot(q, q) - 1., disc = b * b - c, od = 0.;
    if (disc > 0.) { float sq = sqrt(disc); od = max(0., -b + sq) - max(0., -b - sq); }
    float gap = vnoise(wp.xz * 1.9 + 5.) * .6 + vnoise(wp.xz * 4.3 + 1.) * .4;
    ao *= 1. - uFakeGK * uAO.w * smoothstep(.15, .9, od * .9 + (gap - .5) * .8);
  }
  return ao;
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
let MEADOW_FLOWERS = [];   // Blumen der Wiese (Landeplätze für den Zitronenfalter)
const FLOWER_BUSY = new Set();   // Blüten, auf denen gerade jemand sitzt oder landen will (Falter, Hummeln)
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
  const nFlowers = items.length; MEADOW_FLOWERS = items.slice(0, nFlowers);
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
    aPhase[i] = mrr(0, 6.283); it.ph = aPhase[i]; aMask.set(it.mask, i * 4); aTint.set([it.tint, it.tuft], i * 2);
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
uniform vec4 uSeason; uniform vec4 uSeasonB; uniform float uMeadowU; uniform float uTuftH; uniform float uTuftKeep; uniform float uTime; uniform float uWind; uniform vec4 uNodP1; uniform vec4 uNodP2; uniform vec4 uNodA;
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
        float nodK = (distance(aOff.xz, uNodP1.xy) < .002 ? uNodA.x : 0.) + (distance(aOff.xz, uNodP1.zw) < .002 ? uNodA.y : 0.)
          + (distance(aOff.xz, uNodP2.xy) < .002 ? uNodA.z : 0.) + (distance(aOff.xz, uNodP2.zw) < .002 ? uNodA.w : 0.);
        transformed.y -= nodK * position.y * position.y * abs(sz.y);   // Blüte nickt unter der Hummel
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
    grp.visible = show && placed && !(window.__seqActive && window.__seqActive()) && !eichTagFx.away;
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
// Bildrand (25.10.): Bühnen-x, ab dem ein Punkt in Höhe y und Tiefe z knapp außerhalb des Bildes liegt (side −1 links,
// +1 rechts), gesucht ab |x0| nach außen. Liegt x0 schon draußen (kleine Stufen), bleibt es bei x0.
const __edgeP = new V();
function edgeStageX(side, y, z, x0 = 6.4) {
  camera.updateMatrixWorld();
  let x = side * Math.abs(x0);
  for (let k = 0; k < 90; k++) {
    __edgeP.copy(STAGE_R).multiplyScalar(x).addScaledVector(STAGE_U, y).addScaledVector(STAGE_D, z).applyMatrix4(camera.matrixWorldInverse);
    if (__edgeP.z > -0.2) break;                                   // hinter der Kamera (gedrehte Ansicht): nicht weiter
    if (Math.abs(__edgeP.applyMatrix4(camera.projectionMatrix).x) >= 1.12) break;
    x += side * 0.4;
  }
  return x;
}
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
  return { play, frame, late, active, get playing() { return t0 >= 0 && playing; }, get total() { return TOTAL; }, sprite: spr, nut, tex };
})();
window.__seqActive = () => seqPlayer.playing;
window.__sqLate = () => { seqPlayer.late(); squirrel.late(); winterFx.late(); eichTagFx.late(); };
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
  qLevel = l; const q = QUALITY[l]; leafUniforms.uFakeSh.value = q.leafRecv && q.shadows ? 0 : 1; groundUniforms.uFakeGround.value = q.shadows && q.leafCast ? 0 : 1;
  renderer.setPixelRatio(l === QUALITY.length - 1 ? Math.min(devicePixelRatio, q.px, MAX_DPR) : Math.min(q.px, MAX_DPR));
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
  function snowAt(p, n = 12) {   // Krähe landet oder fliegt ab: ein Hauch Schnee rieselt vom Ast
    if (!flakes.some(F => F.t >= 0)) smat.size = 0.3;    // Flocken wie beim Wachsen auf kleinen Stufen
    for (let k = 0; k < n && flakes.length < NS; k++) flakes.push({
      p: p.clone().add(new V((Math.random() - 0.5) * 0.3, -Math.random() * 0.05, (Math.random() - 0.5) * 0.12)),
      v: new V((Math.random() - 0.5) * 0.2, -0.05 - Math.random() * 0.2, (Math.random() - 0.5) * 0.15), t: -Math.random() * 0.15, ph: Math.random() * 6.28 });
  }
  function clear() { leaves = []; flakes = []; lmesh.count = 0; snow.visible = false; }
  window.__fxS = () => [flakes.length, flakes.filter(F => F.t >= 0).length, smat.size];
  window.__fxL = () => leaves.map(L => { const v = L.p.clone().project(camera); return [+L.p.x.toFixed(2), +L.p.y.toFixed(2), +L.p.z.toFixed(2), +L.t.toFixed(2), +L.size.toFixed(2), Math.round((v.x * .5 + .5) * W()), Math.round((.5 - v.y * .5) * H())]; });
  return { spawn, frame, clear, drift, leafAt, snowAt };
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

let trans = null, moveIn = 0, holdMoveIn = false, moveInHeld = 0;   // moveIn 1: Übergang über Stufe 6 läuft, Eichhörnchen zieht danach ein
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
  if (moveIn === 2 && now - moveInHeld > 30000) startMoveIn();   // Baumvogel: Sicherung, falls squirrelIn() ausbleibt
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
    if (e > trans.end) { P = trans.target; trans = null; leafUniforms.uGust.value = 0; tubeUniforms.uBend.value = 0; leafUniforms.uWind.value = baseWind; if (moveIn === 1) { if (holdMoveIn) { moveIn = 2; moveInHeld = now; } else startMoveIn(); } }
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
  eichTagFx.frame();
  gluehFx.frame();
  haufenFx.frame();
  igelFx.frame();
  fledermausFx.frame();
  spechtFx.frame();
  PLAY.frame();
  __shadePics();
  falterFx.frame();
  nistkastenFx.frame();
  kaeferFx.frame();
  kraehenFx.frame();
  hummelFx.frame();
  schmetterlingFx.frame();
  meisenFx.frame();
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
// Bogenflug (Buntspecht, 28.10.): mit tex.fold (Bild mit angelegten Flügeln) und foldGlide werden die Flügel im Gleiten
// eingezogen und das angelegte Bild gezeigt; setAlpha() blendet die ganze Puppe (Überblenden zur Figur am Stamm).
// Ohne tex.fold und ohne setAlpha() verhält sich die Puppe genau wie vorher (Häher, Krähe).
const JAY_META = { body: { w: 1469, h: 473, shoulder: [901, 171], beak: [1443, 165], tail: [26, 406] },
  wing: { w: 990, h: 2026, base: [568, 1980], top: 24, scale: 0.43 } };

const D = Math.PI / 180;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function createJayPuppet(THREE, tex, opt = {}, meta = JAY_META) {   // meta: andere Vögel (Krähe, 25.10.)
  const M = meta, PX = 1 / (M.body.beak[0] - M.body.tail[0]);
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
    foldGlide: false,     // Bogenflug (Specht): im Gleiten Flügel einziehen und das Bild mit angelegten Flügeln (tex.fold) zeigen
  }, opt);

  const grp = new THREE.Group();
  const mat = (map, dark = 1, opacity = 1) => { const m = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: opacity < 1 ? 0.01 : 0.04, opacity, side: THREE.DoubleSide, depthWrite: false, depthTest: P.depthTest, toneMapped: false });
    m.color.setScalar(dark * P.tone); m.userData.op0 = opacity; return m; };
  let alpha = 1, alphaOn = false;   // Gesamt-Deckkraft (nur wenn setAlpha() benutzt wird)

  // ---- Körper: Gitter entlang x (Schwanz biegt sich)
  const bw = M.body.w * PX, bh = M.body.h * PX, bx0 = -M.body.shoulder[0] * PX, by0 = M.body.shoulder[1] * PX;
  const bodyGeo = new THREE.PlaneGeometry(bw, bh, 16, 1); bodyGeo.translate(bx0 + bw / 2, by0 - bh / 2, 0);
  const bodyBase = bodyGeo.attributes.position.array.slice();
  const body = new THREE.Mesh(bodyGeo, mat(tex.body)); body.renderOrder = P.order + 3;
  const foldBody = tex.fold ? new THREE.Mesh(bodyGeo, mat(tex.fold)) : null;   // Bogenflug: Körper mit angelegten Flügeln
  if (foldBody) { foldBody.renderOrder = P.order + 3; foldBody.visible = false; }
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
  const bodyPivot = new THREE.Group(); bodyPivot.add(body, near, far, ...ghosts.flatMap(g => [g.n, g.f]), ...(bodyGhost ? [bodyGhost] : []), ...(foldBody ? [foldBody] : [])); grp.add(bodyPivot);

  // Schlag-Grundkurve: u ∈ [0,1) – 0 = oben; Abschlag bis P.down55, dann Aufschlag
  function stroke(u) {
    const d = P.down55;
    if (u < d) { const k = u / d; return { e: P.up + (P.down - P.up) * (0.5 - 0.5 * Math.cos(Math.PI * k)), v: -Math.sin(Math.PI * k), upF: 0 }; }
    const k = (u - d) / (1 - d); return { e: P.down + (P.up - P.down) * (0.5 - 0.5 * Math.cos(Math.PI * k)), v: Math.sin(Math.PI * k), upF: Math.sin(Math.PI * k) };
  }
  // Wing-Gitter aus Hebung/Pfeilung je Reihe
  const tmp = { x: 0, y: 0, z: 0 };
  let wlK = 1;            // Anteil der Flügellänge (Bogenflug: Flügel eingezogen; sonst immer 1)
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
      if (i > 0) { const ds = WL * wlK / NS; x += Math.sin(sig) * ds; y += Math.cos(sig) * Math.sin(e) * ds; z += side * Math.cos(sig) * Math.cos(e) * ds; }
      rows.push([x, y, z, sig, e]);
    }
    const s0 = (M.wing.h - M.wing.base[1]) / (M.wing.base[1] - M.wing.top);   // Rand unter der Basis
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NC; j++) {
      const k = i * (NC + 1) + j, c = sc[k * 2 + 1];
      const [rx, ry, rz, sig, e] = rows[i];
      const off = i === 0 ? -s0 * WL : 0;    // unterste Reihe liegt etwas unter der Schulter (Deckfedern)
      const ox = Math.sin(sig) * off, oy = Math.cos(sig) * Math.sin(e) * off, oz = side * Math.cos(sig) * Math.cos(e) * off;
      const cc = wlK === 1 ? c : c * (0.35 + 0.65 * wlK);
      const X = rx + ox + Math.cos(sig) * cc, Y = ry + oy - Math.sin(sig) * Math.sin(e) * cc, Z = rz + oz - side * Math.sin(sig) * Math.cos(e) * cc;
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
  let phase = 0, lastT = null, glideT = -1, beatCount = 0, glideW = 0, lift = 0, foldK = 0;
  // c (optional, für Landen/Abheben): { hold: 0–1 Gleiten erzwingen (0 = nur schlagen), e: Hebung beim Gleiten (Grad), freq: Tempo-Faktor,
  //   fold: 0–1 Flügel angelegt erzwingen (nur mit tex.fold) }
  function update(t, c) {
    const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    if (glideT >= 0) { glideT += dt; if (glideT > P.glide) glideT = -1; }
    const gTarget = c && c.hold != null ? c.hold : glideT >= 0 ? 1 : 0; glideW += (gTarget - glideW) * Math.min(1, dt * 9);
    const gE = c && c.e != null ? c.e : P.glideE;
    const prev = phase; phase += dt * P.freq * (c && c.freq || 1) * (1 - glideW);
    if (Math.floor(phase) > Math.floor(prev)) { beatCount++; if (P.beats > 0 && beatCount % P.beats === 0 && P.glide > 0) glideT = 0; }
    const st = stroke(phase % 1);
    const e0 = st.e + (gE - st.e) * glideW;
    let fF = 0;
    if (foldBody) {   // Bogenflug: Flügel einziehen, angelegtes Bild einblenden
      const fw = c && c.fold != null ? c.fold : (P.foldGlide ? glideW : 0);
      foldK = fw; fF = sm(0.3, 0.62, fw); wlK = 1 - 0.94 * sm(0.05, 0.6, fw);
      foldBody.visible = fF > 0.01; body.visible = fF < 0.99;
      near.visible = far.visible = wlK > 0.2;
    }
    bendWing(near, e0, st.v, st.upF, glideW, 1); bendWing(far, e0 + 4, st.v, st.upF, glideW, -1);
    // Nachbilder: dieselbe Puppe einen Augenblick früher – im Gleiten (kein Schlag) fallen sie mit dem Flügel zusammen
    for (const g of ghosts) {
      const sg = stroke(((phase - g.dt * P.freq * (1 - glideW)) % 1 + 1) % 1), eg = sg.e + (gE - sg.e) * glideW;
      bendWing(g.n, eg, sg.v, sg.upF, glideW, 1); bendWing(g.f, eg + 4, sg.v, sg.upF, glideW, -1);
      g.n.visible = g.f.visible = glideW < 0.95;
    }
    if (foldBody || alphaOn)   // Deckkraft: Grundwert je Teil (Körper/angelegt nach Faltung, Nachbilder blass) mal Gesamt-Deckkraft
      for (const m of allMeshes) m.material.opacity = (m === body ? 1 - fF : m === foldBody ? fF : m.material.userData.op0) * alpha;
    if (P.lively) {
      lift += ((-st.v) * P.lift * (1 - glideW) - lift) * Math.min(1, dt * 10);
      bodyPivot.position.y = lift; bodyPivot.rotation.z = -lift / P.lift * P.pitch * D * 0.6;
      bendBody(Math.sin(phase * Math.PI * 2 - 1.3) * P.tail * D * (1 - glideW * 0.6));
    }
  }
  const allMeshes = [body, near, far, ...ghosts.flatMap(g => [g.n, g.f]), ...(bodyGhost ? [bodyGhost] : []), ...(foldBody ? [foldBody] : [])];
  update(0);
  const beak = [(M.body.beak[0] - M.body.shoulder[0]) * PX, (M.body.shoulder[1] - M.body.beak[1]) * PX];   // Schnabelspitze (Puppen-Einheiten)
  allMeshes.forEach(m => { m.frustumCulled = false; });
  return { group: grp, update, params: P, beak, meshes: allMeshes,
    get glide() { return glideW; }, get fold() { return foldK; }, get phase() { return phase; },
    setAlpha(a) { alpha = a; alphaOn = true; }, get alpha() { return alpha; },
    reset() { phase = 0; lastT = null; glideT = -1; beatCount = 0; glideW = 0; lift = 0; foldK = 0; }, setLively(on) { P.lively = on; if (!on) { bodyPivot.position.y = 0; bodyPivot.rotation.z = 0; bendBody(0); } } };
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
// und fliegt zur anderen Seite davon. Herein und hinaus von/bis knapp hinter den Bildrand, je nach Kamera (25.10.). Flug = Gliederpuppe (wie beim Start), am Boden zwei gemalte Haltungen
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

  // Anflug und Abflug: Weg um den Lande- bzw. Abflugpunkt gestreckt (kIn, kOut ≥ 1), sodass er hinter dem Bildrand beginnt
  // bzw. endet (25.10.: früher fest bei ±3,4 bzw. etwa 6 neben dem Stamm – lag schon ab Stufe 1 im Bild, auf großen Stufen
  // mitten im Bild). Gleiche Dauer, also entsprechend schneller; im Bild wirkt es wie vorher auf kleinen Stufen.
  let kIn = 1, kOut = 1;
  function stretch() {
    const S1x = xF + dir * SHO[0], S1y = SHO[1], S2x = xF + dir * HOPX * HOPS.length + dir * SHO[0], S2y = SHO[1] * 0.92;
    const d0 = Math.abs(-dir * 3.4 - S1x), EX = 0.35 * TC + 0.75 * TC * TC, EY = 0.45 * TC + 0.05 * TC * TC;   // Abflug-Weg bei k = 1
    kIn = kOut = 1;
    for (let i = 0; i < 3; i++) {
      const xs = S1x + (-dir * 3.4 - S1x) * kIn, ys = S1y + (1.15 - S1y) * kIn;
      kIn = Math.max(kIn, Math.abs(edgeStageX(-dir, ys, Z, Math.abs(xs)) - S1x) / d0);
      const xe = S2x + dir * EX * kOut, ye = S2y + EY * kOut;
      kOut = Math.max(kOut, Math.abs(edgeStageX(dir, ye, Z, Math.abs(xe)) - S2x) / EX);
    }
    kIn = Math.min(kIn, 6); kOut = Math.min(kOut, 6);
  }
  function approach(t) {
    const u = t / TA, S1x = xF + dir * SHO[0], S1y = SHO[1], S0x = S1x + (-dir * 3.4 - S1x) * kIn, S0y = S1y + (1.15 - S1y) * kIn;
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
    const x = S2x + dir * kOut * (0.35 * t + 0.75 * t * t), y = S2y + kOut * (0.45 * t + 0.05 * t * t);
    const vx = dir * (0.35 + 1.5 * t), vy = 0.45 + 0.1 * t;                       // Richtung (gestreckt: gleich)
    const th = Math.atan(vy / vx) * 0.6 * sm(-0.05, 0.25, t);
    flyAt(x, y, th, t, t < 0.9 ? { hold: 0, freq: 1.5 } : null, false);
    focusX = t < 0.5 ? fx : null;
  }
  function play(o = {}) {
    if (reduceMotion || active) return false;
    dir = o.dir ?? (Math.random() < 0.5 ? 1 : -1);
    xF = -dir * (o.x ?? 0.62 + Math.random() * 0.14);                               // landet auf der Seite, von der er kommt, nah am Stamm
    stretch();
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
// ------------------------------------------------------------------ Zitronenfalter (ab Stufe 1, 24.10.)
// Besucher von Frühling bis Herbst, nur tagsüber; wann er kommt, entscheidet die App (home-tree.mjs).
// Ablauf (ca. 16 s): flattert im leichten Zickzack von der Seite herein, dreht eine Runde ums Bäumchen, setzt sich auf
// eine Blüte der gemalten Wiese (wiegt dort mit ihr im Wind), sitzt mit geschlossenen Flügeln ein paar Sekunden und
// fliegt zur anderen Seite davon.
// Flug: zwei echte Flügelflächen (das Bild von oben, in der Mitte geteilt), die um die Körperachse schlagen – so stimmt
// er aus jedem Blickwinkel –, dazu der Körper mit den Fühlern. In Ruhe: gemaltes Seitenbild (Flügel geschlossen,
// blasse Unterseite). Zwischen beiden ein harter Schnitt. Die Uhr läuft nur, solange der Baum läuft.
// Prüfhilfen: window.__falterT (s) hält die Zeit fest, window.__falter zeigt Phase und Landeplatz.
const falterFx = (() => {
  const loader = new THREE.TextureLoader();
  const ldT = (n) => { const t = loader.load(__img(n)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const tex = { l: ldT('72033a4b80.webp'), r: ldT('de54f64a67.webp'), b: ldT('6caa58b2d8.webp'), s: ldT('0b4e291ee7.webp') };
  const M = {"top": [872, 483], "cx": 421, "bodyY": [115, 308], "left": [421, 483], "right": [451, 483], "body": [271, 571, 483], "side": [647, 605], "feet": [475, 593]};                                     // Bildmaße in px (falter/falter-meta.json)
  const SPAN = 0.14;                                    // Spannweite in Welt-Einheiten (Nutzer 28.10.: kleiner, „das muss schon
                                                        // passen“ – vorher 0,42, so groß wie der Buntspecht; jetzt etwa wie in echt
                                                        // im Verhältnis zu den Vögeln, Meise 0,26 = 14 cm, etwas größer; erst 0,12,
                                                        // dann „ein ganz kleines bisschen größer“)
  const K = SPAN / M.top[0], CY = (M.bodyY[0] + M.bodyY[1]) / 2;
  const mat = (map) => { const m = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }); m.color.setScalar(0.94); return m; };
  // Fläche in der Ebene des Falters: x nach vorn (Kopf = oberer Bildrand), z nach rechts (rechter Bildrand), y nach oben
  function quad(xF, xB, zL, zR, map, order) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([xF, 0, zL, xF, 0, zR, xB, 0, zR, xB, 0, zL], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(g, mat(map)); m.renderOrder = order; m.frustumCulled = false; return m;
  }
  const xF = CY * K, xB = (CY - M.top[1]) * K;
  const grp = new THREE.Group(), pivL = new THREE.Group(), pivR = new THREE.Group();
  pivL.add(quad(xF, xB, -M.cx * K, 0, tex.l, 25));
  pivR.add(quad(xF, xB, 0, (M.top[0] - M.cx) * K, tex.r, 25));
  const body = quad(xF, xB, (M.body[0] - M.cx) * K, (M.body[1] - M.cx) * K, tex.b, 26); body.position.y = 0.002;
  grp.add(pivL, pivR, body); grp.visible = false; scene.add(grp);
  // Ruhebild (Seitenansicht): Füße bei M.feet, Kopf zeigt im Bild nach rechts
  const SIDE_H = SPAN * 0.66, SK = SIDE_H / M.side[1], SW = M.side[0] * SK;
  const side = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(tex.s)); side.renderOrder = 25; side.visible = false; side.frustumCulled = false; scene.add(side);

  // Landeplätze im Wiesen-Atlas (Zelle → Lage auf der Karte; u von links, v von unten): die größte Blüte, bei den hohen
  // Gräsern (6, 7) die höchste Ähre – darauf sitzt er vor allem im Herbst, wenn kaum noch etwas blüht
  const BLOOM = { 6: [0.72, 0.87], 7: [0.65, 0.79], 8: [0.61, 0.74], 9: [0.58, 0.82], 10: [0.49, 0.70], 11: [0.69, 0.66], 12: [0.64, 0.82], 13: [0.62, 0.69] };
  const GRASS = { 6: 1, 7: 1 };
  const camR = new V(), tmp = new V(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), yA = new V(0, 1, 0), zAx = new V(0, 0, 1);
  const fract = (x) => x - Math.floor(x);
  function flowerOn(f) {           // wie im Wiesen-Shader: Karte dieser Jahreszeit (beim Wechsel Karte für Karte)
    const u = groundUniforms.uMeadowU.value, sel = u >= fract(f.ph * 5.31) * 0.9 + 0.05;
    const s4 = sel ? groundUniforms.uSeasonB.value : groundUniforms.uSeason.value;
    return f.mask[0] * s4.x + f.mask[1] * s4.y + f.mask[2] * s4.z + f.mask[3] * s4.w;
  }
  // Lage der Blüte in der Welt – mit dem Wind wie im Shader (Karte dreht sich zur Kamera, nur um die senkrechte Achse)
  function bloomAt(f, out) {
    const [u, v] = BLOOM[f.cell], s = f.w * flowerOn(f);
    camR.set(camera.matrixWorld.elements[0], 0, camera.matrixWorld.elements[2]); camR.x += 1e-5; camR.normalize();
    const tt = leafUniforms.uTime.value, wnd = leafUniforms.uWind.value;
    const sw = (Math.sin(tt * 1.4 + f.ph + f.x * 0.5) * 0.07 + Math.sin(tt * 2.3 + f.ph * 1.7) * 0.025) * wnd * v * v * Math.abs(s);
    return out.set(f.x, -0.015 + v * s, f.z).addScaledVector(camR, (u - 0.5) * s).add(tmp.set(sw, 0, sw * 0.5));
  }
  const toStage = (p) => ({ x: p.dot(STAGE_R), y: p.y, z: p.dot(STAGE_D) });
  // Stamm samt Wurzelanlauf in Höhe y (größte Ausbuchtung wie im Rinden-Shader) – ab Stufe 6 ist der Fuß sehr breit
  function trunkR(y) {
    const r0 = rad && rad.length ? rad[0] : 0;
    return r0 * (1 + Math.exp(-Math.max(y, 0) * 2.4) * sm(0.025, 0.12, r0) * 1.95) * 1.13;
  }
  // Abstand des Stammfußes (Ursprung) von der Strecke a–b, waagerecht betrachtet
  function segDist(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, t = Math.min(1, Math.max(0, -(ax * dx + az * dz) / Math.max(1e-9, dx * dx + dz * dz)));
    return Math.hypot(ax + dx * t, az + dz * t);
  }
  // Landeplatz: eine Blüte, die gerade blüht, gut im Bild und vor dem Stamm liegt; nahe bevorzugt, Blüten lieber als
  // Ähren. Gelbe Blüten (Hahnenfuß, Löwenzahn) nur, wenn es nichts anderes gibt – darauf sähe man den gelben Falter kaum.
  const YELLOW = { 9: 1, 13: 1 };
  function pickFlower(allowYellow = false) {
    const cand = [], p = new V();
    for (const f of MEADOW_FLOWERS) {
      if (!BLOOM[f.cell] || flowerOn(f) < 0.99 || (!allowYellow && YELLOW[f.cell]) || FLOWER_BUSY.has(f)) continue;   // nicht, wo eine Hummel ist
      bloomAt(f, p); const st = toStage(p);
      if (st.z < 0.15) continue;
      const tr = trunkR(p.y);
      if (Math.hypot(p.x, p.z) < tr + 0.12 + SPAN * 0.6) continue;                       // nicht am oder im Stammfuß
      if (segDist(p.x, p.z, camera.position.x, camera.position.z) < tr + 0.08) continue;   // nicht hinter dem Stamm
      const n = p.clone().project(camera);
      if (Math.abs(n.x) > 0.78 || n.y < -0.8 || n.y > 0.55 || n.z > 1) continue;
      if (n.x > 0.5 && n.y < -0.4) continue;            // unten rechts liegt der Knopf „Baum groß“
      cand.push({ f, w: (GRASS[f.cell] ? 0.35 : 1) / (0.4 + Math.hypot(st.x, st.z)) });
    }
    if (!cand.length) return allowYellow ? null : pickFlower(true);
    let r = Math.random() * cand.reduce((a, c) => a + c.w, 0);
    for (const c of cand) { r -= c.w; if (r <= 0) return c.f; }
    return cand[cand.length - 1].f;
  }
  // Weg aus Stützpunkten (Catmull-Rom, nach Bogenlänge): Bühnen-Koordinaten (x quer, y hoch, z zur Kamera)
  function makePath(pts) {
    const P = pts.map(p => new V(p[0], p[1], p[2])), N = 24 * (P.length - 1), samples = [], len = [0];
    const keep = (v, last) => {                                 // nie durch den Stamm: Probe nach außen schieben
      if (last) return v;
      const d = Math.hypot(v.x, v.z), need = trunkR(v.y) + 0.3;
      if (d < need) { if (d < 1e-4) v.z = need; else { v.x *= need / d; v.z *= need / d; } }
      return v;
    };
    const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return new V().addScaledVector(a, -0.5 * t3 + t2 - 0.5 * t).addScaledVector(b, 1.5 * t3 - 2.5 * t2 + 1).addScaledVector(c, -1.5 * t3 + 2 * t2 + 0.5 * t).addScaledVector(d, 0.5 * t3 - 0.5 * t2); };
    for (let i = 0; i <= N; i++) {
      const g = i / N * (P.length - 1), k = Math.min(P.length - 2, Math.floor(g)), t = g - k;
      const s = keep(cr(P[Math.max(0, k - 1)], P[k], P[k + 1], P[Math.min(P.length - 1, k + 2)], t), i === N || i === 0);
      if (i) len.push(len[i - 1] + s.distanceTo(samples[i - 1])); samples.push(s);
    }
    const total = len[N];
    return { total, at(d, out) {
      d = Math.min(total, Math.max(0, d)); let i = 1; while (i < N && len[i] < d) i++;
      const u = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]);
      return out.copy(samples[i - 1]).lerp(samples[i], u);
    } };
  }
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rr = (a, b) => a + Math.random() * (b - a);
  let active = false, vt = 0, last = 0, ph = '', dir = 1, flower = null, landing = new V(), pathIn = null, pathOut = null;
  let tIn = 0, tRest = 0, tOut = 0, outStart = 0, flap = 0, face = 1, seed = [0, 0, 0, 0], tNow = 0;
  const outFrom = new V();                                            // Startpunkt des Abflugs (Bühne), wenn weggeschickt
  let hasFrom = false;
  const SPEED = 1.15;                                   // Reisegeschwindigkeit (Einheiten/s)
  const ZZ0 = SPAN / 0.15;                              // Zickzack wächst mit der Größe
  // Größe fest (Nutzer 26.10.: „alle drei fest“ – vorher wurde er auf großen Stufen bis doppelt so groß gezeichnet, damit
  // er so groß blieb wie auf Stufe 1). Auf großen Stufen ist er darum kleiner im Bild; pxNow = Spannweite in px (Prüfhilfe).
  let sc = 1, ZZ = ZZ0, pxNow = 0;
  function sizeFor(p) {
    const h = renderer.domElement.clientHeight || innerHeight;
    const pxU = h / 2 * camera.projectionMatrix.elements[5] / Math.max(0.5, camera.position.distanceTo(p));
    sc = 1; ZZ = ZZ0; pxNow = SPAN * pxU;
    grp.scale.setScalar(sc);
  }
  // Zeit → Weglänge: gleichmäßig, am Ende sanft bis zum Stillstand (Landung) bzw. am Anfang aus dem Stand (Abflug)
  // spdIn/spdOut: SPEED, auf großen Stufen schneller (weiter Weg vom/zum Bildrand, 25.10.)
  let spdIn = SPEED, spdOut = SPEED;
  const distIn = (t) => { const T = tIn, slow = 0.9; const ts = T - slow; return t < ts ? spdIn * t : spdIn * ts + spdIn * slow * (1 - Math.pow(1 - (t - ts) / slow, 2)) / 2; };
  const distOut = (t) => { const a = 0.7; return t < a ? spdOut * t * t / (2 * a) : spdOut * (a / 2 + t - a); };
  function play(o = {}) {
    if (reduceMotion || active) return false;
    if (season === 'winter' || (!o.force && __isNight())) return false;   // force (Test): auch nachts
    dir = o.dir ?? (Math.random() < 0.5 ? 1 : -1);
    flower = o.flower ?? pickFlower();
    if (flower) FLOWER_BUSY.add(flower);
    const p = flower ? bloomAt(flower, new V()) : stageToWorld(dir * rr(0.25, 0.7), 0.12, rr(0.6, 1.0));
    landing.copy(p); const L = toStage(p); sizeFor(p);
    const r = () => Math.random(), k = trunkR(1.2);          // dicker Stamm (große Stufen): weiter vorn vorbei
    const y0 = 1.3 + r() * 0.5, z0 = 0.3 + r() * 1.0, x0 = edgeStageX(-dir, y0, z0, 6.4);   // außerhalb des Bildes (je nach Kamera)
    spdIn = SPEED * Math.min(3, Math.abs(x0) / 6.4);
    pathIn = makePath([
      [x0, y0, z0],
      [-dir * 2.6, 0.95 + r() * 0.4, 1.0 + r() * 0.6 + k],
      [-dir * (0.7 + r() * 0.3 + k), 1.5 + r() * 0.4, 0.35 + r() * 0.3 + k * 1.3],   // am Bäumchen vorbei
      [dir * (0.35 + r() * 0.3 + k * 0.6), 1.05 + r() * 0.3, 0.9 + r() * 0.3 + k * 1.3],
      [L.x - dir * 0.45, L.y + 0.45, L.z + 0.2],
      [L.x, L.y, L.z]]);
    tIn = pathIn.total / spdIn + 0.45; tRest = rr(3.6, 6); tOut = 0; outStart = tIn + tRest; hasFrom = false; pathOut = null;
    face = dir;
    seed = [r() * 6.3, r() * 6.3, r() * 6.3, r() * 6.3];
    vt = 0; last = nowMs(); ph = 'in'; active = true; flap = 0;
    return true;
  }
  const pos = new V(), prev = new V(), vel = new V(), up = new V(0, 1, 0);
  // Falter an Bühnenpunkt sp (mit Zickzack w = 0…1), Flügelwinkel ang (Bogenmaß, hoch = +)
  function flyAt(sp, sPrev, ang, pitch) {
    const w = stageToWorld(sp.x, sp.y, sp.z), wp = stageToWorld(sPrev.x, sPrev.y, sPrev.z);
    vel.subVectors(w, wp); const hz = Math.hypot(vel.x, vel.z);
    const yaw = hz > 1e-5 ? Math.atan2(-vel.z, vel.x) : grp.userData.yaw ?? 0; grp.userData.yaw = yaw;
    const climb = hz > 1e-5 ? Math.atan2(vel.y, hz) : 0;
    grp.position.copy(w);
    grp.quaternion.copy(q1.setFromAxisAngle(yA, yaw)).multiply(q2.setFromAxisAngle(zAx, pitch + climb * 0.4));
    pivR.rotation.x = -ang; pivL.rotation.x = ang;
    grp.visible = true; side.visible = false;
  }
  // Ruhebild: feste Bildebene wie alle Tiere (dreht sich nicht mit der Kamera), ein Stück vor der Karte seiner Blüte,
  // sonst verdecken ihn deren Stängel und Blätter
  function restAt(p, fc) {
    side.position.copy(p).addScaledVector(STAGE_U, (M.feet[1] - M.side[1] / 2) * SK * sc + 0.004);
    side.position.addScaledVector(STAGE_R, fc * (M.side[0] / 2 - M.feet[0]) * SK * sc).addScaledVector(STAGE_D, 0.035 * sc);
    side.quaternion.copy(STAGE_Q); side.scale.set(fc * SW * sc, SIDE_H * sc, 1); side.visible = true; grp.visible = false;
  }
  function frame() {
    const now = nowMs();
    if (!active) { last = now; return; }
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; vt += dt;
    const t = window.__falterT ?? vt; tNow = t;
    update(t, dt);
    if (!active) return;
    const sp = (grp.visible ? grp.position : side.position).clone().project(camera);
    window.__falter = { ph, t: +t.toFixed(2), flower: flower ? flower.cell : null, tIn: +tIn.toFixed(2), tRest: +tRest.toFixed(2), nx: +sp.x.toFixed(3), ny: +sp.y.toFixed(3), sc: +sc.toFixed(2), px: +pxNow.toFixed(1), vis: grp.visible ? 'flug' : side.visible ? 'ruhe' : '-' };
  }
  function update(t, dt) {
    const live = flower ? bloomAt(flower, new V()) : landing;
    if (t < tIn) {                                       // Anflug
      ph = 'in';
      const d = distIn(t), d0 = distIn(Math.max(0, t - 0.04)), rem = pathIn.total - d, calm = sm(0, 0.55, rem);
      pathIn.at(d, pos); pathIn.at(d0, prev);
      const zz = ZZ * calm * (0.055 * Math.sin(t * 2 * Math.PI * 1.25 + seed[0]) + 0.025 * Math.sin(t * 2 * Math.PI * 2.7 + seed[1]));
      const yy = ZZ * calm * (0.035 * Math.sin(t * 2 * Math.PI * 1.6 + seed[2]));
      // Flügelschlag ca. 7 Hz, ab und zu kurz gleiten; vor der Landung schneller und kleiner, zum Schluss Flügel hoch
      const glide = calm * sm(0.82, 0.9, fract(t * 0.8 + seed[3] / 6.3)) * (1 - sm(0.9, 0.98, fract(t * 0.8 + seed[3] / 6.3)));
      flap += dt * 2 * Math.PI * (7 + 2.5 * (1 - calm)) * (1 - 0.85 * glide);
      let ang = 0.35 + 0.95 * Math.sin(window.__falterT != null ? t * 2 * Math.PI * 7 : flap);
      ang = ang * (1 - glide) + 0.12 * glide;
      ang = ang * (0.55 + 0.45 * calm) + (1 - calm) * 0.55;
      const bob = ZZ * 0.012 * Math.cos(window.__falterT != null ? t * 2 * Math.PI * 7 : flap) * calm;
      // Zickzack quer zur Flugrichtung (in der Waagerechten)
      const dx = pos.x - prev.x, dz = pos.z - prev.z, dl = Math.hypot(dx, dz) || 1;
      pos.x += -dz / dl * zz; pos.z += dx / dl * zz; pos.y += yy + bob;
      if (rem < 0.002 && t > tIn - 0.12) { restAt(live, face); }
      else flyAt(pos, prev, ang, 0.38);
      return;
    }
    if (t < outStart) {                                 // sitzt auf der Blüte, Flügel geschlossen
      ph = 'rest'; restAt(live, face); pathOut = null; return;
    }
    if (!pathOut) {                                     // Abflug zur anderen Seite (von der Blüte oder, wenn er
      const L = hasFrom ? outFrom : toStage(live), r = () => Math.random();   // weggeschickt wurde, von da, wo er gerade ist)
      const yE = 1.8 + r() * 0.4, zE = 0.4 + r() * 0.6, xE = edgeStageX(dir, yE, zE, 6.6);   // hinter den Bildrand (je nach Kamera)
      spdOut = SPEED * Math.min(3, Math.abs(xE) / 6.6);
      pathOut = makePath([[L.x, L.y, L.z], [L.x + dir * 0.3, L.y + 0.5, L.z + 0.05], [dir * (2.2 + r() * 0.6), 1.3 + r() * 0.4, 0.6 + r() * 0.6], [xE, yE, zE]]);
      tOut = pathOut.total / spdOut + 0.4;
    }
    const u = t - outStart;
    if (u < tOut) {
      ph = 'out';
      const d = distOut(u), d0 = distOut(Math.max(0, u - 0.04));
      pathOut.at(d, pos); pathOut.at(d0, prev);
      const ramp = sm(0, 0.6, u);
      const zz = ZZ * ramp * (0.05 * Math.sin(u * 2 * Math.PI * 1.3 + seed[1]));
      flap += dt * 2 * Math.PI * 7.5;
      const ang = u < 0.08 ? 1.3 : 0.35 + 0.95 * Math.sin(window.__falterT != null ? u * 2 * Math.PI * 7.5 : flap);
      const dx = pos.x - prev.x, dz = pos.z - prev.z, dl = Math.hypot(dx, dz) || 1;
      pos.x += -dz / dl * zz; pos.z += dx / dl * zz; pos.y += ZZ * 0.01 * Math.cos(flap) * ramp;
      flyAt(pos, prev, ang, 0.38);
      return;
    }
    stop();
  }
  function stop() { if (flower) FLOWER_BUSY.delete(flower); active = false; ph = ''; grp.visible = side.visible = false; window.__falter = null; }
  // gleich weiterfliegen (der Baum wächst, der Eichelhäher kommt): sitzt er, fliegt er jetzt ab, im Anflug dreht er ab
  function away() {
    if (!active || ph === 'out' || tNow >= outStart) return;
    if (ph === 'in' && grp.visible) { const w = grp.position; outFrom.set(w.dot(STAGE_R), w.y, w.dot(STAGE_D)); hasFrom = true; }
    outStart = tNow; tIn = Math.min(tIn, tNow); pathOut = null;
  }
  return { play, frame, stop, away, get active() { return active; } };
})();
// ------------------------------------------------------------------ Nistkasten (ab Stufe 4, 24.10.)
// Ab Stufe 4 wohnt das Kohlmeisen-Paar in einem Nistkasten (Nutzer 24.10. abends: auf Stufe 3 noch kein Kasten, die
// Meisen setzen sich nur in den Baum). Er hängt am Stamm etwas links (Nutzer: nicht mittig – rechts sind das Astloch des
// Eichhörnchens und später die Eulenhöhle) und immer direkt unter dem untersten Ast an dieser Stelle: „bleibt oben beim
// Ast und rutscht je Stufe mit hoch“ (Nutzer 24.10., 22:16). Die Äste wandern beim Wachsen nicht selbst nach oben – die
// unteren sterben ab. Darum wird die Lage aus den sichtbaren Ästen bestimmt: der Kasten sitzt so hoch am Stamm, wie er
// von unten hinaufrutschen kann, bis über ihm ein Ast kommt – mit so viel Luft, dass eine Meise auf dem Dach sitzen kann
// (geht das nicht, direkt darunter, Abstand CLEAR). Stirbt dieser Ast ab, gleitet er hinauf bis unter den nächsten. Kein Ast wächst durch ihn hindurch: geprüft gegen alle gezeichneten Röhrenstücke, auch die ersten
// Stücke der Seitenäste, die am Stamm mit Stammdicke beginnen (das hatte die alte Prüfung übersehen). Am Wurzelanlauf
// liegt die Rückwand an der Rinde an (oben, unten und an den Kanten) und neigt sich mit. Hängt dort Laub vor dem Flugloch
// (unter der Krone hängen Zweige herab), rutscht er so weit tiefer, bis man es von vorn sieht. Größe bleibt gleich.
// Ein echter Holzkasten (3D, gemalte Flächen aus dem Recraft-Bild, beleuchtet wie der Stamm), Dach mit Überstand.
// Prüfhilfen: window.__kasten (Lage, Höhe, Ziel, Neigung, Platz für eine Meise auf dem Dach); window.__kastenSet =
// { al, y } hält ihn zum Testen fest (al in Grad, y = Mitte); window.__kastenFrei(y) prüft eine Höhe.
const __fracOf = (i) => Math.min(1, Math.max(0, T - tree.birth[i]));
const __alive = (i) => __fracOf(i) > 0.5 && sm01(0, 0.35, mY[i] - crownBase) > 0.6;
function sm01(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
const nistkastenFx = (() => {
  const BOX = { w: 0.24, h: 0.40, d: 0.22, over: 0.05, roofT: 0.03, tilt: 0.16 };
  const HOLE = { x: -0.008, y: 0.114, rx: 0.044, ry: 0.033 };   // Flugloch auf der Vorderseite (aus dem Bild gemessen)
  // Seitenwinkel am Stamm (0 = zur Kamera, − = links): tief unten (Stufe 4) −18°, dort ist unter dem ersten Ast Platz;
  // weiter oben −32°, damit rechts genug Abstand zum Astloch bleibt (ab Stufe 6, Höhe 1,25, +24°)
  const AL_LO = -18 * Math.PI / 180, AL_HI = -32 * Math.PI / 180;
  const alAt = (y) => AL_LO + (AL_HI - AL_LO) * sm01(0.8, 1.2, y);
  const TILT_MAX = 6 * Math.PI / 180;  // am Wurzelanlauf höchstens so schräg (sonst hängt er oben mit etwas Abstand)
  const CLEAR = 0.03;                  // Mindestabstand zu Ästen
  const Y_MIN = 0.3, Y_MAX = 2.6, STEP = 0.02;
  const loader = new THREE.TextureLoader();
  const ldT = (n) => { const t = loader.load(__img(n)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const tex = { front: ldT('e5f9faf959.webp'), side: ldT('6ec163f994.webp'), roof: ldT('ad3af00808.webp') };
  const lam = (map, dark = 1) => { const m = new THREE.MeshLambertMaterial({ map }); m.color.setScalar(dark); return m; };
  const mSide = lam(tex.side), mFront = lam(tex.front), mRoof = lam(tex.roof), mDark = lam(tex.side, 0.55);
  // Kasten: x nach rechts, y nach oben, z nach vorn (vom Stamm weg); Flächen: +x, -x, +y, -y, +z, -z
  const body = new THREE.Mesh(new THREE.BoxGeometry(BOX.w, BOX.h, BOX.d), [mSide, mSide, mRoof, mDark, mFront, mDark]);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(BOX.w + 2 * BOX.over, BOX.roofT, BOX.d + BOX.over * 1.6), mRoof);
  roof.position.set(0, BOX.h / 2 + BOX.roofT / 2 - 0.004, BOX.over * 0.8 - 0.004); roof.rotation.x = BOX.tilt;
  const grp = new THREE.Group(); grp.add(body, roof); grp.visible = false; scene.add(grp);
  for (const m of [body, roof]) { m.castShadow = true; m.receiveShadow = true; }
  const sm = sm01;
  const N = new V(), mtx = new THREE.Matrix4();
  // Stamm = Weg mit den meisten Nachkommen (nicht der dickste: auf mittleren Stufen ist ein Hauptast zeitweise so dick
  // wie der Stamm, dann läge der Kasten je nach Ladestufe an einem anderen Ast)
  let path = null, onPath = null;
  function trunkPath() {
    const n = tree.parent.length, kids = {};
    for (let i = 1; i < n; i++) (kids[tree.parent[i]] = kids[tree.parent[i]] || []).push(i);
    const cnt = new Int32Array(n).fill(1);
    for (let i = n - 1; i > 0; i--) cnt[tree.parent[i]] += cnt[i];
    path = [0]; let i = 0;
    for (let k = 0; k < 400; k++) { const c = kids[i]; if (!c || !c.length) break; i = c.reduce((a, b) => cnt[b] > cnt[a] ? b : a); path.push(i); }
    onPath = new Uint8Array(n); for (const j of path) onPath[j] = 1;
  }
  const sgT = [0, 0, 0];
  function trunkAt(y) {
    for (let k = 1; k < path.length; k++) {
      const a = tree.pos[path[k - 1]], b = tree.pos[path[k]];
      if (a.y <= y && b.y >= y) { sgT[0] = path[k - 1]; sgT[1] = path[k]; sgT[2] = (y - a.y) / Math.max(1e-6, b.y - a.y); return sgT; }
    }
    sgT[0] = path[0]; sgT[1] = path[1]; sgT[2] = 0; return sgT;
  }
  // Rinde: Abstand von der Achse in Höhe y, Richtung (nx, nz) – wie im Rinden-Shader samt Wurzelanlauf, dazu Buckel (+12 %)
  function rindeR(y, nx, nz) {
    const sg = trunkAt(y), r = rad[sg[0]] * (1 - sg[2]) + rad[sg[1]] * sg[2];
    const fl = Math.exp(-Math.max(0, y) * 2.4) * sm(0.025, 0.12, r), w = Math.atan2(nz, nx);
    return r * (1 + fl * (1.05 + 0.75 * Math.pow(Math.max(Math.sin(w * 5 + 1.3), 0), 1.5) + 0.15 * Math.sin(w * 3 - 0.7))) * 1.125 + 0.01;
  }
  // Lage für die Mittelhöhe y: Rückwand liegt an der Rinde an (7 Höhen × Mitte und Kanten), am Wurzelanlauf geneigt
  let alNow = AL_LO, alFix = null;
  const N0 = new V(), A0 = new V(), A1 = new V(), P0 = new V(), P1 = new V();
  const pose = { c: new V(), ex: new V(), ey: new V(), ez: new V(), back: new V(), tilt: 0 }, tp = { c: new V(), ex: new V(), ey: new V(), ez: new V(), back: new V(), tilt: 0 };
  function poseAt(y, out) {
    alNow = alFix != null ? alFix : alAt(y);
    N0.copy(STAGE_D).multiplyScalar(Math.cos(alNow)).addScaledVector(STAGE_R, Math.sin(alNow)); N0.y = 0; N0.normalize();
    const req = [0, 0, 0, 0, 0, 0, 0];
    for (let k = 0; k < 7; k++) {
      const yy = y + (k / 6 - 0.5) * BOX.h, rc = rindeR(yy, N0.x, N0.z); let m = rc;
      for (const xo of [-BOX.w / 2, BOX.w / 2]) {
        const da = Math.atan2(xo, rc), c = Math.cos(da), s = Math.sin(da);
        const rs = rindeR(yy, N0.x * c + N0.z * s, -N0.x * s + N0.z * c);
        m = Math.max(m, Math.sqrt(Math.max(0, rs * rs - xo * xo)));
      }
      req[k] = m;
    }
    const bm = BOX.h * Math.tan(TILT_MAX), b = Math.max(-bm, Math.min(bm, req[6] - req[0])); let a = -1e9;
    for (let k = 0; k < 7; k++) a = Math.max(a, req[k] - b * (k / 6 - 0.5));
    let sg = trunkAt(y - BOX.h / 2); A0.copy(tree.pos[sg[0]]).lerp(tree.pos[sg[1]], sg[2]);
    sg = trunkAt(y + BOX.h / 2); A1.copy(tree.pos[sg[0]]).lerp(tree.pos[sg[1]], sg[2]);
    P0.copy(A0).addScaledVector(N0, a - 0.5 * b); P1.copy(A1).addScaledVector(N0, a + 0.5 * b);
    out.ey.subVectors(P1, P0).normalize();
    out.ez.copy(N0).addScaledVector(out.ey, -N0.dot(out.ey)).normalize();
    out.ex.crossVectors(out.ey, out.ez).normalize();
    out.back.addVectors(P0, P1).multiplyScalar(0.5);
    out.c.copy(out.back).addScaledVector(out.ez, BOX.d / 2);
    out.tilt = Math.atan2(b, BOX.h);
    return out;
  }
  // gezeichnete Röhrenstücke (aStart, aEnd, Radien), ohne den Stamm selbst; dünne, absterbende Reste zählen nicht
  let segs = new Float32Array(0), nSeg = 0;
  function collectSegs() {
    const S = tubeGeo.getAttribute('aStart').array, E = tubeGeo.getAttribute('aEnd').array, Rd = tubeGeo.getAttribute('aRad').array;
    const cnt = tubeGeo.instanceCount; if (segs.length < cnt * 8) segs = new Float32Array(cnt * 8 + 800);
    nSeg = 0; let k = 0;
    const add = (q) => {
      if (Math.max(Rd[q * 2], Rd[q * 2 + 1]) < 0.005) return;
      const o = nSeg * 8; segs[o] = S[q * 3]; segs[o + 1] = S[q * 3 + 1]; segs[o + 2] = S[q * 3 + 2];
      segs[o + 3] = E[q * 3]; segs[o + 4] = E[q * 3 + 1]; segs[o + 5] = E[q * 3 + 2]; segs[o + 6] = Rd[q * 2]; segs[o + 7] = Rd[q * 2 + 1]; nSeg++;
    };
    // Reihenfolge wie in updateTree: je sichtbarem Knoten ein Stück, danach die Stücke des Wohnasts
    for (let i = 1; i < tree.parent.length && k < cnt; i++) {
      if (T - tree.birth[i] <= 0) continue;
      if (sm(0, 0.35, mY[i] - crownBase) <= 0.02) continue;
      if (!(onPath[i] && onPath[tree.parent[i]])) add(k);
      k++;
    }
    for (; k < cnt; k++) add(k);
  }
  // Prüfpunkte (Kasten-Koordinaten): Körper, Dach mit Überstand; dazu Kopffreiheit für eine Meise auf dem Dach
  const LP = [], HP = [];
  for (let ix = 0; ix <= 4; ix++) for (let iy = 0; iy <= 6; iy++) for (let iz = 0; iz <= 3; iz++)
    LP.push([(-0.5 + ix / 4) * BOX.w, (-0.5 + iy / 6) * BOX.h, -BOX.d / 2 + 0.015 + (iz / 3) * (BOX.d - 0.015)]);
  for (let ix = 0; ix <= 6; ix++) for (let iz = 0; iz <= 3; iz++)
    LP.push([(-0.5 + ix / 6) * (BOX.w + 2 * BOX.over), BOX.h / 2 + BOX.roofT, -BOX.d / 2 + 0.01 + (iz / 3) * (BOX.d + BOX.over * 1.6 - 0.01)]);
  for (let ix = 0; ix <= 4; ix++) for (let iy = 1; iy <= 4; iy++) for (let iz = 0; iz <= 1; iz++)
    HP.push([(-0.5 + ix / 4) * 0.25, BOX.h / 2 + BOX.roofT + iy * 0.045, 0.02 + iz * 0.04]);
  const wp = new Float32Array(Math.max(LP.length, HP.length) * 3);
  function blocked(y, pts = LP) {
    poseAt(y, tp);
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (let k = 0; k < pts.length; k++) {
      const l = pts[k], o = k * 3;
      const px = tp.c.x + tp.ex.x * l[0] + tp.ey.x * l[1] + tp.ez.x * l[2], py = tp.c.y + tp.ex.y * l[0] + tp.ey.y * l[1] + tp.ez.y * l[2], pz = tp.c.z + tp.ex.z * l[0] + tp.ey.z * l[1] + tp.ez.z * l[2];
      wp[o] = px; wp[o + 1] = py; wp[o + 2] = pz;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
    }
    for (let s = 0; s < nSeg; s++) {
      const o = s * 8, ax = segs[o], ay = segs[o + 1], az = segs[o + 2], bx = segs[o + 3], by = segs[o + 4], bz = segs[o + 5], r0 = segs[o + 6], r1 = segs[o + 7];
      const m = Math.max(r0, r1) + CLEAR;
      if (Math.max(ax, bx) + m < x0 || Math.min(ax, bx) - m > x1 || Math.max(ay, by) + m < y0 || Math.min(ay, by) - m > y1 || Math.max(az, bz) + m < z0 || Math.min(az, bz) - m > z1) continue;
      const vx = bx - ax, vy = by - ay, vz = bz - az, L2 = vx * vx + vy * vy + vz * vz;
      for (let k = 0; k < pts.length; k++) {
        const px = wp[k * 3], py = wp[k * 3 + 1], pz = wp[k * 3 + 2];
        let u = L2 > 0 ? ((px - ax) * vx + (py - ay) * vy + (pz - az) * vz) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const dx = ax + vx * u - px, dy = ay + vy * u - py, dz = az + vz * u - pz;
        const rr = r0 + (r1 - r0) * u + CLEAR;
        if (dx * dx + dy * dy + dz * dz < rr * rr) return true;
      }
    }
    return false;
  }
  // Laub vor dem Kasten: Zweig-Karten (Ebene 1×1, Fuß unten Mitte am Knoten), die Blätter darauf als Ellipse genähert.
  // Wachstum wie in updateTree (ohne das Laubfenster für das Eichhörnchen), Größe ohne Jahreszeit und Qualitätsstufe –
  // sonst wanderte der Kasten mit dem Frühling oder wenn die Kamera zum Eichhörnchen fährt.
  let cards = new Float32Array(0), nCard = 0;
  function collectCards() {
    nCard = 0; if (!leafMesh || !rE || !leafNode) return;
    const M = leafMesh.instanceMatrix.array, n = leafMesh.count, B = tree.birth, Hd = tree.hideAt;
    const gs = Math.min(1, grownTop / 5.0) * smooth((grownTop - 1.6) / 1.6);
    if (cards.length < n * 13) cards = new Float32Array(n * 13);
    for (let k = 0; k < n; k++) {
      const i = leafNode[k];
      const lowL = smooth((mY[i] - crownBase - 0.15) / 0.3); if (lowL <= 0) continue;
      const sprout = smooth((T - B[i] - 0.1 - leafBirthJit[k] * 0.2) / 2.0);
      const shed = (Hd[i] > 1e8 ? 1 - smooth((rE[i] - 2.5) / 7) : 1) * smooth((Hd[i] - T) / 1.5);
      const g = sprout * shed * lowL * gs; if (g < 0.05) continue;
      const m = k * 16, o = nCard * 13;
      cards[o] = M[m + 12]; cards[o + 1] = M[m + 13]; cards[o + 2] = M[m + 14];
      cards[o + 3] = M[m] * g; cards[o + 4] = M[m + 1] * g; cards[o + 5] = M[m + 2] * g;
      cards[o + 6] = M[m + 4] * g; cards[o + 7] = M[m + 5] * g; cards[o + 8] = M[m + 6] * g;
      cards[o + 9] = M[m + 8]; cards[o + 10] = M[m + 9]; cards[o + 11] = M[m + 10];
      cards[o + 12] = 1.12 * Math.hypot(cards[o + 6], cards[o + 7], cards[o + 8]);
      nCard++;
    }
  }
  // Blick von vorn (leicht von oben, wie die Kamera): verdeckt Laub das Flugloch oder mehr als eine der Prüfstellen?
  const VD = new V(), FV = [[HOLE.x, HOLE.y, 1], [-0.08, 0.12, 0], [0.08, 0.12, 0], [-0.08, -0.04, 0], [0.08, -0.04, 0], [-0.08, -0.16, 0], [0.08, -0.16, 0], [0, 0.18, 0], [0, -0.1, 0]];
  function cardHit(c, px, py, pz) {                    // trifft der Strahl p + t·VD die Blätter der Karte c?
    const o = c * 13, ox = cards[o] - px, oy = cards[o + 1] - py, oz = cards[o + 2] - pz;
    const al = ox * VD.x + oy * VD.y + oz * VD.z, R = cards[o + 12];
    if (al < -R || al > 3 + R) return false;
    const qx = ox - VD.x * al, qy = oy - VD.y * al, qz = oz - VD.z * al; if (qx * qx + qy * qy + qz * qz > R * R) return false;
    const nx = cards[o + 9], ny = cards[o + 10], nz = cards[o + 11], den = VD.x * nx + VD.y * ny + VD.z * nz;
    if (Math.abs(den) < 1e-5) return false;
    const t = (ox * nx + oy * ny + oz * nz) / den; if (t <= 0.02 || t > 3) return false;
    const hx = VD.x * t - ox, hy = VD.y * t - oy, hz = VD.z * t - oz;
    const e2 = cards[o + 3] ** 2 + cards[o + 4] ** 2 + cards[o + 5] ** 2;
    const lx = (hx * cards[o + 3] + hy * cards[o + 4] + hz * cards[o + 5]) / e2, ly = (hx * cards[o + 6] + hy * cards[o + 7] + hz * cards[o + 8]) / e2;
    const u = lx / 0.38, v = (ly - 0.5) / 0.46; return u * u + v * v < 1;
  }
  function leafOnRay(px, py, pz) {
    for (let c = 0; c < nCard; c++) if (cardHit(c, px, py, pz)) return true;
    return false;
  }
  function hidden(y) {
    if (!nCard) return false;
    poseAt(y, tp); VD.copy(STAGE_D).addScaledVector(STAGE_U, 0.12).normalize();
    let n = 0;
    for (const f of FV) {
      const z = BOX.d / 2 + 0.01;
      const px = tp.c.x + tp.ex.x * f[0] + tp.ey.x * f[1] + tp.ez.x * z, py = tp.c.y + tp.ex.y * f[0] + tp.ey.y * f[1] + tp.ez.y * z, pz = tp.c.z + tp.ex.z * f[0] + tp.ey.z * f[1] + tp.ez.z * z;
      if (leafOnRay(px, py, pz)) { if (f[2]) return true; n++; }
    }
    return n > 1;
  }
  // Ziel-Höhe: vom bisherigen Platz so weit hinauf, wie frei ist; ist dort ein Ast hineingewachsen, ein Stück hinunter;
  // ohne bisherigen Platz von unten (erste freie Höhe über dem Gras, dann hinauf bis unter den Ast). Danach so wenig wie
  // möglich zurück, bis eine Meise auf dem Dach Platz hat (höchstens HEAD_BACK; sonst bleibt er direkt unter dem Ast).
  // Das hält auch das Laub, das unter der Krone herabhängt, vom Flugloch fern.
  const HEAD_BACK = 0.3, LEAF_BACK = 0.6;
  function findTarget(from) {
    let y = from;
    if (y != null && blocked(y)) {
      let d = y; while (d - STEP >= Y_MIN && blocked(d)) d -= STEP;
      y = blocked(d) ? null : d;
    }
    if (y == null) { y = Y_MIN; while (y <= Y_MAX && blocked(y)) y += STEP; if (y > Y_MAX) return null; }
    while (y + STEP <= Y_MAX && !blocked(y + STEP)) y += STEP;
    let yh = y;
    while (blocked(yh, HP) && yh - STEP >= Math.max(Y_MIN, y - HEAD_BACK) && !blocked(yh - STEP)) yh -= STEP;
    if (blocked(yh, HP)) yh = y;
    // Laub, das unter der Krone herabhängt: Flugloch und Vorderseite sollen von vorn frei sein – sonst ein Stück tiefer
    let yv = yh;
    while (hidden(yv) && yv - STEP >= Math.max(Y_MIN, yh - LEAF_BACK) && !blocked(yv - STEP)) yv -= STEP;
    return hidden(yv) ? yh : yv;
  }
  let yShown = null, yTarget = null, roofFree = false, lastKey = '', lastP = null, lastMs = 0, prevSc = -1, ovKey = '', snap = true;
  const prevPos = new V(1e9, 0, 0);
  function frame() {
    const show = sm(3.3, 3.75, P);                     // erscheint mit dem Wachsen auf Stufe 4
    if (show <= 0.001) { if (grp.visible) { grp.visible = false; shadowDirty = true; } yShown = yTarget = null; lastP = null; snap = true; return; }
    if (!tree || !tree.pos || !rad || !mY || !tubeGeo) return;
    if (!path) trunkPath();
    const now = nowMs(), dt = Math.min(0.2, Math.max(0, (now - lastMs) / 1000)); lastMs = now;
    const ov = window.__kastenSet, ok = ov ? ov.al + '|' + ov.y : '';
    // Stufe gesprungen (Laden, Test): neu von unten setzen, nicht gleiten – sobald die Äste zur neuen Stufe gezeichnet sind
    if (lastP == null || Math.abs(P - lastP) > 0.25 || ok !== ovKey) snap = true;
    lastP = P; ovKey = ok;
    alFix = ov && ov.al != null ? ov.al * Math.PI / 180 : null;
    const key = T + '|' + tubeGeo.instanceCount;
    if (key !== lastKey || yTarget == null || snap) {
      lastKey = key; collectSegs(); collectCards();
      const fresh = Math.abs(T - PtoT(P)) < 0.6;          // Röhren passen schon zur Stufe (beim Wachsen hinkt T nur ein Bild nach)
      yTarget = ov && ov.y != null ? ov.y : findTarget(snap ? null : yTarget);
      if (yTarget == null) yTarget = yShown != null ? yShown : 1.0;
      roofFree = !blocked(yTarget, HP);
      if (yShown == null || (snap && fresh)) yShown = yTarget;
      if (fresh) snap = false;
    }
    // gleitet hinauf (beim Wachsen), hinunter rasch
    yShown += (yTarget - yShown) * (1 - Math.exp(-dt / (yTarget > yShown ? 0.45 : 0.12)));
    if (Math.abs(yTarget - yShown) < 0.001) yShown = yTarget;
    poseAt(yShown, pose); N.copy(pose.ez);
    const sc = 0.6 + 0.4 * show;
    grp.position.copy(pose.back).addScaledVector(pose.ez, BOX.d / 2 * sc);
    grp.quaternion.setFromRotationMatrix(mtx.makeBasis(pose.ex, pose.ey, pose.ez)); grp.scale.setScalar(sc);
    if (!grp.visible || grp.position.distanceToSquared(prevPos) > 1e-8 || Math.abs(sc - prevSc) > 1e-4) {
      grp.visible = true; shadowDirty = true; prevPos.copy(grp.position); prevSc = sc;
      window.__kasten = { pos: grp.position.toArray().map(v => +v.toFixed(3)), y: +yShown.toFixed(3), ziel: +yTarget.toFixed(3), winkel: +(alNow * 180 / Math.PI).toFixed(1), neigung: +(pose.tilt * 180 / Math.PI).toFixed(1), dachFrei: roofFree, show: +show.toFixed(2) };
    }
  }
  window.__kastenFrei = (y) => { if (!path) trunkPath(); collectSegs(); collectCards(); return { frei: !blocked(y), dach: !blocked(y, HP), laub: hidden(y) }; };
  window.__kastenNdc = () => { const v = grp.position.clone().project(camera); return { x: v.x, y: v.y }; };
  window.__kastenGrp = grp;
  // Flugloch in Weltkoordinaten (für die Meisen)
  const hole = (out = new V()) => out.set(HOLE.x, HOLE.y, BOX.d / 2 + 0.002).applyMatrix4(grp.matrixWorld);
  // Laub zwischen einem Punkt und der Kamera? (für die Sitzplätze der Meisen, 28.10.: sonst säßen sie oft unsichtbar im
  // Laub). leafPrep() sammelt die Zweig-Karten neu (einmal je Suche), leafBlocked(p) prüft einen Punkt.
  // Schnell genug für viele Punkte: die Karten liegen in einem Bildschirm-Raster (je Zelle die Karten, deren umhüllender Kreis
  // sie berührt), geprüft werden nur die der Zelle, in der der Punkt erscheint.
  const GN = 24, GR = 1.2, grid = Array.from({ length: GN * GN }, () => []), gq = new V();
  let gridN = 0;
  const cellOf = (x, y) => { const i = Math.floor((x + GR) / (2 * GR) * GN), j = Math.floor((y + GR) / (2 * GR) * GN); return i < 0 || j < 0 || i >= GN || j >= GN ? -1 : j * GN + i; };
  function leafPrep() {
    gridN = 0; for (const c of grid) c.length = 0;
    if (!tree || !leafMesh) return;
    collectCards(); camera.updateMatrixWorld();
    const P0 = camera.projectionMatrix.elements[0], P5 = camera.projectionMatrix.elements[5];
    for (let c = 0; c < nCard; c++) {
      const o = c * 13; gq.set(cards[o], cards[o + 1], cards[o + 2]);
      const dist = gq.distanceTo(camera.position); if (dist < 0.05) continue;
      gq.project(camera); if (gq.z > 1) continue;
      const rx = cards[o + 12] * P0 / dist * 1.15, ry = cards[o + 12] * P5 / dist * 1.15;
      const i0 = Math.max(0, Math.floor((gq.x - rx + GR) / (2 * GR) * GN)), i1 = Math.min(GN - 1, Math.floor((gq.x + rx + GR) / (2 * GR) * GN));
      const j0 = Math.max(0, Math.floor((gq.y - ry + GR) / (2 * GR) * GN)), j1 = Math.min(GN - 1, Math.floor((gq.y + ry + GR) / (2 * GR) * GN));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j * GN + i].push(c);
    }
    gridN = nCard;
  }
  function leafBlocked(p) {
    if (!gridN) return false;
    gq.copy(p).project(camera); const cell = cellOf(gq.x, gq.y); if (cell < 0) return false;
    VD.copy(camera.position).sub(p).normalize();
    for (const c of grid[cell]) if (cardHit(c, p.x, p.y, p.z)) return true;
    return false;
  }
  const trunk = () => { if (!path) trunkPath(); return onPath; };   // Knoten des Stamms (für die Sitzplätze der Meisen)
  return { frame, hole, BOX, HOLE, grp, leafPrep, leafBlocked, trunk, get visible() { return grp.visible; }, get roofFree() { return roofFree; }, normal: N };
})();
// Prüfhilfen für Analysen: Baumdaten und gezeichnete Röhrenstücke
window.__treeX = () => ({ T, P, crownBase, birth: Array.from(tree.birth), mY: Array.from(mY), rad: Array.from(rad), pos: tree.pos.map(p => [p.x, p.y, p.z]), parent: Array.from(tree.parent), D: STAGE_D.toArray(), R: STAGE_R.toArray() });
window.__tubes = () => { const S = tubeGeo.getAttribute('aStart').array, E = tubeGeo.getAttribute('aEnd').array, Rd = tubeGeo.getAttribute('aRad').array, out = [];
  for (let k = 0; k < tubeGeo.instanceCount; k++) out.push([S[k * 3], S[k * 3 + 1], S[k * 3 + 2], E[k * 3], E[k * 3 + 1], E[k * 3 + 2], Rd[k * 2], Rd[k * 2 + 1]]); return out; };

// ------------------------------------------------------------------ Kohlmeisen-Paar (ab Stufe 3, 24.10.; Haltungen und Brut 28.10.)
// Stufe 3 (Nutzer 24.10. abends): noch kein Kasten – das Paar kommt ab und zu, setzt sich auf Äste im Baum, schaut sich
// um und fliegt wieder (ohne zu nisten). Ab Stufe 4 wohnt es im Nistkasten. Nachts nichts zu sehen. „Weniger Bewegung“:
// eine Meise sitzt still (Dach bzw. Ast, nur tagsüber; im Winter aufgeplustert).
// Nutzer 28.10.: mehr Haltungen, etwas im Schnabel, Junge im Kasten. Ablauf im Vanamo-Jahr (Tag 0 = Frühlingsbeginn):
//  – Nestbau (Tag 2–14): sie bringen Moos mit Halmen in den Kasten (halten sich unter dem Flugloch fest, schlüpfen hinein,
//    kommen ohne heraus); manchmal setzen sie sich erst aufs Dach, manchmal wartet die andere dort oder auf einem Ast.
//  – Füttern (Tag 14 bis zum Ausfliegen): Raupen. Kommt eine Meise ans Loch, schaut ein Junges bettelnd heraus (gelber
//    Sperrschnabel); mal füttern sie am Loch, mal schlüpfen sie hinein. Zwischendurch guckt ab und zu ein Kopf heraus.
//  – Ausfliegen (Tag 30–37, einmal im Jahr: beim ersten Ansehen im Zeitfenster, auf dem Gerät gemerkt wie beim Igel; im
//    Baum-Test nur im Speicher): die Eltern warten mit Raupen auf Ästen am Kasten, ein Junges reckt den Kopf heraus und
//    flattert wackelig auf einen Ast, ein Elternteil hüpft daneben und füttert es; so drei Junge nacheinander (holt einer
//    Nachschub, fliegt er kurz weg), dann fliegen alle zusammen davon. Verpasst man es, sind die Jungen einfach draußen.
//  – Sommer danach (bis Tag 56): ab und zu kommt ein Junges mit und wird auf dem Ast gefüttert; der Kasten bleibt leer.
//  – Die Jungen wachsen mit der Zeit (Köpfe im Flugloch bis zum Ausfliegen, Ästlinge über den Sommer), bleiben aber kleiner.
//  – Herbst und Winter: wie bisher auf dem Kastendach oder auf Ästen; im Winter aufgeplustert.
// Sitzen: Haltungen wechseln (sitzt, schaut sich um, pickt am Ast, putzt sich; im Winter aufgeplustert), dreht sich ab und
// zu um; an dünnen Ästen flattert sie manchmal darunter und hängt kopfüber (pendelt leicht), dann wieder hinauf oder weg.
// Bilder (Recraft nano_banana_pro, 28.10.; freigestellt mit meise/originale/meisen_neu2.py): sitz, hoch, tief (Flug =
// Daumenkino), Haltungen umschauen, picken, putzen, kopfueber, plustern; Moos, Raupe (im Schnabel, kleiner gezeichnet);
// Junge: nest-bettelt, nest-zu, nest-hoch (Kopf im Flugloch), jung-sitz, jung-hoch, jung-tief (Ästling). Maße:
// meise/meise-meta.json (len = Schnabel–Schwanz von „sitz“: alle Haltungen im selben Maßstab).
// Feste Bildebene wie alle Tiere; nach links gespiegelt. Hinein/heraus: Schnittebene = Vorderwand des Kastens. Köpfe im
// Flugloch: Bild in der Ebene der Vorderwand, nur in der Öffnung zu sehen (Ellipse; reckt es sich heraus, oben frei).
// Prüfhilfen: window.__meisen (Zustände), window.__meisenSim(s) (vorspulen ohne Zeichnen), window.__meisenHold (kommen
// nicht von selbst, auch nicht zum Ausfliegen), window.__meisenSpots() (Sitzplätze auf Ästen).
const meisenFx = (() => {
  const IMG = {"sitz":"6d04ae9b97.webp","hoch":"af358e66d3.webp","tief":"0f6c2b5bfc.webp","umschauen":"982f2ad865.webp","picken":"92b3ba769e.webp","putzen":"23270b759f.webp","kopfueber":"eb9f4cab28.webp","plustern":"c12fe0c95e.webp","moos":"427df999ce.webp","raupe":"224e75335c.webp","nest-bettelt":"1b1ae82d59.webp","nest-zu":"8e22001660.webp","nest-hoch":"b97a9afa5c.webp","jung-sitz":"7ddf94b098.webp","jung-hoch":"c955dbb248.webp","jung-tief":"a108347a01.webp"}, META = {"sitz":{"w":400,"h":285,"beak":[395.0,41.0],"tail":[4.0,243.0],"feet":[287.5,278.0]},"hoch":{"w":385,"h":345,"beak":[381.0,249.0],"tail":[3.0,310.0]},"tief":{"w":381,"h":327,"beak":[377.0,50.0],"tail":[3.0,108.0]},"umschauen":{"w":349,"h":331,"len":440.1,"beak":[344.0,120.0],"tail":[5.0,251.0],"feet":[236.5,324.0]},"picken":{"w":439,"h":245,"len":440.1,"beak":[434.0,124.5],"tail":[4.0,6.0],"feet":[310.5,238.0]},"putzen":{"w":352,"h":314,"len":440.1,"beak":[347.0,116.0],"tail":[4.0,266.0],"feet":[269.5,307.0]},"kopfueber":{"w":312,"h":360,"len":440.1,"beak":[307.0,106.0],"tail":[4.0,350.0],"grip":[125.0,25.0],"twig":-8.9},"plustern":{"w":389,"h":252,"len":440.1,"beak":[384.0,126.0],"tail":[4.0,195.0],"feet":[279.5,245.0]},"moos":{"w":202,"h":212,"len":440.1,"grip":[100.5,7.0]},"raupe":{"w":118,"h":72,"len":440.1,"grip":[58.5,45.0]},"nest-bettelt":{"w":160,"h":142,"unten":[79.5,139.0]},"nest-zu":{"w":160,"h":116,"unten":[79.5,113.0]},"nest-hoch":{"w":160,"h":176,"unten":[79.5,173.0]},"jung-sitz":{"w":360,"h":289,"beak":[356.0,56.5],"tail":[4.0,235.0],"feet":[245.0,283.0]},"jung-hoch":{"w":370,"h":395,"beak":[366.0,250.0],"tail":[3.0,352.0]},"jung-tief":{"w":370,"h":306,"beak":[366.0,48.0],"tail":[3.0,120.5]}};
  const loader = new THREE.TextureLoader(), tex = {};
  const getTex = (k) => {
    if (!tex[k]) { const t = loader.load(__img(IMG[k])); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; tex[k] = t; }
    return tex[k];
  };
  getTex('sitz');
  let allTex = false;                                   // die übrigen Bilder erst, wenn Meisen kommen dürfen (ab Stufe 3)
  const LEN = 0.26;                                    // Schnabel bis Schwanzspitze (Häher 0,62 → wie in echt 14 : 34 cm)
  // Die Jungen wachsen (Nutzer 28.10.: „die küken … kleiner“, „mit der zeit wachsen, aber im sommer trotzdem noch kleiner als
  // die eltern“): Ästling beim Ausfliegen (Tag 30) 0,15 lang, bis Sommerende (Tag 56) 0,18 – er ist rund gemalt (kurzer
  // Schwanz), mit 0,205 wirkte er so groß wie die Eltern. Kopf im Flugloch 0,042 breit (Tag 14) bis 0,058 (Tag 30; Loch 0,088).
  const lenJ = () => 0.15 + 0.03 * sm(AUS[0], SOMMER_ENDE, tag());
  const nestK = () => (0.042 + 0.016 * sm(FUTTER, AUS[0], tag())) / 160;   // Welt je Bildpunkt (die Kopfbilder sind 160 breit)
  const ITEM = { moos: 0.45, raupe: 0.7 };             // im Schnabel: Moos etwa kopfgroß, Raupe ~2,5 cm (Maßstab der Haltungen × Faktor)
  const KOPF_R = 0.04;                                 // kopfüber nur an dünnen Ästen (Halbmesser)
  const TWIG = 8.9 * Math.PI / 180;                    // Zweig im Bild „kopfueber“ (weggenommen): steigt nach rechts an
  const kOf = (f) => { const m = META[f]; return (f.startsWith('jung') ? lenJ() : LEN) / (m.len || Math.hypot(m.beak[0] - m.tail[0], m.beak[1] - m.tail[1])); };
  renderer.localClippingEnabled = true;
  const clip = new THREE.Plane(new V(0, 0, 1), 0), CLIP = [clip];
  const mk = (order) => {
    const m = new THREE.MeshBasicMaterial({ map: tex.sitz, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    m.color.setScalar(0.94);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); mesh.renderOrder = order; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    return mesh;
  };
  // Kopf im Flugloch: Bild in der Ebene der Vorderwand (Kind des Kastens), nur innerhalb der Loch-Ellipse zu sehen;
  // uOut = 1: reckt sich heraus – oberhalb der Lochmitte frei
  const HU = { uHole: { value: new THREE.Vector4(0, 0, 1, 1) }, uOut: { value: 0 }, uLoc: { value: null } };
  const headMesh = (() => {
    const m = new THREE.MeshBasicMaterial({ map: tex.sitz, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    m.color.setScalar(0.78);
    m.customProgramCacheKey = () => 'meisenLoch1';    // die Nachtfärbung hüllt onBeforeCompile ein: eigener Schlüssel
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, HU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uLoc; varying vec2 vBox;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvBox = (uLoc * vec4(transformed, 1.)).xy;');
      sh.fragmentShader = 'uniform vec4 uHole; uniform float uOut; varying vec2 vBox;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n{ vec2 q = (vBox - uHole.xy) / uHole.zw; if (dot(q, q) > 1. && (uOut < .5 || vBox.y < uHole.y)) discard; }');
    };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); mesh.renderOrder = 22; mesh.frustumCulled = false; mesh.visible = false;
    HU.uLoc.value = mesh.matrix; nistkastenFx.grp.add(mesh);
    return mesh;
  })();
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rr = (a, b) => a + Math.random() * (b - a);
  // Bildpunkt px eines Bildes, dessen Ankerpunkt ax (Bild-px) auf p liegt (k: Welt je Bildpunkt; fc = +1 Kopf rechts,
  // −1 gespiegelt; tilt gegen den Uhrzeigersinn, gespiegelt mit) → Welt
  function imgPt(k, ax, p, fc, tilt, px, out) {
    const a = tilt * fc, c = Math.cos(a), s = Math.sin(a), x = fc * (px[0] - ax[0]) * k, y = (ax[1] - px[1]) * k;
    return out.copy(p).addScaledVector(STAGE_R, x * c - y * s).addScaledVector(STAGE_U, x * s + y * c);
  }
  const qz = new THREE.Quaternion(), zN = new V(0, 0, 1), ctr = [0, 0];
  function place(mesh, f, k, ax, p, fc, tilt, clipOn) {
    const m = META[f], map = getTex(f);
    if (mesh.material.map !== map) mesh.material.map = map;
    ctr[0] = m.w / 2; ctr[1] = m.h / 2;
    imgPt(k, ax, p, fc, tilt, ctr, mesh.position);
    mesh.quaternion.copy(STAGE_Q).multiply(qz.setFromAxisAngle(zN, tilt * fc)); mesh.scale.set(fc * m.w * k, m.h * k, 1);
    mesh.material.clippingPlanes = clipOn ? CLIP : null;
    const u = mesh.userData; u.f = f; u.k = k; u.fc = fc; u.ax = ax; u.tilt = tilt; (u.p || (u.p = new V())).copy(p);
    mesh.visible = true;
  }
  const ptOf = (mesh, px, out) => { const u = mesh.userData; return imgPt(u.k, u.ax, u.p, u.fc, u.tilt, px, out); };   // Punkt im gezeichneten Bild → Welt
  const beakNow = (b, out = new V()) => ptOf(b.mesh, META[b.mesh.userData.f].beak, out);
  const beakAt = (f, p, fc, out = new V()) => imgPt(kOf(f), META[f].feet, p, fc, 0, META[f].beak, out);   // Schnabel einer sitzenden Meise (Bild f), Füße auf p
  // Vogel zeichnen: Bild f, Anker (Name im Bild oder [x, y]) auf p; dazu das Ding im Schnabel
  function draw(b, f, p, anchor, fc, clipOn = false, tilt = 0) {
    const m = META[f];
    place(b.mesh, f, kOf(f), typeof anchor === 'string' ? m[anchor] : anchor, p, fc, tilt, clipOn);
    if (b.item) drawItem(b, clipOn);
  }
  const iq = new V(), iPx = [0, 0];
  function drawItem(b, clipOn) {
    const u = b.mesh.userData, bk = META[u.f].beak;
    if (!b.carry || !bk) { b.item.visible = false; return; }
    iPx[0] = bk[0] - 6; iPx[1] = bk[1] + 3;            // etwas hinter der Schnabelspitze
    ptOf(b.mesh, iPx, iq);
    const im = META[b.carry];
    place(b.item, b.carry, LEN / im.len * ITEM[b.carry], im.grip, iq, u.fc, b.carry === 'raupe' ? u.tilt : 0, clipOn);   // Moos hängt
  }
  // Weg (Catmull-Rom nach Bogenlänge)
  function makePath(pts) {
    const P = pts.map(p => p.clone()), N = 20 * (P.length - 1), samples = [], len = [0];
    const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return new V().addScaledVector(a, -0.5 * t3 + t2 - 0.5 * t).addScaledVector(b, 1.5 * t3 - 2.5 * t2 + 1).addScaledVector(c, -1.5 * t3 + 2 * t2 + 0.5 * t).addScaledVector(d, 0.5 * t3 - 0.5 * t2); };
    for (let i = 0; i <= N; i++) {
      const g = i / N * (P.length - 1), k = Math.min(P.length - 2, Math.floor(g)), t = g - k;
      const s = cr(P[Math.max(0, k - 1)], P[k], P[k + 1], P[Math.min(P.length - 1, k + 2)], t);
      if (i) len.push(len[i - 1] + s.distanceTo(samples[i - 1])); samples.push(s);
    }
    return { total: len[N], at(d, out) { d = Math.min(len[N], Math.max(0, d)); let i = 1; while (i < N && len[i] < d) i++; const u = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]); return out.copy(samples[i - 1]).lerp(samples[i], u); } };
  }
  const W = (x, y, z) => stageToWorld(x, y, z);
  const toSt = (p) => ({ x: p.dot(STAGE_R), y: p.y, z: p.dot(STAGE_D) });
  // Punkte am Kasten (Welt): Flugloch, Dach
  const holeP = new V(), roofP = new V(), tmp = new V(), tmp2 = new V();
  function boxPoints() {
    const g = nistkastenFx.grp; g.updateMatrixWorld(true);
    const B = nistkastenFx.BOX, H = nistkastenFx.HOLE;
    holeP.set(H.x, H.y, B.d / 2 + 0.004).applyMatrix4(g.matrixWorld);
    roofP.set(0, B.h / 2 + B.roofT + 0.012, 0.02).applyMatrix4(g.matrixWorld);
    // Schnittebene: Vorderwand (Normale nach außen)
    clip.normal.copy(nistkastenFx.normal); clip.constant = -clip.normal.dot(holeP) + 0.004;
  }
  const roofAt = (x, out = new V()) => { const B = nistkastenFx.BOX; return out.set(x, B.h / 2 + B.roofT + 0.012, 0.02).applyMatrix4(nistkastenFx.grp.matrixWorld); };
  const roofSpot = (x) => nistkastenFx.roofFree ? { p: roofAt(x), roof: true, x, r: 1 } : null;
  const SPEED = 2.1;                                   // Fluggeschwindigkeit (Nutzer 25.10.: etwas schneller, vorher 1,5)
  const CLING = 0.75;                                  // festhalten unter dem Loch: Körper steiler (Schwanz nach unten)
  const clingP = (out = new V()) => out.copy(holeP).add(tmp2.set(0, -0.012, 0)).addScaledVector(nistkastenFx.normal, 0.03).addScaledVector(STAGE_R, 0.02);
  // Füttern vor dem Loch (29.10.): etwas tiefer und links festhalten, die Raupe nach oben reichen – das bettelnde Junge im
  // Loch (Kopf etwas höher, s. updHead) bleibt ganz zu sehen
  const FEED = { x: -0.015, y: -0.024, tilt: CLING };
  const clingFeedP = (out = new V()) => out.copy(holeP).add(tmp2.set(0, FEED.y, 0)).addScaledVector(nistkastenFx.normal, 0.03).addScaledVector(STAGE_R, FEED.x);
  const clingOf = (b, out) => b.amLoch ? clingFeedP(out) : clingP(out);

  // ---- Jahr: Brutzeit nach dem Tag im Vanamo-Jahr; Ausfliegen einmal je Jahr (gemerkt; im Baum-Test nur im Speicher)
  const NEST = 2, FUTTER = 14, AUS = [30, 37], SOMMER_ENDE = 56, KEY = 'vanamo-meisen';
  let jahr = OPT.jahr ?? null, lsF = null, lsAt = -1e9; const mem = {};
  const tag = () => { const d = yearSt ? yearSt.d : yearDay; return ((d % YEAR_LEN) + YEAR_LEN) % YEAR_LEN; };
  function flags() {
    if (jahr == null) return mem;
    const t = performance.now(); if (lsF && t - lsAt < 1000) return lsF;
    lsAt = t; try { lsF = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { lsF = {}; }
    return lsF;
  }
  const done = (k) => flags()[k] === (jahr ?? 'test');
  function setDone(k) {
    if (jahr == null) { mem[k] = 'test'; return; }
    try { const f = { ...flags() }; f[k] = jahr; localStorage.setItem(KEY, JSON.stringify(f)); lsF = f; lsAt = performance.now(); } catch {}
  }
  const hasBox = () => nistkastenFx.visible;
  function phase() {
    if (!hasBox()) return 'frei';                          // Stufe 3: nur Äste
    const d = tag();
    if (d >= NEST && d < FUTTER) return 'nest';
    if (d >= FUTTER && d < AUS[1]) return d >= AUS[0] && done('aus') ? 'familie' : 'futter';
    if (d >= AUS[1] && d < SOMMER_ENDE) return 'familie';
    return 'ruhe';
  }
  const ausPending = () => hasBox() && tag() >= AUS[0] && tag() < AUS[1] && !done('aus');
  const allowed = () => P >= 2.98 && !__isNight();

  // ---- Sitzplätze auf Ästen (29.10. überarbeitet; Nutzer: „landen die Meisen teilweise im Stamm, sie sollten aber immer
  // sichtbar irgendwo auf nem Ast sein“): nur Äste und Zweige, nicht der Stamm selbst; höchstens ~48° steil, vorn, im Bild;
  // die Füße stehen oben auf dem Ast (bei schrägen Ästen entsprechend höher). Ein Platz zählt nur, wenn die ganze Meise zu
  // sehen ist: kein Laub vor Ast, Füßen, Bauch und Kopf (Zweig-Karten des Nistkastens), und weder Stamm noch ein anderer
  // Ast an oder vor ihr – Füße, Bauch, Kopf und Schwanz/Kopf nach beiden Seiten (Röhrenstücke wie gezeichnet, s. tubeHit).
  // Gibt es keinen solchen Platz, setzt sie sich aufs Kastendach – oder kommt diesmal nicht.
  function spotOn(i, u) {                               // oben auf dem Aststück (Elternknoten → i), u entlang
    const a = tree.pos[tree.parent[i]], b = tree.pos[i], r = rad[tree.parent[i]] + (rad[i] - rad[tree.parent[i]]) * u;
    const L = a.distanceTo(b), h = Math.hypot(b.x - a.x, b.z - a.z) / Math.max(1e-6, L);   // cos der Neigung
    const c = a.clone().lerp(b, u), p = c.clone(); p.y += r / Math.max(0.6, h) + 0.004;
    return { p, c, r, i, u, L };
  }
  function spotOk(p) {
    if (p.y < 0.55 || p.y > crownBase + 0.9) return false;
    if (toSt(p).z < -0.05) return false;
    const n = p.clone().project(camera); return !(Math.abs(n.x) > 0.72 || n.y < -0.55 || n.y > 0.7);
  }
  // Laub davor (28.10.): Ast vorn unter den Füßen, Füße, Bauch, Kopf; hängend der Körper unter dem Ast (nicht bei kahlem Baum)
  const lq = new V(), leafTest = () => yearLeafK > 0.4;
  const SIT_LEAF = [-0.012, 0.03, 0.08, 0.14], HANG_LEAF = [-0.04, -0.11, -0.18];
  const leafFree = (p, dy) => { for (const y of dy) if (nistkastenFx.leafBlocked(lq.copy(p).add(tmp2.set(0, y, 0)))) return false; return true; };
  // Stamm und Äste (29.10.): alle gezeichneten Röhrenstücke (Halbmesser wie im Rinden-Shader samt Wurzelanlauf und Rinde),
  // in einem Bildschirm-Raster (je Zelle die Stücke, deren Umriss sie berührt). Ein Prüfpunkt ist nicht frei, wenn er in einem
  // Stück liegt oder ihm näher als 1,5 cm kommt, oder wenn ein Stück zwischen ihm und der Kamera liegt. Die eigenen Aststücke
  // (das Stück, auf dem sie sitzt, das davor – außer es ist der Stamm – und die danach) zählen nicht.
  const SIT_TUBE = [[0, 0.03], [0, 0.08], [0, 0.14], [-0.11, 0.07], [0.11, 0.07]];   // Füße, Bauch, Kopf; Schwanz/Kopf links und rechts
  const HANG_TUBE = [[0, -0.05], [0, -0.12], [0, -0.19], [-0.07, -0.1], [0.07, -0.1]];
  const TG = 24, TGR = 1.2, tGrid = Array.from({ length: TG * TG }, () => []);
  let tS = new Float32Array(0), tDep = new Float32Array(0), tNode = new Int32Array(0), kidsOf = null, onTrunk = null;
  const tVD = new V();                                 // Blickrichtung der Kamera (Tiefe der Stücke für das Überspringen)
  const tq = new V(), tq2 = new V(), SS = { s: 0, t: 0 };
  const reff = (y, r) => r * (1 + 1.95 * Math.exp(-Math.max(0, y) * 2.4) * sm01(0.025, 0.12, r)) * 1.125 + 0.01;
  const cl01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  function tubePrep() {
    for (const c of tGrid) c.length = 0;
    if (!kidsOf) {
      kidsOf = Array.from({ length: tree.parent.length }, () => []);
      for (let i = 1; i < tree.parent.length; i++) kidsOf[tree.parent[i]].push(i);
      onTrunk = nistkastenFx.trunk();
    }
    if (!tubeGeo) return;
    const S = tubeGeo.getAttribute('aStart').array, E = tubeGeo.getAttribute('aEnd').array, Rd = tubeGeo.getAttribute('aRad').array, cnt = tubeGeo.instanceCount;
    if (tNode.length < cnt) { tS = new Float32Array(cnt * 8 + 800); tDep = new Float32Array(cnt * 2 + 200); tNode = new Int32Array(cnt + 100); }
    let k = 0;                                          // Stück k gehört zu Knoten i (Reihenfolge wie in updateTree), danach der Wohnast
    for (let i = 1; i < tree.parent.length && k < cnt; i++) {
      if (T - tree.birth[i] <= 0) continue;
      if (sm01(0, 0.35, mY[i] - crownBase) <= 0.02) continue;
      tNode[k++] = i;
    }
    for (; k < cnt; k++) tNode[k] = -1;
    camera.updateMatrixWorld(); camera.getWorldDirection(tVD);
    const C = camera.position, P0 = camera.projectionMatrix.elements[0], P5 = camera.projectionMatrix.elements[5], cell = (x) => Math.floor((x + TGR) / (2 * TGR) * TG);
    for (let q = 0; q < cnt; q++) {
      const r0 = Rd[q * 2], r1 = Rd[q * 2 + 1]; if (Math.max(r0, r1) < TUBE_IN.min) continue;   // dünnere Zweige zählen nie
      const o = q * 8;
      tS[o] = S[q * 3]; tS[o + 1] = S[q * 3 + 1]; tS[o + 2] = S[q * 3 + 2]; tS[o + 3] = E[q * 3]; tS[o + 4] = E[q * 3 + 1]; tS[o + 5] = E[q * 3 + 2];
      tS[o + 6] = reff(tS[o + 1], r0); tS[o + 7] = reff(tS[o + 4], r1);
      tDep[q * 2] = (tS[o] - C.x) * tVD.x + (tS[o + 1] - C.y) * tVD.y + (tS[o + 2] - C.z) * tVD.z;
      tDep[q * 2 + 1] = (tS[o + 3] - C.x) * tVD.x + (tS[o + 4] - C.y) * tVD.y + (tS[o + 5] - C.z) * tVD.z;
      tq.set(tS[o], tS[o + 1], tS[o + 2]); const dA = tq.distanceTo(camera.position); tq.project(camera);
      tq2.set(tS[o + 3], tS[o + 4], tS[o + 5]); const dB = tq2.distanceTo(camera.position); tq2.project(camera);
      if (tq.z > 1 || tq2.z > 1) continue;
      const rr0 = Math.max(tS[o + 6], tS[o + 7]) / Math.max(0.05, Math.min(dA, dB)) * 1.15 + 0.02;
      const i0 = Math.max(0, cell(Math.min(tq.x, tq2.x) - rr0 * P0)), i1 = Math.min(TG - 1, cell(Math.max(tq.x, tq2.x) + rr0 * P0));
      const j0 = Math.max(0, cell(Math.min(tq.y, tq2.y) - rr0 * P5)), j1 = Math.min(TG - 1, cell(Math.max(tq.y, tq2.y) + rr0 * P5));
      for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) tGrid[j * TG + ii].push(q);
    }
  }
  function segSeg(px, py, pz, qx, qy, qz, o) {          // kleinster Abstand² zwischen P→Q und dem Röhrenstück o (setzt SS.s, SS.t)
    const ax = tS[o], ay = tS[o + 1], az = tS[o + 2];
    const d1x = qx - px, d1y = qy - py, d1z = qz - pz, d2x = tS[o + 3] - ax, d2y = tS[o + 4] - ay, d2z = tS[o + 5] - az;
    const rx = px - ax, ry = py - ay, rz = pz - az;
    const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
    let s = 0, t = 0;
    if (a <= 1e-12) t = e > 1e-12 ? cl01(f / e) : 0;
    else {
      const c = d1x * rx + d1y * ry + d1z * rz;
      if (e <= 1e-12) s = cl01(-c / a);
      else {
        const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
        s = den > 1e-12 ? cl01((b * f - c * e) / den) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = cl01(-c / a); } else if (t > 1) { t = 1; s = cl01((b - c) / a); }
      }
    }
    const x = px + d1x * s - ax - d2x * t, y = py + d1y * s - ay - d2y * t, z = pz + d1z * s - az - d2z * t;
    SS.s = s; SS.t = t; return x * x + y * y + z * z;
  }
  const TUBE_IN = { min: 0.02, occ: 0.035 };           // ab welchem Halbmesser ein Stück zählt: an/in der Meise / verdeckt sie (dünne Zweige davor stören nicht)
  function tubeHit(p, own, M = TUBE_IN) {              // p in/an einem Röhrenstück oder davon verdeckt (ohne die eigenen)
    tq.copy(p).project(camera);
    const ci = Math.floor((tq.x + TGR) / (2 * TGR) * TG), cj = Math.floor((tq.y + TGR) / (2 * TGR) * TG);
    if (ci < 0 || cj < 0 || ci >= TG || cj >= TG) return false;
    const C = camera.position, dp = (p.x - C.x) * tVD.x + (p.y - C.y) * tVD.y + (p.z - C.z) * tVD.z;
    for (const q of tGrid[cj * TG + ci]) {
      if (own && own.has(tNode[q])) continue;
      const o = q * 8, rm = Math.max(tS[o + 6], tS[o + 7]);
      if (Math.min(tDep[q * 2], tDep[q * 2 + 1]) - rm > dp + 0.03) continue;   // ganz dahinter: weder drin noch davor
      let d2, r;
      if (rm >= M.min) { d2 = segSeg(p.x, p.y, p.z, p.x, p.y, p.z, o); r = tS[o + 6] + (tS[o + 7] - tS[o + 6]) * SS.t; if (d2 < (r + 0.015) * (r + 0.015)) return true; }
      if (rm >= M.occ) { d2 = segSeg(p.x, p.y, p.z, C.x, C.y, C.z, o); r = tS[o + 6] + (tS[o + 7] - tS[o + 6]) * SS.t; if (SS.s > 0 && d2 < r * r) return true; }
    }
    return false;
  }
  const ownOf = (i) => {                                // eigene Aststücke: dieses, die danach, das davor (außer Stamm)
    const o = new Set([i, ...kidsOf[i]]), pa = tree.parent[i];
    if (!(onTrunk[pa] && onTrunk[tree.parent[pa]])) o.add(pa);
    return o;
  };
  const tubeFree = (p, pts, own) => { for (const [x, y] of pts) if (tubeHit(lq.copy(p).addScaledVector(STAGE_R, x).add(tmp2.set(0, y, 0)), own)) return false; return true; };
  let prepKey = '', leafKey = '';
  function prepLeaf() { if (leafKey !== cacheKey) { leafKey = cacheKey; if (leafTest()) nistkastenFx.leafPrep(); } }
  function prepSight() {                                // Laub-Karten und Röhrenstücke neu sammeln, wenn sich Baum, Jahreszeit oder Kamera geändert haben
    cacheCheck(); if (prepKey === cacheKey) return;
    prepLeaf(); prepKey = cacheKey; tubePrep();
  }
  function spotFree(sp) {                               // ist die ganze Meise auf diesem Platz zu sehen?
    if (!spotOk(sp.p)) return false;
    if (leafTest() && !leafFree(sp.p, SIT_LEAF)) return false;
    return tubeFree(sp.p, SIT_TUBE, ownOf(sp.i));
  }
  function hangFree(sp) {                               // … und kopfüber darunter?
    prepSight();
    if (leafTest() && !leafFree(sp.c, HANG_LEAF)) return false;
    return tubeFree(lq.copy(sp.c), HANG_TUBE, ownOf(sp.i));
  }
  const sdir = new V();
  // Aststücke, auf denen eine Meise sitzen könnte (ohne Sichtprüfung), und je Stück der gefundene freie Platz (oder keiner):
  // zwischengespeichert, solange Baum, Jahreszeit und Kamera gleich bleiben (höchstens 20 s je Stück)
  let candC = null, cacheKey = '', keyAt = -1e9;
  const spotCache = new Map();
  function cacheCheck() {
    const C = camera.position, key = T.toFixed(3) + '|' + season + '|' + yearLeafK.toFixed(2) + '|' + C.x.toFixed(2) + ',' + C.y.toFixed(2) + ',' + C.z.toFixed(2);
    if (key !== cacheKey) { cacheKey = key; keyAt = vt; spotCache.clear(); candC = null; }
  }
  function candSegs() {
    cacheCheck(); if (candC) return candC;
    if (!onTrunk) onTrunk = nistkastenFx.trunk();
    const out = [];
    for (let i = 1; i < tree.parent.length; i++) {
      if (__fracOf(i) < 0.95 || !__alive(i)) continue;
      const pa = tree.parent[i]; if (onTrunk[i] && onTrunk[pa]) continue;      // nicht auf den Stamm
      const r0 = rad[pa], r1 = rad[i]; if (r1 < 0.008 || r0 > 0.45) continue;   // auch dünne Zweige (Meisen sitzen gern darauf)
      sdir.subVectors(tree.pos[i], tree.pos[pa]);
      const L = sdir.length(); if (L < 0.07 || Math.abs(sdir.y / L) > 0.75) continue;   // höchstens ~48° steil
      const m = tree.pos[i].clone().lerp(tree.pos[pa], 0.5);
      if (m.y < 0.45 || m.y > crownBase + 1.0) continue;
      out.push({ i, m });
    }
    candC = out;
    return out;
  }
  // Freie Plätze: Aststücke in zufälliger Reihenfolge (mit focus: die nächsten zuerst), je Stück bis zu vier Stellen, die
  // erste freie zählt; aufhören, sobald max gefunden sind (sonst kostet die Suche auf großen Bäumen zu viel)
  function freeSpots(focus, max = 40) {
    const segs = candSegs().slice();
    if (focus) { for (const c of segs) c.d = c.m.distanceTo(focus); segs.sort((a, b) => a.d - b.d); }
    else for (let k = segs.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; const t = segs[k]; segs[k] = segs[j]; segs[j] = t; }
    const out = [];
    for (const c of segs) {
      const e = cached(c.i) || evalSeg(c.i);
      if (e.sp) out.push(e.sp);
      if (out.length >= max) break;
    }
    return out;
  }
  const cached = (i) => { const e = spotCache.get(i); return e && vt - e.at <= 20 && vt >= e.at ? e : null; };
  function evalSeg(i) {                                 // je Aststück bis zu vier Stellen, die erste freie zählt
    prepSight();
    let found = null;
    for (let k = 0; k < 4 && !found; k++) { const sp = spotOn(i, rr(0.25, 0.85)); if (spotFree(sp)) found = sp; }
    const e = { sp: found, at: vt }; spotCache.set(i, e);
    return e;
  }
  let warmI = 0;
  function warm(n) {                                    // im Leerlauf ein paar Stücke vorab prüfen (verteilt über die Bilder)
    cacheCheck(); if (vt - keyAt < 0.8) return;         // erst, wenn Kamera und Baum still stehen (sonst jedes Bild neu sammeln)
    if (leafKey !== cacheKey) { prepLeaf(); return; }   // je ein Bild: Laub-Karten, Röhrenstücke, Aststücke sammeln
    if (prepKey !== cacheKey) { prepSight(); return; }
    if (!candC) { candSegs(); return; }
    const segs = candC; if (!segs.length) return;
    for (let k = 0, done = 0; k < 60 && done < n; k++) {
      warmI = (warmI + 1) % segs.length;
      if (!cached(segs[warmI].i)) { evalSeg(segs[warmI].i); done++; }
    }
  }
  function pickSpot(near, avoid = []) {                // nur Plätze, an denen die ganze Meise zu sehen ist
    let c = freeSpots(near, near ? 24 : 30).filter(s => avoid.every(q => q.distanceTo(s.p) > 0.16)); if (!c.length) return null;
    if (near) { const k = c.filter(s => s.p.distanceTo(near) > 0.15 && s.p.distanceTo(near) < 0.7); if (k.length) c = k; }
    return c[(Math.random() * c.length) | 0];
  }
  const occupied = () => [...birds, ...young].filter(b => b.spot && b.st !== 'weg').map(b => b.spot.p);
  const roofTaken = (x) => [...birds, ...young].some(b => b.st !== 'weg' && ((b.spot && b.spot.roof && Math.abs(b.spot.x - x) < 0.1) || ((b.st === 'dach' || b.st === 'anflugDach') && Math.abs(x) < 0.1)));
  // Platz neben s (für den Altvogel, der ein Junges füttert): auf demselben Aststück zur Seite side (Bühnen-x), sonst die
  // andere Seite, sonst ein freier Platz ganz in der Nähe; auf dem Dach daneben
  function nextTo(s, side, occ) {
    const free = (p) => occ.every(q => q.distanceTo(p) > 0.1);
    if (s.roof) {
      for (const sd of [side, -side]) { const x = s.x + sd * 0.13; if (Math.abs(x) <= 0.16) return { p: roofAt(x), roof: true, x, r: 1 }; }
      return null;
    }
    prepSight();
    const dx = Math.sign(tmp.subVectors(tree.pos[s.i], tree.pos[tree.parent[s.i]]).dot(STAGE_R)) || 1;
    for (const sd of [side, -side]) {
      const u2 = s.u + sd * dx * 0.13 / s.L;
      if (u2 < 0.05 || u2 > 0.95) continue;
      const n = spotOn(s.i, u2); if (free(n.p) && spotFree(n)) return n;
    }
    const c = freeSpots(s.p, 12).filter(o => o.p.distanceTo(s.p) > 0.1 && o.p.distanceTo(s.p) < 0.32 && free(o.p));
    return c.length ? c.reduce((x, y) => (x.p.distanceTo(s.p) <= y.p.distanceTo(s.p) ? x : y)) : null;
  }
  // Plätze nahe am Flugloch (für das Ausfliegen): freie Äste und das Dach, nächste zuerst, untereinander mit Platz für einen
  // Altvogel daneben
  function spotsNear(n) {
    const all = freeSpots(holeP, 25).filter(s => s.p.distanceTo(holeP) > 0.14 && s.p.distanceTo(holeP) < 1.6);
    const roof = roofSpot(-0.07); if (roof) all.push(roof);
    all.sort((a, b) => a.p.distanceTo(holeP) - b.p.distanceTo(holeP));
    const out = [];
    for (const s of all) { if (out.every(o => o.p.distanceTo(s.p) > 0.24)) out.push(s); if (out.length >= n) break; }
    return out;
  }

  // ---- Vögel: zwei Alte (mit Ding im Schnabel), drei Junge (Ästlinge)
  const mkBird = (i, jung) => ({ i, jung, mesh: mk(23), item: jung ? null : mk(24), st: 'weg', t: 0, d: 0, path: null, fc: 1, dur: 0, far: 1, slow: 1,
    carry: null, pose: 'land', pt: 0, spot: null, then: null, amLoch: false, wartet: false, hold: false, leaveAt: null, leaveSide: null, feed: null, fam: false, fetch: null, clipFly: false, kopfDone: false });
  const birds = [mkBird(0, false), mkBird(1, false)], young = [mkBird(2, true), mkBird(3, true), mkBird(4, true)], everyone = [...birds, ...young];
  const flying = (b) => b.st === 'anflug' || b.st === 'anflugDach' || b.st === 'anflugAst' || b.st === 'abflug' || b.st === 'kopfHop' || b.st === 'anflugFeed';
  const atHole = (b) => b.st === 'anflug' || b.st === 'haengt' || b.st === 'fuettert' || b.st === 'rein' || b.st === 'drin' || b.st === 'raus' || b.st === 'schaut';
  // Anflug zu einem Ziel (zum Loch: vor das Loch, sonst aufs Dach/den Ast); Start außerhalb des Bildes (side −1 links, +1 rechts)
  function flyTo(b, target, kind, side = -1) {
    const s = toSt(target), r = () => Math.random();
    const yS = s.y + 0.4 + r() * 0.6, zS = 0.4 + r() * 0.8, xS = edgeStageX(side, yS, zS, 6.5);   // außerhalb des Bildes (je nach Kamera)
    b.far = Math.min(3, Math.abs(xS) / 6.5);
    const start = W(xS, yS, zS), mid = W(side > 0 ? Math.max(s.x + 1.2, 1.6) : Math.min(s.x - 1.2, -1.6), s.y + 0.35 + r() * 0.3, s.z + 0.5 + r() * 0.4);
    const out = kind === 'anflug' ? nistkastenFx.normal : STAGE_D;
    const near = target.clone().add(tmp.set(0, 0.12, 0)).addScaledVector(out, 0.25).addScaledVector(STAGE_R, side * 0.1);
    b.path = makePath([start, mid, near, target]); b.d = 0; b.st = kind; b.fc = -side; b.slow = b.jung ? 0.75 : 1; b.clipFly = false;
  }
  function flyAway(b, from, side = -1) {
    const s = toSt(from), r = () => Math.random();
    const out = hasBox() && b.st !== 'ast' && b.st !== 'kopf' ? nistkastenFx.normal : STAGE_D;
    const up = from.clone().addScaledVector(out, 0.25).add(tmp.set(0, 0.2, 0)).addScaledVector(STAGE_R, side * 0.1);
    const yE = s.y + 0.5 + r() * 0.5, zE = 0.4 + r() * 0.8, xE = edgeStageX(side, yE, zE, 6.8);   // hinter den Bildrand (je nach Kamera)
    b.far = Math.min(3, Math.abs(xE) / 6.8);
    const mid = W(s.x + side * 1.4, s.y + 0.5 + r() * 0.3, s.z + 0.6 + r() * 0.4), end = W(xE, yE, zE);
    b.path = makePath([from, up, mid, end]); b.d = 0; b.st = 'abflug'; b.fc = side; b.slow = b.jung ? 0.8 : 1; b.clipFly = false;
  }
  // Kurze Wege (hinüberhüpfen, ans Loch, aus dem Loch) nicht durch Stamm oder dicke Äste (29.10.): Stichproben entlang des
  // Weges; trifft eine davon, führt der Bogen weiter vorn (zur Kamera hin) herum
  function solidAt(p) {
    tq.copy(p).project(camera);
    const ci = Math.floor((tq.x + TGR) / (2 * TGR) * TG), cj = Math.floor((tq.y + TGR) / (2 * TGR) * TG);
    if (ci < 0 || cj < 0 || ci >= TG || cj >= TG) return false;
    for (const q of tGrid[cj * TG + ci]) {
      const o = q * 8; if (Math.max(tS[o + 6], tS[o + 7]) < 0.06) continue;
      const d2 = segSeg(p.x, p.y, p.z, p.x, p.y, p.z, o), r = tS[o + 6] + (tS[o + 7] - tS[o + 6]) * SS.t + 0.03;
      if (d2 < r * r) return true;
    }
    return false;
  }
  function arcPath(pts, mi) {                           // pts[mi] = Bogenpunkt; wird nach vorn geschoben, bis der Weg frei ist
    prepSight();
    for (let k = 0; k < 5; k++) {
      const path = makePath(pts); let hit = false;
      for (let q = 2; q < 14 && !hit; q++) { path.at(path.total * q / 16, lq); hit = solidAt(lq); }
      if (!hit) return path;
      pts[mi].addScaledVector(STAGE_D, 0.18); pts[mi].y += 0.03;
    }
    return makePath(pts);
  }
  // kurzer Flug von der jetzigen Stelle (Schnabel) zu target (Schnabel), kleiner Bogen
  function hopTo(b, target, kind) {
    const from = beakNow(b), dist = from.distanceTo(target);
    const mid = from.clone().lerp(target, 0.5).add(tmp.set(0, 0.06 + 0.12 * Math.min(1, dist), 0)).addScaledVector(STAGE_D, 0.05);
    b.path = arcPath([from, mid, target], 1); b.d = 0; b.st = kind; b.far = 1; b.slow = 0.8; b.clipFly = false;
  }
  function hopToHole(b) {                              // vom Dach oder Ast hinüber ans Flugloch
    const from = beakNow(b), to = clingOf(b, new V());
    const mid = from.clone().lerp(to, 0.5).add(tmp.set(0, 0.08, 0)).addScaledVector(nistkastenFx.normal, 0.16);
    b.then = null; b.spot = null; b.path = arcPath([from, mid, to], 1); b.d = 0; b.st = 'anflug'; b.far = 1; b.slow = 0.8; b.clipFly = false;
  }
  function leave(b, side) {
    if (side == null) side = b.spot ? (toSt(b.spot.p).x >= 0 ? 1 : -1) : -1;
    b.wartet = false; b.hold = false; b.leaveAt = null; b.leaveSide = null; b.feed = null; b.fam = false; b.then = null;
    flyAway(b, beakNow(b), side);
  }
  // Flugbild: Daumenkino (Anker Schnabel), leichtes Auf und Ab (Junge: etwas schneller, wackliger)
  const fp = new V(), fq = new V();
  function drawFly(b) {
    b.path.at(b.d, fp); b.path.at(b.d + 0.05, fq);
    const dx = toSt(fq).x - toSt(fp).x; if (Math.abs(dx) > 1e-4) b.fc = dx > 0 ? 1 : -1;
    const ph = Math.floor(vt * (b.jung ? 21 : 24) + b.i * 0.5) % 2;
    fp.y += Math.sin(vt * 9 + b.i) * (b.jung ? 0.018 : 0.012) * (b.st === 'kopfHop' ? 0.3 : 1);
    draw(b, (b.jung ? 'jung-' : '') + (ph ? 'hoch' : 'tief'), fp, 'beak', b.fc, b.clipFly && b.d < 0.3);
  }
  function fly(b, dt) {
    const F = b.d < 0 ? 1 : (b.far || 1);               // weiter Weg vom/zum Bildrand: schneller (Wartezeit davor bleibt)
    b.d += SPEED * F * (b.slow || 1) * dt * (b.st !== 'abflug' ? sm(-0.1, 0.75 * F, b.path.total - b.d) * 0.88 + 0.12 : sm(-0.2, 0.6 * F, b.d) * 0.8 + 0.2);
    if (b.d < 0) { b.mesh.visible = false; if (b.item) b.item.visible = false; return; }
    if (b.d >= b.path.total) {
      if (b.st === 'abflug') { b.st = 'weg'; b.mesh.visible = false; if (b.item) b.item.visible = false; if (!b.fetch) b.carry = null; b.spot = null; return; }
      land(b); return;
    }
    drawFly(b);
  }
  function land(b) {
    b.t = 0; b.slow = 1; b.clipFly = false;
    if (b.st === 'kopfHop') {
      if (b.up) { b.st = 'ast'; b.dur = rr(2.5, 6); startSit(b); } else { b.st = 'kopf'; b.dur = rr(2.5, 5); }
      return;
    }
    if (b.st === 'anflug') { b.st = 'haengt'; b.dur = rr(0.5, 1.1); b.fc = 1; return; }
    if (b.st === 'anflugFeed') { b.st = 'flattert'; b.fc = b.hoverFc; return; }
    if (b.st === 'anflugDach') { b.st = 'dach'; b.dur = rr(3, 8); b.fc = 1; }
    else { b.st = 'ast'; b.dur = b.jung ? Infinity : rr(6, 14); }
    if (b.then === 'loch') b.dur = rr(1.2, 3);
    startSit(b);
  }

  // ---- Sitzen: Haltungen
  function startSit(b) { b.pose = 'land'; b.pt = rr(0.6, 1.2); b.kopfDone = false; }
  function nextPose(b) {
    const winter = season === 'winter', onAst = b.st === 'ast' && b.spot && !b.spot.roof;
    let opts;
    if (b.carry || b.hold) opts = [['base', 3], ['umschauen', 2.5]];
    else if (winter) opts = [['base', 4], ['umschauen', 2], ['picken', onAst ? 1.2 : 0.3], ['putzen', 0.5]];
    else opts = [['base', 2.5], ['umschauen', 3], ['picken', onAst ? 2.2 : 0.4], ['putzen', 1.3]];
    opts = opts.filter(o => o[0] !== b.pose || o[0] === 'base');
    let w = opts.reduce((s, o) => s + o[1], 0) * Math.random(), pose = opts[0][0];
    for (const o of opts) { w -= o[1]; if (w <= 0) { pose = o[0]; break; } }
    b.pose = pose;
    b.pt = pose === 'picken' ? rr(1.1, 2.3) : pose === 'putzen' ? rr(1.6, 3.2) : pose === 'umschauen' ? rr(1.2, 2.6) : rr(1.4, 3.4);
    if (pose !== 'putzen' && Math.random() < 0.35) b.fc = -b.fc;    // dreht sich um
  }
  function poseImg(b) {
    const base = season === 'winter' && !b.carry ? 'plustern' : 'sitz';
    if (b.pose === 'land') return 'sitz';
    if (b.pose === 'picken') return (b.pt % 0.6) < 0.32 ? 'picken' : base;   // pickt mehrmals
    if (b.pose === 'base') return base;
    return b.pose;                                      // umschauen, putzen
  }
  // Altvogel neben einem Jungen: dreht sich zu ihm, gibt die Raupe ab
  function feedStep(b, dt) {
    const j = b.feed;
    if (!j || (j.st !== 'ast' && j.st !== 'anflugAst')) { b.feed = null; if (b.fam) { b.fam = false; b.hold = false; } return; }
    b.pose = 'land'; b.pt = 0.5;
    if (j.st !== 'ast') { b.ft = 0; return; }           // das Junge fliegt noch heran
    b.ft = (b.ft || 0) + dt;
    b.fc = toSt(j.spot.p).x >= toSt(b.spot.p).x ? 1 : -1; j.fc = -b.fc;
    if (b.ft > 0.7 && b.carry) { b.carry = null; j.fedAt = vt; j.fedOnce = true; }
    if (b.ft > 1.3) {
      b.ft = 0;
      b.feed = null; b.pt = rr(0.6, 1.2);
      if (b.fam) {                                      // Sommerbesuch: noch etwas sitzen, dann zuerst das Junge, gleich danach der Altvogel
        b.fam = false; const tL = vt + rr(2.5, 5), side = toSt(j.spot.p).x >= 0 ? 1 : -1;
        j.leaveAt = tL; j.leaveSide = side; b.leaveAt = tL + rr(0.3, 0.9); b.leaveSide = side;
      }
    }
  }
  function sitStep(b, dt) {
    const p = b.st === 'dach' ? roofP : b.spot && b.spot.p;
    if (!p) { b.st = 'weg'; b.mesh.visible = false; b.item.visible = false; return; }
    if (b.feed) feedStep(b, dt);
    else { b.pt -= dt; if (b.pt <= 0) nextPose(b); }
    draw(b, poseImg(b), p, 'feet', b.fc, false);
    // an dünnen Ästen manchmal kopfüber darunter (nicht mit Futter, nicht wenn sie wartet oder füttert)
    if (b.st === 'ast' && b.spot && !b.spot.roof && b.spot.r <= KOPF_R && !b.carry && !b.hold && !b.then && !b.wartet && !b.kopfDone &&
        b.leaveAt == null && b.t > 1.5 && b.t < b.dur - 3 && Math.random() < dt * 0.3 && hangFree(b.spot)) { kopfStart(b); return; }
    const busyHole = birds.some(o => o !== b && atHole(o));
    if (b.then === 'loch') { if (b.t >= b.dur && !busyHole) hopToHole(b); return; }
    if (b.leaveAt != null) { if (vt >= b.leaveAt) leave(b, b.leaveSide); return; }
    if (b.hold || b.t < b.dur) return;
    if ((b.st === 'dach' || b.wartet) && busyHole) return;   // wartet, bis die andere aus dem Kasten heraus ist
    if (birds.some(o => o !== b && (o.st === 'anflugAst' || o.st === 'anflugDach'))) return;   // … bzw. gelandet ist
    leave(b, b.st === 'dach' ? -1 : undefined);
  }
  // kopfüber: flattert kurz unter den Ast und hängt daran (Griff = Unterseite des Astes), pendelt leicht
  function branchAng(s) {                               // Winkel des Aststücks im Bild (−90°…90°), höchstens ±0,5
    const a = tree.pos[tree.parent[s.i]], c = tree.pos[s.i];
    let ang = Math.atan2(c.y - a.y, tmp.subVectors(c, a).dot(STAGE_R));
    if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
    return Math.max(-0.5, Math.min(0.5, ang));
  }
  const kopfTilt = (b) => b.fc * b.kopfA - TWIG;       // Zweig im Bild liegt dann auf dem Ast
  function kopfStart(b) {
    const s = b.spot; b.grip = s.c.clone(); b.grip.y -= s.r + 0.003; b.kopfA = branchAng(s);
    const from = beakNow(b), M = META.kopfueber;
    const to = imgPt(kOf('kopfueber'), M.grip, b.grip, b.fc, kopfTilt(b), M.beak, new V());
    const mid = from.clone().lerp(to, 0.5).addScaledVector(STAGE_D, 0.07).add(tmp.set(0, 0.02, 0));   // vor dem Ast vorbei
    b.path = makePath([from, mid, to]); b.d = 0; b.st = 'kopfHop'; b.kopfDone = true; b.far = 1; b.slow = 0.55; b.up = false;
  }
  function kopfUp(b) {                                  // wieder hinauf auf den Ast
    const from = beakNow(b), to = beakAt('sitz', b.spot.p, b.fc);
    const mid = from.clone().lerp(to, 0.5).addScaledVector(STAGE_D, 0.07);
    b.path = makePath([from, mid, to]); b.d = 0; b.st = 'kopfHop'; b.far = 1; b.slow = 0.55; b.up = true;
  }

  // ---- Altvögel
  function updAdult(b, dt) {
    if (b.st === 'weg') {
      b.mesh.visible = false; b.item.visible = false;
      if (b.fetch && vt >= b.fetch.at) {                // kommt mit einer Raupe zurück (Ausfliegen)
        const f = b.fetch; b.fetch = null; b.carry = 'raupe'; b.feed = f.j; b.hold = true;
        if (!f.hover) { b.spot = f.spot; flyTo(b, beakAt('sitz', f.spot.p, f.fc), 'anflugAst', -f.fc); }
        else if (f.j.st === 'ast') hoverFeed(b, f.j);
        else { b.carry = null; b.feed = null; b.hold = false; }
      }
      return;
    }
    if (flying(b)) { fly(b, dt); if (flying(b) || b.st === 'weg') return; }
    b.t += dt;
    switch (b.st) {
      case 'haengt':                                    // unter dem Flugloch festhalten (Kopf zum Loch)
        draw(b, 'sitz', clingOf(b, tmp), 'beak', 1, false, b.amLoch ? FEED.tilt : CLING);
        if (b.amLoch && b.carry === 'raupe' && b.t > 0.35) { b.st = 'fuettert'; b.t = 0; }
        else if (b.t >= b.dur) { b.st = 'rein'; b.t = 0; }
        break;
      case 'fuettert':                                  // füttert das Junge im Flugloch, bleibt kurz, fliegt dann weg (nicht hinein)
        draw(b, 'sitz', clingOf(b, tmp), 'beak', 1, false, FEED.tilt);
        if (b.t > 0.8 && b.carry) { b.carry = null; head.want = 'zu'; head.hold = 1.0; }
        if (b.t > 1.6) { flyAway(b, beakNow(b)); b.amLoch = false; }
        break;
      case 'rein': {                                    // hinein (Schnitt an der Vorderwand)
        const e = sm(0, 0.3, b.t);
        draw(b, 'sitz', tmp.copy(holeP).add(tmp2.set(0, -0.012 + 0.012 * e, 0)).addScaledVector(nistkastenFx.normal, 0.03 - 0.34 * e), 'beak', 1, true, CLING * (1 - e));
        if (b.t >= 0.32) { b.st = 'drin'; b.t = 0; b.dur = rr(3, 7); b.mesh.visible = false; b.item.visible = false; b.carry = null; b.amLoch = false; }
        break;
      }
      case 'drin':
        b.mesh.visible = false; b.item.visible = false;
        if (b.t >= b.dur) { b.st = 'raus'; b.t = 0; }
        break;
      case 'raus': {                                    // Kopf voran heraus (gespiegelt: schaut nach außen)
        const e = sm(0, 0.3, b.t);
        draw(b, 'sitz', tmp.copy(holeP).add(tmp2.set(0, 0.02 - 0.02 * e, 0)).addScaledVector(nistkastenFx.normal, -0.3 + 0.36 * e).addScaledVector(STAGE_R, -0.02 * e), 'beak', -1, true);
        if (b.t >= 0.32) { b.st = 'schaut'; b.t = 0; b.dur = rr(0.4, 1.0); }
        break;
      }
      case 'schaut':
        draw(b, 'sitz', tmp.copy(holeP).addScaledVector(nistkastenFx.normal, 0.06).addScaledVector(STAGE_R, -0.02), 'beak', -1, false);
        if (b.t >= b.dur) flyAway(b, beakNow(b));
        break;
      case 'ast': case 'dach':
        sitStep(b, dt);
        break;
      case 'flattert': {                                // füttert im Flug: flattert kurz vor dem Jungen, gibt die Raupe ab, fliegt weiter
        const f = Math.floor(vt * 24 + b.i * 0.5) % 2 ? 'hoch' : 'tief';
        draw(b, f, tmp.copy(b.hoverP).add(tmp2.set(0, Math.sin(b.t * 14) * 0.004, 0)), 'beak', b.hoverFc, false);
        if (b.t > 0.6 && b.carry && b.feed) { b.carry = null; b.feed.fedAt = vt; b.feed.fedOnce = true; }
        if (b.t > 1.1) { b.feed = null; b.hold = false; flyAway(b, beakNow(b), toSt(b.hoverP).x >= 0 ? 1 : -1); }
        break;
      }
      case 'kopf': {
        const sw = Math.sin(b.t * 2.4 + b.i) * 0.05 * (1 - 0.5 * sm(0, 2.5, b.t));
        draw(b, 'kopfueber', b.grip, 'grip', b.fc, false, kopfTilt(b) + sw);
        if (b.t >= b.dur) { if (Math.random() < 0.5) kopfUp(b); else leave(b); }
        break;
      }
    }
  }
  // ---- Junge (Ästlinge): sitzen, betteln, wenn ein Altvogel mit Futter kommt (drehen sich zu ihm, hüpfen und zittern)
  function updYoung(j, dt) {
    if (j.st === 'weg') { j.mesh.visible = false; return; }
    if (flying(j)) { fly(j, dt); if (flying(j) || j.st === 'weg') return; }
    j.t += dt;
    const par = birds.find(b => b.feed === j && b.carry && b.st !== 'weg');
    let bob = 0, tilt = 0;
    if (j.t < 1.2) tilt = 0.14 * Math.exp(-3.5 * j.t) * Math.sin(j.t * 15);   // landet noch wackelig
    if (par) {
      if (par.spot) j.fc = toSt(par.spot.p).x >= toSt(j.spot.p).x ? 1 : -1;
      const w = (vt * 1.4 + j.i * 0.37) % 1.3;
      if (w < 0.55) { bob = Math.abs(Math.sin(w * 17)) * 0.009; tilt += Math.sin(w * 40) * 0.035; }
    } else if (j.t > 2 && Math.random() < dt * 0.22 && !(j.fedAt && vt - j.fedAt < 1.5)) j.fc = -j.fc;   // schaut sich um
    draw(j, 'jung-sitz', tmp.copy(j.spot.p).add(tmp2.set(0, bob, 0)), 'feet', j.fc, false, tilt);
    if (j.leaveAt != null) { if (vt >= j.leaveAt) leave(j, j.leaveSide); }
    else if (!AF.on && j.t > 45) leave(j);              // Sicherheit
  }
  // ---- Kopf im Flugloch
  const head = { want: null, s: 1, t: 0, f: 'nest-zu', fc: 1, out: 0, hold: 0, fast: false, peek: 9, peekDur: 0, flipAt: -1 };
  function updHead(dt) {
    if (!hasBox()) { headMesh.visible = false; head.want = null; head.s = 1; return; }
    if (!AF.on) {
      const feeder = birds.find(b => b.carry === 'raupe' && (b.st === 'haengt' || b.st === 'fuettert' || (b.st === 'anflug' && b.d >= 0 && b.path.total - b.d < 0.7)));
      const inside = birds.some(b => b.st === 'rein' || b.st === 'drin' || b.st === 'raus');
      if (head.hold > 0) head.hold -= dt;
      if (inside) { head.want = null; head.fast = true; }
      else if (feeder) { if (head.want !== 'zu' || head.hold <= 0) head.want = 'bettel'; head.fast = false; }   // bettelt, sobald Futter kommt
      else if (head.want === 'zu') { if (head.hold <= 0) head.want = null; }
      else if (head.want === 'bettel') head.want = null;
      // ab und zu guckt ein Kopf heraus (Junge im Kasten, keiner am Loch)
      if (!feeder && !inside && head.want !== 'zu' && phase() === 'futter' && !birds.some(atHole)) {
        if (head.want === 'peek') {
          head.peekDur -= dt; if (head.flipAt > 0 && head.peekDur < head.flipAt) { head.fc = -head.fc; head.flipAt = -1; }
          if (head.peekDur <= 0) head.want = null;
        } else if (!head.want && (head.peek -= dt) <= 0) {
          head.want = 'peek'; head.peekDur = rr(2, 4); head.flipAt = Math.random() < 0.6 ? head.peekDur * rr(0.3, 0.6) : -1;
          head.fc = Math.random() < 0.5 ? 1 : -1; head.peek = rr(8, 18); head.fast = false;
        }
      } else if (head.want === 'peek') head.want = null;
    }
    const up = !!head.want;
    head.s = Math.min(1, Math.max(0, head.s + (up ? -dt / 0.22 : dt / (head.fast ? 0.1 : 0.25))));
    if (head.s >= 1) { headMesh.visible = false; return; }
    head.t += dt;
    if (head.want === 'bettel') head.f = (head.t % 1.2) < 0.8 ? 'nest-bettelt' : 'nest-hoch';
    else if (head.want === 'zu' || head.want === 'peek') head.f = 'nest-zu';
    else if (head.want === 'raus') head.f = (head.t % 2.4) < 1.6 ? 'nest-hoch' : 'nest-zu';
    if (up) head.out = head.want === 'raus' ? 1 : 0;
    const f = head.f, m = META[f], k = nestK(), H = nistkastenFx.HOLE, B = nistkastenFx.BOX;
    const bob = head.want === 'bettel' ? Math.abs(Math.sin(head.t * 8)) * 0.004 : 0;
    const yb = H.y - H.ry * 0.9 - head.s * m.h * k + bob + head.out * 0.01 + (head.want === 'bettel' || head.want === 'zu' ? 0.008 : 0);   // Unterkante (Hals); sinkt beim Verschwinden nach unten weg; bettelnd etwas höher
    headMesh.position.set(H.x + 0.006 + head.fc * (m.w / 2 - m.unten[0]) * k, yb + (m.unten[1] - m.h / 2) * k, B.d / 2 + 0.003);   // Öffnung wirkt rechts tiefer: etwas nach rechts
    headMesh.scale.set(head.fc * m.w * k, m.h * k, 1);
    const map = getTex(f); if (headMesh.material.map !== map) headMesh.material.map = map;
    HU.uHole.value.set(H.x, H.y, H.rx * 0.97, H.ry * 0.97); HU.uOut.value = head.out;
    const c = head.out ? 0.9 : 0.78, pc = headMesh.material.userData.__pic;   // im Loch etwas dunkler
    if (pc) pc.setScalar(c); else headMesh.material.color.setScalar(c);
    headMesh.visible = true;
  }

  // ---- Besuche
  let vt = 0, last = 0, next = 8, turn = 0, pend = null, pendForce = false, afWait = -1, afFail = -1, phNow = 'frei', phAt = -9;
  const idle = () => !AF.on && birds.every(b => (b.st === 'weg' && !b.fetch) || b.st === 'drin') && young.every(j => j.st === 'weg');
  // Äste (Stufe 3, Herbst/Winter, Sommer nach dem Ausfliegen), meist zu zweit; mit Kasten auch aufs Dach
  function perchVisit() {
    const b = birds[turn % 2], o = birds[(turn + 1) % 2]; turn++;
    if (b.st !== 'weg' || b.fetch) return false;
    const roofOk = hasBox() && nistkastenFx.roofFree && !roofTaken(0);
    const s1 = !roofOk || Math.random() < 0.55 ? pickSpot(null, occupied()) : null;
    if (s1) {
      const side = toSt(s1.p).x >= 0 ? 1 : -1;
      b.spot = s1; flyTo(b, beakAt('sitz', s1.p, -side), 'anflugAst', side);
      if (o.st === 'weg' && !o.fetch && Math.random() < 0.75) {
        const s2 = pickSpot(s1.p, [...occupied(), s1.p]);
        if (s2) { o.spot = s2; flyTo(o, beakAt('sitz', s2.p, -side), 'anflugAst', side); o.d = -rr(0.6, 1.6); }
      }
      return true;
    }
    if (roofOk) { b.spot = null; flyTo(b, beakAt('sitz', roofP, 1), 'anflugDach'); return true; }
    return false;                                       // kein Platz, an dem man sie ganz sähe: diesmal nicht
  }
  function nearBox(b, d0, wait = false) {
    const s = pickSpot(roofP, occupied()); if (!s) return false;
    const side = toSt(s.p).x >= 0 ? 1 : -1;
    b.spot = s; b.wartet = wait; flyTo(b, beakAt('sitz', s.p, -side), 'anflugAst', side); b.d = d0;
    return true;
  }
  function sitNearBox(b, d0, wait = false) {           // aufs Dach (wenn frei), sonst auf einen Ast nahe am Kasten
    if (nistkastenFx.roofFree && !birds.some(o => o !== b && (o.st === 'dach' || o.st === 'anflugDach'))) {
      b.spot = null; flyTo(b, beakAt('sitz', roofP, 1), 'anflugDach'); b.d = d0; b.wartet = wait; return true;
    }
    return nearBox(b, d0, wait);
  }
  // Nestbau (Moos) bzw. Füttern (Raupe): ans Flugloch; manchmal erst aufs Dach; manchmal kommt die andere mit und wartet
  function boxVisit(item) {
    const b = birds[turn % 2], o = birds[(turn + 1) % 2]; turn++;
    if (b.st !== 'weg' || b.fetch) return false;
    b.carry = item; b.amLoch = item === 'raupe';        // Raupe: füttert vor dem Loch (Nutzer 29.10.: nicht hinein); Moos: hinein
    if (Math.random() < 0.25 && sitNearBox(b, 0)) b.then = 'loch';
    else flyTo(b, clingOf(b, new V()), 'anflug');
    if (o.st === 'weg' && !o.fetch && Math.random() < 0.35) {
      if (item === 'raupe' && Math.random() < 0.6) { o.carry = 'raupe'; o.then = 'loch'; o.amLoch = true; }   // bringt danach auch eine
      if (!sitNearBox(o, -0.8, !o.then)) { o.carry = null; o.then = null; }
    }
    return true;
  }
  // Sommer nach dem Ausfliegen: ein Junges setzt sich auf einen Ast, ein Altvogel kommt mit einer Raupe daneben und füttert
  function familyVisit() {
    const j = young[0], b = birds[turn % 2], o = birds[(turn + 1) % 2]; turn++;
    if (j.st !== 'weg' || b.st !== 'weg' || b.fetch) return false;
    const occ = occupied();
    let s = null, n = null, side = 1;
    for (let k = 0; k < 4 && !n; k++) {                 // ein freier Platz für das Junge und daneben einer für den Altvogel
      s = pickSpot(hasBox() ? roofP : null, occ); if (!s) break;
      side = toSt(s.p).x >= 0 ? 1 : -1; n = nextTo(s, side, [...occ, s.p]);
    }
    if (!n && hasBox() && !roofTaken(-0.065) && !roofTaken(0.065)) {   // sonst beide aufs Kastendach
      s = roofSpot(-0.065); if (s) { side = -1; n = nextTo(s, 1, occ); }
    }
    if (!s || !n) return false;
    j.spot = s; j.leaveAt = null; j.fedOnce = false; flyTo(j, beakAt('jung-sitz', s.p, -side), 'anflugAst', side);
    const fcB = toSt(s.p).x >= toSt(n.p).x ? 1 : -1;
    b.spot = n; b.carry = 'raupe'; b.feed = j; b.fam = true; b.hold = true; flyTo(b, beakAt('sitz', n.p, fcB), 'anflugAst', -fcB); b.d = -rr(1.2, 2.2);
    if (o.st === 'weg' && !o.fetch && Math.random() < 0.3) {
      const s2 = pickSpot(s.p, [...occ, s.p, n.p]);
      if (s2) { const sd = toSt(s2.p).x >= 0 ? 1 : -1; o.spot = s2; flyTo(o, beakAt('sitz', s2.p, -sd), 'anflugAst', sd); o.d = -rr(2, 3.5); }
    }
    return true;
  }
  // ---- Ausfliegen (einmal im Jahr)
  const AF = { on: false, ph: '', t: 0, all: 0, n: 0, nJ: 3, nSit: 3, F: [], side: -1 };
  function ausflugStart() {
    if (!hasBox() || AF.on || birds.some(b => b.st !== 'weg' || b.fetch) || young.some(j => j.st !== 'weg')) return false;
    const sp = spotsNear(5); if (!sp.length) return false;
    AF.nJ = 3; AF.nSit = Math.min(3, sp.length); AF.F = sp.slice(0, AF.nSit);   // ohne freien Platz flattert ein Junges gleich davon
    const pool = sp.slice(AF.nSit);                      // die Eltern: übrige Plätze, sonst das Dach (wenn dort kein Junges sitzt)
    if (!AF.F.some(s => s.roof)) for (const x of [-0.07, 0.07]) { const r = roofSpot(x); if (r) pool.push(r); }
    const pa = pool[0] || null, pb = pool[1] || null;
    Object.assign(AF, { on: true, ph: 'eltern', t: 0, all: 0, n: 0, side: Math.random() < 0.5 ? -1 : 1 });
    for (const [b, s, d0] of [[birds[0], pa, 0], [birds[1], pb, -rr(1, 2)]]) {   // die Eltern warten mit Raupen nahe am Kasten
      if (!s) continue;
      const sd = toSt(s.p).x >= toSt(holeP).x ? 1 : -1;  // schaut zum Kasten
      b.spot = s; b.carry = 'raupe'; b.hold = true; flyTo(b, beakAt('sitz', s.p, -sd), 'anflugAst', sd); b.d = d0;
    }
    return true;
  }
  function emerge(j, s) {                               // flattert aus dem Flugloch auf den Platz s (wackelig, langsam)
    const n = nistkastenFx.normal, fcT = toSt(s.p).x >= toSt(holeP).x ? 1 : -1;
    const p0 = holeP.clone().addScaledVector(n, -0.05), p1 = holeP.clone().addScaledVector(n, 0.13).add(tmp.set(0, -0.025, 0));
    const target = beakAt('jung-sitz', s.p, fcT), mid = p1.clone().lerp(target, 0.55).add(tmp.set(0, 0.05 + rr(0, 0.06), 0));
    Object.assign(j, { spot: s, path: arcPath([p0, p1, mid, target], 2), d: 0, st: 'anflugAst', far: 1, slow: 0.5, clipFly: true, leaveAt: null, fedOnce: false, fedAt: 0, fc: fcT });
  }
  function emergeAway(j) {                             // flattert aus dem Flugloch und gleich aus dem Bild (kein freier Platz)
    const n = nistkastenFx.normal, side = AF.side;
    const p0 = holeP.clone().addScaledVector(n, -0.05), p1 = holeP.clone().addScaledVector(n, 0.15).add(tmp.set(0, -0.02, 0));
    const s = toSt(p1), yE = s.y + rr(0.2, 0.6), zE = 0.5 + Math.random() * 0.6, xE = edgeStageX(side, yE, zE, 6.8);
    const mid = W(s.x + side * 1.1, s.y + rr(0.05, 0.3), s.z + 0.55);
    Object.assign(j, { spot: null, path: makePath([p0, p1, mid, W(xE, yE, zE)]), d: 0, st: 'abflug', far: Math.min(3, Math.abs(xE) / 6.8), slow: 0.55, clipFly: true, leaveAt: null, fedOnce: true, fedAt: 0 });
  }
  function feedYoung(j) {                               // ein Altvogel mit Raupe hüpft daneben; hat keiner eine, holt einer
    const occ = occupied();
    let b = birds.find(o => o.carry === 'raupe' && o.st === 'ast' && !o.feed);
    const side0 = b ? (toSt(b.spot.p).x >= toSt(j.spot.p).x ? 1 : -1) : (toSt(j.spot.p).x >= 0 ? 1 : -1);
    const n = nextTo(j.spot, side0, occ);
    if (!n && b) { hoverFeed(b, j); return true; }      // kein freier Platz daneben: im Flug füttern
    const fcB = n ? (toSt(j.spot.p).x >= toSt(n.p).x ? 1 : -1) : 1;
    if (b) { b.feed = j; b.spot = n; hopTo(b, beakAt('sitz', n.p, fcB), 'anflugAst'); return true; }
    b = birds.find(o => o.st === 'weg' && !o.fetch) || birds.find(o => o.st === 'ast' && !o.feed && !o.fetch);
    if (!b) return false;
    b.fetch = n ? { j, spot: n, fc: fcB, at: vt + (b.st === 'weg' ? rr(0.5, 1.5) : rr(2.5, 4)) } : { j, hover: true, at: vt + (b.st === 'weg' ? rr(0.5, 1.5) : rr(2.5, 4)) };
    if (b.st !== 'weg') { const f = b.fetch; leave(b); b.fetch = f; }
    return true;
  }
  function hoverFeed(b, j) {                            // Schnabel kurz vor dem des Jungen, zu ihm gedreht
    const fcJ = j.fc, jb = beakAt('jung-sitz', j.spot.p, fcJ);
    b.hoverP = jb.addScaledVector(STAGE_R, fcJ * 0.035).addScaledVector(STAGE_D, 0.02); b.hoverFc = -fcJ;
    b.feed = j; b.spot = null; b.hold = true;
    if (b.st === 'weg') flyTo(b, b.hoverP, 'anflugFeed', fcJ); else hopTo(b, b.hoverP, 'anflugFeed');
  }
  function leaveAll() {                                 // alle zusammen davon, kurz nacheinander, zur selben Seite
    let k = 0;
    for (const b of [birds[0], young[0], young[1], birds[1], young[2]]) {
      b.fetch = null; b.feed = null; if (b.st === 'weg') continue;
      b.leaveAt = vt + 0.2 + k * rr(0.45, 0.8); b.leaveSide = AF.side; k++;
    }
  }
  function afStep(dt) {
    AF.t += dt; AF.all += dt;
    if (AF.ph === 'eltern') {                           // die Eltern sitzen: gleich schaut ein Junges heraus
      if ((birds.some(b => b.st === 'ast') || AF.t > 6) && AF.t > 2.5) { AF.ph = 'kopf'; AF.t = 0; head.want = 'raus'; head.t = 0; head.fc = 1; }
    } else if (AF.ph === 'kopf') {                      // reckt sich aus dem Loch, schaut sich um, dann flattert es los
      if (head.fc === 1 && AF.t > 1.1) head.fc = -1;
      if (AF.t > (AF.n ? 1.9 : 2.8)) {
        head.want = null; head.s = 1; headMesh.visible = false;
        if (AF.n < AF.nSit) emerge(young[AF.n], AF.F[AF.n]); else emergeAway(young[AF.n]);
        if (!AF.n) setDone('aus');
        AF.ph = 'flug'; AF.t = 0;
      }
    } else if (AF.ph === 'flug') {
      const j = young[AF.n];
      if ((j.st === 'ast' && j.t > 0.6) || (AF.n >= AF.nSit && AF.t > 1.6) || AF.t > 12) {
        if (j.st === 'ast') feedYoung(j);
        AF.n++; AF.ph = AF.n < AF.nJ ? 'pause' : 'satt'; AF.t = 0;
      }
    } else if (AF.ph === 'pause') {
      if (AF.t > 2.2) { AF.ph = 'kopf'; AF.t = 0; head.want = 'raus'; head.t = 0; head.fc = 1; }
    } else if (AF.ph === 'satt') {                      // bis alle gefüttert sind (höchstens 16 s), dann noch kurz sitzen
      const fed = young.slice(0, AF.nSit).every(j => j.fedOnce || j.st === 'weg');
      if ((fed && birds.every(b => !b.feed && !b.fetch)) || AF.t > 16) { AF.ph = 'sitzen'; AF.t = 0; }
    } else if (AF.ph === 'sitzen') {
      if (AF.t > 3) { leaveAll(); AF.ph = 'weg'; AF.t = 0; }
    } else if (AF.ph === 'weg') {
      if (everyone.every(b => b.st === 'weg' && !b.fetch) || AF.t > 20) {
        AF.on = false; next = vt + rr(20, 40);
        for (const b of everyone) { b.hold = false; b.fetch = null; b.leaveAt = null; b.feed = null; }
      }
    }
    if (AF.all > 110 && AF.ph !== 'weg') { leaveAll(); AF.ph = 'weg'; AF.t = 0; }
  }
  function startVisit(art) {
    let ok = false;
    if (art === 'ausflug') ok = ausflugStart();
    else if (art === 'nest' || art === 'futter') ok = boxVisit(art === 'nest' ? 'moos' : 'raupe');
    else if (art === 'familie') ok = ((pendForce || Math.random() < 0.6) && familyVisit()) || perchVisit();
    else ok = perchVisit();                             // 'frei' (Stufe 3), 'ruhe' (Herbst/Winter)
    if (art !== 'ausflug' || !ok) next = vt + (!ok ? rr(8, 15) : art === 'futter' ? rr(12, 28) : art === 'nest' ? rr(15, 35) : art === 'frei' ? rr(25, 55) : art === 'familie' ? rr(25, 50) : rr(40, 90));
    pendForce = false;
    return ok;
  }
  function hideAll() {
    for (const b of everyone) {
      b.mesh.visible = false; if (b.item) b.item.visible = false;
      Object.assign(b, { st: 'weg', carry: null, then: null, feed: null, fam: false, fetch: null, hold: false, leaveAt: null, wartet: false, spot: null, amLoch: false, ft: 0 });
    }
    headMesh.visible = false; head.want = null; head.s = 1; AF.on = false; pend = null;
  }
  function still() {                                    // „Weniger Bewegung“: eine sitzt still
    const b = birds[0], pose = season === 'winter' ? 'plustern' : 'sitz';
    for (const o of everyone) if (o !== b) { o.mesh.visible = false; if (o.item) o.item.visible = false; }
    headMesh.visible = false; b.carry = null;
    if (hasBox() && nistkastenFx.roofFree) draw(b, pose, roofP, 'feet', 1, false);
    else { if (!b.spot) b.spot = pickSpot(hasBox() ? roofP : null); if (b.spot) draw(b, pose, b.spot.p, 'feet', 1, false); else b.mesh.visible = false; }
  }
  function update(dt) {
    if (!tree) return;
    if (!allowed()) { if (birds.some(b => b.st !== 'weg' || b.mesh.visible) || young.some(j => j.st !== 'weg') || AF.on || headMesh.visible) hideAll(); window.__meisen = null; return; }
    if (!allTex) { allTex = true; for (const k in IMG) getTex(k); }
    vt += dt;
    if (hasBox()) boxPoints(); else if (AF.on || headMesh.visible) hideAll();
    if (vt - phAt > 1) { phNow = phase(); phAt = vt; }
    if (reduceMotion) { still(); return; }
    const hold = !!window.__meisenHold;
    if (!AF.on && idle()) {
      // Ausfliegen: beim ersten Ansehen im Zeitfenster (ein paar Sekunden, nachdem sie kommen dürfen; erst, wenn keine
      // Meise mehr unterwegs ist). Geht es nicht (keine Plätze), 30 s lang wieder gewöhnliche Besuche.
      const aus = pend === 'ausflug' || (!pend && !hold && ausPending() && vt > afFail);
      if (aus) {
        if (birds.every(b => b.st === 'weg')) {
          if (pend === 'ausflug') afWait = 0; else if (afWait < 0) afWait = rr(3, 7);
          if ((afWait -= dt) <= 0) { afWait = -1; pend = null; if (!startVisit('ausflug')) afFail = vt + 30; }
        }
      } else if (pend || (vt >= next && !hold)) { const a = pend || phNow; pend = null; startVisit(a); }
    }
    if (AF.on) afStep(dt);
    warm(6);
    for (const b of birds) updAdult(b, dt);
    for (const j of young) updYoung(j, dt);
    updHead(dt);
    const sh = (b) => { const n = b.mesh.position.clone().project(camera); return { st: b.st, f: b.mesh.visible ? b.mesh.userData.f : null, carry: b.carry, item: !!(b.item && b.item.visible), vis: b.mesh.visible, nx: +n.x.toFixed(3), ny: +n.y.toFixed(3), d: +(b.d || 0).toFixed(2), feed: b.feed ? young.indexOf(b.feed) : -1, sp: b.spot ? b.spot.p.toArray().map(v => +v.toFixed(4)) : null, spR: b.spot ? b.spot.r : null, gr: b.st === 'kopf' && b.grip ? b.grip.toArray() : null }; };
    const lp = hasBox() ? holeP.clone().project(camera) : null;
    window.__meisen = { phase: phNow, af: AF.on ? AF.ph : null, afN: AF.n, loch: lp ? { nx: lp.x, ny: lp.y } : null, kopf: headMesh.visible ? { f: head.f, want: head.want, out: head.out, s: +head.s.toFixed(2) } : null, alt: birds.map(sh), jung: young.map(sh) };
  }
  function frame() {
    const now = nowMs();
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    update(dt);
  }
  // für Vorschau-Videos (mt/video2.mjs): nur die Meisen zeichnen (Ebene 1), der Baum kommt als stehendes Bild darunter
  window.__meisenMeshes = () => [...everyone.map(b => b.mesh), ...birds.map(b => b.item), headMesh];
  window.__meisenGfx = () => ({ renderer, camera, scene });   // für Vorschau-Videos mit Verdeckung (Tiefe des stehenden Baums)
  window.__meisenLayer = () => {
    for (const m of window.__meisenMeshes()) m.layers.enable(1);
    const mask = camera.layers.mask; camera.layers.set(1); renderer.render(scene, camera); camera.layers.mask = mask;
  };
  window.__meisenSim = (sec) => { for (let k = 0; k < Math.round(sec / 0.05); k++) update(0.05); return window.__meisen; };
  window.__meisenPickT = (frisch) => { if (frisch) { cacheKey = ''; prepKey = ''; leafKey = ''; } const t0 = performance.now(); pickSpot(null, []); pickSpot(roofP, []); spotsNear(5); return +(performance.now() - t0).toFixed(1); };   // Prüfhilfe: Zeit einer Platzwahl
  window.__meisenSpots = () => { cacheKey = ''; prepKey = ''; leafKey = ''; return freeSpots(null, 1e9).map(s => ({ p: s.p.toArray().map(v => +v.toFixed(3)), r: +s.r.toFixed(3), i: s.i, zumLoch: hasBox() ? +s.p.distanceTo(holeP).toFixed(2) : null })); };
  // Prüfhilfe (29.10.): sitzt jede Meise auf dem Ast so, dass sie ganz zu sehen ist (nicht im Stamm, nicht dahinter, nicht im Laub)?
  window.__meisenFrei = () => { prepSight(); return [...birds, ...young].filter(b => (b.st === 'ast' || b.st === 'kopf') && b.spot && !b.spot.roof).map(b => ({ st: b.st, jung: !!b.jung, frei: b.st === 'kopf' ? hangFree(b.spot) : spotFree(b.spot) })); };
  // Test/Play: gleich ein Besuch. o.art: 'nest', 'futter', 'ausflug', 'familie', 'ruhe' (ohne Kasten immer 'frei');
  // ohne art: was gerade passt (im Fenster vor dem Ausfliegen das Ausfliegen). Gibt die Art zurück oder false.
  function visitNow(o = {}) {
    if (!allowed() || reduceMotion || !idle()) return false;
    let art = o.art || (ausPending() ? 'ausflug' : phase());
    if (!hasBox()) art = 'frei';
    pend = art; pendForce = !!o.art; next = vt;
    return art;
  }
  return { frame, visitNow, setJahr(j) { jahr = j ?? null; lsF = null; }, get active() { return AF.on || everyone.some(b => b.st !== 'weg' && b.st !== 'drin') || birds.some(b => b.fetch); } };
})();
// ------------------------------------------------------------------ Marienkäfer (ab Stufe 2, 24.10.)
// Bewohner ab Stufe 2: krabbelt langsam über Stamm und untere Äste (immer auf der Seite zur Kamera), bleibt ab und zu
// stehen, dreht an Astspitzen und am Stammfuß um und fliegt alle 1–2 min ein Stück zu einer anderen Stelle (Flügel-
// decken auf, Hinterflügel schwirren). Nachts und im Winter versteckt er sich (nicht zu sehen). „Weniger Bewegung“:
// sitzt still. Größer als echt, damit man ihn sieht (mind. ~3,5 CSS-Pixel lang, höchstens ~0,055 – neben der Meise mit 0,26).
// Er sitzt auf der Rinde: Lage aus den Ästen des Baums (Stück von Elternknoten zu Knoten, Radius wie die Röhren),
// leicht nach außen versetzt, damit er nicht in den Rindenbuckeln verschwindet.
// Prüfhilfen: window.__kaeferT (s) hält seine Uhr fest, window.__kaefer zeigt Zustand und Lage.
const kaeferFx = (() => {
  const loader = new THREE.TextureLoader();
  const ldT = (n) => { const t = loader.load(__img(n)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const tex = { top: ldT('cdf414e55f.webp'), fly: ldT('b19d7f0cf8.webp') };
  const mat = (map) => { const m = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }); m.color.setScalar(0.94); return m; };
  // Bildmaße (px): Oben-Bild 254×256, Körper (Kopf bis Deckenende) 195 px, Körpermitte (112, 160);
  // Flug-Bild 334×320, Flügeldecken-Mitte (169, 79)
  const TOP = { w: 254, h: 256, len: 195, cx: 112, cy: 160 }, FLY = { w: 334, h: 320, len: 150, cx: 169, cy: 79 };
  const geo = (I) => { const g = new THREE.PlaneGeometry(I.w / I.len, I.h / I.len); g.translate((I.w / 2 - I.cx) / I.len, (I.cy - I.h / 2) / I.len, 0); return g; };
  const top = new THREE.Mesh(geo(TOP), mat(tex.top)), fly = new THREE.Mesh(geo(FLY), mat(tex.fly));
  for (const m of [top, fly]) { m.renderOrder = 24; m.frustumCulled = false; m.visible = false; scene.add(m); }

  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rr = (a, b) => a + Math.random() * (b - a);
  // ---- Äste: Stück i (Eltern → i), sichtbar, dick genug, nicht zu hoch in der Krone
  const segS = new V(), segE = new V(), ax = new V(), n1 = new V(), n2 = new V(), tmp = new V();
  const fracOf = (i) => Math.min(1, Math.max(0, T - tree.birth[i]));
  function segOk(i, minR) {
    if (!tree || i <= 0 || i >= tree.parent.length || !rad) return false;
    if (fracOf(i) < 0.6) return false;
    const low = sm(0, 0.35, (mY[i] - crownBase)); if (low < 0.6) return false;
    return rad[tree.parent[i]] >= minR;
  }
  // Stück-Daten: Anfang, Ende (gewachsen), Achse, zwei Querrichtungen, Radien
  function segGeom(i) {
    const p = tree.pos[tree.parent[i]], c = tree.pos[i], f = fracOf(i);
    segS.copy(p); segE.copy(p).lerp(c, f); ax.subVectors(segE, segS);
    const L = ax.length(); ax.multiplyScalar(1 / Math.max(L, 1e-6));
    n1.set(0, 1, 0); if (Math.abs(ax.y) > 0.9) n1.set(1, 0, 0);
    n1.addScaledVector(ax, -n1.dot(ax)).normalize(); n2.crossVectors(ax, n1).normalize();
    return { L, r0: rad[tree.parent[i]], r1: rad[i] * (f < 1 ? 0.4 + 0.6 * f : 1) };
  }
  // Stamm: dicksten Weg vom Fuß aus (Liste der Stücke)
  let trunk = null;
  function trunkPath() {
    const kids = {}; for (let i = 1; i < tree.parent.length; i++) (kids[tree.parent[i]] = kids[tree.parent[i]] || []).push(i);
    const cnt = new Int32Array(tree.parent.length).fill(1);              // Stamm = Weg mit den meisten Nachkommen
    for (let i = tree.parent.length - 1; i > 0; i--) cnt[tree.parent[i]] += cnt[i];
    const out = []; let i = 0;
    for (let k = 0; k < 400; k++) { const c = kids[i]; if (!c || !c.length) break; const j = c.reduce((a, b) => cnt[b] > cnt[a] ? b : a); out.push(j); i = j; }
    return out;
  }
  // Richtung zur Kamera um die Achse (Winkel θ = 0 zeigt zur Kamera)
  const camDir = new V();
  function camAngle(g) {
    camDir.subVectors(camera.position, segS); camDir.addScaledVector(ax, -camDir.dot(ax));
    return Math.atan2(camDir.dot(n2), camDir.dot(n1));
  }
  // Punkt auf der Rinde: Stück i, u (0…1 vom Eltern- zum Kindknoten), Winkel th (absolut um die Achse)
  const pt = new V(), nrm = new V();
  function surf(i, u, th, out = pt, outN = nrm) {
    const g = segGeom(i), r = g.r0 + (g.r1 - g.r0) * u;
    outN.copy(n1).multiplyScalar(Math.cos(th)).addScaledVector(n2, Math.sin(th));
    out.copy(segS).addScaledVector(ax, g.L * u);
    // Wurzelanlauf wie im Rinden-Shader (nur am Stammfuß wichtig)
    const fl = Math.exp(-Math.max(out.y, 0) * 2.4) * sm(0.025, 0.12, r), w = Math.atan2(outN.z, outN.x);
    const rf = r * (1 + fl * (1.05 + 0.75 * Math.pow(Math.max(Math.sin(w * 5 + 1.3), 0), 1.5) + 0.15 * Math.sin(w * 3 - 0.7)));
    out.addScaledVector(outN, rf * 1.1 + 0.006);
    return g;
  }

  // ---- Zustand
  let st = 'aus', seg = -1, u = 0.5, th = 0, dirU = 1, head = 0, speed = 0.03, tState = 0, vt = 0, last = 0, nextFly = 0, size = 0.08;
  let flyP = null, flyT = 0, flyDur = 0, toSeg = -1, toU = 0, toTh = 0;
  const from = new V(), to = new V(), ctrl = new V();
  const allowed = () => P >= 1.98 && season !== 'winter' && !__isNight();
  function pickSpot() {               // zufälliger Platz: meist am Stamm (gut zu sehen), sonst ein unterer Ast
    if (!trunk) trunk = trunkPath();
    const lowT = trunk.filter(i => segOk(i, 0.012) && tree.pos[tree.parent[i]].y > 0.18 && tree.pos[tree.parent[i]].y < crownBase + 0.4);   // nicht im Gras
    if (Math.random() < 0.7 && lowT.length) return { seg: lowT[(Math.random() * lowT.length) | 0], u: rr(0.15, 0.85) };
    const cand = [];
    for (let i = 1; i < tree.parent.length; i++) if (segOk(i, Math.max(0.014, size * 0.18)) && tree.pos[i].y < crownBase + 0.9) cand.push(i);
    if (!cand.length) return lowT.length ? { seg: lowT[0], u: 0.5 } : null;
    return { seg: cand[(Math.random() * cand.length) | 0], u: rr(0.2, 0.8) };
  }
  // Länge in Welt-Einheiten: mind. ~3,5 CSS-Pixel, 0,025 bis 0,055 (Nutzer 24.10. abends: überall ~25 % kleiner,
  // 25.10.: nochmal um ein Drittel kleiner → halb so groß wie anfangs)
  const SIZE_K = 0.5;
  function sizeFor(p) {
    const h = renderer.domElement.clientHeight || innerHeight;
    const pxU = h / 2 * camera.projectionMatrix.elements[5] / Math.max(0.5, camera.position.distanceTo(p));
    return SIZE_K * Math.min(0.11, Math.max(0.05, 7 / pxU));
  }
  function place() {
    const s = pickSpot(); if (!s) return false;
    seg = s.seg; u = s.u; segGeom(seg); th = camAngle() + rr(-0.5, 0.5); dirU = Math.random() < 0.6 ? 1 : -1;
    head = 0; st = 'krabbeln'; tState = rr(4, 10); nextFly = vt + rr(40, 90);
    surf(seg, u, th); size = sizeFor(pt);
    return true;
  }
  // Ende eines Stücks: weiter auf ein Kind (hinauf) oder zum Eltern-Stück (hinunter); sonst umdrehen
  function nextSeg(up) {
    if (up) {
      const kids = []; for (let i = 1; i < tree.parent.length; i++) if (tree.parent[i] === seg && segOk(i, Math.max(0.012, size * 0.16)) && tree.pos[i].y < crownBase + 1.0) kids.push(i);
      if (!kids.length) return false;
      const thick = kids.reduce((a, b) => rad[b] > rad[a] ? b : a);
      seg = Math.random() < 0.6 ? thick : kids[(Math.random() * kids.length) | 0]; u = 0.02; return true;
    }
    const p = tree.parent[seg]; if (p <= 0) return false;
    if (!segOk(p, 0.01)) return false;
    seg = p; u = 0.98; return true;
  }
  function startFly() {
    const s = pickSpot(); if (!s) return;
    toSeg = s.seg; toU = s.u; segGeom(toSeg); toTh = camAngle() + rr(-0.5, 0.5);
    surf(seg, u, th, from); surf(toSeg, toU, toTh, to);
    const d = from.distanceTo(to);
    // Bogen: nach außen (zur Kamera) und etwas nach oben
    camDir.subVectors(camera.position, from).setY(0).normalize();
    ctrl.copy(from).lerp(to, 0.5).addScaledVector(camDir, 0.35 + d * 0.3); ctrl.y += 0.25 + d * 0.25;
    flyDur = Math.max(1.4, Math.min(3.2, d / 0.55 + 0.8)); flyT = 0; st = 'auf';   // erst Flügel öffnen
    tState = 0.35;
  }
  // ---- Zeichnen
  const qb = new THREE.Matrix4(), xA = new V(), yA = new V(), zA = new V();
  function drawTop(i, uu, tth, hd) {
    surf(i, uu, tth);
    // Kopf zeigt entlang der Achse (hinauf: +ax), leicht gedreht um die Flächennormale (Wackeln/Wenden)
    yA.copy(ax).multiplyScalar(dirU).applyAxisAngle(nrm, hd);
    zA.copy(nrm); xA.crossVectors(yA, zA).normalize(); yA.crossVectors(zA, xA).normalize();
    top.position.copy(pt); top.quaternion.setFromRotationMatrix(qb.makeBasis(xA, yA, zA)); top.scale.setScalar(size);
    top.visible = true; fly.visible = false;
  }
  const fp = new V(), fq = new V();
  function bez(t, out) { const a = 1 - t; return out.copy(from).multiplyScalar(a * a).addScaledVector(ctrl, 2 * a * t).addScaledVector(to, t * t); }
  function drawFly(t, buzz) {
    bez(t, fp); bez(Math.min(1, t + 0.02), fq);
    zA.subVectors(camera.position, fp).normalize();                    // fliegt: Bild zur Kamera
    yA.subVectors(fq, fp); yA.addScaledVector(zA, -yA.dot(zA)); if (yA.lengthSq() < 1e-10) yA.set(0, 1, 0); yA.normalize();
    xA.crossVectors(yA, zA).normalize();
    fly.position.copy(fp); fly.quaternion.setFromRotationMatrix(qb.makeBasis(xA, yA, zA));
    fly.scale.set(size * (0.9 + 0.1 * buzz), size, size); fly.visible = true; top.visible = false;
  }
  function frame() {
    const now = nowMs();
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    update(dt);
  }
  // Prüfhilfe: Zeit vorspulen ohne Zeichnen (in kleinen Schritten)
  window.__kaeferSim = (sec) => { for (let k = 0; k < Math.round(sec / 0.05); k++) update(0.05); };
  function update(dt) {
    if (!tree || !rad || !mY) return;
    if (!allowed()) { if (st !== 'aus') { st = 'aus'; top.visible = fly.visible = false; window.__kaefer = null; } return; }
    vt += dt; const t = window.__kaeferT ?? vt;
    if (st === 'aus') { if (!place()) return; }
    if (seg > 0 && !segOk(seg, 0.008) && st !== 'flug') { if (!place()) return; }   // Ast weg (Stufe gewechselt)
    if (reduceMotion) { drawTop(seg, u, th, 0); return; }
    if (st === 'krabbeln' || st === 'pause') {
      tState -= dt;
      if (st === 'krabbeln') {
        const g = segGeom(seg);
        u += dirU * speed * dt / Math.max(g.L, 0.05);
        head = 0.18 * Math.sin(t * 1.7) + 0.08 * Math.sin(t * 4.1);
        th += (camAngle() - th) * Math.min(1, dt * 0.3) + 0.04 * Math.sin(t * 0.9) * dt;   // bleibt auf der Kameraseite
        surf(seg, u, th);
        if (dirU < 0 && pt.y < 0.14) dirU = 1;                                // nicht ins Gras
        if (u >= 1) { if (!nextSeg(true)) { u = 1; dirU = -1; } }
        else if (u <= 0) { if (!nextSeg(false)) { u = 0; dirU = 1; } }
        if (tState <= 0) { st = 'pause'; tState = rr(1, 3.5); }
      } else if (tState <= 0) { st = 'krabbeln'; tState = rr(5, 14); if (Math.random() < 0.25) dirU = -dirU; }
      if (t >= nextFly) startFly();
      if (st === 'krabbeln' || st === 'pause') { drawTop(seg, u, th, st === 'pause' ? head * 0.3 : head); }
    }
    if (st === 'auf') {                                  // Flügeldecken öffnen (kurz das Flugbild am Platz)
      tState -= dt; surf(seg, u, th, from); fp.copy(from);
      drawFly(0, 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 22));
      if (tState <= 0) st = 'flug';
    } else if (st === 'flug') {
      flyT += dt / flyDur; const e = flyT < 1 ? flyT * flyT * (3 - 2 * flyT) : 1;
      drawFly(e, 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 22));
      if (flyT >= 1) { seg = toSeg; u = toU; th = toTh; dirU = Math.random() < 0.5 ? 1 : -1; st = 'pause'; tState = rr(1.5, 3); nextFly = t + rr(60, 130); }
    }
    const vis = fly.visible ? fly : top, pn = vis.position.clone().project(camera);
    window.__kaefer = { st, seg, u: +u.toFixed(3), size: +size.toFixed(3), y: +vis.position.y.toFixed(2), nx: +pn.x.toFixed(3), ny: +pn.y.toFixed(3) };
  }
  // Test: jetzt fliegen
  function flyNow() { if (st === 'krabbeln' || st === 'pause') { startFly(); return true; } return false; }
  return { frame, flyNow, get active() { return st !== 'aus'; } };
})();
// ------------------------------------------------------------------ Rabenkrähen (ab Stufe 4, Herbst und Winter, 25.10.)
// Nutzer 25.10.: Im Herbst und Winter kommt ab und zu ein kleiner Trupp Rabenkrähen (2–5) vorbei. Im Winter setzen sie
// sich in den kahlen Baum – gern hoch und außen, verteilt, nie hinter dem Stamm –, schauen sich um, krächzen ab und zu
// (ohne Ton), manche plustern sich auf, mal hüpft eine auf einen anderen Ast; nach 1–3 Minuten fliegen sie nacheinander
// weg und kommen ein paar Minuten später wieder. Im Herbst landen sie im Baum, wo das Laub Platz lässt (je mehr Laub
// gefallen ist, desto mehr Plätze), oben auf der Krone und auf der Wiese (stolzieren, picken; selten auch im Winter im
// Schnee). Nur tagsüber, ab Stufe 4. Beim Landen und Abfliegen rieselt im Winter etwas Schnee vom Ast, im Herbst löst
// sich manchmal ein Blatt. „Weniger Bewegung“: im Winter sitzt eine still im Baum.
// Bilder (Recraft, nano_banana_pro mit Häher und Meise als Stilvorlage – der Stil B2 malte nur Häher): sechs Haltungen
// (steht, krächzt, pickt, läuft 1/2, aufgeplustert) im selben Maßstab, dazu Körper und Flügel für die Gliederpuppe
// (createJayPuppet mit eigenen Maßen). Feste Bildebenen wie alle Tiere; nach links schauend gespiegelt.
// Sitzplätze: aus den gezeichneten Röhrenstücken (fast waagerecht, dick genug, ohne den Wohnast des Eichhörnchens).
// Sichtbar heißt: kein Ast, kein Laub (im Herbst nur das, was noch hängt) und nicht der Nistkasten vor dem Körper –
// geprüft in Bildschirm-Koordinaten mit Tiefe (Raster über der Leinwand). Krone: oberer Rand der Laubkarten.
// Die Uhr läuft nur, solange der Baum läuft. Die Bilder werden erst geladen, wenn die Krähen das erste Mal kommen dürfen.
// Prüfhilfen: window.__kraehen (Zustände, Bildschirmlage), window.__kraehenSim(s) (vorspulen ohne Zeichnen),
// window.__kraehenSetzen({ n, wo, fc }) (sofort hinsetzen, für Standbilder), window.__kraehenPose (Haltung erzwingen),
// window.__kraehenPlaetze (letzte Planung).
const kraehenFx = (() => {
  const META = {"stand":{"w":714,"h":669,"feet":[452,650],"shoulder":[450,230]},"kraechz":{"w":895,"h":592,"feet":[510,568]},"pick":{"w":805,"h":450,"feet":[520,412]},"lauf1":{"w":750,"h":656,"feet":[445,640]},"lauf2":{"w":809,"h":647,"feet":[470,618]},"plustern":{"w":774,"h":615,"feet":[520,570]},"lenPx":895,"puppe":{"body":{"w":1246,"h":378,"shoulder":[760,85],"beak":[1237,119],"tail":[8,259]},"wing":{"w":793,"h":1372,"base":[520,1335],"top":8,"scale":0.74}}};
  const LEN0 = 0.75;                                  // Schnabel bis Schwanzspitze (Meise 0,26, Häher 0,62; in echt 14 : 34 : 47 cm)
  // Im ganzen Baum (große Stufen, kleine Leinwand am Handy) wären sie nur ein paar Pixel groß: wie beim Zitronenfalter
  // werden sie dann größer gezeichnet – mindestens MIN_PX (CSS-Pixel) lang, höchstens doppelt so groß. Die Größe gilt für
  // den ganzen Besuch (bestimmt beim Kommen), damit sie nicht während des Sitzens wächst oder schrumpft.
  const MIN_PX = 28;
  let SC = 1, LEN = LEN0, K = LEN0 / META.lenPx, SHO = [0, 0];
  function setScale(sc) {
    SC = sc; LEN = LEN0 * sc; K = LEN / META.lenPx;     // Welt je Bildpunkt der Haltungen (alle aus einem Bogen)
    SHO = [(META.stand.shoulder[0] - META.stand.feet[0]) * K, (META.stand.feet[1] - META.stand.shoulder[1]) * K];   // Schulter über den Füßen
  }
  setScale(1);
  const SPEED = 2.4, HOP_SPEED = 1.7, WALK = 0.42;   // Flug, Umsetzen, Gehen (Welt/s)
  const TONE = 0.94, MAXN = 5;
  const R_MIN = 0.02, R_MAX = 0.32;                  // Astdicke (Radius) zum Sitzen
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rr = (a, b) => a + Math.random() * (b - a);
  const toSt = (p) => ({ x: p.dot(STAGE_R), y: p.y, z: p.dot(STAGE_D) });
  const herbstWinter = () => season === 'herbst' || season === 'winter';
  const allowed = () => !!tree && !!tubeGeo && !!rad && P >= 3.98 && !__isNight() && herbstWinter();
  const tmp = new V(), tmp2 = new V(), qz = new THREE.Quaternion(), zN = new V(0, 0, 1);

  // ---- Bilder und Figuren (erst beim ersten Mal)
  let tex = null, ready = false, shTex = null;
  const crows = [];
  function init() {
    if (ready) return; ready = true;
    const loader = new THREE.TextureLoader();
    const ldT = (n) => { const t = loader.load(__img(n)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    tex = { stand: ldT('bf24cf87e9.webp'), kraechz: ldT('5f44f85fee.webp'), pick: ldT('2349fc9bb1.webp'), lauf1: ldT('a6e73e01bb.webp'), lauf2: ldT('447f93bc09.webp'), plustern: ldT('e923903858.webp') };
    const pupTex = { body: ldT('c1f958953c.webp'), wing: ldT('1cc69b06ad.webp') };
    shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 2, 64, 64, 63); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    for (let i = 0; i < MAXN; i++) {
      const m = new THREE.MeshBasicMaterial({ map: tex.stand, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
      m.color.setScalar(TONE);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); mesh.renderOrder = 23; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
      // Krähe: ruhiger, tiefer Flügelschlag; im Baum leicht von oben gesehen (wie der Häher, aber weniger übertrieben)
      const pup = createJayPuppet(THREE, pupTex, { depthTest: true, order: 22, tone: TONE, freq: 2.7, up: 74, down: -50, lag: 36, fold: 58,
        beats: 5, glide: 0.5, glideE: 12, lift: 0.024, pitch: 2.4, tail: 6, tilt: 22, blur: 2, trail: 0 }, META.puppe);
      pup.group.visible = false; scene.add(pup.group);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, color: 0x18220e, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      sh.renderOrder = 21; sh.visible = false; sh.userData.__night = true; scene.add(sh);
      crows.push({ i, mesh, pup, sh, st: 'weg', spot: null, fc: 1, side: -1, path: null, d: 0, fk: '', dest: null, t: 0, ft: 0,
        act: null, stay: 0, leaveAt: Infinity, arriveAt: 0, answerAt: 0, wx: 0, quick: false });
    }
  }
  const SHQ = STAGE_Q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new V(1, 0, 0), -Math.PI / 2)), shP = new V();

  // ---- Zeichnen
  // Stehbild: Füße auf p, schaut nach fc (±1), sy = Stauchen an den Füßen
  function drawStand(c, pose, p, fc, sy = 1, dy = 0) {
    pose = window.__kraehenPose || pose;
    const m = META[pose], mesh = c.mesh;
    if (mesh.material.map !== tex[pose]) mesh.material.map = tex[pose];
    const cx = fc * (m.w / 2 - m.feet[0]) * K, cy = (m.feet[1] - m.h / 2) * K * sy + dy;
    mesh.position.copy(p).addScaledVector(STAGE_R, cx).addScaledVector(STAGE_U, cy);
    mesh.quaternion.copy(STAGE_Q); mesh.scale.set(fc * m.w * K, m.h * K * sy, 1);
    mesh.visible = true; c.pup.group.visible = false;
  }
  // Flugpuppe mit der Schulter auf s, Neigung th (Bogenmaß; Nase hoch = fc · th > 0)
  function drawFly(c, s, th, ctl) {
    c.pup.update(c.ft, ctl);
    const g = c.pup.group;
    g.position.copy(s); g.quaternion.copy(STAGE_Q).multiply(qz.setFromAxisAngle(zN, th)); g.scale.set(c.fc * LEN, LEN, LEN);
    g.visible = true; c.mesh.visible = false;
  }
  // weicher Schatten auf der Wiese (nur nah am Boden), am Wiesenrand ausgeblendet
  function shade(c, p, h) {
    const hh = Math.max(0, h);
    if (hh > 1.2) { c.sh.visible = false; return; }
    shP.copy(p); shP.addScaledVector(SUN_DIR, -0.22 * Math.max(0.05, hh) / SUN_DIR.y); shP.y = 0.02;
    const edge = 1 - Math.min(1, Math.max(0, (Math.hypot(shP.x, shP.z) - MR * 0.42) / (MR * 0.3)));
    c.sh.position.copy(shP); c.sh.quaternion.copy(SHQ);
    c.sh.scale.set(LEN * (0.75 + hh * 0.5), LEN * (0.26 + hh * 0.18), 1);
    c.sh.material.opacity = 0.45 * edge * (1 - sm(0.2, 1.2, hh)) / (1 + hh * 0.9); c.sh.visible = edge > 0.01;
  }
  function hideCrow(c) { c.mesh.visible = false; c.pup.group.visible = false; c.sh.visible = false; }

  // ---- Weg (Catmull-Rom nach Bogenlänge)
  function makePath(pts) {
    const Pn = pts.map(p => p.clone()), N = 24 * (Pn.length - 1), samples = [], len = [0];
    const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return new V().addScaledVector(a, -0.5 * t3 + t2 - 0.5 * t).addScaledVector(b, 1.5 * t3 - 2.5 * t2 + 1).addScaledVector(c, -1.5 * t3 + 2 * t2 + 0.5 * t).addScaledVector(d, 0.5 * t3 - 0.5 * t2); };
    for (let i = 0; i <= N; i++) {
      const g = i / N * (Pn.length - 1), k = Math.min(Pn.length - 2, Math.floor(g)), t = g - k;
      const s = cr(Pn[Math.max(0, k - 1)], Pn[k], Pn[k + 1], Pn[Math.min(Pn.length - 1, k + 2)], t);
      if (i) len.push(len[i - 1] + s.distanceTo(samples[i - 1])); samples.push(s);
    }
    return { total: len[N], at(d, out) { d = Math.min(len[N], Math.max(0, d)); let i = 1; while (i < N && len[i] < d) i++; const u = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]); return out.copy(samples[i - 1]).lerp(samples[i], u); } };
  }
  const W3 = (x, y, z) => stageToWorld(x, y, z);
  const shoulderAt = (p, fc, out = new V()) => out.copy(p).addScaledVector(STAGE_R, fc * SHO[0]).addScaledVector(STAGE_U, SHO[1]);

  // ---- Sichtbarkeit: Äste, Laub und Nistkasten in Bildschirm-Koordinaten (CSS-Pixel) mit Tiefe, in einem Raster
  const GN = 24;
  let occ = null;
  const pv = new V(), fwd = new V(), sp = [0, 0, 0], a3 = [0, 0, 0], b3 = [0, 0, 0];
  function scr(w, out) {
    pv.copy(w).project(camera);
    out[0] = (pv.x * 0.5 + 0.5) * occ.w; out[1] = (0.5 - pv.y * 0.5) * occ.h;
    out[2] = (w.x - camera.position.x) * fwd.x + (w.y - camera.position.y) * fwd.y + (w.z - camera.position.z) * fwd.z;
    return out;
  }
  // Röhrenstücke der Knoten (wie in updateTree gezählt); danach kommen die Stücke des Wohnasts
  function nodeSegs() {
    let k = 0;
    for (let i = 1; i < tree.N; i++) { if (T - tree.birth[i] <= 0) continue; if (smooth((mY[i] - crownBase) / 0.35) <= 0.02) continue; k++; }
    return Math.min(k, tubeGeo.instanceCount);
  }
  // Raster nur neu bauen, wenn sich Kamera, Baum, Laub, Kasten oder Leinwand geändert haben (sonst bleibt es)
  let occKey = '';
  function buildOcc() {
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements, pe = camera.projectionMatrix.elements;
    const key = [e[0], e[2], e[8], e[10], e[12], e[13], e[14], pe[0], pe[5], T, tubeGeo.instanceCount, leafUniforms.uDropU.value, leafMesh && leafMesh.visible,
      typeof nistkastenFx !== 'undefined' && nistkastenFx.visible ? nistkastenFx.grp.position.y : 0, W(), H()].map(v => typeof v === 'number' ? v.toFixed(3) : String(v)).join('|');
    if (occ && key === occKey) return;
    occKey = key;
    camera.getWorldDirection(fwd);
    const w = W(), h = H(), fpx = h / (2 * Math.tan(camera.fov * Math.PI / 360));
    occ = { w, h, fpx, cells: Array.from({ length: GN * GN }, () => []), items: [], cands: {} };
    // Eintrag: [Art (0 Ast, 1 Kreis), ax, ay, aTiefe, aRadiusPx, bx, by, bTiefe, bRadiusPx, aRadiusWelt, bRadiusWelt]
    const add = (it) => {
      const idx = occ.items.length; occ.items.push(it);
      const pad = Math.max(it[4], it[8]);
      const x0 = Math.min(it[1], it[5]) - pad, x1 = Math.max(it[1], it[5]) + pad, y0 = Math.min(it[2], it[6]) - pad, y1 = Math.max(it[2], it[6]) + pad;
      if (x1 < 0 || y1 < 0 || x0 >= w || y0 >= h) return;
      const cx0 = Math.max(0, Math.floor(x0 / w * GN)), cx1 = Math.min(GN - 1, Math.floor(x1 / w * GN));
      const cy0 = Math.max(0, Math.floor(y0 / h * GN)), cy1 = Math.min(GN - 1, Math.floor(y1 / h * GN));
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) occ.cells[cy * GN + cx].push(idx);
    };
    const S = tubeGeo.getAttribute('aStart').array, E = tubeGeo.getAttribute('aEnd').array, Rd = tubeGeo.getAttribute('aRad').array;
    for (let k = 0; k < tubeGeo.instanceCount; k++) {
      scr(tmp.set(S[k * 3], S[k * 3 + 1], S[k * 3 + 2]), a3); scr(tmp.set(E[k * 3], E[k * 3 + 1], E[k * 3 + 2]), b3);
      if (a3[2] < 0.05 || b3[2] < 0.05) continue;
      // dicke Stücke unten am Stamm: Wurzelanlauf wie im Rinden-Shader (grob, nach außen)
      const fa = 1 + Math.exp(-Math.max(S[k * 3 + 1], 0) * 2.4) * sm(0.025, 0.12, Rd[k * 2]) * 1.6;
      const ra = Rd[k * 2] * fa * 1.06, rb = Rd[k * 2 + 1] * 1.06;
      add([0, a3[0], a3[1], a3[2], ra * fpx / a3[2], b3[0], b3[1], b3[2], rb * fpx / b3[2], ra, rb]);
    }
    if (leafMesh && leafMesh.visible) {
      const ga = leafMesh.geometry.getAttribute('aGrow').array, M = leafMesh.instanceMatrix.array, ls = leafUniforms.uLeafScale.value;
      for (let k = 0; k < ga.length; k++) {
        if (ga[k] < 0.25 || seasonGone(k)) continue;
        const o = k * 16, g = ga[k] * ls;
        tmp.set(M[o + 12] + M[o + 4] * 0.5 * g, M[o + 13] + M[o + 5] * 0.5 * g, M[o + 14] + M[o + 6] * 0.5 * g);   // Mitte der Laub-Ellipse
        scr(tmp, a3); if (a3[2] < 0.05) continue;
        const Rw = 0.5 * Math.hypot(M[o + 4], M[o + 5], M[o + 6]) * g, R = Rw * fpx / a3[2];   // ganze Karte (Blätter reichen bis zum Rand)
        add([2, a3[0], a3[1], a3[2], R, a3[0], a3[1], a3[2], R, 0, 0]);
      }
    }
    if (typeof nistkastenFx !== 'undefined' && nistkastenFx.visible) {
      scr(nistkastenFx.grp.position, a3);
      if (a3[2] > 0.05) { const R = 0.3 * fpx / a3[2]; add([1, a3[0], a3[1], a3[2] - 0.12, R, a3[0], a3[1], a3[2] - 0.12, R, 0, 0]); }   // Nistkasten
    }
  }
  // ist der Weltpunkt w von etwas davor verdeckt? 0 = frei, 1 = Ast oder Kasten, 2 = Laub, 3 = außerhalb der Leinwand
  function hidden(w) {
    scr(w, sp); const x = sp[0], y = sp[1], d = sp[2];
    if (x < 0 || y < 0 || x >= occ.w || y >= occ.h) return 3;
    const cell = occ.cells[Math.floor(y / occ.h * GN) * GN + Math.floor(x / occ.w * GN)];
    for (let j = 0; j < cell.length; j++) {
      const it = occ.items[cell[j]];
      if (it[0] !== 0) {
        if (it[3] > d - 0.04) continue;
        const dx = x - it[1], dy = y - it[2]; if (dx * dx + dy * dy < it[4] * it[4]) return it[0];
      } else {
        const vx = it[5] - it[1], vy = it[6] - it[2], L2 = vx * vx + vy * vy;
        let u = L2 > 1e-6 ? ((x - it[1]) * vx + (y - it[2]) * vy) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const dx = it[1] + vx * u - x, dy = it[2] + vy * u - y, r = it[4] + (it[8] - it[4]) * u;
        if (dx * dx + dy * dy > r * r) continue;
        const front = it[3] + (it[7] - it[3]) * u - (it[9] + (it[10] - it[9]) * u);   // vordere Oberfläche des Asts
        if (front < d - 0.01) return 1;
      }
    }
    return 0;
  }
  // Prüfstellen auf der Krähe (Füße = 0; x in Blickrichtung beider Seiten, darum symmetrisch); h = Kopf
  const SAMP = [[-0.22, 0.1], [0, 0.12], [0.22, 0.1], [-0.24, 0.28], [0, 0.3], [0.24, 0.28], [-0.12, 0.45, 1], [0.12, 0.45, 1], [0, 0.5]];
  const BOX = [[-0.4, 0], [0.4, 0], [-0.4, 0.62], [0.4, 0.62], [0, 0.66]];
  function inView(p) {
    for (const [x, y] of BOX) {
      tmp.copy(p).addScaledVector(STAGE_R, x * SC).addScaledVector(STAGE_U, y * SC).project(camera);
      if (Math.abs(tmp.x) > 0.92 || tmp.y < -0.9 || tmp.y > 0.88 || tmp.z > 1) return false;
      if (tmp.x > 0.5 && tmp.y < -0.38) return false;   // unten rechts liegt der Knopf „Baum groß“
    }
    return true;
  }
  // sichtbar: Kopf frei; höchstens eine Stelle von einem Ast verdeckt; Laub nur an den Füßen (eine Stelle).
  // Krone: sitzt zwischen den obersten Blättern – Kopf und Rücken (ab halber Höhe) müssen ganz frei sein
  function visible(p, kind) {
    let n = 0, leaf = 0;
    for (const s of SAMP) {
      if (kind === 'krone') {
        if (s[1] < 0.4) continue;
        tmp2.copy(p).addScaledVector(STAGE_R, s[0] * SC).addScaledVector(STAGE_U, s[1] * SC);
        if (hidden(tmp2)) return false;
        continue;
      }
      tmp2.copy(p).addScaledVector(STAGE_R, s[0] * SC).addScaledVector(STAGE_U, s[1] * SC);
      const h = hidden(tmp2);
      if (!h) continue;
      if (s[2] || h === 3) return false;
      if (h === 2) { if (s[1] > 0.15 || ++leaf > 1) return false; }
      else if (++n > 1) return false;
    }
    return true;
  }
  const lenPx = (p) => { scr(p, a3); scr(tmp.copy(p).addScaledVector(STAGE_R, LEN), b3); return Math.hypot(b3[0] - a3[0], b3[1] - a3[1]); };
  function spaced(p, others) {
    if (!others.length) return true;
    const L = lenPx(p); scr(p, a3); const ax = a3[0], ay = a3[1];
    for (const q of others) {
      if (q.distanceTo(p) < 0.8 * SC) return false;
      scr(q, b3); if (Math.hypot(b3[0] - ax, b3[1] - ay) < 0.85 * L) return false;
    }
    return true;
  }
  function trunkR(y) { const r0 = rad[0]; return r0 * (1 + Math.exp(-Math.max(y, 0) * 2.4) * sm(0.025, 0.12, r0) * 1.95) * 1.13; }
  const segDist = (p, ax, ay, az, bx, by, bz) => {
    const vx = bx - ax, vy = by - ay, vz = bz - az, L2 = vx * vx + vy * vy + vz * vz;
    let u = L2 > 0 ? ((p.x - ax) * vx + (p.y - ay) * vy + (p.z - az) * vz) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
    return Math.hypot(ax + vx * u - p.x, ay + vy * u - p.y, az + vz * u - p.z);
  };

  // ---- Kandidaten: Äste, Krone (oberer Rand des Laubs), Wiese
  let astKey = '', astList = null;
  function astCands() {
    const key = T.toFixed(4) + '|' + tubeGeo.instanceCount;
    if (astList && key === astKey) return astList.map(c => ({ ...c, score: c.base + rr(0, 0.35) }));
    const S = tubeGeo.getAttribute('aStart').array, E = tubeGeo.getAttribute('aEnd').array, Rd = tubeGeo.getAttribute('aRad').array;
    const nk = nodeSegs(), cnt = tubeGeo.instanceCount, out = [];
    const top = Math.max(crownBase + 0.5, grownTop), crownR = Math.max(0.6, crownW / 2);
    // Wohnast: erst grob über den umgebenden Kasten, dann genau
    let bx0 = 1e9, by0 = 1e9, bz0 = 1e9, bx1 = -1e9, by1 = -1e9, bz1 = -1e9;
    for (let k = nk; k < cnt; k++) for (const A of [S, E]) { bx0 = Math.min(bx0, A[k * 3]); bx1 = Math.max(bx1, A[k * 3]); by0 = Math.min(by0, A[k * 3 + 1]); by1 = Math.max(by1, A[k * 3 + 1]); bz0 = Math.min(bz0, A[k * 3 + 2]); bz1 = Math.max(bz1, A[k * 3 + 2]); }
    const nearWohn = (p) => {
      if (p.x < bx0 - 0.6 || p.x > bx1 + 0.6 || p.y < by0 - 0.6 || p.y > by1 + 0.6 || p.z < bz0 - 0.6 || p.z > bz1 + 0.6) return false;
      for (let k = nk; k < cnt; k++) if (segDist(p, S[k * 3], S[k * 3 + 1], S[k * 3 + 2], E[k * 3], E[k * 3 + 1], E[k * 3 + 2]) < 0.6) return true;
      return false;
    };
    for (let k = 0; k < nk; k++) {
      const ax = S[k * 3], ay = S[k * 3 + 1], az = S[k * 3 + 2], dx = E[k * 3] - ax, dy = E[k * 3 + 1] - ay, dz = E[k * 3 + 2] - az;
      const L = Math.hypot(dx, dy, dz), r0 = Rd[k * 2], r1 = Rd[k * 2 + 1];
      if (L < 0.1 || Math.abs(dy) / L > 0.62) continue;  // zu kurz oder zu steil
      if (Math.min(r0, r1) < R_MIN || Math.max(r0, r1) > R_MAX) continue;
      const u = 0.35 + 0.3 * ((k * 0.618) % 1);           // eine Stelle je Stück (fest, damit der Vorrat gleich bleibt)
      const r = r0 + (r1 - r0) * u, py = ay + dy * u + r * 0.92;
      if (py < 0.8) continue;
      const p = new V(ax + dx * u, py, az + dz * u);
      if (nk < cnt && nearWohn(p)) continue;                // nicht neben das Eichhörnchen
      const st = toSt(p), hn = Math.min(1, Math.max(0, (p.y - crownBase) / (top - crownBase)));
      const out2 = Math.min(1, Math.hypot(p.x, p.z) / crownR);
      out.push({ kind: 'ast', k, p, base: 0.5 * hn + 0.3 * out2 + 0.15 * sm(-0.5, 0.8, st.z) });
    }
    astKey = key; astList = out;
    return out.map(c => ({ ...c, score: c.base + rr(0, 0.35) }));
  }
  function kroneCands() {
    const out = []; if (!leafMesh || !leafMesh.visible) return out;
    const ga = leafMesh.geometry.getAttribute('aGrow').array, M = leafMesh.instanceMatrix.array, ls = leafUniforms.uLeafScale.value, tops = [];
    let ymax = -1e9;
    for (let k = 0; k < ga.length; k++) {
      if (ga[k] < 0.4 || seasonGone(k)) continue;
      const o = k * 16, g = ga[k] * ls;
      const Xx = M[o] * g * 0.38, Xy = M[o + 1] * g * 0.38, Xz = M[o + 2] * g * 0.38, Yx = M[o + 4] * g * 0.46, Yy = M[o + 5] * g * 0.46, Yz = M[o + 6] * g * 0.46;
      const cx = M[o + 12] + M[o + 4] * g * 0.5, cy = M[o + 13] + M[o + 5] * g * 0.5, cz = M[o + 14] + M[o + 6] * g * 0.5;
      const ext = Math.hypot(Xy, Yy) || 1e-6;                                         // höchster Punkt der Ellipse
      const t = [cx + (Xx * Xy + Yx * Yy) / ext, cy + ext, cz + (Xz * Xy + Yz * Yy) / ext];
      tops.push(t); if (t[1] > ymax) ymax = t[1];
    }
    for (const t of tops) {
      if (t[1] < ymax - 0.9) continue;
      const p = new V(t[0], t[1] - 0.22 * SC, t[2]), st = toSt(p);  // Füße zwischen den obersten Blättern
      out.push({ kind: 'krone', k: -1, p, score: (t[1] - ymax + 0.9) / 0.9 + 0.6 * sm(-1.5, 1, st.z) + rr(0, 0.4) });   // lieber vorn
    }
    return out;
  }
  function bodenCands(m = 60) {
    const out = [], tr = trunkR(0.05);
    for (let j = 0; j < m; j++) {
      const x = rr(-2.2, 2.2), z = rr(0.3, tr + 1.6), p = W3(x, 0.01, z);
      if (Math.hypot(p.x, p.z) < tr + 0.35) continue;
      out.push({ kind: 'boden', k: -1, p, score: rr(0, 1) - Math.abs(x) * 0.08 });
    }
    return out;
  }
  // einen Platz dieser Art finden: nach Bewertung, sichtbar, im Bild, mit Abstand zu den anderen
  function findSpot(kind, others, near = null) {
    let c = occ.cands[kind] || (occ.cands[kind] = kind === 'ast' ? astCands() : kind === 'krone' ? kroneCands() : bodenCands());
    if (near) c = c.filter(s => s.p.distanceTo(near) > 0.6 && s.p.distanceTo(near) < 3);
    // verteilt: Plätze weiter weg von der Mitte der anderen (seitlich) bekommen etwas Vorrang
    if (others.length && kind !== 'boden') {
      let mx = 0; for (const q of others) mx += q.dot(STAGE_R); mx /= others.length;
      c = c.map(s => ({ ...s, score: s.score + 0.12 * Math.min(3, Math.abs(s.p.dot(STAGE_R) - mx)) }));
    }
    c = c.slice().sort((a, b) => b.score - a.score);
    let tests = 0;
    for (const s of c) {
      if (tests > 70) break;
      if (!inView(s.p) || !spaced(s.p, others)) continue;
      tests++;
      if (visible(s.p, kind)) return s;
    }
    return null;
  }
  // Arten in der Reihenfolge, in der probiert wird (Winter: Baum, selten Schnee; Herbst: Baum, Krone, Wiese)
  function kindsFor(j) {
    if (season === 'winter') return j > 0 && Math.random() < 0.1 ? ['boden', 'ast'] : ['ast', 'boden'];
    const w = [['ast', 0.4], ['krone', 0.3], ['boden', 0.3]], out = [];
    while (w.length) { let s = 0; for (const e of w) s += e[1]; let r = Math.random() * s, i = 0; while (i < w.length - 1 && (r -= w[i][1]) > 0) i++; out.push(w[i][0]); w.splice(i, 1); }
    return out;
  }
  // Größe: wie lang wäre eine Krähe (LEN0) in der Kronenmitte auf dem Bildschirm?
  function pickScale() {
    camera.updateMatrixWorld();
    const c = leafUniforms.uCrownC.value;
    tmp.set(c.x, Math.min(c.y, grownTop * 0.7), c.z); tmp2.copy(tmp).addScaledVector(STAGE_R, LEN0);
    tmp.project(camera); tmp2.project(camera);
    const px = Math.hypot((tmp2.x - tmp.x) * 0.5 * W(), (tmp2.y - tmp.y) * 0.5 * H());
    setScale(Math.min(2, Math.max(1, MIN_PX / Math.max(1, px))));
  }
  function planSpots(n, wo = null) {
    pickScale(); buildOcc();
    const chosen = [], pts = [];
    for (let j = 0; j < n; j++) {
      for (const kind of (wo ? [wo[j % wo.length]] : kindsFor(j))) {
        if (kind === 'boden' && (visitFx.active || jayFx.active)) continue;
        const s = findSpot(kind, pts); if (s) { chosen.push(s); pts.push(s.p); break; }
      }
    }
    window.__kraehenPlaetze = chosen.map(s => { const v = s.p.clone().project(camera); return { wo: s.kind, x: +s.p.x.toFixed(2), y: +s.p.y.toFixed(2), z: +s.p.z.toFixed(2), nx: +v.x.toFixed(2), ny: +v.y.toFixed(2) }; });
    return chosen;
  }

  // ---- Ablauf
  let vt = 0, last = 0, next = rr(12, 35), ep = null, still = null, soon = false;
  const present = (c) => c.st !== 'weg' && c.st !== 'warten';
  const others = (c) => crows.filter(o => o !== c && o.st !== 'weg' && (o.spot || o.dest)).map(o => (o.dest || o.spot).p);
  function canStart() { return !trans && !moveIn && !jayFx.active && !visitFx.active && !seqPlayer.active(); }
  // Besuch: der erste Platz wird gleich gesucht (gibt es keinen, kommt keiner), die anderen erst beim jeweiligen Anflug
  function startEpisode() {
    const r = Math.random(), nMax = P < 4.98 ? 3 : P < 5.98 ? 4 : 5;     // kleiner Baum: kleiner Trupp
    const n = Math.min(nMax, r < 0.25 ? 2 : r < 0.6 ? 3 : r < 0.85 ? 4 : 5);
    const first = planSpots(1)[0];
    if (!first) { next = vt + rr(25, 50); return false; }
    const side = Math.random() < 0.5 ? -1 : 1;
    let at = 0;
    for (let j = 0; j < n; j++) {
      Object.assign(crows[j], { st: 'warten', spot: null, dest: j ? null : first, nr: j, arriveAt: vt + at, side: Math.random() < 0.8 ? side : -side, leaveAt: Infinity, act: null, answerAt: 0, quick: false });
      at += rr(0.8, 4.5);
    }
    ep = { endAt: vt + at + rr(60, 140), leaving: false, side };
    return true;
  }
  function spotFor(c) {
    buildOcc();
    for (const kind of kindsFor(c.nr)) {
      if (kind === 'boden' && (visitFx.active || jayFx.active)) continue;
      const s = findSpot(kind, others(c)); if (s) return s;
    }
    return null;
  }
  // Abflug aller (nacheinander; quick: aufgeschreckt, alle fast gleichzeitig)
  function leaveAll(quick) {
    if (!ep) return;
    ep.leaving = true;
    let at = vt;
    for (const c of crows.slice().sort(() => Math.random() - 0.5)) {
      if (c.st === 'weg') continue;
      if (c.st === 'warten') { c.st = 'weg'; c.dest = null; continue; }
      c.leaveAt = at; c.quick = quick; at += quick ? rr(0, 0.35) : rr(0.6, 3.5);
    }
  }
  // Anflug: von der Seite herein, hoch über dem Ziel, dann hinunter zur Landestelle (Schulter über den Füßen)
  function arrive(c) {
    const s = c.dest, st = toSt(s.p), fc = -c.side, end = shoulderAt(s.p, fc);
    const yA = Math.min(Math.max(s.p.y + rr(0.9, 1.7), 1.6), Math.max(3, grownTop + 1.5));
    const yS = yA + rr(0, 0.6), zS = st.z + rr(0.3, 1.1), xS = edgeStageX(c.side, yS, zS, 6.6);   // außerhalb des Bildes (je nach Kamera)
    const start = W3(xS, yS, zS); c.far = Math.min(3, Math.abs(xS) / 6.6);
    const mid = W3(st.x + c.side * rr(1.1, 1.8), Math.max(end.y, s.p.y) + rr(0.45, 0.9), st.z + rr(0.15, 0.5));
    const near = end.clone().add(tmp.set(0, 0.16, 0)).addScaledVector(STAGE_R, c.side * 0.32).addScaledVector(STAGE_D, 0.06);
    c.path = makePath([start, mid, near, end]); c.d = 0; c.fk = 'an'; c.st = 'flug'; c.fc = fc; c.ft = 0; c.act = null; c.pup.reset();
  }
  // Umsetzen: kurzer Bogen von der Schulter zum neuen Platz
  function hopTo(c, s) {
    const from = shoulderAt(c.spot.p, c.fc), fc = toSt(s.p).x >= toSt(c.spot.p).x ? 1 : -1, end = shoulderAt(s.p, fc);
    const up = Math.max(from.y, end.y) + rr(0.3, 0.5);
    const m1 = from.clone().lerp(end, 0.3).setY(up), m2 = from.clone().lerp(end, 0.75).setY(up - 0.05);
    c.path = makePath([from, m1, m2, end]); c.d = 0; c.fk = 'hop'; c.dest = s; c.fc = fc; c.st = 'hockt'; c.t = 0; c.next = 'hop';
  }
  // Abflug: hinauf und zur Seite aus dem Bild
  function flyOff(c) {
    const from = shoulderAt(c.spot.p, c.fc), st = toSt(from);
    const side = ep && !c.quick ? (Math.random() < 0.75 ? ep.side * -1 : ep.side) : (st.x >= 0 ? 1 : -1);
    const up = from.clone().add(tmp.set(0, 0.32, 0)).addScaledVector(STAGE_R, side * 0.28).addScaledVector(STAGE_D, 0.1);
    const mid = W3(st.x + side * rr(1.3, 2), st.y + rr(0.7, 1.2), st.z + rr(0.2, 0.6));
    const yE = st.y + rr(1.2, 2), zE = st.z + rr(0.4, 1), xE = edgeStageX(side, yE, zE, 6.9);   // hinter den Bildrand (je nach Kamera)
    const end = W3(xE, yE, zE); c.far = Math.min(3, Math.abs(xE) / 6.9);
    c.path = makePath([from, up, mid, end]); c.d = 0; c.fk = 'ab'; c.dest = null; c.fc = side; c.st = 'hockt'; c.t = 0; c.next = 'ab';
  }
  // Schnee rieselt vom Ast / ein Blatt löst sich
  function puff(c, p) {
    if (reduceMotion || !c.spot || c.spot.kind === 'boden') return;
    if (season === 'winter') stageFx.snowAt?.(p.clone().add(tmp.set(0, -0.03, 0)), 14 + ((Math.random() * 8) | 0));
    else if (Math.random() < 0.5) stageFx.leafAt(p.clone().add(tmp.set(rr(-0.25, 0.25), rr(0, 0.3), rr(-0.1, 0.1))), 'herbst');
  }
  function land(c) {
    c.spot = c.dest; c.dest = null; c.st = c.spot.kind === 'boden' ? 'boden' : 'sitzt'; c.t = 0; c.act = null; c.answerAt = 0;
    c.stay = vt + rr(25, 70); puff(c, c.spot.p);
  }
  // Tätigkeiten
  function setAct(c, k, dur, o = {}) { c.act = Object.assign({ k, t: 0, dur }, o); }
  function caw(c, n) {
    setAct(c, 'kraechz', n * 0.62, { n });
    for (const o of crows) if (o !== c && present(o) && Math.random() < 0.25) o.answerAt = vt + rr(0.7, 1.7);   // ein anderer antwortet
  }
  function nextActPerch(c) {
    const r = Math.random(), wint = season === 'winter';
    if (c.act && c.act.k === 'plustern' && r < 0.5) return setAct(c, 'plustern', rr(6, 16), { flip: Math.random() < 0.4 });
    if (r < 0.1) return caw(c, 1 + ((Math.random() * 3) | 0));
    if (wint && r < 0.38) return setAct(c, 'plustern', rr(8, 22), { flip: Math.random() < 0.4 });
    if (r < 0.62) return setAct(c, 'schau', rr(0.5, 1.2));
    setAct(c, 'ruhe', rr(1.8, 5));
  }
  function nextActGround(c) {
    const r = Math.random();
    if (r < 0.06) return caw(c, 1 + ((Math.random() * 2) | 0));
    if (r < 0.42) { const n = 2 + ((Math.random() * 3) | 0); return setAct(c, 'pick', n * 0.46, { n }); }
    if (r < 0.75) {
      // ein Stück gehen (nur seitlich: Seitenansicht); am Rand des erlaubten Bereichs umdrehen
      let dist = rr(0.2, 0.8), fc = Math.random() < 0.65 ? c.fc : -c.fc;
      const x0 = toSt(c.spot.p).x;
      if (Math.abs(x0 + fc * dist) > 2.3) fc = -fc;
      let tgt = c.spot.p.clone().addScaledVector(STAGE_R, fc * dist);
      if (!inView(tgt)) { fc = -fc; tgt = c.spot.p.clone().addScaledVector(STAGE_R, fc * dist); }
      if (others(c).some(q => q.distanceTo(tgt) < 0.7 * SC)) return setAct(c, 'schau', rr(0.5, 1.2));   // dort steht schon eine
      c.fc = fc; return setAct(c, 'lauf', dist / WALK, { dist, from: c.spot.p.clone() });
    }
    if (r < 0.88) return setAct(c, 'schau', rr(0.5, 1.2));
    setAct(c, 'ruhe', rr(1.2, 3));
  }
  // vielleicht umziehen (Baum ↔ Wiese, anderer Ast)
  function maybeMove(c) {
    if (ep && ep.leaving) return false;
    c.stay = vt + rr(25, 70);
    if (Math.random() > 0.4) return false;
    buildOcc();
    const kinds = season === 'winter' ? ['ast'] : (c.spot.kind === 'boden' ? ['ast', 'krone'] : ['ast', 'krone', 'boden']).sort(() => Math.random() - 0.5);
    for (const kind of kinds) {
      if (kind === 'boden' && (visitFx.active || jayFx.active)) continue;
      const s = findSpot(kind, others(c), kind === c.spot.kind ? c.spot.p : null);
      if (s) { hopTo(c, s); return true; }
    }
    return false;
  }

  const fp = new V(), fq = new V(), fr = new V();
  function stepFlight(c, dt) {
    const total = c.path.total, rem = total - c.d, F = c.fk === 'hop' ? 1 : (c.far || 1);   // F: weiter Weg vom/zum Bildrand
    const v = c.fk === 'ab' ? SPEED * F * (c.quick ? 1.3 : 1) * (sm(-0.2, 0.7 * F, c.d) * 0.8 + 0.2)
      : (c.fk === 'hop' ? HOP_SPEED : SPEED * F) * (sm(-0.1, c.fk === 'hop' ? 0.5 : 0.9 * F, rem) * 0.85 + 0.15);
    c.d += v * dt; c.ft += dt;
    if (c.d >= total) {
      if (c.fk === 'ab') { c.st = 'weg'; c.spot = null; hideCrow(c); return; }
      land(c); drawStand(c, 'stand', c.spot.p, c.fc, 0.93); return;   // gleich im selben Bild stehen
    }
    c.path.at(c.d, fp); c.path.at(Math.min(total, c.d + 0.06), fq);
    const dx = toSt(fq).x - toSt(fp).x, dy = fq.y - fp.y;
    if (Math.abs(dx) > 0.004) c.fc = dx > 0 ? 1 : -1;
    let th = Math.atan2(dy, Math.max(0.02, Math.abs(dx))) * 0.55 * c.fc;
    let ctl = null;
    if (c.fk !== 'ab') {                                    // Landen: abbremsen, Flügel hoch, Nase hoch
      const flare = sm(c.fk === 'hop' ? 0.45 : 0.7 * F, 0, rem);
      if (flare > 0) { ctl = { hold: 1, e: 15 + 55 * flare }; th += c.fc * 0.42 * flare; }
    } else if (c.d < 0.9 * F) ctl = { hold: 0, freq: 1.5 };   // Abflug: kräftig schlagen
    fp.y += Math.sin(c.ft * 6 + c.i) * 0.008;
    drawFly(c, fp, th, ctl);
    // Schatten nur nah am Boden (Wiese)
    shade(c, fr.copy(fp).addScaledVector(STAGE_U, -SHO[1]), fp.y - SHO[1]);
  }
  function stepPerch(c, dt) {
    const a = c.act; a.t += dt;
    let pose = 'stand', sy = 1, dy = 0;
    if (a.k === 'kraechz') {
      const ph = a.t % 0.62, on = ph < 0.34;
      pose = on ? 'kraechz' : 'stand'; sy = on ? 1 + 0.025 * Math.sin(Math.PI * ph / 0.34) : 1;
    } else if (a.k === 'plustern') {
      pose = 'plustern';
      if (a.flip && a.t > a.dur * 0.5 && !a.flipped) { a.flipped = true; c.fc = -c.fc; }
    } else if (a.k === 'schau') {
      if (!a.done && a.t > a.dur * 0.4) { a.done = true; c.fc = -c.fc; }
    }
    if (c.t < 0.3) sy *= 1 - 0.07 * Math.sin(Math.PI * c.t / 0.3);      // Aufsetzen: federt ein
    drawStand(c, pose, c.spot.p, c.fc, sy, dy);
    c.sh.visible = false;
  }
  function stepGround(c, dt) {
    const a = c.act; a.t += dt;
    let pose = 'stand', sy = 1, dy = 0;
    if (a.k === 'lauf') {
      const u = Math.min(1, a.t / a.dur);
      c.spot.p.copy(a.from).addScaledVector(STAGE_R, c.fc * a.dist * u);
      const cyc = (a.t / 0.54) % 1;                                     // Schrittfolge: Bein vor, stehen, anderes Bein, stehen
      pose = cyc < 0.28 ? 'lauf1' : cyc < 0.5 ? 'stand' : cyc < 0.78 ? 'lauf2' : 'stand';
      dy = 0.008 * Math.abs(Math.sin(cyc * Math.PI * 2));
    } else if (a.k === 'pick') {
      const ph = a.t % 0.46; pose = ph < 0.24 ? 'pick' : 'stand';
    } else if (a.k === 'kraechz') {
      const ph = a.t % 0.62, on = ph < 0.34; pose = on ? 'kraechz' : 'stand';
    } else if (a.k === 'schau') {
      if (!a.done && a.t > a.dur * 0.4) { a.done = true; c.fc = -c.fc; }
    }
    if (c.t < 0.3) sy *= 1 - 0.08 * Math.sin(Math.PI * c.t / 0.3);
    drawStand(c, pose, c.spot.p, c.fc, sy, dy);
    shade(c, c.spot.p, 0.06);
  }
  function stepCrow(c, dt) {
    if (c.st === 'weg') { hideCrow(c); return; }
    if (c.st === 'warten') {
      hideCrow(c);
      if (vt >= c.arriveAt) { if (!c.dest) c.dest = spotFor(c); if (c.dest) arrive(c); else c.st = 'weg'; }
      return;
    }
    c.t += dt;
    if (c.st === 'flug') { stepFlight(c, dt); return; }
    if (c.st === 'hockt') {                                              // kurz in die Knie, dann los
      const k = sm(0, 0.18, c.t);
      drawStand(c, 'stand', c.spot.p, c.fc, 1 - 0.1 * k);
      if (c.spot.kind === 'boden') shade(c, c.spot.p, 0.06);
      if (c.t >= 0.2) { puff(c, c.spot.p); c.st = 'flug'; c.ft = 0; c.act = null; c.pup.reset(); stepFlight(c, 0); }   // gleich im selben Bild fliegen
      return;
    }
    // sitzt oder steht am Boden
    if (vt >= c.leaveAt && (!c.act || c.act.k !== 'kraechz' || c.act.t >= c.act.dur)) { flyOff(c); return; }
    if (!c.act || c.act.t >= c.act.dur) {
      if (vt >= c.stay && maybeMove(c)) return;
      if (c.answerAt && vt >= c.answerAt) { c.answerAt = 0; caw(c, 1 + ((Math.random() * 2) | 0)); }
      else if (c.st === 'sitzt') nextActPerch(c); else nextActGround(c);
    }
    if (c.st === 'sitzt') stepPerch(c, dt); else stepGround(c, dt);
  }

  function update(dt) {
    if (!allowed()) {
      if (ready) {
        if (__isNight() || P < 3.98 || !tree) stop();
        else if (crows.some(present)) { vt += dt; if (!ep) ep = { endAt: vt, leaving: false, side: 1 }; if (!ep.leaving) leaveAll(false); stepAll(dt); if (crows.every(c => c.st === 'weg')) ep = null; return; }
      }
      still = null; window.__kraehen = null; return;
    }
    init();
    if (reduceMotion) {                                                  // Winter: eine sitzt still im Baum
      for (const c of crows) if (c !== crows[0]) hideCrow(c);
      if (season !== 'winter') { hideCrow(crows[0]); still = null; return; }
      if (!still) { const s = planSpots(1, ['ast'])[0]; still = s || 'keiner'; }
      if (still !== 'keiner') drawStand(crows[0], 'stand', still.p, 1); else hideCrow(crows[0]);
      return;
    }
    still = null;
    vt += dt;
    if (!ep && vt >= next && canStart()) startEpisode();
    if (ep && !ep.leaving && vt >= ep.endAt) leaveAll(false);
    stepAll(dt);
    if (ep && crows.every(c => c.st === 'weg')) { ep = null; next = vt + (soon ? 1 : rr(120, 300)); soon = false; }
  }
  function stepAll(dt) {
    for (const c of crows) stepCrow(c, dt);
    window.__kraehen = crows.filter(c => c.st !== 'weg').map(c => { const o = c.mesh.visible ? c.mesh : c.pup.group, n = pv.copy(o.position).project(camera);
      return { i: c.i, st: c.st, wo: c.spot?.kind || c.dest?.kind, tun: c.act?.k, nx: +n.x.toFixed(3), ny: +n.y.toFixed(3) }; });
  }
  function frame() {
    const now = nowMs();
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    update(dt);
  }
  // alle sofort weg (neue Stufe, Häher-Start)
  function stop() {
    for (const c of crows) { c.st = 'weg'; c.spot = c.dest = null; c.act = null; hideCrow(c); }
    if (ep) next = vt + rr(30, 90);
    ep = null; still = null;
  }
  // aufgeschreckt: alle fliegen davon (der Baum wächst)
  function away() { if (ep && crows.some(present)) leaveAll(true); else if (ep) { for (const c of crows) if (c.st === 'warten') c.st = 'weg'; } }
  // die auf der Wiese fliegen auf (der Häher kommt): in den Baum, wenn Platz ist, sonst weg
  function groundAway() {
    for (const c of crows) {
      if (c.st === 'warten' && c.dest && c.dest.kind === 'boden') c.st = 'weg';
      if (c.st !== 'boden') continue;
      buildOcc();
      const s = findSpot('ast', others(c)) || (season !== 'winter' ? findSpot('krone', others(c)) : null);
      if (s) hopTo(c, s); else { c.leaveAt = vt; c.quick = true; }
    }
  }
  // Test (Baum-Test): gleich ein Trupp; sind schon welche da, fliegen sie weg und kommen gleich wieder
  function now() {
    if (!allowed() || reduceMotion) return false;
    init();
    if (ep) { leaveAll(true); soon = true; return true; }
    next = vt; return true;
  }
  // Prüfhilfe: warum findet sich (k)ein Platz? Zählt die Gründe für die besten Kandidaten einer Art
  window.__kraehenWarum = (kind = 'ast', m = 80) => {
    if (!allowed()) return 'nicht erlaubt';
    pickScale(); buildOcc();
    const c = (kind === 'ast' ? astCands() : kind === 'krone' ? kroneCands() : bodenCands()).sort((a, b) => b.score - a.score).slice(0, m);
    const r = { kandidaten: c.length, ausserhalb: 0, verdeckt: 0, ok: 0, beispiel: [] };
    for (const s of c) {
      if (!inView(s.p)) { r.ausserhalb++; continue; }
      const h = SAMP.map(q => { tmp2.copy(s.p).addScaledVector(STAGE_R, q[0] * SC).addScaledVector(STAGE_U, q[1] * SC); return hidden(tmp2); });
      if (visible(s.p, kind)) r.ok++; else { r.verdeckt++; if (r.beispiel.length < 5) r.beispiel.push(h.join('')); }
    }
    return r;
  };
  window.__kraehenSim = (sec) => { for (let k = 0; k < Math.round(sec / 0.05); k++) update(0.05); };
  // Standbilder: sofort n Krähen hinsetzen (wo: Liste aus 'ast' | 'krone' | 'boden'), fc: Blickrichtung (sonst zufällig)
  window.__kraehenSetzen = (o = {}) => {
    if (!allowed()) return 'nicht erlaubt';
    init(); stop();
    const spots = planSpots(o.n || 3, o.wo || null);
    spots.forEach((s, j) => { const c = crows[j]; Object.assign(c, { st: s.kind === 'boden' ? 'boden' : 'sitzt', spot: s, dest: null, fc: o.fc || (Math.random() < 0.5 ? -1 : 1), t: 1, act: { k: 'ruhe', t: 0, dur: 1e9 }, stay: Infinity, leaveAt: Infinity }); });
    ep = { endAt: Infinity, leaving: false, side: 1 };
    return window.__kraehenPlaetze;
  };
  return { frame, stop, away, groundAway, now, get active() { return !!ep; } };
})();
// ------------------------------------------------------------------ Erdhummeln (ab Stufe 2, Frühling und Sommer, 25.10.)
// Nutzer 25.10.: Erdhummeln besuchen die Blumen der Wiese – meist eine, manchmal zwei; ab Stufe 2, im Frühling und
// Sommer, nur tagsüber. Ablauf: fliegt leicht taumelnd von der Seite herein, besucht 4–8 Blüten nacheinander (kurz davor
// in der Luft stehen, landen, 1–3 s trinken oder krabbeln, die Blüte nickt unter ihr), fliegt dann zur Seite aus dem Bild.
// Blüten: Löwenzahn, blaue Blümchen, Moosglöckchen (am liebsten), Gänseblümchen, Hahnenfuß – nie Pusteblumen, Gräser oder
// Pilze, nie eine Blüte, auf der schon jemand sitzt oder landen will (FLOWER_BUSY: Falter, die andere Hummel).
// Bilder (Recraft nano_banana_pro, Stilvorlage Häher/Meise/Falter): Flugkörper ohne Flügel + eigene Flügel-Ebene (zwei
// Lagen, eine hinter, eine vor dem Körper, flirren in jedem Bild zwischen zwei Stellungen), sitzt/trinkt, krabbelt.
// Feste Bildebenen wie alle Tiere; nach links schauend gespiegelt.
// Größe: Körper 0,045 lang (halb so groß wie eine Löwenzahnblüte), immer gleich – Nutzer 25.10.: nicht vergrößern, „der
// Marienkäfer wird ja auch nicht größer“; Nutzer 28.10.: „ja die hummel muss auch kleiner“ (wie die Schmetterlinge, etwa wie
// in echt im Verhältnis zu den Vögeln: Meise 0,26 = 14 cm, Erdhummel ~1,8 cm → 0,033, etwas größer) – vorher 0,09.
// Umgesetzt über die Größe je Hummel b.sc = SIZE_K (Bild, Schweben, Taumeln, Krabbeln rechnen damit); Tiefe vor der Blüte
// und Tempo bleiben wie bisher. Auf großen Stufen (Kamera weiter weg) ist sie kleiner im Bild.
// Die Blüte nickt: Wiesen-Shader (uNodP1/uNodP2 = Lage von bis zu vier Blüten, uNodA = Stärke), erkannt an der Lage der
// Karte (aOff) statt an gl_InstanceID (geht auch mit WebGL1); dieselbe Rechnung in bloomAt, damit die Hummel mitgeht.
// Fliegt sie ab, federt die Blüte nach.
// Der Baum entscheidet selbst, wann eine kommt: erster Besuch 15–40 s nachdem der Baum läuft, danach 1–3 min Pause. Die
// Uhr läuft nur, solange der Baum läuft. „Weniger Bewegung“: keine. Bilder werden erst beim ersten Besuch geladen.
// Herein und hinaus geht es bis knapp hinter den Bildrand (edgeStageX in modul.py, je nach Kamera); ist der Weg dadurch
// länger, fliegt sie entsprechend schneller.
// Prüfhilfen: window.__hummeln (Zustände, Bildschirmlage), window.__hummelSim(s) (vorspulen ohne Zeichnen),
// window.__hummelSetzen({ n }) (sitzen sofort auf Blüten, für Standbilder).
const hummelFx = (() => {
  const META = {"flug":{"w":785,"h":618,"mitte":[340,267],"schulter":[375,100],"kern":571},"fluegel":{"w":456,"h":380,"wurzel":[452,332]},"sitz":{"w":825,"h":570,"fuesse":[430,548],"kern":608},"krabbelt":{"w":843,"h":558,"fuesse":[430,530],"kern":609},"kern":590};
  const LEN = 0.09, TONE = 0.94, SIZE_K = 0.5;           // Bildmaß bei Größe 1; gezeichnet LEN · SIZE_K = 0,045
  const BEE = { 8: 0.55, 9: 0.45, 10: 1, 11: 1, 13: 1 };          // Gänseblümchen, Hahnenfuß, blau, Moosglöckchen, Löwenzahn
  const BLOOM = { 8: [0.61, 0.74], 9: [0.58, 0.82], 10: [0.49, 0.70], 11: [0.69, 0.66], 13: [0.62, 0.69] };   // wie beim Falter
  const NOD = 0.09;                                       // so weit neigt sich die Blüte (Anteil der Kartenhöhe am oberen Ende)
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rr = (a, b) => a + Math.random() * (b - a);
  const fract = (x) => x - Math.floor(x);
  const toSt = (p) => ({ x: p.dot(STAGE_R), y: p.y, z: p.dot(STAGE_D) });
  const tmp = new V(), tmp2 = new V(), camR = new V(), qz = new THREE.Quaternion(), zN = new V(0, 0, 1);
  const allowed = () => !!tree && !!rad && P >= 1.98 && !__isNight() && !reduceMotion && (season === 'fruehling' || season === 'sommer') && MEADOW_FLOWERS.length > 0;

  // ---- Blüten (wie beim Falter, dazu das Nicken)
  function flowerOn(f) {
    const u = groundUniforms.uMeadowU.value, sel = u >= fract(f.ph * 5.31) * 0.9 + 0.05;
    const s4 = sel ? groundUniforms.uSeasonB.value : groundUniforms.uSeason.value;
    return f.mask[0] * s4.x + f.mask[1] * s4.y + f.mask[2] * s4.z + f.mask[3] * s4.w;
  }
  function bloomAt(f, out, nod = 0) {
    const [u, v] = BLOOM[f.cell], s = f.w * flowerOn(f);
    camR.set(camera.matrixWorld.elements[0], 0, camera.matrixWorld.elements[2]); camR.x += 1e-5; camR.normalize();
    const tt = leafUniforms.uTime.value, wnd = leafUniforms.uWind.value;
    const sw = (Math.sin(tt * 1.4 + f.ph + f.x * 0.5) * 0.07 + Math.sin(tt * 2.3 + f.ph * 1.7) * 0.025) * wnd * v * v * Math.abs(s);
    return out.set(f.x, -0.015 + v * s - nod * v * v * Math.abs(s), f.z).addScaledVector(camR, (u - 0.5) * s).add(tmp.set(sw, 0, sw * 0.5));
  }
  function trunkR(y) { const r0 = rad && rad.length ? rad[0] : 0; return r0 * (1 + Math.exp(-Math.max(y, 0) * 2.4) * sm(0.025, 0.12, r0) * 1.95) * 1.13; }
  function segDist(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, t = Math.min(1, Math.max(0, -(ax * dx + az * dz) / Math.max(1e-9, dx * dx + dz * dz)));
    return Math.hypot(ax + dx * t, az + dz * t);
  }
  // nächste Blüte: blüht gerade, frei, gut im Bild, vor dem Stamm; vom Platz from aus in der Nähe (sonst lieber nah am Baum)
  function pickFlower(from) {
    const cand = [], p = new V();
    for (const f of MEADOW_FLOWERS) {
      const w0 = BEE[f.cell];
      if (!w0 || FLOWER_BUSY.has(f) || flowerOn(f) < 0.99) continue;
      bloomAt(f, p); const st = toSt(p);
      if (st.z < 0.1) continue;
      const tr = trunkR(p.y);
      if (Math.hypot(p.x, p.z) < tr + 0.15) continue;                                       // nicht am oder im Stammfuß
      if (segDist(p.x, p.z, camera.position.x, camera.position.z) < tr + 0.08) continue;      // nicht hinter dem Stamm
      const n = tmp.copy(p).project(camera);
      if (Math.abs(n.x) > 0.8 || n.y < -0.82 || n.y > 0.6 || n.z > 1) continue;
      if (n.x > 0.5 && n.y < -0.38) continue;                                                  // unten rechts: Knopf „Baum groß“
      let w;
      if (from) { const d = p.distanceTo(from); if (d < 0.18 || d > 1.8) continue; w = w0 / (0.3 + d); }
      else w = w0 / (0.4 + 0.3 * Math.hypot(st.x, st.z));
      cand.push({ f, w });
    }
    if (!cand.length) return null;
    let r = Math.random() * cand.reduce((a, c) => a + c.w, 0);
    for (const c of cand) { r -= c.w; if (r <= 0) return c.f; }
    return cand[cand.length - 1].f;
  }

  // ---- Figuren (erst beim ersten Besuch)
  let tex = null, ready = false;
  const bees = [];
  const nodP1 = groundUniforms.uNodP1.value, nodP2 = groundUniforms.uNodP2.value, nodA = groundUniforms.uNodA.value;   // Wiesen-Shader
  function init() {
    if (ready) return; ready = true;
    const loader = new THREE.TextureLoader();
    const ldT = (n) => { const t = loader.load(__img(n)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    tex = { flug: ldT('9de47072b6.webp'), fluegel: ldT('b98e19adf5.webp'), sitz: ldT('adee405bfd.webp'), krabbelt: ldT('11a2eea9e6.webp') };
    const mat = (map, op = 1) => { const m = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: op, alphaTest: op < 1 ? 0.01 : 0.05, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }); m.color.setScalar(TONE); return m; };
    const plane = (m, order) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); o.renderOrder = order; o.frustumCulled = false; o.visible = false; return o; };
    for (let i = 0; i < 2; i++) {
      const body = plane(mat(tex.flug), 26); scene.add(body);
      const wings = [0, 1].map(j => { const piv = new THREE.Group(), w = plane(mat(tex.fluegel, 0.34), j ? 27 : 25); w.visible = true; piv.add(w); piv.visible = false; scene.add(piv); return { piv, w }; });
      bees.push({ i, body, wings, st: 'weg', f: null, sc: SIZE_K, far: 1, fc: 1, side: 1, path: null, d: 0, fk: '', t: 0, dur: 0, left: 0, startAt: 0, pose: 'sitz', crawl: 0, seed: Math.random() * 6.3,
        nod: { f: null, n: 0, v: 0, aim: 0 }, nodOld: { f: null, n: 0, v: 0, aim: 0 } });
    }
  }

  // ---- Zeichnen
  const K0 = LEN / META.kern;                             // Welt je Bildpunkt (bei Größe 1)
  // Bild key so legen, dass der Ankerpunkt (Bild-px) auf p liegt; fc = +1 Kopf rechts, tilt = Neigung (Nase hoch > 0)
  function drawImg(b, key, p, anchor, fc, tilt = 0) {
    const m = META[key], k = K0 * b.sc, mesh = b.body;
    if (mesh.material.map !== tex[key]) mesh.material.map = tex[key];
    const ax = m[anchor], a = tilt * fc, c = Math.cos(a), s = Math.sin(a);
    const ox = fc * (m.w / 2 - ax[0]) * k, oy = (ax[1] - m.h / 2) * k;
    mesh.position.copy(p).addScaledVector(STAGE_R, ox * c - oy * s).addScaledVector(STAGE_U, ox * s + oy * c);
    mesh.quaternion.copy(STAGE_Q).multiply(qz.setFromAxisAngle(zN, a)); mesh.scale.set(fc * m.w * k, m.h * k, 1);
    mesh.visible = true;
    return a;
  }
  // fliegend: Körper (Mitte auf p) und die beiden Flügel-Lagen an der Schulter; sie flirren in jedem Bild neu
  function drawFly(b, p, tilt) {
    const a = drawImg(b, 'flug', p, 'mitte', b.fc, tilt), m = META.flug, g = META.fluegel, k = K0 * b.sc, c = Math.cos(a), s = Math.sin(a);
    const sx = b.fc * (m.schulter[0] - m.mitte[0]) * k, sy = (m.mitte[1] - m.schulter[1]) * k;
    for (let j = 0; j < 2; j++) {
      const { piv, w } = b.wings[j];
      piv.position.copy(p).addScaledVector(STAGE_R, sx * c - sy * s).addScaledVector(STAGE_U, sx * s + sy * c).addScaledVector(STAGE_D, j ? 0.004 : -0.004);
      const fl = j ? rr(0.05, 0.42) : rr(-0.38, 0.02);   // vordere Lage weiter nach hinten, hintere steiler – je Bild neu
      piv.quaternion.copy(STAGE_Q).multiply(qz.setFromAxisAngle(zN, a + fl * b.fc));
      w.position.set(b.fc * (g.w / 2 - g.wurzel[0]) * k, (g.wurzel[1] - g.h / 2) * k, 0); w.scale.set(b.fc * g.w * k, g.h * k, 1);
      piv.visible = true;
    }
  }
  function drawSit(b, p, pose) {
    drawImg(b, window.__hummelPose || pose, p, 'fuesse', b.fc, 0);
    for (const w of b.wings) w.piv.visible = false;
  }
  function hideBee(b) { b.body.visible = false; for (const w of b.wings) w.piv.visible = false; }
  // Größe fest (b.sc = SIZE_K, alle Abstände rechnen damit); b.px = Länge im Bild an der Blüte, nur für die Prüfhilfe
  function sizeFor(b, p) {
    const h = renderer.domElement.clientHeight || H();
    const pxU = h / 2 * camera.projectionMatrix.elements[5] / Math.max(0.5, camera.position.distanceTo(p));
    b.sc = SIZE_K; b.px = +(LEN * SIZE_K * pxU).toFixed(1);
  }

  // ---- Wege (Catmull-Rom nach Bogenlänge; nie durch den Stamm)
  function makePath(pts) {
    const Pn = pts.map(p => p.clone()), N = 20 * (Pn.length - 1), samples = [], len = [0];
    const keep = (v) => { const d = Math.hypot(v.x, v.z), need = trunkR(v.y) + 0.2; if (d < need) { if (d < 1e-4) v.z = need; else { v.x *= need / d; v.z *= need / d; } } return v; };
    const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return new V().addScaledVector(a, -0.5 * t3 + t2 - 0.5 * t).addScaledVector(b, 1.5 * t3 - 2.5 * t2 + 1).addScaledVector(c, -1.5 * t3 + 2 * t2 + 0.5 * t).addScaledVector(d, 0.5 * t3 - 0.5 * t2); };
    for (let i = 0; i <= N; i++) {
      const g = i / N * (Pn.length - 1), k = Math.min(Pn.length - 2, Math.floor(g)), t = g - k;
      let s = cr(Pn[Math.max(0, k - 1)], Pn[k], Pn[k + 1], Pn[Math.min(Pn.length - 1, k + 2)], t);
      if (i && i < N) s = keep(s);
      if (i) len.push(len[i - 1] + s.distanceTo(samples[i - 1])); samples.push(s);
    }
    return { total: len[N], at(d, out) { d = Math.min(len[N], Math.max(0, d)); let i = 1; while (i < N && len[i] < d) i++; const u = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]); return out.copy(samples[i - 1]).lerp(samples[i], u); } };
  }
  const W3 = (x, y, z) => stageToWorld(x, y, z);
  const hoverAt = (b, f, out) => bloomAt(f, out, b.nod.f === f ? b.nod.n : 0).add(tmp.set(0, 0.07 * b.sc, 0)).addScaledVector(STAGE_D, 0.03);
  const restAt = (b, out) => bloomAt(b.f, out, b.nod.n).addScaledVector(STAGE_D, 0.035).addScaledVector(STAGE_R, b.crawl * b.sc);

  // ---- Ablauf je Hummel
  function claim(b, f) { if (b.f && b.f !== f) FLOWER_BUSY.delete(b.f); b.f = f; if (f) FLOWER_BUSY.add(f); }
  function enter(b) {                                    // von der Seite herein zur ersten Blüte
    const f = pickFlower(null);
    if (!f) { b.st = 'weg'; return; }
    claim(b, f); const L = bloomAt(f, new V()); sizeFor(b, L);
    const end = hoverAt(b, f, new V()), st = toSt(end);
    const y0 = st.y + rr(0.5, 1.0), z0 = st.z + rr(-0.2, 0.6), x0 = edgeStageX(b.side, y0, z0, 6.4);
    const start = W3(x0, y0, z0); b.far = Math.min(3, Math.abs(x0) / 6.4);   // weiter Weg herein: schneller (gleich schnell im Bild)
    const mid = W3(st.x + b.side * rr(1.0, 1.8), st.y + rr(0.25, 0.5), st.z + rr(0.05, 0.35));
    const near = end.clone().add(tmp.set(0, 0.06 * b.sc, 0)).addScaledVector(STAGE_R, b.side * 0.12 * b.sc);
    b.path = makePath([start, mid, near, end]); b.d = 0; b.fk = 'an'; b.st = 'flug'; b.t = 0; b.fc = -b.side;
  }
  function hopNext(b) {                                  // abheben und zur nächsten Blüte (oder fort)
    const from = restAt(b, new V());
    letGo(b);
    const f = b.left > 0 ? pickFlower(from) : null;
    if (!f) { leave(b, from); return; }
    claim(b, f);
    const end = hoverAt(b, f, new V()), up = 0.1 * b.sc + rr(0.04, 0.16) * Math.sqrt(b.sc);
    const m1 = from.clone().lerp(end, 0.35).add(tmp.set(0, up, 0)).addScaledVector(STAGE_D, rr(-0.05, 0.12));
    const m2 = from.clone().lerp(end, 0.75).add(tmp.set(0, up * 0.6, 0));
    b.path = makePath([from.clone().add(tmp.set(0, 0.03 * b.sc, 0)), m1, m2, end]); b.d = 0; b.fk = 'hop'; b.st = 'flug'; b.t = 0;
  }
  function leave(b, from) {                              // hinauf und zur Seite aus dem Bild
    claim(b, null);
    const st = toSt(from), side = st.x >= 0 ? 1 : -1;
    const yE = st.y + rr(1.0, 1.6), zE = st.z + rr(0.2, 0.7), xE = edgeStageX(side, yE, zE, 6.6);
    const mid = W3(st.x + side * rr(1.2, 2), st.y + rr(0.5, 0.9), st.z + rr(0, 0.4)), end = W3(xE, yE, zE); b.far = Math.min(3, Math.abs(xE) / 6.6);
    b.path = makePath([from.clone(), from.clone().add(tmp.set(0, 0.15 * b.sc, 0)), mid, end]); b.d = 0; b.fk = 'ab'; b.st = 'flug'; b.t = 0;
  }
  // Blüte loslassen: sie federt zurück (alte Blüte), die neue fängt bei null an
  function letGo(b) { if (b.nod.f) { Object.assign(b.nodOld, b.nod); b.nodOld.aim = 0; } b.nod.f = null; b.nod.n = b.nod.v = 0; b.nod.aim = 0; }
  function stepNod(o, dt) {
    if (!o.f) return;
    const acc = 90 * (o.aim - o.n) - 9 * o.v;            // Feder: leicht unterdämpft, federt nach
    o.v += acc * dt; o.n += o.v * dt;
    if (!o.aim && Math.abs(o.n) < 0.002 && Math.abs(o.v) < 0.02) { o.f = null; o.n = o.v = 0; }
  }
  const fp = new V(), fq = new V();
  function stepFlight(b, dt) {
    const sp = b.fk === 'ab' ? 1.6 * b.far : b.fk === 'an' ? 1.4 * b.far : 0.8;
    const rem = b.path.total - b.d;
    const F = b.fk === 'hop' ? 1 : b.far;                 // weiter Weg vom/zum Bildrand: auch länger beschleunigen/bremsen
    const v = b.fk === 'ab' ? sp * (sm(-0.1, 0.5 * F, b.d) * 0.8 + 0.2) : sp * (sm(-0.02, 0.35 * F, rem) * 0.85 + 0.15);
    b.d += v * dt;
    if (b.d >= b.path.total) {
      if (b.fk === 'ab') { b.st = 'weg'; hideBee(b); return; }
      b.st = 'schwebt'; b.t = 0; b.dur = rr(0.25, 0.6); return;
    }
    b.path.at(b.d, fp); b.path.at(Math.min(b.path.total, b.d + 0.04), fq);
    const dx = toSt(fq).x - toSt(fp).x, dy = fq.y - fp.y;
    if (Math.abs(dx) > 0.002) b.fc = dx > 0 ? 1 : -1;
    // taumeln: quer und auf und ab, kleiner kurz vor dem Ziel
    const calm = b.fk === 'ab' ? 1 : sm(0, 0.25 * b.sc, rem), A = b.sc * calm;
    fp.addScaledVector(STAGE_R, 0.022 * A * Math.sin(b.t * 6.3 + b.seed)).add(tmp.set(0, 0.016 * A * Math.sin(b.t * 9.7 + b.seed * 1.7), 0));
    const tilt = Math.max(-0.35, Math.min(0.35, Math.atan2(dy, Math.max(0.01, Math.abs(dx))) * 0.5)) + 0.06 * Math.sin(b.t * 7.1 + b.seed);
    drawFly(b, fp, tilt);
  }
  function stepBee(b, dt) {
    if (b.st === 'weg') { hideBee(b); return; }
    if (b.st === 'warten') { hideBee(b); if (vt >= b.startAt) enter(b); return; }
    b.t += dt;
    if (b.st === 'flug') { stepFlight(b, dt); return; }
    if (b.st === 'schwebt') {                            // kurz vor der Blüte in der Luft stehen, dann landen
      if (!b.f || flowerOn(b.f) < 0.99) { hopNext(b); return; }
      hoverAt(b, b.f, fp).addScaledVector(STAGE_R, 0.012 * b.sc * Math.sin(b.t * 9 + b.seed)).add(tmp.set(0, 0.01 * b.sc * Math.sin(b.t * 13 + b.seed), 0));
      drawFly(b, fp, 0.12);
      if (b.t >= b.dur) {
        b.st = 'sitzt'; b.t = 0; b.dur = rr(1.2, 3.2); b.left--; b.crawl = 0; b.pose = 'sitz';
        if (b.nodOld.f === b.f) b.nodOld.f = null;
        Object.assign(b.nod, { f: b.f, n: 0, v: -0.5, aim: NOD });        // setzt sich: die Blüte gibt nach
        drawSit(b, restAt(b, fp), 'sitz');
      }
      return;
    }
    if (b.st === 'sitzt') {                              // trinkt, krabbelt ein wenig, dreht sich manchmal
      if (!b.f || flowerOn(b.f) < 0.99 || b.t >= b.dur) { hopNext(b); return; }
      const k = b.t / b.dur;
      if (k > 0.45 && k < 0.75) { b.pose = 'krabbelt'; b.crawl = 0.012 * Math.sin((k - 0.45) / 0.3 * Math.PI) * b.fc; }
      else { if (b.pose === 'krabbelt' && Math.random() < 0.5) b.fc = -b.fc; b.pose = 'sitz'; b.crawl = 0; }
      drawSit(b, restAt(b, fp), b.pose);
    }
  }

  // ---- Besuche
  let vt = 0, last = 0, next = rr(15, 40), visiting = false, soon = false;
  function canStart() { return !trans && !moveIn && !jayFx.active && !visitFx.active && !seqPlayer.active(); }
  function startVisit() {
    init();
    const n = Math.random() < 0.3 ? 2 : 1, side = Math.random() < 0.5 ? -1 : 1;
    for (let j = 0; j < 2; j++) {
      const b = bees[j];
      if (j >= n) { b.st = 'weg'; continue; }
      Object.assign(b, { st: 'warten', startAt: vt + (j ? rr(4, 14) : 0), side: j ? -side : side, left: 4 + ((Math.random() * 5) | 0), f: null, seed: Math.random() * 6.3 });
    }
    visiting = true;
  }
  function stepAll(dt) {
    for (const b of bees) { stepBee(b, dt); stepNod(b.nod, dt); stepNod(b.nodOld, dt); }
    // Nicken an den Wiesen-Shader (bis zu vier Blüten: je Hummel die jetzige und die, die noch nachfedert)
    const ps = [], as = [];
    for (const b of bees) for (const o of [b.nod, b.nodOld]) { ps.push(o.f ? o.f.x : 1e3, o.f ? o.f.z : 1e3); as.push(o.f ? o.n : 0); }
    nodP1.set(ps[0], ps[1], ps[2], ps[3]); nodP2.set(ps[4], ps[5], ps[6], ps[7]); nodA.set(as[0], as[1], as[2], as[3]);
    window.__hummeln = bees.filter(b => b.st !== 'weg').map(b => { const n = tmp2.copy(b.body.position).project(camera); return { i: b.i, st: b.st, blume: b.f ? b.f.cell : null, noch: b.left, sc: +b.sc.toFixed(2), px: b.px, nx: +n.x.toFixed(3), ny: +n.y.toFixed(3) }; });
  }
  function update(dt) {
    if (!allowed()) {
      if (ready && bees.some(b => b.st !== 'weg')) {
        if (__isNight() || P < 1.98 || reduceMotion) stop();
        else { vt += dt; away(); stepAll(dt); if (bees.every(b => b.st === 'weg')) visiting = false; return; }   // Jahreszeit vorbei: davon
      }
      window.__hummeln = null; return;
    }
    vt += dt;
    if (!visiting && vt >= next && canStart()) startVisit();
    if (!ready) return;
    stepAll(dt);
    if (visiting && bees.every(b => b.st === 'weg')) { visiting = false; next = vt + (soon ? 1 : rr(60, 180)); soon = false; }
  }
  function frame() {
    const now = nowMs();
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    update(dt);
  }
  // alle sofort weg (neue Stufe, Häher-Start)
  function stop() {
    for (const b of bees) { claim(b, null); b.st = 'weg'; b.nod.f = b.nodOld.f = null; hideBee(b); }
    nodA.set(0, 0, 0, 0);
    if (visiting) next = vt + rr(20, 60);
    visiting = false;
  }
  // gleich weiterfliegen (der Baum wächst, der Häher kommt): von da, wo sie gerade sind, zur Seite hinaus
  function away() {
    for (const b of bees) {
      if (b.st === 'warten') { b.st = 'weg'; continue; }
      if (b.st === 'weg' || (b.st === 'flug' && b.fk === 'ab')) continue;
      const from = b.st === 'sitzt' ? restAt(b, new V()) : b.body.position.clone();
      letGo(b); b.left = 0; leave(b, from);
    }
  }
  // Test (Baum-Test): gleich eine Hummel; sind schon welche da, fliegen sie fort und es kommt gleich die nächste
  function now() {
    if (!allowed()) return false;
    if (visiting) { away(); soon = true; return true; }
    next = vt; return true;
  }
  window.__hummelSim = (sec) => { for (let k = 0; k < Math.round(sec / 0.05); k++) update(0.05); };
  window.__hummelSetzen = (o = {}) => {
    if (!allowed()) return 'nicht erlaubt';
    init(); stop();
    for (let j = 0; j < Math.min(2, o.n || 1); j++) {
      const b = bees[j], f = pickFlower(null); if (!f) break;
      claim(b, f); sizeFor(b, bloomAt(f, new V()));
      Object.assign(b, { st: 'sitzt', t: 0, dur: 1e9, left: 0, pose: o.pose || 'sitz', crawl: 0, fc: o.fc || (Math.random() < 0.5 ? -1 : 1) });
      Object.assign(b.nod, { f, n: NOD, v: 0, aim: NOD });
    }
    visiting = true;
    stepAll(0);
    return window.__hummeln;
  };
  return { frame, stop, away, now, get active() { return visiting; } };
})();
// ------------------------------------------------------------------ Tagpfauenauge und Bläulinge (26.10.)
// Nutzer 26.10.: zwei weitere Schmetterlingsarten als Besucher der Wiese (zusätzlich zum Zitronenfalter).
//  • Tagpfauenauge ab Stufe 3, Frühling und Sommer: besucht 1–3 Plätze – Blüten (am liebsten Löwenzahn, dazu blaue
//    Blümchen, Moosglöckchen, Gänseblümchen, Hahnenfuß) oder ein Sonnenbad am Stamm. Auf der Blüte sitzt es erst
//    zugeklappt (gemaltes Seitenbild, fast schwarze Unterseite), dann klappt es die Flügel langsam auf – es dreht sich
//    dabei etwas zur Sonne, man sieht die Augenflecken – und wieder zu. Am Stamm liegt es mit ausgebreiteten Flügeln auf
//    der Rinde und klappt ab und zu zusammen. Manchmal (etwa jeder vierte Besuch) kommen zwei: sie taumeln umeinander
//    herein und schrauben sich zusammen hoch (Balzflug), dann fliegt eines davon, das andere bleibt eine Weile.
//  • Hauhechel-Bläulinge ab Stufe 2, im Sommer: zu zweit oder dritt, flattern tief über die Wiese, die ersten beiden oft
//    umeinander (kurze Jagd), setzen sich auf Blüten und Grashalme, sitzen mit halb offenen Flügeln (das Blau ist zu
//    sehen), hüpfen ein paar Mal weiter und fliegen davon.
// Nur tagsüber, ohne Ton, nicht bei „Weniger Bewegung“; nie auf einer Blüte, auf der schon jemand sitzt oder landen will
// (FLOWER_BUSY: Zitronenfalter, Hummeln, die anderen Schmetterlinge).
// Größe fest (Nutzer 26.10.: „alle drei fest“ – auch der Zitronenfalter wird nicht mehr größer gezeichnet): Spannweite
// Tagpfauenauge 0,14 (wie der Zitronenfalter), Bläuling 0,088. Auf großen Stufen sind sie darum kleiner im Bild.
// Nutzer 28.10.: „der schmetterling ist größer als die meisen … fast größer als der buntspecht … mach den kleiner, das
// muss schon passen“ – vorher 0,42 / 0,26 (so groß wie der Specht lang ist). Jetzt etwa wie in echt im Verhältnis zu den
// Vögeln (Meise 0,26 = 14 cm: Pfauenauge 5–6 cm → 0,10, Bläuling ~3 cm → 0,055), etwas größer, damit man sie sieht
// (erst 0,12 / 0,075; Nutzer: „ein ganz kleines bisschen größer können die schmetterlinge ruhig sein“).
// Figur: echte Flügelflächen mit zwei Seiten – oben das Bild von oben, unten die Bauchansicht (gespiegelt und auf den
// Umriss der Oberseite gelegt) –, die um die Körperachse schlagen; so stimmt der Schmetterling aus jedem Blickwinkel.
// Körper als Kreuz aus zwei Flächen (von oben mit Fühlern, von der Seite ohne). Zugeklappt auf der Blüte: gemaltes
// Seitenbild wie beim Zitronenfalter (harter Schnitt zur Figur, Körper an derselben Stelle).
// Der Baum entscheidet selbst, wann sie kommen: Tagpfauenauge erster Besuch 20–60 s nachdem der Baum läuft, Bläulinge
// 30–80 s, danach je 2–4 min Pause; die Uhr läuft nur, solange der Baum läuft. Ein Besuch beginnt nur, wenn höchstens ein
// anderer Besucher da ist (Zitronenfalter, Hummel, Krähen, Häher-Besuch, die andere Art) – sonst wartet er kurz.
// Herein und hinaus geht es bis knapp hinter den Bildrand (edgeStageX); ist der Weg dadurch länger, fliegen sie schneller.
// Prüfhilfen: window.__pfau / window.__blau (Zustände, Bildschirmlage, Spannweite in px), window.__pfauSim(s) /
// __blauSim(s) (vorspulen ohne Zeichnen), window.__pfauSetzen({ wo: 'bluete'|'stamm', phase: 'zu'|'auf', n }) /
// __blauSetzen(…) (sitzen sofort, für Standbilder).
const schmetterlingFx = (() => {
  const TONE = 0.94;
  // Baum zur Stufe gezeichnet? (Stufenwechsel per Test: P ändert sich sofort, Äste und Nistkasten erst im nächsten Bild)
  let stableFrames = 0, frameNo = 0, stableKey = '';
  const treeNow = () => !!tree && Tshown === T && Math.abs(T - PtoT(P)) < 1e-6;
  const settled = () => stableFrames >= 3 && treeNow() && stableKey === T + '|' + P;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rr = (a, b) => a + Math.random() * (b - a);
  const fract = (x) => x - Math.floor(x);
  const mix = (a, b, t) => a + (b - a) * t;
  const toSt = (p) => ({ x: p.dot(STAGE_R), y: p.y, z: p.dot(STAGE_D) });
  const W3 = (x, y, z) => stageToWorld(x, y, z);
  const tmp = new V(), tmp2 = new V(), camR = new V();
  const bx = new V(), by = new V(), bz = new V(), hv = new V();
  const mtx = new THREE.Matrix4(), qY = new THREE.Quaternion(), qP = new THREE.Quaternion(), yA = new V(0, 1, 0), zA = new V(0, 0, 1);

  // ---- Wiese: Blüten wie beim Zitronenfalter und den Hummeln (Lage der Blüte bzw. Ähre je Zelle im Wiesen-Atlas)
  const BLOOM = { 6: [0.72, 0.87], 7: [0.65, 0.79], 8: [0.61, 0.74], 9: [0.58, 0.82], 10: [0.49, 0.70], 11: [0.69, 0.66], 12: [0.64, 0.82], 13: [0.62, 0.69] };
  function flowerOn(f) {
    const u = groundUniforms.uMeadowU.value, sel = u >= fract(f.ph * 5.31) * 0.9 + 0.05;
    const s4 = sel ? groundUniforms.uSeasonB.value : groundUniforms.uSeason.value;
    return f.mask[0] * s4.x + f.mask[1] * s4.y + f.mask[2] * s4.z + f.mask[3] * s4.w;
  }
  function bloomAt(f, out) {                 // mit dem Wind wie im Wiesen-Shader
    const [u, v] = BLOOM[f.cell], s = f.w * flowerOn(f);
    camR.set(camera.matrixWorld.elements[0], 0, camera.matrixWorld.elements[2]); camR.x += 1e-5; camR.normalize();
    const tt = leafUniforms.uTime.value, wnd = leafUniforms.uWind.value;
    const sw = (Math.sin(tt * 1.4 + f.ph + f.x * 0.5) * 0.07 + Math.sin(tt * 2.3 + f.ph * 1.7) * 0.025) * wnd * v * v * Math.abs(s);
    return out.set(f.x, -0.015 + v * s, f.z).addScaledVector(camR, (u - 0.5) * s).add(tmp.set(sw, 0, sw * 0.5));
  }
  function trunkR(y) { const r0 = rad && rad.length ? rad[0] : 0; return r0 * (1 + Math.exp(-Math.max(y, 0) * 2.4) * sm(0.025, 0.12, r0) * 1.95) * 1.13; }
  function segDist(ax, az, cx, cz) {
    const dx = cx - ax, dz = cz - az, t = Math.min(1, Math.max(0, -(ax * dx + az * dz) / Math.max(1e-9, dx * dx + dz * dz)));
    return Math.hypot(ax + dx * t, az + dz * t);
  }
  function inView(p, mx = 0.8, ylo = -0.82, yhi = 0.6) {
    const n = tmp.copy(p).project(camera);
    if (Math.abs(n.x) > mx || n.y < ylo || n.y > yhi || n.z > 1) return false;
    return !(n.x > 0.5 && n.y < -0.38);                         // unten rechts liegt der Knopf „Baum groß“
  }
  // Blüte: blüht gerade, frei, gut im Bild, vor dem Stamm; von from aus in Reichweite c.HOP (sonst lieber nah am Baum)
  function pickFlower(c, from) {
    const cand = [], p = new V(), q = new V();
    // belegte Blüten im Bild (Bildpunkte): nicht gleich daneben oder davor/dahinter landen
    const hpx = (renderer.domElement.clientHeight || H()) / 2, wpx = (renderer.domElement.clientWidth || W()) / 2, busy = [];
    for (const o of FLOWER_BUSY) { if (!BLOOM[o.cell]) continue; bloomAt(o, q); const n = q.project(camera); busy.push([n.x * wpx, n.y * hpx]); }
    for (const f of MEADOW_FLOWERS) {
      const w0 = c.FLOWERS[f.cell];
      if (!w0 || FLOWER_BUSY.has(f) || flowerOn(f) < 0.99) continue;
      if (busy.length) {
        bloomAt(f, q); const pxU = hpx * camera.projectionMatrix.elements[5] / Math.max(0.5, camera.position.distanceTo(q));
        const n = q.project(camera), minPx = (c.SPAN + 0.3) * pxU * 0.8 + 6;
        if (busy.some(([bx2, by2]) => Math.hypot(n.x * wpx - bx2, n.y * hpx - by2) < minPx)) continue;
      }
      bloomAt(f, p); const st = toSt(p);
      if (st.z < 0.1) continue;
      const tr = trunkR(p.y);
      if (Math.hypot(p.x, p.z) < tr + 0.12 + c.SPAN * 0.5) continue;                       // nicht am oder im Stammfuß
      if (segDist(p.x, p.z, camera.position.x, camera.position.z) < tr + 0.08) continue;      // nicht hinter dem Stamm
      if (!inView(p)) continue;
      let w;
      if (from) { const d = p.distanceTo(from); if (d < c.HOP[0] || d > c.HOP[1]) continue; w = w0 / (0.3 + d); }
      else w = w0 / (0.4 + 0.3 * Math.hypot(st.x, st.z));
      cand.push({ f, w });
    }
    if (!cand.length) return null;
    let r = Math.random() * cand.reduce((a, q) => a + q.w, 0);
    for (const q of cand) { r -= q.w; if (r <= 0) return q.f; }
    return cand[cand.length - 1].f;
  }

  // ---- Rinde (Sonnenbad des Tagpfauenauges): Stamm = Weg mit den meisten Nachkommen (wie beim Marienkäfer)
  let tPath = null, tPathOf = null;
  function trunkPath() {
    if (tPath && tPathOf === tree) return tPath;
    const n = tree.parent.length, kids = {};
    for (let i = 1; i < n; i++) (kids[tree.parent[i]] = kids[tree.parent[i]] || []).push(i);
    const cnt = new Int32Array(n).fill(1);
    for (let i = n - 1; i > 0; i--) cnt[tree.parent[i]] += cnt[i];
    const out = []; let i = 0;
    for (let k = 0; k < 400; k++) { const ch = kids[i]; if (!ch || !ch.length) break; const j = ch.reduce((a, b) => cnt[b] > cnt[a] ? b : a); out.push(j); i = j; }
    tPath = out; tPathOf = tree; return out;
  }
  // Verdeckt ein Ast den Platz? Kleinster Abstand zwischen den Sichtstrahlen (Kamera → Punkte) und allen gewachsenen
  // Aststücken (Röhren), mit etwas Rand. Der Stamm hinter dem Falter stört nicht: die Strahlen enden vor der Rinde.
  const sA = new V(), sB = new V(), d1 = new V(), d2 = new V(), r0v = new V(), segE = new V(), rayE = new V();
  function segSeg(p1, q1, p2, q2) {
    d1.subVectors(q1, p1); d2.subVectors(q2, p2); r0v.subVectors(p1, p2);
    const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r0v);
    let s1, t1;
    if (a <= 1e-12 && e <= 1e-12) return r0v.length();
    if (a <= 1e-12) { s1 = 0; t1 = Math.min(1, Math.max(0, f / e)); }
    else {
      const cc = d1.dot(r0v);
      if (e <= 1e-12) { t1 = 0; s1 = Math.min(1, Math.max(0, -cc / a)); }
      else {
        const bb = d1.dot(d2), den = a * e - bb * bb;
        s1 = den > 1e-12 ? Math.min(1, Math.max(0, (bb * f - cc * e) / den)) : 0;
        t1 = (bb * s1 + f) / e;
        if (t1 < 0) { t1 = 0; s1 = Math.min(1, Math.max(0, -cc / a)); }
        else if (t1 > 1) { t1 = 1; s1 = Math.min(1, Math.max(0, (bb - cc) / a)); }
      }
    }
    return sA.copy(p1).addScaledVector(d1, s1).distanceTo(sB.copy(p2).addScaledVector(d2, t1));
  }
  function hiddenByBranches(pts) {
    const cam = camera.position, n = tree.parent.length;
    for (let i = 1; i < n; i++) {
      const fr = Math.min(1, Math.max(0, T - tree.birth[i])); if (fr < 0.3) continue;
      const r = Math.max(rad[i], rad[tree.parent[i]] * 0.7); if (r < 0.005) continue;
      const a = tree.pos[tree.parent[i]]; segE.copy(a).lerp(tree.pos[i], fr);
      for (const p of pts) { rayE.copy(cam).lerp(p, 0.97); if (segSeg(cam, rayE, a, segE) < r + 0.012) return true; }
    }
    return false;
  }
  // Punkt auf der Rinde: Stück i (Eltern → i), u von unten, dTh = Abweichung von der Richtung zur Kamera (um die Achse);
  // Radius und Wurzelanlauf wie im Rinden-Shader
  function barkAt(i, u, dTh) {
    const a = tree.pos[tree.parent[i]], b = tree.pos[i], ax = new V().subVectors(b, a), L = ax.length();
    if (L < 1e-5) return null; ax.multiplyScalar(1 / L);
    const base = a.clone().addScaledVector(ax, L * u), nrm = new V().subVectors(camera.position, base);
    nrm.addScaledVector(ax, -nrm.dot(ax)); if (nrm.lengthSq() < 1e-8) return null;
    nrm.normalize().applyAxisAngle(ax, dTh);
    const r = rad[tree.parent[i]] + (rad[i] - rad[tree.parent[i]]) * u;
    const fl = Math.exp(-Math.max(base.y, 0) * 2.4) * sm(0.025, 0.12, r), w = Math.atan2(nrm.z, nrm.x);
    const rf = r * (1 + fl * (1.05 + 0.75 * Math.pow(Math.max(Math.sin(w * 5 + 1.3), 0), 1.5) + 0.15 * Math.sin(w * 3 - 0.7)));
    return { kind: 'stamm', p: base.addScaledVector(nrm, rf * 1.1 + 0.006), nrm, ax, r };
  }
  function barkSpot(c) {
    if (!tree || !rad || !tree.pos || !settled()) return null;   // Baum und Nistkasten erst ein paar Bilder lang zur Stufe gezeichnet
    const k = c.SPAN / 0.42, cands = [], yMax = Math.min(crownBase - 0.17 * k - 0.05, 1.7);   // unter der Krone (Laub)
    for (const i of trunkPath()) {
      if (Math.min(1, Math.max(0, T - tree.birth[i])) < 0.98) continue;
      const a = tree.pos[tree.parent[i]], b = tree.pos[i];
      for (const u of [0.2, 0.5, 0.8]) { const y = a.y + (b.y - a.y) * u; if (y >= 0.36 && y <= yMax) cands.push({ i, u }); }
    }
    for (let k = cands.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; const q = cands[k]; cands[k] = cands[j]; cands[j] = q; }
    let tries = 0;
    for (const s of cands) {
      const spot = barkAt(s.i, s.u, rr(-0.22, 0.22));
      if (!spot || !inView(spot.p, 0.72, -0.72, 0.55)) continue;
      if (nistkastenFx.visible && spot.p.distanceTo(nistkastenFx.grp.position) < 0.3 + c.SPAN * 0.55) continue;   // Nistkasten
      if (P >= 5.98 && Math.abs(spot.p.y - 1.25) < 0.24) continue;                                             // Astloch
      if (++tries > 10) break;
      const ctr = spot.p.clone().addScaledVector(spot.nrm, 0.016), side = new V().crossVectors(spot.ax, spot.nrm).normalize();
      const pts = [ctr, ctr.clone().addScaledVector(side, 0.2 * k), ctr.clone().addScaledVector(side, -0.2 * k), ctr.clone().addScaledVector(spot.ax, 0.14 * k), ctr.clone().addScaledVector(spot.ax, -0.14 * k)];
      if (hiddenByBranches(pts)) continue;                                                                   // kein Ast davor
      spot.aOpen = spot.r < c.SPAN * 0.3 ? 0.42 : 0.1;                                                         // dünner Stamm: Flügel etwas angehoben
      return spot;
    }
    return null;
  }

  // ---- Wege (Catmull-Rom nach Bogenlänge; nie durch den Stamm – außer im ersten/letzten Stück, wenn es an der Rinde
  // beginnt oder endet)
  function makePath(pts, o = {}) {
    const Pn = pts.map(p => p.clone()), seg = Pn.length - 1, N = 20 * seg, samples = [], len = [0];
    const keep = (v) => { const d = Math.hypot(v.x, v.z), need = trunkR(v.y) + 0.2; if (d < need) { if (d < 1e-4) v.z = need; else { v.x *= need / d; v.z *= need / d; } } return v; };
    const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return new V().addScaledVector(a, -0.5 * t3 + t2 - 0.5 * t).addScaledVector(b, 1.5 * t3 - 2.5 * t2 + 1).addScaledVector(c, -1.5 * t3 + 2 * t2 + 0.5 * t).addScaledVector(d, 0.5 * t3 - 0.5 * t2); };
    for (let i = 0; i <= N; i++) {
      const g = i / N * seg, k = Math.min(seg - 1, Math.floor(g)), t = g - k;
      let s = cr(Pn[Math.max(0, k - 1)], Pn[k], Pn[k + 1], Pn[Math.min(seg, k + 2)], t);
      if (i && i < N && !(o.head && k === 0) && !(o.tail && k === seg - 1)) s = keep(s);
      if (i) len.push(len[i - 1] + s.distanceTo(samples[i - 1])); samples.push(s);
    }
    return { total: len[N], end: samples[N], at(d, out) { d = Math.min(len[N], Math.max(0, d)); let i = 1; while (i < N && len[i] < d) i++; const u = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]); return out.copy(samples[i - 1]).lerp(samples[i], u); } };
  }

  // ---- Figur: Flügelflächen mit zwei Seiten, Körperkreuz, Seitenbild
  function makeFigure(c) {
    const M = c.M, K = c.K, CY = (M.bodyY[0] + M.bodyY[1]) / 2, xF = CY * K, xB = (CY - M.top[1]) * K, t = c.tex;
    const mat = (map, side) => { const m = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.05, side, depthWrite: false, toneMapped: false }); m.color.setScalar(TONE); return m; };
    // Fläche in der Ebene des Falters: x nach vorn (Kopf = oberer Bildrand), z nach rechts, Vorderseite oben (Rücken)
    function quad(z0, z1, map, side, order, vert = false) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(vert ? [xF, z0, 0, xF, z1, 0, xB, z1, 0, xB, z0, 0] : [xF, 0, z0, xF, 0, z1, xB, 0, z1, xB, 0, z0], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
      g.setIndex([0, 2, 1, 0, 3, 2]);
      const m = new THREE.Mesh(g, mat(map, side)); m.renderOrder = order; m.frustumCulled = false; return m;
    }
    const grp = new THREE.Group(), pivL = new THREE.Group(), pivR = new THREE.Group();
    const zl = -M.cx * K, zr = (M.top[0] - M.cx) * K, b0 = (M.body[0] - M.cx) * K, b1 = (M.body[1] - M.cx) * K;
    pivL.add(quad(zl, 0, t.fl, THREE.FrontSide, 25), quad(zl, 0, t.ul, THREE.BackSide, 25));
    pivR.add(quad(0, zr, t.fr, THREE.FrontSide, 25), quad(0, zr, t.ur, THREE.BackSide, 25));
    const bodyH = quad(b0, b1, t.k, THREE.DoubleSide, 26); bodyH.position.y = 0.002;
    const bodyV = quad(b0, b1, t.ko, THREE.DoubleSide, 26, true);
    grp.add(pivL, pivR, bodyH, bodyV); grp.visible = false; scene.add(grp);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(t.s, THREE.DoubleSide)); side.renderOrder = 25; side.visible = false; side.frustumCulled = false; scene.add(side);
    return { grp, pivL, pivR, side };
  }
  // Ausrichtung aus Kopf-Richtung x und Rücken-Richtung y (Welt); z = x × y (rechter Flügel)
  function basis(q, x, y) {
    bx.copy(x).normalize(); bz.crossVectors(bx, y).normalize(); by.crossVectors(bz, bx).normalize();
    return q.setFromRotationMatrix(mtx.makeBasis(bx, by, bz));
  }
  // seitlich (ψ = 0: Kopf zur Seite fc) bis vom Betrachter weg (ψ = 90°), Kopf um pitch angehoben
  function poseTurn(q, fc, psi, pitch) {
    hv.copy(STAGE_R).multiplyScalar(fc * Math.cos(psi)).addScaledVector(STAGE_D, -Math.sin(psi));
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    tmp.copy(hv).multiplyScalar(cp).addScaledVector(STAGE_U, sp);
    tmp2.copy(hv).multiplyScalar(-sp).addScaledVector(STAGE_U, cp);
    return basis(q, tmp, tmp2);
  }
  function poseFlight(q, vel, pitch, yawKeep) {
    const hz = Math.hypot(vel.x, vel.z), yaw = hz > 1e-5 ? Math.atan2(-vel.z, vel.x) : yawKeep, climb = hz > 1e-5 ? Math.atan2(vel.y, hz) : 0;
    q.copy(qY.setFromAxisAngle(yA, yaw)).multiply(qP.setFromAxisAngle(zA, pitch + Math.max(-0.5, Math.min(0.5, climb * 0.4))));
    return yaw;
  }

  // ---- eine Art
  function makeArt(c) {
    c.K = c.SPAN / c.M.top[0]; c.KS = c.K * c.M.sideK;
    const M = c.M, KS = c.KS, SW = M.side[0] * KS, SH = M.side[1] * KS, ZZ = c.SPAN / 0.15;
    let ready = false;
    const bugs = [];
    function init() {
      if (ready) return; ready = true;
      const loader = new THREE.TextureLoader();
      const ldT = (n) => { const t = loader.load(__img(n)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
      c.tex = { fl: ldT(c.IMG.fl), fr: ldT(c.IMG.fr), ul: ldT(c.IMG.ul), ur: ldT(c.IMG.ur), k: ldT(c.IMG.k), ko: ldT(c.IMG.ko), s: ldT(c.IMG.s) };
      for (let i = 0; i < c.MAXN; i++) bugs.push({ i, fig: makeFigure(c), st: 'weg', seed: Math.random() * 6.3, q: new THREE.Quaternion(), q0: new THREE.Quaternion(), qL: new THREE.Quaternion(), a: 0.5, a0: 0.5, pos: new V(), prev: new V(), yaw: 0, flap: 0 });
      window['__' + c.NAME + 'Tiere'] = bugs;                          // Prüfhilfe (Standbilder: Phase und Zeit setzen)
    }
    const allowed = () => !!tree && !!rad && P >= c.STAGE - 0.02 && !__isNight() && !reduceMotion && c.SEASONS.includes(season) && MEADOW_FLOWERS.length > 0;

    // -- Zeichnen
    function draw3D(b, pos, q, a) {
      const f = b.fig; f.grp.position.copy(pos); f.grp.quaternion.copy(q);
      f.pivL.rotation.x = a; f.pivR.rotation.x = -a; f.grp.visible = true; f.side.visible = false;
      b.pos.copy(pos); b.q.copy(q); b.a = a;
    }
    function sideAt(perch, fc, out) {          // Mitte des Seitenbilds, Füße auf perch
      return out.copy(perch).addScaledVector(STAGE_U, (M.feet[1] - M.side[1] / 2) * KS + 0.004)
        .addScaledVector(STAGE_R, fc * (M.side[0] / 2 - M.feet[0]) * KS).addScaledVector(STAGE_D, 0.035);
    }
    function drawSide(b, perch, fc) {
      const f = b.fig; sideAt(perch, fc, f.side.position); f.side.quaternion.copy(STAGE_Q);
      f.side.scale.set(fc * SW, SH, 1); f.side.visible = true; f.grp.visible = false;
      closedPos(perch, fc, b.pos); poseTurn(b.q, fc, 0, c.SIDE_PITCH); b.a = c.CLOSED;
    }
    function hide(b) { b.fig.grp.visible = false; b.fig.side.visible = false; }
    // Körpermitte der Figur, die zum Seitenbild passt (zugeklappt), und beim Sitzen mit offenen Flügeln
    const closedPos = (perch, fc, out) => out.copy(perch).addScaledVector(STAGE_U, (M.feet[1] - M.bodyC[1]) * KS).addScaledVector(STAGE_R, fc * (M.bodyC[0] - M.feet[0]) * KS).addScaledVector(STAGE_D, 0.035);
    const openPos = (perch, out) => out.copy(perch).addScaledVector(STAGE_U, c.SIT_H).addScaledVector(STAGE_D, 0.035);
    const barkPos = (s, out) => out.copy(s.p).addScaledVector(s.nrm, 0.016);
    function barkQ(b, q) { return basis(q, tmp2.copy(b.sta.ax).multiplyScalar(b.headUp ? 1 : -1), b.sta.nrm); }
    const perchOf = (b, out) => bloomAt(b.sta.f, out);

    // -- Plätze
    function claim(b, sta) { if (b.sta && b.sta.f && (!sta || sta.f !== b.sta.f)) FLOWER_BUSY.delete(b.sta.f); b.sta = sta; if (sta && sta.f) FLOWER_BUSY.add(sta.f); }
    function pickStation(b, from) {
      if (c.BARK && !b.noBark && (b.wantBark || Math.random() < c.BARK_P)) {
        const s = barkSpot(c);
        if (s && !bugs.some(o => o !== b && o.sta && o.sta.kind === 'stamm' && o.sta.p.distanceTo(s.p) < c.SPAN)) {
          b.wantBark = false; return s;
        }
      }
      b.noBark = false;
      const f = pickFlower(c, from);
      return f ? { kind: 'bluete', f } : null;
    }
    // Ziel des Anflugs (Körpermitte bei der Landung) und Punkt davor
    function landTarget(b, out) {
      if (b.sta.kind === 'stamm') return barkPos(b.sta, out);
      return closedPos(perchOf(b, tmp2), b.fc, out);
    }
    function approach(b, end, side) {
      if (b.sta.kind === 'stamm') return end.clone().addScaledVector(b.sta.nrm, 0.35 * c.SPAN / 0.42 + 0.1).add(tmp.set(0, 0.06, 0));
      return end.clone().add(tmp.set(0, 0.12 + c.SPAN * 0.2, 0)).addScaledVector(STAGE_R, side * (0.18 + c.SPAN * 0.4)).addScaledVector(STAGE_D, 0.05);
    }

    // -- Flug: herein, weiter, hinaus
    function enter(b) {
      // Test „am Stamm“ gleich nach einem Stufenwechsel: erst, wenn der Baum (und der Nistkasten) zur Stufe gezeichnet ist –
      // gezählt in gezeichneten Bildern (beim Vorspulen der Prüf-Skripte läuft die Uhr schneller als das Bild), höchstens 120
      if (b.wantBark && !settled() && frameNo - b.waitFrom < 120) return;
      const sta = pickStation(b, null);
      if (!sta) { b.st = 'weg'; hide(b); return; }
      claim(b, sta); b.fc = -b.side;
      if (sta.kind === 'stamm') b.headUp = Math.random() < 0.6;
      const end = landTarget(b, new V()), st = toSt(end);
      const y0 = c.LOW ? rr(0.25, 0.55) : st.y + rr(0.8, 1.4), z0 = st.z + rr(-0.2, 0.6), x0 = edgeStageX(b.side, y0, z0, 6.4);
      b.far = Math.min(3, Math.abs(x0) / 6.4);
      const mid = c.LOW ? W3(st.x + b.side * rr(0.8, 1.6), rr(0.15, 0.45), st.z + rr(0.1, 0.5)) : W3(st.x + b.side * rr(1.2, 2.2), st.y + rr(0.4, 0.8), st.z + rr(0.2, 0.6));
      b.path = makePath([W3(x0, y0, z0), mid, approach(b, end, b.side), end], { tail: sta.kind === 'stamm' }); b.d = 0; b.fk = 'an'; b.st = 'flug'; b.t = 0; b.from = null;
      b.path.at(0, b.prev);
    }
    function hop(b) {                           // zum nächsten Platz (oder fort, wenn keiner mehr dran ist)
      const fromRest = b.st === 'sitzt', fromBark = fromRest && b.sta && b.sta.kind === 'stamm';
      const from = b.pos.clone(); b.q0.copy(b.q); b.a0 = b.a;
      const old = b.sta, sta = b.left > 0 ? pickStation(b, from) : null;
      if (!sta || (old && sta.f && sta.f === old.f)) { leave(b, from, fromRest); return; }
      claim(b, sta); b.left--;
      const dx = toSt(sta.kind === 'stamm' ? sta.p : bloomAt(sta.f, tmp2)).x - toSt(from).x;
      b.fc = Math.abs(dx) > 0.05 ? Math.sign(dx) : (Math.random() < 0.5 ? -1 : 1);
      if (sta.kind === 'stamm') b.headUp = Math.random() < 0.6;
      const end = landTarget(b, new V()), up = c.LOW ? rr(0.08, 0.22) : rr(0.25, 0.55);
      const m1 = from.clone().lerp(end, 0.4).add(tmp.set(0, up, 0)).addScaledVector(STAGE_D, rr(0, 0.25));
      const pts = [from, fromBark ? from.clone().addScaledVector(old.nrm, 0.25) : from.clone().add(tmp.set(0, 0.08, 0)), m1, approach(b, end, -b.fc), end];
      b.path = makePath(pts, { head: fromBark, tail: sta.kind === 'stamm' }); b.d = 0; b.fk = 'hop'; b.st = 'flug'; b.t = 0; b.from = fromRest ? 'rest' : null;
      b.prev.copy(from);
    }
    function leave(b, from, fromRest) {          // hinauf und zur Seite aus dem Bild
      const fromBark = fromRest && b.sta && b.sta.kind === 'stamm', nrm = fromBark ? b.sta.nrm.clone() : null;
      claim(b, null);
      const st = toSt(from), side = st.x >= 0 ? 1 : -1;
      const yE = c.LOW ? rr(0.4, 0.9) : st.y + rr(1.0, 1.6), zE = st.z + rr(0.2, 0.7), xE = edgeStageX(side, yE, zE, 6.6);
      b.far = Math.min(3, Math.abs(xE) / 6.6);
      const mid = W3(st.x + side * rr(1.0, 1.8), c.LOW ? rr(0.3, 0.6) : st.y + rr(0.5, 0.9), st.z + rr(0, 0.4));
      const p1 = fromBark ? from.clone().addScaledVector(nrm, 0.25) : from.clone().add(tmp.set(0, 0.12, 0));
      b.path = makePath([from.clone(), p1, mid, W3(xE, yE, zE)], { head: fromBark }); b.d = 0; b.fk = 'ab'; b.st = 'flug'; b.t = 0;
      b.from = fromRest ? 'rest' : null; b.q0.copy(b.q); b.a0 = b.a; b.fc = side; b.prev.copy(from);
    }
    // Flügelschlag (Winkel aus der Waagerechten, hoch = +) mit gelegentlichem Gleiten
    function flapAngle(b, dt, calm) {
      const gl = c.GLIDE ? calm * sm(0.8, 0.88, fract(b.t * c.GLIDE + b.seed)) * (1 - sm(0.95, 0.995, fract(b.t * c.GLIDE + b.seed))) : 0;
      b.flap += dt * 2 * Math.PI * c.HZ * (1 - 0.85 * gl);
      return mix(c.FLAP_MID + c.FLAP_AMP * Math.sin(b.flap), 0.14, gl);
    }
    const fp = new V(), fq = new V(), vel = new V(), qT = new THREE.Quaternion(), qF = new THREE.Quaternion(), live = new V();
    function stepFlight(b, dt) {
      const sp = b.fk === 'ab' ? c.SPD.ab * b.far : b.fk === 'an' ? c.SPD.an * b.far : c.SPD.hop;
      const rem = b.path.total - b.d, Fk = b.fk === 'hop' ? 1 : b.far;
      const v = b.fk === 'ab' ? sp * (sm(-0.1, 0.5 * Fk, b.d) * 0.8 + 0.2) : sp * (sm(-0.02, c.BRAKE * Fk, rem) * 0.8 + 0.2);
      b.d += v * dt;
      if (b.d >= b.path.total) { arrive(b); return; }
      b.path.at(b.d, fp); b.path.at(Math.min(b.path.total, b.d + 0.03), fq);
      // Zickzack quer und auf und ab, ruhiger vor der Landung
      const calm = b.fk === 'ab' ? sm(0, 0.6, b.d) : sm(0, 0.5, rem) * (b.from ? sm(0, 0.3, b.d) : 1), t = b.t, s = b.seed;
      const dx = fq.x - fp.x, dz = fq.z - fp.z, dl = Math.hypot(dx, dz) || 1;
      const zz = ZZ * calm * (c.ZIG[0] * Math.sin(t * 2 * Math.PI * c.ZIG[1] + s) + c.ZIG[2] * Math.sin(t * 2 * Math.PI * c.ZIG[3] + s * 1.7));
      const yy = ZZ * calm * c.ZIG[4] * Math.sin(t * 2 * Math.PI * c.ZIG[5] + s * 2.3);
      fp.x += -dz / dl * zz; fp.z += dx / dl * zz; fp.y += yy;
      let a = flapAngle(b, dt, calm);
      fp.y += ZZ * 0.01 * Math.cos(b.flap) * calm;
      vel.subVectors(fp, b.prev); b.prev.copy(fp);
      if (vel.lengthSq() < 1e-12) vel.subVectors(fq, fp);
      b.yaw = poseFlight(qF, vel, c.PITCH, b.yaw);
      if (b.fk !== 'ab' && rem < c.LAND_D) {                                 // Landung: in die Ruhelage drehen, Flügel hoch
        const k = 1 - sm(0, c.LAND_D, rem);
        if (b.sta.kind === 'stamm') { barkQ(b, qT); a = mix(a, b.sta.aOpen, k); }
        else { poseTurn(qT, b.fc, 0, c.SIDE_PITCH); a = mix(a, c.CLOSED, k); }
        qF.slerp(qT, k);
        if (b.sta.kind === 'bluete') fp.add(landTarget(b, live).sub(b.path.end).multiplyScalar(k));   // Blüte wiegt im Wind
      }
      if (b.from === 'rest' && b.d < c.TO_D) { const k = sm(0, c.TO_D, b.d); qF.copy(b.q0).slerp(qF, k); a = mix(b.a0, a, k); }
      draw3D(b, fp, qF, a);
    }
    function arrive(b) {
      if (b.fk === 'ab') { b.st = 'weg'; hide(b); return; }
      b.st = 'sitzt'; b.t = 0; b.from = null;
      if (b.sta.kind === 'stamm') {
        b.aOpen = b.sta.aOpen;
        b.phase = 'auf'; b.pt = 0; b.pdur = rr(2.2, 4.5); b.opens = 1 + ((Math.random() * 3) | 0);
      } else {
        b.phase = 'zu'; b.pt = 0; b.pdur = rr(...c.FIRST_ZU); b.opens = b.sta.f && c.NO_OPEN[b.sta.f.cell] ? 0 : rr(...c.OPENS) | 0;
        if (!b.opens) b.pdur = rr(2.0, 4.5);                               // auf der Ähre: bleibt zugeklappt, sitzt länger
        b.psi = rr(...c.OPEN_PSI); b.aOpen = rr(...c.OPEN_A);
      }
    }

    // -- Sitzen
    const qa = new THREE.Quaternion(), qb2 = new THREE.Quaternion(), pa = new V(), pb = new V();
    function stepRest(b, dt) {
      if (b.sta.kind === 'bluete' && (!b.sta.f || flowerOn(b.sta.f) < 0.99)) { hop(b); return; }
      b.pt += dt;
      if (b.sta.kind === 'stamm') {                 // flach auf der Rinde, klappt ab und zu zusammen
        barkPos(b.sta, pa); barkQ(b, qa);
        let a = b.aOpen + 0.05 * Math.sin(b.t * 1.7 + b.seed);
        if (b.phase === 'klappen') { const k = b.pt / b.pdur; a = mix(b.aOpen, c.CLOSED, Math.sin(Math.min(1, k) * Math.PI)); if (k >= 1) { b.phase = 'auf'; b.pt = 0; b.pdur = rr(2.0, 4.5); } }
        else if (b.pt >= b.pdur) { if (b.opens-- > 0) { b.phase = 'klappen'; b.pt = 0; b.pdur = rr(0.9, 1.4); } else { hop(b); return; } }
        draw3D(b, pa, qa, a);
        return;
      }
      const perch = perchOf(b, live);
      if (b.phase === 'zu') {
        drawSide(b, perch, b.fc);
        if (b.pt >= b.pdur) { if (b.opens > 0) { b.opens--; b.phase = 'oeffnen'; b.pt = 0; b.pdur = c.T_OPEN; } else { hop(b); return; } }
        return;
      }
      // offen bzw. beim Öffnen/Schließen: zwischen zugeklappt (wie das Seitenbild) und offen (zur Sonne gedreht)
      let k = 1;
      if (b.phase === 'oeffnen') { k = sm(0, 1, b.pt / b.pdur); if (b.pt >= b.pdur) { b.phase = 'auf'; b.pt = 0; b.pdur = rr(...c.AUF); } }
      else if (b.phase === 'schliessen') { k = 1 - sm(0, 1, b.pt / b.pdur); if (b.pt >= b.pdur) { b.phase = 'zu'; b.pt = 0; b.pdur = rr(...c.ZU); drawSide(b, perch, b.fc); return; } }
      else if (b.phase === 'auf' && b.pt >= b.pdur) {
        if (b.opens <= 0 && Math.random() < c.FLY_OPEN) { b.pt = 0; hop(b); return; }
        b.phase = 'schliessen'; b.pt = 0; b.pdur = c.T_CLOSE;
      }
      closedPos(perch, b.fc, pa); openPos(perch, pb); pa.lerp(pb, k);
      poseTurn(qa, b.fc, b.psi * k, mix(c.SIDE_PITCH, c.OPEN_PITCH, k));
      const breathe = b.phase === 'auf' ? c.BREATH * Math.sin(b.pt * 2 * Math.PI * 0.4 + b.seed) * sm(0, 0.4, b.pt) : 0;
      draw3D(b, pa, qa, mix(c.CLOSED, b.aOpen + breathe, k));
    }

    // -- Paar: taumeln umeinander herein, schrauben sich hoch (Tagpfauenauge: Balzflug; Bläulinge: kurze Jagd)
    let pair = null;
    function startPair(b0, b1, side) {
      // Ort der Spirale: tief über der Wiese (Bläulinge), unter der Krone (große Stufen) oder neben der Krone (kleine Stufen),
      // damit das Paar nicht im Laub verschwindet; liegt der höchste Punkt nicht im Bild, näher an den Baum und weiter nach vorn
      const y1 = c.LOW ? rr(0.3, 0.5) : rr(0.75, 1.05), top = y1 + c.PAIR.rise + 0.25;
      let z1 = rr(0.8, 1.3), x1 = c.LOW || crownBase > top ? side * rr(0.5, 1.2) : side * (crownW * 0.5 + rr(0.35, 0.7));
      if (!inView(W3(x1, top, z1), 0.85, -0.9, 0.85)) { x1 = side * (crownW * 0.5 + 0.1); z1 = crownW * 0.5 + 0.5; }
      const y0 = c.LOW ? rr(0.3, 0.6) : rr(1.0, 1.6), z0 = rr(0.5, 1.3), x0 = edgeStageX(side, y0, z0, 6.4);
      const far = Math.min(3, Math.abs(x0) / 6.4);
      const mid = W3(side * rr(1.6, 2.4), mix(y0, y1, 0.5) + rr(-0.1, 0.2), rr(0.9, 1.5));
      pair = { path: makePath([W3(x0, y0, z0), mid, W3(x1, y1, z1)]), d: 0, spd: c.PAIR.spd * far, t: 0, ph: 'reise', phi: rr(0, 6.3), a: [b0, b1], c: new V() };
      for (const b of [b0, b1]) { b.st = 'paar'; b.t = 0; b.sta = null; b.prev.copy(W3(x0, y0, z0)); }
    }
    function stepPair(dt) {
      const pr = pair, C = c.PAIR;
      pr.t += dt;
      let r, rise = 0;
      if (pr.ph === 'reise') {
        pr.d += pr.spd * (0.35 + 0.65 * sm(0, 0.6, pr.path.total - pr.d)) * dt; pr.phi += dt * 2 * Math.PI * C.w0;
        pr.path.at(pr.d, pr.c); r = C.r0;
        if (pr.d >= pr.path.total) { pr.ph = 'spirale'; pr.t = 0; }
      } else {
        const k = pr.t / C.T; pr.phi += dt * 2 * Math.PI * C.w1; r = mix(C.r0, C.r1, sm(0, 0.4, k)); rise = C.rise * sm(0, 1, k);
        if (k >= 1) { endPair(); return; }
      }
      pr.a.forEach((b, j) => {
        if (b.st !== 'paar') return;
        b.t += dt;
        const ph = pr.phi + j * Math.PI + 0.35 * Math.sin(pr.t * 3.1 + b.seed);
        fp.copy(pr.c).addScaledVector(STAGE_R, Math.cos(ph) * r).addScaledVector(STAGE_D, Math.sin(ph) * r * 0.8).add(tmp.set(0, rise + 0.45 * r * Math.sin(2 * ph + j), 0));
        vel.subVectors(fp, b.prev); b.prev.copy(fp);
        b.yaw = poseFlight(qF, vel, c.PITCH, b.yaw);
        draw3D(b, fp, qF, flapAngle(b, dt, 1));
      });
    }
    function endPair() {
      const [b0, b1] = pair.a; pair = null;
      for (const b of [b0, b1]) if (b.st === 'paar') b.st = 'flug-frei';
      if (c.PAIR.oneLeaves && b0.st === 'flug-frei') { b0.left = 0; b0.sta = null; leave(b0, b0.pos.clone(), false); }
      for (const b of [b0, b1]) if (b.st === 'flug-frei') { b.left = Math.max(1, b.left); b.sta = null; hop(b); }
    }

    // -- Besuche
    let vt = 0, last = 0, next = rr(...c.FIRST), visiting = false, soon = null;
    const others = () => [falterFx.active, hummelFx.active, kraehenFx.active, visitFx.active, ...arts.filter(o => o !== api).map(o => o.active)].filter(Boolean).length;
    const canStart = (force) => !trans && !moveIn && !jayFx.active && !visitFx.active && !seqPlayer.active() && (force || others() <= 1);
    function startVisit(o = {}) {
      init();
      for (const b of bugs) { claim(b, null); b.st = 'weg'; hide(b); }
      pair = null;
      const side = Math.random() < 0.5 ? -1 : 1, n = c.count(o);
      const together = o.mode === 'paar' || (o.mode == null && n >= 2 && Math.random() < c.PAIR.p);
      for (let j = 0; j < n; j++) {
        const b = bugs[j];
        Object.assign(b, { st: 'warten', startAt: vt + c.stagger(j), side: j % 2 ? -side : side, left: rr(...c.STATIONS) | 0, sta: null, wantBark: o.mode === 'stamm' && j === 0, noBark: o.mode === 'bluete' && j === 0, waitFrom: frameNo, seed: Math.random() * 6.3, t: 0, flap: Math.random() * 6.3 });
      }
      if (together) startPair(bugs[0], bugs[1], side);
      visiting = true;
    }
    function stepAll(dt) {
      if (pair) stepPair(dt);
      for (const b of bugs) {
        if (b.st === 'weg') { hide(b); continue; }
        if (b.st === 'paar') continue;
        if (b.st === 'warten') { hide(b); if (vt >= b.startAt) { b.prev.set(0, 0, 0); enter(b); } continue; }
        b.t += dt;
        if (b.st === 'flug') stepFlight(b, dt);
        else if (b.st === 'sitzt') stepRest(b, dt);
      }
      window['__' + c.NAME] = bugs.filter(b => b.st !== 'weg').map(b => {
        const vis = b.fig.side.visible ? b.fig.side.position : b.fig.grp.position, n = tmp.copy(vis).project(camera);
        const h = renderer.domElement.clientHeight || H(), pxU = h / 2 * camera.projectionMatrix.elements[5] / Math.max(0.5, camera.position.distanceTo(vis));
        return { i: b.i, st: b.st, phase: b.st === 'sitzt' ? b.phase : b.st === 'flug' ? b.fk : b.st === 'paar' && pair ? pair.ph : b.st, wo: b.sta ? b.sta.kind : null, blume: b.sta && b.sta.f ? b.sta.f.cell : null, y: b.sta && b.sta.p ? +b.sta.p.y.toFixed(2) : undefined,
          bild: b.fig.side.visible ? 'seite' : b.fig.grp.visible ? 'figur' : '-', a: Math.round(b.a * 57.3), nx: +n.x.toFixed(3), ny: +n.y.toFixed(3), px: +(c.SPAN * pxU).toFixed(1) };
      });
    }
    function update(dt) {
      if (!allowed()) {
        if (ready && bugs.some(b => b.st !== 'weg')) {
          if (__isNight() || P < c.STAGE - 0.02 || reduceMotion) stop();
          else { vt += dt; away(); stepAll(dt); if (bugs.every(b => b.st === 'weg')) visiting = false; return; }   // Jahreszeit vorbei: davon
        }
        window['__' + c.NAME] = null; return;
      }
      vt += dt;
      if (!visiting && vt >= next && canStart(soon && soon.force)) { const o = soon || {}; soon = null; startVisit(o); }
      if (!ready) return;
      stepAll(dt);
      if (visiting && bugs.every(b => b.st === 'weg')) { visiting = false; next = vt + (soon ? 0.5 : rr(...c.GAP)); }
    }
    function frame(dt) { update(dt); }
    function stop() {
      for (const b of bugs) { claim(b, null); b.st = 'weg'; hide(b); }
      pair = null;
      if (visiting) next = vt + rr(20, 60);
      visiting = false;
    }
    function away() {                            // gleich weiterfliegen (der Baum wächst, der Häher kommt)
      if (pair) { for (const b of pair.a) if (b.st === 'paar') { b.left = 0; b.st = 'flug'; leave(b, b.pos.clone(), false); } pair = null; }
      for (const b of bugs) {
        if (b.st === 'warten') { b.st = 'weg'; continue; }
        if (b.st === 'weg' || (b.st === 'flug' && b.fk === 'ab')) continue;
        b.left = 0; leave(b, b.pos.clone(), b.st === 'sitzt');
      }
    }
    // Test (Baum-Test): gleich ein Besuch; sind schon welche da, fliegen sie fort und es kommt gleich der nächste
    function now(o = {}) {
      if (!allowed()) return false;
      soon = { ...o, force: true };
      if (visiting) { away(); return true; }
      next = vt; return true;
    }
    window['__' + c.NAME + 'Sim'] = (sec) => { for (let k = 0; k < Math.round(sec / 0.05); k++) update(0.05); };
    window['__' + c.NAME + 'Stop'] = () => { stop(); window['__' + c.NAME] = null; };
    window['__' + c.NAME + 'Setzen'] = (o = {}) => {
      if (!allowed()) return 'nicht erlaubt';
      init(); stop();
      for (let j = 0; j < Math.min(c.MAXN, o.n || 1); j++) {
        const b = bugs[j]; b.wantBark = o.wo === 'stamm'; b.seed = Math.random() * 6.3;
        const sta = o.wo === 'stamm' ? barkSpot(c) : (() => { const f = pickFlower(c, null); return f ? { kind: 'bluete', f } : null; })();
        if (!sta) break;
        claim(b, sta); b.fc = o.fc || (Math.random() < 0.5 ? -1 : 1); b.headUp = o.headUp ?? true; b.left = 0;
        b.fk = 'an'; arrive(b); b.pdur = 1e9; b.opens = 1;
        if (sta.kind === 'bluete' && o.phase === 'auf') { b.phase = 'auf'; b.pt = 0; b.pdur = 1e9; b.opens = 0; }
        if (o.psi != null) b.psi = o.psi;
        if (o.a != null) b.aOpen = o.a;
        b.st = 'sitzt'; b.t = 0;
      }
      visiting = true; stepAll(0);
      return window['__' + c.NAME];
    };
    const api = { frame, stop, away, now, get active() { return visiting; } };
    return api;
  }

  // ---- die beiden Arten
  const arts = [];
  const pfau = makeArt({
    NAME: 'pfau', STAGE: 3, SEASONS: ['fruehling', 'sommer'], MAXN: 2, SPAN: 0.14, M: {"top": [932, 659], "cx": 466, "bodyY": [179, 536], "left": [466, 659], "right": [466, 659], "body": [308, 622, 659], "side": [792, 820], "feet": [480, 812], "headTop": 178, "sideK": 0.91, "bodyC": [470, 545]},
    IMG: { fl: '25006efa02.webp', fr: '9dd0883a2f.webp', ul: 'f657763d7e.webp', ur: 'de6ea0d275.webp', k: '04533339e3.webp', ko: '28655a3ac6.webp', s: '39352c2a98.webp' },
    FLOWERS: { 13: 1, 10: 0.8, 11: 0.6, 8: 0.5, 9: 0.45 },              // Löwenzahn am liebsten (auf Gelb sieht man es gut)
    NO_OPEN: {}, HOP: [0.3, 2.2], LOW: false, BARK: true, BARK_P: 0.3,
    SPD: { an: 1.15, hop: 0.85, ab: 1.35 }, BRAKE: 0.45, LAND_D: 0.32, TO_D: 0.3,
    HZ: 6, FLAP_MID: 0.42, FLAP_AMP: 1.02, GLIDE: 0.42, PITCH: 0.3, ZIG: [0.035, 1.1, 0.015, 2.3, 0.03, 1.4],
    CLOSED: 1.45, SIDE_PITCH: 0.78, SIT_H: 0.01, OPEN_PITCH: 0.72, OPEN_PSI: [0.95, 1.35], OPEN_A: [0.05, 0.22], BREATH: 0.1,
    FIRST_ZU: [1.0, 2.2], ZU: [0.8, 1.8], AUF: [2.0, 4.5], OPENS: [1, 3], T_OPEN: 0.6, T_CLOSE: 0.45, FLY_OPEN: 0.4,
    STATIONS: [0, 3], count: (o) => o.mode === 'paar' ? 2 : o.mode ? 1 : (Math.random() < 0.25 ? 2 : 1), stagger: (j) => j ? rr(0.2, 0.5) : 0,
    PAIR: { p: 1, spd: 0.9, w0: 0.9, w1: 1.0, r0: 0.16, r1: 0.24, rise: 0.95, T: 3.4, oneLeaves: true },
    FIRST: [20, 60], GAP: [120, 240],
  });
  const blau = makeArt({
    NAME: 'blau', STAGE: 2, SEASONS: ['sommer'], MAXN: 3, SPAN: 0.088, M: {"top": [919, 657], "cx": 460, "bodyY": [179, 585], "left": [460, 657], "right": [459, 657], "body": [298, 622, 657], "side": [847, 803], "feet": [500, 790], "headTop": 176, "sideK": 0.83, "bodyC": [480, 550]},
    IMG: { fl: 'db74eac518.webp', fr: 'c761800f5e.webp', ul: '30c605b145.webp', ur: 'ac5ae78863.webp', k: '0a19fea197.webp', ko: '2e3fae2cdb.webp', s: '114e7a1ef5.webp' },
    FLOWERS: { 8: 1, 10: 0.9, 11: 0.8, 9: 0.6, 13: 0.5, 6: 0.55, 7: 0.55 },  // kleine Blüten, dazu die Ähren der Gräser
    NO_OPEN: { 6: 1, 7: 1 }, HOP: [0.25, 1.8], LOW: true, BARK: false, BARK_P: 0,
    SPD: { an: 0.95, hop: 0.75, ab: 1.15 }, BRAKE: 0.3, LAND_D: 0.2, TO_D: 0.18,
    HZ: 11, FLAP_MID: 0.5, FLAP_AMP: 0.98, GLIDE: 0, PITCH: 0.3, ZIG: [0.05, 2.1, 0.03, 4.3, 0.045, 2.9],
    CLOSED: 1.45, SIDE_PITCH: 0.85, SIT_H: 0.007, OPEN_PITCH: 0.42, OPEN_PSI: [0.75, 1.15], OPEN_A: [0.62, 0.9], BREATH: 0.12,
    FIRST_ZU: [0.4, 1.0], ZU: [0.4, 1.2], AUF: [2.0, 5.0], OPENS: [1, 2], T_OPEN: 0.35, T_CLOSE: 0.3, FLY_OPEN: 0.5,
    STATIONS: [1, 4], count: () => Math.random() < 0.6 ? 2 : 3, stagger: (j) => j === 0 ? 0 : j === 1 ? rr(1.5, 5) : rr(4, 10),
    PAIR: { p: 0.6, spd: 0.8, w0: 1.2, w1: 1.5, r0: 0.1, r1: 0.12, rise: 0.35, T: 1.6, oneLeaves: false },
    FIRST: [30, 80], GAP: [120, 240],
  });
  arts.push(pfau, blau);
  window.__blumenBelegt = () => FLOWER_BUSY.size;                      // Prüfhilfe: belegte Blüten (alle Besucher)
  window.__stammInfo = () => ({ krone: +crownBase.toFixed(2), r0: rad ? +rad[0].toFixed(3) : 0, ruhig: stableFrames, bild: frameNo });
  let last = 0;
  function frame() {
    const now = nowMs(), dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    const key = treeNow() ? T + '|' + P : '';                     // gezeichnete Bilder, seit der Baum zur Stufe passt
    stableFrames = key && key === stableKey ? stableFrames + 1 : key ? 1 : 0; stableKey = key;
    frameNo++;
    pfau.frame(dt); blau.frame(dt);
  }
  return { frame, pfau, blau, stop() { pfau.stop(); blau.stop(); }, away() { pfau.away(); blau.away(); }, get active() { return pfau.active || blau.active; } };
})();
// ------------------------------------------------------------------ Eichhörnchen von Frühling bis Herbst: Tagesablauf (26.10.)
// Nutzer („unbedingt“): auf dem Ast aufwachen/strecken, weg, mit Haselnuss zurück, essen, einschlafen; im Herbst Nüsse
// ins Astloch bunkern. Der Baum entscheidet selbst, wann (erstes Mal nach 40–90 s, dann alle 3–6 min; gezählt wird nur,
// solange es gehen darf): Frühling bis Herbst, tagsüber, ab Stufe 6, nicht bei „Weniger Bewegung“, nicht während
// Wachsen, Einzug, Häher oder Winter-Ausflug. Die Kamera zoomt nicht.
//  1. wach:    statt der schlafenden Figur (Atmen, „z“) das gleiche Liegebild, Auge auf, blinzelt; steht auf (Hinlegen
//              rückwärts), streckt sich vorn (gähnt dabei), steht, streckt sich hinten, steht, dreht um
//  2. weg:     den Ast entlang, kopfvoran rechts am Stamm hinunter (Bauch zum Stamm, Rücken außen), unten nach rechts
//              über die Wiese bis über ihren Rand, wo es mit der Wiese weich in den Hintergrund verschwindet
//  3. fort:    10–20 s nicht zu sehen (der Ast ist leer)
//  4. zurück:  von rechts über die Wiese, rechts am Stamm hinauf, auf den Ast – mit einer Nuss im Maul: Frühling/Sommer
//              Haselnuss, Herbst Haselnuss oder Eichel
//  5. essen:   duckt sich (nimmt die Nuss in die Pfoten), sitzt, knabbert (erst ganze Nuss, dann angebissen mit
//              Krümeln), Nuss ist alle (sitzt mit leeren Pfoten), legt sich hin wie beim Einzug, schläft wieder
//  Herbst:     vor dem letzten Rückweg 1–2 Mal mit einer Nuss ins Astloch – Weg und Schnitt am Loch wie im Winter
//              (loch/winter.js): hinein, kurz drin, kopfvoran heraus, den Stamm hinunter, wieder fort
// Bilder: Einzugs-Abfolge (SEQIMG, Texturen von seqPlayer) + neue (eichhorn/: wach, streck1, streck2, t2h–n4h mit
// Haselnuss statt Eichel, hasel). Lage der neuen Bilder: wie ihr Vorbild (of) plus Versatz dx/dy (eichhorn/bilder.json).
// Uhr: nowMs(), höchstens 0,1 s je Bild (steht der Baum still, steht auch das Eichhörnchen).
const eichTagFx = (() => {
  const IMG = {"t2h": "034f57840b.webp", "t3h": "a2a9620032.webp", "t4h": "9867258132.webp", "n0h": "a2b49299e4.webp", "n1h": "284b8080db.webp", "n2h": "8af99c4b00.webp", "n3h": "0e42d674ee.webp", "n4h": "a7aa6f061c.webp", "hasel": "4053cb597d.webp", "streck1": "d4613d04fb.webp", "streck2": "40572c8bf1.webp", "wach": "586e90c96a.webp"};
  const NF = {"t2h":{"w":0.4075,"h":0.3498,"of":"t2","dx":0.0014,"dy":0.001},"t3h":{"w":0.4113,"h":0.3902,"of":"t3","dx":0.0034,"dy":-0.0},"t4h":{"w":0.4228,"h":0.3556,"of":"t4","dx":0.001,"dy":0.001},"n0h":{"w":0.4228,"h":0.3575,"of":"n0","dx":0.001,"dy":-0.0},"n1h":{"w":0.4075,"h":0.3498,"of":"n1","dx":0.0034,"dy":0.0005},"n2h":{"w":0.3959,"h":0.3575,"of":"n2","dx":0.0029,"dy":-0.0005},"n3h":{"w":0.3844,"h":0.3613,"of":"n3","dx":-0.0034,"dy":0.0005},"n4h":{"w":0.3998,"h":0.3613,"of":"n4","dx":0.0163,"dy":-0.001},"hasel":{"w":0.0769,"h":0.075},"streck1":{"w":0.4824,"h":0.5535,"of":"t0","dx":0.049,"dy":0.0211},"streck2":{"w":0.7034,"h":0.4728,"of":"t0","dx":-0.123,"dy":-0.0192},"wach":{"w":0.4171,"h":0.4497,"of":"l5m","dx":0,"dy":0}};
  const loader = new THREE.TextureLoader(), tex = Object.assign({}, seqPlayer.tex);
  for (const k in IMG) { const t = loader.load(__img(IMG[k])); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; tex[k] = t; }
  const FRAME = (k) => NF[k] || SEQ.frames[k];
  // ---- Bild mit Schnitt am Astloch (wie winter.js, eigener Programm-Schlüssel)
  const OPEN = () => ({ x: holeFx.H.rx * 1.05, y: holeFx.H.ry * 1.12 });
  const hc = { value: new THREE.Vector2() }, hs = { value: new THREE.Vector2(1, 1) }, hk = { value: new THREE.Vector2(1, 0) },
    hr = { value: new THREE.Vector2(1, 1) }, hm = { value: 0 };
  const mk = (order, clipped) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex.k0, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthTest: true, depthWrite: false, toneMapped: false }));
    if (clipped) m.material.customProgramCacheKey = () => 'eichTagClip1';
    if (clipped) m.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uHc: hc, uHs: hs, uHk: hk, uHr: hr, uHm: hm });
      sh.fragmentShader = 'uniform vec2 uHc; uniform vec2 uHs; uniform vec2 uHk; uniform vec2 uHr; uniform float uHm;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
  if (uHm != 0.) {
    vec2 o = (vMapUv - uHc) * uHs;
    vec2 wv = vec2(uHk.x * o.x - uHk.y * o.y, uHk.y * o.x + uHk.x * o.y);
    float e = length(wv / uHr);
    float w = uHm * o.y / uHr.y;
    if (w > 0. && e >= 1.) discard;
    float deep = smoothstep(-.6, .45, w) * mix(1. - smoothstep(.8, 1., e), 1., smoothstep(-.2, .2, w));
    diffuseColor.rgb *= mix(1., .05, deep);
  }`);
    };
    m.material.color.setScalar(0.94); m.renderOrder = order; m.visible = false; scene.add(m); return m;
  };
  const spr = mk(22, true), nut = mk(23, false); nut.material.map = tex.hasel;
  // Nasenspitze je Bild (Anteil von Breite/Höhe, von oben links): dort trägt es die Nuss (g/k wie winter.js)
  const NOSE = { g4: [0.97, 0.43], g5: [0.97, 0.45], g6: [0.96, 0.67], g7: [0.96, 0.6], g8: [0.97, 0.52],
    k0: [0.97, 0.18], k1: [0.9, 0.12], k2: [0.63, 0.05], k3: [0.8, 0.07], k4: [0.85, 0.07],
    h0: [0.975, 0.11], h1: [0.965, 0.21], h2: [0.98, 0.45], h3: [0.985, 0.59], h4: [0.98, 0.645], t0: [0.98, 0.64], l1: [0.955, 0.73] };
  const CLIMBF = ['k0', 'k1', 'k2', 'k3', 'k4'], SPEED = 0.9, FR = 70;   // weiter klettern bis zum Loch (wie winter.js)
  const q = new THREE.Quaternion(), zA = new V(0, 0, 1);
  const rr = (a, b) => a + Math.random() * (b - a);
  // ---- Wege (je Baumstufe aus der gebackenen Einzugs-Abfolge)
  function seqOf(st) {
    const q0 = SEQS[st] || SEQ, S = q0.samples, idx = q0.idx;
    const iT0 = idx.pick - 1;
    let iH4 = iT0; while (iH4 > 0 && S[iH4 - 1][0] === 'h4') iH4--;
    let iClimb = 0; for (let i = 0; i < S.length; i++) { if (S[i][0][0] === 'k') iClimb = i; else if (iClimb && S[i][0][0] !== 'k') break; }
    const at = {};   // erste Lage jedes Bildes beim Fressen und Hinlegen (t0, t1…, n0…, l0…)
    for (let i = iT0; i < S.length; i++) if (!at[S[i][0]]) at[S[i][0]] = S[i];
    const iK0 = S.findIndex(p => p[0][0] === 'k');
    return { S, idx, iT0, iH4, iClimb, iK0, rotB: S[iT0][4], at };
  }
  const P0 = (s) => ({ k: s[0], x: s[1], y: s[2], z: s[3], r: s[4], d: s[5] });
  // Lauf über die Wiese links verlängern bis über den Wiesenrand hinaus (Laufbilder im 15er-Takt). Die Wiese läuft ab
  // etwa 55 % ihres Halbmessers (MR) weich in den Hintergrund aus; das Eichhörnchen verschwindet mit ihr (fadeAt) –
  // dahinter ist kein Boden mehr, aus dem Bild laufen ginge nur über den leeren Hintergrund.
  const X_OUT = -5.6;
  function meadowExt(S, dx = 0) {   // dx: um so viel wird der Lauf danach noch verschoben
    const step = S[15][1] - S[0][1], out = [];
    for (let n = 1; n < 40 && S[0][1] + dx - step * (n - 1) > X_OUT; n++)
      for (let i = 14; i >= 0; i--) out.unshift({ ...P0(S[i]), x: S[i][1] - step * n });
    return out;
  }
  const fadeAt = (p) => p.y > 0.6 ? 1 : 1 - smooth((Math.hypot(p.x, p.z) - MR * 0.73) / (MR * 0.19));
  function timed(pts) { let t = 0; for (const p of pts) { p.t = t; t += p.d; } return { pts, total: t }; }
  // ---- Stamm: rechts hinauf, an der Seite mit dem Astloch. Der gebackene Einzugsweg läuft auf Stufe 6–8 schräg über die
  // Stammmitte – genau dort hängt seit 24.10. der Nistkasten (vorn links, −32°); auf Stufe 6 liefe das Eichhörnchen
  // mitten durch ihn hindurch. Kletterlinie aus Stammachse und Rinde (dickster Ast wie holeFx, Wurzelanlauf wie dort),
  // 40° rechts der Blickrichtung; Tiefe vor der vordersten Rinde (Buckel mitgerechnet), damit der Stamm nichts verdeckt.
  const TH = 40 * Math.PI / 180;
  let kidsFor = null, kids = null;
  const _ta = new V();
  function trunkAt(y) {
    if (!tree || !rad) return null;
    if (kidsFor !== tree) { kids = {}; for (let i = 1; i < tree.parent.length; i++) (kids[tree.parent[i]] = kids[tree.parent[i]] || []).push(i); kidsFor = tree; }
    let i = 0;
    for (let k = 0; k < 400; k++) {
      const c = kids[i]; if (!c || !c.length) break;
      const j = c.reduce((a, b) => rad[b] > rad[a] ? b : a), a = tree.pos[i], b = tree.pos[j];
      if (b.y >= y) {
        const u = Math.min(1, Math.max(0, (y - a.y) / Math.max(1e-6, b.y - a.y))); _ta.copy(a).lerp(b, u);
        return { ax: _ta.dot(STAGE_R), az: _ta.dot(STAGE_D), r: (rad[i] * (1 - u) + rad[j] * u) * (1 + Math.exp(-Math.max(0, y) * 2.4) * 1.1) };
      }
      i = j;
    }
    return null;
  }
  const lineAt = (y) => { const t = trunkAt(y); return t ? { x: t.ax + Math.sin(TH) * t.r, z: t.az + t.r * 1.12 + 0.04 } : null; };
  // Wiese bis zum Stammfuß – von RECHTS (Nutzer 26.10.: am Stamm Rücken nach außen): der gebackene Lauf (kommt von links)
  // an der Kletterlinie gespiegelt, Bilder gespiegelt, Drehung umgekehrt. So geht alles ohne Umklappen ineinander über:
  // von rechts kommend richtet es sich auf, Bauch zum Stamm (links), und klettert so hinauf; hinunter kopfunter, Bauch zum
  // Stamm, unten dreht es sich nach rechts weg (läuft rechts aus dem Bild). Nur oben am Ast dreht es sich einmal um.
  function meadowPart(Q) {
    const L0 = lineAt(Q.S[Q.iK0][2]), x0 = Q.S[Q.iK0][1];
    if (!L0) return [...meadowExt(Q.S), ...Q.S.slice(0, Q.iK0).map(P0)];
    const c = L0.x + x0, pts = [...meadowExt(Q.S, -c), ...Q.S.slice(0, Q.iK0).map(P0)];
    for (const p of pts) { p.x = c - p.x; p.r = -p.r; p.mir = true; }
    return pts;
  }
  // an der Linie hinauf (Kletterbilder im Wechsel wie beim Einzug, nach der Linie geneigt)
  function climbPart(y0, y1, speed = 1.0, ms = 80) {
    const pts = [], n = Math.max(2, Math.round((y1 - y0) / speed * 1000 / ms));
    for (let i = 0; i <= n; i++) {
      const y = y0 + (y1 - y0) * i / n, L = lineAt(y), L2 = lineAt(y + 0.05);
      const rot = Math.max(-0.35, Math.min(0.35, -Math.atan2(L2.x - L.x, 0.05)));
      pts.push({ k: CLIMBF[i % 5], x: L.x, y, z: L.z, r: rot, d: ms, mir: true });
    }
    return pts;
  }
  // Weg zum Ast: Wiese, rechts am Stamm hinauf bis der Kopf über dem Wohnast ist, hinaufziehen (h0, h1 schräg), dann der
  // gebackene Weg auf dem Ast bis zum Stehen (t0)
  function pathAst(Q) {
    const S = Q.S, y0 = S[Q.iK0][2];
    if (!lineAt(y0)) return timed([...meadowExt(S), ...S.slice(0, Q.iT0 + 1).map(P0)]);   // (Baum noch nicht da: wie beim Einzug)
    let iB = Q.iClimb + 1; const top0 = lineAt(1.2);
    while (iB < Q.iT0 && !(Math.abs(S[iB][4] - Q.rotB) < 0.01 && S[iB][1] >= top0.x + 0.08)) iB++;
    const b = S[iB], feet = b[2] - FRAME(b[0]).h / 2;
    const c = climbPart(y0, feet - 0.24), t = c[c.length - 1];
    // hinauf: h0, h1 schräg (hochziehen, dreht sich dabei vom Stamm zum Ast); hinunter (rückwärts): Laufbilder kb mit
    // Drehung rb – am Ast gespiegelt (Kopf schräg links unten, Bauch zum Ast), am Stamm ungespiegelt kopfunter (Bauch zum Stamm)
    const up = [{ k: 'h0', x: t.x + (b[1] - t.x) * 0.3, y: t.y + (b[2] - t.y) * 0.5, z: t.z, r: 0.75, d: 80, kb: 'g6', rb: -1.87, kbm: false },
      { k: 'h1', x: t.x + (b[1] - t.x) * 0.65, y: t.y + (b[2] - t.y) * 0.85, z: (t.z + b[3]) / 2, r: 0.3, d: 80, kb: 'g5', rb: 0.6, kbm: true }];
    return timed([...meadowPart(Q), ...c, ...up, ...S.slice(iB, Q.iT0 + 1).map(P0)]);
  }
  // Weg ins Astloch: an der Linie hinauf bis knapp unter das Loch, dann (wie winter.js) auf die Lochmitte zu und hindurch,
  // bis auch die Schwanzspitze hinter dem oberen Lochrand ist
  function holeStage() {
    if (!holeFx.placed) return null;
    const r = holeFx.radius() * 1.04, w = holeFx.A.clone().addScaledVector(holeFx.N, r);
    return { x: w.dot(STAGE_R), y: w.y, z: w.dot(STAGE_D) };
  }
  function pathLoch(Q) {
    const H = holeStage(), y0 = Q.S[Q.iK0][2]; if (!H || !lineAt(y0)) return null;
    const f = SEQ.frames.k2, O = OPEN();
    const pts = [...meadowPart(Q), ...climbPart(y0, Math.max(y0 + 0.1, H.y - f.h * 0.46 - 0.22))];
    const a0 = pts[pts.length - 1];
    const ang = Math.atan2(H.y - a0.y, H.x - a0.x), rot = ang - Math.PI / 2, c = Math.cos(ang), s = Math.sin(ang);
    const head = f.h * 0.46;
    const dx0 = H.x - c * head - a0.x, dy0 = H.y - s * head - a0.y, l0 = Math.max(1e-3, Math.hypot(dx0, dy0));
    const len = l0 + f.h * 1.0 + O.y * 1.15, ux = dx0 / l0, uy = dy0 / l0;
    const n = Math.max(2, Math.round(len / SPEED * 1000 / FR));
    const zEnd = Math.max(H.z + 0.16, a0.z - 0.05);
    for (let i = 1; i <= n; i++) {
      const d = i / n * len;
      pts.push({ k: CLIMBF[i % 5], x: a0.x + ux * d, y: a0.y + uy * d, z: a0.z + (zEnd - a0.z) * Math.min(1, d / Math.max(1e-3, len - f.h)), r: rot, d: FR, diag: true, mir: true });
    }
    const p = timed(pts); p.H = H; return p;
  }
  // ---- feste Bildfolgen auf dem Ast
  function posOf(Q, k) {   // Lage eines Bildes: wie sein Vorbild (gebacken), neue Bilder mit Versatz
    const nf = NF[k], base = Q.at[nf ? nf.of : k] || Q.at.t0;
    return { k, x: base[1] + (nf ? nf.dx : 0), y: base[2] + (nf ? nf.dy : 0), z: base[3], r: base[4] };
  }
  const F = (Q, k, d, o = {}) => ({ ...posOf(Q, k), d, ...o });
  function wakeFrames(Q) {
    return [F(Q, 'l5m', 600), F(Q, 'wach', 1100), F(Q, 'l5m', 130), F(Q, 'wach', 800),
      F(Q, 'l4', 360), F(Q, 'l3', 300), F(Q, 'l2', 280), F(Q, 't0', 520),
      F(Q, 'streck1', 1800, { st: [0.26, 0.97, 1.04] }), F(Q, 't0', 380),
      F(Q, 'streck2', 1400, { st: [0.81, 0.98, 1.03] }), F(Q, 't0', 650),
      F(Q, 't0', 280, { mirror: true })];
  }
  function eatFrames(Q, kind) {
    const h = kind === 'hasel';
    const whole = h ? ['n0h', 'n2h', 'n1h', 'n2h', 'n0h', 'n2h', 'n1h', 'n2h'] : ['n0', 'n1', 'n2', 'n1', 'n5', 'n2', 'n1', 'n2'];
    const bitten = h ? ['n3h', 'n4h', 'n3h', 'n4h', 'n3h', 'n4h'] : ['n3', 'n4', 'n3', 'n4', 'n3', 'n4'];
    const fr = [F(Q, 'l1', 240, { nose: true }),
      F(Q, h ? 't2h' : 't2', 160), F(Q, h ? 't3h' : 't3', 160), F(Q, h ? 't4h' : 't4', 220)];
    whole.forEach((k, i) => fr.push(F(Q, k, k.startsWith('n2') ? 230 : 180 + (i === 4 ? 120 : 0))));
    bitten.forEach((k) => fr.push(F(Q, k, k.startsWith('n4') ? 280 : 210)));
    fr.push(F(Q, 'l0', 800), F(Q, 'l1', 240), F(Q, 'l2', 240), F(Q, 'l3', 280), F(Q, 'l4', 450), F(Q, 'l5m', 600));
    return fr;
  }
  // ---- Ablauf als Folge von Abschnitten: { frames } | { path, back, nut } | { hide }
  let plan = null, si = 0, st = 0, last = 0, next = -1, info = null;
  function makePlan(o = {}) {
    const stg = Math.min(10, Math.max(6, Math.round(P))), Q = seqOf(stg);
    const autumn = o.autumn ?? season === 'herbst';
    const kindOf = () => autumn ? (Math.random() < 0.5 ? 'hasel' : 'eichel') : 'hasel';
    const A = pathAst(Q), segs = [];
    segs.push({ ph: 'wach', frames: timed(wakeFrames(Q)) });
    segs.push({ ph: 'weg', path: A, back: true, skip: Q.S.slice(Q.iH4, Q.iT0 + 1).reduce((a, s) => a + s[5], 0) });   // ohne Stehen am Ende
    segs.push({ ph: 'fort', hide: rr(10000, 20000) });
    if (autumn) {
      const L = pathLoch(Q), n = L ? (Math.random() < 0.65 ? 1 : 2) : 0;
      for (let i = 0; i < n; i++) {
        segs.push({ ph: 'loch', path: L, back: false, nut: kindOf() });
        segs.push({ ph: 'drin', hide: rr(1500, 2600) });
        segs.push({ ph: 'raus', path: L, back: true });
        segs.push({ ph: 'fort', hide: rr(7000, 13000) });
      }
    }
    const kind = kindOf();
    segs.push({ ph: 'zurueck', path: A, back: false, nut: kind });
    segs.push({ ph: 'essen', frames: timed(eatFrames(Q, kind)), nut: kind });
    return segs;
  }
  function setQuad(m, key, x, y, z, rot, mirror, sx = 1) {
    const f = FRAME(key); m.material.map = tex[key];
    m.userData.ref = stageToWorld(x, y, SEQ.zref); m.userData.zd = z;
    m.userData.base = new V(f.w * sx * (mirror ? -1 : 1), f.h, 1);
    m.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, rot)); m.visible = true;
  }
  function late() { for (const m of [spr, nut]) if (m.visible && m.userData.ref) depthPlace(m, m.userData.ref, m.userData.base, m.userData.zd); }
  const nightF = () => __mix(...__NIGHT.pics, __nightS.k);
  function shade(m, s) { m.material.color.copy(m.material.userData.__pic || new THREE.Color(0.94, 0.94, 0.94)).multiplyScalar(s * (m.material.userData.__pic ? nightF() : 1)); }
  function hide() { spr.visible = nut.visible = false; hm.value = 0; }
  function atT(P2, t) { let lo = 0, hi = P2.length - 1, i = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (P2[m].t <= t) { i = m; lo = m + 1; } else hi = m - 1; } return P2[i]; }
  // Nuss an der Nase (Bild k an Stelle p, gedreht rot, gespiegelt?)
  function showNut(kind, p, k, rot, mirror, path) {
    const f = FRAME(k), nz = NOSE[k] || [0.95, 0.5], sx = mirror ? -1 : 1, c = Math.cos(rot), s = Math.sin(rot);
    const nx = (nz[0] - 0.5) * f.w * sx, ny = (0.5 - nz[1]) * f.h;
    const ex = p.x + c * nx - s * ny, ey = p.y + s * nx + c * ny - 0.02;
    let sh = 1, hidden = false;
    if (p.diag && path && path.H) {   // im Loch: wie das Bild – in der Öffnung dunkler, dahinter weg
      const O = OPEN(), ox = ex - path.H.x, oy = ey - path.H.y, w = (-s * ox + c * oy) / O.y, e = Math.hypot(ox / O.x, oy / O.y);
      hidden = w > 0.55 || (w > 0 && e > 0.85);
      const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      sh = 1 - 0.95 * sm(-0.6, 0.45, w) * (w < 0 ? 1 - sm(0.8, 1, e) : 1);
    }
    if (hidden) { nut.visible = false; return; }
    const fe = FRAME(kind); nut.material.map = tex[kind]; shade(nut, sh);
    nut.userData.ref = stageToWorld(ex, ey, SEQ.zref); nut.userData.zd = p.z - 0.01;
    nut.userData.base = new V(fe.w * (kind === 'hasel' ? 0.9 : 1), fe.h * (kind === 'hasel' ? 0.9 : 1), 1);
    nut.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, rot + (mirror ? 0.3 : -0.3))); nut.visible = true;
  }
  function showPath(seg, t) {
    const path = seg.path, back = seg.back;
    const p = atT(path.pts, back ? path.total - t : t);
    // Spiegeln: Laufbilder schauen nach rechts – vorwärts (zum Ast) ungespiegelt, rückwärts gespiegelt. Am Stamm (mir, Nutzer
    // 26.10.: „der Rücken sollte nach außen zeigen“): der Stamm liegt links vom Eichhörnchen, also Bauch nach links – hinauf
    // gespiegelt, hinunter ungespiegelt und kopfunter gedreht (die Kletterbilder haben den Bauch rechts)
    const kb = back && p.kb, k = kb ? p.kb : p.k, climb = k[0] === 'k';
    const mirror = kb ? p.kbm !== false : back !== !!p.mir, rot = kb ? p.rb : back && climb ? p.r + Math.PI : p.r;
    setQuad(spr, k, p.x, p.y, p.z, rot, mirror); shade(spr, 1);
    const fa = fadeAt(p); spr.material.opacity = nut.material.opacity = fa; if (fa < 0.01) spr.visible = false;
    hm.value = 0;
    if (p.diag && path.H) {   // am Loch: Lochmitte in Bild-Koordinaten; ganz hinter dem oberen Rand → nicht mehr zeichnen
      const O = OPEN(), f = FRAME(k), c = Math.cos(rot), s = Math.sin(rot), dx = path.H.x - p.x, dy = path.H.y - p.y, sx = mirror ? -1 : 1;
      const u = sx * (c * dx + s * dy) / f.w + 0.5, v = (-s * dx + c * dy) / f.h + 0.5;
      hc.value.set(u, v); hs.value.set(sx * f.w, f.h); hk.value.set(c, s); hr.value.set(O.x, O.y); hm.value = back ? -1 : 1;
      const outer = back ? (1 - v) * f.h : v * f.h;
      if (outer < -O.y * 1.02) spr.visible = false;
    }
    if (seg.nut && !back) showNut(seg.nut, p, k, rot, mirror, path); else nut.visible = false;
    info = { ph: seg.ph, k, x: p.x, y: p.y, mirror, nut: nut.visible ? seg.nut : null, sichtbar: spr.visible };
  }
  function showFrames(seg, t) {
    const p = atT(seg.frames.pts, t), u = Math.min(1, (t - p.t) / p.d);
    let x = p.x, sx = 1;
    if (p.st) {   // Strecken: langsam etwas länger werden, Fußpunkt bleibt (Anteil der Breite von links)
      const e = u * u * (3 - 2 * u); sx = p.st[1] + (p.st[2] - p.st[1]) * e;
      x += (p.st[0] - 0.5) * FRAME(p.k).w * (1 - sx);
    }
    setQuad(spr, p.k, x, p.y, p.z, p.r, !!p.mirror, sx); shade(spr, 1); hm.value = 0; spr.material.opacity = nut.material.opacity = 1;
    if (p.nose && seg.nut) showNut(seg.nut, p, p.k, p.r, !!p.mirror, null); else nut.visible = false;
    info = { ph: seg.ph, k: p.k, x: p.x, y: p.y, mirror: !!p.mirror, nut: nut.visible ? seg.nut : null, sichtbar: true };
  }
  const durOf = (seg) => seg.frames ? seg.frames.total : seg.path ? seg.path.total - (seg.skip || 0) : seg.hide;
  const okNow = () => P > 5.95 && season !== 'winter' && !reduceMotion && !trans && !moveIn && !jayFx.active && !seqPlayer.active() && !winterFx.active;
  const can = () => okNow() && !__isNight() && !visitFx.active && !!(window.__sq && window.__sq.placed);
  // erst wenn der Baum zur Stufe gezeichnet ist (Radien rad[] folgen der Stufe erst im nächsten Bild) und die schlafende
  // Figur auf dem Ast liegt – sonst merken und im nächsten passenden Bild beginnen
  const treeNow = () => !!tree && Tshown === T && Math.abs(T - PtoT(P)) < 1e-6;
  let pend = null;
  function start(o = {}) {
    if (!(okNow() && (o.force || !__isNight()))) return false;
    if (!(window.__sq && window.__sq.placed) && !moveIn) squirrel.place();
    if (!treeNow() || !(window.__sq && window.__sq.placed)) { pend = o; return true; }
    pend = null; plan = makePlan(o); si = 0; st = 0; last = nowMs(); return true;
  }
  function stop() { plan = null; pend = null; info = null; hide(); }
  function step(dt) {   // dt in s
    if (!plan) return;
    if (!okNow()) { stop(); return; }
    st += dt * 1000;
    while (plan && st >= durOf(plan[si])) { st -= durOf(plan[si]); si++; if (si >= plan.length) { stop(); return; } }
    const seg = plan[si];
    if (seg.hide != null) { hide(); info = { ph: seg.ph, sichtbar: false }; return; }
    if (seg.frames) showFrames(seg, st); else showPath(seg, st + (seg.back ? (seg.skip || 0) : 0));
  }
  function frame() {
    const now = nowMs(), dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    if (!plan && pend) { if (!okNow()) pend = null; else if (treeNow()) start(pend); }
    if (!plan) {
      hide();
      if (next < 0) next = rr(40, 90);
      if (can()) { next -= dt; if (next <= 0 && !window.__eichTagHold) { start(); next = rr(180, 360); } }
      return;
    }
    if (window.__eichTagFreeze) { step(0); return; }
    step(dt);
  }
  // Prüfhilfen: Zustand, Vorspulen (s), an eine Stelle springen (Abschnitt, ms)
  Object.defineProperty(window, '__eichTag', { get: () => plan ? { ...info, abschnitt: si, t: Math.round(st), plan: plan.map(s => s.ph + (s.nut ? ':' + s.nut : '')) } : null, configurable: true });
  window.__eichTagSim = (s) => { for (let k = 0; k < Math.round(s / 0.05) && plan; k++) step(0.05); return window.__eichTag; };
  Object.defineProperty(window, '__eichTagNext', { get: () => next, set: (v) => { next = v; }, configurable: true });   // s bis zum nächsten Mal
  window.__eichTagSeek = (i, ms) => { if (!plan) return null; si = Math.min(plan.length - 1, i); st = 0; step(ms / 1000); return window.__eichTag; };
  // Prüfhilfen: Welt → Bühne; Kamera nah an eine Bühnenstelle (x, y) – für window.__camOv
  window.__eichBuehne = (a) => { const w = new V().fromArray(a); return [w.dot(STAGE_R), w.y, w.dot(STAGE_D)].map(v => +v.toFixed(3)); };
  window.__eichCam = (x = 1.2, y = 1.5, d = 2.4, up = 0.18) => { const t = stageToWorld(x, y, 0.35); const p = t.clone().addScaledVector(STAGE_D, d).addScaledVector(STAGE_U, up * d); return { p: p.toArray(), t: t.toArray() }; };
  return { frame, late, start, stop, get active() { return !!plan; }, get away() { return !!plan; } };
})();
// ------------------------------------------------------------------ Glühwürmchen-Tanz (Sommernacht, 26.10.)
// Nutzer: für den Play-Knopf auch Nacht-Animationen – zuerst Glühwürmchen. Zu den Glühwürmchen, die in Sommernächten ohnehin
// über der Wiese schweben (__makeNightFx), steigen für etwa 26 s viele weitere aus dem Gras auf, kreisen langsam um den Baum
// (hinauf bis knapp in die Krone; bei großen Bäumen außen um die Krone und unter ihr, mehr davon), blinken und treiben am Ende
// auseinander und verglimmen. Gleiches Licht wie die vorhandenen (Kern + Hof, gelbgrün, nur Licht dazu); Bewegung ganz im
// Grafikprogramm (uT = Zeit im Tanz).
// Kommt auch von selbst: in Sommernächten erstes Mal nach 40–100 s, dann alle 4–8 min. Nicht bei „Weniger Bewegung“.
const gluehFx = (() => {
  const N = 170, DUR = 26;   // kleiner Baum 110, großer alle 170
  const r = mulberry32(4242);
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 4), idx = new Float32Array(N);
  for (let i = 0; i < N; i++) { seed.set([r(), r(), r(), r()], i * 4); idx[i] = (i + 0.5) / N; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4)); g.setAttribute('aI', new THREE.BufferAttribute(idx, 1));
  // uH: Höhe bis knapp in die Krone; uR: äußerer Kreis (bei großen Bäumen außen an der Krone, sonst wären sie im Laub verborgen);
  // uRs: Startkreis auf der sichtbaren Wiese; uK: wie weit sie zum Kreis hin ziehen (kleiner Baum halb, großer ganz); uN: Anteil
  const U = { uTime: leafUniforms.uTime, uT: { value: 0 }, uAmt: { value: 0 }, uH: { value: 2 }, uR: { value: 2.5 }, uRs: { value: 3 }, uK: { value: 0.5 }, uN: { value: 0.65 }, uScale: { value: 1 }, uPR: { value: 1 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: `
    attribute vec4 aSeed; attribute float aI; uniform float uTime, uT, uAmt, uH, uR, uRs, uK, uN, uScale, uPR; varying float vA;
    void main(){
      float ph = aSeed.x * 6.2832, dir = aSeed.w < .5 ? -1. : 1.;
      float e1 = smoothstep(0., 6., uT - aSeed.z * 1.5);          // aufsteigen (nacheinander)
      float e3 = smoothstep(${DUR - 8}., ${DUR}., uT);              // auseinander, verglimmen
      float ang = ph + dir * uT * (.16 + .2 * aSeed.y);
      float r0 = mix(1.2, uRs, aSeed.y);                           // Startkreis auf der Wiese
      float rad = mix(r0, mix(.9, uR, aSeed.z), e1 * uK) + e3 * (1.5 + 2. * aSeed.y);   // zum Kreis hin (die hohen außen)
      float h = mix(.08 + .14 * aSeed.z, .2 + pow(aSeed.z, 1.4) * uH, e1) + sin(uT * .6 + ph * 2.) * .2 * e1 + e3 * .7;
      vec3 p = vec3(cos(ang) * rad, h, sin(ang) * rad);
      p += vec3(sin(uTime * 1.3 + ph) * .1, sin(uTime * 1.7 + ph * 1.3) * .08, cos(uTime * 1.1 + ph) * .1);
      vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
      float b = sin(uTime * (.8 + .9 * aSeed.y) + ph * 3.) * .5 + .5;
      vA = uAmt * (1. - e3) * smoothstep(0., 1.2, uT - aSeed.z * 1.5) * (.3 + .7 * smoothstep(.3, .9, b)) * step(aI, uN);
      gl_PointSize = clamp(.4 * uScale / -mv.z, 7., 44.) * uPR * step(aI, uN);
    }`,
    fragmentShader: `
    varying float vA;
    void main(){ vec2 c = gl_PointCoord * 2. - 1.; float d = length(c); if (d > 1.) discard;
      float core = smoothstep(.22, .0, d), halo = pow(1. - d, 2.2) * .55;
      gl_FragColor = vec4(mix(vec3(.8, 1., .38), vec3(1., 1., .85), core) * (core * 1.3 + halo), vA); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 30; pts.userData.__night = true; scene.add(pts);
  let t = -1, fade = 1, last = 0, next = -1, force = false;
  const rr = (a, b) => a + Math.random() * (b - a);
  const ok = () => season === 'sommer' && !reduceMotion && !trans;
  function start(o = {}) {
    if (reduceMotion || !(o.force || (__isNight() && season === 'sommer'))) return false;
    t = 0; fade = 1; force = !!o.force; last = nowMs(); return true;
  }
  function stop() { t = -1; pts.visible = false; }
  function frame() {
    const now = nowMs(), dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    if (t < 0) {
      if (next < 0) next = rr(40, 100);
      if (ok() && __isNight()) { next -= dt; if (next <= 0 && !window.__gluehHold) { start(); next = rr(240, 480); } }
      return;
    }
    if (window.__gluehT != null) t = window.__gluehT; else t += dt;
    if (!force && (!__isNight() || season !== 'sommer')) fade = Math.max(0, fade - dt / 1.5);   // Tag oder Herbst: rasch aus
    if (t > DUR || fade <= 0 || reduceMotion) { stop(); return; }
    U.uT.value = t; U.uAmt.value = fade * (force ? 1 : Math.max(0.25, __nightS.k));
    const big = Math.min(1, Math.max(0, (crownW - 3) / 5));   // 0 bis Stufe 4, 1 ab Stufe 8
    U.uH.value = Math.min(4.2, Math.max(1.2, Math.min(grownTop * 0.8, crownBase + 1.2)));
    U.uR.value = Math.min(6, Math.max(1.7, crownW * 0.6)); U.uRs.value = Math.min(U.uR.value * 1.25, MR * 0.72);
    U.uK.value = 0.5 + 0.5 * big; U.uN.value = (110 + 60 * big) / N;
    U.uScale.value = H() / (2 * Math.tan(camera.fov * Math.PI / 360)); U.uPR.value = renderer.getPixelRatio();
    pts.visible = true;
  }
  window.__glueh = () => t >= 0 ? { t: +t.toFixed(2), sichtbar: pts.visible, h: +U.uH.value.toFixed(2), r: +U.uR.value.toFixed(2) } : null;
  window.__gluehMass = () => ({ crownW: +crownW.toFixed(2), crownBase: +crownBase.toFixed(2), grownTop: +grownTop.toFixed(2), P });
  return { start, stop, frame, get active() { return t >= 0; }, DUR };
})();

// ------------------------------------------------------------------ Play-Knopf: eine passende Animation auf Knopfdruck (26.10.)
// Nutzer: In der großen Baum-Ansicht ein Play-Knopf, der eine beliebige Animation auslöst – passend zu Stufe, Jahreszeit und
// Tageszeit; neue Animationen kommen automatisch dazu: jede neue Animation meldet sich hier mit PLAY.add({ … }) an.
// Ohne Marienkäfer (Nutzer: zu klein). Zufällig, nie zweimal hintereinander dasselbe und nichts, was gerade schon läuft.
// Gesperrt, solange etwas läuft – die gestartete Animation, eine, die von selbst gekommen ist (jede angemeldete zählt, höchstens
// max s lang, dann wieder frei, auch wenn die Besucher noch bleiben), oder der Baum beschäftigt ist (Wachsen, Einzug, Häher,
// Eichhörnchen unterwegs: die brechen sich gegenseitig ab, darum ohne Zeitgrenze). Passt gerade nichts (nachts bisher nur Glühwürmchen
// und Igel im Sommer): 'still' – die App zeigt „Heute Nacht ist es still“. Beim Drücken dreht die Kamera sanft in die
// Vorderansicht (Nutzer; der Zoom bleibt; Ziehen beendet das Drehen): die Tiere sind gemalte Bilder in der Bühnenebene.
// Eintrag: { id, ab, bis (Stufen), zeiten (Jahreszeiten), nacht (true = nur nachts, sonst nur tagsüber), ok() (weitere
// Bedingung, z. B. Igel wach), start() → true/false, aktiv() (läuft sie gerade?), max (s Sperre höchstens) }.
let __faceFront = false;
controls.addEventListener('start', () => { __faceFront = false; });
window.__camAz = () => { const o = camera.position.clone().sub(controls.target); return { az: +Math.atan2(o.x, o.z).toFixed(3), AZ0: +AZ0.toFixed(3), dreht: __faceFront }; };   // Prüfhilfe
const PLAY = (() => {
  const ALL = ['fruehling', 'sommer', 'herbst', 'winter'];
  const list = [], seit = new Map();   // seit: id → seit wann sie läuft (auch von selbst gekommen)
  let last = null, run = null;
  function add(e) { list.push({ ab: 0, bis: 10, zeiten: ALL, nacht: false, max: 60, ...e }); }
  const passt = (e) => { const s = Math.round(P); return s >= e.ab && s <= e.bis && e.zeiten.includes(season) && !!e.nacht === __isNight() && (!e.ok || !!e.ok()); };
  const beschaeftigt = () => trans || anim || moveIn || jayFx.active || visitFx.active || seqPlayer.active() || winterFx.active || eichTagFx.active;
  const laeuft = () => { const now = nowMs(); return list.find(e => seit.has(e.id) && (now - seit.get(e.id)) / 1000 < e.max) || null; };
  const kandidaten = () => list.filter(e => passt(e) && !(e.aktiv && e.aktiv()));
  function play() {
    if (reduceMotion || run || beschaeftigt() || laeuft()) return false;
    let c = kandidaten(); if (c.length > 1) c = c.filter(e => e.id !== last);
    while (c.length) {
      const e = c.splice(Math.floor(Math.random() * c.length), 1)[0];
      if (e.start()) { last = e.id; run = { e, t0: nowMs(), seen: false }; __faceFront = true; return e.id; }
    }
    return false;
  }
  function frame() {
    const now = nowMs();
    for (const e of list) { if (!(e.aktiv && e.aktiv())) seit.delete(e.id); else if (!seit.has(e.id)) seit.set(e.id, now); }
    if (!run) return;
    const a = !!(run.e.aktiv && run.e.aktiv()), t = (now - run.t0) / 1000;
    if (a) run.seen = true;
    if ((run.seen && !a) || t > run.e.max || (!run.seen && t > 8)) run = null;
  }
  function zustand() {
    if (reduceMotion) return { zustand: 'aus' };
    const l = run ? run.e : laeuft();
    if (l || beschaeftigt()) return { zustand: 'laeuft', id: l ? l.id : null, nacht: __isNight() };
    return { zustand: kandidaten().length ? 'bereit' : 'still', nacht: __isNight() };
  }
  window.__play = () => ({ ...zustand(), passend: list.filter(passt).map(e => e.id), alle: list.map(e => e.id), seit: [...seit.keys()] });
  return { add, play, frame, zustand, stop() { run = null; } };
})();
// die vorhandenen Animationen (der Marienkäfer nicht: Nutzer 26.10.)
PLAY.add({ id: 'eichel', ab: 0, bis: 0, start: () => { __api.jay(); return true; }, aktiv: () => jayFx.active, max: 20 });   // Stufe 0: der Häher bringt die Eichel noch einmal
PLAY.add({ id: 'haeher', ab: 1, start: () => __api.visit(), aktiv: () => visitFx.active, max: 30 });
PLAY.add({ id: 'zitronenfalter', ab: 1, zeiten: ['fruehling', 'sommer', 'herbst'], start: () => __api.butterfly(), aktiv: () => falterFx.active });
PLAY.add({ id: 'hummel', ab: 2, zeiten: ['fruehling', 'sommer'], start: () => hummelFx.now(), aktiv: () => hummelFx.active });
PLAY.add({ id: 'blaeulinge', ab: 2, zeiten: ['sommer'], start: () => schmetterlingFx.blau.now(), aktiv: () => schmetterlingFx.blau.active });
PLAY.add({ id: 'pfauenauge', ab: 3, zeiten: ['fruehling', 'sommer'], start: () => schmetterlingFx.pfau.now(), aktiv: () => schmetterlingFx.pfau.active });
PLAY.add({ id: 'kohlmeisen', ab: 3, start: () => meisenFx.visitNow(), aktiv: () => meisenFx.active, max: 40 });
PLAY.add({ id: 'kraehen', ab: 4, zeiten: ['herbst', 'winter'], start: () => kraehenFx.now(), aktiv: () => kraehenFx.active });
PLAY.add({ id: 'eichhoernchen', ab: 6, zeiten: ['fruehling', 'sommer', 'herbst'], start: () => eichTagFx.start(), aktiv: () => eichTagFx.active, max: 130 });
PLAY.add({ id: 'eichhoernchen-winter', ab: 6, zeiten: ['winter'], start: () => winterFx.start(false), aktiv: () => winterFx.active, max: 45 });
PLAY.add({ id: 'gluehwuermchen', ab: 0, zeiten: ['sommer'], nacht: true, start: () => gluehFx.start(), aktiv: () => gluehFx.active, max: gluehFx.DUR + 2 });
// ------------------------------------------------------------------ Laubhaufen des Igels (ab Stufe 4, 27.10.)
// Nutzer 27.10.: Für den Winterschlaf des Igels ein Laubhaufen rechts neben dem Baum, etwas zurückgesetzt, nahe am Rand
// der Wiese. Er entsteht langsam im Herbst (wächst mit dem Laubfall), der Igel zieht einmal ein und bleibt den ganzen
// Winter darin, im Frühling kommt er einmal heraus, danach versinkt der Haufen langsam in der Erde. Je Baumstufe ein klein
// bisschen größer. Nutzer: aus echten Blättern wie das Falllaub auf der Wiese (nicht gemalt) – also bekommt er Licht,
// Baumschatten, Nacht und Schnee wie alles andere.
// Bau: flache Blätter (dieselben gemalten Blätter wie das Falllaub, Feld 15 des Wiesen-Atlas) – an der Oberfläche kreuz und
// quer gekippt, viele auch im Inneren, ein paar lose rundherum; darunter ein dunkler Laubkern (Halbkugel mit Rauschen), damit
// man nirgends durch den Haufen hindurchsieht (Nutzer 27.10.: erste Fassung „wie ein Iglu, innen hohl“). Form unregelmäßig
// und flach (Rauschen über den Winkel, nf()). Wachsen: die Blätter kommen von unten nach oben dazu, Haufen und Kern werden
// breiter und höher (uA). Altern: im Winter werden die Blätter brauner
// (uOld). Schnee: wie auf der Wiese (uSnow) auf den nach oben zeigenden Blättern. Versinken: die Kuppel sinkt flacher
// werdend unter die Wiese (uSink; was darunter ist, wird nicht gezeichnet). Rascheln: Blätter nahe einer Stelle zittern
// (uRus, für den Igel). Kalender (Tag im Vanamo-Jahr, 0 = Frühlingsanfang): wächst Tag 60–80, voll bis zum Frühling,
// versinkt Tag 9–17 (nach dem Aufwachen des Igels, Tag 1,5–8).
// Prüfhilfen: window.__haufen() (Zustand), window.__haufenTag = d (Tag nur für den Haufen erzwingen).
const haufenFx = (() => {
  const N = 720, NSK = 80, NIN = 300;               // Blätter insgesamt, davon lose rundherum und im Inneren
  const POS = { x: 2.7, d: -3.0 };                  // Bühnen-Koordinaten (rechts, zurück, nahe am Wiesenrand)
  const GROW = [60, 80], SINK = [9, 17];            // Tage: Wachsen, Versinken
  const rnd = mulberry32(5150);
  // unregelmäßige Form: Halbmesser und Höhe schwanken mit dem Winkel (gleiche Rechnung im Kern-Shader)
  const nf = (t) => 0.12 * Math.sin(3 * t + 1.3) + 0.07 * Math.sin(5 * t + 0.4) + 0.05 * Math.sin(9 * t + 2.1);
  const surf = (rho, t) => Math.pow(Math.max(0, 1 - rho * rho), 0.5) * (1 + nf(t) * 0.8);   // Höhe (× H) über dem Boden
  const aP = new Float32Array(N * 4), aN = new Float32Array(N * 4), aS = new Float32Array(N * 4), aC = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const skirt = i >= N - NSK, inner = !skirt && i < NIN;
    const t = rnd() * 6.2832, rf = 1 + nf(t);
    let rho, y, nx, ny, nz;
    if (skirt) {                                     // lose Blätter rundherum, flach
      rho = 1.0 + rnd() * 0.5; y = 0.01 + rnd() * 0.02;
      nx = (rnd() - 0.5) * 0.4; ny = 1; nz = (rnd() - 0.5) * 0.4;
    } else if (inner) {                              // im Inneren: kreuz und quer (füllt die Lücken)
      rho = Math.sqrt(rnd()) * 0.92; y = Math.pow(rnd(), 0.8) * surf(rho, t) * 0.92;
      nx = rnd() * 2 - 1; ny = rnd() * 1.4 - 0.4; nz = rnd() * 2 - 1;
    } else {                                         // Oberfläche: stark verkippt, manche stehen heraus
      rho = Math.sqrt(rnd()) * 1.0; y = surf(rho, t) * (0.86 + rnd() * 0.22);
      nx = Math.cos(t) * rho * 0.9 + (rnd() - 0.5) * 1.6; ny = 0.9 + (rnd() - 0.5) * 1.2; nz = Math.sin(t) * rho * 0.9 + (rnd() - 0.5) * 1.6;
    }
    const x = Math.cos(t) * rho * rf, z = Math.sin(t) * rho * rf;
    const nl = Math.hypot(nx, ny, nz) || 1;
    // Schwelle fürs Wachsen: unten und innen zuerst, oben zuletzt; die losen Blätter kommen früh
    const th = skirt ? rnd() * 0.45 : Math.min(0.98, y * 0.72 + rnd() * 0.26 - (inner ? 0.08 : 0));
    aP.set([x, y, z, Math.max(0, th)], i * 4);
    aN.set([nx / nl, ny / nl, nz / nl, rnd() * 6.2832], i * 4);
    aS.set([0.13 + rnd() * 0.09, rnd(), skirt ? 1 : 0, rnd()], i * 4);     // Größe, Zufall (Rascheln), lose?, Anteil (wie viele je Stufe)
    const sub = (rnd() * 4) | 0;
    aC.set([0.75 + (sub % 2) * 0.125, 0.125 - (sub >> 1) * 0.125], i * 2);
  }
  const base = new THREE.PlaneGeometry(1, 1); base.rotateX(-Math.PI / 2);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv')); g.setAttribute('normal', base.getAttribute('normal'));
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 4)); g.setAttribute('aN', new THREE.InstancedBufferAttribute(aN, 4));
  g.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 4)); g.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 2));
  g.instanceCount = N;
  const U = { uR: { value: 0.4 }, uH: { value: 0.25 }, uA: { value: 0 }, uSink: { value: 0 }, uFrac: { value: 1 }, uOld: { value: 0 },
    uRus: { value: new THREE.Vector4(0, 0, 0, 0) }, uRusT: { value: 0 } };
  const m = new THREE.MeshLambertMaterial({ map: meadowTex, alphaTest: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, groundUniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aP; attribute vec4 aN; attribute vec4 aS; attribute vec2 aC;
        uniform float uR, uH, uA, uSink, uFrac, uRusT, uSnow; uniform vec4 uRus;
        varying vec3 vMWP; varying float vHt, vNy;`)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = uv * .125 + aC;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(aN.xyz);')
      .replace('#include <begin_vertex>', `
        float on = step(aP.w, uA) * step(aS.w, uFrac);
        if (aS.z > .5) on *= (1. - smoothstep(.15, .7, uSink)) * (1. - smoothstep(.2, .7, uSnow));   // lose Blätter: vergehen bzw. unter dem Schnee
        float gw = mix(.55, 1., uA), gh = mix(.3, 1., uA);
        vec3 c = vec3(aP.x * uR * gw, aP.y * uH * gh, aP.z * uR * gw);
        if (aS.z < .5) c.y = c.y * (1. - .5 * uSink) - uSink * uH * .5 - uSink * uSink * .06;   // versinkt flacher werdend (Spitze: H·(1−s))
        vec2 dd = c.xz - uRus.xy; float rf = uRus.z * exp(-dot(dd, dd) / max(.001, uR * uR * .6));
        float ph = aS.y * 6.2832;
        c += vec3(sin(uRusT * 31. + ph) * .014, abs(sin(uRusT * 23. + ph * 1.7)) * .022, cos(uRusT * 27. + ph * 2.3) * .014) * rf;
        vec3 n = normalize(aN.xyz);
        vec3 t1 = normalize(cross(n, abs(n.y) < .95 ? vec3(0., 1., 0.) : vec3(1., 0., 0.))), t2 = cross(n, t1);
        float cs = cos(aN.w + rf * sin(uRusT * 19. + ph) * .5), sn = sin(aN.w + rf * sin(uRusT * 19. + ph) * .5);
        vec3 ax = cs * t1 + sn * t2, az = -sn * t1 + cs * t2;
        vec3 transformed = c + (position.x * ax + position.z * az) * aS.x * on;
        vHt = aP.y; vNy = n.y;`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vMWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMWP; varying float vHt, vNy; uniform float uOld, uSnow;\n' + NOISE + MEADOW_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vMWP.y < .003) discard;                                                   // unter der Wiese
        { float l = dot(diffuseColor.rgb, vec3(.299, .587, .114));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * vec3(1.08, .86, .64), uOld * .55) * (1. - uOld * .22); }   // alt und braun
        diffuseColor.rgb *= groundAO(vMWP) * (.86 + .14 * vHt);                        // unten etwas dunkler
        float snowK = uSnow * smoothstep(.15, .7, abs(vNy) * .55 + vHt * .7);           // oben und flach liegende Blätter zuerst
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.9, .93, .98), snowK);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * (uFill + snowK * .22);')   // Schnee etwas heller (wie auf der Wiese)
      .replace('#include <dithering_fragment>', EDGE_OUT);
  };
  // eigener Programm-Schlüssel: __nightify ersetzt onBeforeCompile durch eine immer gleiche Hülle – ohne Schlüssel bekäme der
  // Haufen das schon übersetzte Programm eines anderen Lambert-Materials (z. B. des Falllaubs) und bliebe unsichtbar
  m.customProgramCacheKey = () => 'haufen1';
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.visible = false;
  mesh.position.copy(stageToWorld(POS.x, 0, POS.d));
  __nightify(m);                                    // nachts gleich richtig gefärbt
  scene.add(mesh);

  // Laubkern: dunkle, unregelmäßige Halbkugel unter den Blättern – durch Lücken sieht man dunkles Laub statt der Wiese dahinter
  const cg = new THREE.SphereGeometry(1, 32, 9, 0, Math.PI * 2, 0, Math.PI / 2);
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff });
  cm.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, groundUniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uR, uH, uA, uSink; varying vec3 vMWP; varying float vHt, vNy;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(vec3(normal.x * .7, normal.y * 1.4, normal.z * .7));')
      .replace('#include <begin_vertex>', `
        float t = atan(position.z, position.x), nf = .12 * sin(3. * t + 1.3) + .07 * sin(5. * t + .4) + .05 * sin(9. * t + 2.1);
        float gw = mix(.55, 1., uA), gh = mix(.3, 1., uA), on = smoothstep(.12, .45, uA);
        vec3 transformed = vec3(position.x * (1. + nf) * uR * gw * .74, position.y * (1. + nf * .8) * uH * gh * .7 * on, position.z * (1. + nf) * uR * gw * .74);
        transformed.y = transformed.y * (1. - .5 * uSink) - uSink * uH * .5 - uSink * uSink * .06;
        transformed *= step(.01, on);
        vHt = position.y; vNy = objectNormal.y;`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vMWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMWP; varying float vHt, vNy; uniform float uOld, uSnow;\n' + NOISE + MEADOW_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vMWP.y < .003) discard;
        diffuseColor.rgb = mix(vec3(.07, .04, .025), vec3(.15, .085, .045), vnoise(vMWP.xz * 11. + vMWP.y * 7.)) * (.75 + .25 * vHt) * (1. - uOld * .2);   // dunkles Laub innen
        diffuseColor.rgb *= groundAO(vMWP);
        float snowK = uSnow * smoothstep(.2, .7, vNy * .5 + vHt * .7);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.9, .93, .98), snowK);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * snowK * (uFill + .22);')
      .replace('#include <dithering_fragment>', EDGE_OUT);
  };
  cm.customProgramCacheKey = () => 'haufenKern2';
  const core = new THREE.Mesh(cg, cm); core.receiveShadow = true; core.frustumCulled = false; core.visible = false;
  core.position.copy(mesh.position);
  __nightify(cm);
  scene.add(core);

  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let rus = 0, rusT = 0, last = 0;
  const day = () => { const d = window.__haufenTag ?? (yearSt ? yearSt.d : yearDay); return ((d % YEAR_LEN) + YEAR_LEN) % YEAR_LEN; };
  // Kalender: wie voll (0–1) und wie weit versunken (0–1) am Tag d
  function stand(d) {
    let a = 0, s = 0;
    if (d >= GROW[0] && d < GROW[1]) a = sm(GROW[0], GROW[1], d);
    else if (d >= GROW[1] || d < SINK[1]) a = 1;
    if (d >= SINK[0] && d < SINK[1]) s = sm(SINK[0], SINK[1], d);
    const old = d >= GROW[0] && d < 84 ? 0 : d >= 84 ? Math.min(0.8, (d - 84) / 20 * 0.8) : 0.8;
    return { a, s, old };
  }
  function frame() {
    const now = nowMs(), dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    const st = Math.min(10, P), d = day(), k = stand(d);
    const on = P >= 3.98 && k.a > 0.001 && k.s < 0.999;
    mesh.visible = on; core.visible = on && k.a > 0.12;
    if (!on) return;
    const R = 0.4 + 0.065 * (st - 4);
    U.uR.value = R; U.uH.value = R * 0.62; U.uA.value = k.a; U.uSink.value = k.s; U.uOld.value = k.old;
    U.uFrac.value = Math.min(1, (330 + 390 * sm(4, 10, st)) / N);   // Stufe 4: ~330 Blätter, Stufe 10: alle
    rus = Math.max(0, rus - dt * 0.9); rusT += dt; U.uRus.value.z = rus; U.uRusT.value = rusT;
  }
  // Rascheln an einer Stelle (Welt-Koordinaten), Stärke 0–1, klingt von selbst ab
  function rustle(wx, wz, amt = 1) { U.uRus.value.x = wx - mesh.position.x; U.uRus.value.y = wz - mesh.position.z; rus = Math.max(rus, amt); }
  window.__haufenMesh = mesh;
  window.__haufen = () => ({ tag: +day().toFixed(1), sichtbar: mesh.visible, ...stand(day()), R: +U.uR.value.toFixed(2), rus: +rus.toFixed(2) });
  return { frame, rustle, POS, get R() { return U.uR.value; }, get H() { return U.uH.value; }, get A() { return U.uA.value; },
    get visible() { return mesh.visible; }, center: () => mesh.position.clone(), stand: () => stand(day()) };
})();
// ------------------------------------------------------------------ Igel (ab Stufe 4, 26./27.10.)
// Nutzer 26.10.: Der Igel kommt nachts vorbei, ab Stufe 4. Er trippelt über die Wiese, schnüffelt im Gras und frisst einen
// Wurm (Nutzer: diese drei, ohne Zusammenrollen). Von selbst alle 5–10 Minuten (das erste Mal nach 1–2,5 min; die Uhr läuft
// nur, wenn er kommen darf, solange der Baum läuft), dazu über den Play-Knopf. Nutzer 27.10.: nachts vom Aufwachen im
// Frühling bis zum Winterschlaf im Herbst (wach()); Winterschlaf im Laubhaufen (haufen.js): im Spätherbst kriecht er einmal
// hinein, im Frühling kommt er einmal heraus – jeweils beim ersten Ansehen im Zeitfenster, Tag oder Nacht (Nutzer), auf
// diesem Gerät gemerkt (je Vanamo-Jahr, das Jahr kommt von der App; im Baum-Test nur im Speicher). Zeitfenster (Tag im
// Vanamo-Jahr): Einzug 74–86 (der Haufen ist dann fast fertig), Aufwachen 1,5–8 (der Schnee ist weg); verpasst man es, ist
// er einfach drin bzw. schon wach.
// Größe natürlich (Nase bis Hinterende 0,46 – Häher 0,62, in echt 25 : 34 cm); wäre er kürzer als MIN_PX CSS-Pixel (große
// Stufen, kleine Leinwand), wird er größer gezeichnet, höchstens doppelt so groß (wie die Krähen; gilt für den ganzen
// Besuch). Nachts so dunkel wie die anderen gemalten Tiere und im Gras – Grasbüschel davor verdecken ihn (Nutzer).
// Ablauf (etwa 30–40 s): kommt von links oder rechts über die Wiese vor dem Baum (am Wiesenrand weich herein bzw. von
// hinter dem Bildrand), trippelt (Gliederpuppe: die vier Beine laufen versetzt, leichtes Wippen), hält an,
// schnüffelt am Boden und schnuppert in die Luft, trippelt weiter (manchmal noch ein kurzes Schnüffeln), findet einen Wurm,
// frisst ihn (Wurm lang, dann fast weg; kaut), schnuppert zufrieden und trippelt zur anderen Seite hinaus. Weicher
// Schatten unter ihm. Wird es Tag oder Herbst oder sinkt die Stufe unter 4, blendet er rasch aus; wächst der Baum auch.
// Bilder: Recraft nano_banana_pro mit Eichhörnchen, Krähe, Häher und Meise als Stilvorlage (igel/originale/), freigestellt
// (ausschneiden.py) und ausgerichtet (ausrichten.py: Füße auf einer Linie, der Stachelrücken steht beim Bildwechsel still).
// Gehen und Stehen: Gliederpuppe aus dem Bild „stand“ (puppe.py, igel-puppe.webp; Erklärung unten bei PUP).
// Prüfhilfen: window.__igel (Abschnitt, Haltung, Lage, Länge in px), window.__igelSim(s, Schritt) (vorspulen ohne Zeichnen),
// window.__igelHold = true (kommt nicht von selbst), window.__igelNext (s bis zum nächsten Besuch, auch setzbar),
// window.__igelFreeze = true (Zeit steht; __igelSim geht weiter), window.__igelPose = 'fressen' (Haltung erzwingen; 'lauf'
// mit window.__igelPhase = 0…1: Beinstellung), window.__igelFuesse() (Füße quer durchs Bild, ob sie auf der Wiese stehen).
const igelFx = (() => {
  const META = {"poses":{"stand":{"w":649,"h":413,"sc":1.0,"x0":0,"y0":0},"schnueffeln":{"w":620,"h":435,"sc":0.98,"x0":20,"y0":-10},"schnuppern":{"w":637,"h":461,"sc":0.96,"x0":-2,"y0":-26},"fressen":{"w":724,"h":432,"sc":0.98,"x0":4,"y0":-7},"fressen2":{"w":724,"h":432,"sc":0.98,"x0":6,"y0":-7}},"anchor":[288,401],"lenPx":626,"mid":324,"puppe":{"W":414,"H":227,"k":0.5,"A":40,"beta":0.62,"phase":{"nh":0,"nf":0.25,"fh":0.5,"ff":0.75},"parts":{"fh":{"r":[348,191,55,28],"at":[158,335,110,57],"piv":[210.4,318.3],"foot":[216,386],"rot":0.5,"lift":9.0,"hl":39.48,"len":67.68},"ff":{"r":[348,78,44,51],"at":[380,288,88,102],"piv":[407.6,290.9],"foot":[433,384],"rot":1.0,"lift":13.0,"hl":22.56,"len":93.06},"nh":{"r":[348,145,58,30],"at":[104,344,117,61],"piv":[160,326],"foot":[166,398],"rot":0.5,"lift":10.0,"hl":42.0,"len":72.0},"nf":{"r":[348,8,47,54],"at":[337,297,94,109],"piv":[366,300],"foot":[393,399],"rot":1.0,"lift":14.0,"hl":24.0,"len":99.0},"body":{"r":[8,8,324,206],"at":[0,0,649,413]}}}}, IMG = {"schnueffeln": "bd87106fd9.webp", "schnuppern": "626b9f2881.webp", "fressen": "729f2e2cf4.webp", "fressen2": "baec63c543.webp", "puppe": "913a89b8a2.webp"};
  const LEN0 = 0.46, MIN_PX = 24, TONE = 0.94;   // Länge (Welt), kleinste Länge im Bild (CSS-Pixel), Grundfarbe
  const V0 = 0.42;                                 // Trippeln (Welt/s, × Größe)
  // ---- Gliederpuppe (Nutzer 27.10.: erst „als würde er auf dem boden langrutschen, die beine bleiben immer gleich“, nach
  // vier Laufbildern „gibt es wieder keinen wirklichen gang?“ – die Bilder waren paarweise fast gleich; Entscheidung des
  // Nutzers: Gliederpuppe). Körper aus „stand“ ohne Beine, die beiden nahen Beine einzeln, die fernen als dunklere Kopien
  // (puppe.py, ein Bild). Viertakt wie beim echten Gang: hinten nah, vorn nah, hinten fern, vorn fern, je ein Viertel
  // versetzt. Ein Fuß steht 62 % des Zyklus auf der Wiese und wandert dabei genau so schnell nach hinten, wie der Körper
  // vorankommt (Phase nach dem Weg, nicht nach der Zeit) – er rutscht nicht –, dann schwingt er angehoben nach vorn.
  // Vorderbeine drehen in der Schulter, Hinterpfoten halb gedreht, halb geschoben (die Sohle kippt nur leicht). Die
  // Ruhestellung ist genau das Bild „stand“: Stehen und Laufen gehen ohne Bildwechsel ineinander über; beim Anhalten setzen
  // sich die Füße in 0,2 s zurecht. Ein Netz mit fünf Flächen (ein Zeichenaufruf), Ecken je Bild auf der CPU gerechnet.
  const PUP = META.puppe, PP = PUP.parts, ORDER = ['fh', 'ff', 'nh', 'nf', 'body'];   // Zeichenfolge: fern, nah, Körper
  const STRIDE = 2 * PUP.A / PUP.beta;            // Weg je Schrittzyklus (Bildpunkte von „stand“)
  let SC = 1, K = LEN0 / META.lenPx, LEN = LEN0;   // K: Welt je Bildpunkt von „stand“
  const rr = (a, b) => a + Math.random() * (b - a);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const trunkR = (y) => { const r0 = rad && rad.length ? rad[0] : 0; return r0 * (1 + Math.exp(-Math.max(y, 0) * 2.4) * sm(0.025, 0.12, r0) * 1.95) * 1.13; };
  // ---- Winterschlaf: Zeitfenster, gemerkt je Vanamo-Jahr (null = Baum-Test: nur im Speicher)
  const EIN = [74, 86], AUS = [1.5, 8], KEY = 'vanamo-igel-schlaf';
  let jahr = OPT.jahr ?? null; const mem = {};
  const tag = () => { const d = yearSt ? yearSt.d : yearDay; return ((d % YEAR_LEN) + YEAR_LEN) % YEAR_LEN; };
  function flags() { if (jahr == null) return mem; try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
  const done = (k) => flags()[k] === (jahr ?? 'test');
  function setDone(k) {
    if (jahr == null) { mem[k] = 'test'; return; }
    try { const f = flags(); f[k] = jahr; localStorage.setItem(KEY, JSON.stringify(f)); } catch {}
  }
  // wach (nachts unterwegs): vom Aufwachen bis zum Einzug; im Einzug-Fenster bis er drin ist, im Aufwach-Fenster erst danach
  function wach() {
    const d = tag();
    if (d >= AUS[1] && d < EIN[0]) return true;
    if (d >= EIN[0] && d < EIN[1]) return !done('ein');
    if (d >= AUS[0] && d < AUS[1]) return done('aus');
    return false;
  }
  const allowed = (force) => !!tree && !!rad && P >= 3.98 && !reduceMotion && (force || (__isNight() && wach()));
  const canStart = () => !trans && !moveIn && !jayFx.active && !visitFx.active && !seqPlayer.active() && !winterFx.active && !eichTagFx.active;
  // am Wiesenrand weich weg (wie das Eichhörnchen): Halbmesser in der Welt
  const fadeAt = (x, d) => 1 - smooth((Math.hypot(x, d) - MR * 0.73) / (MR * 0.19));

  // ---- Figur und Schatten (erst beim ersten Mal)
  let tex = null, mesh = null, pup = null, sh = null;
  const tmp = new V(), tmp2 = new V();
  function init() {
    if (mesh) return;
    const loader = new THREE.TextureLoader();
    tex = {};
    for (const k in IMG) { const t = loader.load(__img(IMG[k])); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; tex[k] = t; }
    const mat = (map) => {
      const m = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
      m.color.setScalar(TONE); m.forceSinglePass = true;
      __nightify(m); __nightPic(m);                  // gleich nachts dunkel (nicht erst beim nächsten Durchgang)
      return m;
    };
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(tex.schnueffeln)); mesh.renderOrder = 23; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    // Gliederpuppe: fünf Flächen in einem Netz (Atlas igel-puppe.webp), Ecken setzt setPup()
    const geo = new THREE.BufferGeometry(), uv = new Float32Array(40), idx = [];
    ORDER.forEach((k, q) => {
      const r = PP[k].r, u0 = r[0] / PUP.W, u1 = (r[0] + r[2]) / PUP.W, v0 = 1 - r[1] / PUP.H, v1 = 1 - (r[1] + r[3]) / PUP.H;
      uv.set([u0, v0, u1, v0, u0, v1, u1, v1], q * 8); idx.push(q * 4, q * 4 + 2, q * 4 + 1, q * 4 + 1, q * 4 + 2, q * 4 + 3);
    });
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60), 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    pup = new THREE.Mesh(geo, mat(tex.puppe)); pup.renderOrder = 23; pup.frustumCulled = false; pup.visible = false; scene.add(pup);
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 63); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace;
    sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: st, color: 0x10160c, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    sh.renderOrder = 21; sh.visible = false; sh.userData.__night = true; sh.material.userData.__night = true; scene.add(sh);
  }
  const SHQ = STAGE_Q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new V(1, 0, 0), -Math.PI / 2));
  function hide() { if (mesh) mesh.visible = false; if (pup) pup.visible = false; if (sh) sh.visible = false; }
  // ein Bein der Puppe bei Phase ph (0…1) und Ausschlag amp (0 = Ruhestellung): Drehung (c, s) um die Schulter/Hüfte und
  // Verschiebung (tx, ty), damit der Fuß bei (foot.x + dx, foot.y − up) steht; Bildpunkte von „stand“, y nach unten
  function legPose(k, ph, amp) {
    const L = PP[k], B = PUP.beta; ph = (ph + PUP.phase[k]) % 1;
    let dx, up;
    if (ph < B) { dx = PUP.A * (1 - 2 * ph / B); up = 0; }                              // steht: wandert nach hinten
    else { const u = (ph - B) / (1 - B); dx = PUP.A * (-1 + 2 * u * u * (3 - 2 * u)); up = L.lift * Math.sin(Math.PI * u); }   // schwingt vor
    dx *= amp; up *= amp;
    const th = L.rot * Math.asin(Math.max(-0.95, Math.min(0.95, dx / L.len))), c = Math.cos(th), s = Math.sin(th);
    up += L.hl * Math.abs(s) * 0.5;                                                      // gekippte Sohle: Ferse/Zehen nicht im Boden
    const fx = L.foot[0] - L.piv[0], fy = L.foot[1] - L.piv[1];
    return [c, s, L.foot[0] + dx - (L.piv[0] + fx * c + fy * s), L.foot[1] - up - (L.piv[1] - fx * s + fy * c), ph < B, dx, up];
  }
  function setPup(ph, amp, bobPx) {
    const P = pup.geometry.attributes.position.array, ax = META.anchor[0], ay = META.anchor[1];
    for (let q = 0; q < 5; q++) {
      const k = ORDER[q], L = PP[k], [x0, y0, w, h] = L.at;
      let c = 1, s = 0, tx = 0, ty = -bobPx, px = 0, py = 0;                            // Körper: nur Wippen
      if (k !== 'body') { [c, s, tx, ty] = legPose(k, ph, amp); px = L.piv[0]; py = L.piv[1]; }
      for (let i = 0; i < 4; i++) {
        const X = x0 + (i & 1 ? w : 0) - px, Y = y0 + (i & 2 ? h : 0) - py, o = (q * 4 + i) * 3;
        P[o] = (px + X * c + Y * s + tx - ax) * K; P[o + 1] = (ay - (py - X * s + Y * c + ty)) * K; P[o + 2] = 0;
      }
    }
    pup.geometry.attributes.position.needsUpdate = true;
  }
  // Haltung zeichnen: Anker (Mitte der Füße von „stand“) auf der Wiese bei (x, d) in Bühnen-Koordinaten, Blick fc (±1);
  // 'lauf' und 'stand' mit der Gliederpuppe (Phase ph, Ausschlag amp), die übrigen Haltungen als ganzes Bild
  function draw(pose, x, d, fc, bob, fade, ph, amp) {
    pose = window.__igelPose || pose;
    tmp.copy(STAGE_R).multiplyScalar(x).addScaledVector(STAGE_D, d); tmp.y = 0.01;
    if (pose === 'lauf' || pose === 'stand') {
      if (window.__igelPose) { amp = pose === 'lauf' ? 1 : 0; ph = window.__igelPhase ?? ph; }
      setPup(ph, amp, bob / K);
      pup.position.copy(tmp); pup.quaternion.copy(STAGE_Q); pup.scale.set(fc, 1, 1);
      pup.material.opacity = fade; pup.visible = fade > 0.01; mesh.visible = false;
    } else {
      const m = META.poses[pose];
      if (mesh.material.map !== tex[pose]) mesh.material.map = tex[pose];
      const w = m.w * m.sc, h = m.h * m.sc;            // in Bildpunkten von „stand“
      const cx = m.x0 + w / 2 - META.anchor[0], cy = m.y0 + h / 2 - META.anchor[1];
      mesh.position.copy(tmp).addScaledVector(STAGE_R, fc * cx * K).addScaledVector(STAGE_U, -cy * K + bob);
      mesh.quaternion.copy(STAGE_Q); mesh.scale.set(fc * w * K, h * K, 1);
      mesh.material.opacity = fade; mesh.visible = fade > 0.01; pup.visible = false;
    }
    // Schatten: flach unter dem Körper (Körpermitte etwas hinter dem Anker)
    sh.position.copy(tmp).addScaledVector(STAGE_R, fc * (META.mid - META.anchor[0]) * K); sh.position.y = 0.012;
    sh.quaternion.copy(SHQ); sh.scale.set(LEN * 0.95, LEN * 0.34, 1);
    sh.material.opacity = 0.42 * fade; sh.visible = fade > 0.01;
  }

  // ---- Größe: wie lang wäre er (LEN0) mitten auf seinem Weg im Bild?
  function pickScale(d, x = 0, max = 2) {
    camera.updateMatrixWorld();
    tmp.copy(STAGE_D).multiplyScalar(d).addScaledVector(STAGE_R, x); tmp.y = 0.12; tmp2.copy(tmp).addScaledVector(STAGE_R, LEN0);
    tmp.project(camera); tmp2.project(camera);
    const px = Math.hypot((tmp2.x - tmp.x) * 0.5 * W(), (tmp2.y - tmp.y) * 0.5 * H());
    SC = Math.min(max, Math.max(1, MIN_PX / Math.max(1, px))); LEN = LEN0 * SC; K = LEN / META.lenPx;
    return px;
  }

  // ---- Weg: Bezier-Stück von a nach b (Kontrollpunkt c), nach Bogenlänge
  function seg(a, b, bend) {
    const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + bend];
    const N = 24, pts = [], acc = [0];
    for (let i = 0; i <= N; i++) { const t = i / N, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
    for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, acc, len: acc[N] };
  }
  function at(s, q) {
    const a = q.acc, n = a.length - 1;
    if (s <= 0) return q.pts[0]; if (s >= q.len) return q.pts[n];
    let i = 1; while (i < n && a[i] < s) i++;
    const f = (s - a[i - 1]) / Math.max(1e-6, a[i] - a[i - 1]), p0 = q.pts[i - 1], p1 = q.pts[i];
    return [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f];
  }

  // ---- Plan: Abschnitte { k: 'lauf', q, ein, aus, v, f, rus } oder { k: Haltung, dur, kau, rus } oder { k: 'leer', dur, rus }
  // v: Tempo (× V0), f: [Sicht am Anfang, am Ende, ab Anteil, bis Anteil] (hinein-/herauskriechen), rus: Rascheln im Laubhaufen
  let plan = null, vt = 0, last = 0, next = rr(60, 150), ruhig = 0;
  const lauf = (S, a, b, o = {}) => S.push({ k: 'lauf', q: seg(a, b, o.bend ?? rr(-0.25, 0.25)), ein: !!o.ein, aus: !!o.aus, v: o.v || 1, f: o.f || null, rus: o.rus || 0 });
  const halt = (S, seq) => { for (const [k, dur, x] of seq) S.push({ k, dur, kau: !!(x && x.kau), rus: (x && x.rus) || 0 }); };
  // Ein- und Ausgang: am Wiesenrand (Halbmesser MR·0,86: dort fast ausgeblendet) oder knapp hinter dem Bildrand
  const edge = (sd, d) => sd * Math.min(Math.sqrt(Math.max(0.5, (MR * 0.86) ** 2 - d * d)), Math.abs(edgeStageX(sd, 0.15, d, 3)) + 0.25 + LEN * 0.6);
  function makePlan(o) {
    const side = o.side || (Math.random() < 0.5 ? -1 : 1), fc = -side;           // kommt von side, läuft zur anderen Seite
    const tr = trunkR(0.05), dMin = tr + 0.55, dMax = dMin + 1.2;
    const dR = () => rr(dMin, dMax);
    const d0 = dR(), d1 = dR(), d2 = Math.min(dMax, Math.max(dMin, d1 + rr(-0.5, 0.5))), d3 = dR();
    pickScale((dMin + dMax) / 2);
    const x0 = edge(side, d0), x3 = edge(-side, d3);
    const x1 = side * rr(0.9, 2.3), x2 = x1 - side * rr(1.0, 1.9);
    const S = [];
    lauf(S, [x0, d0], [x1, d1], { ein: true });
    halt(S, [['stand', rr(0.3, 0.6)], ['schnueffeln', rr(0.7, 1.1)], ['stand', 0.22], ['schnueffeln', rr(0.6, 1.0)], ['schnuppern', rr(0.8, 1.3)], ['stand', rr(0.3, 0.5)]]);
    if (Math.random() < 0.35) {                                                      // noch ein kurzes Schnüffeln unterwegs
      const xm = x1 - side * rr(0.4, 0.7), dm = (d1 + d2) / 2;
      lauf(S, [x1, d1], [xm, dm]);
      halt(S, [['schnueffeln', rr(0.8, 1.4)], ['stand', 0.3]]);
      lauf(S, [xm, dm], [x2, d2]);
    } else lauf(S, [x1, d1], [x2, d2]);
    halt(S, [['stand', 0.3], ['schnueffeln', rr(1.0, 1.6)], ['fressen', rr(2.2, 3.0), { kau: 1 }], ['fressen2', rr(1.4, 2.0), { kau: 1 }], ['stand', rr(0.5, 0.8)], ['schnuppern', rr(0.9, 1.4)], ['stand', 0.3]]);
    lauf(S, [x2, d2], [x3, d3], { aus: true });
    return { S, i: 0, t: 0, s: 0, ph: 0, amp: 0, fc, x: x0, d: d0, force: !!o.force, out: 0, fade: 1, vis: 1, pose: 'lauf', schlaf: null };
  }
  // Winterschlaf: 'ein' (kommt von rechts, schnüffelt am Haufen, kriecht hinein) bzw. 'aus' (raschelt, kommt heraus,
  // schnuppert, trippelt nach rechts davon). Der Igel steht dabei knapp vor der Mitte des Haufens: was vom Haufen davor liegt,
  // verdeckt ihn; ganz drin ist er unsichtbar. Größe höchstens so, dass er nicht viel höher ist als der Haufen.
  function makeSchlaf(art) {
    const P0 = haufenFx.POS, R = haufenFx.R, Hh = haufenFx.H;
    pickScale(P0.d, P0.x, Math.min(2, Math.max(1, 1.5 * Hh / (LEN0 * META.poses.stand.h / META.lenPx))));
    const dc = P0.d + 0.08, xc = P0.x + 0.05 * R;                                   // drin
    const d1 = P0.d + 0.22, x1 = P0.x + R * 1.12 + LEN * 0.3;                        // rechts neben dem Haufen
    const d0 = P0.d + 0.55, x0 = edge(1, d0);                                         // Wiesenrand rechts
    const S = [];
    if (art === 'ein') {
      lauf(S, [x0, d0], [x1, d1], { ein: true, bend: 0.15 });
      halt(S, [['stand', 0.4], ['schnueffeln', rr(1.0, 1.4), { rus: 0.15 }], ['stand', 0.25], ['schnuppern', rr(0.8, 1.1)], ['stand', 0.3], ['schnueffeln', 0.7, { rus: 0.2 }]]);
      lauf(S, [x1, d1], [xc, dc], { v: 0.5, f: [1, 0, 0.35, 1], rus: 0.85, bend: 0 });
      S.push({ k: 'leer', dur: 1.6, rus: 0.5 });
      return { S, i: 0, t: 0, s: 0, ph: 0, amp: 0, fc: -1, x: x0, d: d0, force: true, out: 0, fade: 1, vis: 1, pose: 'lauf', schlaf: 'ein' };
    }
    S.push({ k: 'leer', dur: 1.8, rus: 0.7 });
    lauf(S, [xc, dc], [x1, d1], { v: 0.45, f: [0, 1, 0, 0.6], rus: 0.85, bend: 0 });
    halt(S, [['stand', 0.4], ['schnuppern', rr(1.2, 1.6)], ['stand', 0.4], ['schnueffeln', rr(0.7, 1.0)], ['stand', 0.3], ['schnuppern', 0.8], ['stand', 0.3]]);
    lauf(S, [x1, d1], [x0, d0], { aus: true, bend: -0.15 });
    return { S, i: 0, t: 0, s: 0, ph: 0, amp: 0, fc: 1, x: xc, d: dc, force: true, out: 0, fade: 1, vis: 0, pose: 'stand', schlaf: 'aus' };
  }
  function start(o = {}) {
    if (!allowed(o.force)) return false;
    init(); plan = makePlan(o);
    return true;
  }
  function startSchlaf(art) {
    if (P < 3.98 || reduceMotion || !haufenFx.visible) return false;
    init(); plan = makeSchlaf(art); setDone(art);                                   // gleich merken: einmal je Jahr
    return true;
  }
  function stop() { plan = null; hide(); window.__igel = null; }
  // aufgeschreckt (der Baum wächst): rasch ausblenden
  function away() { if (plan) plan.out = Math.max(plan.out, 0.001); }

  // ---- Ablauf
  function step(dt) {
    const p = plan, A = p.S[p.i];
    if (!A) { stop(); next = vt + rr(300, 600); return; }
    let rus = A.rus || 0;
    if (A.k === 'lauf') {
      const v = V0 * SC * A.v, rest = A.q.len - p.s;
      const kIn = A.ein ? 1 : 0.3 + 0.7 * sm(0, 0.3 * SC, p.s), kOut = A.aus ? 1 : 0.25 + 0.75 * sm(0, 0.35 * SC, rest);
      const ds = Math.min(rest, v * kIn * kOut * dt), x0 = p.x, d0 = p.d;
      p.s += ds;
      [p.x, p.d] = at(p.s, A.q);
      // Beine: Ausschlag nach dem Tempo (Anlaufen, Anhalten), Phase nach dem Weg quer durchs Bild (darauf stehen die Füße)
      p.amp += (sm(0.05, 0.6, kIn * kOut) - p.amp) * Math.min(1, dt * 10);
      p.ph = (p.ph + Math.hypot(p.x - x0, 0.3 * (p.d - d0)) / (STRIDE * K * Math.max(0.45, p.amp))) % 1;
      p.pose = 'lauf';
      const u = p.s / Math.max(1e-6, A.q.len);
      p.vis = A.f ? A.f[0] + (A.f[1] - A.f[0]) * sm(A.f[2], A.f[3], u) : 1;
      if (p.s >= A.q.len - 1e-4) { p.i++; p.s = 0; p.t = 0; const N = p.S[p.i]; if (N && N.k !== 'lauf' && N.k !== 'leer') p.pose = N.k; }
    } else if (A.k === 'leer') {                                                      // im Haufen (unsichtbar), es raschelt
      p.t += dt; p.vis = 0; p.amp = 0;
      rus *= p.schlaf === 'ein' ? 1 - sm(0, A.dur, p.t) : 0.4 + 0.6 * sm(0, A.dur * 0.8, p.t);
      if (p.t >= A.dur) { p.i++; p.t = 0; p.s = 0; }
    } else {
      p.t += dt; p.pose = A.k; p.vis = 1;
      p.amp *= Math.max(0, 1 - dt * 12);                                               // Füße setzen sich zurecht
      if (p.t >= A.dur) { p.i++; p.t = 0; p.s = 0; const N = p.S[p.i]; if (N && N.k !== 'lauf' && N.k !== 'leer') p.pose = N.k; }   // gleich die neue Haltung
    }
    if (rus > 0 && p.schlaf) {                                                        // Laub raschelt um die Nase
      tmp.copy(STAGE_R).multiplyScalar(p.x + p.fc * LEN * 0.4).addScaledVector(STAGE_D, p.d);
      haufenFx.rustle(tmp.x, tmp.z, rus);
    }
  }
  function update(dt) {
    if (!plan) {
      // Winterschlaf: einmal im Fenster, beim ersten Ansehen (der Baum läuft ein paar Sekunden ruhig)
      const ok = P >= 3.98 && !reduceMotion && haufenFx.visible && canStart();
      ruhig = ok ? ruhig + dt : 0;
      if (ok && ruhig > 3 && !window.__igelSchlafHold) {
        const d = tag();
        if (d >= EIN[0] && d < EIN[1] && !done('ein') && haufenFx.A > 0.85) { startSchlaf('ein'); return; }
        if (d >= AUS[0] && d < AUS[1] && !done('aus')) { startSchlaf('aus'); return; }
      }
      if (allowed(false)) {
        vt += dt;
        if (vt >= next && !window.__igelHold && canStart()) { if (!start({})) next = vt + rr(30, 60); }
      }
      return;
    }
    const p = plan;
    const ok = p.schlaf ? P >= 3.98 && !reduceMotion : allowed(p.force);
    if (!ok && !p.out) p.out = 0.001;                                                  // Tag, Winterschlaf, kleine Stufe: weg
    if (p.out) { p.out += dt; p.fade = Math.max(0, 1 - p.out / 0.7); if (p.fade <= 0) { stop(); next = vt + rr(300, 600); return; } }
    vt += dt;
    step(dt);
  }
  function render() {
    const p = plan; if (!p) return;
    const A = p.S[p.i];
    let bob = 0;
    if (p.pose === 'lauf' || p.pose === 'stand') bob = 0.005 * LEN * p.amp * (0.5 - 0.5 * Math.cos(4 * Math.PI * p.ph));   // Wippen je halbem Zyklus
    else if (A && A.kau) bob = 0.006 * LEN * Math.sin(p.t * Math.PI * 2 * 3);                                   // kauen
    const fade = p.fade * fadeAt(p.x, p.d) * p.vis;
    draw(p.pose, p.x, p.d, p.fc, bob, fade, p.ph, p.amp);
    tmp.copy(STAGE_R).multiplyScalar(p.x).addScaledVector(STAGE_D, p.d); tmp.y = 0.12; tmp2.copy(tmp).addScaledVector(STAGE_R, LEN);
    const n1 = tmp.clone().project(camera), n2 = tmp2.project(camera);
    window.__igel = { ab: p.i, von: p.S.length, k: A ? A.k : null, pose: p.pose, ph: +p.ph.toFixed(3), amp: +p.amp.toFixed(2), x: +p.x.toFixed(2), d: +p.d.toFixed(2), fc: p.fc, sc: +SC.toFixed(2), schlaf: p.schlaf,
      px: Math.round(Math.hypot((n2.x - n1.x) * 0.5 * W(), (n2.y - n1.y) * 0.5 * H())), sicht: +fade.toFixed(2), nx: +n1.x.toFixed(3), ny: +n1.y.toFixed(3) };
  }
  function frame() {
    const now = nowMs();
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    if (!window.__igelFreeze) update(dt);
    render();
  }
  window.__igelSim = (sec, st = 0.05) => { for (let k = 0; k < Math.round(sec / st); k++) update(st); render(); return window.__igel; };
  // Füße der Puppe: Lage quer durchs Bild (Bühnen-x der Sohlenmitte) und ob sie gerade auf der Wiese stehen
  window.__igelFuesse = () => {
    if (!plan) return null;
    const out = { x: plan.x, amp: plan.amp, pose: plan.pose };
    for (const k of ['nh', 'nf', 'fh', 'ff']) {
      const r = legPose(k, plan.ph, plan.amp);
      out[k] = { sx: plan.x + plan.fc * (PP[k].foot[0] + r[5] - META.anchor[0]) * K, steht: r[4] };
    }
    return out;
  };
  Object.defineProperty(window, '__igelNext', { configurable: true, get: () => +(next - vt).toFixed(1), set: (s) => { next = vt + s; } });
  window.__igelSchlaf = () => ({ tag: +tag().toFixed(1), jahr, wach: wach(), ein: done('ein'), aus: done('aus'), haufen: haufenFx.visible });
  // Test (Baum-Test): gleich ein Igel (force: auch tagsüber und außerhalb seiner Zeit); ist schon einer da, kommt ein neuer
  function now(o = {}) {
    if (!allowed(o.force) || !canStart()) return false;
    if (plan) stop();
    return start(o);
  }
  // Test: Einzug bzw. Aufwachen jetzt (auch wenn schon gesehen)
  function schlaf(art) {
    if (!canStart()) return false;
    if (plan) stop();
    return startSchlaf(art === 'aus' ? 'aus' : 'ein');
  }
  return { frame, now, schlaf, stop, away, get active() { return !!plan; }, get wach() { return wach(); }, setJahr(j) { jahr = j ?? null; } };
})();
// Play-Knopf: nachts ab Stufe 4, solange er wach ist (Frühling nach dem Aufwachen bis Herbst vor dem Winterschlaf)
PLAY.add({ id: 'igel', ab: 4, zeiten: ['fruehling', 'sommer', 'herbst'], nacht: true, ok: () => igelFx.wach, start: () => igelFx.now(), aktiv: () => igelFx.active, max: 50 });
// ------------------------------------------------------------------ Baumschatten auf den gemalten Tieren (27.10.)
// Nutzer 27.10.: „hat der Baumschatten einen Einfluss auf den Igel? der sieht immer gleich hell aus. gilt wahrscheinlich
// auch für die anderen Tiere“ → ja, für alle Tiere (Nutzer). Die gemalten Bilder (MeshBasic ohne Licht: Igel, Eichhörnchen,
// Vögel, Falter, Hummeln …) werden je Bild weich abgedunkelt, wenn die Krone zwischen ihnen und Sonne bzw. Mond liegt:
// Weglänge des Lichtstrahls durch das Kronen-Ellipsoid (uCrownC/uCrownR, wie der Ersatzschatten der Wiese), mal Größe der
// Krone (uAO.w) und Laubmenge der Jahreszeit (yearLeafK; im Winter kahl: kein Schatten). Ohne das feine Blättermuster.
// Stärke: tagsüber bis 38 % dunkler (wie die Wiese im Kronenschatten), nachts bis 28 % (die Bilder sind nachts ohnehin
// schon so dunkel wie Laub im Schatten). Kostet je Figur und Bild nur eine kleine Rechnung (Liste __picMeshes aus __nightAll).
// Prüfhilfen: window.__schattenAn(x, y, z) (Schatten 0–1 an einer Weltstelle), window.__tierSchatten = false (aus).
const __shQ = new V(), __shS = new V(), __shP = new V();
function __shadeAt(p) {
  const w = groundUniforms.uAO.value.w * yearLeafK; if (w < 0.01) return 0;
  const C = leafUniforms.uCrownC.value, R = leafUniforms.uCrownR.value, L = leafUniforms.uSun.value;
  __shQ.set((p.x - C.x) / R.x, (p.y - C.y) / R.y, (p.z - C.z) / R.z);
  __shS.set(L.x / R.x, L.y / R.y, L.z / R.z).normalize();
  const b = __shQ.dot(__shS), c = __shQ.lengthSq() - 1, disc = b * b - c;
  if (disc <= 0) return 0;
  const sq = Math.sqrt(disc), od = Math.max(0, -b + sq) - Math.max(0, -b - sq);
  return w * smooth((od * 0.9 - 0.15) / 0.75);
}
function __shadePics() {
  if (!__picMeshes.size) return;
  const off = window.__tierSchatten === false;
  const nk = __nightS.k, K = 0.38 + (0.28 - 0.38) * nk;
  for (const o of __picMeshes) {
    if (!o.parent) { __picMeshes.delete(o); continue; }
    const m = o.material; if (!m || Array.isArray(m) || !m.userData.__pic) continue;
    let s = 0;
    if (!off) {
      if (o.parent === scene) __shP.copy(o.position); else __shP.setFromMatrixPosition(o.matrixWorld);
      s = __shadeAt(__shP);
    }
    const pf = __mix(1, m.userData.__picN ?? __NIGHT.pics[1], nk);   // eigener Nachtwert je Bild (Fledermäuse, 27.10.)
    m.color.copy(m.userData.__pic).multiplyScalar(pf * (1 - K * s));
  }
}
window.__schattenAn = (x, y, z) => +__shadeAt(new V(x, y, z)).toFixed(3);
// ------------------------------------------------------------------ Fledermäuse: Braune Langohren (ab Stufe 5, 27.10.)
// Nutzer 27.10.: Braunes Langohr, ab Stufe 5, nachts vom Frühling bis zum Herbst („nicht im Winter natürlich“), meist zwei
// bis drei. Sie jagen um die Krone, fangen Nachtfalter und hängen zwischendurch kopfüber am Ast. Von selbst alle 5–10 Minuten
// (das erste Mal nach 1–3 min; die Uhr läuft nur, wenn sie kommen dürfen, solange der Baum läuft), dazu der Play-Knopf.
// Ablauf eines Besuchs (40–70 s): zwei oder drei kommen nacheinander von der Seite, jagen in Schleifen und Haken um die
// Krone (manchmal kurz im Rüttelflug vor dem Laub, manchmal unter der Krone vor dem Stamm durch). Nach ein paar Sekunden
// flattert ein heller Nachtfalter (Holunderspanner) am Rand der Krone; eine Fledermaus jagt ihn (der erste Anlauf geht
// manchmal daneben), trägt ihn zu einem Ast, hängt sich kopfüber hin und frisst ihn (wie echte Langohren am Fraßplatz:
// die Falterflügel fallen herunter und trudeln ins Gras), putzt sich, schaut sich um, lässt sich fallen und fliegt weiter.
// Manchmal hängt sich eine andere auch ohne Falter kurz hin. Zum Schluss fliegen sie nacheinander davon. Ohne passenden
// Ast frisst die Fängerin im Flug (die Flügel fallen trotzdem).
// Figur im Flug wie bei den Schmetterlingen: echte Flächen – Flügel mit zwei Seiten (oben das Bild von oben, unten die
// Bauchansicht), die um Gelenklinien neben dem Körper schlagen (beim Hochschlag etwas eingezogen), der Körper waagerecht
// (oben/unten) und senkrecht (Seitenbild ohne Flügel) –, so stimmt sie aus jedem Blickwinkel; sie legt sich in die Kurven.
// Kopfüber: gemalte Haltungen (wach, döst, schaut, putzt, frisst, gleich los), kurz überblendet; Zehen am Ast.
// Größe natürlich (Spannweite 0,48 – Meise 0,26, in echt 26 : 14 cm); wäre die Spannweite in der Kronenmitte kleiner als
// MIN_PX CSS-Pixel (große Stufen, kleine Leinwand), werden sie größer gezeichnet, höchstens doppelt (wie Krähen und Igel; gilt
// für den ganzen Besuch). Nachts heller als die anderen gemalten Tiere (Nutzer: Vorschlag „heller, damit man sie vor dem
// dunklen Himmel sieht“) – eigener Nachtwert je Bild (userData.__picN), der Falter noch heller.
// Wird es Tag oder Winter, sinkt die Stufe oder wächst der Baum: sie fliegen rasch davon.
// Prüfhilfen: window.__fm (Zustand: Tiere, Falter, Größe in px), window.__fmSim(s) (vorspulen ohne Zeichnen),
// window.__fmHold = true (kommen nicht von selbst), window.__fmNext (s bis zum nächsten Besuch, auch setzbar),
// window.__fmFreeze = true (Zeit steht), window.__fmSetzen({ pose, n }) (Standbild: n Tiere hängen bzw. fliegen),
// window.__fmPlaetze() (Hängeplätze mit Wertung), window.__fmWarum() (warum kein Hängeplatz).
const fledermausFx = (() => {
  const META = {"flug":{"atlas":{"W":1136,"H":660,"r":{"fl-oben":[16,16,248,298],"fr-oben":[296,16,248,298],"fl-unten":[576,16,248,298],"fr-unten":[856,16,248,298],"k-oben":[16,346,116,298],"k-unten":[164,346,116,298],"seite":[312,346,270,158]}},"fl-oben":[248,298],"fr-oben":[248,298],"k-oben":[116,298],"seite":[270,158],"k":0.5,"W":595.5,"H":298.0,"cx":297.5,"BW":50.0,"kx0":239.5,"schnauze":64.0,"rumpf":227.5,"schulter":125.0,"oben":5.0,"unten":293.0},"haengen":{"schlaf":{"w":148,"h":253,"zx":71.82,"zy":4.18},"wach":{"w":149,"h":265,"zx":73.15,"zy":4.56},"schauen":{"w":128,"h":264,"zx":67.64,"zy":4.18},"fressen":{"w":312,"h":234,"zx":155.61,"zy":4.18},"putzen":{"w":263,"h":265,"zx":187.53,"zy":2.66},"los":{"w":309,"h":232,"zx":154.28,"zy":2.28},"_hoehe":260.3},"falter":{"atlas":{"W":400,"H":167,"r":{"fl":[16,16,120,135],"fr":[168,16,120,135],"k":[320,16,48,135]}},"fl":[120,135],"fr":[120,135],"k":[48,135],"W":251.16,"H":134.64,"cx":125.52,"NB":5.52,"oben":1.2,"unten":133.56,"kx0":101.52},"seite":{"schnauze":265.5,"rumpf":3.5,"mitteY":109.25}}, IMG = {"flug": "d1ba1a2667.webp", "falter": "4b65b7fe38.webp", "nf-k": "61912304d9.webp", "h-schlaf": "ce8060dd8c.webp", "h-wach": "31b5606e57.webp", "h-schauen": "48d240f4e0.webp", "h-putzen": "ff11224d04.webp", "h-fressen": "edbbd94146.webp", "h-los": "13775dd71b.webp"};
  const SPAN0 = 0.48, HANG0 = 0.17, MOTH0 = 0.16, MIN_PX = 34, TONE = 0.94;
  const NIGHT_BAT = 0.42, NIGHT_MOTH = 0.62;            // Nachtwert der Bilder (andere Tiere: __NIGHT.pics = 0,13)
  const F = META.flug, S = META.seite, HG = META.haengen, NF = META.falter;
  const SPANPX = F.W - 2 * 5.5;                          // Spannweite im Bild (ohne Rand)
  let SC = 1, K = SPAN0 / SPANPX, KH = HANG0 / HG._hoehe, KM = MOTH0 / NF.W;
  const rr = (a, b) => a + Math.random() * (b - a);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const UP = new V(0, 1, 0);
  const tmp = new V(), tmp2 = new V(), tmp3 = new V(), vA = new V(), vB = new V();
  const toSt = (p) => ({ x: p.dot(STAGE_R), y: p.y, z: p.dot(STAGE_D) });
  const trunkR = (y) => { const r0 = rad && rad.length ? rad[0] : 0; return r0 * (1 + Math.exp(-Math.max(y, 0) * 2.4) * sm(0.025, 0.12, r0) * 1.95) * 1.13; };
  const SEASONS = ['fruehling', 'sommer', 'herbst'];
  const allowed = (force) => !!tree && !!rad && P >= 4.98 && !reduceMotion && (force || (__isNight() && SEASONS.includes(season)));
  const canStart = () => !trans && !moveIn && !jayFx.active && !visitFx.active && !seqPlayer.active();

  // ---------------------------------------------------------------- Bilder und Figuren (erst beim ersten Mal)
  // Flugfigur als EIN Netz je Fledermaus (ein Zeichenaufruf): alle Flächen in einem Bild (fm-flug.webp); jede Fläche zweimal
  // mit entgegengesetzter Drehrichtung (oben: Bild von oben, unten: Bauchansicht) – es zeichnet nur, was zur Kamera zeigt.
  // Der Flügelschlag wird je Bild in den Ecken der Flügelflächen gerechnet (16 Punkte).
  let tex = null;
  const BATS = [], MAXN = 3;
  function mat(map, side, night, o = {}) {
    const m = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: o.at ?? 0.05, side, depthWrite: !!o.dw, toneMapped: false });
    m.color.setScalar(TONE); m.userData.__picN = night;
    if (side === THREE.DoubleSide) m.forceSinglePass = true;          // durchsichtig und zweiseitig: sonst zwei Zeichenaufrufe
    __nightify(m); __nightPic(m);
    return m;
  }
  // Netz aus Flächen: jede Fläche { p: [4 Ecken als [x,y,z]], r: Rechteck im Atlas [x,y,w,h], back } – Bild oben = Ecke 0/1
  function sheet(quads, A) {
    const pos = new Float32Array(quads.length * 12), uv = new Float32Array(quads.length * 8), idx = [];
    quads.forEach((q, i) => {
      q.p.forEach((c, j) => pos.set(c, i * 12 + j * 3));
      const [x, y, w, h] = q.r, u0 = x / A.W, u1 = (x + w) / A.W, v0 = 1 - y / A.H, v1 = 1 - (y + h) / A.H;
      uv.set([u0, v0, u1, v0, u1, v1, u0, v1], i * 8);
      const o = i * 4;
      idx.push(...(q.back ? [o, o + 1, o + 2, o, o + 2, o + 3] : [o, o + 2, o + 1, o, o + 3, o + 2]));
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  }
  // Ecken einer waagerechten Fläche (x vorn, z rechts): Bild oben = vorn (xF)
  const flat = (xF, xB, a0, a1, y = 0) => [[xF, y, a0], [xF, y, a1], [xB, y, a1], [xB, y, a0]];
  function makeBat(i) {
    // Maße in Bildpunkten der Flugbilder; Ursprung = Schulter auf der Mittellinie; Maßstab über die Netz-Größe (Welt je Bildpunkt)
    const A = F.atlas, R = A.r, xF = F.schulter, xB = F.schulter - F.H, cx = F.cx, bw = F.BW;
    const wl = F['fl-oben'][0], wr = F['fr-oben'][0];
    const kz0 = F.kx0 - cx, kz1 = kz0 + F['k-oben'][0];
    const ks = (F.rumpf - F.schnauze) / (S.schnauze - S.rumpf), sw = F.seite[0], shh = F.seite[1];
    const sx0 = (F.schulter - F.rumpf) - S.rumpf * ks, sx1 = sx0 + sw * ks, sy0 = S.mitteY * ks, sy1 = sy0 - shh * ks;
    const side = [[sx0, sy0, 0], [sx1, sy0, 0], [sx1, sy1, 0], [sx0, sy1, 0]];
    const quads = [
      { p: flat(xF, xB, -bw - wl, -bw), r: R['fl-oben'] }, { p: flat(xF, xB, -bw - wl, -bw), r: R['fl-unten'], back: true },
      { p: flat(xF, xB, bw, bw + wr), r: R['fr-oben'] }, { p: flat(xF, xB, bw, bw + wr), r: R['fr-unten'], back: true },
      { p: flat(xF, xB, kz0, kz1, 0.6), r: R['k-oben'] }, { p: flat(xF, xB, kz0, kz1, -0.6), r: R['k-unten'], back: true },
      { p: side, r: R.seite, back: true }, { p: side, r: R.seite },
    ];
    const g = sheet(quads, A);
    const mesh = new THREE.Mesh(g, mat(tex.flug, THREE.FrontSide, NIGHT_BAT, { at: 0.3, dw: true })); mesh.renderOrder = 25; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    // Ruhelage der Flügelecken (zum Schlagen: Drehung um die Gelenklinie z = ∓bw)
    const base = { L: flat(xF, xB, -bw - wl, -bw), R: flat(xF, xB, bw, bw + wr) };
    // Kopfüber: zwei Bildflächen zum Überblenden (zeigen immer zur Kamera)
    const hang = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(tex['h-wach'], THREE.FrontSide, NIGHT_BAT)); m.renderOrder = 24; m.frustumCulled = false; m.visible = false; scene.add(m); return m; });
    // Falter im Maul (im Flug): kleiner heller Fleck an der Schnauze
    const maul = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(tex['nf-k'], THREE.DoubleSide, NIGHT_MOTH)); maul.renderOrder = 27; maul.frustumCulled = false; maul.visible = false; scene.add(maul);
    return { i, grp: mesh, base, hang, maul, st: 'weg', pos: new V(), vel: new V(), q: new THREE.Quaternion(), roll: 0, ph: Math.random(), seed: rr(0, 100), flapA: 0.5, fold: 0 };
  }
  // Flügelschlag in die Ecken schreiben: links um z = −bw mit +a, rechts um z = +bw mit −a (beide hoch bei a > 0); f = eingezogen
  function setWings(g, base, bw, a, f) {
    const P = g.getAttribute('position'), arr = P.array, ca = Math.cos(a) * f, sa = Math.sin(a) * f;
    for (let j = 0; j < 4; j++) {
      const [x, , z] = base.L[j], zr = z + bw;                       // zr ≤ 0
      const y2 = -zr * sa, z2 = -bw + zr * ca;
      arr.set([x, y2, z2], j * 3); arr.set([x, y2, z2], 12 + j * 3);
      const [xr, , zR] = base.R[j], zq = zR - bw;                    // zq ≥ 0
      const y3 = zq * sa, z3 = bw + zq * ca;
      arr.set([xr, y3, z3], 24 + j * 3); arr.set([xr, y3, z3], 36 + j * 3);
    }
    P.needsUpdate = true;
  }
  // Nachtfalter: ein Netz (Flügel oben/unten, Körper), dazu herabfallende Flügel (Fraßplatz)
  let moth = null; const bits = [];
  function makeMoth() {
    const A = NF.atlas, R = A.r, xF = NF.H / 2, xB = -NF.H / 2, cx = NF.cx, nb = NF.NB, wl = NF.fl[0], wr = NF.fr[0];
    const kz0 = NF.kx0 - cx, kz1 = kz0 + NF.k[0];
    const quads = [
      { p: flat(xF, xB, -nb - wl, -nb), r: R.fl }, { p: flat(xF, xB, -nb - wl, -nb), r: R.fl, back: true },
      { p: flat(xF, xB, nb, nb + wr), r: R.fr }, { p: flat(xF, xB, nb, nb + wr), r: R.fr, back: true },
      { p: flat(xF, xB, kz0, kz1, 0.5), r: R.k }, { p: flat(xF, xB, kz0, kz1, -0.5), r: R.k, back: true },
    ];
    const mesh = new THREE.Mesh(sheet(quads, A), mat(tex.falter, THREE.FrontSide, NIGHT_MOTH, { at: 0.3, dw: true })); mesh.renderOrder = 25; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    for (const k of ['fl', 'fr']) {
      const r = R[k], g = sheet([{ p: [[-0.5, 0.5, 0], [0.5, 0.5, 0], [0.5, -0.5, 0], [-0.5, -0.5, 0]], r }], A);   // in x/y, Bild oben = +y
      const m = new THREE.Mesh(g, mat(tex.falter, THREE.DoubleSide, NIGHT_MOTH)); m.renderOrder = 25; m.frustumCulled = false; m.visible = false; scene.add(m);
      bits.push({ m, on: false, p: new V(), v: new V(), t: 0, rot: 0, w: 0, asp: r[2] / r[3] });
    }
    return { grp: mesh, base: { L: flat(xF, xB, -nb - wl, -nb), R: flat(xF, xB, nb, nb + wr) }, nb, on: false, pos: new V(), vel: new V(), t: 0, home: new V(), fade: 0, caught: false, flee: 0, ph: Math.random() };
  }
  function init() {
    if (tex) return;
    const loader = new THREE.TextureLoader(); tex = {};
    for (const k in IMG) { const t = loader.load(__img(IMG[k])); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; tex[k] = t; }
    for (let i = 0; i < MAXN; i++) BATS.push(makeBat(i));
    moth = makeMoth();
  }

  // ---------------------------------------------------------------- Größe
  const pxLen = (p, len) => {
    camera.updateMatrixWorld();
    vA.copy(p).project(camera); vB.copy(p).addScaledVector(STAGE_R, len).project(camera);
    return Math.hypot((vB.x - vA.x) * 0.5 * W(), (vB.y - vA.y) * 0.5 * H());
  };
  function pickScale() {
    buildHull(); const px = pxLen(hc, SPAN0);
    SC = Math.min(2, Math.max(1, MIN_PX / Math.max(1, px)));
    K = SPAN0 * SC / SPANPX; KH = HANG0 * SC / HG._hoehe; KM = MOTH0 * Math.sqrt(SC) / NF.W;
    return px;
  }

  // ---------------------------------------------------------------- Krone, Wegpunkte, Hindernisse
  // Kronenhülle: je Richtung (NA × NE Fächer um die Mitte des Laubs) wie weit das Laub reicht (Kartenmitte + Karte). Das
  // Ellipsoid uCrownC/uCrownR (aus den Knoten) ist zu klein – das Laub reicht bis zum 2- bis 2,5-fachen hinaus.
  const CC = () => leafUniforms.uCrownC.value, CR = () => leafUniforms.uCrownR.value;
  const NA = 16, NE = 9, HULL = new Float32Array(NA * NE), hc = new V(), hbox = new V(1, 1, 1);
  let hullKey = '', hullF = -1, fno = 0;
  function buildHull() {
    if (hullF === fno) return; hullF = fno;               // höchstens einmal je Bild prüfen
    const key = T.toFixed(4) + '|' + leafUniforms.uDropU.value.toFixed(3) + '|' + season + '|' + (leafMesh && leafMesh.visible) + '|' + leafUniforms.uLeafScale.value.toFixed(3);
    if (key === hullKey) return; hullKey = key;
    const L = []; let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
    if (leafMesh && leafMesh.visible) {
      const ga = leafMesh.geometry.getAttribute('aGrow').array, M = leafMesh.instanceMatrix.array, ls = leafUniforms.uLeafScale.value;
      for (let k = 0; k < ga.length; k++) {
        if (ga[k] < 0.25 || seasonGone(k)) continue;
        const o = k * 16, g = ga[k] * ls;
        const x = M[o + 12] + M[o + 4] * 0.5 * g, y = M[o + 13] + M[o + 5] * 0.5 * g, z = M[o + 14] + M[o + 6] * 0.5 * g, r = 0.42 * Math.hypot(M[o + 4], M[o + 5], M[o + 6]) * g;
        L.push(x, y, z, r);
        mnx = Math.min(mnx, x - r); mxx = Math.max(mxx, x + r); mny = Math.min(mny, y - r); mxy = Math.max(mxy, y + r); mnz = Math.min(mnz, z - r); mxz = Math.max(mxz, z + r);
      }
    }
    if (L.length < 80) {                                   // kaum Laub: Ellipsoid der Knoten, etwas größer
      const C = CC(), R = CR(); hc.copy(C); hbox.copy(R).multiplyScalar(1.3);
      for (let ie = 0; ie < NE; ie++) for (let ia = 0; ia < NA; ia++) {
        const el = ((ie + 0.5) / NE - 0.5) * Math.PI, az = (ia + 0.5) / NA * Math.PI * 2 - Math.PI;
        const dx = Math.cos(el) * Math.sin(az), dy = Math.sin(el), dz = Math.cos(el) * Math.cos(az);
        HULL[ie * NA + ia] = 1 / Math.hypot(dx / hbox.x, dy / hbox.y, dz / hbox.z);
      }
      return;
    }
    hc.set((mnx + mxx) / 2, (mny + mxy) / 2, (mnz + mxz) / 2); hbox.set((mxx - mnx) / 2, (mxy - mny) / 2, (mxz - mnz) / 2);
    HULL.fill(0);
    for (let j = 0; j < L.length; j += 4) {
      const dx = L[j] - hc.x, dy = L[j + 1] - hc.y, dz = L[j + 2] - hc.z, d = Math.hypot(dx, dy, dz) || 1e-4;
      const ia = Math.min(NA - 1, Math.floor((Math.atan2(dx, dz) + Math.PI) / (Math.PI * 2) * NA)), ie = Math.min(NE - 1, Math.max(0, Math.floor((Math.asin(dy / d) / Math.PI + 0.5) * NE)));
      const i = ie * NA + ia; HULL[i] = Math.max(HULL[i], d + L[j + 3]);
    }
    // leere Fächer aus den Nachbarn füllen, dann je Fach das Größte der Nachbarn (lieber etwas weiter außen)
    for (let it = 0; it < 6; it++) {
      const C2 = HULL.slice();
      for (let ie = 0; ie < NE; ie++) for (let ia = 0; ia < NA; ia++) {
        if (C2[ie * NA + ia] > 0) continue;
        let s2 = 0, n = 0;
        for (const [de, da] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const e = ie + de; if (e < 0 || e >= NE) continue; const v = C2[e * NA + (ia + da + NA) % NA]; if (v > 0) { s2 += v; n++; } }
        if (n) HULL[ie * NA + ia] = s2 / n;
      }
    }
    const C3 = HULL.slice();
    for (let ie = 0; ie < NE; ie++) for (let ia = 0; ia < NA; ia++) {
      let m = C3[ie * NA + ia];
      for (const [de, da] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const e = ie + de; if (e < 0 || e >= NE) continue; m = Math.max(m, C3[e * NA + (ia + da + NA) % NA] * 0.92); }
      HULL[ie * NA + ia] = m;
    }
  }
  // Reichweite des Laubs in Richtung dir (Welt, normiert), weich zwischen den Fächern
  function hullR(dir) {
    const az = (Math.atan2(dir.x, dir.z) + Math.PI) / (Math.PI * 2) * NA - 0.5, el = (Math.asin(Math.max(-1, Math.min(1, dir.y))) / Math.PI + 0.5) * NE - 0.5;
    const a0 = Math.floor(az), fa = az - a0, e0 = Math.max(0, Math.min(NE - 1, Math.floor(el))), e1 = Math.min(NE - 1, e0 + 1), fe = Math.max(0, Math.min(1, el - e0));
    const g = (e, a) => HULL[e * NA + ((a % NA) + NA) % NA];
    return (g(e0, a0) * (1 - fa) + g(e0, a0 + 1) * fa) * (1 - fe) + (g(e1, a0) * (1 - fa) + g(e1, a0 + 1) * fa) * fe;
  }
  // Punkt um die Krone: Richtung α (0 = zur Kamera, ± = Seiten), Höhe β (−1 unten … 1 oben), Abstand m außerhalb des Laubs
  const hd = new V();
  function around(a, b, m, out = new V()) {
    buildHull();
    const cb = Math.cos(b * 1.2);
    hd.copy(STAGE_R).multiplyScalar(Math.sin(a) * cb).addScaledVector(STAGE_D, Math.cos(a) * cb).addScaledVector(UP, Math.sin(b * 1.2)).normalize();
    out.copy(hc).addScaledVector(hd, hullR(hd) + m);
    out.y = Math.max(out.y, 0.75 * SC + 0.2);
    return out;
  }
  // Abstand außerhalb des Laubs (negativ: drin)
  const gap = (p) => { buildHull(); hd.subVectors(p, hc); const d = hd.length() || 1e-4; hd.multiplyScalar(1 / d); return d - hullR(hd); };
  function avoid(b, acc, dt) {
    const p = b.pos;
    // Krone: außerhalb des Laubs bleiben (beim Rütteln und Landen dichter heran)
    const want = b.near ? 0.05 : 0.18 * SC, g = b.noHull ? 1 : gap(p);   // beim Anflug an den Ast nicht (der Ast liegt unter dem Laub)
    if (g < want) acc.addScaledVector(hd, (want - g) * 16);
    // Stamm unter der Krone
    const h = Math.hypot(p.x, p.z), tr = trunkR(Math.max(0, p.y)) + 0.22 * SC;
    if (p.y < crownBase + 0.4 && h < tr + 0.3) { tmp.set(p.x, 0, p.z).normalize(); if (h < 1e-4) tmp.copy(STAGE_D); acc.addScaledVector(tmp, (tr + 0.3 - h) * 30); }
    // Boden
    const lo = 0.55 * SC + 0.15; if (p.y < lo && !b.lowOk) acc.y += (lo - p.y) * 22;
    // Abstand zu den anderen
    for (const o of BATS) {
      if (o === b || o.st === 'weg' || o.st === 'haengt') continue;
      tmp.subVectors(p, o.pos); const d = tmp.length(), want2 = 0.45 * SC;
      if (d < want2 && d > 1e-4) acc.addScaledVector(tmp, (want2 - d) / d * 14);
    }
  }
  // nächster Wegpunkt beim Jagen: weiter im Kreis (selten Kehrtwende), Höhe wechselt; manchmal Rüttelflug am Laub oder unter
  // der Krone vor dem Stamm durch
  function nextWp(b) {
    b.near = false; b.lowOk = false; b.hover = 0; b.wpT = 0; b.noHull = false;
    const r = Math.random();
    if (r < 0.12 && crownBase > 0.9) {                       // unter der Krone vor dem Stamm
      b.dir = Math.random() < 0.5 ? 1 : -1;
      b.a = b.dir * rr(0.1, 0.5);
      tmp2.copy(STAGE_D).multiplyScalar(rr(0.7, 1.4) * SC + trunkR(0.5)).addScaledVector(STAGE_R, b.dir * rr(0.4, 1.2)); tmp2.y = Math.max(0.8 * SC, crownBase * rr(0.45, 0.8));
      b.wp.copy(tmp2); b.lowOk = true; return;
    }
    if (Math.random() < 0.18) b.dir = -b.dir;               // Haken
    b.a += b.dir * rr(0.45, 1.1);
    if (Math.abs(b.a) > 1.95) { b.dir = -Math.sign(b.a); b.a = Math.sign(b.a) * 1.95; }   // meist vorn und an den Seiten
    b.b = Math.min(0.75, Math.max(-0.45, b.b + rr(-0.5, 0.5)));
    if (r > 0.86) { around(b.a, b.b, 0.06, b.wp); b.near = true; b.hover = rr(0.7, 1.3); return; }   // Rüttelflug am Laub
    around(b.a, b.b, rr(0.3, 0.85) * (0.7 + 0.3 * SC), b.wp);
  }

  // ---------------------------------------------------------------- Hängeplätze (Unterseite fast waagerechter Äste)
  // Sichtbarkeit wie bei den Krähen: Äste, Laub und Nistkasten in Bildschirm-Koordinaten mit Tiefe, in einem Raster
  const GN = 24, LEAF_K = 0.62; let occ = null, occKey = '';
  const pv = new V(), fwd = new V(), sp = [0, 0, 0], a3 = [0, 0, 0], b3 = [0, 0, 0];
  function scr(w, out) {
    pv.copy(w).project(camera);
    out[0] = (pv.x * 0.5 + 0.5) * occ.w; out[1] = (0.5 - pv.y * 0.5) * occ.h;
    out[2] = (w.x - camera.position.x) * fwd.x + (w.y - camera.position.y) * fwd.y + (w.z - camera.position.z) * fwd.z;
    return out;
  }
  function nodeSegs() {
    let k = 0;
    for (let i = 1; i < tree.N; i++) { if (T - tree.birth[i] <= 0) continue; if (smooth((mY[i] - crownBase) / 0.35) <= 0.02) continue; k++; }
    return Math.min(k, tubeGeo.instanceCount);
  }
  function buildOcc() {
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements, pe = camera.projectionMatrix.elements;
    const key = [e[0], e[2], e[8], e[10], e[12], e[13], e[14], pe[0], pe[5], T, tubeGeo.instanceCount, leafUniforms.uDropU.value, leafMesh && leafMesh.visible,
      typeof nistkastenFx !== 'undefined' && nistkastenFx.visible ? nistkastenFx.grp.position.y : 0, W(), H()].map(v => typeof v === 'number' ? v.toFixed(3) : String(v)).join('|');
    if (occ && key === occKey) return;
    occKey = key;
    camera.getWorldDirection(fwd);
    const w = W(), h = H(), fpx = h / (2 * Math.tan(camera.fov * Math.PI / 360));
    occ = { w, h, fpx, cells: Array.from({ length: GN * GN }, () => []), items: [] };
    const add = (it) => {
      const idx = occ.items.length; occ.items.push(it);
      const pad = Math.max(it[4], it[8]);
      const x0 = Math.min(it[1], it[5]) - pad, x1 = Math.max(it[1], it[5]) + pad, y0 = Math.min(it[2], it[6]) - pad, y1 = Math.max(it[2], it[6]) + pad;
      if (x1 < 0 || y1 < 0 || x0 >= w || y0 >= h) return;
      const cx0 = Math.max(0, Math.floor(x0 / w * GN)), cx1 = Math.min(GN - 1, Math.floor(x1 / w * GN));
      const cy0 = Math.max(0, Math.floor(y0 / h * GN)), cy1 = Math.min(GN - 1, Math.floor(y1 / h * GN));
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) occ.cells[cy * GN + cx].push(idx);
    };
    const Sa = tubeGeo.getAttribute('aStart').array, Ea = tubeGeo.getAttribute('aEnd').array, Rd = tubeGeo.getAttribute('aRad').array;
    for (let k = 0; k < tubeGeo.instanceCount; k++) {
      scr(tmp.set(Sa[k * 3], Sa[k * 3 + 1], Sa[k * 3 + 2]), a3); scr(tmp.set(Ea[k * 3], Ea[k * 3 + 1], Ea[k * 3 + 2]), b3);
      if (a3[2] < 0.05 || b3[2] < 0.05) continue;
      const fa = 1 + Math.exp(-Math.max(Sa[k * 3 + 1], 0) * 2.4) * sm(0.025, 0.12, Rd[k * 2]) * 1.6;
      const ra = Rd[k * 2] * fa * 1.06, rb = Rd[k * 2 + 1] * 1.06;
      add([0, a3[0], a3[1], a3[2], ra * fpx / a3[2], b3[0], b3[1], b3[2], rb * fpx / b3[2], ra, rb]);
    }
    if (leafMesh && leafMesh.visible) {
      const ga = leafMesh.geometry.getAttribute('aGrow').array, M = leafMesh.instanceMatrix.array, ls = leafUniforms.uLeafScale.value;
      for (let k = 0; k < ga.length; k++) {
        if (ga[k] < 0.25 || seasonGone(k)) continue;
        const o = k * 16, g = ga[k] * ls;
        tmp.set(M[o + 12] + M[o + 4] * 0.5 * g, M[o + 13] + M[o + 5] * 0.5 * g, M[o + 14] + M[o + 6] * 0.5 * g);
        scr(tmp, a3); if (a3[2] < 0.05) continue;
        const Rw = 0.5 * Math.hypot(M[o + 4], M[o + 5], M[o + 6]) * g * LEAF_K, R = Rw * fpx / a3[2];   // Büschel decken die Karte nicht ganz
        add([2, a3[0], a3[1], a3[2], R, a3[0], a3[1], a3[2], R, 0, 0]);
      }
    }
    if (typeof nistkastenFx !== 'undefined' && nistkastenFx.visible) {
      scr(nistkastenFx.grp.position, a3);
      if (a3[2] > 0.05) { const R = 0.3 * fpx / a3[2]; add([1, a3[0], a3[1], a3[2] - 0.12, R, a3[0], a3[1], a3[2] - 0.12, R, 0, 0]); }
    }
  }
  // 0 = frei, 1 = Ast oder Kasten davor, 2 = Laub davor, 3 = außerhalb der Leinwand
  function hidden(w) {
    scr(w, sp); const x = sp[0], y = sp[1], d = sp[2];
    if (x < 0 || y < 0 || x >= occ.w || y >= occ.h) return 3;
    const cell = occ.cells[Math.floor(y / occ.h * GN) * GN + Math.floor(x / occ.w * GN)];
    for (let j = 0; j < cell.length; j++) {
      const it = occ.items[cell[j]];
      if (it[0] !== 0) {
        if (it[3] > d - 0.04) continue;
        const dx = x - it[1], dy = y - it[2]; if (dx * dx + dy * dy < it[4] * it[4]) return it[0];
      } else {
        const vx = it[5] - it[1], vy = it[6] - it[2], L2 = vx * vx + vy * vy;
        let u = L2 > 1e-6 ? ((x - it[1]) * vx + (y - it[2]) * vy) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const dx = it[1] + vx * u - x, dy = it[2] + vy * u - y, r = it[4] + (it[8] - it[4]) * u;
        if (dx * dx + dy * dy > r * r) continue;
        const front = it[3] + (it[7] - it[3]) * u - (it[9] + (it[10] - it[9]) * u);
        if (front < d - 0.01) return 1;
      }
    }
    return 0;
  }
  // Prüfstellen der hängenden Fledermaus (Anteile von Breite/Höhe der Haltung „wach“, unter dem Anker)
  const HSAMP = [[0, 0.12], [-0.28, 0.35], [0.28, 0.35], [0, 0.5], [-0.25, 0.7], [0.25, 0.7], [0, 0.88, 1], [-0.18, 0.95, 1], [0.18, 0.95, 1]];
  let warum = {};
  function hangSpots() {
    warum = { stuecke: 0, steil: 0, dicke: 0, tief: 0, stamm: 0, bild: 0, verdeckt: 0, kasten: 0, wohn: 0, gut: 0 };
    if (!tree || !tubeGeo || !rad) return [];
    buildOcc();
    const Sa = tubeGeo.getAttribute('aStart').array, Ea = tubeGeo.getAttribute('aEnd').array, Rd = tubeGeo.getAttribute('aRad').array;
    const nk = nodeSegs(), cnt = tubeGeo.instanceCount, out = [];
    const hh = HANG0 * SC, hw = hh * HG.wach.w / HG._hoehe;
    // Wohnast des Eichhörnchens (Stücke nach den Knoten): nicht daneben
    const wohn = [];
    for (let k = nk; k < cnt; k++) wohn.push([Sa[k * 3], Sa[k * 3 + 1], Sa[k * 3 + 2], Ea[k * 3], Ea[k * 3 + 1], Ea[k * 3 + 2]]);
    const segD = (p, s) => { const vx = s[3] - s[0], vy = s[4] - s[1], vz = s[5] - s[2], L2 = vx * vx + vy * vy + vz * vz; let u = L2 > 0 ? ((p.x - s[0]) * vx + (p.y - s[1]) * vy + (p.z - s[2]) * vz) / L2 : 0; u = Math.min(1, Math.max(0, u)); return Math.hypot(s[0] + vx * u - p.x, s[1] + vy * u - p.y, s[2] + vz * u - p.z); };
    // Wohnast: Bogenlänge vom Stamm aus (das Eichhörnchen liegt bei ~1,8; ab Stufe 6 dort Abstand halten)
    const wohnS = []; { let acc = 0; for (let k = nk; k < cnt; k++) { const L = Math.hypot(Ea[k * 3] - Sa[k * 3], Ea[k * 3 + 1] - Sa[k * 3 + 1], Ea[k * 3 + 2] - Sa[k * 3 + 2]); wohnS.push(acc + L / 2); acc += L; } }
    const q = new V();
    for (let k = 0; k < cnt; k++) {
      const amWohn = k >= nk;
      if (amWohn && P >= 5.98 && Math.abs(wohnS[k - nk] - 1.82) < 0.6) { warum.wohn++; continue; }
      warum.stuecke++;
      const ax = Sa[k * 3], ay = Sa[k * 3 + 1], az = Sa[k * 3 + 2], dx = Ea[k * 3] - ax, dy = Ea[k * 3 + 1] - ay, dz = Ea[k * 3 + 2] - az;
      const L = Math.hypot(dx, dy, dz), r0 = Rd[k * 2], r1 = Rd[k * 2 + 1];
      if (L < 0.02 || Math.abs(dy) / L > 0.5) { warum.steil++; continue; }
      if (Math.min(r0, r1) < 0.01 || Math.max(r0, r1) > 0.17) { warum.dicke++; continue; }
      for (const u of [0.3, 0.6]) {
        const r = r0 + (r1 - r0) * u;
        q.set(ax + dx * u, ay + dy * u - r * 0.92, az + dz * u);
        if (q.y < hh + 0.55) { warum.tief++; continue; }
        if (Math.hypot(q.x, q.z) < trunkR(q.y) + 0.12 + hw * 0.6) { warum.stamm++; continue; }
        if (typeof nistkastenFx !== 'undefined' && nistkastenFx.visible && q.distanceTo(nistkastenFx.grp.position) < 0.5) { warum.kasten++; continue; }
        if (!amWohn && wohn.some(s => segD(q, s) < 0.45)) { warum.wohn++; continue; }
        // im Bild (nicht unten rechts beim Knopf, nicht am Rand)
        tmp.copy(q).project(camera); tmp2.copy(q).addScaledVector(UP, -hh).project(camera);
        if (Math.abs(tmp.x) > 0.86 || tmp.y > 0.86 || tmp2.y < -0.8 || tmp.z > 1 || (tmp.x > 0.5 && tmp2.y < -0.38)) { warum.bild++; continue; }
        let n = 0, bad = false;
        for (const s of HSAMP) {
          tmp3.copy(q).addScaledVector(STAGE_R, s[0] * hw).addScaledVector(UP, -s[1] * hh).addScaledVector(STAGE_D, 0.02);
          const h = hidden(tmp3);
          if (!h) continue;
          if (s[2] || h === 3 || h === 2 || ++n > 1) { bad = true; break; }   // Kopf frei, kein Laub davor, höchstens ein Ast
        }
        if (bad) { warum.verdeckt++; continue; }
        warum.gut++;
        const st = toSt(q);
        out.push({ p: q.clone(), k, r, wohn: amWohn, score: 0.5 * sm(-1, 1.5, st.z) + 0.3 * (1 - Math.min(1, Math.abs(st.x) / 3)) + rr(0, 0.4) });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }
  function pickSpot(b) {
    const s = hangSpots().filter(c => !BATS.some(o => o !== b && o.spot && o.spot.p.distanceTo(c.p) < 0.6 * SC));
    return s.length ? s[Math.floor(Math.random() * Math.min(3, s.length))] : null;
  }

  // ---------------------------------------------------------------- Besuch
  let visit = null, vt = 0, last = 0, next = rr(60, 180);
  function startVisit(o = {}) {
    if (!allowed(o.force) || !canStart()) return false;
    init(); stopNow();
    const px = pickScale();
    const n = o.n || (Math.random() < 0.45 ? 3 : 2);
    const side0 = Math.random() < 0.5 ? -1 : 1;
    visit = { t: 0, force: !!o.force, px: Math.round(px), mothAt: rr(4, 8), mothDone: false, mothTries: 0, rest: Math.random() < 0.4, out: 0 };
    for (let i = 0; i < MAXN; i++) {
      const b = BATS[i]; b.st = 'weg'; hideBat(b);
      if (i >= n) continue;
      const side = Math.random() < 0.7 ? side0 : -side0;
      Object.assign(b, { st: 'warten', wait: i * rr(0.6, 1.8), side, dir: -side, a: side * rr(0.9, 1.5), b: rr(-0.2, 0.5), wp: new V(), near: false, lowOk: false, hover: 0, hoverT: 0,
        jagd: rr(24, 38), t: 0, fang: false, beute: false, beuteH: false, spot: null, plan: null, fall: 0, roll: 0, flapA: 0.5, wantRest: false, fade: 1, leaveWp: null,
        eatFly: 0, headDown: false, noHull: false, vorn: false, vornP: null, final: false, quick: false, missOk: false, wpT: 0, lastDir: null });
    }
    return true;
  }
  function enter(b) {
    buildHull();
    const y = hc.y + hbox.y * rr(-0.2, 0.5), z = toSt(hc).z + rr(-0.5, 1.0);
    b.pos.copy(stageToWorld(edgeStageX(b.side, y, z, Math.max(4, hbox.x * 1.3)), y, z));
    b.vel.copy(STAGE_R).multiplyScalar(-b.side * 2.2);
    b.st = 'jagd'; b.t = 0; b.fade = 1;
    around(b.a, b.b, 0.6, b.wp);
  }
  function leave(b, quick = false) {
    const from = b.st === 'haengt' && b.spot ? b.spot.p : b.pos;
    const side = toSt(from).x >= 0 ? 1 : -1;
    buildHull();
    const y = hc.y + hbox.y * rr(0.1, 0.8), z = toSt(hc).z + rr(-1.0, 0.5);
    b.leaveWp = stageToWorld(edgeStageX(side, y, z, Math.max(4, hbox.x * 1.3)) + side * 0.6, y, z);
    b.quick = quick; b.near = false; b.lowOk = false; b.hover = 0; b.hoverT = 0; b.fang = false;
    if (b.st === 'haengt') { b.plan = null; startDrop(b); return; }    // erst fallen lassen, dann davon
    if (b.st === 'faellt') return;
    b.st = 'ab';
  }
  function hideBat(b) { b.grp.visible = false; b.hang[0].visible = b.hang[1].visible = false; b.maul.visible = false; }
  function stopNow() {
    visit = null;
    for (const b of BATS) { b.st = 'weg'; b.spot = null; b.plan = null; hideBat(b); }
    if (moth) { moth.on = false; moth.grp.visible = false; }
    for (const x of bits) { x.on = false; x.m.visible = false; }
    window.__fm = null;
  }
  function away() { if (!visit) return; for (const b of BATS) if (b.st !== 'weg') { if (b.st === 'warten') b.st = 'weg'; else leave(b, true); } if (moth.on) moth.out = true; }

  // ---------------------------------------------------------------- Falter
  function spawnMoth() {
    const a = rr(-1.1, 1.1), bb = rr(-0.35, 0.35);
    around(a, bb, 0.08, moth.home);
    moth.pos.copy(moth.home).addScaledVector(STAGE_D, 0.9).add(tmp.set(0, rr(0.3, 0.7), 0));
    moth.vel.set(0, 0, 0); moth.on = true; moth.caught = false; moth.t = 0; moth.fade = 0; moth.out = false; moth.flee = 0;
    // die nächste Fledermaus im Jagdflug jagt ihn
    let best = null, bd = 1e9;
    for (const b of BATS) if (b.st === 'jagd' && !b.beute) { const d = b.pos.distanceTo(moth.home) + (b.wantRest ? 5 : 0); if (d < bd) { bd = d; best = b; } }
    if (best) best.wantRest = false;
    if (best) { best.fang = true; best.missOk = Math.random() < 0.35; }
    visit.mothDone = true;
  }
  function stepMoth(dt) {
    if (!moth.on) return;
    moth.t += dt;
    moth.fade = moth.out ? Math.max(0, moth.fade - dt * 2) : Math.min(1, moth.fade + dt * 2.5);
    if (moth.out && moth.fade <= 0) { moth.on = false; moth.grp.visible = false; return; }
    // flattert unstet um seinen Platz am Laub; flieht kurz, wenn eine Fledermaus nah ist
    const t = moth.t + moth.ph * 10, acc = tmp2.set(Math.sin(t * 3.1) + Math.sin(t * 7.3) * 0.6, Math.sin(t * 4.3 + 1) * 0.8 + Math.sin(t * 9.1) * 0.4, Math.cos(t * 3.7) + Math.cos(t * 6.1) * 0.5).multiplyScalar(1.6);
    acc.addScaledVector(tmp.subVectors(moth.home, moth.pos), 1.8);
    if (moth.flee > 0) { moth.flee -= dt; acc.y -= 6; }
    moth.vel.addScaledVector(acc, dt).multiplyScalar(Math.exp(-dt * 1.6));
    const v = moth.vel.length(); if (v > 0.9) moth.vel.multiplyScalar(0.9 / v);
    moth.pos.addScaledVector(moth.vel, dt);
    if (moth.t > 14 && !moth.out) moth.out = true;      // keiner fängt ihn: verschwindet im Dunkeln
  }
  function drawMoth() {
    if (!moth.on) { moth.grp.visible = false; return; }
    const g = moth.grp; g.position.copy(moth.pos); g.scale.setScalar(KM);
    tmp.copy(moth.vel); if (Math.hypot(tmp.x, tmp.z) < 1e-3) tmp.copy(STAGE_R);     // senkrecht/still: Kopf zur Seite
    tmp.y = tmp.y * 0.4; tmp.normalize();
    basis(g.quaternion, tmp, UP);
    const a = 0.35 + 0.75 * Math.sin((moth.t + moth.ph) * Math.PI * 2 * 11);
    setWings(g.geometry, moth.base, moth.nb, a, 1);
    g.material.opacity = moth.fade; g.visible = moth.fade > 0.01;
  }
  // herabfallende Falterflügel (Fraßplatz)
  function dropWings(p) {
    for (const [i, x] of bits.entries()) {
      x.on = true; x.t = 0; x.p.copy(p).addScaledVector(STAGE_R, (i ? 1 : -1) * 0.03 * SC); x.v.set(rr(-0.15, 0.15), rr(-0.1, 0.05), rr(-0.1, 0.1)); x.rot = rr(0, 6.3); x.w = rr(5, 9) * (i ? 1 : -1);
    }
  }
  function stepBits(dt) {
    for (const x of bits) {
      if (!x.on) continue;
      x.t += dt;
      x.v.y = Math.max(-0.32, x.v.y - 0.6 * dt);
      x.p.addScaledVector(x.v, dt); x.p.x += Math.sin(x.t * 3 + x.rot) * 0.18 * dt; x.rot += x.w * dt;
      if (x.p.y < 0.02) { x.p.y = 0.02; x.v.set(0, 0, 0); x.w = 0; }
      if (x.t > 9) { x.on = false; x.m.visible = false; }
    }
  }
  function drawBits() {
    for (const x of bits) {
      if (!x.on) { x.m.visible = false; continue; }
      const s = KM * NF.H * 0.62;                         // ein Flügel ist kleiner als der ganze Falter
      x.m.position.copy(x.p); x.m.quaternion.copy(STAGE_Q).multiply(tmp2q.setFromAxisAngle(zA, x.rot)); x.m.rotateX(Math.sin(x.t * 5) * 0.9);
      x.m.scale.set(s * x.asp, s, 1); x.m.material.opacity = 1 - sm(6, 9, x.t); x.m.visible = true;
    }
  }

  // ---------------------------------------------------------------- Flug
  const mtx = new THREE.Matrix4(), bx = new V(), by = new V(), bz = new V(), tmp2q = new THREE.Quaternion(), zA = new V(0, 0, 1), xA = new V(1, 0, 0);
  function basis(q, x, y) {
    bx.copy(x).normalize(); bz.crossVectors(bx, y).normalize(); by.crossVectors(bz, bx).normalize();
    return q.setFromRotationMatrix(mtx.makeBasis(bx, by, bz));
  }
  const acc = new V();
  function fly(b, dt, target, speed, o = {}) {
    acc.subVectors(target, b.pos);
    const dist = acc.length();
    const vDes = speed * (o.brake ? Math.min(1, 0.25 + dist / o.brake) : 1);
    acc.multiplyScalar(vDes / Math.max(1e-4, dist)).sub(b.vel).multiplyScalar(o.steer || 3.2);
    // unstet: weiche Zufallsbewegung (Haken)
    const t = vt * 1.7 + b.seed;
    acc.x += (Math.sin(t * 2.3) + Math.sin(t * 5.1 + 1.3) * 0.7) * (o.jit ?? 2.2);
    acc.y += (Math.sin(t * 3.1 + 2) + Math.sin(t * 6.7) * 0.5) * (o.jit ?? 2.2) * 0.7;
    acc.z += (Math.cos(t * 2.7 + 0.4) + Math.cos(t * 4.9) * 0.7) * (o.jit ?? 2.2);
    if (!o.free) avoid(b, acc, dt);
    const am = o.amax || 14; if (acc.length() > am) acc.multiplyScalar(am / acc.length());
    // Querbeschleunigung → in die Kurve legen
    tmp.copy(b.vel); const v0 = tmp.length();
    b.vel.addScaledVector(acc, dt);
    const vmax = (o.vmax || speed * 1.25); if (b.vel.length() > vmax) b.vel.multiplyScalar(vmax / b.vel.length());
    if (v0 > 0.1) {
      tmp2.crossVectors(tmp.normalize(), UP);             // rechts
      const lat = acc.dot(tmp2);
      b.roll += (Math.max(-0.9, Math.min(0.9, lat * 0.09)) - b.roll) * Math.min(1, dt * 6);
    }
    b.pos.addScaledVector(b.vel, dt);
    return dist;
  }
  // Flügelschlag: schneller Abschlag, langsamer Aufschlag (Flügel dabei etwas eingezogen)
  function flap(b, dt, hz, amp = 1) {
    b.ph = (b.ph + dt * hz) % 1;
    const u = b.ph < 0.42 ? b.ph / 0.42 : 1 - (b.ph - 0.42) / 0.58;   // 0 oben → 1 unten → 0
    const a = 1.15 - u * u * (3 - 2 * u) * 1.95 * amp;                  // oben ~66°, unten ~−46°
    b.flapA = a; b.fold = b.ph >= 0.42 ? Math.sin((b.ph - 0.42) / 0.58 * Math.PI) : 0;
  }
  function drawFly(b, fade = 1) {
    const g = b.grp; g.position.copy(b.pos); g.scale.setScalar(K);
    tmp.copy(b.vel); const hz = Math.hypot(tmp.x, tmp.z);
    if (b.headDown) { tmp.set(0, -1, 0).addScaledVector(STAGE_D, 0.25); tmp2.copy(STAGE_D).negate(); basis(g.quaternion, tmp, tmp2); }   // Bauch zur Kamera wie „los“
    else {
      if (hz < 0.05) tmp.copy(b.lastDir || STAGE_R); else { tmp.y = Math.max(-0.6, Math.min(0.6, tmp.y / hz)) * hz * 0.6; b.lastDir = (b.lastDir || new V()).copy(tmp).setY(0).normalize(); }
      tmp.normalize();
      tmp2.copy(UP).applyAxisAngle(tmp, b.roll);
      basis(g.quaternion, tmp, tmp2);
    }
    setWings(g.geometry, b.base, F.BW, b.flapA, 1 - 0.18 * (b.fold || 0));
    g.material.opacity = fade; g.visible = fade > 0.01;
    b.hang[0].visible = b.hang[1].visible = false;
    // Falter im Maul
    if (b.beute) {
      tmp.set(F.schulter - F.schnauze + 6, -4, 0).applyQuaternion(g.quaternion).multiplyScalar(K).add(b.pos);
      b.maul.position.copy(tmp); b.maul.quaternion.copy(STAGE_Q); const s = KM * NF.H * 0.8; b.maul.scale.set(s * 0.45, s, 1);
      b.maul.material.opacity = fade; b.maul.visible = true;
    } else b.maul.visible = false;
  }

  // ---------------------------------------------------------------- Hängen
  // Plan: [Haltung, Dauer, Extra] – Extra: 'kau' (kauen), 'fl' (Falterflügel fallen am Ende)
  function hangPlan(b) {
    const P_ = [['los', 0.35]];
    if (b.beute) P_.push(['fressen', rr(4.5, 6.5), 'kau'], ['fressen', 0.6, 'fl'], ['los', rr(0.8, 1.2)]);
    P_.push(['wach', rr(1.2, 2.2)], ['schauen', rr(1.0, 1.8)]);
    if (b.beute || Math.random() < 0.6) P_.push(['wach', 0.5], ['putzen', rr(2.0, 3.0), 'kau'], ['wach', rr(0.5, 1.0)]);
    if (!b.beute && Math.random() < 0.35) P_.push(['schlaf', rr(2.5, 4.0)], ['wach', 0.8]);
    P_.push(['schauen', rr(0.8, 1.4)], ['wach', 0.5], ['los', 0.45]);
    return { S: P_, i: 0, t: 0, from: null, x: 0 };
  }
  function startHang(b) {
    b.st = 'haengt'; b.plan = hangPlan(b); b.beuteH = b.beute; b.beute = false;
    b.vel.set(0, 0, 0); b.grp.visible = false;
  }
  function startDrop(b) {
    // vom Ast fallen lassen: Figur kopfunter mit offenen Flügeln, fällt, fängt sich und fliegt los
    b.st = 'faellt'; b.fall = 0; b.headDown = true; b.noHull = false;
    b.pos.copy(b.spot.p).addScaledVector(UP, -HANG0 * SC * 0.45);
    b.vel.set(0, -0.4, 0).addScaledVector(STAGE_D, 0.3); b.flapA = -0.2;
    b.spot = null;
  }
  function stepHang(b, dt) {
    const pl = b.plan, A = pl.S[pl.i];
    if (!A) { startDrop(b); return; }
    pl.t += dt; pl.x = Math.min(1, pl.x + dt / 0.16);
    if (A[2] === 'fl' && !pl.fl && pl.t > A[1] * 0.5) { pl.fl = true; tmp.copy(b.spot.p).addScaledVector(UP, -HANG0 * SC * 0.82); dropWings(tmp); }
    if (pl.t >= A[1]) { pl.from = A[0]; pl.i++; pl.t = 0; pl.x = 0; }
  }
  function drawHang(b, fade = 1) {
    const pl = b.plan; if (!pl) return;
    const A = pl.S[Math.min(pl.i, pl.S.length - 1)], pose = window.__fmPose || A[0];
    const kau = A[2] === 'kau' ? Math.sin(pl.t * Math.PI * 2 * 3.2) * 0.012 : 0;
    const setPose = (m, ps, op) => {
      const h = HG[ps], tx = tex['h-' + ps];
      if (m.material.map !== tx) m.material.map = tx;
      const sx = h.w * KH, sy = h.h * KH * (1 + kau);
      m.position.copy(b.spot.p).addScaledVector(STAGE_R, (h.w / 2 - h.zx) * KH).addScaledVector(UP, -(h.h / 2 - h.zy) * KH * (1 + kau)).addScaledVector(STAGE_D, 0.004);
      m.quaternion.copy(STAGE_Q); m.scale.set(sx, sy, 1); m.material.opacity = op; m.visible = op > 0.01;
    };
    // Überblenden (0,16 s): neue Haltung oben, beide in der Mitte voll deckend (kein Durchscheinen)
    const x = pl.from && pl.from !== pose ? pl.x : 1;
    setPose(b.hang[0], pose, fade * Math.min(1, 2 * x)); b.hang[0].renderOrder = 24.2;
    if (x < 1) { setPose(b.hang[1], pl.from, fade * Math.min(1, 2 * (1 - x))); b.hang[1].renderOrder = 24.1; }
    else b.hang[1].visible = false;
    b.grp.visible = false; b.maul.visible = false;
  }

  // ---------------------------------------------------------------- ein Tier
  function stepBat(b, dt) {
    if (b.st === 'weg') return;
    if (b.st === 'warten') { b.wait -= dt; if (b.wait <= 0) enter(b); return; }
    b.t += dt;
    if (b.st === 'haengt') { stepHang(b, dt); return; }
    if (b.st === 'faellt') {
      b.fall += dt;
      b.vel.y -= 5 * dt; b.vel.multiplyScalar(Math.exp(-dt * 1.2));
      b.pos.addScaledVector(b.vel, dt);
      b.flapA += (0.4 - b.flapA) * Math.min(1, dt * 8);
      if (b.fall > 0.28) { b.headDown = false; b.st = b.leaveWp ? 'ab' : 'jagd'; b.vel.addScaledVector(STAGE_D, 1.2).add(tmp.set(0, 1.4, 0)); nextWp(b); }
      return;
    }
    flap(b, dt, b.hoverT > 0 ? 13 : 9.5, b.hoverT > 0 ? 0.85 : 1);
    if (b.st === 'ab') {
      const d = fly(b, dt, b.leaveWp, b.quick ? 3.4 : 2.6, { jit: 1.2 });
      const n = tmp.copy(b.pos).project(camera);
      if (d < 0.5 || Math.abs(n.x) > 1.15 || Math.abs(n.y) > 1.2) { b.st = 'weg'; hideBat(b); }
      return;
    }
    if (b.st === 'anflug') {
      // zum Ast: erst vor die Krone (vor dem Hängeplatz, außerhalb des Laubs), dann von vorn unten heran, langsamer,
      // zuletzt hinauf an den Ast
      const sp = b.spot.p;
      if (!b.vorn) {
        if (!b.vornP) {
          b.vornP = new V().copy(sp).addScaledVector(UP, -0.3 * SC);
          for (let k = 0; k < 24 && gap(b.vornP) < 0.25; k++) b.vornP.addScaledVector(STAGE_D, 0.2);
        }
        const d = fly(b, dt, b.vornP, 2.2, { brake: 1.0, jit: 1.0 });
        if (d < 0.3 * SC || b.t - b.anT > 6) b.vorn = true;
      } else if (!b.final) {
        tmp3.copy(sp).addScaledVector(UP, -HANG0 * SC * 1.6).addScaledVector(STAGE_D, 0.25 * SC);
        b.near = true; b.lowOk = true; b.noHull = gap(b.pos) < 0.6;          // nah am Ziel: das Laub nicht mehr meiden
        const d = fly(b, dt, tmp3, 2.0, { brake: 1.2, jit: 0.6, steer: 4 });
        if (d < 0.18 * SC || b.t - b.anT > 11) { b.final = true; b.finT = b.t; }
      } else {
        tmp3.copy(sp).addScaledVector(UP, -HANG0 * SC * 0.45);
        const d = fly(b, dt, tmp3, 1.0, { brake: 0.5, jit: 0.2, steer: 6, free: true });
        if (d < 0.05 * SC || b.t - b.finT > 3) startHang(b);
      }
      return;
    }
    // Jagd: Falter verfolgen, Wegpunkte um die Krone, Rüttelflug
    if (b.fang && (!moth.on || moth.caught || moth.out)) b.fang = false;
    if (b.fang) {
      tmp3.copy(moth.pos).addScaledVector(moth.vel, 0.25);
      b.near = true; b.lowOk = true;
      const d = fly(b, dt, tmp3, 2.6, { jit: 0.8, steer: 4.5, amax: 18 });
      if (d < 0.5 && moth.flee <= 0 && b.missOk) { moth.flee = 0.5; b.missOk = false; b.vel.addScaledVector(STAGE_R, rr(-1, 1)); }   // knapp daneben
      if (d < 0.12 * SC + 0.05) { moth.caught = true; moth.on = false; moth.grp.visible = false; b.fang = false; b.beute = true; b.beuteT = 0; b.t = Math.min(b.t, b.jagd - 6);
        b.spot = pickSpot(b); if (b.spot) { b.st = 'anflug'; b.final = false; b.vorn = false; b.vornP = null; b.anT = b.t; } else { b.eatFly = 3; }
      }
      return;
    }
    if (b.eatFly > 0) { b.eatFly -= dt; if (b.eatFly <= 0) { tmp.copy(b.pos); dropWings(tmp); b.beute = false; } }
    if (b.hoverT > 0) {
      b.hoverT -= dt;
      fly(b, dt, b.wp, 0.25, { jit: 0.6, steer: 5 });
      if (b.hoverT <= 0) nextWp(b);
      return;
    }
    const d = fly(b, dt, b.wp, 2.2, { jit: 2.2 });
    b.wpT = (b.wpT || 0) + dt;
    if (d < 0.35 * SC + 0.1 || b.wpT > 4) {
      b.wpT = 0;
      if (b.hover > 0) { b.hoverT = b.hover; b.hover = 0; }
      else nextWp(b);
    }
    // Ruhepause ohne Falter (manchmal eine)
    if (b.wantRest && b.t > 6 && !b.spot) { b.wantRest = false; b.spot = pickSpot(b); if (b.spot) { b.st = 'anflug'; b.final = false; b.vorn = false; b.vornP = null; b.anT = b.t; } }
    if (b.t > b.jagd && !b.fang && !b.beute) leave(b);
  }
  function update(dt) {
    if (!visit) {
      if (allowed(false)) {
        vt += dt;
        if (vt >= next && !window.__fmHold && canStart()) { if (!startVisit({})) next = vt + rr(30, 60); }
      }
      stepBits(dt);
      return;
    }
    vt += dt; visit.t += dt;
    const ok = allowed(visit.force);
    if (!ok && !visit.out) { visit.out = 1; away(); }
    // Ruhepause: eine (nicht die Fängerin) darf sich kurz hinhängen
    if (visit.rest && visit.t > 5) { visit.rest = false; const c = BATS.filter(b => b.st === 'jagd' && !b.fang); if (c.length) c[Math.floor(Math.random() * c.length)].wantRest = true; }
    if (!visit.mothDone && visit.t > visit.mothAt && BATS.some(b => b.st === 'jagd')) spawnMoth();
    for (const b of BATS) stepBat(b, dt);
    stepMoth(dt); stepBits(dt);
    if (visit.out) { visit.out += dt; if (visit.out > 4) { for (const b of BATS) if (b.st !== 'weg') { b.st = 'weg'; hideBat(b); } } }
    if (BATS.every(b => b.st === 'weg') && !moth.on) { visit = null; next = vt + rr(300, 600); window.__fm = null; }
  }
  function render() {
    drawBits();
    if (!visit) return;
    const fadeOut = visit.out ? Math.max(0, 1 - (visit.out - 2.5) / 1.5) : 1;
    for (const b of BATS) {
      if (b.st === 'weg' || b.st === 'warten') { hideBat(b); continue; }
      if (b.st === 'haengt') drawHang(b, fadeOut); else drawFly(b, fadeOut);
    }
    drawMoth();
    window.__fm = {
      t: +visit.t.toFixed(1), sc: +SC.toFixed(2), spanPx: Math.round(visit.px * SC), n: BATS.filter(b => b.st !== 'weg').length,
      tiere: BATS.map(b => ({ st: b.st, pose: b.st === 'haengt' && b.plan ? (b.plan.S[Math.min(b.plan.i, b.plan.S.length - 1)] || [])[0] : null, beute: !!(b.beute || b.beuteH && b.st === 'haengt'), fang: !!b.fang,
        p: b.st === 'weg' ? null : [+b.pos.x.toFixed(2), +b.pos.y.toFixed(2), +b.pos.z.toFixed(2)], gap: b.st === 'weg' ? null : +gap(b.pos).toFixed(2), spot: b.spot ? [+b.spot.p.x.toFixed(2), +b.spot.p.y.toFixed(2), +b.spot.p.z.toFixed(2)] : null })),
      falter: moth.on ? { p: [+moth.pos.x.toFixed(2), +moth.pos.y.toFixed(2), +moth.pos.z.toFixed(2)], t: +moth.t.toFixed(1) } : (moth.caught ? 'gefangen' : null),
    };
  }
  function frame() {
    fno++;
    const now = nowMs();
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    if (!window.__fmFreeze) update(dt);
    render();
  }
  window.__fmSim = (sec) => { fno++; for (let k = 0; k < Math.round(sec / 0.033); k++) update(0.033); render(); return window.__fm; };
  Object.defineProperty(window, '__fmNext', { configurable: true, get: () => +(next - vt).toFixed(1), set: (s) => { next = vt + s; } });
  window.__fmPlaetze = () => hangSpots().map(s => ({ p: [+s.p.x.toFixed(2), +s.p.y.toFixed(2), +s.p.z.toFixed(2)], r: +s.r.toFixed(3), wohn: s.wohn, score: +s.score.toFixed(2), px: window.__fmProj(s.p.x, s.p.y, s.p.z) }));
  window.__fmWarum = () => { hangSpots(); return warum; };
  window.__fmBats = BATS;
  window.__fmBits = () => bits.filter(x => x.on).length;
  window.__fmHidden = (x, y, z) => { buildOcc(); return hidden(new V(x, y, z)); };
  window.__fmProj = (x, y, z) => { const n = new V(x, y, z).project(camera); return [Math.round((n.x * 0.5 + 0.5) * W()), Math.round((0.5 - n.y * 0.5) * H())]; };
  // Standbild: n Tiere hängen (pose) an den besten Plätzen bzw. fliegen um die Krone (pose 'flug', Flügelstellung a)
  window.__fmSetzen = (o = {}) => {
    init(); stopNow(); pickScale();
    visit = { t: 0, force: true, px: Math.round(pxLen(hc, SPAN0)), mothAt: 1e9, mothDone: true, rest: false, out: 0 };
    const spots = o.pose && o.pose !== 'flug' ? hangSpots() : [];
    for (let i = 0; i < (o.n || 1); i++) {
      const b = BATS[i];
      Object.assign(b, { st: 'jagd', wp: new V(), a: 0, b: 0, dir: 1, jagd: 1e9, t: 0, fang: false, beute: false, spot: null, plan: null, roll: 0, hoverT: 0, hover: 0, fade: 1, leaveWp: null, eatFly: 0 });
      if (o.pose && o.pose !== 'flug') {
        if (!spots[i]) break;
        b.spot = spots[i]; b.st = 'haengt'; b.plan = { S: [[o.pose, 1e9]], i: 0, t: 0, from: null, x: 1 };
      } else {
        around(o.a ?? (i - 0.5) * 0.9, o.b ?? 0.1 * i, o.m ?? 0.4, b.pos);
        b.vel.copy(STAGE_R).multiplyScalar(o.v ?? 2).add(tmp.set(0, o.vy ?? 0, 0)); b.flapA = o.flap ?? 0.4; b.roll = o.roll ?? 0;
      }
    }
    window.__fmFreeze = true; render();
    return window.__fm;
  };
  // Test (Baum-Test): gleich ein Besuch (force: auch tagsüber, im Winter und auf kleinen Stufen ab 5)
  function now(o = {}) {
    if (!allowed(o.force) || !canStart()) return false;
    return startVisit(o);
  }
  return { frame, now, stop: stopNow, away, get active() { return !!visit; } };
})();
// Play-Knopf: nachts ab Stufe 5, vom Frühling bis zum Herbst
PLAY.add({ id: 'fledermaeuse', ab: 5, zeiten: ['fruehling', 'sommer', 'herbst'], nacht: true, start: () => fledermausFx.now(), aktiv: () => fledermausFx.active, max: 90 });
// ------------------------------------------------------------------ Buntspecht (ab Stufe 5, 28.10.)
// Nutzer 28.10.: ab Stufe 5 zieht ein Buntspecht (Männchen, roter Nacken) ein und baut sich über ein paar Tage eine Höhle –
// er kommt immer wieder, die Höhle wächst sichtbar, nach etwa einer Woche ist sie fertig. Die Höhle wächst mit dem Baum mit
// (Stufe 5 spechtgroß, ab Stufe 8 so groß, dass später eine Eule hineinpasst). Verhalten: klettern und klopfen (Futtersuche
// an der Rinde), in der Höhle schlafen (wird es Nacht, schlüpft er hinein; wird es Tag, schaut er heraus und fliegt los),
// im Winter Spechtschmiede (Eichel in eine Rindenspalte klemmen und aufhacken). Kein Trommeln, kein Ton. Nur tagsüber zu
// sehen; der Baum entscheidet selbst wann (erstes Mal nach 30–90 s, dann alle 3–7 min), dazu Play-Knopf und Test-Knopf.
//
// Höhlenbau: Beginn = Zeitpunkt, an dem der Baum auf Stufe 5 wächst (gemerkt auf dem Gerät: localStorage KEY; im Baum-Test
// – setDay(d, null) – nur im Speicher). Fortschritt 0…1 über 7 Tage, danach dunkelt der frische Rand in 3 Wochen nach.
// Bäume, die schon auf Stufe 5 oder höher stehen (ohne Merker), haben eine fertige Höhle. Gezeichnet im Rinden-Shader (in
// Ruhe-Koordinaten wie das Astloch des Eichhörnchens): Hackspuren (Rinde ab, helles Holz) → Mulde → Loch mit hellem frischem
// Rand → Rand dunkelt nach, darunter eine dunkle Spur. Lage: vorn links am Stamm (−24°), Höhe 0,86 auf der Stammachse –
// unter dem Nistkasten (−18°/−32°, ab 1,26) und weit weg vom Astloch (rechts, +24°, 1,25). Daneben (−36°, 0,52) die
// Rindenspalte der Schmiede (sichtbar, sobald die Höhle halb fertig ist).
//
// Figuren (Bilder: specht/specht-*.webp, Recraft nano_banana_pro, freigestellt; Maße specht-meta.json):
//  – am Stamm ein gemaltes Bild je Haltung (ruhig, klopfen, umschauen, hochschauen; alle auf derselben Leinwand, Fußpunkt
//    gleich). Das Bild liegt auf einem Gitter, das sich um die Füße biegt: Klopfen = Oberkörper kippt nach hinten, Kopf zieht
//    zurück und dreht leicht gegen (Nutzer 28.10.: „Klopfen deutlicher, der Kopf darf sich etwas mehr nach hinten bewegen“).
//  – im Flug die Gliederpuppe des Hähers mit eigenen Maßen und Bogenflug (ein paar Schläge, dann Flügel angelegt: eigenes
//    Bild „bogenflug“); beim Landen/Abheben kurz überblendet.
//  – in die Höhle/heraus: das Bild mit angelegten Flügeln, waagerecht, Schnabel voran; Schnitt am Loch wie beim
//    Eichhörnchen (was hinter der Lochmitte liegt, sieht man nur in der Öffnung, dort zum Inneren hin dunkel).
//  – Späne: kleine gezeichnete Teile (helles Holz, Rinde, Eichelschalen), fliegen vom Schnabel weg und fallen ins Gras;
//    Schalen bleiben im Winter eine Minute im Schnee liegen.
// Größe: 0,42 (Schnabel bis Schwanz; Häher 0,62); ist er im Bild kürzer als MIN_PX CSS-Pixel, wird er größer gezeichnet
// (höchstens doppelt) – die Höhle dann mindestens so groß, dass er hineinpasst.
// Prüfhilfen: window.__specht (Zustand), window.__spechtSim(s) (vorspulen ohne Zeichnen), window.__spechtHold (nicht von selbst).
const spechtFx = (() => {
  const META = {"stamm":{"w":210,"h":386,"feet":[178.9,156.5],"lenPx":350.1,"hinweis":"Leinwand f\u00fcr alle Haltungen gleich; feet = Fu\u00dfpunkt auf der Stammkante (Kante senkrecht bei x = feet[0]); Vogel schaut nach rechts, Stamm rechts","posen":{"ruhig":{"tail":[175.0,359.8],"beak":[145.0,11.0]},"ausholen":{"tail":[176.2,371.0],"beak":[109.0,32.0]},"klopfen":{"tail":[176.2,381.5],"beak":[187.0,97.0]},"ruhig2":{"tail":[174.9,369.8],"beak":[142.0,28.0]},"umschauen":{"tail":[85.7,357.4],"beak":[151.0,85.0]},"hochschauen":{"tail":[175.7,376.2],"beak":[110.0,20.0]}}},"flug":{"body":{"w":704,"h":250,"tail":[6.0,197.0],"beak":[697.0,63.2],"shoulder":[430.0,86.0],"feet":[345.0,226.0]},"wing":{"w":313,"h":630,"base":[215.0,585.0],"top":6.5,"scale":0.932}}}, IMG = {"ruhig": "009694e1ab.webp", "klopfen": "ceb2ae2bf2.webp", "umschauen": "70b627438f.webp", "hochschauen": "0a85c7d136.webp", "koerper": "85bb81b830.webp", "bogenflug": "dd142ee257.webp", "fluegel": "fb963f105d.webp"};
  const D = Math.PI / 180, LEN0 = 0.42, MIN_PX = 26, TONE = 0.96;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t, cl = (x) => Math.min(1, Math.max(0, x));
  const rr = (a, b) => a + Math.random() * (b - a);
  const KEY = 'vanamo-specht', BAU_MS = 7 * 86400000, ALT_MS = 21 * 86400000;
  const HO = { y: 0.86, ang: -24 * D, rx: [0.045, 0.105], ry: [0.05, 0.14] };   // Höhle: Stufe 5 → ab Stufe 8 (Eule)
  const AN = { y: 0.52, ang: -36 * D, w: 0.009, h: 0.032 };                       // Schmiede (Rindenspalte)
  const q = new THREE.Quaternion(), zA = new V(0, 0, 1), tmp = new V(), tmp2 = new V();

  // ---- Zeit des Höhlenbaus (Gerät; im Baum-Test nur im Speicher)
  let jahr = OPT.jahr ?? null, memStart = null, testBau = null, visitAdd = 0;
  let lsVal = null, lsAt = -1e9;
  function getStart() {
    if (jahr == null) return memStart;
    const t = performance.now(); if (t - lsAt < 1000) return lsVal;
    lsAt = t; try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); lsVal = o && Number.isFinite(o.bau) ? o.bau : null; } catch { lsVal = null; }
    return lsVal;
  }
  function setStart(ms) {
    if (jahr == null) { memStart = ms; return; }
    lsVal = ms; lsAt = performance.now(); try { localStorage.setItem(KEY, JSON.stringify({ bau: ms })); } catch {}
  }
  function bauState() {
    if (testBau != null) return { b: cl(testBau + visitAdd), a: testBau >= 1 ? 0.25 : 0 };
    const st = getStart();
    if (st == null) return { b: 1, a: 1 };              // Baum stand schon auf Stufe 5: Höhle längst fertig
    const e = Date.now() - st;
    return { b: cl(e / BAU_MS + visitAdd), a: cl((e - BAU_MS) / ALT_MS) };
  }

  // ---- Stamm: Achse (Weg mit den meisten Nachkommen), Radius wie im Rinden-Shader (Wurzelanlauf, Knubbel)
  let path = null, pathOf = null;
  function mainPath() {
    if (path && pathOf === tree) return path;
    const n = tree.parent.length, kids = {}, cnt = new Int32Array(n).fill(1);
    for (let i = 1; i < n; i++) (kids[tree.parent[i]] = kids[tree.parent[i]] || []).push(i);
    for (let i = n - 1; i > 0; i--) cnt[tree.parent[i]] += cnt[i];
    const out = [0]; let i = 0;
    for (let k = 0; k < 400; k++) { const ch = kids[i]; if (!ch || !ch.length) break; const j = ch.reduce((a, b) => cnt[b] > cnt[a] ? b : a); out.push(j); i = j; }
    path = out; pathOf = tree; return out;
  }
  function axisAt(y) {
    const p = mainPath();
    for (let k = 1; k < p.length; k++) {
      const a = tree.pos[p[k - 1]], b = tree.pos[p[k]];
      if (a.y <= y && b.y >= y) {
        const u = (y - a.y) / Math.max(1e-6, b.y - a.y);
        return { A: a.clone().lerp(b, u), U: b.clone().sub(a).normalize(), r: rad[p[k - 1]] + (rad[p[k]] - rad[p[k - 1]]) * u };
      }
    }
    return null;
  }
  function barkR(A, n, r) {   // wie tubeFrame im Rinden-Shader
    const wang = Math.atan2(A.z + n.z * r, A.x + n.x * r);
    const fl = Math.exp(-Math.max(A.y, 0) * 2.4) * sm(0.025, 0.12, r);
    r *= 1 + fl * (1.05 + 0.75 * Math.pow(Math.max(Math.sin(wang * 5 + 1.3), 0), 1.5) + 0.15 * Math.sin(wang * 3 - 0.7));
    const qx = A.x + n.x * r, qy = A.y + n.y * r, qz = A.z + n.z * r, knob = sm(0.05, 0.28, r);
    return r * (1 + knob * (0.08 * Math.sin(qx * 5.1 + qy * 2.3) * Math.sin(qz * 4.7 - qy * 1.7) + 0.045 * Math.sin(qy * 9.3 + qx * 7.1 + qz * 3.3)));
  }
  // Richtung um die Achse: phi = 0 zur Kamera der Startansicht (STAGE_D), negativ = links
  function dirAt(ax, phi, out = new V()) {
    out.copy(STAGE_D).multiplyScalar(Math.cos(phi)).addScaledVector(STAGE_R, Math.sin(phi));
    return out.addScaledVector(ax.U, -out.dot(ax.U)).normalize();
  }
  // Punkt auf der Rinde in Bühnen-Koordinaten { x, y, z } (Höhe y auf der Achse, Winkel phi)
  function barkStage(y, phi) {
    const ax = axisAt(y); if (!ax) return null;
    const n = dirAt(ax, phi), r = barkR(ax.A, n, ax.r), p = ax.A.clone().addScaledVector(n, r);
    return { x: p.dot(STAGE_R), y: p.y, z: p.dot(STAGE_D), ax, n, r };
  }
  // Vorderste Rinde (Bühnen-z) bei Bühnen-x in Höhe y
  function surfZ(x, y) {
    const ax = axisAt(Math.max(0.02, y)); if (!ax) return 0;
    const cx = ax.A.dot(STAGE_R), cz = ax.A.dot(STAGE_D), r0 = ax.r * 1.12;
    const phi = Math.asin(Math.max(-1, Math.min(1, (x - cx) / r0))), n = dirAt(ax, phi, tmp2), r = barkR(ax.A, n, ax.r);
    const dx = x - cx; return cz + Math.sqrt(Math.max(0, r * r - dx * dx));
  }

  // ---- Größe: wie lang wäre er (LEN0) an der Höhle im Bild? (beim Kommen bestimmt; die Höhle wächst mit)
  let SC = 1;
  function pickScale() {
    const h = barkStage(HO.y, HO.ang); if (!h) return;
    camera.updateMatrixWorld();
    tmp.copy(stageToWorld(h.x, h.y, h.z)); tmp2.copy(tmp).addScaledVector(STAGE_R, LEN0);
    tmp.project(camera); tmp2.project(camera);
    const px = Math.hypot((tmp2.x - tmp.x) * 0.5 * W(), (tmp2.y - tmp.y) * 0.5 * H());
    SC = Math.min(2, Math.max(1, MIN_PX / Math.max(1, px))); lastPx = px;
  }
  let lastPx = 0;

  // ---- Höhle und Schmiede im Rinden-Shader
  const HOLE = { x: 0, y: 0, z: 0, rx: 0.045, ry: 0.05, ox: 0.045, oy: 0.05, ok: false };
  const ANV = { x: 0, y: 0, z: 0, ok: false };
  function placeHole() {
    const U = tubeUniforms, s = cl((P - 5) / 3);
    const h = barkStage(HO.y, HO.ang), a = barkStage(AN.y, AN.ang);
    if (!h || !a) { HOLE.ok = ANV.ok = false; U.uSpS.value.z = 0; U.uAnS.value.z = 0; return; }
    HOLE.rx = lerp(HO.rx[0], HO.rx[1], s); HOLE.ry = lerp(HO.ry[0], HO.ry[1], s);
    const R = new V().crossVectors(h.ax.U, h.n).normalize();
    U.uSpA.value.copy(h.ax.A); U.uSpN.value.copy(h.n); U.uSpR.value.copy(R); U.uSpU.value.copy(h.ax.U);
    const bs = bauState(), on = P >= 4.98 ? 1 : 0;
    U.uSpS.value.set(HOLE.rx, HOLE.ry, on * bs.b, bs.a);
    Object.assign(HOLE, { x: h.x, y: h.y, z: h.z, ok: true, ox: HOLE.rx * Math.abs(h.n.dot(STAGE_D)) * 1.05, oy: HOLE.ry * 1.1 });
    const Ra = new V().crossVectors(a.ax.U, a.n).normalize(), ap = a.ax.A.clone().addScaledVector(a.n, a.r);
    U.uAnA.value.copy(ap); U.uAnN.value.copy(a.n); U.uAnR.value.copy(Ra); U.uAnU.value.copy(a.ax.U);
    U.uAnS.value.set(AN.w * Math.max(1, s * 1.6), AN.h * Math.max(1, s * 1.6), on * sm(0.45, 0.6, bs.b));
    Object.assign(ANV, { x: a.x, y: a.y, z: a.z, ok: true });
  }

  // ---- Schnitt am Loch (wie das Eichhörnchen im Winter): in Bühnen-Koordinaten der Weltlage
  const CU = { uClipC: { value: new THREE.Vector2() }, uClipR: { value: new THREE.Vector2(1, 1) }, uClipD: { value: new THREE.Vector2(1, 0) }, uClipM: { value: 0 }, uStR: { value: STAGE_R.clone() } };
  function addClip(m, key) {
    m.customProgramCacheKey = () => 'spechtClip-' + key;   // die Nachtfärbung hüllt onBeforeCompile ein: eigener Schlüssel
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, CU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vClipP; uniform vec3 uStR;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 cwp = modelMatrix * vec4(transformed, 1.); vClipP = vec2(dot(cwp.xyz, uStR), cwp.y); }');
      sh.fragmentShader = 'uniform vec2 uClipC; uniform vec2 uClipR; uniform vec2 uClipD; uniform float uClipM; varying vec2 vClipP;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  if (uClipM > .5) {
    vec2 o = vClipP - uClipC; float e = length(o / uClipR); float w = dot(o, uClipD) / uClipR.x;
    if (uClipM < 1.5) {                                   // hinein/heraus: hinter der Lochmitte nur in der Öffnung, dort dunkel
      if (w > 0. && e >= 1.) discard;
      float deep = smoothstep(-.6, .45, w) * mix(1. - smoothstep(.8, 1., e), 1., smoothstep(-.2, .2, w));
      diffuseColor.rgb *= mix(1., .05, deep);
    } else {                                              // Kopf schaut heraus: nur die Öffnung, hinten dunkler
      diffuseColor.a *= 1. - smoothstep(.9, 1., e);
      diffuseColor.rgb *= mix(1., .12, smoothstep(-.3, .9, w));
    }
  }`);
    };
  }
  const night = (mesh) => { const m = mesh.material; __nightify(m); __nightPic(m); __picMeshes.add(mesh); };

  // ---- Figuren (erst beim ersten Mal)
  let ready = false, tex = null, fig = null, pup = null, fly = null, slip = null, nut = null, chips = null;
  const MS = META.stamm, KS = LEN0 / MS.lenPx;                                   // Welt je Bildpunkt (Stamm-Bilder)
  const FB = META.flug.body, KF = LEN0 / (FB.beak[0] - FB.tail[0]);              // Welt je Bildpunkt (Flugbild)
  const beakL = (pose) => [(MS.posen[pose].beak[0] - MS.feet[0]) * KS, (MS.feet[1] - MS.posen[pose].beak[1]) * KS];
  const HEADU = [(102 - MS.feet[0]) * KS, (MS.feet[1] - 30) * KS];              // Gesichtsmitte im Bild „umschauen“
  const AX = Math.atan2(FB.tail[1] - FB.beak[1], FB.beak[0] - FB.tail[0]);      // Achse Schwanz→Schnabel im Flugbild (11° schräg)
  const BV = [(FB.beak[0] - FB.w / 2) * KF, (FB.h / 2 - FB.beak[1]) * KF];
  const SLEN = Math.hypot(FB.beak[0] - FB.tail[0], FB.beak[1] - FB.tail[1]) * KF;
  const PB = 1 / (FB.beak[0] - FB.tail[0]);
  const FEET = [(FB.feet[0] - FB.shoulder[0]) * PB, (FB.shoulder[1] - FB.feet[1]) * PB];   // Füße unter dem Bauch (Puppen-Einheiten)

  function init() {
    if (ready) return; ready = true;
    const loader = new THREE.TextureLoader();
    const ld = (k) => { const t = loader.load(__img(IMG[k])); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    tex = { ruhig: ld('ruhig'), klopfen: ld('klopfen'), umschauen: ld('umschauen'), hochschauen: ld('hochschauen'),
      koerper: ld('koerper'), bogenflug: ld('bogenflug'), fluegel: ld('fluegel') };
    const te = loader.load(SEQIMG.eichel); te.colorSpace = THREE.SRGBColorSpace; tex.eichel = te;
    fig = makeFigure();
    pup = createJayPuppet(THREE, { body: tex.koerper, wing: tex.fluegel, fold: tex.bogenflug }, { depthTest: true, order: 24, tone: TONE,
      freq: 6.5, up: 76, down: -54, lag: 34, fold: 60, sweep: -8, lift: 0.02, pitch: 3, tail: 6, tilt: 20,
      beats: 0, glide: 0, foldGlide: true, blur: 2, blurDt: 0.011, blurA: [0.28, 0.12] }, META.flug);
    fly = pup.group; fly.visible = false; scene.add(fly);
    for (const m of pup.meshes) night(m);
    const sMat = new THREE.MeshBasicMaterial({ map: tex.bogenflug, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide, depthTest: true, depthWrite: false, toneMapped: false });
    sMat.color.setScalar(TONE); addClip(sMat, 'slip');
    slip = new THREE.Mesh(new THREE.PlaneGeometry(FB.w * KF, FB.h * KF), sMat); slip.renderOrder = 23; slip.visible = false; slip.frustumCulled = false; scene.add(slip); night(slip);
    const nMat = new THREE.MeshBasicMaterial({ map: tex.eichel, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthTest: true, depthWrite: false, toneMapped: false });
    nMat.color.setScalar(TONE);
    nut = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.047), nMat); nut.renderOrder = 26; nut.visible = false; nut.frustumCulled = false; scene.add(nut); night(nut);
    chips = makeChips();
  }

  // ---- Figur am Stamm: Bild auf einem biegsamen Gitter (Ursprung = Fußpunkt, y nach oben, schaut nach rechts)
  function makeFigure() {
    const Wd = MS.w * KS, Hd = MS.h * KS, fx = MS.feet[0] * KS, fy = MS.feet[1] * KS;
    const grp = new THREE.Group(); grp.visible = false; scene.add(grp);
    const mkGeo = () => { const g = new THREE.PlaneGeometry(Wd, Hd, 8, 22); g.translate(Wd / 2 - fx, -Hd / 2 + fy, 0); g.userData.base = g.attributes.position.array.slice(); return g; };
    const mk = (key, order) => {
      const m = new THREE.MeshBasicMaterial({ map: tex.ruhig, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide, depthTest: true, depthWrite: false, toneMapped: false });
      m.color.setScalar(TONE); addClip(m, key);
      const mesh = new THREE.Mesh(mkGeo(), m); mesh.renderOrder = order; mesh.frustumCulled = false; grp.add(mesh); return mesh;
    };
    const a = mk('stammA', 21), b = mk('stammB', 22); b.visible = false;
    night(a); night(b);
    const HB = {}; for (const n in MS.posen) HB[n] = Math.max(0.04, (MS.feet[1] - MS.posen[n].beak[1]) * KS);
    let cur = 'ruhig', th = 0, head = 0, ret = 0, op = 1;
    function warp(x, y, Hb) {
      const w = sm(-0.15 * Hb, 0.7 * Hb, y), w2 = sm(0.3 * Hb, 0.95 * Hb, y);
      x -= ret * w2;
      const r = th * w, c = Math.cos(r), s = Math.sin(r);
      let X = x * c - y * s, Y = x * s + y * c;
      if (head && w2 > 0) {
        const ny = 0.55 * Hb, nx = -ny * Math.sin(r), nY = ny * Math.cos(r), r2 = head * w2, c2 = Math.cos(r2), s2 = Math.sin(r2);
        const dx = X - nx, dy = Y - nY; X = nx + dx * c2 - dy * s2; Y = nY + dx * s2 + dy * c2;
      }
      return [X, Y];
    }
    function bend(g, name) {
      const p = g.attributes.position.array, b0 = g.userData.base, Hb = HB[name] || 0.1;
      for (let i = 0; i < p.length; i += 3) { const [X, Y] = warp(b0[i], b0[i + 1], Hb); p[i] = X; p[i + 1] = Y; }
      g.attributes.position.needsUpdate = true;
    }
    return {
      group: grp, a, b,
      setPose(n) { if (n === cur) return; cur = n; a.material.map = tex[n]; },   // Vögel wechseln die Haltung ruckartig
      update() { a.material.opacity = op; bend(a.geometry, cur); },
      beakWorld(out) { const P0 = MS.posen[cur].beak, [X, Y] = warp((P0[0] - MS.feet[0]) * KS, (MS.feet[1] - P0[1]) * KS, HB[cur]); return out.set(X, Y, 0).applyMatrix4(grp.matrixWorld); },
      get pose() { return cur; },
      set bend(v) { th = v; }, set head(v) { head = v; }, set retract(v) { ret = v; }, set opacity(v) { op = v; },
      reset() { th = head = ret = 0; op = 1; },
    };
  }

  // ---- Späne: helles Holz (Höhle), Rinde (Futtersuche), Eichelschalen (Schmiede)
  function makeChips() {
    const ROWS = 3, cv = document.createElement('canvas'); cv.width = 256; cv.height = 64 * ROWS;
    const g = cv.getContext('2d');
    let s0 = 7; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;
    const shapes = [[[.12, .4], [.55, .18], [.9, .35], [.78, .62], [.3, .75]], [[.2, .2], [.85, .3], [.7, .8], [.25, .66]], [[.1, .5], [.5, .25], [.92, .48], [.48, .72]], [[.25, .15], [.75, .25], [.8, .7], [.45, .88], [.15, .6]]];
    for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
      const x0 = i * 64, y0 = row * 64, shp = shapes[i];
      g.beginPath(); shp.forEach(([u, v], j) => { const x = x0 + 6 + u * 52, y = y0 + 6 + v * 52; j ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
      const grd = g.createLinearGradient(x0, y0, x0 + 64, y0 + 64);
      if (row === 0) { grd.addColorStop(0, '#f3e2bd'); grd.addColorStop(1, '#d9bb87'); } else { grd.addColorStop(0, '#8a715a'); grd.addColorStop(1, '#5d4a3a'); }
      g.fillStyle = grd; g.fill(); g.lineWidth = 2.2; g.strokeStyle = row === 0 ? 'rgba(120,88,52,.85)' : 'rgba(45,34,26,.9)'; g.stroke();
      g.strokeStyle = row === 0 ? 'rgba(170,130,80,.55)' : 'rgba(40,30,22,.5)'; g.lineWidth = 1;
      for (let f = 0; f < 3; f++) { g.beginPath(); g.moveTo(x0 + 16 + rnd() * 10, y0 + 22 + f * 8); g.lineTo(x0 + 44 + rnd() * 8, y0 + 18 + f * 9 + rnd() * 4); g.stroke(); }
    }
    for (let i = 0; i < 4; i++) {   // Schalenstücke: gewölbte Sicheln, außen braun, innen hell
      const cx = i * 64 + 32, cy = 128 + 34, r1 = 22 - i * 2, a0 = -2.6 + i * 0.4, a1 = a0 + 2.2 + (i % 2) * 0.6;
      g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx + 4, cy + 6, r1 * 0.72, a1, a0, true); g.closePath();
      const grd = g.createLinearGradient(cx - r1, cy - r1, cx + r1, cy + r1); grd.addColorStop(0, '#9a6a3a'); grd.addColorStop(1, '#6a4526');
      g.fillStyle = grd; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(52,32,18,.9)'; g.stroke();
      g.beginPath(); g.arc(cx + 4, cy + 6, r1 * 0.72 + 1.5, a0 + 0.2, a1 - 0.2); g.lineWidth = 3; g.strokeStyle = 'rgba(232,206,160,.95)'; g.stroke();
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const KINDS = { holz: 0, rinde: 1, schale: 2 }, N = 40, pool = [];
    for (let i = 0; i < N; i++) {
      const geo = new THREE.PlaneGeometry(1, 1), m = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthTest: true, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = 30; mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh); night(mesh);
      pool.push({ m: mesh, uv: geo.attributes.uv, v: new V(), life: 0, max: 1, spin: 0, stay: 0, landed: -1 });
    }
    let next = 0, seed = 11; const r = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    function spawn(pos, kind, n, o = {}) {
      for (let i = 0; i < n; i++) {
        const c = pool[next++ % N], row = KINDS[kind] ?? 0, sh = Math.floor(r() * 4), a = c.uv.array, vt = 1 - row / ROWS, vb = 1 - (row + 1) / ROWS, u0 = sh * 0.25;
        a[0] = u0; a[1] = vt; a[2] = u0 + 0.25; a[3] = vt; a[4] = u0; a[5] = vb; a[6] = u0 + 0.25; a[7] = vb; c.uv.needsUpdate = true;
        const s = (kind === 'holz' ? 0.024 : kind === 'schale' ? 0.02 : 0.018) * (0.7 + r() * 0.6) * SC;
        c.m.scale.set(s, s * (0.7 + r() * 0.5), 1); c.m.position.copy(pos); c.m.quaternion.copy(STAGE_Q);
        // weg vom Stamm: nach links (Bühne) und etwas nach vorn
        tmp.copy(STAGE_R).multiplyScalar(-(0.25 + r() * 0.45) * (o.spread ?? 1)).addScaledVector(STAGE_D, 0.05 + r() * 0.25);
        c.v.copy(tmp).multiplyScalar(SC); c.v.y = (0.12 + r() * 0.42) * (o.up ?? 1) * SC;
        c.spin = (r() - 0.5) * 24; c.rot = r() * 6; c.life = 0; c.max = o.stay ? 1e9 : 1.1 + r() * 0.6; c.stay = o.stay || 0; c.landed = -1;
        c.m.visible = true; c.m.material.opacity = 1;
      }
    }
    function update(dt) {
      for (const c of pool) {
        if (!c.m.visible) continue;
        c.life += dt;
        if (c.landed < 0) { c.v.y -= 2.4 * SC * dt; c.v.multiplyScalar(Math.exp(-1.2 * dt)); c.m.position.addScaledVector(c.v, dt); c.rot += c.spin * dt; }
        if (c.landed < 0 && c.m.position.y < 0.012) { c.m.position.y = 0.012; c.v.set(0, 0, 0); c.spin = 0; c.landed = c.life; if (c.stay) c.max = c.life + c.stay; }
        c.m.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, c.rot));
        c.m.material.opacity = 1 - sm(c.max - 0.35, c.max, c.life);
        if (c.life > c.max) c.m.visible = false;
      }
    }
    return { spawn, update, clear() { for (const c of pool) c.m.visible = false; }, get n() { return pool.filter(c => c.m.visible).length; } };
  }

  // ---- Zeichnen in Bühnen-Koordinaten
  function putFig(x, y, z, rot = 0, mir = 1) {
    fig.group.position.copy(stageToWorld(x, y, z));
    fig.group.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, rot));
    fig.group.scale.set(mir * SC, SC, SC);
  }
  function putFly(x, y, z, pitch, mir = 1) {   // Schulter auf (x, y, z)
    fly.position.copy(stageToWorld(x, y, z));
    fly.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, mir * pitch));
    fly.scale.set(mir * LEN0 * SC, LEN0 * SC, LEN0 * SC);
  }
  function putSlip(bx, by, z, mir) {           // Schnabelspitze nach (bx, by), Achse waagerecht
    const a2 = mir < 0 ? AX : -AX, c = Math.cos(a2), s = Math.sin(a2), lx = (mir < 0 ? -BV[0] : BV[0]) * SC, ly = BV[1] * SC;
    slip.position.copy(stageToWorld(bx - (lx * c - ly * s), by - (lx * s + ly * c), z));
    slip.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, a2));
    slip.scale.set(mir * SC, SC, 1);
  }
  const shoulderFor = (fx, fy, pitch) => { const c = Math.cos(pitch), s = Math.sin(pitch), L = LEN0 * SC; return [fx - (FEET[0] * c - FEET[1] * s) * L, fy - (FEET[0] * s + FEET[1] * c) * L]; };
  const peckCurve = (u) => (u < 0.55 ? sm(0, 0.5, u) : 1 - sm(0.55, 0.68, u));   // ausholen, kurz oben halten, Schlag schnell
  // Bogenflug: je Zyklus 3 Schläge, dann Flügel angelegt
  const TF = 3 / 6.5, TG = 0.22, TC = TF + TG;
  function bound(t) {
    const u = ((t % TC) + TC) % TC, fold = u < TF ? 0 : sm(TF, TF + 0.05, u) * (1 - sm(TC - 0.04, TC, u));
    const p = u / TC, pf = TF / TC;
    return { fold, h: 0.032 * SC * Math.sin(2 * Math.PI * (p - pf + 0.25)), slope: Math.cos(2 * Math.PI * (p - pf + 0.25)) };
  }

  // ---- Besuche: Abschnitte nacheinander [Name, Dauer, Funktion(v = Sekunden im Abschnitt, u = 0…1), sitzt am Stamm?]
  let visit = null;
  const F = { fig: false, fly: false, slip: false, nut: false };   // was in diesem Bild zu sehen ist
  function plan(art, segs, o = {}) {
    let t = 0; const S = segs.map(([n, d, f, p]) => { const s = { n, t0: t, t1: t + d, d, f, p: !!p }; t += d; return s; });
    return Object.assign({ art, segs: S, total: t, t: 0, peck: -1, leave: false, started: false, si: 0 }, o);
  }
  // Landeplatz: Fußpunkt (x, y) und Tiefe der Bildebene (knapp vor der vordersten Rinde am Schnabel)
  function perchAt(fx, fy, zMin = -1e9) {
    const bx = fx + (beakL('klopfen')[0] + 0.008) * SC; let z = zMin;
    for (const dy of [-0.2, 0, 0.12]) z = Math.max(z, surfZ(bx, fy + dy * SC) + 0.014 * SC);
    return { x: fx, y: fy, z };
  }
  // Anflug von links (Bildrand) bis kurz vor den Landeplatz, dann Landen (Puppe → Bild am Stamm)
  function approachSegs(L, carry) {
    const A1 = [L.x - 0.5 * SC, L.y - 0.12 * SC], yS = L.y + 0.35 * SC, zS = L.z + 0.6;
    const x0 = Math.min(edgeStageX(-1, yS, zS, 1.2) - 0.3, A1[0] - 0.8), dist = Math.hypot(A1[0] - x0, A1[1] - yS);
    const T = Math.min(3.4, Math.max(1.3, dist / 1.8));
    let tt0 = 0;
    return [
      ['anflug', T, (v, u) => {
        const b = bound(v);
        putFly(lerp(x0, A1[0], u), lerp(yS, A1[1], sm(0, 1, u)) + b.h, lerp(zS, L.z + 0.04, u), (-7 + 8 * b.slope) * D);
        pup.update(v, { hold: b.fold, fold: b.fold, e: 0 }); pup.setAlpha(1); F.fly = true; tt0 = v;
        if (carry) carryNut();
      }],
      ['landen', 0.5, (v, u) => {
        const pitch = lerp(-7, 80, sm(0.05, 0.85, u)) * D, S1 = shoulderFor(L.x, L.y, 80 * D);
        putFly(lerp(A1[0], S1[0], sm(0, 1, u)), lerp(A1[1], S1[1], sm(0.15, 1, u)) - 0.06 * SC * Math.sin(Math.PI * Math.min(1, u * 1.1)), L.z + 0.04 * (1 - u), pitch);
        pup.update(T + v, { hold: 0, fold: 0, freq: 1.45 }); F.fly = true;
        if (u > 0.88) { const f = sm(0.88, 1, u); F.fig = true; fig.setPose(carry ? 'klopfen' : 'ruhig'); fig.opacity = f; pup.setAlpha(1 - f); putFig(L.x, L.y, L.z); }
        else pup.setAlpha(1);
        if (carry) { if (u > 0.88) nutAtBeak(-0.25); else carryNut(); }
      }],
    ];
  }
  // Abflug: weg vom Stamm (nach vorn, etwas nach unten), dann nach rechts vor dem Stamm vorbei aus dem Bild
  function leaveSeg(getL) {
    let L = null, xEnd = 0, sp = 1.3;
    return ['abflug', 6, (v, u, V) => {
      if (!L) { L = getL(); const S0 = shoulderFor(L.x, L.y, 75 * D); xEnd = edgeStageX(1, S0[1], L.z + 0.6, 1.2) + 0.5; sp = Math.max(1.3, (xEnd - S0[0]) / 3.2); pup.reset(); }
      const w = Math.max(0, v - 0.04), f = sm(0, 0.06, w);
      if (f < 1) { F.fig = true; fig.setPose('ruhig'); fig.opacity = 1 - f; fig.bend = -4 * D * sm(0, 0.08, v); putFig(L.x, L.y, L.z); }
      const pitch = (w < 0.45 ? lerp(75, -22, sm(0, 0.45, w)) : lerp(-22, -6, sm(0.45, 0.9, w))) * D;
      const S0 = shoulderFor(L.x, L.y, 75 * D), b = w > 0.6 ? bound(w) : { fold: 0, h: 0, slope: 0 };
      const x = S0[0] - 0.05 * SC * sm(0, 0.25, w) + sp * Math.max(0, w - 0.15) * sm(0.15, 0.55, w);
      putFly(x, S0[1] - 0.16 * SC * sm(0, 0.5, w) + b.h * sm(0.6, 0.8, w), lerp(L.z, L.z + 0.6, sm(0, 0.3, w)), pitch + 7 * D * b.slope * sm(0.6, 0.8, w));
      pup.update(v, { hold: b.fold, fold: b.fold, freq: w < 0.5 ? 1.35 : 1, e: 0 }); pup.setAlpha(f); F.fly = w > 0;
      if (x > xEnd) V.done = true;
    }];
  }
  // Schläge (Serien [Beginn s, Schläge/s, Anzahl]); bei jedem Schlag Späne vom Schnabel
  function pecks(V, v, bursts, heavy, kinds, onHit) {
    let th = 0, hd = 0, rt = 0;
    for (const [s0, f, n] of bursts) {
      const qq = (v - s0) * f;
      if (qq >= 0 && qq < n) {
        const c = Math.floor(qq), pk = peckCurve(qq - c);
        th = pk * (heavy ? 22 : 14) * D; hd = -pk * (heavy ? 8 : 5) * D; rt = pk * (heavy ? 0.02 : 0.013);
        const id = V.si * 1000 + s0 * 100 + c;
        if (qq - c > 0.68 && V.peck !== id) {
          V.peck = id; fig.group.updateMatrixWorld(); fig.beakWorld(tmp);
          if (kinds) chips.spawn(tmp, kinds[c % kinds.length], heavy ? 2 + (c % 2) : (c % 2));
          if (onHit) onHit(c);
        }
      }
    }
    fig.bend = th; fig.head = hd; fig.retract = rt;
  }
  function carryNut() {   // Eichel quer im Schnabel der fliegenden Puppe
    fly.updateMatrixWorld(); tmp.set(pup.beak[0] - 0.01, pup.beak[1] - 0.03, 0); fly.localToWorld(tmp);
    nut.position.copy(tmp).addScaledVector(STAGE_D, 0.01); nut.quaternion.copy(fly.quaternion).multiply(q.setFromAxisAngle(zA, -0.25)); nut.scale.set(SC, SC, 1); F.nut = true;
  }
  function nutAt(x, y, z, rot, s = 1) { nut.position.copy(stageToWorld(x, y, z)); nut.quaternion.copy(STAGE_Q).multiply(q.setFromAxisAngle(zA, rot)); nut.scale.set(s * SC, s * SC, 1); F.nut = true; }
  function nutAtBeak(rot) { fig.group.updateMatrixWorld(); fig.beakWorld(tmp); const x = tmp.dot(STAGE_R), y = tmp.y, z = tmp.dot(STAGE_D); nutAt(x + 0.012 * SC, y - 0.006 * SC, z + 0.004, rot); }

  // Höhle: Fußpunkt so, dass der Schnabel (Bild „klopfen“) links in die Öffnung trifft
  const holePerch = () => perchAt(HOLE.x - HOLE.ox * 0.27 - beakL('klopfen')[0] * SC, HOLE.y - 0.005 * SC - beakL('klopfen')[1] * SC, HOLE.z + 0.012 * SC);

  // --- Höhlenbau (Bau < 1): je nach Fortschritt Hackspuren, Mulde oder Kopf hinein und Späne heraus
  function bauVisit() {
    const L = holePerch(), b = bauState().b, stil = b < 0.2 ? 1 : b < 0.6 ? 3 : 5;
    const hit = () => { visitAdd = Math.min(visitAdd + 0.0025, 0.04); };
    const work = [];
    const nW = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < nW; i++) {
      if (stil < 5 || i % 2 === 0) work.push(['hacken', 2.4, (v, u, V) => { F.fig = true; fig.setPose('klopfen'); putFig(L.x, L.y, L.z);
        pecks(V, v, [[0.2, 4.2, 4], [1.3, 4.2, 3 + (i % 2)]], true, stil === 1 ? ['rinde', 'holz'] : ['holz'], hit); }, true]);
      else work.push(['kopfrein', 1.7, (v, u, V) => {    // Kopf in die Höhle, kurz drin, zurück, Späne mit einem Ruck hinaus
        F.fig = true; fig.setPose('klopfen'); putFig(L.x, L.y, L.z);
        const inn = sm(0, 0.25, v) * (1 - sm(0.75, 0.95, v));
        fig.bend = 0; fig.head = 0; fig.retract = 0;
        if (v > 0.95 && v < 1.3) {
          const qq = (v - 0.95) / 0.35; fig.bend = Math.sin(Math.PI * qq) * 16 * D; fig.head = Math.sin(Math.PI * qq) * 10 * D;
          if (qq > 0.45 && V.peck !== 'kr' + i) { V.peck = 'kr' + i; fig.group.updateMatrixWorld(); fig.beakWorld(tmp); chips.spawn(tmp, 'holz', 3); hit(); }
        }
        if (inn > 0) { V.clip = 1; fig.bend = -16 * D * inn; fig.retract = -0.04 * inn; fig.head = 4 * D * inn; }
      }, true]);
      work.push(['umschauen', rr(0.5, 0.9), () => { F.fig = true; fig.setPose('umschauen'); putFig(L.x, L.y, L.z); }, true]);
    }
    return plan('bau', [...approachSegs(L), ['sitzen', 0.7, (v) => { F.fig = true; fig.opacity = 1; pup.setAlpha(1); fig.setPose('klopfen'); fig.bend = 5 * D * Math.sin(Math.PI * Math.min(1, v / 0.35)) * (v < 0.35 ? 1 : 0); putFig(L.x, L.y, L.z); }, true],
      ...work, leaveSeg(() => L)], { L, stil });
  }

  // --- Futtersuche: links am Stamm landen, hinaufhüpfen, Rinde abklopfen (Rindenstückchen), umschauen, weiter hinauf
  function futterVisit() {
    const PHI = -58 * D, y0 = rr(0.34, 0.46) * Math.max(1, SC * 0.8), yTop = HO.y + 0.04;
    const feet = (y) => { const s = barkStage(y, PHI); return s ? s.x : 0; };
    const L0 = perchAt(feet(y0), y0);
    let y = y0;
    const at = (yy) => perchAt(feet(yy), yy);
    const segs = [...approachSegs(L0), ['sitzen', 1.4, (v) => { F.fig = true; fig.opacity = 1; pup.setAlpha(1);
      fig.bend = 5 * D * Math.sin(Math.PI * Math.min(1, v / 0.35)) * (v < 0.35 ? 1 : 0);
      fig.setPose(v > 0.55 && v < 1.15 ? 'umschauen' : 'ruhig'); putFig(L0.x, L0.y, L0.z); }, true]];
    const rounds = 2 + Math.floor(Math.random() * 2);
    let cur = L0;
    for (let k = 0; k < rounds; k++) {
      const HOPS = [0.45, 0.68, 0.91, 1.2], HD = 0.11, HY = 0.05 * SC;
      const yA = y, nh = Math.max(0, Math.min(4, Math.floor((yTop - yA) / HY)));
      let Lc = null;
      segs.push(['klettern', 1.45, (v) => {
        F.fig = true; if (!Lc) Lc = at(yA);
        if (v < 0.4) { fig.setPose('hochschauen'); fig.bend = 0; putFig(Lc.x, yA, Lc.z); cur = Lc; return; }
        fig.setPose('ruhig');
        let n = 0, off = 0, bnd = 0, dx = 0;
        for (const h of HOPS.slice(0, nh)) { if (v >= h + HD) n++; else if (v >= h) { const qq = (v - h) / HD; off = sm(0, 1, qq) * HY; bnd = Math.sin(Math.PI * qq) * 6 * D; dx = -0.012 * SC * Math.sin(Math.PI * qq); } }
        const yy = yA + n * HY + off, L = at(yy); fig.bend = bnd; putFig(L.x + dx, yy, L.z); cur = L;
      }, true]);
      y = yA + nh * HY;
      const yB = y, two = yB + 2 * 0.045 * SC <= yTop;
      let Lb = null;
      segs.push(['suchen', 2.4, (v, u, V) => {
        F.fig = true; fig.setPose('klopfen'); if (!Lb) Lb = at(yB);
        pecks(V, v, [[0.2, 6.5, 5], [1.12, 6.5, 3], [1.74, 6.5, 3]], false, ['rinde']);
        let off = 0, nn = 0;
        if (two) for (const [h0, hd2] of [[0.99, 0.11], [1.6, 0.11]]) { if (v >= h0 + hd2) nn++; else if (v >= h0) { const qq = (v - h0) / hd2; off = sm(0, 1, qq) * 0.045 * SC; fig.bend = Math.sin(Math.PI * qq) * 6 * D; } }
        const yy = yB + nn * 0.045 * SC + off, L = at(yy); putFig(L.x, yy, L.z); cur = L;
      }, true]);
      if (two) y += 2 * 0.045 * SC;
      segs.push(['umschauen', rr(0.6, 1.0), () => { F.fig = true; fig.bend = 0; fig.head = 0; fig.retract = 0; fig.setPose('umschauen'); putFig(cur.x, cur.y, cur.z); }, true]);
    }
    segs.push(['pause', 0.5, () => { F.fig = true; fig.setPose('ruhig'); putFig(cur.x, cur.y, cur.z); }, true]);
    segs.push(leaveSeg(() => cur));
    return plan('futter', segs);
  }

  // --- Spechtschmiede (Winter): mit Eichel im Schnabel kommen, in die Rindenspalte klemmen, aufhacken, Hülle wegwerfen
  function schmiedeVisit() {
    const bl = beakL('klopfen'), L = perchAt(ANV.x - 0.006 * SC - bl[0] * SC, ANV.y + 0.004 * SC - bl[1] * SC);
    const ax = ANV.x + 0.006 * SC, ay = ANV.y, az = L.z + 0.004;
    let nutK = 1, wob = 0, drop = null;
    const segs = [...approachSegs(L, true),
      ['klemmen', 1.2, (v) => {
        F.fig = true; fig.opacity = 1; pup.setAlpha(1); fig.setPose('klopfen'); putFig(L.x, L.y, L.z);
        const push = sm(0.1, 0.4, v) * (1 - sm(0.55, 0.75, v)); fig.bend = -9 * D * push; fig.retract = -0.018 * push; fig.head = 0;
        const pl = sm(0.25, 0.45, v);
        if (pl < 1) { fig.group.updateMatrixWorld(); fig.beakWorld(tmp); const bx = tmp.dot(STAGE_R), by = tmp.y;
          nutAt(lerp(bx + 0.012 * SC, ax, pl), lerp(by - 0.006 * SC, ay, pl), az, lerp(-0.25, -1.45, pl)); }
        else nutAt(ax, ay, az, -1.45);
        for (const s0 of [0.8, 1.0]) { const qq = (v - s0) * 5; if (qq >= 0 && qq < 1) { const pk = peckCurve(qq); fig.bend = pk * 9 * D; fig.retract = pk * 0.008; } }
      }, true],
      ['hacken', 4.0, (v, u, V) => {
        F.fig = true; fig.setPose('klopfen'); putFig(L.x, L.y, L.z);
        pecks(V, v, [[0.1, 4.2, 5], [1.75, 4.2, 4], [3.0, 4.2, 3]], true, null, () => {
          nutK = Math.max(0.55, nutK - 0.035); wob = 1;
          tmp.copy(stageToWorld(ax - 0.002, ay + 0.004, az + 0.006)); chips.spawn(tmp, 'schale', 1 + Math.floor(Math.random() * 2), { stay: season === 'winter' ? 60 : 8, spread: 0.6, up: 0.6 });
        });
        for (const s0 of [1.35, 2.65]) { const qq = (v - s0) / 0.28; if (qq >= 0 && qq < 1) { const th = Math.abs(Math.sin(qq * Math.PI * 2)) * 10 * D; fig.bend = th; fig.head = th * 0.4; } }   // Kopf hoch, schlucken
        wob *= Math.exp(-V.dt * 14);
        nutAt(ax, ay, az, -1.45 + 0.12 * wob * Math.sin(V.t * 60), nutK);
        nut.material.userData.__pic && nut.material.userData.__pic.setRGB(TONE, TONE * (0.86 + 0.14 * nutK), TONE * (0.7 + 0.3 * nutK));
      }, true],
      ['leer', 0.7, (v) => {
        F.fig = true; fig.setPose('klopfen'); putFig(L.x, L.y, L.z);
        const pull = sm(0.05, 0.3, v) * (1 - sm(0.35, 0.5, v)); fig.bend = 6 * D * pull; fig.retract = 0.01 * pull; fig.head = 0;
        if (v < 0.35) nutAt(ax - 0.02 * SC * pull, ay + 0.006 * SC * pull, az, -1.45 + 0.6 * pull, nutK);
        else if (!drop) drop = { x: ax - 0.01 * SC, y: ay + 0.006 * SC, vy: 0.15, rot: -0.85 };
      }, true],
      leaveSeg(() => L)];
    const V0 = plan('schmiede', segs);
    V0.after = (dt) => {   // leere Hülle fällt ins Gras/in den Schnee und bleibt kurz liegen
      if (!drop) return;
      if (drop.y > 0.012) { drop.vy -= 2.4 * dt; drop.y += drop.vy * dt; drop.x -= 0.05 * dt; drop.rot += 5 * dt; } else drop.y = 0.012;
      nutAt(drop.x, drop.y, az + 0.1, drop.rot, nutK);
    };
    return V0;
  }

  // --- Abends: zur Höhle fliegen, umschauen, Kopf voran hineinschlüpfen
  function abendVisit() {
    const L = holePerch(), bl = beakL('klopfen');
    return plan('abend', [...approachSegs(L), ['sitzen', 0.6, (v) => { F.fig = true; fig.opacity = 1; pup.setAlpha(1); fig.setPose('klopfen'); putFig(L.x, L.y, L.z); }, true],
      ['umschauen', 0.9, () => { F.fig = true; fig.setPose('umschauen'); putFig(L.x, L.y, L.z); }, true],
      ['klopfen', 0.4, (v, u, V) => { F.fig = true; fig.setPose('klopfen'); putFig(L.x, L.y, L.z); pecks(V, v, [[0.05, 4.2, 1]], true, ['holz']); }, true],
      ['drehen', 0.17, (v, u) => {    // Körper schwingt waagerecht, Kopf an der Öffnung
        const a = -72 * D * sm(0, 1, u), c = Math.cos(a), s = Math.sin(a), px = L.x + bl[0] * SC, py = L.y + bl[1] * SC;
        F.fig = true; fig.setPose('klopfen'); putFig(px - (bl[0] * SC * c - bl[1] * SC * s), py - (bl[0] * SC * s + bl[1] * SC * c), L.z, a);
      }],
      ['hinein', 0.75, (v, u, V) => {
        const qq = sm(0, 0.9, u); putSlip(HOLE.x - 0.03 * SC + qq * (SLEN * SC + 0.06 * SC), HOLE.y, HOLE.z + 0.02 * SC, 1);
        V.clip = 1; F.slip = qq < 0.999; if (qq > 0.95) inside = true;
      }],
    ], { L, nightOk: true });
  }
  // --- Morgens: Kopf schaut heraus, umschauen (links/rechts), heraus und nach links davon
  function morgenVisit() {
    const z = () => HOLE.z + 0.02 * SC;
    let started = false, x0 = 0, y0 = 0, xEnd = 0, sp = 0.5;
    return plan('morgen', [
      ['warten', 0.4, () => {}],
      ['schauen', 1.75, (v) => {
        const out = sm(0, 0.25, v) * (1 - sm(1.6, 1.75, v)), mir = (v > 0.65 && v < 1.15) ? -1 : 1;
        fig.setPose('umschauen'); fig.reset();
        putFig(HOLE.x - 0.006 * SC + (1 - out) * 0.035 * SC - mir * HEADU[0] * SC, HOLE.y + 0.004 * SC - HEADU[1] * SC, z(), 0, mir);
        F.fig = true; F.clip = 2;
      }],
      ['heraus', 0.3, (v, u, V) => { putSlip(HOLE.x + 0.01 * SC - sm(0, 1, u) * (SLEN + 0.02) * SC, HOLE.y, z(), -1); V.clip = 1; F.slip = true; inside = false; }],
      ['abflug', 6, (v, u, V) => {
        if (!started) { started = true; pup.reset(); pup.setAlpha(1); x0 = HOLE.x + 0.01 * SC - (SLEN + 0.02) * SC + (FB.beak[0] - FB.shoulder[0]) * KF * SC; y0 = HOLE.y;
          xEnd = edgeStageX(-1, y0, z() + 0.4, 1.2) - 0.5; sp = Math.max(0.5, (x0 - xEnd) / 3.0); }
        const x = x0 - sp * v - 0.45 * v * v * SC, y = y0 + 0.04 * SC - 0.12 * SC * Math.sin(Math.min(1, v / 0.8) * Math.PI * 0.5) + 0.03 * SC * Math.sin(v * 6);
        putFly(x, y, z() + 0.1 + 0.3 * sm(0, 0.6, v), (-8 + 6 * Math.cos(v * 6)) * D, -1);
        const cyc = v % 0.68, fold = v > 0.6 && cyc > 0.46 ? 1 : 0;
        pup.update(v, { hold: fold, fold, freq: v < 0.4 ? 1.3 : 1, e: 0 }); F.fly = true;
        if (x < xEnd) V.done = true;
      }],
    ], { nightOk: true });
  }

  // ---- Lauf
  let inside = false, vt = 0, last = 0, next = rr(30, 90), lastNight = null, lastFrame = 0, pendingIn = null, queue = null, placedP = -1, placedAt = -1e9;
  const allowedBase = () => !!tree && !!rad && P >= 4.98 && !reduceMotion;
  const canStart = () => !trans && !moveIn && !jayFx.active && !visitFx.active && !seqPlayer.active() && !winterFx.active && !eichTagFx.active;
  const isNight = () => __nightS.target > 0.5;
  function choose() {
    const b = bauState().b;
    if (b < 1) return season === 'winter' && b >= 0.6 && Math.random() < 0.4 ? 'schmiede' : 'bau';
    return season === 'winter' ? 'schmiede' : 'futter';
  }
  function start(art, o = {}) {
    if (!allowedBase() || !HOLE.ok) return false;
    if (!o.force && (isNight() ? !(art === 'abend') : art === 'abend')) return false;
    init(); stop(); pickScale(); placeHole();
    SC = Math.min(SC, Math.max(1, HOLE.rx / HO.rx[0]));   // nie größer, als die Höhle erlaubt (gleich groß bei allen Besuchen)
    if (art !== 'morgen' && art !== 'abend') inside = false;
    visit = art === 'bau' ? bauVisit() : art === 'futter' ? futterVisit() : art === 'schmiede' ? schmiedeVisit() : art === 'abend' ? abendVisit() : art === 'morgen' ? morgenVisit() : null;
    if (!visit) return false;
    if (art === 'morgen') inside = true;
    pup.reset(); last = nowMs();
    return art;
  }
  function stop() {
    visit = null; queue = null;
    if (!ready) return;
    fig.group.visible = false; fly.visible = false; slip.visible = false; nut.visible = false; chips.clear(); fig.reset(); CU.uClipM.value = 0;
    if (nut.material.userData.__pic) nut.material.userData.__pic.setScalar(TONE);
  }
  function step(dt) {
    const V = visit; if (!V) return;
    V.t += dt; V.dt = dt;
    F.fig = F.fly = F.slip = F.nut = false; F.clip = 0; V.clip = 0;
    fig.bend = 0; fig.head = 0; fig.retract = 0; fig.group.scale.x = Math.abs(fig.group.scale.x || 1);
    let s = V.segs.find(x => V.t >= x.t0 && V.t < x.t1);
    if (V.leave && s && s.p) { const ab = V.segs.find(x => x.n === 'abflug'); if (ab) { V.t = ab.t0 + 1e-4; s = ab; } }
    if (!s) { endVisit(); return; }
    V.si = V.segs.indexOf(s);
    s.f(V.t - s.t0, (V.t - s.t0) / s.d, V);
    if (V.after) V.after(dt);
    if (V.done) { endVisit(); return; }
    fig.group.visible = F.fig; fly.visible = F.fly; slip.visible = F.slip; nut.visible = F.nut;
    CU.uClipM.value = F.clip || V.clip || 0; CU.uClipC.value.set(HOLE.x, HOLE.y); CU.uClipR.value.set(HOLE.ox, HOLE.oy); CU.uClipD.value.set(1, 0);
    if (F.fig) fig.update();
    window.__specht = { art: V.art, seg: s.n, t: +V.t.toFixed(2), pose: fig.pose, fig: F.fig, fly: F.fly, slip: F.slip, nut: F.nut, clip: CU.uClipM.value,
      sc: +SC.toFixed(2), px: Math.round(lastPx), bau: +bauState().b.toFixed(3), inside, chips: chips.n };
  }
  function endVisit() {
    const art = visit && visit.art; visit = null;
    fig.group.visible = false; fly.visible = false; slip.visible = false; CU.uClipM.value = 0;
    if (nut.material.userData.__pic) nut.material.userData.__pic.setScalar(TONE);
    nut.visible = false;
    window.__specht = { art: null, last: art, inside, bau: +bauState().b.toFixed(3) };
    next = vt + rr(180, 420);
    if (art === 'abend' && !isNight() && inside) queue = 'morgen';   // inzwischen Tag geworden: gleich wieder heraus
  }
  function frame() {
    const now = nowMs(), dt = Math.min(0.1, Math.max(0, (now - (last || now)) / 1000)), gap = now - (lastFrame || now); last = now; lastFrame = now;
    if (!tree || !rad) return;
    if ((P >= 4.98 || tubeUniforms.uSpS.value.z) && (visit || P !== placedP || now - placedAt > 1000 || now < placedAt)) { placeHole(); placedP = P; placedAt = now; }   // ruhig: einmal je Sekunde
    const nightNow = isNight();
    if (lastNight == null || gap > 1500 || reduceMotion) { lastNight = nightNow; if (!visit) inside = nightNow && bauState().b >= 0.85; }
    else if (nightNow !== lastNight) {   // Tag ↔ Nacht gewechselt, während der Baum läuft
      lastNight = nightNow;
      if (allowedBase() && bauState().b >= 0.85) {
        if (nightNow && !inside) { if (visit) { visit.leave = true; queue = 'abend'; } else queue = 'abend'; }
        else if (!nightNow && inside) { if (!visit) queue = 'morgen'; }
      }
    }
    if (chips) chips.update(dt);
    if (visit) {
      if (!allowedBase()) { stop(); return; }
      if (!visit.nightOk && nightNow && !visit.leave) visit.leave = true;   // wird es Nacht: gleich weg (danach zur Höhle)
      step(dt);
      return;
    }
    if (pendingIn && P >= 4.98 && !trans) {   // gerade auf Stufe 5 gewachsen: Höhlenbau beginnt, Einzug wartet auf den Baumvogel
      if (!pendingIn.rec) { pendingIn.rec = true; setStart(Date.now()); visitAdd = 0; }
      if (holdMoveIn && now - pendingIn.t < 30000) return;
      if (isNight() || reduceMotion || window.__spechtHold) pendingIn = null;
      else if (canStart()) { pendingIn = null; start('bau'); return; }
    }
    if (queue && canStart() && !window.__spechtHold) {   // nur, wenn es noch passt: abends hinein (noch draußen), morgens heraus (noch drin)
      const a = queue; queue = null;
      if (a === 'abend' ? isNight() && !inside : !isNight() && inside) start(a);
      return;
    }
    if (!allowedBase() || isNight()) return;
    vt += dt;
    if (vt >= next && !window.__spechtHold && canStart()) { if (!start(choose())) next = vt + rr(30, 60); }
  }
  // gerade gewachsen (grow): über Stufe 5 hinweg → Einzug merken
  function grew(from, target) { if (from < 5 && target >= 5) { pendingIn = { t: nowMs(), rec: false }; testBau = null; } }
  function away() { if (visit) visit.leave = true; }
  // Test: jetzt ein Besuch. o.art: 'bau' | 'futter' | 'schmiede' | 'abend' | 'morgen'; o.bau: Fortschritt 0…1 (nur Anzeige)
  function now(o = {}) {
    if (o.bau != null) { testBau = Math.min(1, Math.max(0, +o.bau)); visitAdd = 0; }
    placeHole();
    const art = o.art || choose();
    if (art === 'morgen') inside = true;
    return start(art, { force: !!o.force || art === 'abend' || art === 'morgen' });
  }
  window.__spechtSim = (s, h = 0.05) => { for (let k = 0; k * h < s && visit; k++) { vt += h; step(h); if (chips) chips.update(h); } return window.__specht; };
  Object.defineProperty(window, '__spechtNext', { configurable: true, get: () => +(next - vt).toFixed(1), set: (s) => { next = vt + s; } });
  window.__spechtHole = () => (placeHole(), { x: +HOLE.x.toFixed(3), y: +HOLE.y.toFixed(3), z: +HOLE.z.toFixed(3), rx: +HOLE.rx.toFixed(3), ry: +HOLE.ry.toFixed(3), bau: +bauState().b.toFixed(3), alt: +bauState().a.toFixed(3), sc: +SC.toFixed(2), px: Math.round(lastPx) });
  return { frame, stop, away, grew, now, setJahr(j) { if (j != null) { testBau = null; visitAdd = 0; } jahr = j; },
    get active() { return !!visit; }, get inside() { return inside; } };
})();
PLAY.add({ id: 'buntspecht', ab: 5, start: () => spechtFx.now(), aktiv: () => spechtFx.active, max: 45 });
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
    const offs = camera.position.clone().sub(controls.target); let az = Math.atan2(offs.x, offs.z);
    if (__faceFront) { az += (AZ0 - az) * Math.min(1, dtC * 3.5); if (Math.abs(AZ0 - az) < 0.003) __faceFront = false; }   // Play-Knopf: sanft in die Vorderansicht
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
  setStage(n) { anim = null; trans = null; moveIn = 0; P = n; visitFx.stop(); falterFx.stop(); kraehenFx.stop(); hummelFx.stop(); schmetterlingFx.stop(); eichTagFx.stop(); igelFx.stop(); fledermausFx.stop(); spechtFx.stop(); PLAY.stop(); },
  /** zur Stufe n wachsen – mit Windstoß und fallenden Blättern (mehrere Stufen = ein längerer Übergang) */
  grow(n, o = {}) { holdMoveIn = !!o.holdMoveIn; falterFx.away(); kraehenFx.away(); hummelFx.away(); schmetterlingFx.away(); eichTagFx.stop(); igelFx.away(); fledermausFx.away(); spechtFx.away(); spechtFx.grew(Math.round(P), n); startTransition(n); },
  /** Einzug des Eichhörnchens, der auf den Baumvogel wartet (grow(n, { holdMoveIn: true })), jetzt starten */
  squirrelIn() { if (moveIn === 2) startMoveIn(); else holdMoveIn = false; },
  get stage() { return P; },
  /** Tag im Vanamo-Jahr (0–112) */
  /** Tag im Vanamo-Jahr; jahr = wievieltes Jahr seit dem Pflanzen (für „einmal je Jahr“, null = Baum-Test: nur im Speicher) */
  setDay(d, jahr) { yearDay = d; applyYear(d); if (jahr !== undefined) { igelFx.setJahr(jahr); spechtFx.setJahr(jahr); meisenFx.setJahr(jahr); } },
  /** der Eichelhäher bringt die Eichel (Stufe 0); onLand: sobald sie im Gras liegt */
  jay(onLand) { anim = null; trans = null; P = 0; visitFx.stop(); falterFx.stop(); kraehenFx.stop(); hummelFx.stop(); schmetterlingFx.stop(); eichTagFx.stop(); igelFx.stop(); fledermausFx.stop(); spechtFx.stop(); jayFx.play(onLand); },
  /** Eichel im Gras zeigen (true) oder noch nicht (false, vor dem Häher) */
  seed(on) { jayFx.seed(!!on); },
  /** Besuch des Eichelhähers (ab Stufe 1, ca. 12 s); false, wenn er gerade nicht kommen kann. o: { dir: ±1, x } */
  visit(o) { if (!(P >= 0.98 && !trans && !jayFx.active)) return false; falterFx.away(); kraehenFx.groundAway(); hummelFx.away(); schmetterlingFx.away(); eichTagFx.stop(); spechtFx.away(); return visitFx.play(o); },
  /** läuft gerade ein Übergang, der Start oder ein Besuch? */
  get busy() { return !!trans || !!anim || !!moveIn || jayFx.active || visitFx.active || seqPlayer.active() || winterFx.active || falterFx.active || eichTagFx.active; },
  /** Zitronenfalter kommt vorbei (ab Stufe 1; nicht im Winter, nicht nachts – force: auch nachts); false, wenn es gerade nicht geht. o: { dir: ±1, force } */
  butterfly(o = {}) { return P >= 0.98 && !trans && !jayFx.active && !visitFx.active ? falterFx.play(o) : false; },
  /** Test: der Marienkäfer fliegt jetzt ein Stück (false, wenn er gerade nicht zu sehen ist) */
  ladybird() { return kaeferFx.flyNow(); },
  /** Test: gleich ein Besuch der Kohlmeisen (tagsüber). o.art: 'nest' (Moos in den Kasten), 'futter' (Raupen, Junge betteln im
   *  Flugloch), 'ausflug' (die Jungen fliegen aus), 'familie' (Sommer: ein Junges wird auf dem Ast gefüttert), 'ruhe' (Dach
   *  oder Äste; im Winter aufgeplustert); ohne Kasten (Stufe 3) immer auf Äste. Ohne art: was gerade passt. Gibt die Art
   *  zurück oder false */
  titVisit(o = {}) { return meisenFx.visitNow(o); },
  /** Test: gleich kommt ein Trupp Rabenkrähen (ab Stufe 4, Herbst/Winter, tagsüber); sind schon welche da, fliegen sie weg und kommen gleich wieder */
  crows() { return kraehenFx.now(); },
  /** Test: gleich kommt eine Erdhummel (ab Stufe 2, Frühling/Sommer, tagsüber); sind schon welche da, fliegen sie fort und es kommt gleich die nächste */
  bumblebee() { return hummelFx.now(); },
  /** Test: gleich kommt ein Tagpfauenauge (ab Stufe 3, Frühling/Sommer, tagsüber). o.mode: 'stamm' (Sonnenbad am Stamm), 'paar' (zwei mit Balzflug) */
  peacock(o = {}) { return schmetterlingFx.pfau.now(o); },
  /** Test: gleich kommen Hauhechel-Bläulinge (ab Stufe 2, Sommer, tagsüber). o.mode: 'paar' (die ersten beiden jagen sich) */
  blues(o = {}) { return schmetterlingFx.blau.now(o); },
  /** Test: Ausflug des Eichhörnchens im Winter jetzt starten (true: nur der Rückweg ins Loch) */
  winterTrip(onlyIn) { return winterFx.start(!!onlyIn); },
  /** Test: Tagesablauf des Eichhörnchens jetzt (Frühling bis Herbst, ab Stufe 6): aufwachen, strecken, fort, mit einer Nuss
   *  zurück, fressen, einschlafen. o.autumn: wie im Herbst (vorher Nüsse ins Astloch); o.force: auch nachts */
  squirrelDay(o = {}) { return eichTagFx.start(o); },
  /** Play-Knopf (große Ansicht): jetzt eine zu Stufe, Jahreszeit und Tageszeit passende Animation; Name (id) oder false */
  play() { return PLAY.play(); },
  /** Zustand für den Play-Knopf: { zustand: 'bereit' | 'laeuft' | 'still' (nichts passt) | 'aus' (Weniger Bewegung), nacht } */
  get playState() { return PLAY.zustand(); },
  /** Test: Glühwürmchen-Tanz jetzt (Sommernacht; force: auch tagsüber und in anderen Jahreszeiten) */
  fireflies(o = {}) { return gluehFx.start(o); },
  /** Test: gleich ein Igel (nachts, ab Stufe 4, solange er wach ist; force: auch tagsüber und im Winterschlaf) */
  hedgehog(o = {}) { return igelFx.now(o); },
  /** Test: Winterschlaf des Igels jetzt – 'ein' (kriecht in den Laubhaufen) oder 'aus' (wacht auf, kommt heraus) */
  hedgehogSleep(art) { return igelFx.schlaf(art); },
  /** Test: gleich ein Besuch der Fledermäuse (nachts ab Stufe 5, Frühling bis Herbst; force: auch tagsüber und im Winter) */
  bats(o = {}) { return fledermausFx.now(o); },
  /** Test: gleich ein Besuch des Buntspechts (ab Stufe 5, tagsüber). o.art: 'bau' (Höhle hacken), 'futter' (klettern und
   *  klopfen), 'schmiede' (Eichel aufhacken), 'abend' (in die Höhle), 'morgen' (heraus); o.bau: Fortschritt der Höhle 0…1
   *  (nur Anzeige, bis „Mein Baum“); o.force: auch nachts. Ohne art: was gerade passt. Gibt die Art zurück oder false */
  woodpecker(o = {}) { return spechtFx.now(o); },
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
