// Behaviour shared by the fit page and the scan results.
import { toast } from "../ui.js";
import { go } from "../router.js";
import * as store from "../store.js";

/**
 * Save / watch buttons inside tags. `resolve(tagEl)` returns the item data for a tag.
 */
export function bindTagActions(root, resolve) {
  const onClick = (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || !root.contains(btn)) return;
    const tag = btn.closest("[data-item]");
    const item = tag && resolve(tag);
    if (!item) return;
    const key = store.itemKey(item);
    if (btn.dataset.action === "save") {
      if (store.isSaved(key)) {
        store.removeItem(key);
        setPressed(btn, false, "heart");
        btn.setAttribute("aria-label", "שמירה בארון");
        toast("הוסר מהארון");
      } else {
        store.saveItem(item);
        setPressed(btn, true, "heart-fill");
        btn.setAttribute("aria-label", "הסרה מהארון");
        toast("נשמר בארון", { action: "לצפייה", onAction: () => go("closet") });
      }
    } else if (btn.dataset.action === "watch") {
      if (store.isWatching(key)) {
        store.setWatch(key, false);
        setPressed(btn, false, "bell");
        btn.setAttribute("aria-label", "עדכנו אותי כשיחזור למלאי");
        toast("התראת המלאי בוטלה");
      } else {
        store.saveItem(item, { watch: true });
        setPressed(btn, true, "bell-ringing-fill");
        btn.setAttribute("aria-label", "ביטול התראת מלאי");
        const like = tag.querySelector('[data-action="save"]');
        if (like) setPressed(like, true, "heart-fill");
        toast("נבדוק בחנות ונעדכן אתכם כשהפריט יחזור");
      }
    }
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}

function setPressed(btn, on, iconName) {
  btn.setAttribute("aria-pressed", String(on));
  const use = btn.querySelector("use");
  if (use) use.setAttribute("href", `#i-${iconName}`);
  const label = btn.querySelector("[data-label]");
  if (label && btn.dataset.on) label.textContent = on ? btn.dataset.on : btn.dataset.off;
  if (btn.classList.contains("btn") && btn.dataset.on) btn.classList.toggle("btn--ghost", !on);
}

/** Clicking a dot highlights its tag; hovering a tag highlights its dot (and box). */
export function linkSpotsAndTags(root) {
  const spots = () => [...root.querySelectorAll(".detail__media .hotspot")];
  const tags = () => [...root.querySelectorAll(".tags .tag")];
  const boxes = () => [...root.querySelectorAll(".detail__media .box")];
  const activate = (i, scroll) => {
    spots().forEach((s, k) => s.classList.toggle("is-active", k === i));
    tags().forEach((t, k) => t.classList.toggle("is-active", k === i));
    boxes().forEach((b, k) => b.classList.toggle("is-on", k === i));
    const t = tags()[i];
    if (scroll && t) {
      const r = t.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight) t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
  };
  const onClick = (e) => {
    const spot = e.target.closest(".detail__media .hotspot");
    if (spot && root.contains(spot)) activate(Number(spot.dataset.spot), true);
  };
  const onOver = (e) => {
    if (e.pointerType === "touch") return;
    const tag = e.target.closest(".tags .tag");
    if (tag) activate(tags().indexOf(tag), false);
  };
  const onOut = (e) => {
    if (e.pointerType === "touch") return;
    const from = e.target.closest && e.target.closest(".tags");
    const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".tags");
    if (from && !to) activate(-1, false);
  };
  root.addEventListener("click", onClick);
  root.addEventListener("pointerover", onOver);
  root.addEventListener("pointerout", onOut);
  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("pointerover", onOver);
    root.removeEventListener("pointerout", onOut);
  };
}
