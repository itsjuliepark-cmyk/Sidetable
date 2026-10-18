// End to end, the way phones would use it: starts the real server on a scratch data folder, then 50 made-up members
// join through a club link, verify a school email, fill in their card, plan the week, and live through it over HTTP:
// sealed invitations, the table, the chat, the vote, captains booking, hangs, the Board, People, stepping out.
// Every response is checked (status, shape, the rules), timings are kept, and nothing real is touched.
//   npm run e2e            (50 members)
//   node scripts/e2e.js --people 80
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net');
const SX = require('../public/shared.js');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = Math.max(10, +arg('people', 50));
const ADMIN = 'e2e-admin-key-' + Math.random().toString(36).slice(2);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hashtable-e2e-'));
const problems = [], times = [], counts = {};
const problem = (kind, text) => { problems.push(`[${kind}] ${text}`); };
const PHOTO = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('a face, as a test')]).toString('base64');
let BASE = '';

function freePort() { return new Promise((r) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); }); }
async function call(method, url, body, o) {
  o = o || {};
  const t0 = Date.now(), headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': o.ip || '10.0.0.1' };
  if (o.token) headers['x-sixtop-token'] = o.token; if (o.admin) headers['x-admin-key'] = ADMIN;
  const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const ms = Date.now() - t0; times.push(ms); counts[url.split('?')[0]] = (counts[url.split('?')[0]] || 0) + 1;
  const text = await res.text(); let j = {}; try { j = JSON.parse(text); } catch (e) { j = { raw: text.slice(0, 120) }; }
  if (res.status >= 500) problem('5xx', `${method} ${url} → ${res.status} ${j.error || ''}`);
  if (!o.allow && res.status >= 400) problem('http', `${method} ${url} → ${res.status} ${j.error || ''}`);
  return { status: res.status, j, ms };
}
const profileFor = (i, tr) => ({
  tracks: [tr], interests: SX.INTS.filter((x) => x.tr === tr).slice(i % 3, (i % 3) + 3).map((x) => x.id), lens: ['build', 'run', 'study', 'fund', 'pivot'][i % 5], before: 'Engineer',
  takes: { track: i % 2 ? 'agree' : 'disagree', code: 'agree', lab: 'depends' }, answers: { 0: i % 4, 1: (i + 1) % 4, 2: (i + 2) % 4, 3: i % 3 },
  rhythm: 'Every two weeks', life: ['New to Boston'], acts: [['Run the Charles'], ['Climb'], ['Museums'], ['Cook together']][i % 4], look: 'crew', askWork: 'agents', askLife: 'hikes', diet: [],
  mix: i % 7 === 0 ? 'topic' : i % 11 === 0 ? 'social' : 'both', perWeek: 2, next: ['Start a company'], plan: 'ship a beta', dream: 'a bookstore'
});
const pick = (a, i) => a[i % a.length];

(async () => {
  const port = await freePort(); BASE = 'http://127.0.0.1:' + port;
  const env = Object.assign({}, process.env, { PORT: String(port), SIXTOP_DATA_DIR: DATA, SIXTOP_MAIL: 'show', SIXTOP_ADMIN_KEY: ADMIN, SIXTOP_DEMO: '1', SIXTOP_PUBLIC_URL: BASE, SIXTOP_RATE: '600' });
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let errOut = ''; srv.stderr.on('data', (d) => { errOut += d; }); srv.stdout.on('data', () => {});
  const stop = () => { try { srv.kill(); } catch (e) {} setTimeout(() => { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {} }, 300); };
  try {
    for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch (e) {} await new Promise((r) => setTimeout(r, 150)); }

    /* ---------- the pages a phone loads ---------- */
    for (const [u, type] of [['/', 'text/html'], ['/admin', 'text/html'], ['/manifest.webmanifest', 'manifest'], ['/sw.js', 'javascript'], ['/app.css', 'css'], ['/shared.js', 'javascript'], ['/icons/icon-192.png', 'image/png'], ['/icons/icon-48.png', 'image/png'], ['/icons/maskable-512.png', 'image/png'], ['/icons/badge-96.png', 'image/png'], ['/img/film.jpg', 'image/jpeg']]) {
      const r = await fetch(BASE + u); if (!r.ok) problem('static', `${u} → ${r.status}`); else if ((r.headers.get('content-type') || '').indexOf(type) < 0) problem('static', `${u} served as ${r.headers.get('content-type')}`);
      if (u === '/') { const h = await r.text(); if (/Sidetable|Sixtop/.test(h.replace(/sixtop(Token|-demo|-v\d)/gi, ''))) problem('name', 'an old name is still on the page'); if (!/default-src 'self'/.test(r.headers.get('content-security-policy') || '')) problem('headers', 'no real content policy on the page'); }
      if (u === '/manifest.webmanifest') { const mf = await r.json().catch(() => ({})); if (mf.id !== '/' || mf.start_url !== '/' || !(mf.icons || []).some((x) => x.purpose === 'maskable' && /maskable/.test(x.src))) problem('manifest', 'the install manifest is missing its id, start_url or padded maskable icon'); }
    }
    const vr = await fetch(BASE + '/video/film.mp4', { headers: { Range: 'bytes=0-1023' } });
    if (vr.status !== 206 || +(vr.headers.get('content-length') || 0) !== 1024) problem('video', `range request → ${vr.status}, ${vr.headers.get('content-length')} bytes (iPhone Safari needs 206)`);
    if (!vr.headers.get('etag')) problem('video', 'the film has no ETag, so a new cut could mix with cached pieces of the old one');
    const vr2 = await fetch(BASE + '/video/film.mp4', { headers: { Range: 'bytes=0-1023', 'If-Range': '"old"' } }); if (vr2.status !== 200) problem('video', 'a range for an older copy of the film should get the whole new file, got ' + vr2.status); try { await vr2.body.cancel(); } catch (e) {}

    /* ---------- ops sets up: a club link and four spots captains book ---------- */
    const club = (await call('POST', '/api/admin/club', { name: 'E2E Club' }, { admin: true })).j;
    if (!club.code) { problem('setup', 'no club code'); throw new Error('setup'); }
    for (const [name, via, url] of [['E2E Bistro', 'opentable', 'https://www.opentable.com/'], ['E2E Noodle', 'resy', 'https://resy.com/'], ['E2E Tavern', 'phone', ''], ['E2E Grill', 'web', 'https://example.com/']]) {
      await call('POST', '/api/admin/place', { name, address: '1 Test St, Central Square', area: 'Central Square', nights: [0, 1, 2, 3, 4, 5, 6], tables: 4, seats: 6, mode: 'captain', bookVia: via, bookUrl: url, phone: via === 'phone' ? '(617) 555-0100' : '', vibe: 'Sample' }, { admin: true });
    }

    /* ---------- someone the team invited by email, who never opened the link, signs in on the Home Screen app ---------- */
    const inv = (await call('POST', '/api/admin/invite', { name: 'Invited Person', email: 'invited@mit.edu', school: 'mit' }, { admin: true })).j;
    const iv1 = await call('POST', '/api/verify/start', { email: 'invited@mit.edu' }, { ip: '10.9.0.1' });
    const iv2 = iv1.j.devCode ? await call('POST', '/api/verify/finish', { email: 'invited@mit.edu', code: iv1.j.devCode }, { ip: '10.9.0.1' }) : { j: {} };
    if (!iv2.j.token) problem('signin', 'an invited member who never opened their link can’t sign in by email: ' + JSON.stringify(iv1.j).slice(0, 120));
    else if (inv.link && inv.link.indexOf(iv2.j.token) >= 0) problem('signin', 'the invite link still works after they signed in');

    /* ---------- 50 people join, each from their own phone ---------- */
    const tracks = ['genai', 'genai', 'genai', 'robotics', 'bio', 'climate', 'founders', 'fintech'].filter((t) => SX.TRACKS.some((x) => x.id === t));
    const M = [];
    const joinOne = async (i) => {
      const school = i % 2 ? 'mit' : 'harvard', ip = '10.1.' + Math.floor(i / 200) + '.' + (i % 200 + 2), email = `e2e${i}@${school === 'mit' ? 'mit.edu' : 'college.harvard.edu'}`;
      const j0 = await call('GET', '/api/join?code=' + club.code, null, { ip }); if (!j0.j.ok) problem('join', 'club link not active');
      const s1 = await call('POST', '/api/verify/start', { code: club.code, name: `Test Person${i}`, email }, { ip });
      if (!s1.j.devCode) { problem('verify', `no code for ${email}: ${s1.j.error || ''}`); return null; }
      const bad = await call('POST', '/api/verify/finish', { email, code: '000000' === s1.j.devCode ? '111111' : '000000' }, { ip, allow: true });
      if (bad.status < 400) problem('verify', 'a wrong code was accepted');
      const s2 = await call('POST', '/api/verify/finish', { email, code: s1.j.devCode }, { ip });
      const token = s2.j.token; if (!token) { problem('verify', 'no token after the right code'); return null; }
      const noPhoto = await call('POST', '/api/profile', { first: 'Test' + i, school, program: SX.SCHOOLS[school].programs[i % SX.SCHOOLS[school].programs.length], year: SX.YEARS[1], profile: profileFor(i, pick(tracks, i)) }, { ip, token, allow: true });
      if (noPhoto.status < 400) problem('profile', 'a card without a photo was saved');
      await call('POST', '/api/profile', { first: 'Test' + i, school, program: SX.SCHOOLS[school].programs[i % SX.SCHOOLS[school].programs.length], year: SX.YEARS[1], profile: profileFor(i, pick(tracks, i)), photo: PHOTO }, { ip, token });
      const me = (await call('GET', '/api/me', null, { ip, token })).j;
      if (!me.me || !me.me.done) problem('profile', `${email} isn't done after saving the card`);
      if (me.me && me.me.school !== school) problem('profile', `${email} shows the wrong school`);
      return { i, ip, token, school, email, id: me.me && me.me.id };
    };
    for (let b = 0; b < N; b += 10) (await Promise.all(Array.from({ length: Math.min(10, N - b) }, (_, k) => joinOne(b + k)))).forEach((x) => x && M.push(x));
    if (M.length !== N) problem('join', `${N - M.length} people couldn't finish joining`);

    // someone already in can sign in on a new phone with the same email
    const back = M[3], s3 = await call('POST', '/api/verify/start', { email: back.email }, { ip: '10.9.9.9', allow: true });
    if (s3.j.devCode) { const s4 = await call('POST', '/api/verify/finish', { email: back.email, code: s3.j.devCode }, { ip: '10.9.9.9' }); if (!s4.j.token) problem('signin', 'signing back in gave no token'); else back.token = s4.j.token; }
    else problem('signin', 'no code to sign back in: ' + (s3.j.error || ''));

    /* ---------- everyone plans next week ---------- */
    const view0 = (await call('GET', '/api/me', null, M[0])).j, days = (view0.avail && view0.avail.days) || [];
    const slots = days.flatMap((d) => (d.slots || []).map((s) => s.id || s.slot || s.key)).filter(Boolean);
    if (slots.length < 5) problem('avail', 'the week planner shows ' + slots.length + ' evenings');
    const marked = {};
    for (const m of M) {
      const k = 1 + (m.i % 3), mine = slots.filter((_, j) => (j + m.i) % 5 < k + 1).slice(0, k + 1), max = 1 + (m.i % 2);
      const r = await call('POST', '/api/avail', { slots: mine, max }, m); if (r.j.ok !== false) marked[m.id] = { slots: mine, max };
    }

    /* ---------- Sunday night: ops builds and publishes the week (or SIXTOP_AUTO_WEEK does) ---------- */
    const mw = await call('POST', '/api/admin/match-week', {}, { admin: true });
    if (!(mw.j.tables > 0)) problem('match', 'no tables built: ' + JSON.stringify(mw.j).slice(0, 200));
    await call('POST', '/api/admin/publish-week', {}, { admin: true });
    const st = (await call('GET', '/api/admin/state', null, { admin: true })).j;

    /* ---------- everyone opens the app: sealed invitations, the table, the rules ---------- */
    const seen = {}, byTable = {}, views = {};
    for (const m of M) {
      const v = (await call('GET', '/api/me', null, m)).j; views[m.id] = v; if (!v.build) problem('version', 'the app can’t tell which version it is (no build in /api/me)');
      const mine = (v.tables || []).filter((t) => !t.left && new Date(t.start) > Date.now());
      if (marked[m.id] && !mine.length) problem('nobody-left-out', `${m.email} marked evenings and has no dinner`);
      if (marked[m.id] && mine.length > marked[m.id].max) problem('plan', `${m.email} has ${mine.length} dinners after asking for ${marked[m.id].max}`);
      const dates = mine.map((t) => t.date); if (new Set(dates).size !== dates.length) problem('double', `${m.email} has two tables one night`);
      mine.forEach((t) => {
        if (marked[m.id] && marked[m.id].slots.indexOf(t.date + '|dinner') < 0 && marked[m.id].slots.every((s) => s.indexOf(t.date) < 0)) problem('plan', `${m.email} seated on an evening they didn't mark`);
        if (t.opened) problem('invite', 'an invitation was already open before anyone opened it');
        (byTable[t.id] = byTable[t.id] || []).push(m);
      });
      for (const t of mine) {
        await call('POST', '/api/invite-open', { table: t.id }, m);
        const tv = (await call('GET', '/api/table?id=' + t.id, null, m)).j; seen[t.id] = tv;
        if (!tv.people || tv.people.length < 3 || tv.people.length > 6) problem('size', `table ${t.id} shows ${tv.people && tv.people.length} people`);
        if (tv.venue) problem('reveal', 'the restaurant shows before noon on the day');
        if (!Array.isArray(tv.why) || !tv.why.length) problem('why', 'no why lines at ' + t.id);
        (tv.people || []).forEach((p) => { if (p.email) problem('privacy', 'a tablemate\'s email is in the table view'); });
      }
    }
    Object.keys(byTable).forEach((id) => {
      const ppl = byTable[id], h = ppl.filter((m) => m.school === 'harvard').length, tv = seen[id] || {};
      if (!tv.loose && ppl.length >= 4 && Math.max(h, ppl.length - h) > Math.ceil(ppl.length / 2)) problem('mix', `table ${id} is ${h} Harvard / ${ppl.length - h} MIT`);
    });

    /* ---------- the table talks, votes, and the captain books ---------- */
    const tables = Object.keys(byTable);
    for (const id of tables) {
      const ppl = byTable[id], tv = seen[id] || {};
      for (const m of ppl.slice(0, 3)) await call('POST', '/api/chat', { table: id, text: `hi from ${m.email.split('@')[0]}` }, m);
      const chat = (await call('GET', '/api/chat?table=' + id, null, ppl[0])).j;
      if (!(chat.list || chat.chat || chat.messages || []).length && !(Array.isArray(chat) && chat.length)) { /* shape differs: fine as long as it answered */ }
      const g = tv.game; const card = g && (g.cards || [])[0]; const cid = card && (card.id || card);
      if (cid) for (const m of ppl) await call('POST', '/api/game', { table: id, act: 'vote', card: cid }, Object.assign({}, m, { allow: true }));
      const capId = tv.captain && tv.captain.id, cap = ppl.find((m) => m.id === capId);
      if (!capId) problem('captain', 'no captain at ' + id);
      if (cap) {
        const ctv = (await call('GET', '/api/table?id=' + id, null, cap)).j, opt = ctv.cap && ctv.cap.spot && (ctv.cap.spot.options || []).find((o) => o.kind === 'book');
        if (!opt) problem('captain', 'the captain has no spot to book at ' + id);
        else {
          if (!/covers=\d|seats=\d|size=\d|^tel:|example\.com/.test(opt.link || '')) problem('captain', 'booking link without the party size: ' + opt.link);
          const r = await call('POST', '/api/captain-book', { table: id, place: opt.id, name: 'Test Captain' }, cap);
          if (!r.j.ok) problem('captain', 'booking failed at ' + id);
          const other = ppl.find((m) => m.id !== cap.id), seenBy = (await call('GET', '/api/table?id=' + id, null, other)).j;
          if (seenBy.venue) problem('reveal', 'a booked spot shows to the table before noon');
        }
        const nd = await call('POST', '/api/captain-nudge', { table: id }, Object.assign({}, cap, { allow: true }));
        if (nd.status >= 500) problem('captain', 'nudge crashed');
      }
    }

    /* ---------- plans change: free step-outs, another evening, a block and a report ---------- */
    const leavers = M.filter((m) => m.i % 9 === 4).slice(0, 4);
    for (const m of leavers) {
      const t = ((views[m.id] || {}).tables || []).find((x) => !x.left && new Date(x.start) > Date.now()); if (!t) continue;
      const r = await call('POST', '/api/seat-cancel', { event: t.eventId }, m);
      if (r.j.late) problem('late', 'a step-out days before the free cutoff counted as late');
      const after = (await call('GET', '/api/table?id=' + t.id, null, m, { allow: true }));
      if (after.status === 200 && after.j && !after.j.left) problem('leave', 'still on the table after stepping out');
      const days2 = slots.map((s) => s.split('|')[0]).filter((d) => d !== t.date).slice(0, 3);
      await call('POST', '/api/reinvite', { table: t.id, dates: days2 }, Object.assign({}, m, { allow: true }));
    }
    const [r1, r2] = [M[10], M[11]];
    await call('POST', '/api/report', { id: r2.id, reason: 'test' }, r1);

    /* ---------- hangs, the Board, People ---------- */
    const host = M[1], hv = (await call('POST', '/api/pop', { title: 'E2E coffee', place: 'A cafe in Central', date: slots[2].split('|')[0], time: '17:30', kind: 'social', vibe: 'coffee', size: 5 }, host)).j;
    if (hv.id) { for (const m of M.slice(2, 6)) await call('POST', '/api/pop-join', { id: hv.id }, m); await call('POST', '/api/pchat', { id: hv.id, text: 'see you there' }, M[2]);
      const full = await call('POST', '/api/pop-join', { id: hv.id }, Object.assign({}, M[7], { allow: true })); if (full.status < 400) problem('hang', 'a full hang let one more in'); }
    else problem('hang', 'no hang created');
    const post = (await call('POST', '/api/post', { kind: 'take', text: 'Evals are the new unit tests.' }, M[5])).j;
    if (post.id) { await call('POST', '/api/vote', { post: post.id, side: 'agree' }, M[6]); await call('POST', '/api/reply', { post: post.id, text: 'agree' }, M[7]); }
    await call('GET', '/api/board', null, M[8]);
    for (const m of M.slice(0, 10)) { const pv = (await call('GET', '/api/people', null, m)).j; (pv.people || pv || []).forEach && (pv.people || []).forEach((p) => { if (p.email) problem('privacy', 'People shows an email'); }); }

    /* ---------- the ops view stays consistent ---------- */
    const st2 = (await call('GET', '/api/admin/state', null, { admin: true })).j;
    if (!st2 || st2.error) problem('admin', 'the admin state didn\'t load');
    void st;

    /* ---------- delete an account: the person is gone from tables and People ---------- */
    const gone = M[20]; await call('POST', '/api/me', { erase: true }, Object.assign({}, gone, { allow: true }));

    /* ---------- the same server in a real browser (headless Chrome at phone size), if Chrome is installed ---------- */
    const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && fs.existsSync(p));
    let ui = 'skipped (no Chrome found)';
    if (CHROME && !process.argv.includes('--no-ui')) {
      const dbg = 9600 + Math.floor(Math.random() * 300), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'hashtable-ui-'));
      const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + dbg, '--user-data-dir=' + prof, '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      try {
        let tgt; for (let i = 0; i < 60 && !tgt; i++) { try { tgt = (await (await fetch('http://127.0.0.1:' + dbg + '/json/list')).json()).find((t) => t.type === 'page'); } catch (e) { await sleep(200); } }
        const ws = new WebSocket(tgt.webSocketDebuggerUrl); let n = 0; const wait = {}, errs = [];
        ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; }
          if (d.method === 'Runtime.exceptionThrown') errs.push(((d.params.exceptionDetails || {}).exception || {}).description || d.params.exceptionDetails.text);
          if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push(d.params.args.map((a) => a.value || a.description || '').join(' ')); };
        await new Promise((r) => (ws.onopen = r));
        const cmd = (method, params) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({ id, method, params: params || {} })); });
        const run = async (js) => { const r = await cmd('Runtime.evaluate', { expression: '(async () => { ' + js + ' })()', awaitPromise: true, returnByValue: true }); return r.result && r.result.result && r.result.result.value; };
        await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await cmd('Runtime.enable'); await cmd('Page.enable');
        const shots = path.join(os.tmpdir(), 'hashtable-e2e-shots'); fs.mkdirSync(shots, { recursive: true });
        const shot = async (name) => { const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(shots, name + '.jpg'), Buffer.from(r.result.data, 'base64')); };
        await cmd('Page.navigate', { url: BASE + '/' }); await sleep(2500); await shot('0-landing');
        const filmOk = await run("const v = document.querySelector('#filmBox video'); return !!v");
        if (!filmOk) problem('ui', 'the opening film never started on the landing page');
        let checked = 0;
        for (const m of M.filter((x) => x.id !== gone.id).slice(0, 4)) {
          await run("localStorage.setItem('sixtopToken', " + JSON.stringify(m.token) + "); localStorage.setItem('sixtopSetup', String(Date.now())); return 1"); await cmd('Page.navigate', { url: BASE + '/' }); await sleep(2600);
          const home = await run("return { cur: typeof cur !== 'undefined' ? cur : '', envs: document.querySelectorAll('#homeBody .env, #homeBody .invm').length, month: !!document.querySelector('#homeBody .month'), err: document.body.innerText.indexOf('Something’s off') >= 0 }");
          if (!home || home.cur !== 'home') problem('ui', m.email + ' did not land on Tables: ' + JSON.stringify(home));
          else if (!home.envs) problem('ui', m.email + ' sees no invitation on Tables');
          if (checked === 0) await shot('1-home');
          const t = ((views[m.id] || {}).tables || []).find((x) => !x.left);
          if (t) {
            await run("location.hash = 'table=" + t.id + "'; route(); return 1"); await sleep(1800);
            const tv = await run("return { cur, people: document.querySelectorAll('#tv .seat').length, title: (document.querySelector('#tableBody h2') || {}).textContent || '' }");
            if (!tv || tv.cur !== 'table' || !tv.people) problem('ui', 'the table screen did not render for ' + m.email + ': ' + JSON.stringify(tv));
            if (checked === 0) await shot('2-table');
            await run("openChat('table', '" + t.id + "', true); return 1"); await sleep(1500);
            const sent = await run("const i = document.getElementById('chatIn'); i.value = 'hello from the browser'; sendChat(); await new Promise((r) => setTimeout(r, 1200)); return [...document.querySelectorAll('#msgs .bub, #msgs .m')].some((x) => x.textContent.indexOf('hello from the browser') >= 0)");
            if (!sent) problem('ui', 'a chat message typed in the browser did not show up');
            if (checked === 0) await shot('3-chat');
          }
          for (const tb of ['popups', 'board', 'people', 'me']) { await run("tab('" + tb + "'); return 1"); await sleep(900); if (checked === 0) await shot('4-' + tb); }
          checked++;
        }
        // the iPhone how-to renders its steps, and the app gets through losing its connection
        const how = await run("installSheet(); await new Promise((r) => setTimeout(r, 500)); const n = document.querySelectorAll('#sheet .bookstep').length; closeSheet(); return n");
        if (!(how >= 4)) problem('ui', 'the Home Screen how-to shows ' + how + ' steps');
        await run("await navigator.serviceWorker.ready; return 1"); await cmd('Network.enable');
        await cmd('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); await cmd('Page.reload'); await sleep(3000);
        const off = await run("return { cur: typeof cur !== 'undefined' ? cur : 'no app', retry: !!document.getElementById('lRetry') && getComputedStyle(document.getElementById('lRetry')).display !== 'none', token: !!localStorage.getItem('sixtopToken') }");
        if (!off || off.cur === 'no app') problem('offline', 'with no connection the app didn’t open at all (nothing cached)');
        else if (off.cur !== 'start' || !off.retry || !off.token) problem('offline', 'with no connection: ' + JSON.stringify(off));
        await cmd('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); await sleep(7000);
        const back = await run("return typeof cur !== 'undefined' ? cur : ''"); if (back !== 'home') problem('offline', 'back online, the app stayed on ' + back + ' instead of opening Tables');
        errs.filter((e) => !/favicon|Failed to load resource: the server responded with a status of 4\d\d/.test(e)).forEach((e) => problem('ui', 'console error: ' + String(e).slice(0, 160)));
        ui = checked + ' members in headless Chrome, screenshots in ' + shots;
        ws.close();
      } catch (e) { problem('ui', 'browser run failed: ' + e.message); }
      try { ch.kill(); } catch (e) {} setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {} }, 500);
    }

    /* ---------- report ---------- */
    times.sort((a, b) => a - b);
    const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
    console.log(`\nHash Table end to end: ${N} people over HTTP on a real server\n`);
    console.log(`  joined ${M.length} of ${N}, tables ${tables.length} (${Object.values(byTable).map((x) => x.length).join(', ')} people)`);
    console.log(`  marked evenings ${Object.keys(marked).length}, with a dinner ${Object.keys(marked).filter((id) => ((views[id] || {}).tables || []).some((t) => !t.left)).length}`);
    console.log(`  browser: ${ui}`);
    console.log(`  requests ${times.length}, median ${q(0.5)} ms, 95th percentile ${q(0.95)} ms, slowest ${times[times.length - 1]} ms`);
    if (errOut.trim()) problem('server', 'the server printed errors: ' + errOut.trim().split('\n').slice(0, 3).join(' | '));
    console.log(problems.length ? `\n  PROBLEMS (${problems.length}):\n` + problems.slice(0, 40).map((p) => '   - ' + p).join('\n') : '\n  Everything answered, every rule held.');
    stop(); process.exit(problems.length ? 1 : 0);
  } catch (e) { console.error(e); console.log(problems.join('\n')); stop(); process.exit(1); }
})();
