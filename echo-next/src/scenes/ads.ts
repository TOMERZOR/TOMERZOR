/** The prototype's ad: a short countdown sheet, then the reward. A real build swaps in an SDK here. */
import { Text } from "pixi.js";
import { C } from "../theme";
import { body } from "../ui";
import { t } from "../i18n";
import { dialog } from "./dialog";

export function showAd(onDone: () => void, seconds = 3) {
  let n = seconds; const txt = new Text({ text: t("ad_sub", { n }), style: body(28, C.lilac) }); txt.anchor.set(0.5, 0);
  const d = dialog({ eyebrow: t("free_coins"), title: t("ad_title"), content: txt, buttons: [{ label: t("close"), kind: "ghost", onTap: () => { clearInterval(iv); } }], dismiss: false });
  const iv = setInterval(() => { n--; txt.text = t("ad_sub", { n }); if (n <= 0) { clearInterval(iv); d.close(); onDone(); } }, 1000);
}
