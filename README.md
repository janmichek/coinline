# CoinLine

CoinLine is a simple, effective **inline exchange**: highlight a number on any page and convert it to crypto or fiat, right where you are. No extra tab, no copy-paste into a calculator.

A passion project — something I kept wishing existed, then built.

Works in Chrome and Firefox. Off by default.

## Features

- Click the toolbar icon to turn it **ON** (badge) or off again. The state is saved and restored after a browser restart.
- Select a number on a page — `$1,250`, `€80`, `0.5 BTC`, and similar. A number with no currency sign is treated as USD.
- Recognizes common fiat symbols and names (USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY) and crypto tickers from the live list.
- Searchable dropdown to convert into USD or any of the listed coins.
- Copy the converted amount, or open a TradingView chart.

Prices are **refreshed when you switch the extension ON** by clicking the icon.

## Data

- Crypto: [CoinGecko](https://www.coingecko.com/) — top coins by market cap (USD).
- Fiat: [ExchangeRate-API](https://www.exchangerate-api.com/) — rates vs USD.

**Prices are for informational purposes only.** They may not be accurate and should not be used as a decision price for any trade. Always double-check before you act.

## Get in touch

Want another currency, a new feature, or just to say hi? Open an issue on [github.com/janmichek/coinline](https://github.com/janmichek/coinline).

## Develop

Requires [Node.js](https://nodejs.org/). No `npm install` — the build is a single script.

```bash
npm run build          # dist/chrome and dist/firefox
npm run build:chrome
npm run build:firefox
```

Load the **built** folder, not `src/` or the repo root (`manifest.json` is written into `dist/`):

- **Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome`
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json`

After changing `src/`, rebuild and reload the extension. Content-script changes also need a page refresh.

Store-ready zips:

```bash
npm run export           # both
npm run export:chrome    # dist/coinline-chrome.zip
npm run export:firefox   # dist/coinline-firefox.zip
```

