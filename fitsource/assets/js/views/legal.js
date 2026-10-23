import { html } from "../ui.js";

function render() {
  return html`
  <div class="wrap">
    <article class="prose">
      <h1 class="display" style="font-size:clamp(2.2rem,4.6vw,3.6rem)">Privacy and disclosure</h1>

      <h2>Your photos</h2>
      <p>A quick scan runs entirely in your browser. The photo is not uploaded anywhere. The scanning model is downloaded once from Hugging Face and cached by your browser.</p>
      <p>A deep scan, when it is switched on, sends the photo to the FitSource server, which passes it to Anthropic's Claude to identify the pieces and search shops. The photo is not stored. To save cost, the results (not the photo) of a scan may be kept for up to 24 hours, keyed by a fingerprint of the image, so the same viral photo is not searched twice.</p>

      <h2>What stays on your device</h2>
      <p>Your closet, restock alerts, likes and recent scans are saved in your browser's local storage. They never leave your device unless you share a receipt yourself. Clearing your browser data removes them.</p>
      <p>Restock alerts ask the FitSource server to read the shop's product page. Only the product link is sent.</p>

      <h2>How FitSource makes money</h2>
      <p>Some links to shops are affiliate links: if you buy something, the shop may pay FitSource a commission. You pay the same price. Commissions never decide which products we show or their order. Sponsored placements, if any, are always labelled.</p>

      <h2>The feed</h2>
      <p>The feed is a preview. Its people and brands are invented and the photos are AI-generated, except the Created By God fit, which is a real Dream Studios photo linking to the real store. Shop buttons on sample pieces search real shops for similar items.</p>

      <h2>Credits</h2>
      <ul>
        <li>Garment recognition: MobileCLIP by Apple, run with Transformers.js.</li>
        <li>Deep scan: Claude by Anthropic, with web search.</li>
        <li>Type: Archivo and Geist Mono, under the SIL Open Font License.</li>
        <li>Icons: Phosphor Icons, MIT licence.</li>
      </ul>
    </article>
  </div>`;
}

export default { render };
