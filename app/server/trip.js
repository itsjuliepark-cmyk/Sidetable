// How long it takes to get from where someone usually comes from to a restaurant, with no maps API and nothing to pay for:
// a walk, or the T and the main buses over a small map of real stops (the Red Line, the Green Line trunk and its B, D and E
// branches and the Lechmere stretch, and buses 1, 47, 66, 69 and 70). Rough on purpose, minutes not seconds: good enough to
// tell a 10-minute dinner from a 35-minute one, and to find the spot that's fair to all six.
// Walking: straight-line distance times 1.25 for streets, at 80 meters a minute. Riding: distance at the line's speed, plus
// half a minute a stop, plus a wait to get on (and again to change). Walks to and from a stop are capped at 1.3 km.
'use strict';
const LINES = [
  { id: 'red', name: 'the Red Line', speed: 32, wait: 4, stops: [[42.3884, -71.1191], [42.3734, -71.1190], [42.3654, -71.1037], [42.3624, -71.0862], [42.3612, -71.0706], [42.3564, -71.0624]] },
  { id: 'green', name: 'the Green Line', speed: 20, wait: 5, stops: [[42.3564, -71.0624], [42.3529, -71.0646], [42.3519, -71.0707], [42.3500, -71.0774], [42.3479, -71.0876], [42.3489, -71.0951]] },
  { id: 'greenb', name: 'the Green Line', speed: 14, wait: 5, stops: [[42.3489, -71.0951], [42.3491, -71.1001], [42.3496, -71.1036], [42.3504, -71.1063], [42.3507, -71.1138], [42.3516, -71.1213], [42.3517, -71.1253], [42.3503, -71.1311], [42.3484, -71.1347], [42.3483, -71.1400], [42.3437, -71.1428], [42.3417, -71.1460], [42.3383, -71.1530]] },
  { id: 'greend', name: 'the Green Line', speed: 22, wait: 6, stops: [[42.3489, -71.0951], [42.3451, -71.1043], [42.3412, -71.1101], [42.3328, -71.1168]] },
  { id: 'greene', name: 'the Green Line', speed: 14, wait: 6, stops: [[42.3500, -71.0774], [42.3459, -71.0818], [42.3424, -71.0852], [42.3401, -71.0889], [42.3375, -71.0957], [42.3357, -71.1003]] },
  { id: 'greenn', name: 'the Green Line', speed: 20, wait: 5, stops: [[42.3711, -71.0765], [42.3666, -71.0676], [42.3656, -71.0613], [42.3630, -71.0583], [42.3597, -71.0592], [42.3564, -71.0624]] },
  { id: 'bus1', name: 'the 1 bus', speed: 12, wait: 7, stops: [[42.3726, -71.1178], [42.3692, -71.1110], [42.3654, -71.1037], [42.3615, -71.0975], [42.3592, -71.0938], [42.3508, -71.0893], [42.3483, -71.0878], [42.3427, -71.0855]] },
  { id: 'bus47', name: 'the 47 bus', speed: 12, wait: 8, stops: [[42.3652, -71.1030], [42.3580, -71.1046], [42.3517, -71.1106], [42.3442, -71.1018], [42.3384, -71.1080]] },
  { id: 'bus66', name: 'the 66 bus', speed: 11, wait: 7, stops: [[42.3727, -71.1188], [42.3699, -71.1209], [42.3651, -71.1263], [42.3637, -71.1295], [42.3580, -71.1306], [42.3532, -71.1323], [42.3500, -71.1313], [42.3422, -71.1213], [42.3330, -71.1185]] },
  { id: 'bus69', name: 'the 69 bus', speed: 12, wait: 8, stops: [[42.3735, -71.1159], [42.3740, -71.1087], [42.3742, -71.1010], [42.3733, -71.0920], [42.3711, -71.0765]] },
  { id: 'bus70', name: 'the 70 bus', speed: 12, wait: 8, stops: [[42.3652, -71.1030], [42.3613, -71.1085], [42.3620, -71.1145], [42.3637, -71.1295], [42.3627, -71.1365]] },
];
const WALK = 80, DETOUR = 1.25, ACCESS = 1.3, SWITCH = 0.25; // meters a minute; street factor; km to reach a stop; km to change lines
function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const walkMin = (a, b) => (km(a, b) * 1000 * DETOUR) / WALK;
// every stop is a node; riding to the next stop on the same line, or walking to another line's stop nearby, are the edges
const NODES = [], EDGES = [];
LINES.forEach((L, li) => L.stops.forEach((p, i) => { NODES.push({ li, i, p }); }));
NODES.forEach((n, a) => {
  EDGES[a] = [];
  NODES.forEach((m, b) => {
    if (a === b) return;
    const L = LINES[n.li];
    if (m.li === n.li && Math.abs(m.i - n.i) === 1) EDGES[a].push([b, (km(n.p, m.p) / L.speed) * 60 + 0.5, false]);
    else if (m.li !== n.li && km(n.p, m.p) <= SWITCH) EDGES[a].push([b, walkMin(n.p, m.p) + LINES[m.li].wait, true]);
  });
});
const memo = new Map();
// from and to are [lat, lng]; the answer is { min, walk: true|false, lines: ['the Red Line', ...] }
function trip(from, to) {
  if (!from || !to || !isFinite(from[0]) || !isFinite(to[0])) return null;
  const key = from.join(',') + '|' + to.join(','); if (memo.has(key)) return memo.get(key);
  const walk = walkMin(from, to), dist = NODES.map(() => Infinity), prev = NODES.map(() => -1), done = NODES.map(() => false);
  NODES.forEach((n, i) => { if (km(from, n.p) <= ACCESS) dist[i] = walkMin(from, n.p) + LINES[n.li].wait; });
  for (;;) {
    let u = -1; dist.forEach((d, i) => { if (!done[i] && d < Infinity && (u < 0 || d < dist[u])) u = i; });
    if (u < 0) break; done[u] = true;
    EDGES[u].forEach(([v, w]) => { if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; } });
  }
  let best = Infinity, end = -1;
  NODES.forEach((n, i) => { if (dist[i] < Infinity && km(n.p, to) <= ACCESS) { const t = dist[i] + walkMin(n.p, to); if (t < best) { best = t; end = i; } } });
  const lines = []; for (let i = end; i >= 0; i = prev[i]) { const nm = LINES[NODES[i].li].name; if (lines[0] !== nm) lines.unshift(nm); }
  const out = walk <= best + 3 ? { min: Math.max(1, Math.round(walk)), walk: true, lines: [] } : { min: Math.round(best), walk: false, lines }; // a walk wins a near tie: no waiting
  if (memo.size > 50000) memo.clear(); memo.set(key, out);
  return out;
}
module.exports = { trip, km, LINES };
