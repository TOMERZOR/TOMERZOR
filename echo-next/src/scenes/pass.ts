/** Season pass: the XP track with its ten rewards, free lane and premium lane. */
import { Container, Text, Graphics } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout, killTweensDeep } from "../scenes";
import { W, C } from "../theme";
import { panel, button, display, body, progressBar, ribbon , spacing } from "../ui";
import { TopBar, TOP_H, ScrollView, iconSprite, heroSprite, toast } from "../widgets";
import { state, L } from "../state";
import { audio, buzz } from "../audio";
import { t } from "../i18n";
import { dialog } from "./dialog";
import { rewardLabel } from "./home";

export function rewardIcon(tier: { coins?: number; gems?: number; skin?: string }, size: number) {
  if (tier.skin) { const s = heroSprite(tier.skin); s.anchor.set(0.5); s.height = size; s.scale.x = s.scale.y; return s; }
  return iconSprite(tier.gems ? "gem" : "coin", size);
}

export class PassScene extends Scene {
  private top!: TopBar; private scroll!: ScrollView; private unsub = () => {};
  build() {
    const bg = new Graphics(); bg.rect(0, 0, W, 4000).fill({ color: C.night }); this.addChild(bg);
    this.scroll = new ScrollView(W, 1000); this.addChild(this.scroll);
    this.top = new TopBar({ back: () => Scenes.pop() }); this.addChild(this.top);
    this.fill(); this.unsub = state.on(() => { this.top.refresh(); this.fill(); });
  }
  private fill() {
    const c = this.scroll.content; c.removeChildren().forEach((x) => { killTweensDeep(x as Container); x.destroy({ children: true }); });
    const p = state.profile; let y = 30;
    // Header card.
    const hw = W - 80; const head = new Container(); head.position.set(40, y); head.addChild(panel(hw, 300, { radius: 32, glow: p.pass ? C.gold : undefined }));
    const chest = iconSprite("chest", 150); chest.position.set(120, 150); head.addChild(chest);
    gsap.to(chest, { y: 140, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut" });
    const eyebrow = new Text({ text: t("season_pass").toUpperCase(), style: body(24, C.mint, 800) }); eyebrow.style.letterSpacing = spacing(3); eyebrow.position.set(230, 44); head.addChild(eyebrow);
    const title = new Text({ text: t("season_name"), style: display(44) }); title.style.wordWrap = true; title.style.wordWrapWidth = hw - 260; title.position.set(230, 78); head.addChild(title);
    const next = L.PASS_TIERS[p.claimedTiers];
    const xp = new Text({ text: next ? `${p.passXp}${next.xp > p.passXp ? " / " + next.xp : ""} XP · ${t("tier_n", { n: p.claimedTiers + 1 })}` : t("all_claimed"), style: body(26, C.lilac, 800) }); xp.position.set(230, 160); head.addChild(xp);
    const bar = progressBar(hw - 270, 22, next ? p.passXp / Math.max(1, next.xp) : 1); bar.position.set(230, 200); head.addChild(bar);
    const how = new Text({ text: t("pass_how"), style: body(22, C.lilac) }); how.style.wordWrap = true; how.style.wordWrapWidth = hw - 270; how.position.set(230, 236); head.addChild(how);
    c.addChild(head); y += 330;
    // Buy / active.
    if (p.pass) { const r = ribbon(t("pass_owned"), C.mintDark, 420, 64); r.position.set((W - 420) / 2, y); c.addChild(r); y += 100; }
    else {
      const b = button({ w: hw, h: 130, label: t("pass_get", { p: L.IAP.pass.price }), sub: t("pass_d"), kind: "primary", size: 44, onTap: () => dialog({ eyebrow: t("purchase_title"), title: t("purchase_q", { item: t("season_pass"), price: L.IAP.pass.price }), text: t("purchase_note"), buttons: [{ label: t("cancel"), kind: "ghost" }, { label: t("confirm"), onTap: () => { const r = state.act({ t: "iap", sku: "pass" }); if (r.ok) { audio.play("buy"); buzz("success"); toast(t("bought")); } else toast(r.error); } }] }) });
      b.position.set(W / 2, y + 65); c.addChild(b); y += 170;
    }
    // Track.
    const lanes = new Text({ text: t("pass_sub"), style: body(24, C.lilac) }); lanes.style.wordWrap = true; lanes.style.wordWrapWidth = hw; lanes.position.set(40, y); c.addChild(lanes); y += lanes.height + 24;
    const rail = new Graphics(); c.addChild(rail);
    const y0 = y;
    L.PASS_TIERS.forEach((tier, i) => {
      const claimed = i < p.claimedTiers, reach = p.passXp >= tier.xp, free = i < 2, canClaim = i === p.claimedTiers && reach && (free || p.pass);
      const row = new Container(); row.position.set(40, y); const rh = 150;
      row.addChild(panel(hw, rh, { radius: 28, rivets: false, color: claimed ? C.plate : C.wall, glow: canClaim ? C.mint : undefined }));
      // tier disc
      const disc = new Graphics(); disc.circle(0, 4, 46).fill({ color: 0x000000, alpha: 0.4 }); disc.circle(0, 0, 46).fill({ color: claimed ? C.mint : reach ? C.gold : C.plateLight }); disc.circle(-6, -10, 24).fill({ color: 0xffffff, alpha: 0.25 }); disc.position.set(70, rh / 2); row.addChild(disc);
      const num = new Text({ text: String(i + 1), style: display(40, claimed || reach ? 0x2a1200 : C.lilac) }); num.anchor.set(0.5); num.position.set(70, rh / 2 - 2); row.addChild(num);
      const ic = rewardIcon(tier, 96); ic.position.set(180, rh / 2); if (!reach && !claimed) ic.alpha = 0.55; row.addChild(ic);
      const lb = new Text({ text: rewardLabel(tier), style: display(34, claimed ? C.lilac : C.cream) }); lb.anchor.set(0, 0.5); lb.position.set(250, rh / 2 - 18); row.addChild(lb);
      const sub = new Text({ text: free ? t("free_lane") : t("premium"), style: body(22, free ? C.mint : C.gold, 800) }); sub.anchor.set(0, 0.5); sub.position.set(250, rh / 2 + 24); row.addChild(sub);
      if (claimed) { const ck = iconSprite("check", 60); ck.position.set(hw - 90, rh / 2); row.addChild(ck); }
      else if (canClaim) { const b = button({ w: 200, h: 90, label: t("claim"), kind: "mint", size: 34, onTap: () => { const r = state.act({ t: "claim_pass" }); if (r.ok) { audio.play("buy"); buzz("success"); toast(rewardLabel(tier)); } else toast(r.error); } }); b.position.set(hw - 130, rh / 2); row.addChild(b); }
      else if (!free && !p.pass) { const lk = iconSprite("lock", 52); lk.position.set(hw - 90, rh / 2 - 14); row.addChild(lk); const s = new Text({ text: t("locked_pass"), style: body(20, C.lilac, 800) }); s.anchor.set(0.5); s.position.set(hw - 90, rh / 2 + 34); row.addChild(s); }
      else { const s = new Text({ text: t("xp_to_go", { n: Math.max(0, tier.xp - p.passXp) }), style: body(24, C.lilac, 800) }); s.anchor.set(1, 0.5); s.position.set(hw - 40, rh / 2); row.addChild(s); }
      c.addChild(row); y += rh + 18;
    });
    rail.roundRect(40 + 70 - 8, y0 + 75, 16, y - y0 - 150 - 18).fill({ color: C.plateLight });
    rail.roundRect(40 + 70 - 8, y0 + 75, 16, Math.max(0, (p.claimedTiers - 0.5) * 168)).fill({ color: C.mint });
    this.scroll.setContentHeight(y + 40);
  }
  relayout() { this.top.relayout(layout.safeTop); const y0 = layout.safeTop + TOP_H; this.scroll.y = y0; this.scroll.resize(W, layout.bottom - y0); }
  dispose() { this.unsub(); super.dispose(); }
}
