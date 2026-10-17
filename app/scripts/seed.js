// Demo data for trying Hash Table locally: 40 members (20 from across Harvard, 20 from MIT), a past dinner with picks already in,
// a career dinner and a social dinner this week (Charlie's invitations, still sealed), next week's evenings marked,
// and a few hangs.
// Never run this on real data.
//
//   node scripts/seed.js            (adds to ./data, or SIXTOP_DATA_DIR)
//   node scripts/seed.js --reset    (wipes the data folder's db first)
'use strict';
const S = require('../server/server.js');
const SX = require('../public/shared.js');
const { pk } = require('../server/tables.js');
const FACES = require('./faces.js'); // AI-generated sample faces, one per name below

if (process.argv.indexOf('--reset') >= 0) S.setDb({});
const db = S.db();
let seed = 11;
const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pick = (a) => a[Math.floor(r() * a.length)];
const some = (a, n) => a.slice().sort(() => r() - 0.5).slice(0, n);
const day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };

const NAMES = ['Jordan Park', 'Priya Raman', 'Dev Malhotra', 'Sam Okafor', 'Hannah Lee', 'Mei Chen', 'Tomás Rivera', 'Amara Nwosu', 'Lucas Meyer', 'Sofia Rossi',
  'Kenji Watanabe', 'Leah Cohen', 'Omar Haddad', 'Grace Kim', 'Daniel Ortiz', 'Nina Patel', 'Ethan Brooks', 'Yuna Seo', 'Marcus Green', 'Isabel Duarte',
  'Arjun Mehta', 'Chloe Martin', 'Felix Wagner', 'Zara Ahmed', 'Ben Carter', 'Lina Haddad', 'Theo Laurent', 'Maya Singh', 'Owen Murphy', 'Elena Petrova',
  'Kofi Mensah', 'Ava Thompson', 'Ravi Iyer', 'Julia Novak', 'Mateo Silva', 'Ines Garcia', 'Noah Fischer', 'Sara Lindqvist', 'Hugo Bernard', 'Aisha Bello'];
const WORK = { genai: ['why most agent demos break on step four', 'evals nobody wants to write', 'the AI tool I quietly pay for myself'], hcai: ['why hospitals buy AI and never switch it on', 'what a night shift taught me about software', 'the prior-auth mess'],
  founders: ['the startup I almost quit a job for', 'cold emails that actually worked', 'raising money while still in school'], climate: ['what data centers are doing to the grid', 'heat pumps, seriously', 'why carbon markets keep breaking'] };
Object.assign(WORK, {
  fintech: ['why stablecoins are boring in the best way', 'the payments bug that cost us a weekend'], robotics: ['why robot hands are so hard', 'what a chip shortage feels like from the inside'],
  bio: ['what a wet lab smells like at 2 AM', 'why longevity startups make me nervous'], consumer: ['the app my friends actually use', 'why most social apps die in month three'],
  vc: ['what a partner meeting is really like', 'the deal I passed on and regret'], product: ['the best PRD I ever read', 'why I prototype before I write specs']
});
const HEAD = {
  genai: [['Building evals for AI agents', 'An eval harness that tells you when an agent is about to break'], ['Ex-PM, AI developer tools', 'A side project: agents that do expense reports'], ['Former ML engineer, now on the business side', 'Figuring out which AI products actually make money'], ['Thinking about AI and the future of work', 'Research on how agents change junior roles']],
  hcai: [['Clinical AI, ex-hospital ops', 'Prior-auth automation with three hospital design partners'], ['Former resident, now building', 'Ambient notes for home-care nurses'], ['Health systems strategy', 'Why hospitals buy AI and never switch it on']],
  founders: [['Second startup, first MBA', 'An AI tool for construction estimates'], ['Searching for a company to buy', 'A search fund, focused on vertical software'], ['Pre-seed, consumer', 'A social app for running clubs'], ['Angel investor, mostly AI infra', 'Writing small checks into student founders']],
  fintech: [['Ex-payments PM', 'Stablecoin payouts for gig workers'], ['Former trader, curious about crypto', 'Figuring out what onchain finance is actually for']],
  robotics: [['Mechanical engineer turned MBA', 'Warehouse robots that learn new tasks in a day'], ['Chip industry, five years', 'Why compute is the new oil']],
  bio: [['Synthetic biologist', 'Yeast that makes rare medicines'], ['Ex-biotech BD', 'Lab automation for small biotechs']],
  consumer: [['Ex-growth at a social app', 'A friend app for people new to a city'], ['Creator economy nerd', 'Tools for creators to run real businesses']],
  vc: [['Pre-MBA at a seed fund', 'Writing about why good founders get passed on'], ['Former banker, future investor', 'Learning how funds really work']],
  product: [['Product designer', 'Making AI products feel less like a chat box'], ['PM, fintech and marketplaces', 'Prototyping everything before writing a spec']],
  climate: [['Grid nerd, ex-utility engineer', 'Software for grid interconnection queues'], ['Climate fintech', 'Financing heat pumps for renters'], ['EVs and fleets', 'Charging for delivery fleets in Somerville']]
};
const PLANS = ['ship a beta to ten real users', 'raise a pre-seed round', 'run my first marathon', 'learn to cook five real dinners', 'land a founding PM role', 'read a book a week', 'finish my thesis without losing my mind', 'take one trip with no laptop'];
const DREAMS = ['open a tiny bookstore with a great coffee bar', 'build a company my kids would be proud of', 'teach a class on building with AI', 'live in three countries', 'fix how hospitals buy software', 'put solar on every school roof in my hometown', 'write a novel, finally'];
const LIFE = ['the best hike within two hours of Boston', 'my sourdough, at your own risk', 'the 14 restaurants on my list', 'climbing in a city with no mountains', 'the concert I flew across the world for', 'my very competitive board game night'];

// people from all over both schools, with the business schools a little heavier
const PROGRAMS = { harvard: ['Business School', 'Business School', 'Business School', 'College', 'Kennedy School', 'Medical School', 'Engineering (SEAS)', 'Law School', 'Arts & Sciences (PhD)'],
  mit: ['Sloan', 'Sloan', 'Sloan', 'Engineering', 'Computing (EECS)', 'Media Lab', 'Science', 'Undergraduate'] };
const DOMAIN = { 'Business School': 'mba2028.hbs.edu', College: 'college.harvard.edu', 'Kennedy School': 'hks.harvard.edu', 'Law School': 'law.harvard.edu', 'Medical School': 'hms.harvard.edu' };
const classOf = (program) => (/College|Undergraduate/.test(program) ? pick(['Class of 2027', 'Class of 2028', 'Class of 2029']) : /PhD|Science|Media Lab/.test(program) ? 'PhD or postdoc' : pick(['Class of 2027', 'Class of 2028']));
function makeMember(i) {
  const school = i % 2 ? 'mit' : 'harvard', program = i === 0 ? 'Business School' : pick(PROGRAMS[school]);
  const m = S.newMember(NAMES[i], NAMES[i].split(' ')[0].toLowerCase() + '@' + (school === 'mit' ? 'mit.edu' : DOMAIN[program] || 'g.harvard.edu'), school, 'seed');
  m.verified = true; m.verifiedAt = new Date().toISOString();
  const tr = i === 0 ? 'genai' : pick(['genai', 'genai', 'genai', 'hcai', 'founders', 'founders', 'climate', 'fintech', 'robotics', 'bio', 'consumer', 'vc', 'product']), tracks = r() < 0.3 ? [tr, pick(SX.TRACKS.map((t) => t.id).filter((x) => x !== tr))] : [tr];
  const ints = some(SX.INTS.filter((x) => x.tr === tr).map((x) => x.id), 3 + Math.floor(r() * 2));
  S.saveProfile(m, { first: m.first, school, program, year: i === 0 ? 'Class of 2028' : classOf(program), profile: {
    tracks, interests: ints, lens: pick(['build', 'build', 'fund', 'run', 'run', 'study', 'pivot']), before: pick(SX.BEFORE),
    takes: { track: pick(['agree', 'disagree', 'depends']), code: pick(['agree', 'disagree']), lab: pick(['agree', 'disagree', 'depends']) },
    answers: { 0: Math.floor(r() * 4), 1: Math.floor(r() * 4), 2: Math.floor(r() * 4), 3: Math.floor(r() * 4) },
    rhythm: pick(SX.RHYTHM)[0], life: some(SX.LIFE, 1 + Math.floor(r() * 2)), acts: some(SX.ACTS, 2 + Math.floor(r() * 2)), look: pick(SX.LOOK).id,
    askWork: pick(WORK[tr]), askLife: pick(LIFE), diet: r() < 0.15 ? [pick(SX.DIETS)] : [],
    headline: (i === 0 ? HEAD.genai[0] : pick(HEAD[tr]))[0], building: (i === 0 ? HEAD.genai[0] : pick(HEAD[tr]))[1], openTo: some(SX.OPEN_TO, 1 + Math.floor(r() * 3)),
    links: ['https://example.com/' + NAMES[i].split(' ')[0].toLowerCase()],
    mix: i === 0 ? 'both' : pick(['both', 'both', 'both', 'topic', 'social']), perWeek: i === 0 ? 2 : 1 + Math.floor(r() * 4), next: i === 0 ? ['Start a company', 'Join a startup'] : [pick(SX.NEXT)],
    plan: i === 0 ? 'ship the eval harness to ten teams' : pick(PLANS), dream: i === 0 ? 'teach a class on building with AI' : pick(DREAMS) }, photo: 'data:image/jpeg;base64,' + FACES[i] });
  return m;
}
const members = NAMES.map((_, i) => makeMember(i)), demo = members[0];
const holdSeats = (e, ms, back) => { db.seats[e.id] = db.seats[e.id] || {}; ms.forEach((m, k) => { db.seats[e.id][m.id] = { at: new Date(Date.now() - (back || 5) * 864e5 + k * 6e4).toISOString(), size: pick(['either', 'either', 'six', 'four']), diet: [], status: 'held' }; }); };
// spots captains book themselves (made up): through OpenTable, Resy, a call, or the restaurant's site
const venues = [['Demo Bistro', 'Massachusetts Ave, Central Square', 'Cozy booths and great dumplings', 'opentable', 'https://www.opentable.com/', '$$', false],
  ['Demo Table House', 'Main St, Kendall Square', 'One big shared table, loud in a good way', 'resy', 'https://resy.com/cities/bos', '$$', true],
  ['Demo Trattoria', 'Prospect St, Central Square', 'Candles, fresh pasta, quiet corners', 'phone', '', '$$$', false],
  ['Demo Supper Room', 'Brattle St, Harvard Square', 'Old wood, small plates, a back room for six', 'web', 'https://example.com/', '$$', false]];
// partner restaurants (made up). In the demo they're open every evening, since sample dates can land on a weekend. Tables are
// placed at them automatically when they're published.
// the people who run it: an ops lead and a campus lead take turns being on duty (made up)
S.saveOps({ team: [{ name: 'Demo Ops Lead', role: 'ops lead' }, { name: 'Demo Campus Lead', role: 'campus lead (MIT)' }], rota: {} });
venues.forEach(([name, address, vibe, bookVia, bookUrl, price, card], k) => S.savePlace({ name, address, vibe, mode: 'captain', bookVia, bookUrl, price, card, phone: bookVia === 'phone' ? '(617) 555-01' + (40 + k) : '', area: address.split(', ')[1], nights: [0, 1, 2, 3, 4, 5, 6], tables: 3, seats: 6, contact: 'the host stand', note: 'Ask for the Hash Table table' }));

const ago = (h) => new Date(Date.now() - h * 36e5).toISOString();
const firstWith = (tr, not) => members.find((m) => m.profile.tracks[0] === tr && m !== demo && (!not || not.indexOf(m) < 0));

// 1. a week ago: a dinner, done, with picks in (Jordan and two tablemates picked each other)
const weekly = (e) => { Object.assign(db.events[e.id], { meal: 'dinner', generated: true }); return e; };
const past = weekly(S.createEvent({ type: 'topic', date: day(-7), time: '19:00' }));
holdSeats(past, members.slice(0, 30), 20);
S.draft({ event: past.id }); S.publish({ event: past.id });
Object.values(db.tables).filter((t) => t.eventId === past.id).forEach((t, k) => {
  t.ids.forEach((id) => { if (r() < 0.6) db.chats[t.id].push({ id: 'x' + id + t.id, from: id, text: pick(['Mine planned my whole week and forgot Thursday exists.', 'Ha. Same.', 'Can’t wait for Wednesday.', 'Okay, I have a strong opinion on round two already.']), at: new Date(Date.now() - 8 * 864e5).toISOString() }); });
});
const pastTable = Object.values(db.tables).find((t) => t.eventId === past.id && t.ids.indexOf(demo.id) >= 0);
const demoTwo = pastTable.ids.filter((x) => x !== demo.id).slice(0, 2); // Jordan and these two picked each other
Object.values(db.tables).filter((t) => t.eventId === past.id).forEach((t) => t.ids.forEach((id) => {
  const others = t.ids.filter((x) => x !== id);
  let picks = some(others, Math.floor(r() * 3));
  if (t === pastTable) { if (id === demo.id) picks = demoTwo; else if (demoTwo.indexOf(id) >= 0) picks = picks.concat([demo.id]); }
  S.feedback(db.members[id], { table: t.id, attended: t === pastTable || r() > 0.05, rating: 3 + Math.floor(r() * 3), picks: Array.from(new Set(picks)), again: false }); // round two comes below
}));
const friends = demoTwo;
friends.forEach((f, k) => { const key = pk(demo.id, f); db.dms[key] = [{ id: 'dm' + k, from: f, text: k ? 'That napkin startup was better than half the decks I’ve read this year.' : 'Coffee in Central next week?', at: new Date(Date.now() - 5 * 864e5).toISOString() }]; });

// 2. this week: Charlie's invitations are out, a career dinner in two days and a social dinner in four
const soon = weekly(S.createEvent({ type: 'topic', date: day(2), time: '19:00' }));
holdSeats(soon, [demo].concat(members.slice(1, 40).filter((m, i) => i % 3 !== 0)), 6);
S.draft({ event: soon.id }); S.publish({ event: soon.id });
Object.values(db.tables).filter((t) => t.eventId === soon.id).forEach((t, k) => {
  t.ids.slice(1, 4).forEach((id, j) => db.chats[t.id].push({ id: 'y' + id, from: id, text: ['Mine wrote a unit test that tested nothing. Very confidently.', 'It summarized a case for me and I didn’t check it. The cold call went… fine.', 'Looking forward to this one.'][j], at: new Date(Date.now() - 3600e3 * (5 - j)).toISOString() }));
});

// Jordan said they're happy to be a captain, and it's Jordan's turn at this week's tech table
demo.captain = 'yes';
{ const jt = Object.values(db.tables).find((t) => t.eventId === soon.id && t.ids.indexOf(demo.id) >= 0); if (jt) { jt.captain = demo.id; demo.captainAt = ago(2); jt.cap = { spot: null, nudges: [], checks: null, salutes: {}, hadChoice: S.spotOptions(jt).length > 1, briefed: demo.id }; } }
// tonight's question: most of Jordan's tech table has voted already, so Jordan's vote (and one more) settles it
Object.values(db.tables).filter((t) => t.eventId === soon.id && t.game).forEach((t) => {
  const others = t.ids.filter((id) => id !== demo.id), early = others.slice(0, Math.max(0, others.length - 1));
  early.forEach((id, k) => S.playGame(db.members[id], { table: t.id, act: 'vote', card: t.game.cards[[0, 1, 0, 2, 1][k % 5]] }));
});

const social = S.createEvent({ type: 'kindred', date: day(4), time: '19:00' }); Object.assign(db.events[social.id], { meal: 'dinner', generated: true });
holdSeats(social, [demo].concat(members.slice(1, 40).filter((m, i) => i % 3 !== 1)), 6);
S.draft({ event: social.id }); S.publish({ event: social.id });
Object.values(db.tables).filter((t) => t.eventId === past.id && t.ids.indexOf(demo.id) >= 0).forEach((t) => { demo.read['inv:' + t.id] = ago(24 * 8); });
// a second tech night and a second social night this week, without Jordan and with open chairs (tables of five), so someone who
// can't make their night can be moved to another one
const tech2 = weekly(S.createEvent({ type: 'topic', date: day(3), time: '19:00' }));
holdSeats(tech2, members.slice(1, 40).filter((m, i) => i % 4 === 1 || i % 4 === 2).slice(0, 10), 4);
S.draft({ event: tech2.id }); S.publish({ event: tech2.id });
const social2 = weekly(S.createEvent({ type: 'kindred', date: day(5), time: '19:00' }));
holdSeats(social2, members.slice(1, 40).filter((m, i) => i % 4 === 3 || i % 4 === 0).slice(0, 10), 4);
S.draft({ event: social2.id }); S.publish({ event: social2.id });

// round two: most of Jordan's table from a week ago said yes the morning after, so Charlie booked the same table again, two
// weeks on (in seven days, the same spot). Booked after this week's tables, so it skips anyone who already has a dinner that night.
// Jordan and two tablemates each left a line for their next table, which their next tables see.
{
  const fb = db.feedback[pastTable.id], ids = pastTable.ids, need = Math.max(3, Math.ceil(ids.length * 0.6));
  [demo.id].concat(demoTwo, ids.filter((x) => x !== demo.id && demoTwo.indexOf(x) < 0)).slice(0, need + 1).forEach((id) => { if (fb[id]) fb[id].again = true; });
  const start = new Date(S.eventTimes(past).start).toISOString(), LINES = ['ship the eval harness to two more teams', 'email my old manager about the pilot', 'run the Charles loop under 30 minutes', 'finish the grant draft'];
  [demo.id].concat(ids.filter((x) => x !== demo.id).slice(0, 3)).forEach((id, k) => { db.members[id].loose = [{ id: 'l' + k, text: LINES[k], from: pastTable.id, start, at: ago(24 * 7 + k) }]; });
  // last time's question, played out: a 4 to 2 split, and one of them changed their mind by the morning
  const card = SX.CARDS.find((c) => c.tr.indexOf('genai') >= 0 && c.k === 'take') || SX.CARDS[0], ps = Date.parse(start);
  pastTable.game = { cards: [card.id], votes: {}, pick: card.id, snap: JSON.parse(JSON.stringify(card)), sides: {}, guess: {}, final: {}, voteBy: ps - 864e5, pickedAt: ps - 864e5, by: 'table', revealed: true, revealedAt: ps, notes: { sealed: true, morning: true } };
  ids.forEach((id, k) => { pastTable.game.sides[id] = k % 3 ? 'a' : 'b'; pastTable.game.final[id] = k === 2 ? (k % 3 ? 'b' : 'a') : pastTable.game.sides[id]; });
  // Jordan captained that one and did all three missions, so Jordan already has a stripe (and three thank-yous)
  pastTable.captain = demo.id; pastTable.game.turnout = ids.length;
  const sp = Object.values(db.places)[0];
  pastTable.venue = { pid: sp.id, name: sp.name, address: sp.address, note: 'Booked under ' + demo.name };
  pastTable.cap = { booking: { pid: sp.id, at: ago(24 * 9), size: ids.length, warned: ids.length, time: '19:00', name: demo.name, code: '', via: sp.bookVia }, spot: { vid: sp.id, at: ago(24 * 9), booked: true }, nudges: [ago(24 * 8)], checks: { at: ago(24 * 7) }, salutes: {}, hadChoice: true, briefed: demo.id, thanked: true };
  ids.filter((x) => x !== demo.id).slice(0, 3).forEach((id, k) => { pastTable.cap.salutes[id] = ago(24 * 6 + k); });
  const nt = S.roundTwo(pastTable);
  if (nt) { demo.read['inv:' + nt.id] = ago(24 * 6); nt.ids.filter((id) => id !== demo.id).slice(0, 2).forEach((id, j) => db.chats[nt.id].push({ id: 'r' + j, from: id, text: ['Round two! I have a rebuttal ready.', 'Same seat as last time, I’m calling it.'][j], at: ago(30 - j * 6) })); }
}
// an industry table next week: a guest from the industry, open to captains with a stripe for the first 48 hours (Jordan has one)
S.createEvent({ type: 'topic', date: day(9), time: '19:00', area: 'Kendall Square', industry: true, guest: 'A seed-fund partner (sample guest)', role: 'Invests in early AI teams. Made up for the demo', about: 'No pitching: what investors actually look for in a first AI hire, and what they get wrong' });
// the other captains already booked their tables (made up); Jordan's waits for Jordan
Object.values(db.tables).filter((t) => t.published && !t.closed && !t.venue && t.captain && t.captain !== demo.id && db.events[t.eventId] && S.eventTimes(db.events[t.eventId]).start > Date.now() + 2 * 36e5).forEach((t, k) => {
  const opts = S.spotOptions(t).filter((o) => o.kind === 'book'), c = db.members[t.captain]; if (!opts.length || !c) return;
  try { S.captainBook(c, { table: t.id, place: opts[k % opts.length].id, time: db.events[t.eventId].time, name: c.name }); } catch (e) {}
});
// the long table at the end of the month: some of Jordan's people already said they're in (Jordan hasn't yet)
const month = S.monthNow(); db.long[month] = {};
db.longSpot[month] = { name: 'The Demo Loft', address: 'Main St, Kendall Square', note: 'Upstairs, one long table' };
members.slice(1).filter((m, i) => i % 3 === 0 || demoTwo.indexOf(m.id) >= 0).forEach((m, k) => { db.long[month][m.id] = ago(40 - k); });

// 3. next week: most people have marked their evenings and how many dinners they want (Jordan: two)
const week = S.targetWeek(), eve = (d) => S.addDays(week, d) + '|dinner';
members.slice(1).forEach((m, i) => { if (i % 6 === 5) return; S.setAvail(m, { slots: some([0, 1, 2, 3, 4], 2 + (i % 3)).map(eve), max: 1 + (i % 4) }, true); });
S.setAvail(demo, { slots: [eve(1), eve(3)], max: 2 }, true);

// 4. hangs members started (generic places, made-up plans); Jordan is in for the climate lunch
const at = (n, hm) => ({ date: S.ymdTz(Date.now() + n * 864e5), time: hm });
const POPS = [
  [firstWith('genai'), Object.assign({ title: 'Agents and ramen', place: 'A ramen spot in Central Square', kind: 'topic', track: 'genai', size: 6, note: 'Bring one agent demo that broke on you. We trade war stories.' }, at(1, '19:00')), [3, 7, 11]],
  [firstWith('hcai'), Object.assign({ title: 'Morning walk by the river', place: 'Along the Charles, from the Weeks Footbridge', kind: 'social', vibe: 'walk', size: 4, note: 'An easy 45-minute walk. Coffee after if people want.' }, at(2, '08:30')), [12]],
  [members[9], Object.assign({ title: 'Board games and dumplings', place: 'A dumpling place in Central Square', kind: 'social', vibe: 'games', size: 6, note: 'I’ll bring Codenames. Beginners very welcome.' }, at(1, '20:00')), [2, 14]],
  [members[17], Object.assign({ title: 'Cowork morning', place: 'A cafe near Kendall with big tables', kind: 'social', vibe: 'cowork', size: 5, note: 'Two quiet hours of work, then lunch together.' }, at(6, '10:00')), [6]],
  [firstWith('climate'), Object.assign({ title: 'Climate lunch at Kendall', place: 'Kendall Square, outdoor tables by the T', kind: 'topic', track: 'climate', size: 6, note: 'Grab food anywhere and meet at the tables. Grid, heat pumps, all of it.' }, at(3, '12:15')), [0, 15, 19, 23]],
  [firstWith('founders'), Object.assign({ title: 'First-time founders, honest edition', place: 'A café in Harvard Square', kind: 'topic', track: 'founders', size: 5, note: 'What is actually hard about starting while in school. No pitching.' }, at(5, '16:00')), [8, 16, 20]]
];
POPS.forEach(([host, b, joiners]) => { const id = S.createPop(host, b).id; joiners.map((k) => members[k]).filter((m) => m && m !== host).forEach((m) => S.joinPop(m, { id })); });
// each hang's question: the people in it have mostly voted; on Jordan's climate lunch everyone but Jordan has, so Jordan's vote settles it
Object.values(db.pops).forEach((u) => {
  if (!u.game) return;
  const ids = [u.host].concat(u.joined), voters = ids.indexOf(demo.id) >= 0 ? ids.filter((id) => id !== demo.id) : ids.slice(0, -1);
  voters.forEach((id, k) => S.playGame(db.members[id], { pop: u.id, act: 'vote', card: u.game.cards[[0, 1, 0, 2][k % 4]] }));
});
// 5. the Board: sample roles at made-up companies (marked sample), some posted by members who can refer
const hcaiPoster = firstWith('hcai'), climatePoster = firstWith('climate'), foundersPoster = firstWith('founders'), genaiPoster = firstWith('genai');
const ROLES = [
  [demo, { title: 'Founding PM, agent workflows', company: 'Orchard Agents', track: 'genai', kind: 'Founding team', role: 'Product', stage: 'Seed', location: 'Kendall Square', comp: '$150–180k + 0.5–1%', refer: true,
    about: 'Eight engineers, two design partners, no PM yet. You would own the roadmap for agents that run back-office work for mid-size companies.', note: 'I advise them. They want someone who has shipped B2B and can hold their own with engineers. Happy to intro.' }, 5],
  [null, { title: 'Summer 2027 PM intern, evals platform', company: 'Ferrite Labs', track: 'genai', kind: 'Internship', role: 'Product', stage: 'Series A', location: 'New York or remote', comp: '$9k / month',
    about: 'Twelve weeks on the team that measures whether AI agents actually work. MBA interns own one customer-facing feature end to end.' }, 20],
  [genaiPoster, { title: 'Product engineer, LLM apps (TypeScript)', company: 'Brightwork', track: 'genai', kind: 'Full-time', role: 'Engineering', stage: 'Seed', location: 'Boston', comp: '$160–190k + equity', refer: true,
    about: 'Small team building AI copilots for field-service companies. You ship every day.', note: 'I was employee #3 before school. Fast, kind team. Ask me anything.' }, 30],
  [null, { title: 'Strategy & Ops lead, enterprise agents', company: 'Plinth AI', track: 'genai', kind: 'Full-time', role: 'BizOps & Strategy', stage: 'Series B+', location: 'San Francisco or Boston', comp: '$170–200k',
    about: 'Own pricing, partnerships and the operating cadence for a 120-person AI company selling to banks and insurers.' }, 52],
  [hcaiPoster, { title: 'Clinical AI PM, prior authorization', company: 'Quayside Health', track: 'hcai', kind: 'Full-time', role: 'Product', stage: 'Series A', location: 'Longwood, Boston', comp: '$165–190k', refer: true,
    about: 'Automating prior auth for three health systems. You would sit between clinicians, payers and the ML team.', note: 'Their head of product is an HBS alum. Best place I know to learn how hospitals actually buy.' }, 9],
  [null, { title: 'Health AI venture fellow (10 hrs a week)', company: 'Marrow Ventures', track: 'hcai', kind: 'Fellowship', role: 'Venture', stage: 'Pre-seed', location: 'Boston', comp: 'Stipend',
    about: 'Source and diligence pre-seed health AI companies with the partners. Open to current Harvard and MIT students.' }, 70],
  [null, { title: 'Summer 2027 strategy intern, AI drug discovery', company: 'Sundial Bio', track: 'hcai', kind: 'Internship', role: 'BizOps & Strategy', stage: 'Series B+', location: 'Cambridge', comp: '$8.5k / month',
    about: 'Help decide which programs to partner out and which to build. Science background helpful, not required.' }, 96],
  [foundersPoster, { title: 'Chief of Staff to a second-time founder', company: 'Stealth', track: 'founders', kind: 'Founding team', role: 'Chief of Staff', stage: 'Pre-seed', location: 'Boston', comp: '$140k + 1%', refer: true,
    about: 'AI for construction estimates. Founder sold her last company. You run everything that is not engineering.', note: 'The founder is a friend. She wants an MBA who likes chaos and can sell.' }, 14],
  [null, { title: 'Investor, early-stage AI', company: 'Bramble Capital', track: 'founders', kind: 'Full-time', role: 'Venture', stage: 'Growth', location: 'Boston or New York', comp: 'Competitive',
    about: 'Join a four-person seed team. You will lead sourcing in applied AI and sit on boards within two years.' }, 120],
  [null, { title: 'Student venture partner (Harvard or MIT)', company: 'Riverbend Fund', track: 'founders', kind: 'Part-time', role: 'Venture', stage: 'Pre-seed', location: 'Cambridge', comp: 'Carry pool',
    about: 'Find the best student founders on both sides of the river. Five hours a week, real check-writing input.' }, 40],
  [null, { title: 'Associate, search fund', company: 'Kestrel Search Partners', track: 'founders', kind: 'Full-time', role: 'Operations', stage: '', location: 'Boston', comp: '$130–150k + carry',
    about: 'Help two searchers find and buy a vertical software company, then run it with them.' }, 160],
  [climatePoster, { title: 'PM, grid interconnection software', company: 'Kiln Energy', track: 'climate', kind: 'Full-time', role: 'Product', stage: 'Series A', location: 'Boston', comp: '$155–175k', refer: true,
    about: 'Interconnection queues hold back most new clean power. Kiln builds the software utilities use to clear them.', note: 'This is the bottleneck nobody talks about. Great team, and they hire MBAs.' }, 26],
  [null, { title: 'Summer 2027 BizOps intern, carbon removal', company: 'Basalt Works', track: 'climate', kind: 'Internship', role: 'BizOps & Strategy', stage: 'Seed', location: 'Remote', comp: '$8k / month',
    about: 'Build the buyer pipeline and pricing model for verified carbon removal credits.' }, 60],
  [null, { title: 'Founding BizOps, EV fleet charging', company: 'Voltair', track: 'climate', kind: 'Founding team', role: 'Operations', stage: 'Seed', location: 'Somerville', comp: '$135–150k + equity',
    about: 'First non-engineering hire. Sales, operations, and the first ten fleet customers.' }, 75]
];
const roleIds = ROLES.map(([by, j, hoursAgo]) => { const id = S.postJob(by, Object.assign({ sample: true }, j)).id; db.jobs[id].at = ago(hoursAgo); db.jobs[id].sample = true; return id; });
members.slice(4, 18).forEach((m, k) => { if (k % 2) S.saveJob(m, { job: roleIds[k % roleIds.length] }); });
S.saveJob(demo, { job: roleIds[4] });
// someone asked Jordan for an intro to Orchard Agents (waiting for Jordan's answer)
const asker = members.find((m) => m.profile.tracks[0] === 'genai' && m !== demo && m !== genaiPoster);
S.askIntro(asker, { job: roleIds[0], note: 'Shipped two B2B AI products before school. Would love 20 minutes with the founders.' });
db.intros[db.intros.length - 1].at = ago(3);

// 6. Pulse: takes people vote on, asks, launches, reading
const authorFor = (tr, k) => members.filter((m) => m.profile.tracks[0] === tr && m !== demo)[k] || members[5 + k];
const POSTS = [
  [authorFor('genai', 1), 'take', 'Every agent startup is a services company until its eval suite says otherwise.', 'genai', 2],
  [authorFor('hcai', 1), 'ask', 'Looking for a technical cofounder in clinical AI. I have three hospital design partners and a lot of coffee. Reply or wave if curious.', 'hcai', 5],
  [demo, 'ship', 'Shipped our first eval harness for agent workflows. Pass rate went from 41% to 82% in two weeks, mostly by fixing step four.', 'genai', 9],
  [authorFor('founders', 0), 'take', 'You should start a company right out of school. The opportunity cost will never be this low again.', 'founders', 14],
  [authorFor('climate', 0), 'ship', 'First 10 paying customers for our fleet charging tool. Very manual, very fun.', 'climate', 20],
  [authorFor('hcai', 0), 'take', 'Healthcare AI’s bottleneck is procurement, not models.', 'hcai', 27],
  [authorFor('genai', 2), 'ask', 'Need five people who run a small business to try an AI bookkeeping agent for two weeks. I’ll buy dinner.', 'genai', 33],
  [authorFor('climate', 1), 'take', 'AI data centers will do more for grid buildout than a decade of policy did.', 'climate', 40],
  [authorFor('founders', 1), 'ship', 'Closed our pre-seed. Thank you to the three people from my tech table who tore the deck apart.', 'founders', 52],
  [authorFor('genai', 3), 'read', 'Reading this week: the case for small, specialized models in regulated industries. Notes in the replies.', 'genai', 61],
  [authorFor('hcai', 2), 'read', 'How hospital IT procurement actually works. The most useful 20 minutes of my semester.', 'hcai', 80],
  [authorFor('genai', 0), 'take', 'Most MBA “AI strategy” slides would be better as a working prototype.', 'genai', 100],
  [authorFor('bio', 0), 'read', 'Best explainer I’ve found on personalized gene editing, and why one baby’s treatment could change how the FDA works.', 'bio', 3, 'https://www.technologyreview.com/2026/01/12/1129999/gene-editing-base-edited-baby-personalized-drugs-2026-breakthrough-technology/'],
  [authorFor('hcai', 0), 'read', 'If you’re building for doctors, read this before your next customer call. AI scribes are the first tool clinicians actually ask for.', 'hcai', 7, 'https://www.medicaleconomics.com/view/take-note-the-ai-scribe-era-is-here'],
  [authorFor('vc', 0), 'read', 'Fortune asked a bunch of investors if the AI bubble pops this year. The disagreements are the interesting part.', 'vc', 12, 'https://fortune.com/2026/01/05/crystal-ball-will-the-ai-bubble-burst-or-balloon-in-2026/'],
  [authorFor('fintech', 0), 'read', 'Short read on why stablecoins might finally go mainstream for payments. Curious what the fintech people here think.', 'fintech', 20, 'https://www.fintechweekly.com/magazine/articles/stablecoins-mainstream-payments-genius-act-2026'],
  [authorFor('founders', 0), 'event', 'Demo night for student founders next Thursday, 6 PM, at a coworking space in Kendall. Five-minute demos, no slides. Who’s coming?', 'founders', 15],
  [authorFor('robotics', 0), 'event', 'Robotics lab open house this Saturday afternoon. They let you drive the quadruped. Going with two friends from my table, join us.', 'robotics', 26],
  [authorFor('climate', 0), 'ask', 'Anyone here worked on utility procurement? Fifteen minutes on the phone would save me a month.', 'climate', 31],
  [authorFor('product', 0), 'ask', 'Running a usability test Friday for a study app. Pizza and a gift card for 30 minutes of your time.', 'product', 44]
];
const REPLIES = ['Strong agree. Ask me about the one we killed.', 'Counterpoint at dinner on Wednesday.', 'Sending you a note.', 'This is exactly what we saw at my last job.', 'Would love the notes.', 'Congrats! Which part was hardest?'];
POSTS.forEach(([by, kind, text, track, hoursAgo, link], k) => {
  const id = S.createPost(by, { kind, text, track, link }).id, p = db.posts.find((x) => x.id === id); p.at = ago(hoursAgo);
  members.forEach((m, i) => {
    if (m === by || m === demo) return;
    if (kind === 'take' && (i + k) % 3 !== 0) S.vote(m, { post: id, side: (i * 7 + k) % 5 < 3 ? 'agree' : 'disagree' });
    if (kind !== 'take' && (i + k) % 4 === 0) S.plus(m, { post: id });
  });
  [1, 2].slice(0, k % 3).forEach((n) => { const m = members[(k * 3 + n * 5) % members.length]; if (m !== by) { S.reply(m, { post: id, text: REPLIES[(k + n) % REPLIES.length] }); p.replies[p.replies.length - 1].at = ago(hoursAgo - n * 0.5 > 0 ? hoursAgo - n * 0.5 : 0.2); } });
});

// 7. People: Jordan and someone Jordan has never sat with waved at each other, so they can talk
const stranger = members.find((m) => m.school === 'mit' && m.profile.tracks[0] === 'climate' && !S.view(demo).connections.some((c) => c.id === m.id));
if (stranger) { S.wave(demo, { id: stranger.id }); S.wave(stranger, { id: demo.id }); db.dms[pk(demo.id, stranger.id)].push({ id: 'w1', from: stranger.id, text: 'Hey! Saw your eval post. I’m working on grid software and have opinions about step four too.', at: ago(1) }); }
members.slice(20, 26).forEach((m) => S.wave(m, { id: demo.id })); // waves Jordan can't see until Jordan waves back

const club = S.newClub({ name: 'Demo Club' });
S.save(true);

console.log('Seeded ' + members.length + ' members, 3 dinners, next week’s evenings and ' + POPS.length + ' hangs.');
console.log('Open as Jordan (Harvard):  http://localhost:' + (process.env.PORT || 8800) + '/?invite=' + demo.token);
console.log('Open as ' + db.members[friends[0]].name + ':  http://localhost:' + (process.env.PORT || 8800) + '/?invite=' + db.members[friends[0]].token);
console.log('Club join link:        http://localhost:' + (process.env.PORT || 8800) + '/?join=' + club.code + '  (any Harvard or MIT email; in dev the code shows on screen)');
