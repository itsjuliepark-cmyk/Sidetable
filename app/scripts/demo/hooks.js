/* Hash Table demo controls: a way in from the start screen, a "Demo" tab to switch people, and two skip-ahead buttons
   (Charlie sets next week's tables, and the morning after) so a whole week fits in a few minutes. */
(function () {
  'use strict';
  var D = self.SIXTOP_DEMO, S = D.S;
  var db = function () { return S.db(); };
  var VENUES = [['Demo Bistro', 'Massachusetts Ave, Central Square'], ['Demo Table House', 'Main St, Kendall Square'], ['Demo Trattoria', 'Prospect St, Central Square'], ['Demo Supper Room', 'Brattle St, Harvard Square']];
  function jordan() { return Object.values(db().members).find(function (m) { return m.name === 'Jordan Park' && !m.deleted; }); }
  function friend() { var j = jordan(); return j && Object.values(db().members).find(function (m) { return m.id !== j.id && !m.deleted && S.isMutual(j.id, m.id); }); }
  function club() { return Object.values(db().clubs)[0]; }
  function me() { return A.view && db().members[A.view.me.id]; }
  function etDate(offsetDays) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offsetDays * 864e5)); }

  D.as = function (who) {
    var m = who === 'jordan' ? jordan() : friend(); if (!m) return;
    if (typeof landSheet === 'function') landSheet(false);
    A.token = m.token; store.set(m.token); A.view = null; A.table = null; A.tableId = null; hist.length = 0; closeSheet(); boot();
  };
  D.join = function () {
    if (typeof landSheet === 'function') landSheet(false);
    var wk = S.targetWeek(), w = db().weeks[wk];
    if (w && w.published) {
      w.events.forEach(function (eid) {
        var e = db().events[eid]; if (!e || S.eventTimes(e).start < Date.now()) return; // a dinner that already happened stays
        Object.values(db().tables).filter(function (t) { return t.eventId === eid; }).forEach(function (t) { delete db().tables[t.id]; delete db().chats[t.id]; delete db().feedback[t.id]; });
        delete db().events[eid]; delete db().seats[eid];
      });
      delete db().weeks[wk];
    }
    // an earlier newcomer's email is freed, so signing up again with the same address really is a new sign-up
    Object.values(db().members).forEach(function (m) { if (!m.deleted && /^club:/.test(m.via || '') && m.email && m.email.indexOf('+demo') < 0) m.email = m.email.replace('@', '+demo' + m.id + '@'); });
    S.save(true);
    D.newcomer = true;
    store.clear(); A.token = ''; A.view = null; hist.length = 0; closeSheet(); openJoin(club().code); };
  // Charlie sets next week's tables (the person asking is seated first), a few tablemates vote and say hi, venues go in
  function setWeek(m, wk) {
    m.prio = 9; S.matchWeek({ week: wk }); S.publishWeek({ week: wk });
    ensureTech(m, wk);
    Object.values(db().tables).filter(function (t) { var e = db().events[t.eventId]; return e && e.week === wk && t.ids.indexOf(m.id) >= 0; }).forEach(function (t, j) {
      var others = t.ids.filter(function (id) { return id !== m.id; });
      if (t.game) others.slice(0, 3).forEach(function (id, k) { try { S.playGame(db().members[id], { table: t.id, act: 'vote', card: t.game.cards[[0, 1, 0][k]] }); } catch (e) {} });
      try { S.postChat(db().members[others[others.length - 1]], { table: t.id, text: ['Hi all! First one for me too, can’t wait.', 'Hello! I already have opinions about the question.'][j % 2] }); } catch (e) {}
    });
    // the other captains book their tables right away; yours waits for you if you're captain
    db().weeks[wk].events.forEach(function (eid) { Object.values(db().tables).filter(function (t) { return t.eventId === eid && !t.venue && t.captain && t.captain !== m.id; }).forEach(function (t, k) { var o = S.spotOptions(t).filter(function (x) { return x.kind === 'book'; }), c = db().members[t.captain]; if (o.length && c) try { S.captainBook(c, { table: t.id, place: o[k % o.length].id, time: db().events[t.eventId].time, name: c.name }); } catch (e) {} }); }); // partners place tables; this only fills a gap
    S.save(true);
  }
  // the demo is about tech tables: someone who asked for them always gets at least one, swapped in for a social one
  function ensureTech(m, wk) {
    if (((m.profile || {}).mix || 'both') === 'social') return;
    var inWeek = function (t) { var e = db().events[t.eventId]; return e && e.week === wk && t.published; };
    var mine = Object.values(db().tables).filter(function (t) { return inWeek(t) && t.ids.indexOf(m.id) >= 0 && !(t.out && t.out[m.id]); });
    if (mine.some(function (t) { return db().events[t.eventId].type === 'topic'; })) return;
    var nights = mine.map(function (t) { return db().events[t.eventId].date; }), drop = mine[mine.length - 1];
    var open = Object.values(db().tables).filter(function (t) { var e = db().events[t.eventId]; return inWeek(t) && e.type === 'topic' && t.ids.length < 6 && (nights.indexOf(e.date) < 0 || (drop && db().events[drop.eventId].date === e.date)); })
      .sort(function (a, b) { var tr = (m.profile.tracks || []); return (tr.indexOf(b.track) >= 0) - (tr.indexOf(a.track) >= 0) || a.ids.length - b.ids.length; })[0];
    if (!open) return;
    if (drop && mine.length >= 2) { drop.ids = drop.ids.filter(function (id) { return id !== m.id; }); if (db().seats[drop.eventId]) delete db().seats[drop.eventId][m.id]; }
    var e = db().events[open.eventId]; open.ids.push(m.id); (db().seats[e.id] = db().seats[e.id] || {})[m.id] = { at: new Date().toISOString(), size: 'either', diet: [], status: 'held' };
  }
  // a new member lands on Tables with two sealed invitations, no evening-picking first (every evening offered, two dinners at most)
  var welcomed = {};
  function firstInvites() {
    var m = me(); if (!m || !D.newcomer || welcomed[m.id] || !(m.profile && m.profile.done)) return false;
    welcomed[m.id] = true; D.newcomer = false;
    if (A.view.tables.some(function (t) { return t.phase !== 'past' && !t.left; })) return false;
    var wk = S.targetWeek(), w = db().weeks[wk]; if (w && w.published) return false;
    m.avail = { week: wk, slots: [0, 1, 2, 3, 4].map(function (d) { return S.addDays(wk, d) + '|dinner'; }), max: 2, at: new Date().toISOString() };
    return function () { setWeek(m, wk); };
  }
  D.ff = function (kind) {
    var m = me(); closeSheet();
    if (!m) { toast('Demo', 'Pick who to be first.'); return; }
    var evs = Object.values(db().events);
    if (kind === 'set') {
      var wk = S.targetWeek(), w = db().weeks[wk];
      var already = !!(w && w.published);
      if (!already && !(m.avail && m.avail.week === wk && m.avail.slots.length)) { toast('Demo', 'Pick your evenings on Tables first.'); return; }
      if (!already) toast('Charlie', 'Setting next week’s tables. One moment.');
      setTimeout(function () { if (!already) setWeek(m, wk); refresh().then(function () {
        var mine = A.view.tables.filter(function (t) { var e = db().events[t.eventId]; return e && e.week === wk && !t.left; });
        if (!mine.length) { toast('Charlie', already ? 'Next week’s tables are already set, and you’re not at one. Join a hang this week, or pick evenings the week after.' : m.paused ? 'Your tables are paused. Turn that off in Me to get invitations.' : 'No table fit your evenings next week. Join a hang, or pick more evenings next time.'); tab('home'); return; }
        toast('Charlie', mine.length > 1 ? 'I sent you ' + (NUMW[mine.length] || mine.length) + ' private invitations for next week.' : 'I sent you a private invitation for next week.');
        hist.length = 0; go('home', { noHist: true }); var first = mine.sort(function (a, b) { return (a.type === 'kindred') - (b.type === 'kindred') || (a.start < b.start ? -1 : 1); })[0]; if (first && !first.opened) setTimeout(function () { openInvite(first.id); }, 900);
      }); }, already ? 0 : 120);
      return;
    }
    var target = evs.filter(function (e) { return e.status === 'published' && S.eventTimes(e).start > Date.now() && Object.values(db().tables).some(function (t) { return t.eventId === e.id && t.ids.indexOf(m.id) >= 0 && !(t.out && t.out[m.id]); }); })
      .sort(function (a, b) { return S.eventTimes(a).start - S.eventTimes(b).start; })[0];
    if (!target) { toast('Demo', 'No upcoming dinner. Plan your week, then tap “Charlie sends next week’s invitations” first.'); return; }
    target.date = etDate(-1);
    if (target.week && db().weeks[target.week]) db().weeks[target.week].events = db().weeks[target.week].events.filter(function (x) { return x !== target.id; });
    delete target.week;
    // tonight's question played out: the vote closed, everyone had a side, the split came out at dinner, two minds changed
    Object.values(db().tables).filter(function (t) { return t.eventId === target.id && t.game; }).forEach(function (t) {
      var g = t.game, ids = t.ids.filter(function (id) { return !(t.out && t.out[id]); });
      // close the vote as of an hour before dinner, give everyone a side, then let dinner time open the split
      g.voteBy = 0; S.advanceGame(t, S.eventTimes(target).start - 36e5);
      ids.forEach(function (id, i) { if (!g.sides[id] && id !== m.id) g.sides[id] = i % 3 ? 'a' : 'b'; if (g.guess[id] == null && i % 2 && id !== m.id) g.guess[id] = 2 + (i % 3); });
      S.advanceGame(t, S.eventTimes(target).start + 6e4);
      ids.filter(function (id) { return id !== m.id; }).forEach(function (id, i) { g.final[id] = i === 1 ? (g.sides[id] === 'a' ? 'b' : 'a') : g.sides[id]; });
    });
    // the others send their picks: about half of them pick you, all but one of the yeses round two needs are in (yours books it),
    // and a few leave a line for their next table
    var LINES = ['ship the onboarding flow', 'ask my advisor about a semester off', 'try the climbing gym on Prospect St'];
    Object.values(db().tables).filter(function (t) { return t.eventId === target.id; }).forEach(function (t) {
      var seated = t.ids.filter(function (id) { return !(t.out && t.out[id]); }), need = Math.max(3, Math.ceil(seated.length * 0.6)), mine = seated.indexOf(m.id) >= 0, yes = 0;
      seated.forEach(function (id, i) {
        if (id === m.id) return;
        var picks = seated.filter(function (x, k) { return x !== id && (x === m.id ? i % 2 === 0 : (k + i) % 3 === 0); });
        var again = yes < (mine ? need - 1 : need - 2); if (again) yes++;
        try { S.feedback(db().members[id], { table: t.id, attended: true, rating: 4 + (i % 2), picks: picks, again: again, next: LINES[i], salute: t.captain === m.id && i % 3 !== 2 }); } catch (e) {}
      });
    });
    S.save(true);
    toast('Charlie', 'Good morning. How was the table?');
    refresh().then(function () { var t = A.view.tables.find(function (x) { return x.eventId === target.id && !x.left; }); if (t) openAfter(t.id); else tab('home'); });
  };
  // behind the scenes: what a partner restaurant sees, a restaurant that can't host, and a table that loses most of its people
  function nextTable(m) {
    var now = Date.now();
    return Object.values(db().tables).filter(function (t) { var e = db().events[t.eventId]; return e && t.published && !t.closed && e.status === 'published' && t.ids.indexOf(m.id) >= 0 && !(t.out && t.out[m.id]) && S.eventTimes(e).start > now; })
      .sort(function (a, b) { return S.eventTimes(db().events[a.eventId]).start - S.eventTimes(db().events[b.eventId]).start; })[0];
  }
  var PLACE = null;
  var PSTATE = { held: 'Held for Hash Table', asked: 'Waiting for their yes', confirmed: 'Confirmed', declined: 'Can’t host', released: 'Not needed after all' };
  function drawPlace(v) {
    var diets = function (d) { return Object.keys(d || {}).map(function (k) { return d[k] + ' ' + k.toLowerCase(); }).join(', '); };
    $('sheet').innerHTML = '<div class="grab"></div><h3>' + esc(v.name) + '</h3><div class="sub2" style="line-height:1.5">This is the restaurant’s private page. No login, no names: sizes, times, dietary notes and the captain’s first name. ' + (v.mode === 'ask' ? 'They confirm each evening.' : 'Their tables are held for Hash Table, so there’s nothing to do unless an evening can’t work.') + ' They get this week’s plan on Sunday night and the final count at noon the day before.</div>'
      + (v.evenings.length ? v.evenings.map(function (e) {
        var act = !e.started && e.state === 'asked' ? '<button class="btn sm" data-pl="' + e.date + '|1">Confirm</button>' : '';
        if (!e.started && (e.state === 'held' || e.state === 'asked' || e.state === 'confirmed')) act += '<button class="btn sm ghost" data-pl="' + e.date + '|0">We can’t host this one</button>';
        return '<div class="cardg" style="margin-top:10px"><div class="row" style="justify-content:space-between;align-items:baseline"><b>' + esc(e.label) + '</b><span class="sub2">' + PSTATE[e.state] + '</span></div>'
          + e.tables.map(function (t, i) { return '<div class="sub2" style="margin-top:4px">Table ' + (i + 1) + ': ' + t.size + ' people at ' + esc(t.time) + (diets(t.diets) ? ' (' + esc(diets(t.diets)) + ')' : '') + (t.captain ? ', ask for ' + esc(t.captain) : '') + '</div>'; }).join('')
          + (act ? '<div class="row" style="gap:8px;margin-top:10px">' + act + '</div>' : '') + '</div>';
      }).join('') : '<div class="cardg empty" style="margin-top:10px">Nothing on the books for the next three weeks.</div>');
    $('sheetBg').classList.add('on'); $('sheet').classList.add('on');
  }
  D.place = function () {
    var m = me(), t = m && nextTable(m), v = (t && t.venue && t.venue.id && db().places[t.venue.id]) || Object.values(db().places || {})[0];
    if (!v) { toast('Demo', 'No partner restaurants in this demo yet.'); return; }
    PLACE = v; fetch('/api/place?k=' + v.key).then(function (r) { return r.json(); }).then(drawPlace).catch(function () {});
  };
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-pl]'); if (!b || !PLACE) return;
    var q = b.dataset.pl.split('|');
    if (q[1] === '0' && !b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again: we can’t host'; return; }
    fetch('/api/place', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: PLACE.key, date: q[0], ok: q[1] === '1' }) }).then(function (r) { return r.json(); }).then(function (v) {
      drawPlace(v); refresh();
      toast(PLACE.name, q[1] === '1' ? 'Confirmed. The address goes out at noon on the day.' : 'Got it. Charlie is moving those tables to another partner with room.');
    }).catch(function () {});
  });
  D.cantHost = function () {
    var m = me(), t = m && nextTable(m); closeSheet();
    if (!t || !t.venue || !t.venue.id) { toast('Demo', 'No upcoming table at a partner restaurant. Get your invitations first.'); return; }
    var e = db().events[t.eventId], v = db().places[t.venue.id], was = v.name;
    try { S.placeAnswer(v, e.date, false, 'demo'); } catch (er) { toast('Demo', er.message); return; }
    S.save(true);
    var day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(new Date(S.eventTimes(e).start));
    toast(was, t.venue ? 'Can’t host ' + day + '. Charlie moved your table to ' + t.venue.name + ' before anyone saw the address. Nothing changes for you.' : 'Can’t host ' + day + ', and no partner has room. Whoever is on duty gets an alert to find a spot or call it off.');
    refresh().then(function () { openTable(t.id); });
  };
  // try the captain's missions on your next dinner
  D.captain = function () {
    var m = me(), t = m && nextTable(m); closeSheet();
    if (!t) { toast('Demo', 'No upcoming table. Get your invitations first.'); return; }
    t.captain = m.id; m.captainAt = new Date().toISOString(); if (t.cap) { t.cap.briefed = m.id; delete t.cap.booking; t.cap.spot = null; }
    if (t.venue && t.venue.pid) t.venue = null;
    S.save(true);
    refresh().then(function () { openTable(t.id); });
  };
  D.dropOuts = function () {
    var m = me(), t = m && nextTable(m); closeSheet();
    if (!t) { toast('Demo', 'No upcoming table. Get your invitations first.'); return; }
    var e = db().events[t.eventId], others = t.ids.filter(function (id) { return id !== m.id && !(t.out && t.out[id]); });
    others.slice(0, Math.max(0, others.length - 1)).forEach(function (id) { try { S.cancelSeat(db().members[id], { event: e.id }); } catch (er) {} });
    S.save(true);
    refresh().then(function () {
      var mine = A.view.tables.find(function (x) { return x.eventId === e.id && !x.left; });
      if (mine && mine.id !== t.id) { toast('Charlie', 'Most of your table had to cancel, so I moved you to table ' + mine.no + ', same evening. Your new invitation is on Tables.'); tab('home'); }
      else if (!mine) { toast('Charlie', 'Most of your table had to cancel and no other table had room, so this one is off. You’re first in line next week.'); tab('home'); }
      else { toast('Charlie', 'Most of your table had to cancel. You’re ' + (NUMW[mine.size] || mine.size) + ' now.'); openTable(mine.id); }
    });
  };
  D.reset = function (b) {
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to start over with fresh sample data'; return; }
    try { localStorage.removeItem(D.KEY); localStorage.removeItem('sixtopToken'); } catch (e) {}
    location.reload();
  };
  D.menu = function () {
    var f = friend(), who = me();
    $('sheet').innerHTML = '<div class="grab"></div><h3>Demo</h3><div class="sub2" style="line-height:1.5">The real Hash Table app, with 40 sample members. It runs on this phone only, and nothing is sent anywhere.' + (who ? ' You’re ' + esc(who.name) + '.' : '') + '</div>'
      + (D.fresh ? (who ? '' : '<button class="opt plain" onclick="SIXTOP_DEMO.join()">Join as someone new<small>Through a club link, the whole sign-up, then your first invitations</small></button>')
      : '<div class="label">Be someone</div>'
      + '<button class="opt plain" onclick="SIXTOP_DEMO.as(\'jordan\')">Jordan Park, Harvard<small>Two sealed invitations, round two with last week’s table, and two friends</small></button>'
      + (f ? '<button class="opt plain" onclick="SIXTOP_DEMO.as(\'friend\')">' + esc(f.name) + ', ' + (f.school === 'mit' ? 'MIT' : 'Harvard') + '<small>Picked Jordan after their last dinner</small></button>' : '')
      + '<button class="opt plain" onclick="SIXTOP_DEMO.join()">Someone new<small>Join through a club link and do the whole sign-up</small></button>')
      + '<div class="label">Behind the scenes</div>'
      + '<button class="opt plain" onclick="SIXTOP_DEMO.captain()">Make me captain of my next dinner<small>Book the spot, rally the vote, settle up, and earn a stripe</small></button>'
      + '<button class="opt plain" onclick="SIXTOP_DEMO.dropOuts()">Most of my next table cancels<small>The people left join another table that night, or it’s called off</small></button>'
      + '<div class="label">Skip ahead</div>'
      + '<button class="opt plain" onclick="SIXTOP_DEMO.ff(\'set\')">Charlie sends next week’s invitations<small>From everyone’s evenings, half tech and half social</small></button>'
      + '<button class="opt plain" onclick="SIXTOP_DEMO.ff(\'after\')">My next dinner happened<small>Jump to the next morning and send your picks</small></button>'
      + '<button class="link" onclick="SIXTOP_DEMO.reset(this)">Start the demo over</button>';
    $('sheetBg').classList.add('on'); $('sheet').classList.add('on');
  };

  var baseStart = renderStart;
  // on the film, Join opens the demo's ways in: be Jordan, or sign up as someone new
  renderStart = function (msg) {
    baseStart(msg);
    if (D.fresh) { $('lSign').style.display = 'none'; $('lJoin').textContent = 'Start'; } // nobody to sign in as yet
    $('startBox').innerHTML = D.fresh
      ? '<div class="ls-note">A working demo: you’re new here. Sign up the way a real member would, meet Charlie, and get your first invitations. It runs on your phone only, and nothing is sent anywhere.</div><button class="btn" onclick="SIXTOP_DEMO.join()">Start as someone new</button>'
      : '<div class="ls-note">This is a working demo with 40 sample members. It runs on your phone only, and nothing is sent anywhere.</div>'
      + '<button class="btn" onclick="SIXTOP_DEMO.as(\'jordan\')">Try it as Jordan</button><button class="btn ghost" onclick="SIXTOP_DEMO.join()">Join as someone new</button>';
  };
  if (cur === 'start') renderStart();
  // the demo skips the school email code: the code fills itself in and you go straight on
  var baseVerify = renderVerify;
  renderVerify = function () {
    var V = A.ver; if (!V) return;
    if (V.step === 'code' && V.devCode) {
      V.code = V.devCode;
      $('verifyBody').innerHTML = '<div class="spin"></div><div class="err" id="vErr"></div>'; $('vGo').disabled = true;
      setTimeout(checkVerify, 250); return;
    }
    baseVerify();
    if (V.step === 'email') {
      $('vGo').textContent = 'Continue';
      var sub = document.querySelector('#verifyBody .sub'); if (sub) sub.textContent = V.mode === 'signin' ? 'This is a demo, so no code is needed. Use the email you signed up with in this demo.' : 'This is a demo, so no code is needed. Use any Harvard or MIT address.';
    }
  };
  RENDER.verify = renderVerify;
  // a new member's first tech table is days away in real life; in the demo, Sunday night is one tap
  var baseHome = renderHome;
  renderHome = function () {
    var build = firstInvites();
    if (build) {
      baseHome(); toast('Charlie', 'Setting your first tables. One moment.');
      setTimeout(function () { build(); refresh().then(function () { if (cur !== 'home') return; renderHome(); var n = A.view.tables.filter(function (t) { return t.phase !== 'past' && !t.left; }).length; toast('Charlie', n > 1 ? 'Your first ' + (NUMW[n] || n) + ' invitations are here. Tap one to open it.' : n ? 'Your first invitation is here. Tap it to open it.' : 'No table fit next week yet. Pick your evenings and I’ll keep looking.'); }); }, 120);
      return;
    }
    baseHome();
    var c = document.querySelector('#homeBody .firsttable');
    if (c) c.insertAdjacentHTML('beforeend', '<button class="link" style="margin:10px 0 0" onclick="SIXTOP_DEMO.ff(\'set\')">Demo: skip to Sunday night and get my invitations</button>');
  };
  RENDER.home = renderHome;
  var autoT = null;
  function autoSet() {
    clearTimeout(autoT);
    var a = A.view && A.view.avail; if (!a || !a.open || a.set || !a.count || a.count < (a.max || 1)) return;
    autoT = setTimeout(function () {
      var m = me(), wk = S.targetWeek(); if (!m || cur !== 'home') return;
      if (!(m.avail && m.avail.week === wk && m.avail.slots.length >= (m.avail.max || 1))) return;
      toast('Charlie', 'Got your evenings. In real life your invitation comes Sunday night. In the demo, it’s coming now.');
      autoT = setTimeout(function () { var a2 = A.view && A.view.avail; if (cur === 'home' && a2 && a2.count >= (a2.max || 1)) D.ff('set'); }, 1700);
    }, 1400);
  }
  var baseToggle = toggleSlot; toggleSlot = function (id) { baseToggle(id); autoSet(); };
  var baseMax = setMax; setMax = function (k) { baseMax(k); autoSet(); };
  // the card step needs a real photo; in the demo you can borrow one of the sample faces instead of uploading yours
  var baseCard = renderCard;
  renderCard = function () {
    baseCard();
    if (!document.getElementById('demoFace')) $('photoHint').insertAdjacentHTML('afterend', '<div style="text-align:center"><button class="link" id="demoFace" style="margin-top:0" onclick="SIXTOP_DEMO.face()">Demo: use a sample face instead</button></div>');
  };
  RENDER.card = renderCard;
  D.face = function () { var F = D.faces; A.P.photo = 'data:image/jpeg;base64,' + F[Math.floor(Math.random() * F.length)]; renderCard(); };
  enablePush = function () { toast('Notifications', 'They work in the real app. This demo runs on your phone only.'); };
  var btn = document.createElement('button');
  btn.className = 'demobtn'; btn.type = 'button'; btn.textContent = 'Demo'; btn.setAttribute('aria-label', 'Demo controls'); btn.onclick = D.menu;
  $('phone').appendChild(btn);
})();
