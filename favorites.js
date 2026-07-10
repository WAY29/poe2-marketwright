(function () {
  const GLOBAL_NAME = "Poe2MarketwrightFavorites";
  const BUTTON_CLASS = "poe2-marketwright-favorite-button";
  const PROCESSED_ATTR = "data-poe2-marketwright-favorite";
  const MESSAGE_SOURCE = "poe2-marketwright-favorites";
  const ENGLISH_ORIGINS = new Set(["https://pathofexile.com", "https://www.pathofexile.com"]);
  const SOURCE_SETS = ["explicitMods", "fracturedMods", "craftedMods", "desecratedMods"];
  const NUMBER_RE = /-?\d+(?:\.\d+)?/g;
  const RESET_DELAY_MS = 1200;
  const ITEM_DETAILS_WAIT_TIMEOUT_MS = 6000;
  const DEFAULT_LABELS = {
    add: "Save favorite",
    remove: "Remove favorite",
    loading: "Loading item...",
    saved: "Saved",
    removed: "Removed",
    error: "Unable to save"
  };

  function createFavoriteTools() {
    const createFavoriteError = (code, message, details = {}) => {
      const error = new Error(message);
      error.code = code;
      error.details = details;
      return error;
    };

    const stripTradeMarkup = (value) =>
      String(value || "")
        .replace(/\[[^\]|]+\|([^\]]+)\]/g, "$1")
        .replace(/\s+/g, " ")
        .trim();

    const normalizeNumber = (value) => {
      const rounded = Math.round(Number(value) * 1000000) / 1000000;
      return Object.is(rounded, -0) ? 0 : rounded;
    };

    const getStatId = (hash) => {
      const value = String(hash || "").trim();
      const match = value.match(/^stat\.(explicit|fractured|crafted|desecrated)\.(.+)$/i);
      return match ? `${match[1].toLowerCase()}.${match[2]}` : null;
    };

    const getStatValue = (description) => {
      const values = (stripTradeMarkup(description).match(NUMBER_RE) || []).map(Number).filter(Number.isFinite);
      if (!values.length) {
        return { value: null, approximate: false };
      }
      if (values.length === 1) {
        return { value: normalizeNumber(values[0]), approximate: false };
      }
      return {
        value: normalizeNumber(values.reduce((total, value) => total + value, 0) / values.length),
        approximate: true
      };
    };

    const createSignature = (favorite) =>
      JSON.stringify({
        league: favorite.league,
        rarity: favorite.rarity,
        baseName: favorite.baseName,
        category: favorite.category,
        stats: favorite.stats
      });

    const createFavoriteRecord = (item, league, itemClassification, createdAt = Date.now()) => {
      const normalizedLeague = String(league || "").trim();
      const baseName = String(itemClassification?.baseName || item?.typeLine || item?.baseType || "").trim();
      const category = String(itemClassification?.category || "").trim();
      const itemType = String(itemClassification?.itemType || "").trim();
      const rarity = String(item?.rarity || "").trim().toLowerCase();
      const originalName = String(item?.name || "").trim();
      if (!normalizedLeague || !baseName || !category || !rarity) {
        throw createFavoriteError(
          "missing_item_context",
          "Favorite requires a league, base name, item category, and rarity",
          { league: normalizedLeague, baseName, category, rarity }
        );
      }

      const groupedStats = new Map();
      const specialStatTotals = new Map();
      const mods = [];
      let approximate = false;

      for (const sourceKey of SOURCE_SETS) {
        const sourceMods = item?.[sourceKey];
        if (!Array.isArray(sourceMods)) {
          continue;
        }
        for (const mod of sourceMods) {
          const id = getStatId(mod?.hash);
          if (!id) {
            // The trade API mixes other special-source modifiers into explicitMods. They are outside this feature's scope.
            continue;
          }
          const text = stripTradeMarkup(mod?.description);
          if (!text) {
            throw createFavoriteError(
              "missing_modifier_text",
              "Favorite contains a supported modifier without display text",
              { id, hash: mod?.hash || null }
            );
          }

          const next = getStatValue(text);
          mods.push({ text });
          const separatorIndex = id.indexOf(".");
          const source = id.slice(0, separatorIndex);
          const baseStatId = id.slice(separatorIndex + 1);
          if (source !== "explicit" && next.value != null) {
            const total = specialStatTotals.get(baseStatId) || 0;
            specialStatTotals.set(baseStatId, normalizeNumber(total + next.value));
          }
          const current = groupedStats.get(id);
          if (!current) {
            groupedStats.set(id, { id, value: next.value });
            approximate ||= next.approximate;
            continue;
          }

          if (current.value != null && next.value != null) {
            current.value = normalizeNumber(current.value + next.value);
            approximate = true;
          }
          // A repeated presence-only stat is already fully represented by one condition.
        }
      }

      // Trade's ordinary stat filter matches the total that includes source-specific variants.
      for (const [baseStatId, specialTotal] of specialStatTotals) {
        const normalStat = groupedStats.get(`explicit.${baseStatId}`);
        if (normalStat?.value != null) {
          normalStat.value = normalizeNumber(normalStat.value + specialTotal);
        }
      }

      if (!groupedStats.size) {
        throw createFavoriteError(
          "no_supported_modifiers",
          "Favorite requires at least one explicit, fractured, crafted, or desecrated trade modifier"
        );
      }

      const stats = Array.from(groupedStats.values()).map((stat) => {
        if (stat.value == null) {
          return { id: stat.id };
        }
        return { id: stat.id, value: { min: stat.value, max: stat.value } };
      });
      const favorite = {
        version: 1,
        league: normalizedLeague,
        displayName: originalName || baseName,
        originalName,
        baseName,
        category,
        itemType,
        rarity,
        stats,
        mods,
        approximate,
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now()
      };
      favorite.signature = createSignature(favorite);
      return favorite;
    };

    const createTradeSearchPayload = (favorite) => {
      const baseName = String(favorite?.baseName || "").trim();
      const category = String(favorite?.category || "").trim();
      if (!baseName || !category) {
        throw createFavoriteError(
          "missing_favorite_item_classification",
          "Favorite requires a base name and item category",
          { baseName, category }
        );
      }
      const filters = (favorite?.stats || []).map((stat) => {
        const filter = { id: stat.id, disabled: false };
        if (stat.value) {
          filter.value = { min: stat.value.min, max: stat.value.max };
        }
        return filter;
      });
      const miscFilters = {};
      if ((favorite?.stats || []).some((stat) => String(stat?.id || "").startsWith("fractured."))) {
        miscFilters.fractured_item = { option: "true" };
      }
      if ((favorite?.stats || []).some((stat) => String(stat?.id || "").startsWith("desecrated."))) {
        miscFilters.desecrated = { option: "true" };
      }
      const query = {
        status: { option: "available" },
        type: baseName,
        stats: [{ type: "and", filters }],
        filters: {
          type_filters: {
            filters: {
              rarity: { option: favorite.rarity },
              category: { option: category }
            }
          },
          ...(Object.keys(miscFilters).length ? { misc_filters: { filters: miscFilters } } : {})
        }
      };
      return { query, sort: { price: "asc" } };
    };

    const getLeagueFromTradeUrl = (url) => {
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

    return { createFavoriteRecord, createTradeSearchPayload, getLeagueFromTradeUrl };
  }

  function createFavoriteFeature(options = {}) {
    const labels = { ...DEFAULT_LABELS, ...(options.labels || {}) };
    const tools = createFavoriteTools();
    const itemCache = new Map();
    const itemSourceUrls = new Map();
    const inFlightEnglishFetches = new Map();
    let favorites = Array.isArray(options.favorites) ? options.favorites.slice() : [];
    let enabled = options.enabled !== false;
    let started = false;
    let observer = null;
    let rescanTimer = null;

    const bookmarkIcon = (filled) =>
      filled
        ? '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 1.75h8a1 1 0 0 1 1 1v11.1l-5-2.85-5 2.85V2.75a1 1 0 0 1 1-1z"></path></svg>'
        : '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 1.75h8a1 1 0 0 1 1 1v11.1l-5-2.85-5 2.85V2.75a1 1 0 0 1 1-1zm0 1.5v8.01L8 8.98l4 2.28V3.25H4z"></path></svg>';

    const summarizeItem = (item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const modifiers = {};
      for (const sourceKey of SOURCE_SETS) {
        const sourceMods = Array.isArray(item[sourceKey]) ? item[sourceKey] : [];
        modifiers[sourceKey] = sourceMods.map((mod) => mod?.hash || null);
      }
      return {
        rarity: item.rarity || null,
        name: item.name || null,
        typeLine: item.typeLine || item.baseType || null,
        modifiers
      };
    };

    const getFavoriteSignature = (item) => {
      try {
        const league = options.getLeague?.();
        const classification = options.getItemClassification?.(item);
        return tools.createFavoriteRecord(item, league, classification).signature;
      } catch (error) {
        return null;
      }
    };

    const isFavorite = (item) => {
      const signature = getFavoriteSignature(item);
      return Boolean(signature && favorites.some((favorite) => favorite?.signature === signature));
    };

    const setButtonStatus = (button, status, item = null, error = null) => {
      const active = item ? isFavorite(item) : button.dataset.favorite === "true";
      button.dataset.status = status;
      button.dataset.favorite = String(active);
      button.disabled = status === "loading";
      button.innerHTML = bookmarkIcon(active);
      const label =
        status === "loading"
          ? labels.loading
          : status === "error"
            ? labels.error
            : active
              ? labels.remove
              : labels.add;
      const detail = status === "error" && error?.message ? `: ${error.message}` : "";
      button.title = `${label}${detail}`;
      button.setAttribute("aria-label", button.title);
    };

    const buildEnglishFetchUrl = (sourceUrl) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(sourceUrl, window.location.href);
      } catch (error) {
        return null;
      }
      const outUrl = new URL(parsedUrl.pathname, "https://pathofexile.com");
      parsedUrl.searchParams.forEach((value, key) => outUrl.searchParams.set(key, value));
      return outUrl.toString();
    };

    const storeResults = (data, sourceUrl = null, cacheItems = true) => {
      if (!data || !Array.isArray(data.result)) {
        return;
      }
      for (const entry of data.result) {
        if (!entry?.id) {
          continue;
        }
        if (sourceUrl) {
          itemSourceUrls.set(entry.id, sourceUrl);
        }
        if (cacheItems && entry.item) {
          itemCache.set(entry.id, entry.item);
        }
      }
      console.debug("[PoE2 Marketwright] favorite item data cached", {
        sourceUrl,
        cacheItems,
        resultCount: data.result.length
      });
      refreshButtons();
    };

    const fetchEnglishData = (sourceUrl) => {
      const englishUrl = buildEnglishFetchUrl(sourceUrl);
      const runtimeApi = globalThis.chrome?.runtime;
      if (!englishUrl || !runtimeApi?.sendMessage) {
        return Promise.reject(new Error("English item data is unavailable"));
      }
      if (inFlightEnglishFetches.has(englishUrl)) {
        return inFlightEnglishFetches.get(englishUrl);
      }
      console.debug("[PoE2 Marketwright] loading English favorite item data", { sourceUrl, englishUrl });
      const request = new Promise((resolve, reject) => {
        try {
          runtimeApi.sendMessage({ type: "fetch-english", url: englishUrl }, (response) => {
            if (globalThis.chrome?.runtime?.lastError || !response?.ok || typeof response.body !== "string") {
              const error = new Error(
                response?.error || globalThis.chrome?.runtime?.lastError?.message || "Unable to load English item data"
              );
              error.code = "english_item_fetch_failed";
              error.details = { sourceUrl, englishUrl, response: response || null };
              reject(error);
              return;
            }
            try {
              storeResults(JSON.parse(response.body), englishUrl);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        } catch (error) {
          reject(error);
        }
      });
      inFlightEnglishFetches.set(englishUrl, request);
      void request.finally(() => inFlightEnglishFetches.delete(englishUrl)).catch(() => {});
      return request;
    };

    const waitForItemDetails = (delayMs) =>
      new Promise((resolve) => window.setTimeout(resolve, delayMs));

    const ensureItem = async (itemId) => {
      const deadline = Date.now() + ITEM_DETAILS_WAIT_TIMEOUT_MS;
      let lastFetchError = null;
      while (Date.now() < deadline) {
        const cached = itemCache.get(itemId);
        if (cached) {
          return cached;
        }
        const sourceUrl = itemSourceUrls.get(itemId);
        if (sourceUrl) {
          try {
            await fetchEnglishData(sourceUrl);
          } catch (error) {
            lastFetchError = error;
          }
          await waitForItemDetails(100);
          continue;
        }
        await waitForItemDetails(100);
      }
      const error = new Error("Timed out waiting for item details");
      error.code = "item_details_timeout";
      error.details = {
        itemId,
        waitTimeoutMs: ITEM_DETAILS_WAIT_TIMEOUT_MS,
        sourceUrl: itemSourceUrls.get(itemId) || null,
        lastFetchError: lastFetchError?.message || null
      };
      throw error;
    };

    const updateButton = (button) => {
      const row = button.closest?.("div.row[data-id]");
      const itemId = row?.getAttribute?.("data-id");
      const item = itemId ? itemCache.get(itemId) : null;
      setButtonStatus(button, "ready", item);
    };

    const refreshButtons = () => {
      if (typeof document === "undefined") {
        return;
      }
      document.querySelectorAll(`.${BUTTON_CLASS}`).forEach(updateButton);
    };

    const handleToggle = async (row, button) => {
      const itemId = row.getAttribute("data-id");
      if (!itemId) {
        setButtonStatus(button, "error");
        return;
      }
      setButtonStatus(button, "loading");
      try {
        const item = await ensureItem(itemId);
        const league = options.getLeague?.();
        console.debug("[PoE2 Marketwright] favorite toggle requested", {
          itemId,
          league: league || null,
          sourceUrl: itemSourceUrls.get(itemId) || null,
          item: summarizeItem(item)
        });
        const classification = options.getItemClassification?.(item);
        const favorite = tools.createFavoriteRecord(item, league, classification);
        await options.onToggleFavorite?.(favorite);
        favorites = Array.isArray(options.getFavorites?.()) ? options.getFavorites().slice() : favorites;
        setButtonStatus(button, "ready", item);
      } catch (error) {
        console.error("[PoE2 Marketwright] favorite toggle failed", {
          itemId,
          league: options.getLeague?.() || null,
          sourceUrl: itemSourceUrls.get(itemId) || null,
          cachedItem: summarizeItem(itemCache.get(itemId)),
          error,
          code: error?.code || null,
          details: error?.details || null,
          message: error?.message || String(error)
        });
        setButtonStatus(button, "error", itemCache.get(itemId) || null, error);
        window.setTimeout(() => updateButton(button), RESET_DELAY_MS);
      }
    };

    const injectButton = (row) => {
      if (!enabled || !(row instanceof Element) || row.querySelector(`.${BUTTON_CLASS}`)) {
        return;
      }
      const left = row.querySelector(".left");
      if (!left) {
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = BUTTON_CLASS;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        void handleToggle(row, button);
      });

      const pobButton = row.querySelector(".poe2-marketwright-pob-copy-button");
      if (pobButton?.parentNode) {
        pobButton.insertAdjacentElement("afterend", button);
      } else {
        left.insertBefore(button, left.firstChild);
      }
      row.setAttribute(PROCESSED_ATTR, "true");
      updateButton(button);
    };

    const scanAndInject = (root = document) => {
      if (!enabled || typeof document === "undefined") {
        return;
      }
      if (root instanceof Element && root.matches("div.row[data-id]")) {
        injectButton(root);
      }
      root.querySelectorAll?.("div.row[data-id]").forEach(injectButton);
    };

    const removeButtons = () => {
      if (typeof document === "undefined") {
        return;
      }
      document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((button) => button.remove());
      document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((row) => row.removeAttribute(PROCESSED_ATTR));
    };

    const handleApiMessage = (url, bodyText) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(url, window.location.href);
      } catch (error) {
        return;
      }

      if (bodyText) {
        try {
          const parsed = JSON.parse(bodyText);
          const isEnglish = ENGLISH_ORIGINS.has(parsedUrl.origin);
          storeResults(parsed, parsedUrl.toString(), isEnglish);
          if (isEnglish) {
            return;
          }
        } catch (error) {
          console.warn("[PoE2 Marketwright] favorite item response could not be parsed", {
            url: parsedUrl.toString(),
            error
          });
          return;
        }
      }
      fetchEnglishData(parsedUrl.toString()).catch((error) => {
        console.warn("[PoE2 Marketwright] English favorite item request failed", {
          url: parsedUrl.toString(),
          error,
          message: error?.message || String(error)
        });
      });
    };

    const handleMessage = (event) => {
      if (event.source !== window || event.data?.source !== MESSAGE_SOURCE || typeof event.data.url !== "string") {
        return;
      }
      handleApiMessage(event.data.url, typeof event.data.body === "string" ? event.data.body : null);
    };

    const setFavorites = (nextFavorites) => {
      favorites = Array.isArray(nextFavorites) ? nextFavorites.slice() : [];
      refreshButtons();
    };

    const setEnabled = (nextEnabled) => {
      enabled = Boolean(nextEnabled);
      if (!started) {
        return;
      }
      if (enabled) {
        scanAndInject();
      } else {
        removeButtons();
      }
    };

    const start = () => {
      if (started || typeof window === "undefined" || typeof document === "undefined") {
        return;
      }
      started = true;
      window.addEventListener("message", handleMessage);
      scanAndInject();
      observer = new MutationObserver((mutations) => {
        if (!enabled) {
          return;
        }
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              scanAndInject(node);
            }
          });
        }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      rescanTimer = window.setInterval(scanAndInject, 2000);
    };

    return { start, setEnabled, setFavorites, handleApiMessage, storeResults };
  }

  globalThis[GLOBAL_NAME] = { createFavoriteTools, createFavoriteFeature };
})();
