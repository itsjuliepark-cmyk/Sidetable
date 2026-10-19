/* Hash Table demo runtime. It runs the real server code (server/server.js, server/tables.js, scripts/seed.js) inside the
   page, with an in-memory file system saved to this browser, and answers the app's /api/ calls itself. So the demo is
   the real app with 40 sample members and no server. Built into one page by scripts/build-demo.js. */
(function () {
  'use strict';
  // KEY changes with the bundled code (scripts/build-demo.js fills it in), so new code never runs on old sample data
  var FRESH = /*FRESH*/false, KIND = FRESH ? 'sixtop-start-' : 'sixtop-demo-', KEY = KIND + '/*BUILD*/', MAX_AGE = 3 * 864e5;
  // sample data is rebuilt every few days, and always when a new week starts in Boston, so 'next week' always has evenings in it
  var etYmd = function (ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); };
  var etMonday = function (ms) { var d = new Date(etYmd(ms) + 'T12:00:00Z'), back = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - back * 864e5).toISOString().slice(0, 10); };
  var files = {}, seededAt = 0;
  try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(KIND) === 0 && k !== KEY) localStorage.removeItem(k); }); } catch (e) {}
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && Date.now() - saved.at < MAX_AGE && etMonday(saved.at) === etMonday(Date.now()) && saved.files) { files = saved.files; seededAt = saved.at; } } catch (e) {}
  var warned = false;
  function persist() { try { localStorage.setItem(KEY, JSON.stringify({ at: seededAt, files: files })); } catch (e) { if (!warned) { warned = true; try { toast('Demo', 'This browser is out of room to save the demo, so changes last until you close the page.'); } catch (x) {} } } }

  /* ---------- the few Node pieces the server uses ---------- */
  function Buf(bytes, b64) { this.bytes = bytes; this.length = bytes.length; this._b64 = b64 || null; }
  Buf.from = function (v, enc) {
    if (v instanceof Buf) return v;
    if (enc === 'base64') { var bin = atob(v), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Buf(u, v); }
    return new Buf(new TextEncoder().encode(String(v)));
  };
  Buf.concat = function (list) { var n = 0; list.forEach(function (b) { n += b.length; }); var u = new Uint8Array(n), o = 0; list.forEach(function (b) { u.set(b.bytes, o); o += b.length; }); return new Buf(u); };
  Buf.alloc = function (n) { return new Buf(new Uint8Array(n)); };
  Buf.prototype.toString = function (enc) {
    if (enc === 'hex') { var s = ''; for (var i = 0; i < this.bytes.length; i++) s += (this.bytes[i] < 16 ? '0' : '') + this.bytes[i].toString(16); return s; }
    if (enc === 'base64') { if (this._b64) return this._b64; var t = ''; for (var j = 0; j < this.bytes.length; j++) t += String.fromCharCode(this.bytes[j]); return btoa(t); }
    return new TextDecoder().decode(this.bytes);
  };
  var webCrypto = self.crypto;
  var BUILTIN = {
    fs: {
      mkdirSync: function () {},
      existsSync: function (p) { return Object.prototype.hasOwnProperty.call(files, p); },
      readFileSync: function (p) { if (!Object.prototype.hasOwnProperty.call(files, p)) { var e = new Error('ENOENT: ' + p); e.code = 'ENOENT'; throw e; } return files[p]; },
      writeFileSync: function (p, data) { files[p] = data instanceof Buf ? data.toString('base64') : String(data); },
      renameSync: function (a, b) { files[b] = files[a]; delete files[a]; if (/db\.json$/.test(b)) persist(); },
      unlinkSync: function (p) { delete files[p]; }
    },
    path: { join: function () { return Array.prototype.join.call(arguments, '/').replace(/\/+/g, '/'); }, resolve: function () { return Array.prototype.join.call(arguments, '/').replace(/\/+/g, '/'); } },
    crypto: {
      randomBytes: function (n) { var u = new Uint8Array(n); webCrypto.getRandomValues(u); return new Buf(u); },
      timingSafeEqual: function (a, b) { if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.bytes[i] ^ b.bytes[i]; return d === 0; }
    },
    http: { createServer: function (h) { return { handler: h, listen: function () { return this; }, close: function (cb) { if (cb) cb(); }, address: function () { return { port: 0 }; } }; } },
    zlib: {}
  };
  var PROC = { env: { SIXTOP_ADMIN_KEY: BUILTIN.crypto.randomBytes(16).toString('hex'), SIXTOP_MAIL: 'show', SIXTOP_DEMO: '1', SIXTOP_DATA_DIR: '/data', SIXTOP_AREA: 'Central Square' }, argv: ['node', 'demo'], on: function () {}, exit: function () {} };

  /* ---------- the server's own files ---------- */
  var SRC = {/*MODULES*/};
  var cache = {};
  function load(name) {
    var base = String(name).split('/').pop();
    if (base === 'shared.js') return self.SX;
    if (base === 'push.js') return function () { return { publicKey: '', send: function () { return Promise.resolve({ ok: false }); } }; };
    if (BUILTIN[name]) return BUILTIN[name];
    if (cache[base]) return cache[base].exports;
    var module = { exports: {} }; cache[base] = module;
    SRC[base](module, module.exports, load, '/app/server', PROC, Buf);
    return module.exports;
  }
  var fresh = !files['/data/db.json'];
  if (fresh) { files = {}; seededAt = Date.now(); PROC.argv = ['node', 'seed', '--reset']; try { localStorage.removeItem('sixtopToken'); } catch (e) {} } // fresh sample data: an old sign-in points at nobody
  var S = load('server.js');
  if (fresh) { var log = console.log; console.log = function () {}; try { load('seed.js'); } finally { console.log = log; } }
  persist();

  /* ---------- the app's /api/ calls, answered here ---------- */
  function withPhotos(text) {
    return text.replace(/\/api\/photo\?id=(m[0-9a-f]{8})&t=[0-9a-f]+&v=[^"]*/g, function (all, id) {
      var b = files['/data/photos/' + id + '.img'], m = S.db().members[id];
      return b ? 'data:image/' + ((m && m.photoType) || 'jpeg') + ';base64,' + b : '';
    });
  }
  function memberBy(token) { var ms = S.db().members; for (var id in ms) if (ms[id].token === token && !ms[id].deleted) return ms[id]; return null; }
  // tablemates and friends answer, so the chats feel alive
  var CHAT = ['Ha. Okay, I need to hear more about this.', 'This table is going to be good.', 'Bringing this up at dinner. You’ve been warned.', 'Love it. See you soon.'];
  var DM = ['Yes! Central Square works for me.', 'Ha, same. Coffee next week?', 'Let’s do it. Tuesday after class?'];
  var POPCHAT = ['In! Should I bring anything?', 'See you there. I’ll grab a table if I’m early.', 'Love this topic. I have a story for you.'];
  // when you start a hang, two people who fit it say they're in over the next few seconds
  function popJoiners(me) {
    var D = S.db(), u = Object.values(D.pops).filter(function (x) { return x.host === me.id && !x.cancelled; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; })[0]; if (!u) return;
    var pool = Object.values(D.members).filter(function (m) { return m.id !== me.id && !m.deleted && m.profile && m.profile.done && u.joined.indexOf(m.id) < 0 && (!u.track || (m.profile.tracks || []).indexOf(u.track) >= 0); });
    pool.sort(function (a, b) { return (a.school === me.school ? 1 : 0) - (b.school === me.school ? 1 : 0); });
    [0, 1].forEach(function (k) {
      setTimeout(function () {
        var m = pool[k]; if (!m) return;
        try { S.joinPop(m, { id: u.id }); var g = u.game; if (g && !g.pick && !g.votes[m.id]) S.playGame(m, { pop: u.id, act: 'vote', card: g.cards[k % g.cards.length] }); S.save(true); } catch (e) { return; }
        try { toast('Hang', m.name.split(' ')[0] + ' is in for “' + u.title + '”.'); refresh(); if (cur === 'pop' && A.pop && A.pop.id === u.id) openPopRefresh(); } catch (e) {}
      }, 2500 + k * 4500);
    });
  }
  // tonight's question: after you vote, the last holdouts vote too; after you pick a side, others pick theirs and talk a little
  var SIDE_TALK = ['Team “%s”. I have receipts.', 'Going with “%s” and I will die on this hill.', '“%s”, obviously. See you there.', 'Picked “%s”. Changing my mind is not on the menu.'];
  function gameCrowd(me, b) {
    var D = S.db(), t = b.pop ? D.pops[b.pop] : D.tables[b.table]; if (!t || !t.game) return;
    var ref = function (o) { o[b.pop ? 'pop' : 'table'] = t.id; return o; };
    var g = t.game, seated = (b.pop ? [t.host].concat(t.joined) : t.ids).filter(function (id) { return id !== me.id && !(t.out && t.out[id]); });
    var later = function (k, fn) { setTimeout(function () { try { fn(); S.save(true); } catch (e) {} try { if (cur === 'chat') pollChat(true); refresh(); } catch (e) {} }, 2400 + k * 2600); };
    if (b.act === 'vote' && !g.pick) {
      seated.filter(function (id) { return !g.votes[id]; }).forEach(function (id, k) {
        later(k, function () { if (!g.pick) S.playGame(D.members[id], ref({ act: 'vote', card: k % 2 ? g.cards[(g.cards.indexOf(b.card) + 1) % 3] : b.card })); });
      });
    }
    if (b.act === 'side' && g.pick && !g.revealed && !g.notes.crowd) {
      g.notes.crowd = true;
      var c = SX.card(g.pick), quiet = seated.filter(function (id) { return !g.sides[id]; });
      quiet.slice(0, 3).forEach(function (id, k) {
        later(k, function () {
          var side = (k + id.charCodeAt(1)) % 3 ? 'a' : 'b';
          S.playGame(D.members[id], ref({ act: 'side', side: side }));
          var talk = SIDE_TALK[(n++) % SIDE_TALK.length].replace('%s', c[side]);
          if (k < 2) { if (b.pop) S.postPopChat(D.members[id], { id: t.id, text: talk }); else S.postChat(D.members[id], { table: t.id, text: talk }); }
          if (k === 0) S.playGame(D.members[id], ref({ act: 'guess', n: Math.ceil((seated.length + 1) / 2) }));
        });
      });
    }
  }
  function chairOpens(me) {
    var D = S.db(), s = (D.standby || {})[me.id]; if (!s) return;
    var tables = Object.values(D.tables).filter(function (t) { var e = D.events[t.eventId]; return e && t.published && e.status === 'published' && e.type === s.kind && s.dates.indexOf(e.date) >= 0 && S.eventTimes(e).start > Date.now() + 6 * 36e5; });
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i], others = t.ids.filter(function (id) { return id !== me.id && !(t.out && t.out[id]); });
      for (var j = 0; j < others.length; j++) {
        var o = D.members[others[j]]; if (!o || o.school !== me.school) continue; // someone from the same school leaves, so the mix still holds
        try { S.cancelSeat(o, { event: t.eventId }); } catch (e) { continue; }
        if (!(D.standby || {})[me.id]) { S.save(true); try { toast('Charlie', 'A chair just opened up, and it’s yours. Your new invitation is on Tables.'); refresh(); } catch (e) {} return; }
      }
    }
  }
  var n = 0;
  function after(req, status, body) {
    if (status !== 200 || req.method !== 'POST') return;
    var p = req.url.split('?')[0], b = {}; try { b = JSON.parse(body || '{}'); } catch (e) {}
    var me = memberBy(req.headers['x-sixtop-token']); if (!me) return;
    if (p === '/api/chat') setTimeout(function () {
      var t = S.db().tables[b.table]; if (!t) return;
      var others = t.ids.filter(function (id) { return id !== me.id && !(t.out && t.out[id]); }), o = S.db().members[others[n % Math.max(1, others.length)]];
      if (o) { try { S.postChat(o, { table: t.id, text: CHAT[n++ % CHAT.length] }); S.save(true); } catch (e) {} }
    }, 2200);
    if (p === '/api/game') gameCrowd(me, b);
    if (p === '/api/reinvite') setTimeout(function () { chairOpens(me); }, 7000);
    if (p === '/api/pop') popJoiners(me);
    if (p === '/api/pchat') setTimeout(function () {
      var u = S.db().pops[b.id]; if (!u) return;
      var others = [u.host].concat(u.joined).filter(function (id) { return id !== me.id; }), o = S.db().members[others[n % Math.max(1, others.length)]];
      if (o) { try { S.postPopChat(o, { id: u.id, text: POPCHAT[n++ % POPCHAT.length] }); S.save(true); } catch (e) {} }
    }, 2200);
    if (p === '/api/dm') setTimeout(function () { var o = S.db().members[b.with]; if (o) { try { S.postDm(o, { with: me.id, text: DM[n++ % DM.length] }); S.save(true); } catch (e) {} } }, 2600);
  }
  var realFetch = self.fetch ? self.fetch.bind(self) : null;
  self.fetch = function (input, opt) {
    opt = opt || {};
    var u; try { u = new URL(typeof input === 'string' ? input : input.url, location.href); } catch (e) { return realFetch(input, opt); }
    if (u.pathname.indexOf('/api/') !== 0) return realFetch(input, opt);
    return new Promise(function (resolve) {
      var headers = {}; Object.keys(opt.headers || {}).forEach(function (k) { headers[k.toLowerCase()] = opt.headers[k]; });
      var on = {}, status = 200;
      var req = { method: String(opt.method || 'GET').toUpperCase(), url: u.pathname + u.search, headers: headers, socket: { remoteAddress: 'demo' }, on: function (ev, fn) { on[ev] = fn; return req; }, destroy: function () {} };
      var res = {
        writeHead: function (c) { status = c; },
        end: function (body) { resolve(new Response(withPhotos(body == null ? '' : String(body)), { status: status, headers: { 'Content-Type': 'application/json' } })); after(req, status, opt.body); }
      };
      S.server.handler(req, res);
      setTimeout(function () { if (opt.body != null && on.data) on.data(Buf.from(String(opt.body))); if (on.end) on.end(); }, 0);
    });
  };
  self.addEventListener('storage', function (e) { if (e.key === KEY) location.reload(); });
  self.SIXTOP_DEMO = { S: S, KEY: KEY, fresh: FRESH, faces: load('faces.js') };
})();
