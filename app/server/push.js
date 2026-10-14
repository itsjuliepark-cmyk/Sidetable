// Web Push for Sidetable (copied from Amie beta), with no dependencies: VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291, RFC 8188).
// Works with any standard push service (Chrome/FCM, Firefox, Safari/Apple for home-screen web apps).
//
//   const push = require('./push.js')({ dir, subject });
//   push.publicKey                         -> the key the app subscribes with (base64url)
//   await push.send(subscription, payload) -> { ok, status, gone }   gone = the subscription is dead, drop it
//
// Keys: SIXTOP_VAPID_PUBLIC / SIXTOP_VAPID_PRIVATE (base64url, raw P-256), or generated once and kept in <dir>/vapid.json.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// RFC 8291 section 3.4: the content-encryption key and nonce for one message
function encrypt(payload, uaPublicB64, authB64, opts) {
  opts = opts || {};
  const uaPublic = unb64u(uaPublicB64), auth = unb64u(authB64);
  if (uaPublic.length !== 65 || auth.length !== 16) throw new Error('bad subscription keys');
  const ecdh = crypto.createECDH('prime256v1');
  if (opts.asPrivate) ecdh.setPrivateKey(unb64u(opts.asPrivate)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = opts.salt ? unb64u(opts.salt) : crypto.randomBytes(16);
  const prkKey = hmac(auth, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const rs = 4096;
  const plain = Buffer.concat([Buffer.from(payload), Buffer.from([2])]); // one record, last-record delimiter, no padding
  if (plain.length + 16 > rs) throw new Error('payload too large');
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(rs, 16); head[20] = asPublic.length;
  return Buffer.concat([head, asPublic, body]);
}

// the receiving side, for tests: what a browser does with the bytes
function decrypt(buf, uaPrivateB64, uaPublicB64, authB64) {
  const salt = buf.subarray(0, 16), idlen = buf[20], asPublic = buf.subarray(21, 21 + idlen), ct = buf.subarray(21 + idlen);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.setPrivateKey(unb64u(uaPrivateB64));
  const uaPublic = unb64u(uaPublicB64), auth = unb64u(authB64), shared = ecdh.computeSecret(asPublic);
  const ikm = hmac(hmac(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = plain.length - 1; while (end >= 0 && plain[end] === 0) end--; // strip padding, then the delimiter
  return plain.subarray(0, end).toString();
}

// a VAPID key pair as raw base64url (public: 65-byte uncompressed point, private: 32 bytes)
function newKeys() { const e = crypto.createECDH('prime256v1'); e.generateKeys(); return { publicKey: b64u(e.getPublicKey()), privateKey: b64u(e.getPrivateKey()) }; }
function keyObject(pub, priv) {
  const P = unb64u(pub);
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u(unb64u(priv)), x: b64u(P.subarray(1, 33)), y: b64u(P.subarray(33, 65)) }, format: 'jwk' });
}
// RFC 8292: a short-lived JWT for the push service's origin, signed ES256
function vapidHeader(endpoint, keys, subject, now) {
  const aud = new URL(endpoint).origin, exp = Math.floor((now || Date.now()) / 1000) + 12 * 3600;
  const unsigned = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' })) + '.' + b64u(JSON.stringify({ aud, exp, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key: keyObject(keys.publicKey, keys.privateKey), dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + unsigned + '.' + b64u(sig) + ', k=' + keys.publicKey;
}

module.exports = function makePush(o) {
  o = o || {};
  let keys = null;
  if (process.env.SIXTOP_VAPID_PUBLIC && process.env.SIXTOP_VAPID_PRIVATE) keys = { publicKey: process.env.SIXTOP_VAPID_PUBLIC, privateKey: process.env.SIXTOP_VAPID_PRIVATE };
  else if (o.dir) {
    const f = path.join(o.dir, 'vapid.json');
    // keys made once and kept: new keys would silently break every phone's subscription, so a file that won't read stops the server
    let raw = null; try { raw = fs.readFileSync(f, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (raw != null) { try { keys = JSON.parse(raw); } catch (e) { throw new Error(f + ' could not be read (' + e.message + '). Restore it from a backup; new keys would turn off everyone’s notifications.'); } }
    else { keys = newKeys(); try { fs.mkdirSync(o.dir, { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(keys)); fs.renameSync(f + '.tmp', f); } catch (e2) { console.error('could not save push keys', e2.message); } }
  } else keys = newKeys();
  const subject = o.subject || process.env.SIXTOP_VAPID_SUBJECT || 'mailto:push@sixtop.invalid';
  // bad keys (pasted the wrong way round, cut short) fail here at startup, not on the first notification
  try { vapidHeader('https://push.example.com/x', keys, subject); } catch (e) { throw new Error('The push keys (SIXTOP_VAPID_PUBLIC and SIXTOP_VAPID_PRIVATE, or vapid.json) aren’t a valid pair: ' + e.message); }
  function send(sub, payload, opt) {
    opt = opt || {};
    return new Promise((resolve) => {
      let u; try { u = new URL(sub.endpoint); } catch (e) { return resolve({ ok: false, gone: true, status: 0 }); }
      if (u.protocol !== 'https:' && !o.allowHttp) return resolve({ ok: false, gone: true, status: 0 });
      let body, auth; try { body = encrypt(typeof payload === 'string' ? payload : JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth); } catch (e) { return resolve({ ok: false, gone: true, status: 0 }); }
      try { auth = vapidHeader(sub.endpoint, keys, subject); } catch (e) { return resolve({ ok: false, gone: false, status: 0 }); }
      const req = (u.protocol === 'https:' ? https : http).request(u, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', 'Content-Length': body.length, TTL: String(opt.ttl || 6 * 3600), Urgency: opt.urgency || 'normal', Topic: opt.topic ? String(opt.topic).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : undefined, Authorization: auth },
        timeout: 10000,
      }, (res) => { res.resume(); res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, gone: [401, 403, 404, 410].indexOf(res.statusCode) >= 0 })); });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', () => resolve({ ok: false, status: 0, gone: false }));
      req.end(body);
    });
  }
  return { publicKey: keys.publicKey, send, keys };
};
module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;
module.exports.vapidHeader = vapidHeader;
module.exports.newKeys = newKeys;
module.exports.b64u = b64u;
module.exports.unb64u = unb64u;
