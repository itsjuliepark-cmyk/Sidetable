// The opening film for the first screen: about 24 seconds of real footage, vertical, warm like late-afternoon light.
// A campus in autumn and someone opening a laptop under a tree, then late nights speeding up (code, a 3D model, a circuit
// board, a whiteboard, a microscope), a flash, and people building it together: high fives over a laptop, cheering at
// the screen. Then the friends part (pizza, a kitchen full of people, a Jenga tower falling, marshmallows over a fire, a
// guitar in the park) and the table at the end, candles and all.
//
// Footage is from Mixkit (only clips under the Mixkit Stock Video Free License: commercial use, no attribution, can't be
// resold on their own; never the Restricted ones, which are personal use only) and Pexels (Pexels License: commercial
// use, no attribution). Each shot is read straight from the CDN, cropped to 9:16, slowed or punched in, graded, and
// cached in art/.film. Then the shots are cut together into public/video/film.mp4, with a poster frame in public/img/film.jpg.
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
  candle: "eq=contrast=1.06:saturation=0.86:gamma=0.97,colorbalance=rs=0.02:gs=-0.02:bs=0.07:rm=0.07:gm=0.01:bm=-0.04:rh=0.07:gh=0.03:bh=-0.06,curves=master='0/0.045 0.5/0.5 1/0.95'",
  // the warm cut: late-afternoon sun, like an old film photo (lifted blacks, honey everywhere, nothing cold)
  sun: "eq=contrast=1.03:saturation=1.08:gamma=1.02,colorbalance=rs=0.03:gs=-0.01:bs=-0.03:rm=0.05:gm=-0.01:bm=-0.04:rh=0.05:gh=0.02:bh=-0.04,curves=master='0/0.04 0.5/0.53 1/0.97'",
  // a desk lamp or a kitchen at night: warm, a little deeper
  lamp: "eq=contrast=1.05:saturation=1.04:gamma=1.02,colorbalance=rs=0.04:gs=-0.01:bs=-0.03:rm=0.06:gm=-0.01:bm=-0.04:rh=0.05:gh=0.02:bh=-0.05,curves=master='0/0.045 0.5/0.53 1/0.96'",
  // screens and benches: a touch of cool in the shadows, warm in the light, so the tech shots sit in the same film
  bench: "eq=contrast=1.04:saturation=0.88:gamma=1.0,colorbalance=rs=-0.02:gs=0.0:bs=0.03:rm=0.03:bm=-0.02:rh=0.06:gh=0.03:bh=-0.04,curves=master='0/0.05 0.4/0.41 1/0.95'"
};
// halation: only the brightest parts glow, tinted to the scene
const GLOW = { dfn: [0.8, 0.9, 1, 0.45], night: [0.82, 0.92, 1, 0.42], lab: [0.82, 0.95, 1, 0.38], warm: [1, 0.8, 0.66, 0.55], candle: [1, 0.78, 0.6, 0.6],
  sun: [1, 0.86, 0.66, 0.5], lamp: [1, 0.8, 0.6, 0.55], bench: [1, 0.9, 0.78, 0.36] };

const T2 = (id, t, d, xc, extra) => Object.assign({ id, t, d, xc, z: 0.07, g: 'bench', in: 'cut' }, extra || {});
const P = (id, t, d, xc, extra) => Object.assign({ id, t, d, xc, z: 0.05, g: 'sun', in: 'cut' }, extra || {});
// id: a Mixkit clip number, or P + a Pexels video number (with its fps), t: where to start in it (s), d: how long the shot
// runs in the film (s), sp: playback speed, xc: where the 9:16 window sits across a landscape frame (0 left, 1 right),
// z: push-in over the shot, zs: how far in the shot starts (1 = the full frame), xz/yc: where a punched-in window sits
// across and top to bottom, in: how the shot arrives (cut, dissolve, white), act: the first shot of each act (the app
// times its lines to these)
const SHOTS = [
  // I. something starts: a campus by the river in autumn, walking to class, friends on a bench, a laptop under a tree, studying outside in the leaves
  P('P3288313', 17.0, 1.7, 0.5, { fps: 30, sp: 0.9, z: 0.05, zs: 1.4, yc: 0.82, in: 'black' }),
  P(4519, 4.0, 1.2, 0.5, { in: 'dissolve' }),
  P(4566, 1.0, 1.0, 0.42, { in: 'dissolve' }),
  P(4865, 4.0, 0.9, 0.34, { in: 'dissolve' }),
  P('P6145425', 2.0, 1.0, 0.36, { fps: 24, in: 'dissolve' }),
  // II. late nights, speeding up: code, a desk lamp, a 3D model, a whiteboard, a circuit board, VR, a microscope, the workshop
  T2(41653, 3.5, 0.62, 0.5, { act: 'tech' }),
  T2(41646, 4.0, 0.55, 0.5, { in: 'white' }),
  T2(50126, 6.0, 0.6, 0.45, { g: 'lamp' }),
  T2(29997, 6.0, 0.5, 0.5, { in: 'white' }),
  T2(29981, 4.0, 0.5, 0.3),
  T2(29994, 7.4, 0.46, 0.32, { in: 'white' }),
  T2(40453, 8.0, 0.44, 0.3),
  T2(4773, 9.0, 0.42, 0.28, { in: 'white' }),
  T2(29998, 6.0, 0.4, 0.5),
  T2(29989, 4.0, 0.46, 0.5, { z: 0.16 }),
  // III. a flash, and then building it together: high fives in the library, a plan at the cafe table, cheering at the laptop,
  // a group hug
  P('P8199334', 5.4, 1.1, 0.5, { fps: 25, in: 'white', act: 'build' }),
  P(4794, 5.8, 0.95, 0.5),
  P('P6104301', 4.9, 1.0, 0.36, { fps: 25 }),
  P(4709, 3.6, 1.2, 0.5),
  // IV. and then the friends part: pizza, a kitchen full of people, the Jenga tower falls, marshmallows over a fire, a guitar
  // in the park, laughing on the bus home
  P(42487, 2.2, 0.6, 0.5, { g: 'lamp', act: 'friends' }),
  P('P8757809', 5.0, 0.9, 0.45, { fps: 30, g: 'lamp' }),
  P(5323, 4.6, 0.9, 0.3),
  P(42758, 2.2, 0.85, 0.5, { g: 'lamp', sp: 0.85 }),
  P('P8379051', 4.8, 0.9, 0.45, { fps: 25 }),
  P(42583, 5.5, 0.8, 0.4, { g: 'lamp' }),
  // V. the table: setting it together, then candles and the whole table talking
  P('P7246906', 7.5, 1.2, 0.5, { fps: 25, g: 'lamp', act: 'table' }),
  P('P6289662', 10.5, 3.0, 0.5, { fps: 25, sp: 0.85, z: 0.06, g: 'lamp', in: 'dissolve', out: 'black' })
];
const XD = { dissolve: 0.36, white: 0.0 }; // dissolve overlap; white is a flash at the start of the shot, no overlap

// the biggest file each site serves for a clip, so the 9:16 crop stays sharp (Mixkit: 1080 then 720; Pexels: 1080p, 1440p, 4K, 720p)
function source(id, fps) {
  const ok = (u) => { try { execFileSync(findBin('ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', u], { stdio: ['ignore', 'pipe', 'ignore'] }); return true; } catch (e) { return false; } };
  const n = String(id).replace(/^P/, ''), urls = /^P/.test(String(id))
    ? ['hd_1920_1080', 'uhd_2560_1440', 'uhd_3840_2160', 'uhd_4096_2160', 'hd_1280_720'].map((r) => `https://videos.pexels.com/video-files/${n}/${n}-${r}_${fps || 25}fps.mp4`)
    : [1080, 720].map((r) => `https://assets.mixkit.co/videos/${n}/${n}-${r}.mp4`);
  for (const u of urls) if (ok(u)) return u;
  throw new Error('clip ' + id + ' is not reachable');
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
  const u = source(s.id, s.fps), { w, h } = probe(u), land = w > h;
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
// the poster: what shows before the film can play (the campus in autumn light)
run(['-ss', '0.9', '-i', film, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '5', path.join(ROOT, 'public', 'img', 'film.jpg')]);



const acts = Object.fromEntries(cues.filter((c) => c.act).map((c) => [c.act, c.t]));
const meta = { seconds: +total.toFixed(3), acts, cuts: cues.map((c) => c.t), credit: 'Footage: Mixkit (mixkit.co, Free License clips only) and Pexels (pexels.com, Pexels License)' };
fs.writeFileSync(path.join(OUT, 'film.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(`Wrote public/video/film.mp4 (${(fs.statSync(film).size / 1048576).toFixed(1)} MB, ${total.toFixed(2)}s) and public/img/film.jpg`);
console.log(JSON.stringify(meta));
