import { Mascot } from './mascot.js';

const { Conversation } = window.ElevenLabsClient;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

const mascot = new Mascot($('mascot'));

// ---- model & voice choices (sent as per-conversation overrides) ----
const LLMS = [
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: 'ברירת המחדל – מהיר ומדבר עברית יפה', tag: 'מומלץ', cls: 'fast' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', desc: 'הכי מהיר, קצת פחות מעמיק', tag: 'הכי מהיר', cls: 'fast' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', desc: 'הדור החדש של Gemini', tag: 'מהיר', cls: 'fast' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', desc: 'מהיר, חם ומדויק', tag: 'מהיר', cls: 'fast' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', desc: 'חכם מאוד, עונה קצת יותר לאט', tag: 'הכי חכם', cls: 'smart' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini', desc: 'מהיר וקליל', tag: 'מהיר', cls: 'fast' },
  { id: 'gpt-5.5', name: 'GPT-5.5', desc: 'חכם, עם השהיה ארוכה יותר', tag: 'חכם', cls: 'smart' },
];
const VOICES = [
  { id: '8sZ9Z3Jy28CGLLCmKEHn', name: 'ויקטור', desc: 'חם וטוב לב (ברירת המחדל)' },
  { id: 'IK7YYZcSpmlkjKrQxbSn', name: 'ראאד', desc: 'מבוגר, צרוד קצת, מבטא מפרץ/סעודי' },
  { id: 'Jez3JdhBInQTvlAvDOWR', name: 'מונסלנס', desc: 'מבוגר, חם ורגוע, מבטא מצרי' },
  { id: 'kIybghJkLIe04WclQHIw', name: 'ד"ר סאלח', desc: 'מבטא ירדני' },
  { id: 'ZiofZHcEBTn5sRySe5h8', name: 'נמרוד', desc: 'חם ובטוח' },
  { id: '6Ijsl5024dyMrE00loVE', name: 'הרצל', desc: 'רגוע ומדוד' },
  { id: 'l7Q9rbdCC6j3J5dNlOOg', name: 'איתמר', desc: 'ברור, קריין' },
];
const store = {
  get(k, d) { try { return localStorage.getItem('zakai.' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('zakai.' + k, v); } catch {} },
};
const prefs = {
  llm: store.get('llm', LLMS[0].id),
  voice: store.get('voice', VOICES[0].id),
  speed: parseFloat(store.get('speed', '0.92')),
};
if (!LLMS.some(m => m.id === prefs.llm)) prefs.llm = LLMS[0].id;
if (!VOICES.some(v => v.id === prefs.voice)) prefs.voice = VOICES[0].id;

function renderChip() {
  $('modelChip').textContent = LLMS.find(m => m.id === prefs.llm).name;
}
function renderOptions() {
  $('llmOptions').innerHTML = LLMS.map(m => `
    <label class="opt"><input type="radio" name="llm" value="${m.id}" ${m.id === prefs.llm ? 'checked' : ''}>
      <span><b>${m.name}</b><small>${m.desc}</small></span><span class="tag ${m.cls}">${m.tag}</span></label>`).join('');
  $('voiceOptions').innerHTML = VOICES.map(v => `
    <label class="opt"><input type="radio" name="voice" value="${v.id}" ${v.id === prefs.voice ? 'checked' : ''}>
      <span><b>${v.name}</b><small>${v.desc}</small></span><span></span></label>`).join('');
  $('speedInput').value = prefs.speed;
  $('speedOut').textContent = prefs.speed.toFixed(2);
}
renderChip();

$('speedInput').addEventListener('input', e => { $('speedOut').textContent = (+e.target.value).toFixed(2); });
$('settingsBtn').addEventListener('click', () => {
  renderOptions();
  $('settingsNote').textContent = convo ? 'שמירה תתחיל שיחה חדשה עם ההגדרות החדשות.' : 'השינוי ייכנס לתוקף בשיחה הבאה.';
  $('settings').showModal();
});
$('settings').addEventListener('close', async () => {
  if ($('settings').returnValue !== 'save') return;
  const f = $('settings').querySelector('form');
  const next = { llm: f.llm.value, voice: f.voice.value, speed: +$('speedInput').value };
  const changed = next.llm !== prefs.llm || next.voice !== prefs.voice || next.speed !== prefs.speed;
  Object.assign(prefs, next);
  store.set('llm', prefs.llm); store.set('voice', prefs.voice); store.set('speed', String(prefs.speed));
  renderChip();
  if (changed && convo) { await convo.endSession(); stopped(); await start(); }
});
let convo = null;
let starting = false;
let mode = 'listening';
let awaitingReply = false;

const STATUS = {
  idle: 'לחץ על המיקרופון ותשאל את זכאי מה שבא לך',
  connecting: 'רגע, הסבא מתיישב<span class="dots"></span>',
  listening: 'זכאי מקשיב… דבר אליו',
  thinking: 'זכאי חושב<span class="dots"></span>',
  speaking: 'זכאי מדבר (אפשר לקטוע אותו)',
};

function setState(s) {
  document.body.dataset.state = s;
  mascot.setState(s);
  $('status').innerHTML = STATUS[s] ?? '';
}
setState('idle');

function agentId() {
  const fromUrl = params.get('agent');
  if (fromUrl) { try { localStorage.setItem('zakai.agent', fromUrl); } catch {} return fromUrl; }
  if (window.ZAKAI_CONFIG?.agentId) return window.ZAKAI_CONFIG.agentId;
  try { return localStorage.getItem('zakai.agent') || ''; } catch { return ''; }
}

function askForAgentId() {
  return new Promise(resolve => {
    const d = $('setup');
    d.addEventListener('close', () => {
      const v = $('agentIdInput').value.trim();
      if (v) { try { localStorage.setItem('zakai.agent', v); } catch {} }
      resolve(v);
    }, { once: true });
    d.showModal();
  });
}

function say(text) {
  $('bubbleText').textContent = text;
  $('bubble').hidden = !text;
}

function log(role, text) {
  const li = document.createElement('li');
  li.className = role;
  li.textContent = (role === 'user' ? 'אתה: ' : 'זכאי: ') + text;
  $('log').append(li);
  li.scrollIntoView({ block: 'nearest' });
}

async function start() {
  if (convo || starting) return convo;
  let id = agentId();
  if (!id) id = await askForAgentId();
  if (!id) return null;
  starting = true;
  $('micBtn').disabled = true;
  setState('connecting');
  try {
    // ask for the mic first so the browser prompt doesn't eat into the conversation
    await navigator.mediaDevices.getUserMedia({ audio: true });
    convo = await Conversation.startSession({
      agentId: id,
      connectionType: 'webrtc',
      overrides: {
        agent: { prompt: { llm: prefs.llm } },
        tts: { voiceId: prefs.voice, speed: prefs.speed },
      },
      onConnect: () => { document.body.dataset.live = '1'; $('micLabel').textContent = 'סיים שיחה'; setState('listening'); },
      onDisconnect: () => stopped(),
      onError: (msg) => { console.error(msg); $('status').textContent = 'אוי, משהו השתבש בחיבור. נסה שוב.'; },
      onModeChange: ({ mode: m }) => {
        mode = m;
        if (m === 'speaking') { awaitingReply = false; setState('speaking'); }
        else setState(awaitingReply ? 'thinking' : 'listening');
      },
      onMessage: ({ source, message }) => {
        if (!message) return;
        if (source === 'user') {
          log('user', message);
          if (mode !== 'speaking') { awaitingReply = true; setState('thinking'); }
        } else {
          log('ai', message);
          say(message);
        }
      },
      onAgentChatResponsePart: (part) => {
        // stream the words into the bubble as they arrive
        if (part?.type === 'start') say('');
        if (part?.type === 'delta' && part.text) say(($('bubbleText').textContent || '') + part.text);
      },
      onInterruption: () => { awaitingReply = false; },
    });
    return convo;
  } catch (e) {
    console.error(e);
    $('status').textContent = e?.name === 'NotAllowedError'
      ? 'צריך לאשר גישה למיקרופון כדי לדבר עם זכאי'
      : 'לא הצלחתי להתחבר לזכאי. בדוק את החיבור ונסה שוב.';
    stopped(true);
    return null;
  } finally {
    starting = false;
    $('micBtn').disabled = false;
  }
}

function stopped(keepStatus) {
  convo = null;
  delete document.body.dataset.live;
  $('micLabel').textContent = 'דבר עם זכאי';
  if (!keepStatus) setState('idle'); else { document.body.dataset.state = 'idle'; mascot.setState('idle'); }
}

$('micBtn').addEventListener('click', async () => {
  if (convo) { await convo.endSession(); stopped(); }
  else await start();
});

$('askForm').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('askInput').value.trim();
  if (!text) return;
  $('askInput').value = '';
  const c = convo || await start();
  if (!c) return;
  c.sendUserMessage(text);
  log('user', text);
  awaitingReply = true;
  if (mode !== 'speaking') setState('thinking');
});

// audio → mascot, every frame
const brightnessOf = (bins) => {
  if (!bins?.length) return 0.5;
  let lo = 0, hi = 0;
  const n = bins.length, cut = Math.floor(n * 0.18);
  for (let i = 2; i < n * 0.6; i++) (i < cut ? (lo += bins[i]) : (hi += bins[i]));
  const s = lo + hi;
  return s ? Math.min(1, (hi / s) * 1.8) : 0.5;
};

function frame() {
  if (convo) {
    try {
      const out = convo.getOutputVolume();
      mascot.feed(Math.min(1, out * 2.4), brightnessOf(convo.getOutputByteFrequencyData()));
      document.body.style.setProperty('--in', Math.min(1, convo.getInputVolume() * 3).toFixed(2));
    } catch { /* not ready yet */ }
  } else if (demo) {
    demo();
  }
  requestAnimationFrame(frame);
}

// ?demo=speaking|listening|thinking — animate without a connection (for previews and testing)
let demo = null;
if (params.get('demo')) {
  const s = params.get('demo');
  setState(s);
  if (s === 'speaking') say('אה, יא בְּנִי! שאלה טובה שאלת. בוא, שב, תשמע מה סבא יגיד לך…');
  const t0 = performance.now();
  demo = () => {
    const t = (performance.now() - t0) / 1000;
    const syll = Math.max(0, Math.sin(t * 11) * 0.6 + Math.sin(t * 5.3) * 0.4);
    const gap = (Math.sin(t * 1.7) > -0.6) ? 1 : 0;
    mascot.feed(s === 'speaking' ? syll * gap : 0, 0.5 + Math.sin(t * 3) * 0.4);
  };
}
requestAnimationFrame(frame);

window.addEventListener('pagehide', () => { convo?.endSession(); });
