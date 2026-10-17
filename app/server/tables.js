// Hash Table table assembly: who sits with whom on one night.
// Pure functions, no I/O, so the same code runs in the server, the seed script and the tests.
//
// Hard rules (never broken on purpose; if the people in a group make one impossible, the table carries a flag the
// admin sees): 4 to 6 seats, at least two schools (Harvard and MIT) and no school above half the table, nobody who blocked the other.
// Strongly avoided: two people who already shared a table (unless they picked each other and this is their reunion).
// In a small track that meets every week some repeats can't be avoided; the search keeps them to a minimum.
// Soft goals: Topic tables weigh the topic 60 and the people 40; Kindred tables weigh the people 80.
'use strict';
const SX = require('../public/shared.js');

const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const INT_TRACK = {}; SX.INTS.forEach((i) => { INT_TRACK[i.id] = i.tr; });
const pk = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m)))); };
function jacc(A, B) { if (!A.size && !B.size) return 0; let n = 0; A.forEach((x) => { if (B.has(x)) n++; }); return n / (A.size + B.size - n); }
function pairsAvg(ps, f) { let s = 0, n = 0; for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { s += f(ps[i], ps[j]); n++; } return n ? s / n : 0; }
function topCount(ps, key) { const c = {}; ps.forEach((p) => p[key].forEach((x) => { c[x] = (c[x] || 0) + 1; })); let best = null; Object.keys(c).forEach((k) => { if (!best || c[k] > best[1]) best = [k, c[k]]; }); return best; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* a seated member as the engine sees them: { id, school, profile, size, prio, at } */
function prep(m) {
  const p = m.profile || {}, ax = SX.axes(p.answers);
  return {
    id: m.id, school: m.school || 'other', track: (p.tracks || [])[0] || 'genai', tracks: (p.tracks || []).length ? p.tracks.slice(0, 3) : ['genai'], ints: new Set(p.interests || []), lens: p.lens || 'build', lensSet: !!p.lens,
    ax, code: SX.codeOf(ax), rhythm: p.rhythm || '', look: p.look || '', life: new Set(p.life || []), acts: new Set(p.acts || []), takes: p.takes || {}, next: new Set([].concat(p.next || [])),
    size: m.size || 'either', prio: m.prio || 0, at: m.at || ''
  };
}

/* ---------- one table ---------- */
function takeOf(p, id, trackId) { if (id === 'track' && p.track !== trackId) return null; return p.takes[id] || 'depends'; }
function splits(ps, trackId) {
  return SX.takesFor(trackId).map((t) => {
    let a = 0, d = 0, dep = 0;
    ps.forEach((p) => { const v = takeOf(p, t.id, trackId); if (v == null) return; if (v === 'agree') a++; else if (v === 'disagree') d++; else dep++; });
    return { id: t.id, t: t.t.replace(/\.$/, ''), a, d, dep, bal: a && d ? 1 - Math.abs(a - d) / (a + d) : 0 };
  }).sort((x, y) => (y.bal - x.bal) || ((y.a + y.d) - (x.a + x.d)));
}
function balanced(ps, mix) {
  if (!mix) return true;
  const c = {}; ps.forEach((p) => { c[p.school] = (c[p.school] || 0) + 1; });
  const v = Object.values(c);
  return v.length >= 2 && Math.max.apply(null, v) <= Math.ceil(ps.length / 2);
}
const RIDX = { 'Every week': 0, 'Every two weeks': 1, 'Once a month': 2 };
function scoreTable(ps, type, trackId, ctx) {
  const n = ps.length; if (n < 2) return { total: -10, base: 0, parts: {}, flags: ['too small'] };
  const jac = pairsAvg(ps, (x, y) => jacc(x.ints, y.ints)), top = topCount(ps, 'ints');
  const interest = 0.5 * Math.min(1, jac / 0.35) + 0.5 * (top ? top[1] / n : 0);
  // a pooled evening (too few people per track): the table's own shared track counts, so people who share one sit together
  const pooled = trackId === 'pool', tid = pooled ? sharedTrack(ps, ps[0].track) : trackId;
  const share = pooled ? ps.filter((p) => p.tracks.indexOf(tid) >= 0).length / n : 1;
  const sp = splits(ps, tid), split = ((sp[0] ? sp[0].bal : 0) + (sp[1] ? sp[1].bal : 0)) / 2;
  const lensDiv = Math.min(1, new Set(ps.map((p) => p.lens)).size / Math.min(n, 4));
  const funders = ps.filter((p) => p.lens === 'fund').length;
  const topic = pooled ? 0.4 * interest + 0.3 * share + 0.1 * split + 0.2 * lensDiv : 0.55 * interest + 0.2 * split + 0.25 * lensDiv;

  const depthSim = clamp01(1 - sd(ps.map((p) => p.ax.d)) / 35), ritualSim = clamp01(1 - sd(ps.map((p) => p.ax.a)) / 35);
  const rhythmSim = pairsAvg(ps, (x, y) => (x.rhythm && y.rhythm ? (x.rhythm === y.rhythm ? 1 : Math.abs(RIDX[x.rhythm] - RIDX[y.rhythm]) === 1 ? 0.4 : 0) : 0.3));
  const lookSim = pairsAvg(ps, (x, y) => (x.look && x.look === y.look ? 1 : 0));
  const life = Math.min(1, pairsAvg(ps, (x, y) => jacc(x.life, y.life)) / 0.3);
  const topAct = topCount(ps, 'acts'), acts = 0.5 * Math.min(1, pairsAvg(ps, (x, y) => jacc(x.acts, y.acts)) / 0.3) + 0.5 * (topAct ? topAct[1] / n : 0);
  const sparks = ps.filter((p) => p.code[0] === 'S').length, hosts = ps.filter((p) => p.code[2] === 'H').length;
  const sparkS = sparks >= 1 && sparks <= 3 ? 1 : sparks === 0 ? 0.3 : 0.6;
  const social = 0.2 * depthSim + 0.1 * rhythmSim + 0.1 * lookSim + 0.15 * life + 0.15 * acts + 0.1 * ritualSim + 0.1 * sparkS + 0.1 * (hosts ? 1 : 0);

  const base = type === 'kindred' ? 0.2 * interest + 0.8 * social : 0.6 * topic + 0.4 * social;
  let pen = 0; const flags = [];
  if (!hosts) { pen += 0.5; flags.push('no host'); }
  if (type !== 'kindred' && funders > 2) { pen += 0.3 * (funders - 2); flags.push(funders + ' investors'); }
  if (!balanced(ps, ctx.mix)) { pen += 3; flags.push('school mix'); }
  if (n < 4 || n > 6) { pen += 3; flags.push(n + ' seats'); }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const k = pk(ps[i].id, ps[j].id), lock = ctx.lockOf[ps[i].id] && ctx.lockOf[ps[i].id] === ctx.lockOf[ps[j].id];
    if (ctx.blocked.has(k)) { pen += 5; flags.push('blocked pair'); }
    else if (ctx.history.has(k) && !lock) { pen += 2; flags.push('sat together before'); }
  }
  ps.forEach((p) => { if (p.size === 'four' && n > 4) pen += 0.04; if (p.size === 'six' && n < 5) pen += 0.03; });
  return { total: base - pen, base, parts: { interest, split, lensDiv, social, depthSim, acts, hosts, sparks }, flags: Array.from(new Set(flags)) };
}

/* ---------- why these people (what Charlie tells the table) ----------
   Four short lines at most, the way a friend who set up the dinner would text it. The one thing worth noticing in each
   line is wrapped in *stars*; the app draws it with a highlighter. No full stop at the end. */
function countWord(c, n) { if (c === n) return n === 2 ? 'Both' : 'All ' + (NUMW[n] || n); return cap(NUMW[c] || String(c)); }
function lowWord(c, n) { return c === n ? (n === 2 ? 'both' : 'all ' + (NUMW[n] || n)) : NUMW[c] || String(c); }
const ROLE = { build: ['a builder', 'builders'], fund: ['an investor', 'investors'], run: ['an operator', 'operators'], study: ['a researcher', 'researchers'], pivot: ['a newcomer', 'newcomers'] };
const listOf = (parts) => (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || '');
// the short form of what people plan next ("want to *start a company*")
const NEXTS = { 'Start a company': 'want to *start a company*', 'Join a startup': 'want to *join a startup*', 'Big tech': 'are headed to *big tech*', 'Venture capital': 'want to end up in *venture*',
  'Back to my old industry': 'are going *back to their old industry*', 'Research or a PhD': 'are eyeing *research or a PhD*' };
const LIFES = { 'New to Boston': 'are *new to Boston*', 'International': 'moved here *from abroad*', 'Staying in Boston': 'are *staying in Boston* after school' };
function whyLines(ps, type, trackId, ctx) {
  const n = ps.length, out = [];
  const d = ps.filter((p) => p.code[1] === 'D').length, h = ps.filter((p) => p.code[2] === 'H').length;
  const sch = {}; ps.forEach((p) => { sch[p.school] = (sch[p.school] || 0) + 1; });
  const anyLock = ps.some((p) => ctx && ctx.lockOf[p.id]), anyPast = ps.some((p, i) => ps.some((q, j) => j > i && ctx && ctx.history.has(pk(p.id, q.id))));
  const sides = sch.harvard && sch.mit ? `*${sch.harvard} Harvard, ${sch.mit} MIT*` : '';
  const faces = anyLock ? `${sides ? sides + ', and ' : ''}a little *reunion* with new faces` : anyPast ? sides : sides ? `${sides}, all first meetings` : '';
  const planners = h === n ? '*All planners*, so round two will happen' : h > 1 ? `*${cap(NUMW[h] || String(h))} natural planners*, so round two might happen` : h === 1 ? '*One natural planner*, so round two might happen' : 'No planners here, so *I’ll send the reminder*';
  const nx = topCount(ps, 'next'), next = nx && nx[1] >= 2 && NEXTS[nx[0]] ? `${countWord(nx[1], n)} of you ${NEXTS[nx[0]]}` : '';
  if (type === 'kindred') {
    out.push(d * 2 > n ? 'A *go-deep* crowd, zero small talk' : (n - d) * 2 > n ? 'A *playful* crowd, expect a lot of laughing' : 'Half *deep talkers*, half *jokers*, the best mix');
    const ac = topCount(ps, 'acts'); if (ac && ac[1] >= 2) out.push(`${countWord(ac[1], n)} of you want to *${SX.ACTV[ac[0]] || ac[0].toLowerCase()}*`);
    const lifeC = {}; ps.forEach((p) => p.life.forEach((l) => { if (SX.LIFE_PUBLIC.indexOf(l) >= 0) lifeC[l] = (lifeC[l] || 0) + 1; }));
    const l = Object.keys(lifeC).sort((x, y) => lifeC[y] - lifeC[x])[0]; if (l && lifeC[l] >= 2 && LIFES[l]) out.push(`${countWord(lifeC[l], n)} of you ${LIFES[l]}`);
    out.push(planners);
    if (next) out.push(next);
  } else {
    // the headline interest comes from the table's own track (some people also picked a second one)
    const tr = SX.track(trackId), own = ps.map((p) => ({ ints: new Set(Array.from(p.ints).filter((i) => INT_TRACK[i] === trackId)) })), top = topCount(own, 'ints') || topCount(ps, 'ints');
    out.push(!top || top[1] < 2 ? `${cap(NUMW[n] || String(n))} different angles on *${tr.t}*` : top[1] === n ? `All of you are into *${SX.INTNAME[top[0]]}*` : `${cap(NUMW[top[1]] || String(top[1]))} of you are hooked on *${SX.INTNAME[top[0]]}*`);
    const sp = splits(ps, trackId)[0];
    if (sp && sp.a && sp.d && sp.a + sp.d >= 3) out.push(`“${sp.t}”: *${sp.a} yes, ${sp.d} no*`);
    const lc = {}; ps.filter((p) => p.lensSet).forEach((p) => { lc[p.lens] = (lc[p.lens] || 0) + 1; });
    const kinds = ['build', 'fund', 'run', 'study', 'pivot'].filter((k) => lc[k]).sort((x, y) => lc[y] - lc[x]);
    if (kinds.length > 1) { const names = kinds.slice(0, 3).map((k) => ROLE[k][lc[k] > 1 ? 1 : 0]); out.push(`At the table: *${listOf(names)}*`); }
    else if (kinds.length) out.push(`All *${ROLE[kinds[0]][1]}*, so skip the basics`);
    if (next) out.push(next);
  }
  if (faces) out.splice(Math.min(out.length, 3), 0, cap(faces));
  return out.slice(0, 4);
}

/* ---------- one group (a track, or everyone for Kindred) ---------- */
function assembleGroup(ps, type, trackId, ctx) {
  const N = ps.length, wait = [];
  if (N < 4) return { tables: [], wait: ps.map((p) => p.id) };
  let k = Math.max(1, Math.min(Math.floor(N / 4), Math.round(N / 6) || 1));
  k = Math.max(k, Math.min(Math.floor(N / 4), Math.ceil(N / 6)));
  if (ctx.mix) { const c0 = {}; ps.forEach((p) => { c0[p.school] = (c0[p.school] || 0) + 1; }); k = Math.max(1, Math.min(k, Math.floor((N - Math.max.apply(null, Object.values(c0))) / 2))); }
  const tables = Array.from({ length: k }, () => []);
  const order = ps.slice().sort((a, b) => (b.prio - a.prio) || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const cnt = (t, s) => t.filter((p) => p.school === s).length;
  const placed = new Set();
  // reunions first: each group shares a table
  ctx.locks.forEach((ids) => {
    const g = ids.map((id) => ps.find((p) => p.id === id)).filter(Boolean); if (g.length < 2) return;
    const t = tables.slice().sort((x, y) => x.length - y.length)[0];
    if (t.length + g.length > 6) return;
    g.forEach((p) => { t.push(p); placed.add(p.id); });
  });
  // everyone else, in priority order, to the table with the fewest people from their school
  order.forEach((p) => {
    if (placed.has(p.id)) return;
    const ok = tables.filter((t) => t.length < 6 && (!ctx.mix || cnt(t, p.school) < 3));
    if (!ok.length) { wait.push(p); return; }
    ok.sort((x, y) => (cnt(x, p.school) - cnt(y, p.school)) || (x.length - y.length));
    ok[0].push(p); placed.add(p.id);
  });
  // repair the school mix: move the newest majority member to a table that can take them, or to the waitlist
  const fits = (t, p) => t.length < 6 && balanced(t.concat([p]), ctx.mix) || (t.length < 3 && (!ctx.mix || cnt(t, p.school) < 2));
  for (let guard = 0; guard < 50; guard++) {
    const bad = tables.find((t) => t.length >= 4 && !balanced(t, ctx.mix)); if (!bad) break;
    const c = {}; bad.forEach((p) => { c[p.school] = (c[p.school] || 0) + 1; });
    const maj = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    const cand = bad.filter((p) => p.school === maj && !ctx.lockOf[p.id]).pop() || bad.filter((p) => p.school === maj).pop();
    bad.splice(bad.indexOf(cand), 1);
    const to = tables.find((t) => t !== bad && t.length >= 3 && fits(t, cand)); if (to) to.push(cand); else wait.push(cand);
  }
  // a table under four people cannot run: its people move where they fit, or wait
  for (let guard = 0; guard < 10; guard++) {
    const small = tables.find((t) => t.length > 0 && t.length < 4); if (!small) break;
    tables.splice(tables.indexOf(small), 1);
    small.forEach((p) => { const to = tables.find((t) => fits(t, p) && t.length >= 4); if (to) to.push(p); else wait.push(p); });
  }
  // the waitlist gets another look: an open seat that keeps the mix is a seat
  wait.sort((a, b) => (b.prio - a.prio) || (a.at < b.at ? -1 : 1));
  for (let i = 0; i < wait.length; i++) { const to = tables.filter((t) => t.length < 6 && balanced(t.concat([wait[i]]), ctx.mix)).sort((x, y) => x.length - y.length)[0]; if (to) { to.push(wait[i]); wait.splice(i--, 1); } }
  // enough people left over for a table of their own (only if that makes progress and the mix allows it)
  const mixOK = (L) => { if (!ctx.mix) return true; const c = {}; L.forEach((p) => { c[p.school] = (c[p.school] || 0) + 1; }); return L.length - Math.max.apply(null, Object.values(c)) >= 2; };
  if (wait.length >= 4 && wait.length < N && mixOK(wait)) { const r = assembleGroup(wait.splice(0), type, trackId, Object.assign({}, ctx, { locks: [] })); r.tables.forEach((t) => tables.push(t.ids.map((id) => ps.find((p) => p.id === id)))); r.wait.forEach((id) => wait.push(ps.find((p) => p.id === id))); }

  // local search: swap two people from the same school (the mix never changes), or move one where the sizes allow
  const live = tables.filter((t) => t.length);
  const sc = live.map((t) => scoreTable(t, type, trackId, ctx).total);
  const iters = live.length > 1 ? Math.min(20000, 2500 * live.length) : 0;
  for (let it = 0; it < iters; it++) {
    const i = Math.floor(ctx.rng() * live.length); let j = Math.floor(ctx.rng() * (live.length - 1)); if (j >= i) j++;
    const A = live[i], B = live[j], a = A[Math.floor(ctx.rng() * A.length)];
    if (!a || ctx.lockOf[a.id]) continue;
    if (ctx.rng() < 0.8) {
      const same = B.filter((p) => p.school === a.school && !ctx.lockOf[p.id]); if (!same.length) continue;
      const b = same[Math.floor(ctx.rng() * same.length)];
      const A2 = A.map((p) => (p === a ? b : p)), B2 = B.map((p) => (p === b ? a : p));
      const sa = scoreTable(A2, type, trackId, ctx).total, sb = scoreTable(B2, type, trackId, ctx).total;
      if (sa + sb > sc[i] + sc[j] + 1e-9) { live[i] = A2; live[j] = B2; sc[i] = sa; sc[j] = sb; }
    } else {
      if (A.length <= 4 || B.length >= 6) continue;
      const A2 = A.filter((p) => p !== a), B2 = B.concat([a]);
      if (!balanced(A2, ctx.mix) || !balanced(B2, ctx.mix)) continue;
      const sa = scoreTable(A2, type, trackId, ctx).total, sb = scoreTable(B2, type, trackId, ctx).total;
      if (sa + sb > sc[i] + sc[j] + 1e-9) { live[i] = A2; live[j] = B2; sc[i] = sa; sc[j] = sb; }
    }
  }
  // people who blocked or reported each other never share a table: the one with less priority (the later one, if equal)
  // moves to another table that keeps the mix, or waits; a table left under four people can't run, so its people wait
  const clash = (t, p) => t.some((q) => q !== p && ctx.blocked.has(pk(p.id, q.id)));
  for (let guard = 0; guard < 50; guard++) {
    const ti = live.findIndex((t) => t.some((p) => clash(t, p))); if (ti < 0) break;
    const t = live[ti], keeps = (p) => (balanced(t.filter((q) => q !== p), ctx.mix) ? 0 : 1);
    const mv = t.filter((p) => clash(t, p)).sort((a, b) => (keeps(a) - keeps(b)) || (!!ctx.lockOf[a.id] - !!ctx.lockOf[b.id]) || (a.prio - b.prio) || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))[0];
    live[ti] = t.filter((p) => p !== mv);
    const to = live.find((o, j) => j !== ti && o.length < 6 && !clash(o.concat([mv]), mv) && balanced(o.concat([mv]), ctx.mix)); if (to) to.push(mv); else wait.push(mv);
  }
  for (let guard = 0; guard < 50; guard++) {
    const bad = live.find((t) => t.length >= 4 && !balanced(t, ctx.mix)); if (!bad) break;
    const c = {}; bad.forEach((p) => { c[p.school] = (c[p.school] || 0) + 1; }); const maj = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    const cand = bad.filter((p) => p.school === maj && !ctx.lockOf[p.id]).pop() || bad.filter((p) => p.school === maj).pop(); bad.splice(bad.indexOf(cand), 1);
    const to = live.find((o) => o !== bad && o.length >= 4 && o.length < 6 && !clash(o.concat([cand]), cand) && balanced(o.concat([cand]), ctx.mix)); if (to) to.push(cand); else wait.push(cand);
  }
  for (let i = live.length - 1; i >= 0; i--) if (live[i].length < 4) { live[i].forEach((p) => wait.push(p)); live.splice(i, 1); }
  return {
    tables: live.map((t) => { const s = scoreTable(t, type, trackId, ctx); return { track: type === 'kindred' ? null : trackId, ids: t.map((p) => p.id), score: Math.round(s.base * 100), flags: s.flags }; }),
    wait: wait.map((p) => p.id)
  };
}

/* ---------- one night ----------
   members: [{ id, school, profile, size, prio, at }]
   opt: { type: 'topic'|'kindred', blocked: [pairKey], history: [pairKey], locks: [[ids]], mix: true, seed } */
// the track most of a table shares (a first pick counts double), the group's own track on a tie
function sharedTrack(people, fallback) {
  const c = {}; people.forEach((p) => p.tracks.forEach((x, i) => { c[x] = (c[x] || 0) + (i === 0 ? 2 : 1); }));
  return Object.keys(c).sort((a, b) => (c[b] - c[a]) || ((b === fallback) - (a === fallback)))[0] || fallback;
}
function assemble(members, opt) {
  opt = opt || {};
  const type = opt.type === 'kindred' ? 'kindred' : 'topic';
  const ps = members.map(prep), byId = {}; ps.forEach((p) => { byId[p.id] = p; });
  const ctx = { blocked: new Set(opt.blocked || []), history: new Set(opt.history || []), lockOf: {}, locks: [], mix: opt.mix !== false, rng: rng(opt.seed || 7) };
  (opt.locks || []).forEach((g, gi) => {
    const ids = g.filter((id) => byId[id] && !ctx.lockOf[id]).slice(0, 4); if (ids.length < 2) return;
    ctx.locks.push(ids); ids.forEach((id) => { ctx.lockOf[id] = gi + 1; });
    ids.forEach((id) => { byId[id].gtrack = byId[ids[0]].track; }); // a reunion sits in the first person's track
  });
  const merged = [];
  let groups = {};
  if (type === 'kindred') groups = { all: ps };
  else {
    ps.forEach((p) => { const t = p.gtrack || p.track; (groups[t] = groups[t] || []).push(p); });
    const canForm = (L) => { if (L.length < 4) return false; if (!ctx.mix) return true; const c = {}; L.forEach((p) => { c[p.school] = (c[p.school] || 0) + 1; }); return L.length - Math.max.apply(null, Object.values(c)) >= 2; };
    // a track too small for a table: its people go to their other track first, when that one can make a table (or nearly)
    Object.keys(groups).filter((t) => !canForm(groups[t])).sort((a, b) => groups[a].length - groups[b].length).forEach((t) => {
      const g = groups[t]; if (!g || canForm(g)) return;
      g.slice().forEach((p) => {
        if (p.gtrack) return; // a reunion stays in its track
        const alt = p.tracks.slice(1).find((x) => x !== t && groups[x] && (canForm(groups[x]) || groups[x].length >= 3));
        if (alt) { groups[alt].push(p); g.splice(g.indexOf(p), 1); }
      });
      if (!g.length) delete groups[t];
    });
    // when most people's tracks are too small for a table that evening, one pool beats merging into whichever track is
    // biggest: the scorer then seats people who share a track together, and each table is named for what it shares
    const viable = Object.keys(groups).filter((t) => canForm(groups[t])).reduce((n, t) => n + groups[t].length, 0);
    if (viable < 0.6 * ps.length) groups = { pool: ps };
    for (let guard = 0; guard < 40 && !groups.pool; guard++) {
      const small = Object.keys(groups).filter((t) => !canForm(groups[t])).sort((a, b) => groups[a].length - groups[b].length)[0];
      const others = Object.keys(groups).filter((t) => t !== small);
      if (!small || !others.length) break;
      const into = groups[SX.NEAR[small]] && SX.NEAR[small] !== small ? SX.NEAR[small] : others.sort((a, b) => groups[b].length - groups[a].length)[0];
      groups[into] = groups[into].concat(groups[small]); delete groups[small]; merged.push({ from: small, into });
    }
  }
  const tables = [], wait = [];
  Object.keys(groups).forEach((g) => {
    const r = assembleGroup(groups[g], type, g === 'all' ? null : g, ctx);
    r.tables.forEach((t) => {
      const people = t.ids.map((id) => byId[id]);
      if (type !== 'kindred') t.track = sharedTrack(people, t.track); // named for the track most of the table shares
      tables.push(Object.assign(t, { why: whyLines(people, type, t.track, ctx), split: type === 'kindred' ? null : splits(people, t.track)[0] }));
    });
    wait.push.apply(wait, r.wait);
  });
  if (type !== 'kindred' && wait.length >= 4 && Object.keys(groups).length > 1) {
    const W = wait.map((id) => byId[id]), inW = new Set(wait);
    const r = assembleGroup(W, type, 'pool', Object.assign({}, ctx, { locks: ctx.locks.filter((g) => g.every((id) => inW.has(id))) }));
    if (r.tables.length) {
      wait.length = 0; wait.push.apply(wait, r.wait);
      r.tables.forEach((t) => { const people = t.ids.map((id) => byId[id]); t.track = sharedTrack(people, people[0].track); tables.push(Object.assign(t, { why: whyLines(people, type, t.track, ctx), split: splits(people, t.track)[0] })); });
    }
  }
  return { tables, wait, merged };
}

module.exports = { assemble, scoreTable, whyLines, splits, balanced, prep, pk };
