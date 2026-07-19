(function () {
  const ENGLISH_ORIGINS = new Set(["https://pathofexile.com", "https://www.pathofexile.com"]);
  const POE2SCOUT_API_ORIGIN = "https://api.poe2scout.com";
  const POE2SCOUT_CACHE_TTL_MS = 60 * 1000;
  const FAVORITES_PANEL_SESSION_PREFIX = "poe2-marketwright:favorites-panel:";
  const poe2ScoutCache = new Map();

  const normalizeFavoritesPanelSessionId = (value) => {
    if (typeof value !== "string") {
      return null;
    }
    const sessionId = value.trim();
    return /^[a-zA-Z0-9_-]{8,128}$/.test(sessionId) ? sessionId : null;
  };

  const getFavoritesPanelSessionKey = (sessionId) => `${FAVORITES_PANEL_SESSION_PREFIX}${sessionId}`;

  const getFavoritesPanelPath = (sessionId) =>
    `favorites-panel.html?session=${encodeURIComponent(sessionId)}`;

  const configureFavoritesPanel = (tabId, sessionId) =>
    chrome.sidePanel?.setOptions?.({
      tabId,
      enabled: true,
      path: getFavoritesPanelPath(sessionId)
    }) || Promise.resolve();

  const isExtensionSender = (sender) => sender?.id === chrome.runtime.id;
  const isTradePageUrl = (url) =>
    typeof url === "string" && /^https:\/\/(?:[^/]+\.)?pathofexile\.com\/trade2(?:[/?#]|$)/.test(url);

  const normalizeEnglishUrl = (input) => {
    let url;
    try {
      url = new URL(input);
    } catch (error) {
      return null;
    }
    if (!url.pathname.includes("/api/trade2/fetch/")) {
      return null;
    }
    if (!ENGLISH_ORIGINS.has(url.origin)) {
      url = new URL(url.pathname + url.search, "https://pathofexile.com");
    }
    return url.toString();
  };

  const normalizeLeague = (value) => {
    if (typeof value !== "string") {
      return null;
    }
    const league = value.trim();
    return league && league.length <= 120 && !/[\u0000-\u001f]/.test(league) ? league : null;
  };

  const normalizeDebugValue = (value) =>
    typeof value === "string" && value.length <= 4096 ? value : null;

  const getResponseErrorDetail = async (response) => {
    if (typeof response?.text !== "function") {
      return "";
    }
    try {
      const detail = (await response.text()).replace(/\s+/g, " ").trim();
      return detail ? `: ${detail.slice(0, 160)}` : "";
    } catch (error) {
      return "";
    }
  };

  const createPoe2ScoutError = (message, details) => {
    const error = new Error(message);
    error.details = details;
    return error;
  };

  const buildPoe2ScoutReferenceUrl = (league) =>
    `${POE2SCOUT_API_ORIGIN}/poe2/Leagues/${encodeURIComponent(league)}/ReferenceCurrencies`;

  const getPoe2ScoutReferenceCurrencies = async (league, force = false, requestContext = {}) => {
    const cacheKey = `reference:${league}`;
    const cached = poe2ScoutCache.get(cacheKey);
    if (!force && cached && Date.now() - cached.createdAt < POE2SCOUT_CACHE_TTL_MS) {
      return cached.rates;
    }

    const requestUrl = buildPoe2ScoutReferenceUrl(league);
    const response = await fetch(requestUrl, { credentials: "omit" });
    if (!response.ok) {
      const detail = await getResponseErrorDetail(response);
      const details = {
        requestedLeague: league,
        force,
        requestUrl,
        responseUrl: response.url || requestUrl,
        status: response.status,
        statusText: response.statusText || "",
        responseBody: detail,
        queryId: normalizeDebugValue(requestContext.queryId),
        searchUrl: normalizeDebugValue(requestContext.searchUrl),
        tradeUrl: normalizeDebugValue(requestContext.tradeUrl)
      };
      console.error("[PoE2 Marketwright] Poe2Scout reference request failed", details);
      throw createPoe2ScoutError(
        `Poe2Scout request failed for "${league}": ${response.status}${detail}`,
        details
      );
    }
    const rates = await response.json();
    if (!Array.isArray(rates)) {
      throw new Error("Poe2Scout returned invalid reference rates");
    }
    poe2ScoutCache.set(cacheKey, { createdAt: Date.now(), rates });
    return rates;
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) {
      return;
    }

    if (message.type === "favorites-panel-register") {
      const sessionId = normalizeFavoritesPanelSessionId(message.sessionId);
      const tabId = sender?.tab?.id;
      if (!isExtensionSender(sender) || !sessionId || !Number.isInteger(tabId)) {
        sendResponse({ ok: false, error: "invalid_panel_registration" });
        return;
      }
      Promise.all([
        chrome.storage.session.set({ [getFavoritesPanelSessionKey(sessionId)]: { tabId } }),
        configureFavoritesPanel(tabId, sessionId)
      ])
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
      return true;
    }

    if (message.type === "favorites-panel-open" || message.type === "favorites-panel-close") {
      const sessionId = normalizeFavoritesPanelSessionId(message.sessionId);
      const tabId = sender?.tab?.id;
      if (!isExtensionSender(sender) || !sessionId || !Number.isInteger(tabId)) {
        sendResponse({ ok: false, error: "invalid_panel_request" });
        return;
      }
      if (message.type === "favorites-panel-open") {
        Promise.resolve(chrome.sidePanel?.open?.({ tabId }))
          .then(() => sendResponse({ ok: true }))
          .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
        return true;
      }
      chrome.storage.session
        .get(getFavoritesPanelSessionKey(sessionId))
        .then((stored) => {
          if (stored?.[getFavoritesPanelSessionKey(sessionId)]?.tabId !== tabId) {
            return { ok: false, error: "unknown_panel_session" };
          }
          return Promise.resolve(chrome.sidePanel?.close?.({ tabId })).then(() => ({ ok: true }));
        })
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
      return true;
    }

    if (message.type === "favorites-panel-request") {
      const sessionId = normalizeFavoritesPanelSessionId(message.sessionId);
      const command = typeof message.command === "string" ? message.command : "";
      if (!isExtensionSender(sender) || !sessionId || !command) {
        sendResponse({ ok: false, error: "invalid_panel_request" });
        return;
      }
      chrome.storage.session
        .get(getFavoritesPanelSessionKey(sessionId))
        .then((stored) => {
          const tabId = stored?.[getFavoritesPanelSessionKey(sessionId)]?.tabId;
          if (!Number.isInteger(tabId)) {
            sendResponse({ ok: false, error: "unknown_panel_session" });
            return null;
          }
          return chrome.tabs.sendMessage(tabId, {
            type: "favorites-panel-command",
            sessionId,
            command,
            payload: message.payload
          });
        })
        .then((response) => {
          sendResponse(response || { ok: false, error: "panel_tab_unavailable" });
        })
        .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
      return true;
    }

    if (message.type === "favorites-panel-state-update") {
      const sessionId = normalizeFavoritesPanelSessionId(message.sessionId);
      if (!isExtensionSender(sender) || !sessionId || !sender?.tab || !message.state) {
        return;
      }
      chrome.storage.session
        .get(getFavoritesPanelSessionKey(sessionId))
        .then((stored) => {
          const tabId = stored?.[getFavoritesPanelSessionKey(sessionId)]?.tabId;
          if (tabId !== sender.tab.id) {
            return null;
          }
          return chrome.runtime.sendMessage({
            type: "favorites-panel-state",
            sessionId,
            state: message.state
          });
        })
        .catch(() => {});
      return;
    }

    if (message.type === "fetch-english") {
      const englishUrl = normalizeEnglishUrl(message.url);
      if (!englishUrl) {
        sendResponse({ ok: false, error: "invalid_url" });
        return;
      }

      fetch(englishUrl, { credentials: "include" })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status}`);
          }
          return response.text();
        })
        .then((body) => sendResponse({ ok: true, body }))
        .catch((error) => {
          console.error("[PoE2 Marketwright] English item fetch failed", {
            url: englishUrl,
            error: error?.message || String(error)
          });
          sendResponse({ ok: false, error: String(error) });
        });
      return true;
    }

    if (message.type === "fetch-poe2scout-reference-currencies") {
      const league = normalizeLeague(message.league);
      if (!league) {
        sendResponse({ ok: false, error: "invalid_league" });
        return;
      }

      const requestContext = {
        queryId: message.queryId,
        searchUrl: message.searchUrl,
        tradeUrl: message.tradeUrl
      };
      getPoe2ScoutReferenceCurrencies(league, Boolean(message.force), requestContext)
        .then((rates) => sendResponse({ ok: true, rates }))
        .catch((error) => {
          const details =
            error.details || {
              requestedLeague: league,
              force: Boolean(message.force),
              requestUrl: buildPoe2ScoutReferenceUrl(league),
              responseUrl: null,
              status: null,
              statusText: "",
              responseBody: "",
              queryId: normalizeDebugValue(requestContext.queryId),
              searchUrl: normalizeDebugValue(requestContext.searchUrl),
              tradeUrl: normalizeDebugValue(requestContext.tradeUrl),
              transportError: error.message || String(error)
            };
          if (!error.details) {
            console.error("[PoE2 Marketwright] Poe2Scout reference request failed before a response", details);
          }
          sendResponse({ ok: false, error: error.message || String(error), details });
        });
      return true;
    }
  });

  chrome.runtime.onInstalled?.addListener(() => {
    chrome.sidePanel?.setOptions?.({ enabled: false }).catch(() => {});
  });

  chrome.tabs?.onUpdated?.addListener((tabId, changeInfo, tab) => {
    if ((changeInfo.status === "loading" || changeInfo.url) && !isTradePageUrl(changeInfo.url || tab?.url)) {
      chrome.sidePanel?.setOptions?.({ tabId, enabled: false }).catch(() => {});
    }
  });

  chrome.tabs?.onActivated?.addListener(({ tabId }) => {
    chrome.tabs.get(tabId).then((tab) => {
      if (!isTradePageUrl(tab?.url)) {
        return chrome.sidePanel?.setOptions?.({ tabId, enabled: false });
      }
    }).catch(() => {});
  });

  chrome.sidePanel?.onClosed?.addListener(({ tabId }) => {
    if (Number.isInteger(tabId)) {
      chrome.tabs.sendMessage(tabId, { type: "favorites-panel-closed" }).catch(() => {});
    }
  });
})();
