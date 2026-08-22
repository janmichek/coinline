const { expect } = require('@playwright/test');
const { CRYPTO_LIST, FX_RATES } = require('./fixtures');

async function seedStorage(serviceWorker, data) {
  await serviceWorker.evaluate(async (payload) => {
    await chrome.storage.local.set(payload);
  }, data);
}

async function waitForInstallFetch(serviceWorker) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const ready = await serviceWorker.evaluate(async () => {
      const { lastUpdated, cryptoList } = await chrome.storage.local.get([
        'lastUpdated',
        'cryptoList',
      ]);
      return Boolean(lastUpdated || cryptoList);
    });
    if (ready) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function activateExtension(serviceWorker, { rates = true } = {}) {
  await waitForInstallFetch(serviceWorker);
  const payload = { calcActive: true };
  if (rates) {
    payload.cryptoList = CRYPTO_LIST;
    payload.fxRates = FX_RATES;
  } else {
    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.remove(['cryptoList', 'fxRates']);
    });
  }
  await seedStorage(serviceWorker, payload);
}

async function openFixture(page) {
  await page.goto('http://e2e.coinline.test/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#usd-amount')).toBeVisible();
}

async function selectText(page, selector) {
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    el.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: 40,
      clientY: 40,
    }));
  });
}

async function expectNoPopup(page, waitMs = 600) {
  await page.waitForTimeout(waitMs);
  await expect(page.locator('#calc-ext-popup')).toHaveCount(0);
}

module.exports = {
  activateExtension,
  expectNoPopup,
  openFixture,
  seedStorage,
  selectText,
  waitForInstallFetch,
};
