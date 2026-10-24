// Site settings. Edit these, nothing else needs to change.
export const CONFIG = {
  // Where the FitSource API (worker/) is deployed, e.g.
  // "https://fitsource-api.your-name.workers.dev". Leave empty to use the
  // same site's /api when it exists (local preview), otherwise scans run
  // on the visitor's device only.
  apiBase: "",

  // Affiliate programmes. Leave all empty to link shops directly.
  affiliate: {
    // Per-shop deep-link templates, keyed by the shop's domain. {url} is
    // replaced with the encoded product or search link. Checked first. E.g.
    //   "aliexpress.com": "https://ad.admitad.com/g/YOUR_ID/?ulp={url}",
    //   "asos.com": "https://www.awin1.com/cread.php?awinmid=MID&awinaffid=YOUR_ID&ued={url}",
    deeplinks: {},
    // Network-wide wrapping for every other shop (note: Skimlinks only pays
    // on traffic from North America, Europe and APAC, not Israel).
    skimlinksId: "", // e.g. "123456X1234567"  (skimlinks.com)
    sovrnKey: "", // e.g. "a1b2c3..."          (sovrn.com/commerce)
    amazonTag: "", // e.g. "fitsource-20"      (Amazon Associates, added to Amazon links)
  },

  // Shown on the For brands page as the partnership contact. Leave empty to hide the button.
  contactEmail: "",

  // When set, scanning is switched off and this message is shown instead
  // (for previews hosted where the scanner can't be downloaded).
  scanDisabledMessage: "",
};
