const { test, expect } = require('./fixtures');
const {
  activateExtension,
  expectNoPopup,
  openFixture,
  seedStorage,
  selectText,
} = require('./helpers');

test.describe('CoinLine popup', () => {
  test('does not open while the extension is off', async ({ page, serviceWorker }) => {
    await seedStorage(serviceWorker, { calcActive: false });
    await openFixture(page);
    await selectText(page, '#usd-amount');
    await expectNoPopup(page);
  });

  test('shows a popup for a selected fiat amount', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#usd-amount');

    const popup = page.locator('#calc-ext-popup');
    await expect(popup).toBeVisible();
    await expect(page.locator('#calc-ext-header-val')).toHaveText('1,250.00 USD');
    await expect(page.locator('#calc-ext-sel-text')).toHaveText('— Select currency —');
    await expect(page.locator('#calc-ext-dropdown')).toBeVisible();
  });

  test('converts a dollar amount into the chosen coin', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#usd-amount');

    await page.locator('#calc-ext-list [data-id="bitcoin"]').click();
    await expect(page.locator('#calc-ext-sel-text')).toHaveText('Bitcoin (BTC)');
    await expect(page.locator('#calc-ext-conv-text')).toHaveText('≈ 0.0208 BTC');
    await expect(page.locator('#calc-ext-copy')).toBeVisible();
    await expect(page.locator('#calc-ext-chart')).toBeVisible();
  });

  test('converts a crypto selection into USD', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#btc-amount');

    await expect(page.locator('#calc-ext-header-val')).toHaveText('0.5000 BTC');
    await page.locator('#calc-ext-list [data-id="usd"]').click();
    await expect(page.locator('#calc-ext-conv-text')).toHaveText('≈ 30000.00 USD');
  });

  test('converts a euro amount using fx rates', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#eur-amount');

    await expect(page.locator('#calc-ext-header-val')).toHaveText('80.00 EUR');
    await page.locator('#calc-ext-list [data-id="usd"]').click();
    await expect(page.locator('#calc-ext-conv-text')).toHaveText('≈ 86.96 USD');
  });

  test('treats a bare number as USD', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#bare-amount');

    await expect(page.locator('#calc-ext-header-val')).toHaveText('99.50 USD');
    await page.locator('#calc-ext-search').press('Enter');
    await expect(page.locator('#calc-ext-conv-text')).toHaveText('≈ 99.50 USD');
  });

  test('filters the currency list from the search box', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#usd-amount');

    await page.locator('#calc-ext-search').fill('eth');
    await expect(page.locator('#calc-ext-list [data-id="ethereum"]')).toBeVisible();
    await expect(page.locator('#calc-ext-list [data-id="bitcoin"]')).toHaveCount(0);
    await expect(page.locator('#calc-ext-list [data-id="usd"]')).toHaveCount(0);
  });

  test('closes the popup from the × button', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#usd-amount');
    await expect(page.locator('#calc-ext-popup')).toBeVisible();

    await page.locator('#calc-ext-close').click();
    await expect(page.locator('#calc-ext-popup')).toHaveCount(0);
  });

  test('does not open when price data is missing', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker, { rates: false });
    await selectText(page, '#usd-amount');
    await expectNoPopup(page);
  });

  test('does not open for text without a number or over 50 characters', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#words');
    await expectNoPopup(page, 400);
    await selectText(page, '#long-amount');
    await expectNoPopup(page, 400);
  });

  test('hides the popup when the extension is turned off', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#usd-amount');
    await expect(page.locator('#calc-ext-popup')).toBeVisible();

    await seedStorage(serviceWorker, { calcActive: false });
    await expect(page.locator('#calc-ext-popup')).toHaveCount(0);
  });

  test('copies the converted amount', async ({ page, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#usd-amount');
    await page.locator('#calc-ext-list [data-id="ethereum"]').click();

    const copyBtn = page.locator('#calc-ext-copy');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    // Persistent Chromium cannot grant clipboard-read. The click handler
    // shows a checkmark once a converted amount is ready to copy.
    await expect(copyBtn.locator('path')).toHaveAttribute('d', 'M3.5 8.5l3 3 6-7');
  });

  test('opens a TradingView chart for the selected pair', async ({ page, context, serviceWorker }) => {
    await openFixture(page);
    await activateExtension(serviceWorker);
    await selectText(page, '#usd-amount');
    await page.locator('#calc-ext-list [data-id="bitcoin"]').click();

    const chartPagePromise = context.waitForEvent('page');
    await page.locator('#calc-ext-chart').click();
    const chartPage = await chartPagePromise;
    expect(chartPage.url()).toMatch(/tradingview\.com\/chart/);
    expect(decodeURIComponent(chartPage.url())).toContain('BINANCE:BTCUSDT');
    await chartPage.close();
  });
});
