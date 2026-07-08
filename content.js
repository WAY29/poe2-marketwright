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
  const LOOKUP_SPLIT_RE = /[\n\r|]+/;
  const NUMBER_RE = /([-+]?\d+(?:\.\d+)?)/g;

  const runtime = {
    data: null,
    state: { ...DEFAULT_STATE },
    allPatterns: new Set(),
    pagePatternCache: new Map(),
    logicalPatternCache: new Map(),
    activeSelection: null,
    observer: null,
    refreshTimer: null,
    ui: {}
  };

  bootstrap().catch((error) => {
    console.error("[PoE2 Marketwright] bootstrap failed", error);
  });

  async function bootstrap() {
    runtime.data = await loadData();
    runtime.allPatterns = new Set(runtime.data.allPatterns || []);
    runtime.state = await loadState();
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
      scheduleRefresh();
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
    const observer = new MutationObserver(() => {
      scheduleRefresh();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-expanded", "aria-selected", "value"]
    });
    runtime.observer = observer;

    document.addEventListener("input", scheduleRefresh, true);
    document.addEventListener("change", scheduleRefresh, true);
    document.addEventListener("focusin", scheduleRefresh, true);
    window.addEventListener("popstate", scheduleRefresh, true);
    window.addEventListener("hashchange", scheduleRefresh, true);
    setInterval(scheduleRefresh, 1200);
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

  function refreshFiltering() {
    unhideAllFilteredOptions();

    const activeSelection = resolveActiveSelection();
    runtime.activeSelection = activeSelection;

    const allowedPatterns = getAllowedPatterns(activeSelection);
    updatePanel(activeSelection, allowedPatterns);

    if (!runtime.state.enabled || !allowedPatterns) {
      return;
    }

    const groups = findFilterableOptionGroups();
    for (const group of groups) {
      filterOptionGroup(group, allowedPatterns);
    }
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
    const texts = collectCandidateTexts();
    let bestItem = null;
    let bestCategory = null;

    for (const text of texts) {
      for (const segment of splitCandidateText(text)) {
        const itemSlug = runtime.data.itemNameToPage[segment];
        if (itemSlug) {
          if (!bestItem || segment.length > bestItem.match.length) {
            bestItem = {
              kind: "page",
              id: itemSlug,
              source: "item",
              match: segment
            };
          }
        }

        const category = runtime.data.categoryAliasToSelection[segment];
        if (category) {
          if (!bestCategory || segment.length > bestCategory.match.length) {
            bestCategory = {
              kind: category.kind,
              id: category.id,
              source: "category",
              match: segment
            };
          }
        }
      }
    }

    return bestItem || bestCategory || null;
  }

  function collectCandidateTexts() {
    const texts = new Set();
    const selectors = [
      "input",
      "textarea",
      "button",
      "[role='button']",
      "[role='combobox']",
      "[role='option'][aria-selected='true']",
      "[aria-haspopup='listbox']",
      "[contenteditable='true']",
      "label"
    ];

    for (const element of document.querySelectorAll(selectors.join(","))) {
      if (!isVisible(element) || runtime.ui.root.contains(element)) {
        continue;
      }

      const rawValues = [
        element.value,
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.textContent
      ];

      for (const rawValue of rawValues) {
        if (!rawValue) {
          continue;
        }
        const text = String(rawValue).trim();
        if (text) {
          texts.add(text);
        }
      }
    }

    return texts;
  }

  function splitCandidateText(text) {
    const cleaned = String(text).replace(/\u00a0/g, " ").trim();
    const parts = new Set();

    for (const chunk of cleaned.split(LOOKUP_SPLIT_RE)) {
      const trimmed = normalizeLookupText(chunk);
      if (trimmed) {
        parts.add(trimmed);
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
        runtime.pagePatternCache.set(selection.id, new Set(record ? record.allowedPatterns : []));
      }
      return runtime.pagePatternCache.get(selection.id);
    }

    if (selection.kind === "logical") {
      if (!runtime.logicalPatternCache.has(selection.id)) {
        const record = runtime.data.logicalCategories[selection.id];
        runtime.logicalPatternCache.set(selection.id, new Set(record ? record.allowedPatterns : []));
      }
      return runtime.logicalPatternCache.get(selection.id);
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
    runtime.ui.meta.textContent = `可用词条模式 ${patternCount} 条`;
  }

  function unhideAllFilteredOptions() {
    for (const element of document.querySelectorAll(`.${HIDDEN_CLASS}`)) {
      element.classList.remove(HIDDEN_CLASS);
    }
  }

  function findFilterableOptionGroups() {
    const roots = new Set();
    const roleOptions = document.querySelectorAll("[role='option'], [role='menuitem']");

    for (const option of roleOptions) {
      if (!isVisible(option) || runtime.ui.root.contains(option)) {
        continue;
      }
      const pattern = canonicalizeStatText(option.textContent || "");
      if (!runtime.allPatterns.has(pattern)) {
        continue;
      }
      const root = findOptionRoot(option);
      if (root) {
        roots.add(root);
      }
    }

    for (const root of document.querySelectorAll("[role='listbox'], [role='menu']")) {
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
      const semantic = current.getAttribute("role") === "listbox" || current.getAttribute("role") === "menu";
      if (positioned || semantic) {
        return current;
      }
    }
    return null;
  }

  function getOptionElements(root, quickMode) {
    let options = Array.from(root.querySelectorAll("[role='option'], [role='menuitem']"));
    if (!options.length) {
      options = Array.from(root.querySelectorAll("li, button"));
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

  function filterOptionGroup(root, allowedPatterns) {
    const options = getOptionElements(root, false);
    if (options.length < 3) {
      return;
    }

    let affixOptionCount = 0;
    for (const option of options) {
      const pattern = canonicalizeStatText(getOptionText(option));
      if (runtime.allPatterns.has(pattern)) {
        affixOptionCount += 1;
      }
    }

    if (affixOptionCount < 2) {
      return;
    }

    for (const option of options) {
      const pattern = canonicalizeStatText(getOptionText(option));
      if (!runtime.allPatterns.has(pattern)) {
        continue;
      }
      option.classList.toggle(HIDDEN_CLASS, !allowedPatterns.has(pattern));
    }
  }

  function canonicalizeStatText(text) {
    return String(text)
      .replace(/\u00a0/g, " ")
      .replace(/[−–—]/g, "-")
      .replace(NUMBER_RE, "#")
      .replace(/\(\s*#\s*-\s*#\s*\)/g, "#")
      .replace(/#\s*-\s*#/g, "#")
      .replace(/\+#/g, "#")
      .replace(/\(#\)/g, "#")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getOptionText(element) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
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
