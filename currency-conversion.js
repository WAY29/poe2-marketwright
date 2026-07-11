(function () {
  const GLOBAL_NAME = "Poe2MarketwrightCurrencyConversion";
  const CONTROL_CLASS = "poe2-marketwright-currency-conversion";
  const BUTTON_CLASS = "poe2-marketwright-currency-conversion-button";
  const VALUE_CLASS = "poe2-marketwright-currency-conversion-value";
  const VALUE_BREAK_CLASS = "poe2-marketwright-currency-conversion-break";
  const VALUE_PREFIX_CLASS = "poe2-marketwright-currency-conversion-prefix";
  const ICON_CLASS = "poe2-marketwright-currency-conversion-icon";
  const MESSAGE_SOURCE = "poe2-marketwright-currency-conversion";
  const CACHE_LIMIT = 5000;
  const CURRENCY_ORDER = ["exalted", "chaos", "divine"];
  const SUPPORTED_CURRENCIES = new Set(CURRENCY_ORDER);
  const CURRENCY_SYMBOLS = { exalted: "E", chaos: "C", divine: "D" };
  const CURRENCY_ICON_PATHS = {
    exalted: "images/currency/exalted-orb.png",
    chaos: "images/currency/chaos-orb.png",
    divine: "images/currency/divine-orb.png"
  };
  const FIXED_PRICE_TYPES = new Set(["~price", "~b/o"]);
  const DEFAULT_LABELS = {
    showExalted: "Show in Exalted Orbs",
    showChaos: "Show in Chaos Orbs",
    showDivine: "Show in Divine Orbs",
    currencyExalted: "Exalted Orb",
    currencyChaos: "Chaos Orb",
    currencyDivine: "Divine Orb",
    loading: "Loading...",
    unavailable: "Rate unavailable"
  };

  function createConversionTools() {
    const number = (value) => (typeof value === "number" ? value : Number(value));
    const firstValue = (value, camelCase, pascalCase) => value?.[camelCase] ?? value?.[pascalCase];

    const getLeagueFromTradeUrl = (url) => {
      const match = String(url || "").match(/\/(?:api\/)?trade2\/search\/(?:poe2\/)?([^/?#]+)/i);
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

    const resolveMessageLeague = (league, fallbackLeague) => {
      if (typeof league === "string" && league.trim()) {
        return league.trim();
      }
      return fallbackLeague || null;
    };

    const readListingPrice = (entry) => {
      const price = entry?.listing?.price;
      const amount = number(price?.amount);
      const currency = typeof price?.currency === "string" ? price.currency.trim().toLowerCase() : "";
      if (
        !FIXED_PRICE_TYPES.has(price?.type) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !SUPPORTED_CURRENCIES.has(currency)
      ) {
        return null;
      }
      return { amount, currency };
    };

    const createRateMap = (references) => {
      const rates = new Map();
      for (const reference of Array.isArray(references) ? references : []) {
        const currency = String(firstValue(reference, "apiId", "ApiId") || "").trim().toLowerCase();
        const rate = number(firstValue(reference, "relativePrice", "RelativePrice"));
        if (currency && Number.isFinite(rate) && rate > 0) {
          rates.set(currency, rate);
        }
      }
      return rates;
    };

    const getConversionTargets = (sourceCurrency) => {
      if (!SUPPORTED_CURRENCIES.has(sourceCurrency)) {
        return [];
      }
      return CURRENCY_ORDER.filter((currency) => currency !== sourceCurrency);
    };

    const getCurrencySymbol = (currency) => CURRENCY_SYMBOLS[currency] || "";

    const getCurrencyIconPath = (currency) => CURRENCY_ICON_PATHS[currency] || "";

    const convert = (amount, sourceRate, targetRate) => {
      const numericAmount = number(amount);
      const numericSourceRate = number(sourceRate);
      const numericTargetRate = number(targetRate);
      if (
        !Number.isFinite(numericAmount) ||
        !Number.isFinite(numericSourceRate) ||
        !Number.isFinite(numericTargetRate) ||
        numericAmount <= 0 ||
        numericSourceRate <= 0 ||
        numericTargetRate <= 0
      ) {
        return null;
      }
      return numericAmount * (numericSourceRate / numericTargetRate);
    };

    const formatAmount = (amount) => {
      const numericAmount = number(amount);
      if (!Number.isFinite(numericAmount)) {
        return "";
      }
      const decimals =
        Math.abs(numericAmount) >= 100 ? 1 : Math.abs(numericAmount) >= 1 ? 2 : Math.abs(numericAmount) >= 0.1 ? 3 : 4;
      return numericAmount.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    };

    return {
      getLeagueFromTradeUrl,
      resolveMessageLeague,
      readListingPrice,
      createRateMap,
      getConversionTargets,
      getCurrencySymbol,
      getCurrencyIconPath,
      convert,
      formatAmount
    };
  }

  function createCurrencyConversionFeature(options = {}) {
    const labels = { ...DEFAULT_LABELS, ...(options.labels || {}) };
    const tools = createConversionTools();
    const priceCache = new Map();
    const referenceRates = new Map();
    const referenceRateLoads = new Map();
    let enabled = options.enabled !== false;
    let started = false;
    let activeLeague = null;
    let activeSearchUrl = null;
    let observer = null;
    let rescanTimer = null;

    const setActiveLeague = (league, searchUrl = null) => {
      if (typeof league !== "string" || !league.trim()) {
        return null;
      }
      const normalizedLeague = league.trim();
      const normalizedSearchUrl = typeof searchUrl === "string" && searchUrl ? searchUrl : null;
      const changed = normalizedLeague !== activeLeague || normalizedSearchUrl !== activeSearchUrl;
      activeLeague = normalizedLeague;
      activeSearchUrl = normalizedSearchUrl;
      if (changed) {
        options.onLeagueChange?.(activeLeague, activeSearchUrl);
      }
      return activeLeague;
    };

    const syncLeagueFromPageUrl = () => {
      const searchUrl = typeof globalThis.location?.href === "string" ? globalThis.location.href : null;
      const league = tools.getLeagueFromTradeUrl(searchUrl);
      if (league) {
        return setActiveLeague(league, searchUrl);
      }
      const changed = activeLeague !== null || activeSearchUrl !== searchUrl;
      activeLeague = null;
      activeSearchUrl = searchUrl;
      if (changed) {
        options.onLeagueChange?.(null, activeSearchUrl);
      }
      return null;
    };

    const sendRuntimeMessage = (message) =>
      new Promise((resolve, reject) => {
        const runtimeApi = globalThis.chrome?.runtime;
        if (!runtimeApi?.sendMessage) {
          reject(new Error("Extension runtime unavailable"));
          return;
        }
        try {
          runtimeApi.sendMessage(message, (response) => {
            if (runtimeApi.lastError) {
              reject(new Error(runtimeApi.lastError.message));
              return;
            }
            if (!response?.ok) {
              const error = new Error(response?.error || "Poe2Scout request failed");
              error.details = response?.details || null;
              reject(error);
              return;
            }
            resolve(response);
          });
        } catch (error) {
          reject(error);
        }
      });

    const getReferenceRates = (league, force = false, requestContext = {}) => {
      if (force) {
        referenceRates.delete(league);
      }
      if (referenceRates.has(league)) {
        return Promise.resolve(referenceRates.get(league));
      }
      if (referenceRateLoads.has(league)) {
        return referenceRateLoads.get(league);
      }
      const request = sendRuntimeMessage({
        type: "fetch-poe2scout-reference-currencies",
        league,
        force,
        queryId: requestContext.queryId || null,
        searchUrl: requestContext.searchUrl || null,
        tradeUrl: requestContext.tradeUrl || null
      })
        .then((response) => {
          const rates = tools.createRateMap(response.rates);
          if (Array.from(SUPPORTED_CURRENCIES).some((currency) => !rates.has(currency))) {
            throw new Error("Incomplete Poe2Scout reference rates");
          }
          referenceRates.set(league, rates);
          return rates;
        })
        .finally(() => referenceRateLoads.delete(league));
      referenceRateLoads.set(league, request);
      return request;
    };

    const getCurrencyIconUrl = (currency) => {
      const path = tools.getCurrencyIconPath(currency);
      return path && globalThis.chrome?.runtime?.getURL ? globalThis.chrome.runtime.getURL(path) : path;
    };

    const findPriceAnchor = (row, price) => {
      const priceField = row.querySelector('[data-field="price"]');
      if (priceField) {
        return priceField;
      }
      const priceNodes = [
        ...row.querySelectorAll(".price-item, .listing-price"),
        ...row.querySelectorAll(".price")
      ];
      const matchingNode = priceNodes.find((node) => {
        const text = (node.textContent || "").replace(/\s+/g, " ");
        return text.includes(String(price.amount));
      });
      return matchingNode || priceNodes[0] || row.querySelector(".right .listing") || row.querySelector(".right");
    };

    const updateControl = (control, targetCurrency, state, value = "", title = "") => {
      const valueNode = control.__poe2MarketwrightValueNode || control.querySelector(`.${VALUE_CLASS}`);
      const valueBreak = control.__poe2MarketwrightValueBreak;
      const buttons = control.querySelectorAll(`.${BUTTON_CLASS}`);
      for (const button of buttons) {
        button.setAttribute("aria-pressed", String(state === "ready" && button.dataset.currency === targetCurrency));
      }
      control.dataset.state = state;
      if (valueNode) {
        valueNode.dataset.state = state;
        if (valueBreak) {
          valueBreak.style.display = value ? "" : "none";
        }
        valueNode.replaceChildren();
        if (value && typeof value === "object") {
          const prefix = document.createElement("span");
          prefix.className = VALUE_PREFIX_CLASS;
          prefix.textContent = "\u2248";
          const icon = document.createElement("img");
          icon.className = ICON_CLASS;
          icon.src = getCurrencyIconUrl(value.currency);
          icon.alt = value.name;
          icon.decoding = "async";
          valueNode.append(prefix, document.createTextNode(`${value.amount}\u00d7 `), icon, document.createTextNode(value.name));
        } else {
          valueNode.textContent = value;
        }
        valueNode.title = title;
      }
    };

    const alignValueWithOriginalPrice = (priceField, value) => {
      if (!priceField || !value) {
        return;
      }
      const firstPriceValue = priceField.querySelector("br")?.nextElementSibling;
      const priceLeft = firstPriceValue?.getBoundingClientRect?.().left;
      const valueLeft = value.getBoundingClientRect?.().left;
      const delta = priceLeft - valueLeft;
      if (Number.isFinite(delta)) {
        const currentMargin = Number.parseFloat(value.style.marginLeft) || 0;
        const marginLeft = `${Math.max(0, Math.round(currentMargin + delta))}px`;
        if (typeof value.style.setProperty === "function") {
          value.style.setProperty("margin-left", marginLeft, "important");
        } else {
          value.style.marginLeft = marginLeft;
        }
      }
    };

    const matchOriginalCurrencyIconSize = (priceField, value) => {
      const originalIcon = priceField?.querySelector(".currency-text.currency-image img");
      const convertedIcon = value?.querySelector(`.${ICON_CLASS}`);
      const rect = originalIcon?.getBoundingClientRect?.();
      if (!convertedIcon || !rect || rect.width <= 0 || rect.height <= 0) {
        return;
      }
      convertedIcon.style.width = `${Math.round(rect.width)}px`;
      convertedIcon.style.height = `${Math.round(rect.height)}px`;
    };

    const renderConversion = async (row, control, targetCurrency, force = false) => {
      const itemId = row.getAttribute("data-id");
      const record = itemId ? priceCache.get(itemId) : null;
      if (!record?.league) {
        updateControl(control, "", "error", labels.unavailable, labels.unavailable);
        return;
      }
      if (!force && control.dataset.state === "ready" && control.dataset.activeCurrency === targetCurrency) {
        control.dataset.activeCurrency = "";
        updateControl(control, "", "idle");
        return;
      }

      control.dataset.activeCurrency = targetCurrency;
      updateControl(control, "", "loading", labels.loading, labels.loading);
      alignValueWithOriginalPrice(control.__poe2MarketwrightPriceField, control.__poe2MarketwrightValueNode);
      try {
        const rates = await getReferenceRates(record.league, false, record.requestContext);
        const sourceRate = rates.get(record.price.currency);
        const converted = tools.convert(record.price.amount, sourceRate, rates.get(targetCurrency));
        if (converted === null) {
          throw new Error("Invalid converted amount");
        }
        const targetSymbol = tools.getCurrencySymbol(targetCurrency);
        const targetNames = {
          exalted: labels.currencyExalted,
          chaos: labels.currencyChaos,
          divine: labels.currencyDivine
        };
        const amount = tools.formatAmount(converted);
        const title = `Poe2Scout: ${record.price.amount} ${record.price.currency} = ${amount} ${targetSymbol}`;
        updateControl(control, targetCurrency, "ready", { amount, currency: targetCurrency, name: targetNames[targetCurrency] }, title);
        matchOriginalCurrencyIconSize(control.__poe2MarketwrightPriceField, control.__poe2MarketwrightValueNode);
        alignValueWithOriginalPrice(control.__poe2MarketwrightPriceField, control.__poe2MarketwrightValueNode);
      } catch (error) {
        console.error("[PoE2 Marketwright] currency conversion failed", {
          itemId,
          league: record.league,
          price: record.price,
          targetCurrency,
          requestContext: record.requestContext,
          error,
          details: error?.details || null
        });
        control.dataset.activeCurrency = "";
        updateControl(control, "", "error", labels.unavailable, labels.unavailable);
      }
    };

    const injectControls = (row) => {
      if (!enabled || !(row instanceof Element)) {
        return;
      }
      const itemId = row.getAttribute("data-id");
      const record = itemId ? priceCache.get(itemId) : null;
      if (!itemId || !record?.price || !record.league) {
        return;
      }

      const existing = row.querySelector(`.${CONTROL_CLASS}`);
      if (existing?.dataset.itemId === itemId) {
        return;
      }
      existing?.__poe2MarketwrightValueNode?.remove();
      existing?.remove();

      const anchor = findPriceAnchor(row, record.price);
      if (!anchor) {
        return;
      }
      const controls = document.createElement("span");
      controls.className = CONTROL_CLASS;
      controls.dataset.itemId = itemId;
      controls.dataset.state = "idle";
      controls.dataset.activeCurrency = "";

      const value = document.createElement("span");
      value.className = VALUE_CLASS;
      value.dataset.itemId = itemId;
      value.setAttribute("aria-live", "polite");
      const valueBreak = document.createElement("br");
      valueBreak.className = VALUE_BREAK_CLASS;
      valueBreak.style.display = "none";
      controls.__poe2MarketwrightValueNode = value;
      controls.__poe2MarketwrightValueBreak = valueBreak;
      controls.__poe2MarketwrightPriceField = anchor;

      const targetLabels = {
        exalted: labels.showExalted,
        chaos: labels.showChaos,
        divine: labels.showDivine
      };
      for (const currency of tools.getConversionTargets(record.price.currency)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = BUTTON_CLASS;
        button.dataset.currency = currency;
        button.textContent = tools.getCurrencySymbol(currency);
        button.title = targetLabels[currency];
        button.setAttribute("aria-label", targetLabels[currency]);
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void renderConversion(row, controls, currency);
        });
        controls.appendChild(button);
      }

      const priceLabel = anchor.querySelector(".price-label.buyout-price, .price-label");
      if (priceLabel) {
        priceLabel.insertAdjacentElement("afterend", controls);
      } else {
        anchor.appendChild(controls);
      }
      anchor.append(valueBreak, value);
    };

    const scanAndInject = (root = document) => {
      if (!enabled) {
        return;
      }
      if (root instanceof Element && root.matches("div.row[data-id]")) {
        injectControls(root);
      }
      root.querySelectorAll?.("div.row[data-id]").forEach(injectControls);
    };

    const removeControls = () => {
      document
        .querySelectorAll(`.${CONTROL_CLASS}, .${VALUE_CLASS}, .${VALUE_BREAK_CLASS}`)
        .forEach((control) => control.remove());
    };

    const storeResults = (data, league, requestContext = {}) => {
      if (!data || !Array.isArray(data.result)) {
        return;
      }
      for (const entry of data.result) {
        const price = tools.readListingPrice(entry);
        if (entry?.id && price) {
          priceCache.set(entry.id, { price, league: league || activeLeague, requestContext });
        }
      }
      if (priceCache.size > CACHE_LIMIT) {
        priceCache.clear();
      }
      scanAndInject();
    };

    const handleMessage = (event) => {
      if (event.source !== window || event.data?.source !== MESSAGE_SOURCE) {
        return;
      }
      const { type, league, body, queryId, searchUrl, tradeUrl } = event.data;
      const messageLeague = tools.resolveMessageLeague(league, activeLeague);
      if (messageLeague) {
        setActiveLeague(messageLeague, typeof searchUrl === "string" ? searchUrl : activeSearchUrl);
      }
      if (type === "fetch" && typeof body === "string") {
        try {
          storeResults(JSON.parse(body), messageLeague, {
            queryId: typeof queryId === "string" ? queryId : null,
            searchUrl: typeof searchUrl === "string" ? searchUrl : activeSearchUrl,
            tradeUrl: typeof tradeUrl === "string" ? tradeUrl : null
          });
        } catch (error) {
          console.debug("[PoE2 Marketwright] unable to parse trade prices", error);
        }
      }
    };

    const setEnabled = (nextEnabled) => {
      enabled = Boolean(nextEnabled);
      if (!started) {
        return;
      }
      if (enabled) {
        scanAndInject();
      } else {
        removeControls();
      }
    };

    const setLabels = (nextLabels) => {
      Object.assign(labels, nextLabels || {});
      document.querySelectorAll(`.${CONTROL_CLASS}`).forEach((control) => control.remove());
      scanAndInject();
    };

    const refresh = async () => {
      syncLeagueFromPageUrl();
      if (!activeLeague) {
        const error = new Error(`No active trade league from search URL: ${globalThis.location?.href || "unavailable"}`);
        error.searchUrl = globalThis.location?.href || null;
        throw error;
      }
      try {
        await getReferenceRates(activeLeague, true, { searchUrl: activeSearchUrl });
      } catch (error) {
        error.requestedLeague = activeLeague;
        error.searchUrl = activeSearchUrl;
        throw error;
      }
      const updates = [];
      for (const control of document.querySelectorAll(`.${CONTROL_CLASS}[data-active-currency]`)) {
        const targetCurrency = control.dataset.activeCurrency;
        const row = control.closest("div.row[data-id]");
        if (targetCurrency && row) {
          updates.push(renderConversion(row, control, targetCurrency, true));
        }
      }
      await Promise.all(updates);
    };

    const start = () => {
      if (started) {
        return;
      }
      started = true;
      window.addEventListener("message", handleMessage);
      syncLeagueFromPageUrl();
      scanAndInject();
      observer = new MutationObserver((mutations) => {
        if (!enabled) {
          return;
        }
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              scanAndInject(node);
            }
          });
        }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      rescanTimer = window.setInterval(() => {
        syncLeagueFromPageUrl();
        scanAndInject();
      }, 2000);
    };

    return {
      start,
      setEnabled,
      setLabels,
      storeResults,
      handleMessage,
      refresh,
      getActiveLeagueContext: () => ({ league: activeLeague, searchUrl: activeSearchUrl })
    };
  }

  globalThis[GLOBAL_NAME] = { createConversionTools, createCurrencyConversionFeature };
})();
