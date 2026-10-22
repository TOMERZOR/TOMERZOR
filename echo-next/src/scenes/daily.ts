/** Daily: today's room for everyone, your best, the streak and the board. */
import { Container, Text, Graphics } from "pixi.js";
import { Scene, Scenes, layout, killTweensDeep } from "../scenes";
import { W, C } from "../theme";
import { panel, button, display, body } from "../ui";
import { TopBar, TabBar, TOP_H, TAB_H, ScrollView, iconSprite, starRow } from "../widgets";
import { state, L, today } from "../state";
import { audio } from "../audio";
import { t, bidi } from "../i18n";
import { LevelScene } from "./level";

export class DailyScene extends Scene {
  private top!: TopBar; private tabs!: TabBar; private scroll!: ScrollView; private unsub = () => {};
  build() {
    const bg = new Graphics(); bg.rect(0, 0, W, 4000).fill({ color: C.night }); this.addChild(bg);
    this.scroll = new ScrollView(W, 1000); this.addChild(this.scroll);
    this.top = new TopBar(); this.tabs = new TabBar("daily"); this.addChild(this.top, this.tabs);
    this.fill(); this.unsub = state.on(() => { this.top.refresh(); this.fill(); });
  }
  private fill() {
    const c = this.scroll.content; c.removeChildren().forEach((x) => { killTweensDeep(x as Container); x.destroy({ children: true }); });
    const p = state.profile, day = today(), key = `daily-${day}`, best = p.best[key];
    let y = 30;
    const h1 = new Text({ text: t("daily"), style: display(60) }); h1.position.set(60, y); c.addChild(h1); y += 80;
    const sub = new Text({ text: t("daily_sub"), style: body(28, C.lilac) }); sub.style.wordWrap = true; sub.style.wordWrapWidth = W - 120; sub.position.set(60, y); c.addChild(sub); y += sub.height + 30;

    // Today's room card.
    const card = new Container(); card.position.set(40, y); const cw = W - 80, ch = 380;
    card.addChild(panel(cw, ch, { radius: 32, glow: C.gold }));
    const ic = iconSprite("cal", 110); ic.position.set(110, 110); card.addChild(ic);
    const name = new Text({ text: t("daily_name", { d: day % 1000 }), style: display(48) }); name.position.set(200, 50); card.addChild(name);
    const line = new Text({ text: best ? bidi(`${best.echoes} ${t("echoes_used")} · ${best.ticks} ${t("seconds")}`) : t("daily_open"), style: body(28, C.lilac, 800) }); line.position.set(200, 118); card.addChild(line);
    if (best) { const st = starRow(p.stars[key] || 1, 44); st.position.set(cw - 120, 90); card.addChild(st); }
    if (p.streak) { const fl = iconSprite("flame", 44); fl.position.set(220, 180); card.addChild(fl); const s = new Text({ text: t("streak", { n: p.streak }), style: body(26, C.gold, 800) }); s.anchor.set(0, 0.5); s.position.set(250, 180); card.addChild(s); }
    const play = button({ w: cw - 100, h: 110, label: t("play_daily"), kind: "primary", size: 40, onTap: () => { audio.play("tap", 0.6); Scenes.push(new LevelScene(L.dailyLevel(day), "daily")); } });
    play.position.set(cw / 2, ch - 90); card.addChild(play);
    c.addChild(card); y += ch + 40;

    // Leaderboard.
    const h2 = new Text({ text: t("leaderboard"), style: display(44) }); h2.position.set(60, y); c.addChild(h2); y += 70;
    const board = state.daily.day === day ? state.daily.board : [];
    const bh = Math.max(140, 30 + board.length * 86);
    const bp = new Container(); bp.position.set(40, y); bp.addChild(panel(W - 80, bh, { radius: 28, rivets: false, color: C.plate }));
    if (!board.length) { const e = new Text({ text: t("board_empty"), style: body(28, C.lilac) }); e.anchor.set(0.5); e.position.set((W - 80) / 2, bh / 2); bp.addChild(e); }
    board.forEach((row: any, i: number) => {
      const r = new Container(); r.y = 20 + i * 86; const me = row.pid === state.pid;
      if (me) { const hl = new Graphics(); hl.roundRect(16, 0, W - 112, 76, 20).fill({ color: C.mint, alpha: 0.14 }); r.addChild(hl); }
      const rank = new Text({ text: String(i + 1), style: display(36, i < 3 ? C.gold : C.lilac) }); rank.anchor.set(0.5); rank.position.set(70, 38); r.addChild(rank);
      const nm = new Text({ text: (row.name || t("unnamed")) + (me ? ` · ${t("you")}` : ""), style: body(30, me ? C.mint : C.cream, 800) }); nm.anchor.set(0, 0.5); nm.position.set(120, 38); r.addChild(nm);
      const sc = new Text({ text: bidi(`${row.echoes} ${t("echoes_used")} · ${row.ticks}`), style: body(26, C.lilac, 800) }); sc.anchor.set(1, 0.5); sc.position.set(W - 120, 38); r.addChild(sc);
      bp.addChild(r);
    });
    c.addChild(bp); y += bh + 60;
    this.scroll.setContentHeight(y);
  }
  relayout() {
    this.top.relayout(layout.safeTop); this.tabs.relayout(layout.bottom, layout.safeBottom);
    const y0 = layout.safeTop + TOP_H, y1 = layout.bottom - TAB_H - layout.safeBottom;
    this.scroll.y = y0; this.scroll.resize(W, y1 - y0);
  }
  dispose() { this.unsub(); super.dispose(); }
}
