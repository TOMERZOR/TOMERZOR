// Encrypts js/roster.js (the real cast) into js/roster.enc.js, which is safe to publish:
// without the key nobody can read it. The key goes only into the invite link
// (https://…/netibot/#l=<lobby>&k=<key>), so whoever gets the link sees the real names.
// The key is kept in tools/roster.key and js/roster.key.js (both git-ignored) and reused,
// so links already sent keep working. Usage: node tools/encrypt-roster.js
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

const dir = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(dir, 'js/roster.js'), 'utf8');
const ROSTER = new Function(src + '; return ROSTER;')();
// Cartoon portraits of the real cast (tools/faces/<id>.webp, git-ignored) travel inside the
// encrypted roster too, so the public repo has neither the names nor the faces.
const faceDir = path.join(__dirname, 'faces');
if (fs.existsSync(faceDir)) {
  ROSTER.faces = {};
  for (const f of fs.readdirSync(faceDir)) {
    const m = f.match(/^([\w-]+)\.(webp|png|jpg)$/);
    if (m) ROSTER.faces[m[1]] = `data:image/${m[2] === 'jpg' ? 'jpeg' : m[2]};base64,` + fs.readFileSync(path.join(faceDir, f)).toString('base64');
  }
  console.log('faces:', Object.keys(ROSTER.faces).length);
}
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

(async () => {
  const keyFile = path.join(__dirname, 'roster.key');
  const raw = fs.existsSync(keyFile) ? Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64url') : webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  // Their rigged 3D models (tools/people/<id>.glb, packed with tools/pack-person.py) are
  // gzipped and encrypted with the same key into assets/people/<hash>.bin; the roster only
  // says which file is whose.
  const peopleIn = path.join(__dirname, 'people'), peopleOut = path.join(dir, 'assets/people');
  if (fs.existsSync(peopleIn)) {
    fs.mkdirSync(peopleOut, { recursive: true });
    for (const f of fs.readdirSync(peopleOut)) if (f.endsWith('.bin')) fs.unlinkSync(path.join(peopleOut, f));
    ROSTER.models = {};
    for (const f of fs.readdirSync(peopleIn)) {
      const m = f.match(/^([\w-]+)\.glb$/);
      if (!m) continue;
      const name = require('crypto').createHash('sha256').update(b64u(raw) + ':' + m[1]).digest('hex').slice(0, 16);
      const fiv = webcrypto.getRandomValues(new Uint8Array(12));
      const enc = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: fiv }, key, require('zlib').gzipSync(fs.readFileSync(path.join(peopleIn, f)), { level: 9 }));
      fs.writeFileSync(path.join(peopleOut, name + '.bin'), Buffer.concat([Buffer.from(fiv), Buffer.from(enc)]));
      ROSTER.models[m[1]] = name;
    }
    console.log('models:', Object.keys(ROSTER.models).length);
  }
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const data = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(ROSTER)));
  fs.writeFileSync(path.join(dir, 'js/roster.enc.js'),
    '// The real cast, encrypted (tools/encrypt-roster.js). The key is only in the invite link.\n' +
    `var ROSTER_ENC = ${JSON.stringify({ iv: b64u(iv), data: b64u(data) })};\n`);
  fs.writeFileSync(keyFile, b64u(raw) + '\n');
  fs.writeFileSync(path.join(dir, 'js/roster.key.js'), `// Git-ignored: lets this copy build invite links with the key.\nvar ROSTER_KEY = '${b64u(raw)}';\n`);
  console.log('wrote js/roster.enc.js; key', b64u(raw));
})();
