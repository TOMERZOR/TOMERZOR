import { MotionDetector, sensitivityToThreshold, toGray } from './motion.js';
import * as ntfy from './ntfy.js';

const $ = id => document.getElementById(id);

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('shomer.' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem('shomer.' + key, JSON.stringify(value)); } catch {}
  },
};

const settings = Object.assign({
  mode: 'motion', sens: 6, name: '', cooldown: 30, arm: 10, facing: 'environment',
  photo: true, urgent: true, server: ntfy.DEFAULT_SERVER, topic: null,
}, store.get('settings', {}));
if (!settings.topic) settings.topic = ntfy.newTopic();
const saveSettings = () => store.set('settings', settings);
saveSettings();

const cameraName = () => settings.name.trim() || 'המצלמה';
const clock = (date = new Date()) => date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
  if (id !== 'listen') stopListening();
  if (id === 'cam-setup') renderSetup();
  if (id === 'listen-join') $('join-topic').value = store.get('listenTopic', '');
  if (id === 'home' && location.hash) history.replaceState(null, '', location.pathname);
}

document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const label = button.textContent;
    button.textContent = 'הועתק ✓';
    setTimeout(() => (button.textContent = label), 1500);
  } catch {}
}

// ---------- Camera setup ----------

const MODE_NOTES = {
  motion: 'מתריע על כל תנועה בתמונה. פשוט ומהיר, אבל גם חתול או וילון שזז יפעילו אותו.',
  people: 'מתריע רק כשהמצלמה מזהה אדם (בינה מלאכותית שרצה במכשיר עצמו). פחות התראות שווא, וצריך אינטרנט כדי לטעון אותה בפעם הראשונה.',
};

function pairUrl() {
  let url = `${location.origin}${location.pathname}#listen=${settings.topic}`;
  if (settings.server !== ntfy.DEFAULT_SERVER) url += `&s=${encodeURIComponent(settings.server)}`;
  return url;
}

function renderSetup() {
  $('topic').textContent = settings.topic;
  const qr = qrcode(0, 'M');
  qr.addData(pairUrl());
  qr.make();
  $('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });

  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', b.dataset.mode === settings.mode));
  $('mode-note').textContent = MODE_NOTES[settings.mode];
  $('sens').value = settings.sens;
  $('sens-out').textContent = settings.sens;
  $('name').value = settings.name;
  $('cooldown').value = settings.cooldown;
  $('arm').value = settings.arm;
  $('facing').value = settings.facing;
  $('photo').checked = settings.photo;
  $('urgent').checked = settings.urgent;
  $('server').value = settings.server === ntfy.DEFAULT_SERVER ? '' : settings.server;
  $('test-status').textContent = '';
}

document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  settings.mode = b.dataset.mode;
  saveSettings();
  renderSetup();
  if (settings.mode === 'people') loadPeopleModel().catch(() => {});
}));

const bind = (id, key, read) => $(id).addEventListener('input', () => {
  settings[key] = read($(id));
  saveSettings();
  if (id === 'sens') $('sens-out').textContent = settings.sens;
});
bind('sens', 'sens', el => +el.value);
bind('name', 'name', el => el.value);
bind('cooldown', 'cooldown', el => +el.value);
bind('arm', 'arm', el => +el.value);
bind('facing', 'facing', el => el.value);
bind('photo', 'photo', el => el.checked);
bind('urgent', 'urgent', el => el.checked);

$('server').addEventListener('change', () => {
  const v = $('server').value.trim().replace(/\/+$/, '');
  settings.server = /^https?:\/\/\S+$/.test(v) ? v : ntfy.DEFAULT_SERVER;
  saveSettings();
  renderSetup();
});

$('new-topic').addEventListener('click', () => {
  if (!confirm('ליצור ערוץ חדש? טלפונים שכבר מחוברים יפסיקו לקבל התראות עד שיסרקו שוב.')) return;
  settings.topic = ntfy.newTopic();
  saveSettings();
  renderSetup();
});

$('copy-topic').addEventListener('click', e => copy(settings.topic, e.currentTarget));

$('test-send').addEventListener('click', async () => {
  const out = $('test-status');
  out.textContent = 'שולח…';
  try {
    await ntfy.publish(settings.server, settings.topic, {
      title: 'בדיקה: שומר מחובר',
      message: `${cameraName()}: אם קיבלת את זה, הכול עובד.`,
      tags: 'white_check_mark',
      priority: 3,
    });
    out.textContent = 'נשלח ✓ בדוק שההתראה הגיעה לטלפון שלך.';
  } catch {
    out.textContent = 'השליחה נכשלה. בדוק שיש חיבור לאינטרנט.';
  }
});

// ---------- People detection (COCO-SSD, loaded only when needed) ----------

let modelPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('load ' + src));
    document.head.append(s);
  });
}

function loadPeopleModel() {
  modelPromise ||= (async () => {
    if (!window.tf) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    if (!window.cocoSsd) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
    return window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
  })().catch(err => {
    modelPromise = null;
    throw err;
  });
  return modelPromise;
}

// ---------- Watching ----------

const video = $('video');
const overlay = $('overlay');
const octx = overlay.getContext('2d');
const small = document.createElement('canvas');
const sctx = small.getContext('2d', { willReadFrequently: true });
const SMALL_W = 160;
const TICK_MS = 125;

let run = null;

function setStatus(text, kind = 'ok') {
  const el = $('status');
  if (el.textContent !== text) el.textContent = text;
  el.dataset.kind = kind;
}

async function openCamera() {
  run.stream?.getTracks().forEach(t => t.stop());
  run.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: settings.facing }, width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = run.stream;
  await video.play().catch(() => {});
  run.detector.reset();
}

async function requestWakeLock() {
  try {
    if (run && navigator.wakeLock && !document.hidden) run.wake = await navigator.wakeLock.request('screen');
  } catch {}
}

$('start').addEventListener('click', async () => {
  show('cam-run');
  run = {
    detector: new MotionDetector(),
    hot: 0,
    lastAlert: 0,
    sent: 0,
    armedAt: Date.now() + settings.arm * 1000,
    lastDetect: 0,
    detecting: false,
    model: null,
    marks: [],
  };
  $('sent-count').textContent = '0 התראות';
  $('last-sent').textContent = '';
  setStatus('פותח את המצלמה…', 'wait');
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera api');
    await openCamera();
  } catch {
    setStatus('אין גישה למצלמה. אשר גישה למצלמה בדפדפן ונסה שוב.', 'err');
    return;
  }
  if (settings.mode === 'people') {
    loadPeopleModel().then(m => run && (run.model = m), () => run && (run.model = false));
  }
  requestWakeLock();
  tick();
});

function stopWatching() {
  if (!run) return;
  clearTimeout(run.timer);
  run.stream?.getTracks().forEach(t => t.stop());
  run.wake?.release().catch(() => {});
  video.srcObject = null;
  run = null;
  $('curtain').hidden = true;
}

$('stop').addEventListener('click', () => {
  stopWatching();
  show('cam-setup');
});

$('blackout').addEventListener('click', () => ($('curtain').hidden = false));
$('curtain').addEventListener('click', () => ($('curtain').hidden = true));

function tick() {
  if (!run) return;
  run.timer = setTimeout(tick, TICK_MS);
  const vw = video.videoWidth, vh = video.videoHeight;
  if (video.readyState < 2 || !vw) return;

  const w = SMALL_W, h = Math.round((SMALL_W * vh) / vw);
  if (small.width !== w || small.height !== h) {
    small.width = w;
    small.height = h;
    run.gray = new Uint8Array(w * h);
  }
  sctx.drawImage(video, 0, 0, w, h);
  toGray(sctx.getImageData(0, 0, w, h).data, run.gray);
  const r = run.detector.process(run.gray, w, h);
  const threshold = sensitivityToThreshold(settings.sens);
  const scale = vw / w;
  const box = r.box && { x: r.box.x * scale, y: r.box.y * scale, w: r.box.w * scale, h: r.box.h * scale };

  const now = Date.now();
  run.hot = r.score >= threshold ? run.hot + 1 : 0;
  const moving = run.hot >= 2;
  drawOverlay(vw, vh, moving ? box : null, now);
  drawMeter(r.score, threshold);

  if (now < run.armedAt) return setStatus(`מתחיל לשמור בעוד ${Math.ceil((run.armedAt - now) / 1000)} שניות…`, 'wait');
  if (r.warming) return setStatus('מתכונן…', 'wait');

  const cooling = now - run.lastAlert < settings.cooldown * 1000;
  const peopleOnly = settings.mode === 'people' && run.model !== false;
  if (moving && !cooling) {
    if (!peopleOnly) trigger('motion', box);
    else if (run.model) checkForPeople();
  }

  if (cooling) setStatus(`🚨 התראה נשלחה ${$('last-sent').dataset.time || ''}`, 'alert');
  else if (peopleOnly && !run.model) setStatus('טוען זיהוי אנשים…', 'wait');
  else if (moving) setStatus(peopleOnly ? 'יש תנועה, בודק אם זה אדם…' : 'תנועה!', 'move');
  else if (settings.mode === 'people' && run.model === false) setStatus('שומר (זיהוי אנשים לא נטען, מתריע על כל תנועה)', 'ok');
  else setStatus('שומר', 'ok');
}

async function checkForPeople() {
  const now = Date.now();
  if (run.detecting || now - run.lastDetect < 600) return;
  run.detecting = true;
  const current = run;
  try {
    // Detect on a frozen frame and send that same frame, so the box matches the photo.
    const frame = grabFrame(video);
    const found = await current.model.detect(frame, 10, 0.4);
    const person = found.filter(p => p.class === 'person' && p.score >= 0.55).sort((a, b) => b.score - a.score)[0];
    if (person && run === current) {
      const [x, y, w, h] = person.bbox;
      trigger('person', { x, y, w, h }, frame);
    }
  } catch {}
  current.detecting = false;
  current.lastDetect = Date.now();
}

function drawOverlay(vw, vh, box, now) {
  if (overlay.width !== vw || overlay.height !== vh) {
    overlay.width = vw;
    overlay.height = vh;
  }
  octx.clearRect(0, 0, vw, vh);
  run.marks = run.marks.filter(m => now - m.at < 2000);
  octx.lineWidth = Math.max(2, vw / 160);
  if (box) {
    octx.strokeStyle = '#ffb703';
    octx.strokeRect(box.x, box.y, box.w, box.h);
  }
  for (const m of run.marks) {
    octx.strokeStyle = '#ff3b4e';
    octx.strokeRect(m.box.x, m.box.y, m.box.w, m.box.h);
  }
}

function drawMeter(score, threshold) {
  // The mark sits in the middle: past it, the frame counts as motion.
  const level = Math.min(1, score / threshold / 2);
  $('meter').style.width = (level * 100).toFixed(1) + '%';
  $('meter').classList.toggle('over', score >= threshold);
}

function grabFrame(source) {
  const c = document.createElement('canvas');
  c.width = source.videoWidth;
  c.height = source.videoHeight;
  c.getContext('2d').drawImage(source, 0, 0);
  return c;
}

// frame: the video itself, or a canvas from grabFrame() at full video size.
function snapshot(box, frame = video) {
  const vw = frame.videoWidth || frame.width, vh = frame.videoHeight || frame.height;
  const scale = Math.min(1, 800 / vw);
  const c = document.createElement('canvas');
  c.width = Math.round(vw * scale);
  c.height = Math.round(vh * scale);
  const ctx = c.getContext('2d');
  ctx.drawImage(frame, 0, 0, c.width, c.height);
  if (box) {
    ctx.strokeStyle = '#ff3b4e';
    ctx.lineWidth = Math.max(3, c.width / 160);
    ctx.strokeRect(box.x * scale, box.y * scale, box.w * scale, box.h * scale);
  }
  return new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.75));
}

async function trigger(kind, box, frame) {
  const current = run;
  const at = new Date();
  current.lastAlert = at.getTime();
  if (box) current.marks.push({ box, at: at.getTime() });
  $('last-sent').dataset.time = clock(at);
  try {
    const image = settings.photo ? await snapshot(box, frame) : null;
    await ntfy.publish(settings.server, settings.topic, {
      title: kind === 'person' ? `זוהה אדם · ${cameraName()}` : `זוהתה תנועה · ${cameraName()}`,
      message: `${cameraName()} · ${clock(at)}`,
      tags: kind === 'person' ? 'bust_in_silhouette,rotating_light' : 'rotating_light',
      priority: settings.urgent ? 5 : 4,
      image,
    });
    current.sent++;
    $('sent-count').textContent = current.sent === 1 ? 'התראה אחת' : `${current.sent} התראות`;
    $('last-sent').textContent = `אחרונה: ${clock(at)}`;
  } catch {
    // Let it try again in a few seconds instead of waiting out the whole pause.
    current.lastAlert = Date.now() - settings.cooldown * 1000 + 5000;
    $('last-sent').textContent = `השליחה נכשלה ${clock()}, בדוק אינטרנט`;
  }
}

document.addEventListener('visibilitychange', async () => {
  if (!run) return;
  if (document.hidden) {
    run.wasHidden = true;
    ntfy.beacon(settings.server, settings.topic, {
      title: `שומר עבר לרקע · ${cameraName()}`,
      message: 'המסך כבה או שנפתחה אפליקציה אחרת, ולכן ייתכן שהמצלמה הפסיקה לשמור. פתח את שומר שוב במכשיר.',
      tags: 'warning',
      priority: 4,
    });
    return;
  }
  requestWakeLock();
  const track = run.stream?.getVideoTracks()[0];
  if (!track || track.readyState === 'ended') {
    try { await openCamera(); } catch { return setStatus('המצלמה נסגרה. לחץ עצור ואז התחל שוב.', 'err'); }
  }
  run.detector.reset();
  if (run.wasHidden) {
    run.wasHidden = false;
    ntfy.publish(settings.server, settings.topic, {
      title: `שומר חזר לשמור · ${cameraName()}`,
      message: clock(),
      tags: 'eyes',
      priority: 2,
    }).catch(() => {});
  }
});

// ---------- Receiving ----------

let listen = null;

function startListening(topic, server = ntfy.DEFAULT_SERVER) {
  stopListening();
  store.set('listenTopic', topic);
  show('listen');
  listen = { topic, server, seen: new Set() };
  $('listen-topic').textContent = topic;
  $('open-ntfy').href = `ntfy://${new URL(server).host}/${topic}`;
  $('alerts').innerHTML = '<li class="empty">עוד אין התראות.</li>';
  setConn('wait', 'מתחבר…');

  const current = listen;
  ntfy.history(server, topic).then(msgs => {
    if (listen === current) msgs.forEach(m => addAlert(m, false));
  }).catch(() => {});

  const es = new EventSource(ntfy.sseUrl(server, topic));
  current.es = es;
  es.onopen = () => setConn('ok', 'מחובר. ההתראות יופיעו כאן.');
  es.onerror = () => setConn('wait', 'מתחבר מחדש…');
  es.onmessage = e => {
    try {
      const m = JSON.parse(e.data);
      if (m.event === 'message') addAlert(m, true);
    } catch {}
  };
}

function stopListening() {
  listen?.es?.close();
  listen = null;
}

function setConn(kind, text) {
  $('conn-dot').dataset.kind = kind;
  $('conn-text').textContent = text;
}

function addAlert(m, live) {
  if (listen.seen.has(m.id)) return;
  listen.seen.add(m.id);
  const list = $('alerts');
  list.querySelector('.empty')?.remove();

  const li = document.createElement('li');
  const head = document.createElement('div');
  head.className = 'alert-head';
  const title = document.createElement('b');
  title.textContent = m.title || 'שומר';
  const time = document.createElement('time');
  time.textContent = clock(new Date(m.time * 1000));
  head.append(title, time);
  li.append(head);
  if (m.attachment?.url && (m.attachment.type || '').startsWith('image/')) {
    const img = document.createElement('img');
    img.src = m.attachment.url;
    img.alt = 'תמונה מהמצלמה';
    img.loading = 'lazy';
    li.append(img);
  } else if (m.message && m.message !== 'You received a file: shomer.jpg') {
    const p = document.createElement('p');
    p.textContent = m.message;
    li.append(p);
  }
  if (live) li.classList.add('new');

  // History arrives oldest first and live messages are newest, so newest always goes on top.
  list.prepend(li);
  while (list.children.length > 30) list.lastElementChild.remove();
  if (live) ring(m);
}

let audio = null;

$('enable-alerts').addEventListener('click', async e => {
  const button = e.currentTarget;
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  await audio.resume().catch(() => {});
  if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission().catch(() => {});
  beep(1);
  button.textContent = '✓ צליל והתראות פעילים';
  button.classList.add('done');
});

function beep(times = 3) {
  if (!audio || audio.state !== 'running') return;
  const t0 = audio.currentTime;
  for (let i = 0; i < times * 2; i++) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = i % 2 ? 660 : 880;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.2);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + i * 0.22);
    osc.stop(t0 + i * 0.22 + 0.21);
  }
}

function ring(m) {
  beep();
  navigator.vibrate?.([400, 150, 400, 150, 400]);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification(m.title || 'שומר', { body: m.message, tag: m.id, icon: 'img/icon.png' }); } catch {}
  }
}

$('copy-listen').addEventListener('click', e => copy(listen?.topic || '', e.currentTarget));

$('join-form').addEventListener('submit', e => {
  e.preventDefault();
  const topic = $('join-topic').value.trim();
  if (!ntfy.isValidTopic(topic)) {
    $('join-topic').setCustomValidity('קוד ערוץ לא תקין');
    $('join-topic').reportValidity();
    return;
  }
  $('join-topic').setCustomValidity('');
  history.replaceState(null, '', `#listen=${topic}`);
  startListening(topic);
});
$('join-topic').addEventListener('input', () => $('join-topic').setCustomValidity(''));

// ---------- Routing (#listen=<topic>&s=<server> comes from the pairing QR) ----------

function route() {
  const params = new URLSearchParams(location.hash.slice(1));
  const topic = params.get('listen');
  if (topic && ntfy.isValidTopic(topic)) {
    stopWatching();
    let server = ntfy.DEFAULT_SERVER;
    const s = params.get('s');
    if (s && /^https?:$/.test(new URL(s, location.href).protocol)) server = s.replace(/\/+$/, '');
    startListening(topic, server);
  }
}

window.addEventListener('hashchange', route);
route();
