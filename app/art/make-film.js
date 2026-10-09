// The opening film for the first screen: about 21 seconds of real footage, vertical, graded like a dream.
// Night and strange light first (the city, cells, holograms), then the cuts speed up through bio, AI, robots and
// medicine, a white flash, and then people: laughing too hard, pouring beer, glasses meeting over a dinner table.
//
// Footage is from Mixkit (free license: commercial use, no attribution needed, but the clips can't be resold on
// their own). Each shot is read straight from Mixkit's CDN, cropped to 9:16, slowed or punched in, graded, and
// cached in art/.film. Then the shots are cut together into public/video/film.mp4, with a poster frame in public/img/film.jpg.
// Needs ffmpeg with libx264 (set FFMPEG to its folder if it isn't on PATH). Run: npm run film
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const W = 720, H = 1280, FPS = 30;
const ROOT = path.join(__dirname, '..');
const CACHE = path.join(__dirname, '.film');
const OUT = path.join(ROOT, 'public', 'video');
fs.mkdirSync(CACHE, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

function findBin(name) {
  const dirs = [process.env.FFMPEG, ...(process.env.PATH || '').split(path.delimiter)];
  if (process.env.LOCALAPPDATA) {
    const pk = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
    try { fs.readdirSync(pk).filter((d) => /FFmpeg/i.test(d)).forEach((d) => fs.readdirSync(path.join(pk, d)).forEach((v) => dirs.push(path.join(pk, d, v, 'bin')))); } catch (e) {}
  }
  for (const d of dirs) { if (!d) continue; for (const f of [name + '.exe', name]) { const p = path.join(d, f); if (fs.existsSync(p)) return p; } }
  throw new Error(name + ' not found. Install ffmpeg or set FFMPEG to its bin folder.');
}
const FF = findBin('ffmpeg');
const run = (args) => execFileSync(FF, ['-hide_banner', '-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

// Grades. All of them lift the blacks and roll off the highlights so nothing is ever harsh; the night ones push
// teal into the shadows, the warm ones push violet into the shadows and apricot into the light.
const GRADE = {
  // a daylight skyline turned into a blue hour that never ends
  dfn: "eq=contrast=1.1:saturation=0.5:brightness=-0.09:gamma=0.86,colorbalance=rs=-0.12:gs=-0.03:bs=0.16:rm=-0.09:gm=-0.02:bm=0.12:rh=-0.03:gh=0.02:bh=0.08,curves=master='0/0.03 0.4/0.25 1/0.8'",
  night: "eq=contrast=1.06:saturation=0.82:gamma=0.96,colorbalance=rs=-0.07:gs=-0.02:bs=0.10:rm=-0.04:bm=0.06:rh=0.06:gh=0.03:bh=-0.02,curves=master='0/0.035 0.3/0.26 0.7/0.72 1/0.96'",
  lab: "eq=contrast=1.08:saturation=0.78:gamma=0.94,colorbalance=rs=-0.08:gs=0.0:bs=0.09:rm=-0.05:gm=0.01:bm=0.05:rh=0.04:gh=0.02:bh=-0.01,curves=master='0/0.03 0.35/0.3 0.75/0.76 1/0.95'",
  warm: "eq=contrast=1.05:saturation=0.9:gamma=0.98,colorbalance=rs=0.01:gs=-0.03:bs=0.08:rm=0.06:bm=-0.03:rh=0.06:gh=0.03:bh=-0.05,curves=master='0/0.04 0.5/0.51 1/0.96'",
  candle: "eq=contrast=1.06:saturation=0.86:gamma=0.97,colorbalance=rs=0.02:gs=-0.02:bs=0.07:rm=0.07:gm=0.01:bm=-0.04:rh=0.07:gh=0.03:bh=-0.06,curves=master='0/0.045 0.5/0.5 1/0.95'"
};
// halation: only the brightest parts glow, tinted to the scene
const GLOW = { dfn: [0.8, 0.9, 1, 0.45], night: [0.82, 0.92, 1, 0.42], lab: [0.82, 0.95, 1, 0.38], warm: [1, 0.8, 0.66, 0.55], candle: [1, 0.78, 0.6, 0.6] };

const ACT2 = (id, t, d, xc, extra) => Object.assign({ id, t, d, xc, z: 0.07, g: 'lab', in: 'cut' }, extra || {});
const P = (id, t, d, xc, extra) => Object.assign({ id, t, d, xc, z: 0.05, g: 'warm', in: 'cut' }, extra || {});
// id: Mixkit clip, t: where to start in it (s), d: how long the shot runs in the film (s), sp: playback speed,
// xc: where the 9:16 window sits across a landscape frame (0 left, 1 right), z: push-in over the shot,
// zs: how far in the shot starts (1 = the full frame), xz/yc: where a punched-in window sits across and top to bottom,
// in: how the shot arrives (cut, dissolve, white), act: the first shot of each act (the app times its lines to these)
const SHOTS = [
  // I. something is out there: the city at night, cells glowing, a hologram, a sphere of points
  { id: 11074, t: 1.6, d: 1.5, xc: 0.8, z: 0.05, g: 'dfn', in: 'black' },
  { id: 49878, t: 1.0, d: 1.3, sp: 0.8, z: 0.04, g: 'night', in: 'dissolve' },
  { id: 3968, t: 3.0, d: 1.0, xc: 0.42, z: 0.08, g: 'lab', in: 'dissolve' },
  { id: 5485, t: 4.2, d: 1.0, xc: 0.3, z: 0.05, g: 'lab', in: 'dissolve' },
  { id: 31771, t: 5.0, d: 0.85, xc: 0.62, z: 0.1, g: 'night', in: 'dissolve' },
  // II. it speeds up: AI, bio, robots, medicine, chips, compute
  ACT2(46635, 2.0, 0.66, 0.74, { act: 'tech' }),
  ACT2(17456, 5.0, 0.6, 0.56, { in: 'white' }),
  ACT2(20961, 3.2, 0.55, 0.5),
  ACT2(4712, 3.0, 0.5, 0.42, { in: 'white' }),
  ACT2(5580, 0.6, 0.46, 0.3, { zs: 1.3, yc: 0.7, xz: 0.3 }),
  ACT2(1140, 4.0, 0.42, 0.55, { in: 'white' }),
  ACT2(51214, 7.0, 0.4, 0.55),
  ACT2(46748, 12.0, 0.38, 0.38, { in: 'white' }),
  ACT2(23282, 3.0, 0.36, 0.5),
  ACT2(21921, 9.0, 0.34, 0.47, { in: 'white' }),
  ACT2(3953, 3.0, 0.32, 0.22),
  ACT2(31497, 6.0, 0.34, 0.5, { z: 0.16 }),
  // III. a white flash, and then people building it together: sticky notes, a 3D model, a flip chart, a robot on the
  // bench, a laptop everyone leans over, a joke at the laptop, the moment it works, hands in
  P(8813, 1.6, 0.75, 0.5, { in: 'white', act: 'build' }),
  P(23978, 7.5, 0.7, 0.5),
  P(8998, 4.0, 0.6, 0.45),
  P(23155, 13.0, 0.6, 0.45),
  P(9072, 5.6, 0.6, 0.3),
  P(4872, 6.8, 0.75, 0.5),
  P(32833, 6.4, 0.85, 0.45),
  P(35959, 4.4, 0.75, 0.5),
  // IV. and then the friends part: a pour, laughing too hard, bottles and glasses meeting
  P(8709, 3.0, 0.75, 0.5, { sp: 0.75, z: 0.04, act: 'friends' }),
  P(51534, 7.9, 0.9, 0.5, { sp: 0.85, z: 0.04 }),
  P(44593, 2.3, 0.55, 0.45),
  P(51533, 1.7, 0.75, 0.42, { sp: 0.9, z: 0.04 }),
  P(22738, 2.9, 0.85, 0.5, { sp: 0.8, z: 0.03 }),
  P(51536, 0.5, 0.6, 0.44, { z: 0.04 }),
  // V. the table, and the city it's in
  { id: 24368, t: 6.5, d: 2.3, sp: 0.85, xc: 0.48, z: 0.06, g: 'candle', in: 'cut', act: 'table' },
  { id: 49846, t: 10.0, d: 2.1, sp: 0.8, xc: 0.5, z: 0.05, g: 'night', in: 'dissolve', out: 'black' }
];
const XD = { dissolve: 0.36, white: 0.0 }; // dissolve overlap; white is a flash at the start of the shot, no overlap

function source(id) {
  for (const r of [1080, 720]) {
    const u = `https://assets.mixkit.co/videos/${id}/${id}-${r}.mp4`;
    try { execFileSync(findBin('ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', u], { stdio: ['ignore', 'pipe', 'ignore'] }); return u; } catch (e) {}
  }
  throw new Error('clip ' + id + ' is not reachable on Mixkit');
}
function probe(u) {
  const o = execFileSync(findBin('ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', u]).toString().trim().split(',');
  return { w: +o[0], h: +o[1] };
}

function shotFile(s, i) {
  // shots that dissolve in need a little extra at the head so the overlap doesn't eat the moment
  const pre = s.in === 'dissolve' ? XD.dissolve : 0, sp = s.sp || 1, dur = s.d + pre;
  const key = crypto.createHash('md5').update(JSON.stringify([s, pre, GRADE[s.g], GLOW[s.g], 3])).digest('hex').slice(0, 10);
  const f = path.join(CACHE, `shot-${String(i).padStart(2, '0')}-${s.id}-${key}.mp4`);
  if (fs.existsSync(f)) return { f, dur };
  const u = source(s.id), { w, h } = probe(u), land = w > h;
  const t0 = Math.max(0, s.t - pre * sp);
  const z = s.z || 0, zs = s.zs || 1, xc = s.xc == null ? 0.5 : s.xc, yc = s.yc == null ? 0.5 : s.yc, xz = s.xz == null ? 0.5 : s.xz;
  const crop = land ? `crop=w='trunc(ih*9/16/2)*2':h=ih:x='(iw-trunc(ih*9/16/2)*2)*${xc}':y=0,` : '';
  const [cr, cg, cb, op] = GLOW[s.g];
  const chain = [
    `[0:v]setpts=(PTS-STARTPTS)/${sp},fps=${FPS},trim=duration=${dur.toFixed(3)},setpts=PTS-STARTPTS,`,
    crop,
    `scale=w='trunc(${W}*(${zs}+${z}*t/${dur.toFixed(3)})/2)*2':h=-2:eval=frame:flags=bicubic,crop=${W}:${H}:x='(iw-${W})*${xz}':y='(ih-${H})*${yc}',setsar=1,`,
    GRADE[s.g] + ',split[a][b];',
    `[b]scale=${W / 5}:${H / 5},gblur=sigma=4,scale=${W}:${H}:flags=bilinear,curves=master='0/0 0.55/0.03 0.8/0.45 1/1',colorchannelmixer=rr=${cr}:gg=${cg}:bb=${cb}[h];`,
    `[a][h]blend=all_mode=screen:all_opacity=${op},vignette=angle=0.62`,
    s.in === 'white' ? `,fade=t=in:st=0:d=0.12:color=white` : '',
    `,format=yuv420p[v]`
  ].join('');
  console.log(`  shot ${i} · ${s.id} · ${s.d}s ${land ? '(cropped)' : ''}`);
  run(['-ss', t0.toFixed(3), '-t', (dur * sp + 0.5).toFixed(3), '-i', u, '-filter_complex', chain, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-r', String(FPS), f]);
  return { f, dur };
}

console.log('Cutting the opening film');
const files = SHOTS.map((s, i) => shotFile(s, i));
// shots from older cuts are dropped from the cache
const keep = new Set(files.map((x) => path.basename(x.f)));
fs.readdirSync(CACHE).filter((n) => !keep.has(n)).forEach((n) => fs.unlinkSync(path.join(CACHE, n)));

// cut them together: dissolves where a shot asks for one, hard cuts everywhere else
// every shot on the same clock first, or xfade refuses to mix a concat's output with a fresh input
let fc = files.map((_, i) => `[${i}:v]settb=AVTB,setpts=PTS-STARTPTS[s${i}];`).join(''), acc = '[s0]', len = files[0].dur;
const cues = [{ t: 0, id: SHOTS[0].id, act: SHOTS[0].act }];
for (let i = 1; i < files.length; i++) {
  const s = SHOTS[i], o = `[x${i}]`;
  if (s.in === 'dissolve') {
    const d = XD.dissolve, off = len - d;
    fc += `${acc}[s${i}]xfade=transition=dissolve:duration=${d}:offset=${off.toFixed(3)}${o};`;
    cues.push({ t: +(off + d).toFixed(3), id: s.id, act: s.act }); len = off + files[i].dur;
  } else {
    fc += `${acc}[s${i}]concat=n=2:v=1:a=0${o};`;
    cues.push({ t: +len.toFixed(3), id: s.id, act: s.act }); len += files[i].dur;
  }
  acc = o;
}
const total = len, fadeOut = 0.9;
fc += `${acc}fade=t=in:st=0:d=0.6,fade=t=out:st=${(total - fadeOut).toFixed(3)}:d=${fadeOut},format=yuv420p[v]`;
const film = path.join(OUT, 'film.mp4');
run([...files.flatMap((x) => ['-i', x.f]), '-filter_complex', fc, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-maxrate', '2600k', '-bufsize', '5200k',
  '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2), '-movflags', '+faststart', film]);
// the poster: what shows before the film can play (a quiet frame from the night city)
run(['-ss', '0.9', '-i', film, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '5', path.join(ROOT, 'public', 'img', 'film.jpg')]);



const acts = Object.fromEntries(cues.filter((c) => c.act).map((c) => [c.act, c.t]));
const meta = { seconds: +total.toFixed(3), acts, cuts: cues.map((c) => c.t), credit: 'Footage: Mixkit (mixkit.co), free license' };
fs.writeFileSync(path.join(OUT, 'film.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(`Wrote public/video/film.mp4 (${(fs.statSync(film).size / 1048576).toFixed(1)} MB, ${total.toFixed(2)}s) and public/img/film.jpg`);
console.log(JSON.stringify(meta));
