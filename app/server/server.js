// Sidetable closed beta: a small real server for the Harvard × MIT pilot (a few dozen to a few hundred people).
// One Node file, no dependencies, the same shape as Amie's beta: members in one JSON file, personal invite links and
// club join links, a table assembly the admin reviews before publishing, a group chat per table, next-morning picks
// that stay private unless they are mutual, and a 1:1 chat only between two people who picked each other.
//
//   SIXTOP_ADMIN_KEY=choose-a-long-secret node server/server.js
//   then open http://localhost:8800/admin
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SX = require('../public/shared.js');
const T = require('./tables.js');

const PORT = +process.env.PORT || 8800;
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const DATA = path.resolve(process.env.SIXTOP_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROOT, 'data'));
const PUBLIC_URL = (process.env.SIXTOP_PUBLIC_URL || '').replace(/\/$/, '');
const TZ = process.env.SIXTOP_TZ || 'America/New_York';
const AREA = process.env.SIXTOP_AREA || 'Central Square';
// school email codes: 'resend' sends them through Resend (RESEND_API_KEY, SIXTOP_MAIL_FROM); 'show' puts the code on screen (local dev, the phone demo)
const MAIL_MODE = process.env.SIXTOP_MAIL === 'show' ? 'show' : 'resend';
const MAIL_FROM = process.env.SIXTOP_MAIL_FROM || '';
const PUSH_DAY = +process.env.SIXTOP_PUSH_DAY || 4;
let ADMIN = process.env.SIXTOP_ADMIN_KEY || '';
if (!ADMIN) { ADMIN = crypto.randomBytes(12).toString('hex'); if (require.main === module || process.env.SIXTOP_DEV) console.log('No SIXTOP_ADMIN_KEY set. Admin key for this run: ' + ADMIN); }
const PHOTOS = path.join(DATA, 'photos');
fs.mkdirSync(PHOTOS, { recursive: true });
const PUSH = require('./push.js')({ dir: DATA, allowHttp: process.env.SIXTOP_PUSH_HTTP === '1' });
const HOUR = 36e5, DAY = 24 * HOUR;

/* ---------- storage: one JSON file, written atomically ---------- */
const DBF = path.join(DATA, 'db.json');
const fresh = () => ({ v: 1, members: {}, clubs: {}, events: {}, seats: {}, tables: {}, chats: {}, dms: {}, feedback: {}, reports: [], log: [],
  jobs: {}, saves: {}, intros: [], posts: [], waves: {}, links: {}, pops: {}, weeks: {}, verify: {}, long: {}, places: {}, longSpot: {}, bookings: {}, ops: {}, alerts: [], longWait: {} });
let db = fresh();
try { db = Object.assign(fresh(), JSON.parse(fs.readFileSync(DBF, 'utf8'))); } catch (e) {
  // a missing file is a first run; a file that won't parse (cut off, hand-edited) is never quietly replaced by an empty one
  if (e.code !== 'ENOENT') throw new Error('db.json could not be read (' + e.message + '). Nothing was changed. Restore the newest file from ' + path.join(DATA, 'backups') + ' as db.json and start again.');
  let photos = []; try { photos = fs.readdirSync ? fs.readdirSync(path.join(DATA, 'photos')) : []; } catch (e2) {}
  if (photos.length) throw new Error('db.json is missing but ' + path.join(DATA, 'photos') + ' has photos, so this looks like lost data, not a first run. Restore db.json from ' + path.join(DATA, 'backups') + '.');
}
// the pilot started as HBS × MIT; members from then become Harvard, with their program and class split out
function migrateDb() {
  Object.values(db.members).forEach((m) => {
    if (m.school === 'hbs') { m.school = 'harvard'; if (!m.program) m.program = 'Business School'; }
    if (m.school === 'mit' && !m.program && /Sloan/.test(m.year || '')) m.program = 'Sloan';
    if (m.year && SX.YEARS.indexOf(m.year) < 0) { const y = /(20\d\d)/.exec(m.year); m.year = y ? 'Class of ' + y[1] : /grad student/i.test(m.year) ? 'PhD or postdoc' : ''; }
  });
  Object.values(db.verify || {}).forEach((v) => { if (v.school === 'hbs') v.school = 'harvard'; });
  Object.values(db.members).forEach((m) => { if (m.profile && typeof m.profile.next === 'string') m.profile.next = m.profile.next ? [m.profile.next] : []; });
  Object.values(db.places || {}).forEach((v) => { if (!v.key) v.key = crypto.randomBytes(12).toString('hex'); if (!v.mode) v.mode = 'hold'; });
}
migrateDb();
let saveTimer = null, lazyTimer = null, lastBackup = '';
function backup() {
  const day = ymdTz(Date.now()); if (lastBackup === day || !fs.copyFileSync || !fs.existsSync(DBF)) return;
  const dir = path.join(DATA, 'backups'), to = path.join(dir, 'db-' + day + '.json');
  try { fs.mkdirSync(dir, { recursive: true }); if (!fs.existsSync(to)) fs.copyFileSync(DBF, to); fs.readdirSync(dir).filter((x) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().slice(0, -14).forEach((x) => fs.unlinkSync(path.join(dir, x))); lastBackup = day; } catch (e) { console.error('backup failed', e.message); }
}
// read marks and other small changes from GETs: written within a few seconds, not on every poll
function saveSoon() { if (!lazyTimer) { lazyTimer = setTimeout(() => { lazyTimer = null; save(); }, 5000); if (lazyTimer.unref) lazyTimer.unref(); } }
function save(now) {
  const write = () => { saveTimer = null; backup(); const tmp = DBF + '.tmp'; try { fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DBF); } catch (e) { console.error('save failed, retrying', e.message); if (!saveTimer) saveTimer = setTimeout(write, 1000); } };
  if (now) { if (saveTimer) clearTimeout(saveTimer); return write(); }
  if (!saveTimer) saveTimer = setTimeout(write, 200);
}
const rid = (n) => crypto.randomBytes(n).toString('hex');
const own = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
const arr = (v) => (Array.isArray(v) ? v : []);
const pk = T.pk;
function fail(msg) { const e = new Error(msg); e.user = true; throw e; }

/* ---------- time, in the club's time zone ---------- */
const ZF = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function zoned(ms) {
  const o = {}; ZF.formatToParts(new Date(ms)).forEach((p) => { o[p.type] = p.value; });
  return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour, mi: +o.minute };
}
function tzMs(date, time) {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number), want = Date.UTC(y, mo - 1, d, h, mi);
  let t = want; for (let i = 0; i < 3; i++) { const z = zoned(t); t += want - Date.UTC(z.y, z.mo - 1, z.d, z.h, z.mi); }
  return t;
}
const FMTS = new Map();
const fmt = (ms, o) => { const k = JSON.stringify(o); let F = FMTS.get(k); if (!F) FMTS.set(k, (F = new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: TZ }, o)))); return F.format(new Date(ms)); };
const dayLabel = (ms) => fmt(ms, { weekday: 'long', month: 'short', day: 'numeric' });
const shortLabel = (ms) => fmt(ms, { weekday: 'short', month: 'short', day: 'numeric' });
const timeLabel = (ms) => fmt(ms, { hour: 'numeric', minute: '2-digit' });
const weekday = (ms) => fmt(ms, { weekday: 'long' });

/* ---------- members ---------- */
const byToken = (t) => { if (!t || !/^[a-f0-9]{32}$/.test(t)) return null; for (const id in db.members) { const m = db.members[id]; if (m.token === t && !m.deleted) return m; } return null; };
const live = () => Object.values(db.members).filter((m) => !m.deleted);
const firstOf = (m) => (m && (m.first || String(m.name || '').split(' ')[0])) || '';
const lastInitial = (m) => { const w = String(m.name || '').trim().split(/\s+/); return w.length > 1 ? w[w.length - 1][0].toUpperCase() + '.' : ''; };
const done = (m) => !!(m && m.profile && m.profile.done);
function newMember(name, email, school, via) {
  const nm = oneLine(clip(name, 80)); if (nm.length < 2) fail('name required');
  const id = 'm' + rid(4), m = { id, token: rid(16), name: nm, first: nm.split(' ')[0], email: clip(email, 120).toLowerCase().trim(), school: SX.SCHOOLS[school] ? school : '', program: '', year: '', via, createdAt: new Date().toISOString(), never: {}, read: {}, prio: 0 };
  db.members[id] = m; return m;
}
const inviteLink = (m) => PUBLIC_URL + '/?invite=' + m.token;
const oneLine = (v) => String(v || '').replace(/\s+/g, ' ').trim();
/* ---------- school email: every member proves a Harvard or MIT address with a 6-digit code ---------- */
function schoolOfEmail(email) {
  const e = String(email || '').toLowerCase().trim(); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)) return null;
  const dom = e.split('@')[1];
  return Object.keys(SX.SCHOOLS).find((k) => SX.SCHOOLS[k].domains.some((d) => dom === d || dom.endsWith('.' + d))) || null;
}
async function sendCode(email, code) {
  if (MAIL_MODE === 'show') return { show: code };
  if (!process.env.RESEND_API_KEY || !MAIL_FROM) fail('email isn’t set up yet, so ask the organizer');
  const text = 'Your Sidetable code is ' + code + '\n\nIt works for 15 minutes. If you didn’t ask for it, you can ignore this email.';
  const r = await resend(email, code + ' is your Sidetable code', text).catch((e) => { console.error('code mail failed', e.message); return { ok: false }; });
  if (!r.ok) fail('the email didn’t go out, so try again in a minute');
  return {};
}
// who the code is for: the member signed in on this link, a member signing in on a new phone, or someone new from a club link
async function startVerify(me, b) {
  const email = clip(b && b.email, 120).toLowerCase().trim(), school = schoolOfEmail(email);
  if (!school) fail('use your Harvard or MIT email');
  const owner = live().find((m) => m.verified && m.email === email);
  let who;
  if (me) { if (owner && owner.id !== me.id) fail('that email belongs to another member'); who = { kind: 'member', id: me.id }; }
  else if (owner) who = { kind: 'signin', id: owner.id };
  else {
    const c = own(db.clubs, clip(b.code, 20)); if (!c || c.off) fail('Sidetable is invite-only for now, so open the link from your club');
    const name = oneLine(clip(b.name, 80)); if (name.split(' ').length < 2) fail('your full name, please');
    who = { kind: 'join', club: c.code, name };
  }
  const prev = db.verify[email], now = Date.now(); if (prev && now - prev.sentAt < 30000) fail('a code is on its way, so wait 30 seconds before asking again');
  const fresh = !prev || now - (prev.firstAt || prev.sentAt) >= HOUR, sends = fresh ? 1 : (prev.sends || 1) + 1; if (sends > 6) fail('that’s a lot of codes, so try again in an hour');
  const code = String(100000 + (parseInt(crypto.randomBytes(4).toString('hex'), 16) % 900000));
  db.verify[email] = Object.assign({ code, exp: now + 15 * 60000, tries: fresh ? 0 : prev.tries || 0, sentAt: now, firstAt: fresh ? now : prev.firstAt || prev.sentAt, sends, school }, who);
  let r; try { r = await sendCode(email, code); } catch (e) { delete db.verify[email]; throw e; }
  return Object.assign({ ok: true, email, school }, r.show ? { devCode: r.show } : {});
}
function finishVerify(me, b) {
  const email = clip(b && b.email, 120).toLowerCase().trim(), v = db.verify[email], code = String((b && b.code) || '').replace(/\D/g, '');
  if (!v || Date.now() > v.exp) fail('that code expired, so ask for a new one');
  if (v.tries >= 5) fail('too many tries, so try again in an hour');
  if (code.length !== 6 || !crypto.timingSafeEqual(Buffer.from(code), Buffer.from(v.code))) { v.tries++; fail('that code doesn’t match'); }
  delete db.verify[email];
  let m;
  if (v.kind === 'join') { m = newMember(v.name, email, v.school, 'club:' + v.club); const c = db.clubs[v.club]; if (c) c.uses = (c.uses || 0) + 1; log('join', m.id, c ? c.name : ''); }
  else { m = db.members[v.id]; if (!m || m.deleted || (v.kind === 'member' && (!me || me.id !== m.id))) fail('open your link again'); }
  if (m.school !== v.school) { m.school = v.school; m.program = ''; }
  if (v.kind === 'member' && !m.verified) m.token = rid(16);
  m.email = email; m.verified = true; m.verifiedAt = new Date().toISOString();
  if (v.kind === 'signin') log('signin', m.id);
  return { token: m.token };
}

/* ---------- the profile ---------- */
const inList = (v, list) => (list.indexOf(v) >= 0 ? v : null);
function cleanUrl(v) { const s = clip(v, 200).trim(); if (!s) return ''; const u = /^https?:\/\//i.test(s) ? s : 'https://' + s; try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.indexOf('.') > 0 ? x.href : ''; } catch (e) { return ''; } }
const trOf = (i) => (SX.INTS.find((x) => x.id === i) || {}).tr;
function cleanProfile(b) {
  b = b || {};
  const tracks = arr(b.tracks).filter((t, i, a) => SX.TRACKS.some((x) => x.id === t) && a.indexOf(t) === i).slice(0, 2);
  const interests = arr(b.interests).filter((i, k, a) => SX.INTNAME[i] && tracks.indexOf(trOf(i)) >= 0 && a.indexOf(i) === k).slice(0, 5);
  const st = ['agree', 'disagree', 'depends'], takes = {};
  ['track', 'code', 'lab'].forEach((k) => { if (b.takes && inList(b.takes[k], st)) takes[k] = b.takes[k]; });
  const answers = {};
  SX.QS.forEach((q, qi) => { const v = b.answers ? +b.answers[qi] : NaN; if (v >= 0 && v < q.o.length && Number.isInteger(v)) answers[qi] = v; });
  const p = {
    tracks, interests, lens: inList(b.lens, SX.LENS.map((l) => l.id)), before: inList(b.before, SX.BEFORE), takes, answers,
    rhythm: inList(b.rhythm, SX.RHYTHM.map((r) => r[0])), life: arr(b.life).filter((x) => SX.LIFE.indexOf(x) >= 0), acts: arr(b.acts).filter((x) => SX.ACTS.indexOf(x) >= 0),
    look: inList(b.look, SX.LOOK.map((l) => l.id)), askWork: clip(b.askWork, 90).trim(), askLife: clip(b.askLife, 90).trim(), diet: arr(b.diet).filter((x) => SX.DIETS.indexOf(x) >= 0),
    headline: clip(b.headline, 80).trim(), building: clip(b.building, 160).trim(), openTo: arr(b.openTo).filter((x, i, a) => SX.OPEN_TO.indexOf(x) >= 0 && a.indexOf(x) === i),
    links: arr(b.links).map((l) => cleanUrl(l)).filter(Boolean).slice(0, 2),
    mix: inList(b.mix, SX.MIX.map((x) => x.id)), perWeek: Math.max(1, Math.min(5, Math.round(+b.perWeek) || 2)),
    next: [].concat(b.next || []).filter((x, i, a) => SX.NEXT.indexOf(x) >= 0 && a.indexOf(x) === i), plan: clip(b.plan, 100).trim(), dream: clip(b.dream, 120).trim()
  };
  const tech = p.mix === 'social' || (tracks.length && interests.length >= 3 && p.lens && Object.keys(takes).length === 3);
  p.done = !!(p.mix && tech && Object.keys(answers).length === SX.QS.length && p.rhythm && p.look && p.next.length);
  return p;
}
function saveProfile(me, b) {
  const hasPhoto = b.photo === null ? false : (typeof b.photo === 'string' && b.photo.indexOf('data:') === 0) || !!me.photo;
  if (!hasPhoto) fail('add a photo of yourself so your table can find you');
  if (b.school && SX.SCHOOLS[b.school] && !me.verified) me.school = b.school; // once verified, the school follows the email
  if (b.program != null) me.program = inList(b.program, me.school ? SX.SCHOOLS[me.school].programs : []) || me.program || '';
  if (b.year != null) me.year = inList(b.year, SX.YEARS) || me.year || '';
  if (b.first) me.first = oneLine(clip(b.first, 30)) || me.first;
  me.profile = cleanProfile(b.profile);
  if (b.photo === null) { me.photo = false; try { fs.unlinkSync(path.join(PHOTOS, me.id + '.img')); } catch (e) {} }
  else if (typeof b.photo === 'string' && b.photo.indexOf('data:') === 0) {
    const mm = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.photo); if (!mm) fail('photo not recognized');
    const buf = Buffer.from(mm[2], 'base64'); if (buf.length > 1.5 * 1024 * 1024) fail('photo too large');
    const hx = Buffer.from(mm[2].slice(0, 16), 'base64').toString('hex'); // the first twelve bytes
    const magic = { jpeg: hx.indexOf('ffd8') === 0, png: hx.indexOf('89504e47') === 0, webp: hx.indexOf('52494646') === 0 && hx.slice(16, 24) === '57454250' };
    if (!magic[mm[1]]) fail('photo not recognized');
    fs.writeFileSync(path.join(PHOTOS, me.id + '.img'), buf); me.photo = true; me.photoType = mm[1];
  }
  if (me.profile.done && !me.joinedAt) { me.joinedAt = new Date().toISOString(); log('profile', me.id); }
  me.updatedAt = new Date().toISOString();
}
function personaOf(m) { return SX.persona(SX.codeOf(SX.axes(m.profile && m.profile.answers))); }

/* ---------- events and seats ---------- */
function addDays(date, n) { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
const ETIMES = new Map();
function eventTimes(e) {
  const k = e.date + '|' + e.time + '|' + (e.closesAt || '') + '|' + (e.meal || ''); if (ETIMES.has(k)) return ETIMES.get(k);
  const v = eventTimes1(e); if (ETIMES.size > 20000) ETIMES.clear(); ETIMES.set(k, v); return v;
}
function eventTimes1(e) {
  const start = tzMs(e.date, e.time);
  // seats close three nights before (club time), tables go out the next day, the spot at noon on the day
  return { start, closes: e.closesAt || tzMs(addDays(e.date, -3), '23:59'), reveal: e.meal === 'lunch' ? tzMs(addDays(e.date, -1), '18:00') : tzMs(e.date, '12:00'), feedback: start + 2 * HOUR, pushFeedback: tzMs(addDays(e.date, 1), '10:00') };
}

/* ---------- the week: members mark the evenings they're free and how many dinners they want (1 to 5); Charlie sends invitations ---------- */
const MEALS = { lunch: { t: 'Lunch', time: process.env.SIXTOP_LUNCH || '12:15' }, dinner: { t: 'Dinner', time: process.env.SIXTOP_DINNER || '19:00' } };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function ymdTz(ms) { const z = zoned(ms); return z.y + '-' + String(z.mo).padStart(2, '0') + '-' + String(z.d).padStart(2, '0'); }
function dowOf(date) { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
// the week people are planning: always the Monday after today (club time)
function targetWeek(nowMs) { const today = ymdTz(nowMs || Date.now()); return addDays(today, ((8 - dowOf(today)) % 7) || 7); }
const weekCloses = (week) => tzMs(addDays(week, -1), '18:00'); // Sunday 6 PM
function weekSlots(week) { const out = []; for (let d = 0; d < 5; d++) out.push(addDays(week, d) + '|dinner'); return out; }
function setAvail(me, b, force) {
  if (!done(me)) fail('finish your profile first');
  const week = targetWeek(), ok = weekSlots(week);
  if ((db.weeks[week] || {}).published) fail('tables for that week are already set');
  if (!force && process.env.SIXTOP_DEMO !== '1' && (Date.now() >= weekCloses(week) || db.weeks[week])) fail('plans for next week closed Sunday at 6 PM, so this one is set. Next week’s opens Monday');
  me.avail = { week, slots: arr(b.slots).filter((s, i, a) => ok.indexOf(s) >= 0 && a.indexOf(s) === i), max: Math.max(1, Math.min(5, Math.round(+b.max) || (me.profile && me.profile.perWeek) || 1)), at: new Date().toISOString() };
  return { ok: true };
}
// a table you already have that evening (round two, or one from an earlier week): the evening is spoken for
function hasTable(me, date) {
  const t = Object.values(db.tables).find((x) => x.published && seatedIds(x).indexOf(me.id) >= 0 && (db.events[x.eventId] || {}).date === date && db.events[x.eventId].status !== 'cancelled');
  return t ? { kind: db.events[t.eventId].type === 'kindred' ? 'social' : 'tech', round: t.round || 1 } : null;
}
function availView(me) {
  const week = targetWeek(), mine = me.avail && me.avail.week === week ? me.avail : { slots: [], max: (me.profile && me.profile.perWeek) || 1 }, w = db.weeks[week] || {};
  // your people (picked each other, or waved at each other) who marked an evening too: pick the same one and Charlie seats you together
  const pals = live().filter((o) => o.id !== me.id && done(o) && !o.paused && o.avail && o.avail.week === week && !blockedEither(me.id, o.id) && (mutualWave(me.id, o.id) || isMutual(me.id, o.id)));
  const days = [0, 1, 2, 3, 4].map((d) => { const date = addDays(week, d); return { date, dow: DOW[dowOf(date)], day: +date.slice(8), slots: [{ id: date + '|dinner', meal: 'dinner', on: mine.slots.indexOf(date + '|dinner') >= 0 }],
    pals: pals.filter((o) => o.avail.slots.indexOf(date + '|dinner') >= 0).slice(0, 3).map((o) => mini(o, me)), has: hasTable(me, date) }; });
  const start = tzMs(week, '12:00'), end = tzMs(addDays(week, 4), '12:00');
  const same = fmt(start, { month: 'short' }) === fmt(end, { month: 'short' });
  return { week, label: fmt(start, { month: 'short', day: 'numeric' }) + ' – ' + fmt(end, same ? { day: 'numeric' } : { month: 'short', day: 'numeric' }),
    closes: 'Sunday at 6 PM', open: Date.now() < weekCloses(week) && !w.published, set: !!w.published, days, max: mine.max, count: mine.slots.length,
    free: live().filter((m) => done(m) && m.avail && m.avail.week === week && m.avail.slots.length).length };
}
// Build next week's tables. Biggest evenings first; each person gets at most the number of dinners they asked for, never two
// the same night, and Charlie alternates tech tables (their corner of tech) with social tables (people they'd click with).
const pendingWeek = () => Object.keys(db.weeks).filter((k) => db.weeks[k] && !db.weeks[k].published && k >= mondayOf(ymdTz(Date.now()))).sort()[0];
function matchWeek(b) {
  b = b || {};
  const week = b.week || pendingWeek() || targetWeek(), prev = db.weeks[week];
  if (prev && prev.published) fail('this week is already published');
  if ((prev ? prev.events : []).some((eid) => (db.events[eid] || {}).status === 'published')) fail('some of this week’s tables already went out to members, so the week can’t be rebuilt. Move people by hand instead');
  (prev ? prev.events : []).forEach((eid) => { tablesOf(eid).forEach((t) => { delete db.tables[t.id]; }); delete db.events[eid]; delete db.seats[eid]; });
  const L = live().filter((m) => done(m) && !m.paused && !cooling(m) && m.avail && m.avail.week === week && m.avail.slots.length);
  const cap = {}, want = {}, usedDay = {}, pools = {}, had = {};
  L.forEach((m) => { want[m.id] = cap[m.id] = Math.min(m.avail.max || 1, m.avail.slots.length); usedDay[m.id] = {}; had[m.id] = { topic: 0, kindred: 0 }; m.avail.slots.forEach((s) => (pools[s] = pools[s] || []).push(m)); });
  // evenings someone already has a dinner on (a published table, or a seat held at a special night) stay theirs
  const weekDates = weekSlots(week).map((s) => s.split('|')[0]);
  Object.values(db.tables).forEach((t) => { const e = db.events[t.eventId]; if (!t.published || !e || e.status === 'cancelled') return; seatedIds(t).forEach((id) => { if (usedDay[id]) usedDay[id][e.date] = 1; }); });
  Object.keys(db.seats).forEach((eid) => { const e = db.events[eid]; if (!e || e.status === 'cancelled') return; Object.keys(db.seats[eid]).forEach((id) => { if (usedDay[id] && db.seats[eid][id].status === 'held') usedDay[id][e.date] = 1; }); });
  L.forEach((m) => { const taken = weekDates.filter((d) => usedDay[m.id][d]).length; cap[m.id] = want[m.id] = Math.max(0, want[m.id] - taken); });
  const order = Object.keys(pools).sort((x, y) => (pools[y].length - pools[x].length) || (x < y ? -1 : 1));
  const mixOk = (g) => { const h = g.filter((m) => m.school === 'harvard').length; return g.length >= 4 && Math.min(h, g.length - h) >= 2; };
  const edges = reunionEdges(Date.now());
  const created = []; let tables = 0, seatedN = 0, flip = 0;
  order.forEach((sid) => {
    const [date, meal] = sid.split('|');
    const pool = pools[sid].filter((m) => cap[m.id] > 0 && !usedDay[m.id][date]);
    if (pool.length < 4) return;
    // tech-only people sit at tech tables and social-only people at social ones; the flexible lean toward whatever they've had less of,
    // and the undecided split evenly, school by school
    const pref = (m) => (m.profile && m.profile.mix) || 'both', lean = (m) => had[m.id].topic - had[m.id].kindred, career = [], social = [];
    Object.keys(SX.SCHOOLS).forEach((sch) => pool.filter((m) => m.school === sch).forEach((m) => {
      const pf = pref(m), l = lean(m);
      if (pf === 'topic' || (pf === 'both' && l < 0)) career.push(m); else if (pf === 'social' || l > 0) social.push(m); else ((flip++) % 2 ? social : career).push(m);
    }));
    // two people who picked each other and marked the same evening go to the same kind of table, so they can share one
    const side = {}; career.forEach((m) => { side[m.id] = career; }); social.forEach((m) => { side[m.id] = social; });
    edges.forEach(([a, c]) => {
      const A = side[a], C = side[c]; if (!A || !C || A === C) return;
      const ma = A.find((m) => m.id === a), mc = C.find((m) => m.id === c);
      const mv = pref(mc) === 'both' ? [mc, C, A] : pref(ma) === 'both' ? [ma, A, C] : null; if (!mv) return;
      mv[1].splice(mv[1].indexOf(mv[0]), 1); mv[2].push(mv[0]); side[mv[0].id] = mv[2];
    });
    let groups = [];
    if (mixOk(career) && mixOk(social)) groups = [['topic', career], ['kindred', social]];
    else { // one kind of table tonight: the flexible join it, people who only want the other kind wait for another evening
      const c2 = pool.filter((m) => pref(m) !== 'social'), s2 = pool.filter((m) => pref(m) !== 'topic');
      if (mixOk(c2) && (c2.length >= s2.length || !mixOk(s2))) groups = [['topic', c2]]; else if (mixOk(s2)) groups = [['kindred', s2]];
    }
    groups.forEach(([type, ms]) => {
      const e = { id: 'e' + rid(4), type, date, time: MEALS[meal].time, meal, week, generated: true, area: AREA, status: 'open', createdAt: new Date().toISOString(), notified: {}, wait: [] };
      db.events[e.id] = e; db.seats[e.id] = {};
      ms.forEach((m) => { db.seats[e.id][m.id] = { at: m.avail.at || '', size: m.tableSize || 'either', diet: (m.profile && m.profile.diet) || [], status: 'held' }; });
      draft({ event: e.id, seed: b.seed });
      const seated = [].concat.apply([], tablesOf(e.id).map((t) => t.ids));
      if (!seated.length) { delete db.events[e.id]; delete db.seats[e.id]; return; }
      Object.keys(db.seats[e.id]).forEach((id) => { if (seated.indexOf(id) < 0) delete db.seats[e.id][id]; }); // the rest stay free for other evenings
      e.wait = [];
      seated.forEach((id) => { cap[id]--; usedDay[id][date] = 1; had[id][type]++; });
      created.push(e.id); tables += tablesOf(e.id).length; seatedN += seated.length;
    });
  });
  const unmatched = L.filter((m) => want[m.id] > 0 && cap[m.id] === want[m.id]).map((m) => m.id);
  db.weeks[week] = { matchedAt: new Date().toISOString(), published: false, events: created, unmatched };
  log('match-week', week, tables + ' tables');
  return { week, slots: created.length, tables, seated: seatedN, people: L.length, unmatched: unmatched.length };
}
function publishWeek(b) {
  const week = (b && b.week) || pendingWeek() || targetWeek(), w = db.weeks[week]; if (!w) fail('build the week first');
  if (w.published) fail('already published');
  w.events.forEach((eid) => { const e = db.events[eid]; if (e && e.status === 'draft') publish({ event: eid }, true); });
  w.published = true; w.publishedAt = new Date().toISOString(); resolveAlerts('week:' + week); resolveAlerts('autoweek:' + week);
  fillRounds(week);
  w.unmatched.forEach((id) => { const m = db.members[id]; if (m && !Object.values(db.tables).some((t) => t.published && seatedIds(t).indexOf(id) >= 0 && (db.events[t.eventId] || {}).week === week)) { m.prio = (m.prio || 0) + 1; notify(id, 'unmatched'); } });
  return { ok: true, week };
}

/* ---------- hangs: spur-of-the-moment meetups members host themselves (social or topic) ---------- */
function popTimes(u) { const start = tzMs(u.date, u.time); return { start, end: start + 3 * HOUR }; }
function createPop(me, b) {
  if (!done(me)) fail('finish your profile first');
  const title = clip(b.title, 70).trim(), place = clip(b.place, 80).trim();
  if (title.length < 3) fail('give it a title'); if (place.length < 2) fail('say where');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || !/^\d{2}:\d{2}$/.test(b.time || '')) fail('pick a day and a time');
  const start = tzMs(b.date, b.time); if (start < Date.now() + 15 * 60000) fail('pick a time at least 15 minutes from now'); if (start > Date.now() + 30 * DAY) fail('pick a time in the next 30 days');
  if (Object.values(db.pops).filter((u) => u.host === me.id && !u.cancelled && popTimes(u).end > Date.now()).length >= 3) fail('you’re already hosting three');
  const u = { id: 'u' + rid(4), host: me.id, title, note: clip(b.note, 280).trim(), kind: b.kind === 'topic' ? 'topic' : 'social', vibe: inList(b.vibe, SX.VIBES.map((v) => v.id)) || '', track: inList(b.track, SX.TRACKS.map((t) => t.id)) || '', date: b.date, time: b.time, place, size: Math.max(3, Math.min(8, Math.round(+b.size || 6))), joined: [], at: new Date().toISOString(), cancelled: false };
  db.pops[u.id] = u; log('pop', me.id, u.title);
  ensurePopGame(u); // the hang's question, three cards to vote on
  return { ok: true, id: u.id };
}
const popVisible = (u, me) => !u.cancelled && db.members[u.host] && !db.members[u.host].deleted && !blockedEither(me.id, u.host);
function popOut(u, me, full) {
  const tm = popTimes(u), host = db.members[u.host], people = u.joined.map((id) => db.members[id]).filter((m) => m && !m.deleted && !blockedEither(me.id, m.id));
  const inIt = u.host === me.id || u.joined.indexOf(me.id) >= 0;
  const vibe = SX.VIBES.find((v) => v.id === u.vibe);
  if (full) ensurePopGame(u);
  if (inIt && u.game) advanceGame(u);
  const peek = u.game && { title: gctx(u).title, stage: !u.game.pick ? 'vote' : !u.game.revealed ? 'sides' : 'revealed', q: u.game.pick ? (SX.card(u.game.pick) || {}).q : null };
  return { id: u.id, title: u.title, note: u.note, kind: u.kind || (u.track ? 'topic' : 'social'), vibe: u.vibe || '', vibeName: vibe ? vibe.t : '', track: u.track, trackName: u.track ? SX.track(u.track).t : '', date: u.date, time: u.time, place: u.place, size: u.size,
    label: dayLabel(tm.start), short: shortLabel(tm.start), timeLabel: timeLabel(tm.start), start: new Date(tm.start).toISOString(), past: Date.now() > tm.end,
    count: 1 + u.joined.filter((id) => db.members[id] && !db.members[id].deleted).length, left: Math.max(0, u.size - 1 - u.joined.filter((id) => db.members[id] && !db.members[id].deleted).length), mine: u.host === me.id, joined: u.joined.indexOf(me.id) >= 0,
    host: full ? card(host, me) : mini(host, me), people: people.map((m) => (full ? card(m, me) : mini(m, me))),
    unread: inIt ? unread(me, 'p:' + u.id, db.chats['p:' + u.id]) : 0, chat: full && inIt ? chatOut(db.chats['p:' + u.id]) : null,
    game: !u.game ? null : !inIt ? (full ? peek : null) : full ? gameView(u, me) : gameSum(u, me), peek: !!(full && !inIt && u.game) };
}
function pops(me) { return Object.values(db.pops).filter((u) => popVisible(u, me) && popTimes(u).end > Date.now()).sort((a, b) => popTimes(a).start - popTimes(b).start).map((u) => popOut(u, me)); }
function popView(me, id) { const u = db.pops[id]; if (!u || !popVisible(u, me)) fail('this hang is gone'); me.read['p:' + u.id] = new Date().toISOString(); return popOut(u, me, true); }
function joinPop(me, b) {
  const u = db.pops[b.id]; if (!u || !popVisible(u, me) || popTimes(u).start < Date.now()) fail('this hang is gone');
  if (u.host === me.id) fail('you’re hosting this one');
  if (u.joined.some((id) => blockedEither(me.id, id))) fail('this hang is gone');
  const k = u.joined.indexOf(me.id);
  if (b.on === false) { if (k >= 0) { u.joined.splice(k, 1); charlie('p:' + u.id, `${firstOf(me)} can’t make it anymore, so a seat opened up.`); } return { ok: true }; }
  if (k >= 0) return { ok: true };
  if (1 + u.joined.length >= u.size) fail('it’s full');
  u.joined.push(me.id);
  charlie('p:' + u.id, `${firstOf(me)} joined.${me.profile && me.profile.headline ? ' ' + me.profile.headline + '.' : ''}`);
  notify(u.host, 'popjoin', { other: firstOf(me), title: u.title });
  return { ok: true };
}
function cancelPop(me, b) {
  const u = own(db.pops, b.id); if (!u || u.host !== me.id) fail('no such hang');
  if (u.cancelled) return { ok: true };
  if (popTimes(u).start < Date.now()) fail('this hang already happened');
  u.cancelled = true; u.joined.forEach((id) => notify(id, 'popcancel', { title: u.title, other: firstOf(me) }));
  return { ok: true };
}
function postPopChat(me, b) {
  const u = db.pops[b.id]; if (!u || u.cancelled || (u.host !== me.id && u.joined.indexOf(me.id) < 0)) fail('no such hang');
  const text = clip(b.text, 800).trim(); if (!text) fail('message required');
  const k = 'p:' + u.id; (db.chats[k] = db.chats[k] || []).push({ id: rid(6), from: me.id, text, at: new Date().toISOString() });
  me.read[k] = new Date().toISOString();
  return { ok: true };
}
function createEvent(b) {
  const type = b.type === 'kindred' && !b.industry ? 'kindred' : 'topic';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) fail('date required (YYYY-MM-DD)');
  const time = /^\d{2}:\d{2}$/.test(b.time || '') ? b.time : '19:30';
  const e = { id: 'e' + rid(4), type, date: b.date, time, area: clip(b.area, 60) || AREA, status: 'open', createdAt: new Date().toISOString(), notified: {}, wait: [] };
  if (b.closes && /^\d{4}-\d{2}-\d{2}$/.test(b.closes)) e.closesAt = tzMs(b.closes, '23:59');
  // an industry table: a guest from the industry at the table; for its first 48 hours only captains with a stripe can take a seat
  if (b.industry) e.industry = { guest: clip(b.guest, 80).trim() || 'A guest from the industry', role: clip(b.role, 100).trim(), about: clip(b.about, 240).trim(), captainsUntil: new Date(Math.ceil((Date.now() + 48 * HOUR) / HOUR) * HOUR).toISOString(), everyone: !!b.notify };
  db.events[e.id] = e; db.seats[e.id] = {};
  const label = shortLabel(eventTimes(e).start);
  if (e.industry) live().filter((m) => done(m) && !m.paused && !cooling(m) && captainStats(m).stripes >= 1).forEach((m) => notify(m.id, 'industry', { guest: e.industry.guest, label }));
  else if (b.notify) live().filter((m) => done(m) && !m.paused).forEach((m) => notify(m.id, 'event', { label, type }));
  return e;
}
function eventPhase(e, now) {
  const t = eventTimes(e); now = now || Date.now();
  if (e.status === 'cancelled') return 'cancelled';
  if (now >= t.start + 6 * DAY) return 'past';
  if (now >= t.feedback) return 'after';
  if (now >= t.start - 12 * HOUR) return 'tonight';
  if (e.status === 'published') return 'set';
  if (now > t.closes) return 'closed';
  return 'open';
}
function bookSeat(me, b) {
  if (!done(me)) fail('finish your profile first');
  if (cooling(me)) fail('your invitations are paused until ' + dayLabel(Date.parse(me.coolUntil)));
  const e = db.events[b.event]; if (!e) fail('no such event');
  if (eventPhase(e) !== 'open' || e.status !== 'open') fail('seats for this night are closed');
  if (e.industry && Date.now() < Date.parse(e.industry.captainsUntil) && captainStats(me).stripes < 1) { const at = Date.parse(e.industry.captainsUntil); fail('captains with a stripe get the first 48 hours at industry tables. Seats open to everyone ' + weekday(at) + ' at ' + timeLabel(at)); }
  const s = db.seats[e.id] = db.seats[e.id] || {};
  s[me.id] = { at: (s[me.id] && s[me.id].status === 'held' && s[me.id].at) || new Date().toISOString(), size: inList(b.size, ['six', 'four', 'either']) || 'either',
    diet: arr(b.diet).filter((x) => SX.DIETS.indexOf(x) >= 0), status: 'held' };
  return { ok: true };
}
function cancelSeat(me, b) {
  const e = db.events[b.event], s = e && (db.seats[e.id] || {})[me.id]; if (s && s.status === 'cancelled') return { ok: true, late: !!s.late };
  if (!s || s.status !== 'held') fail('no such seat');
  const t = eventTimes(e); if (Date.now() >= t.start) fail('this dinner already started');
  const tb = tableOf(e.id, me.id), seated = !!(tb && tb.published && !tb.closed && !(tb.out && tb.out[me.id]));
  s.status = 'cancelled'; s.cancelledAt = new Date().toISOString(); s.late = seated && Date.now() > freeFor(e, me) && !seatedIds(tb).some((x) => x !== me.id && apart(me.id, x));
  if (tb && tb.published && !tb.closed) {
    tb.out = tb.out || {}; tb.out[me.id] = true;
    if (!fillChair(tb, e)) { if (seatedIds(tb).length < 3) shrink(tb, e); else charlie(tb.id, 'Plans changed for one of you, so the table is a seat smaller. Everything else stays the same.'); }
    if (!tb.closed) { if (tb.captain === me.id) { pickCaptain(tb, me.id); captainChanged(tb, e); briefCaptain(tb); } if (tb.venue && tb.venue.id) syncBooking(tb.venue.id, e.date); }
  }
  else if (tb) { tb.ids = tb.ids.filter((x) => x !== me.id); refreshTable(tb); }
  e.wait = (e.wait || []).filter((x) => x !== me.id);
  if (s.late) coolCheck(me);
  return { ok: true, late: s.late, paused: cooling(me) ? dayLabel(Date.parse(me.coolUntil)) : '' };
}


/* ---------- can't make it: another evening ----------
   Someone who can't make their night asks for another one. Charlie looks for an open chair (tables seat up to six) at a
   table of the same kind in the next week, on an evening they picked: no blocked pairs, the school mix still holds, their
   track first for tech tables, then the soonest. If nothing is open they go on standby, and the next chair someone gives
   up on one of those evenings is theirs. */
function chairFits(m, t, e, dates, skip) {
  if (!t.published || t.closed || e.status !== 'published' || !done(m) || m.paused || m.deleted || cooling(m)) return false;
  if (!dates || !dates.length || dates.indexOf(e.date) < 0) return false;
  if (tablesOf(e.id).some((x) => x.ids.indexOf(m.id) >= 0)) return false;
  if (Object.keys(db.seats).some((eid) => eid !== e.id && ((db.seats[eid] || {})[m.id] || {}).status === 'held' && (db.events[eid] || {}).date === e.date)) return false;
  if (e.date === skip || eventTimes(e).start < Date.now() + 6 * HOUR || eventTimes(e).start > Date.now() + 8 * DAY) return false;
  const ids = seatedIds(t); if (ids.length >= tableCap(t) || t.ids.indexOf(m.id) >= 0) return false;
  if (ids.some((id) => blockedEither(m.id, id))) return false;
  if (Object.values(db.tables).some((x) => x !== t && x.published && seatedIds(x).indexOf(m.id) >= 0 && (db.events[x.eventId] || {}).date === e.date)) return false;
  const same = ids.filter((id) => (db.members[id] || {}).school === m.school).length;
  return same + 1 <= Math.ceil((ids.length + 1) / 2);
}
function openChair(m, kind, dates, skip) {
  const tr = (m.profile && m.profile.tracks) || []; let best = null;
  Object.values(db.events).forEach((e) => {
    if (e.type !== kind) return;
    tablesOf(e.id).forEach((t) => {
      if (!chairFits(m, t, e, dates, skip)) return;
      const fit = (t.track && tr.indexOf(t.track) >= 0 ? 10 : 0) + (6 - seatedIds(t).length), at = eventTimes(e).start;
      if (!best || fit > best.fit || (fit === best.fit && at < best.at)) best = { t, e, fit, at };
    });
  });
  return best;
}
function seatAt(m, t, e) {
  t.ids.push(m.id); if (t.out) delete t.out[m.id];
  (db.seats[e.id] = db.seats[e.id] || {})[m.id] = { at: new Date().toISOString(), size: 'either', diet: (m.profile && m.profile.diet) || [], status: 'held', moved: true };
  charlie(t.id, `${firstOf(m)} pulled up a chair, so you’re ${NUMW(seatedIds(t).length)} now.${m.profile && m.profile.headline ? ' ' + m.profile.headline + '.' : ''}`);
  notify(m.id, 'table', { n: seatedIds(t).length - 1, day: weekday(eventTimes(e).start) });
  if (db.standby) delete db.standby[m.id];
  if (t.venue && t.venue.id) syncBooking(t.venue.id, e.date);
}
function reinvite(me, b) {
  if (!done(me)) fail('finish your profile first');
  const from = own(db.tables, b.table), fe = from && db.events[from.eventId], seat = fe && (db.seats[fe.id] || {})[me.id];
  if (!from || !fe || from.ids.indexOf(me.id) < 0 || !(from.out && from.out[me.id])) fail('let Charlie know you can’t make that table first');
  if (seat && seat.reinvited) fail('you already asked for another evening for that one');
  if (cooling(me)) fail('your invitations are paused until ' + dayLabel(Date.parse(me.coolUntil)) + ', so I can’t find you another evening before then');
  const kind = fe.type, skip = fe.date;
  const dates = arr(b.dates).filter((d, i, a) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== skip && a.indexOf(d) === i).slice(0, 8);
  if (!dates.length) fail('pick at least one evening');
  if (seat) seat.reinvited = true;
  const hit = openChair(me, kind, dates, skip);
  if (hit) { seatAt(me, hit.t, hit.e); return { ok: true, table: hit.t.id, day: weekday(eventTimes(hit.e).start) }; }
  (db.standby = db.standby || {})[me.id] = { kind, dates, skip, until: dates.slice().sort().pop(), at: new Date().toISOString() };
  return { ok: true, standby: true };
}
function stopStandby(me) { if (db.standby) delete db.standby[me.id]; return { ok: true }; }
// a chair just opened: the longest-waiting person on standby whose evenings fit gets it
function fillChair(t, e) {
  pruneStandby();
  const S = db.standby || {}, who = Object.keys(S).filter((id) => db.members[id] && !db.members[id].deleted && S[id].kind === e.type).sort((a, b) => (S[a].at < S[b].at ? -1 : 1));
  for (const id of who) { const m = db.members[id]; if (chairFits(m, t, e, S[id].dates, S[id].skip)) { seatAt(m, t, e); return id; } }
  return null;
}
function pruneStandby() { const today = ymdTz(Date.now()), S = db.standby || {}; Object.keys(S).forEach((id) => { const m = db.members[id]; if (!m || m.deleted || !S[id].until || S[id].until < today) delete S[id]; }); }
function standbyView(me) {
  pruneStandby();
  const s = (db.standby || {})[me.id]; if (!s) return null;
  return { kind: s.kind, days: s.dates.map((d) => weekday(tzMs(d, '12:00'))) };
}

/* ---------- tables ---------- */
const tablesOf = (eventId) => Object.values(db.tables).filter((t) => t.eventId === eventId).sort((a, b) => a.no - b.no);
const tableOf = (eventId, mid) => { const ts = tablesOf(eventId).filter((t) => t.ids.indexOf(mid) >= 0); return ts.find((t) => !(t.out && t.out[mid])) || ts[0]; };
const seatedIds = (t) => t.ids.filter((x) => !(t.out && t.out[x]));
function attendedPair(t, a, b) { const at = t.attended || {}, fb = db.feedback[t.id] || {}; const went = (x) => at[x] !== false && !(fb[x] && fb[x].attended === false); return went(a) && went(b); }
// who already shared a table before this night, who must never sit together, and who picked each other (a reunion)
function context(e) {
  const start = eventTimes(e).start, history = new Set(), blocked = new Set(), mutualEdges = [];
  Object.values(db.tables).forEach((t) => {
    const te = db.events[t.eventId]; if (!te || !t.published || te.status === 'cancelled' || te.id === e.id || eventTimes(te).start >= start) return;
    const ids = seatedIds(t);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (attendedPair(t, ids[i], ids[j])) history.add(pk(ids[i], ids[j]));
    if (start - eventTimes(te).start < 60 * DAY) mutualPairs(t).forEach((p) => mutualEdges.push(p));
  });
  // two people who waved at each other in People count as a reunion too
  Object.keys(db.waves || {}).forEach((a) => Object.keys(db.waves[a] || {}).forEach((b) => { if (a < b && (db.waves[b] || {})[a]) mutualEdges.push([a, b]); }));
  live().forEach((m) => Object.keys(m.never || {}).forEach((o) => blocked.add(pk(m.id, o))));
  db.reports.forEach((r) => blocked.add(pk(r.by, r.who)));
  // reunions: people holding a seat tonight who picked each other, grouped (at most four)
  const seated = new Set(Object.keys(db.seats[e.id] || {}).filter((id) => db.seats[e.id][id].status === 'held'));
  const adj = {}; mutualEdges.forEach(([a, b]) => { if (seated.has(a) && seated.has(b) && !blocked.has(pk(a, b))) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); } });
  const seen = {}, locks = [];
  Object.keys(adj).forEach((s) => { if (seen[s]) return; const g = [], q = [s]; seen[s] = 1; while (q.length) { const x = q.shift(); g.push(x); (adj[x] || []).forEach((y) => { if (!seen[y]) { seen[y] = 1; q.push(y); } }); } locks.push(g.slice(0, 4)); });
  return { history, blocked, locks };
}
// pairs Charlie tries to seat together again: picked each other after a dinner in the last 60 days, or waved at each other
function reunionEdges(start) {
  const out = [];
  Object.values(db.tables).forEach((t) => { const te = db.events[t.eventId]; if (!te || !t.published) return; const s = eventTimes(te).start; if (s < start && start - s < 60 * DAY) mutualPairs(t).forEach((p) => out.push(p)); });
  Object.keys(db.waves || {}).forEach((a) => Object.keys(db.waves[a] || {}).forEach((b) => { if (a < b && (db.waves[b] || {})[a]) out.push([a, b]); }));
  return out;
}
function seatRows(e) {
  return Object.keys(db.seats[e.id] || {}).map((id) => ({ id, s: db.seats[e.id][id], m: db.members[id] })).filter((x) => x.s.status === 'held' && x.m && !x.m.deleted && done(x.m) && !cooling(x.m));
}
function draft(b) {
  const e = db.events[b.event]; if (!e) fail('no such event');
  if (e.status === 'published') fail('already published');
  const rows = seatRows(e), ctx = context(e);
  // at an industry table, stripes come first: more stripes, earlier seat
  const res = T.assemble(rows.map((x) => ({ id: x.id, school: x.m.school, profile: x.m.profile, size: x.s.size, prio: (x.m.prio || 0) + (e.industry ? 10 * Math.min(5, captainStats(x.m).stripes) : 0), at: x.s.at })),
    { type: e.type, blocked: Array.from(ctx.blocked), history: Array.from(ctx.history), locks: ctx.locks, seed: +b.seed || 7 });
  tablesOf(e.id).forEach((t) => { delete db.tables[t.id]; });
  res.tables.forEach((t, i) => { const id = 't' + rid(5); db.tables[id] = { id, eventId: e.id, no: i + 1, track: t.track, ids: t.ids, score: t.score, flags: t.flags, why: t.why, split: t.split, venue: null, published: false, attended: {}, createdAt: new Date().toISOString() }; });
  e.wait = res.wait; e.status = 'draft'; e.merged = res.merged; e.draftedAt = new Date().toISOString();
  return adminEvent(e.id);
}
// after the admin moves someone: recompute the table's score, flags and Charlie's lines
function refreshTable(t) {
  const e = db.events[t.eventId], ctx = context(e), lockOf = {};
  ctx.locks.forEach((g, i) => g.forEach((id) => { lockOf[id] = i + 1; }));
  const people = t.ids.map((id) => db.members[id]).filter(Boolean).map((m) => T.prep({ id: m.id, school: m.school, profile: m.profile, size: (db.seats[e.id][m.id] || {}).size }));
  const c = { blocked: ctx.blocked, history: ctx.history, lockOf, mix: true };
  const s = T.scoreTable(people, e.type, t.track, c);
  t.score = Math.round(s.base * 100); t.flags = s.flags; t.why = T.whyLines(people, e.type, t.track, c); t.split = e.type === 'kindred' ? null : T.splits(people, t.track)[0] || null;
}
function move(b) {
  const e = db.events[b.event]; if (!e) fail('no such event');
  if (e.status === 'published') fail('already published: move people before publishing');
  const mid = b.member; if (!db.members[mid]) fail('no such member');
  const from = tableOf(e.id, mid);
  if (from) { from.ids = from.ids.filter((x) => x !== mid); refreshTable(from); } else e.wait = (e.wait || []).filter((x) => x !== mid);
  if (b.to === 'wait') e.wait.push(mid);
  else if (b.to === 'new') { const id = 't' + rid(5), no = tablesOf(e.id).reduce((n, t) => Math.max(n, t.no), 0) + 1; db.tables[id] = { id, eventId: e.id, no, track: (db.members[mid].profile.tracks || [])[0] || null, ids: [mid], venue: null, published: false, attended: {} }; if (e.type === 'kindred') db.tables[id].track = null; refreshTable(db.tables[id]); }
  else { const to = db.tables[b.to]; if (!to || to.eventId !== e.id) fail('no such table'); to.ids.push(mid); refreshTable(to); }
  tablesOf(e.id).filter((t) => !t.ids.length).forEach((t) => { delete db.tables[t.id]; });
  return adminEvent(e.id);
}
function setVenue(b) {
  const t = db.tables[b.table]; if (!t) fail('no such table');
  const was = t.venue, e = db.events[t.eventId];
  t.venue = { name: clip(b.name, 80).trim(), address: clip(b.address, 120).trim(), note: clip(b.note, 160).trim() };
  const named = Object.values(db.places || {}).find((v) => !v.gone && v.name.toLowerCase() === t.venue.name.toLowerCase());
  if (named) t.venue.id = named.id;
  else if (was && was.id && (was.name === t.venue.name || was.address === t.venue.address)) t.venue.id = was.id; // the same partner, the name or note retyped
  if (!t.venue.name) t.venue = null;
  if (t.venue && t.venue.id && e && !(was && was.id === t.venue.id)) syncBooking(t.venue.id, e.date);
  if (was && was.id && e && !(t.venue && t.venue.id === was.id)) syncBooking(was.id, e.date);
  if (t.venue) resolveAlerts('noplace:' + t.id);
  if (t.venue && t.revealWait) revealNow(t);
  else if (was && t.venue && was.name !== t.venue.name) spotMoved(t, was);
  return adminEvent(t.eventId);
}
/* ---------- places: partner restaurants hold Sidetable tables ----------
   Members never book anything, and nothing is booked inside a restaurant's own system (OpenTable, Resy and the rest have no
   open booking API, and copying reservations into them breaks their rules). Instead a partner agrees to hold a few tables on
   certain weeknights, the way Timeleft's partner restaurants do. Charlie fills those holds, each table at a partner with room
   that evening (same area first, round two at its old spot when it has room, backup partners last). The restaurant hears
   the week's plan on Sunday night, the final count at noon the day before, and any change after that. */
const placeLoad = (v, date, not) => Object.values(db.tables).filter((x) => x.id !== not && x.published && !x.closed && x.venue && x.venue.id === v.id && (db.events[x.eventId] || {}).date === date && db.events[x.eventId].status !== 'cancelled').length;
const placeUses = (v) => Object.values(db.tables).filter((x) => x.published && x.venue && x.venue.id === v.id).length;
function placeFits(v, t, e) {
  return !!v && !v.off && !v.gone && arr(v.nights).indexOf(dowOf(e.date)) >= 0 && arr(v.closedOn).indexOf(e.date) < 0 && ((db.bookings || {})[bkey(v.id, e.date)] || {}).state !== 'declined'
    && (v.seats || 6) >= seatedIds(t).length && placeLoad(v, e.date, t.id) < Math.min(v.tables || 1, ((db.bookings || {})[bkey(v.id, e.date)] || {}).cap || 99);
}
function placeTable(t, prefer) {
  const e = db.events[t.eventId]; if (!e || t.closed || (t.venue && t.venue.name)) return t.venue || null;
  const P = Object.values(db.places || {});
  const v = (prefer && placeFits(own(db.places || {}, prefer), t, e) ? db.places[prefer] : null)
    || P.filter((x) => placeFits(x, t, e)).sort((a, b) => (!!a.backup - !!b.backup) || ((b.area || '') === e.area) - ((a.area || '') === e.area) || placeLoad(a, e.date) - placeLoad(b, e.date) || placeUses(a) - placeUses(b) || (a.name < b.name ? -1 : 1))[0];
  if (!v) return null;
  t.venue = { id: v.id, name: v.name, address: v.address, note: v.note || 'Ask for the Sidetable table' };
  syncBooking(v.id, e.date);
  resolveAlerts('noplace:' + t.id); revealNow(t);
  return t.venue;
}
const ymdOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
function savePlace(b) {
  const name = clip(b.name, 80).trim(), address = clip(b.address, 120).trim(); if (name.length < 2 || address.length < 4) fail('name and address required');
  const nights = arr(b.nights).map(Number).filter((d, i, a) => d >= 0 && d <= 6 && a.indexOf(d) === i).sort(); if (!nights.length) fail('pick at least one evening');
  const v = (b.id && own(db.places || {}, b.id)) || { id: 'v' + rid(4), createdAt: isoNow() };
  Object.assign(v, { name, address, area: clip(b.area, 60).trim() || AREA, nights,
    tables: Math.max(1, Math.min(12, Math.round(+b.tables) || 2)), seats: Math.max(4, Math.min(8, Math.round(+b.seats) || 6)),
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email || '').trim()) ? String(b.email).trim().slice(0, 120) : '', contact: clip(b.contact, 80).trim(), phone: clip(b.phone, 30).trim(),
    note: clip(b.note, 160).trim(), vibe: clip(b.vibe, 80).trim(), terms: clip(b.terms, 400).trim(), closedOn: arr(b.closedOn).map(String).filter(ymdOk).slice(0, 60), off: b.off === undefined ? !!v.off : !!b.off,
    mode: b.mode === 'ask' ? 'ask' : 'hold', backup: !!b.backup });
  // 10. now a standing hold: evenings waiting for a yes are simply held
  if (v.mode === 'hold') Object.values(db.bookings || {}).forEach((x) => { if (x.vid === v.id && x.state === 'asked' && x.date >= ymdTz(Date.now())) { x.state = 'held'; delete x.more; resolveAlerts('unconfirmed:' + bkey(v.id, x.date)); tablesAt(v, x.date).forEach((t) => revealNow(t)); } });
  if (!v.key) v.key = rid(12);
  (db.places = db.places || {})[v.id] = v;
  replaceAt(v);
  return { ok: true, id: v.id };
}
// a partner that now has fewer tables, fewer seats, a closed evening, or is paused: tables past what it can take go elsewhere
function replaceAt(v) {
  Object.values(db.tables).filter((t) => t.published && !t.closed && t.venue && t.venue.id === v.id && (db.events[t.eventId] || {}).date >= ymdTz(Date.now())).forEach((t) => {
    const e = db.events[t.eventId]; if (eventTimes(e).start < Date.now()) return;
    if (!placeFits(v, t, e)) { const was = t.venue; t.venue = null; syncBooking(v.id, e.date); placeTable(t); spotMoved(t, was); if (!t.venue) alertOps('noplace:' + t.id, 'place', `${v.name} can’t take table ${t.no} on ${dayLabel(eventTimes(e).start)} any more, and no other partner has room. Find a spot or call it off.`); }
  });
}
// what one restaurant has on one evening: tables, covers, the time, dietary notes and the captain's first name (nothing else)
function placeNight(v, date) {
  const ts = Object.values(db.tables).filter((x) => x.published && !x.closed && x.venue && x.venue.id === v.id && (db.events[x.eventId] || {}).date === date && db.events[x.eventId].status !== 'cancelled').sort((a, b) => a.no - b.no);
  const rows = ts.map((t) => {
    const e = db.events[t.eventId], ids = seatedIds(t), diets = {};
    ids.forEach((id) => (((db.seats[e.id] || {})[id] || {}).diet || ((db.members[id] || {}).profile || {}).diet || []).forEach((d) => { diets[d] = (diets[d] || 0) + 1; }));
    return { table: t.id, size: ids.length, time: timeLabel(eventTimes(e).start), kind: e.type === 'kindred' ? 'Social' : 'Tech', round: t.round || 1, diets, captain: t.captain && ids.indexOf(t.captain) >= 0 ? firstOf(db.members[t.captain]) : '' };
  }).filter((r) => r.size);
  return { covers: rows.reduce((n, r) => n + r.size, 0), tables: rows };
}
// Resend takes about two requests a second: mails go out one at a time, each with a ten-second timeout
let mailChain = Promise.resolve();
function resend(to, subject, text) {
  const go = () => fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, text }), signal: AbortSignal.timeout(10000) })
    .then(async (r) => { if (!r.ok) console.error('mail not sent (' + r.status + '): ' + subject + ' | ' + (await r.text().catch(() => '')).slice(0, 300)); return { ok: r.ok, status: r.status }; });
  const p = mailChain.then(go, go); mailChain = p.catch(() => {}).then(() => new Promise((r) => { const t = setTimeout(r, 550); if (t.unref) t.unref(); })); return p;
}
async function sendMail(to, subject, text) {
  if (MAIL_MODE === 'show') { console.log('[mail to ' + to + '] ' + subject + '\n' + text); return { show: true }; }
  if (!process.env.RESEND_API_KEY || !MAIL_FROM) return { off: true };
  return resend(to, subject, text);
}
// the admin's view: partners with their next three weeks evening by evening, and what needs a person
function placesAdmin() {
  const today = ymdTz(Date.now()), last = addDays(today, 21), now = Date.now();
  const upcoming = Object.values(db.tables).filter((t) => { const e = db.events[t.eventId]; return t.published && !t.closed && e && e.status !== 'cancelled' && e.date >= today && e.date <= last && eventTimes(e).start > now - 3 * HOUR; });
  const B = Object.values(db.bookings || {}), needs = [];
  upcoming.filter((t) => !(t.venue && t.venue.name)).forEach((t) => { const e = db.events[t.eventId]; needs.push({ kind: 'noplace', table: t.id, label: dayLabel(eventTimes(e).start) + ' at ' + timeLabel(eventTimes(e).start), text: `${e.type === 'kindred' ? 'Social' : 'Tech'}${t.round > 1 ? ' round ' + t.round : ''} table ${t.no}, ${seatedIds(t).length} people, no partner with room`, at: e.date }); });
  B.filter((b) => b.state === 'asked' && b.date >= today && now >= confirmBy(b) - 12 * HOUR).forEach((b) => { const v = (db.places || {})[b.vid]; if (v) needs.push({ kind: 'unconfirmed', place: v.id, date: b.date, label: dayLabel(tzMs(b.date, '12:00')), text: `${v.name} hasn’t confirmed ${b.tables} ${b.tables > 1 ? 'tables' : 'table'} (${b.covers} people). Answer due ${dayLabel(confirmBy(b))} at ${timeLabel(confirmBy(b))}${v.phone ? '. ' + v.phone : ''}`, at: b.date }); });
  return {
    places: Object.values(db.places || {}).filter((v) => !v.gone).sort((a, b) => (!!a.backup - !!b.backup) || (a.name < b.name ? -1 : 1)).map((v) => Object.assign({}, v, { nightsLabel: arr(v.nights).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DOW[d]).join(', '), link: placeLink(v),
      flakes: arr(v.flakes).filter((d) => d >= addDays(today, -90)).length,
      evenings: B.filter((b) => b.vid === v.id && b.date >= today && b.date <= last && (b.state !== 'released' || b.told)).sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => ({ date: b.date, label: shortLabel(tzMs(b.date, '12:00')), state: b.state, started: tablesAt(v, b.date).some((t) => eventTimes(db.events[t.eventId]).start <= now), tables: b.tables || 0, covers: b.covers || 0, of: v.tables, due: b.state === 'asked' ? shortLabel(confirmBy(b)) + ' ' + timeLabel(confirmBy(b)) : '' })) })),
    needs: needs.sort((a, b) => (a.at < b.at ? -1 : 1)),
    long: { month: monthNow(), day: longDate(monthNow()), date: dayLabel(tzMs(longDate(monthNow()), LONG_TIME)), spot: ((db.longSpot || {})[monthNow()] || {}).name ? db.longSpot[monthNow()] : null, going: Object.keys(db.long[monthNow()] || {}).length, wait: arr((db.longWait || {})[monthNow()]).length, cap: longCap(monthNow()), closes: dayLabel(longCloses(monthNow())) }
  };
}
function setLongSpot(b) {
  const mo = monthNow(), name = clip(b.name, 80).trim();
  db.longSpot = db.longSpot || {};
  const cap = Math.max(8, Math.min(200, Math.round(+b.cap) || longCap(mo)));
  const was = db.longSpot[mo] || {}, date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) && String(b.date).slice(0, 7) === mo ? String(b.date) : b.date === '' ? '' : was.date || '';
  if (date && date !== was.date && tzMs(date, LONG_TIME) < Date.now()) fail('that date has passed');
  db.longSpot[mo] = Object.assign(name ? { name, address: clip(b.address, 120).trim(), note: clip(b.note, 160).trim(), pay: clip(b.pay, 80).trim(), cap } : { cap }, date ? { date } : {});
  promoteLong(mo);
  return placesAdmin();
}

/* ---------- bookings: each partner's evenings, and who has said what ----------
   A standing hold is the normal case: the partner agreed to keep those tables for Sidetable, so an evening Charlie fills is
   set unless the restaurant says it can't (one tap on its private link, or a call to whoever is on duty). Some partners
   would rather say yes to each evening; for them Charlie asks and waits, with a deadline of noon two days before (or the
   morning before, for something set later), and members see the address only once they've said yes. If a restaurant can't
   host, its tables move to another partner with room that evening; if none has room, whoever is on duty gets an alert. */
const bkey = (vid, date) => vid + '|' + date;
const isoNow = () => new Date().toISOString();
const bookingOf = (t) => { const e = t && db.events[t.eventId]; return t && t.venue && t.venue.id && e ? (db.bookings || {})[bkey(t.venue.id, e.date)] || null : null; };
// a table's spot is set when it was typed in by hand, or its partner holds it (or said yes) that evening
const spotSet = (t) => { if (!(t && t.venue && t.venue.name)) return false; if (!t.venue.id) return true; const b = bookingOf(t) || {}; return ['held', 'confirmed'].indexOf(b.state) >= 0 || (!!b.more && arr(b.okIds).indexOf(t.id) >= 0); };
const tablesAt = (v, date) => Object.values(db.tables).filter((x) => x.published && !x.closed && x.venue && x.venue.id === v.id && (db.events[x.eventId] || {}).date === date && db.events[x.eventId].status !== 'cancelled');
function syncBooking(vid, date) {
  const v = own(db.places || {}, vid); if (!v || !date) return null;
  const B = db.bookings = db.bookings || {}, k = bkey(vid, date), n = placeNight(v, date); let b = B[k];
  if (!n.tables.length) {
    if (b && b.state !== 'declined' && b.state !== 'released' && b.told && date >= ymdTz(Date.now())) { b.state = 'released'; b.releasedAt = isoNow(); }
    else if (b && b.state !== 'declined' && b.state !== 'released') delete B[k];
    return B[k] || null;
  }
  const fresh = v.mode === 'ask' ? 'asked' : 'held';
  if (!b) b = B[k] = { vid, date, state: fresh, askedAt: isoNow() };
  else if (b.state === 'released') { b.state = fresh; b.askedAt = isoNow(); ['askMail', 'remindAt', 'releaseMail', 'told', 'finalAt', 'final'].forEach((k) => { delete b[k]; }); }
  else if (b.state === 'confirmed' && v.mode === 'ask' && n.tables.length > (b.okTables || 0)) { b.more = true; b.state = 'asked'; b.askedAt = isoNow(); ['askMail', 'remindAt', 'told'].forEach((k) => { delete b[k]; }); }
  else if (b.state === 'asked' && b.more && n.tables.length <= (b.okTables || 0)) { b.state = 'confirmed'; delete b.more; resolveAlerts('unconfirmed:' + k); }
  b.tables = n.tables.length; b.covers = n.covers;
  return b;
}
// when a partner that confirms each evening has to answer by: noon two days before; for something set later, ten the
// morning before; at the very last minute, three hours
function confirmBy(b) {
  const asked = Date.parse(b.askMail || b.askedAt), two = tzMs(addDays(b.date, -2), '12:00'), one = tzMs(addDays(b.date, -1), '10:00');
  return asked + 12 * HOUR <= two ? two : asked + 6 * HOUR <= one ? one : Math.min(tzMs(b.date, '17:00'), Math.max(asked + 3 * HOUR, tzMs(b.date, '10:00')));
}
// the restaurant (or whoever is on duty, after a phone call) says yes or no for one evening
function placeAnswer(v, date, ok, by) {
  const b = (db.bookings || {})[bkey(v.id, date)]; if (!b || b.state === 'released') fail('nothing is booked that evening');
  if (tzMs(date, '23:59') < Date.now() || tablesAt(v, date).some((t) => eventTimes(db.events[t.eventId]).start <= Date.now())) fail('that dinner has already started');
  syncBooking(v.id, date);
  if (ok) {
    Object.assign(b, { state: 'confirmed', confirmedAt: isoNow(), okTables: b.tables, okCovers: b.covers, okIds: tablesAt(v, date).map((t) => t.id), by }); delete b.more;
    tablesAt(v, date).forEach((t) => revealNow(t)); // an address that was waiting goes out
    resolveAlerts('unconfirmed:' + bkey(v.id, date)); tablesAt(v, date).forEach((t) => resolveAlerts('reveal:' + t.id)); log('place-ok', v.id, date);
    return b;
  }
  if (b.more) { // they can't take the extra table: only that one moves, and what they confirmed stays
    const keep = arr(b.okIds); b.cap = keep.length; b.state = 'confirmed'; delete b.more; log('place-no-more', v.id, date);
    tablesAt(v, date).filter((t) => keep.indexOf(t.id) < 0).forEach((t) => { const was = t.venue; t.venue = null; placeTable(t); spotMoved(t, was); if (!t.venue) alertOps('noplace:' + t.id, 'place', `${v.name} can’t take a second table on ${dayLabel(tzMs(date, '12:00'))}, and table ${t.no} (${seatedIds(t).length} people) has no other partner with room. Find a spot or call it off.`); });
    syncBooking(v.id, date); resolveAlerts('unconfirmed:' + bkey(v.id, date));
    return b;
  }
  const had = b.state === 'held' || b.state === 'confirmed';
  Object.assign(b, { state: 'declined', declinedAt: isoNow(), by }); log('place-no', v.id, date);
  // saying no to an evening they'd agreed to, within two days of it: twice in ninety days and it's time to talk
  if (had && tzMs(date, '19:00') - Date.now() < 2 * DAY) {
    v.flakes = arr(v.flakes).concat([date]);
    if (arr(v.flakes).filter((d) => d >= addDays(ymdTz(Date.now()), -90)).length >= 2) alertOps('flaky:' + v.id, 'flaky', `${v.name} has cancelled on us twice in ninety days, both within two days of the dinner. Time to talk to ${v.contact || 'them'}, or lean on another partner.`);
  }
  const stuck = [];
  tablesAt(v, date).forEach((t) => { const was = t.venue; t.venue = null; placeTable(t); if (!t.venue) stuck.push(t); spotMoved(t, was); });
  b.tables = 0; b.covers = 0;
  resolveAlerts('unconfirmed:' + bkey(v.id, date));
  stuck.forEach((t) => alertOps('noplace:' + t.id, 'place', `${v.name} can’t host ${dayLabel(tzMs(date, '12:00'))}, and table ${t.no} (${seatedIds(t).length} people) has no other partner with room. Find a spot and type it in on the night, or call the table off (they go first next week).`));
  return b;
}
// after noon on the day, a spot that just got set goes out: a notification, a line in the chat, and the alert clears
function revealNow(t, now) {
  const e = t && db.events[t.eventId]; if (!e || !t.revealWait || !spotSet(t) || (now || Date.now()) < eventTimes(e).reveal) return;
  delete t.revealWait; resolveAlerts('reveal:' + t.id);
  charlie(t.id, `Tonight’s spot is set: ${t.venue.name}. The address is on your table.`);
  seatedIds(t).forEach((id) => notify(id, 'reveal'));
}
// a table changed restaurants: if members could already see the old address, Charlie tells them in the chat
function spotMoved(t, was) {
  const e = db.events[t.eventId]; if (!e) return;
  if (t.round > 1) { const prev = db.tables[t.prev]; t.same = !!(t.venue && prev && prev.venue && prev.venue.name === t.venue.name); }
  if (Date.now() < eventTimes(e).reveal || !was) return;
  if (spotSet(t)) delete t.revealWait;
  charlie(t.id, t.venue && spotSet(t) ? `Change of plans: ${was.name} can’t host tonight, so you’re at ${t.venue.name} instead. The new address is on your table. Same time.` : `Change of plans: ${was.name} can’t host tonight. I’m finding another spot and it shows up on your table the moment it’s set.`);
  seatedIds(t).forEach((id) => notify(id, 'spot', { day: weekday(eventTimes(e).start) }));
}
const placeLink = (v) => PUBLIC_URL + '/place?k=' + v.key;
// what one restaurant sees on its private link: the next three weeks, evening by evening (sizes, times, dietary notes, captains)
function placeView(v) {
  const today = ymdTz(Date.now());
  const evenings = Object.values(db.bookings || {}).filter((b) => b.vid === v.id && b.date >= today && b.date <= addDays(today, 21) && (b.state !== 'released' || b.told)).sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => {
    const n = placeNight(v, b.date);
    return { date: b.date, label: dayLabel(tzMs(b.date, '12:00')), state: b.state, more: !!b.more, by: b.state === 'asked' ? dayLabel(confirmBy(b)) + ' at ' + timeLabel(confirmBy(b)) : '',
      final: finalTime(v, b.date) <= Date.now() && b.state !== 'asked', started: tablesAt(v, b.date).some((t) => eventTimes(db.events[t.eventId]).start <= Date.now()), tables: n.tables.map((r) => ({ size: r.size, time: r.time, diets: r.diets, captain: r.captain })), covers: n.covers };
  });
  return { name: v.name, address: v.address, contact: v.contact, mode: v.mode || 'hold', nights: arr(v.nights).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DOW[d]).join(', '), holds: v.tables, seats: v.seats, terms: v.terms || '', evenings };
}
const placeByKey = (k) => (/^[a-f0-9]{24}$/.test(String(k || '')) ? Object.values(db.places || {}).find((v) => v.key === k && !v.gone) : null);
function mailPlace(v, subject, text, undo) {
  log('place-mail', v.id, subject);
  const failed = (why) => { if (undo) undo(); log('place-mail-failed', v.id, subject); alertOps('mail:' + v.id, 'mail', `An email to ${v.name} didn’t go out (${why}): “${subject}”. It tries again every few minutes. If it keeps failing, call ${v.contact || 'them'}${v.phone ? ' at ' + v.phone : ''}.`); save(); };
  if (!v.email) { if (/^Sidetable (tonight|tomorrow)/.test(subject)) alertOps('call:' + v.id + '|' + subject, 'mail', `${v.name} has no email on file, so call ${v.contact || 'them'}${v.phone ? ' at ' + v.phone : ''} with the final count: ${subject}. The tables are on the Places tab.`); return; }
  sendMail(v.email, subject, text).then((r) => { if (r.ok || r.show) resolveAlerts('mail:' + v.id); else failed(r.off ? 'email isn’t set up' : 'the mail service turned it down'); }).catch((e) => failed(e.message));
}
const snapOf = (n) => n.tables.map((r) => r.size + '@' + r.time + '@' + r.captain).sort().join(',');
const dietLine = (d) => Object.keys(d).map((k) => d[k] + ' ' + k.toLowerCase()).join(', ');
const tableLines = (n) => n.tables.map((r, i) => `Table ${i + 1}: ${r.size} people at ${r.time}${Object.keys(r.diets).length ? ' (' + dietLine(r.diets) + ')' : ''}${r.captain ? `, ask for ${r.captain}` : ''}`).join('\n');
// the mail a restaurant gets:
//   Sunday 10 PM, the week's plan: each of its evenings, with what's needed or "not needed, release it" (backups only hear
//   when they're needed); an evening filled after the plan went out gets its own note;
//   a partner that confirms each evening: the ask, then a reminder at the deadline (and an alert for whoever is on duty);
//   noon the day before: the final count, the same moment members can no longer change plans for free;
//   after that: a short update if the count changes, and a release if the evening empties out
function placeMail(now) {
  const today = ymdTz(now), iso = new Date(now).toISOString(), P = Object.values(db.places || {}).filter((v) => !v.gone && !v.off);
  db.planSent = db.planSent || {};
  const weeks = [mondayOf(today)].concat(dowOf(today) === 0 && now >= tzMs(today, '22:00') ? [addDays(today, 1)] : []);
  weeks.forEach((wk) => P.forEach((v) => {
    const pk2 = v.id + '|' + wk; if (db.planSent[pk2]) return;
    if (wk > today && !(dowOf(today) === 0 && now >= tzMs(today, '22:00'))) return;
    if (wk > today && !(db.weeks[wk] || {}).published) return; // next week isn't out yet: the plan waits for it, or for Monday morning
    if (wk <= today && !(db.weeks[wk] || {}).published && now < tzMs(wk, '09:00')) return;
    const nights = [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(wk, d)).filter((d) => d >= today && arr(v.nights).indexOf(dowOf(d)) >= 0 && arr(v.closedOn).indexOf(d) < 0);
    if (!nights.length) return;
    db.planSent[pk2] = iso;
    const lines = nights.map((d) => { const n = placeNight(v, d), b = (db.bookings || {})[bkey(v.id, d)]; if (b && n.tables.length) b.told = iso; return `${dayLabel(tzMs(d, '12:00'))}: ` + (n.tables.length ? `${n.tables.length > 1 ? NUMW(n.tables.length) + ' tables' : 'one table'}, ${n.covers} people at ${n.tables[0].time}` : 'not needed this week, so please release it'); });
    const needed = nights.some((d) => placeNight(v, d).tables.length);
    if (v.backup && !needed) return;
    const ask = v.mode === 'ask' && needed;
    mailPlace(v, `Sidetable this week${needed ? '' : ': nothing needed'}`, `Hi ${v.contact || v.name},\n\nHere’s Sidetable for the week of ${dayLabel(tzMs(wk, '12:00'))}:\n\n${lines.join('\n')}\n\n${ask ? 'Please confirm each evening on your page' : 'Nothing to do unless something can’t work. If it can’t, tell us on your page'}: ${placeLink(v)}\nThe final count for each evening comes at noon the day before. Everyone pays their own check.\n\nThanks,\nSidetable`, () => { delete db.planSent[pk2]; nights.forEach((d) => { const b = (db.bookings || {})[bkey(v.id, d)]; if (b && b.told === iso) delete b.told; if (b && b.askMail === iso) delete b.askMail; }); });
    nights.forEach((d) => { const b = (db.bookings || {})[bkey(v.id, d)]; if (b && b.state === 'asked') b.askMail = iso; });
  }));
  Object.values(db.bookings || {}).forEach((b) => {
    const v = (db.places || {})[b.vid]; if (!v || b.date < today) return;
    const n = placeNight(v, b.date), day = dayLabel(tzMs(b.date, '12:00')), link = placeLink(v), hi = `Hi ${v.contact || v.name},\n\n`;
    const planned = !!db.planSent[v.id + '|' + mondayOf(b.date)];
    if ((b.state === 'asked' ? !b.askMail : b.state === 'held' && !b.told) && planned && n.tables.length) {
      b.told = iso; if (b.state === 'asked') b.askMail = iso;
      mailPlace(v, `Sidetable on ${day}${b.state === 'asked' ? ': can you confirm?' : ''}`, `${hi}Sidetable needs ${n.tables.length > 1 ? NUMW(n.tables.length) + ' tables' : 'a table'} on ${day}${b.more ? ' (one more than you confirmed)' : ''}:\n\n${tableLines(n)}\n\n${b.state === 'asked' ? `Please confirm, or tell us you can’t, by ${dayLabel(confirmBy(b))} at ${timeLabel(confirmBy(b))}` : 'It’s within your usual hold, so nothing to do unless it can’t work'}: ${link}\n\nThanks,\nSidetable`, () => { if (b.told === iso) delete b.told; if (b.askMail === iso) delete b.askMail; });
    }
    if (b.state === 'asked' && b.askMail && !b.remindAt && now >= confirmBy(b)) {
      b.remindAt = iso;
      mailPlace(v, `Reminder: Sidetable on ${day}`, `${hi}We still need a yes or no for ${day} (${n.covers} people). One tap: ${link}\n\nThanks,\nSidetable`, () => { delete b.remindAt; });
      alertOps('unconfirmed:' + bkey(v.id, b.date), 'unconfirmed', `${v.name} hasn’t confirmed ${day} (${n.tables.length} ${n.tables.length > 1 ? 'tables' : 'table'}, ${n.covers} people). Call ${v.contact || 'them'}${v.phone ? ' at ' + v.phone : ''}, then mark it on the Places tab.`);
    }
    const counted = b.state === 'held' || b.state === 'confirmed' || (b.state === 'asked' && b.more), started = tablesAt(v, b.date).some((t) => eventTimes(db.events[t.eventId]).start <= now);
    if (counted && !b.finalAt && now >= finalTime(v, b.date) && n.tables.length && !started) {
      b.finalAt = iso; b.final = snapOf(n); b.told = b.told || iso;
      const when = b.date === today ? 'tonight' : 'tomorrow';
      mailPlace(v, `Sidetable ${when}: ${n.covers} people`, `${hi}Final count for ${when}, ${day}:\n\n${tableLines(n)}\n\nEach table asks for Sidetable and gives the captain’s first name. Separate checks, please.${b.more ? ' One table is new since you confirmed, so please confirm it on your page: ' + link + '.' : ''} If anything changes on our side, you’ll hear from us right away.\n\nThanks,\nSidetable`, () => { delete b.finalAt; delete b.final; });
    } else if (counted && b.finalAt && n.tables.length && b.final !== snapOf(n) && !started) {
      const was = b.final; b.final = snapOf(n); b.updates = (b.updates || 0) + 1;
      mailPlace(v, `Update for Sidetable on ${day}`, `${hi}A change for ${day}. It’s now:\n\n${tableLines(n)}\n\n${n.covers} people in all.\n\nSidetable`, () => { b.final = was; });
    }
    if (b.state === 'released' && b.told && !b.releaseMail) {
      b.releaseMail = iso;
      mailPlace(v, `No Sidetable tables on ${day} after all`, `${hi}Plans changed and we won’t need a table on ${day} after all. Please release it, and thank you for holding it.\n\nSidetable`, () => { delete b.releaseMail; });
    }
  });
}

/* ---------- who runs it: the ops team and the person on duty ----------
   A small team (at first the founder and one or two campus leads) takes turns being on duty, one person a day. Whoever is
   on duty gets every alert by email (an evening with no place, a restaurant that hasn't answered, a table that changed on
   the day, a partner that keeps cancelling) and clears it on the admin page. Partner deals, the weekly publish and the
   long table stay with the ops lead. */
function opsDuty(nowMs) { const O = db.ops || {}, team = arr(O.team); if (!team.length) return null; const d = dowOf(ymdTz(nowMs || Date.now())); return team.find((p) => p.id === (O.rota || {})[d]) || team[0]; }
function alertOps(key, kind, text) {
  db.alerts = arr(db.alerts);
  if (db.alerts.some((a) => a.key === key && !a.done)) return;
  const a = { id: 'a' + rid(4), key, kind, text: clip(text, 400), at: isoNow(), done: false };
  db.alerts.push(a); db.alerts = db.alerts.slice(-200);
  const subj = { unconfirmed: 'a restaurant hasn’t answered', place: 'a table needs a place', table: 'a table changed today', mail: 'an email didn’t go out', flaky: 'a partner keeps cancelling', report: 'a member was reported', week: 'this week’s tables', long: 'the long table count' }[kind] || 'needs a look';
  const p = opsDuty(); if (p && p.email) sendMail(p.email, 'Sidetable: ' + subj, text + '\n\n' + PUBLIC_URL + '/admin').then((r) => { if (!r.ok && !r.show) console.error('alert mail not sent: ' + key); }).catch((e) => console.error('alert mail failed', e.message));
  log('alert', kind, key);
}
function resolveAlerts(key) { arr(db.alerts).forEach((a) => { if (a.key === key && !a.done) { a.done = true; a.doneAt = isoNow(); } }); }
function saveOps(b) {
  const team = arr(b.team).slice(0, 12).map((p) => ({ id: /^p[a-f0-9]{4,8}$/.test(p.id || '') ? p.id : 'p' + rid(3), name: clip(p.name, 60).trim(), email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(p.email || '').trim()) ? String(p.email).trim().slice(0, 120) : '', role: clip(p.role, 40).trim() })).filter((p) => p.name);
  const rota = {}; [0, 1, 2, 3, 4, 5, 6].forEach((d) => { const id = (b.rota || {})[d]; if (team.some((p) => p.id === id)) rota[d] = id; });
  db.ops = { team, rota };
  return opsAdmin();
}
function opsAdmin() {
  const O = db.ops || {}, duty = opsDuty();
  return { team: arr(O.team), rota: O.rota || {}, duty: duty ? duty.name : '', alerts: arr(db.alerts).slice().reverse().filter((a) => !a.done || Date.parse(a.doneAt || 0) > Date.now() - 3 * DAY).slice(0, 60) };
}

/* ---------- when people drop out ----------
   Changing plans is free until noon the day before, when the restaurant gets its final count. One person dropping out just
   makes the table a seat smaller (someone on standby may take it). A table below three isn't a table any more: two at
   dinner reads like a date, and one is dinner alone. The people left join another table that evening if one has room (same
   restaurant first), and otherwise the table is off: they go first next week and can ask for another evening now. */
// the cutoff: noon the day before; tables that only went out after that noon (Monday's, published Sunday evening) stay
// free until ten that morning
function freeUntil(e) {
  const noon = tzMs(addDays(e.date, -1), '12:00'), pub = Date.parse(e.publishedAt || 0) || 0;
  return pub > noon && ymdTz(pub) === addDays(e.date, -1) ? tzMs(e.date, '10:00') : noon;
}
// when a restaurant gets its final count for an evening: the latest free-change cutoff among its tables that night
function finalTime(v, date) { const ts = tablesAt(v, date); return ts.length ? Math.max.apply(null, ts.map((t) => freeUntil(db.events[t.eventId]))) : tzMs(addDays(date, -1), '12:00'); }
const byLabel = (ms, now) => timeLabel(ms) + (ymdTz(ms) === ymdTz(now) ? ' today' : ymdTz(ms) === addDays(ymdTz(now), 1) ? ' tomorrow' : ' ' + weekday(ms));
// someone seated after that (a chair that opened late) can still hand it back for three hours
function freeFor(e, m) { const cut = freeUntil(e), s = ((db.seats[e.id] || {})[m.id]) || {}, at = Date.parse(s.at || 0); return at > cut ? Math.min(eventTimes(e).start, at + 3 * HOUR) : cut; }
function shrink(t, e) {
  const left = seatedIds(t); if (!left.length || left.length >= 3) return null;
  const into = tablesOf(e.id).filter((o) => o !== t && o.published && !o.closed && seatedIds(o).length >= 3 && seatedIds(o).length + left.length <= tableCap(o) && !left.some((id) => seatedIds(o).some((x) => apart(x, id))))
    .sort((a, b) => (((b.venue || {}).id === (t.venue || {}).id) - ((a.venue || {}).id === (t.venue || {}).id)) || seatedIds(a).length - seatedIds(b).length)[0];
  const day = weekday(eventTimes(e).start);
  if (into) {
    left.forEach((id) => { t.out[id] = true; if (into.ids.indexOf(id) < 0) into.ids.push(id); if (into.out) delete into.out[id]; const st = (db.seats[e.id] || {})[id]; if (st) st.at = isoNow(); notify(id, 'merged', { day, no: into.no }); });
    charlie(into.id, `${listNames(left)} ${left.length > 1 ? 'are' : 'is'} joining you from another table, so you’re ${NUMW(seatedIds(into).length)} now. Say hi.`);
    charlie(t.id, `Plans changed and this table got too small, so I moved ${left.length > 1 ? 'you both' : 'you'} to table ${into.no}, same evening. It’s on Tables.`);
    closeTable(t, e, 'merged');
    if (into.venue && into.venue.id) syncBooking(into.venue.id, e.date);
    if (!into.captain || seatedIds(into).indexOf(into.captain) < 0) { pickCaptain(into); captainChanged(into, e); briefCaptain(into); }
    if (Date.now() > freeUntil(e)) alertOps('merge:' + t.id, 'table', `On ${day}, table ${t.no} got too small and joined table ${into.no}${into.venue ? ' at ' + into.venue.name : ''}. The restaurant gets an updated count automatically.`);
    return into;
  }
  closeTable(t, e, 'small');
  return null;
}
// a table closes: too few left ('small'), no restaurant could host ('place', from the admin), or merged into another table
function closeTable(t, e, why) {
  const left = seatedIds(t), day = weekday(eventTimes(e).start);
  t.closed = why; t.closedAt = isoNow(); t.out = t.out || {};
  if (why !== 'merged') {
    const line = why === 'admin' ? `This evening is off: something came up on our side and we had to cancel it. I’m sorry. You’re first in line next week, and you can ask for another evening on Tables.`
      : why === 'place' ? `This table is off. The restaurant couldn’t host and I couldn’t find another spot in time. I’m sorry. You’re first in line next week, and you can ask for another evening on Tables.`
      : t.round > 1 ? `Round ${NUMW(t.round)} on ${day} is off. Plans changed and only ${NUMW(left.length)} of you could still make it, and a table needs three. Pick each other and mark the same evening, and I’ll seat you together.`
      : `This table is off. Plans changed and only ${NUMW(left.length)} of you could still make it, and a table needs three. I’m sorry. You’re first in line next week, and you can ask for another evening on Tables.`;
    left.forEach((id) => {
      t.out[id] = true; t.closedFor = arr(t.closedFor).concat([id]);
      const st = (db.seats[e.id] || {})[id]; if (st && st.status === 'held') { st.status = 'cancelled'; st.cancelledAt = isoNow(); st.byCharlie = true; }
      const m = db.members[id]; if (m) m.prio = (m.prio || 0) + 1;
      notify(id, t.round > 1 && why === 'small' ? 'roundoff' : 'tableoff', { day, n: t.round || 1, why });
    });
    charlie(t.id, line);
    const prev = t.round > 1 && db.tables[t.prev]; if (prev) { charlie(prev.id, line); prev.next = 'off'; }
    if (Date.now() > freeUntil(e) && why === 'small') alertOps('off:' + t.id, 'table', `${t.round > 1 ? 'Round ' + t.round : 'Table ' + t.no} on ${day} closed: only ${NUMW(left.length)} left and no table had room for them.`);
    resolveAlerts('reveal:' + t.id); resolveAlerts('noplace:' + t.id);
    log(t.round > 1 ? 'round-off' : 'table-off', t.id, why + ' ' + left.length);
  }
  if (t.venue && t.venue.id) syncBooking(t.venue.id, e.date);
}
// the admin cancels a whole night: every table closes with a note, the people go first next week, restaurants are released
function cancelEvent(b) {
  const e = db.events[b.id]; if (!e) fail('no such event'); if (e.status === 'cancelled') return { ok: true };
  const ahead = eventTimes(e).start > Date.now();
  if (ahead) tablesOf(e.id).filter((t) => t.published && !t.closed).forEach((t) => closeTable(t, e, 'admin'));
  Object.keys(db.seats[e.id] || {}).forEach((id) => { const st = db.seats[e.id][id]; if (st.status === 'held') { st.status = 'cancelled'; st.cancelledAt = isoNow(); st.byCharlie = true; } });
  e.status = 'cancelled'; e.cancelledAt = isoNow();
  tablesOf(e.id).forEach((t) => { if (t.venue && t.venue.id) syncBooking(t.venue.id, e.date); });
  log('event-cancel', e.id, ahead ? 'ahead' : 'past');
  return { ok: true };
}
function callOff(b) {
  const t = own(db.tables, b.table), e = t && db.events[t.eventId]; if (!t || !e || !t.published) fail('no such table');
  if (t.closed) fail('this table is already closed'); if (eventTimes(e).start < Date.now()) fail('this dinner already started');
  closeTable(t, e, 'place');
  return adminEvent(e.id);
}

/* ---------- late changes ----------
   Changing plans before noon the day before is free. After that the restaurant has the count, so a cancel is a late change
   (one point), and not showing up, as the organizer marks it, is two. Three points in sixty days pause invitations for two
   weeks. Telling Charlie the next morning that you couldn't go counts nothing on its own, and halves a no-show the organizer marks. (Later, with a
   card on file, a late change can carry a small fee instead, the way restaurants charge for empty chairs.) */
const COOL_DAYS = 14;
function lateChanges(m) {
  const since = Math.max(Date.now() - 60 * DAY, m.coolUntil ? Date.parse(m.coolUntil) : 0); let n = 0;
  Object.keys(db.seats).forEach((eid) => { const s = (db.seats[eid] || {})[m.id]; if (s && s.late && !s.byCharlie && Date.parse(s.cancelledAt || 0) > since) n += 1; });
  Object.values(db.tables).forEach((t) => { const e = db.events[t.eventId]; if ((t.attended || {})[m.id] === false && !(t.out || {})[m.id] && e && eventTimes(e).start > since) n += (((db.feedback[t.id] || {})[m.id] || {}).attended === false ? 1 : 2); });
  return n;
}
const cooling = (m) => !!(m && m.coolUntil && Date.parse(m.coolUntil) > Date.now());
function coolCheck(m) {
  if (!m) return;
  if (cooling(m) && m.coolFrom) { const keep = m.coolUntil; m.coolUntil = m.coolPrev || ''; const n = lateChanges(m); m.coolUntil = keep; if (n < 3) { delete m.coolUntil; delete m.coolFrom; log('cool-lifted', m.id, ''); } return; }
  if (cooling(m) || lateChanges(m) < 3) return;
  m.coolFrom = isoNow(); m.coolPrev = m.coolUntil || '';
  m.coolUntil = new Date(Date.now() + COOL_DAYS * DAY).toISOString(); m.coolCount = (m.coolCount || 0) + 1;
  notify(m.id, 'cool', { until: dayLabel(Date.parse(m.coolUntil)) }); log('cool', m.id, m.coolUntil);
}

/* ---------- the captain ----------
   One person at each table gets there first and gives the name at the door ("Sidetable, party of five"), asks for separate
   checks, and opens the deck once everyone's sat down. It rotates: whoever has done it least recently goes first, people who
   said they're happy to before people who didn't say, never someone who said no. Anyone can pass it on until two hours
   before. The restaurant hears only the captain's first name. */
function pickCaptain(t, skip) {
  const pass = arr(t.passed).concat(skip ? [skip] : []), now = Date.now();
  const ok = seatedIds(t).filter((id) => { const m = db.members[id]; return m && !m.deleted && (m.captain || 'maybe') !== 'no' && pass.indexOf(id) < 0; });
  const score = (id) => { const m = db.members[id], recent = m.captainAt && now - Date.parse(m.captainAt) < 21 * DAY; return (m.captain === 'yes' ? 0 : 1) + (recent ? 2 : 0); };
  const pick = ok.sort((a, b) => score(a) - score(b) || ((db.members[a].captainAt || '') < (db.members[b].captainAt || '') ? -1 : 1))[0] || null;
  t.captain = pick;
  if (pick) db.members[pick].captainAt = isoNow();
  return pick;
}
function captainMove(me, b) {
  const t = own(db.tables, b.table); if (!canSeeTable(me, t) || (t.out && t.out[me.id]) || t.closed) fail('no such table');
  const e = db.events[t.eventId]; if (Date.now() > eventTimes(e).start - 2 * HOUR) fail('too close to dinner to change captains');
  if (b.act === 'pass') {
    if (t.captain !== me.id) fail('you’re not the captain of this table');
    t.passed = arr(t.passed).concat([me.id]); delete me.captainAt;
    const next = pickCaptain(t); briefCaptain(t);
    charlie(t.id, next ? `${firstOf(me)} passed the captain’s job to ${firstOf(db.members[next])}. Thanks, ${firstOf(db.members[next])}.` : `${firstOf(me)} passed the captain’s job. Whoever gets there first, give the name at the door: Sidetable, party of ${NUMW(seatedIds(t).length)}.`);
  } else if (b.act === 'take') {
    if (t.captain && t.captain !== me.id && seatedIds(t).indexOf(t.captain) >= 0) fail('this table has a captain');
    t.captain = me.id; me.captainAt = isoNow(); t.passed = arr(t.passed).filter((x) => x !== me.id); capOf(t).briefed = me.id;
    charlie(t.id, `${firstOf(me)} is captain tonight: first one there, gives the name at the door.`);
  } else fail('unknown move');
  if (t.venue && t.venue.id) syncBooking(t.venue.id, e.date);
  return { ok: true };
}
// a new captain after the noon note: the table and the new captain both hear
function captainChanged(t, e) { if (!t.captainNoted || !t.captain) return; charlie(t.id, `Plans changed, so ${firstOf(db.members[t.captain])} is captain tonight: first one there, gives the name at the door (Sidetable, party of ${NUMW(seatedIds(t).length)}).`); notify(t.captain, 'captain', { day: weekday(eventTimes(e).start) }); }
// on the day, at noon: who the captain is, in the chat
function captainNote(t) {
  if (!t.published || t.closed || t.captainNoted) return;
  t.captainNoted = true;
  if (!t.captain || seatedIds(t).indexOf(t.captain) < 0) pickCaptain(t);
  if (t.captain) charlie(t.id, `Tonight’s captain is ${firstOf(db.members[t.captain])}: first one there, gives the name at the door (Sidetable, party of ${NUMW(seatedIds(t).length)}) and asks for separate checks.`);
}

/* ---------- the captain's three missions ----------
   Each captain gets a brief with three missions:
   1. Pick the spot: one of the partner restaurants with room that evening (Charlie's pick stands if they don't), until
      the restaurant gets its final count. The table only finds out at noon on the day.
   2. Rally the vote: get at least three of every four at the table to vote on tonight's question (two nudges allowed).
   3. Settle up: ask for separate checks, and tick it off on the night.
   All three earn a captain's stripe, and tablemates can thank their captain the next morning. Stripes come with a perk:
   industry tables (dinner with a guest from the industry) open to captains first, and seat them first. */
const RANKS = [[5, 'Commodore'], [3, 'Senior captain'], [1, 'Captain'], [0, 'Deckhand']];
const rankOf = (n) => RANKS.find((r) => n >= r[0])[1];
const capOf = (t) => (t.cap = t.cap || { spot: null, nudges: [], checks: null, salutes: {} });
const isCaptain = (t, me) => !!(t && t.published && !t.closed && t.captain === me.id && seatedIds(t).indexOf(me.id) >= 0);
// the partners that could take this table that evening: where it is now, then the rest with room (backups stay out of it)
function spotOptions(t) {
  const e = db.events[t.eventId]; if (!e) return [];
  const cur = t.venue && t.venue.id;
  return Object.values(db.places || {}).filter((v) => !v.gone && (v.id === cur || (!v.backup && placeFits(v, t, e))))
    .sort((a, b) => ((b.id === cur) - (a.id === cur)) || (((b.area || '') === e.area) - ((a.area || '') === e.area)) || (a.name < b.name ? -1 : 1)).slice(0, 3)
    .map((v) => ({ id: v.id, name: v.name, area: v.area || '', note: v.vibe || '', mine: v.id === cur }));
}
function missions(t, now, light) {
  now = now || Date.now();
  const e = db.events[t.eventId], tm = eventTimes(e), c = capOf(t), ids = seatedIds(t), g = t.game, by = freeUntil(e), open = now < by;
  const manual = !!(t.venue && t.venue.name && !t.venue.id), opts = open && !light ? spotOptions(t) : [];
  const choice = open && !light ? opts.length > 1 : c.hadChoice !== false;
  const spot = { state: c.spot ? 'picked' : manual || !choice ? 'set' : open ? 'open' : 'missed', by, options: opts, at: c.spot && t.venue ? t.venue.name : '' };
  spot.done = spot.state === 'picked' || spot.state === 'set';
  const need = Math.max(2, Math.ceil(ids.length * 0.75)), voted = !g ? 0 : g.pick && g.turnout != null ? g.turnout : ids.filter((id) => g.votes[id]).length;
  const last = c.nudges.length ? Date.parse(c.nudges[c.nudges.length - 1]) : 0;
  const vote = { done: !!g && voted >= need, voted, total: ids.length, need, closed: !g || !!g.pick, nudgesLeft: Math.max(0, 2 - c.nudges.length), nudgeAt: last ? last + 3 * HOUR : 0 };
  const checks = { done: !!c.checks, open: now >= tm.start - 30 * 60000 && now <= tm.start + 36 * HOUR, later: now < tm.start - 30 * 60000 };
  return { spot, vote, checks, salutes: Object.keys(c.salutes).length, stripe: spot.done && vote.done && checks.done };
}
// a captain's record: tables captained (the dinner happened), stripes, missions done, and thanks from tablemates
function captainStats(m, now) {
  now = now || Date.now(); const out = { tables: 0, stripes: 0, missions: 0, salutes: 0 };
  Object.values(db.tables).forEach((t) => {
    if (t.captain !== m.id || !t.published || t.closed || seatedIds(t).indexOf(m.id) < 0) return;
    const e = db.events[t.eventId]; if (!e || e.status === 'cancelled' || eventTimes(e).start > now) return;
    const M = missions(t, now, true); out.tables++; out.salutes += M.salutes; out.missions += [M.spot.done, M.vote.done, M.checks.done].filter(Boolean).length; if (M.stripe) out.stripes++;
  });
  out.rank = rankOf(out.stripes); out.next = (RANKS.slice().reverse().find((r) => r[0] > out.stripes) || [])[0] || 0;
  return out;
}
// what a tablemate sees about the captain; the captain also sees their brief
function capView(t, me, now) {
  if (!t.captain || seatedIds(t).indexOf(t.captain) < 0) return null;
  now = now || Date.now();
  const M = missions(t, now, t.captain !== me.id), c = capOf(t), out = { me: t.captain === me.id, salutes: M.salutes, saluted: !!c.salutes[me.id], stripe: M.stripe };
  if (!out.me) return out;
  const st = captainStats(me, now);
  return Object.assign(out, {
    spot: { state: M.spot.state, done: M.spot.done, by: byLabel(M.spot.by, now), options: M.spot.options, at: M.spot.at },
    vote: Object.assign({}, M.vote, { nudgeAt: M.vote.nudgeAt > now ? timeLabel(M.vote.nudgeAt) : '' }),
    checks: M.checks, done: [M.spot.done, M.vote.done, M.checks.done].filter(Boolean).length, stripes: st.stripes, rank: st.rank, next: st.next
  });
}
// the brief goes to whoever is captain, once each time it changes hands
function briefCaptain(t) {
  if (!t || !t.captain) return;
  const c = capOf(t); if (c.hadChoice == null) c.hadChoice = spotOptions(t).length > 1;
  const e = db.events[t.eventId]; if (c.briefed === t.captain || !e || eventTimes(e).start < Date.now()) return;
  c.briefed = t.captain; notify(t.captain, 'captainbrief', { day: weekday(eventTimes(e).start) });
}
function captainSpot(me, b) {
  const t = own(db.tables, b.table); if (!isCaptain(t, me)) fail('you’re not the captain of this table');
  const e = db.events[t.eventId]; if (Date.now() >= freeUntil(e)) fail('the spot is locked now, since the restaurant has its count');
  const opt = spotOptions(t).find((o) => o.id === b.place); if (!opt) fail('that spot isn’t open that evening');
  const c = capOf(t), first = !c.spot;
  if (!opt.mine) {
    const was = t.venue; t.venue = null; if (was && was.id) syncBooking(was.id, e.date);
    placeTable(t, opt.id);
    if (!t.venue || t.venue.id !== opt.id) { // it filled up a moment ago: back where it was
      if (t.venue && t.venue.id) { const v2 = t.venue.id; t.venue = null; syncBooking(v2, e.date); }
      t.venue = was; if (was && was.id) syncBooking(was.id, e.date);
      fail('that spot just filled up, so pick another');
    }
  }
  c.spot = { vid: opt.id, at: isoNow() };
  if (first) charlie(t.id, `${firstOf(me)} picked the spot for ${weekday(eventTimes(e).start)}. It stays a secret until noon on the day`, 'cap');
  log('captain-spot', t.id, opt.id);
  return { ok: true, cap: capView(t, me) };
}
function captainNudge(me, b) {
  const t = own(db.tables, b.table); if (!isCaptain(t, me)) fail('you’re not the captain of this table');
  advanceGame(t); const g = t.game; if (!g || g.pick) fail('the vote is already closed');
  const c = capOf(t), now = Date.now(), M = missions(t, now, true);
  if (c.nudges.length >= 2) fail('two nudges is the limit, so let the table catch up');
  if (M.vote.nudgeAt > now) fail('you nudged a moment ago, so try again after ' + timeLabel(M.vote.nudgeAt));
  const quiet = seatedIds(t).filter((id) => id !== me.id && !g.votes[id]); if (!quiet.length) fail('everyone else has voted already');
  c.nudges.push(isoNow());
  const left = Math.max(1, M.vote.need - M.vote.voted);
  (db.chats[t.id] = db.chats[t.id] || []).push({ id: rid(6), from: me.id, kind: 'nudge', text: `Captain here: three cards, one winner. ${left > 1 ? NUMW(left) + ' more votes' : 'One more vote'} and we know what we’re arguing about`, at: isoNow() });
  quiet.forEach((id) => notify(id, 'nudge', { other: firstOf(me) }));
  log('captain-nudge', t.id, String(quiet.length));
  return { ok: true, nudged: quiet.length, cap: capView(t, me) };
}
function captainChecks(me, b) {
  const t = own(db.tables, b.table); if (!isCaptain(t, me)) fail('you’re not the captain of this table');
  const c = capOf(t), M = missions(t, Date.now(), true);
  if (b.off) c.checks = null;
  else { if (!M.checks.open) fail(M.checks.later ? 'this one is for the night of the dinner' : 'that dinner was a while ago'); if (!c.checks) { c.checks = { at: isoNow() }; log('captain-checks', t.id, ''); } }
  return { ok: true, cap: capView(t, me) };
}

/* ---------- the long table: a real room with a real limit ----------
   The ops lead books the room by hand, weeks ahead: a private room usually comes with a food-and-drink minimum and a final
   count about a week out, or a sponsor hosts. RSVPs stop at the room's limit and the rest wait in line; they close five days
   before at noon, when the count goes to the venue. After that you can still say you can't come, and the first person in
   line gets the seat. */
const LONG_CAP = 40;
const longCap = (mo) => (((db.longSpot || {})[mo] || {}).cap) || LONG_CAP;
const longCloses = (mo) => tzMs(addDays(longDate(mo), -5), '12:00');

function publish(b, quiet) {
  const e = db.events[b.event]; if (!e) fail('no such event');
  if (e.status !== 'draft') fail('draft the tables first');
  // a table that shrank under three while it was a draft doesn't go out: its people wait, first in line
  tablesOf(e.id).filter((t) => seatedIds(t).length < 3).forEach((t) => { e.wait = arr(e.wait).concat(seatedIds(t)); delete db.tables[t.id]; });
  const ts = tablesOf(e.id); if (!ts.length) { if (!quiet) fail('no tables to publish'); arr(e.wait).forEach((id) => { const m = db.members[id]; if (m) m.prio = (m.prio || 0) + 1; }); e.status = 'cancelled'; return { ok: true }; }
  const when = eventTimes(e);
  ts.forEach((t) => {
    t.published = true; t.publishedAt = new Date().toISOString(); placeTable(t); pickCaptain(t); noPlace(t, when.start); briefCaptain(t);
    charlie(t.id, `Welcome, table ${t.no}. Why you ${NUMW(seatedIds(t).length)}:\n${(t.why || []).join('\n')}`, 'why');
    if (when.start > Date.now()) startGame(t); // the menu for tonight's question
    t.ids.forEach((id) => { const m = db.members[id]; if (db.standby) delete db.standby[id]; if (m) { m.prio = 0; notify(id, 'table', { n: t.ids.length - 1, day: weekday(when.start) }); } });
  });
  (e.wait || []).forEach((id) => { const m = db.members[id]; if (m) { m.prio = (m.prio || 0) + 1; notify(id, 'wait', {}); } });
  e.status = 'published'; e.publishedAt = new Date().toISOString();
  // open chairs go to whoever is waiting for that kind of table that evening
  if (when.start > Date.now()) ts.forEach((t) => { for (let i = 0; i < 6 && seatedIds(t).length < tableCap(t) && fillChair(t, e); i++); });
  log('publish', e.id, ts.length + ' tables');
  return quiet ? { ok: true } : adminEvent(e.id);
}
// a table that went out with no partner able to take it: whoever is on duty hears now, not at noon on the day
function noPlace(t, start) { if (!t.venue && Object.keys(db.places || {}).length) alertOps('noplace:' + t.id, 'place', `Table ${t.no} on ${dayLabel(start)} went out, and no partner has room for it that evening. Find a spot or call it off.`); }
function NUMW(n) { return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][n] || String(n); }

/* ---------- chats ---------- */
function charlie(tableId, text, kind) { (db.chats[tableId] = db.chats[tableId] || []).push({ id: rid(6), from: 'charlie', text, kind: kind || '', at: new Date().toISOString() }); }
function canSeeTable(me, t) { return !!t && t.published && t.ids.indexOf(me.id) >= 0; }
function postChat(me, b) {
  const t = db.tables[b.table]; if (!canSeeTable(me, t)) fail('no such table');
  if (t.out && t.out[me.id]) fail('you left this table');
  const text = clip(b.text, 800).trim(); if (!text) fail('message required');
  db.chats[t.id] = db.chats[t.id] || [];
  db.chats[t.id].push({ id: rid(6), from: me.id, text, at: new Date().toISOString() });
  if (db.chats[t.id].length > 2000) db.chats[t.id] = db.chats[t.id].slice(-2000);
  me.read['t:' + t.id] = new Date().toISOString();
  return { ok: true };
}
function chatOut(list, after) { return (list || []).filter((x) => !after || x.at > after).slice(-300).map((x) => ({ id: x.id, from: x.from, first: x.from === 'charlie' ? 'Charlie' : firstOf(db.members[x.from]), text: x.text, kind: x.kind || '', at: x.at })); }
function unread(me, key, list) { const r = me.read[key] || ''; return (list || []).filter((x) => x.at > r && x.from !== me.id).length; }

/* ---------- tonight's question: the game every table plays ----------
   When a table is set, Charlie puts three question cards on its menu (shared.js CARDS), picked for who's at the table.
   Everyone votes; the card with the most votes wins when the whole table has voted or at noon the day before (if no one
   votes, Charlie picks). Then everyone picks a side in secret and can guess how the table will split. The split opens
   when dinner starts, the deck's second round is built on it, and the next morning people say if they changed their mind. */
const GAME_VOTE_HOURS = 3; // a table set late still gets at least this long to vote
// a stable number in [0, 1) from a string (FNV-1a), so the order is the same every time without any randomness
function shuffleKey(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
// a game lives on a table or on a hang; this is what the engine needs from either one
const isPop = (x) => !!(x && x.host);
// a card by id, or the copy kept when it was picked (cards get retired as the news moves on)
const cardOf = (g, id) => SX.card(id) || (g && g.snap && g.snap.id === id ? g.snap : null);
// "today", "tomorrow" or the weekday, for hangs that are often a few hours away
const dayWord = (ms) => { const d = ymdTz(ms), t = ymdTz(Date.now()); return d === t ? 'today' : d === addDays(t, 1) ? 'tomorrow' : weekday(ms); };
function gctx(x) {
  if (isPop(x)) {
    const tm = popTimes(x), ids = [x.host].concat(x.joined).filter((id) => db.members[id] && !db.members[id].deleted);
    return { ok: !x.cancelled, ids, start: tm.start, after: tm.end, key: 'p:' + x.id, kind: (x.kind || (x.track ? 'topic' : 'social')) === 'topic' ? 'topic' : 'kindred', track: x.track || '', vibe: x.vibe || '', hang: true,
      day: dayWord, title: 'The big question' };
  }
  const e = x.published && db.events[x.eventId]; if (!e || e.status === 'cancelled') return { ok: false };
  const tm = eventTimes(e);
  return { ok: true, ids: seatedIds(x), start: tm.start, after: tm.pushFeedback, key: x.id, kind: e.type, track: x.track, hang: false, day: weekday, title: 'Tonight’s question' };
}
// a life card is purely about people (friends, daily life), with no tech track on it
const lifeCard = (c) => c.tr.indexOf('social') >= 0 && c.tr.every((t) => t === 'social' || t === 'cities');
function gameScore(c, cx, people, seen, salt) {
  const social = c.tr.indexOf('social') >= 0;
  let s = 0;
  if (cx.kind === 'kindred') { s += lifeCard(c) ? 8 : -30; if (cx.vibe && (c.vibe || []).indexOf(cx.vibe) >= 0) s += 4; }
  else { if (c.tr.indexOf(cx.track) >= 0) s += 6; if (social && c.tr.length === 1) s -= 8; }
  people.forEach((m) => { const tr = ((m && m.profile) || {}).tracks || []; if (c.tr.some((x) => tr.indexOf(x) >= 0)) s += 1; });
  if (seen.has(c.id)) s -= 20; // nobody gets the same question twice
  // a stable shuffle, so two tables on the same night don't all get the same menu
  return s + shuffleKey(salt + c.id);
}
function startGame(x) {
  const cx = gctx(x); if (!cx.ok) return;
  const people = cx.ids.map((id) => db.members[id]), seen = new Set(), mine = (list) => list.some((id) => cx.ids.indexOf(id) >= 0);
  Object.values(db.tables).forEach((y) => { if (y.game && y !== x && mine(y.ids)) seen.add(y.game.pick || ''); });
  Object.values(db.pops).forEach((y) => { if (y.game && y !== x && mine([y.host].concat(y.joined))) seen.add(y.game.pick || ''); });
  const ranked = SX.CARDS.slice().sort((a, b) => gameScore(b, cx, people, seen, x.id) - gameScore(a, cx, people, seen, x.id)), cards = [];
  // three different formats when the top of the list allows it
  ranked.forEach((c) => { if (cards.length < 3 && !cards.some((y) => y.k === c.k)) cards.push(c); });
  ranked.forEach((c) => { if (cards.length < 3 && cards.indexOf(c) < 0) cards.push(c); });
  const now = Date.now();
  if (cx.start < now + 45 * 60000) return; // too close to start for a vote to mean anything
  // a hang often happens within hours: votes close an hour before (at least 20 minutes from now); a table votes until noon the day before
  const voteBy = cx.hang ? Math.min(cx.start - 5 * 60000, Math.max(now + 20 * 60000, cx.start - HOUR))
    : Math.min(cx.start - 15 * 60000, Math.max(now + 30 * 60000, Math.min(cx.start - 2 * HOUR, Math.max(tzMs(addDays(db.events[x.eventId].date, -1), '12:00'), now + GAME_VOTE_HOURS * HOUR))));
  x.game = { cards: cards.map((c) => c.id), votes: {}, pick: null, sides: {}, guess: {}, final: {}, voteBy, notes: {} };
  charlie(cx.key, cx.hang
    ? `Three questions for this hang. The one with the most votes is what you argue about when you meet. Votes close ${dayWord(voteBy)} at ${atTime(voteBy)}.`
    : `This week’s menu is up. Pick the question your table argues about on ${weekday(cx.start)}. Three cards, one winner, votes close ${weekday(voteBy)} at ${atTime(voteBy)}.`, 'menu');
}
// a hang gets its question when it's posted (and older hangs get one the first time someone opens them)
function ensurePopGame(u) { if (u && !u.game && !u.cancelled && popTimes(u).start > Date.now() + 10 * 60000) startGame(u); }
const atTime = (ms) => (timeLabel(ms) === '12:00 PM' ? 'noon' : timeLabel(ms));
const listNames = (ids) => { const n = ids.map((id) => firstOf(db.members[id])); return n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; };
// moves the game along with the clock: lock the vote, note when everyone has a side, open the split, wrap up afterwards
function advanceGame(x, now) {
  const g = x && x.game, cx = g && gctx(x); if (!g || !cx.ok) return false;
  now = now || Date.now();
  const ids = cx.ids, when = `${cx.day(cx.start)} at ${timeLabel(cx.start)}`; let changed = false;
  if (!g.pick) {
    const voters = ids.filter((id) => g.votes[id]);
    // a hang keeps its vote open while people are still joining, unless at least three are in and all of them voted
    if ((voters.length >= ids.length && (!cx.hang || ids.length >= 3)) || now >= g.voteBy) {
      const n = {}; voters.forEach((id) => { n[g.votes[id]] = (n[g.votes[id]] || 0) + 1; });
      g.pick = g.cards.slice().sort((a, b) => (n[b] || 0) - (n[a] || 0) || g.cards.indexOf(a) - g.cards.indexOf(b))[0];
      g.pickedAt = now; g.by = voters.length ? 'table' : 'charlie'; g.turnout = voters.length; changed = true;
      const c = cardOf(g, g.pick) || {}; if (SX.card(g.pick)) g.snap = JSON.parse(JSON.stringify(SX.card(g.pick)));
      charlie(cx.key, (voters.length ? `The ${cx.hang ? 'group' : 'table'} has spoken (${n[g.pick]} of ${voters.length} votes): ` : 'Nobody voted, so I picked one for you: ')
        + `“${c.q}”\n\nNow pick your side. Nobody sees it until ${when}, and you can guess how the ${cx.hang ? 'group' : 'table'} splits.`, 'game');
    }
  }
  if (g.pick && !g.revealed && !g.notes.sealed && ids.length > 1 && ids.every((id) => g.sides[id])) {
    g.notes.sealed = true; changed = true;
    charlie(cx.key, `All ${NUMW(ids.length)} of you picked a side. It’s sealed until ${when}. My lips are zipped.`, 'game');
  }
  if (g.pick && !g.revealed && now >= cx.start) {
    g.revealed = true; g.revealedAt = now; changed = true;
    const c = cardOf(g, g.pick) || {}, A = ids.filter((id) => g.sides[id] === 'a'), B = ids.filter((id) => g.sides[id] === 'b');
    if (!A.length && !B.length) charlie(cx.key, `Nobody picked a side on “${c.q}”, so decide out loud ${cx.hang ? 'when you meet' : 'tonight. Round 2 of the deck is yours'}.`, 'game');
    else {
      const oracle = ids.filter((id) => g.guess[id] != null && g.guess[id] === A.length), lone = A.length === 1 ? A : B.length === 1 ? B : [];
      charlie(cx.key, `The split is in: ${A.length} for “${c.a}”, ${B.length} for “${c.b}”.`
        + (lone.length && A.length + B.length > 2 ? ` ${firstOf(db.members[lone[0]])} is holding the line alone.` : '')
        + (oracle.length ? ` ${listNames(oracle)} called it exactly.` : '')
        + (cx.hang ? ' Now argue it out in person.' : ' Open the deck: round 2 is all yours.'), 'game');
    }
  }
  if (g.revealed && !g.notes.morning && now >= cx.after) {
    const voted = ids.filter((id) => g.final[id] && g.sides[id]), sided = ids.filter((id) => g.sides[id]);
    if (voted.length && (voted.length >= sided.length || now >= cx.after + 36 * HOUR)) {
      g.notes.morning = true; changed = true;
      const moved = voted.filter((id) => g.final[id] !== g.sides[id]);
      charlie(cx.key, moved.length ? `${cx.hang ? '' : 'Last night '}${listNames(moved)} changed ${moved.length > 1 ? 'their minds' : 'their mind'}. That counts as winning.`
        : cx.hang ? 'Nobody changed their mind. Stubborn bunch. I respect it.' : 'Last night nobody changed their mind. Stubborn table. I respect it.', 'game');
    }
  }
  if (changed) save();
  return changed;
}
// b.table for a table, b.pop for a hang
function playGame(me, b) {
  let x;
  if (b.pop) { x = db.pops[b.pop]; if (!x || !popVisible(x, me) || (x.host !== me.id && x.joined.indexOf(me.id) < 0)) fail('join the hang to play'); ensurePopGame(x); }
  else { x = db.tables[b.table]; if (!canSeeTable(me, x)) fail('no such table'); if (x.out && x.out[me.id]) fail('you left this table'); }
  const g = x.game; if (!g) fail(b.pop ? 'this hang has no question' : 'this table has no question');
  advanceGame(x);
  const side = b.side === 'a' || b.side === 'b' ? b.side : null;
  if (b.act === 'vote') { if (g.pick) fail('the vote is closed'); if (g.cards.indexOf(b.card) < 0) fail('no such card'); g.votes[me.id] = b.card; }
  else if (b.act === 'side') { if (!g.pick) fail('vote on the question first'); if (g.revealed) fail('the split is already out'); if (!side) fail('pick a side'); g.sides[me.id] = side; }
  else if (b.act === 'guess') { if (!g.pick || g.revealed) fail('guessing is closed'); const n = Math.round(+b.n); if (!(n >= 0 && n <= gctx(x).ids.length)) fail('guess between 0 and the table size'); g.guess[me.id] = n; }
  else if (b.act === 'final') { if (!g.revealed) fail('after dinner'); if (!side) fail('pick a side'); g.final[me.id] = side; }
  else fail('unknown move');
  advanceGame(x);
  return { ok: true, game: gameView(x, me) };
}
// what one person sees: the menu and live votes; then their own side (everyone else's stays sealed); then the whole split
function gameView(x, me) {
  const g = x.game; if (!g) return null;
  const cx = gctx(x), ids = cx.ids, pub = (c) => c && { id: c.id, k: c.k, kind: SX.KINDS[c.k], heat: c.heat, q: c.q, kw: c.kw, a: c.a, b: c.b, why: c.why, reads: (c.reads || []).map(([title, src, url]) => ({ title, src, url })) };
  const out = { stage: !g.pick ? 'vote' : !g.revealed ? 'sides' : 'revealed', n: ids.length, voteBy: new Date(g.voteBy).toISOString(), revealAt: new Date(cx.start).toISOString(),
    revealLabel: `${cx.day(cx.start)} at ${timeLabel(cx.start)}`, voteLabel: `${cx.day(g.voteBy)} at ${atTime(g.voteBy)}`, by: g.by || null, title: cx.title, hang: cx.hang };
  if (!g.pick) {
    out.cards = g.cards.filter((id) => SX.card(id)).map((id) => Object.assign(pub(SX.card(id)), { voters: ids.filter((y) => g.votes[y] === id).map((y) => ({ id: y, first: y === me.id ? 'You' : firstOf(db.members[y]) })) }));
    out.myVote = g.votes[me.id] || null; out.voted = ids.filter((y) => g.votes[y]).length;
    return out;
  }
  out.card = pub(cardOf(g, g.pick)) || { id: g.pick, k: 'take', kind: SX.KINDS.take, heat: 1, q: 'Tonight’s question', a: 'Agree', b: 'Disagree', kw: 'Tonight’s question', why: '', reads: [] }; out.mySide = g.sides[me.id] || null; out.myGuess = g.guess[me.id] != null ? g.guess[me.id] : null; out.sided = ids.filter((y) => g.sides[y]).length;
  if (g.revealed) {
    const who = (s) => ids.filter((y) => g.sides[y] === s).map((y) => ({ id: y, first: y === me.id ? 'You' : firstOf(db.members[y]) }));
    out.A = who('a'); out.B = who('b');
    out.oracle = ids.filter((y) => g.guess[y] != null && g.guess[y] === out.A.length).map((y) => (y === me.id ? 'You' : firstOf(db.members[y])));
    out.myFinal = g.final[me.id] || null; out.finals = ids.filter((y) => g.final[y] && g.sides[y]).length;
    out.moved = ids.filter((y) => g.final[y] && g.sides[y] && g.final[y] !== g.sides[y]).map((y) => (y === me.id ? 'You' : firstOf(db.members[y])));
  }
  return out;
}
// the one-line version for lists: where the game is and whether it's waiting on you
function gameSum(x, me) {
  const g = x.game; if (!g) return null;
  return { stage: !g.pick ? 'vote' : !g.revealed ? 'sides' : 'revealed', mine: !g.pick ? !!g.votes[me.id] : !!g.sides[me.id], q: g.pick ? (cardOf(g, g.pick) || {}).q || null : null, kw: g.pick ? (cardOf(g, g.pick) || {}).kw || null : null, title: gctx(x).title };
}

/* ---------- after the dinner ---------- */
function mutualPairs(t) {
  const fb = db.feedback[t.id] || {}, out = [];
  Object.keys(fb).forEach((a) => arr(fb[a].picks).forEach((b) => { if (a < b && fb[b] && arr(fb[b].picks).indexOf(a) >= 0) out.push([a, b]); }));
  return out;
}
function isMutual(a, b) { return Object.values(db.tables).some((t) => t.published && t.ids.indexOf(a) >= 0 && t.ids.indexOf(b) >= 0 && mutualPairs(t).some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))); }
function feedback(me, b) {
  const t = db.tables[b.table]; if (!canSeeTable(me, t)) fail('no such table');
  if (t.out && t.out[me.id]) fail('you left this table before the dinner');
  const e = db.events[t.eventId]; if (Date.now() < eventTimes(e).start) fail('the dinner has not happened yet');
  const others = seatedIds(t).filter((x) => x !== me.id);
  const before = new Set(mutualPairs(t).map((p) => pk(p[0], p[1])));
  const f = (db.feedback[t.id] = db.feedback[t.id] || {}), went = b.attended !== false;
  const prev = f[me.id];
  f[me.id] = { attended: went, rating: Math.max(0, Math.min(5, Math.round(+b.rating || 0))), picks: !went ? [] : b.picks === undefined && prev ? arr(prev.picks) : arr(b.picks).filter((x) => others.indexOf(x) >= 0),
    again: went && !!b.again, at: new Date().toISOString() };
  if (went) setLoose(me, t, b);
  if (b.salute != null && t.captain && t.captain !== me.id && seatedIds(t).indexOf(t.captain) >= 0) {
    const S = capOf(t).salutes;
    if (b.salute && went) { if (!S[me.id]) { S[me.id] = isoNow(); if (!capOf(t).thanked) { capOf(t).thanked = true; notify(t.captain, 'salute', {}); } } } else delete S[me.id];
  }
  const now = mutualPairs(t).filter((p) => !before.has(pk(p[0], p[1])));
  now.forEach(([a, c]) => { notify(a, 'mutual', { other: firstOf(db.members[c]) }); notify(c, 'mutual', { other: firstOf(db.members[a]) }); });
  const mine = mutualPairs(t).filter((p) => p.indexOf(me.id) >= 0).map((p) => (p[0] === me.id ? p[1] : p[0]));
  const nt = roundTwo(t);
  return { ok: true, mutual: mine.map((id) => ({ id, first: firstOf(db.members[id]) })), again: againView(t, me), booked: !!(nt && nt.ids.indexOf(me.id) >= 0) };
}

/* ---------- round two: the same table, two weeks later ----------
   The morning after, everyone answers "same table in two weeks?". Once most of the table says yes (three of four or five,
   four of six), Charlie books round two: the same weekday two weeks on, the same spot, everyone who said yes. Up to two
   chairs stay open for people who marked that evening and didn't get a table, so a table that keeps meeting never closes
   into a clique. Round two can lead to round three the same way. */
const againNeed = (n) => Math.max(3, Math.ceil(n * 0.6));
// how many a table can seat: six, or fewer if its restaurant only holds fewer
const tableCap = (t) => Math.min(6, (t && t.venue && t.venue.id && ((db.places || {})[t.venue.id] || {}).seats) || 6);
const ROUND_AHEAD = 3 * DAY; // round two is only booked while it's still at least three days away
const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const mondayOf = (date) => addDays(date, -((dowOf(date) + 6) % 7));
const utcOf = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); };
const dayDiff = (a, b) => Math.round((utcOf(b) - utcOf(a)) / DAY);
const byStart = (a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
function againIds(t) { const fb = db.feedback[t.id] || {}; return seatedIds(t).filter((id) => fb[id] && fb[id].again && fb[id].attended !== false && db.members[id] && !db.members[id].deleted); }
// two people who must never share a table: one blocked or reported the other
const apart = (a, b) => blockedEither(a, b) || db.reports.some((r) => (r.by === a && r.who === b) || (r.by === b && r.who === a));
function keepApart(ids) { const out = []; ids.forEach((id) => { if (!out.some((k) => apart(k, id))) out.push(id); }); return out; }
// someone already has a dinner that evening: a seat held at any table or special night, or a seat at a published table
function busyOn(id, date) {
  const live = (eid) => (db.events[eid] || {}).date === date && db.events[eid].status !== 'cancelled';
  return Object.keys(db.seats).some((eid) => ((db.seats[eid] || {})[id] || {}).status === 'held' && live(eid))
    || Object.values(db.tables).some((x) => x.published && seatedIds(x).indexOf(id) >= 0 && live(x.eventId));
}
// who is back at a round table: the people seated there who said yes at the table before it
function backIds(t) { const prev = db.tables[t.prev], yes = prev ? againIds(prev) : []; return seatedIds(t).filter((id) => yes.indexOf(id) >= 0); }
function roundWhy(t) {
  const prev = db.tables[t.prev], g = prev && prev.game, c = g && g.pick && cardOf(g, g.pick), was = prev ? seatedIds(prev) : [], ids = seatedIds(t);
  const back = backIds(t), fresh = ids.filter((id) => back.indexOf(id) < 0), out = [];
  out.push(`*${capFirst(NUMW(back.length))} of you* said yes to round ${NUMW(t.round)} the morning after`);
  if (c && g.revealed) { const A = was.filter((id) => g.sides[id] === 'a').length, B = was.filter((id) => g.sides[id] === 'b').length; if (A + B) out.push(`Last time you argued *${c.kw || c.q}*${A === B ? `, and it ended ${A} to ${B}. Tonight settles it` : `, and it went ${Math.max(A, B)} to ${Math.min(A, B)}`}`); }
  const moved = g && g.revealed ? back.filter((id) => g.final[id] && g.sides[id] && g.final[id] !== g.sides[id]).length : 0;
  if (moved) out.push(`${capFirst(NUMW(moved))} of you changed sides by the morning, so tonight is a rematch`);
  const open = Math.min(tableCap(t), back.length + 2) - ids.length;
  if (fresh.length) out.push(`*${listNames(fresh)}* ${fresh.length > 1 ? 'are' : 'is'} new this round`);
  else if (open > 0) out.push(`*${capFirst(NUMW(open))} ${open > 1 ? 'chairs stay' : 'chair stays'} open* for someone new`);
  return out.slice(0, 4);
}
function roundTwo(t) {
  if (t && t.next && db.tables[t.next]) return lateYes(t, db.tables[t.next]);
  if (!t || t.next || !t.published) return null;
  const e = db.events[t.eventId]; if (!e || e.status === 'cancelled') return null;
  const date = addDays(e.date, 14); if (tzMs(date, e.time) < Date.now() + ROUND_AHEAD) return null; // too late to book two weeks on
  const yes = againIds(t); if (yes.length < againNeed(seatedIds(t).length)) { againNudge(t, yes.length); return null; }
  const ids = keepApart(yes.filter((id) => !db.members[id].paused && !cooling(db.members[id]) && !busyOn(id, date))), round = (t.round || 1) + 1;
  if (ids.length < 3) { if (t.busyNoted) return null; t.busyNoted = true; charlie(t.id, `Most of you want round ${NUMW(round)}, but most of you already have a dinner ${weekday(tzMs(date, '12:00'))} two weeks from now. Pick each other and mark the same evening, and I’ll seat you together.`); return null; }
  const now = new Date().toISOString();
  const ne = { id: 'e' + rid(4), type: e.type, date, time: e.time, meal: e.meal || 'dinner', week: mondayOf(date), generated: true, round, area: e.area, status: 'published', createdAt: now, publishedAt: now, notified: {}, wait: [] };
  db.events[ne.id] = ne; db.seats[ne.id] = {};
  ids.forEach((id) => { db.seats[ne.id][id] = { at: now, size: 'either', diet: ((db.members[id].profile || {}).diet) || [], status: 'held' }; });
  const nt = { id: 't' + rid(5), eventId: ne.id, no: 1, track: t.track, ids: ids.slice(), round, root: t.root || t.id, prev: t.id, venue: t.venue && !t.venue.id ? Object.assign({}, t.venue) : null,
    published: true, publishedAt: now, attended: {}, createdAt: now, score: t.score, flags: [], split: t.split || null };
  db.tables[nt.id] = nt; t.next = nt.id; placeTable(nt, t.venue && t.venue.id); pickCaptain(nt); noPlace(nt, tzMs(date, e.time)); briefCaptain(nt); nt.same = !!(nt.venue && t.venue && nt.venue.name === t.venue.name); nt.why = roundWhy(nt);
  const when = eventTimes(ne).start, open = Math.min(tableCap(nt), ids.length + 2) - ids.length, spot = nt.same ? 'same spot' : nt.venue ? 'a new spot this time' : 'the spot comes on the day';
  charlie(nt.id, `Round ${NUMW(round)}, ${spot}. Why you’re back:\n${nt.why.join('\n')}`, 'why');
  charlie(t.id, `Booked. Round ${NUMW(round)} is ${dayLabel(when)} at ${timeLabel(when)}, ${spot}.${open > 0 ? ` I’m keeping ${NUMW(open)} ${open > 1 ? 'chairs' : 'chair'} open for someone new.` : ''} It’s on Tables.`);
  startGame(nt);
  ids.forEach((id) => notify(id, 'again', { day: weekday(when), n: round }));
  log('round', nt.id, String(round));
  return nt;
}
// a yes that comes in after round two is booked still gets a chair, while there's room, they're free that evening, and nobody
// there is someone they must stay apart from
function lateYes(t, nt) {
  const ne = db.events[nt.eventId]; if (!ne || ne.status !== 'published' || nt.closed || eventTimes(ne).start < Date.now() + 6 * HOUR) return nt;
  againIds(t).filter((id) => nt.ids.indexOf(id) < 0 && !db.members[id].paused && !cooling(db.members[id]) && !busyOn(id, ne.date)).forEach((id) => {
    if (seatedIds(nt).length < tableCap(nt) && !seatedIds(nt).some((x) => apart(x, id))) seatAt(db.members[id], nt, ne);
  });
  nt.why = roundWhy(nt);
  return nt;
}
// one yes away: Charlie says so in the group chat, once
function againNudge(t, n) {
  const need = againNeed(seatedIds(t).length), e = db.events[t.eventId];
  if (n !== need - 1 || n < 2 || t.nudged || !e) return;
  t.nudged = true;
  charlie(t.id, `${capFirst(NUMW(n))} of you want round ${NUMW((t.round || 1) + 1)}. One more yes and I’ll book ${weekday(tzMs(e.date, '12:00'))} two weeks from now, same spot. It’s the last switch on “How was the table?”.`);
}
function againView(t, me) {
  const n = seatedIds(t).length, nt = t.next && db.tables[t.next], ne = nt && db.events[nt.eventId], e = db.events[t.eventId], at = e ? tzMs(addDays(e.date, 14), e.time) : 0;
  return { when: e ? dayLabel(at) : '', open: !!e && e.status !== 'cancelled' && at >= Date.now() + ROUND_AHEAD, yes: againIds(t).length, need: againNeed(n), round: (t.round || 1) + 1,
    mine: !!(((db.feedback[t.id] || {})[me.id]) || {}).again, booked: nt && ne && ne.status !== 'cancelled' && !nt.closed ? { id: nt.id, label: dayLabel(eventTimes(ne).start), in: seatedIds(nt).indexOf(me.id) >= 0, same: !!nt.same } : null,
    busy: !!t.busyNoted && !nt, off: t.next === 'off' || !!(ne && ne.status === 'cancelled') || !!(nt && nt.closed) };
}
// round-two tables that week: their open chairs go to new people who marked that evening and still have room for a dinner
// (never someone from the table before: a yes is already seated, and a no meant no)
function fillRounds(week) {
  const w = db.weeks[week] || { unmatched: [] }, dates = weekSlots(week).map((s) => s.split('|')[0]);
  const inWeek = (x) => dates.indexOf((db.events[x.eventId] || {}).date) >= 0;
  const room = (m) => (m.avail.max || 1) - Object.values(db.tables).filter((x) => x.published && inWeek(x) && seatedIds(x).indexOf(m.id) >= 0).length;
  Object.values(db.tables).filter((t) => t.round > 1 && t.published && !t.closed && inWeek(t) && (db.events[t.eventId] || {}).status === 'published').forEach((t) => {
    const e = db.events[t.eventId], prev = db.tables[t.prev], before = prev ? prev.ids : [], back = backIds(t).length;
    const not = e.type === 'kindred' ? 'topic' : 'social', unm = w.unmatched || [];
    while (seatedIds(t).length < Math.min(tableCap(t), back + 2)) {
      const m = live().filter((x) => done(x) && !x.paused && before.indexOf(x.id) < 0 && x.avail && x.avail.week === week && x.avail.slots.indexOf(e.date + '|dinner') >= 0 && room(x) > 0
        && ((x.profile || {}).mix || 'both') !== not && chairFits(x, t, e, [e.date], null) && !seatedIds(t).some((y) => apart(x.id, y)))
        .sort((a, b) => (unm.indexOf(b.id) >= 0) - (unm.indexOf(a.id) >= 0) || (b.prio || 0) - (a.prio || 0) || ((a.avail.at || '') < (b.avail.at || '') ? -1 : 1))[0];
      if (!m) break;
      seatAt(m, t, e); w.unmatched = (w.unmatched || []).filter((id) => id !== m.id);
    }
    t.why = roundWhy(t);
  });
}

/* ---------- before next time ----------
   The morning after, one optional line: something you'll do before your next table ("ship the waitlist page"). Your next
   tables see it, Charlie brings it up on the day, and the morning after that you say whether it happened. It's how one
   dinner hands off to the next instead of starting from zero. One line is open at a time (the one from your latest table),
   and a line nobody checks off fades after three weeks. */
const LOOSE_DAYS = 21;
function setLoose(me, t, b) {
  const start = new Date(eventTimes(db.events[t.eventId]).start).toISOString(), L = me.loose = arr(me.loose).sort(byStart);
  const prev = L.filter((l) => l.from !== t.id && l.start < start && (!l.done || l.doneAt === t.id)).pop();
  if (prev && b.prevDone === 'done') { prev.done = 'done'; prev.doneAt = t.id; }
  else if (prev && b.prevDone === 'open' && prev.doneAt === t.id) { delete prev.done; delete prev.doneAt; }
  const text = clip(b.next, 90).replace(/\s+/g, ' ').trim(), here = L.find((l) => l.from === t.id);
  if (b.next === undefined) return;
  if (!text) { if (here) { L.splice(L.indexOf(here), 1); L.forEach((l) => { if (l.by === here.id) { delete l.done; delete l.by; } }); } return; }
  if (here) { here.text = text; return; }
  const line = { id: rid(4), text, from: t.id, start, at: new Date().toISOString() };
  // feedback for an earlier table can come in after a later one: then the later table's line stays the open one
  if (L.some((l) => !l.done && l.start > start)) line.done = 'replaced';
  else L.filter((l) => !l.done && l.start < start).forEach((l) => { l.done = 'replaced'; l.by = line.id; });
  L.push(line); me.loose = L.sort(byStart).slice(-12);
}
// the line someone carries into a table: the newest one set before it (in the last three weeks), while it's still open or
// was checked off at this table
function looseFor(m, t) {
  const ms = eventTimes(db.events[t.eventId]).start, start = new Date(ms).toISOString(), since = new Date(ms - LOOSE_DAYS * DAY).toISOString();
  const l = arr(m && m.loose).filter((x) => x.start < start && x.start > since && x.from !== t.id && x.done !== 'replaced').sort(byStart).pop();
  return l && (!l.done || l.doneAt === t.id) ? l : null;
}
// on the day, at noon: Charlie reminds the table what each of them said they'd do before this one
function looseNote(t) {
  if (!t.published || t.looseNoted) return;
  t.looseNoted = true;
  const L = seatedIds(t).map((id) => { const m = db.members[id], l = m && !m.deleted ? looseFor(m, t) : null; return l && !l.done ? `*${firstOf(m)}*: ${l.text.replace(/[.!]+$/, '')}` : null; }).filter(Boolean);
  if (L.length) charlie(t.id, `Since last time, ask how ${L.length > 1 ? 'these' : 'this one'} went\n${L.join('\n')}`, 'why');
}
function looseAt(t, me) {
  return seatedIds(t).map((id) => { const m = db.members[id], l = m && !m.deleted ? looseFor(m, t) : null; return l ? { id, first: id === me.id ? 'You' : firstOf(m), text: l.text, done: l.done === 'done', me: id === me.id } : null; }).filter(Boolean);
}

/* ---------- the month: every table is a bead on one thread, and the month ends with a long table ----------
   The last Thursday of every month, everyone who sat at a table that month is invited to one long table together, so the
   people from different tables meet each other too. A month runs from the day after last month's long table through this
   month's, so the dinners in the last days of a month count toward the next one. */
const LONG_TIME = process.env.SIXTOP_LONG_TIME || '19:00';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function longDate(mo) { const o = (((db.longSpot || {})[mo]) || {}).date; if (o && /^\d{4}-\d{2}-\d{2}$/.test(o) && o.slice(0, 7) === mo) return o; const [y, m] = mo.split('-').map(Number), last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); return addDays(last, -((dowOf(last) + 3) % 7)); }
function nextMonth(mo) { const [y, m] = mo.split('-').map(Number); return m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0'); }
function prevMonth(mo) { const [y, m] = mo.split('-').map(Number); return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0'); }
function monthSpan(mo) { return { from: addDays(longDate(prevMonth(mo)), 1), to: longDate(mo) }; }
// this month, until its long table is over; then next month
function monthNow() { const mo = ymdTz(Date.now()).slice(0, 7); return Date.now() > tzMs(longDate(mo), LONG_TIME) + 4 * HOUR ? nextMonth(mo) : mo; }
function tablesIn(me, mo) {
  const sp = monthSpan(mo);
  return Object.values(db.tables).filter((t) => t.published && t.ids.indexOf(me.id) >= 0 && !(t.out && t.out[me.id])).map((t) => ({ t, e: db.events[t.eventId] }))
    .filter((x) => x.e && x.e.status !== 'cancelled' && x.e.date >= sp.from && x.e.date <= sp.to);
}
function setLong(me, b) {
  const mo = monthNow(), L = db.long[mo] = db.long[mo] || {}, LW = db.longWait = db.longWait || {}, W = LW[mo] = arr(LW[mo]), now = Date.now(), start = tzMs(longDate(mo), LONG_TIME);
  if (b.going === false) {
    const was = !!L[me.id]; delete L[me.id]; const i = W.indexOf(me.id); if (i >= 0) W.splice(i, 1);
    if (was && now < start - 6 * HOUR) promoteLong(mo);
    return { ok: true, going: false };
  }
  if (!done(me) || !tablesIn(me, mo).length) fail('sit at one table this month first');
  if (L[me.id] || W.indexOf(me.id) >= 0) return { ok: true, going: !!L[me.id], wait: W.indexOf(me.id) + 1 };
  if (now > longCloses(mo)) fail('RSVPs for this one closed, and the final count went to the venue');
  if (Object.keys(L).filter((id) => db.members[id] && !db.members[id].deleted).length >= longCap(mo)) { W.push(me.id); return { ok: true, going: false, wait: W.length }; }
  L[me.id] = isoNow();
  return { ok: true, going: true };
}
// a seat opened at the long table (someone can't come, or the room got bigger): the first person waiting gets it
function promoteLong(mo) {
  const L = db.long[mo] = db.long[mo] || {}, W = arr((db.longWait || {})[mo]), count = () => Object.keys(L).filter((id) => db.members[id] && !db.members[id].deleted).length;
  while (W.length && count() < longCap(mo)) { const id = W.shift(), m = db.members[id]; if (m && !m.deleted) { L[id] = isoNow(); notify(id, 'longin', { day: dayLabel(tzMs(longDate(mo), LONG_TIME)) }); } }
  if (db.longWait) db.longWait[mo] = W;
}
function monthView(me, tog) {
  const mo = monthNow(), m = +mo.slice(5), now = Date.now(), today = ymdTz(now), sp = monthSpan(mo), ld = sp.to, lstart = tzMs(ld, LONG_TIME), at = (d) => dayDiff(sp.from, d);
  const short = (d) => fmt(tzMs(d, '12:00'), { month: 'short', day: 'numeric' });
  const mine = tablesIn(me, mo), beads = [], met = new Set();
  mine.forEach(({ t, e }) => {
    const past = eventTimes(e).start < now;
    beads.push({ id: t.id, at: at(e.date), label: short(e.date), kind: e.type === 'kindred' ? 'social' : 'tech', past, round: t.round || 1 });
    if (past) seatedIds(t).forEach((o) => { if (o !== me.id && attendedPair(t, me.id, o)) met.add(o); });
  });
  Object.values(db.pops).forEach((u) => {
    const ids = [u.host].concat(u.joined); if (u.cancelled || ids.indexOf(me.id) < 0 || u.date < sp.from || u.date > sp.to) return;
    const past = popTimes(u).start < now; beads.push({ id: u.id, at: at(u.date), label: short(u.date), kind: 'hang', past, round: 1 });
    if (past) ids.forEach((o) => { if (o !== me.id) met.add(o); });
  });
  beads.sort((a, b) => a.at - b.at);
  const L = db.long[mo] || {}, going = Object.keys(L).filter((id) => db.members[id] && !db.members[id].deleted);
  tog = tog || together(me);
  const known = going.filter((id) => id !== me.id && !blockedEither(me.id, id) && ((tog[id] || []).length || canDm(me.id, id)));
  const picked = Array.from(met).filter((o) => mine.some(({ t }) => mutualPairs(t).some((p) => p.indexOf(me.id) >= 0 && p.indexOf(o) >= 0))).length;
  const since = new Date(now - LOOSE_DAYS * DAY).toISOString(), l = arr(me.loose).filter((x) => !x.done && x.start > since).sort(byStart).pop();
  return { key: mo, name: MONTHS[m - 1], span: at(sp.to) + 1, today: today >= sp.from && today <= sp.to ? at(today) : -1, fromLabel: short(sp.from), toLabel: short(sp.to), beads,
    tables: mine.length, people: met.size, picked, loose: l ? l.text : '',
    long: { at: at(ld), label: dayLabel(lstart), date: short(ld), time: timeLabel(lstart), area: AREA, invited: done(me) && mine.length > 0, going: !!L[me.id], count: going.length,
      known: known.length, faces: known.slice(0, 4).map((id) => mini(db.members[id], me)), tonight: today === ld, spot: done(me) && mine.length && ((db.longSpot || {})[mo] || {}).name ? db.longSpot[mo] : null,
      cap: longCap(mo), full: going.length >= longCap(mo), closed: now > longCloses(mo), closes: dayLabel(longCloses(mo)), wait: arr((db.longWait || {})[mo]).indexOf(me.id) + 1 } };
}
function dmKey(a, b) { return pk(a, b); }
const blockedEither = (a, b) => !!(((db.members[a] || {}).never || {})[b] || ((db.members[b] || {}).never || {})[a]);
const waved = (a, b) => !!((db.waves || {})[a] || {})[b];
const mutualWave = (a, b) => waved(a, b) && waved(b, a);
// who may message whom: two people who picked each other after a dinner, waved at each other, or were introduced
function canDm(a, b) { if (a === b || blockedEither(a, b)) return false; return isMutual(a, b) || mutualWave(a, b) || !!(db.links || {})[pk(a, b)]; }
function dmSystem(a, b, text) { const k = dmKey(a, b); (db.dms[k] = db.dms[k] || []).push({ id: rid(6), from: 'charlie', text, at: new Date().toISOString() }); }
function postDm(me, b) {
  const o = db.members[b.with]; if (!o || o.deleted || !canDm(me.id, o.id)) fail('no such chat');
  const text = clip(b.text, 800).trim(); if (!text) fail('message required');
  const k = dmKey(me.id, o.id); (db.dms[k] = db.dms[k] || []).push({ id: rid(6), from: me.id, text, at: new Date().toISOString() });
  me.read['d:' + o.id] = new Date().toISOString();
  notify(o.id, 'dm', { other: firstOf(me) });
  return { ok: true };
}
function ageLabel(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm'; if (s < 86400) return Math.round(s / 3600) + 'h'; if (s < 7 * 86400) return Math.round(s / 86400) + 'd'; return Math.round(s / (7 * 86400)) + 'w';
}

/* ---------- what a member sees ---------- */
const photoKey = (m) => m.pt || (m.pt = rid(16));
function photoUrl(owner, viewer) { const o = db.members[owner]; return o && o.photo ? '/api/photo?id=' + owner + '&t=' + photoKey(viewer) + '&v=' + encodeURIComponent(o.updatedAt || '') : null; }
function mini(m, me) { return { id: m.id, first: firstOf(m), last: lastInitial(m), school: m.school, photo: photoUrl(m.id, me), headline: (m.profile || {}).headline || '' }; }
function card(m, me) {
  const p = m.profile || {}, pe = personaOf(m);
  return Object.assign(mini(m, me), { program: m.program || '', year: m.year, before: p.before || '', lens: p.lens, code: pe.code, persona: pe.name, askWork: p.askWork || '', askLife: p.askLife || '',
    ints: p.interests || [], acts: p.acts || [], tracks: p.tracks || [], building: p.building || '', openTo: p.openTo || [], links: p.links || [], next: [].concat(p.next || []), plan: p.plan || '', dream: p.dream || '', me: m.id === me.id });
}
// the shared thing at a social table ("three of you want to climb"), and how the table splits across the river
function themeOf(t) {
  const c = {}; seatedIds(t).forEach((id) => (((db.members[id] || {}).profile || {}).acts || []).forEach((a) => { c[a] = (c[a] || 0) + 1; }));
  const a = Object.keys(c).sort((x, y) => c[y] - c[x])[0];
  return a && c[a] >= 2 ? { act: a, n: c[a] } : null;
}
function sidesOf(t) { const ids = seatedIds(t), h = ids.filter((id) => (db.members[id] || {}).school === 'harvard').length; return { harvard: h, mit: ids.length - h }; }
function tableSummary(t, me, tog) {
  advanceGame(t); tog = tog || together(me);
  const e = db.events[t.eventId], tm = eventTimes(e), ph = eventPhase(e), fb = (db.feedback[t.id] || {})[me.id], g = t.game;
  return { id: t.id, no: t.no, eventId: e.id, type: e.type, track: t.track, trackName: t.track ? SX.track(t.track).t : null, label: dayLabel(tm.start), short: shortLabel(tm.start),
    day: weekday(tm.start), date: e.date, time: timeLabel(tm.start), area: e.area, phase: ph, left: !!(t.out && t.out[me.id]), feedbackOpen: Date.now() >= tm.feedback && !(t.out && t.out[me.id]), feedbackDone: !!fb,
    unread: unread(me, 't:' + t.id, db.chats[t.id]), start: new Date(tm.start).toISOString(), size: seatedIds(t).length, meal: e.meal || '', mealName: e.meal ? MEALS[e.meal].t : 'Dinner', generated: !!e.generated,
    opened: !!me.read['inv:' + t.id], theme: e.type === 'kindred' ? themeOf(t) : null, faces: seatedIds(t).filter((x) => x !== me.id).slice(0, 5).map((x) => mini(db.members[x], me)), why: (t.why || []).slice(0, 2), sides: sidesOf(t),
    game: g ? gameSum(t, me) : null, round: t.round || 1, same: !!t.same, closed: t.closed && t.closed !== 'merged' && arr(t.closedFor).indexOf(me.id) >= 0 ? t.closed : null, offSeen: !!me.read['off:' + t.id], freeUntil: new Date(freeFor(e, me)).toISOString(), freeLabel: freeFor(e, me) === freeUntil(e) ? weekday(freeUntil(e)) + ' at noon' : (ymdTz(freeFor(e, me)) === ymdTz(Date.now()) ? 'today' : weekday(freeFor(e, me))) + ' at ' + timeLabel(freeFor(e, me)),
    captain: t.captain && seatedIds(t).indexOf(t.captain) >= 0 && db.members[t.captain] ? { id: t.captain, first: firstOf(db.members[t.captain]), me: t.captain === me.id } : null, known: knownAt(t, me, tog, tm.start),
    spotIn: Date.now() >= tm.reveal && spotSet(t) && !(t.out && t.out[me.id]),
    capDone: t.captain === me.id && !(t.out && t.out[me.id]) && !t.closed ? (() => { const M = missions(t); return [M.spot.done, M.vote.done, M.checks.done].filter(Boolean).length; })() : null };
}
// people at this table you've already shared a table or a hang with, and how many times
function knownAt(t, me, tog, start) {
  return seatedIds(t).filter((x) => x !== me.id && db.members[x] && !db.members[x].deleted).map((x) => ({ x, n: (tog[x] || []).filter((s) => s < start).length })).filter((k) => k.n > 0).map((k) => Object.assign(mini(db.members[k.x], me), { n: k.n }));
}
// the deck's second round, once the table has its question (with the split once it's out)
function gameDeck(t) {
  const g = t.game, c = g && g.pick && cardOf(g, g.pick); if (!c) return null;
  const ids = seatedIds(t), na = ids.filter((x) => g.sides[x] === 'a').length, nb = ids.filter((x) => g.sides[x] === 'b').length;
  return { q: c.q, a: c.a, b: c.b, na: g.revealed && na + nb ? na : null, nb: g.revealed && na + nb ? nb : null };
}
function tableView(me, id) {
  const t = db.tables[id]; if (!canSeeTable(me, t)) fail('no such table');
  const e = db.events[t.eventId], tm = eventTimes(e), people = seatedIds(t).map((x) => db.members[x]).filter((m) => m && !m.deleted);
  const fb = (db.feedback[t.id] || {})[me.id] || null;
  const mutual = mutualPairs(t).filter((p) => p.indexOf(me.id) >= 0).map((p) => (p[0] === me.id ? p[1] : p[0]));
  const mineL = arr(me.loose).find((l) => l.from === t.id), prevL = looseFor(me, t);
  return Object.assign(tableSummary(t, me), {
    why: t.why || [], split: t.split || null, deck: SX.deck(e.type, t.track, t.split, gameDeck(t)), people: people.map((m) => card(m, me)), game: gameView(t, me),
    cap: t.out && t.out[me.id] ? null : capView(t, me),
    venue: Date.now() >= tm.reveal && !(t.out && t.out[me.id]) && spotSet(t) ? t.venue : null, spotPending: Date.now() >= tm.reveal && !(t.out && t.out[me.id]) && !spotSet(t), revealLabel: weekday(tm.start) + ' at noon', myFeedback: fb, mutual,
    again: againView(t, me), loose: t.out && t.out[me.id] ? [] : looseAt(t, me), myLoose: { here: mineL ? mineL.text : '', prev: prevL ? { text: prevL.text, done: prevL.done === 'done' } : null },
    chat: chatOut(t.out && t.out[me.id] ? (db.chats[t.id] || []).filter((x) => x.at <= leftAt(t, me)) : db.chats[t.id])
  });
}
function leftAt(t, me) {
  const s = ((db.seats[t.eventId] || {})[me.id]) || {};
  return (s.status === 'cancelled' && s.cancelledAt) || (t.closed && t.closedAt) || '';
}
// when I shared a table or a hang with each person (start times, past ones only)
function together(me) {
  const out = {}, now = Date.now(), add = (o, s) => { (out[o] = out[o] || []).push(s); };
  Object.values(db.tables).forEach((t) => {
    if (!t.published || t.ids.indexOf(me.id) < 0 || (t.out && t.out[me.id])) return; const e = db.events[t.eventId]; if (!e || e.status === 'cancelled') return;
    const s = eventTimes(e).start; if (s > now) return; seatedIds(t).forEach((o) => { if (o !== me.id && attendedPair(t, me.id, o)) add(o, s); });
  });
  Object.values(db.pops || {}).forEach((u) => { const ids = [u.host].concat(u.joined); if (u.cancelled || ids.indexOf(me.id) < 0 || ids.length < 2) return; const s = popTimes(u).start; if (s > now) return; ids.forEach((o) => { if (o !== me.id) add(o, s); }); });
  return out;
}
// how many dinners I actually shared with each person
function metCounts(me) {
  const out = {};
  Object.values(db.tables).forEach((t) => {
    if (!t.published || t.ids.indexOf(me.id) < 0 || (t.out && t.out[me.id]) || !db.events[t.eventId] || db.events[t.eventId].status === 'cancelled') return;
    const start = eventTimes(db.events[t.eventId]).start; if (Date.now() < start) return;
    seatedIds(t).forEach((o) => { if (o === me.id || !attendedPair(t, me.id, o)) return; const c = out[o] = out[o] || { times: 0, lastAt: '' }; c.times++; const at = new Date(start).toISOString(); if (at > c.lastAt) c.lastAt = at; });
  });
  Object.values(db.pops || {}).forEach((u) => {
    const ids = [u.host].concat(u.joined); if (u.cancelled || ids.indexOf(me.id) < 0 || ids.length < 2) return;
    const start = popTimes(u).start; if (Date.now() < start) return;
    ids.forEach((o) => { if (o === me.id) return; const c = out[o] = out[o] || { times: 0, lastAt: '' }; c.times++; const at = new Date(start).toISOString(); if (at > c.lastAt) c.lastAt = at; });
  });
  return out;
}
function connections(me) {
  const met = metCounts(me);
  return Object.keys(met).map((o) => db.members[o]).filter((m) => m && !m.deleted).map((m) => {
    const ok = canDm(me.id, m.id);
    return Object.assign(mini(m, me), { times: met[m.id].times, lastAt: met[m.id].lastAt, mutual: isMutual(me.id, m.id), canDm: ok, unread: ok ? unread(me, 'd:' + m.id, db.dms[dmKey(me.id, m.id)]) : 0, never: !!(me.never || {})[m.id] });
  }).sort((a, b) => (b.lastAt > a.lastAt ? 1 : -1));
}
function threads(me) {
  const ids = new Set();
  Object.keys(db.dms).forEach((k) => { const ab = k.split('|'); if (ab[0] === me.id) ids.add(ab[1]); else if (ab[1] === me.id) ids.add(ab[0]); });
  Object.keys(db.waves[me.id] || {}).forEach((o) => { if (mutualWave(me.id, o)) ids.add(o); });
  return Array.from(ids).filter((o) => db.members[o] && !db.members[o].deleted && canDm(me.id, o)).map((o) => {
    const L = db.dms[dmKey(me.id, o)] || [], last = L[L.length - 1];
    return Object.assign(mini(db.members[o], me), { preview: last ? (last.from === me.id ? 'You: ' : '') + last.text : 'Say hi', at: last ? last.at : '', age: last ? ageLabel(last.at) : '', unread: unread(me, 'd:' + o, L) });
  }).sort((a, b) => (b.at > a.at ? 1 : -1));
}

/* ---------- People: everyone in the community, waves ---------- */
function person(me, m, met) {
  const p = m.profile || {}, mine = (me.profile || {}).interests || [];
  return Object.assign(card(m, me), { times: (met[m.id] || {}).times || 0, waved: waved(me.id, m.id), mutualWave: mutualWave(me.id, m.id), canDm: canDm(me.id, m.id),
    shared: (p.interests || []).filter((i) => mine.indexOf(i) >= 0) });
}
// people you've been in a hang with (hosting or joined, before or after it happens)
function hangMates(me) {
  const out = new Set();
  Object.values(db.pops).forEach((u) => { if (u.cancelled) return; const ids = [u.host].concat(u.joined); if (ids.indexOf(me.id) >= 0) ids.forEach((id) => { if (id !== me.id) out.add(id); }); });
  return out;
}
// the people at your tables that haven't happened yet (you can see them on the table screen already)
function tableMates(me) {
  const out = new Set();
  Object.values(db.tables).forEach((t) => { if (!t.published || !seatedIds(t).includes(me.id)) return; const e = db.events[t.eventId]; if (!e || e.status === 'cancelled' || eventTimes(e).start < Date.now()) return; seatedIds(t).forEach((id) => { if (id !== me.id) out.add(id); }); });
  return out;
}
// your people, never a directory of every member: shared a table or a hang, or a chat is open (mutual pick, mutual wave, intro)
function people(me, q, track) {
  const met = metCounts(me), mates = hangMates(me), soon = tableMates(me), Q = String(q || '').toLowerCase().trim();
  return live().filter((m) => done(m) && m.id !== me.id && !blockedEither(me.id, m.id) && ((met[m.id] || {}).times || mates.has(m.id) || soon.has(m.id) || canDm(me.id, m.id))).map((m) => Object.assign(person(me, m, met), { hang: mates.has(m.id), soon: soon.has(m.id) }))
    .filter((c) => (!track || c.tracks.indexOf(track) >= 0) && (!Q || [c.first, c.last, c.headline, c.building, c.before].concat(c.ints.map((i) => SX.INTNAME[i])).join(' ').toLowerCase().indexOf(Q) >= 0))
    .sort((a, b) => (b.times - a.times) || (b.mutualWave - a.mutualWave) || (b.shared.length - a.shared.length) || (a.first < b.first ? -1 : 1));
}
// someone you could actually come across: you've met, a chat is open, you share a table or a hang, or they're in a hang you can see
function canView(me, m) {
  if (!m || m.id === me.id) return !!m;
  if ((metCounts(me)[m.id] || {}).times || canDm(me.id, m.id) || hangMates(me).has(m.id) || tableMates(me).has(m.id)) return true;
  return Object.values(db.pops).some((u) => popVisible(u, me) && popTimes(u).end > Date.now() && (u.host === m.id || u.joined.indexOf(m.id) >= 0));
}
function personView(me, id) {
  const m = own(db.members, id); if (!m || m.deleted || !done(m) || blockedEither(me.id, m.id) || !canView(me, m)) fail('no such member');
  return Object.assign(person(me, m, metCounts(me)), { posts: db.posts.filter((p) => p.by === m.id && postVisible(p, me)).sort(newest).slice(0, 5).map((p) => postOut(p, me)) });
}
function wave(me, b) {
  const o = own(db.members, b.id); if (!o || o.deleted || o.id === me.id || blockedEither(me.id, o.id) || (b.on !== false && !canView(me, o))) fail('no such member');
  db.waves[me.id] = db.waves[me.id] || {};
  if (b.on === false) { delete db.waves[me.id][o.id]; return { ok: true, waved: false, mutual: false }; }
  if (limited('wave:' + me.id, 30)) fail('slow down');
  const was = mutualWave(me.id, o.id); db.waves[me.id][o.id] = new Date().toISOString();
  const now = mutualWave(me.id, o.id);
  if (now && !was) {
    notify(o.id, 'wave', { other: firstOf(me) }); notify(me.id, 'wave', { other: firstOf(o) });
    dmSystem(me.id, o.id, 'You two waved at each other. Say hi. If you both mark the same evening, I’ll try to seat you at the same table.');
  }
  return { ok: true, waved: true, mutual: now };
}

/* ---------- the Board: roles and intros ---------- */
function postJob(me, b) {
  const title = clip(b.title, 80).trim(), company = clip(b.company, 60).trim(); if (title.length < 3 || company.length < 2) fail('title and company required');
  if (me && limited('job:' + me.id, 5)) fail('slow down');
  const j = { id: 'j' + rid(5), title, company, track: inList(b.track, SX.TRACKS.map((t) => t.id)) || '', kind: inList(b.kind, SX.JOB.kinds) || 'Full-time', role: inList(b.role, SX.JOB.roles) || 'Product',
    stage: inList(b.stage, SX.JOB.stages) || '', location: clip(b.location, 40).trim() || 'Boston', comp: clip(b.comp, 40).trim(), link: cleanUrl(b.link), about: clip(b.about, 700).trim(), note: clip(b.note, 280).trim(),
    refer: me ? !!b.refer : false, by: me ? me.id : 'admin', sample: !!b.sample, at: b.at && !me ? b.at : new Date().toISOString(), closed: false };
  db.jobs[j.id] = j; if (me) log('job', me.id, j.title);
  return { ok: true, id: j.id };
}
function jobOut(j, me, met) {
  const by = j.by !== 'admin' ? db.members[j.by] : null, mineIntro = db.intros.find((x) => x.job === j.id && x.from === me.id), mp = me.profile || {};
  const fit = (j.track && (mp.tracks || []).indexOf(j.track) >= 0 ? 2 : 0) + (by && met[by.id] ? 2 : 0) + (j.kind === 'Internship' && (mp.openTo || []).indexOf('Internships') >= 0 ? 1 : 0)
    + (j.kind === 'Founding team' && (mp.openTo || []).indexOf('A cofounder') >= 0 ? 1 : 0) + (j.kind === 'Full-time' && (mp.openTo || []).indexOf('Full-time roles') >= 0 ? 1 : 0);
  return { id: j.id, title: j.title, company: j.company, track: j.track, trackName: j.track ? SX.track(j.track).t : '', kind: j.kind, role: j.role, stage: j.stage, location: j.location, comp: j.comp, link: j.link,
    about: j.about, note: j.note, refer: !!(j.refer && by && !by.deleted), by: by && !by.deleted ? Object.assign(mini(by, me), { times: (met[by.id] || {}).times || 0 }) : null, mine: j.by === me.id, sample: !!j.sample,
    saved: !!((db.saves[me.id] || {})[j.id]), saves: Object.keys(db.saves).filter((k) => (db.saves[k] || {})[j.id]).length,
    intro: mineIntro ? (mineIntro.status === 'accepted' ? 'accepted' : 'sent') : null, age: ageLabel(j.at), at: j.at, fit: j.by === me.id ? -1 : fit };
}
function jobsFor(me) {
  const met = metCounts(me);
  return Object.values(db.jobs).filter((j) => !j.closed && !(j.by !== 'admin' && blockedEither(me.id, j.by))).map((j) => jobOut(j, me, met)).sort((a, b) => (b.fit - a.fit) || (b.at > a.at ? 1 : -1));
}
function board(me) {
  const introsIn = db.intros.filter((x) => x.to === me.id && db.members[x.from] && !db.members[x.from].deleted).map((x) => ({ id: x.id, status: x.status, note: x.note, at: x.at, age: ageLabel(x.at),
    from: mini(db.members[x.from], me), job: db.jobs[x.job] ? { id: x.job, title: db.jobs[x.job].title, company: db.jobs[x.job].company } : null }))
    .sort((a, b) => ((a.status === 'sent' ? 0 : 1) - (b.status === 'sent' ? 0 : 1)) || (b.at > a.at ? 1 : -1));
  me.read.board = new Date().toISOString();
  return { jobs: jobsFor(me), introsIn };
}
function saveJob(me, b) { const j = db.jobs[b.job]; if (!j) fail('no such role'); db.saves[me.id] = db.saves[me.id] || {}; if (b.on === false) delete db.saves[me.id][j.id]; else db.saves[me.id][j.id] = 1; return { ok: true }; }
function askIntro(me, b) {
  const j = db.jobs[b.job]; if (!j || j.closed) fail('no such role');
  const to = db.members[j.by]; if (!to || to.deleted || !j.refer || to.id === me.id || blockedEither(me.id, to.id)) fail('nobody to ask about this role');
  if (db.intros.some((x) => x.job === j.id && x.from === me.id)) fail('you already asked');
  if (limited('intro:' + me.id, 5)) fail('slow down');
  db.intros.push({ id: 'i' + rid(5), job: j.id, from: me.id, to: to.id, note: clip(b.note, 280).trim(), status: 'sent', at: new Date().toISOString() });
  notify(to.id, 'intro', { other: firstOf(me), title: j.title });
  return { ok: true };
}
// a yes opens a 1:1 chat; a no is never shown to the person who asked
function answerIntro(me, b) {
  const x = db.intros.find((i) => i.id === b.intro && i.to === me.id); if (!x) fail('no such request');
  x.status = b.accept ? 'accepted' : 'declined'; x.answeredAt = new Date().toISOString();
  if (b.accept) {
    const j = db.jobs[x.job] || {};
    db.links[pk(x.from, x.to)] = 'intro';
    dmSystem(x.from, x.to, `Intro about ${j.title || 'a role'} at ${j.company || 'a company'}.${x.note ? ' The note: “' + x.note + '”' : ''} ${firstOf(me)} said yes, so this chat is open.`);
    notify(x.from, 'introOk', { other: firstOf(me), title: j.title });
  }
  return { ok: true };
}

/* ---------- Pulse: takes, asks, launches, reading ---------- */
const postVisible = (p, me) => !p.removed && db.members[p.by] && !db.members[p.by].deleted && !blockedEither(me.id, p.by);
const postBy = (id) => db.posts.find((p) => p.id === id && !p.removed);
function postOut(p, me, full) {
  const v = p.votes || {}, keys = Object.keys(v);
  return { id: p.id, kind: p.kind, text: p.text, link: p.link, track: p.track, trackName: p.track ? SX.track(p.track).t : '', at: p.at, age: ageLabel(p.at), by: mini(db.members[p.by], me), mine: p.by === me.id,
    agree: keys.filter((k) => v[k] === 'agree').length, disagree: keys.filter((k) => v[k] === 'disagree').length, myVote: v[me.id] || null,
    plus: Object.keys(p.plus || {}).length, myPlus: !!(p.plus || {})[me.id], replyN: (p.replies || []).length,
    replies: (full ? p.replies || [] : (p.replies || []).slice(-2)).filter((r) => db.members[r.by] && !db.members[r.by].deleted && !blockedEither(me.id, r.by))
      .map((r) => ({ id: r.id, text: r.text, at: r.at, age: ageLabel(r.at), by: mini(db.members[r.by], me), mine: r.by === me.id })) };
}
const newest = (a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : 0);
function pulse(me) { const posts = db.posts.filter((p) => postVisible(p, me)).sort(newest).slice(0, 150).map((p) => postOut(p, me)); me.read.pulse = new Date().toISOString(); return { posts }; }
function createPost(me, b) {
  if (!SX.POSTS[b.kind]) fail('pick a kind of post');
  const text = clip(b.text, 400).trim(); if (text.length < 3) fail('write a little more');
  if (limited('post:' + me.id, 10)) fail('slow down');
  const p = { id: 'p' + rid(5), by: me.id, kind: b.kind, text, link: cleanUrl(b.link), track: inList(b.track, SX.TRACKS.map((t) => t.id)) || '', at: new Date().toISOString(), votes: {}, plus: {}, replies: [] };
  db.posts.push(p); if (db.posts.length > 3000) db.posts = db.posts.slice(-3000);
  return { ok: true, id: p.id };
}
function vote(me, b) { const p = postBy(b.post); if (!p || p.kind !== 'take' || !postVisible(p, me)) fail('no such take'); p.votes = p.votes || {}; if (b.side === 'agree' || b.side === 'disagree') p.votes[me.id] = b.side; else delete p.votes[me.id]; return { ok: true, post: postOut(p, me) }; }
function plus(me, b) { const p = postBy(b.post); if (!p || !postVisible(p, me)) fail('no such post'); p.plus = p.plus || {}; if (p.plus[me.id]) delete p.plus[me.id]; else p.plus[me.id] = 1; return { ok: true, post: postOut(p, me) }; }
function reply(me, b) {
  const p = postBy(b.post); if (!p || !postVisible(p, me)) fail('no such post');
  const text = clip(b.text, 400).trim(); if (!text) fail('message required'); if (limited('reply:' + me.id, 20)) fail('slow down');
  (p.replies = p.replies || []).push({ id: rid(5), by: me.id, text, at: new Date().toISOString() });
  if (p.by !== me.id) notify(p.by, 'reply', { other: firstOf(me) });
  return { ok: true, post: postOut(p, me, true) };
}
function deletePost(me, b) { const p = postBy(b.post); if (!p || p.by !== me.id) fail('no such post'); p.removed = true; return { ok: true }; }
function featuredTake(me) {
  const week = Date.now() - 7 * DAY, takes = db.posts.filter((p) => p.kind === 'take' && postVisible(p, me) && Date.parse(p.at) > week);
  if (!takes.length) return null;
  return postOut(takes.slice().sort((a, b) => Object.keys(b.votes || {}).length - Object.keys(a.votes || {}).length)[0], me);
}

function view(me) {
  const now = Date.now(), myStripes = done(me) ? captainStats(me, now).stripes : 0;
  const events = Object.values(db.events).filter((e) => !e.generated && e.status !== 'cancelled' && eventTimes(e).start > now - 6 * HOUR).sort((a, b) => eventTimes(a).start - eventTimes(b).start).map((e) => {
    const tm = eventTimes(e), s = (db.seats[e.id] || {})[me.id], t = tableOf(e.id, me.id);
    return { id: e.id, type: e.type, label: dayLabel(tm.start), short: shortLabel(tm.start), day: weekday(tm.start), time: timeLabel(tm.start), area: e.area,
      phase: eventPhase(e), bookable: e.status === 'open' && now <= tm.closes, closes: dayLabel(tm.closes) + ', ' + timeLabel(tm.closes), setDay: weekday(tm.closes + 12 * HOUR),
      seat: s && s.status === 'held' ? { size: s.size, diet: s.diet } : null, table: t && t.published && !(t.out && t.out[me.id]) ? t.id : null,
      waitlisted: e.status === 'published' && (e.wait || []).indexOf(me.id) >= 0, start: new Date(tm.start).toISOString(),
      seats: Object.keys(db.seats[e.id] || {}).filter((id) => db.seats[e.id][id].status === 'held').length,
      industry: e.industry ? { guest: e.industry.guest, role: e.industry.role, about: e.industry.about, early: now < Date.parse(e.industry.captainsUntil), opens: weekday(Date.parse(e.industry.captainsUntil)) + ' at ' + timeLabel(Date.parse(e.industry.captainsUntil)), you: myStripes >= 1 } : null };
  });
  const p = me.profile || {}, pe = personaOf(me), ok = done(me), th = ok ? threads(me) : [], tog = ok ? together(me) : {};
  const tables = Object.values(db.tables).filter((t) => canSeeTable(me, t) && (db.events[t.eventId] || {}).status !== 'cancelled').map((t) => tableSummary(t, me, tog)).sort((a, b) => (a.start < b.start ? 1 : -1));
  return { standby: standbyView(me), days: [1, 2, 3, 4, 5, 6, 7].map((i) => { const d = addDays(ymdTz(Date.now()), i); return { date: d, dow: fmt(tzMs(d, '12:00'), { weekday: 'short' }), day: +d.slice(8) }; }),
    me: { id: me.id, first: firstOf(me), name: me.name, email: me.email, verified: !!me.verified, school: me.school, program: me.program || '', year: me.year, profile: p, done: ok, persona: pe, photo: photoUrl(me.id, me),
      paused: !!me.paused, cool: cooling(me) ? dayLabel(Date.parse(me.coolUntil)) : '', late: ok ? lateChanges(me) : 0, captain: me.captain || 'maybe', captainLog: ok ? captainStats(me) : null, push: !!(me.push && me.push.length), never: Object.keys(me.never || {}), tableSize: me.tableSize || 'either' },
    events, tables, connections: ok ? connections(me) : [], threads: th, campus: campusStats(), pushKey: PUSH.publicKey, area: AREA,
    counts: ok ? { board: Object.values(db.jobs).filter((j) => !j.closed && j.at > (me.read.board || '')).length, pulse: db.posts.filter((x) => postVisible(x, me) && x.by !== me.id && x.at > (me.read.pulse || '')).length,
      introsIn: db.intros.filter((x) => x.to === me.id && x.status === 'sent').length, dms: th.reduce((n, t) => n + t.unread, 0) } : {},
    featured: ok ? { take: featuredTake(me), jobs: jobsFor(me).filter((j) => !j.mine).slice(0, 3) } : {},
    avail: ok ? availView(me) : null, pops: ok ? pops(me) : [], month: ok ? monthView(me, tog) : null
  };
}
function campusStats() {
  const pairs = {};
  Object.values(db.tables).forEach((t) => {
    const e = db.events[t.eventId]; if (!t.published || !e || e.status === 'cancelled' || Date.now() < eventTimes(e).start) return;
    const ids = seatedIds(t);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (attendedPair(t, ids[i], ids[j])) { const k = pk(ids[i], ids[j]); pairs[k] = (pairs[k] || 0) + 1; }
  });
  const v = Object.values(pairs);
  return { first: v.length, second: v.filter((x) => x >= 2).length, third: v.filter((x) => x >= 3).length, members: live().filter(done).length, roles: Object.values(db.jobs).filter((j) => !j.closed).length };
}

/* ---------- notifications ---------- */
const PUSH_TEXT = {
  event: (o) => ({ body: `Seats are open for ${o.type === 'kindred' ? 'a social table' : 'tech tables'} on ${o.label}.`, url: './#home' }),
  table: (o) => ({ body: `Charlie sent you a private invitation for ${o.day}. ${o.n} people, one good question.`, url: './#home' }),
  wait: () => ({ body: 'No seat for you this time, sorry. You’re first in line next time.', url: './#home' }),
  reveal: () => ({ body: 'Tonight’s spot is in. Tap for the address.', url: './#table' }),
  feedback: () => ({ body: 'How was the table? Your picks stay private unless they’re mutual.', url: './#table' }),
  mutual: (o) => ({ body: `It’s mutual with ${o.other || 'someone from your table'}. Say hi.`, url: './#messages' }),
  dm: (o) => ({ body: `New message from ${o.other || 'a friend'}.`, url: './#messages' }),
  intro: (o) => ({ body: `${o.other || 'Someone'} asked you for an intro about ${o.title || 'a role'}.`, url: './#roles' }),
  introOk: (o) => ({ body: `${o.other || 'They'} said yes to your intro request. Your chat is open.`, url: './#messages' }),
  wave: (o) => ({ body: `You and ${o.other || 'someone'} waved at each other. Say hi.`, url: './#messages' }),
  reply: (o) => ({ body: `${o.other || 'Someone'} replied to your post.`, url: './#board' }),
  roundoff: (o) => ({ body: `Round ${o.n === 2 ? 'two' : o.n === 3 ? 'three' : o.n} on ${o.day} is off, since only two of you could still make it. Your other tables stay the same.`, url: './#home' }),
  lastcall: (o) => ({ body: `Dinner ${o.day} at ${o.time}. Can’t make it? Tell me by ${o.by || 'noon today'} and it’s free.`, url: './#home' }),
  spot: (o) => ({ body: `Change of plans for ${o.day}: your table has a new spot. Tap for the address.`, url: './#table' }),
  merged: (o) => ({ body: `Plans changed for ${o.day}: you’re joining table ${o.no} instead, same evening.`, url: './#home' }),
  tableoff: (o) => ({ body: `Your ${o.day} table is off: ${o.why === 'admin' ? 'we had to cancel that evening' : o.why === 'place' ? 'the restaurant couldn’t host and no other spot was free' : 'too many people had to cancel'}. You’re first in line next week, and you can find another evening now.`, url: './#home' }),
  cool: (o) => ({ body: `A few late changes lately, so I’m pausing your invitations until ${o.until}. Hangs are open as always.`, url: './#home' }),
  captainbrief: (o) => ({ body: `You’re captain for ${o.day}. Three missions: pick the spot, rally the vote, settle up. All three earn a stripe`, url: './#table' }),
  nudge: (o) => ({ body: `${o.other || 'Your captain'} says: vote on tonight’s question. It takes ten seconds`, url: './#table' }),
  stripe: (o) => ({ body: `Three for three, captain. That’s stripe number ${o.n || 1}`, url: './#me' }),
  salute: () => ({ body: 'Your table thanked you for captaining', url: './#me' }),
  industry: (o) => ({ body: `Captains first: an industry table with ${o.guest} on ${o.label}. You get 48 hours before anyone else`, url: './#home' }),
  industryopen: (o) => ({ body: `Seats are open for an industry table with ${o.guest} on ${o.label}`, url: './#home' }),
  captain: (o) => ({ body: `You’re the captain for ${o.day}: get there five minutes early and give the name at the door.`, url: './#home' }),
  longin: (o) => ({ body: `A seat opened at the long table on ${o.day}, and it’s yours.`, url: './#home' }),
  again: (o) => ({ body: `Round ${o.n === 2 ? 'two' : o.n === 3 ? 'three' : o.n} is booked: your table again, ${o.day} two weeks from now.`, url: './#home' }),
  unmatched: () => ({ body: 'No table fit your evenings this week, so you’re first in line next week. Hangs are open any day.', url: './#home' }),
  popjoin: (o) => ({ body: `${o.other || 'Someone'} is in for your hang: ${o.title || ''}`, url: './#hangs' }),
  popcancel: (o) => ({ body: `${o.other || 'The host'} called off “${o.title || 'the hang'}”.`, url: './#hangs' })
};
// about tonight: these always go out, whatever else someone got today
const URGENT = ['reveal', 'spot', 'tableoff', 'merged', 'roundoff', 'lastcall', 'captain', 'longin', 'table'];
function notify(id, kind, o) {
  const m = db.members[id]; if (!m || m.deleted || !(m.push && m.push.length) || !PUSH_TEXT[kind]) return Promise.resolve(0);
  if (m.paused && kind === 'event') return Promise.resolve(0);
  const day = ymdTz(Date.now()), urgent = URGENT.indexOf(kind) >= 0;
  m.pushLog = (m.pushLog || []).filter((x) => x.day === day);
  if (!urgent && m.pushLog.filter((x) => URGENT.indexOf(x.kind) < 0).length >= PUSH_DAY) return Promise.resolve(0);
  m.pushLog.push({ day, kind });
  const t = PUSH_TEXT[kind](o || {});
  return Promise.all(m.push.map((sub) => PUSH.send(sub, { title: 'Sidetable', body: t.body, url: t.url, tag: kind }, { topic: kind })
    .then((r) => { if (r.gone) m.push = (m.push || []).filter((x) => x.endpoint !== sub.endpoint); return r.ok ? 1 : 0; })))
    .then((a) => { save(); return a.reduce((x, y) => x + y, 0); });
}
function setPush(me, b) {
  if (b.off) { me.push = b.endpoint ? (me.push || []).filter((x) => x.endpoint !== String(b.endpoint)) : []; return { ok: true, push: !!me.push.length }; }
  const sub = b.sub || {}, k = sub.keys || {};
  let u; try { u = new URL(String(sub.endpoint || '')); } catch (e) { fail('subscription required'); }
  if (process.env.SIXTOP_PUSH_HTTP !== '1' && (u.protocol !== 'https:' || !/(\.googleapis\.com|\.mozilla\.com|\.push\.apple\.com|\.notify\.windows\.com)$/.test(u.hostname))) fail('subscription not allowed');
  if (String(sub.endpoint).length > 1000 || !/^[A-Za-z0-9_-]{80,100}$/.test(k.p256dh || '') || !/^[A-Za-z0-9_-]{16,30}$/.test(k.auth || '')) fail('subscription not recognized');
  me.push = (me.push || []).filter((x) => x.endpoint !== sub.endpoint).concat([{ endpoint: String(sub.endpoint), keys: { p256dh: k.p256dh, auth: k.auth }, at: new Date().toISOString() }]).slice(-3);
  return { ok: true, push: true };
}
// the venue at noon on the day, and the next-morning question, each once per event
function tick(nowMs) {
  const now = nowMs || Date.now();
  const today = ymdTz(now), wk = targetWeek(now), old = addDays(today, -8);
  if (process.env.SIXTOP_AUTO_WEEK === '1') {
    const cur = mondayOf(today), todo = !db.weeks[wk] && now >= weekCloses(wk) + 2 * HOUR ? wk : dowOf(today) === 1 && now < tzMs(today, '09:00') && !db.weeks[cur] ? cur : null;
    if (todo) { try { matchWeek({ week: todo }); publishWeek({ week: todo }); } catch (e) { console.error(e); alertOps('autoweek:' + todo, 'week', `Building or publishing the week of ${dayLabel(tzMs(todo, '12:00'))} didn’t work (${e.message}). Build and publish it on the Tables tab.`); } }
  }
  if (dowOf(today) === 0 && now >= tzMs(today, '21:00')) {
    const w = db.weeks[wk], marked = live().some((m) => m.avail && m.avail.week === wk && m.avail.slots.length);
    if (marked && !(w && w.published)) alertOps('week:' + wk, 'week', w ? 'Next week’s tables are built but not published, and members are waiting for Sunday-night invitations. Publish them on the Tables tab.' : 'Next week’s tables aren’t built yet, and members are waiting for Sunday-night invitations. Build and publish them on the Tables tab.');
  }
  Object.values(db.events).forEach((e) => {
    if (e.status !== 'published' || e.date < old) return;
    const tm = eventTimes(e); e.notified = e.notified || {};
    const people = [].concat.apply([], tablesOf(e.id).map((t) => seatedIds(t)));
    if (!e.notified.reveal && now >= tm.reveal && now < tm.start + 3 * HOUR) {
      e.notified.reveal = 1;
      tablesOf(e.id).filter((t) => t.published && !t.closed).forEach((t) => {
        if (spotSet(t)) seatedIds(t).forEach((id) => notify(id, 'reveal'));
        else { t.revealWait = true; alertOps('reveal:' + t.id, 'place', `It’s noon on ${weekday(tm.start)} and table ${t.no} (${seatedIds(t).length} people) has no confirmed spot${t.venue ? ': ' + t.venue.name + ' hasn’t said yes' : ''}. Members see “confirming the spot” until you fix it.`); }
        looseNote(t); captainNote(t);
      });
    }
    tablesOf(e.id).forEach((t) => advanceGame(t, now));
    const cut = freeUntil(e);
    if (!e.notified.lastcall && now >= Math.max(tzMs(addDays(e.date, -1), '09:00'), (Date.parse(e.publishedAt || 0) || 0) + HOUR) && now < cut - 30 * 60000) { e.notified.lastcall = 1; people.forEach((id) => notify(id, 'lastcall', { day: weekday(tm.start), time: timeLabel(tm.start), by: byLabel(cut, now) })); }
    if (!e.notified.feedback && now >= tm.pushFeedback && now < tm.start + 6 * DAY) {
      tablesOf(e.id).forEach((t) => { if (t.published && !t.closed && t.captain && seatedIds(t).indexOf(t.captain) >= 0 && missions(t, now, true).stripe) notify(t.captain, 'stripe', { n: captainStats(db.members[t.captain], now).stripes }); });
      e.notified.feedback = 1; people.filter((id) => !tablesOf(e.id).some((t) => (db.feedback[t.id] || {})[id])).forEach((id) => notify(id, 'feedback')); }
  });
  Object.values(db.events).forEach((e) => { if (e.industry && e.status === 'open' && e.industry.everyone && !e.notified.everyone && now >= Date.parse(e.industry.captainsUntil) && now < eventTimes(e).closes) { e.notified.everyone = 1; live().filter((m) => done(m) && !m.paused).forEach((m) => notify(m.id, 'industryopen', { guest: e.industry.guest, label: shortLabel(eventTimes(e).start) })); } });
  Object.values(db.pops).forEach((u) => { if (u.game && !u.cancelled && popTimes(u).end + DAY > now) advanceGame(u, now); });
  Object.values(db.tables).forEach((t) => { const e = db.events[t.eventId]; if (t.published && !t.closed && !t.venue && e && e.status === 'published' && eventTimes(e).start > now) placeTable(t); if (t.revealWait && !t.closed) revealNow(t, now); });
  const mo = monthNow(), going = Object.keys(db.long[mo] || {}).length;
  if (going && now >= longCloses(mo) && now < tzMs(longDate(mo), LONG_TIME) && !(db.longCount || {})[mo]) {
    (db.longCount = db.longCount || {})[mo] = isoNow(); const sp = (db.longSpot || {})[mo] || {};
    alertOps('longcount:' + mo, 'long', `Long table RSVPs just closed: ${going} going${arr((db.longWait || {})[mo]).length ? ', ' + arr(db.longWait[mo]).length + ' waiting' : ''}. Send the count to ${sp.name || 'the venue'}${sp.name ? '' : ' (no venue entered yet)'}.`);
  }
  // sign-ups that never finished: their name and email don't stay around
  Object.keys(db.verify).forEach((em) => { if ((db.verify[em].exp || 0) + DAY < now) delete db.verify[em]; });
  placeMail(now);
  save();
}

/* ---------- member actions ---------- */
function setNever(me, b) { const o = db.members[b.id]; if (!o) fail('no such member'); me.never = me.never || {}; if (b.on) me.never[o.id] = 1; else delete me.never[o.id]; return { ok: true }; }
function report(me, b) {
  const o = db.members[b.id]; if (!o) fail('no such member');
  me.never = me.never || {}; me.never[o.id] = 1;
  db.reports.push({ by: me.id, who: o.id, reason: clip(b.reason, 60), text: clip(b.text, 600), at: new Date().toISOString(), open: true });
  log('report', me.id, o.id);
  const shared = Object.values(db.tables).some((t) => t.published && !t.closed && seatedIds(t).indexOf(me.id) >= 0 && seatedIds(t).indexOf(o.id) >= 0 && (db.events[t.eventId] || {}).date >= ymdTz(Date.now()));
  alertOps('report:' + o.id + ':' + me.id, 'report', `${me.name} reported ${o.name || 'a member'}${b.reason ? ' (' + clip(b.reason, 60) + ')' : ''}. Read it on the People tab within a day.${shared ? ' They share an upcoming table, and the reporter can step out of it at no cost.' : ''}`);
  return { ok: true };
}
function erase(me) {
  try { fs.unlinkSync(path.join(PHOTOS, me.id + '.img')); } catch (e) {}
  Object.keys(db.seats).forEach((eid) => { const s = db.seats[eid][me.id]; if (s && s.status === 'held') { try { cancelSeat(me, { event: eid }); } catch (e) { s.status = 'cancelled'; } } });
  Object.values(db.pops).forEach((u) => { if (u.host === me.id && !u.cancelled) u.cancelled = true; const k = u.joined.indexOf(me.id); if (k >= 0) u.joined.splice(k, 1); });
  if (db.standby) delete db.standby[me.id];
  Object.keys(db.long || {}).forEach((mo) => { if (db.long[mo][me.id]) { delete db.long[mo][me.id]; if (Date.now() < tzMs(longDate(mo), LONG_TIME) - 6 * HOUR) promoteLong(mo); } });
  Object.keys(db.longWait || {}).forEach((mo) => { db.longWait[mo] = arr(db.longWait[mo]).filter((x) => x !== me.id); });
  Object.keys(db.chats).forEach((k) => { db.chats[k] = arr(db.chats[k]).filter((x) => x.from !== me.id); });
  Object.keys(db.dms).forEach((k) => { if (k.split('|').indexOf(me.id) >= 0) delete db.dms[k]; });
  db.posts.forEach((p) => { if (p.by === me.id) { p.removed = true; p.text = ''; } });
  Object.values(db.jobs).forEach((j) => { if (j.by === me.id) j.closed = true; });
  delete db.waves[me.id]; Object.keys(db.waves).forEach((a) => { if (db.waves[a]) delete db.waves[a][me.id]; });
  Object.keys(db.verify).forEach((e) => { if (e === me.email || db.verify[e].id === me.id) delete db.verify[e]; });
  Object.keys(db.feedback).forEach((t) => { if (db.feedback[t]) delete db.feedback[t][me.id]; });
  db.members[me.id] = { id: me.id, deleted: true, deletedAt: new Date().toISOString() }; // the link stops working; their messages, posts, picks and waves go too
  return { ok: true };
}
function log(kind, a, b) { db.log.push({ kind, a: a || '', b: b || '', at: new Date().toISOString() }); db.log = db.log.slice(-500); }

/* ---------- admin ---------- */
function adminOK(req) { const a = Buffer.from(String(req.headers['x-admin-key'] || '')), b = Buffer.from(ADMIN); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function newClub(b) {
  const name = clip(b.name, 60).trim(); if (!name) fail('name required');
  let code; do { code = crypto.randomBytes(5).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase(); } while (!code || db.clubs[code] || code.length < 6);
  db.clubs[code] = { code, name, uses: 0, createdAt: new Date().toISOString() };
  return { code, link: PUBLIC_URL + '/?join=' + code };
}
function metrics() {
  const L = live(), joined = L.filter(done), now = Date.now();
  const past = Object.values(db.tables).filter((t) => t.published && db.events[t.eventId] && db.events[t.eventId].status !== 'cancelled' && now >= eventTimes(db.events[t.eventId]).start);
  let seated = 0, came = 0, absent = 0, ratings = [], again = 0, standing = 0;
  past.forEach((t) => {
    const fb = db.feedback[t.id] || {}, ids = seatedIds(t); seated += ids.length;
    ids.forEach((id) => { const a = (t.attended || {})[id], f = fb[id]; if (a === true || (f && f.attended && a !== false)) came++; else if (a === false || (f && f.attended === false)) absent++; if (f && f.rating) ratings.push(f.rating); if (f && f.again) again++; });
    if (t.next && t.next !== 'busy') standing++;
  });
  // came back: had a past table and booked another night within 21 days after it
  const rebook = (() => {
    const firsts = {}; past.forEach((t) => { const st = eventTimes(db.events[t.eventId]).start; seatedIds(t).forEach((id) => { if (!firsts[id] || st < firsts[id]) firsts[id] = st; }); });
    const ids = Object.keys(firsts).filter((id) => now - firsts[id] >= 21 * DAY); if (!ids.length) return 'n/a';
    const back = ids.filter((id) => Object.keys(db.seats).some((eid) => { const e = db.events[eid], s = db.seats[eid][id]; if (!e || !s) return false; const st = eventTimes(e).start; return st > firsts[id] && Date.parse(s.at) - firsts[id] <= 21 * DAY; }));
    return Math.round(100 * back.length / ids.length) + '%';
  })();
  const mutual = past.reduce((n, t) => n + mutualPairs(t).length, 0), cs = campusStats();
  const topicIds = new Set(), kinIds = new Set();
  Object.keys(db.seats).forEach((eid) => { const e = db.events[eid]; if (!e) return; Object.keys(db.seats[eid]).forEach((id) => { if (db.seats[eid][id].status === 'held') (e.type === 'kindred' ? kinIds : topicIds).add(id); }); });
  return {
    invited: L.length, joined: joined.length, harvard: joined.filter((m) => m.school === 'harvard').length, mit: joined.filter((m) => m.school === 'mit').length,
    showUp: came + absent ? Math.round(100 * came / (came + absent)) + '%' : 'n/a', confirmed: came + ' of ' + seated, rating: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 'n/a',
    rebook, mutual, dms: Object.keys(db.dms).length, met: cs.first, second: cs.second, third: cs.third, wantAgain: again, standing, longGoing: Object.keys(db.long[monthNow()] || {}).filter((id) => db.members[id] && !db.members[id].deleted).length,
    popsHosted: Object.keys(db.pops).length, popJoins: Object.values(db.pops).reduce((n, x) => n + x.joined.length, 0),
    roles: Object.values(db.jobs).filter((j) => !j.closed).length, introsAsked: db.intros.length, introsYes: db.intros.filter((x) => x.status === 'accepted').length,
    posts: db.posts.filter((x) => !x.removed).length, votes: db.posts.reduce((n, x) => n + Object.keys(x.votes || {}).length, 0),
    waves: Object.keys(db.waves).reduce((n, a) => n + Object.keys(db.waves[a] || {}).filter((b2) => a < b2 && (db.waves[b2] || {})[a]).length, 0),
    kindredFromTopic: topicIds.size ? Math.round(100 * Array.from(topicIds).filter((id) => kinIds.has(id)).length / topicIds.size) + '%' : 'n/a'
  };
}
function adminState() {
  const L = live();
  const tracks = {}; L.filter(done).forEach((m) => { const t = (m.profile.tracks || [])[0]; if (t) tracks[t] = (tracks[t] || 0) + 1; });
  return {
    metrics: metrics(), tracks, area: AREA, places: placesAdmin(), ops: opsAdmin(), mail: MAIL_MODE === 'show' ? 'show' : MAIL_FROM && process.env.RESEND_API_KEY ? 'resend' : 'off', week: weekAdmin(),
    pops: Object.values(db.pops).sort((a, b) => (b.date + b.time > a.date + a.time ? 1 : -1)).slice(0, 60).map((x) => ({ id: x.id, title: x.title, host: (db.members[x.host] || {}).name || x.host, when: dayLabel(popTimes(x).start) + ' at ' + timeLabel(popTimes(x).start), place: x.place, count: 1 + x.joined.length, size: x.size, cancelled: !!x.cancelled })),
    members: L.map((m) => ({ id: m.id, name: m.name, email: m.email || '', school: m.school, program: m.program || '', year: m.year, joined: done(m), via: m.via || 'invite', tracks: (m.profile && m.profile.tracks) || [],
      persona: done(m) ? personaOf(m).name : '', photo: !!m.photo, push: !!(m.push && m.push.length), paused: !!m.paused, prio: m.prio || 0,
      seats: Object.keys(db.seats).filter((e) => (db.seats[e][m.id] || {}).status === 'held').length, tables: Object.values(db.tables).filter((t) => t.published && t.ids.indexOf(m.id) >= 0).length, link: inviteLink(m) })),
    clubs: Object.values(db.clubs).map((c) => Object.assign({}, c, { link: PUBLIC_URL + '/?join=' + c.code })),
    events: Object.values(db.events).sort((a, b) => eventTimes(b).start - eventTimes(a).start).map((e) => {
      const rows = seatRows(e);
      return { id: e.id, type: e.type, industry: e.industry ? e.industry.guest : '', date: e.date, time: e.time, label: dayLabel(eventTimes(e).start) + ' at ' + timeLabel(eventTimes(e).start), area: e.area, status: e.status, phase: eventPhase(e), round: e.round || 0,
        seats: rows.length, harvard: rows.filter((x) => x.m.school === 'harvard').length, mit: rows.filter((x) => x.m.school === 'mit').length, tables: tablesOf(e.id).length, wait: (e.wait || []).length };
    }),
    jobs: Object.values(db.jobs).sort((a, b) => (b.at > a.at ? 1 : -1)).map((j) => ({ id: j.id, title: j.title, company: j.company, track: j.track, kind: j.kind, by: j.by === 'admin' ? 'Admin' : ((db.members[j.by] || {}).name || j.by), refer: j.refer, closed: !!j.closed, sample: !!j.sample, at: j.at,
      saves: Object.keys(db.saves).filter((k) => (db.saves[k] || {})[j.id]).length, intros: db.intros.filter((x) => x.job === j.id).length })),
    posts: db.posts.slice(-80).reverse().map((x) => ({ id: x.id, kind: x.kind, text: x.text, by: (db.members[x.by] || {}).name || x.by, at: x.at, removed: !!x.removed, votes: Object.keys(x.votes || {}).length, replies: (x.replies || []).length })),
    reports: db.reports.filter((r) => r.open).map((r) => Object.assign({}, r, { byName: (db.members[r.by] || {}).name || r.by, whoName: (db.members[r.who] || {}).name || r.who })),
    log: db.log.slice(-30).reverse()
  };
}
function weekAdmin() {
  const week = pendingWeek() || targetWeek(), w = db.weeks[week] || null, L = live().filter((m) => done(m) && m.avail && m.avail.week === week && m.avail.slots.length);
  const slots = weekSlots(week).map((sid) => { const [date, meal] = sid.split('|'); const ms = L.filter((m) => m.avail.slots.indexOf(sid) >= 0); return { id: sid, label: DOW[dowOf(date)] + ' ' + date.slice(5) + ' ' + MEALS[meal].t, n: ms.length, harvard: ms.filter((m) => m.school === 'harvard').length, mit: ms.filter((m) => m.school === 'mit').length }; });
  return { week, closes: dayLabel(weekCloses(week)) + ' ' + timeLabel(weekCloses(week)), people: L.length, slots, matched: !!w, published: !!(w && w.published),
    events: w ? w.events.filter((eid) => db.events[eid]).map((eid) => ({ id: eid, label: dayLabel(eventTimes(db.events[eid]).start) + ', ' + (db.events[eid].type === 'kindred' ? 'Social' : 'Tech'), tables: tablesOf(eid).length })) : [], unmatched: w ? w.unmatched.length : 0 };
}
// tonight's question at a glance: the menu, the votes, the pick, the split, changed minds
function adminGame(t) {
  const g = t.game; if (!g) return null;
  const ids = seatedIds(t), q = (id) => (SX.card(id) || {}).q || id, n = (fn) => ids.filter(fn).length;
  return { menu: g.cards.map((id) => ({ q: q(id), votes: n((x) => g.votes[x] === id) })), pick: g.pick ? q(g.pick) : null, by: g.by || null,
    a: n((x) => g.sides[x] === 'a'), b: n((x) => g.sides[x] === 'b'), revealed: !!g.revealed, moved: n((x) => g.final[x] && g.sides[x] && g.final[x] !== g.sides[x]) };
}
function adminEvent(id) {
  const e = db.events[id]; if (!e) fail('no such event');
  const tm = eventTimes(e), rows = seatRows(e), nm = (mid) => { const m = db.members[mid] || {}; return { id: mid, name: m.name || mid, school: m.school, track: ((m.profile || {}).tracks || [])[0] || '', lens: (m.profile || {}).lens || '', persona: done(m) ? personaOf(m).code : '' }; };
  const byTrack = {}; rows.forEach((x) => { const t = (x.m.profile.tracks || [])[0] || '?'; byTrack[t] = byTrack[t] || { harvard: 0, mit: 0 }; byTrack[t][x.m.school] = (byTrack[t][x.m.school] || 0) + 1; });
  return {
    event: Object.assign({}, e, { label: dayLabel(tm.start) + ' at ' + timeLabel(tm.start), closes: dayLabel(tm.closes) + ' ' + timeLabel(tm.closes), phase: eventPhase(e) }), byTrack,
    seats: rows.map((x) => Object.assign(nm(x.id), { size: x.s.size, diet: x.s.diet, at: x.s.at, prio: x.m.prio || 0 })),
    cancelled: Object.keys(db.seats[e.id] || {}).filter((mid) => db.seats[e.id][mid].status === 'cancelled').map((mid) => Object.assign(nm(mid), { late: !!db.seats[e.id][mid].late })),
    tables: tablesOf(e.id).map((t) => ({ id: t.id, no: t.no, track: t.track, published: !!t.published, score: t.score, flags: t.flags || [], why: t.why || [], venue: t.venue, closed: t.closed || '', round: t.round || 1,
      spot: t.venue && t.venue.id ? ((bookingOf(t) || {}).state || '') : t.venue ? 'by hand' : '', captain: t.captain && db.members[t.captain] ? db.members[t.captain].name : '',
      people: t.ids.map((mid) => Object.assign(nm(mid), { out: !!(t.out && t.out[mid]), attended: (t.attended || {})[mid], feedback: !!(db.feedback[t.id] || {})[mid] })),
      ratings: Object.values(db.feedback[t.id] || {}).map((f) => f.rating).filter(Boolean), mutual: mutualPairs(t).map((p) => p.map((x) => (db.members[x] || {}).name || x)),
      again: Object.values(db.feedback[t.id] || {}).filter((f) => f.again).length, messages: (db.chats[t.id] || []).filter((x) => x.from !== 'charlie').length, game: adminGame(t) })),
    wait: (e.wait || []).map(nm), merged: e.merged || [], reunions: context(e).locks.map((g) => g.map((x) => (db.members[x] || {}).name || x))
  };
}

/* ---------- http ---------- */
const hits = new Map();
function limited(key, max) {
  const now = Date.now(), w = (hits.get(key) || []).filter((t) => now - t < 60000); w.push(now); hits.set(key, w);
  if (hits.size > 5000) hits.forEach((v, k) => { if (now - v[v.length - 1] > 60000) hits.delete(k); });
  return w.length > max;
}
const recent = (key) => (hits.get(key) || []).filter((t) => Date.now() - t < 60000).length;
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(obj)); }
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > max) { if (!chunks.over) { chunks.over = true; chunks.length = 0; reject(Object.assign(new Error('that’s too big to send'), { user: true })); } } else if (!chunks.over) chunks.push(c); });
    req.on('end', () => { try { const v = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; resolve(v && typeof v === 'object' && !Array.isArray(v) ? v : {}); } catch (e) { reject(Object.assign(new Error('bad json'), { user: true })); } });
    req.on('error', reject);
  });
}
const STATIC = { '/': 'index.html', '/index.html': 'index.html', '/admin': 'admin.html', '/place': 'place.html', '/shared.js': 'shared.js', '/app.css': 'app.css', '/sw.js': 'sw.js', '/manifest.webmanifest': 'manifest.webmanifest' };
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', webmanifest: 'application/manifest+json', png: 'image/png', jpg: 'image/jpeg', mp4: 'video/mp4' };
const STATIC_CACHE = {};
function staticBody(file) {
  const st = fs.statSync(file), c = STATIC_CACHE[file]; if (c && c.mtime === st.mtimeMs && c.size === st.size) return c;
  const raw = fs.readFileSync(file);
  return (STATIC_CACHE[file] = { mtime: st.mtimeMs, size: st.size, raw, etag: '"' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"', gz: /\.(html|js|css|webmanifest)$/.test(file) ? require('zlib').gzipSync(raw) : null });
}
function serveStatic(p, res, req) {
  let f = STATIC[p]; if (!f && (/^\/icons\/icon-\d{2,4}\.png$/.test(p) || /^\/img\/[a-z]+\.jpg$/.test(p) || /^\/video\/[a-z]+\.mp4$/.test(p))) f = p.slice(1);
  if (!f) return false;
  const file = path.join(PUB, f); if (!fs.existsSync(file)) { send(res, 404, { error: 'not found' }); return true; }
  const ext = f.split('.').pop();
  if (ext === 'mp4') return serveVideo(file, req, res);
  const c = staticBody(file), head = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === 'png' || ext === 'jpg' ? 'public, max-age=86400' : 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "frame-ancestors 'none'", 'X-Frame-Options': 'DENY', ETag: c.etag, Vary: 'Accept-Encoding' };
  if (req && req.headers['if-none-match'] === c.etag) { res.writeHead(304, head); res.end(); return true; }
  const gz = !!(c.gz && req && /\bgzip\b/.test(String(req.headers['accept-encoding'] || '')));
  res.writeHead(200, gz ? Object.assign(head, { 'Content-Encoding': 'gzip' }) : head);
  res.end(req && req.method === 'HEAD' ? undefined : gz ? c.gz : c.raw);
  return true;
}
// the opening film: Safari on iPhone only plays video from servers that answer byte ranges
function serveVideo(file, req, res) {
  const size = fs.statSync(file).size, m = /^bytes=(\d*)-(\d*)$/.exec((req && req.headers.range) || '');
  const head = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
  const stream = (o) => { const rs = fs.createReadStream(file, o); res.on('close', () => rs.destroy()); rs.on('error', () => res.destroy()); rs.pipe(res); };
  if (!m) { res.writeHead(200, Object.assign(head, { 'Content-Length': size })); stream(); return true; }
  let a = m[1] === '' ? size - +m[2] : +m[1], b = m[1] !== '' && m[2] !== '' ? +m[2] : size - 1;
  a = Math.max(0, a); b = Math.min(b, size - 1);
  if (a > b || a >= size) { res.writeHead(416, { 'Content-Range': 'bytes */' + size }); res.end(); return true; }
  res.writeHead(206, Object.assign(head, { 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 }));
  stream({ start: a, end: b });
  return true;
}
const server = http.createServer(async (req, res) => {
  let u; try { u = new URL(req.url, 'http://x'); } catch (e) { return send(res, 400, { error: 'bad request' }); }
  const p = u.pathname, ip = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress || '', tk = String(req.headers['x-sixtop-token'] || '');
  try {
    if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(p, res, req)) return;
    if (req.method === 'GET' && p === '/health') return send(res, 200, { ok: true });
    if (limited(/^[a-f0-9]{32}$/.test(tk) && byToken(tk) ? 'm:' + tk : ip, +process.env.SIXTOP_RATE || 300)) return send(res, 429, { error: 'slow down' });
    if (p.indexOf('/api/admin/') === 0) {
      if (recent('adminfail:' + ip) >= 10) return send(res, 429, { error: 'slow down' });
      if (!adminOK(req)) { limited('adminfail:' + ip, 10); return send(res, 401, { error: 'admin key required' }); }
      if (req.method === 'GET' && p === '/api/admin/state') return send(res, 200, adminState());
      if (req.method === 'GET' && p === '/api/admin/event') return send(res, 200, adminEvent(u.searchParams.get('id')));
      const b = req.method === 'POST' ? await readBody(req, 64 * 1024) : {};
      let out;
      if (p === '/api/admin/invite') { const m = newMember(b.name, b.email, b.school, 'invite'); out = { id: m.id, link: inviteLink(m) }; }
      else if (p === '/api/admin/club') out = newClub(b);
      else if (p === '/api/admin/club-off') { const c = own(db.clubs, b.code); if (!c) fail('no such club'); c.off = !c.off; out = { ok: true }; }
      else if (p === '/api/admin/event') out = createEvent(b);
      else if (p === '/api/admin/event-cancel') out = cancelEvent(b);
      else if (p === '/api/admin/draft') out = draft(b);
      else if (p === '/api/admin/move') out = move(b);
      else if (p === '/api/admin/venue') out = setVenue(b);
      else if (p === '/api/admin/place') out = savePlace(b);
      else if (p === '/api/admin/place-off') { const v = own(db.places || {}, b.id); if (!v) fail('no such place'); v.off = !v.off; if (v.off) replaceAt(v); out = { ok: true }; }
      else if (p === '/api/admin/place-table') { const t = own(db.tables, b.table); if (!t) fail('no such table'); if (!placeTable(t)) fail('no partner has room that evening'); out = placesAdmin(); }
      else if (p === '/api/admin/long-spot') out = setLongSpot(b);
      else if (p === '/api/admin/place-answer') { const v = own(db.places || {}, b.id); if (!v) fail('no such place'); placeAnswer(v, String(b.date || ''), !!b.ok, 'admin'); out = placesAdmin(); }
      else if (p === '/api/admin/place-key') { const v = own(db.places || {}, b.id); if (!v) fail('no such place'); v.key = rid(12); out = placesAdmin(); }
      else if (p === '/api/admin/ops') out = saveOps(b);
      else if (p === '/api/admin/table-off') out = callOff(b);
      else if (p === '/api/admin/alert-done') { const a = arr(db.alerts).find((x) => x.id === b.id); if (!a) fail('no such alert'); a.done = !a.done; a.doneAt = isoNow(); out = opsAdmin(); }
      else if (p === '/api/admin/publish') out = publish(b);
      else if (p === '/api/admin/attend') { const t = db.tables[b.table]; if (!t) fail('no such table'); if (b.attended === false && t.out && t.out[b.member]) fail('they cancelled before the dinner, and that already counts on its own'); t.attended = t.attended || {}; if (b.attended == null) delete t.attended[b.member]; else t.attended[b.member] = !!b.attended; coolCheck(db.members[b.member]); out = adminEvent(t.eventId); }
      else if (p === '/api/admin/announce') { const e = db.events[b.event]; if (!e) fail('no such event'); const text = clip(b.text, 600).trim(); if (!text) fail('message required'); tablesOf(e.id).filter((t) => t.published).forEach((t) => charlie(t.id, text)); out = { ok: true }; }
      else if (p === '/api/admin/remove') { const m = db.members[b.id]; if (!m) fail('no such member'); erase(m); out = { ok: true }; }
      else if (p === '/api/admin/match-week') out = matchWeek(b);
      else if (p === '/api/admin/publish-week') out = publishWeek(b);
      else if (p === '/api/admin/pop-cancel') { const x = db.pops[b.id]; if (!x) fail('no such hang'); if (!x.cancelled) { x.cancelled = true; if (popTimes(x).start > Date.now()) x.joined.concat([x.host]).forEach((id) => notify(id, 'popcancel', { title: x.title, other: 'Sidetable' })); } out = { ok: true }; }
      else if (p === '/api/admin/job') out = postJob(null, b);
      else if (p === '/api/admin/job-close') { const j = db.jobs[b.id]; if (!j) fail('no such role'); j.closed = !j.closed; out = { ok: true }; }
      else if (p === '/api/admin/post-remove') { const x = db.posts.find((q) => q.id === b.id); if (!x) fail('no such post'); x.removed = !x.removed; out = { ok: true }; }
      else if (p === '/api/admin/resolve') { const r = db.reports.find((x) => x.open && x.at === b.at); if (r) r.open = false; out = { ok: true }; }
      else return send(res, 404, { error: 'not found' });
      save(true); return send(res, 200, out);
    }
    if (p === '/api/place') {
      if (limited('place:' + ip, 40)) return send(res, 429, { error: 'slow down' });
      const b = req.method === 'POST' ? await readBody(req, 4 * 1024) : {}, v = placeByKey(req.method === 'POST' ? b.k : u.searchParams.get('k'));
      if (!v) return send(res, 404, { error: 'this link is not active' });
      if (req.method === 'POST') { placeAnswer(v, String(b.date || ''), !!b.ok, 'place'); save(true); }
      return send(res, 200, placeView(v));
    }
    if (p === '/api/join' && req.method === 'GET') { const c = own(db.clubs, u.searchParams.get('code') || ''); return c && !c.off ? send(res, 200, { ok: true, club: c.name }) : send(res, 404, { error: 'this join link is not active' }); }
    if ((p === '/api/verify/start' || p === '/api/verify/finish') && req.method === 'POST') {
      if (limited('verify:' + ip, 60)) return send(res, 429, { error: 'slow down' });
      const who = byToken(String(req.headers['x-sixtop-token'] || '')) || null, b = await readBody(req, 8 * 1024);
      const out = p === '/api/verify/start' ? await startVerify(who, b) : finishVerify(who, b); save(true); return send(res, 200, out);
    }
    if (p === '/api/photo' && req.method === 'GET') {
      const pt = u.searchParams.get('t') || '', id = u.searchParams.get('id') || '', o = db.members[id], me = /^[a-f0-9]{32}$/.test(pt) ? live().find((m) => m.pt === pt) : null;
      const ok = me && o && o.photo && !o.deleted && (id === me.id || (me.verified && done(me) && !blockedEither(me.id, id)));
      const f = path.join(PHOTOS, id + '.img'); if (!ok || !/^m[a-f0-9]{8}$/.test(id) || !fs.existsSync(f)) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': 'image/' + (o.photoType || 'jpeg'), 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
      return res.end(fs.readFileSync(f));
    }
    if (p.indexOf('/api/') === 0) {
      const me = byToken(String(req.headers['x-sixtop-token'] || ''));
      if (!me) return send(res, 401, { error: 'this link is not active' });
      if (!me.verified && p !== '/api/me') return send(res, 403, { error: 'confirm your school email first' });
      me.seenAt = new Date().toISOString();
      if (req.method === 'GET') {
        if (p === '/api/me') return send(res, 200, view(me));
        if (p === '/api/table') { const v = tableView(me, u.searchParams.get('id')); me.read['t:' + v.id] = new Date().toISOString(); saveSoon(); return send(res, 200, v); }
        if (p === '/api/chat') { const t = own(db.tables, u.searchParams.get('table')); if (!canSeeTable(me, t)) fail('no such table'); if (t.out && t.out[me.id]) fail('you left this table'); advanceGame(t); me.read['t:' + t.id] = new Date().toISOString(); saveSoon(); return send(res, 200, { messages: chatOut(db.chats[t.id], u.searchParams.get('after') || ''), game: gameView(t, me) }); }
        if (p === '/api/pops') return send(res, 200, { pops: pops(me) });
        if (p === '/api/pop') { const r = popView(me, u.searchParams.get('id')); saveSoon(); return send(res, 200, r); }
        if (p === '/api/pchat') { const x = db.pops[u.searchParams.get('id')]; if (!x || (x.host !== me.id && x.joined.indexOf(me.id) < 0)) fail('no such hang'); ensurePopGame(x); advanceGame(x); me.read['p:' + x.id] = new Date().toISOString(); saveSoon(); return send(res, 200, { messages: chatOut(db.chats['p:' + x.id], u.searchParams.get('after') || ''), game: gameView(x, me) }); }
        if (p === '/api/board') { const r = board(me); saveSoon(); return send(res, 200, r); }
        if (p === '/api/pulse') { const r = pulse(me); saveSoon(); return send(res, 200, r); }
        if (p === '/api/post') { const x = postBy(u.searchParams.get('id')); if (!x || !postVisible(x, me)) fail('no such post'); return send(res, 200, postOut(x, me, true)); }
        if (p === '/api/people') return send(res, 200, { people: people(me, u.searchParams.get('q'), u.searchParams.get('track')) });
        if (p === '/api/person') return send(res, 200, personView(me, u.searchParams.get('id')));
        if (p === '/api/dm') { const o = own(db.members, u.searchParams.get('with')); if (!o || o.deleted || !canDm(me.id, o.id)) fail('no such chat'); me.read['d:' + o.id] = new Date().toISOString(); save(); return send(res, 200, { with: card(o, me), messages: chatOut(db.dms[dmKey(me.id, o.id)], u.searchParams.get('after') || '') }); }
        return send(res, 404, { error: 'not found' });
      }
      if (req.method === 'DELETE' && p === '/api/me') { erase(me); save(true); return send(res, 200, { ok: true }); }
      const b = req.method === 'POST' ? await readBody(req, p === '/api/profile' ? 2.5 * 1024 * 1024 : 32 * 1024) : {};
      if (db.members[me.id] !== me || me.deleted) return send(res, 401, { error: 'this link is not active' });
      let out;
      if (p === '/api/profile') { saveProfile(me, b); out = { ok: true }; }
      else if (p === '/api/seat') out = bookSeat(me, b);
      else if (p === '/api/seat-cancel') out = cancelSeat(me, b);
      else if (p === '/api/chat') { if (limited('chat:' + me.id, 30)) fail('slow down'); out = postChat(me, b); }
      else if (p === '/api/dm') { if (limited('dm:' + me.id, 30)) fail('slow down'); out = postDm(me, b); }
      else if (p === '/api/feedback') out = feedback(me, b);
      else if (p === '/api/game') { if (limited('game:' + me.id, 60)) fail('slow down'); out = playGame(me, b); }
      else if (p === '/api/pause') { me.paused = !!b.paused; out = { ok: true }; }
      else if (p === '/api/invite-open') { const t = db.tables[b.table]; if (!t || !canSeeTable(me, t)) fail('no such table'); me.read['inv:' + t.id] = new Date().toISOString(); out = { ok: true }; }
      else if (p === '/api/table-size') { me.tableSize = inList(b.size, ['four', 'six', 'either']) || 'either'; out = { ok: true }; }
      else if (p === '/api/never') out = setNever(me, b);
      else if (p === '/api/report') out = report(me, b);
      else if (p === '/api/push') out = setPush(me, b);
      else if (p === '/api/avail') out = setAvail(me, b);
      else if (p === '/api/pop') out = createPop(me, b);
      else if (p === '/api/reinvite') { if (limited('reinvite:' + me.id, 10)) fail('slow down'); out = reinvite(me, b); }
      else if (p === '/api/standby-stop') out = stopStandby(me);
      else if (p === '/api/long') out = setLong(me, b);
      else if (p === '/api/seen') { const k = String(b.key || ''); if (!/^off:t[a-f0-9]{10}$/.test(k)) fail('nothing to mark'); me.read[k] = isoNow(); out = { ok: true }; }
      else if (p === '/api/captain') out = captainMove(me, b);
      else if (p === '/api/captain-spot') out = captainSpot(me, b);
      else if (p === '/api/captain-nudge') out = captainNudge(me, b);
      else if (p === '/api/captain-checks') out = captainChecks(me, b);
      else if (p === '/api/captain-pref') { me.captain = inList(b.pref, ['yes', 'maybe', 'no']) || 'maybe'; out = { ok: true }; }
      else if (p === '/api/pop-join') { if (limited('popjoin:' + me.id, 20)) fail('slow down'); out = joinPop(me, b); }
      else if (p === '/api/pop-cancel') out = cancelPop(me, b);
      else if (p === '/api/pchat') { if (limited('chat:' + me.id, 30)) fail('slow down'); out = postPopChat(me, b); }
      else if (p === '/api/job') { if (!done(me)) fail('finish your profile first'); out = postJob(me, b); }
      else if (p === '/api/job-save') out = saveJob(me, b);
      else if (p === '/api/intro') out = askIntro(me, b);
      else if (p === '/api/intro-answer') out = answerIntro(me, b);
      else if (p === '/api/post') { if (!done(me)) fail('finish your profile first'); out = createPost(me, b); }
      else if (p === '/api/vote') out = vote(me, b);
      else if (p === '/api/plus') out = plus(me, b);
      else if (p === '/api/reply') out = reply(me, b);
      else if (p === '/api/post-delete') out = deletePost(me, b);
      else if (p === '/api/wave') out = wave(me, b);
      else return send(res, 404, { error: 'not found' });
      save();
      return send(res, 200, Object.assign(out, { view: view(me) }));
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    if (!e.user && e.code !== 'ECONNRESET' && e.message !== 'aborted') console.error(e);
    if (res.headersSent || res.destroyed) return;
    return send(res, e.user ? 400 : 500, { error: e.user ? e.message : 'something went wrong' });
  }
});

function start(port) {
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) { // on Railway the container's own disk is wiped on every deploy
    const vol = process.env.RAILWAY_VOLUME_MOUNT_PATH;
    if (!vol) throw new Error('Attach a Railway volume (mounted at /data) before starting, or every deploy starts with no members.');
    if (path.relative(path.resolve(vol), DATA).indexOf('..') === 0) throw new Error('SIXTOP_DATA_DIR (' + DATA + ') has to be inside the volume at ' + vol + '.');
  }
  process.on('unhandledRejection', (e) => console.error('unhandled', (e && e.stack) || e));
  if (/^https:\/\//.test(PUBLIC_URL)) {
    if (MAIL_MODE === 'show') throw new Error('SIXTOP_MAIL=show puts sign-in codes on screen, so anyone could sign in as anyone. Remove it on a real deployment.');
    if (String(process.env.SIXTOP_ADMIN_KEY || '').length < 16) throw new Error('Set SIXTOP_ADMIN_KEY to a long random secret (16+ characters) on a real deployment.');
  }
  if (MAIL_MODE !== 'show' && (!process.env.RESEND_API_KEY || !MAIL_FROM)) console.warn('RESEND_API_KEY or SIXTOP_MAIL_FROM is not set: nobody can get a sign-in code, so nobody can join.');
  if (!PUBLIC_URL) console.warn('SIXTOP_PUBLIC_URL is not set: invite, club and restaurant links will be missing the site address.');
  const t = setInterval(() => { try { tick(); } catch (e) { console.error(e); } }, 5 * 60 * 1000); if (t.unref) t.unref();
  process.on('SIGINT', () => { save(true); process.exit(0); });
  process.on('SIGTERM', () => { save(true); process.exit(0); });
  return server.listen(port || PORT, () => console.log('Sidetable beta on http://localhost:' + (port || PORT) + '  (admin: /admin, data: ' + DATA + ')'));
}
if (require.main === module) start();
module.exports = { server, start, db: () => db, save, newMember, saveProfile, createEvent, bookSeat, cancelSeat, draft, move, setVenue, publish, feedback, postChat, postDm, playGame, advanceGame, gameView, startGame, ensurePopGame, reinvite, fillChair, roundTwo, savePlace, placeTable, placesAdmin, placeMail, placeAnswer, placeView, setLongSpot, syncBooking, saveOps, opsAdmin, opsDuty, alertOps, shrink, closeTable, callOff, pickCaptain, captainMove, lateChanges, cooling, promoteLong, setVenue, fillRounds, monthView, setLong, longDate, monthNow,
  isMutual, canDm, view, tableView, setAvail, availView, matchWeek, publishWeek, targetWeek, addDays, ymdTz, createPop, joinPop, cancelPop, pops, popView, postPopChat, postJob, board, saveJob, askIntro, answerIntro, createPost, vote, plus, reply, deletePost, pulse, people, personView, wave, threads, adminState, adminEvent, newClub, startVerify, finishVerify, tick, eventTimes, tzMs, cleanProfile, report, erase, cancelEvent, freeUntil, captainSpot, captainNudge, captainChecks, missions, captainStats, spotOptions, briefCaptain, setDb: (x) => { db = Object.assign(fresh(), x); migrateDb(); } };
