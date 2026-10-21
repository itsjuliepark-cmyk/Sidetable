// Builds scripts/guide/map.json (the spot guide's drawn map) from OpenStreetMap extracts saved next to this file. They came
// from the Overpass API (overpass-api.de) once, in October 2026, for the box 42.335,-71.175 to 42.392,-71.050:
//   water.json   (way|relation)[natural=water] and way[waterway=riverbank]
//   roads.json   way[highway~^(trunk|primary|secondary)$]
//   rail.json    way[railway~^(subway|light_rail)$], routes.json relation[route~^(subway|light_rail|tram)$] (out body, for line colors)
//   land.json    way[leisure=park], (way|relation)[amenity=university]
// The raw files aren't kept in the repo (about 6 MB). Map data from OpenStreetMap contributors, under the ODbL.
// OpenStreetMap extracts -> small SVG paths in meters around the area's center
const fs = require('fs'), D = __dirname + '/';
const LAT0 = 42.3635, LNG0 = -71.1125, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KY = 110574;
const P = (lat, lng) => [(lng - LNG0) * KX, (LAT0 - lat) * KY];
const BOX = (() => { const a = P(42.392, -71.175), b = P(42.335, -71.050); return { x0: a[0] - 400, y0: a[1] - 400, x1: b[0] + 400, y1: b[1] + 400 }; })();
const read = (f) => JSON.parse(fs.readFileSync(D + f, 'utf8')).elements;
// Douglas-Peucker on [x, y] points
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let idx = -1, max = 0;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L; if (d > max) { max = d; idx = i; } }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// a closed ring: split at the point farthest from the start, simplify both halves
function simplifyRing(pts, tol) {
  if (pts.length < 4) return pts;
  let k = 1, far = 0; pts.forEach((p, i) => { const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d > far) { far = d; k = i; } });
  const a = simplify(pts.slice(0, k + 1), tol), b = simplify(pts.slice(k), tol);
  return a.concat(b.slice(1, -1));
}
// clip a closed ring to the box (Sutherland-Hodgman)
function clipRing(ring) {
  const edges = [[(p) => p[0] >= BOX.x0, (a, b) => { const t = (BOX.x0 - a[0]) / (b[0] - a[0]); return [BOX.x0, a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[0] <= BOX.x1, (a, b) => { const t = (BOX.x1 - a[0]) / (b[0] - a[0]); return [BOX.x1, a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[1] >= BOX.y0, (a, b) => { const t = (BOX.y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), BOX.y0]; }],
    [(p) => p[1] <= BOX.y1, (a, b) => { const t = (BOX.y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), BOX.y1]; }]];
  let out = ring;
  edges.forEach(([inside, cut]) => {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const cur = src[i], prev = src[(i + src.length - 1) % src.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); } else if (inside(prev)) out.push(cut(prev, cur));
    }
  });
  return out;
}
const area = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); };
const inBox = (p) => p[0] >= BOX.x0 && p[0] <= BOX.x1 && p[1] >= BOX.y0 && p[1] <= BOX.y1;
const fmt = (r, close) => 'M' + r.map((p) => Math.round(p[0]) + ' ' + Math.round(p[1])).join('L') + (close ? 'Z' : '');
// join member ways of a multipolygon into closed rings
function rings(members) {
  const segs = members.filter((m) => m.geometry && m.geometry.length > 1).map((m) => m.geometry.map((g) => [g.lat, g.lon]));
  const out = [], key = (p) => p[0].toFixed(7) + ',' + p[1].toFixed(7);
  while (segs.length) {
    let ring = segs.shift();
    let grew = true;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], end = key(ring[ring.length - 1]);
        if (key(s[0]) === end) { ring = ring.concat(s.slice(1)); } else if (key(s[s.length - 1]) === end) { ring = ring.concat(s.slice().reverse().slice(1)); }
        else if (key(s[s.length - 1]) === key(ring[0])) { ring = s.concat(ring.slice(1)); } else if (key(s[0]) === key(ring[0])) { ring = s.slice().reverse().concat(ring.slice(1)); }
        else continue;
        segs.splice(i, 1); grew = true; break;
      }
    }
    if (key(ring[0]) === key(ring[ring.length - 1])) out.push(ring);
  }
  return out;
}
function polys(elements, test, tol, minArea) {
  const out = [];
  elements.forEach((e) => {
    if (!test(e.tags || {})) return;
    let rs = [];
    if (e.type === 'way' && e.geometry) rs = [e.geometry.map((g) => [g.lat, g.lon])];
    else if (e.type === 'relation') rs = rings(e.members || []);
    rs.forEach((r) => {
      let pts = r.map((g) => P(g[0], g[1])); if (!pts.some(inBox)) return;
      pts = clipRing(simplifyRing(pts, tol)); if (pts.length < 3 || area(pts) < minArea) return;
      out.push(fmt(pts, true));
    });
  });
  return out.join('');
}
// lines, cut where they leave the box
function lines(elements, test, tol) {
  const out = [];
  elements.forEach((e) => {
    if (e.type !== 'way' || !e.geometry || !test(e.tags || {}, e)) return;
    let run = [];
    const flush = () => { if (run.length > 1) out.push(fmt(simplify(run, tol), false)); run = []; };
    e.geometry.forEach((g) => { const p = P(g.lat, g.lon); if (inBox(p)) run.push(p); else flush(); });
    flush();
  });
  return out.join('');
}
const W = read('water.json'), RD = read('roads.json'), RL = read('rail.json'), LD = read('land.json');
const water = polys(W, (t) => t.natural === 'water' || t.waterway === 'riverbank', 4, 1500);
const park = polys(LD, (t) => t.leisure === 'park', 5, 6000);
const campus = polys(LD, (t) => t.amenity === 'university', 6, 20000);
const trunk = lines(RD, (t) => t.highway === 'trunk', 6), primary = lines(RD, (t) => t.highway === 'primary', 6), secondary = lines(RD, (t) => t.highway === 'secondary', 6);
const LINEOF = {}; JSON.parse(fs.readFileSync(D + 'routes.json', 'utf8')).elements.forEach((r) => { const n = /Red/.test(r.tags.name) ? 'red' : /Orange/.test(r.tags.name) ? 'orange' : /Green/.test(r.tags.name) ? 'green' : /Blue/.test(r.tags.name) ? 'blue' : ''; r.members.forEach((m) => { if (m.type === 'way' && n) LINEOF[m.ref] = n; }); });
const avg = (e) => { const g = e.geometry; return [g.reduce((s, x) => s + x.lat, 0) / g.length, g.reduce((s, x) => s + x.lon, 0) / g.length]; };
const orange = (e) => { const [la, lo] = avg(e); return la < 42.352 && lo > -71.10; };
const red = lines(RL, (t, e) => LINEOF[e.id] === 'red', 5);
const orangeL = lines(RL, (t, e) => LINEOF[e.id] === 'orange', 5);
const blue = lines(RL, (t, e) => LINEOF[e.id] === 'blue', 5);
const green = lines(RL, (t, e) => LINEOF[e.id] === 'green', 5);
const out = { lat0: LAT0, lng0: LNG0, kx: KX, ky: KY, box: [Math.round(BOX.x0), Math.round(BOX.y0), Math.round(BOX.x1 - BOX.x0), Math.round(BOX.y1 - BOX.y0)], water, park, campus, trunk, primary, secondary, red, orange: orangeL, green, blue };
fs.writeFileSync(D + 'geo-out.json', JSON.stringify(out));
Object.keys(out).forEach((k) => { if (typeof out[k] === 'string') console.log(k.padEnd(10), (out[k].length / 1024).toFixed(1) + ' KB'); });
console.log('total', (JSON.stringify(out).length / 1024).toFixed(1) + ' KB', 'box', out.box);
