// Site settings. Edit these, nothing else needs to change.
export const CONFIG = {
  // Where the FitSource API (worker/) is deployed, e.g.
  // "https://fitsource-api.your-name.workers.dev". Leave empty to use the
  // same site's /api when it exists (local preview), otherwise scans run
  // on the visitor's device only.
  apiBase: "",

  // Affiliate programmes. Outbound shop links are wrapped with the first one
  // that has an id. Leave all empty to link shops directly.
  affiliate: {
    skimlinksId: "", // e.g. "123456X1234567"  (skimlinks.com)
    sovrnKey: "", // e.g. "a1b2c3..."          (sovrn.com/commerce)
    amazonTag: "", // e.g. "fitsource-20"      (Amazon Associates, added to Amazon links)
  },

  // Shown on the For brands page as the partnership contact. Leave empty to hide the button.
  contactEmail: "",
};
