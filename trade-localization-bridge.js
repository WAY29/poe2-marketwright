(function () {
  const MESSAGE_SOURCE = "poe2-marketwright";
  const MESSAGE_TYPE = "POE2_MARKETWRIGHT_TRADE_ITEM_LOCALIZATION";
  const CACHE_MESSAGE_TYPE = "POE2_MARKETWRIGHT_TRADE_ITEM_CACHE";
  const CACHE_MARKER_KEY = "poe2-marketwright:trade-native-search-localization";
  const LEGACY_ITEM_CACHE_MARKER_KEY = "poe2-marketwright:trade-item-localization";
  const TRADE_DATASETS = Object.freeze({
    items: { cacheKey: "lscache-trade2items" },
    stats: { cacheKey: "lscache-trade2stats" },
    static: { cacheKey: "lscache-trade2data" },
    filters: { cacheKey: "lscache-trade2filters" }
  });
  const nativeFetch = window.fetch;
  let configuration = null;
  let resolveConfiguration;
  const configurationReady = new Promise((resolve) => {
    resolveConfiguration = resolve;
  });

  function getTradeDataDataset(input) {
    const url = typeof input === "string" ? input : input?.url;
    const match = typeof url === "string" && url.match(/\/api\/trade2\/data\/(items|stats|static|filters)(?:[?#]|$)/);
    return match ? match[1] : null;
  }

  function getLocalizedText(value, localized, bilingual) {
    const english = String(value || "");
    const translation = String(localized || "");
    if (!translation || translation === english) {
      return english;
    }
    if (bilingual && english.startsWith(`${translation} (`) && english.endsWith(")")) {
      return english;
    }
    return bilingual ? `${translation} (${english})` : translation;
  }

  function localizeTradeItemsPayload(payload, config) {
    if (!config?.enabled || config.locale === "en" || !Array.isArray(payload?.result)) {
      return payload;
    }
    const items = config.items || {};
    return {
      ...payload,
      result: payload.result.map((group) => ({
        ...group,
        entries: Array.isArray(group?.entries)
          ? group.entries.map((entry) => {
              const englishText = String(entry?.text || "");
              const englishType = String(entry?.type || "");
              // A flagged entry is a named item. Its base type must not become
              // its display name, but a verified name translation is safe.
              const localized = (entry?.flags ? items[englishText] : items[englishText] || items[englishType])?.[
                config.locale
              ];
              const english = englishText || englishType;
              const text = getLocalizedText(english, localized, config.bilingual === true);
              return localized && text !== englishText ? { ...entry, text } : entry;
            })
          : group?.entries
      }))
    };
  }

  function localizeTradeStatsPayload(payload, config) {
    if (!config?.enabled || config.locale === "en" || !Array.isArray(payload?.result)) {
      return payload;
    }
    const stats = config.stats || {};
    return {
      ...payload,
      result: payload.result.map((group) => ({
        ...group,
        entries: Array.isArray(group?.entries)
          ? group.entries.map((entry) => {
              const english = String(entry?.text || "");
              const text = getLocalizedText(english, stats[String(entry?.id || "")]?.[config.locale], config.bilingual === true);
              return text && text !== english ? { ...entry, text } : entry;
            })
          : group?.entries
      }))
    };
  }

  function localizeStaticValue(value, config) {
    return getLocalizedText(value, config.strings?.[value]?.[config.locale], config.bilingual === true);
  }

  function localizeTradeTextPayload(payload, config) {
    if (!config?.enabled || config.locale === "en" || !payload || typeof payload !== "object") {
      return payload;
    }
    if (Array.isArray(payload)) {
      return payload.map((entry) => localizeTradeTextPayload(entry, config));
    }
    const localized = {};
    for (const [key, value] of Object.entries(payload)) {
      localized[key] = (key === "text" || key === "label") && typeof value === "string"
        ? localizeStaticValue(value, config)
        : localizeTradeTextPayload(value, config);
    }
    return localized;
  }

  function localizeTradePayload(dataset, payload, config) {
    if (dataset === "items") {
      return localizeTradeItemsPayload(payload, config);
    }
    if (dataset === "stats") {
      return localizeTradeStatsPayload(payload, config);
    }
    return localizeTradeTextPayload(payload, config);
  }

  function hasTradeResult(payload) {
    return payload && typeof payload === "object" && Object.hasOwn(payload, "result");
  }

  function writeNativeTradeCache(dataset, payload, config) {
    const cache = TRADE_DATASETS[dataset];
    if (!cache || !config?.enabled || config.locale === "en" || !hasTradeResult(payload)) {
      return payload;
    }
    const localized = localizeTradePayload(dataset, payload, config);
    try {
      // Trade reads these values before its native multiselects initialize.
      // IDs and item types stay English, so selected Chinese labels preserve
      // the official query identity.
      localStorage.setItem(cache.cacheKey, JSON.stringify(localized.result));
      localStorage.removeItem(`${cache.cacheKey}-cacheexpiration`);
      localStorage.setItem(CACHE_MARKER_KEY, String(config.cacheVersion || ""));
      localStorage.removeItem(LEGACY_ITEM_CACHE_MARKER_KEY);
    } catch (error) {
      console.debug("[PoE2 Marketwright] unable to write native Trade cache", error);
    }
    return localized;
  }

  function writeNativeTradeCaches(payloads, config) {
    for (const dataset of Object.keys(TRADE_DATASETS)) {
      if (payloads?.[dataset]) {
        writeNativeTradeCache(dataset, payloads[dataset], config);
      }
    }
  }

  function clearNativeTradeCaches() {
    try {
      for (const { cacheKey } of Object.values(TRADE_DATASETS)) {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}-cacheexpiration`);
      }
      localStorage.removeItem(CACHE_MARKER_KEY);
      localStorage.removeItem(LEGACY_ITEM_CACHE_MARKER_KEY);
    } catch (error) {
      console.debug("[PoE2 Marketwright] unable to clear native Trade caches", error);
    }
  }

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.data?.source !== MESSAGE_SOURCE ||
      ![MESSAGE_TYPE, CACHE_MESSAGE_TYPE].includes(event.data?.type)
    ) {
      return;
    }
    if (event.data.type === MESSAGE_TYPE) {
      configuration = event.data.payload || { enabled: false, locale: "en", items: {}, stats: {}, strings: {} };
      if (
        !configuration.enabled ||
        configuration.locale === "en" ||
        localStorage.getItem(CACHE_MARKER_KEY) !== String(configuration.cacheVersion || "")
      ) {
        clearNativeTradeCaches();
      }
      resolveConfiguration?.(configuration);
      resolveConfiguration = null;
      return;
    }
    if (event.data.type === CACHE_MESSAGE_TYPE) {
      writeNativeTradeCaches(event.data.payload?.datasets, configuration);
    }
  });

  // A disabled or removed extension may have left translated data in these
  // native caches. Only reuse caches this extension explicitly marked.
  try {
    if (!localStorage.getItem(CACHE_MARKER_KEY)) {
      clearNativeTradeCaches();
    }
  } catch (error) {
    console.debug("[PoE2 Marketwright] unable to inspect native Trade caches", error);
  }

  if (typeof nativeFetch !== "function") {
    return;
  }

  window.fetch = async function (...args) {
    const response = await nativeFetch.apply(this, args);
    const dataset = getTradeDataDataset(args[0]);
    if (!dataset) {
      return response;
    }
    const config = configuration || await Promise.race([
      configurationReady,
      new Promise((resolve) => window.setTimeout(() => resolve(null), 1000))
    ]);
    if (!config?.enabled || config.locale === "en") {
      return response;
    }
    try {
      const originalPayload = JSON.parse(await response.clone().text());
      const localized = writeNativeTradeCache(dataset, originalPayload, config);
      return new Response(JSON.stringify(localized), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.debug("[PoE2 Marketwright] unable to localize native Trade data", error);
      return response;
    }
  };
})();
