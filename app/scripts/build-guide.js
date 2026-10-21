// The captains' spot guide: one page with every restaurant on the list, a drawn map (OpenStreetMap shapes from
// scripts/guide/map.json, no tiles), the same travel times and fit score as the app, and booking links that open with the
// night, time and party filled in. Writes dist/spot-guide.html and demo/spot-guide.html.
//   node scripts/build-guide.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const R = require('../server/restaurants.js'), CHECKS = require('../server/spotchecks.js'), TRIP = require('../server/trip.js'), SX = require('../public/shared.js');
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'guide', 'map.json'), 'utf8'));
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SHORT = { hsq: 'Harvard Square', hbs: 'HBS', mit: 'MIT', central: 'Central', inman: 'Inman', porter: 'Porter', eastcam: 'East Cambridge', allston: 'Lower Allston', backbay: 'Back Bay', fenway: 'Fenway', longwood: 'Longwood' };
const ids = new Set();
const places = R.map((r) => {
  let id = slug(r.name); while (ids.has(id)) id += '-2'; ids.add(id);
  if (!isFinite(r.lat) || !isFinite(r.lng)) throw new Error('no map pin for ' + r.name);
  return { id, name: r.name, area: r.area, address: r.address, lat: r.lat, lng: r.lng, cuisine: r.cuisine, price: r.price || '', bookVia: r.bookVia, bookUrl: r.bookUrl || '', phone: r.phone || '',
    six: r.six, maxOnline: r.maxOnline || 0, closed: r.closed || [], hours: r.hours || '', fee: r.fee || '', vibe: r.vibe || '', noise: r.noise, talk: r.talk, seat: r.seat || '', sound: r.sound || '',
    sixTables: r.sixTables || 'some', privateRoom: !!r.privateRoom, privateNote: r.privateNote || '', weekday: r.weekday || 'some', weekend: r.weekend || 'some', fit: r.fit || 3,
    check: String(r.check || '').slice(0, 320), sources: (r.sources && r.sources.length ? r.sources : [r.source]).filter(Boolean).slice(0, 4) };
});
const stop = (line, i) => { const L = TRIP.LINES.find((x) => x.id === line); return { lat: L.stops[i][0], lng: L.stops[i][1] }; };
const stations = [['Porter', 'red', 0], ['Harvard', 'red', 1], ['Central', 'red', 2], ['Kendall/MIT', 'red', 3], ['Charles/MGH', 'red', 4], ['Park Street', 'red', 5], ['Arlington', 'green', 2], ['Copley', 'green', 3], ['Hynes', 'green', 4], ['Kenmore', 'green', 5],
  ['BU Central', 'greenb', 3], ['Harvard Ave', 'greenb', 7], ['Fenway', 'greend', 1], ['Longwood', 'greend', 2], ['Longwood Medical', 'greene', 5], ['Lechmere', 'greenn', 0], ['Science Park', 'greenn', 1]]
  .map(([name, line, i]) => Object.assign({ name }, stop(line, i)));
const labels = [
  ['Harvard Square', 42.3760, -71.1225, 'big'], ['Porter Square', 42.3905, -71.1225, 'big'], ['Central Square', 42.3675, -71.1000, 'big'], ['Kendall Square', 42.3648, -71.0835, 'big'], ['Inman Square', 42.3765, -71.0985, 'big'],
  ['Allston', 42.3555, -71.1300, 'big'], ['Brighton', 42.3470, -71.1545, 'big'], ['Back Bay', 42.3505, -71.0760, 'big'], ['Fenway', 42.3445, -71.1000, 'big'], ['East Cambridge', 42.3712, -71.0805, 'big'],
  ['Cambridgeport', 42.3585, -71.1085, ''], ['Kenmore', 42.3505, -71.0975, ''], ['Longwood', 42.3375, -71.1065, ''], ['Huron Village', 42.3815, -71.1365, ''],
  ['HBS', 42.3660, -71.1225, ''], ['Harvard Yard', 42.3745, -71.1170, ''], ['MIT', 42.3585, -71.0950, ''], ['Boston University', 42.3505, -71.1080, ''],
  ['Charles River', 42.3555, -71.1090, 'river'], ['Charles River', 42.3685, -71.1260, 'river']].map(([t, lat, lng, k]) => ({ t, lat, lng, k }));
const data = {
  researched: 'October 2026', places, map: MAP, stations, labels,
  lines: TRIP.LINES.map((L) => ({ id: L.id, name: L.name, speed: L.speed, wait: L.wait, stops: L.stops })),
  from: SX.FROM.map((f) => ({ id: f.id, t: f.t, short: SHORT[f.id] || f.t, lat: f.lat, lng: f.lng })),
  cuisines: SX.CUISINES, food: SX.FOOD, checks: CHECKS.map((c) => ({ date: c.date, size: c.size, time: c.time || '19:00', at: c.at, seen: c.seen })),
};
const tpl = fs.readFileSync(path.join(__dirname, 'guide', 'template.html'), 'utf8');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const html = tpl.replace('/*DATA*/', () => json);
if (/<\/script/i.test(json)) throw new Error('data contains a closing script tag');
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'spot-guide.html'), html);
fs.writeFileSync(path.join(ROOT, '..', 'demo', 'spot-guide.html'), html);
console.log('dist/spot-guide.html ' + Math.round(html.length / 1024) + ' KB, ' + places.length + ' places');
