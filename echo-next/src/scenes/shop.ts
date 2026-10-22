/** Shop: robots to play as, then the store and free coins. */
import { Container, Text, Graphics } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout, killTweensDeep } from "../scenes";
import { W, C } from "../theme";
import { panel, button, display, body, ribbon, pill } from "../ui";
import { TopBar, TabBar, TOP_H, TAB_H, ScrollView, iconSprite, heroSprite, echoSprite, fitSprite, toast } from "../widgets";
import { state, L, today } from "../state";
import { audio, buzz } from "../audio";
import { t } from "../i18n";
import { dialog } from "./dialog";
import { PassScene } from "./pass";
import { showAd } from "./ads";

const TIER_COLOR = [C.plateLight, C.plateLight, C.violetDark, C.goldDark];

export class ShopScene extends Scene {
  private top!: TopBar; private tabs!: TabBar; private scroll!: ScrollView; private unsub = () => {};
  build() {
    const bg = new Graphics(); bg.rect(0, 0, W, 4000).fill({ color: C.night }); this.addChild(bg);
    this.scroll = new ScrollView(W, 1000); this.addChild(this.scroll);
    this.top = new TopBar(); this.tabs = new TabBar("shop"); this.addChild(this.top, this.tabs);
    this.fill(); this.unsub = state.on(() => { this.top.refresh(); this.fill(); });
  }
  private fill() {
    const c = this.scroll.content; c.removeChildren().forEach((x) => { killTweensDeep(x as Container); x.destroy({ children: true }); });
    const p = state.profile, mine = L.skinId(p.skin); let y = 20;
    // Your robot.
    const hero = new Container(); hero.position.set(40, y); const hw = W - 80, hh = 360;
    hero.addChild(panel(hw, hh, { radius: 32, color: C.plate, glow: C.mint }));
    const pad = new Graphics(); pad.ellipse(0, 0, 150, 44).fill({ color: C.mint, alpha: 0.18 }); pad.ellipse(0, 0, 150, 44).stroke({ color: C.mint, alpha: 0.8, width: 5 }); pad.position.set(200, hh - 60); hero.addChild(pad);
    const e = echoSprite(mine); e.position.set(300, hh - 70); fitSprite(e, 150, 230); e.alpha = 0.45; hero.addChild(e);
    const h = heroSprite(mine); h.position.set(200, hh - 60); fitSprite(h, 230, 300); hero.addChild(h);
    gsap.to(h, { y: hh - 72, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut" });
    const eb = new Text({ text: t("your_robot").toUpperCase(), style: body(24, C.mint, 800) }); eb.style.letterSpacing = 3; eb.position.set(400, 50); hero.addChild(eb);
    const nm = new Text({ text: t("sk_" + mine), style: display(56) }); nm.position.set(400, 84); hero.addChild(nm);
    const fl = new Text({ text: t("fl_" + mine), style: body(26, C.lilac) }); fl.style.wordWrap = true; fl.style.wordWrapWidth = hw - 440; fl.position.set(400, 160); hero.addChild(fl);
    const sub = new Text({ text: t("robots_sub"), style: body(22, C.lilac) }); sub.style.wordWrap = true; sub.style.wordWrapWidth = hw - 440; sub.position.set(400, 230); hero.addChild(sub);
    c.addChild(hero); y += hh + 40;

    const h1 = new Text({ text: t("robots"), style: display(48) }); h1.position.set(60, y); c.addChild(h1); y += 76;
    const ids = Object.keys(L.SKINS) as (keyof typeof L.SKINS)[]; const cw = (W - 80 - 24) / 2, ch = 430;
    ids.forEach((id, i) => {
      const s = L.SKINS[id] as any, owned = p.skins.includes(id), on = mine === id;
      const card = new Container(); card.position.set(40 + (i % 2) * (cw + 24), y + Math.floor(i / 2) * (ch + 24));
      card.addChild(panel(cw, ch, { radius: 30, color: on ? C.plate : C.wall, glow: on ? C.mint : undefined }));
      const glow = new Graphics(); glow.circle(0, 0, 110).fill({ color: parseInt(s.color.slice(1), 16), alpha: 0.18 }); glow.position.set(cw / 2, 170); card.addChild(glow);
      const sp = heroSprite(id); sp.position.set(cw / 2, 270); fitSprite(sp, 200, 240); if (!owned) sp.alpha = 0.92; card.addChild(sp);
      const rb = ribbon(t("tier" + s.tier), TIER_COLOR[s.tier] ?? C.plateLight, 180, 42); rb.position.set(cw / 2 - 90, 22); card.addChild(rb);
      const name = new Text({ text: t("sk_" + id), style: display(36) }); name.anchor.set(0.5); name.position.set(cw / 2, 300); card.addChild(name);
      let foot: Container;
      if (on) { foot = ribbon(t("equipped"), C.mintDark, 240, 56); foot.position.set(cw / 2 - 120, ch - 90); }
      else if (owned) { foot = button({ w: 240, h: 84, label: t("equip"), kind: "mint", size: 32, onTap: () => { const r = state.act({ t: "equip", skin: id }); if (r.ok) { audio.play("tap", 0.6); buzz("light"); } } }); foot.position.set(cw / 2, ch - 64); }
      else {
        const price = s.coins ? String(s.coins) : String(s.gems), cur = s.coins ? "coin" : "gem";
        foot = button({ w: 260, h: 84, label: "", kind: "primary", size: 32, onTap: () => this.confirmBuy(id) });
        const pl = new Container(); const ic = iconSprite(cur, 52); ic.x = -50; pl.addChild(ic); const pt = new Text({ text: price, style: display(36, 0x2a1200) }); pt.anchor.set(0, 0.5); pt.x = -14; pl.addChild(pt); pl.position.set(130, 40); foot.addChild(pl);
        foot.position.set(cw / 2, ch - 64);
      }
      card.addChild(foot); c.addChild(card);
    });
    y += Math.ceil(ids.length / 2) * (ch + 24) + 30;

    // Store.
    const h2 = new Text({ text: t("store"), style: display(48) }); h2.position.set(60, y); c.addChild(h2); y += 76;
    const sw = W - 80;
    if (!p.owned.includes("starter")) {
      const card = new Container(); card.position.set(40, y); card.addChild(panel(sw, 260, { radius: 32, color: C.plate, glow: C.gold }));
      const rb = ribbon(t("premium").toUpperCase(), C.coral, 200, 44); rb.position.set(30, -10); card.addChild(rb);
      const ro = heroSprite("royal"); ro.position.set(150, 240); fitSprite(ro, 200, 220); card.addChild(ro);
      const tt = new Text({ text: t("starter"), style: display(44) }); tt.position.set(290, 50); card.addChild(tt);
      const d = new Text({ text: t("starter_d"), style: body(26, C.lilac, 800) }); d.style.wordWrap = true; d.style.wordWrapWidth = sw - 560; d.position.set(290, 110); card.addChild(d);
      const b = button({ w: 220, h: 96, label: L.IAP.starter.price, kind: "primary", size: 36, onTap: () => this.confirmIap("starter", t("starter"), L.IAP.starter.price) }); b.position.set(sw - 140, 130); card.addChild(b);
      c.addChild(card); y += 290;
    }
    const items: [string, string, string, string, () => void][] = [
      ["gem", t("gems_small"), "100", L.IAP.gems_small.price, () => this.confirmIap("gems_small", t("gems_small"), L.IAP.gems_small.price)],
      ["gem", t("gems_big"), "600", L.IAP.gems_big.price, () => this.confirmIap("gems_big", t("gems_big"), L.IAP.gems_big.price)],
      ["chest", t("pass"), t("pass_d"), p.pass ? t("pass_owned") : L.IAP.pass.price, () => Scenes.push(new PassScene())],
      ["cross", t("noads"), t("noads_d"), p.noads ? t("owned") : L.IAP.noads.price, () => { if (!p.noads) this.confirmIap("noads", t("noads"), L.IAP.noads.price); }],
    ];
    const iw = (sw - 24) / 2;
    items.forEach(([ic, name, d, price, fn], i) => {
      const card = new Container(); card.position.set(40 + (i % 2) * (iw + 24), y + Math.floor(i / 2) * 264); card.addChild(panel(iw, 240, { radius: 28, rivets: false }));
      const s = iconSprite(ic, 90); s.position.set(iw / 2, 70); card.addChild(s);
      const n = new Text({ text: name, style: display(30) }); n.anchor.set(0.5); n.position.set(iw / 2, 135); card.addChild(n);
      const b = button({ w: iw - 80, h: 70, label: price, sub: "", kind: "secondary", size: 28, onTap: fn }); b.position.set(iw / 2, 198); card.addChild(b);
      void d; c.addChild(card);
    });
    y += Math.ceil(items.length / 2) * 264 + 20;
    // Free coins.
    if (!p.noads) {
      const left = p.adsDay === today() ? L.ADS_PER_DAY - p.adsToday : L.ADS_PER_DAY;
      const card = new Container(); card.position.set(40, y); card.addChild(panel(sw, 150, { radius: 28, rivets: false, color: C.plate }));
      const s = iconSprite("play", 70); s.position.set(70, 75); card.addChild(s);
      const n = new Text({ text: t("free_coins"), style: display(34) }); n.position.set(130, 36); card.addChild(n);
      const d = new Text({ text: left > 0 ? t("ads_left", { n: left }) : t("ads_none"), style: body(24, C.lilac, 800) }); d.position.set(130, 86); card.addChild(d);
      const b = button({ w: 300, h: 84, label: t("watch_ad"), kind: left > 0 ? "mint" : "ghost", size: 28, onTap: () => { if (left > 0) this.watchAd(); } }); b.position.set(sw - 180, 75); card.addChild(b);
      c.addChild(card); y += 180;
    }
    const note = new Text({ text: t("store_note"), style: body(22, C.lilac) }); note.anchor.set(0.5, 0); note.position.set(W / 2, y); c.addChild(note); y += 80;
    this.scroll.setContentHeight(y);
  }
  private confirmBuy(id: string) {
    const s = (L.SKINS as any)[id], price = s.coins ? `${s.coins} ${t("coins")}` : t("gems_n", { n: s.gems });
    dialog({ eyebrow: t("purchase_title"), title: t("purchase_q", { item: t("sk_" + id), price }), content: (() => { const h = heroSprite(id); h.anchor.set(0.5, 0); fitSprite(h, 200, 220); return h; })(),
      buttons: [{ label: t("cancel"), kind: "ghost" }, { label: t("buy"), onTap: () => { const r = state.act({ t: "buy", item: id }); if (r.ok) { audio.play("buy"); buzz("success"); toast(t("bought")); } else toast(r.error === "not enough coins" ? t("not_enough", { c: t("coins") }) : r.error === "not enough gems" ? t("not_enough", { c: t("gems") }) : r.error); } }] });
  }
  private confirmIap(sku: string, name: string, price: string) {
    dialog({ eyebrow: t("purchase_title"), title: t("purchase_q", { item: name, price }), text: t("purchase_note"), buttons: [{ label: t("cancel"), kind: "ghost" }, { label: t("confirm"), onTap: () => { const r = state.act({ t: "iap", sku }); if (r.ok) { audio.play("buy"); buzz("success"); toast(t("bought")); } else toast(r.error); } }] });
  }
  private watchAd() {
    showAd(() => { const r = state.act({ t: "ad", day: today() }); if (r.ok) { audio.play("coin"); toast(t("ad_done")); } });
  }
  relayout() {
    this.top.relayout(layout.safeTop); this.tabs.relayout(layout.bottom, layout.safeBottom);
    const y0 = layout.safeTop + TOP_H, y1 = layout.bottom - TAB_H - layout.safeBottom;
    this.scroll.y = y0; this.scroll.resize(W, y1 - y0);
  }
  dispose() { this.unsub(); super.dispose(); }
}
