// Platform layer: haptics, ads, in-app purchases and analytics.
// On the web everything is mocked so the game is fully playable; inside the
// Capacitor app the same calls go to AdMob, RevenueCat and native haptics.
import * as Save from './save.js';

const Cap = () => window.Capacitor;
const isNative = () => !!(Cap() && Cap().isNativePlatform && Cap().isNativePlatform());
const plugin = (name) => (isNative() && Cap().registerPlugin ? Cap().registerPlugin(name) : null);

// Fill these in before a store build (see app/README.md).
export const CONFIG = {
  admob: {
    ios: { rewarded: 'ca-app-pub-3940256099942544/1712485313', interstitial: 'ca-app-pub-3940256099942544/4411468910' },
    android: { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' },
    testing: true,
  },
  revenuecat: { ios: 'appl_REPLACE_ME', android: 'goog_REPLACE_ME' },
  interstitialFromLevel: 12,
  interstitialGapMs: 90 * 1000,
};

// ---------------- haptics ----------------
let Haptics = null, lastBuzz = 0;
export const haptic = {
  light() { buzz('light', 8); },
  medium() { buzz('medium', 18); },
  heavy() { buzz('heavy', 40); },
  success() { buzz('success', [12, 40, 18]); },
  tick() { const n = performance.now(); if (n - lastBuzz < 45) return; buzz('tick', 4); },
};
function buzz(kind, pattern) {
  if (!Save.get().settings.haptics) return;
  lastBuzz = performance.now();
  try {
    if (isNative()) {
      Haptics = Haptics || plugin('Haptics');
      if (kind === 'success') Haptics.notification({ type: 'SUCCESS' });
      else if (kind === 'tick') Haptics.selectionChanged ? Haptics.selectionChanged() : Haptics.impact({ style: 'LIGHT' });
      else Haptics.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
    } else if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) { /* haptics are a nice-to-have */ }
}

// ---------------- analytics ----------------
const listeners = [];
export function track(name, params = {}) {
  const e = { name, params, t: Date.now() };
  try {
    if (window.gtag) window.gtag('event', name, params);
    if (window.ppAnalytics) window.ppAnalytics(e);
  } catch (err) { /* never break the game on analytics */ }
  for (const l of listeners) l(e);
}
export function onTrack(fn) { listeners.push(fn); }

// ---------------- ads ----------------
let AdMob = null, adsReady = false, rewardedLoaded = false, interLoaded = false, privacyRequired = false;
const platformKey = () => (Cap() && Cap().getPlatform && Cap().getPlatform() === 'android' ? 'android' : 'ios');

export const Ads = {
  async init() {
    if (!isNative()) { adsReady = true; return; }
    try {
      AdMob = plugin('AdMob');
      await AdMob.initialize({ initializeForTesting: CONFIG.admob.testing });
      try {
        const st = await AdMob.trackingAuthorizationStatus();
        if (st && st.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      } catch (e) { /* android */ }
      try {
        const info = await AdMob.requestConsentInfo();
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
        const after = await AdMob.requestConsentInfo();
        privacyRequired = !!(after && after.privacyOptionsRequirementStatus === 'REQUIRED');
      } catch (e) { /* consent not required here */ }
      adsReady = true;
      this.preload();
    } catch (e) { adsReady = false; }
  },
  async preload() {
    if (!isNative() || !AdMob) return;
    const ids = CONFIG.admob[platformKey()];
    try { if (!rewardedLoaded) { await AdMob.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: CONFIG.admob.testing }); rewardedLoaded = true; } } catch (e) { rewardedLoaded = false; }
    try { if (!interLoaded && !Save.get().noAds) { await AdMob.prepareInterstitial({ adId: ids.interstitial, isTesting: CONFIG.admob.testing }); interLoaded = true; } } catch (e) { interLoaded = false; }
  },
  // GDPR: lets players change their ad consent at any time (Settings).
  privacyOptionsAvailable() { return isNative() && !!AdMob && privacyRequired; },
  async privacyOptions() { if (AdMob) { try { await AdMob.showPrivacyOptionsForm(); } catch (e) { /* not required */ } } },
  rewardedReady() { return isNative() ? rewardedLoaded : adsReady; },
  // Resolves true only if the player earned the reward.
  async rewarded(placement) {
    track('ad_rewarded_request', { placement });
    let ok = false;
    if (isNative() && AdMob) {
      try { const r = await AdMob.showRewardVideoAd(); ok = !!r; } catch (e) { ok = false; }
      rewardedLoaded = false; this.preload();
    } else {
      ok = await mockAd('rewarded');
    }
    if (ok) track('ad_rewarded', { placement });
    return ok;
  },
  canInterstitial(level) {
    const s = Save.get();
    if (s.noAds || level < CONFIG.interstitialFromLevel) return false;
    return Date.now() - (s.ads.lastInterstitial || 0) >= CONFIG.interstitialGapMs;
  },
  async interstitial(placement, level) {
    if (!this.canInterstitial(level)) return false;
    Save.get().ads.lastInterstitial = Date.now(); Save.save();
    track('ad_interstitial', { placement, level });
    if (isNative() && AdMob) {
      try { await AdMob.showInterstitial(); } catch (e) { /* not loaded: skip */ }
      interLoaded = false; this.preload();
    } else await mockAd('interstitial');
    return true;
  },
};

// The web build shows a clearly-labelled stand-in so every flow can be tested.
function mockAd(kind) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'mock-ad';
    const secs = kind === 'rewarded' ? 5 : 3;
    el.innerHTML = `<div class="mock-ad__card"><div class="mock-ad__tag">AD · ${kind === 'rewarded' ? 'Rewarded video' : 'Interstitial'}</div>
      <div class="mock-ad__art">🎨</div><p>Your ad network shows a video here.<br>(Test mode — AdMob plugs in on iOS/Android.)</p>
      <button class="btn btn--ghost mock-ad__close" disabled>${secs}</button></div>`;
    document.body.appendChild(el);
    const btn = el.querySelector('button');
    let left = secs;
    const iv = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(iv); btn.disabled = false; btn.textContent = kind === 'rewarded' ? 'Claim reward ✓' : 'Close ✕'; }
      else btn.textContent = String(left);
    }, 1000);
    btn.addEventListener('click', () => { el.remove(); resolve(true); });
  });
}

// ---------------- in-app purchases ----------------
export const PRODUCTS = [
  { id: 'pp_starter', kind: 'starter', price: '$1.99', coins: 1000, boosters: 2, unlimitedMin: 60, title: 'Starter Pack', once: true },
  { id: 'pp_noads', kind: 'noads', price: '$6.99', title: 'No Ads' },
  { id: 'pp_noads_bundle', kind: 'noads', price: '$9.99', coins: 1500, boosters: 3, title: 'No Ads Bundle', best: true },
  { id: 'pp_coins_1', kind: 'coins', price: '$1.99', coins: 1000, title: 'Handful of Coins' },
  { id: 'pp_coins_2', kind: 'coins', price: '$4.99', coins: 3000, title: 'Pouch of Coins', tag: '+20%' },
  { id: 'pp_coins_3', kind: 'coins', price: '$9.99', coins: 7500, title: 'Chest of Coins', tag: 'Popular' },
  { id: 'pp_coins_4', kind: 'coins', price: '$19.99', coins: 20000, title: 'Treasure of Coins', tag: '+60%' },
  { id: 'pp_coins_5', kind: 'coins', price: '$49.99', coins: 60000, title: 'Vault of Coins', tag: 'Best value' },
];

let Purchases = null, rcOfferings = null;
export const IAP = {
  async init() {
    if (!isNative()) return;
    try {
      Purchases = plugin('Purchases');
      await Purchases.configure({ apiKey: CONFIG.revenuecat[platformKey()] });
      const off = await Purchases.getOfferings();
      rcOfferings = off && off.current;
      await this.refresh();
    } catch (e) { Purchases = null; }
  },
  async refresh() {
    if (!Purchases) return;
    try {
      const { customerInfo } = await Purchases.getCustomerInfo();
      if (customerInfo && customerInfo.entitlements && customerInfo.entitlements.active && customerInfo.entitlements.active.no_ads) { Save.get().noAds = true; Save.save(); }
    } catch (e) { /* offline */ }
  },
  // Live price from the store when available, else the default label.
  price(id) {
    const pk = rcOfferings && rcOfferings.availablePackages && rcOfferings.availablePackages.find((p) => p.product && p.product.identifier === id);
    return pk ? pk.product.priceString : (PRODUCTS.find((p) => p.id === id) || {}).price;
  },
  async buy(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return false;
    track('iap_request', { id });
    let ok = false;
    if (Purchases) {
      try {
        const pk = rcOfferings && rcOfferings.availablePackages.find((x) => x.product.identifier === id);
        if (pk) { await Purchases.purchasePackage({ aPackage: pk }); ok = true; }
        else { const prods = await Purchases.getProducts({ productIdentifiers: [id] }); if (prods.products[0]) { await Purchases.purchaseStoreProduct({ product: prods.products[0] }); ok = true; } }
      } catch (e) { ok = false; }
    } else {
      ok = await mockPurchase(p);
    }
    if (ok) { grant(p); track('iap_purchase', { id, price: p.price }); }
    return ok;
  },
  async restore() {
    if (Purchases) { try { await Purchases.restorePurchases(); await this.refresh(); return true; } catch (e) { return false; } }
    return Save.get().noAds;
  },
};

function grant(p) {
  const s = Save.get();
  if (p.coins) Save.addCoins(p.coins);
  if (p.boosters) for (const k of Object.keys(s.boosters)) s.boosters[k] += p.boosters;
  if (p.kind === 'noads') s.noAds = true;
  if (p.unlimitedMin) s.unlimitedUntil = Math.max(Date.now(), s.unlimitedUntil) + p.unlimitedMin * 60000;
  if (p.kind === 'starter') s.starterBought = true;
  s.purchases[p.id] = (s.purchases[p.id] || 0) + 1;
  Save.save();
}

function mockPurchase(p) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'mock-ad';
    el.innerHTML = `<div class="mock-ad__card"><div class="mock-ad__tag">TEST STORE</div><h3>${p.title}</h3><p class="mock-ad__price">${p.price}</p>
      <p>Test purchase — the App Store / Google Play sheet appears here in the app.</p>
      <div class="row"><button class="btn btn--ghost" data-x="0">Cancel</button><button class="btn btn--green" data-x="1">Buy</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (!b) return; el.remove(); resolve(b.dataset.x === '1'); });
  });
}

export async function initPlatform() {
  await Promise.all([Ads.init(), IAP.init()]);
  if (isNative()) {
    try {
      const App = plugin('App');
      App.addListener('appStateChange', ({ isActive }) => window.dispatchEvent(new CustomEvent(isActive ? 'pp:resume' : 'pp:pause')));
      App.addListener('backButton', () => window.dispatchEvent(new CustomEvent('pp:back')));
    } catch (e) { /* optional */ }
    try { const SB = plugin('StatusBar'); SB.setOverlaysWebView({ overlay: true }); SB.setStyle({ style: 'LIGHT' }); } catch (e) { /* optional */ }
    try { const SS = plugin('SplashScreen'); setTimeout(() => SS.hide(), 200); } catch (e) { /* optional */ }
  }
}

// Native store rating sheet (Apple/Google decide whether it actually shows).
export async function requestReview() {
  if (!isNative()) return false;
  try { await plugin('InAppReview').requestReview(); return true; } catch (e) { return false; }
}

export { isNative };
