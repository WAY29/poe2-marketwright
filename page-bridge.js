(function () {
  if (window.__poe2MarketwrightPageBridgeLoaded) {
    return;
  }
  window.__poe2MarketwrightPageBridgeLoaded = true;

  const SOURCE = "poe2-marketwright";
  const UPDATE_TYPE = "POE2_MARKETWRIGHT_UPDATE";
  const READY_TYPE = "POE2_MARKETWRIGHT_READY";
  const STATE_TYPE = "POE2_MARKETWRIGHT_STATE";
  const SEARCH_SNAPSHOT_TYPE = "POE2_MARKETWRIGHT_SEARCH_SNAPSHOT";
  const SEARCH_SNAPSHOT_STORAGE_KEY = "poe2-marketwright:search-snapshot";
  const POB_MESSAGE_SOURCE = "poe2-marketwright-pob-copy";
  const FAVORITES_MESSAGE_SOURCE = "poe2-marketwright-favorites";
  const CURRENCY_MESSAGE_SOURCE = "poe2-marketwright-currency-conversion";
  const NUMBER_RE = /([-+]?\d+(?:\.\d+)?)/g;
  const PSEUDO_STAT_GROUP_ID = "pseudo";
  const ALWAYS_VISIBLE_PSEUDO_STAT_ID_RE = /^pseudo\.pseudo_number_of_(?:[\w]+_mods|uses_remaining)$/i;
  const ALWAYS_VISIBLE_PSEUDO_STAT_TEXT_RE =
    /^#?\s*(?:(?:(?:crafted|desecrated|empty|enchant|fractured|implicit|prefix|suffix|unrevealed)\s+)*modifiers?|uses remaining(?:\s*\([^)]*\))?)\s*$/i;
  const ALWAYS_VISIBLE_PSEUDO_STAT_ZH_TEXT_RE =
    /^#?\s*(?:空\s*)?(?:前缀|前綴|后缀|後綴|词缀|詞綴)(?:\s*(?:数量|數量|修饰|修飾|词缀|詞綴))?$/i;
  const PSEUDO_STAT_RELEVANCE_IGNORED_TOKENS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "by",
    "combined",
    "crafted",
    "during",
    "enchant",
    "explicit",
    "extra",
    "for",
    "fractured",
    "from",
    "gain",
    "gained",
    "global",
    "grants",
    "has",
    "have",
    "if",
    "implicit",
    "in",
    "increased",
    "is",
    "less",
    "local",
    "more",
    "of",
    "on",
    "or",
    "per",
    "pseudo",
    "reduced",
    "rune",
    "skill",
    "stat",
    "sum",
    "the",
    "to",
    "total",
    "when",
    "while",
    "with",
    "you",
    "your"
  ]);
  const ATTRIBUTE_RELEVANCE_TOKENS = new Set(["attribute", "strength", "dexterity", "intelligence"]);
  const BASIC_ATTRIBUTE_RELEVANCE_TOKENS = new Set(["strength", "dexterity", "intelligence"]);
  const RESISTANCE_RELEVANCE_TOKENS = new Set([
    "chaos",
    "cold",
    "elemental",
    "fire",
    "lightning",
    "resistance"
  ]);
  const ELEMENTAL_RELEVANCE_TOKENS = new Set(["cold", "fire", "lightning"]);
  const FILTERABLE_STAT_GROUPS = new Set([
    "pseudo",
    "explicit",
    "implicit",
    "fractured",
    "crafted",
    "enchant",
    "rune",
    "desecrated",
    "sanctum",
    "skill"
  ]);

  const runtime = {
    app: null,
    originalKnownStats: null,
    lastPayload: {
      enabled: false,
      pobCopyEnabled: false,
      // Capture result details during initial content-script startup. Content state can disable this afterward.
      favoritesEnabled: true,
      currencyConversionEnabled: false,
      allowedKeys: [],
      allowedStatIds: [],
      allKeys: [],
      allStatIds: []
    },
    lastFilterStats: null
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== SOURCE || event.data.type !== UPDATE_TYPE) {
      return;
    }

    runtime.lastPayload = { ...runtime.lastPayload, ...(event.data.payload || {}) };
    applyKnownStatsFilter();
    restoreCurrentSearchSnapshot();
    notifyState();
  });

  waitForTradeApp();
  installTradeApiHook();
  notifyReady();

  function waitForTradeApp() {
    if (captureTradeApp()) {
      applyKnownStatsFilter();
      notifyState();
      return;
    }

    window.setTimeout(waitForTradeApp, 250);
  }

  function captureTradeApp() {
    const app = window.app;
    const staticData = app?.$data?.static_;
    if (!app || !staticData || !Array.isArray(staticData.knownStats)) {
      return false;
    }

    runtime.app = app;
    if (!runtime.originalKnownStats) {
      runtime.originalKnownStats = cloneKnownStats(staticData.knownStats);
    }
    return true;
  }

  function installTradeApiHook() {
    if (window.__poe2MarketwrightPobApiHookLoaded) {
      return;
    }
    window.__poe2MarketwrightPobApiHookLoaded = true;

    const getLeagueFromTradeSearchUrl = (url) => {
      const match = String(url || "").match(/\/trade2\/search\/(?:poe2\/)?([^/?#]+)/i);
      if (!match) {
        return null;
      }
      try {
        const league = decodeURIComponent(match[1]).trim();
        return league || null;
      } catch (error) {
        return null;
      }
    };

    const getQueryIdFromFetchUrl = (url) => {
      const match = String(url || "").match(/[?&]query=([^&#]+)/i);
      if (!match) {
        return null;
      }
      try {
        const queryId = decodeURIComponent(match[1]).trim();
        return queryId || null;
      } catch (error) {
        return null;
      }
    };

    const getTradeSearchRequest = (url, body) => {
      const match = String(url || "").match(/\/api\/trade2\/search\/(?:poe2\/)?([^/?#]+)/i);
      if (!match || typeof body !== "string") {
        return null;
      }
      try {
        const league = decodeURIComponent(match[1]).trim();
        const query = JSON.parse(body);
        return league && query && typeof query === "object" ? { league, query } : null;
      } catch (error) {
        return null;
      }
    };

    const emitLinkSearchSnapshot = (url, requestBody, responseBody) => {
      if (!runtime.lastPayload.favoritesEnabled) {
        return;
      }
      const request = getTradeSearchRequest(url, requestBody);
      if (!request || typeof responseBody !== "string") {
        return;
      }
      try {
        const response = JSON.parse(responseBody);
        const queryId = String(response?.id || "").trim();
        if (!queryId) {
          return;
        }
        emitSearchSnapshot({ league: request.league, queryId, query: request.query });
      } catch (error) {
        // A failed or non-JSON request must not affect the native trade request.
      }
    };

    const emitCurrencyUpdate = (url, body, searchUrl) => {
      if (!runtime.lastPayload.currencyConversionEnabled || !url) {
        return;
      }
      const tradeUrl = String(url);
      if (!tradeUrl.includes("/api/trade2/fetch/")) {
        return;
      }
      const league = getLeagueFromTradeSearchUrl(searchUrl);
      if (!league) {
        return;
      }
      const queryId = getQueryIdFromFetchUrl(tradeUrl);
      window.postMessage(
        {
          source: CURRENCY_MESSAGE_SOURCE,
          type: "fetch",
          league,
          queryId,
          searchUrl,
          tradeUrl,
          body: typeof body === "string" ? body : null
        },
        "*"
      );
    };

    const emitPobCopy = (url, body) => {
      if (!runtime.lastPayload.pobCopyEnabled || !url || !String(url).includes("/api/trade2/fetch/")) {
        return;
      }
      window.postMessage(
        {
          source: POB_MESSAGE_SOURCE,
          url: String(url),
          body: typeof body === "string" ? body : null
        },
        "*"
      );
    };

    const emitFavorites = (url, body) => {
      if (!runtime.lastPayload.favoritesEnabled || !url || !String(url).includes("/api/trade2/fetch/")) {
        return;
      }
      window.postMessage(
        {
          source: FAVORITES_MESSAGE_SOURCE,
          url: String(url),
          body: typeof body === "string" ? body : null
        },
        "*"
      );
    };

    const emit = (url, body, searchUrl) => {
      emitCurrencyUpdate(url, body, searchUrl);
      emitPobCopy(url, body);
      emitFavorites(url, body);
    };

    const originalFetch = window.fetch;
    if (typeof originalFetch === "function") {
      window.fetch = function (...args) {
        let targetUrl = null;
        try {
          const target =
            typeof Request !== "undefined" && args[0] instanceof Request ? args[0].url : args[0];
          targetUrl = String(target);
        } catch (error) {
          targetUrl = null;
        }

        const searchUrl = window.location?.href || null;
        const requestBody = typeof args[1]?.body === "string" ? args[1].body : null;
        const responsePromise = originalFetch.apply(this, args);
        if (targetUrl?.includes("/api/trade2/search/")) {
          responsePromise
            .then((response) => response.clone().text())
            .then((body) => emitLinkSearchSnapshot(targetUrl, requestBody, body))
            .catch(() => {});
        }
        if (
          targetUrl?.includes("/api/trade2/fetch/") &&
          (
            runtime.lastPayload.pobCopyEnabled ||
            runtime.lastPayload.favoritesEnabled ||
            runtime.lastPayload.currencyConversionEnabled
          )
        ) {
          responsePromise
            .then((response) => response.clone().text())
            .then((body) => emit(targetUrl, body, searchUrl))
            .catch(() => {});
        }
        return responsePromise;
      };
    }

    if (typeof XMLHttpRequest !== "undefined") {
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this.__poe2MarketwrightPobUrl =
          typeof url === "string" && url.includes("/api/trade2/fetch/") ? url : null;
        this.__poe2MarketwrightTradeSearchUrl = this.__poe2MarketwrightPobUrl ? window.location?.href || null : null;
        this.__poe2MarketwrightLinkSearchUrl =
          typeof url === "string" && url.includes("/api/trade2/search/") ? url : null;
        return originalOpen.call(this, method, url, ...rest);
      };
      XMLHttpRequest.prototype.send = function (...args) {
        this.__poe2MarketwrightLinkSearchBody = typeof args[0] === "string" ? args[0] : null;
        if (this.__poe2MarketwrightLinkSearchUrl) {
          this.addEventListener(
            "load",
            () => {
              try {
                const body = this.responseType === "json" ? JSON.stringify(this.response) : this.responseText;
                emitLinkSearchSnapshot(this.__poe2MarketwrightLinkSearchUrl, this.__poe2MarketwrightLinkSearchBody, body);
              } catch (error) {
                // Ignore inaccessible XHR responses.
              }
            },
            { once: true }
          );
        }
        if (this.__poe2MarketwrightPobUrl) {
          this.addEventListener(
            "load",
            () => {
              let body = null;
              if (
                runtime.lastPayload.pobCopyEnabled ||
                runtime.lastPayload.favoritesEnabled ||
                runtime.lastPayload.currencyConversionEnabled
              ) {
                try {
                  if (this.responseType === "" || this.responseType === "text") {
                    body = this.responseText;
                  } else if (this.responseType === "json") {
                    body = JSON.stringify(this.response);
                  }
                } catch (error) {
                  body = null;
                }
              }
              emit(this.__poe2MarketwrightPobUrl, body, this.__poe2MarketwrightTradeSearchUrl);
            },
            { once: true }
          );
        }
        return originalSend.apply(this, args);
      };
    }
  }

  function emitSearchSnapshot(payload) {
    cacheSearchSnapshot(payload);
    window.postMessage(
      {
        source: SOURCE,
        type: SEARCH_SNAPSHOT_TYPE,
        payload
      },
      "*"
    );
  }

  function cacheSearchSnapshot(payload) {
    try {
      window.sessionStorage?.setItem(SEARCH_SNAPSHOT_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Storage is optional; live search capture remains available in this document.
    }
  }

  function restoreCurrentSearchSnapshot() {
    if (!runtime.lastPayload.favoritesEnabled) {
      return;
    }
    const current = getCurrentSearchLocation();
    if (!current) {
      return;
    }
    try {
      const cached = JSON.parse(window.sessionStorage?.getItem(SEARCH_SNAPSHOT_STORAGE_KEY) || "null");
      if (
        cached?.league === current.league &&
        cached?.queryId === current.queryId &&
        cached?.query &&
        typeof cached.query === "object"
      ) {
        emitSearchSnapshot(cached);
      }
    } catch (error) {
      // A malformed or unavailable session cache must not affect Trade.
    }
  }

  function getCurrentSearchLocation() {
    const match = String(window.location?.pathname || "").match(/^\/trade2\/search\/poe2\/([^/]+)\/([^/]+)\/?$/i);
    if (!match) {
      return null;
    }
    try {
      const league = decodeURIComponent(match[1]).trim();
      const queryId = decodeURIComponent(match[2]).trim();
      return league && queryId ? { league, queryId } : null;
    } catch (error) {
      return null;
    }
  }

  function cloneKnownStats(knownStats) {
    return knownStats.map((group) => ({
      ...group,
      entries: Array.isArray(group.entries) ? group.entries.slice() : []
    }));
  }

  function applyKnownStatsFilter() {
    if (!runtime.app && !captureTradeApp()) {
      return;
    }

    const staticData = runtime.app.$data.static_;
    const payload = runtime.lastPayload || {};
    const allowedIds = new Set(payload.allowedStatIds || []);
    const allowedKeys = buildAllowedKeys(payload.allowedKeys || [], allowedIds);
    const shouldFilter = Boolean(payload.enabled && (allowedKeys.size > 0 || allowedIds.size > 0));
    const stats = {
      total: 0,
      kept: 0,
      hidden: 0,
      skipped: false
    };

    const nextKnownStats = runtime.originalKnownStats.map((group) => {
      const entries = Array.isArray(group.entries) ? group.entries : [];
      if (!shouldFilter || !isFilterableStatGroup(group.id)) {
        return {
          ...group,
          entries: entries.slice()
        };
      }

      const filteredEntries = entries.filter((entry) => {
        stats.total += 1;
        const id = String(entry?.id || "");
        const key = normalizeStatKey(entry?.text || entry?.type || "");
        const pseudo = isPseudoStatGroup(group.id) || isPseudoStatId(id);
        const keep =
          (id && allowedIds.has(id)) ||
          (key && allowedKeys.has(key)) ||
          (pseudo &&
            (isAlwaysVisiblePseudoStat(id, [entry?.text, entry?.type, key]) ||
              isPseudoStatRelatedToAllowed([id, key], allowedKeys)));
        if (keep) {
          stats.kept += 1;
          return true;
        }
        stats.hidden += 1;
        return false;
      });

      return {
        ...group,
        entries: filteredEntries
      };
    });

    if (shouldFilter && stats.total > 0 && stats.kept === 0) {
      replaceKnownStats(staticData, cloneKnownStats(runtime.originalKnownStats));
      runtime.lastFilterStats = {
        ...stats,
        hidden: 0,
        skipped: true
      };
      return;
    }

    replaceKnownStats(staticData, nextKnownStats);
    runtime.lastFilterStats = stats;
  }

  function replaceKnownStats(staticData, nextKnownStats) {
    if (Array.isArray(staticData.knownStats) && typeof staticData.knownStats.splice === "function") {
      staticData.knownStats.splice(0, staticData.knownStats.length, ...nextKnownStats);
      return;
    }

    staticData.knownStats = nextKnownStats;
  }

  function buildAllowedKeys(payloadKeys, allowedIds) {
    const allowedKeys = new Set(payloadKeys);
    if (!allowedIds.size || !runtime.originalKnownStats) {
      return allowedKeys;
    }

    for (const group of runtime.originalKnownStats) {
      for (const entry of Array.isArray(group.entries) ? group.entries : []) {
        if (!allowedIds.has(String(entry?.id || ""))) {
          continue;
        }
        const key = normalizeStatKey(entry?.text || entry?.type || "");
        if (key) {
          allowedKeys.add(key);
        }
      }
    }

    return allowedKeys;
  }

  function isFilterableStatGroup(groupId) {
    const normalized = String(groupId || "").toLowerCase();
    return FILTERABLE_STAT_GROUPS.has(normalized);
  }

  function isPseudoStatGroup(groupId) {
    return String(groupId || "").toLowerCase() === PSEUDO_STAT_GROUP_ID;
  }

  function isPseudoStatId(statId) {
    return /^pseudo\./i.test(String(statId || ""));
  }

  function isAlwaysVisiblePseudoStat(statId, values) {
    if (ALWAYS_VISIBLE_PSEUDO_STAT_ID_RE.test(String(statId || ""))) {
      return true;
    }

    return values.some(hasAlwaysVisiblePseudoStatText);
  }

  function hasAlwaysVisiblePseudoStatText(text) {
    const raw = String(text || "").replace(/\u00a0/g, " ");
    const normalized = raw
      .replace(/^pseudo\s*[:：-]?\s*/i, "")
      .replace(NUMBER_RE, "#")
      .replace(/\s+/g, " ")
      .trim();
    const zhNormalized = normalized.replace(/\s+/g, "");
    return (
      ALWAYS_VISIBLE_PSEUDO_STAT_TEXT_RE.test(normalized) ||
      ALWAYS_VISIBLE_PSEUDO_STAT_ZH_TEXT_RE.test(normalized) ||
      ALWAYS_VISIBLE_PSEUDO_STAT_ZH_TEXT_RE.test(zhNormalized)
    );
  }

  function isPseudoStatRelatedToAllowed(pseudoValues, allowedKeys) {
    const pseudoTokenSets = buildStatRelevanceTokenSets(pseudoValues);
    if (!pseudoTokenSets.length) {
      return false;
    }

    for (const allowedKey of allowedKeys) {
      const allowedTokens = buildStatRelevanceTokens(allowedKey);
      if (!allowedTokens.size) {
        continue;
      }

      for (const pseudoTokens of pseudoTokenSets) {
        if (areStatRelevanceTokensRelated(pseudoTokens, allowedTokens)) {
          return true;
        }
      }
    }

    return false;
  }

  function buildStatRelevanceTokenSets(values) {
    const tokenSets = [];
    for (const value of values) {
      const tokens = buildStatRelevanceTokens(value);
      if (tokens.size && !tokenSets.some((existing) => areSetsEqual(existing, tokens))) {
        tokenSets.push(tokens);
      }
    }
    return tokenSets;
  }

  function buildStatRelevanceTokens(value) {
    const tokens = String(value || "")
      .replace(/^pseudo\.(?:pseudo_)?/i, " ")
      .replace(/[_./-]+/g, " ")
      .toLowerCase()
      .replace(/\u00a0/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .map(normalizeRelevanceToken)
      .filter((token) => token && !PSEUDO_STAT_RELEVANCE_IGNORED_TOKENS.has(token));

    return new Set(tokens);
  }

  function normalizeRelevanceToken(token) {
    if (token === "attributes") {
      return "attribute";
    }
    if (token === "resistances") {
      return "resistance";
    }
    if (token.endsWith("ies") && token.length > 3) {
      return `${token.slice(0, -3)}y`;
    }
    if (token.endsWith("s") && token.length > 3 && token !== "chaos") {
      return token.slice(0, -1);
    }
    return token;
  }

  function areStatRelevanceTokensRelated(pseudoTokens, allowedTokens) {
    return (
      areSetsEqual(pseudoTokens, allowedTokens) ||
      isAttributeRelevanceMatch(pseudoTokens, allowedTokens) ||
      isResistanceRelevanceMatch(pseudoTokens, allowedTokens)
    );
  }

  function isAttributeRelevanceMatch(leftTokens, rightTokens) {
    if (!isSetLimitedTo(leftTokens, ATTRIBUTE_RELEVANCE_TOKENS)) {
      return false;
    }
    if (!isSetLimitedTo(rightTokens, ATTRIBUTE_RELEVANCE_TOKENS)) {
      return false;
    }
    return hasSpecificAttribute(leftTokens) && hasSpecificAttribute(rightTokens) && setsIntersect(leftTokens, rightTokens);
  }

  function hasSpecificAttribute(tokens) {
    return tokens.has("attribute") || setsIntersect(tokens, BASIC_ATTRIBUTE_RELEVANCE_TOKENS);
  }

  function isResistanceRelevanceMatch(leftTokens, rightTokens) {
    if (!leftTokens.has("resistance") || !rightTokens.has("resistance")) {
      return false;
    }
    if (!isSetLimitedTo(leftTokens, RESISTANCE_RELEVANCE_TOKENS)) {
      return false;
    }
    if (!isSetLimitedTo(rightTokens, RESISTANCE_RELEVANCE_TOKENS)) {
      return false;
    }
    return (
      leftTokens.size === 1 ||
      rightTokens.size === 1 ||
      setsIntersect(leftTokens, rightTokens) ||
      (leftTokens.has("elemental") && setsIntersect(rightTokens, ELEMENTAL_RELEVANCE_TOKENS)) ||
      (rightTokens.has("elemental") && setsIntersect(leftTokens, ELEMENTAL_RELEVANCE_TOKENS))
    );
  }

  function areSetsEqual(leftTokens, rightTokens) {
    return leftTokens.size === rightTokens.size && isSetSubset(leftTokens, rightTokens);
  }

  function isSetSubset(leftTokens, rightTokens) {
    for (const token of leftTokens) {
      if (!rightTokens.has(token)) {
        return false;
      }
    }
    return true;
  }

  function isSetLimitedTo(tokens, allowedTokens) {
    for (const token of tokens) {
      if (!allowedTokens.has(token)) {
        return false;
      }
    }
    return true;
  }

  function setsIntersect(leftTokens, rightTokens) {
    for (const token of leftTokens) {
      if (rightTokens.has(token)) {
        return true;
      }
    }
    return false;
  }

  function notifyReady() {
    window.postMessage(
      {
        source: SOURCE,
        type: READY_TYPE
      },
      "*"
    );
  }

  function notifyState() {
    window.postMessage(
      {
        source: SOURCE,
        type: STATE_TYPE,
        payload: {
          filterStats: runtime.lastFilterStats
        }
      },
      "*"
    );
  }

  function normalizeStatKey(text) {
    return String(text)
      .replace(/\u00a0/g, " ")
      .replace(/\n+/g, " ")
      .replace(/[−–—]/g, "-")
      .replace(/\([^)]*local[^)]*\)/gi, " ")
      .replace(/\[[^\]]+\]/g, " ")
      .replace(NUMBER_RE, "#")
      .replace(/\(\s*#\s*-\s*#\s*\)/g, "#")
      .replace(/#\s*-\s*#/g, "#")
      .replace(/\+#/g, "#")
      .replace(/\(#\)/g, "#")
      .replace(/\(##\)/g, "#")
      .replace(/##/g, "#")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
})();
