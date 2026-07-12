(function () {
  const STORAGE_KEY = "poe2Trade2AffixFilterState";
  const MESSAGE_SOURCE = "poe2-marketwright";
  const MESSAGE_TYPE = "POE2_MARKETWRIGHT_TRADE_ITEM_LOCALIZATION";
  const CACHE_MESSAGE_TYPE = "POE2_MARKETWRIGHT_TRADE_ITEM_CACHE";
  const CACHE_MARKER_KEY = "poe2-marketwright:trade-native-search-localization";
  const TRADE_DATASETS = Object.freeze({
    items: "lscache-trade2items",
    stats: "lscache-trade2stats",
    static: "lscache-trade2data",
    filters: "lscache-trade2filters"
  });
  const PAGE_LANGUAGES = new Set(["en", "zh_CN", "zh_TW", "zh_CN_en", "zh_TW_en"]);

  function resolvePageLanguage(value) {
    if (PAGE_LANGUAGES.has(value)) {
      return value;
    }
    const browserLanguage = chrome.i18n.getUILanguage().replace("-", "_");
    return PAGE_LANGUAGES.has(browserLanguage) ? browserLanguage : "en";
  }

  function getLocale(language) {
    if (language.startsWith("zh_CN")) {
      return "zh_CN";
    }
    if (language.startsWith("zh_TW")) {
      return "zh_TW";
    }
    return "en";
  }

  async function loadStoredState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (stored) => resolve(stored[STORAGE_KEY] || {}));
    });
  }

  function getCacheVersion(bundle, locale) {
    const extensionVersion = chrome.runtime.getManifest?.().version || "development";
    return `${extensionVersion}:${bundle.version || 1}:${locale}`;
  }

  function hasCurrentNativeTradeCaches(cacheVersion) {
    try {
      return (
        localStorage.getItem(CACHE_MARKER_KEY) === cacheVersion &&
        Object.values(TRADE_DATASETS).every((cacheKey) => {
          const value = JSON.parse(localStorage.getItem(cacheKey) || "null");
          return value && typeof value === "object";
        })
      );
    } catch (error) {
      return false;
    }
  }

  async function fetchOfficialTradeDataset(dataset) {
    const url = new URL(`/api/trade2/data/${dataset}`, window.location.origin);
    const response = await fetch(url.toString(), { credentials: "include" });
    if (!response.ok) {
      throw new Error(`Unable to fetch Trade ${dataset} data: ${response.status}`);
    }
    const payload = await response.json();
    if (!payload?.result || typeof payload.result !== "object") {
      throw new Error(`Trade ${dataset} data has no result payload`);
    }
    return [dataset, payload];
  }

  async function fetchOfficialTradeData() {
    return Object.fromEntries(await Promise.all(Object.keys(TRADE_DATASETS).map(fetchOfficialTradeDataset)));
  }

  async function bootstrap() {
    const [state, response] = await Promise.all([
      loadStoredState(),
      fetch(chrome.runtime.getURL("data/trade-item-localization.json"))
    ]);
    if (!response.ok) {
      throw new Error(`Unable to load Trade localization data: ${response.status}`);
    }
    const language = resolvePageLanguage(state.pageLanguage || state.uiLanguage);
    const locale = getLocale(language);
    const enabled = state.pageTranslationEnabled !== false;
    const bundle = await response.json();
    const cacheVersion = getCacheVersion(bundle, locale);
    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: MESSAGE_TYPE,
        payload: {
          enabled,
          locale,
          cacheVersion,
          items: bundle.items || {},
          stats: bundle.stats || {},
          strings: bundle.strings || {}
        }
      },
      "*"
    );
    if (!enabled || locale === "en" || hasCurrentNativeTradeCaches(cacheVersion)) {
      return;
    }
    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: CACHE_MESSAGE_TYPE,
        payload: { datasets: await fetchOfficialTradeData() }
      },
      "*"
    );
  }

  bootstrap().catch((error) => {
    console.debug("[PoE2 Marketwright] unable to configure native Trade localization", error);
  });
})();
