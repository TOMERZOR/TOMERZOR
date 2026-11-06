import { Mascot } from './mascot.js';

const { Conversation } = window.ElevenLabsClient;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

const mascot = new Mascot($('mascot'));
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
