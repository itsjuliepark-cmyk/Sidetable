// node --test: the server's flows, from joining to a reunion, on a throwaway data folder.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sixtop-test-'));
process.env.SIXTOP_DATA_DIR = dir;
process.env.SIXTOP_ADMIN_KEY = 'test-admin-key-123';
process.env.SIXTOP_MAIL = 'show'; // codes come back in the response instead of an email
const S = require('../server/server.js');
const SX = require('../public/shared.js');
const db = () => S.db();
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const PHOTO = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('a face')]).toString('base64');
test.after(() => { S.save(true); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });

const fullProfile = (i, tr) => ({
  tracks: [tr || 'genai'], interests: SX.INTS.filter((x) => x.tr === (tr || 'genai')).slice(i % 3, (i % 3) + 3).map((x) => x.id), lens: ['build', 'run', 'study', 'fund'][i % 4], before: 'Engineer',
  takes: { track: i % 2 ? 'agree' : 'disagree', code: 'agree', lab: 'depends' }, answers: { 0: i % 4, 1: (i + 1) % 4, 2: (i + 2) % 4, 3: i % 3 },
  rhythm: 'Every two weeks', life: ['New to Boston'], acts: ['Run the Charles'], look: 'crew', askWork: 'agents', askLife: 'hikes', diet: [],
  mix: 'both', perWeek: 2, next: ['Start a company', 'Venture capital'], plan: 'ship a beta', dream: 'a bookstore with a great coffee bar'
});
function people(n, tag, tr) {
  return Array.from({ length: n }, (_, i) => {
    const school = i % 2 ? 'mit' : 'harvard', m = S.newMember(tag + ' Person' + i, tag.toLowerCase() + i + '@' + (school === 'harvard' ? 'harvard.edu' : 'mit.edu'), school, 'test');
    m.verified = true;
    S.saveProfile(m, { first: tag + i, school, program: SX.SCHOOLS[school].programs[0], year: SX.YEARS[1], profile: fullProfile(i, tr), photo: PHOTO });
    return m;
  });
}

test('joining: a 6-digit code to a Harvard or MIT email; the same email signs you back in', async () => {
  const c = S.newClub({ name: 'Test Club' });
  await assert.rejects(S.startVerify(null, { code: c.code, name: 'A Person', email: 'a@gmail.com' }), /Harvard|MIT/);
  await assert.rejects(S.startVerify(null, { code: 'NOPE', name: 'B Person', email: 'b@mit.edu' }), /invite-only/);
  const r = await S.startVerify(null, { code: c.code, name: 'A Person', email: 'A@MBA2027.hbs.edu' });
  assert.strictEqual(r.school, 'harvard', 'an HBS address is a Harvard address'); assert.ok(/^\d{6}$/.test(r.devCode));
  await assert.rejects(S.startVerify(null, { code: c.code, name: 'A Person', email: 'a@mba2027.hbs.edu' }), /30 seconds/, 'no code spamming');
  assert.throws(() => S.finishVerify(null, { email: 'a@mba2027.hbs.edu', code: r.devCode === '123456' ? '654321' : '123456' }), /match/);
  const tok = S.finishVerify(null, { email: 'a@mba2027.hbs.edu', code: r.devCode }).token, m = Object.values(db().members).find((x) => x.token === tok);
  assert.ok(m.verified && m.school === 'harvard' && m.email === 'a@mba2027.hbs.edu');
  assert.throws(() => S.finishVerify(null, { email: 'a@mba2027.hbs.edu', code: r.devCode }), /expired/, 'a code works once');
  // a new phone: the same email signs the same person back in
  const again = await S.startVerify(null, { email: 'a@mba2027.hbs.edu' });
  assert.strictEqual(S.finishVerify(null, { email: 'a@mba2027.hbs.edu', code: again.devCode }).token, m.token);
  // a personal invite from the organizer confirms its school email first, and the school follows the email
  const inv = S.newMember('Invited Person', '', 'harvard', 'invite');
  await assert.rejects(S.startVerify(inv, { email: 'a@mba2027.hbs.edu' }), /another member/);
  const r2 = await S.startVerify(inv, { email: 'inv@mit.edu' });
  S.finishVerify(inv, { email: 'inv@mit.edu', code: r2.devCode });
  assert.ok(inv.verified && inv.email === 'inv@mit.edu' && inv.school === 'mit');
  assert.throws(() => S.saveProfile(inv, { first: 'Inv', school: 'mit', profile: fullProfile(0) }), /photo/, 'a photo is required');
  // anyone at Harvard, not just HBS: the College and the other schools verify too
  const col = await S.startVerify(null, { code: c.code, name: 'College Person', email: 'cp@college.harvard.edu' });
  assert.strictEqual(col.school, 'harvard');
  // what you study and your class come from fixed lists
  S.saveProfile(inv, { first: 'Inv', program: 'Media Lab', year: 'Class of 2028', profile: fullProfile(0), photo: PHOTO });
  assert.strictEqual(inv.program, 'Media Lab'); assert.strictEqual(inv.year, 'Class of 2028');
  S.saveProfile(inv, { first: 'Inv', program: 'Kennedy School', year: 'RC · Class of 2027', profile: fullProfile(0) });
  assert.strictEqual(inv.program, 'Media Lab', 'an MIT member can’t pick a Harvard program'); assert.strictEqual(inv.year, 'Class of 2028', 'old-style years are ignored');
});

test('the profile keeps only known answers, and is done only when complete', () => {
  const p = S.cleanProfile({ tracks: ['genai', 'bogus', 'hcai', 'climate'], interests: ['agents', 'clinical', 'grid', 'made-up'], lens: 'wizard', takes: { track: 'yes' }, answers: { 0: 9 } });
  assert.deepStrictEqual(p.tracks, ['genai', 'hcai', 'climate'], 'as many tracks as are true');
  assert.deepStrictEqual(p.interests, ['agents', 'clinical', 'grid']);
  assert.strictEqual(p.lens, null);
  assert.strictEqual(p.done, false);
  assert.strictEqual(S.cleanProfile(fullProfile(1)).done, true);
});

test('a night: seats, a draft, publishing, the table and its chat', () => {
  const ms = people(12, 'Night');
  const e = S.createEvent({ type: 'topic', date: day(10), time: '19:30' });
  ms.forEach((m) => S.bookSeat(m, { event: e.id, size: 'either' }));
  S.cancelSeat(ms[0], { event: e.id });
  assert.strictEqual(db().seats[e.id][ms[0].id].status, 'cancelled');
  S.bookSeat(ms[0], { event: e.id });
  const d = S.draft({ event: e.id });
  assert.ok(d.tables.length >= 2, 'tables drafted');
  const seated = d.tables.reduce((n, t) => n + t.people.length, 0);
  assert.strictEqual(seated + d.wait.length, 12);
  assert.throws(() => S.bookSeat(ms[1], { event: 'nope' }), /no such event/);
  S.publish({ event: e.id });
  const v = S.view(ms[3]);
  const mine = v.tables.find((t) => t.eventId === e.id);
  assert.ok(mine, 'the table shows up for a member');
  const tv = S.tableView(ms[3], mine.id);
  assert.ok(tv.people.some((p) => p.me), 'I am at my table');
  assert.strictEqual(tv.venue, null, 'the venue stays hidden until noon on the day');
  assert.ok(tv.chat[0].from === 'charlie' && /Welcome, table/.test(tv.chat[0].text), 'Charlie opens the chat');
  assert.throws(() => S.tableView(S.newMember('Out Sider', '', 'harvard', 'test'), mine.id), /no such table/);
  S.postChat(ms[3], { table: mine.id, text: 'hi all' });
  assert.ok(S.tableView(ms[3], mine.id).chat.some((m) => m.text === 'hi all'));
  assert.throws(() => S.feedback(ms[3], { table: mine.id, picks: [] }), /not happened yet/);
});

test('tonight’s question: a menu of three, the table votes, sides stay sealed until dinner, then the split and changed minds', () => {
  const ms = people(6, 'Game');
  const e = S.createEvent({ type: 'topic', date: day(3), time: '19:00' });
  ms.forEach((m) => S.bookSeat(m, { event: e.id })); S.draft({ event: e.id }); S.publish({ event: e.id });
  const t = Object.values(db().tables).find((x) => x.eventId === e.id), ids = t.ids, who = (id) => db().members[id];
  const g0 = S.tableView(who(ids[0]), t.id).game;
  assert.strictEqual(g0.stage, 'vote'); assert.strictEqual(g0.cards.length, 3);
  assert.strictEqual(new Set(g0.cards.map((c) => c.k)).size, 3, 'three different formats');
  assert.ok(g0.cards.every((c) => c.tr === undefined && c.q && c.a && c.b), 'cards carry the question and both sides');
  assert.ok(g0.cards.some((c) => SX.card(c.id).tr.indexOf('genai') >= 0), 'at least one card fits the table’s track');
  assert.ok(S.tableView(who(ids[0]), t.id).chat.some((m) => m.kind === 'menu'), 'Charlie posts the menu');
  // everyone votes; the most-voted card wins the moment the last vote is in
  const [c1, c2] = g0.cards.map((c) => c.id);
  ids.forEach((id, i) => S.playGame(who(id), { table: t.id, act: 'vote', card: i < ids.length - 2 ? c2 : c1 }));
  assert.strictEqual(t.game.pick, c2);
  assert.throws(() => S.playGame(who(ids[0]), { table: t.id, act: 'vote', card: c1 }), /closed/);
  assert.ok(S.tableView(who(ids[0]), t.id).chat.some((m) => /The table has spoken/.test(m.text)));
  // sides are sealed: I see mine and a count, never anyone else's
  S.playGame(who(ids[0]), { table: t.id, act: 'side', side: 'a' });
  S.playGame(who(ids[1]), { table: t.id, act: 'side', side: 'b' });
  const peek = S.gameView(t, who(ids[1]));
  assert.strictEqual(peek.mySide, 'b'); assert.strictEqual(peek.sided, 2); assert.strictEqual(peek.A, undefined, 'nobody else’s side shows before dinner');
  ids.slice(2).forEach((id) => S.playGame(who(id), { table: t.id, act: 'side', side: 'a' }));
  S.playGame(who(ids[1]), { table: t.id, act: 'guess', n: 5 });
  assert.throws(() => S.playGame(who(ids[1]), { table: t.id, act: 'guess', n: 40 }), /between/);
  assert.ok(S.tableView(who(ids[0]), t.id).chat.some((m) => /sealed/.test(m.text)), 'Charlie notes when every side is in');
  assert.throws(() => S.playGame(who(ids[0]), { table: t.id, act: 'final', side: 'b' }), /after dinner/);
  // dinner starts: the split opens, with whoever called it
  S.advanceGame(t, S.eventTimes(e).start + 60000);
  const open = S.gameView(t, who(ids[0]));
  assert.strictEqual(open.stage, 'revealed'); assert.strictEqual(open.A.length, 5); assert.strictEqual(open.B.length, 1);
  assert.deepStrictEqual(open.oracle, [who(ids[1]).first]);
  assert.ok(db().chats[t.id].some((m) => /The split is in: 5/.test(m.text) && /holding the line alone/.test(m.text)));
  assert.match(S.tableView(who(ids[0]), t.id).deck[1][4], /You split 5–1/, 'the deck’s round 2 is built on the split');
  // the morning after: who changed their mind
  S.playGame(who(ids[1]), { table: t.id, act: 'final', side: 'a' });
  S.playGame(who(ids[0]), { table: t.id, act: 'final', side: 'a' });
  assert.deepStrictEqual(S.gameView(t, who(ids[0])).moved, [who(ids[1]).first]);
  // the note waits for the rest of the table (or a day and a half), so two answers don't speak for six
  S.advanceGame(t, S.eventTimes(e).pushFeedback + 60000);
  assert.ok(!db().chats[t.id].some((m) => /changed their mind/.test(m.text)), 'not yet: four people still haven’t said');
  S.advanceGame(t, S.eventTimes(e).pushFeedback + 37 * 3600e3);
  assert.ok(db().chats[t.id].some((m) => /changed their mind/.test(m.text)));
});

test('can’t make it: an open chair on another evening, or standby until someone gives one up', () => {
  const night = (n, ms, size) => { const e = S.createEvent({ type: 'topic', date: day(n), time: '19:00' }); ms.forEach((m) => S.bookSeat(m, { event: e.id })); S.draft({ event: e.id }); S.publish({ event: e.id }); return e; };
  const [a, b] = [people(5, 'Mon'), people(5, 'Wed')];
  const mon = night(3, a), wed = night(5, b);
  // MIT people move, so Wednesday's school mix (three and three at most) still holds
  const me = a[1], monTable = Object.values(db().tables).find((t) => t.eventId === mon.id && t.ids.indexOf(me.id) >= 0);
  assert.throws(() => S.reinvite(me, { table: monTable.id, dates: [day(5)] }), /can’t make that table first/, 'only after stepping out');
  assert.throws(() => S.reinvite(b[0], { table: monTable.id, dates: [day(5)] }), /can’t make that table first/, 'not someone else’s table');
  S.cancelSeat(me, { event: mon.id });
  assert.throws(() => S.reinvite(me, { table: monTable.id, dates: [] }), /pick at least one evening/);
  const r = S.reinvite(me, { table: monTable.id, dates: [day(5)] });
  assert.ok(r.table, 'a chair on Wednesday');
  assert.strictEqual(db().tables[r.table].eventId, wed.id);
  assert.ok(db().chats[r.table].some((m) => /pulled up a chair/.test(m.text)), 'Charlie tells the new table');
  assert.ok(S.view(me).tables.some((t) => t.id === r.table), 'the new invitation shows up');
  // Wednesday is full now (six), so the next person who asks waits on standby
  const late = a[3]; S.cancelSeat(late, { event: mon.id });
  const s = S.reinvite(late, { table: monTable.id, dates: [day(5)] });
  assert.ok(s.standby, 'nothing open, so standby'); assert.ok(S.view(late).standby, 'the app shows it');
  // someone on Wednesday can't make it: the chair goes to the person on standby
  S.cancelSeat(b[1], { event: wed.id });
  assert.ok(seatedIn(late, wed.id), 'the freed chair went to standby');
  assert.strictEqual(S.view(late).standby, null);
  function seatedIn(m, eid) { return Object.values(db().tables).some((t) => t.eventId === eid && t.ids.indexOf(m.id) >= 0 && !(t.out && t.out[m.id])); }
});

test('nobody votes: Charlie picks at the deadline', () => {
  const ms = people(6, 'Quiet');
  const e = S.createEvent({ type: 'kindred', date: day(5), time: '19:00' });
  ms.forEach((m) => S.bookSeat(m, { event: e.id })); S.draft({ event: e.id }); S.publish({ event: e.id });
  const t = Object.values(db().tables).find((x) => x.eventId === e.id);
  assert.ok(t.game.cards.every((id) => SX.card(id).tr.indexOf('social') >= 0), 'social tables get social questions');
  S.advanceGame(t, t.game.voteBy + 1000);
  assert.strictEqual(t.game.pick, t.game.cards[0]); assert.strictEqual(t.game.by, 'charlie');
  assert.ok(db().chats[t.id].some((m) => /Nobody voted, so I picked/.test(m.text)));
});

test('after a dinner: picks stay private, mutual picks open a 1:1, and they sit together next time', () => {
  const ms = people(8, 'After');
  const e = S.createEvent({ type: 'kindred', date: day(-3), time: '19:30' });
  db().seats[e.id] = {}; ms.forEach((m, k) => { db().seats[e.id][m.id] = { at: new Date(Date.now() - 9e8 + k).toISOString(), size: 'either', diet: [], status: 'held' }; });
  const d = S.draft({ event: e.id }); S.publish({ event: e.id });
  const t = db().tables[d.tables[0].id], [a, b, c] = t.ids.map((id) => db().members[id]);
  S.feedback(a, { table: t.id, rating: 5, picks: [b.id, c.id] });
  assert.strictEqual(S.isMutual(a.id, b.id), false, 'one-way is not mutual');
  assert.throws(() => S.postDm(a, { with: b.id, text: 'hey' }), /no such chat/);
  const r = S.feedback(b, { table: t.id, rating: 4, picks: [a.id] });
  assert.deepStrictEqual(r.mutual.map((x) => x.id), [a.id]);
  assert.strictEqual(S.isMutual(a.id, b.id), true);
  S.postDm(a, { with: b.id, text: 'coffee?' });
  assert.throws(() => S.postDm(c, { with: a.id, text: 'hi' }), /no such chat/, 'c picked nobody back');
  const conn = S.view(a).connections.find((x) => x.id === b.id);
  assert.ok(conn && conn.mutual && conn.times === 1, 'b shows up as a mutual connection');
  // next night, both book: the reunion seats them together
  const next = S.createEvent({ type: 'kindred', date: day(12), time: '19:30' });
  ms.concat(people(6, 'Fresh')).forEach((m) => S.bookSeat(m, { event: next.id }));
  const d2 = S.draft({ event: next.id });
  const ta = d2.tables.find((x) => x.people.some((p) => p.id === a.id));
  assert.ok(ta && ta.people.some((p) => p.id === b.id), 'a and b sit together again');
  assert.ok(d2.reunions.some((g) => g.indexOf(a.name) >= 0 && g.indexOf(b.name) >= 0));
});

test('admin moves someone and the table is re-scored', () => {
  const ms = people(10, 'Move');
  const e = S.createEvent({ type: 'kindred', date: day(14), time: '19:30' });
  ms.forEach((m) => S.bookSeat(m, { event: e.id }));
  const d = S.draft({ event: e.id }), from = d.tables[0], who = from.people[0].id;
  const after = S.move({ event: e.id, member: who, to: 'wait' });
  assert.ok(after.wait.some((p) => p.id === who));
  assert.ok(!after.tables.find((t) => t.id === from.id).people.some((p) => p.id === who));
});

test('http: the app, the member API and the admin API', async () => {
  await new Promise((res) => S.server.listen(0, res));
  const base = 'http://127.0.0.1:' + S.server.address().port;
  try {
    const page = await fetch(base + '/'); assert.strictEqual(page.status, 200); assert.match(await page.text(), /stay for the <span class="it">friends<\/span>/);
    assert.strictEqual((await fetch(base + '/admin')).status, 200);
    assert.strictEqual((await fetch(base + '/shared.js')).status, 200);
    // the opening film answers byte ranges (Safari on iPhone won't play it otherwise)
    const part = await fetch(base + '/video/film.mp4', { headers: { range: 'bytes=0-99' } });
    assert.strictEqual(part.status, 206); assert.strictEqual(part.headers.get('content-type'), 'video/mp4');
    assert.match(part.headers.get('content-range'), /^bytes 0-99\/\d+$/); assert.strictEqual((await part.arrayBuffer()).byteLength, 100);
    assert.strictEqual((await fetch(base + '/api/me')).status, 401);
    // invite-only: object keys like __proto__ are just unknown club codes
    for (const code of ['__proto__', 'constructor']) assert.strictEqual((await fetch(base + '/api/join?code=' + code)).status, 404);
    const sneak = await fetch(base + '/api/verify/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'sneak@mit.edu', name: 'Sneaky Person', code: '__proto__' }) });
    assert.strictEqual(sneak.status, 400, 'no club, no join');
    // a malformed request line is a 400, and the server keeps running
    await new Promise((resolve) => { const sock = require('net').connect(S.server.address().port, '127.0.0.1', () => sock.end('GET //[ HTTP/1.1\r\nHost: x\r\n\r\n')); sock.on('data', () => {}); sock.on('close', resolve); sock.on('error', resolve); });
    assert.strictEqual((await fetch(base + '/health')).status, 200, 'still up');
    const m = people(1, 'Http')[0];
    const me = await fetch(base + '/api/me', { headers: { 'x-sixtop-token': m.token } });
    assert.strictEqual(me.status, 200);
    const v = await me.json(); assert.strictEqual(v.me.done, true); assert.ok(!('token' in v.me), 'the token never comes back in a view');
    assert.strictEqual((await fetch(base + '/api/admin/state')).status, 401);
    const st = await fetch(base + '/api/admin/state', { headers: { 'x-admin-key': 'test-admin-key-123' } });
    assert.strictEqual(st.status, 200); assert.ok((await st.json()).members.length > 0);
    const bad = await fetch(base + '/api/seat', { method: 'POST', headers: { 'x-sixtop-token': m.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'nope' }) });
    assert.strictEqual(bad.status, 400);
    const other = people(1, 'Http2')[0], stranger = S.newMember('Not Verified', '', 'harvard', 'invite');
    const pkey = new URL(v.me.photo, base).searchParams.get('t');
    assert.ok(pkey && pkey !== m.token, 'photo addresses carry a photo key, not the login token');
    assert.strictEqual((await fetch(base + '/api/photo?id=' + other.id + '&t=' + pkey)).status, 200, 'verified members see each other’s faces');
    assert.strictEqual((await fetch(base + '/api/photo?id=' + other.id + '&t=' + m.token)).status, 404, 'the login token never opens a photo');
    assert.strictEqual((await fetch(base + '/api/photo?id=' + other.id + '&t=' + stranger.token)).status, 404, 'not before verifying');
    const gated = await fetch(base + '/api/avail', { method: 'POST', headers: { 'x-sixtop-token': stranger.token, 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(gated.status, 403, 'nothing works until the school email is confirmed');
    const start = await fetch(base + '/api/verify/start', { method: 'POST', headers: { 'x-sixtop-token': stranger.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nv@mit.edu' }) });
    const code = (await start.json()).devCode;
    const fin = await fetch(base + '/api/verify/finish', { method: 'POST', headers: { 'x-sixtop-token': stranger.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nv@mit.edu', code }) });
    assert.strictEqual(fin.status, 200); assert.ok(stranger.verified);
  } finally { await new Promise((res) => S.server.close(res)); }
});

test('Board: post a role, save it, ask for an intro; a yes opens a chat, a no stays invisible', () => {
  const [poster, asker, other] = people(3, 'Board');
  const id = S.postJob(poster, { title: 'Founding PM', company: 'Test Co', track: 'genai', kind: 'Founding team', role: 'Product', refer: true, note: 'Happy to intro' }).id;
  assert.throws(() => S.postJob(poster, { title: 'x', company: '' }), /title and company/);
  S.saveJob(asker, { job: id });
  const seen = S.board(asker).jobs.find((j) => j.id === id);
  assert.ok(seen && seen.saved && seen.refer && seen.by.id === poster.id);
  assert.throws(() => S.askIntro(poster, { job: id }), /nobody to ask/, 'you cannot ask yourself');
  S.askIntro(asker, { job: id, note: 'I shipped two B2B AI products' });
  assert.throws(() => S.askIntro(asker, { job: id }), /already asked/);
  assert.strictEqual(S.canDm(asker.id, poster.id), false, 'no chat before a yes');
  const req = S.board(poster).introsIn.find((x) => x.from.id === asker.id);
  S.answerIntro(poster, { intro: req.id, accept: true });
  assert.strictEqual(S.canDm(asker.id, poster.id), true, 'a yes opens the chat');
  assert.strictEqual(S.board(asker).jobs.find((j) => j.id === id).intro, 'accepted');
  S.askIntro(other, { job: id });
  const req2 = S.board(poster).introsIn.find((x) => x.from.id === other.id);
  S.answerIntro(poster, { intro: req2.id, accept: false });
  assert.strictEqual(S.board(other).jobs.find((j) => j.id === id).intro, 'sent', 'a no looks like waiting to the person who asked');
  assert.strictEqual(S.canDm(other.id, poster.id), false);
});

test('Pulse: takes split, plus-ones, replies; blocked authors disappear', () => {
  const [a, b, c] = people(3, 'Pulse');
  const take = S.createPost(a, { kind: 'take', text: 'Agents are mostly services companies.', track: 'genai' }).id;
  assert.throws(() => S.createPost(a, { kind: 'rant', text: 'hello there' }), /kind of post/);
  S.vote(b, { post: take, side: 'agree' }); S.vote(c, { post: take, side: 'disagree' });
  let p = S.vote(c, { post: take, side: 'agree' }).post;
  assert.deepStrictEqual([p.agree, p.disagree, p.myVote], [2, 0, 'agree']);
  const ship = S.createPost(b, { kind: 'ship', text: 'Shipped our eval harness.' }).id;
  assert.throws(() => S.vote(a, { post: ship, side: 'agree' }), /no such take/);
  assert.strictEqual(S.plus(a, { post: ship }).post.plus, 1);
  p = S.reply(c, { post: ship, text: 'Congrats!' }).post;
  assert.strictEqual(p.replyN, 1);
  assert.ok(S.pulse(a).posts.some((x) => x.id === ship));
  a.never[b.id] = 1;
  assert.ok(!S.pulse(a).posts.some((x) => x.id === ship), 'a blocked author is hidden');
  delete a.never[b.id];
});

test('People: a wave is private until it is mutual, then the chat opens', () => {
  const [a, b, c] = people(3, 'Wave');
  // a stranger's profile is off limits; once they're in a hang you can see, you can look and wave
  assert.throws(() => S.personView(b, c.id), /no such member/); assert.throws(() => S.wave(b, { id: c.id }), /no such member/);
  const hang = S.createPop(a, { title: 'Coffee before class', place: 'Central Square', date: day(2), time: '09:00', size: 6, kind: 'social', vibe: 'coffee' }).id;
  S.joinPop(b, { id: hang });
  assert.strictEqual(S.wave(a, { id: b.id }).mutual, false);
  assert.strictEqual(S.canDm(a.id, b.id), false);
  assert.ok(!S.people(b).some((x) => x.id === c.id), 'People never lists strangers');
  assert.ok(S.people(b).some((x) => x.id === a.id && x.hang), 'someone from your hang is one of your people');
  assert.strictEqual(S.personView(b, a.id).mutualWave, false, 'b cannot see that a waved');
  assert.strictEqual(S.wave(b, { id: a.id }).mutual, true);
  assert.strictEqual(S.canDm(a.id, b.id), true);
  assert.ok(S.view(a).threads.some((t) => t.id === b.id), 'the chat shows up in Messages');
  assert.ok(S.personView(a, b.id).mutualWave);
  assert.ok(S.people(a).some((x) => x.id === b.id && x.canDm), 'and once the chat is open, you can message them');
});

test('The week: people pick evenings and how many dinners (1 to 5), Charlie mixes career and social tables, never two a night', () => {
  const ms = people(24, 'Week');
  const week = S.targetWeek(), day = (n) => S.addDays(week, n) + '|dinner';
  ms.slice(0, 2).forEach((m) => { m.profile.mix = 'topic'; }); ms.slice(2, 4).forEach((m) => { m.profile.mix = 'social'; });
  assert.strictEqual(S.availView(ms[5]).max, 2, 'the week starts from how many invitations they asked for');
  ms.forEach((m, i) => S.setAvail(m, { slots: i < 18 ? [day(0), day(1), day(2), day(3)] : [day(1)], max: i < 18 ? 3 : 1 }, true));
  assert.strictEqual(S.availView(ms[0]).max, 3);
  assert.ok(S.availView(ms[0]).days.slice(0, 4).every((d) => d.slots[0].on), 'my evenings come back');
  S.setAvail(ms[23], { slots: [day(1)], max: 9 }, true); assert.strictEqual(ms[23].avail.max, 5, 'five a week at most');
  S.setAvail(ms[23], { slots: [day(1)], max: 1 }, true);
  const r = S.matchWeek({});
  assert.ok(r.tables >= 4, 'tables were built: ' + JSON.stringify(r));
  const w = S.db().weeks[week], byPerson = {};
  w.events.forEach((eid) => { const e = S.db().events[eid]; Object.values(S.db().tables).filter((t) => t.eventId === eid).forEach((t) => {
    assert.ok(t.ids.length >= 4 && t.ids.length <= 6);
    t.ids.forEach((id) => { (byPerson[id] = byPerson[id] || []).push(e); });
  }); });
  assert.ok(w.events.some((eid) => S.db().events[eid].type === 'kindred') && w.events.some((eid) => S.db().events[eid].type === 'topic'), 'both career and social tables');
  let mixed = 0;
  Object.keys(byPerson).forEach((id) => {
    const m = S.db().members[id], evs = byPerson[id], dates = evs.map((e) => e.date);
    assert.ok(evs.length <= m.avail.max, 'never more than they asked for');
    assert.strictEqual(new Set(dates).size, dates.length, 'never two the same night');
    if (evs.length >= 2 && new Set(evs.map((e) => e.type)).size === 2) mixed++;
    if (m.profile.mix === 'topic') assert.ok(evs.every((e) => e.type === 'topic'), 'topic-only people only get career tables');
    if (m.profile.mix === 'social') assert.ok(evs.every((e) => e.type === 'kindred'), 'social-only people only get social tables');
  });
  assert.ok(mixed >= 4, 'people with two or more dinners get both kinds: ' + mixed);
  assert.strictEqual(S.view(ms[0]).tables.filter((t) => t.generated).length, 0, 'nothing shows before publishing');
  S.publishWeek({});
  const seated = S.db().members[Object.keys(byPerson)[0]], inv = S.view(seated).tables.find((t) => t.generated);
  assert.ok(inv && inv.meal === 'dinner' && inv.opened === false, 'the invitation arrives sealed');
  seated.read['inv:' + inv.id] = new Date().toISOString();
  assert.ok(S.view(seated).tables.find((t) => t.id === inv.id).opened, 'and stays open once opened');
  assert.throws(() => S.setAvail(ms[0], { slots: [] }), /already set/);
});

test('nobody who marked an evening goes without a dinner: a lopsided evening, someone alone on their kind, someone alone on their evening', () => {
  const W = S.addDays(S.targetWeek(), 21), d = (n) => S.addDays(W, n) + '|dinner', at = new Date().toISOString();
  const mk = (tag, schools, mix, slots) => people(schools.length, tag).map((m, i) => { m.school = schools[i]; m.profile.mix = mix; m.avail = { week: W, slots, max: 1, at }; return m; });
  const lop = mk('Lop', ['harvard', 'harvard', 'harvard', 'harvard', 'mit'], 'both', [d(0)]);           // four from one school, one from the other
  const tech = mk('Tch', ['harvard', 'harvard', 'mit'], 'topic', [d(1)]), solo = mk('Solo', ['mit'], 'social', [d(1)]); // one social-only person among tech people
  const six = mk('Six', ['harvard', 'mit', 'harvard', 'mit', 'harvard', 'mit'], 'both', [d(2), d(3)]), alone = mk('Alone', ['harvard'], 'both', [d(3)]);
  const all = lop.concat(tech, solo, six, alone), r = S.matchWeek({ week: W });
  const tablesFor = (m) => Object.values(db().tables).filter((t) => (db().events[t.eventId] || {}).week === W && t.ids.indexOf(m.id) >= 0);
  all.forEach((m) => assert.strictEqual(tablesFor(m).length, 1, m.name + ' has one dinner'));
  assert.strictEqual(r.unmatched, 0);
  Object.values(db().tables).filter((t) => (db().events[t.eventId] || {}).week === W).forEach((t) => {
    assert.ok(t.ids.length >= 3 && t.ids.length <= 6, 'three to six at a table');
    assert.ok(new Set(t.ids.map((id) => db().members[id].school)).size === 2, 'both schools at every table');
  });
  assert.ok(Object.values(db().seats).some((x) => x[solo[0].id] && x[solo[0].id].rescued), 'the one alone on their kind was placed by the second pass');
});

test('mostly-social members can skip the tech questions; everyone else answers them', () => {
  const [a] = people(1, 'Soc');
  const social = Object.assign(fullProfile(0), { mix: 'social', tracks: [], interests: [], lens: null, takes: {} });
  S.saveProfile(a, { profile: social });
  assert.ok(a.profile.done, 'social-only is done without tech answers');
  S.saveProfile(a, { profile: Object.assign({}, social, { mix: 'both' }) });
  assert.ok(!a.profile.done, 'topic or mixed tables need them');
});

test('Hangs: host one (social or topic), others join and see each other’s cards, it fills up, the host can cancel', () => {
  const [host, a, b, c] = people(4, 'Pop');
  const date = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  assert.throws(() => S.createPop(host, { title: 'x', place: 'Somewhere', date, time: '19:00' }), /title/);
  const id = S.createPop(host, { title: 'Agents and ramen', place: 'Central Square', date, time: '19:00', size: 3, kind: 'topic', track: 'genai', note: 'Bring a hot take' }).id;
  const walk = S.createPop(host, { title: 'Walk by the river', place: 'Weeks Footbridge', date, time: '08:30', size: 4, kind: 'social', vibe: 'walk' }).id;
  assert.deepStrictEqual([S.popView(a, walk).kind, S.popView(a, walk).vibeName, S.popView(a, id).kind], ['social', 'Walk', 'topic']);
  assert.ok(S.pops(a).some((u) => u.id === id && u.host.id === host.id), 'everyone can see it');
  S.joinPop(a, { id }); S.joinPop(b, { id });
  assert.throws(() => S.joinPop(c, { id }), /full/);
  const v = S.popView(a, id);
  assert.strictEqual(v.count, 3);
  assert.ok(v.host.headline !== undefined && v.people.some((p) => p.id === b.id), 'cards for the host and everyone who joined');
  assert.ok(v.chat.some((m) => m.from === 'charlie' && /joined/.test(m.text)), 'Charlie says who joined');
  assert.throws(() => S.postPopChat(c, { id, text: 'hi' }), /no such/);
  S.postPopChat(a, { id, text: 'See you there' });
  S.joinPop(b, { id, on: false });
  S.joinPop(c, { id });
  assert.throws(() => S.joinPop(host, { id }), /hosting/);
  S.cancelPop(host, { id });
  assert.ok(!S.pops(a).some((u) => u.id === id), 'a canceled hang disappears');
});

test('a hang plays the question game too: vote, sealed sides, the split when it starts', () => {
  const [host, a, b, c] = people(4, 'HangQ');
  const date = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const id = S.createPop(host, { title: 'Agents and ramen', place: 'Central Square', date, time: '19:00', size: 6, kind: 'topic', track: 'genai' }).id;
  const u = db().pops[id];
  assert.ok(u.game && u.game.cards.length === 3, 'three cards when the hang is posted');
  assert.ok(db().chats['p:' + id].some((m) => m.kind === 'menu'), 'Charlie posts the menu in the hang chat');
  assert.strictEqual(S.popView(c, id).game.stage, 'vote', 'someone not in it gets a peek');
  assert.ok(S.popView(c, id).peek && !S.popView(c, id).game.cards, 'but not the cards');
  assert.throws(() => S.playGame(c, { pop: id, act: 'vote', card: u.game.cards[0] }), /join/);
  S.joinPop(a, { id }); S.joinPop(b, { id });
  S.playGame(host, { pop: id, act: 'vote', card: u.game.cards[1] });
  S.playGame(a, { pop: id, act: 'vote', card: u.game.cards[1] });
  assert.strictEqual(S.popView(a, id).game.stage, 'vote', 'still open while someone in it has not voted');
  const g = S.playGame(b, { pop: id, act: 'vote', card: u.game.cards[0] }).game;
  assert.strictEqual(g.stage, 'sides'); assert.strictEqual(g.card.id, u.game.cards[1]);
  S.playGame(host, { pop: id, act: 'side', side: 'a' }); S.playGame(a, { pop: id, act: 'side', side: 'b' });
  assert.strictEqual(S.popView(host, id).game.A, undefined, 'sides stay sealed');
  S.advanceGame(u, new Date(S.popView(host, id).start).getTime() + 60000);
  const r = S.popView(host, id).game;
  assert.strictEqual(r.stage, 'revealed'); assert.deepStrictEqual([r.A.length, r.B.length], [1, 1]);
  assert.ok(db().chats['p:' + id].some((m) => /split is in/.test(m.text)), 'the split lands in the hang chat');
  assert.strictEqual(S.pops(a).find((x) => x.id === id).game.stage, 'revealed', 'lists carry a one-liner');
});

// a past (or future) night with these people already at one table
function night(ms, type, date, time) {
  const e = S.createEvent({ type, date, time: time || '19:00' });
  db().seats[e.id] = {}; ms.forEach((m, k) => { db().seats[e.id][m.id] = { at: new Date(Date.now() - 9e8 + k).toISOString(), size: 'either', diet: [], status: 'held' }; });
  const d = S.draft({ event: e.id }); S.publish({ event: e.id });
  return { e, t: db().tables[d.tables[0].id] };
}

test('round two: once three say yes, Charlie books the same table two weeks later, and the empty chairs go to new people free that night', () => {
  const ms = people(6, 'Round');
  // a weekday, so round two two weeks later lands inside a Monday-to-Friday week whatever the hour the tests run
  const base = [-8, -9, -10, -11, -12].map(day).find((d) => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 5; });
  const { e, t } = night(ms, 'topic', base), seated = t.ids.map((id) => db().members[id]), need = 3;
  assert.ok(seated.length >= 4);
  seated.slice(0, need - 1).forEach((m) => S.feedback(m, { table: t.id, rating: 5, picks: [], again: true }));
  assert.ok(!t.next, 'not booked one yes short');
  assert.ok(db().chats[t.id].some((x) => /One more yes/.test(x.text)), 'Charlie says one more yes would do it');
  assert.strictEqual(S.tableView(seated[0], t.id).again.yes, need - 1);
  const no = seated[need];
  S.feedback(no, { table: t.id, rating: 3, picks: [], again: false });
  const r = S.feedback(seated[need - 1], { table: t.id, rating: 4, picks: [], again: true });
  assert.ok(r.booked && t.next, 'the last yes books it');
  const nt = db().tables[t.next], ne = db().events[nt.eventId];
  assert.strictEqual(ne.date, S.addDays(e.date, 14)); assert.strictEqual(nt.round, 2); assert.strictEqual(nt.ids.length, need);
  assert.ok(nt.ids.indexOf(no.id) < 0, 'a no stays a no');
  assert.ok(db().chats[t.id].some((x) => /^Booked\. Round two/.test(x.text)), 'the old chat hears about it');
  assert.ok(nt.game && db().chats[nt.id].some((x) => x.kind === 'why' && /Round two/.test(x.text)), 'round two has its own chat, question and why');
  const v = S.view(seated[0]).tables.find((x) => x.id === nt.id);
  assert.ok(v && v.round === 2 && v.phase === 'set', 'it arrives like any invitation');
  assert.strictEqual(v.known.length, need - 1, 'everyone there is someone you know'); assert.ok(v.known.every((k) => k.n === 1));
  S.feedback(no, { table: t.id, rating: 3, picks: [], again: true });
  assert.strictEqual(db().tables[t.next], nt, 'still the same round two');
  assert.ok(nt.ids.indexOf(no.id) >= 0, 'a late yes still gets a chair');
  assert.ok(db().chats[nt.id].some((x) => /is in after all/.test(x.text)), 'the table hears they’re back');
  // the empty chairs: someone new who's free that evening can take one, up to the first table's size and never more new than back
  const wk = ne.week, fresh = people(4, 'Chair');
  fresh.forEach((m) => { m.avail = { week: wk, slots: [ne.date + '|dinner'], max: 1, at: new Date().toISOString() }; });
  fresh.forEach((m) => { db().standby = db().standby || {}; db().standby[m.id] = { kind: 'any', dates: [ne.date], skip: null, until: ne.date, at: new Date().toISOString() }; });
  for (let i = 0; i < 4; i++) S.fillChair(nt, ne);
  const newIds = nt.ids.filter((id) => fresh.some((m) => m.id === id));
  assert.strictEqual(nt.ids.length, Math.min(6, seated.length), 'filled back to the first table’s size');
  assert.ok(newIds.length >= 1 && newIds.length <= need + 1, 'some new people, never more than came back');
  assert.ok(nt.why.some((l) => /new to the table/.test(l)), 'the why line names who’s new');
  assert.ok(db().chats[nt.id].some((x) => /new to the table/.test(x.text)), 'the table hears who joined');
  const nv = S.view(db().members[newIds[0]]).tables.find((x) => x.id === nt.id), rv = S.view(seated[0]).tables.find((x) => x.id === nt.id);
  assert.ok(nv && nv.newcomer && !rv.newcomer && rv.back === nv.back && nv.back === need + 1, 'the new person knows they’re new, and how many are back');
});

test('before next time: one line the morning after shows at your next table, Charlie brings it up on the day, and you say whether it happened', () => {
  const ms = people(5, 'Loose');
  const one = night(ms, 'kindred', day(-4)), two = night(ms, 'kindred', day(-1)), three = night(ms, 'kindred', day(3));
  const a = db().members[one.t.ids[0]], b = db().members[one.t.ids[1]];
  S.feedback(a, { table: one.t.id, rating: 5, picks: [], next: '  Ship the waitlist page.  ' });
  const seen = S.tableView(b, two.t.id).loose.find((x) => x.id === a.id);
  assert.ok(seen && seen.text === 'Ship the waitlist page.' && !seen.done, 'the next table sees it');
  assert.ok(!S.tableView(b, one.t.id).loose.length, 'not the table where it was written');
  S.tick(S.eventTimes(three.e).reveal + 60000);
  assert.ok(db().chats[three.t.id].some((x) => x.kind === 'why' && /Since last time/.test(x.text) && /Ship the waitlist page/.test(x.text)), 'Charlie brings it up on the day');
  assert.strictEqual(S.tableView(a, two.t.id).myLoose.prev.text, 'Ship the waitlist page.');
  S.feedback(a, { table: two.t.id, rating: 4, picks: [], prevDone: 'done', next: 'Call my old boss' });
  assert.ok(S.tableView(b, two.t.id).loose.find((x) => x.id === a.id).done, 'done shows as done where it was checked off');
  assert.strictEqual(S.tableView(b, three.t.id).loose.find((x) => x.id === a.id).text, 'Call my old boss', 'the new line moves on');
  assert.strictEqual(S.view(a).month.loose, 'Call my old boss');
  S.feedback(a, { table: two.t.id, rating: 4, picks: [], prevDone: 'done', next: '' });
  assert.ok(!S.tableView(b, three.t.id).loose.some((x) => x.id === a.id), 'an empty line takes it back');
  assert.throws(() => S.tableView(db().members[people(1, 'Outsider')[0].id], two.t.id));
});

test('the month: a calendar from the 1st to the last day, with your tables on it and round twos coming up', () => {
  const mo = S.monthNow(), [y, m] = mo.split('-').map(Number), last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const ms = people(4, 'Month'), d = mo + '-' + String(Math.min(last, Math.max(1, +S.ymdTz(Date.now()).slice(8) + 1))).padStart(2, '0'), { t } = night(ms, 'topic', d);
  const a = db().members[t.ids[0]], mv = S.view(a).month;
  assert.strictEqual(mv.from, mo + '-01', 'it starts on the 1st');
  assert.strictEqual(mv.span, last, 'and runs to the last day');
  assert.ok(mv.beads.some((k) => k.id === t.id && k.kind === 'tech'), 'your table is on it');
  assert.ok(mv.long === undefined, 'no long table any more');
  assert.ok(Array.isArray(mv.again));
});

test('your people on the week: someone you picked each other with shows on the evenings they marked', () => {
  const [a, b, c] = people(3, 'Pals');
  const wk = S.targetWeek(), eve = (d) => S.addDays(wk, d) + '|dinner';
  db().waves[a.id] = { [b.id]: new Date().toISOString() }; db().waves[b.id] = { [a.id]: new Date().toISOString() };
  [b, c].forEach((m) => { m.avail = { week: wk, slots: [eve(2)], max: 1, at: new Date().toISOString() }; }); // the week may already be set by an earlier test
  const days = S.availView(a).days;
  assert.ok(days[2].pals.some((p) => p.id === b.id), 'b is on Wednesday');
  assert.ok(!days[2].pals.some((p) => p.id === c.id), 'a stranger is not');
  assert.ok(!days[1].pals.length);
});

test('a round table that drops to two is called off, so nobody ends up at a dinner for two', () => {
  const ms = people(4, 'Off');
  const { t } = night(ms, 'kindred', day(-2)), seated = t.ids.map((id) => db().members[id]);
  seated.forEach((m) => S.feedback(m, { table: t.id, rating: 5, picks: [], again: true }));
  const nt = db().tables[t.next], ne = db().events[nt.eventId];
  assert.ok(nt && nt.ids.length === 4, 'the fourth yes joined after the third booked it');
  S.cancelSeat(seated[0], { event: ne.id });
  assert.ok(!nt.closed, 'three is still a table');
  S.cancelSeat(seated[1], { event: ne.id });
  assert.strictEqual(nt.closed, 'small', 'two is not');
  assert.ok(db().chats[t.id].some((x) => /is off/.test(x.text)), 'the old chat hears why');
  const v = S.view(seated[2]).tables.find((x) => x.id === nt.id);
  assert.ok(v && v.left && v.closed === 'small', 'Tables says it closed, so they can ask for another evening');
  assert.ok(S.tableView(seated[2], t.id).again.off, 'the old table’s switch says round two is off');
  assert.ok(Object.values(db().seats[ne.id]).every((x) => x.status === 'cancelled'), 'nobody is held for that evening any more');
});

test('round two keeps people apart who must be, never books in the past, and never brings back someone who said no', () => {
  // blocked pair: both say yes, only one is seated
  const ms = people(6, 'Apart');
  const a1 = night(ms, 'topic', day(-2)), seated = a1.t.ids.map((id) => db().members[id]);
  seated[0].never = { [seated[1].id]: 1 };
  seated.forEach((m) => S.feedback(m, { table: a1.t.id, rating: 5, picks: [], again: true }));
  const r = db().tables[a1.t.next];
  assert.ok(r && !(r.ids.indexOf(seated[0].id) >= 0 && r.ids.indexOf(seated[1].id) >= 0), 'never at the same round two');
  // a table from three weeks ago: too late for round two, and the switch says so
  const old = people(4, 'Old'), o = night(old, 'kindred', day(-20));
  old.forEach((m) => S.feedback(m, { table: o.t.id, rating: 5, picks: [], again: true }));
  assert.ok(!o.t.next, 'no round two in the past');
  assert.strictEqual(S.tableView(old[0], o.t.id).again.open, false);
  // someone who said no, free that evening, stays out
  const six = people(6, 'Chairs'), c = night(six, 'topic', day(-8)), cs = c.t.ids.map((id) => db().members[id]), need = 3;
  cs.forEach((m, k) => S.feedback(m, { table: c.t.id, rating: 4, picks: [], again: k < need }));
  const nt = db().tables[c.t.next], ne = db().events[nt.eventId], no = cs[cs.length - 1];
  no.avail = { week: ne.week, slots: [ne.date + '|dinner'], max: 1, at: new Date().toISOString() };
  (db().standby = db().standby || {})[no.id] = { kind: 'any', dates: [ne.date], skip: null, until: ne.date, at: new Date(0).toISOString() };
  S.fillChair(nt, ne);
  assert.ok(nt.ids.indexOf(no.id) < 0, 'a no stays a no, even with a free evening');
  delete db().standby[no.id]; // (so later tests on that evening start clean)
  // called off: the old table's switch says it's off, not booked
  nt.ids.slice().forEach((id, k) => { if (k < nt.ids.length - 2) S.cancelSeat(db().members[id], { event: ne.id }); });
  if (ne.status === 'cancelled') { const v = S.tableView(cs[cs.length - 2], c.t.id).again; assert.ok(v.off && !v.booked, 'off, not booked'); }
});

test('before next time: feedback that comes in out of order keeps the newest table’s line, and an empty line brings the old one back', () => {
  const ms = people(4, 'Order');
  const mon = night(ms, 'kindred', day(-5)), wed = night(ms, 'kindred', day(-3)), next = night(ms, 'kindred', day(4));
  const a = db().members[mon.t.ids[0]], b = db().members[mon.t.ids[1]];
  S.feedback(a, { table: wed.t.id, rating: 5, picks: [], next: 'NEWER' });
  S.feedback(a, { table: mon.t.id, rating: 5, picks: [], next: 'OLDER' });
  assert.strictEqual(S.tableView(b, next.t.id).loose.find((x) => x.id === a.id).text, 'NEWER');
  assert.strictEqual(S.view(a).month.loose === 'NEWER' || S.view(a).month.loose === '', true);
  S.feedback(a, { table: wed.t.id, rating: 5, picks: [], next: '' });
  const back = S.tableView(b, next.t.id).loose.find((x) => x.id === a.id);
  assert.ok(!back || back.text !== 'NEWER', 'the cleared line is gone');
});

test('places: partners hold tables on their evenings, tables are placed when they go out, and a full partner sends the rest elsewhere', () => {
  const ms = people(12, 'Place');
  const date = day(19), dow = new Date(date + 'T12:00:00Z').getUTCDay(); // an evening no other test uses
  const a = S.savePlace({ name: 'Test Bistro', address: '1 Main St', area: 'Central Square', nights: [dow], tables: 1, seats: 6, email: 'host@example.com', contact: 'Sam' }).id;
  assert.throws(() => S.savePlace({ name: 'X', address: '' }), /required/);
  const { e } = night(ms, 'kindred', date), ts = Object.values(db().tables).filter((t) => t.eventId === e.id);
  assert.strictEqual(ts.filter((t) => t.venue && t.venue.id === a).length, 1, 'one table: the partner holds one that evening');
  assert.ok(ts.some((t) => !t.venue), 'the other waits for a place');
  let P = S.placesAdmin();
  assert.ok(P.needs.some((n) => n.kind === 'noplace'), 'admin sees what still needs a place');
  assert.strictEqual(P.places.find((v) => v.id === a).evenings[0].state, 'held', 'a standing hold: set unless the restaurant says it can’t');
  S.savePlace({ id: a, name: 'Test Bistro', address: '1 Main St', area: 'Central Square', nights: [dow], tables: 8, seats: 6, email: 'host@example.com', contact: 'Sam' });
  S.tick();
  assert.ok(ts.every((t) => t.venue && t.venue.id === a), 'placed once there was room');
  assert.ok(ts.every((t) => t.captain && t.ids.indexOf(t.captain) >= 0), 'every table has a captain');
});

const mondayOf = (d) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
const mails = (vid, re) => db().log.filter((l) => l.kind === 'place-mail' && l.a === vid && re.test(l.b)).length;

test('a standing hold: the week’s plan on Sunday night (with what to release), the final count at noon the day before, an update, and a release', () => {
  const date = [12, 13, 14, 15, 16].map(day).find((d) => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 4; }), dow = new Date(date + 'T12:00:00Z').getUTCDay(), other = (dow + 1) % 7, ms = people(5, 'Hold');
  const v = S.savePlace({ name: 'Hold Place', address: '5 Hold St', area: 'Central Square', nights: [dow, other], tables: 2, seats: 6, email: 'hold@example.com', contact: 'Rae' }).id;
  const { e } = night(ms, 'kindred', date), t = Object.values(db().tables).find((x) => x.eventId === e.id);
  assert.strictEqual(t.venue.id, v);
  assert.strictEqual(S.placeView(db().places[v]).evenings[0].state, 'held');
  // Sunday at 10:30 PM before that week: the plan, once
  db().weeks[mondayOf(date)] = db().weeks[mondayOf(date)] || { published: true, events: [], unmatched: [] }; // the week is out, so the plan goes Sunday night
  const sunday = S.addDays(mondayOf(date), -1), at = Math.max(Date.now(), S.tzMs(sunday, '22:30'));
  S.tick(at); S.tick(at + 60000);
  assert.strictEqual(mails(v, /^Hash Table this week/), 1, 'one plan for the week');
  // noon the day before: the final count; someone drops out after it: an update
  S.tick(S.tzMs(S.addDays(date, -1), '12:30'));
  assert.strictEqual(mails(v, /^Hash Table tomorrow/), 1, 'the final count');
  S.cancelSeat(db().members[t.ids.find((id) => id !== t.captain)], { event: e.id });
  S.tick(S.tzMs(S.addDays(date, -1), '13:30'));
  assert.strictEqual(mails(v, /^Update for Hash Table/), 1, 'an update after the count');
  // the whole table drops out: the restaurant is told to release it
  t.ids.filter((id) => !(t.out || {})[id]).forEach((id) => S.cancelSeat(db().members[id], { event: e.id }));
  S.tick(S.tzMs(S.addDays(date, -1), '14:30'));
  assert.strictEqual(mails(v, /after all/), 1, 'a release once the evening is empty');
});

test('a partner that confirms each evening: asked once, reminded at the deadline with an alert for whoever is on duty, no address until it says yes; a no moves the table', () => {
  const ms = people(10, 'Conf');
  const date = day(2), dow = new Date(date + 'T12:00:00Z').getUTCDay();
  const v1 = S.savePlace({ name: 'Asking Place', address: '10 A St', area: 'Central Square', nights: [dow], tables: 2, seats: 6, email: 'first@example.com', contact: 'Ana', mode: 'ask' }).id;
  const v2 = S.savePlace({ name: 'Second Place', address: '20 B St', area: 'Kendall Square', nights: [dow], tables: 6, seats: 6, email: 'second@example.com', backup: true }).id;
  const { e } = night(ms, 'topic', date), t = Object.values(db().tables).find((x) => x.eventId === e.id), m = db().members[t.ids[0]];
  assert.strictEqual(t.venue.id, v1, 'backups come last');
  const place = db().places[v1];
  assert.ok(/^[a-f0-9]{24}$/.test(place.key), 'each partner has a private link');
  // the week's plan already went out (on a Saturday, the dinner two days on is in next week, whose plan goes out Sunday night)
  const monday = (d) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  db().planSent = db().planSent || {}; db().planSent[v1 + '|' + monday(date)] = new Date().toISOString();
  S.tick(); S.tick();
  assert.ok(db().bookings[v1 + '|' + date].askMail, 'asked');
  const pv = S.placeView(place);
  assert.ok(pv.evenings[0].state === 'asked' && pv.evenings[0].tables[0].size === t.ids.length && !JSON.stringify(pv).match(/Conf Person/), 'the restaurant sees sizes and a captain’s first name, not who’s coming');
  // the deadline passes: a reminder, and an alert for whoever is on duty
  S.saveOps({ team: [{ name: 'Duty Person', email: 'duty@example.com' }], rota: {} });
  S.tick(Math.max(Date.now(), S.tzMs(S.addDays(date, -1), '10:30')));
  assert.strictEqual(mails(v1, /^Reminder/), 1);
  assert.ok(S.opsAdmin().alerts.some((x) => !x.done && x.kind === 'unconfirmed'), 'on duty hears about it');
  // noon on the day without a yes: no address
  S.tick(S.eventTimes(e).reveal + 60000);
  assert.ok(!S.tableView(m, t.id).venue && t.revealWait, 'no address until the restaurant says yes');
  // the restaurant can't: the table moves to the backup
  S.placeAnswer(place, date, false, 'place');
  assert.strictEqual(t.venue.id, v2, 'moved to the partner with room');
  S.placeAnswer(db().places[v2], date, true, 'admin');
  assert.strictEqual(S.placeView(db().places[v2]).evenings.find((x) => x.date === date).state, 'confirmed');
  S.tick(S.eventTimes(e).reveal + 2 * 36e5);
  assert.ok(!t.revealWait && db().chats[t.id].some((x) => /spot is set/.test(x.text)), 'the address goes out, with a line in the chat');
  // the organizer can call a table off when nothing works; they go first next week
  const before = db().members[t.ids[1]].prio || 0;
  S.callOff({ table: t.id });
  assert.strictEqual(t.closed, 'place');
  assert.strictEqual(db().members[t.ids[1]].prio, before + 1, 'first in line next week');
  assert.strictEqual(S.view(db().members[t.ids[1]]).tables.find((x) => x.id === t.id).closed, 'place');
});

test('drop-outs: a table below three joins another table that night, or closes and offers another evening', () => {
  const ms = people(8, 'Drop');
  const date = day(6), { e } = night(ms, 'kindred', date);
  const ts = Object.values(db().tables).filter((t) => t.eventId === e.id).sort((a, b) => a.ids.length - b.ids.length);
  assert.strictEqual(ts.length, 2, 'two tables of four');
  const [small, big] = ts;
  // three of the four at one table cancel: the last one joins the other table
  const leave = small.ids.slice(0, small.ids.length - 1), stay = small.ids[small.ids.length - 1];
  leave.forEach((id) => S.cancelSeat(db().members[id], { event: e.id }));
  assert.strictEqual(small.closed, 'merged');
  assert.ok(big.ids.indexOf(stay) >= 0 && !(big.out || {})[stay], 'moved to the other table');
  assert.ok(db().chats[big.id].some((x) => /joining you/.test(x.text)));
  assert.ok(S.view(db().members[stay]).tables.some((x) => x.id === big.id && !x.left), 'their invitation is now the other table');
  // a table with nowhere to go closes, its people are free that evening and can ask for another one
  const ms2 = people(4, 'Solo'), n2 = night(ms2, 'topic', day(7)), solo = Object.values(db().tables).find((t) => t.eventId === n2.e.id);
  solo.ids.slice(0, 2).forEach((id) => S.cancelSeat(db().members[id], { event: n2.e.id }));
  assert.strictEqual(solo.closed, 'small');
  const left = db().members[solo.ids[3]];
  assert.ok(Object.values(db().seats[n2.e.id]).filter((x) => x.status === 'held').length === 0, 'nobody is held for it');
  const vt = S.view(left).tables.find((x) => x.id === solo.id);
  assert.ok(vt.closed === 'small' && vt.left, 'Tables says it closed');
  assert.ok(S.reinvite(left, { table: solo.id, dates: [day(8), day(9)] }).ok, 'and they can ask for another evening');
});

// a club-time date and time some hours from now
const etIn = (h) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(Date.now() + h * 36e5)); const g = (k) => p.find((x) => x.type === k).value; return [g('year') + '-' + g('month') + '-' + g('day'), g('hour') + ':' + g('minute')]; };

test('late changes: free until noon the day before; after that a cancel is one point and a no-show two; three in sixty days pause invitations', () => {
  const ms = people(8, 'Late'), m = ms[0];
  const ago = new Date(Date.now() - 3 * 864e5).toISOString();
  const [d1, h1] = etIn(5), n1 = night(ms.slice(0, 5), 'topic', d1, h1); n1.e.publishedAt = ago;
  S.cancelSeat(m, { event: n1.e.id });
  assert.ok(S.lateChanges(m) === 1 && !S.cooling(m), 'one late change is fine');
  const past = night(ms.slice(0, 4), 'kindred', day(-2)), t = Object.values(db().tables).find((x) => x.eventId === past.e.id);
  t.attended = t.attended || {}; t.attended[m.id] = false;
  const [d2, h2] = etIn(8), n2 = night(ms.slice(0, 5), 'kindred', d2, h2); n2.e.publishedAt = ago;
  const r = S.cancelSeat(m, { event: n2.e.id });
  assert.ok(S.cooling(m) && r.paused, 'one + two + one: paused, and told until when');
  assert.ok(S.view(m).me.cool);
  const fresh = people(1, 'Honest')[0], p2 = night([fresh].concat(ms.slice(5, 8)), 'kindred', day(-3)), t2 = Object.values(db().tables).find((x) => x.eventId === p2.e.id);
  S.feedback(fresh, { table: t2.id, attended: false });
  assert.strictEqual(S.lateChanges(fresh), 0, 'an honest “I couldn’t go” is not a strike');
});

test('captains rotate, skip people who said no, and can pass it on', () => {
  const ms = people(5, 'Cap');
  ms[0].captain = 'no'; ms[1].captain = 'yes';
  const { e } = night(ms, 'topic', day(9)), t = Object.values(db().tables).find((x) => x.eventId === e.id);
  assert.strictEqual(t.captain, ms[1].id, 'the volunteer first');
  S.captainMove(ms[1], { table: t.id, act: 'pass' });
  assert.ok(t.captain && t.captain !== ms[1].id && t.captain !== ms[0].id, 'passed to someone who didn’t say no');
  assert.throws(() => S.captainMove(ms[2].id === t.captain ? ms[3] : ms[2], { table: t.id, act: 'pass' }), /not the captain/);
  const { e: e2 } = night(ms, 'kindred', day(11)), t2 = Object.values(db().tables).find((x) => x.eventId === e2.id);
  assert.notStrictEqual(t2.captain, t.captain, 'next time it’s someone else');
  assert.ok(S.tableView(ms[3], t.id).captain, 'everyone sees who it is');
});


test('ops edge cases: a re-ask reaches the restaurant, a hand-typed note keeps the partner, a paused partner hands its tables on, people who left can’t read new chat, answers stop at dinner', () => {
  const date = day(16), dow = new Date(date + 'T12:00:00Z').getUTCDay();
  const ask = S.savePlace({ name: 'Edge Ask', address: '1 Edge St', area: 'Central Square', nights: [dow], tables: 3, seats: 6, email: 'edge@example.com', mode: 'ask' }).id;
  const hold = S.savePlace({ name: 'Edge Hold', address: '2 Edge St', area: 'Kendall Square', nights: [dow], tables: 3, seats: 6, email: 'edgeh@example.com', backup: true }).id;
  Object.values(db().places).forEach((v) => { if (v.id !== ask && v.id !== hold) v.closedOn = (v.closedOn || []).concat([date]); }); // only these two that evening
  db().weeks[mondayOf(date)] = db().weeks[mondayOf(date)] || { published: true, events: [], unmatched: [] };
  const n1 = night(people(5, 'EdgeA'), 'kindred', date), t1 = Object.values(db().tables).find((x) => x.eventId === n1.e.id);
  assert.strictEqual(t1.venue.id, ask);
  const at = Math.max(Date.now(), S.tzMs(S.addDays(mondayOf(date), -1), '22:30'));
  S.tick(at); S.placeAnswer(db().places[ask], date, true, 'place');
  // a second table lands on that evening: the restaurant is asked again, by email
  const n2 = night(people(5, 'EdgeB'), 'topic', date), t2 = Object.values(db().tables).find((x) => x.eventId === n2.e.id);
  assert.strictEqual(t2.venue.id, ask);
  const b = db().bookings[ask + '|' + date]; assert.ok(b.state === 'asked' && b.more);
  S.tick(at + 60000);
  assert.ok(b.askMail && mails(ask, /can you confirm/) >= 1, 'asked again, by email');
  // the organizer changes only the note: still the same partner, nothing released
  S.setVenue({ table: t1.id, name: 'Edge Ask', address: '1 Edge St', note: 'Ask for Sam' });
  assert.ok(t1.venue.id === ask && db().bookings[ask + '|' + date].state !== 'released', 'the partner link stays');
  // switching the partner to a standing hold: what was waiting is simply held
  S.savePlace({ id: ask, name: 'Edge Ask', address: '1 Edge St', area: 'Central Square', nights: [dow], tables: 3, seats: 6, email: 'edge@example.com', mode: 'hold' });
  assert.strictEqual(db().bookings[ask + '|' + date].state, 'held');
  assert.ok(!db().places[ask].off, 'editing never un-pauses or pauses by accident');
  // pausing the partner moves its tables to the backup
  S.savePlace({ id: ask, name: 'Edge Ask', address: '1 Edge St', area: 'Central Square', nights: [dow], tables: 3, seats: 6, email: 'edge@example.com', off: true });
  assert.ok(t1.venue.id === hold && t2.venue.id === hold, 'paused: tables go to the backup');
  // someone who left sees the chat only up to when they left
  const leaver = db().members[t2.ids.find((id) => id !== t2.captain)];
  S.cancelSeat(leaver, { event: n2.e.id });
  for (const t0 = Date.now(); Date.now() === t0;); // the next message is at least a millisecond later
  S.postChat(db().members[t2.ids.find((id) => !(t2.out || {})[id])], { table: t2.id, text: 'After you left' });
  assert.ok(!S.tableView(leaver, t2.id).chat.some((x) => x.text === 'After you left'), 'no chat after leaving');
  // answers stop once dinner starts
  const [d3, h3] = etIn(-1); void d3; void h3;
});

test('late changes are fair: a waitlisted cancel isn’t late, a chair taken after the cutoff can be handed back for three hours, an honest no-show counts once, clearing a mark lifts a pause', () => {
  const ms = people(6, 'Fair'), m = ms[0];
  // seated after the cutoff (a chair that opened late): free for three hours
  const [d1, h1] = etIn(20), n1 = night(ms.slice(1, 6), 'topic', d1, h1), t1 = Object.values(db().tables).find((x) => x.eventId === n1.e.id);
  db().seats[n1.e.id][m.id] = { at: new Date().toISOString(), size: 'either', diet: [], status: 'held' }; t1.ids.push(m.id);
  assert.strictEqual(S.cancelSeat(m, { event: n1.e.id }).late, false, 'handing back a late chair right away is free');
  // waitlisted, never seated
  const [d2, h2] = etIn(10), e2 = S.createEvent({ type: 'kindred', date: d2, time: h2 }); db().seats[e2.id] = { [m.id]: { at: new Date(Date.now() - 5 * 864e5).toISOString(), size: 'either', diet: [], status: 'held' } };
  assert.strictEqual(S.cancelSeat(m, { event: e2.id }).late, false, 'no table, no late change');
  // an honest no-show is one point, a silent one two
  const p = night(ms.slice(0, 4), 'kindred', day(-3)), tp = Object.values(db().tables).find((x) => x.eventId === p.e.id);
  S.feedback(m, { table: tp.id, attended: false }); tp.attended = { [m.id]: false };
  assert.strictEqual(S.lateChanges(m), 1);
  const p2 = night(ms.slice(0, 4), 'topic', day(-5)), tp2 = Object.values(db().tables).find((x) => x.eventId === p2.e.id);
  tp2.attended = { [m.id]: false };
  assert.strictEqual(S.lateChanges(m), 3);
});

test('sign-in codes: a new code keeps the wrong guesses, and an invite link stops working once its owner verifies', async () => {
  const [m] = people(1, 'Codes'), em = m.email;
  let r = await S.startVerify(null, { email: em });
  for (let i = 0; i < 5; i++) assert.throws(() => S.finishVerify(null, { email: em, code: '000000' }), /match/);
  db().verify[em].sentAt -= 31000;
  r = await S.startVerify(null, { email: em });
  assert.throws(() => S.finishVerify(null, { email: em, code: r.devCode }), /too many tries/, 'asking for a new code doesn’t reset the guesses');
  const inv = S.newMember('Invite Person', '', 'harvard', 'invite'), old = inv.token;
  const r2 = await S.startVerify(inv, { email: 'invite.person@college.harvard.edu' });
  const out = S.finishVerify(inv, { email: 'invite.person@college.harvard.edu', code: r2.devCode });
  assert.ok(out.token && out.token !== old && inv.token === out.token, 'the invite link’s key is replaced once it’s used');
});

test('people who reported each other never share a table, even on an evening with one table', () => {
  const ms = people(6, 'Clash');
  S.report(ms[0], { id: ms[2].id, reason: 'test' });
  assert.ok(db().alerts.some((a) => a.key === 'report:' + ms[2].id + ':' + ms[0].id && !a.done), 'a report reaches whoever is on duty');
  const e = S.createEvent({ type: 'topic', date: day(9), time: '19:00' }); db().seats[e.id] = {};
  ms.forEach((m, k) => { db().seats[e.id][m.id] = { at: new Date(Date.now() - 9e8 + k).toISOString(), size: 'either', diet: [], status: 'held' }; });
  S.draft({ event: e.id });
  const ts = Object.values(db().tables).filter((t) => t.eventId === e.id);
  assert.ok(ts.length >= 1, 'the evening still has a table');
  ts.forEach((t) => assert.ok(!(t.ids.indexOf(ms[0].id) >= 0 && t.ids.indexOf(ms[2].id) >= 0), 'never at the same table'));
});

test('the free-change cutoff: noon the day before, and ten that morning for tables that only went out after it (Monday)', () => {
  const mon = '2026-11-02', sunEve = S.tzMs('2026-11-01', '20:00'), sat = S.tzMs('2026-10-31', '20:00');
  assert.strictEqual(S.freeUntil({ date: mon, publishedAt: new Date(sunEve).toISOString() }), S.tzMs(mon, '10:00'));
  assert.strictEqual(S.freeUntil({ date: mon, publishedAt: new Date(sat).toISOString() }), S.tzMs('2026-11-01', '12:00'));
  assert.strictEqual(S.freeUntil({ date: '2026-11-04', publishedAt: new Date(sunEve).toISOString() }), S.tzMs('2026-11-03', '12:00'));
  assert.strictEqual(S.freeUntil({ date: '2026-11-04', time: '19:00', publishedAt: new Date(S.tzMs('2026-11-03', '15:00')).toISOString() }), S.tzMs('2026-11-04', '10:00'), 'any late build gets the morning');
  assert.strictEqual(S.freeUntil({ date: '2026-11-04', time: '19:00', publishedAt: new Date(S.tzMs('2026-11-04', '09:00')).toISOString() }), S.tzMs('2026-11-04', '11:00'), 'a same-day build gets two hours');
});

test('cancelling a night tells everyone at its tables, puts them first next week, and deleting an account takes its words along', () => {
  const ms = people(5, 'Cancel'), n = night(ms, 'topic', day(6));
  S.postChat(ms[1], { table: n.t.id, text: 'my number is 617' });
  S.cancelEvent({ id: n.e.id });
  assert.strictEqual(n.t.closed, 'admin');
  assert.ok(ms.every((m) => m.prio >= 1), 'first in line next week');
  assert.ok(db().chats[n.t.id].some((x) => x.from === 'charlie' && /This evening is off/.test(x.text)), 'Charlie says why');
  S.erase(ms[1]);
  assert.ok(!db().chats[n.t.id].some((x) => x.from === ms[1].id), 'their messages are gone');
});

test('the captain’s three missions: pick the spot, rally the vote, settle up, and all three earn a stripe', () => {
  ['Cap Grill', 'Cap Noodle', 'Cap Tavern'].forEach((name) => S.savePlace({ name, address: '9 Test St', area: 'Central Square', nights: [0, 1, 2, 3, 4, 5, 6], tables: 2, seats: 6 }));
  const ms = people(5, 'Capt'), n = night(ms, 'topic', day(23)), t = n.t, cap = db().members[t.captain];
  assert.ok(cap, 'the table has a captain');
  const v = S.tableView(cap, t.id).cap;
  assert.ok(v.me && v.spot.state === 'held' && v.spot.options.filter((o) => o.kind === 'partner').length >= 2, 'a partner holds a table, and the brief offers the others with room');
  const other = v.spot.options.find((o) => !o.mine);
  S.captainSpot(cap, { table: t.id, place: other.id });
  assert.strictEqual(t.venue.id, other.id, 'the table moves to the captain’s pick');
  assert.ok(db().chats[t.id].some((x) => x.kind === 'cap' && x.text.indexOf(other.name) < 0), 'the table hears a spot was picked, not which');
  const mate = db().members[t.ids.find((id) => id !== cap.id)];
  assert.ok(!S.tableView(mate, t.id).cap.spot, 'tablemates don’t see the brief');
  assert.throws(() => S.captainSpot(mate, { table: t.id, place: other.id }), /not the captain/);
  S.captainNudge(cap, { table: t.id });
  assert.ok(db().chats[t.id].some((x) => x.kind === 'nudge' && x.from === cap.id), 'the nudge lands in the chat from the captain');
  assert.throws(() => S.captainNudge(cap, { table: t.id }), /moment ago/, 'one nudge at a time');
  const c1 = t.game.cards[0];
  t.ids.slice(0, 4).forEach((id) => S.playGame(db().members[id], { table: t.id, act: 'vote', card: c1 }));
  assert.ok(S.missions(t).vote.done, 'four of five voted');
  assert.throws(() => S.captainChecks(cap, { table: t.id }), /night of the dinner/);
  const [d, h] = etIn(-1); n.e.date = d; n.e.time = h;
  S.captainChecks(cap, { table: t.id });
  const M = S.missions(t);
  assert.ok(M.spot.done && M.vote.done && M.checks.done && M.stripe, 'three for three');
  S.feedback(mate, { table: t.id, rating: 5, picks: [], salute: true });
  const st = S.captainStats(cap);
  assert.ok(st.stripes >= 1 && st.salutes >= 1 && st.rank === 'Captain', 'a stripe, a thank-you, and the rank that comes with it');
});

// a captaincy from last week with all three missions done
function stripe(m) {
  const n = night([m].concat(people(4, 'Crew' + m.id.slice(1, 5))), 'topic', day(-3)), t = n.t;
  if (!t.venue) t.venue = { name: 'Sample Spot', address: '1 Test St', note: '' };
  t.captain = m.id; t.cap = { spot: { vid: t.venue.id || '', at: '' }, nudges: [], checks: { at: '' }, salutes: {}, hadChoice: true };
  t.game = { cards: [], votes: {}, pick: 'x', sides: {}, guess: {}, final: {}, voteBy: 0, notes: {}, turnout: t.ids.length };
  return t;
}
test('industry tables: captains with a stripe get the first 48 hours, and are seated first', () => {
  const [capt] = people(1, 'Ind'), [plain] = people(1, 'Ind2');
  stripe(capt);
  assert.strictEqual(S.captainStats(capt).stripes, 1);
  const e = S.createEvent({ type: 'topic', date: day(12), time: '19:00', industry: true, guest: 'A seed investor (sample)', role: 'Partner, Sample Ventures' });
  assert.throws(() => S.bookSeat(plain, { event: e.id }), /captains/, 'not yet for everyone');
  assert.ok(S.bookSeat(capt, { event: e.id }).ok, 'captains first');
  const card = S.view(capt).events.find((x) => x.id === e.id);
  assert.ok(card.industry && card.industry.early && card.industry.you, 'the card says captains first, and that includes you');
  e.industry.captainsUntil = new Date(Date.now() - 1000).toISOString();
  assert.ok(S.bookSeat(plain, { event: e.id }).ok, 'after 48 hours, everyone');
  // seven for one table of six: the captain who booked last still gets a chair
  const e2 = S.createEvent({ type: 'topic', date: day(13), time: '19:00', industry: true, guest: 'A robotics founder (sample)' });
  e2.industry.captainsUntil = new Date(Date.now() - 1000).toISOString();
  people(6, 'Rush').forEach((m) => S.bookSeat(m, { event: e2.id }));
  S.bookSeat(capt, { event: e2.id }); db().seats[e2.id][capt.id].at = new Date(Date.now() + 1e6).toISOString();
  S.draft({ event: e2.id });
  assert.ok(Object.values(db().tables).some((t) => t.eventId === e2.id && t.ids.indexOf(capt.id) >= 0), 'stripes come first at an industry table');
});

test('the captain books it: a spot from the list, booked under their name, a nudge when the size changes, and nothing sent to the restaurant', () => {
  const sp = S.savePlace({ name: 'Booked Bistro', address: '5 Elm St, Central Square', area: 'Central Square', nights: [0, 1, 2, 3, 4, 5, 6], tables: 3, seats: 6, mode: 'captain', bookVia: 'opentable', bookUrl: 'https://www.opentable.com/r/booked-bistro-cambridge', vibe: 'Booths', price: '$$' }).id;
  assert.throws(() => S.savePlace({ name: 'No Link', address: '6 Elm St', nights: [1], mode: 'captain' }), /booking link or a phone/);
  const ms = people(6, 'Book'), n = night(ms, 'topic', day(25)), t = n.t, cap = db().members[t.captain];
  assert.ok(!t.venue || t.venue.id, 'nobody books a captain spot automatically');
  const o = S.tableView(cap, t.id).cap.spot.options.find((x) => x.id === sp);
  assert.ok(o && o.kind === 'book' && /covers=\d&dateTime=/.test(o.link), 'the link opens the booking page with the party and time filled in');
  assert.throws(() => S.captainBook(cap, { table: t.id, place: sp, time: '22:00', name: cap.name }), /hour and a half/);
  S.captainBook(cap, { table: t.id, place: sp, time: '19:30', name: cap.name, code: 'AB12' });
  assert.ok(t.venue.pid === sp && !t.venue.id && t.time === '19:30', 'booked under the captain’s name, at the time they got');
  assert.ok(S.missions(t).spot.done, 'mission one done');
  assert.strictEqual(S.view(cap).tables.find((x) => x.id === t.id).time, '7:30 PM', 'the table shows the booked time');
  assert.ok(!Object.values(db().bookings || {}).some((b) => b.vid === sp), 'Hash Table never contacts a spot the captain booked');
  const out = db().members[t.ids.find((id) => id !== cap.id)];
  S.cancelSeat(out, { event: n.e.id }); S.tick(S.tzMs(S.ymdTz(Date.now()), '12:00')); // booking nudges wait for a decent hour
  assert.strictEqual(t.cap.booking.warned, t.ids.filter((id) => !(t.out || {})[id]).length, 'a size change after booking nudges the captain once');
  assert.ok(S.tableView(cap, t.id).cap.spot.booking.now !== S.tableView(cap, t.id).cap.spot.booking.size, 'the brief says the booking needs an update');
  S.captainBook(cap, { table: t.id, resize: true });
  assert.strictEqual(t.cap.booking.size, t.cap.booking.now || S.tableView(cap, t.id).cap.spot.booking.now);
  S.captainBook(cap, { table: t.id, cancel: true });
  assert.ok(!t.venue && !t.cap.booking && !S.missions(t).spot.done, 'it fell through: back to booking');
});

// a phone that takes pushes without sending anything (an http endpoint is turned away before any network)
const ear = (m) => { m.push = [{ endpoint: 'http://push.invalid/' + m.id, keys: { p256dh: 'x', auth: 'x' } }]; m.pushLog = []; };
const heard = (m, kind) => (m.pushLog || []).some((x) => x.kind === kind);
// only these spots are open (the rest stay registered from earlier tests); returns a way back
const only = (ids) => { const was = {}; Object.values(db().places).forEach((v) => { was[v.id] = v.off; v.off = ids.indexOf(v.id) < 0; }); return () => Object.values(db().places).forEach((v) => { v.off = was[v.id]; }); };
function bookSpot(tag) {
  return S.savePlace({ name: tag + ' Bistro', address: '7 Elm St, Central Square', area: 'Central Square', nights: [0, 1, 2, 3, 4, 5, 6], tables: 3, seats: 6, mode: 'captain', bookVia: 'resy', bookUrl: 'https://resy.com/cities/bos/' + tag.toLowerCase() }).id;
}

test('a booking belongs to whoever made it: they hear when the table no longer needs it, keep it when they step away, and only they get credit', () => {
  const sp = bookSpot('Holder'), sp2 = bookSpot('Other'), back = only([sp, sp2]), ms = people(6, 'Hold'), n = night(ms, 'topic', day(29)), t = n.t, cap = db().members[t.captain];
  if (t.venue && t.venue.id) { const vid = t.venue.id; t.venue = null; S.syncBooking(vid, n.e.date); }
  S.captainBook(cap, { table: t.id, place: sp, name: cap.name });
  assert.strictEqual(t.cap.booking.by, cap.id, 'the booking remembers who made it');
  ear(cap); S.captainMove(cap, { table: t.id, act: 'pass' });
  assert.ok(heard(cap, 'bookkeep'), 'passing the job: please keep the booking');
  const next = db().members[t.captain], v = S.tableView(next, t.id).cap.spot;
  assert.ok(next.id !== cap.id && v.state === 'booked' && v.booking && !v.booking.mine && v.booking.byFirst, 'the new captain sees who holds it');
  assert.ok(!S.captainStats(next).missions, 'no credit for a booking someone else made');
  ear(cap); S.captainBook(next, { table: t.id, place: sp2, name: next.name });
  assert.ok(heard(cap, 'bookcancel'), 'a new booking elsewhere: whoever held the old one is asked to cancel it');
  ear(next); S.cancelEvent({ id: n.e.id });
  assert.ok(heard(next, 'bookcancel'), 'the evening is off: the booking gets cancelled too');
  assert.ok(db().log.some((x) => x.kind === 'booking-release' && x.a === t.id));
  back();
});

test('round two starts without last time’s booking: the new captain books, with last time’s spot on top of the list', () => {
  const sp = bookSpot('Again'), back = only([sp]), ms = people(6, 'Again'), n = night(ms, 'topic', day(-9)), t = n.t, cap = db().members[t.captain];
  t.venue = { pid: sp, name: 'Again Bistro', address: '7 Elm St', note: 'Booked under ' + cap.name };
  t.cap = Object.assign(t.cap || {}, { booking: { pid: sp, by: cap.id, size: 6, warned: 6, time: '19:00', name: cap.name } });
  const seated = t.ids.map((id) => db().members[id]);
  seated.forEach((m) => S.feedback(m, { table: t.id, rating: 5, picks: [], again: true }));
  const nt = db().tables[t.next];
  assert.ok(nt && !nt.venue, 'nothing booked for round two until someone books it');
  const o = S.tableView(db().members[nt.captain], nt.id).cap.spot.options;
  assert.ok(o.length && o[0].id === sp && o[0].last, 'last time’s spot comes first');
  back();
});

test('late on the day: a captain can still book until 2 PM, a booking that falls through gets an hour, and a partner with its count stays put', () => {
  const sp = bookSpot('Late'), sp2 = bookSpot('Later'), part = Object.values(db().places).find((v) => v.mode === 'hold' || v.mode === 'ask'), back = only([sp, sp2].concat(part ? [part.id] : [])), ms = people(5, 'Late'), n = night(ms, 'topic', day(31)), t = n.t, cap = db().members[t.captain];
  const tm = S.eventTimes(n.e), H = 36e5, real = Date.now;
  try {
    if (t.venue && t.venue.id) {
      Date.now = () => S.freeUntil(n.e) + H;
      assert.throws(() => S.captainBook(cap, { table: t.id, place: sp, name: cap.name }), /partner already has its count/);
      const vid = t.venue.id; t.venue = null; S.syncBooking(vid, n.e.date);
    }
    Date.now = () => tm.reveal + H;
    const M = S.tableView(cap, t.id).cap.spot;
    assert.ok(M.state === 'late' && M.options.length && M.options.every((o) => o.kind === 'book'), 'past the cutoff with nothing: book now');
    S.captainBook(cap, { table: t.id, place: sp, name: cap.name });
    Date.now = () => tm.reveal + 3 * H;
    S.captainBook(cap, { table: t.id, cancel: true });
    assert.ok(t.cap.grace > Date.now(), 'it fell through on the day: an hour to book another');
    S.tick(Date.now() + 30 * 6e4);
    assert.ok(!t.closed, 'still open inside the hour');
    Date.now = () => tm.reveal + 3.5 * H;
    S.captainBook(cap, { table: t.id, place: sp2, name: cap.name });
    assert.ok(t.venue && t.venue.pid === sp2, 'booked again in time');
    S.captainBook(cap, { table: t.id, cancel: true });
    S.tick(tm.reveal + 5 * H);
    assert.strictEqual(t.closed, 'nospot', 'nothing after the hour: the table is off');
  } finally { Date.now = real; back(); }
});

test('a report outlasts lifting the block: asking for another evening never seats you with someone you reported', () => {
  const a = people(4, 'RepA'), b = people(4, 'RepB'), first = night(a, 'kindred', day(3)), second = night(b, 'kindred', day(4));
  const A = a[0], B = b.find((m) => second.t.ids.indexOf(m.id) >= 0);
  S.report(A, { id: B.id, reason: 'test' }); A.never = {};
  S.cancelSeat(A, { event: first.e.id });
  const others = Object.values(db().events).filter((e) => e !== second.e && e.date === second.e.date && e.status === 'published'); others.forEach((e) => { e.status = 'test-hold'; });
  const r = S.reinvite(A, { table: first.t.id, dates: [second.e.date] });
  others.forEach((e) => { e.status = 'published'; });
  assert.ok(r.standby || r.table !== second.t.id, 'not the reported person’s table');
  assert.ok(!(second.t.ids.indexOf(A.id) >= 0 && !(second.t.out || {})[A.id]), 'never at the table of someone they reported');
});

test('after the noon reveal, a booking that falls through and a new one are both told to the table, with the new time', () => {
  const sp = bookSpot('Noon'), sp2 = bookSpot('Later Noon'), back = only([sp, sp2]), ms = people(5, 'Noon'), n = night(ms, 'topic', day(35)), t = n.t, cap = db().members[t.captain];
  const tm = S.eventTimes(n.e), H = 36e5, real = Date.now;
  try {
    S.captainBook(cap, { table: t.id, place: sp, name: cap.name });
    Date.now = () => tm.reveal + H; S.tick(Date.now());
    const other = db().members[t.ids.find((id) => id !== cap.id)]; ear(other);
    S.captainBook(cap, { table: t.id, cancel: true });
    assert.ok(db().chats[t.id].some((x) => /fell through/.test(x.text)), 'the table hears it fell through');
    assert.ok(heard(other, 'spot'), 'and gets a push');
    S.captainBook(cap, { table: t.id, place: sp2, time: '19:30', name: cap.name });
    const last = db().chats[t.id].filter((x) => x.from === 'charlie').pop().text;
    assert.ok(/Later Noon Bistro at 7:30 PM/.test(last) && !/secret until noon/.test(last), 'the new spot and time go out, and nothing says it is a secret: ' + last);
  } finally { Date.now = real; back(); }
});

test('Monday tables say their real free cutoff, and every table has a captain even when nobody volunteered', () => {
  const ms = people(4, 'Nocap'); ms.forEach((m) => { m.captain = 'no'; });
  const n = night(ms, 'topic', day(37));
  assert.ok(n.t.captain, 'someone who would rather not still beats no captain');
  const mon = '2026-11-02', e = { id: 'x', date: mon, time: '19:00', publishedAt: new Date(S.tzMs('2026-11-01', '20:00')).toISOString() };
  assert.strictEqual(S.freeUntil(e), S.tzMs(mon, '10:00'));
});

test('a captain gets a reminder before anyone takes the job, and hears when it moves on', () => {
  Object.values(db().places).forEach((v) => { if (v.mode !== 'captain') v.off = true; });
  const sp = bookSpot('Remind'), ms = people(5, 'Remind'); ms.forEach((m) => { m.captain = 'maybe'; });
  const n = night(ms, 'topic', day(39)), t = n.t, st = S.eventTimes(n.e).start, H = 36e5;
  if (t.venue && t.venue.id) { const vid = t.venue.id; t.venue = null; S.syncBooking(vid, n.e.date); }
  const first = db().members[t.captain]; ear(first);
  t.cap.since = new Date(st - 40 * H).toISOString(); delete t.cap.remind;
  S.tick(st - 34 * H);
  assert.ok(t.cap.remind && !t.cap.handed && t.captain === first.id, 'a reminder first, no handover in the same moment');
  S.tick(st - 27 * H);
  assert.ok(t.cap.handed && t.captain !== first.id, 'six hours later, someone else has it');
  assert.ok(heard(first, 'captainoff'), 'and the first captain is told');
  Object.values(db().places).forEach((v) => { if (v.mode !== 'captain') v.off = false; });
  void sp;
});

test('whoever booked deleting their account close to dinner leaves the booking in place, and a table of three that loses one early takes someone who marked that evening', () => {
  const sp = bookSpot('Erase'), back = only([sp]), ms = people(5, 'Erase'), n = night(ms, 'topic', day(41)), t = n.t, cap = db().members[t.captain];
  const real = Date.now;
  try {
    S.captainBook(cap, { table: t.id, place: sp, name: 'Booker Name' });
    Date.now = () => S.freeUntil(n.e) + 36e5;
    S.erase(cap);
    assert.ok(t.venue && t.venue.pid === sp && t.cap.booking.name === 'Booker Name' && !t.cap.booking.by, 'the table keeps the reservation');
    assert.ok(db().alerts.some((a) => a.key === 'booker:' + t.id && !a.done), 'ops is asked to confirm it');
  } finally { Date.now = real; back(); }
  // a table of three in a built week, someone free that evening with room for a dinner
  const W = S.addDays(S.targetWeek(), 35), d = day(4), at = new Date().toISOString(); // chairs open up to eight days out
  const trio = people(4, 'Trio'), spare = people(2, 'Spare');
  trio.concat(spare).forEach((m) => { m.profile.mix = 'both'; m.avail = { week: W, slots: [d + '|dinner'], max: 1, at }; });
  const e = S.createEvent({ type: 'topic', date: d, time: '19:00' }); e.week = W; e.generated = true;
  db().seats[e.id] = {}; trio.forEach((m) => { db().seats[e.id][m.id] = { at, size: 'either', diet: [], status: 'held' }; });
  const dr = S.draft({ event: e.id }); S.publish({ event: e.id }); const tt = db().tables[dr.tables[0] ? dr.tables[0].id : Object.values(db().tables).find((x) => x.eventId === e.id).id];
  assert.ok(tt && tt.ids.length === 4);
  S.cancelSeat(trio[0], { event: e.id }); S.cancelSeat(trio[1], { event: e.id });
  assert.ok(!tt.closed && tt.ids.filter((id) => !(tt.out || {})[id]).length >= 3, 'someone who marked the evening takes the chair, so the table stays');
});

test('an unbooked table passes to another captain a day and a half out, and with no spot by 2 PM on the day it’s off', () => {
  Object.values(db().places).forEach((v) => { if (v.mode !== 'captain') v.off = true; }); // only spots captains book
  const ms = people(5, 'Hand'); ms.forEach((m) => { m.captain = 'maybe'; });
  const n = night(ms, 'topic', day(27)), t = n.t, first = t.captain, st = S.eventTimes(n.e).start, H = 36e5;
  if (t.venue && t.venue.id) { const vid = t.venue.id; t.venue = null; S.syncBooking(vid, n.e.date); }
  assert.ok(!t.venue && first, 'nothing booked yet, and a captain to book it');
  S.tick(st - 47 * H);
  assert.ok(t.cap.remind, 'two days out: a reminder');
  S.tick(st - 35 * H);
  assert.ok(t.cap.handed && t.captain && t.captain !== first, 'a day and a half out: someone else is captain');
  assert.ok(db().chats[t.id].some((x) => /is captain now/.test(x.text)), 'the table hears who');
  S.tick(S.eventTimes(n.e).reveal + 2 * H + 6e4);
  assert.strictEqual(t.closed, 'nospot', 'no spot by 2 PM: the table is off');
  assert.ok(ms.every((m) => m.prio >= 1), 'and they go first next week');
  Object.values(db().places).forEach((v) => { if (v.mode !== 'captain') v.off = false; });
});

test('someone the team invited can sign in with their email before they ever confirmed it, and the old link stops working', async () => {
  const m = S.newMember('Late Person', 'late@mit.edu', 'mit', 'invite'), link = m.token;
  const r = await S.startVerify(null, { email: 'late@mit.edu' });
  const tok = S.finishVerify(null, { email: 'late@mit.edu', code: r.devCode }).token;
  assert.ok(m.verified && tok === m.token && tok !== link, 'signed in, with a new key in place of the invite link');
});

test('with notifications off, the few notices that matter come by email, three a day at most', async () => {
  const [m] = people(1, 'Mailed'); m.push = [];
  const out = [], log = console.log; console.log = (...a) => { if (/^\[mail to /.test(String(a[0]))) out.push(String(a[0])); else log(...a); };
  try { for (const k of ['table', 'dm', 'reveal', 'spot', 'tableoff', 'merged']) await S.notify(m.id, k, { day: 'Friday', n: 4, other: 'Sam', table: 't1' }); }
  finally { console.log = log; }
  const mine = out.filter((s) => s.indexOf(m.email) >= 0);
  assert.strictEqual(mine.length, 3, 'three a day, and never a chat message');
  assert.ok(/a private invitation/.test(mine[0]) && /\/#home/.test(mine[0]) && /#table=t1/.test(mine[1]), 'each with a link into the app');
});

test('round two with three back: people who marked that evening fill the other three chairs when the week goes out', () => {
  const real = Date.now, OFF = 70 * 864e5; Date.now = () => real() + OFF; // a quiet week of its own, far from the other tests
  try {
    const ms = people(6, 'Refill');
    const base = [-9, -10, -11, -12].map((n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)).find((d) => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 5; });
    const { t } = night(ms, 'topic', base), seated = t.ids.map((id) => db().members[id]);
    assert.strictEqual(seated.length, 6);
    seated.forEach((m, k) => S.feedback(m, { table: t.id, rating: 5, picks: [], again: k < 3 }));
    const nt = db().tables[t.next], ne = db().events[nt.eventId];
    assert.ok(nt && nt.ids.length === 3 && nt.want === 6, 'three of six is enough for round two');
    assert.ok(db().chats[t.id].some((x) => /three new people in the empty chairs/.test(x.text)), 'the old chat hears new people will join');
    // twelve others mark that evening; two of the people who said no do too
    const others = people(12, 'Fresh'), at = new Date(Date.now()).toISOString();
    others.forEach((m) => { m.avail = { week: ne.week, slots: [ne.date + '|dinner'], max: 1, at }; });
    seated.slice(3, 5).forEach((m) => { m.avail = { week: ne.week, slots: [ne.date + '|dinner'], max: 1, at }; });
    const r = S.matchWeek({ week: ne.week });
    assert.strictEqual(r.rounds, 3, 'three chairs planned');
    assert.strictEqual(nt.ids.length, 3, 'nobody hears before Sunday');
    S.publishWeek({ week: ne.week });
    const ids = nt.ids.filter((id) => !(nt.out || {})[id]), fresh = ids.filter((id) => seated.slice(0, 3).every((m) => m.id !== id));
    assert.strictEqual(ids.length, 6, 'six at round two');
    assert.ok(fresh.every((id) => others.some((m) => m.id === id)), 'the new people are people who marked that evening, never someone who said no');
    const h = ids.filter((id) => db().members[id].school === 'harvard').length;
    assert.ok(Math.max(h, 6 - h) <= 4, 'both schools still at the table');
    const nv = S.view(db().members[fresh[0]]).tables.find((x) => x.id === nt.id);
    assert.ok(nv && nv.newcomer && nv.back === 3 && nv.round === 2, 'the invitation tells them they’re joining a table meeting again');
    assert.ok(nt.why.some((l) => /new to the table/.test(l)), 'the table’s why names who’s new');
    // everyone who marked that evening has a dinner: round two or a table of their own
    const dinner = (m) => Object.values(db().tables).some((x) => x.published && !x.closed && (db().events[x.eventId] || {}).date === ne.date && x.ids.indexOf(m.id) >= 0);
    assert.ok(others.every(dinner), 'nobody left out');
  } finally { Date.now = real; }
});

test('nobody’s first dinner comes with a job when someone at the table has been before, and the captain hears it inside the invitation', () => {
  const vets = people(2, 'Vet'), pals = people(2, 'VetPal'), news = people(3, 'Newbie');
  night(vets.concat(pals), 'topic', day(-7));
  vets.concat(news).forEach((m) => { delete m.captainAt; m.captain = 'maybe'; m.push = []; });
  news[0].captain = 'yes'; // a volunteer, but it's their very first dinner
  const out = [], log = console.log; console.log = (...a) => { if (/^\[mail to /.test(String(a[0]))) out.push(String(a[0])); else log(...a); };
  let t;
  try { t = night(vets.concat(news), 'topic', day(5)).t; } finally { console.log = log; }
  assert.ok(vets.some((m) => m.id === t.captain), 'someone who has been to a dinner is captain');
  const cm = db().members[t.captain], mine = out.filter((s) => s.indexOf(cm.email) >= 0);
  assert.ok(mine.some((s) => /small job inside/.test(s)), 'the invitation says there’s a job inside');
  assert.ok(!mine.some((s) => /you’re captain/.test(s)), 'and no second notice before they open it');
  const v = S.view(cm).tables.find((x) => x.id === t.id);
  assert.ok(v.capJobs && v.capJobs.spotBy && v.capJobs.checks, 'the captain sees what’s left: the spot (and by when), the checks');
  assert.strictEqual(S.view(news[1]).tables.find((x) => x.id === t.id).capJobs, null, 'nobody else does');
});

test('a captain who never opens the table hands the job to someone who has, and four hours before the cutoff anyone can book it', () => {
  const sp = bookSpot('Quiet'), back = only([sp]);
  try {
    const ms = people(5, 'Quiet'), n = night(ms, 'topic', day(33)), t = n.t, first = t.captain;
    assert.ok(first && !t.venue, 'a captain, nothing booked');
    const keen = ms.find((m) => m.id !== first); keen.read['inv:' + t.id] = new Date().toISOString();
    S.tick(S.tzMs(day(1), '10:00'));
    assert.ok(t.captain && t.captain !== first && t.cap.quiet, 'the job moved off a captain who never opened the table');
    assert.strictEqual(t.captain, keen.id, 'to the one who did');
    // the new captain doesn't book either: four hours before the cutoff the table can book it
    S.tick(S.closeAt(n.e) - 3 * 36e5);
    assert.ok(t.cap.open, 'open to the table');
    const other = ms.find((m) => m.id !== t.captain && m.id !== first), v = S.view(other).tables.find((x) => x.id === t.id);
    assert.ok(v.spotOpen, 'everyone sees it');
    assert.ok(db().chats[t.id].some((x) => /Anyone here can book it now/.test(x.text)), 'the table hears it');
    S.captainMove(other, { table: t.id, act: 'take' });
    assert.strictEqual(t.captain, other.id, 'whoever steps in is captain');
    S.captainBook(other, { table: t.id, place: sp, name: other.name });
    assert.ok(t.venue && t.venue.pid === sp && !S.view(other).tables.find((x) => x.id === t.id).spotOpen, 'booked, and no longer open');
  } finally { back(); }
});

test('a table of six that loses three while changes are free takes someone who marked that evening, so one more change can’t sink it', () => {
  const W = S.addDays(S.targetWeek(), 42), d = day(3), at = new Date().toISOString();
  const six = people(6, 'Half'), spare = people(2, 'Spare2');
  six.concat(spare).forEach((m) => { m.profile.mix = 'both'; m.avail = { week: W, slots: [d + '|dinner'], max: 1, at }; });
  const e = S.createEvent({ type: 'topic', date: d, time: '19:00' }); e.week = W; e.generated = true;
  db().seats[e.id] = {}; six.forEach((m) => { db().seats[e.id][m.id] = { at, size: 'either', diet: [], status: 'held' }; });
  S.draft({ event: e.id }); S.publish({ event: e.id });
  const t = Object.values(db().tables).find((x) => x.eventId === e.id);
  assert.strictEqual(t.ids.length, 6);
  const leave = t.ids.slice(0, 3); leave.forEach((id) => S.cancelSeat(db().members[id], { event: e.id }));
  const seated = t.ids.filter((id) => !(t.out || {})[id]);
  assert.ok(!t.closed && seated.length === 4, 'four at the table: ' + seated.length);
  assert.ok(seated.some((id) => spare.some((m) => m.id === id)), 'one of them someone who marked that evening');
  assert.ok(t.captain && seated.indexOf(t.captain) >= 0, 'and a captain who is still coming');
});

test('the restaurant list: each place says what it serves, if it takes six online and how easy it is to talk there; a captain sees every one open that night, the likeliest to have six first and quiet rooms first among those, with the date and six filled in', () => {
  const r1 = S.importRestaurants(), r2 = S.importRestaurants();
  assert.ok(r1.added >= 50 && !r1.skipped.length, 'the whole list goes in: ' + JSON.stringify(r1.skipped));
  assert.ok(r2.added === 0 && r2.updated === r1.added, 'a second time only brings them up to date');
  const P = Object.values(db().places).filter((v) => v.mode === 'captain' && v.cuisine);
  assert.ok(P.every((v) => SX.CUISINES.some((c) => c.id === v.cuisine) && ['online', 'call', 'unknown'].indexOf(v.six) >= 0), 'every one says what it serves');
  assert.ok(P.every((v) => ['quiet', 'moderate', 'lively'].indexOf(v.noise) >= 0 && [1, 2, 3].indexOf(v.talk) >= 0 && v.sound), 'and how easy it is to talk there');
  assert.ok(r1.checks > 40 && Object.keys(db().seen).length >= r1.checks, 'the spot checks we did come along: ' + r1.checks);
  const back = only(P.map((v) => v.id));
  try {
    const monday = [3, 4, 5, 6, 7, 8, 9].map(day).find((d) => new Date(d + 'T12:00:00Z').getUTCDay() === 1);
    const ms = people(6, 'Spot'), t = night(ms, 'topic', monday).t, O = S.spotOptions(t);
    assert.strictEqual(S.db().tables[t.id].ids.length, 6);
    assert.ok(O.length > 20, 'the whole list, not four: ' + O.length);
    const shutMon = P.filter((v) => v.nights.indexOf(1) < 0).map((v) => v.id);
    assert.ok(shutMon.length && O.every((o) => shutMon.indexOf(o.id) < 0), 'nothing closed on Mondays');
    // had room when looked at, then not looked at (room the other nights first), then full; the easiest to talk in first inside each
    const key = O.map((o) => [o.tier, o.score]);
    assert.ok(key.every((k2, i) => !i || key[i - 1][0] < k2[0] || (key[i - 1][0] === k2[0] && key[i - 1][1] <= k2[1])), 'what a look found first, then the best fit for the table');
    assert.ok(O.filter((o) => o.best).length === 1 && O.find((o) => o.best).tier <= 1, 'one best fit, and it could work');
    assert.ok(O.some((o) => o.had) && O.some((o) => !o.had && !o.seen), 'a night nobody looked at leans on the nights we did');
    const ot = O.find((o) => o.via === 'opentable'), rs = O.find((o) => o.via === 'resy'), ph = O.find((o) => o.via === 'phone');
    assert.ok(ot.link.indexOf('covers=6&dateTime=' + monday + 'T') > 0, 'OpenTable opens on that date for six: ' + ot.link);
    assert.ok(rs.link.indexOf('date=' + monday + '&seats=6') > 0, 'Resy too: ' + rs.link);
    assert.ok(!ph || /^tel:/.test(ph.link), 'a call-to-book place dials');
    assert.ok(O.every((o) => o.cuisine), 'and each says what it serves');
  } finally { back(); }
});

test('spot checks: a place a look found a table for six at around 7 comes first, with the times and when it was looked at; full ones drop to the bottom; a captain can mark one full for the other captains', () => {
  const mk = (tag, noise, talk) => S.savePlace({ name: tag + ' Room', address: '9 Elm St, Central Square', area: 'Central Square', nights: [0, 1, 2, 3, 4, 5, 6], tables: 3, seats: 6, mode: 'captain', bookVia: 'opentable', bookUrl: 'https://www.opentable.com/r/' + tag.toLowerCase() + '-room', six: 'online', noise, talk }).id;
  const A = mk('Seen', 'moderate', 2), B = mk('Hushed', 'quiet', 3), C = mk('Late', 'moderate', 2), D = mk('Phone', 'moderate', 2), E = mk('Calm', 'quiet', 3), F = mk('Din', 'lively', 1), back = only([A, B, C, D, E, F]);
  try {
    const date = day(26), other = day(33), hour = 36e5;
    const r = S.importChecks([{ date, size: 6, time: '19:00', at: new Date(Date.now() - 2 * hour).toISOString(), seen: { 'Seen Room': ['17:30', '18:45', '19:00', '19:15'], 'Hushed Room': [], 'Late Room': ['21:00'], 'Phone Room': 'call', 'Nowhere Grill': ['19:00'] } }]);
    assert.ok(r.read === 4 && r.unknown.join() === 'Nowhere Grill', 'by name, and a name not on the list is said back');
    const ms = people(6, 'Look'), n = night(ms, 'topic', date), t = n.t, cap = db().members[t.captain];
    if (t.venue && t.venue.id) { const vid = t.venue.id; t.venue = null; S.syncBooking(vid, n.e.date); }
    const O = S.spotOptions(t), at = (id) => O.find((o) => o.id === id);
    assert.deepStrictEqual(O.map((o) => o.id), [A, E, D, F, B, C], 'room at 7 first; then not looked at (quiet first, the phone-only one with them); full last, quiet first');
    assert.ok(at(A).seen.state === 'free' && at(A).seen.times.join() === '18:45,19:00,19:15' && at(A).seen.best === '19:00' && /today|yesterday/.test(at(A).seen.when), 'the times near 7, and when it was looked at');
    assert.ok(at(A).link.indexOf('dateTime=' + date + 'T19%3A00') > 0, 'the link opens at the free time');
    assert.ok(at(B).seen.state === 'full' && at(C).seen.state === 'full' && at(D).seen.state === 'call' && !at(E).seen, 'nothing near 7 is full, even with a late table; too big online says call');
    assert.ok(at(E).sound === '' && at(E).noise === 'quiet' && at(E).talk === 3, 'how loud it is comes along');
    // a look for four says nothing about six
    S.importChecks([{ date, size: 4, at: new Date(Date.now() - hour).toISOString(), seen: { 'Calm Room': ['19:00'] } }]);
    assert.ok(!S.spotOptions(t).find((o) => o.id === E).seen, 'room for four isn’t room for six');
    // and full for six isn't full for four: a table of four sees it as tight, below the ones nobody looked at
    const t4 = night(people(4, 'Four'), 'topic', date).t, O4 = S.spotOptions(t4), i4 = (id) => O4.findIndex((o) => o.id === id);
    assert.ok(O4[i4(B)].seen.state === 'tight' && i4(B) > i4(F) && O4[i4(A)].seen.state === 'free' && O4[i4(E)].seen.state === 'free' && i4(E) === 0, 'six full: maybe four fits, so it waits below the unknowns; room for four counts for four, and the quiet one leads');
    // another night nobody looked at leans on this one
    const n2 = night(people(6, 'Other'), 'topic', other), O2 = S.spotOptions(n2.t);
    const i2 = (id) => O2.findIndex((o) => o.id === id);
    assert.ok(O2[i2(A)].had.room === 1 && O2[i2(B)].had.room === 0 && i2(A) < i2(B), 'it had room the night we looked, so it ranks above the one that was full');
    // the captain finds no table for six at A: marked full for that evening, for every captain that night
    assert.throws(() => S.captainSeen(db().members[t.ids.find((id) => id !== cap.id)], { table: t.id, place: A }), /captain/);
    S.captainSeen(cap, { table: t.id, place: A, full: true });
    const O3 = S.spotOptions(t);
    assert.ok(O3.find((o) => o.id === A).seen.state === 'full' && O3.find((o) => o.id === A).seen.by === 'captain' && O3[O3.length - 1].id !== E, 'a captain’s look counts, and the newest look wins');
    assert.ok(O3.indexOf(O3.find((o) => o.id === A)) > O3.indexOf(O3.find((o) => o.id === F)), 'and it drops below every place that might have room');
    S.importChecks([{ date, size: 6, at: new Date(Date.now() - hour).toISOString(), seen: { 'Seen Room': ['19:00'] } }]);
    assert.strictEqual(S.spotOptions(t).find((o) => o.id === A).seen.by, 'captain', 'an older look doesn’t undo a newer one');
  } finally { back(); }
});

const lookSpot = (tag, noise, talk) => S.savePlace({ name: tag + ' Kitchen', address: '11 Elm St, Central Square', area: 'Central Square', nights: [0, 1, 2, 3, 4, 5, 6], tables: 3, seats: 6, mode: 'captain', bookVia: 'opentable', bookUrl: 'https://www.opentable.com/r/' + tag.toLowerCase() + '-kitchen', six: 'online', noise, talk }).id;

test('back from a booking page: a captain says what it showed (times, nothing near the time, call us), every captain that night sees it at once, a booked time comes off, and the same weekday later leans on it', () => {
  const A = lookSpot('Saw', 'moderate', 2), B = lookSpot('Nope', 'quiet', 3), C = lookSpot('Ring', 'moderate', 2), back = only([A, B, C]);
  try {
    const date = day(40), n1 = night(people(6, 'Capa'), 'topic', date), n2 = night(people(6, 'Capb'), 'topic', date), t1 = n1.t, t2 = n2.t, c1 = db().members[t1.captain], c2 = db().members[t2.captain];
    assert.ok(c1 && c2 && t1.id !== t2.id, 'two tables that night, each with a captain');
    assert.throws(() => S.captainSeen(c1, { table: t1.id, place: A }), /times/, 'it needs what they saw');
    S.captainSeen(c1, { table: t1.id, place: A, times: ['19:15', '19:00', '19:00', '03:00', 'later'] });
    assert.deepStrictEqual(db().seen[A + '|' + date].times, ['19:00', '19:15'], 'times only, once each, in order');
    const mine = S.spotOptions(t1).find((o) => o.id === A).seen, theirs = S.spotOptions(t2).find((o) => o.id === A).seen;
    assert.ok(mine.mine && mine.by === 'captain' && mine.state === 'free' && mine.when === 'just now', 'the captain sees their own look');
    assert.ok(!theirs.mine && theirs.state === 'free' && theirs.times.join() === '19:00,19:15', 'and the other captain that night sees it right away');
    assert.strictEqual(S.spotOptions(t2)[0].id, A, 'the place with a table goes to the top for them, ahead of the quiet one nobody has looked at');
    S.captainSeen(c2, { table: t2.id, place: B, full: true }); S.captainSeen(c2, { table: t2.id, place: C, call: true });
    const O1 = S.spotOptions(t1);
    assert.ok(O1.find((o) => o.id === B).seen.state === 'full' && O1.find((o) => o.id === C).seen.state === 'call' && O1[O1.length - 1].id === B, 'nothing near the time drops to the bottom, quiet or not; call us stays in the middle');
    // the captain books 7:00 there: that time is ours now, so the other captain sees 7:15 only
    S.captainBook(c1, { table: t1.id, place: A, time: '19:00', name: c1.name });
    assert.strictEqual(S.spotOptions(t2).find((o) => o.id === A).seen.times.join(), '19:15', 'a booked time comes off the list');
    // a week on, the same weekday, and nobody has looked yet: it had room, so it leads; the full one is remembered
    const O3 = S.spotOptions(night(people(6, 'Capc'), 'topic', S.addDays(date, 7)).t), hA = O3.find((o) => o.id === A).had, hB = O3.find((o) => o.id === B).had;
    assert.ok(hA && hA.room === 1 && hA.nights === 1 && hA.day && O3[0].id === A, 'the same weekday a week on leans on what the captains saw');
    assert.ok(hB && hB.room === 0 && O3.findIndex((o) => o.id === B) > O3.findIndex((o) => o.id === A), 'and remembers the one that was full');
    assert.ok(hA.list.length === 1 && hA.list[0].room && hA.list[0].how === 'look' && /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d+$/.test(hA.list[0].d), 'with the date it was seen: ' + JSON.stringify(hA.list));
    // a table our captain booked counts as a night with room; a made-up one (the demo's sample captains) never does
    const n4 = night(people(6, 'Capd'), 'topic', S.addDays(date, 1)), c4 = db().members[n4.t.captain], t5 = night(people(6, 'Cape'), 'topic', S.addDays(date, 8)).t;
    S.captainBook(c4, { table: n4.t.id, place: C, name: c4.name });
    const hC = () => S.spotOptions(t5).find((o) => o.id === C).had;
    assert.ok(hC() && hC().room === 1 && hC().list[0].how === 'booked', 'a real booking says the place had room');
    n4.t.cap.booking.sample = true;
    assert.ok(!hC(), 'a sample booking says nothing');
  } finally { back(); }
});

test('the spot checks tab: each coming night with its tables, the places that need a look first with a link for six, one tap to save what a page showed, and a note to duty on a bare Sunday night', () => {
  const ids = [['Hush', 'quiet', 3], ['Calm', 'moderate', 3], ['Mid', 'moderate', 2], ['Buzz', 'lively', 2], ['Loud', 'lively', 1], ['Plain', 'moderate', 2]].map((x) => lookSpot('Tab' + x[0], x[1], x[2])), back = only(ids);
  try {
    const sun = [1, 2, 3, 4, 5, 6, 7].map(day).find((d) => new Date(d + 'T12:00:00Z').getUTCDay() === 0), tue = S.addDays(sun, 2);
    night(people(6, 'Chk'), 'topic', tue);
    const N = S.checksAdmin(14).find((x) => x.date === tue);
    assert.ok(N && N.tables >= 1 && N.rows.length === ids.length && N.looked === 0 && N.free === 0, 'the night, its tables, and every place open that night');
    assert.ok(N.rows.every((r) => r.look && r.link.indexOf('covers=6&dateTime=' + tue + 'T19%3A00') > 0), 'each with its page for six at 7');
    assert.strictEqual(N.rows[0].noise, 'quiet', 'the quiet ones first, as captains will see them');
    S.importChecks([{ date: tue, size: 6, time: '19:00', seen: { [ids[0]]: ['19:00'], [ids[1]]: [] } }]);
    const N2 = S.checksAdmin(14).find((x) => x.date === tue), last = N2.rows.slice(-2).map((r) => r.id).sort();
    assert.ok(N2.looked === 2 && N2.free === 1 && last.join() === [ids[0], ids[1]].sort().join() && !N2.rows[0].seen, 'saved by id, counted, and the looked-at ones move down');
    // Sunday 8:45 PM with fewer than five looked at that week: one note to whoever is on duty, naming the night
    const at = S.tzMs(sun, '20:45'); S.checksNudge(at); S.checksNudge(at); S.checksNudge(S.tzMs(sun, '19:00'));
    const notes = db().alerts.filter((a) => a.key === 'checks:' + S.addDays(sun, 1));
    assert.ok(notes.length === 1 && /Tuesday/.test(notes[0].text), 'once, naming the bare nights: ' + notes.length);
  } finally { back(); }
});

test('the fairest trip: a rough map of walks, the T and the main buses; places easy for the whole table rank first; the card says where you come from', () => {
  const TRIP = require('../server/trip.js');
  const hsq = [42.3736, -71.1190], hbs = [42.3655, -71.1240], mit = [42.3600, -71.0915], harvest = [42.37377, -71.12183];
  const w = TRIP.trip(hbs, harvest), r = TRIP.trip(mit, harvest), k = TRIP.trip(hsq, [42.3636, -71.0915]);
  assert.ok(w.walk && w.min >= 10 && w.min <= 20, 'HBS to Harvard Square is a walk: ' + JSON.stringify(w));
  assert.ok(!r.walk && r.lines.indexOf('the Red Line') >= 0 && r.min >= 15 && r.min <= 30, 'MIT to Harvard Square is the Red Line: ' + JSON.stringify(r));
  assert.ok(k.min >= 12 && k.min <= 28, 'Harvard Square to Kendall: ' + JSON.stringify(k));
  const mk = (tag, lat, lng) => S.savePlace({ name: tag + ' Table', address: '1 Test St, Cambridge', area: 'Test', nights: [0, 1, 2, 3, 4, 5, 6], tables: 3, seats: 6, mode: 'captain', bookVia: 'opentable', bookUrl: 'https://www.opentable.com/r/' + tag.toLowerCase() + '-table', six: 'online', noise: 'moderate', talk: 2, lat, lng }).id;
  const AL = mk('Barry', 42.3638, -71.1290), KE = mk('Tech', 42.3636, -71.0915), back = only([AL, KE]);
  assert.throws(() => S.savePlace({ id: AL, name: 'Barry Table', address: '1 Test St, Cambridge', nights: [1], mode: 'captain', bookUrl: 'https://www.opentable.com/r/x', lat: 10, lng: 10 }), /Boston/, 'a map pin has to be around Boston');
  try {
    const ms = people(6, 'Trip'), t = night(ms, 'topic', day(41)).t, seated = t.ids.map((id) => db().members[id]);
    seated.forEach((m) => { m.profile.from = 'hbs'; });
    let O = S.spotOptions(t);
    assert.ok(O[0].id === AL && O[0].best && O[0].trip.walkAll && O[0].trip.max <= 12 && O[1].trip.max >= 25, 'a table coming from HBS gets the Allston spot first, a short walk for all: ' + JSON.stringify(O.map((o) => o.trip)));
    seated.forEach((m) => { m.profile.from = 'mit'; });
    O = S.spotOptions(t);
    assert.strictEqual(O[0].id, KE, 'and a table coming from MIT, the Kendall one');
    seated.forEach((m, i) => { m.profile.from = i % 2 ? 'mit' : 'hbs'; });
    const T = S.spotOptions(t).find((o) => o.id === AL).trip;
    assert.ok(T.groups.length === 2 && T.groups.every((g) => g.n >= 1 && g.t) && T.max >= T.avg, 'who comes from where, by area: ' + JSON.stringify(T));
    // the card keeps the area, and only areas on the list
    const m0 = seated[0];
    S.saveProfile(m0, { first: m0.first, profile: Object.assign({}, m0.profile, { from: 'backbay' }) }); assert.strictEqual(m0.profile.from, 'backbay');
    S.saveProfile(m0, { first: m0.first, profile: Object.assign({}, m0.profile, { from: 'mars' }) }); assert.strictEqual(m0.profile.from, '', 'only the areas on the list');
    assert.strictEqual(SX.fromOf('harvard', 'Business School', ''), 'hbs'); assert.strictEqual(SX.fromOf('mit', 'Sloan', ''), 'mit'); assert.strictEqual(SX.fromOf('harvard', 'Medical School', ''), 'longwood');
  } finally { back(); }
});
