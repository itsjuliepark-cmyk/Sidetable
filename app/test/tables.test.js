// node --test: the table engine keeps its rules on random groups.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const T = require('../server/tables.js');
const SX = require('../public/shared.js');

function people(n, opt) {
  opt = opt || {};
  let s = opt.seed || 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; const pick = (a) => a[Math.floor(r() * a.length)];
  return Array.from({ length: n }, (_, i) => {
    const tr = opt.track || pick(['genai', 'hcai', 'founders', 'climate']);
    return { id: 'p' + i, school: opt.school || (opt.hbsShare != null ? (r() < opt.hbsShare ? 'harvard' : 'mit') : i % 2 ? 'mit' : 'harvard'), at: String(1000 + i),
      profile: { tracks: [tr], interests: SX.INTS.filter((x) => x.tr === tr).slice(0, 6).filter(() => r() < 0.6).map((x) => x.id).concat([SX.INTS.find((x) => x.tr === tr).id]),
        lens: pick(['build', 'fund', 'run', 'study', 'pivot']), takes: { track: pick(['agree', 'disagree']), code: pick(['agree', 'disagree', 'depends']), lab: pick(['agree', 'disagree']) },
        answers: { 0: Math.floor(r() * 4), 1: Math.floor(r() * 4), 2: Math.floor(r() * 4), 3: Math.floor(r() * 4) }, rhythm: pick(SX.RHYTHM)[0], look: pick(SX.LOOK).id,
        life: [pick(SX.LIFE)], acts: [pick(SX.ACTS), pick(SX.ACTS)] } };
  });
}
function checkRules(out, members) {
  const byId = {}; members.forEach((m) => { byId[m.id] = m; });
  const seen = new Set();
  out.tables.forEach((t) => {
    assert.ok(t.ids.length >= 4 && t.ids.length <= 6, 'table size ' + t.ids.length);
    const c = {}; t.ids.forEach((id) => { assert.ok(!seen.has(id), 'seated twice: ' + id); seen.add(id); c[byId[id].school] = (c[byId[id].school] || 0) + 1; });
    assert.ok(Object.keys(c).length >= 2, 'one school only');
    assert.ok(Math.max.apply(null, Object.values(c)) <= Math.ceil(t.ids.length / 2), 'school above half: ' + JSON.stringify(c));
    assert.ok(Array.isArray(t.why) && t.why.length >= 3, 'why lines');
  });
  out.wait.forEach((id) => assert.ok(!seen.has(id), 'waitlisted and seated: ' + id));
  assert.strictEqual(seen.size + out.wait.length, members.length, 'everyone is either seated or waiting');
}

test('balanced groups: everyone gets a seat and every rule holds', () => {
  [12, 13, 18, 24, 31, 47].forEach((n) => {
    const ms = people(n, { seed: n });
    ['topic', 'kindred'].forEach((type) => { const out = T.assemble(ms, { type, seed: 3 }); checkRules(out, ms); if (type === 'kindred') assert.strictEqual(out.wait.length, 0, 'kindred seats everyone when the schools are even'); });
  });
});

test('lopsided schools: the extra people wait instead of breaking the mix', () => {
  const ms = people(20, { seed: 9, hbsShare: 0.8 });
  const out = T.assemble(ms, { type: 'kindred', seed: 1 });
  checkRules(out, ms);
  assert.ok(out.wait.length > 0, 'some people wait');
});

test('one school only: no table at all', () => {
  const ms = people(10, { school: 'harvard' });
  const out = T.assemble(ms, { type: 'kindred' });
  assert.strictEqual(out.tables.length, 0);
  assert.strictEqual(out.wait.length, 10);
});

test('a blocked pair never shares a table when there is room to separate them', () => {
  const ms = people(24, { seed: 4, track: 'genai' });
  const blocked = [T.pk('p0', 'p2'), T.pk('p1', 'p3'), T.pk('p4', 'p6')];
  const out = T.assemble(ms, { type: 'topic', blocked, seed: 2 });
  checkRules(out, ms);
  out.tables.forEach((t) => blocked.forEach((k) => { const [a, b] = k.split('|'); assert.ok(!(t.ids.indexOf(a) >= 0 && t.ids.indexOf(b) >= 0), 'blocked pair together: ' + k); }));
});

test('a reunion sits together, even though they shared a table before', () => {
  const ms = people(24, { seed: 6, track: 'hcai' });
  const out = T.assemble(ms, { type: 'topic', history: [T.pk('p0', 'p1'), T.pk('p0', 'p3'), T.pk('p1', 'p3')], locks: [['p0', 'p1', 'p3']], seed: 2 });
  checkRules(out, ms);
  const t = out.tables.find((x) => x.ids.indexOf('p0') >= 0);
  assert.ok(t.ids.indexOf('p1') >= 0 && t.ids.indexOf('p3') >= 0, 'reunion split up');
  assert.ok(t.flags.indexOf('sat together before') < 0, 'a reunion is not a repeat');
  assert.ok(t.why.some((w) => /reunion/.test(w)), 'Charlie mentions the reunion');
});

test('a track too small for a table joins its nearest neighbor', () => {
  const ms = people(16, { seed: 8, track: 'genai' }).concat(people(3, { seed: 2, track: 'hcai' }).map((m, i) => Object.assign(m, { id: 'h' + i })));
  const out = T.assemble(ms, { type: 'topic', seed: 2 });
  checkRules(out, ms);
  assert.deepStrictEqual(out.merged, [{ from: 'hcai', into: 'genai' }]);
});

test('the same seed gives the same tables', () => {
  const ms = people(30, { seed: 12 });
  assert.deepStrictEqual(T.assemble(ms, { type: 'topic', seed: 4 }).tables.map((t) => t.ids), T.assemble(ms, { type: 'topic', seed: 4 }).tables.map((t) => t.ids));
});

test('Topic tables keep at most two investors when there are enough others', () => {
  const ms = people(24, { seed: 3, track: 'founders' });
  ms.forEach((m, i) => { m.profile.lens = i < 6 ? 'fund' : 'build'; }); // six investors for four tables
  const out = T.assemble(ms, { type: 'topic', seed: 5 });
  out.tables.forEach((t) => assert.ok(t.ids.filter((id) => ms.find((m) => m.id === id).profile.lens === 'fund').length <= 2, 'pitch night'));
});

test('separating a blocked pair never leaves a table over half one school', () => {
  const ms = people(5, { track: 'genai' }); ['harvard', 'harvard', 'harvard', 'mit', 'mit'].forEach((s, i) => { ms[i].school = s; });
  ['kindred', 'topic'].forEach((type) => {
    const out = T.assemble(ms, { type, blocked: [T.pk(ms[0].id, ms[3].id)], seed: 1 });
    checkRules(out, ms);
    out.tables.forEach((t) => assert.ok(!(t.ids.indexOf(ms[0].id) >= 0 && t.ids.indexOf(ms[3].id) >= 0), 'the blocked pair apart'));
  });
});

test('a small second school still gets its tables: twenty from one school and two from the other seat five', () => {
  const ms = people(22, { track: 'genai' }); ms.forEach((m, i) => { m.school = i < 20 ? 'harvard' : 'mit'; });
  ['kindred', 'topic'].forEach((type) => { const out = T.assemble(ms, { type, seed: 1 }); checkRules(out, ms); assert.ok(out.tables.length >= 1, type + ': one table, not none'); });
});

test('people left over from different tracks can still share a table', () => {
  const tr = ['genai', 'genai', 'genai', 'climate', 'climate', 'founders', 'founders', 'hcai', 'hcai', 'bio'];
  const ms = people(tr.length); ms.forEach((m, i) => { m.profile.tracks = [tr[i]]; m.school = i % 2 ? 'mit' : 'harvard'; });
  const out = T.assemble(ms, { type: 'topic', seed: 2 }); checkRules(out, ms);
  assert.ok(out.wait.length < 4, 'four or more waiting would make a table: ' + out.wait.length);
});
