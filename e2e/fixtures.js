const { test: base, chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const EXT_PATH = path.join(__dirname, '..', 'dist', 'chrome');
const FIXTURE_ORIGIN = 'http://e2e.coinline.test';
const FIXTURE_URL = `${FIXTURE_ORIGIN}/`;

const CRYPTO_API = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 60000 },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3000 },
];

const FX_API = { rates: { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150 } };

const CRYPTO_LIST = CRYPTO_API.map((c) => ({
  id: c.id,
  symbol: c.symbol.toUpperCase(),
  name: c.name,
  priceUSD: c.current_price,
}));

const FX_RATES = FX_API.rates;

const test = base.extend({
  context: async ({}, use) => {
    if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
      throw new Error('Missing dist/chrome. Run `npm run build:chrome` first.');
    }

    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      viewport: { width: 1280, height: 800 },
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        '--lang=en-US',
      ],
    });

    await context.route('https://api.coingecko.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CRYPTO_API),
      }),
    );
    await context.route('https://api.exchangerate-api.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FX_API),
      }),
    );

    const html = fs.readFileSync(path.join(__dirname, 'page.html'), 'utf8');
    await context.route(`${FIXTURE_ORIGIN}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: html,
      }),
    );

    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(serviceWorker.url().split('/')[2]);
  },
});

module.exports = {
  test,
  expect,
  FIXTURE_URL,
  CRYPTO_LIST,
  FX_RATES,
};
