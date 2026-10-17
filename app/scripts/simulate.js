// A pre-launch rehearsal: 50 made-up members (25 Harvard, 25 MIT) live four weeks of Sidetable on a fake clock, in a
// throwaway data folder. Every hour the server's own tick runs; people mark evenings, captains book, tables vote, some
// cancel late or don't show, everyone sends feedback, round twos get booked. After each step the rules are checked:
// nobody twice in one evening, tables of three to six, no school over half, blocked pairs apart, captains who said yes or
// maybe, no more dinners than asked for, paused people not seated. It ends with numbers and how long the busiest calls take.
//   npm run simulate            (or: node scripts/simulate.js --weeks 6 --people 80)
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] || d : d; };
const WEEKS = arg('weeks', 4), N = arg('people', 50), SEED = arg('seed', 11);

// a clock the whole server runs on: Date.now() and new Date() both read it
const RealDate = Date; let NOW = 0;
global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } };
const tz = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const etDay = (ms) => tz.format(new RealDate(ms));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidetable-sim-'));
Object.assign(process.env, { SIXTOP_DATA_DIR: dir, SIXTOP_MAIL: 'show', SIXTOP_AUTO_WEEK: '1', SIXTOP_ADMIN_KEY: 'simulation-admin-key-123' });
const quiet = console.log; console.log = () => {}; // the server prints every mail in show mode
const S = require('../server/server.js'), SX = require('../public/shared.js');
const db = () => S.db();

let r = SEED; const rnd = () => { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; };
const pick = (a) => a[Math.floor(rnd() * a.length)], chance = (p) => rnd() < p;
const HOUR = 36e5, DAY = 24 * HOUR;

// start on a Monday, 9 AM in Boston, two weeks from now
const today = etDay(RealDate.now()), dow = new RealDate(today + 'T12:00:00Z').getUTCDay();
const monday = S.addDays(today, ((8 - dow) % 7 || 7) + 7);
NOW = S.tzMs(monday, '09:00');

const problems = [], stats = { weeks: [], requests: [], bookings: 0, unbooked: 0, late: 0, noshow: 0, reinvites: 0, roundTwos: 0, stripes: 0, salutes: 0, hangs: 0 };
const problem = (kind, msg) => { if (problems.filter((p) => p.kind === kind).length < 8) problems.push({ kind, msg, at: etDay(NOW) }); else problems.push({ kind, msg: '', at: '' }); };
const tryDo = (what, f) => { try { return f(); } catch (e) { if (!e.user) problem('crash', what + ': ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); return null; } };

/* ---------- people ---------- */
const PHOTO = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('a face')]).toString('base64');
const tracks = SX.TRACKS.map((t) => t.id).filter((id) => SX.INTS.some((x) => x.tr === id));
// how popular each track is likely to be on campus (AI first); --flat spreads people evenly instead, the hardest case
const WEIGHT = { genai: 24, founders: 12, hcai: 10, climate: 8, product: 8, fintech: 7, robotics: 7, bio: 6, consumer: 5, vc: 5, future: 3, space: 2, cities: 2, society: 1 };
const weighted = process.argv.indexOf('--flat') > 0 ? tracks : [].concat(...tracks.map((t) => Array(WEIGHT[t] || 2).fill(t)));
const people = [];
for (let i = 0; i < N; i++) {
  const school = i % 2 ? 'mit' : 'harvard', tr = [pick(weighted)].concat(chance(0.4) ? [pick(weighted)] : []).filter((x, k, a) => a.indexOf(x) === k);
  const m = S.newMember('Sim Person' + i + ' Test', 'sim' + i + '@' + (school === 'mit' ? 'mit.edu' : 'harvard.edu'), school, 'sim');
  m.verified = true;
  const ints = SX.INTS.filter((x) => tr.indexOf(x.tr) >= 0).map((x) => x.id).sort(() => rnd() - 0.5).slice(0, 4);
  const mix = chance(0.6) ? 'both' : chance(0.6) ? 'topic' : 'social';
  tryDo('profile', () => S.saveProfile(m, { first: 'Sim' + i, school, program: pick(SX.SCHOOLS[school].programs), year: pick(SX.YEARS), photo: PHOTO,
    profile: { tracks: tr, interests: ints.length >= 3 ? ints : SX.INTS.filter((x) => x.tr === tr[0]).slice(0, 3).map((x) => x.id), lens: pick(['build', 'run', 'study', 'fund']), before: pick(SX.BEFORE),
      takes: { track: pick(['agree', 'disagree']), code: pick(['agree', 'disagree']), lab: 'depends' }, answers: { 0: i % 4, 1: (i * 3) % 4, 2: (i * 7) % 4, 3: i % 3 },
      rhythm: pick(SX.RHYTHM)[0], life: [pick(SX.LIFE)], acts: [pick(SX.ACTS)], look: pick(SX.LOOK).id, askWork: 'agents', askLife: 'hikes', diet: chance(0.15) ? [pick(SX.DIETS)] : [],
      mix, perWeek: 1 + Math.floor(rnd() * 3), next: ['Start a company'], plan: 'ship it', dream: 'a bookstore' } }));
  m.captain = chance(0.3) ? 'yes' : chance(0.85) ? 'maybe' : 'no';
  people.push({ m, flake: rnd() < 0.15 ? 0.25 : 0.04, voter: rnd() < 0.8 });
}
// two people who reported someone, and one block
tryDo('report', () => S.report(people[0].m, { id: people[2].m.id, reason: 'test' }));
tryDo('report', () => S.report(people[5].m, { id: people[7].m.id, reason: 'test' }));
people[10].m.never = { [people[12].m.id]: 1 };
const apartPairs = [[0, 2], [5, 7], [10, 12]].map(([a, b]) => [people[a].m.id, people[b].m.id]);

// spots captains book (and one partner holding two tables on weeknights)
[['Sim Bistro', 'Central Square', 'opentable'], ['Sim Noodle Bar', 'Central Square', 'resy'], ['Sim Tavern', 'Kendall Square', 'phone'], ['Sim Trattoria', 'Harvard Square', 'web'], ['Sim Dumplings', 'Central Square', 'opentable'], ['Sim Grill', 'Kendall Square', 'tock']]
  .forEach(([name, area, via], k) => S.savePlace({ name, address: (k + 1) + ' Sim St, ' + area, area, nights: [0, 1, 2, 3, 4, 5, 6], tables: 3, seats: 6, mode: 'captain', bookVia: via, bookUrl: via === 'phone' ? '' : 'https://example.com/' + k, phone: via === 'phone' ? '(617) 555-0199' : '', vibe: 'Sample' }));
S.savePlace({ name: 'Sim Partner House', address: '9 Partner Rd, Central Square', area: 'Central Square', nights: [1, 2, 3], tables: 2, seats: 6, email: 'partner@example.com', mode: 'hold' });
S.saveOps({ team: [{ name: 'Sim Duty', email: 'duty@example.com' }], rota: {} });

/* ---------- the rules, checked as the weeks go ---------- */
const evOf = (t) => db().events[t.eventId];
const seated = (t) => t.ids.filter((x) => !(t.out && t.out[x]));
const live = () => Object.values(db().tables).filter((t) => t.published && !t.closed && evOf(t) && evOf(t).status === 'published');
function check(label) {
  const byDate = {};
  // a table that closed ahead of dinner with a booking on it: whoever made it was told to cancel
  Object.values(db().tables).filter((t) => t.closed && t.venue && t.venue.pid && t.cap && t.cap.booking && t.cap.booking.pid === t.venue.pid && !t.cap.booking.released && evOf(t) && Date.parse(t.closedAt || 0) < S.eventTimes(evOf(t)).start).forEach((t) => problem('release', `${label}: table ${t.id} closed with a booking nobody was told to cancel`));
  live().forEach((t) => {
    const e = evOf(t), ids = seated(t), past = S.eventTimes(e).start < NOW;
    ids.forEach((id) => { const k = id + '|' + e.date; if (byDate[k] && byDate[k] !== t.id) problem('double', `${label}: a member is at two tables on ${e.date}`); byDate[k] = t.id; });
    if (!past && (ids.length < 3 || ids.length > 6)) problem('size', `${label}: table ${t.id} has ${ids.length} people`);
    const h = ids.filter((id) => (db().members[id] || {}).school === 'harvard').length;
    // the mix is a matching rule: a first table nobody has left yet (round twos keep whoever said yes)
    if (!past && (t.round || 1) === 1 && !Object.keys(t.out || {}).length && ids.length >= 4 && Math.max(h, ids.length - h) > Math.ceil(ids.length / 2)) problem('mix', `${label}: table ${t.id} is ${h} Harvard / ${ids.length - h} MIT`);
    apartPairs.forEach(([a, b]) => { if (ids.indexOf(a) >= 0 && ids.indexOf(b) >= 0) problem('apart', `${label}: a reported or blocked pair shares table ${t.id}`); });
    // a captain-booked spot is always backed by the booking that made it (round two never inherits last time's)
    if (t.venue && t.venue.pid && !(t.cap && t.cap.booking && t.cap.booking.pid === t.venue.pid)) problem('ghost', `${label}: table ${t.id} shows a booked spot nobody booked`);
    if (!past && (!t.captain || ids.indexOf(t.captain) < 0)) problem('captain', `${label}: table ${t.id} has no seated captain`);
    else if (!past && db().members[t.captain].captain === 'no' && ids.some((id) => (db().members[id].captain || 'maybe') !== 'no')) problem('captain', `${label}: a captain who said no, with others willing`);
  });
}
// dinners per member in a week, against what they asked for (round twos and reinvites are on top, by their own choice)
function weekCheck(week) {
  const w = db().weeks[week]; if (!w) { problem('week', 'week ' + week + ' was never built'); return {}; }
  const count = {}, asked = {};
  people.forEach(({ m }) => { if (m.avail && m.avail.week === week) asked[m.id] = m.avail; });
  w.events.forEach((eid) => Object.values(db().tables).filter((t) => t.eventId === eid && t.published).forEach((t) => t.ids.forEach((id) => {
    if (((db().seats[eid] || {})[id] || {}).moved) return; // a chair taken later, by someone who asked for another evening
    if (t.closed === 'merged' && (t.out || {})[id]) return; // moved to the table this one merged into, counted there
    count[id] = (count[id] || 0) + 1; const a = asked[id];
    if (!a) problem('plan', `week ${week}: someone was seated without marking the week`);
    else if (a.slots.indexOf(db().events[eid].date + '|dinner') < 0) problem('plan', `week ${week}: someone was seated on an evening they didn't mark`);
  })));
  Object.keys(count).forEach((id) => { if (asked[id] && count[id] > asked[id].max) { problem('plan', `week ${week}: someone got ${count[id]} dinners after asking for ${asked[id].max}`); if (process.env.SIM_DEBUG) w.events.forEach((eid) => Object.values(db().tables).filter((t) => t.eventId === eid && t.published && t.ids.indexOf(id) >= 0).forEach((t) => quiet('   seat', db().events[eid].date, 'table', t.id, 'round', t.round || 1, 'closed', t.closed || '-', 'out', !!(t.out || {})[id], JSON.stringify((db().seats[eid] || {})[id] || {}), 'slots', asked[id].slots.join(' '), 'max', asked[id].max))); } if (S.cooling(db().members[id]) && asked[id]) problem('pause', `week ${week}: a paused member was seated`); });
  // anyone who marked the week and has a dinner in it: from this matching, a round two, or another evening they asked for
  const dates = [0, 1, 2, 3, 4].map((d) => S.addDays(week, d)), dinner = (id) => Object.values(db().tables).some((t) => t.published && !t.closed && evOf(t) && dates.indexOf(evOf(t).date) >= 0 && t.ids.indexOf(id) >= 0);
  const marked = Object.keys(asked).filter((id) => asked[id].slots.length), got = marked.filter((id) => dinner(id));
  if (process.env.SIM_DEBUG && w.unmatched.length > 3) w.unmatched.forEach((id) => { const m = db().members[id], a = m.avail; quiet('   unmatched', m.school, (m.profile || {}).mix, 'max', a.max, a.slots.map((sl) => sl.slice(5, 10) + ':' + people.filter((p) => p.m.avail && p.m.avail.week === week && p.m.avail.slots.indexOf(sl) >= 0).length).join(' '), 'busy', dates.filter((d) => Object.values(db().tables).some((t) => t.published && evOf(t) && evOf(t).date === d && t.ids.indexOf(id) >= 0)).join(',')); });
  return { marked: marked.length, seated: got.length, seats: Object.values(count).reduce((a, b) => a + b, 0), unmatched: w.unmatched.length, tables: w.events.reduce((n, eid) => n + Object.values(db().tables).filter((t) => t.eventId === eid && t.published).length, 0) };
}
// every member's screens render, and how long the busiest call takes
function viewsCheck(label) {
  people.forEach(({ m }) => {
    const t0 = RealDate.now(); const v = tryDo('view ' + label, () => S.view(m)); stats.requests.push(RealDate.now() - t0);
    if (!v) return;
    v.tables.slice(0, 3).forEach((t) => tryDo('tableView ' + label, () => S.tableView(m, t.id)));
  });
}

/* ---------- the clock ---------- */
const tickTo = (ms) => { while (NOW < ms) { NOW = Math.min(ms, NOW + HOUR); tryDo('tick', () => S.tick(NOW)); hourly(); } };
const done = new Set();
function hourly() {
  const tables = live();
  tables.forEach((t) => {
    const e = evOf(t), st = S.eventTimes(e).start, c = db().members[t.captain];
    // captains book within a day of getting the table (one in ten forgets)
    if (!t.venue && c && st - NOW > 6 * HOUR && !done.has('book' + t.id + c.id) && NOW - Date.parse(t.publishedAt || 0) > 6 * HOUR) {
      done.add('book' + t.id + c.id);
      if (chance(0.9)) {
        const o = tryDo('options', () => S.spotOptions(t)) || [], partner = o.find((x) => x.kind === 'partner'), book = o.filter((x) => x.kind === 'book');
        if (partner && chance(0.5)) tryDo('captainSpot', () => S.captainSpot(c, { table: t.id, place: partner.id }));
        else if (book.length && tryDo('captainBook', () => S.captainBook(c, { table: t.id, place: pick(book).id, time: pick([e.time, e.time, '19:30']), name: c.name }))) stats.bookings++;
      } else stats.unbooked++;
    }
    // on the day, one booking in twenty falls through; most captains book another right away
    if (t.venue && t.venue.pid && c && NOW >= S.eventTimes(e).reveal + HOUR && NOW < st - 2 * HOUR && !done.has('fell' + t.id)) {
      done.add('fell' + t.id);
      if (chance(0.05) && tryDo('unbook', () => S.captainBook(c, { table: t.id, cancel: true }))) {
        stats.fell = (stats.fell || 0) + 1;
        const book = (tryDo('options', () => S.spotOptions(t)) || []).filter((x) => x.kind === 'book' && x.id !== t.cap.spot && x.id);
        if (book.length && chance(0.7) && tryDo('rebook', () => S.captainBook(c, { table: t.id, place: pick(book).id, name: c.name }))) stats.rebooked = (stats.rebooked || 0) + 1;
      }
    }
    // the vote: most people vote within a day; captains nudge once
    if (t.game && !t.game.pick && st - NOW < 3 * DAY) {
      seated(t).forEach((id) => { const p = people.find((x) => x.m.id === id); if (p && p.voter && !t.game.votes[id] && chance(0.3)) tryDo('vote', () => S.playGame(p.m, { table: t.id, act: 'vote', card: pick(t.game.cards) })); });
      if (c && !done.has('nudge' + t.id) && st - NOW < 2 * DAY) { done.add('nudge' + t.id); tryDo('nudge', () => S.captainNudge(c, { table: t.id })); }
    }
    // cancellations: early ones, late ones
    if (st > NOW && !done.has('cx' + t.id + Math.floor(NOW / DAY))) {
      done.add('cx' + t.id + Math.floor(NOW / DAY));
      seated(t).forEach((id) => {
        const p = people.find((x) => x.m.id === id); if (!p || !chance(p.flake / 4)) return;
        const r2 = tryDo('cancel', () => S.cancelSeat(p.m, { event: e.id })); if (!r2) return;
        if (r2.late) stats.late++;
        if (chance(0.5)) { const days = [1, 2, 3, 4, 5].map((d) => S.addDays(etDay(NOW), d)); if (tryDo('reinvite', () => S.reinvite(p.m, { table: t.id, dates: days }))) stats.reinvites++; }
      });
    }
    // dinner: the table needs a spot, the captain settles up, a few don't show
    if (NOW >= st && NOW < st + HOUR + 1 && !done.has('night' + t.id)) {
      done.add('night' + t.id);
      if (!(t.venue && t.venue.name)) { stats.nospot = (stats.nospot || 0) + 1; if (!(db().alerts || []).some((a) => a.key.indexOf(t.id) >= 0)) problem('nospot', 'table ' + t.id + ' reached dinner with no spot and no alert'); }
      if (c && chance(0.85)) tryDo('checks', () => S.captainChecks(c, { table: t.id }));
      seated(t).forEach((id) => { const p = people.find((x) => x.m.id === id); if (p && chance(p.flake / 3)) { t.attended = t.attended || {}; t.attended[id] = false; stats.noshow++; } });
    }
    // the morning after: feedback, picks, round two, thanks for the captain
    if (NOW >= st + 15 * HOUR && !done.has('fb' + t.id)) {
      done.add('fb' + t.id);
      const ids = seated(t);
      ids.forEach((id) => {
        const p = people.find((x) => x.m.id === id); if (!p || !chance(0.85)) return;
        const went = !(t.attended && t.attended[id] === false);
        tryDo('feedback', () => S.feedback(p.m, { table: t.id, attended: went, rating: 3 + Math.floor(rnd() * 3), picks: ids.filter((x) => x !== id && chance(0.35)), again: chance(0.6), salute: chance(0.7), next: chance(0.3) ? 'try the climbing gym' : '' }));
      });
    }
  });
  // a hang now and then
  if (chance(0.05)) { const p = pick(people), when = NOW + (2 + Math.floor(rnd() * 48)) * HOUR, d = etDay(when); if (tryDo('hang', () => S.createPop(p.m, { title: 'Sim coffee', place: 'A cafe', date: d, time: '18:00', kind: 'social', vibe: 'coffee', size: 4 }))) stats.hangs++; }
}

/* ---------- four weeks ---------- */
for (let w = 0; w < WEEKS; w++) {
  const wkMon = S.addDays(monday, 7 * w), next = S.addDays(wkMon, 7);
  // Tuesday: people plan next week (most of them)
  tickTo(S.tzMs(S.addDays(wkMon, 1), '12:00'));
  people.forEach(({ m }) => { if (!chance(0.85)) return; const n = 1 + Math.floor(rnd() * 4), slots = [0, 1, 2, 3, 4].sort(() => rnd() - 0.5).slice(0, n).map((d) => S.addDays(next, d) + '|dinner'); tryDo('avail', () => S.setAvail(m, { slots, max: 1 + Math.floor(rnd() * Math.min(3, n)) })); });
  // Sunday 8 PM: the week builds and publishes itself (SIXTOP_AUTO_WEEK)
  tickTo(S.tzMs(S.addDays(next, -1), '21:00'));
  check('after publish, week ' + (w + 1));
  stats.weeks.push(Object.assign({ week: next }, weekCheck(next)));
  viewsCheck('week ' + (w + 1));
  tickTo(S.tzMs(S.addDays(next, 3), '12:00')); check('midweek ' + (w + 1));
}
tickTo(NOW + 5 * DAY); check('the end'); viewsCheck('the end');

/* ---------- numbers ---------- */
const all = Object.values(db().tables).filter((t) => t.published && evOf(t) && S.eventTimes(evOf(t)).start < NOW);
const sizes = all.filter((t) => !t.closed).map((t) => seated(t).length), pairs = {};
all.filter((t) => !t.closed).forEach((t) => { const ids = seated(t); ids.forEach((a, i) => ids.slice(i + 1).forEach((b) => { const k = a < b ? a + b : b + a; pairs[k] = (pairs[k] || 0) + 1; })); });
const met = Object.values(pairs), techOk = all.filter((t) => evOf(t).type === 'topic' && t.track && !t.closed);
const trackHit = techOk.reduce((n, t) => n + seated(t).filter((id) => ((db().members[id].profile || {}).tracks || []).indexOf(t.track) >= 0).length, 0), techSeats = techOk.reduce((n, t) => n + seated(t).length, 0);
const nearHit = techOk.reduce((n, t) => n + seated(t).filter((id) => { const tr = (db().members[id].profile || {}).tracks || []; return tr.indexOf(t.track) >= 0 || tr.some((x) => SX.NEAR[x] === t.track || SX.NEAR[t.track] === x); }).length, 0);
const alertKinds = {}; (db().alerts || []).forEach((a) => { const k = a.key.split(':')[0]; alertKinds[k] = (alertKinds[k] || 0) + 1; });
people.forEach(({ m }) => { const s = S.captainStats(m, NOW); stats.stripes += s.stripes; stats.salutes += s.salutes; });
stats.roundTwos = Object.values(db().tables).filter((t) => (t.round || 1) > 1).length;
const req = stats.requests.slice().sort((a, b) => a - b), pct = (p) => req[Math.min(req.length - 1, Math.floor(req.length * p))] || 0;
console.log = quiet;
const kinds = {}; problems.forEach((p) => { kinds[p.kind] = (kinds[p.kind] || 0) + 1; });
console.log(`\nSidetable rehearsal: ${N} people, ${WEEKS} weeks (seed ${SEED})\n`);
stats.weeks.forEach((w) => console.log(`  week of ${w.week}: ${w.marked} people marked evenings, ${w.seated} have a dinner that week (${w.marked ? Math.round(100 * w.seated / w.marked) : 0}%), ${w.tables} tables, ${w.unmatched} unmatched`));
console.log(`\n  tables that happened: ${all.length} (${all.filter((t) => t.closed).length} closed or merged), sizes ${Math.min(...sizes)} to ${Math.max(...sizes)}, average ${(sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1)}`);
console.log(`  tech table seats in one of the member's own tracks: ${techSeats ? Math.round(100 * trackHit / techSeats) : 0}%, own or next to it: ${techSeats ? Math.round(100 * nearHit / techSeats) : 0}%`);
console.log(`  pairs who met: ${met.length}, met twice or more: ${met.filter((x) => x >= 2).length}, three times: ${met.filter((x) => x >= 3).length}`);
console.log(`  captains: ${stats.bookings} booked it themselves, ${stats.unbooked} forgot, ${stats.stripes} stripes earned, ${stats.salutes} thank-yous`);
console.log(`  bookings that fell through on the day ${stats.fell || 0}, booked again ${stats.rebooked || 0}`);
console.log(`  late cancels ${stats.late}, no-shows ${stats.noshow}, another-evening requests ${stats.reinvites}, round twos ${stats.roundTwos}, hangs ${stats.hangs}`);
console.log(`  paused for late changes: ${people.filter(({ m }) => S.cooling(m)).length}, tables that reached dinner with no spot: ${stats.nospot || 0}`);
console.log(`  alerts for whoever is on duty: ${Object.keys(alertKinds).map((k) => k + ' ' + alertKinds[k]).join(', ') || 'none'}`);
console.log(`  member view: median ${pct(0.5)} ms, 95th percentile ${pct(0.95)} ms, slowest ${req[req.length - 1] || 0} ms (${req.length} calls)`);
console.log(`  data file: ${Math.round(JSON.stringify(db()).length / 1024)} KB`);
console.log(problems.length ? `\n  PROBLEMS (${problems.length}): ${Object.keys(kinds).map((k) => k + ' ' + kinds[k]).join(', ')}\n` + problems.filter((p) => p.msg).map((p) => `   - [${p.kind}] ${p.at} ${p.msg}`).join('\n') : '\n  No rule broken, nothing crashed.');
S.save(true);
setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} process.exit(problems.length ? 1 : 0); }, 300);
