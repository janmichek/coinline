const ext = globalThis.browser ?? globalThis.chrome;

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

    await ext.storage.local.set({
      cryptoList,
      fxRates: fx.rates,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error('CoinLine: failed to fetch prices', err);
  }
}

function applyActionState(active) {
  ext.action.setBadgeText({ text: active ? 'ON' : '' });
  ext.action.setBadgeBackgroundColor({ color: '#00ff88' });
  ext.action.setTitle({
    title: active ? 'CoinLine: ON — click to disable' : 'CoinLine: OFF — click to enable',
  });
}

async function restoreActionState() {
  const { calcActive } = await ext.storage.local.get('calcActive');
  if (calcActive === undefined) {
    await ext.storage.local.set({ calcActive: false });
    applyActionState(false);
    return;
  }
  applyActionState(!!calcActive);
}

ext.runtime.onInstalled.addListener(fetchPrices);
ext.runtime.onStartup.addListener(restoreActionState);
restoreActionState();

ext.action.onClicked.addListener(async () => {
  const { calcActive } = await ext.storage.local.get('calcActive');
  const next = !calcActive;
  await ext.storage.local.set({ calcActive: next });
  applyActionState(next);

  if (next) await fetchPrices();
});
