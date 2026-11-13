"""Headless harvester for the question bank of "השתול" (https://hashtul.onrender.com).

Plays complete games over the game's WebSocket protocol and records every round's
question pair (real question + the plant's fake question) into questions.json and
questions.md next to this file.

Usage (Python 3.10+, `pip install websockets`):

    python harvest.py --games 3 --spice 1            # 3 games, clean questions, host + server bots
    python harvest.py --games 2 --spice 3            # spicy ("פלפל") on
    python harvest.py --games 1 --spice 1 --humans   # no bots: host + 2 extra clients from this script
    python harvest.py --render                       # only rebuild questions.md from questions.json

Options:
    --games N       games to play in this run (sequential, one room at a time)
    --spice 1|3     settings.spice (1 = clean, 3 = pepper/18+)
    --rounds 5|8|12 rounds per game (default 12)
    --humans        use 3 script-driven players instead of the server's bots
    --pause S       seconds to wait between games (default 20)
    --raw FILE      append every raw server message (JSONL) to FILE, for debugging

Behaviour: one room per game; settings rounds=N, answer 30s, discuss 0s, vote 20s;
each player answers with a valid random value for the question kind, votes for a
random other participant, the host sends `next` once in discuss/result/scores; after the
final the client sends `leave`. The seen keys of every round (state.round.seenKey)
are stored in seen_keys.json and sent with the next `create` as the same bitset the
web client sends, so the server serves unseen questions. Stops on `rate_limited`
or repeated errors. Outbound traffic honours HTTPS_PROXY; the CA bundle in
SSL_CERT_FILE / /root/.ccr/ca-bundle.crt is used when present.
"""
import argparse, asyncio, base64, json, os, random, ssl, sys, time
from pathlib import Path

import websockets

HERE = Path(__file__).resolve().parent
QFILE = HERE / "questions.json"
SEENFILE = HERE / "seen_keys.json"
MDFILE = HERE / "questions.md"
URL = "wss://hashtul.onrender.com/ws"
ORIGIN = "https://hashtul.onrender.com"
NAME = "בודק"
AVATARS = ["tomato.open.smile", "tomato.happy.grin", "tomato.lid.smirk"]


def ssl_ctx():
    for p in (os.environ.get("SSL_CERT_FILE"), "/root/.ccr/ca-bundle.crt"):
        if p and os.path.exists(p):
            return ssl.create_default_context(cafile=p)
    return ssl.create_default_context()


def bitset(keys):
    b = bytearray(256)
    for n in keys:
        if isinstance(n, int) and 0 <= n < 2048:
            b[n >> 3] |= 1 << (n & 7)
    return base64.b64encode(bytes(b)).decode()


def seen_payload(keys):
    if not keys:
        return {}
    return {"seen": {"all": bitset(keys), "recent": bitset(keys[-40:])}}


def load_json(p, default):
    try:
        return json.loads(p.read_text("utf-8"))
    except Exception:
        return default


class Stop(Exception):
    pass


def valid_answer(q, participants, me):
    k = q.get("kind")
    if k == "number":
        lo, hi = q.get("min", 0), q.get("max", 999)
        return random.randint(lo, min(hi, lo + 10))
    if k == "scale":
        return random.randint(1, 10)
    if k == "choice":
        return random.randrange(max(1, len(q.get("options") or [1])))
    if k == "player":
        others = [p for p in participants if p != me] or participants
        return random.choice(others)
    return random.choice(["פיצה", "שוקולד", "חומוס", "אבא שלי", "בים", "לא יודע"])


class Player:
    def __init__(self, idx, host, args, record, rawlog):
        self.idx, self.host, self.args, self.record, self.rawlog = idx, host, args, record, rawlog
        self.ws = None
        self.me = None
        self.code = None
        self.done = asyncio.Event()
        self.acted = set()
        self.errors = 0
        self.started = False
        self.settings_sent = False
        self.ready_to_start = asyncio.Event()
        self.state = None

    async def send(self, msg):
        await self.ws.send(json.dumps(msg, ensure_ascii=False))

    async def run(self, first_msg):
        async with websockets.connect(URL, ssl=ssl_ctx(), origin=ORIGIN, open_timeout=90,
                                      ping_interval=20, max_size=2**22) as ws:
            self.ws = ws
            await self.send(first_msg)
            try:
                async for raw in ws:
                    if self.rawlog and self.host:
                        with open(self.rawlog, "a", encoding="utf-8") as f:
                            f.write(raw + "\n")
                    msg = json.loads(raw)
                    await self.handle(msg)
                    if self.done.is_set():
                        break
            finally:
                try:
                    await self.send({"t": "leave"})
                    await asyncio.sleep(0.5)
                except Exception:
                    pass

    async def handle(self, msg):
        t = msg.get("t")
        if t == "welcome":
            self.me, self.code = msg["playerId"], msg["code"]
            return
        if t == "error":
            code = msg.get("code")
            print(f"  [p{self.idx}] error: {code}", flush=True)
            if code in ("rate_limited", "session_expired", "room_not_found"):
                raise Stop(code)
            self.errors += 1
            if self.errors > 6:
                raise Stop("too many errors")
            return
        if t != "state":
            return
        s = self.state = msg["state"]
        phase, rnd = s.get("phase"), s.get("round") or {}
        rn = s.get("roundNumber")
        key = (phase, rn)
        if phase == "lobby":
            if self.host and not self.started:
                n = len(s.get("players", []))
                if not self.settings_sent:
                    self.settings_sent = True
                    await self.send({"t": "settings", "settings": {
                        "rounds": self.args.rounds, "spice": self.args.spice,
                        "answerSeconds": 30, "discussSeconds": 0, "voteSeconds": 20}})
                    if not self.args.humans:
                        await self.send({"t": "bots"})
                if n >= 3 and s["settings"].get("spice") == self.args.spice:
                    self.ready_to_start.set()
            return
        if phase == "answer" and rnd.get("myQuestion") and rnd.get("myAnswer") is None and key not in self.acted:
            if self.me in (rnd.get("participants") or []):
                self.acted.add(key)
                await asyncio.sleep(random.uniform(0.3, 1.2))
                await self.send({"t": "answer", "value": valid_answer(rnd["myQuestion"], rnd["participants"], self.me)})
            return
        if phase == "vote" and key not in self.acted:
            parts = [p for p in (rnd.get("participants") or []) if p != self.me]
            if parts and self.me in (rnd.get("participants") or []):
                self.acted.add(key)
                await asyncio.sleep(random.uniform(0.3, 1.0))
                await self.send({"t": "vote", "targetId": random.choice(parts)})
            return
        if phase == "result":
            if self.host:
                self.record(s, self.idx)
            elif rnd.get("iAmImpostor"):
                self.record(s, self.idx)
            if self.host and key not in self.acted:
                self.acted.add(key)
                await asyncio.sleep(1.0)
                await self.send({"t": "next"})
            return
        if phase == "discuss" and self.host and key not in self.acted:
            self.acted.add(key)
            await asyncio.sleep(1.0)
            await self.send({"t": "next"})
            return
        if phase == "scores" and self.host and key not in self.acted:
            self.acted.add(key)
            await asyncio.sleep(0.5)
            await self.send({"t": "next"})
            return
        if phase == "final":
            self.done.set()


class Harvest:
    def __init__(self):
        self.qs = {q["_k"]: q for q in load_json(QFILE, {}).get("questions", [])} if QFILE.exists() else {}
        self.meta = load_json(QFILE, {}).get("meta", {}) if QFILE.exists() else {}
        self.seen_keys = load_json(SEENFILE, [])
        self.game_log = []  # per game: list of (key, new?)
        self.cur = None
        self.myq = {}  # per (game, round) myQuestion text of plant clients

    def pair_key(self, real, fake):
        return real.strip() + " || " + fake.strip()

    def record(self, s, who):
        rnd = s["round"]
        rq = rnd.get("realQuestion") or {}
        fake = rnd.get("fakeQuestion")
        fake_text = fake.get("text") if isinstance(fake, dict) else fake
        if not rq.get("text") or not fake_text:
            return
        tag = (s["code"], rnd.get("number"))
        if tag in self.cur["rounds"]:
            return
        self.cur["rounds"].add(tag)
        k = self.pair_key(rq["text"], fake_text)
        sk = rnd.get("seenKey")
        if isinstance(sk, int) and sk not in self.seen_keys:
            self.seen_keys.append(sk)
        new = k not in self.qs
        e = self.qs.setdefault(k, {"_k": k})
        e["id"] = sk if sk is not None else e.get("id")
        e["kind"] = rq.get("kind")
        for f in ("spice", "category"):
            v = rq.get(f, rnd.get(f))
            if v is not None:
                e[f] = v
        e["real"] = rq["text"]
        e["fake"] = fake_text
        for f in ("unit", "min", "max", "options", "lowLabel", "highLabel", "placeholder"):
            if rq.get(f) is not None:
                e[f] = rq[f]
        if isinstance(fake, dict):
            for f, v in fake.items():
                if f != "text" and v != rq.get(f):
                    e.setdefault("fakeExtra", {})[f] = v
        e["seen"] = e.get("seen", 0) + 1
        e.setdefault("settingSpice", [])
        if self.cur["spice"] not in e["settingSpice"]:
            e["settingSpice"].append(self.cur["spice"])
        e.setdefault("tiers", [])
        if s.get("tier") and s["tier"] not in e["tiers"]:
            e["tiers"].append(s["tier"])
        self.cur["log"].append({"key": sk, "new": new, "kind": e["kind"]})
        print(f"  r{rnd.get('number')} [{e['kind']}] {'NEW' if new else 'dup'} seenKey={sk}: {rq['text']} || {fake_text}", flush=True)
        self.save()

    def save(self):
        qs = sorted(self.qs.values(), key=lambda q: (q.get("kind") or "", q.get("id") if isinstance(q.get("id"), int) else 9999))
        QFILE.write_text(json.dumps({"meta": self.meta, "questions": qs}, ensure_ascii=False, indent=1), "utf-8")
        SEENFILE.write_text(json.dumps(self.seen_keys), "utf-8")

    async def play_game(self, args):
        self.cur = {"rounds": set(), "log": [], "spice": args.spice}
        host = Player(0, True, args, self.record, args.raw)
        base = {"name": NAME, "client": "web"}
        create = {"t": "create", **base, "avatar": AVATARS[0], **seen_payload(self.seen_keys)}
        tasks = [asyncio.create_task(host.run(create))]
        players = [host]
        if args.humans:
            for _ in range(60):
                if host.code:
                    break
                await asyncio.sleep(0.5)
            for i in (1, 2):
                p = Player(i, False, args, self.record, None)
                players.append(p)
                tasks.append(asyncio.create_task(p.run({"t": "join", "code": host.code, **base, "avatar": AVATARS[i],
                                                        **seen_payload(self.seen_keys)})))
                await asyncio.sleep(1.0)
        await asyncio.wait_for(host.ready_to_start.wait(), 60)
        await asyncio.sleep(1.0)
        host.started = True
        await host.send({"t": "start"})
        t0 = time.time()
        # host finishing (final phase) ends the game; non-hosts are told to stop too
        done, pending = await asyncio.wait([tasks[0]], timeout=args.rounds * 90)
        for p in players[1:]:
            p.done.set()
            try:
                await p.send({"t": "leave"})
                await p.ws.close()
            except Exception:
                pass
        for t in tasks:
            if not t.done():
                t.cancel()
        res = await asyncio.gather(*tasks, return_exceptions=True)
        for r in res:
            if isinstance(r, Stop):
                raise r
        tier = (host.state or {}).get("tier")
        new = sum(1 for x in self.cur["log"] if x["new"])
        g = {"spice": args.spice, "humans": args.humans, "rounds": len(self.cur["log"]), "new": new,
             "tier": tier, "secs": round(time.time() - t0)}
        self.meta.setdefault("games", []).append(g)
        self.save()
        print(f"game done: {g}", flush=True)
        return g


def render():
    data = load_json(QFILE, {"questions": []})
    qs = data["questions"]
    order = ["number", "player", "text", "choice", "scale"]
    out = ["# השתול: בנק השאלות שנאסף", "",
           f"{len(qs)} זוגות ייחודיים. `seen` = כמה פעמים הזוג הופיע. `spice` = רמת הפלפל של השאלה (אם השרת חשף), "
           "`tiers` = ה-tier של החדר כשהזוג הופיע.", ""]
    esc = lambda x: str(x).replace("|", "\\|").replace("\n", " ")
    for k in order + sorted({q.get("kind") for q in qs} - set(order) - {None}):
        group = [q for q in qs if q.get("kind") == k]
        if not group:
            continue
        out += [f"## {k} ({len(group)})", "", "| id | spice | category | real (כולם) | fake (השתול) | format | seen | tiers |",
                "|---|---|---|---|---|---|---|---|"]
        for q in group:
            if k == "number":
                fmt = f"{q.get('min', '')}-{q.get('max', '')} {q.get('unit', '')}".strip()
            elif k == "choice":
                fmt = " / ".join(q.get("options") or [])
            elif k == "scale":
                fmt = f"1 {q.get('lowLabel', '')} .. 10 {q.get('highLabel', '')}"
            elif k == "text":
                fmt = q.get("placeholder", "")
            else:
                fmt = "שחקן"
            out.append("| " + " | ".join(esc(x) for x in [q.get("id", ""), q.get("spice", ""), q.get("category", ""),
                                                          q["real"], q["fake"], fmt, q.get("seen", 0),
                                                          ",".join(q.get("tiers", []))]) + " |")
        out.append("")
    MDFILE.write_text("\n".join(out), "utf-8")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=1)
    ap.add_argument("--spice", type=int, default=1, choices=[1, 2, 3])
    ap.add_argument("--rounds", type=int, default=12, choices=[5, 8, 12])
    ap.add_argument("--humans", action="store_true")
    ap.add_argument("--pause", type=float, default=20)
    ap.add_argument("--raw")
    ap.add_argument("--render", action="store_true")
    args = ap.parse_args()
    if args.render:
        render()
        return
    h = Harvest()
    for i in range(args.games):
        print(f"=== game {i + 1}/{args.games} spice={args.spice} humans={args.humans}", flush=True)
        try:
            await h.play_game(args)
        except Stop as e:
            print(f"STOP: {e}", flush=True)
            break
        except Exception as e:
            print(f"game failed: {type(e).__name__}: {e}", flush=True)
            h.save()
            break
        render()
        if i + 1 < args.games:
            await asyncio.sleep(args.pause)
    h.save()
    render()


if __name__ == "__main__":
    asyncio.run(main())
