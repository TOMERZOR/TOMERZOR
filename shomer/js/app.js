import { MotionDetector, sensitivityToThreshold, toGray } from './motion.js';
import { CameraLink, PhoneLink, linkSupported, isCode } from './link.js';
import { scanVideo } from './scan.js';

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
  if (b.dataset.go === 'pair') unlockAudio();
  show(b.dataset.go);
}));

function drawQr(el, text) {
  const qr = qrcode(0, 'L');
  qr.addData(text);
  qr.make();
  el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
}

async function keepAwake(holder) {
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
  run.link?.setTrack(run.liveOn ? run.stream.getVideoTracks()[0] : null);
}

$('start').addEventListener('click', async () => {
  // Full screen hides the status bar (clock, icons), which would otherwise stay lit. Android only.
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
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
    queue: [],
    liveOn: true,
  };
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
  if (linkSupported()) startCameraPairing();
  else $('link-state').textContent = 'הדפדפן הזה לא תומך בחיבור לטלפון';
});

function stopWatching() {
  if (!run) return;
  clearTimeout(run.timer);
  clearInterval(run.heartbeat);
  run.stopScan?.();
  run.link?.close();
  run.stream?.getTracks().forEach(t => t.stop());
  run.wake?.release().catch(() => {});
  video.srcObject = null;
  run = null;
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

// ----- Pairing, camera side: show our code, then read the phone's code through the lens -----

async function startCameraPairing() {
  const current = run;
  current.stopScan?.();
  current.link?.close();
  const link = (current.link = new CameraLink());
  $('pair-panel').hidden = false;
  $('pair-again').hidden = true;
  $('pair-qr').innerHTML = '';
  $('pair-status').textContent = 'מכין קוד…';

  link.on('open', () => run === current && current.link === link && onPhoneConnected());
  link.on('message', msg => run === current && onPhoneMessage(msg));
  link.on('state', state => run === current && current.link === link && onLinkState(state));

  let code;
  try {
    code = await link.createCode();
  } catch {
    $('pair-status').textContent = 'לא הצלחתי להכין קוד חיבור. נסה לעצור ולהתחיל שוב.';
    return;
  }
  if (current.link !== link) return;
  drawQr($('pair-qr'), code);
  $('pair-status').textContent = 'מחכה לקוד מהטלפון…';

  const tried = new Set();
  current.stopScan = scanVideo(video, {
    accept: text => isCode(text) && !tried.has(text),
    onCode: async text => {
      tried.add(text);
      try {
        await link.acceptCode(text);
        current.stopScan();
        $('pair-status').textContent = 'קיבלתי את הקוד, מתחבר…';
      } catch {
        $('pair-status').textContent = 'זה לא הקוד מהטלפון. בטלפון סרוק קודם את הקוד שמוצג כאן.';
      }
    },
  });
}

$('pair-again').addEventListener('click', () => run && startCameraPairing());
$('pair-skip').addEventListener('click', () => {
  if (!run) return;
  run.stopScan?.();
  $('pair-panel').hidden = true;
  $('pair-again').hidden = false;
  $('link-state').textContent = 'בלי טלפון';
  if (settings.dark) setDark(true);
});

function onPhoneConnected() {
  $('pair-panel').hidden = true;
  $('pair-again').hidden = true;
  $('link-state').textContent = '🔗 הטלפון מחובר';
  if (settings.dark) setDark(true);
  sendHeartbeat();
  // Alerts that happened while the phone was away.
  for (const msg of run.queue.splice(0)) run.link.send(msg);
}

function onLinkState(state) {
  if (state === 'connected') {
    if (run.link.open) $('link-state').textContent = '🔗 הטלפון מחובר';
  } else if (state === 'disconnected') {
    $('link-state').textContent = '⚠️ החיבור לטלפון נחלש…';
  } else if (state === 'failed' || state === 'closed') {
    // Show a fresh code right away, so it's ready when you get to the camera.
    $('link-state').textContent = '❌ הטלפון לא מחובר';
    startCameraPairing();
  }
}

function onPhoneMessage(msg) {
  if (msg.type === 'live') {
    run.liveOn = !!msg.on;
    run.link.setTrack(run.liveOn ? run.stream?.getVideoTracks()[0] : null);
  }
  if (msg.type === 'ping') run.link.send({ type: 'pong', t: msg.t });
  if (msg.type === 'video-restart' && run.liveOn) run.link.restartVideo(run.stream?.getVideoTracks()[0]);
}

async function sendHeartbeat() {
  if (!run?.link?.open) return;
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
  if (!moving) run.idleChecks = 0;
  // Nothing to draw while the screen is blacked out.
  if (curtain.hidden) {
    drawOverlay(vw, vh, moving ? box : null, now);
    drawMeter(r.score, threshold);
  }
  if (run.link?.open && (moving || run.boxShown)) {
    run.boxShown = moving;
    run.link.send({ type: 'motion', box: moving && box ? normalize(box, vw, vh) : null });
  }

  if (now < run.armedAt) return setStatus(`מתחיל לשמור בעוד ${Math.ceil((run.armedAt - now) / 1000)} שניות…`, 'wait');
  if (r.warming) return setStatus('מתכונן…', 'wait');

  const cooling = now - run.lastAlert < settings.cooldown * 1000;
  const peopleOnly = settings.mode === 'people' && run.model !== false;
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

const normalize = (box, vw, vh) => ({ x: box.x / vw, y: box.y / vh, w: box.w / vw, h: box.h / vh });

const PERSON_SCORE = 0.55;

const bestPerson = found => found.filter(p => p.class === 'person' && p.score >= PERSON_SCORE).sort((a, b) => b.score - a.score)[0];

// The model looks at the frame shrunk to about 300px, so a far-away person a few dozen pixels
// tall is easily missed. When the motion is in a small area, look again at a zoomed-in square
// around it, which makes that person several times bigger for the model.
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
  if (run.detecting || now - run.lastDetect < (run.detectGap || 600)) return;
  run.detecting = true;
  const current = run;
  let found = false;
  try {
    // Detect on a frozen frame and send that same frame, so the box matches the photo.
    const frame = grabFrame(video);
    let person = bestPerson(await current.model.detect(frame, 10, 0.4));
    let bbox = person?.bbox;
    const zoom = !person && motionBox && zoomOn(frame, motionBox);
    if (zoom) {
      person = bestPerson(await current.model.detect(zoom.crop, 10, 0.4));
      if (person) {
        const [x, y, w, h] = person.bbox;
        bbox = [zoom.x0 + x * zoom.scale, zoom.y0 + y * zoom.scale, w * zoom.scale, h * zoom.scale];
      }
    }
    found = !!person;
    if (person && run === current) {
      const [x, y, w, h] = bbox;
      trigger('person', { x, y, w, h }, frame);
    }
  } catch {}
  // Detection is the heaviest work on the phone. Under constant motion with no one there (wind in
  // the bushes) check less often, up to every 2.5 s, and never use more than about a third of the time,
  // so the phone stays cool and the live video smooth.
  const took = Date.now() - now;
  current.idleChecks = found ? 0 : (current.idleChecks || 0) + 1;
  current.detectGap = Math.min(2500, Math.max(600 + current.idleChecks * 150, took * 3));
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
    kind,
    title: kind === 'person' ? 'זוהה אדם' : 'זוהתה תנועה',
    name: cameraName(),
    at: at.getTime(),
    box: box && normalize(box, vw, vh),
    photo: settings.photo ? snapshot(box, frame) : null,
  };
  run.sent++;
  $('sent-count').textContent = run.sent === 1 ? 'התראה אחת' : `${run.sent} התראות`;
  $('last-sent').textContent = `אחרונה: ${clock(at)}`;
  if (!run.link?.send(msg)) {
    run.queue.push(msg);
    if (run.queue.length > 5) run.queue.shift();
  }
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
  $('scan-step').hidden = false;
  $('answer-step').hidden = true;
  $('pair-phone-status').textContent = '';
  if (!linkSupported()) {
    $('pair-phone-status').textContent = 'הדפדפן הזה לא תומך בחיבור. עדכן את הדפדפן או נסה Chrome.';
    return;
  }
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

  const tried = new Set();
  current.stop = scanVideo(scanVideoEl, {
    accept: text => isCode(text) && !tried.has(text),
    onCode: async text => {
      tried.add(text);
      const link = new PhoneLink();
      let answer;
      try {
        answer = await link.answerCode(text);
      } catch {
        link.close();
        $('pair-phone-status').textContent = 'זה לא קוד של מכשיר המצלמה. סרוק את הקוד שמוצג במכשיר המצלמה.';
        return;
      }
      if (scan !== current) return link.close();
      stopPhoneScan();
      beginPhone(link);
      $('scan-step').hidden = true;
      $('answer-step').hidden = false;
      drawQr($('answer-qr'), answer);
      $('pair-phone-status').textContent = 'מחכה שהמצלמה תקרא את הקוד…';
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

// ----- Receiving: live view, alerts, link watchdog -----

const liveVideo = $('live-video');
const liveOverlay = $('live-overlay');

function beginPhone(link) {
  const p = (phone = { link, lastSeen: 0, lost: false, liveOn: store.get('liveOn', true) });
  link.on('open', () => {
    if (phone !== p) return;
    p.lastSeen = Date.now();
    show('listen');
    $('alerts').innerHTML = '<li class="empty">עוד אין התראות.</li>';
    $('check-result').textContent = '';
    setLive(p.liveOn);
    keepAwake(p);
    p.watchdog = setInterval(() => watchdog(p), 1000);
    p.statsTimer = setInterval(() => videoQuality(p), 2000);
    // If the video hasn't started, ask once more.
    setTimeout(() => phone === p && p.liveOn && !liveVideo.videoWidth && p.link.send({ type: 'live', on: true }), 6000);
  });
  link.on('track', stream => {
    liveVideo.srcObject = stream;
    liveVideo.play().catch(() => {});
  });
  link.on('message', msg => phone === p && onCameraMessage(p, msg));
  link.on('state', state => {
    if (phone === p && p.watchdog && (state === 'failed' || state === 'closed')) lostCamera(p);
  });
}

function closePhone() {
  if (!phone) return;
  clearInterval(phone.watchdog);
  clearInterval(phone.lostAlarm);
  clearInterval(phone.statsTimer);
  clearTimeout(phone.pingTimer);
  $('live-quality').textContent = '';
  phone.link.close();
  phone.wake?.release().catch(() => {});
  phone = null;
  liveVideo.srcObject = null;
  $('live-view').classList.remove('big');
}

function onCameraMessage(p, msg) {
  p.lastSeen = Date.now();
  if (p.lost || p.weak) {
    p.lost = p.weak = false;
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
  if (msg.type === 'motion') drawLiveBox(msg.box, '#ffb703');
  if (msg.type === 'alert') {
    drawLiveBox(msg.box, '#ff3b4e');
    addAlert(msg);
    ring();
    const el = $('live-view');
    el.classList.remove('alarm');
    void el.offsetWidth;
    el.classList.add('alarm');
  }
  if (msg.type === 'pong') {
    clearTimeout(p.pingTimer);
    $('check-result').textContent = `✓ החיבור תקין (${Math.round(performance.now() - msg.t)} ms)`;
    beep(1);
  }
}

// The camera sends a heartbeat every 2 s; silence means it died, went out of range or its screen went off.
function watchdog(p) {
  const quiet = Date.now() - p.lastSeen;
  if (quiet > 10000) lostCamera(p);
  else if (quiet > 5000 && !p.weak && !p.lost) {
    p.weak = true;
    setConn('weak');
  }
}

function lostCamera(p) {
  if (p.lost) return;
  p.lost = true;
  setConn('lost');
  drawLiveBox(null);
  alarmLost();
  p.lostAlarm = setInterval(alarmLost, 15000);
}

// Shows frame rate and delay on the live view, and restarts the video if it froze while the link is up.
async function videoQuality(p) {
  const el = $('live-quality');
  if (!p.liveOn || p.lost) {
    el.textContent = '';
    p.frozen = 0;
    return;
  }
  let stats;
  try { stats = await p.link.videoStats(); } catch { return; }
  if (phone !== p || stats.fps == null) return;
  const fps = Math.round(stats.fps);
  el.textContent = `${fps} fps` + (stats.delay != null ? ` · ${stats.delay.toFixed(1)} שנ׳` : '');
  el.classList.toggle('bad', fps < 5);
  p.frozen = fps < 1 ? (p.frozen || 0) + 1 : 0;
  if (p.frozen >= 2 && Date.now() - (p.lastRestart || 0) > 10000) {
    p.lastRestart = Date.now();
    p.link.send({ type: 'video-restart' });
  }
}

function setConn(kind) {
  const name = phone?.name || 'המצלמה';
  const text = {
    ok: `מחובר ל${name}`,
    weak: 'החיבור למצלמה חלש…',
    lost: '❌ החיבור למצלמה אבד! בדוק את מכשיר המצלמה. אם הוא לא חוזר תוך כמה שניות, חבר מחדש.',
  }[kind];
  $('conn-banner').dataset.kind = kind;
  $('conn-text').textContent = text;
  $('battery').hidden = kind === 'lost';
  $('reconnect').hidden = kind !== 'lost';
  // Don't leave the last frame looking like a live picture.
  $('live-view').classList.toggle('stale', kind === 'lost');
  $('live-state').textContent = kind === 'ok' ? 'שידור חי' : kind === 'lost' ? 'אין שידור' : '';
}

function setLive(on) {
  phone.liveOn = on;
  store.set('liveOn', on);
  phone.link.send({ type: 'live', on });
  $('live-view').hidden = !on;
  $('live-toggle').textContent = on ? 'כבה שידור חי (חוסך סוללה)' : '📺 הצג שידור חי';
  setConn(phone.lost ? 'lost' : phone.weak ? 'weak' : 'ok');
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
  show('pair');
});

$('disconnect').addEventListener('click', () => {
  if (phone?.link.open && !confirm('להתנתק מהמצלמה? כדי להתחבר שוב צריך לסרוק מחדש.')) return;
  show('home');
});

document.addEventListener('visibilitychange', () => phone && !document.hidden && keepAwake(phone));

function drawLiveBox(box, color) {
  const w = liveVideo.videoWidth || 640, h = liveVideo.videoHeight || 480;
  if (liveOverlay.width !== w || liveOverlay.height !== h) {
    liveOverlay.width = w;
    liveOverlay.height = h;
  }
  const ctx = liveOverlay.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (!box) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, w / 160);
  ctx.strokeRect(box.x * w, box.y * h, box.w * w, box.h * h);
}

function addAlert(msg) {
  const list = $('alerts');
  list.querySelector('.empty')?.remove();
  const li = document.createElement('li');
  li.className = 'new';
  const head = document.createElement('div');
  head.className = 'alert-head';
  const title = document.createElement('b');
  title.textContent = `${msg.title} · ${msg.name}`;
  const time = document.createElement('time');
  time.textContent = clock(new Date(msg.at));
  head.append(title, time);
  li.append(head);
  if (typeof msg.photo === 'string' && msg.photo.startsWith('data:image/jpeg')) {
    const img = document.createElement('img');
    img.src = msg.photo;
    img.alt = 'תמונה מהמצלמה';
    li.append(img);
  }
  list.prepend(li);
  // Kept in memory only, and only the latest ones.
  while (list.children.length > 20) list.lastElementChild.remove();
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
document.addEventListener('click', unlockAudio);
document.addEventListener('touchend', unlockAudio);

// ---------- Direct links: …/shomer/#camera and …/shomer/#phone ----------

const startScreen = { '#camera': 'cam-setup', '#phone': 'pair' }[location.hash];
if (startScreen) {
  history.replaceState(null, '', location.pathname);
  show(startScreen);
}
