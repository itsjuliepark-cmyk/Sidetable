// Draws the Hash Table app icon (a table seen from above: a river runner, three mist plates for Kendall, three rose
// plates for Allston, two candle glows) into PNGs with no dependencies. Run once: node scripts/make-icons.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
function png(size, px) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

function draw(size) {
  const S = 4, N = size * S, px = Buffer.alloc(size * size * 4); // 4x supersampling
  const bgTop = hex('#F7F4F2'), bgBot = hex('#E9EDF0'), linen = hex('#FFFFFF'), linen2 = hex('#EEF1F2'), river = hex('#C3D2DF');
  const mist = hex('#8DA3B8'), rose = hex('#C7848C'), glow = hex('#F6C98A');
  const plates = [[0.36, 0.415, mist], [0.5, 0.405, mist], [0.64, 0.415, mist], [0.36, 0.585, rose], [0.5, 0.595, rose], [0.64, 0.585, rose]];
  const acc = new Float64Array(size * size * 3);
  for (let Y = 0; Y < N; Y++) for (let X = 0; X < N; X++) {
    const x = X / N, y = Y / N;
    let c = mix(bgTop, bgBot, y);
    // the table: a pill shape
    const tx = Math.max(0.3, Math.min(0.7, x)), dx = x - tx, dy = y - 0.5, inT = dx * dx + dy * dy <= 0.2 * 0.2 && Math.abs(y - 0.5) <= 0.2;
    // soft shadow under the table
    const sd = Math.sqrt(dx * dx + (dy - 0.035) * (dy - 0.035)); if (!inT && sd < 0.235) c = mix(c, hex('#1C2430'), 0.12 * Math.min(1, (0.235 - sd) / 0.04));
    if (inT) {
      c = mix(linen, linen2, (y - 0.3) / 0.4);
      const ry = 0.5 + 0.022 * Math.sin((x - 0.2) * Math.PI * 4), rd = Math.abs(y - ry), edge = Math.min(1, Math.min(x - 0.17, 0.83 - x) / 0.08);
      if (rd < 0.032 && edge > 0) c = mix(c, river, 0.8 * edge * Math.min(1, (0.032 - rd) / 0.01));
      [[0.43, 0.503], [0.57, 0.496]].forEach(([gx, gy]) => { const g = Math.hypot(x - gx, y - gy); if (g < 0.06) c = mix(c, glow, 0.75 * (1 - g / 0.06) * (1 - g / 0.06)); if (g < 0.011) c = hex('#FFF6E4'); });
      plates.forEach(([px0, py0, col]) => { const d = Math.hypot(x - px0, y - py0); if (d < 0.05) c = d > 0.041 ? col : d < 0.012 ? hex('#F2DFDE') : hex('#FFFFFF'); });
    }
    const i = (Math.floor(Y / S) * size + Math.floor(X / S)) * 3;
    acc[i] += c[0]; acc[i + 1] += c[1]; acc[i + 2] += c[2];
  }
  for (let i = 0; i < size * size; i++) { px[i * 4] = acc[i * 3] / (S * S); px[i * 4 + 1] = acc[i * 3 + 1] / (S * S); px[i * 4 + 2] = acc[i * 3 + 2] / (S * S); px[i * 4 + 3] = 255; }
  return png(size, px);
}
const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
[48, 96, 180, 192, 512].forEach((s) => { fs.writeFileSync(path.join(out, 'icon-' + s + '.png'), draw(s)); console.log('icon-' + s + '.png'); });
