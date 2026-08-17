const ext = globalThis.browser ?? globalThis.chrome;

let isActive = false;
let popupEl = null;

function getTheme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? {
    name: 'dark', bg: '#1a1a2e', text: '#ccc', accent: '#00ff88', surface: '#16213e',
    border: '#333', result: '#0ff', muted: '#aaa', inputBg: '#1a1a2e',
    dropdownBg: '#0f1629', hover: '#16213e',
  } : {
    name: 'light', bg: '#ffffff', text: '#333', accent: '#0055cc', surface: '#eef2ff',
    border: '#ddd', result: '#0055cc', muted: '#888', inputBg: '#f5f7fa',
    dropdownBg: '#ffffff', hover: '#e0e8ff',
  };
}

(async () => {
  const { calcActive } = await ext.storage.local.get('calcActive');
  if (calcActive) setActive(true);
})();

ext.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.calcActive) return;
  setActive(!!changes.calcActive.newValue);
});

function setActive(state) {
  isActive = state;
  if (!state && popupEl) { popupEl.remove(); popupEl = null; }
}

document.addEventListener('mouseup', async (e) => {
  if (!isActive) return;

  if (popupEl && popupEl.contains(e.target)) return;
  if (popupEl) { popupEl.remove(); popupEl = null; }

  const sel = window.getSelection();
  const text = sel.toString().trim();
  if (!text || text.length > 50) return;

  // Clone before await — focus/async work would otherwise drop the selection
  const savedRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  const rect = savedRange ? savedRange.getBoundingClientRect() : null;
  const x = rect ? rect.right + 8 : e.clientX + 14;
  const y = rect ? rect.top : e.clientY + 14;

  const { cryptoList, fxRates } = await ext.storage.local.get(['cryptoList', 'fxRates']);
  if (!cryptoList || !fxRates) return;

  const parsed = parseSelection(text, cryptoList);
  if (!parsed) return;
  if (Math.abs(parsed.value) > 1e12) return;

  showPopup(x, y, parsed, cryptoList, fxRates, savedRange);
});

const CURRENCY_SYMBOLS = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };
const CURRENCY_WORDS = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
  'US Dollar', 'Euro', 'British Pound', 'Japanese Yen',
  'Canadian Dollar', 'Australian Dollar', 'Swiss Franc', 'Chinese Yuan',
  'dollar', 'euro', 'pound', 'yen'];

const USD_OPTION = { id: 'usd', symbol: 'USD', name: 'US Dollar', priceUSD: null };

function parseSelection(text, cryptoList) {
  let currency = 'USD';
  let type = 'fiat';
  const upper = text.toUpperCase();

  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(sym)) { currency = code; break; }
  }

  if (currency === 'USD') {
    for (const word of CURRENCY_WORDS) {
      if (upper.includes(word.toUpperCase())) {
        const map = { USDOLLAR: 'USD', EURO: 'EUR', BRITISHPOUND: 'GBP', JAPANESEYEN: 'JPY', CANADIANDOLLAR: 'CAD', AUSTRALIANDOLLAR: 'AUD', SWISSFRANC: 'CHF', CHINESEYUAN: 'CNY', DOLLAR: 'USD', EUR: 'EUR', GBP: 'GBP', JPY: 'JPY', CAD: 'CAD', AUD: 'AUD', CHF: 'CHF', CNY: 'CNY' };
        const key = word.toUpperCase().replace(/\s+/g, '');
        if (map[key]) { currency = map[key]; break; }
      }
    }
  }

  let cleaned = text.replace(/[$€£¥,]/g, '').replace(/[^0-9.\-]/g, '').trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  if (currency === 'USD' && cryptoList) {
    const symbols = new Set(cryptoList.map(c => c.symbol));
    const remaining = upper.replace(/[\d,.\-]+/g, ' ').replace(/[$€£¥,\s]+/g, ' ').trim();
    for (const token of remaining.split(/\s+/)) {
      if (symbols.has(token)) {
        currency = token;
        type = 'crypto';
        break;
      }
    }
  }

  return { value: num, currency, type };
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (err) {}
  ta.remove();
}

function restoreSelection(range) {
  if (!range) return;
  try {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (_) {}
}

function showPopup(x, y, parsed, cryptoList, fxRates, savedRange) {
  if (popupEl) popupEl.remove();

  const theme = getTheme();
  popupEl = document.createElement('div');
  popupEl.id = 'calc-ext-popup';

  const fmtVal = parsed.type === 'crypto'
    ? parsed.value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })
    : parsed.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  popupEl.setAttribute('data-bwignore', 'true');
  popupEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;min-height:0">
      <span id="calc-ext-header-val" style="font:12px monospace;color:${theme.muted};line-height:1.2"></span>
      <button id="calc-ext-close" style="display:inline-flex;align-items:center;justify-content:center;background:none;border:none;color:${theme.muted};cursor:pointer;font:20px/1 monospace;width:16px;height:16px;padding:0;margin:0;outline:none;flex-shrink:0;transition:color .12s ease;position:relative;top:-2px">×</button>
    </div>
    <div id="calc-ext-sel-wrap" style="position:relative" data-bwignore="true">
      <div id="calc-ext-sel-btn" tabindex="0" style="display:flex;align-items:center;justify-content:space-between;width:100%;background:${theme.surface};border:1px solid ${theme.border};border-radius:4px;padding:5px 8px;cursor:pointer;box-sizing:border-box;outline:none;user-select:none;transition:border-color .12s ease,background .12s ease">
        <span id="calc-ext-sel-text" style="color:${theme.muted};font:12px sans-serif;cursor:pointer">— Select currency —</span>
        <span style="color:${theme.muted};font:10px;margin-left:6px;cursor:pointer">▼</span>
      </div>
      <div id="calc-ext-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;margin-top:2px;background:${theme.dropdownBg};border:1px solid ${theme.border};border-radius:6px;z-index:10;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,${theme.name === 'dark' ? '0.7' : '0.15'})">
        <input id="calc-ext-search" type="search" name="calc-ext-crypto-search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-bwignore="true" data-form-type="other" placeholder="Search..." style="width:100%;padding:7px 8px;background:${theme.inputBg};color:${theme.text};border:none;border-bottom:1px solid ${theme.border};font:12px sans-serif;outline:none;box-sizing:border-box;cursor:text;transition:background .12s ease" />
        <div id="calc-ext-list" style="max-height:180px;overflow-y:auto"></div>
      </div>
    </div>
    <div id="calc-ext-conversion" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;min-height:20px;font:bold 13px monospace;color:${theme.result}">
      <span id="calc-ext-conv-text" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
      <div style="display:flex;align-items:center;flex-shrink:0;margin-left:6px;gap:4px">
        <button id="calc-ext-copy" style="display:none;background:none;border:1px solid ${theme.border};color:${theme.muted};cursor:pointer;border-radius:4px;font-size:11px;padding:1px 6px;outline:none;transition:color .12s ease,border-color .12s ease">Copy</button>
        <button id="calc-ext-chart" title="Open chart" style="display:none;background:none;border:1px solid ${theme.border};color:${theme.muted};cursor:pointer;border-radius:4px;padding:1px 5px;outline:none;line-height:0;transition:color .12s ease,border-color .12s ease">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true" style="display:block;pointer-events:none">
            <path d="M1 14h14"/>
            <path d="M4 14V8M4 6v2"/>
            <rect x="2.6" y="8" width="2.8" height="6" rx="0.4"/>
            <path d="M8 14V5M8 3v2"/>
            <rect x="6.6" y="5" width="2.8" height="9" rx="0.4"/>
            <path d="M12 14V7M12 5v2"/>
            <rect x="10.6" y="7" width="2.8" height="7" rx="0.4"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  const w = 250, h = 140;
  let left = Math.min(x, window.innerWidth - w - 10);
  let top = Math.min(y, window.innerHeight - h - 10);
  if (left < 10) left = 10;
  if (top < 10) top = 10;

  Object.assign(popupEl.style, {
    position: 'fixed', left: `${left}px`, top: `${top}px`,
    width: `${w}px`, background: theme.bg, color: theme.text,
    padding: '10px', borderRadius: '8px', font: '12px sans-serif',
    zIndex: '999999', boxShadow: `0 4px 20px rgba(0,0,0,${theme.name === 'dark' ? '0.6' : '0.15'})`,
    border: `1px solid ${theme.border}`,
  });

  document.body.appendChild(popupEl);
  popupEl.querySelector('#calc-ext-header-val').textContent = `${fmtVal} ${parsed.currency}`;

  const closeBtn = popupEl.querySelector('#calc-ext-close');
  closeBtn.onclick = () => {
    popupEl.remove(); popupEl = null;
  };
  closeBtn.onmouseenter = () => { closeBtn.style.color = theme.accent; };
  closeBtn.onmouseleave = () => { closeBtn.style.color = theme.muted; };

  const btn = popupEl.querySelector('#calc-ext-sel-btn');
  const textSpan = popupEl.querySelector('#calc-ext-sel-text');
  const dropdown = popupEl.querySelector('#calc-ext-dropdown');
  const search = popupEl.querySelector('#calc-ext-search');
  const list = popupEl.querySelector('#calc-ext-list');
  const convText = popupEl.querySelector('#calc-ext-conv-text');
  const copyBtn = popupEl.querySelector('#calc-ext-copy');
  const chartBtn = popupEl.querySelector('#calc-ext-chart');
  let selectedId = '';
  let dropdownOpen = false;
  let highlightIdx = 0;
  let lastAmount = null;

  function cryptoTvSymbol(ticker) {
    return `CRYPTO-${ticker}USD`;
  }

  function tradingViewUrl() {
    if (!selectedId) return null;

    const sourceCrypto = parsed.type === 'crypto' ? parsed.currency : null;
    const targetCoin = selectedId === 'usd' ? null : cryptoList.find(c => c.id === selectedId);
    if (selectedId !== 'usd' && !targetCoin) return null;

    const base = 'https://www.tradingview.com/chart/';

    if (sourceCrypto && targetCoin) {
      if (sourceCrypto === targetCoin.symbol) {
        return `${base}?symbol=${cryptoTvSymbol(sourceCrypto)}`;
      }
      return `${base}?symbol=${cryptoTvSymbol(sourceCrypto)}&comparison=${cryptoTvSymbol(targetCoin.symbol)}`;
    }

    if (sourceCrypto && selectedId === 'usd') {
      return `${base}?symbol=${cryptoTvSymbol(sourceCrypto)}`;
    }

    if (!sourceCrypto && targetCoin) {
      return `${base}?symbol=CRYPTO-${targetCoin.symbol}${parsed.currency}`;
    }

    if (!sourceCrypto && selectedId === 'usd' && parsed.currency !== 'USD') {
      return `${base}?symbol=${parsed.currency}USD`;
    }

    return null;
  }

  function setActionButtons(visible) {
    copyBtn.style.display = visible ? '' : 'none';
    chartBtn.style.display = visible && tradingViewUrl() ? '' : 'none';
  }

  function bindActionHover(el) {
    el.onmouseenter = () => {
      el.style.color = theme.accent;
      el.style.borderColor = theme.accent;
    };
    el.onmouseleave = () => {
      el.style.color = theme.muted;
      el.style.borderColor = theme.border;
    };
  }

  btn.onmouseenter = () => {
    btn.style.borderColor = theme.accent;
    btn.style.background = theme.hover;
  };
  btn.onmouseleave = () => {
    if (dropdownOpen) return;
    btn.style.borderColor = theme.border;
    btn.style.background = theme.surface;
  };

  search.onmouseenter = () => { search.style.background = theme.hover; };
  search.onmouseleave = () => {
    if (document.activeElement === search) return;
    search.style.background = theme.inputBg;
  };
  search.onfocus = () => { search.style.background = theme.hover; };
  search.onblur = () => {
    search.style.background = theme.inputBg;
    restoreSelection(savedRange);
  };

  copyBtn.onclick = (e) => {
    e.stopPropagation();
    if (lastAmount === null) return;
    copyToClipboard(lastAmount);
    const old = copyBtn.textContent;
    copyBtn.textContent = '✓';
    setTimeout(() => { copyBtn.textContent = old; }, 1200);
  };
  bindActionHover(copyBtn);

  chartBtn.onclick = (e) => {
    e.stopPropagation();
    const url = tradingViewUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  bindActionHover(chartBtn);

  function updateHighlight() {
    const items = list.querySelectorAll('div');
    items.forEach((el, i) => {
      const sel = el.dataset.id === selectedId;
      const hl = i === highlightIdx;
      el.style.background = hl ? theme.hover : (sel ? theme.surface : 'transparent');
      el.style.color = hl ? theme.accent : (sel ? theme.result : theme.text);
    });
    items[highlightIdx]?.scrollIntoView({ block: 'nearest' });
  }

  function renderList(filter) {
    const q = (filter || '').toUpperCase();
    const targets = [USD_OPTION, ...cryptoList];
    const filtered = q
      ? targets.filter(c => c.name.toUpperCase().includes(q) || c.symbol.includes(q))
      : targets;

    const borderColor = theme.name === 'dark' ? '#1a1a2e' : '#eee';
    list.replaceChildren();
    filtered.forEach((c) => {
      const row = document.createElement('div');
      row.dataset.id = c.id;
      Object.assign(row.style, {
        padding: '5px 8px',
        cursor: 'pointer',
        font: '12px sans-serif',
        display: 'flex',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${borderColor}`,
      });

      const nameSpan = document.createElement('span');
      nameSpan.textContent = c.name;

      const symSpan = document.createElement('span');
      symSpan.textContent = c.symbol;
      symSpan.style.color = theme.muted;

      row.append(nameSpan, symSpan);
      row.onclick = () => selectCrypto(c.id);
      row.onmouseenter = () => {
        highlightIdx = Array.from(list.children).indexOf(row);
        updateHighlight();
      };
      list.appendChild(row);
    });

    highlightIdx = 0;
    updateHighlight();
  }

  function selectCrypto(id) {
    selectedId = id;
    const coin = id === 'usd' ? USD_OPTION : cryptoList.find(c => c.id === id);
    textSpan.textContent = coin ? `${coin.name} (${coin.symbol})` : '';
    textSpan.style.color = theme.text;
    closeDropdown();
    updateConversion();
    restoreSelection(savedRange);
  }

  function updateConversion() {
    if (!selectedId) { convText.textContent = ''; setActionButtons(false); lastAmount = null; return; }
    let usdValue;
    if (parsed.type === 'crypto') {
      const source = cryptoList.find(c => c.symbol === parsed.currency);
      if (!source) { convText.textContent = ''; setActionButtons(false); lastAmount = null; return; }
      usdValue = parsed.value * source.priceUSD;
    } else {
      usdValue = parsed.value;
      if (parsed.currency !== 'USD' && fxRates[parsed.currency]) {
        usdValue = parsed.value / fxRates[parsed.currency];
      }
    }

    if (selectedId === 'usd') {
      const numStr = usdValue.toFixed(2);
      lastAmount = numStr;
      convText.textContent = `≈ ${numStr} USD`;
      setActionButtons(true);
      return;
    }

    const coin = cryptoList.find(c => c.id === selectedId);
    if (!coin) { convText.textContent = ''; setActionButtons(false); lastAmount = null; return; }
    const amt = usdValue / coin.priceUSD;
    const numStr = amt < 0.001 ? amt.toFixed(8) : amt.toFixed(4);
    lastAmount = numStr;
    convText.textContent = `≈ ${numStr} ${coin.symbol}`;
    setActionButtons(true);
  }

  function positionDropdown() {
    dropdown.style.top = '100%';
    dropdown.style.bottom = 'auto';
    dropdown.style.marginTop = '2px';
    dropdown.style.marginBottom = '0';
    list.style.maxHeight = '180px';

    const btnRect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - btnRect.bottom - 8;
    const spaceAbove = btnRect.top - 8;
    const needed = dropdown.offsetHeight || 220;
    const openUp = spaceBelow < needed && spaceAbove > spaceBelow;
    const available = Math.max(80, openUp ? spaceAbove : spaceBelow);
    list.style.maxHeight = `${Math.max(60, Math.min(180, available - 40))}px`;

    if (openUp) {
      dropdown.style.top = 'auto';
      dropdown.style.bottom = '100%';
      dropdown.style.marginTop = '0';
      dropdown.style.marginBottom = '2px';
    }
  }

  function openDropdown(autoFocus = true) {
    selectedId = '';
    textSpan.textContent = '— Select currency —';
    textSpan.style.color = theme.muted;
    search.value = '';
    updateConversion();
    dropdownOpen = true;
    dropdown.style.display = 'block';
    btn.style.borderColor = theme.accent;
    btn.style.background = theme.hover;
    renderList('');
    positionDropdown();
    if (!autoFocus) return;
    // readonly briefly so password manager doesn't attach its overlay on focus
    search.setAttribute('readonly', 'readonly');
    search.focus();
    requestAnimationFrame(() => {
      search.removeAttribute('readonly');
    });
  }

  function closeDropdown() {
    dropdownOpen = false;
    dropdown.style.display = 'none';
    btn.style.borderColor = theme.border;
    btn.style.background = theme.surface;
  }

  btn.onclick = (e) => {
    e.stopPropagation();
    dropdownOpen ? closeDropdown() : openDropdown();
  };
  btn.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDropdown(); }
  };

  search.oninput = () => renderList(search.value);

  search.onkeydown = (e) => {
    const items = list.querySelectorAll('div');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) highlightIdx = (highlightIdx + 1) % items.length;
      updateHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) highlightIdx = (highlightIdx - 1 + items.length) % items.length;
      updateHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[highlightIdx]) items[highlightIdx].click();
    } else if (e.key === 'Escape') {
      closeDropdown();
      restoreSelection(savedRange);
    }
  };

  // Keep page text selected while interacting with the popup (except real inputs)
  popupEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    e.preventDefault();
  });

  popupEl.addEventListener('click', (e) => {
    if (dropdownOpen && !e.target.closest('#calc-ext-dropdown') && !e.target.closest('#calc-ext-sel-btn')) {
      closeDropdown();
    }
  });

  openDropdown(true);
}
