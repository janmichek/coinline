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

    await browser.storage.local.set({
      cryptoList,
      fxRates: fx.rates,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error('CoinFlick: failed to fetch prices', err);
  }
}

browser.runtime.onInstalled.addListener(fetchPrices);

browser.storage.local.get('calcActive').then((r) => {
  if (r.calcActive === undefined) browser.storage.local.set({ calcActive: false });
});

browser.browserAction.onClicked.addListener(async () => {
  const { calcActive } = await browser.storage.local.get('calcActive');
  const next = !calcActive;
  await browser.storage.local.set({ calcActive: next });
  browser.browserAction.setBadgeText({ text: next ? 'ON' : '' });
  browser.browserAction.setBadgeBackgroundColor({ color: '#00ff88' });
  browser.browserAction.setTitle({ title: next ? 'CoinFlick: ON — click to disable' : 'CoinFlick: OFF — click to enable' });

  if (next) await fetchPrices();

  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    browser.tabs.sendMessage(tab.id, { type: 'toggle', isActive: next }).catch(() => {});
  }
});
