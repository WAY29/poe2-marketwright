(function () {
  const ENGLISH_ORIGINS = new Set(["https://pathofexile.com", "https://www.pathofexile.com"]);
  const POE2SCOUT_API_ORIGIN = "https://api.poe2scout.com";
  const POE2SCOUT_CACHE_TTL_MS = 60 * 1000;
  const poe2ScoutCache = new Map();

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
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
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
})();
