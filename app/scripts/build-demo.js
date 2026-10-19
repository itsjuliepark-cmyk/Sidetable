// Builds dist/sixtop-demo.html (and dist/video/film.mp4 beside it), plus a copy in ../demo for the repo: the real member app plus the real server code running inside the page (see
// scripts/demo/runtime.js), so the whole app works on a phone from one file with no server. Run: npm run demo
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const must = (s, a, b) => { if (s.indexOf(a) < 0) throw new Error('build-demo: could not find ' + JSON.stringify(a.slice(0, 70))); return s.replace(a, () => b); };

const html = read('public/index.html');
// the scene pictures ride along inside the stylesheet
const css = read('public/app.css').replace(/url\(\/img\/([a-z]+)\.jpg\)/g, (all, name) => 'url(data:image/jpeg;base64,' + fs.readFileSync(path.join(root, 'public/img', name + '.jpg')).toString('base64') + ')');
const shared = read('public/shared.js');
const mods = { 'tables.js': read('server/tables.js'), 'server.js': read('server/server.js'), 'seed.js': read('scripts/seed.js'), 'faces.js': read('scripts/faces.js') };
// the saved demo data is keyed to this exact code, so a new build never runs on data from an older one
const build = require('crypto').createHash('sha1').update([read('public/shared.js'), read('server/tables.js'), read('server/server.js'), read('scripts/seed.js'), read('scripts/demo/runtime.js')].join('\n')).digest('hex').slice(0, 10);
// two demos from one build: Jordan's (with a week already lived in), and a fresh start where you sign up as someone new
function page(fresh) {
const runtime = read('scripts/demo/runtime.js').replace('/*BUILD*/', build).replace('/*FRESH*/false', fresh ? 'true' : 'false');
let hooks = read('scripts/demo/hooks.js');

const inlineStyle = html.indexOf('<style>') >= 0 ? html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>')) : '';
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src="/shared.js"></script>'));
let app = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
app = must(app, "if ('serviceWorker' in navigator) {", "if (!window.SIXTOP_DEMO && 'serviceWorker' in navigator) {");
app = must(app, "history.replaceState(null, '', '/'); toast(V.mode === 'signin' ? 'Signed in' : 'Verified', V.mode === 'signin' ? 'Welcome back.' : 'Welcome to Hash Table.'); return boot();", "toast(V.mode === 'signin' ? 'Signed in' : 'Verified', V.mode === 'signin' ? 'Welcome back.' : 'Welcome to Hash Table.'); return boot();");
// the opening film ships next to the page (published with it as video/film.mp4), not inside it
app = must(app, "const FILM_SRC = '/video/film.mp4';", "const FILM_SRC = 'video/film.mp4';");
// each demo signs in on its own, so the two never pick up each other's member on the same browser
if (fresh) { app = app.split("'sixtopToken'").join("'sixtopToken-start'"); hooks = hooks.split("'sixtopToken'").join("'sixtopToken-start'"); }

const src = Object.keys(mods).map((k) => JSON.stringify(k) + ': function (module, exports, require, __dirname, process, Buffer) {\n' + mods[k] + '\n}').join(',\n');
const demoCss = `
/* demo build: fit the viewer's frame on a phone, and the Demo tab */
@media (max-width:520px){.phone{height:100%}}
.demobtn{position:absolute;right:0;top:44%;z-index:25;writing-mode:vertical-rl;transform:rotate(180deg);padding:12px 6px;border-radius:0 12px 12px 0;background:rgba(28,32,36,.72);backdrop-filter:blur(10px);color:#fff;font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;box-shadow:0 10px 24px -12px rgba(18,28,38,.6)}
.demobtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.phone:has(.land.sheet-open) .demobtn{opacity:0;pointer-events:none}
/* the three ways into the demo, on the film's Join sheet */
.ls-opts{display:grid;gap:8px;margin-top:2px}
.ls-opt{display:block;width:100%;text-align:left;padding:13px 16px 14px;border-radius:18px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);color:#fff;font-family:var(--sans);font-size:15.5px;font-weight:600;letter-spacing:-.01em;transition:transform .15s}
.ls-opt:active{transform:scale(.98)}
.ls-opt small{display:block;margin-top:3px;font-size:12.5px;font-weight:400;letter-spacing:0;line-height:1.4;color:rgba(255,255,255,.68)}
.ls-opt.main{background:#FFFBF5;color:#2A1C14;border-color:transparent;box-shadow:0 14px 34px -16px rgba(255,180,120,.6)}
.ls-opt.main small{color:#7A6658}
`;
const out = `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${fresh ? 'Hash Table Start' : 'Hash Table'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Newsreader:ital,opsz,wght@1,6..72,300;1,6..72,400&display=swap" rel="stylesheet" />
<style>
${css}
${inlineStyle}
${demoCss}
</style>
${body.trim()}
<script>
${shared}
</script>
<script>
${runtime.replace('{/*MODULES*/}', () => '{\n' + src + '\n}')}
</script>
<script>
${app}
</script>
<script>
${hooks}
</script>
`;
[shared, runtime, app, hooks].concat(Object.values(mods)).forEach((s) => { if (/<\/script/i.test(s)) throw new Error('build-demo: a script contains </script>'); });
return out;
}
const out = page(false), fresh = page(true);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'sixtop-demo.html'), out);
fs.writeFileSync(path.join(root, 'dist', 'hash-table-start.html'), fresh);
fs.mkdirSync(path.join(root, 'dist', 'video'), { recursive: true });
fs.copyFileSync(path.join(root, 'public', 'video', 'film.mp4'), path.join(root, 'dist', 'video', 'film.mp4'));
// the same demo as a standalone page in the repo (demo/), so anyone with access to the repo can download it and open it in a browser
const repoDemo = path.join(root, '..', 'demo');
fs.mkdirSync(path.join(repoDemo, 'video'), { recursive: true });
fs.writeFileSync(path.join(repoDemo, 'hash-table-demo.html'), '<!doctype html>\n<html lang="en">\n' + out + '</html>\n');
fs.writeFileSync(path.join(repoDemo, 'hash-table-start.html'), '<!doctype html>\n<html lang="en">\n' + fresh + '</html>\n');
fs.copyFileSync(path.join(root, 'public', 'video', 'film.mp4'), path.join(repoDemo, 'video', 'film.mp4'));
console.log('dist/sixtop-demo.html and dist/hash-table-start.html', Math.round(out.length / 1024) + ' KB', '+ dist/video/film.mp4', (fs.statSync(path.join(root, 'dist', 'video', 'film.mp4')).size / 1048576).toFixed(1) + ' MB');
