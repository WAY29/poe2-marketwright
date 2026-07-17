(function () {
  const GLOBAL_NAME = "Poe2MarketwrightAffixViewer";
  const BUTTON_CLASS = "poe2-marketwright-affix-viewer-button";
  const PANEL_CLASS = "poe2-marketwright-affix-viewer-panel";
  const HOST_CLASS = "poe2-marketwright-affix-viewer-host";
  const MESSAGE_SOURCE = "poe2-marketwright-affix-viewer";
  const BRIDGE_SOURCE = "poe2-marketwright";
  const BRIDGE_REQUEST_TYPE = "POE2_MARKETWRIGHT_AFFIX_VIEWER_REQUEST";
  const ENGLISH_ORIGINS = new Set(["https://pathofexile.com", "https://www.pathofexile.com"]);
  const GROUP_IDS = ["prefix", "suffix", "other"];
  const DEFAULT_LABELS = {
    ready: "View possible modifiers",
    prefix: "Prefixes",
    suffix: "Suffixes",
    other: "Other modifiers",
    basePotential: "Possible modifiers for $1"
  };

  function getExtendedModifierHash(item, sourceKey, index) {
    const source = String(sourceKey || "").replace(/Mods$/, "").toLowerCase();
    const hashes = item?.extended?.hashes?.[source];
    if (!Array.isArray(hashes)) {
      return null;
    }
    return hashes.find((entry) => Array.isArray(entry?.[1]) && entry[1].includes(index))?.[0] || hashes[index]?.[0] || null;
  }

  function normalizeEffectStatId(hash, rarity) {
    const [source, bareId] = String(hash || "").split(".", 2);
    if (!source || !bareId) {
      return null;
    }
    if (["explicit", "fractured", "crafted"].includes(source)) {
      return String(rarity || "").toLowerCase() === "unique" ? null : `explicit.${bareId}`;
    }
    // Trade uses the same implicit stat IDs for base implicits and corruptions.
    if (["desecrated", "rune"].includes(source)) {
      return `${source}.${bareId}`;
    }
    return null;
  }

  function createAffixViewerTools() {
    const getEffectGroups = (effectsByPage, pageId) => {
      const effects = effectsByPage?.[pageId] || {};
      return GROUP_IDS.flatMap((id) => {
        const statIds = Array.isArray(effects[id]) ? effects[id].filter((statId) => typeof statId === "string") : [];
        return statIds.length ? [{ id, statIds }] : [];
      });
    };

    const getMatchedEffectIds = (item, row) => {
      const matched = new Set();
      for (const [sourceKey, modifiers] of Object.entries(item || {})) {
        if (!sourceKey.endsWith("Mods") || !Array.isArray(modifiers)) {
          continue;
        }
        modifiers.forEach((modifier, index) => {
          const statId = normalizeEffectStatId(
            modifier && typeof modifier === "object" ? modifier.hash : getExtendedModifierHash(item, sourceKey, index),
            item?.rarity
          );
          if (statId) {
            matched.add(statId);
          }
        });
      }
      row?.querySelectorAll?.('[data-field^="stat."]').forEach((element) => {
        const hash = String(element.getAttribute("data-field") || "").slice("stat.".length);
        const statId = normalizeEffectStatId(hash, item?.rarity);
        if (statId) {
          matched.add(statId);
        }
      });
      return matched;
    };

    const getPanelPlacement = (buttonBox, hostBox, panelHeight, viewportHeight) => {
      const gap = 4;
      const viewportPadding = 8;
      const spaceAbove = Math.max(0, buttonBox.top - viewportPadding - gap);
      const spaceBelow = Math.max(0, viewportHeight - buttonBox.bottom - viewportPadding - gap);
      const placeAbove = spaceBelow < panelHeight && spaceAbove > spaceBelow;
      const availableHeight = placeAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.min(panelHeight, availableHeight);
      return {
        top: placeAbove
          ? buttonBox.top - hostBox.top - maxHeight - gap
          : buttonBox.bottom - hostBox.top + gap,
        maxHeight: maxHeight < panelHeight ? maxHeight : null
      };
    };

    return { getEffectGroups, getMatchedEffectIds, getPanelPlacement };
  }

  function createAffixViewerFeature(options = {}) {
    const tools = createAffixViewerTools();
    const labels = { ...DEFAULT_LABELS, ...(options.labels || {}) };
    const effectsByPage = options.effectsByPage || {};
    const itemCache = new Map();
    const inFlightEnglishFetches = new Set();
    let started = false;
    let observer = null;
    let rescanTimer = null;
    let openRow = null;
    let openHost = null;
    let openPanelElement = null;

    const getItemContext = (row) => {
      const itemId = row?.getAttribute?.("data-id");
      const item = itemId ? itemCache.get(itemId) : null;
      const pageId = item ? options.getPageId?.(item) : null;
      const groups = pageId ? tools.getEffectGroups(effectsByPage, pageId) : [];
      return { item, groups };
    };

    const getPanelTitle = (item) => {
      if (typeof options.getPanelTitle === "function") {
        return options.getPanelTitle(item);
      }
      const baseName = String(item?.typeLine || item?.baseType || "").trim();
      return labels.basePotential.replace("$1", baseName);
    };

    const closePanel = () => {
      openPanelElement?.remove();
      openHost?.classList?.remove(HOST_CLASS);
      openRow?.querySelector?.(`.${BUTTON_CLASS}`)?.setAttribute("aria-expanded", "false");
      openRow = null;
      openHost = null;
      openPanelElement = null;
    };

    const handleDocumentClick = (event) => {
      if (openPanelElement && !openPanelElement.contains(event.target)) {
        closePanel();
      }
    };

    const handleDocumentKeydown = (event) => {
      if (event.key === "Escape" && openPanelElement) {
        closePanel();
      }
    };

    const createEffectList = (statIds, matched) => {
      const list = document.createElement("ul");
      list.className = `${PANEL_CLASS}-list`;
      const sortedStatIds = [...statIds].sort((left, right) =>
        String(options.getStatText?.(left) || left).localeCompare(String(options.getStatText?.(right) || right))
      );
      for (const statId of sortedStatIds) {
        const entry = document.createElement("li");
        entry.className = `${PANEL_CLASS}-effect`;
        if (matched.has(statId)) {
          entry.dataset.matched = "true";
        }
        entry.textContent = options.getStatText?.(statId) || statId;
        list.appendChild(entry);
      }
      return list;
    };

    const createGroup = (group, matched) => {
      const label = `${labels[group.id] || group.id} (${group.statIds.length})`;
      if (group.id === "other") {
        const details = document.createElement("details");
        details.className = `${PANEL_CLASS}-group ${PANEL_CLASS}-group--other`;
        const summary = document.createElement("summary");
        summary.textContent = label;
        details.append(summary, createEffectList(group.statIds, matched));
        return details;
      }
      const section = document.createElement("section");
      section.className = `${PANEL_CLASS}-group`;
      const heading = document.createElement("h4");
      heading.textContent = label;
      section.append(heading, createEffectList(group.statIds, matched));
      return section;
    };

    const openPanel = (row, button) => {
      if (openRow === row) {
        closePanel();
        return;
      }
      closePanel();
      const { item, groups } = getItemContext(row);
      if (!item || !groups.length) {
        return;
      }
      const host = row.querySelector(".left");
      if (!host) {
        return;
      }
      const panel = document.createElement("div");
      panel.className = PANEL_CLASS;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-label", getPanelTitle(item));
      panel.addEventListener("click", (event) => event.stopPropagation());
      const matched = tools.getMatchedEffectIds(item, row);
      groups.forEach((group) => panel.appendChild(createGroup(group, matched)));
      const hostBox = host.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      panel.style.left = `${buttonBox.left - hostBox.left}px`;
      panel.style.top = `${buttonBox.bottom - hostBox.top + 4}px`;
      host.classList.add(HOST_CLASS);
      host.appendChild(panel);
      const placement = tools.getPanelPlacement(
        buttonBox,
        hostBox,
        panel.getBoundingClientRect().height,
        window.innerHeight
      );
      if (placement.maxHeight !== null) {
        panel.style.maxHeight = `${placement.maxHeight}px`;
      }
      panel.style.top = `${placement.top}px`;
      openRow = row;
      openHost = host;
      openPanelElement = panel;
      button.setAttribute("aria-expanded", "true");
    };

    const updateButton = (button) => {
      const row = button.closest?.("div.row[data-id]");
      const { item, groups } = getItemContext(row);
      const available = Boolean(item && groups.length);
      button.hidden = !available;
      button.disabled = !available;
      if (!available && openRow === row) {
        closePanel();
      }
    };

    const injectButton = (row) => {
      if (!(row instanceof Element)) {
        return;
      }
      const { item, groups } = getItemContext(row);
      if (!item || !groups.length || row.querySelector(`.${BUTTON_CLASS}`)) {
        return;
      }
      const left = row.querySelector(".left");
      if (!left) {
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = BUTTON_CLASS;
      button.title = labels.ready;
      button.setAttribute("aria-label", labels.ready);
      button.setAttribute("aria-expanded", "false");
      button.innerHTML =
        '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2 3h12v1H2V3zm0 4h12v1H2V7zm0 4h12v1H2v-1z"></path></svg>';
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        openPanel(row, button);
      });
      const favoriteButton = row.querySelector(".poe2-marketwright-favorite-button");
      const pobButton = row.querySelector(".poe2-marketwright-pob-copy-button");
      const anchor = favoriteButton || pobButton;
      if (anchor?.parentNode) {
        anchor.insertAdjacentElement("afterend", button);
      } else {
        left.insertBefore(button, left.firstChild);
      }
    };

    const scanAndInject = (root = document) => {
      if (root instanceof Element && root.matches("div.row[data-id]")) {
        injectButton(root);
      }
      root.querySelectorAll?.("div.row[data-id]").forEach(injectButton);
      document.querySelectorAll?.(`.${BUTTON_CLASS}`).forEach(updateButton);
    };

    const storeResults = (data) => {
      if (!Array.isArray(data?.result)) {
        return;
      }
      for (const entry of data.result) {
        if (entry?.id && entry.item) {
          itemCache.set(entry.id, entry.item);
        }
      }
      scanAndInject();
    };

    const getFallbackQueryId = () => {
      const url = new URL(window.location.href);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      return lastPart && lastPart !== "poe2" ? lastPart : url.searchParams.get("query");
    };

    const buildEnglishFetchUrl = (sourceUrl) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(sourceUrl, window.location.href);
      } catch (error) {
        return null;
      }
      const englishUrl = new URL(parsedUrl.pathname, "https://pathofexile.com");
      parsedUrl.searchParams.forEach((value, key) => englishUrl.searchParams.set(key, value));
      const queryId = getFallbackQueryId();
      if (!englishUrl.searchParams.get("query") && queryId) {
        englishUrl.searchParams.set("query", queryId);
      }
      if (!englishUrl.searchParams.get("realm")) {
        englishUrl.searchParams.set("realm", "poe2");
      }
      return englishUrl.toString();
    };

    const fetchEnglishData = (sourceUrl) => {
      const englishUrl = buildEnglishFetchUrl(sourceUrl);
      const runtimeApi = globalThis.chrome?.runtime;
      if (!englishUrl || inFlightEnglishFetches.has(englishUrl) || !runtimeApi?.sendMessage) {
        return;
      }
      inFlightEnglishFetches.add(englishUrl);
      runtimeApi.sendMessage({ type: "fetch-english", url: englishUrl }, (response) => {
        inFlightEnglishFetches.delete(englishUrl);
        if (globalThis.chrome?.runtime?.lastError || !response?.ok || typeof response.body !== "string") {
          return;
        }
        try {
          storeResults(JSON.parse(response.body));
        } catch (error) {
          console.debug("[PoE2 Marketwright] unable to parse English affix viewer item data", error);
        }
      });
    };

    const handleApiMessage = (url, bodyText) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(url, window.location.href);
      } catch (error) {
        return;
      }
      if (bodyText && ENGLISH_ORIGINS.has(parsedUrl.origin)) {
        try {
          storeResults(JSON.parse(bodyText));
        } catch (error) {
          console.debug("[PoE2 Marketwright] unable to parse affix viewer item data", error);
        }
        return;
      }
      fetchEnglishData(parsedUrl.toString());
    };

    const handleMessage = (event) => {
      if (event.source !== window || event.data?.source !== MESSAGE_SOURCE || typeof event.data.url !== "string") {
        return;
      }
      handleApiMessage(event.data.url, typeof event.data.body === "string" ? event.data.body : null);
    };

    const start = () => {
      if (started || typeof document === "undefined") {
        return;
      }
      started = true;
      window.addEventListener("message", handleMessage);
      document.addEventListener("click", handleDocumentClick);
      document.addEventListener("keydown", handleDocumentKeydown);
      window.postMessage({ source: BRIDGE_SOURCE, type: BRIDGE_REQUEST_TYPE }, "*");
      scanAndInject();
      observer = new MutationObserver((mutations) => mutations.forEach((mutation) => scanAndInject(mutation.target)));
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      rescanTimer = window.setInterval(scanAndInject, 2000);
    };

    return { start, storeResults, handleMessage };
  }

  globalThis[GLOBAL_NAME] = { createAffixViewerTools, createAffixViewerFeature };
})();
