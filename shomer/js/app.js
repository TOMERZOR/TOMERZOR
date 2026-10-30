import { MotionDetector, sensitivityToThreshold, toGray } from './motion.js';
import { Link, linkSupported, isCode, newKey, codeFor, keyFrom } from './link.js';
import { scanVideo } from './scan.js';
import { cameraKeys, sendPush, pushSupport, subscribe } from './push.js';

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

const settings = Object.assign(
  { mode: 'people', sens: 6, name: '', cooldown: 15, arm: 10, facing: 'environment', photo: true, dark: true },
  store.get('settings', {}),
);
const saveSettings = () => store.set('settings', settings);

const cameraName = () => settings.name.trim() || 'המצלמה';
const clock = (date = new Date()) => date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
  if (id !== 'pair') stopPhoneScan();
  if (id !== 'listen' && id !== 'pair') closePhone();
  if (id === 'cam-setup') renderSetup();
  if (id === 'pair') startPhonePairing();
}

document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.go === 'pair') {
    unlockAudio();
    if (awakeVideo.paused) awakeVideo.play().catch(() => {});
  }
  show(b.dataset.go);
}));

function drawQr(el, text) {
  const qr = qrcode(0, 'L');
  qr.addData(text);
  qr.make();
  el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
}

// If the screen turns off, the browser stops the page and the link between the devices drops.
// The Wake Lock API keeps it on; where that's missing or broken (iPhone web apps before iOS 18.4),
// a tiny silent video playing in a loop does the same job.
const awakeVideo = Object.assign(document.createElement('video'), { src: 'img/keepawake.mp4', muted: true, loop: true, playsInline: true });
awakeVideo.setAttribute('playsinline', '');

async function keepAwake(holder) {
  if (awakeVideo.paused) awakeVideo.play().catch(() => {});
  try {
    if (navigator.wakeLock && !document.hidden) holder.wake = await navigator.wakeLock.request('screen');
  } catch {}
}

// ---------- Offline: everything is cached by the service worker after the first visit ----------

async function checkOffline() {
  const el = $('offline-state');
  if (!('serviceWorker' in navigator)) return (el.textContent = 'הדפדפן הזה לא תומך בעבודה בלי אינטרנט.');
  try {
    await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 60; i++) {
      for (const key of await caches.keys()) {
        if (key.startsWith('shomer-') && (await (await caches.open(key)).match('vendor/ssdlite/group1-shard5of5'))) {
          el.textContent = '✓ מוכן לעבודה בלי אינטרנט. מומלץ להוסיף למסך הבית.';
          return;
        }
      }
      el.textContent = 'מוריד את האפליקציה למכשיר כדי שתעבוד גם בלי אינטרנט…';
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch {}
  el.textContent = 'פתח את האתר פעם אחת עם אינטרנט, כדי שיעבוד אחר כך גם בלי.';
}
checkOffline();

// ---------- Camera setup ----------

const MODE_NOTES = {
  motion: 'מתריע על כל תנועה בתמונה. בשטח פתוח גם עלים וענפים ברוח יפעילו אותו.',
  people: 'מתריע רק כשמזוהה אדם (בינה מלאכותית שרצה במכשיר עצמו). מומלץ בשטח פתוח ובין שיחים.',
};

function renderSetup() {
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', b.dataset.mode === settings.mode));
  $('mode-note').textContent = MODE_NOTES[settings.mode];
  $('sens').value = settings.sens;
  $('sens-out').textContent = settings.sens;
  $('name').value = settings.name;
  $('cooldown').value = settings.cooldown;
  $('arm').value = settings.arm;
  $('facing').value = settings.facing;
  $('photo').checked = settings.photo;
  $('dark').checked = settings.dark;
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
bind('dark', 'dark', el => el.checked);

// ---------- People detection (COCO-SSD, shipped with the app, runs on the device) ----------

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
    if (!window.tf) await loadScript('vendor/tf.min.js');
    if (!window.cocoSsd) await loadScript('vendor/coco-ssd.min.js');
    return window.cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: 'vendor/ssdlite/model.json' });
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
  if (run) run.statusKind = kind;
}

async function openCamera() {
  run.stream?.getTracks().forEach(t => t.stop());
  run.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: settings.facing }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } },
    audio: false,
  });
  video.srcObject = run.stream;
  await video.play().catch(() => {});
  run.detector.reset();
}

$('start').addEventListener('click', async () => {
  // Full screen hides the status bar (clock, icons), which would otherwise stay lit. Android only.
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
  show('cam-run');
  if (awakeVideo.paused) awakeVideo.play().catch(() => {});
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
    pending: new Map(),
    liveOn: true,
    lastPreview: 0,
    phoneSeen: 0,
    phoneVisible: false,
    pushSub: store.get('pushSub', null),
  };
  cameraKeys(store).then(k => run && (run.keys = k)).catch(() => {});
  $('push-state').textContent = run.pushSub ? '📲 פוש מוכן' : '';
  $('sent-count').textContent = '';
  $('last-sent').textContent = '';
  $('link-state').textContent = '';
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
  keepAwake(run);
  tick();
  run.heartbeat = setInterval(sendHeartbeat, 2000);
  if (linkSupported()) startCameraLink();
  else $('link-state').textContent = 'הדפדפן הזה לא תומך בחיבור לטלפון';
});

function stopWatching() {
  if (!run) return;
  clearTimeout(run.timer);
  clearInterval(run.heartbeat);
  run.link?.close();
  run.stream?.getTracks().forEach(t => t.stop());
  run.wake?.release().catch(() => {});
  video.srcObject = null;
  run = null;
  if (!phone) awakeVideo.pause();
  setDark(false);
  $('pair-panel').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

$('stop').addEventListener('click', () => {
  if (run?.link?.open && !confirm('לעצור את השמירה? הטלפון יתנתק.')) return;
  stopWatching();
  show('cam-setup');
});

// Dark screen. Only a 2-second press brings the display back, so leaves or a brush of the hand
// in the bushes can't light it up or reach the buttons.
function setDark(on) {
  const curtain = $('curtain');
  if (on && !curtain.hidden) return;
  curtain.hidden = !on;
  // Restart the hint's fade-out each time.
  const hint = $('curtain-hint');
  hint.style.animation = 'none';
  void hint.offsetWidth;
  hint.style.animation = '';
  document.querySelector('meta[name="theme-color"]').content = on ? '#000000' : '#0d1321';
}

$('blackout').addEventListener('click', () => setDark(true));

let holdTimer = null;
const curtain = $('curtain');
curtain.addEventListener('pointerdown', () => {
  curtain.classList.add('holding');
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    curtain.classList.remove('holding');
    setDark(false);
  }, 2000);
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  curtain.addEventListener(type, () => {
    clearTimeout(holdTimer);
    curtain.classList.remove('holding');
  });
}
curtain.addEventListener('contextmenu', e => e.preventDefault());

// ----- Link, camera side: the pairing code holds the key; the phone scans it once -----

function startCameraLink() {
  const current = run;
  let key = store.get('roomKey', null);
  if (!key) {
    key = newKey();
    store.set('roomKey', key);
  }
  current.link?.close();
  const link = (current.link = new Link(key, 'camera'));
  drawQr($('pair-qr'), codeFor(key));
  $('pair-panel').hidden = false;
  $('pair-again').hidden = true;
  link.on('open', () => run === current && current.link === link && onPhoneConnected());
  link.on('message', msg => run === current && onPhoneMessage(msg));
  link.on('state', state => run === current && current.link === link && onLinkState(state));
  onLinkState('offline');
}

$('pair-again').addEventListener('click', () => {
  if (!run) return;
  $('pair-panel').hidden = false;
  $('pair-again').hidden = true;
});
$('pair-new').addEventListener('click', () => {
  if (!run || !confirm('ליצור קוד חדש? טלפונים שכבר מחוברים יתנתקו ויצטרכו לסרוק מחדש.')) return;
  store.set('roomKey', null);
  store.set('pushSub', null);
  run.pushSub = null;
  $('push-state').textContent = '';
  startCameraLink();
});
$('pair-skip').addEventListener('click', () => {
  if (!run) return;
  $('pair-panel').hidden = true;
  $('pair-again').hidden = false;
  if (settings.dark) setDark(true);
});

function onPhoneConnected() {
  $('pair-panel').hidden = true;
  $('pair-again').hidden = true;
  $('link-state').textContent = '🔗 הטלפון מחובר';
  run.phoneSeen = Date.now();
  if (settings.dark) setDark(true);
  sendHeartbeat();
  // The phone needs the camera's public key to subscribe to pushes from it.
  cameraKeys(store).then(k => {
    run.keys = k;
    run.link?.send({ type: 'push-key', key: k.publicKey });
  }).catch(() => {});
  // Alerts the phone hasn't confirmed yet (it was away, or the link dropped mid-way).
  for (const msg of run.pending.values()) run.link.send(msg);
}

// The link reconnects by itself; this only says where things stand.
function onLinkState(state) {
  const text = {
    offline: '🌐 אין חיבור לאינטרנט, מנסה שוב…',
    waiting: '📵 הטלפון לא מחובר',
    connected: '🔗 הטלפון מחובר',
  }[state];
  $('link-state').textContent = text;
  $('pair-status').textContent = state === 'offline' ? text : state === 'waiting' ? 'מחכה שהטלפון יסרוק את הקוד… (טלפון שכבר סרק אותו מתחבר לבד)' : '';
  if (state !== 'connected' && $('pair-panel').hidden) $('pair-again').hidden = false;
}

function onPhoneMessage(msg) {
  if (!run.phoneSeen || Date.now() - run.phoneSeen > 10000) $('link-state').textContent = '🔗 הטלפון מחובר';
  run.phoneSeen = Date.now();
  if (msg.type === 'live') run.liveOn = !!msg.on;
  if (msg.type === 'hb' && 'visible' in msg) run.phoneVisible = !!msg.visible;
  if (msg.type === 'ack') run.pending.delete(msg.id);
  if (msg.type === 'push-sub' && msg.sub?.endpoint) {
    run.pushSub = msg.sub;
    store.set('pushSub', msg.sub);
    if (!msg.quiet) testPush();
  }
  if (msg.type === 'push-test') testPush();
  if (msg.type === 'ping') run.link.send({ type: 'pong', t: msg.t });
}

async function sendHeartbeat() {
  if (!run?.link?.open) return;
  // The phone sends heartbeats too; say so on the camera if they stop.
  if (Date.now() - run.phoneSeen > 10000) $('link-state').textContent = '📵 הטלפון לא עונה';
  let battery = null;
  try {
    const b = await navigator.getBattery?.();
    if (b) battery = { level: Math.round(b.level * 100), charging: b.charging };
  } catch {}
  run?.link?.send({ type: 'hb', name: cameraName(), battery, status: run.statusKind });
}

// ----- Detection loop -----

function tick() {
  if (!run) return;
  run.timer = setTimeout(tick, TICK_MS);
  const vw = video.videoWidth, vh = video.videoHeight;
  if (video.readyState < 2 || !vw) return;

  const w = SMALL_W, h = Math.round((SMALL_W * vh) / vw);
  if (small.width !== w || small.height !== h) {
    small.width = w;
    small.height = h;
  }
  if (run.gray?.length !== w * h) run.gray = new Uint8Array(w * h);
  sctx.drawImage(video, 0, 0, w, h);
  toGray(sctx.getImageData(0, 0, w, h).data, run.gray);
  const r = run.detector.process(run.gray, w, h);
  const threshold = sensitivityToThreshold(settings.sens);
  const scale = vw / w;
  const box = r.box && { x: r.box.x * scale, y: r.box.y * scale, w: r.box.w * scale, h: r.box.h * scale };
  const now = Date.now();

  run.hot = r.score >= threshold ? run.hot + 1 : 0;
  // In people mode the person detector confirms, so one frame of motion is enough to start looking.
  const peopleOnly = settings.mode === 'people' && run.model !== false;
  const moving = run.hot >= (peopleOnly ? 1 : 2);
  // When this burst of motion started; it ends after 3 s of calm.
  if (!moving) {
    run.calmSince ??= now;
    if (now - run.calmSince > 3000) run.motionSince = 0;
  } else {
    run.calmSince = null;
    run.motionSince ||= now;
  }
  // Nothing to draw while the screen is blacked out.
  if (curtain.hidden) {
    drawOverlay(vw, vh, moving ? box : null, now);
    drawMeter(r.score, threshold);
  }
  // About once a second, a small picture for the phone's preview, with the moving area boxed.
  // Paused for a moment after an alert, so the alert's photo goes out first.
  if (run.liveOn && run.link?.open && now - run.lastPreview >= PREVIEW_MS && now - run.lastAlert > 2000) {
    run.lastPreview = now;
    run.link.sendPreview(previewFrame(moving ? box : null));
  }

  if (now < run.armedAt) return setStatus(`מתחיל לשמור בעוד ${Math.ceil((run.armedAt - now) / 1000)} שניות…`, 'wait');
  if (r.warming) return setStatus('מתכונן…', 'wait');

  const cooling = now - run.lastAlert < settings.cooldown * 1000;
  if (moving && !cooling) {
    if (!peopleOnly) trigger('motion', box);
    else if (run.model) checkForPeople(box);
  }

  if (cooling) setStatus(`🚨 התראה ${$('last-sent').dataset.time || ''}`, 'alert');
  else if (peopleOnly && !run.model) setStatus('טוען זיהוי אנשים…', 'wait');
  else if (moving) setStatus(peopleOnly ? 'יש תנועה, בודק אם זה אדם…' : 'תנועה!', 'move');
  else if (settings.mode === 'people' && run.model === false) setStatus('שומר (זיהוי אנשים לא נטען, מתריע על כל תנועה)', 'ok');
  else setStatus('שומר', 'ok');
}

const PREVIEW_MS = 1000;
const previewCanvas = document.createElement('canvas');

function previewFrame(box) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = 320 / vw;
  previewCanvas.width = 320;
  previewCanvas.height = Math.round(vh * scale);
  const ctx = previewCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);
  if (box) {
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x * scale, box.y * scale, box.w * scale, box.h * scale);
  }
  return previewCanvas.toDataURL('image/jpeg', 0.6);
}

const normalize = (box, vw, vh) => ({ x: box.x / vw, y: box.y / vh, w: box.w / vw, h: box.h / vh });

const PERSON_SCORE = 0.55;

const bestPerson = found => found.filter(p => p.class === 'person' && p.score >= PERSON_SCORE).sort((a, b) => b.score - a.score)[0];

// The model looks at the frame shrunk to about 300px, so a far-away person a few dozen pixels
// tall is easily missed. A zoomed-in square around a small area of motion makes that person
// several times bigger for the model.
function zoomOn(frame, box) {
  const fw = frame.width, fh = frame.height;
  const side = Math.min(fw, fh, Math.max(box.w, box.h, fh / 4) * 2);
  if (side > 0.75 * Math.min(fw, fh)) return null;
  const x0 = Math.max(0, Math.min(fw - side, box.x + box.w / 2 - side / 2));
  const y0 = Math.max(0, Math.min(fh - side, box.y + box.h / 2 - side / 2));
  const crop = document.createElement('canvas');
  crop.width = crop.height = 300;
  crop.getContext('2d').drawImage(frame, x0, y0, side, side, 0, 0, 300, 300);
  return { crop, x0, y0, scale: side / 300 };
}

async function checkForPeople(motionBox) {
  const now = Date.now();
  if (run.detecting || now - run.lastDetect < (run.detectGap || 0)) return;
  run.detecting = true;
  const current = run;
  let found = false;
  try {
    // Detect on a frozen frame and send that same frame, so the box matches the photo.
    const frame = grabFrame(video);
    // When the motion is in a small area, take turns between the whole frame and a zoomed look at
    // that area. One model run per check keeps each check short, so a person is caught sooner.
    const zoom = motionBox && zoomOn(frame, motionBox);
    const zoomed = zoom && (current.zoomTurn = !current.zoomTurn);
    const person = bestPerson(await current.model.detect(zoomed ? zoom.crop : frame, 10, 0.4));
    let bbox = person?.bbox;
    if (person && zoomed) {
      const [x, y, w, h] = person.bbox;
      bbox = [zoom.x0 + x * zoom.scale, zoom.y0 + y * zoom.scale, w * zoom.scale, h * zoom.scale];
    }
    found = !!person;
    if (person && run === current) {
      const [x, y, w, h] = bbox;
      trigger('person', { x, y, w, h }, frame);
    }
  } catch {}
  // Detection is the heaviest work on the phone. Right after motion starts it looks again as soon as
  // it can (leaving the phone a short breather), so a person walking in is caught within a check or
  // two. Only when motion goes on for a while with no one there (wind in the bushes) does it slow
  // down, to at most every 1.5 s, so the phone stays cool.
  const took = Date.now() - now;
  const windy = !found && now - (current.motionSince || now) > 8000;
  current.detectGap = Math.max(100, took * 0.25, windy ? 1500 : 0);
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
  const scale = Math.min(1, 640 / vw);
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
  return c.toDataURL('image/jpeg', 0.7);
}

function trigger(kind, box, frame) {
  const at = new Date();
  run.lastAlert = at.getTime();
  if (box) run.marks.push({ box, at: at.getTime() });
  $('last-sent').dataset.time = clock(at);
  const vw = video.videoWidth, vh = video.videoHeight;
  const msg = {
    type: 'alert',
    id: `${at.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    title: kind === 'person' ? 'זוהה אדם' : 'זוהתה תנועה',
    name: cameraName(),
    at: at.getTime(),
    box: box && normalize(box, vw, vh),
    photo: null,
  };
  run.sent++;
  $('sent-count').textContent = run.sent === 1 ? 'התראה אחת' : `${run.sent} התראות`;
  $('last-sent').textContent = `אחרונה: ${clock(at)}`;
  // Kept until the phone confirms it, and sent again after a reconnect. Only the latest 10.
  run.pending.set(msg.id, msg);
  if (run.pending.size > 10) run.pending.delete(run.pending.keys().next().value);
  // The alert goes out right away, small; its photo follows a moment later, so encoding and
  // uploading ~50 KB never holds up the ring.
  run.link?.send(msg);
  maybePush(msg);
  if (settings.photo) {
    const current = run;
    const source = frame || grabFrame(video);
    setTimeout(() => {
      msg.photo = snapshot(box, source);
      current.link?.send({ type: 'alert-photo', id: msg.id, photo: msg.photo });
    }, 0);
  }
}

// ----- Push to the phone through Apple/Google, for when Shomer isn't on its screen -----

// If the phone has Shomer open on screen, the local link is enough. Otherwise push right away;
// and if the phone doesn't confirm the alert within 1.5 s, push anyway.
function maybePush(msg) {
  if (!run.pushSub) return;
  const watching = run.link?.open && run.phoneVisible && Date.now() - run.phoneSeen < 4000;
  if (!watching) return pushAlert(msg);
  const current = run;
  setTimeout(() => run === current && current.pending.has(msg.id) && pushAlert(msg), 1500);
}

async function pushAlert(msg) {
  const current = run;
  try {
    current.keys ||= await cameraKeys(store);
    const ok = await sendPush(current.pushSub, current.keys, { title: `${msg.title} · ${msg.name}`, body: clock(new Date(msg.at)), tag: msg.id });
    if (run === current) $('push-state').textContent = ok ? `📲 פוש נשלח ${clock()}` : '📲 הפוש נדחה';
    return ok;
  } catch (err) {
    if (err.gone) {
      // The phone turned notifications off or reinstalled; it has to subscribe again.
      store.set('pushSub', null);
      current.pushSub = null;
    }
    if (run === current) $('push-state').textContent = err.gone ? '📲 הפוש בוטל בטלפון' : '📲 אין אינטרנט לפוש';
    return false;
  }
}

async function testPush() {
  if (!run?.pushSub) return;
  const ok = await pushAlert({ title: 'בדיקה', name: cameraName(), at: Date.now(), id: `test-${Date.now()}` });
  run?.link?.send({ type: 'push-result', ok });
}

document.addEventListener('visibilitychange', async () => {
  if (!run || document.hidden) return;
  keepAwake(run);
  const track = run.stream?.getVideoTracks()[0];
  if (!track || track.readyState === 'ended') {
    try { await openCamera(); } catch { return setStatus('המצלמה נסגרה. לחץ עצור ואז התחל שוב.', 'err'); }
  }
  run.detector.reset();
});

// ---------- Phone side ----------

let phone = null;
let scan = null;
const scanVideoEl = $('scan-video');

async function startPhonePairing() {
  stopPhoneScan();
  closePhone();
  $('pair-phone-status').textContent = '';
  if (!linkSupported()) {
    $('pair-phone-status').textContent = 'הדפדפן הזה לא תומך בחיבור. עדכן את הדפדפן.';
    return;
  }
  // Paired before: connect straight away, no scanning.
  const saved = store.get('pairKey', null);
  if (saved) return connectPhone(saved);

  const current = (scan = {});
  try {
    current.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch {
    $('pair-phone-status').textContent = 'אין גישה למצלמה. אשר גישה למצלמה כדי לסרוק את הקוד.';
    return;
  }
  if (scan !== current) return current.stream.getTracks().forEach(t => t.stop());
  scanVideoEl.srcObject = current.stream;
  scanVideoEl.play().catch(() => {});
  current.stop = scanVideo(scanVideoEl, {
    accept: isCode,
    onCode: text => {
      if (scan !== current) return;
      const key = keyFrom(text);
      store.set('pairKey', key);
      connectPhone(key);
    },
  });
}

function stopPhoneScan() {
  if (!scan) return;
  scan.stop?.();
  scan.stream?.getTracks().forEach(t => t.stop());
  scanVideoEl.srcObject = null;
  scan = null;
}

function connectPhone(key) {
  show('listen');
  beginPhone(new Link(key, 'phone'));
}

// ----- Receiving: live view, alerts, link watchdog -----

const liveImg = $('live-img');

function beginPhone(link) {
  const now = Date.now();
  const p = (phone = { link, lastSeen: now, graceUntil: now + 8000, liveOn: store.get('liveOn', true), seenAlerts: new Set(), lastFrame: 0, conn: '' });
  $('alerts').innerHTML = '<li class="empty">עוד אין התראות.</li>';
  $('check-result').textContent = '';
  $('push-card').hidden = true;
  setLive(p.liveOn);
  setConn('connecting');
  keepAwake(p);
  p.watchdog = setInterval(() => watchdog(p), 1000);
  link.on('open', () => {
    if (phone !== p) return;
    p.lastSeen = Date.now();
    setConn('ok');
    link.send({ type: 'live', on: p.liveOn });
    link.send({ type: 'hb', visible: !document.hidden });
  });
  link.on('preview', dataUrl => {
    if (phone !== p || !dataUrl.startsWith('data:image/jpeg')) return;
    liveImg.src = dataUrl;
    p.lastFrame = Date.now();
  });
  link.on('message', msg => phone === p && onCameraMessage(p, msg));
  link.on('state', state => {
    if (phone !== p || state === 'connected') return;
    // The link is already trying again; the watchdog sounds the alarm if it takes too long.
    if (!p.lost) setConn(state === 'offline' ? 'reconnecting' : 'nocamera');
  });
}

function closePhone() {
  if (!phone) return;
  clearInterval(phone.watchdog);
  clearInterval(phone.lostAlarm);
  clearTimeout(phone.pingTimer);
  $('live-quality').textContent = '';
  phone.link.close();
  phone.wake?.release().catch(() => {});
  phone = null;
  if (!run) awakeVideo.pause();
  liveImg.removeAttribute('src');
  $('live-view').classList.remove('big');
}

function onCameraMessage(p, msg) {
  p.lastSeen = Date.now();
  if (p.lost || p.conn !== 'ok') {
    p.lost = false;
    clearInterval(p.lostAlarm);
    setConn('ok');
  }
  if (msg.type === 'hb') {
    if (msg.name !== p.name) {
      p.name = msg.name;
      setConn('ok');
    }
    const b = msg.battery;
    $('battery').textContent = b ? `${b.charging ? '⚡' : '🔋'} ${b.level}%` : '';
    $('battery').classList.toggle('low', !!b && !b.charging && b.level <= 20);
  }
  if (msg.type === 'alert') {
    // Confirm every copy; the camera resends until it hears back.
    p.link.send({ type: 'ack', id: msg.id });
    if (p.seenAlerts.has(msg.id)) return;
    p.seenAlerts.add(msg.id);
    addAlert(msg);
    ring();
    const el = $('live-view');
    el.classList.remove('alarm');
    void el.offsetWidth;
    el.classList.add('alarm');
  }
  if (msg.type === 'alert-photo') attachPhoto(msg.id, msg.photo);
  if (msg.type === 'push-key') {
    p.pushKey = msg.key;
    renderPush(p);
    // Already allowed and subscribed with this camera's key: just hand the subscription over.
    if (store.get('pushKey', '') === msg.key && window.Notification?.permission === 'granted') enablePush(p, true);
  }
  if (msg.type === 'push-result') {
    p.pushBusy = false;
    renderPush(p, msg.ok ? '✓ התראות פעילות. נעל את הטלפון ונסה: ההתראה תופיע למעלה.' : '❌ ההתראה לא נשלחה. לשני הטלפונים צריך להיות אינטרנט.');
  }
  if (msg.type === 'pong') {
    clearTimeout(p.pingTimer);
    $('check-result').textContent = `✓ החיבור תקין (${Math.round(performance.now() - msg.t)} ms)`;
    beep(1);
  }
}

// The camera sends a heartbeat every 2 s; silence means it died, lost its internet or its screen
// went off. The phone sends one back, so the camera can tell too. Right after the phone comes
// back from the background the link needs a moment to reconnect, so there's a short grace period.
function watchdog(p) {
  const now = Date.now();
  if (p.link.open && now - (p.lastHb || 0) >= 2000) {
    p.lastHb = now;
    p.link.send({ type: 'hb', visible: !document.hidden });
  }
  previewAge(p);
  if (document.hidden || now < p.graceUntil) return;
  const quiet = now - p.lastSeen;
  if (quiet > 10000) lostCamera(p);
  else if (quiet > 5000 && p.conn === 'ok') setConn('weak');
}

function lostCamera(p) {
  if (p.lost) return;
  p.lost = true;
  setConn('lost');
  alarmLost();
  p.lostAlarm = setInterval(alarmLost, 15000);
}

// How old the preview picture is. It's a still picture every second, not video.
function previewAge(p) {
  const el = $('live-quality');
  if (!p.liveOn || p.lost || !p.lastFrame) {
    el.textContent = '';
    return;
  }
  const age = Math.round((Date.now() - p.lastFrame) / 1000);
  el.textContent = age <= 1 ? 'עכשיו' : `לפני ${age} שנ׳`;
  el.classList.toggle('bad', age > 5);
}

function setConn(kind) {
  const name = phone?.name || 'המצלמה';
  let text = {
    connecting: 'מתחבר למצלמה…',
    ok: `מחובר ל${name}`,
    weak: 'החיבור למצלמה חלש…',
    reconnecting: 'מתחבר מחדש…',
    nocamera: 'מחכה למצלמה… (היא צריכה להיות במצב שמירה, עם אינטרנט)',
  }[kind];
  if (kind === 'lost') {
    const why = phone?.link.state === 'offline' ? 'לטלפון הזה אין חיבור לאינטרנט' : phone?.link.state === 'waiting' ? 'המצלמה לא מחוברת (כבויה, בלי אינטרנט או שהמסך שלה כבה)' : 'המצלמה לא עונה';
    text = `❌ ${why}. מנסה להתחבר שוב כל הזמן.`;
  }
  if (phone) phone.conn = kind;
  $('conn-banner').dataset.kind = kind === 'lost' ? 'lost' : kind === 'ok' ? 'ok' : 'weak';
  $('conn-text').textContent = text;
  $('battery').hidden = kind === 'lost';
  $('reconnect').hidden = kind !== 'lost';
  // Don't leave the last frame looking like a live picture.
  $('live-view').classList.toggle('stale', kind === 'lost');
  $('live-state').textContent = kind === 'ok' ? 'תמונה חיה' : kind === 'lost' ? 'אין חיבור' : '';
}

function setLive(on) {
  phone.liveOn = on;
  store.set('liveOn', on);
  phone.link.send({ type: 'live', on });
  $('live-view').hidden = !on;
  $('live-toggle').textContent = on ? 'הסתר תמונה חיה' : '📺 הצג תמונה חיה';
}

$('live-toggle').addEventListener('click', () => phone && setLive(!phone.liveOn));
$('live-size').addEventListener('click', () => $('live-view').classList.toggle('big'));

$('check').addEventListener('click', () => {
  if (!phone) return;
  unlockAudio();
  $('check-result').textContent = 'בודק…';
  phone.link.send({ type: 'ping', t: performance.now() });
  clearTimeout(phone.pingTimer);
  phone.pingTimer = setTimeout(() => ($('check-result').textContent = '❌ אין תשובה מהמצלמה'), 3000);
});

$('reconnect').addEventListener('click', () => {
  unlockAudio();
  if (awakeVideo.paused) awakeVideo.play().catch(() => {});
  if (!phone) return;
  phone.graceUntil = Date.now() + 8000;
  phone.link.probe();
});

$('disconnect').addEventListener('click', () => show('home'));

$('forget').addEventListener('click', () => {
  if (!confirm('לשכוח את המצלמה הזו ולסרוק קוד של מצלמה אחרת?')) return;
  store.set('pairKey', null);
  show('pair');
});

document.addEventListener('visibilitychange', () => {
  if (!phone) return;
  // Tell the camera right away, so it starts pushing instead of waiting for a missed confirmation.
  phone.link.send({ type: 'hb', visible: !document.hidden });
  if (document.hidden) return;
  keepAwake(phone);
  // Back from the background: give the link a moment to reconnect before calling it lost.
  phone.graceUntil = Date.now() + 8000;
});

function renderPush(p, text) {
  const support = pushSupport();
  $('push-card').hidden = !p.pushKey || support === 'none';
  const enabled = store.get('pushKey', '') === p.pushKey && window.Notification?.permission === 'granted';
  if (support === 'ios-browser') {
    $('push-text').textContent = 'באייפון זה עובד רק מהאפליקציה במסך הבית: בספארי לחץ שיתוף ← „הוסף למסך הבית”, פתח את שומר מהאייקון וחבר שוב למצלמה. צריך iOS 16.4 ומעלה.';
  } else {
    $('push-text').textContent = text || (enabled
      ? '✓ התראות פעילות: כשמישהו מתקרב תקבל התראה למעלה גם כשהטלפון נעול או ששומר ברקע. צריך אינטרנט בשני הטלפונים.'
      : 'כדי לקבל התראה למעלה גם כשהטלפון נעול או ששומר ברקע. ההתראה עוברת מוצפנת דרך שירות ההתראות של אפל/גוגל ולכן צריך אינטרנט. תמונות לא נשלחות כך.');
  }
  $('push-enable').hidden = support !== 'ok' || enabled || p.pushBusy;
  $('push-test').hidden = support !== 'ok' || !enabled || p.pushBusy;
}

async function enablePush(p, quiet) {
  if (!p.pushKey) return;
  p.pushBusy = true;
  if (!quiet) renderPush(p, 'מפעיל…');
  try {
    const sub = await subscribe(p.pushKey);
    store.set('pushKey', p.pushKey);
    p.link.send({ type: 'push-sub', sub, quiet });
    if (quiet) {
      p.pushBusy = false;
      renderPush(p);
    } else {
      renderPush(p, 'שולח התראת בדיקה…');
    }
  } catch (err) {
    p.pushBusy = false;
    renderPush(p, err.denied ? 'ההתראות חסומות. אפשר אותן בהגדרות ← התראות ← שומר.' : 'לא הצלחתי להפעיל התראות. ודא שיש אינטרנט ונסה שוב.');
  }
}

$('push-enable').addEventListener('click', () => phone && enablePush(phone));
$('push-test').addEventListener('click', () => {
  if (!phone) return;
  phone.pushBusy = true;
  renderPush(phone, 'שולח התראת בדיקה… נעל את הטלפון עכשיו כדי לראות אותה למעלה.');
  phone.link.send({ type: 'push-test' });
  setTimeout(() => {
    if (phone?.pushBusy) {
      phone.pushBusy = false;
      renderPush(phone, '❌ אין תשובה מהמצלמה.');
    }
  }, 15000);
});

function addAlert(msg) {
  const list = $('alerts');
  list.querySelector('.empty')?.remove();
  const li = document.createElement('li');
  li.className = 'new';
  li.dataset.id = msg.id;
  const head = document.createElement('div');
  head.className = 'alert-head';
  const title = document.createElement('b');
  title.textContent = `${msg.title} · ${msg.name}`;
  const time = document.createElement('time');
  time.textContent = clock(new Date(msg.at));
  head.append(title, time);
  li.append(head);
  list.prepend(li);
  attachPhoto(msg.id, msg.photo);
  // Kept in memory only, and only the latest ones.
  while (list.children.length > 20) list.lastElementChild.remove();
}

// The photo arrives a moment after its alert.
function attachPhoto(id, photo) {
  if (typeof photo !== 'string' || !photo.startsWith('data:image/jpeg')) return;
  const li = [...$('alerts').children].find(el => el.dataset.id === id);
  if (!li || li.querySelector('img')) return;
  const img = document.createElement('img');
  img.src = photo;
  img.alt = 'תמונה מהמצלמה';
  li.append(img);
}

// ---------- Sound ----------

let audio = null;

function unlockAudio() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
  } catch {}
}

function tone(freqs, step, gainLevel = 0.4) {
  if (!audio || audio.state !== 'running') return;
  const t0 = audio.currentTime;
  freqs.forEach((f, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t0 + i * step);
    gain.gain.exponentialRampToValueAtTime(gainLevel, t0 + i * step + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * step + step - 0.02);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + i * step);
    osc.stop(t0 + i * step + step);
  });
}

const beep = (times = 3) => tone(Array.from({ length: times * 2 }, (_, i) => (i % 2 ? 660 : 880)), 0.22);

function alarmLost() {
  tone([440, 330, 440, 330], 0.4, 0.5);
  navigator.vibrate?.([800, 300, 800]);
}

function ring() {
  beep();
  navigator.vibrate?.([400, 150, 400, 150, 400]);
}

// Sound needs a tap before it can play; any tap on the page counts.
function onTap() {
  unlockAudio();
  if ((run || phone || scan) && awakeVideo.paused) awakeVideo.play().catch(() => {});
}
document.addEventListener('click', onTap);
document.addEventListener('touchend', onTap);

// ---------- Direct links: …/shomer/#camera and …/shomer/#phone ----------

const startScreen = { '#camera': 'cam-setup', '#phone': 'pair' }[location.hash];
if (startScreen) {
  history.replaceState(null, '', location.pathname);
  show(startScreen);
}
