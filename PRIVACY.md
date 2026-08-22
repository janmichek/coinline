# Privacy Policy

**CoinLine** is a browser extension that converts a number you highlight on a page into crypto or fiat.

This policy describes what data CoinLine handles, how it is used, and who (if anyone) it is disclosed to. It applies to the Chrome and Firefox versions of the extension.

**Last updated:** 22 August 2026

## Summary

CoinLine does **not** collect personal information, does **not** create accounts, and does **not** use analytics, advertising, or tracking. Selected text stays on your device. The only network requests are for public market and exchange rates.

## Data CoinLine does not collect

CoinLine does not collect, store, or transmit:

- your name, email, or other identity
- browsing history, URLs, or page content (beyond the short selected text, processed locally)
- the numbers or currencies you convert
- cookies for tracking
- analytics or usage telemetry

There is no login and no server operated by CoinLine that receives your data.

## Data stored on your device

CoinLine uses the browser’s **local extension storage** (`storage` permission) for:

| Data | Purpose |
| --- | --- |
| On/off state | Remember whether the converter is enabled after a restart |
| Cached coin list and USD prices | Convert crypto without fetching on every highlight |
| Cached fiat rates vs USD | Convert common fiat currencies |
| Last-updated timestamp | Know when prices were last fetched |

This data stays on your device. It is not synced to a CoinLine account (there isn’t one) and is not uploaded by the extension.

You can remove it by disabling or uninstalling CoinLine, or by clearing the extension’s storage in your browser.

## How selected text is used

When CoinLine is **on**, it reads the current text selection on the page so it can parse a number and optional currency. That work happens **in the page, on your device**. The selected text is not sent to CoinLine, CoinGecko, ExchangeRate-API, or any other service.

If CoinLine is **off**, it does not convert selections.

Copying a result uses the clipboard on your device only.

## Network requests (disclosure to third parties)

When you install CoinLine, and again when you turn it **on**, it fetches public price data from:

- **[CoinGecko](https://www.coingecko.com/)** — top coins by market cap in USD  
  API: `https://api.coingecko.com/`
- **[ExchangeRate-API](https://www.exchangerate-api.com/)** — fiat rates vs USD  
  API: `https://api.exchangerate-api.com/`

Those requests include only what a normal HTTPS request includes (for example IP address and browser user-agent). CoinLine does **not** send selected text, page URLs, or conversion history with them.

Those providers process the request under their own policies:

- [CoinGecko Privacy Policy](https://www.coingecko.com/en/privacy)
- [ExchangeRate-API Privacy](https://www.exchangerate-api.com/terms)

If you open a **TradingView** chart from the popup, your browser navigates to TradingView with a market symbol in the URL. That visit is under [TradingView’s privacy policy](https://www.tradingview.com/privacy-policy/). CoinLine does not send them extra data.

## How data is used

Local storage and price fetches exist only to:

1. turn the converter on or off and restore that choice
2. show an inline conversion using recent public rates

They are not used for advertising, profiling, or any other purpose.

## Sale and sharing

CoinLine does not sell your data. It does not share user data with third parties except the incidental HTTP metadata in the price requests described above.

## Permissions (why they exist)

- **storage** — save on/off state and cached rates on your device
- **Host access to CoinGecko and ExchangeRate-API** — download public prices
- **Content script on web pages** — read a short text selection when CoinLine is on, so conversion can happen inline

## Children

CoinLine is not directed at children and does not knowingly collect personal data from anyone, including children.

## Changes

If this policy changes in a way that affects how data is handled, this file will be updated and the date above will change.

## Contact

Questions or requests: open an issue at [github.com/janmichek/coinline](https://github.com/janmichek/coinline).
