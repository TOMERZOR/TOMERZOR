"""Builds the My Old Friend launch video in two shapes from one set of scenes:
composition/index.html (1920x1080) and composition-vertical/index.html (1080x1920, for stories).
Same timeline, same audio; only the layout differs. Run: python3 build.py"""
from pathlib import Path

HERE = Path(__file__).parent
DURATION = 18.8

FONTS = "\n".join(
    f'      @font-face {{ font-family: Rubik; font-weight: {w}; src: url(assets/fonts/rubik-{subset}-{w}-normal.woff2) format("woff2"); unicode-range: {rng}; }}'
    for w in (400, 500, 700, 800)
    for subset, rng in (
        ("hebrew", "U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F"),
        ("latin", "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"),
    )
)

BASE_CSS = """
      :root {
        --paper: #ffffff; --blush: #fbf1f5; --ink: #1d1a1c; --ink-2: #6b6268;
        --pink: #d6336f; --pink-deep: #a82157; --moffy: #ec6c9c; --moffy-deep: #b8336a;
        --bubble: #e9e9eb; --chat-bg: #efe7de; --chat-green: #128c7e;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: var(--W); height: var(--H); overflow: hidden; background: var(--paper); }
      #root { position: relative; width: var(--W); height: var(--H); font-family: Rubik, "DejaVu Sans", sans-serif; color: var(--ink); background: var(--paper); overflow: hidden; }
      .clip { position: absolute; inset: 0; }
      .stage { background: var(--stage-bg); }

      /* Moffy, drawn the way the app draws her. */
      .moffy { position: absolute; }
      .moffy .body { position: absolute; inset: 0; border-radius: 30%; background: linear-gradient(180deg, #f283ad, var(--moffy)); box-shadow: 0 7% 0 var(--moffy-deep), 0 14% 24% rgba(184, 51, 106, 0.25); }
      .moffy .shine { position: absolute; left: 14%; right: 14%; top: 7%; height: 7%; border-radius: 99px; background: rgba(255, 255, 255, 0.35); }
      .moffy .eye { position: absolute; top: 30%; width: 13%; height: 36%; border-radius: 99px; background: #fff; }
      .moffy .eye.l { left: 30%; } .moffy .eye.r { right: 30%; }
      .moffy.worried .eye.l { transform: rotate(18deg); } .moffy.worried .eye.r { transform: rotate(-18deg); }

      /* A phone. Everything inside is sized from --u, one hundredth of the screen width. */
      .phone { position: absolute; left: var(--phone-x); top: var(--phone-y); width: var(--phone-w); height: var(--phone-h); border-radius: calc(var(--u) * 16); background: #111; padding: calc(var(--u) * 4); box-shadow: 0 40px 90px rgba(29, 26, 28, 0.25); }
      .screen { position: relative; width: 100%; height: 100%; border-radius: calc(var(--u) * 12.5); overflow: hidden; background: #fff; direction: rtl; }
      .screen > img { width: 100%; height: 100%; display: block; object-fit: cover; }
      .status { height: calc(var(--u) * 13); display: flex; justify-content: space-between; align-items: flex-end; padding: 0 calc(var(--u) * 9) calc(var(--u) * 2); font-size: calc(var(--u) * 4); font-weight: 700; direction: ltr; }
      .island { position: absolute; top: calc(var(--u) * 3); left: 50%; width: calc(var(--u) * 30); height: calc(var(--u) * 8.5); margin-left: calc(var(--u) * -15); border-radius: 99px; background: #111; }

      /* Messaging app */
      .chat { background: var(--chat-bg); }
      .chat .top { background: #f6f6f6; border-bottom: 1px solid #ddd; }
      .chat .head { display: flex; align-items: center; gap: calc(var(--u) * 3); padding: calc(var(--u) * 2.5) calc(var(--u) * 4) calc(var(--u) * 3); }
      .chat .back { font-size: calc(var(--u) * 8); color: #007aff; line-height: 1; }
      .chat .avatar { width: calc(var(--u) * 11); height: calc(var(--u) * 11); border-radius: 50%; background: linear-gradient(160deg, #e0457f, #c22a62); color: #fff; font-weight: 700; font-size: calc(var(--u) * 5.5); display: flex; align-items: center; justify-content: center; }
      .chat .who { font-size: calc(var(--u) * 5.8); font-weight: 700; }
      .chat .online { font-size: calc(var(--u) * 3.6); color: #107f73; }
      .chat .msgs { display: flex; flex-direction: column; align-items: flex-start; gap: calc(var(--u) * 3); padding: calc(var(--u) * 6) calc(var(--u) * 4); }
      .chat .msg { position: relative; background: #fff; border-radius: calc(var(--u) * 4); border-top-right-radius: calc(var(--u) * 1); padding: calc(var(--u) * 2.6) calc(var(--u) * 4) calc(var(--u) * 2); max-width: 90%; font-size: calc(var(--u) * 6.4); line-height: 1.35; box-shadow: 0 1px 1px rgba(0, 0, 0, 0.08); }
      .chat .msg .t { display: block; text-align: left; font-size: calc(var(--u) * 3.4); color: #6f6f6f; margin-top: calc(var(--u) * 0.8); }
      .chat .dots { background: #fff; border-radius: calc(var(--u) * 4); padding: calc(var(--u) * 3.2) calc(var(--u) * 4); display: flex; gap: calc(var(--u) * 1.6); }
      .chat .dots i { width: calc(var(--u) * 2.2); height: calc(var(--u) * 2.2); border-radius: 50%; background: #9a9a9a; display: block; }
      .chat .bar { position: absolute; left: 0; right: 0; bottom: 0; background: #f6f6f6; padding: calc(var(--u) * 3) calc(var(--u) * 4) calc(var(--u) * 8); display: flex; gap: calc(var(--u) * 3); align-items: center; }
      .chat .field { flex: 1; height: calc(var(--u) * 10); border-radius: 99px; background: #fff; border: 1px solid #ddd; color: #767676; font-size: calc(var(--u) * 4.2); display: flex; align-items: center; padding: 0 calc(var(--u) * 4); }
      .chat .mic { width: calc(var(--u) * 10); height: calc(var(--u) * 10); border-radius: 50%; background: var(--chat-green); }

      /* Moffy's "write your question" screen */
      .ask { background: #fff; }
      .ask .nav { display: flex; align-items: center; justify-content: center; position: relative; height: calc(var(--u) * 13); font-size: calc(var(--u) * 5); font-weight: 700; }
      .ask .cancel { position: absolute; right: calc(var(--u) * 5); font-weight: 500; color: var(--pink); }
      .ask .box { margin: calc(var(--u) * 5) calc(var(--u) * 5) 0; min-height: calc(var(--u) * 30); border-radius: calc(var(--u) * 5); border: 2px solid var(--pink); padding: calc(var(--u) * 5); position: relative; }
      .ask .ph { position: absolute; top: calc(var(--u) * 5); right: calc(var(--u) * 5); font-size: calc(var(--u) * 5.4); color: #a9a2a6; }
      .ask .line { display: flex; align-items: center; font-size: calc(var(--u) * 6.4); font-weight: 500; height: calc(var(--u) * 9); }
      .ask .typed { display: inline-block; overflow: hidden; white-space: nowrap; width: 0; }
      .ask .caret { width: calc(var(--u) * 0.8); height: calc(var(--u) * 8); background: var(--pink); border-radius: 2px; margin-right: 2px; }
      .ask .send { margin: calc(var(--u) * 6) calc(var(--u) * 5) 0; height: calc(var(--u) * 15); border-radius: calc(var(--u) * 5); background: linear-gradient(180deg, #e84a8a, #d02a6b); box-shadow: 0 calc(var(--u) * 1.5) 0 var(--pink-deep); color: #fff; font-size: calc(var(--u) * 5.6); font-weight: 700; display: flex; align-items: center; justify-content: center; gap: calc(var(--u) * 2.5); }
      .ask .send svg { width: calc(var(--u) * 5.5); height: calc(var(--u) * 5.5); }
      .ask .tap { position: absolute; width: calc(var(--u) * 16); height: calc(var(--u) * 16); border-radius: 50%; background: rgba(29, 26, 28, 0.18); border: 3px solid rgba(255, 255, 255, 0.9); left: 50%; margin-left: calc(var(--u) * -8); top: calc(var(--u) * 66.5); opacity: 0; }
      .ask .kbd { position: absolute; left: 0; right: 0; bottom: 0; background: #d1d3d9; padding: calc(var(--u) * 3) calc(var(--u) * 1.5) calc(var(--u) * 9); display: flex; flex-direction: column; gap: calc(var(--u) * 2.4); direction: rtl; }
      .ask .row { display: flex; justify-content: center; gap: calc(var(--u) * 1.4); }
      .ask .key { width: calc(var(--u) * 8.2); height: calc(var(--u) * 11); border-radius: calc(var(--u) * 1.6); background: #fff; box-shadow: 0 1px 0 #8e9096; font-size: calc(var(--u) * 5); display: flex; align-items: center; justify-content: center; }
      .ask .key.wide { width: calc(var(--u) * 44); }
      .ask .key.mod { width: calc(var(--u) * 13); background: #adb1b9; font-size: calc(var(--u) * 3.6); }

      /* Words beside or above the phone */
      .copy { position: absolute; direction: rtl; display: flex; flex-direction: column; gap: var(--copy-gap); }
      .copy .eyebrow { font-size: var(--eyebrow); font-weight: 700; color: var(--pink); }
      .copy .big { font-size: var(--big); font-weight: 800; line-height: 1.12; letter-spacing: -0.01em; text-wrap: balance; }
      .copy .small { font-size: var(--small); font-weight: 500; line-height: 1.3; color: var(--ink-2); text-wrap: balance; }

      /* Reveal and outro */
      .brand { position: absolute; left: 0; right: 0; text-align: center; padding: 0 60px; }
      .name { font-weight: 800; letter-spacing: -0.02em; }
      .tag { font-weight: 500; color: var(--pink); direction: rtl; text-wrap: balance; }
      .offer { direction: rtl; }
      .offer span { display: inline-block; font-weight: 700; color: #fff; background: var(--pink); border-radius: 30px; box-shadow: 0 10px 0 var(--pink-deep); }
      .soon { font-weight: 500; color: var(--ink-2); direction: rtl; }

      /* Scam */
      #s5 .sms { position: absolute; direction: rtl; background: var(--bubble); border-radius: 40px; line-height: 1.4; }
      #s5 .sms .link { color: #2f6fd6; text-decoration: underline; white-space: nowrap; direction: ltr; unicode-bidi: isolate; }
      #s5 .stamp { position: absolute; border-radius: 50%; background: var(--pink); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 0 var(--pink-deep); }
      #s5 .card { position: absolute; direction: rtl; background: var(--paper); border-radius: 36px; box-shadow: 0 24px 60px rgba(29, 26, 28, 0.18); }
      #s5 .card .eyebrow { font-weight: 700; color: var(--pink); }
      #s5 .card .say { font-weight: 700; line-height: 1.25; margin-top: 8px; }
"""

LANDSCAPE_CSS = """
      :root { --W: 1920px; --H: 1080px; --stage-bg: linear-gradient(90deg, var(--blush) 0 46%, var(--paper) 46% 100%);
              --phone-x: 330px; --phone-y: 70px; --phone-w: 440px; --phone-h: 940px; --u: 4.04px;
              --eyebrow: 36px; --big: 82px; --small: 50px; --copy-gap: 30px; }
      .stage .copy { right: 150px; top: 0; bottom: 0; width: 820px; justify-content: center; }
      #s2 .moffy { left: 850px; top: 220px; width: 220px; height: 220px; }
      #s2 .name { top: 560px; font-size: 128px; }
      #s2 .tag { top: 730px; font-size: 64px; }
      #s5 .sms { left: 260px; top: 250px; width: 760px; padding: 36px 44px; font-size: 44px; }
      #s5 .stamp { left: 220px; top: 210px; width: 96px; height: 96px; font-size: 56px; }
      #s5 .card { left: 230px; top: 640px; width: 820px; padding: 34px 44px; }
      #s5 .card .eyebrow { font-size: 30px; } #s5 .card .say { font-size: 50px; }
      #s5 .moffy { left: 70px; top: 610px; width: 160px; height: 160px; }
      #s5 .copy { right: 140px; top: 0; bottom: 0; width: 640px; justify-content: center; }
      #s6 .moffy { left: 880px; top: 170px; width: 160px; height: 160px; }
      #s6 .name { top: 400px; font-size: 120px; }
      #s6 .tag { top: 560px; font-size: 54px; }
      #s6 .offer { top: 690px; } #s6 .offer span { font-size: 46px; padding: 22px 48px; }
      #s6 .soon { top: 860px; font-size: 40px; }
"""

VERTICAL_CSS = """
      :root { --W: 1080px; --H: 1920px; --stage-bg: linear-gradient(180deg, var(--paper) 0 24%, var(--blush) 24% 100%);
              --phone-x: 230px; --phone-y: 500px; --phone-w: 620px; --phone-h: 1324px; --u: 5.84px;
              --eyebrow: 40px; --big: 84px; --small: 46px; --copy-gap: 18px; }
      .stage .copy { left: 80px; right: 80px; top: 110px; height: 360px; justify-content: flex-start; text-align: center; align-items: center; }
      #s2 .moffy { left: 400px; top: 560px; width: 280px; height: 280px; }
      #s2 .name { top: 960px; font-size: 124px; }
      #s2 .tag { top: 1130px; font-size: 64px; }
      #s5 .sms { left: 120px; top: 560px; width: 840px; padding: 40px 48px; font-size: 48px; }
      #s5 .stamp { left: 80px; top: 510px; width: 110px; height: 110px; font-size: 62px; }
      #s5 .card { left: 230px; top: 920px; width: 770px; padding: 36px 44px; }
      #s5 .card .eyebrow { font-size: 34px; } #s5 .card .say { font-size: 54px; }
      #s5 .moffy { left: 60px; top: 900px; width: 170px; height: 170px; }
      #s5 .copy { left: 80px; right: 80px; top: 170px; text-align: center; align-items: center; }
      #s6 .moffy { left: 430px; top: 520px; width: 220px; height: 220px; }
      #s6 .name { top: 860px; font-size: 118px; }
      #s6 .tag { top: 1030px; font-size: 54px; }
      #s6 .offer { top: 1230px; } #s6 .offer span { font-size: 42px; padding: 22px 40px; }
      #s6 .soon { top: 1400px; font-size: 44px; }
"""


def moffy(extra=""):
    return f'<div class="moffy {extra}"><div class="body"></div><div class="shine"></div><div class="eye l"></div><div class="eye r"></div></div>'


KEYS = [list("פםןוטאר׳ק"), list("ףךלחיעכגדש"), list("ץתצמנהבסז")]
KEYBOARD = "".join(
    '<div class="row">' + "".join(f'<div class="key">{k}</div>' for k in row) + "</div>" for row in KEYS
) + '<div class="row"><div class="key mod">123</div><div class="key wide">רווח</div><div class="key mod">שליחה</div></div>'

PLANE = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M2 21l21-9L2 3v7l15 2-15 2z" transform="scale(-1,1) translate(-24,0)"/></svg>'

SCENES = f"""
      <section id="s1" class="clip stage" data-start="0" data-duration="2.4" data-track-index="0">
        <div class="phone"><div class="screen chat">
          <div class="top"><div class="status"><span>9:41</span><span>100%</span></div><div class="island"></div>
            <div class="head"><span class="back">‹</span><div class="avatar">ס</div><div><div class="who">סבתא ❤️</div><div class="online">מחוברת</div></div></div></div>
          <div class="msgs">
            <div class="msg b1">איך מדליקים את הטלוויזיה?<span class="t">09:41</span></div>
            <div class="msg b2">ואיך שולחים תמונה בוואטסאפ?<span class="t">09:41</span></div>
            <div class="msg b3">מישהו ביקש ממני קוד מ-SMS…<span class="t">09:42</span></div>
            <div class="dots"><i></i><i></i><i></i></div>
          </div>
          <div class="bar"><div class="field">הודעה</div><div class="mic"></div></div>
        </div></div>
        <div class="copy"><div class="eyebrow">מכירים את זה?</div><div class="big">כל יום, אותן שאלות.</div></div>
      </section>

      <section id="s2" class="clip" data-start="2.4" data-duration="1.8" data-track-index="0">
        {moffy()}
        <div class="brand name">My Old Friend</div>
        <div class="brand tag">בינה מלאכותית לגיל השלישי</div>
      </section>

      <section id="s2b" class="clip stage" data-start="4.2" data-duration="2.1" data-track-index="0">
        <div class="phone"><div class="screen ask">
          <div class="status"><span>9:41</span><span>100%</span></div><div class="island"></div>
          <div class="nav">כתבו את השאלה<span class="cancel">ביטול</span></div>
          <div class="box"><div class="ph">למשל: איך מגדילים את האותיות?</div>
            <div class="line"><span class="typed">איך מדליקים את הטלוויזיה?</span><span class="caret"></span></div></div>
          <div class="send">לשאול את מופי {PLANE}</div>
          <div class="tap"></div>
          <div class="kbd">{KEYBOARD}</div>
        </div></div>
        <div class="copy"><div class="eyebrow">שאלה</div><div class="big">שואלים את מופי,</div><div class="small">במילים שלכם, בקול או בכתב.</div></div>
      </section>

      <section id="s3" class="clip stage" data-start="6.3" data-duration="5.5" data-track-index="0">
        <div class="phone"><div class="screen"><img src="assets/he-pointing-light.png" alt="" /></div></div>
        <div class="copy"><div class="eyebrow">מצלמה</div><div class="big l1">מכוונים את הטלפון.</div><div class="small l2">מופי מראה בדיוק על מה ללחוץ, ואומרת את זה בקול.</div></div>
      </section>

      <section id="s4" class="clip stage" data-start="11.8" data-duration="2.2" data-track-index="0">
        <div class="phone"><div class="screen"><img src="assets/he-photo-light.png" alt="" /></div></div>
        <div class="copy"><div class="eyebrow">צילום מסך</div><div class="big l1">לחיצה אחת על ״תמונה אחרונה״.</div><div class="small l2">צעד אחד בכל פעם, באותיות גדולות.</div></div>
      </section>

      <section id="s5" class="clip" data-start="14.0" data-duration="2.2" data-track-index="0">
        <div class="sms">מזל טוב!! זכית באייפון חדש 🎉 לאישור המשלוח לחץ כאן: <span class="link">doar-prize.top/a7</span></div>
        <div class="stamp">✕</div>
        {moffy("worried")}
        <div class="card"><div class="eyebrow">זהירות</div><div class="say">אל תלחצו על הקישור. זו הודעת הונאה.</div></div>
        <div class="copy"><div class="eyebrow">שומרת עליהם</div><div class="big">ומזהירה מעוקצים.</div></div>
      </section>

      <section id="s6" class="clip" data-start="16.2" data-duration="2.6" data-track-index="0">
        {moffy()}
        <div class="brand name">My Old Friend</div>
        <div class="brand tag">החבר הוותיק שלי, בכל שאלה של טכנולוגיה</div>
        <div class="brand offer"><span>20 שאלות ראשונות חינם · ₪24.90 לחודש</span></div>
        <div class="brand soon">בקרוב לאייפון</div>
      </section>
"""

# (sound, start, length, volume)
CUES = [
    ("ding", 0.25, 0.9, 0.55), ("ding", 0.75, 0.9, 0.55), ("ding", 1.25, 0.9, 0.55),
    ("whoosh", 2.1, 0.7, 0.4), ("boing", 2.72, 1.25, 0.6), ("whoosh", 3.95, 0.7, 0.4),
    ("typing", 4.55, 1.1, 0.6), ("ding", 5.8, 0.9, 0.35), ("whoosh", 6.05, 0.7, 0.4),
    ("whoosh", 11.55, 0.7, 0.4), ("whoosh", 13.75, 0.7, 0.4), ("buzz", 14.3, 0.55, 0.5),
    ("whoosh", 15.95, 0.7, 0.4), ("boing", 16.68, 1.25, 0.35), ("chime", 16.8, 0.6, 0.6),
]
AUDIO = "\n".join(
    [
        f'      <audio id="music" class="clip" src="assets/music-bed.mp3" data-start="0" data-duration="{DURATION}" data-track-index="1" data-volume="1"></audio>',
        '      <audio id="vo" class="clip" src="assets/yael-fast.mp3" data-start="6.45" data-duration="5.32" data-track-index="2" data-volume="1"></audio>',
    ]
    + [
        f'      <audio id="sfx{i}" class="clip" src="assets/sfx-{name}.mp3" data-start="{t}" data-duration="{d}" data-track-index="3" data-volume="{v}"></audio>'
        for i, (name, t, d, v) in enumerate(CUES)
    ]
)

SCRIPT = """
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      const pop = { ease: "back.out(1.7)", duration: 0.4 };
      const rise = (sel, at, d = 0.35) => tl.fromTo(sel, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: d, ease: "power3.out" }, at);
      const leave = (sel, at) => tl.to(sel, { opacity: 0, duration: 0.2 }, at);

      // 1. Grandma's messages arrive in a chat.
      tl.fromTo("#s1 .phone", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, 0);
      rise("#s1 .copy", 0.15);
      tl.set("#s1 .dots", { opacity: 0 }, 0);
      tl.fromTo("#s1 .b1", { opacity: 0, scale: 0.85, y: 20 }, { opacity: 1, scale: 1, y: 0, transformOrigin: "100% 0%", ...pop }, 0.25);
      tl.fromTo("#s1 .b2", { opacity: 0, scale: 0.85, y: 20 }, { opacity: 1, scale: 1, y: 0, transformOrigin: "100% 0%", ...pop }, 0.75);
      tl.fromTo("#s1 .b3", { opacity: 0, scale: 0.85, y: 20 }, { opacity: 1, scale: 1, y: 0, transformOrigin: "100% 0%", ...pop }, 1.25);
      tl.fromTo("#s1 .dots", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.25 }, 1.7);
      tl.to("#s1 .dots i", { y: -6, duration: 0.15, yoyo: true, repeat: 3, stagger: 0.08 }, 1.75);
      leave("#s1 .phone, #s1 .copy", 2.2);

      // 2. Moffy drops in; the name lands.
      tl.fromTo("#s2 .moffy", { y: -500 }, { y: 0, duration: 0.38, ease: "power2.in" }, 2.4);
      tl.to("#s2 .moffy", { scaleY: 0.86, scaleX: 1.08, transformOrigin: "50% 100%", duration: 0.08 }, 2.78);
      tl.to("#s2 .moffy", { scaleY: 1, scaleX: 1, duration: 0.3, ease: "back.out(3)" }, 2.86);
      rise("#s2 .name", 2.9);
      rise("#s2 .tag", 3.05);
      tl.to("#s2 .eye", { scaleY: 0.1, duration: 0.07, yoyo: true, repeat: 1 }, 3.5);
      leave("#s2 .moffy, #s2 .brand", 4.0);

      // 2b. The question is typed into Moffy's box and sent.
      tl.fromTo("#s2b .phone", { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 4.2);
      rise("#s2b .copy", 4.3);
      tl.to("#s2b .ph", { opacity: 0, duration: 0.05 }, 4.55);
      tl.fromTo("#s2b .typed", { width: 0 }, { width: () => document.querySelector("#s2b .typed").scrollWidth + 2, duration: 1.1, ease: "steps(24)" }, 4.55);
      tl.to("#s2b .caret", { opacity: 0, duration: 0.01, yoyo: true, repeat: 1, repeatDelay: 0.2 }, 5.7);
      tl.fromTo("#s2b .tap", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.18 }, 5.78);
      tl.to("#s2b .send", { scale: 0.95, duration: 0.08, yoyo: true, repeat: 1 }, 5.8);
      tl.to("#s2b .tap", { opacity: 0, duration: 0.2 }, 6.0);
      leave("#s2b .phone, #s2b .copy", 6.1);

      // 3. Camera: Moffy points at the button while Yael says it.
      tl.fromTo("#s3 .phone", { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" }, 6.3);
      tl.fromTo("#s3 .eyebrow", { opacity: 0 }, { opacity: 1, duration: 0.25 }, 6.4);
      rise("#s3 .l1", 6.45);
      rise("#s3 .l2", 7.05);
      tl.to("#s3 .phone", { scale: 1.04, duration: 4.5, ease: "none" }, 6.9);
      leave("#s3 .phone, #s3 .copy", 11.6);

      // 4. Screenshot.
      tl.fromTo("#s4 .phone", { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 11.8);
      tl.fromTo("#s4 .eyebrow", { opacity: 0 }, { opacity: 1, duration: 0.25 }, 11.85);
      rise("#s4 .l1", 11.9);
      rise("#s4 .l2", 12.3);
      leave("#s4 .phone, #s4 .copy", 13.8);

      // 5. Scam.
      rise("#s5 .sms", 14.0, 0.3);
      tl.fromTo("#s5 .stamp", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(3)" }, 14.3);
      tl.fromTo("#s5 .moffy", { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.3, ease: "back.out(2)" }, 14.45);
      rise("#s5 .card", 14.55);
      rise("#s5 .copy", 14.7);
      leave("#s5 .sms, #s5 .stamp, #s5 .moffy, #s5 .card, #s5 .copy", 16.0);

      // 6. Outro.
      tl.fromTo("#s6 .moffy", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "back.out(2.5)" }, 16.2);
      rise("#s6 .name", 16.3);
      rise("#s6 .tag", 16.5);
      tl.to("#s6 .moffy", { y: -26, duration: 0.2, ease: "power2.out", yoyo: true, repeat: 1 }, 16.7);
      tl.fromTo("#s6 .offer", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, ...pop }, 16.8);
      tl.fromTo("#s6 .soon", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 17.15);
      tl.to("#s6 .eye", { scaleY: 0.1, duration: 0.07, yoyo: true, repeat: 1 }, 17.9);

      window.__timelines["main"] = tl;
      tl.seek(0);
"""


def page(width, height, resolution, layout_css):
    return f"""<!doctype html>
<html lang="he" data-resolution="{resolution}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={width}, height={height}" />
    <script src="assets/gsap.min.js"></script>
    <style>
{FONTS}
{BASE_CSS}
{layout_css}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DURATION}" data-width="{width}" data-height="{height}">
{SCENES}
{AUDIO}
    </div>
    <script>
{SCRIPT}
    </script>
  </body>
</html>
"""


(HERE / "composition" / "index.html").write_text(page(1920, 1080, "landscape", LANDSCAPE_CSS))
(HERE / "composition-vertical" / "index.html").write_text(page(1080, 1920, "portrait", VERTICAL_CSS))
print("built both")
