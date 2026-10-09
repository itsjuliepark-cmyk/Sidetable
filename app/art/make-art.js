// Paints the soft, photo-like scenes the app uses, as SVG: the Charles in morning fog, Boston at night (the opening), a candlelit table at dusk,
// coffee and sketches on a cafe table, and two friends on a foggy river path. art/render.ps1 turns them into JPEGs.
//   node art/make-art.js
'use strict';
const fs = require('fs');
const path = require('path');

const W = 900, H = 1000;
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const between = (a, b) => a + (b - a) * rnd();
const pick = (a) => a[Math.floor(rnd() * a.length)];
const f = (n) => Math.round(n * 10) / 10;

// shared: blur filters, film grain, a soft vignette
const DEFS = `
  <filter id="b1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1"/></filter>
  <filter id="b2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
  <filter id="b4" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="b8" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="b16" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="b30" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="30"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer></filter>
  <radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#1C2430" stop-opacity="0"/><stop offset="1" stop-color="#1C2430" stop-opacity=".16"/></radialGradient>`;
const FINISH = `<rect width="${W}" height="${H}" fill="url(#vig)"/><rect width="${W}" height="${H}" filter="url(#grain)" opacity=".2"/>`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${DEFS}${defs}</defs>${body}${FINISH}</svg>`;

/* ---------- 1. The Charles at dawn: far bank, an arched bridge, still water, one rower ---------- */
function river() {
  seed = 11;
  const BANK = 512, WATER = 590;
  let skyline = '';
  for (let x = -10; x < W + 10;) {
    const w = between(16, 54), far = x > 330;
    let h = far ? between(18, 86) : between(8, 34);
    skyline += `<rect x="${f(x)}" y="${f(BANK - h)}" width="${f(w + 1)}" height="${f(h + 4)}"/>`;
    x += w;
  }
  // a few towers, the way the Back Bay rises out of the haze
  [[468, 34, 150, 30], [562, 30, 214, 0], [606, 42, 168, 0], [700, 26, 120, 0], [380, 24, 96, 0]].forEach(([x, w, h, mast]) => {
    skyline += `<rect x="${x}" y="${BANK - h}" width="${w}" height="${h + 4}"/>`;
    if (mast) skyline += `<rect x="${x + w / 2 - 1.5}" y="${BANK - h - mast}" width="3" height="${mast}"/>`;
  });
  let trees = '';
  for (let x = -20; x < W + 20; x += between(10, 22)) { const r = between(8, 21); trees += `<circle cx="${f(x)}" cy="${f(BANK + 6 - r * 0.55)}" r="${f(r)}"/>`; }
  // the bridge: a deck on piers, arches cut out with a mask, little lamps on top
  let arches = '', lamps = '', towers = '';
  for (let i = 0; i < 9; i++) { const cx = -30 + i * 120; arches += `<ellipse cx="${cx}" cy="${WATER}" rx="50" ry="29" fill="#000"/>`; }
  for (let x = 20; x < W; x += 58) lamps += `<circle cx="${x}" cy="${WATER - 46}" r="2.2"/>`;
  [318, 372, 528, 582].forEach((x) => { towers += `<path d="M${x} ${WATER - 40} v-18 q0 -9 8 -9 q8 0 8 9 v18 z"/>`; });
  const bridge = `<g><rect x="-20" y="${WATER - 40}" width="${W + 40}" height="40" mask="url(#arch)"/>${towers}<rect x="-20" y="${WATER - 44}" width="${W + 40}" height="4"/></g>`;
  // water: shimmer gets longer and stronger as it comes closer
  let shimmer = '';
  for (let i = 0; i < 190; i++) {
    const t = Math.pow(rnd(), 1.5), y = WATER + 6 + t * (H - WATER), len = 12 + t * 170 * between(0.4, 1), x = between(-40, W);
    const light = rnd() < 0.78;
    shimmer += `<rect x="${f(x)}" y="${f(y)}" width="${f(len)}" height="${f(0.7 + t * 2.2)}" rx="1" fill="${light ? '#FFFFFF' : '#8E9DAB'}" opacity="${f(light ? between(0.12, 0.42) : between(0.08, 0.2) * 10) / 10}"/>`;
  }
  // out-of-focus branches in the top-left corner, as if shot from under a tree on the bank
  const branches = [
    'M-30 -20 C 60 40, 120 70, 230 92', 'M40 30 C 70 80, 80 120, 70 190', 'M110 60 C 150 90, 200 100, 290 70', 'M150 78 C 170 120, 196 150, 250 168',
    'M-20 120 C 30 130, 60 150, 90 210', 'M200 96 C 230 110, 250 140, 260 200'
  ].map((d, i) => `<path d="${d}" stroke-width="${[11, 6, 5, 3.5, 6, 3][i]}"/>`).join('');
  let twigs = '';
  for (let i = 0; i < 26; i++) { const x = between(20, 300), y = between(10, 200); twigs += `<path d="M${f(x)} ${f(y)} q ${f(between(-20, 30))} ${f(between(10, 40))} ${f(between(-10, 50))} ${f(between(20, 60))}" stroke-width="${f(between(1, 2.4))}"/>`; }
  // a rower, far off
  const rower = `<g transform="translate(260 690) scale(.8)" filter="url(#b1)"><path d="M0 0 L104 -3" stroke="#56636F" stroke-width="3.2" stroke-linecap="round"/><path d="M40 -2 q4 -16 10 -18 q6 2 6 14" fill="#56636F"/><circle cx="51" cy="-24" r="4.6" fill="#56636F"/>
    <path d="M50 -9 L18 10 M52 -9 L84 12" stroke="#56636F" stroke-width="1.6"/><path d="M104 -2 C 150 2, 200 8, 260 16 M104 1 C 150 10, 196 22, 250 36" stroke="#FFFFFF" stroke-width="1.3" fill="none" opacity=".6"/>
    <path d="M0 6 L104 3" stroke="#56636F" stroke-width="3" opacity=".22" filter="url(#b2)"/></g>`;
  const defs = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B4C3D1"/><stop offset=".28" stop-color="#CCD6DF"/><stop offset=".46" stop-color="#E4DEDF"/><stop offset=".53" stop-color="#F1E5E1"/><stop offset=".6" stop-color="#ECE5E3"/><stop offset="1" stop-color="#C9D3DB"/></linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ECE3E0"/><stop offset=".25" stop-color="#DCE0E4"/><stop offset="1" stop-color="#B8C5D0"/></linearGradient>
    <radialGradient id="sun" cx="590" cy="455" r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFF6EA" stop-opacity=".95"/><stop offset=".22" stop-color="#FBE2D2" stop-opacity=".6"/><stop offset="1" stop-color="#F7DDD3" stop-opacity="0"/></radialGradient>
    <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="arch"><rect x="-20" y="0" width="${W + 40}" height="${H}" fill="#fff"/>${arches}</mask>
    <clipPath id="below"><rect x="0" y="${WATER}" width="${W}" height="${H - WATER}"/></clipPath>
    <clipPath id="belowBank"><rect x="0" y="${BANK}" width="${W}" height="${WATER - BANK}"/></clipPath>`;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <rect width="${W}" height="${H}" fill="url(#sun)"/>
    <circle cx="590" cy="452" r="24" fill="#FFF9F1" opacity=".85" filter="url(#b8)"/>
    <path d="M150 210 l7 4 l7 -4 M182 188 l5 3 l5 -3" stroke="#6F7C88" stroke-width="1.4" fill="none" opacity=".45"/>
    <g fill="#A9B5C1" opacity=".42" filter="url(#b4)">${skyline}</g>
    <g fill="#A1AAAF" opacity=".5" filter="url(#b4)">${trees}</g>
    <rect x="0" y="${BANK}" width="${W}" height="${H - BANK}" fill="url(#water)"/>
    <g clip-path="url(#belowBank)"><g transform="translate(0 ${BANK * 2 + 4}) scale(1 -1)" opacity=".18" filter="url(#b4)"><g fill="#9AA6B1">${skyline}${trees}</g></g></g>
    <rect x="0" y="420" width="${W}" height="170" fill="url(#fog)" filter="url(#b16)"/>
    <ellipse cx="590" cy="700" rx="70" ry="190" fill="#FFF4EA" opacity=".45" filter="url(#b16)"/>
    <g fill="#8B9AA8" opacity=".72" filter="url(#b2)">${bridge}</g>
    <g fill="#FFE6C4" opacity=".9" filter="url(#b1)">${lamps}</g>
    <g clip-path="url(#below)"><g transform="translate(0 ${WATER * 2}) scale(1 -1)" opacity=".24" filter="url(#b4)"><g fill="#7F8F9E">${bridge}</g></g></g>
    <g filter="url(#b1)">${shimmer}</g>
    <rect x="0" y="560" width="${W}" height="120" fill="url(#fog)" opacity=".7" filter="url(#b16)"/>
    ${rower}
    <g stroke="#4C5660" fill="none" stroke-linecap="round" opacity=".5" filter="url(#b4)">${branches}${twigs}</g>`;
  return svg(defs, body);
}

/* ---------- 2. Dusk: a table set for friends, candles lit, the city soft in the window ---------- */
function dusk() {
  seed = 23;
  const TABLE = 610;
  let bokeh = '', bokehBig = '';
  const COL = ['#FFD9A6', '#FFC892', '#F8E7C8', '#DCE6F1', '#F4BDB4', '#FFE9C9'];
  for (let i = 0; i < 70; i++) {
    const r = between(5, 18), x = between(-10, W + 10), y = between(170, TABLE - 40) - (rnd() < 0.3 ? 60 : 0);
    bokeh += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${pick(COL)}" opacity="${f(between(0.3, 0.75) * 10) / 10}"/>`;
  }
  for (let i = 0; i < 16; i++) {
    const r = between(26, 46), x = between(-20, W + 20), y = between(230, TABLE - 60);
    bokehBig += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${pick(COL)}" opacity="${f(between(0.18, 0.4) * 10) / 10}"/>`;
  }
  const candle = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="40" rx="150" ry="34" fill="#FFCF94" opacity=".35" filter="url(#b16)"/>
      <circle cx="0" cy="-16" r="120" fill="url(#glow)"/>
      <rect x="-19" y="-6" width="38" height="46" rx="7" fill="#FFF3E2" opacity=".55"/>
      <rect x="-19" y="-6" width="38" height="46" rx="7" fill="none" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="1.4"/>
      <ellipse cx="0" cy="-16" rx="6" ry="13" fill="#FFF8E6" filter="url(#b1)"/>
      <ellipse cx="0" cy="-12" rx="3" ry="6" fill="#FFFFFF"/></g>`;
  const glass = (x, y, s, blur, wine) => `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#${blur})">
      <path d="M-46 -150 C -50 -90, -38 -40, 0 -30 C 38 -40, 50 -90, 46 -150 Z" fill="#FFFFFF" fill-opacity=".14" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="2.5"/>
      ${wine ? '<path d="M-44 -100 C -40 -60, -30 -38, 0 -32 C 30 -38, 40 -60, 44 -100 Z" fill="#8A3A48" opacity=".72"/>' : ''}
      <path d="M-30 -140 C -34 -110, -30 -80, -22 -64" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="5" fill="none" stroke-linecap="round"/>
      <rect x="-3" y="-32" width="6" height="96" fill="#FFFFFF" fill-opacity=".45"/>
      <ellipse cx="0" cy="66" rx="40" ry="9" fill="#FFFFFF" fill-opacity=".4"/></g>`;
  const plate = (x, y, rx) => `<g><ellipse cx="${x}" cy="${y + 8}" rx="${rx}" ry="${rx * 0.3}" fill="#B9A89C" opacity=".35" filter="url(#b4)"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.3}" fill="#FDFBF8"/><ellipse cx="${x}" cy="${y}" rx="${rx * 0.72}" ry="${rx * 0.21}" fill="none" stroke="#E7DFD6" stroke-width="2"/></g>`;
  const defs = `
    <linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#56657E"/><stop offset=".3" stop-color="#7D8098"/><stop offset=".5" stop-color="#B096A2"/><stop offset=".62" stop-color="#D8B2A6"/><stop offset="1" stop-color="#E7CDBF"/></linearGradient>
    <linearGradient id="linen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DEC6BC"/><stop offset=".06" stop-color="#E9DCD2"/><stop offset=".25" stop-color="#F5EDE5"/><stop offset="1" stop-color="#E4D8CE"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#FFE8C2" stop-opacity=".95"/><stop offset=".25" stop-color="#FFC98A" stop-opacity=".5"/><stop offset="1" stop-color="#FFC98A" stop-opacity="0"/></radialGradient>`;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#win)"/>
    <g filter="url(#b4)">${bokeh}</g>
    <g filter="url(#b8)">${bokehBig}</g>
    <g fill="#3B4252" opacity=".38" filter="url(#b8)"><rect x="290" y="0" width="18" height="${TABLE}"/><rect x="606" y="0" width="18" height="${TABLE}"/><rect x="0" y="330" width="${W}" height="14"/></g>
    <rect x="0" y="${TABLE - 26}" width="${W}" height="40" fill="#C9B0A6" opacity=".6" filter="url(#b8)"/>
    <path d="M0 ${TABLE} L${W} ${TABLE} L${W} ${H} L0 ${H} Z" fill="url(#linen)"/>
    <path d="M120 ${TABLE + 40} C 300 ${TABLE + 60}, 600 ${TABLE + 50}, 820 ${TABLE + 80}" stroke="#DCCDC1" stroke-width="3" fill="none" opacity=".6" filter="url(#b2)"/>
    <rect x="-20" y="${TABLE - 18}" width="${W + 40}" height="40" fill="#E2CCC2" filter="url(#b8)"/>
    <g filter="url(#b2)">${plate(470, 668, 84)}${candle(560, 625, 0.85)}</g>
    <g filter="url(#b1)">${plate(250, 720, 120)}${plate(700, 760, 130)}${candle(360, 640, 1)}${candle(760, 650, 1.1)}</g>
    ${glass(640, 610, 0.9, 'b2', true)}
    ${glass(150, 640, 1.6, 'b4', true)}
    <rect x="0" y="0" width="${W}" height="${H}" fill="#FFE4C7" opacity=".08"/>`;
  return svg(defs, body);
}

/* ---------- 3. Morning: coffee, a notebook of product sketches, a laptop, window light ---------- */
function morning() {
  seed = 31;
  let veins = '';
  for (let i = 0; i < 9; i++) { const y = between(0, H), x = between(-100, 300); veins += `<path d="M${f(x)} ${f(y)} C ${f(x + 250)} ${f(y + between(-120, 120))}, ${f(x + 500)} ${f(y + between(-160, 160))}, ${f(x + 1000)} ${f(y + between(-200, 200))}" stroke-width="${f(between(0.8, 2.6))}"/>`; }
  let leaves = '';
  for (let i = 0; i < 40; i++) { const x = between(0, W), y = between(0, 520), rx = between(10, 34); leaves += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(rx * 0.42)}" transform="rotate(${f(between(0, 180))} ${f(x)} ${f(y)})"/>`; }
  let keys = '';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 12; c++) keys += `<rect x="${24 + c * 30}" y="${30 + r * 30}" width="24" height="24" rx="4"/>`;
  const cup = (x, y, latte) => `<g transform="translate(${x} ${y})">
      <circle cx="10" cy="14" r="128" fill="#8E8378" opacity=".28" filter="url(#b16)"/>
      <circle r="124" fill="#FCFBF9"/><circle r="124" fill="none" stroke="#ECE8E3" stroke-width="2"/><circle r="104" fill="none" stroke="#EFEBE6" stroke-width="1.5"/>
      <rect x="64" y="-16" width="62" height="32" rx="16" fill="#FAF9F7" stroke="#E7E2DC" stroke-width="2"/>
      <circle cx="4" cy="6" r="80" fill="#7C6F64" opacity=".25" filter="url(#b8)"/>
      <circle r="78" fill="#FFFFFF"/><circle r="78" fill="none" stroke="#E5E0DA" stroke-width="2"/>
      <circle r="63" fill="url(#${latte ? 'latte' : 'coffee'})"/>
      ${latte ? '<path d="M0 -30 C 18 -30, 26 -8, 0 22 C -26 -8, -18 -30, 0 -30 Z M0 -22 V 20" fill="#F4E7D7" stroke="#C9AE93" stroke-width="2" opacity=".9"/>' : '<ellipse cx="-18" cy="-22" rx="20" ry="9" fill="#FFFFFF" opacity=".28" transform="rotate(-30 -18 -22)"/>'}</g>`;
  const defs = `
    <linearGradient id="marble" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F1ED"/><stop offset="1" stop-color="#E6E3DE"/></linearGradient>
    <radialGradient id="coffee"><stop offset="0" stop-color="#6E4F3E"/><stop offset=".7" stop-color="#8A6650"/><stop offset="1" stop-color="#B08B70"/></radialGradient>
    <radialGradient id="latte"><stop offset="0" stop-color="#D9BFA5"/><stop offset=".8" stop-color="#C29F80"/><stop offset="1" stop-color="#A9846A"/></radialGradient>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".85"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`;
  const sketch = `<g stroke="#7E8894" stroke-width="2" fill="none" stroke-linecap="round" opacity=".55">
      <rect x="40" y="48" width="96" height="176" rx="16"/><rect x="54" y="74" width="68" height="36" rx="6"/><path d="M54 126 h68 M54 140 h50 M54 154 h60"/><rect x="54" y="174" width="68" height="28" rx="14"/>
      <path d="M150 120 C 175 112, 190 112, 212 120" /><path d="M204 112 l8 8 l-9 6"/>
      <rect x="226" y="70" width="96" height="70" rx="10"/><circle cx="252" cy="96" r="12"/><path d="M272 92 h36 M272 106 h26 M240 124 h70"/>
      <circle cx="274" cy="196" r="30"/><path d="M262 196 l9 9 l18 -20"/>
      <path d="M44 262 h160 M44 282 h220 M44 302 h120"/></g>`;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#marble)"/>
    <g stroke="#CBC5BE" fill="none" opacity=".45" filter="url(#b1)">${veins}</g>
    <path d="M-50 -50 L520 -50 L980 520 L980 760 Z" fill="url(#light)" opacity=".6" filter="url(#b30)"/>
    <g transform="translate(470 -110) rotate(14)">
      <rect x="10" y="20" width="440" height="300" rx="22" fill="#8C8F93" opacity=".3" filter="url(#b16)"/>
      <rect width="440" height="300" rx="22" fill="#D6D9DD"/><rect x="10" y="10" width="420" height="190" rx="14" fill="#C9CDD2"/>
      <g fill="#BEC3C9">${keys}</g><rect x="150" y="214" width="140" height="70" rx="10" fill="#CDD1D6"/></g>
    <g transform="translate(70 420) rotate(-7)">
      <rect x="12" y="16" width="360" height="430" rx="10" fill="#9A9187" opacity=".3" filter="url(#b16)"/>
      <rect width="360" height="430" rx="10" fill="#FCFAF5"/><rect width="360" height="430" rx="10" fill="none" stroke="#EAE4DA" stroke-width="2"/>
      ${sketch}
      <rect x="250" y="320" width="190" height="12" rx="6" fill="#30363C" transform="rotate(-28 250 320)"/></g>
    ${cup(650, 560, false)}${cup(560, 860, true)}
    <g stroke="#FFFFFF" stroke-width="5" fill="none" stroke-linecap="round" opacity=".55" filter="url(#b4)">
      <path d="M630 470 C 600 430, 660 400, 630 350 S 650 280, 630 250"/><path d="M670 480 C 700 440, 650 410, 680 360"/></g>
    <g fill="#5E665E" opacity=".07" filter="url(#b8)">${leaves}</g>`;
  return svg(defs, body);
}

/* ---------- 4. Two friends on the river path, autumn fog, lamps going off into the distance ---------- */
function walk() {
  seed = 47;
  const VX = 470, VY = 470;
  let trees = '', lamps = '', leaves = '', shimmer = '';
  [[400, 0.18, 70, 6], [330, 0.26, 110, 5], [250, 0.36, 170, 4], [150, 0.48, 260, 3], [30, 0.62, 420, 2.4]].forEach(([x, op, h, bl]) => {
    const base = VY + (VX - x) * 0.55 + 30;
    let crown = '';
    for (let k = 0; k < 14; k++) crown += `<circle cx="${f(x + between(-0.5, 0.5) * h * 0.7)}" cy="${f(base - h * between(0.62, 1.1))}" r="${f(h * between(0.1, 0.2))}" fill="${pick(['#7D878C', '#87908F', '#8E9592', '#9A9C90'])}"/>`;
    trees += `<g opacity="${op}"><rect x="${x}" y="${base - h * 0.75}" width="${f(h / 26)}" height="${f(h * 0.75)}" fill="#5E676E" filter="url(#b2)"/><g filter="url(#b${bl > 4 ? 8 : 4})">${crown}</g></g>`;
  });
  [[520, 0.22, 56], [560, 0.3, 84], [620, 0.42, 128], [720, 0.58, 210]].forEach(([x, op, h]) => {
    const base = VY + (x - VX) * 0.62 + 20;
    lamps += `<g opacity="${op}" filter="url(#b1)"><rect x="${x}" y="${base - h}" width="${h / 40}" height="${h}" fill="#4F5860"/><circle cx="${x + h / 80}" cy="${base - h}" r="${h / 14}" fill="#FFE2B8"/>
      <circle cx="${x + h / 80}" cy="${base - h}" r="${h / 4}" fill="#FFD9A0" opacity=".45" filter="url(#b8)"/></g>`;
  });
  for (let i = 0; i < 60; i++) { const t = Math.pow(rnd(), 0.7), y = VY + 20 + t * (H - VY), half = 30 + t * 300, x = VX + between(-half, half); leaves += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(2 + t * 7)}" ry="${f(1 + t * 3)}" fill="${pick(['#C9A36B', '#D7B27C', '#BE8F5E', '#D9BC8F'])}" opacity="${f(between(0.4, 0.85) * 10) / 10}" transform="rotate(${f(between(0, 180))} ${f(x)} ${f(y)})"/>`; }
  for (let i = 0; i < 70; i++) { const t = rnd(), y = VY + 6 + t * 280, x = between(640, W); shimmer += `<rect x="${f(x)}" y="${f(y)}" width="${f(10 + t * 90)}" height="${f(0.6 + t * 1.6)}" fill="#FFFFFF" opacity="${f(between(0.15, 0.45) * 10) / 10}"/>`; }
  // a group of friends from behind, mid-stride, a little spread out: different coats, a backpack, a beanie, one head turned to talk
  const person = (x, y, s, coat, scarf, step, o) => { o = o || {}; return `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="150" rx="34" ry="6" fill="#6E747A" opacity=".25" filter="url(#b4)"/>
      <path d="M-9 92 L${-12 - step} 148 L${-4 - step} 148 L-1 96 Z M9 92 L${12 + step * 0.4} 146 L${4 + step * 0.4} 146 L1 96 Z" fill="#3E454C"/>
      <path d="M-22 20 C -26 50, -24 80, -20 100 L20 100 C 24 80, 26 50, 22 20 C 14 10, -14 10, -22 20 Z" fill="${coat}"/>
      <path d="M-22 22 C -32 46, -30 70, -26 84 M22 22 C 32 46, 30 70, 26 84" stroke="${coat}" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M-13 14 C -8 22, 8 22, 13 14 L 11 26 C 4 30, -4 30, -11 26 Z" fill="${scarf}"/>
      ${o.bag ? `<rect x="-15" y="24" width="30" height="38" rx="8" fill="${o.bag}"/>` : ''}
      <circle cx="${o.turn || 0}" cy="0" r="13" fill="#4A4F55"/>${o.hat ? `<path d="M${-13 + (o.turn || 0)} -2 C ${-13 + (o.turn || 0)} -20, ${13 + (o.turn || 0)} -20, ${13 + (o.turn || 0)} -2 Z" fill="${o.hat}"/>` : ''}</g>`; };
  const defs = `
    <linearGradient id="fogsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D3DBE1"/><stop offset=".45" stop-color="#E9E7E4"/><stop offset="1" stop-color="#DEDFDD"/></linearGradient>
    <linearGradient id="path" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4E1DD"/><stop offset="1" stop-color="#C8C2BA"/></linearGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DADDD8"/><stop offset="1" stop-color="#AEB5A8"/></linearGradient>
    <linearGradient id="riverw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E3E6E8"/><stop offset="1" stop-color="#B9C5CF"/></linearGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#fogsky)"/>
    <g fill="#B4BDC4" opacity=".4" filter="url(#b4)"><rect x="560" y="${VY - 22}" width="${W}" height="24"/>${[600, 690, 780, 870].map((x) => `<ellipse cx="${x}" cy="${VY + 2}" rx="40" ry="18" fill="#E6E8E8"/>`).join('')}</g>
    <path d="M0 ${VY} L${W} ${VY} L${W} ${H} L0 ${H} Z" fill="url(#grass)"/>
    <path d="M${VX + 40} ${VY} L${W} ${VY} L${W} ${H} L${VX + 380} ${H} Z" fill="url(#riverw)" filter="url(#b2)"/>
    ${shimmer}
    <path d="M${VX - 12} ${VY} L${VX + 12} ${VY} L${VX + 330} ${H} L${VX - 360} ${H} Z" fill="url(#path)" filter="url(#b2)"/>
    ${trees}${lamps}
    <g filter="url(#b1)">${leaves}</g>
    <g filter="url(#b1)">${person(470, 530, 0.5, '#6C747C', '#CFC6B6', 4, { hat: '#A9846A' })}${person(424, 556, 0.6, '#8C8B6E', '#E2DCCD', 6, { turn: 3 })}${person(463, 560, 0.62, '#B49573', '#EDE7DC', -4, { bag: '#5E666E' })}${person(506, 554, 0.58, '#7E93A6', '#D8D4CB', 5, { turn: -3 })}</g>
    <rect x="0" y="${VY - 160}" width="${W}" height="300" fill="url(#mist)" filter="url(#b16)"/>
    <rect x="0" y="${VY + 120}" width="${W}" height="140" fill="url(#mist)" opacity=".35" filter="url(#b16)"/>`;
  return svg(defs, body);
}

/* ---------- 5. Boston at night across the Charles: lit towers, a bridge of lamps, light falling on the water (the opening film) ---------- */
function night() {
  seed = 59;
  const BANK = 600, WATER = 664;
  const WIN = ['#FFD9A0', '#FFE7C2', '#FFCE8A', '#CFE2FF', '#FFF1D6'];
  let back = '', front = '', windows = '', reds = '', streaks = '';
  // far layer: low, hazy blocks
  for (let x = -20; x < W + 20;) { const w = between(20, 60), h = between(30, 110); back += `<rect x="${f(x)}" y="${f(BANK - h)}" width="${f(w + 1)}" height="${f(h + 6)}"/>`; x += w; }
  // two layers of towers with depth: a hazier middle row, a sharp front row; flat, stepped, slanted and masted roofs
  let mid = '';
  const tower = (x, w, h, roof, layer) => {
    const top = BANK - h, fill = layer === 'mid' ? '#141C36' : '#0B1222';
    let shape = `<rect x="${x}" y="${top}" width="${w}" height="${h + 6}"/>`;
    if (roof === 'step') shape += `<rect x="${x + w * 0.18}" y="${top - 22}" width="${w * 0.64}" height="24"/><rect x="${x + w * 0.34}" y="${top - 38}" width="${w * 0.32}" height="18"/>`;
    if (roof === 'slant') shape = `<path d="M${x} ${BANK + 6} V${top + 26} L${x + w} ${top} V${BANK + 6} Z"/>`;
    if (roof === 'mast') shape += `<rect x="${x + w / 2 - 1.5}" y="${top - 64}" width="3" height="64"/>`;
    if (layer === 'mid') mid += shape.replace(/<(rect|path)/g, '<$1 fill="' + fill + '"'); else front += shape;
    const dense = layer === 'mid' ? 0.18 : 0.3;
    for (let wy = top + 12; wy < BANK - 8; wy += 8) {
      const band = rnd() < 0.22 ? 0.05 : rnd() < 0.15 ? 0.8 : dense; // some floors dark, some all lit
      for (let wx = x + 5; wx < x + w - 5; wx += 6) if (rnd() < band) windows += `<rect x="${wx}" y="${wy}" width="2.6" height="3.4" fill="${pick(WIN)}" opacity="${f(between(layer === 'mid' ? 0.3 : 0.5, layer === 'mid' ? 0.6 : 0.95) * 10) / 10}"/>`;
    }
    const peak = roof === 'mast' ? top - 64 : roof === 'step' ? top - 38 : top;
    if (h > 150) reds += `<circle cx="${x + w / 2}" cy="${peak - 2}" r="2.2" fill="#FF6464"/><circle cx="${x + w / 2}" cy="${peak - 2}" r="9" fill="#FF6464" opacity=".25" filter="url(#b4)"/>`;
    if (layer !== 'mid') for (let k = 0; k < 9; k++) { const y = WATER + 6 + k * between(16, 30), ww = between(2, Math.min(10, w / 4)); streaks += `<rect x="${f(x + between(4, w - 8))}" y="${f(y)}" width="${f(ww)}" height="${f(between(6, 18))}" rx="1" fill="${pick(WIN)}" opacity="${f(between(0.15, 0.4) * 10) / 10}"/>`; }
  };
  [[30, 50, 150, 'flat'], [150, 44, 210, 'step'], [268, 58, 180, 'flat'], [356, 40, 250, 'mast'], [452, 54, 290, 'step'], [640, 46, 240, 'flat'], [700, 62, 200, 'step'], [820, 50, 170, 'flat']].forEach(([x, w, h, r]) => tower(x, w, h, r, 'mid'));
  [[0, 44, 90, 'flat'], [70, 38, 130, 'flat'], [112, 52, 100, 'flat'], [214, 36, 150, 'slant'], [300, 48, 120, 'flat'], [392, 42, 170, 'flat'], [500, 50, 330, 'step'], [560, 38, 410, 'slant'], [604, 44, 160, 'flat'], [662, 34, 120, 'flat'], [748, 52, 140, 'step'], [806, 40, 100, 'flat'], [850, 50, 130, 'flat']].forEach(([x, w, h, r]) => tower(x, w, h, r, 'front'));
  // the bridge: arches, a row of warm lamps, their light on the water
  let arches = '', lamps = '', lampTrails = '';
  for (let i = 0; i < 9; i++) arches += `<ellipse cx="${-30 + i * 120}" cy="${WATER}" rx="50" ry="29" fill="#000"/>`;
  for (let x = 14; x < W; x += 44) {
    lamps += `<circle cx="${x}" cy="${WATER - 50}" r="2.6" fill="#FFD48F"/><circle cx="${x}" cy="${WATER - 50}" r="12" fill="#FFC56E" opacity=".35" filter="url(#b4)"/>`;
    for (let k = 0; k < 6; k++) lampTrails += `<rect x="${f(x - 1.5 + between(-2, 2))}" y="${f(WATER + 8 + k * between(18, 34))}" width="${f(between(2, 4))}" height="${f(between(8, 20))}" rx="1" fill="#FFC56E" opacity="${f(between(0.2, 0.5) * 10) / 10}"/>`;
  }
  const bridge = `<g><rect x="-20" y="${WATER - 44}" width="${W + 40}" height="44" mask="url(#arch)"/>${[318, 372, 528, 582].map((x) => `<path d="M${x} ${WATER - 44} v-18 q0 -9 8 -9 q8 0 8 9 v18 z"/>`).join('')}</g>`;
  let stars = ''; for (let i = 0; i < 40; i++) stars += `<circle cx="${f(between(0, W))}" cy="${f(between(0, 300))}" r="${f(between(0.4, 1.1))}" fill="#fff" opacity="${f(between(0.15, 0.5) * 10) / 10}"/>`;
  let ripples = ''; for (let i = 0; i < 120; i++) { const t = Math.pow(rnd(), 1.4), y = WATER + 4 + t * (H - WATER); ripples += `<rect x="${f(between(-40, W))}" y="${f(y)}" width="${f(10 + t * 120)}" height="${f(0.6 + t * 1.4)}" fill="#8FA6D6" opacity="${f(between(0.05, 0.16) * 100) / 100}"/>`; }
  const defs = `
    <linearGradient id="nsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060B18"/><stop offset=".35" stop-color="#0C1530"/><stop offset=".55" stop-color="#1A2147"/><stop offset=".62" stop-color="#2E2B55"/><stop offset=".7" stop-color="#121A33"/><stop offset="1" stop-color="#070B17"/></linearGradient>
    <linearGradient id="nwater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141C3A"/><stop offset="1" stop-color="#060A15"/></linearGradient>
    <mask id="arch"><rect x="-20" y="0" width="${W + 40}" height="${H}" fill="#fff"/>${arches}</mask>`;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#nsky)"/>
    ${stars}
    <ellipse cx="520" cy="${BANK}" rx="560" ry="230" fill="#D98B57" opacity=".2" filter="url(#b30)"/>
    <g fill="#1C2442" opacity=".9" filter="url(#b2)">${back}</g>
    <g filter="url(#b1)" opacity=".95">${mid}</g>
    <rect x="0" y="${BANK - 120}" width="${W}" height="140" fill="#3A3A66" opacity=".22" filter="url(#b16)"/>
    <g fill="#0B1222">${front}</g>
    <g filter="url(#b1)">${windows}</g>
    ${reds}
    <rect x="0" y="${BANK}" width="${W}" height="${H - BANK}" fill="url(#nwater)"/>
    <g filter="url(#b2)">${streaks}</g>
    <g fill="#090F1E">${bridge}</g>
    ${lamps}
    <g filter="url(#b2)">${lampTrails}</g>
    ${ripples}
    <rect x="0" y="${BANK - 40}" width="${W}" height="90" fill="#9AA8D6" opacity=".07" filter="url(#b16)"/>`;
  return svg(defs, body);
}

const out = __dirname;
[['river', river], ['dusk', dusk], ['morning', morning], ['walk', walk], ['night', night]].forEach(([name, fn]) => {
  fs.writeFileSync(path.join(out, name + '.svg'), fn());
  console.log('art/' + name + '.svg');
});
