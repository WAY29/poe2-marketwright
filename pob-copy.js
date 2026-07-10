(function () {
  const GLOBAL_NAME = "Poe2MarketwrightPobCopy";
  const BUTTON_CLASS = "poe2-marketwright-pob-copy-button";
  const PROCESSED_ATTR = "data-poe2-marketwright-pob-copy";
  const RESET_DELAY_MS = 1500;
  const MESSAGE_SOURCE = "poe2-marketwright-pob-copy";
  const ENGLISH_ORIGINS = new Set(["https://pathofexile.com", "https://www.pathofexile.com"]);
  const DEFAULT_LABELS = {
    ready: "PoB Copy",
    loading: "Loading...",
    ok: "Copied!",
    error: "Failed"
  };

  function createItemTextBuilder(sourceSets) {
    const normalizeLine = (line) => (line ? line.replace(/\s+/g, " ").trim() : "");
    const countMods = (mods) => (Array.isArray(mods) ? mods.length : 0);

    const getPropertyValue = (item, expectedName) => {
      if (!item || !Array.isArray(item.properties)) {
        return null;
      }
      for (const property of item.properties) {
        if (!property || typeof property.name !== "string") {
          continue;
        }
        const name = property.name.replace(/\s+/g, "").toLowerCase();
        if (name !== expectedName) {
          continue;
        }
        const value = property.values?.[0]?.[0];
        if (typeof value === "string") {
          return value;
        }
      }
      return null;
    };

    const extractModText = (mod) => {
      if (typeof mod === "string") {
        return mod;
      }
      if (mod && typeof mod === "object" && typeof mod.description === "string") {
        return mod.description.replace(/\[[^\|]+\|([^\]]+)\]/g, "$1");
      }
      return "";
    };

    const buildModLines = (item) => {
      if (!item) {
        return [];
      }
      const lines = [];
      for (const source of sourceSets) {
        const mods = item[source.key];
        if (!Array.isArray(mods)) {
          continue;
        }
        for (const mod of mods) {
          let line = normalizeLine(extractModText(mod));
          if (!line || line.includes("#")) {
            continue;
          }
          if (source.tag) {
            line = `{${source.tag}}${line}`;
          }
          lines.push(line);
        }
      }
      return lines;
    };

    const buildPobFullText = (item) => {
      if (!item) {
        return "";
      }
      const rarity =
        typeof item.rarity === "string" && item.rarity.trim() ? item.rarity.trim().toUpperCase() : "RARE";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const typeLine =
        typeof item.typeLine === "string"
          ? item.typeLine.trim()
          : typeof item.baseType === "string"
            ? item.baseType.trim()
            : "";
      const headerLines = [`Rarity: ${rarity}`];

      if (rarity === "UNIQUE" || rarity === "RELIC" || rarity === "RARE") {
        headerLines.push(name || "Custom Item");
        headerLines.push(typeLine || name || "Unknown Base");
      } else {
        let displayName = typeLine || name || "Custom Item";
        if (name && typeLine && !name.includes(typeLine)) {
          displayName = `${name} ${typeLine}`.trim();
        }
        headerLines.push(displayName);
      }

      const implicitCount =
        countMods(item.runeMods) + countMods(item.implicitMods) + countMods(item.enchantMods);
      const qualityText = getPropertyValue(item, "[quality]");
      const quality = qualityText?.match(/-?\d+/)?.[0];
      if (quality !== undefined) {
        headerLines.push(`Quality: ${quality}`);
      }
      const radius = getPropertyValue(item, "radius");
      if (radius) {
        headerLines.push(`Radius: ${radius.trim()}`);
      }
      headerLines.push(`Implicits: ${implicitCount}`);
      if (item.corrupted) {
        headerLines.push("Corrupted");
      }
      if (item.mirrored) {
        headerLines.push("Mirrored");
      }

      return [...headerLines, ...buildModLines(item)].join("\n");
    };

    return { buildPobFullText };
  }

  function createPobCopyFeature(options = {}) {
    const labels = { ...DEFAULT_LABELS, ...(options.labels || {}) };
    const sourceSets = options.sourceSets || [
      { key: "runeMods", tag: "rune" },
      { key: "enchantMods", tag: "enchant" },
      { key: "implicitMods", tag: "implicit" },
      { key: "fracturedMods", tag: "fractured" },
      { key: "explicitMods", tag: null },
      { key: "desecratedMods", tag: "desecrated" }
    ];
    const itemCache = new Map();
    const inFlightEnglishFetches = new Set();
    const textBuilder = createItemTextBuilder(sourceSets);
    let enabled = options.enabled !== false;
    let started = false;
    let observer = null;
    let rescanTimer = null;

    const storeResults = (data) => {
      if (!data || !Array.isArray(data.result)) {
        return;
      }
      for (const entry of data.result) {
        if (entry?.id && entry.item) {
          itemCache.set(entry.id, entry.item);
        }
      }
    };

    const setButtonStatus = (button, status) => {
      button.dataset.status = status;
      button.textContent = labels[status] || labels.ready;
    };

    const copyToClipboard = async (text) => {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      if (!document.execCommand("copy")) {
        textarea.remove();
        throw new Error("Clipboard copy failed");
      }
      textarea.remove();
    };

    const handleCopy = async (row, button) => {
      const itemId = row.getAttribute("data-id");
      if (!itemId) {
        setButtonStatus(button, "error");
        return;
      }
      if (button._pobResetTimer) {
        clearTimeout(button._pobResetTimer);
      }

      setButtonStatus(button, "loading");
      button.disabled = true;
      try {
        const item = itemCache.get(itemId);
        if (!item) {
          throw new Error("Item not in cache");
        }
        const text = textBuilder.buildPobFullText(item);
        if (!text) {
          throw new Error("No valid item text");
        }
        await copyToClipboard(text);
        setButtonStatus(button, "ok");
      } catch (error) {
        console.debug("[PoE2 Marketwright] PoB copy failed", error);
        setButtonStatus(button, "error");
      } finally {
        button._pobResetTimer = window.setTimeout(() => {
          setButtonStatus(button, "ready");
          button.disabled = false;
          button._pobResetTimer = null;
        }, RESET_DELAY_MS);
      }
    };

    const hasButton = (row) => row.querySelector(`.${BUTTON_CLASS}`);

    const injectButton = (row) => {
      if (!enabled || !(row instanceof Element)) {
        return;
      }
      const left = row.querySelector(".left");
      if (!left || hasButton(row)) {
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = BUTTON_CLASS;
      button.title = labels.ready;
      setButtonStatus(button, "ready");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        void handleCopy(row, button);
      });

      const verifiedStatus = row.querySelector(".verifiedStatus");
      if (verifiedStatus?.parentNode) {
        button.classList.add(`${BUTTON_CLASS}--below-verified`);
        verifiedStatus.insertAdjacentElement("afterend", button);
      } else {
        left.insertBefore(button, left.firstChild);
      }
      row.setAttribute(PROCESSED_ATTR, "true");
    };

    const scanAndInject = (root = document) => {
      if (!enabled) {
        return;
      }
      if (root instanceof Element && root.matches("div.row[data-id]")) {
        injectButton(root);
      }
      root.querySelectorAll?.("div.row[data-id]").forEach(injectButton);
    };

    const removeButtons = () => {
      document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((button) => button.remove());
      document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((row) => row.removeAttribute(PROCESSED_ATTR));
    };

    const getFallbackQueryId = () => {
      const url = new URL(window.location.href);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart !== "poe2") {
        return lastPart;
      }
      return url.searchParams.get("query") || new URLSearchParams(url.hash.replace(/^#/, "")).get("query");
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
      const fallbackQueryId = getFallbackQueryId();
      if (!outUrl.searchParams.get("query") && fallbackQueryId) {
        outUrl.searchParams.set("query", fallbackQueryId);
      }
      if (!outUrl.searchParams.get("realm")) {
        outUrl.searchParams.set("realm", "poe2");
      }
      return outUrl.toString();
    };

    const fetchEnglishData = (sourceUrl) => {
      const englishUrl = buildEnglishFetchUrl(sourceUrl);
      const runtimeApi = globalThis.chrome?.runtime;
      if (!enabled || !englishUrl || inFlightEnglishFetches.has(englishUrl) || !runtimeApi?.sendMessage) {
        return;
      }
      inFlightEnglishFetches.add(englishUrl);
      try {
        runtimeApi.sendMessage({ type: "fetch-english", url: englishUrl }, (response) => {
          inFlightEnglishFetches.delete(englishUrl);
          if (globalThis.chrome?.runtime?.lastError || !response?.ok || typeof response.body !== "string") {
            return;
          }
          try {
            storeResults(JSON.parse(response.body));
          } catch (error) {
            console.debug("[PoE2 Marketwright] unable to parse English item data", error);
          }
        });
      } catch (error) {
        inFlightEnglishFetches.delete(englishUrl);
      }
    };

    const handleApiMessage = (url, bodyText) => {
      if (!enabled) {
        return;
      }
      let parsedUrl;
      try {
        parsedUrl = new URL(url, window.location.href);
      } catch (error) {
        return;
      }
      const englishOrigin = ENGLISH_ORIGINS.has(parsedUrl.origin);
      if (bodyText && englishOrigin) {
        try {
          storeResults(JSON.parse(bodyText));
        } catch (error) {
          console.debug("[PoE2 Marketwright] unable to parse item data", error);
        }
      }
      if (!englishOrigin || !bodyText) {
        fetchEnglishData(parsedUrl.toString());
      }
    };

    const handleMessage = (event) => {
      if (event.source !== window || event.data?.source !== MESSAGE_SOURCE) {
        return;
      }
      const { url, body } = event.data;
      if (typeof url === "string") {
        handleApiMessage(url, typeof body === "string" ? body : null);
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
        removeButtons();
      }
    };

    const start = () => {
      if (started) {
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
            if (node.nodeType !== Node.ELEMENT_NODE) {
              return;
            }
            scanAndInject(node);
          });
        }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      rescanTimer = window.setInterval(scanAndInject, 2000);
    };

    return { start, setEnabled, handleApiMessage, storeResults };
  }

  globalThis[GLOBAL_NAME] = { createItemTextBuilder, createPobCopyFeature };
})();
