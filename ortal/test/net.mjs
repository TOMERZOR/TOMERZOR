// Two rollback sessions talking over a fake network with latency, jitter,
// packet loss and clock drift. Both must end on exactly the same fight, and
// that fight must equal a plain replay of the inputs each player pressed.
//   node ortal/test/net.mjs [seconds] [latencyMs] [jitterMs] [lossPct]
import { Rollback } from "../js/rollback.js";
import { createState, step, checksum, IN } from "../js/sim.js";

const SECONDS = +(process.argv[2] || 120);
const LAT = +(process.argv[3] || 70);
const JIT = +(process.argv[4] || 30);
const LOSS = +(process.argv[5] || 5) / 100;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const R = rng(12345);

// a button-masher that walks, jumps, blocks and attacks
function bot(seed) {
  const r = rng(seed);
  let hold = 0, left = 0;
  return () => {
    if (left-- <= 0) {
      left = 2 + Math.floor(r() * 25);
      const dirs = [0, IN.LEFT, IN.RIGHT, IN.DOWN, IN.UP, IN.UP | IN.RIGHT, IN.B, IN.DOWN | IN.B, IN.RIGHT];
      hold = dirs[Math.floor(r() * dirs.length)];
    }
    let v = hold;
    const x = r();
    if (x < 0.12) v |= IN.P; else if (x < 0.2) v |= IN.K; else if (x < 0.23) v |= IN.S; else if (x < 0.25) v |= IN.X;
    return v;
  };
}

let now = 0;
const queue = []; // {at, to, msg}
const sessions = [];
const sentBytes = [0, 0];
function makeSend(from) {
  return (msg) => {
    const json = JSON.stringify(msg);
    sentBytes[from] += json.length;
    if (R() < LOSS) return;
    const at = now + LAT + (R() * 2 - 1) * JIT;
    queue.push({ at, to: 1 - from, msg: JSON.parse(json) });
  };
}
sessions[0] = new Rollback({ me: 0, ch0: 2, ch1: 5, send: makeSend(0) });
sessions[1] = new Rollback({ me: 1, ch0: 2, ch1: 5, send: makeSend(1) });
const bots = [bot(7), bot(99)];
// record every input each side commits to, to replay the fight from scratch later
const record = [new Map(), new Map()];
for (let i = 0; i < 2; i++) {
  const m = sessions[i].local; const orig = m.set.bind(m);
  m.set = (k, v) => { if (!record[i].has(k)) record[i].set(k, v); return orig(k, v); };
}
// the guest starts a little later and its clock runs 0.4% fast
const period = [1000 / 60, 1000 / 60 / 1.004];
const nextTick = [0, 37];
const END = SECONDS * 1000;
while (now < END) {
  // deliver due packets
  queue.sort((a, b) => a.at - b.at);
  while (queue.length && queue[0].at <= now) { const q = queue.shift(); sessions[q.to].receive(q.msg); }
  for (let i = 0; i < 2; i++) {
    if (now >= nextTick[i]) { sessions[i].tick(bots[i]()); nextTick[i] += period[i]; }
  }
  now += 1;
}
// let the network drain with both players idle so everything confirms
// (a late packet only rewinds on the next tick, so keep ticking)
for (let t = 0; t < 400; t++) {
  queue.sort((a, b) => a.at - b.at);
  while (queue.length && queue[0].at <= now) { const q = queue.shift(); sessions[q.to].receive(q.msg); }
  if (t % 2 === 0) { sessions[0].tick(0); sessions[1].tick(0); }
  now += 16;
}

const [A, B] = sessions;
const common = Math.min(A.confirmed, B.confirmed, A.frame, B.frame);
// replay from scratch with the real inputs (from each side's own local map is pruned, so check via checksums of stored states)
const ha = A.states.has(common) ? checksum(A.states.get(common)) : null;
const hb = B.states.has(common) ? checksum(B.states.get(common)) : null;
console.log(`frames A=${A.frame} B=${B.frame} confirmed A=${A.confirmed} B=${B.confirmed} common=${common}`);
console.log(`rollbacks A=${A.rollbacks} B=${B.rollbacks} maxRolled A=${A.maxRolled} B=${B.maxRolled} stalls A=${A.stalls} B=${B.stalls}`);
console.log(`desyncs A=${A.desyncs} B=${B.desyncs}  bytes/s A=${Math.round(sentBytes[0] / SECONDS)} B=${Math.round(sentBytes[1] / SECONDS)}`);
const sa = A.states.get(common).p, sb = B.states.get(common).p;
console.log(`hp ${sa[0].hp}/${sa[1].hp} vs ${sb[0].hp}/${sb[1].hp}  round ${A.states.get(common).round} phase ${A.states.get(common).phase}`);
if (ha === null || ha !== hb) { console.log("MISMATCH", ha, hb); process.exit(1); }
const ref = createState(2, 5);
for (let f = 1; f <= common; f++) step(ref, record[0].get(f) || 0, record[1].get(f) || 0);
if (checksum(ref) !== ha) { console.log("REPLAY MISMATCH", checksum(ref), ha); process.exit(1); }
console.log("replay from scratch matches");
console.log("OK: identical fight on both sides");
