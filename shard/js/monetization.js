// Ads and purchases behind one interface.
// In the app: AdMob (@capacitor-community/admob) and RevenueCat (@revenuecat/purchases-capacitor).
// On the web: a short simulated ad so every flow can be tested end to end.
import { save } from './save.js';
import { track } from './analytics.js';

export const CONFIG = {
  // Replace with your real IDs before release (these are Google's public test units).
  admob: {
    ios: { rewarded: 'ca-app-pub-3940256099942544/1712485313', interstitial: 'ca-app-pub-3940256099942544/4411468910' },
    android: { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' },
  },
  revenuecat: { ios: 'appl_REPLACE_ME', android: 'goog_REPLACE_ME' },
  interstitial: { fromLevel: 12, everyClears: 3, minGapMs: 150000 },
};

export const PRODUCTS = [
  { id: 'shard_noads', kind: 'noads', title: 'Remove Ads', desc: 'No more interstitials. Ever.', price: '$3.99' },
  { id: 'shard_starter', kind: 'starter', title: 'Starter Pack', desc: 'No ads + 1,500 coins + Aurora ball', price: '$4.99', best: true },
  { id: 'shard_prism', kind: 'skin', skin: 'prism', title: 'Prism Ball', desc: 'Splits light into every color', price: '$1.99' },
  { id: 'shard_coins_s', kind: 'coins', coins: 600, title: 'Pouch', desc: '600 coins', price: '$0.99' },
  { id: 'shard_coins_m', kind: 'coins', coins: 2000, title: 'Chest', desc: '2,000 coins', price: '$2.99', tag: '+11%' },
  { id: 'shard_coins_l', kind: 'coins', coins: 6000, title: 'Vault', desc: '6,000 coins', price: '$7.99', tag: '+25%' },
];

const cap = () => window.Capacitor;
const native = () => !!cap()?.isNativePlatform?.();
const platform = () => cap()?.getPlatform?.() || 'web';
const AdMob = () => cap()?.Plugins?.AdMob;
const Purchases = () => cap()?.Plugins?.Purchases;

let ready = false, ui = null, prices = {}, storeProducts = {};
// Web build: rewards are granted straight away and purchases point to the app.
// Add ?test to the URL to walk through simulated ads and purchases instead.
const webTest = (() => { try { return new URLSearchParams(location.search).has('test'); } catch (e) { return false; } })();

export async function initMonetization(uiHooks) {
  ui = uiHooks;
  if (!native()) { ready = true; return; }
  try {
    const ad = AdMob();
    if (ad) {
      await ad.initialize({ initializeForTesting: false });
      try {
        const info = await ad.requestConsentInfo();
        if (info?.isConsentFormAvailable && info.status === 'REQUIRED') await ad.showConsentForm();
      } catch (e) {}
      if (platform() === 'ios') { try { await ad.requestTrackingAuthorization(); } catch (e) {} }
      preload();
    }
    const p = Purchases();
    if (p) {
      await p.configure({ apiKey: platform() === 'ios' ? CONFIG.revenuecat.ios : CONFIG.revenuecat.android });
      try {
        const { products } = await p.getProducts({ productIdentifiers: PRODUCTS.map((x) => x.id), type: 'NON_SUBSCRIPTION' });
        for (const pr of products || []) { storeProducts[pr.identifier] = pr; prices[pr.identifier] = pr.priceString; }
      } catch (e) {}
      await syncEntitlements();
      try { await p.addCustomerInfoUpdateListener((info) => applyCustomerInfo(info?.customerInfo || info)); } catch (e) {}
    }
  } catch (e) { console.warn('monetization init', e); }
  ready = true;
}

export const priceOf = (p) => prices[p.id] || p.price;

function unit(kind) { return CONFIG.admob[platform() === 'ios' ? 'ios' : 'android'][kind]; }
async function preload() {
  const ad = AdMob(); if (!ad) return;
  try { await ad.prepareRewardVideoAd({ adId: unit('rewarded') }); } catch (e) {}
  if (!save.d.noAds) try { await ad.prepareInterstitial({ adId: unit('interstitial') }); } catch (e) {}
}

// Rewarded: resolves true only when the reward was earned.
export async function showRewarded(placement) {
  track('ad_rewarded_request', { placement });
  if (!native()) {
    const ok = webTest ? await ui.fakeAd('rewarded') : true;
    if (ok) track('ad_rewarded_earned', { placement });
    return ok;
  }
  const ad = AdMob();
  if (!ad) return false;
  // settle on whichever comes first: reward then close, close without reward, or a failure to show
  let earned = false, done;
  const finished = new Promise((r) => { done = r; });
  const handles = [];
  const listen = async (name, fn) => { try { handles.push(await ad.addListener(name, fn)); } catch (e) {} };
  await listen('onRewardedVideoAdReward', () => { earned = true; });
  await listen('onRewardedVideoAdDismissed', () => done());
  await listen('onRewardedVideoAdFailedToShow', () => done('failed'));
  const show = async () => {
    try { const res = await ad.showRewardVideoAd(); if (res && res.amount > 0) earned = true; }
    catch (e) {
      // not loaded yet: load once and try again
      try { await ad.prepareRewardVideoAd({ adId: unit('rewarded') }); const res = await ad.showRewardVideoAd(); if (res && res.amount > 0) earned = true; }
      catch (e2) { done('failed'); }
    }
  };
  show();
  const outcome = await Promise.race([finished, new Promise((r) => setTimeout(() => r('timeout'), 120000))]);
  for (const h of handles) { try { h?.remove?.(); } catch (e) {} }
  preload();
  if (outcome === 'failed' && !earned) ui.toast('No video available right now. Try again in a moment.');
  if (earned) track('ad_rewarded_earned', { placement });
  return earned;
}

// Interstitial pacing: never before level 12, at most every 3 clears and 150 s apart.
export async function maybeInterstitial(levelIndex) {
  const a = save.d.ads;
  a.clearsSince++;
  save.touch();
  if (save.d.noAds) return;
  const c = CONFIG.interstitial;
  if (levelIndex + 1 < c.fromLevel) return;
  if (a.clearsSince < c.everyClears) return;
  if (Date.now() - a.lastAt < c.minGapMs) return;
  a.clearsSince = 0; a.lastAt = Date.now(); save.touch();
  track('ad_interstitial', { level: levelIndex + 1 });
  if (!native()) { if (webTest) await ui.fakeAd('interstitial'); return; }
  try { await AdMob()?.showInterstitial(); } catch (e) {}
  preload();
}

export async function purchase(product) {
  track('iap_start', { id: product.id });
  let ok = false;
  if (!native()) {
    if (!webTest) { ui.toast('Purchases are available in the SHARD app for iPhone and Android'); return false; }
    ok = await ui.fakePurchase(product);
  }
  else {
    try {
      const p = Purchases();
      let sp = storeProducts[product.id];
      if (!sp) {
        const { products } = await p.getProducts({ productIdentifiers: [product.id], type: 'NON_SUBSCRIPTION' });
        sp = products?.[0];
      }
      if (!sp) throw new Error('product not found');
      const result = await p.purchaseStoreProduct({ product: sp });
      const txn = result?.transaction?.transactionIdentifier;
      if (txn) { save.d.txns = save.d.txns || []; save.d.txns.push(txn); }
      ok = true;
    } catch (e) {
      const code = String(e?.code ?? '');
      if (code === '20' || /pending/i.test(e?.message || '')) {
        // waiting for approval: it arrives through the customer-info listener when it completes
        save.d.pending = save.d.pending || {};
        save.d.pending[product.id] = Date.now();
        save.flush();
        ui.toast('Your purchase is waiting for approval. It will arrive automatically.');
      } else if (!e?.userCancelled && !code.toUpperCase().includes('CANCEL') && !/cancel/i.test(e?.message || '')) {
        ui.toast('Purchase did not go through. You were not charged.');
      }
      ok = false;
    }
  }
  if (ok) { grant(product); track('iap_success', { id: product.id }); }
  return ok;
}

export function grant(product) {
  const d = save.d;
  if (product.kind === 'noads') d.noAds = true;
  if (product.kind === 'starter') { d.noAds = true; d.coins += 1500; if (!d.owned.includes('aurora')) d.owned.push('aurora'); d.skin = 'aurora'; }
  if (product.kind === 'skin' && !d.owned.includes(product.skin)) { d.owned.push(product.skin); d.skin = product.skin; }
  if (product.kind === 'coins') d.coins += product.coins;
  save.flush();
}

// Apply what the store says we own. Also completes purchases that were pending approval
// (Ask to Buy, cash payments): only products we marked pending on this device, only transactions
// made after that moment, and each transaction once, so a reinstall never re-grants coins.
function applyCustomerInfo(info) {
  if (!info) return;
  const d = save.d;
  const ent = info.entitlements?.active || {};
  if (ent.no_ads) d.noAds = true;
  if (ent.prism && !d.owned.includes('prism')) d.owned.push('prism');
  if (ent.aurora && !d.owned.includes('aurora')) d.owned.push('aurora');
  d.pending = d.pending || {};
  d.txns = d.txns || [];
  for (const [id, since] of Object.entries(d.pending)) {
    const product = PRODUCTS.find((x) => x.id === id);
    const t = (info.nonSubscriptionTransactions || []).find((x) => x.productIdentifier === id && !d.txns.includes(x.transactionIdentifier) && Date.parse(x.purchaseDate) >= since - 60000);
    if (product && t) {
      d.txns.push(t.transactionIdentifier);
      delete d.pending[id];
      grant(product);
      ui?.toast?.(`${product.title} has arrived. Thank you!`);
    }
  }
  save.flush();
}

async function syncEntitlements() {
  const p = Purchases(); if (!p) return;
  try {
    const { customerInfo } = await p.getCustomerInfo();
    applyCustomerInfo(customerInfo);
  } catch (e) {}
}

export async function restore() {
  if (!native()) { ui.toast(webTest ? 'Purchases restored.' : 'Purchases are available in the SHARD app for iPhone and Android'); return; }
  try { await Purchases()?.restorePurchases(); await syncEntitlements(); ui.toast('Purchases restored.'); }
  catch (e) { ui.toast('Could not restore purchases.'); }
}

export const isNative = native;
