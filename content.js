(function () {
  if (!location.pathname.startsWith("/trade2")) {
    return;
  }

  if (window.__poe2Trade2AffixFilterLoaded) {
    return;
  }
  window.__poe2Trade2AffixFilterLoaded = true;

  const STORAGE_KEY = "poe2Trade2AffixFilterState";
  const DEFAULT_STATE = {
    enabled: true,
    selection: "auto"
  };
  const ROOT_ID = "poe2-trade2-affix-filter-root";
  const HIDDEN_CLASS = "poe2-trade2-affix-filter-hidden";
  const BRIDGE_SCRIPT_ID = "poe2-marketwright-page-bridge";
  const BRIDGE_SOURCE = "poe2-marketwright";
  const BRIDGE_UPDATE_TYPE = "POE2_MARKETWRIGHT_UPDATE";
  const BRIDGE_READY_TYPE = "POE2_MARKETWRIGHT_READY";
  const BRIDGE_STATE_TYPE = "POE2_MARKETWRIGHT_STATE";
  const TRADE_ROOT_SELECTOR = "#trade";
  const ITEM_SEARCH_ROOT_SELECTOR =
    "#trade .top .search-panel > .search-bar:not(.search-advanced) .search-left .multiselect.search-select";
  const ITEM_SEARCH_INPUT_SELECTOR = `${ITEM_SEARCH_ROOT_SELECTOR} input.multiselect__input`;
  const TYPE_FILTER_GROUP_SELECTOR = "#trade .search-advanced-pane.blue > .filter-group";
  const LOOKUP_SPLIT_RE = /[\n\r|]+/;
  const NUMBER_RE = /([-+]?\d+(?:\.\d+)?)/g;
  const STAT_GROUP_PREFIX_RE =
    /^(pseudo|explicit|implicit|fractured|crafted|enchant|rune|augment|desecrated|sanctum|skill)\s*[:：-]?\s*/i;
  const OPTION_SELECTOR = [
    "[role='option']",
    "[role='menuitem']",
    ".select2-results__option",
    ".multiselect__option",
    ".multiselect__element",
    ".vs__dropdown-option",
    ".dropdown-item",
    "[data-option]",
    "[data-select-option]"
  ].join(",");
  const OPTION_ROOT_SELECTOR = [
    "[role='listbox']",
    "[role='menu']",
    ".select2-dropdown",
    ".select2-results",
    ".select2-results__options",
    ".multiselect__content-wrapper",
    ".multiselect__content",
    ".vs__dropdown-menu",
    ".dropdown-menu"
  ].join(",");

  const runtime = {
    data: null,
    state: { ...DEFAULT_STATE },
    allPatterns: new Set(),
    itemLookupEntries: [],
    categoryLookupEntries: [],
    categoryAliasToSelection: {},
    pagePatternCache: new Map(),
    logicalPatternCache: new Map(),
    pageStatIdCache: new Map(),
    logicalStatIdCache: new Map(),
    activeSelection: null,
    observer: null,
    controlListenerAbort: null,
    controlObservers: [],
    controlListenerTimer: null,
    refreshTimer: null,
    bridgeStats: null,
    bridgePayloadSignature: "",
    lastFilterStats: null,
    ui: {}
  };

  bootstrap().catch((error) => {
    console.error("[PoE2 Marketwright] bootstrap failed", error);
  });

  async function bootstrap() {
    runtime.data = await loadData();
    runtime.allPatterns = new Set((runtime.data.allPatterns || []).map(normalizeStatKey).filter(Boolean));
    runtime.itemLookupEntries = Object.keys(runtime.data.itemNameToPage || {}).sort(compareLookupLengthDesc);
    runtime.categoryAliasToSelection = buildExpandedCategoryAliasMap(runtime.data.categoryAliasToSelection || {});
    runtime.categoryLookupEntries = Object.keys(runtime.categoryAliasToSelection).sort(compareLookupLengthDesc);
    runtime.state = await loadState();
    bindPageBridgeMessages();
    injectPageBridge();
    mountPanel();
    bindGlobalListeners();
    scheduleRefresh();
  }

  async function loadData() {
    const url = chrome.runtime.getURL("data/affix-filter-data.json");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load affix filter data: ${response.status}`);
    }
    return response.json();
  }

  async function loadState() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return {
      ...DEFAULT_STATE,
      ...(stored[STORAGE_KEY] || {})
    };
  }

  async function saveState() {
    await chrome.storage.local.set({
      [STORAGE_KEY]: runtime.state
    });
  }

  function mountPanel() {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="poe2-trade2-affix-filter-panel">
        <div class="poe2-trade2-affix-filter-header">
          <div class="poe2-trade2-affix-filter-title">PoE2 Marketwright</div>
          <label class="poe2-trade2-affix-filter-toggle">
            <input id="poe2-trade2-affix-filter-enabled" type="checkbox">
            <span>启用</span>
          </label>
        </div>
        <div id="poe2-trade2-affix-filter-status" class="poe2-trade2-affix-filter-status"></div>
        <label class="poe2-trade2-affix-filter-field">
          <span class="poe2-trade2-affix-filter-field-label">模式</span>
          <select id="poe2-trade2-affix-filter-selection"></select>
        </label>
        <div id="poe2-trade2-affix-filter-meta" class="poe2-trade2-affix-filter-meta"></div>
      </div>
    `;

    document.documentElement.appendChild(root);

    runtime.ui.root = root;
    runtime.ui.enabled = root.querySelector("#poe2-trade2-affix-filter-enabled");
    runtime.ui.selection = root.querySelector("#poe2-trade2-affix-filter-selection");
    runtime.ui.status = root.querySelector("#poe2-trade2-affix-filter-status");
    runtime.ui.meta = root.querySelector("#poe2-trade2-affix-filter-meta");

    populateSelectionOptions(runtime.ui.selection);

    runtime.ui.enabled.checked = Boolean(runtime.state.enabled);
    runtime.ui.selection.value = runtime.state.selection;

    runtime.ui.enabled.addEventListener("change", async () => {
      runtime.state.enabled = runtime.ui.enabled.checked;
      await saveState();
      scheduleRefresh();
    });

    runtime.ui.selection.addEventListener("change", async () => {
      runtime.state.selection = runtime.ui.selection.value;
      await saveState();
      scheduleRefreshAfterDomUpdate();
    });
  }

  function populateSelectionOptions(select) {
    select.innerHTML = "";

    const autoOption = document.createElement("option");
    autoOption.value = "auto";
    autoOption.textContent = "自动识别";
    select.appendChild(autoOption);

    const logicalGroup = document.createElement("optgroup");
    logicalGroup.label = "逻辑类别";
    const pageGroup = document.createElement("optgroup");
    pageGroup.label = "具体类别页";

    for (const option of runtime.data.selectionOptions || []) {
      const element = document.createElement("option");
      element.value = encodeSelection(option.kind, option.id);
      element.textContent = option.label;
      if (option.kind === "logical") {
        logicalGroup.appendChild(element);
      } else {
        pageGroup.appendChild(element);
      }
    }

    select.appendChild(logicalGroup);
    select.appendChild(pageGroup);
  }

  function encodeSelection(kind, id) {
    return `${kind}:${id}`;
  }

  function decodeSelection(value) {
    if (!value || value === "auto") {
      return null;
    }
    const separatorIndex = value.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }
    return {
      kind: value.slice(0, separatorIndex),
      id: value.slice(separatorIndex + 1),
      source: "manual"
    };
  }

  function bindGlobalListeners() {
    bindTradeControlListeners();

    const observer = new MutationObserver(() => {
      scheduleControlListenerRefresh();
    });
    observer.observe(document.querySelector(TRADE_ROOT_SELECTOR) || document.documentElement, {
      childList: true,
      subtree: true
    });
    runtime.observer = observer;

    window.addEventListener("popstate", scheduleRefreshAfterDomUpdate, true);
    window.addEventListener("hashchange", scheduleRefreshAfterDomUpdate, true);
  }

  function scheduleControlListenerRefresh() {
    if (runtime.controlListenerTimer) {
      clearTimeout(runtime.controlListenerTimer);
    }
    runtime.controlListenerTimer = window.setTimeout(() => {
      runtime.controlListenerTimer = null;
      bindTradeControlListeners();
    }, 100);
  }

  function bindTradeControlListeners() {
    if (runtime.controlListenerAbort) {
      runtime.controlListenerAbort.abort();
    }
    for (const observer of runtime.controlObservers) {
      observer.disconnect();
    }
    runtime.controlObservers = [];

    const controller = new AbortController();
    runtime.controlListenerAbort = controller;

    const targets = new Set([
      getItemSearchRoot(),
      getItemSearchInput(),
      getTypeCategoryMultiselect()
    ]);

    for (const target of targets) {
      if (!target || runtime.ui.root?.contains(target)) {
        continue;
      }

      bindSelectionTargetEvents(target, controller.signal);
      observeSelectionTarget(target);
    }

    scheduleRefresh();
  }

  function bindSelectionTargetEvents(target, signal) {
    for (const type of ["input", "change", "click", "pointerup", "keyup", "blur"]) {
      target.addEventListener(type, scheduleRefreshAfterDomUpdate, {
        capture: true,
        signal
      });
    }
  }

  function observeSelectionTarget(target) {
    const observer = new MutationObserver(scheduleRefreshAfterDomUpdate);
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "value", "aria-expanded", "aria-selected"]
    });
    runtime.controlObservers.push(observer);
  }

  function bindPageBridgeMessages() {
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.data?.source !== BRIDGE_SOURCE) {
        return;
      }

      if (event.data.type === BRIDGE_READY_TYPE) {
        scheduleRefresh();
        return;
      }

      if (event.data.type !== BRIDGE_STATE_TYPE) {
        return;
      }

      const payload = event.data.payload || {};
      runtime.bridgeStats = payload.filterStats || null;
      scheduleRefresh();
    });
  }

  function injectPageBridge() {
    if (document.getElementById(BRIDGE_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.id = BRIDGE_SCRIPT_ID;
    script.src = chrome.runtime.getURL("page-bridge.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  function scheduleRefresh() {
    if (runtime.refreshTimer) {
      clearTimeout(runtime.refreshTimer);
    }
    runtime.refreshTimer = window.setTimeout(() => {
      runtime.refreshTimer = null;
      refreshFiltering();
    }, 120);
  }

  function scheduleRefreshAfterDomUpdate() {
    scheduleRefresh();
    window.setTimeout(scheduleRefresh, 300);
    window.setTimeout(scheduleRefresh, 800);
  }

  function refreshFiltering() {
    unhideAllFilteredOptions();

    const activeSelection = resolveActiveSelection();
    runtime.activeSelection = activeSelection;

    const allowedPatterns = getAllowedPatterns(activeSelection);
    const allowedStatIds = getAllowedStatIds(activeSelection);
    syncPageBridge(allowedPatterns, allowedStatIds);

    const filterStats = {
      groups: 0,
      options: 0,
      matched: 0,
      hidden: 0
    };

    if (!runtime.state.enabled || !allowedPatterns || allowedPatterns.size === 0) {
      runtime.lastFilterStats = filterStats;
      updatePanel(activeSelection, allowedPatterns);
      return;
    }

    const groups = findFilterableOptionGroups();
    for (const group of groups) {
      filterOptionGroup(group, allowedPatterns, allowedStatIds, filterStats);
    }

    runtime.lastFilterStats = filterStats;
    updatePanel(activeSelection, allowedPatterns);
  }

  function resolveActiveSelection() {
    if (!runtime.state.enabled) {
      return null;
    }

    const manual = decodeSelection(runtime.state.selection);
    if (manual) {
      return manual;
    }

    return inferActiveSelection();
  }

  function inferActiveSelection() {
    const categorySelection = inferCategorySelectionFromTypeFilterDom();
    const itemSelection = inferItemSelectionFromSearchBoxDom();

    if (itemSelection && categorySelection && selectionIncludesPage(categorySelection, itemSelection.id)) {
      return itemSelection;
    }
    if (categorySelection) {
      return categorySelection;
    }
    return itemSelection;
  }

  function inferItemSelectionFromSearchBoxDom() {
    const texts = new Set();
    const input = getItemSearchInput();
    const root = getItemSearchRoot();

    for (const text of collectMultiselectSelectedTexts(root || input)) {
      texts.add(text);
    }
    if (input?.value) {
      texts.add(input.value);
    }

    return inferSelectionFromTexts(texts, {
      allowItems: true,
      allowCategories: false
    });
  }

  function inferCategorySelectionFromTypeFilterDom() {
    const texts = collectMultiselectSelectedTexts(getTypeCategoryMultiselect());
    return inferSelectionFromTexts(texts, {
      allowItems: false,
      allowCategories: true
    });
  }

  function getItemSearchRoot() {
    return document.querySelector(ITEM_SEARCH_ROOT_SELECTOR);
  }

  function getItemSearchInput() {
    return document.querySelector(ITEM_SEARCH_INPUT_SELECTOR);
  }

  function getTypeCategoryMultiselect() {
    const group = findTypeFilterGroup();
    const body = group?.querySelector(".filter-group-body");
    if (!body) {
      return null;
    }

    const fields = Array.from(body.children).filter((child) => child.matches?.(".filter.filter-property"));
    const categoryField =
      fields.find((field) => isCategoryFilterField(field)) ||
      fields.find((field) => field.matches(".filter-property.full-span")) ||
      fields[0];

    return categoryField?.querySelector(".multiselect.filter-select, .multiselect") || null;
  }

  function findTypeFilterGroup() {
    for (const group of document.querySelectorAll(TYPE_FILTER_GROUP_SELECTOR)) {
      const text = normalizeLookupText(group.textContent || "");
      if (/(type filters?|類別過濾|类别过滤)/.test(text) && /(item category|道具分類|道具分类)/.test(text)) {
        return group;
      }
    }
    return document.querySelector(TYPE_FILTER_GROUP_SELECTOR);
  }

  function isCategoryFilterField(field) {
    const text = normalizeLookupText(field.textContent || "");
    const withoutOptions = text.replace(/\b(any|normal|magic|rare|unique)\b/g, " ");
    return /(item category|道具分類|道具分类)/.test(withoutOptions);
  }

  function collectMultiselectSelectedTexts(root) {
    if (!root) {
      return [];
    }

    const multiselect = root.matches?.(".multiselect") ? root : root.closest?.(".multiselect") || root;
    const values = [];
    const selectedSelectors = [
      ".multiselect__tags > .multiselect__single",
      ".multiselect__tags .multiselect__tag",
      ".multiselect__option--selected",
      "input.multiselect__input"
    ];

    for (const element of multiselect.querySelectorAll(selectedSelectors.join(","))) {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        values.push(element.value || "");
      }
      values.push(element.getAttribute("title") || "");
      values.push(element.getAttribute("data-value") || "");
      values.push(element.getAttribute("data-text") || "");
      values.push(element.getAttribute("data-label") || "");
      values.push(element.textContent || "");
    }

    return values
      .map((value) => String(value).replace(/\s+/g, " ").trim())
      .filter((value, index, array) => value && array.indexOf(value) === index && !isIgnorableSelectionText(value));
  }

  function inferSelectionFromTexts(texts, options = {}) {
    const allowItems = options.allowItems !== false;
    const allowCategories = options.allowCategories !== false;
    let bestItem = null;
    let bestCategory = null;

    for (const text of texts) {
      for (const segment of splitCandidateText(text)) {
        const exactMatch = lookupSelectionSegment(segment);
        if (
          allowItems &&
          exactMatch?.source === "item" &&
          (!bestItem || exactMatch.match.length > bestItem.match.length)
        ) {
          bestItem = exactMatch;
        }
        if (
          allowCategories &&
          exactMatch?.source === "category" &&
          (!bestCategory || exactMatch.match.length > bestCategory.match.length)
        ) {
          bestCategory = exactMatch;
        }
      }

      if (allowItems) {
        const containedItemMatch = lookupSelectionInText(text, {
          allowItems: true,
          allowCategories: false
        });
        if (
          containedItemMatch?.source === "item" &&
          (!bestItem || containedItemMatch.match.length > bestItem.match.length)
        ) {
          bestItem = containedItemMatch;
        }
      }

      if (allowCategories) {
        const containedCategoryMatch = lookupSelectionInText(text, {
          allowItems: false,
          allowCategories: true
        });
        if (
          containedCategoryMatch?.source === "category" &&
          (!bestCategory || containedCategoryMatch.match.length > bestCategory.match.length)
        ) {
          bestCategory = containedCategoryMatch;
        }
      }
    }

    if (bestItem && bestCategory && !selectionIncludesPage(bestCategory, bestItem.id)) {
      return bestCategory;
    }

    return bestItem || bestCategory || null;
  }

  function selectionIncludesPage(selection, pageId) {
    if (!selection || !pageId) {
      return false;
    }
    if (selection.kind === "page") {
      return selection.id === pageId;
    }
    if (selection.kind === "logical") {
      const record = runtime.data.logicalCategories[selection.id];
      return Boolean(record?.pageSlugs?.includes(pageId));
    }
    return false;
  }

  function isIgnorableSelectionText(text) {
    const normalized = normalizeLookupText(text);
    const withoutBracketTranslation = normalized.replace(/\[[^\]]+\]/g, "").trim();
    return (
      !normalized ||
      ["any", "任何", "任意"].includes(withoutBracketTranslation) ||
      normalized === "any" ||
      normalized === "任何[any]" ||
      normalized === "任何 [any]" ||
      normalized === "任意[any]" ||
      normalized === "任意 [any]" ||
      normalized === "any category" ||
      normalized === "search" ||
      normalized === "搜尋" ||
      normalized === "搜索" ||
      normalized === "搜尋道具..." ||
      normalized === "搜索道具..." ||
      normalized === "select" ||
      normalized === "type filters" ||
      normalized === "item category" ||
      normalized === "物品类别" ||
      normalized === "道具分类" ||
      normalized === "道具分類"
    );
  }

  function lookupSelectionSegment(segment) {
    const pageAlias = lookupPageAliasSegment(segment);
    if (pageAlias) {
      return pageAlias;
    }

    const itemSlug = runtime.data.itemNameToPage[segment];
    if (itemSlug) {
      return {
        kind: "page",
        id: itemSlug,
        source: "item",
        match: segment
      };
    }

    const category = runtime.categoryAliasToSelection[segment];
    if (category) {
      return {
        kind: category.kind,
        id: category.id,
        source: "category",
        match: segment
      };
    }

    return null;
  }

  function lookupPageAliasSegment(segment) {
    const category = runtime.categoryAliasToSelection[segment];
    if (!category || category.kind !== "page") {
      return null;
    }
    return {
      kind: category.kind,
      id: category.id,
      source: "item",
      match: segment
    };
  }

  function lookupSelectionInText(text, options = {}) {
    const allowItems = options.allowItems !== false;
    const allowCategories = options.allowCategories !== false;
    const normalized = normalizeLookupText(text);
    if (!normalized) {
      return null;
    }

    if (allowItems) {
      for (const categoryAlias of runtime.categoryLookupEntries) {
        const category = runtime.categoryAliasToSelection[categoryAlias];
        if (category?.kind !== "page" || !isContainedLookupMatch(normalized, categoryAlias)) {
          continue;
        }
        return {
          kind: category.kind,
          id: category.id,
          source: "item",
          match: categoryAlias
        };
      }

      for (const itemName of runtime.itemLookupEntries) {
        if (!isContainedLookupMatch(normalized, itemName)) {
          continue;
        }
        return {
          kind: "page",
          id: runtime.data.itemNameToPage[itemName],
          source: "item",
          match: itemName
        };
      }
    }

    if (allowCategories) {
      for (const categoryAlias of runtime.categoryLookupEntries) {
        if (!isContainedLookupMatch(normalized, categoryAlias)) {
          continue;
        }
        const category = runtime.categoryAliasToSelection[categoryAlias];
        return {
          kind: category.kind,
          id: category.id,
          source: "category",
          match: categoryAlias
        };
      }
    }

    return null;
  }

  function isContainedLookupMatch(text, lookup) {
    let index = text.indexOf(lookup);
    while (index >= 0) {
      const before = index === 0 ? "" : text[index - 1];
      const afterIndex = index + lookup.length;
      const after = afterIndex >= text.length ? "" : text[afterIndex];
      if (isLookupBoundary(before) && isLookupBoundary(after)) {
        return true;
      }
      index = text.indexOf(lookup, index + lookup.length);
    }
    return false;
  }

  function isLookupBoundary(character) {
    return !character || !/[a-z0-9]/i.test(character);
  }

  function buildExpandedCategoryAliasMap(aliasMap) {
    const expanded = { ...aliasMap };
    for (const [alias, selection] of Object.entries(aliasMap)) {
      for (const variant of getLookupAliasVariants(alias)) {
        if (!expanded[variant]) {
          expanded[variant] = selection;
        }
      }
    }
    return expanded;
  }

  function getLookupAliasVariants(alias) {
    const normalized = normalizeLookupText(alias);
    const variants = new Set([normalized]);
    if (normalized.endsWith("ies")) {
      variants.add(`${normalized.slice(0, -3)}y`);
    } else if (normalized.endsWith("s") && normalized.length > 3) {
      variants.add(normalized.slice(0, -1));
    } else if (normalized.length > 3) {
      variants.add(`${normalized}s`);
    }

    for (const value of Array.from(variants)) {
      variants.add(value.replace(/\bone handed\b/g, "one hand"));
      variants.add(value.replace(/\btwo handed\b/g, "two hand"));
      variants.add(value.replace(/\bone hand\b/g, "one handed"));
      variants.add(value.replace(/\btwo hand\b/g, "two handed"));
    }

    variants.delete("");
    return variants;
  }

  function splitCandidateText(text) {
    const cleaned = String(text).replace(/\u00a0/g, " ").trim();
    const parts = new Set();

    for (const chunk of cleaned.split(LOOKUP_SPLIT_RE)) {
      const trimmed = normalizeLookupText(chunk);
      if (trimmed) {
        parts.add(trimmed);
      }
      for (const match of chunk.matchAll(/\[([^\]]+)\]/g)) {
        const bracketText = normalizeLookupText(match[1]);
        if (bracketText) {
          parts.add(bracketText);
        }
      }
      const colonIndex = chunk.lastIndexOf(":");
      if (colonIndex >= 0) {
        const afterColon = normalizeLookupText(chunk.slice(colonIndex + 1));
        if (afterColon) {
          parts.add(afterColon);
        }
      }
    }

    const whole = normalizeLookupText(cleaned);
    if (whole) {
      parts.add(whole);
    }

    return Array.from(parts);
  }

  function normalizeLookupText(text) {
    return String(text)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function getSelectionRecord(selection) {
    if (!selection) {
      return null;
    }
    if (selection.kind === "page") {
      return runtime.data.pageCategories[selection.id] || null;
    }
    if (selection.kind === "logical") {
      return runtime.data.logicalCategories[selection.id] || null;
    }
    return null;
  }

  function getAllowedPatterns(selection) {
    if (!selection || !runtime.state.enabled) {
      return null;
    }

    if (selection.kind === "page") {
      if (!runtime.pagePatternCache.has(selection.id)) {
        const record = runtime.data.pageCategories[selection.id];
        runtime.pagePatternCache.set(
          selection.id,
          new Set((record ? record.allowedPatterns : []).map(normalizeStatKey).filter(Boolean))
        );
      }
      return runtime.pagePatternCache.get(selection.id);
    }

    if (selection.kind === "logical") {
      if (!runtime.logicalPatternCache.has(selection.id)) {
        const record = runtime.data.logicalCategories[selection.id];
        runtime.logicalPatternCache.set(
          selection.id,
          new Set((record ? record.allowedPatterns : []).map(normalizeStatKey).filter(Boolean))
        );
      }
      return runtime.logicalPatternCache.get(selection.id);
    }

    return null;
  }

  function getAllowedStatIds(selection) {
    if (!selection || !runtime.state.enabled) {
      return null;
    }

    if (selection.kind === "page") {
      if (!runtime.pageStatIdCache.has(selection.id)) {
        const record = runtime.data.pageCategories[selection.id];
        runtime.pageStatIdCache.set(selection.id, new Set(record ? record.allowedStatIds || [] : []));
      }
      return runtime.pageStatIdCache.get(selection.id);
    }

    if (selection.kind === "logical") {
      if (!runtime.logicalStatIdCache.has(selection.id)) {
        const record = runtime.data.logicalCategories[selection.id];
        runtime.logicalStatIdCache.set(selection.id, new Set(record ? record.allowedStatIds || [] : []));
      }
      return runtime.logicalStatIdCache.get(selection.id);
    }

    return null;
  }

  function updatePanel(selection, allowedPatterns) {
    if (!runtime.ui.status) {
      return;
    }

    const record = getSelectionRecord(selection);
    runtime.ui.enabled.checked = Boolean(runtime.state.enabled);
    runtime.ui.selection.value = runtime.state.selection;

    if (!runtime.state.enabled) {
      runtime.ui.status.textContent = "已关闭。当前不会过滤右侧词缀建议。";
      runtime.ui.meta.textContent = "模式: 关闭";
      return;
    }

    if (!selection || !record) {
      runtime.ui.status.textContent = "未识别到当前类别或物品名，当前不过滤。";
      runtime.ui.meta.textContent = "模式: 自动识别";
      return;
    }

    const label = record.label || selection.id;
    const selectionSource = selection.source === "manual" ? "手动" : "自动";
    const patternCount = allowedPatterns ? allowedPatterns.size : 0;
    runtime.ui.status.textContent = `${selectionSource}: ${label}`;
    runtime.ui.meta.textContent = buildMetaText(patternCount);
  }

  function buildMetaText(patternCount) {
    const parts = [`可用词条模式 ${patternCount} 条`];
    if (runtime.lastFilterStats?.matched) {
      parts.push(`页面候选 ${runtime.lastFilterStats.matched} 条，已隐藏 ${runtime.lastFilterStats.hidden} 条`);
    }
    if (runtime.bridgeStats?.total) {
      const skipped = runtime.bridgeStats.skipped ? "，已跳过严格过滤" : "";
      parts.push(`源数据保留 ${runtime.bridgeStats.kept || 0} 条，已隐藏 ${runtime.bridgeStats.hidden || 0} 条${skipped}`);
    }
    return parts.join("；");
  }

  function unhideAllFilteredOptions() {
    for (const element of document.querySelectorAll(`.${HIDDEN_CLASS}`)) {
      element.classList.remove(HIDDEN_CLASS);
    }
  }

  function findFilterableOptionGroups() {
    const roots = new Set();
    const roleOptions = document.querySelectorAll(OPTION_SELECTOR);

    for (const option of roleOptions) {
      if (!isVisible(option) || runtime.ui.root.contains(option)) {
        continue;
      }
      const pattern = getOptionPatternKey(option);
      if (!runtime.allPatterns.has(pattern)) {
        continue;
      }
      const root = findOptionRoot(option);
      if (root) {
        roots.add(root);
      }
    }

    for (const root of document.querySelectorAll(OPTION_ROOT_SELECTOR)) {
      if (isVisible(root) && !runtime.ui.root.contains(root)) {
        roots.add(root);
      }
    }

    return Array.from(roots);
  }

  function findOptionRoot(option) {
    let current = option;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      if (runtime.ui.root.contains(current) || !isVisible(current)) {
        continue;
      }
      const options = getOptionElements(current, true);
      if (options.length < 3) {
        continue;
      }
      const style = window.getComputedStyle(current);
      const positioned = ["absolute", "fixed", "sticky"].includes(style.position);
      const semantic =
        current.getAttribute("role") === "listbox" ||
        current.getAttribute("role") === "menu" ||
        current.matches(OPTION_ROOT_SELECTOR);
      if (positioned || semantic) {
        return current;
      }
    }
    return null;
  }

  function getOptionElements(root, quickMode) {
    let options = root.matches(OPTION_SELECTOR) ? [root] : [];
    options.push(...Array.from(root.querySelectorAll(OPTION_SELECTOR)));
    if (!options.length) {
      options = Array.from(root.querySelectorAll("li, button, [class*='option'], [data-option]"));
    }
    options = options.filter((element) => {
      if (!isVisible(element) || runtime.ui.root.contains(element)) {
        return false;
      }
      const text = getOptionText(element);
      return text.length > 0 && text.length < 180;
    });
    if (quickMode && options.length > 40) {
      return options.slice(0, 40);
    }
    return options;
  }

  function filterOptionGroup(root, allowedPatterns, allowedStatIds, stats) {
    const options = getOptionElements(root, false);
    if (options.length < 3) {
      return;
    }

    let affixOptionCount = 0;
    for (const option of options) {
      const statId = getOptionStatId(option);
      const pattern = getOptionPatternKey(option);
      if (
        (statId && allowedStatIds?.has(statId)) ||
        (pattern && (runtime.allPatterns.has(pattern) || allowedPatterns.has(pattern)))
      ) {
        affixOptionCount += 1;
      }
    }

    if (affixOptionCount < 2) {
      return;
    }

    stats.groups += 1;
    for (const option of options) {
      stats.options += 1;
      const statId = getOptionStatId(option);
      const pattern = getOptionPatternKey(option);
      if (!statId && (!pattern || !isFilterableStatOption(option, pattern, allowedPatterns))) {
        continue;
      }
      const shouldHide = statId ? !allowedStatIds?.has(statId) : !allowedPatterns.has(pattern);
      stats.matched += 1;
      if (shouldHide) {
        stats.hidden += 1;
      }
      option.classList.toggle(HIDDEN_CLASS, shouldHide);
    }
  }

  function getOptionPatternKey(element) {
    let fallbackKey = "";
    for (const text of collectOptionTexts(element)) {
      for (const candidate of extractStatCandidateTexts(text)) {
        const key = normalizeStatKey(candidate);
        if (!key) {
          continue;
        }
        if (runtime.allPatterns.has(key)) {
          return key;
        }
        fallbackKey ||= key;
      }
    }
    return fallbackKey;
  }

  function getOptionStatId(element) {
    const values = [
      element.getAttribute("data-id"),
      element.getAttribute("data-stat-id"),
      element.getAttribute("data-stat"),
      element.getAttribute("data-value"),
      element.getAttribute("value"),
      element.id
    ];

    for (const value of values) {
      if (!value) {
        continue;
      }
      const match = String(value).match(
        /\b(?:pseudo|explicit|implicit|fractured|crafted|enchant|rune|desecrated|sanctum|skill)\.[\w.-]+\b/i
      );
      if (match) {
        return match[0];
      }
    }

    return "";
  }

  function isFilterableStatOption(element, pattern, allowedPatterns) {
    if (allowedPatterns.has(pattern) || runtime.allPatterns.has(pattern)) {
      return true;
    }

    const text = getOptionText(element);
    return /#|%|\bmap\b|\bmodifier\b|\bmonsters?\b|\bitems?\b/i.test(text);
  }

  function collectOptionTexts(element) {
    return [
      element.innerText,
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-text"),
      element.getAttribute("data-label"),
      element.getAttribute("data-value"),
      element.value
    ]
      .map((value) => (value == null ? "" : String(value).trim()))
      .filter(Boolean);
  }

  function extractStatCandidateTexts(text) {
    const raw = String(text).replace(/\u00a0/g, " ").replace(/\r/g, "\n").trim();
    const candidates = new Set();
    const collapsed = raw.replace(/\s+/g, " ").trim();
    if (collapsed) {
      candidates.add(collapsed);
    }

    for (const line of raw.split(/\n+/)) {
      const trimmed = line.replace(/\s+/g, " ").trim();
      if (trimmed) {
        candidates.add(trimmed);
      }
    }

    for (const candidate of Array.from(candidates)) {
      const withoutPrefix = candidate.replace(STAT_GROUP_PREFIX_RE, "").trim();
      if (withoutPrefix) {
        candidates.add(withoutPrefix);
      }
    }

    return Array.from(candidates);
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

  function getOptionText(element) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function syncPageBridge(allowedPatterns, allowedStatIds) {
    const enabled = Boolean(
      runtime.state.enabled &&
        ((allowedPatterns && allowedPatterns.size > 0) || (allowedStatIds && allowedStatIds.size > 0))
    );
    const payload = {
      enabled,
      allowedKeys: enabled ? Array.from(allowedPatterns || []) : [],
      allowedStatIds: enabled ? Array.from(allowedStatIds || []) : [],
      allKeys: Array.from(runtime.allPatterns)
    };
    const signature = `${payload.enabled}:${payload.allowedKeys.join("|")}:${payload.allowedStatIds.join("|")}`;
    if (signature === runtime.bridgePayloadSignature) {
      return;
    }
    runtime.bridgePayloadSignature = signature;

    window.postMessage(
      {
        source: BRIDGE_SOURCE,
        type: BRIDGE_UPDATE_TYPE,
        payload
      },
      "*"
    );
  }

  function compareLookupLengthDesc(left, right) {
    return right.length - left.length;
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    if (element.getClientRects().length === 0) {
      return false;
    }
    return true;
  }
})();
