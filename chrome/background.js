const COINGECKO_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false';
const FX_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

async function fetchPrices() {
  try {
    const [cryptoRes, fxRes] = await Promise.all([fetch(COINGECKO_URL), fetch(FX_URL)]);
    const coins = await cryptoRes.json();
    const fx = await fxRes.json();

    const cryptoList = coins.map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      priceUSD: c.current_price,
    }));

    await chrome.storage.local.set({
      cryptoList,
      fxRates: fx.rates,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error('CoinLine: failed to fetch prices', err);
  }
}

chrome.runtime.onInstalled.addListener(fetchPrices);

chrome.storage.local.get('calcActive').then((r) => {
  if (r.calcActive === undefined) chrome.storage.local.set({ calcActive: false });
});

chrome.action.onClicked.addListener(async () => {
  const { calcActive } = await chrome.storage.local.get('calcActive');
  const next = !calcActive;
  await chrome.storage.local.set({ calcActive: next });
  chrome.action.setBadgeText({ text: next ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#00ff88' });
  chrome.action.setTitle({ title: next ? 'CoinLine: ON — click to disable' : 'CoinLine: OFF — click to enable' });

  if (next) await fetchPrices();
});
