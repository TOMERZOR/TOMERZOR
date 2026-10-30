// The stocks Mabat scans all the time, plus every ticker someone adds to their watchlist.
// issuer: how the company's name starts in a 13F information table, to match fund holdings.

export const UNIVERSE = [
  ['SPY', 'SPDR S&P 500 ETF', null, 'etf'],
  ['QQQ', 'Invesco QQQ (Nasdaq 100)', null, 'etf'],
  ['IWM', 'iShares Russell 2000 ETF', null, 'etf'],
  ['AAPL', 'Apple', 'APPLE INC', 'tech'],
  ['MSFT', 'Microsoft', 'MICROSOFT', 'tech'],
  ['NVDA', 'NVIDIA', 'NVIDIA', 'tech'],
  ['AMZN', 'Amazon', 'AMAZON COM', 'consumer'],
  ['GOOGL', 'Alphabet', 'ALPHABET', 'tech'],
  ['META', 'Meta Platforms', 'META PLATFORMS', 'tech'],
  ['TSLA', 'Tesla', 'TESLA', 'consumer'],
  ['AVGO', 'Broadcom', 'BROADCOM', 'tech'],
  ['AMD', 'AMD', 'ADVANCED MICRO', 'tech'],
  ['NFLX', 'Netflix', 'NETFLIX', 'media'],
  ['ORCL', 'Oracle', 'ORACLE', 'tech'],
  ['CRM', 'Salesforce', 'SALESFORCE', 'tech'],
  ['ADBE', 'Adobe', 'ADOBE', 'tech'],
  ['INTC', 'Intel', 'INTEL CORP', 'tech'],
  ['QCOM', 'Qualcomm', 'QUALCOMM', 'tech'],
  ['MU', 'Micron', 'MICRON TECH', 'tech'],
  ['PLTR', 'Palantir', 'PALANTIR', 'tech'],
  ['UBER', 'Uber', 'UBER TECH', 'tech'],
  ['SHOP', 'Shopify', 'SHOPIFY', 'tech'],
  ['COIN', 'Coinbase', 'COINBASE', 'finance'],
  ['JPM', 'JPMorgan Chase', 'JPMORGAN', 'finance'],
  ['BAC', 'Bank of America', 'BANK AMER', 'finance'],
  ['GS', 'Goldman Sachs', 'GOLDMAN SACHS', 'finance'],
  ['V', 'Visa', 'VISA INC', 'finance'],
  ['MA', 'Mastercard', 'MASTERCARD', 'finance'],
  ['AXP', 'American Express', 'AMERICAN EXPRESS', 'finance'],
  ['UNH', 'UnitedHealth', 'UNITEDHEALTH', 'health'],
  ['LLY', 'Eli Lilly', 'LILLY ELI|ELI LILLY', 'health'],
  ['JNJ', 'Johnson & Johnson', 'JOHNSON & JOHNSON', 'health'],
  ['MRK', 'Merck', 'MERCK & CO|MERCK CO', 'health'],
  ['ABBV', 'AbbVie', 'ABBVIE', 'health'],
  ['PFE', 'Pfizer', 'PFIZER', 'health'],
  ['COST', 'Costco', 'COSTCO', 'consumer'],
  ['WMT', 'Walmart', 'WALMART', 'consumer'],
  ['HD', 'Home Depot', 'HOME DEPOT', 'consumer'],
  ['MCD', "McDonald's", 'MCDONALDS', 'consumer'],
  ['NKE', 'Nike', 'NIKE', 'consumer'],
  ['KO', 'Coca-Cola', 'COCA COLA', 'consumer'],
  ['PEP', 'PepsiCo', 'PEPSICO', 'consumer'],
  ['DIS', 'Disney', 'DISNEY WALT|WALT DISNEY', 'media'],
  ['XOM', 'Exxon Mobil', 'EXXON MOBIL', 'energy'],
  ['CVX', 'Chevron', 'CHEVRON', 'energy'],
  ['CAT', 'Caterpillar', 'CATERPILLAR', 'industrial'],
  ['BA', 'Boeing', 'BOEING', 'industrial'],
  ['GE', 'GE Aerospace', 'GENERAL ELECTRIC|GE AEROSPACE', 'industrial'],
].map(([t, name, issuer, sector]) => ({ t, name, issuer, sector }));

export const UNIVERSE_TICKERS = UNIVERSE.map(u => u.t);
export const byTicker = Object.fromEntries(UNIVERSE.map(u => [u.t, u]));

// Funds whose quarterly 13F-HR Mabat reads (trader-copycat). check: a word the filer's SEC name
// must contain, so a wrong CIK is skipped instead of misread.
export const FUNDS = [
  { cik: 1067983, name: "Berkshire Hathaway", he: 'ברקשייר', check: 'BERKSHIRE' },
  { cik: 1336528, name: 'Pershing Square', he: 'פרשינג סקוור (אקמן)', check: 'PERSHING' },
  { cik: 1536411, name: 'Duquesne', he: 'דוקיין (דרוקנמילר)', check: 'DUQUESNE' },
  { cik: 1656456, name: 'Appaloosa', he: 'אפלוסה (טפר)', check: 'APPALOOSA' },
  { cik: 1040273, name: 'Third Point', he: 'ת׳רד פוינט (לוב)', check: 'THIRD POINT' },
  { cik: 1350694, name: 'Bridgewater', he: 'ברידג׳ווטר (דליו)', check: 'BRIDGEWATER' },
];

// Members of Congress whose new trade reports ring an alert (trader-pelosi).
export const WATCHED_MEMBERS = ['Pelosi'];

export function matchIssuer(name) {
  const n = name.toUpperCase().replace(/[.,]/g, '');
  return UNIVERSE.find(u => u.issuer && u.issuer.split('|').some(prefix => n.startsWith(prefix)))?.t || null;
}
