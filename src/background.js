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

async function injectToTab(tabId) {
  try {
    await ext.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (e) {
    // ignore chrome://, edge://, extension pages
  }
}

ext.runtime.onInstalled.addListener(async (details) => {
  await fetchPrices();
  if (details.reason === 'install') {
    await ext.storage.local.set({ calcActive: true });
    applyActionState(true);
  }
});
ext.runtime.onStartup.addListener(async () => {
  await restoreActionState();
  await fetchPrices();
});
restoreActionState();

ext.action.onClicked.addListener(async (tab) => {
  const { calcActive } = await ext.storage.local.get('calcActive');
  const next = !calcActive;
  await ext.storage.local.set({ calcActive: next });
  applyActionState(next);

  if (next) {
    await fetchPrices();
    if (tab?.id) await injectToTab(tab.id);
  }
});

// When user switches tabs while ON, inject into that tab (activeTab grants temp access on click, so this succeeds only after recent click — otherwise silently fails, which is expected for least-privilege)
ext.tabs?.onActivated?.addListener(async ({ tabId }) => {
  const { calcActive } = await ext.storage.local.get('calcActive');
  if (calcActive) await injectToTab(tabId);
});
