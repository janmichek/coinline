import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const extPath = join(root, 'dist', 'chrome');
const outDir = join(root, 'recordings');
const demoOrigin = 'http://demo.coinline.test';
const demoHtml = readFileSync(join(root, 'scripts', 'demo-page.html'), 'utf8');

const VIEWPORT = { width: 1280, height: 720 };

const CRYPTO_API = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 67420 },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3280 },
  { id: 'solana', symbol: 'sol', name: 'Solana', current_price: 148 },
  { id: 'ripple', symbol: 'xrp', name: 'XRP', current_price: 0.58 },
  { id: 'cardano', symbol: 'ada', name: 'Cardano', current_price: 0.42 },
  { id: 'dogecoin', symbol: 'doge', name: 'Dogecoin', current_price: 0.12 },
  { id: 'avalanche-2', symbol: 'avax', name: 'Avalanche', current_price: 28 },
  { id: 'polkadot', symbol: 'dot', name: 'Polkadot', current_price: 6.4 },
];

const FX_API = { rates: { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150 } };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

async function syncPointer(page, x, y) {
  await page.evaluate(({ px, py }) => {
    window.__demoPointerMove?.(px, py);
  }, { px: x, py: y });
}

async function waitForWorker(context) {
  const existing = context.serviceWorkers()[0];
  return existing || context.waitForEvent('serviceworker');
}

async function activateExtension(worker) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const ready = await worker.evaluate(async () => {
      const { lastUpdated, cryptoList } = await chrome.storage.local.get([
        'lastUpdated',
        'cryptoList',
      ]);
      return Boolean(lastUpdated || cryptoList);
    });
    if (ready) break;
    await sleep(50);
  }

  await worker.evaluate(async ({ coins, fx }) => {
    await chrome.storage.local.set({
      calcActive: true,
      cryptoList: coins.map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        priceUSD: c.current_price,
      })),
      fxRates: fx.rates,
    });
  }, { coins: CRYPTO_API, fx: FX_API });
}

function createMouse(page) {
  let x = VIEWPORT.width * 0.75;
  let y = VIEWPORT.height - 36;

  async function move(toX, toY, { duration = 260, ease = easeInOutCubic } = {}) {
    const fromX = x;
    const fromY = y;
    const frames = Math.max(12, Math.round(duration / 16));
    for (let i = 1; i <= frames; i += 1) {
      const t = ease(i / frames);
      x = fromX + (toX - fromX) * t;
      y = fromY + (toY - fromY) * t;
      await page.mouse.move(x, y);
      await syncPointer(page, x, y);
      await sleep(duration / frames);
    }
  }

  async function clickAt(toX, toY, { approach = 240, hold = 45 } = {}) {
    await move(toX, toY, { duration: approach });
    await sleep(40);
    await page.evaluate(() => document.getElementById('demo-pointer')?.classList.add('clicking'));
    await page.mouse.down();
    await sleep(hold);
    await page.mouse.up();
    await page.evaluate(() => document.getElementById('demo-pointer')?.classList.remove('clicking'));
    await sleep(60);
  }

  async function drag(fromX, fromY, toX, toY) {
    await move(fromX, fromY, { duration: 220 });
    await sleep(50);
    await page.evaluate(() => document.getElementById('demo-pointer')?.classList.add('clicking'));
    await page.mouse.down();
    await sleep(40);
    await move(toX, toY, { duration: 320, ease: easeOutQuad });
    await sleep(30);
    await page.mouse.up();
    await page.evaluate(() => document.getElementById('demo-pointer')?.classList.remove('clicking'));
    await sleep(80);
  }

  return { move, clickAt, drag };
}

async function clickLocator(page, mouse, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing click target');
  await mouse.clickAt(box.x + box.width / 2, box.y + box.height / 2);
}

async function typeQuick(page, mouse, locator, text) {
  await clickLocator(page, mouse, locator);
  await locator.pressSequentially(text, { delay: 55 });
}

async function dragSelect(page, mouse, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing element: ${selector}`);
  const y = box.y + box.height / 2;
  const inset = 3;
  const startX = box.x + inset;
  const endX = box.x + box.width - inset;
  await mouse.move(startX, box.y + box.height + 18, { duration: 120 });
  await mouse.move(startX, y + 6, { duration: 90 });
  await mouse.drag(startX, y, endX, y);
}

async function recordClip({ name, colorScheme, play }) {
  const userDataDir = mkdtempSync(join(tmpdir(), `coinline-demo-${name}-`));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme,
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    recordVideo: {
      dir: join(outDir, 'raw'),
      size: VIEWPORT,
    },
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
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
  await context.route(`${demoOrigin}/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: demoHtml,
    }),
  );

  const page = context.pages()[0] || await context.newPage();
  const mouse = createMouse(page);
  const worker = await waitForWorker(context);
  await activateExtension(worker);

  await page.goto(demoOrigin, { waitUntil: 'domcontentloaded' });
  await page.locator('#demo-pointer').waitFor();
  await syncPointer(page, VIEWPORT.width * 0.75, VIEWPORT.height - 36);
  await sleep(250);
  await play(page, mouse);
  await sleep(600);

  const video = page.video();
  if (!video) throw new Error(`Video recording did not start for ${name}`);
  const dest = join(outDir, `${name}.webm`);
  await page.close();
  await video.saveAs(dest);
  await context.close();
  rmSync(userDataDir, { recursive: true, force: true });
  return dest;
}

async function usdToBtc(page, mouse) {
  await dragSelect(page, mouse, '#usd-amount');
  await page.locator('#calc-ext-popup').waitFor({ state: 'visible' });
  await sleep(280);
  await typeQuick(page, mouse, page.locator('#calc-ext-search'), 'btc');
  await sleep(180);
  await clickLocator(page, mouse, page.locator('#calc-ext-list [data-id="bitcoin"]'));
  await page.locator('#calc-ext-conv-text').waitFor();
  await sleep(450);
  await clickLocator(page, mouse, page.locator('#calc-ext-copy'));
  await sleep(350);
}

async function eurToEth(page, mouse) {
  await dragSelect(page, mouse, '#eur-amount');
  await page.locator('#calc-ext-popup').waitFor({ state: 'visible' });
  await sleep(260);
  await typeQuick(page, mouse, page.locator('#calc-ext-search'), 'eth');
  await sleep(160);
  await clickLocator(page, mouse, page.locator('#calc-ext-list [data-id="ethereum"]'));
  await page.locator('#calc-ext-conv-text').waitFor();
  await sleep(500);
}

async function btcToUsd(page, mouse) {
  await dragSelect(page, mouse, '#btc-amount');
  await page.locator('#calc-ext-popup').waitFor({ state: 'visible' });
  await sleep(260);
  await typeQuick(page, mouse, page.locator('#calc-ext-search'), 'usd');
  await sleep(160);
  await clickLocator(page, mouse, page.locator('#calc-ext-list [data-id="usd"]'));
  await page.locator('#calc-ext-conv-text').waitFor();
  await sleep(400);
  await clickLocator(page, mouse, page.locator('#calc-ext-copy'));
  await sleep(350);
}

async function main() {
  if (!existsSync(join(extPath, 'manifest.json'))) {
    throw new Error('Missing dist/chrome. Run `npm run build:chrome` first.');
  }

  mkdirSync(outDir, { recursive: true });

  const clips = [
    { name: 'coinline-usd-to-btc', colorScheme: 'light', play: usdToBtc },
    { name: 'coinline-dark-eur-to-eth', colorScheme: 'dark', play: eurToEth },
    { name: 'coinline-btc-to-usd', colorScheme: 'light', play: btcToUsd },
  ];

  for (const clip of clips) {
    process.stdout.write(`Recording ${clip.name}… `);
    const dest = await recordClip(clip);
    const mp4 = dest.replace(/\.webm$/, '.mp4');
    try {
      execFileSync('ffmpeg', [
        '-y', '-i', dest,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-crf', '18', '-preset', 'slow',
        '-movflags', '+faststart',
        mp4,
      ], { stdio: 'ignore' });
      console.log(mp4);
    } catch {
      console.log(dest);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
