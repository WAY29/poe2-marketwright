(function () {
  if (window.__poe2MarketwrightPageBridgeLoaded) {
    return;
  }
  window.__poe2MarketwrightPageBridgeLoaded = true;

  const SOURCE = "poe2-marketwright";
  const UPDATE_TYPE = "POE2_MARKETWRIGHT_UPDATE";
  const TIER_UPDATE_TYPE = "POE2_MARKETWRIGHT_TIER_UPDATE";
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
  const ITEM_SEARCH_ROOT_SELECTOR =
    "#trade .top .search-panel > .search-bar:not(.search-advanced) .search-left .multiselect.search-select";
  const FILTERABLE_STAT_ID_RE = /^(?:pseudo|explicit|implicit|fractured|crafted|enchant|rune|desecrated|sanctum|skill)\./i;
  const TIER_FILTER_SELECTOR = "#trade .search-advanced-pane .filter";
  const TIER_CONTROL_CLASS = "poe2-marketwright-tier-control";
  const TIER_CONTROL_OPEN_CLASS = "poe2-marketwright-tier-control-open";
  const TIER_TRIGGER_CLASS = "poe2-marketwright-tier-trigger";
  const TIER_SELECT_CLASS = "poe2-marketwright-tier-select";

  const runtime = {
    app: null,
    originalKnownStats: null,
    lastPayload: {
      enabled: false,
      pobCopyEnabled: false,
      // Capture result details during initial content-script startup. Content state can disable this afterward.
      favoritesEnabled: true,
      currencyConversionEnabled: false,
      pageLanguage: "en",
      pageTranslationEnabled: false,
      filterOptionTexts: {},
      leagueOptionTexts: {},
      allowedKeys: [],
      allowedStatIds: [],
      allKeys: [],
      allStatIds: []
    },
    lastFilterStats: null,
    whitespaceSearchFocusBound: false,
    whitespaceSearchWatchers: new WeakSet(),
    whitespaceSearchUnderlines: new WeakMap(),
    tierMappings: {},
    tierPageLabels: {},
    tierPageId: null,
    tierEnabled: true,
    tierMode: "minimum",
    tierLabel: "Tier",
    tierOpenControl: null,
    tierOutsidePointerBound: false,
    tierObserver: null,
    tierRefreshTimer: null,
    tradeOptionOriginalTexts: new WeakMap()
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== SOURCE) {
      return;
    }

    if (event.data.type === TIER_UPDATE_TYPE) {
      const payload = event.data.payload || {};
      if (payload.tierMappings && typeof payload.tierMappings === "object") {
        runtime.tierMappings = payload.tierMappings;
      }
      runtime.tierPageLabels = payload.tierPageLabels || runtime.tierPageLabels;
      runtime.tierPageId = typeof payload.tierPageId === "string" ? payload.tierPageId : null;
      runtime.tierEnabled = payload.tierEnabled !== false;
      runtime.tierMode = payload.tierMode === "exact" ? "exact" : "minimum";
      if (typeof payload.tierLabel === "string" && payload.tierLabel) {
        runtime.tierLabel = payload.tierLabel;
      }
      installTierControls();
      scheduleTierControlRefresh();
      return;
    }

    if (event.data.type !== UPDATE_TYPE) {
      return;
    }

    runtime.lastPayload = { ...runtime.lastPayload, ...(event.data.payload || {}) };
    applyKnownStatsFilter();
    localizeTradeOptions();
    installWhitespaceSearch();
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
    localizeTradeOptions();
    installWhitespaceSearch();
    return true;
  }

  function localizeTradeOptions() {
    const payload = runtime.lastPayload || {};
    const language = String(payload.pageLanguage || "en");
    const locale = language.startsWith("zh_CN")
      ? "zh_CN"
      : language.startsWith("zh_TW")
        ? "zh_TW"
        : "en";
    const shouldTranslate = payload.pageTranslationEnabled !== false && locale !== "en";

    const filterOptionTexts = payload.filterOptionTexts || {};
    visitVueComponents(runtime.app, (component) => {
      for (const [property, translations] of [
        ["statusOptions", filterOptionTexts["status_filters/status"] || {}],
        ["leagueOptions", payload.leagueOptionTexts || {}]
      ]) {
        const options = component?.[property];
        if (!Array.isArray(options)) {
          continue;
        }
        for (const option of options) {
          if (!option || typeof option !== "object") {
            continue;
          }
          localizeTradeOptionText(option, translations, locale, shouldTranslate);
        }
      }
    });
    for (const group of runtime.app?.$data?.static_?.propertyFilters || []) {
      for (const filter of group?.filters || []) {
        const translations = filterOptionTexts[`${group?.id || ""}/${filter?.id || ""}`];
        for (const option of translations ? filter.option?.options || [] : []) {
          localizeTradeOptionText(option, translations, locale, shouldTranslate);
        }
      }
    }
  }

  function localizeTradeOptionText(option, translations, locale, shouldTranslate) {
    if (!option || typeof option !== "object") {
      return;
    }
    if (!runtime.tradeOptionOriginalTexts.has(option)) {
      runtime.tradeOptionOriginalTexts.set(option, String(option.text || ""));
    }
    const original = runtime.tradeOptionOriginalTexts.get(option) || "";
    const localized = translations[String(option.id || "")]?.[locale];
    const nextText = shouldTranslate && typeof localized === "string" && localized ? localized : original;
    if (option.text !== nextText) {
      option.text = nextText;
    }
  }

  function visitVueComponents(component, visitor, seen = new Set()) {
    if (!component || typeof component !== "object" || seen.has(component)) {
      return;
    }
    seen.add(component);
    visitor(component);
    for (const child of Array.isArray(component.$children) ? component.$children : []) {
      visitVueComponents(child, visitor, seen);
    }
  }

  function installWhitespaceSearch() {
    const document = window.document;
    if (!document) {
      return;
    }

    if (!runtime.whitespaceSearchFocusBound) {
      document.addEventListener(
        "focusin",
        (event) => patchWhitespaceSearchFilter(getVueComponentFromElement(event.target)),
        true
      );
      runtime.whitespaceSearchFocusBound = true;
    }

    patchWhitespaceSearchRefs(runtime.app);
  }

  function patchWhitespaceSearchRefs(component, seen = new Set()) {
    if (!component || typeof component !== "object" || seen.has(component)) {
      return;
    }
    seen.add(component);

    const searchRefs = component.$refs?.search;
    for (const search of Array.isArray(searchRefs) ? searchRefs : [searchRefs]) {
      patchWhitespaceSearchFilter(search);
    }
    for (const child of Array.isArray(component.$children) ? component.$children : []) {
      patchWhitespaceSearchRefs(child, seen);
    }
  }

  function getVueComponentFromElement(element) {
    for (let current = element; current; current = current.parentElement) {
      if (current.__vue__) {
        return current.__vue__;
      }
    }
    return null;
  }

  function installTierControls() {
    const document = window.document;
    if (!document?.documentElement) {
      return;
    }
    if (!runtime.tierOutsidePointerBound) {
      document.addEventListener(
        "pointerdown",
        (event) => {
          const control = runtime.tierOpenControl;
          if (control && !control.contains(event.target)) {
            setTierControlOpen(control, false);
          }
        },
        true
      );
      runtime.tierOutsidePointerBound = true;
    }
    if (runtime.tierObserver) {
      return;
    }
    runtime.tierObserver = new MutationObserver(scheduleTierControlRefresh);
    runtime.tierObserver.observe(document.querySelector("#trade") || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleTierControlRefresh() {
    if (runtime.tierRefreshTimer) {
      return;
    }
    runtime.tierRefreshTimer = window.setTimeout(() => {
      runtime.tierRefreshTimer = null;
      refreshTierControls();
    }, 50);
  }

  function refreshTierControls() {
    const document = window.document;
    if (!document?.querySelectorAll) {
      return;
    }
    for (const filterElement of document.querySelectorAll(TIER_FILTER_SELECTOR)) {
      const statId = getTierStatId(filterElement);
      const rangeInputs = filterElement.querySelectorAll("input.minmax");
      const minInput = rangeInputs[0] || null;
      const maxInput = rangeInputs[1] || null;
      const existing = filterElement.querySelector(`.${TIER_CONTROL_CLASS}`);
      const options = runtime.tierEnabled && statId ? getTierOptions(statId) : [];
      if (!minInput || !options.length) {
        removeTierControl(existing);
        continue;
      }
      const control = existing || createTierControl(document, filterElement, minInput);
      renderTierControl(control, minInput, maxInput, options);
    }
  }

  function getTierStatId(element) {
    let component = getVueComponentFromElement(element);
    while (component) {
      const statId = String(component.filter?.id || "");
      if (FILTERABLE_STAT_ID_RE.test(statId)) {
        return statId;
      }
      component = component.$parent;
    }
    return "";
  }

  function getTierOptions(statId) {
    const mappings = runtime.tierMappings || {};
    const pageIds = runtime.tierPageId ? [runtime.tierPageId] : Object.keys(mappings);
    return pageIds
      .flatMap((currentPageId) => {
        const tiers = mappings[currentPageId]?.[statId];
        return Array.isArray(tiers)
          ? tiers.map((tier) => ({
              ...tier,
              pageId: currentPageId,
              label: runtime.tierPageId
                ? `T${tier.tier}`
                : `${runtime.tierPageLabels[currentPageId] || currentPageId} T${tier.tier}`
            }))
          : [];
      })
      .sort((left, right) => left.pageId.localeCompare(right.pageId) || left.tier - right.tier);
  }

  function createTierControl(document, filterElement, minInput) {
    const control = document.createElement("span");
    control.className = TIER_CONTROL_CLASS;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = TIER_TRIGGER_CLASS;
    trigger.textContent = "T";
    trigger.setAttribute("aria-label", runtime.tierLabel);
    trigger.setAttribute("aria-expanded", "false");
    const select = document.createElement("select");
    select.className = TIER_SELECT_CLASS;
    select.setAttribute("aria-label", runtime.tierLabel);
    trigger.addEventListener("click", (event) => {
      event.preventDefault?.();
      setTierControlOpen(control, !control.classList.contains(TIER_CONTROL_OPEN_CLASS));
      select.focus?.();
    });
    select.addEventListener("change", () => {
      const selected = control.__poe2MarketwrightTierOptions?.find(
        (option) => getTierOptionValue(option) === select.value
      );
      if (selected) {
        applyTierSelection(control, selected);
      }
      setTierControlOpen(control, false);
    });
    control.appendChild(trigger);
    control.appendChild(select);
    const filterBody = filterElement.querySelector(".filter-body");
    if (filterBody) {
      filterElement.insertBefore(control, filterBody);
    } else {
      minInput.before(control);
    }
    return control;
  }

  function removeTierControl(control) {
    control?.remove();
  }

  function renderTierControl(control, minInput, maxInput, options) {
    const select = control.querySelector(`.${TIER_SELECT_CLASS}`);
    if (!select) {
      return;
    }
    const signature = options
      .map((option) => `${option.pageId}:${option.tier}:${option.min}:${option.exactMin}:${option.exactMax}:${option.label}`)
      .join("|");
    if (control.__poe2MarketwrightTierSignature !== signature) {
      select.replaceChildren();
      for (const option of options) {
        const element = select.ownerDocument.createElement("option");
        element.value = getTierOptionValue(option);
        element.textContent = option.label;
        select.appendChild(element);
      }
      control.__poe2MarketwrightTierSignature = signature;
    }
    control.__poe2MarketwrightTierOptions = options;
    select.size = Math.min(options.length, 8);
    if (control.__poe2MarketwrightTierMinInput !== minInput) {
      control.__poe2MarketwrightTierMinInput = minInput;
      bindTierInput(control, minInput);
    }
    if (control.__poe2MarketwrightTierMaxInput !== maxInput) {
      control.__poe2MarketwrightTierMaxInput = maxInput;
      if (maxInput) {
        bindTierInput(control, maxInput);
      }
    }
    if (control.classList.contains(TIER_CONTROL_OPEN_CLASS)) {
      return;
    }
    syncTierControlSelection(control);
  }

  function bindTierInput(control, input) {
    const sync = () => {
      if (!control.__poe2MarketwrightTierApplying) {
        control.__poe2MarketwrightTierSelectedOptionValue = "";
      }
      syncTierControlSelection(control);
    };
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
  }

  function applyTierSelection(control, option) {
    const exact = runtime.tierMode === "exact";
    control.__poe2MarketwrightTierSelectedOptionValue = getTierOptionValue(option);
    control.__poe2MarketwrightTierApplying = true;
    try {
      setTierInputValue(control.__poe2MarketwrightTierMinInput, exact ? option.exactMin : option.min);
      if (exact) {
        setTierInputValue(control.__poe2MarketwrightTierMaxInput, option.exactMax);
      }
    } finally {
      control.__poe2MarketwrightTierApplying = false;
    }
    syncTierControlSelection(control);
  }

  function setTierInputValue(input, value) {
    if (!input) {
      return;
    }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const text = value == null ? "" : String(value);
    if (setter) {
      setter.call(input, text);
    } else {
      input.value = text;
    }
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  }

  function syncTierControlSelection(control) {
    const select = control.querySelector(`.${TIER_SELECT_CLASS}`);
    const trigger = control.querySelector(`.${TIER_TRIGGER_CLASS}`);
    const options = control.__poe2MarketwrightTierOptions || [];
    const option = getTierOptionForInputs(control, options);
    select.value = option ? getTierOptionValue(option) : "";
    select.title = option ? `${runtime.tierLabel} ${option.label}` : runtime.tierLabel;
    if (trigger) {
      trigger.textContent = option ? `T${option.tier}` : "T";
      trigger.title = select.title;
    }
  }

  function getTierOptionForInputs(control, options) {
    const minInput = control.__poe2MarketwrightTierMinInput;
    const maxInput = control.__poe2MarketwrightTierMaxInput;
    if (runtime.tierMode === "exact") {
      const minimum = Number(minInput?.value);
      const maximum = Number(maxInput?.value);
      if (String(minInput?.value || "").trim() && String(maxInput?.value || "").trim()) {
        const exact = options.find(
          (option) => Number(option.exactMin) === minimum && Number(option.exactMax) === maximum
        );
        if (exact) {
          return exact;
        }
      }
    } else {
      const closest = getClosestTierOption(options, minInput?.value);
      if (closest) {
        return closest;
      }
    }
    const selectedValue = control.__poe2MarketwrightTierSelectedOptionValue;
    return options.find((option) => getTierOptionValue(option) === selectedValue) || null;
  }

  function setTierControlOpen(control, open) {
    if (open && runtime.tierOpenControl && runtime.tierOpenControl !== control) {
      runtime.tierOpenControl.classList.remove(TIER_CONTROL_OPEN_CLASS);
      runtime.tierOpenControl.querySelector(`.${TIER_TRIGGER_CLASS}`)?.setAttribute("aria-expanded", "false");
    }
    control.classList.toggle(TIER_CONTROL_OPEN_CLASS, open);
    control.querySelector(`.${TIER_TRIGGER_CLASS}`)?.setAttribute("aria-expanded", String(open));
    runtime.tierOpenControl = open ? control : runtime.tierOpenControl === control ? null : runtime.tierOpenControl;
  }

  function getClosestTierOption(options, value) {
    const rawValue = String(value ?? "").trim();
    const minimum = Number(rawValue);
    const optionsWithMinimum = options.filter((option) => Number.isFinite(Number(option.min)));
    if (!rawValue || !Number.isFinite(minimum) || !optionsWithMinimum.length) {
      return null;
    }
    return optionsWithMinimum.reduce((closest, option) => {
      if (!closest) {
        return option;
      }
      const distance = Math.abs(Number(option.min) - minimum);
      const closestDistance = Math.abs(Number(closest.min) - minimum);
      return distance < closestDistance || (distance === closestDistance && Number(option.min) > Number(closest.min))
        ? option
        : closest;
    }, null);
  }

  function getTierOptionValue(option) {
    return `${option.pageId}:${option.tier}`;
  }

  function isWhitespaceSearchTarget(component) {
    if (!component?._computedWatchers?.filteredOptions) {
      return false;
    }
    if (component.$el?.matches?.(ITEM_SEARCH_ROOT_SELECTOR)) {
      return true;
    }
    return hasFilterableStatOptions(component.options);
  }

  function hasFilterableStatOptions(options) {
    if (!Array.isArray(options)) {
      return false;
    }
    for (const option of options) {
      if (FILTERABLE_STAT_ID_RE.test(String(option?.id || ""))) {
        return true;
      }
      for (const entry of Array.isArray(option?.entries) ? option.entries : []) {
        if (FILTERABLE_STAT_ID_RE.test(String(entry?.id || ""))) {
          return true;
        }
      }
    }
    return false;
  }

  function getNativeWhitespaceSearchQuery(value) {
    const terms = getWhitespaceSearchTerms(value);
    return terms.length > 1 ? `~${terms.join(" ")}` : null;
  }

  function getWhitespaceSearchTerms(value) {
    const query = String(value || "");
    if (query.startsWith("~")) {
      return [];
    }
    return query
      .split(" ")
      .map((term) => term.trim())
      .filter(Boolean);
  }

  function patchWhitespaceSearchFilter(component) {
    if (!isWhitespaceSearchTarget(component)) {
      return false;
    }

    patchWhitespaceSearchUnderline(component);

    const watcher = component._computedWatchers.filteredOptions;
    if (runtime.whitespaceSearchWatchers.has(watcher) || typeof watcher.getter !== "function") {
      return runtime.whitespaceSearchWatchers.has(watcher);
    }

    const originalGetter = watcher.getter;
    watcher.getter = function (...args) {
      const target = typeof this?.search === "string" ? this : component;
      const replacement = getNativeWhitespaceSearchQuery(target.search);
      if (!replacement) {
        return originalGetter.apply(target, args);
      }
      try {
        return getWhitespaceSearchFilteredOptions(target, replacement);
      } catch (error) {
        return originalGetter.apply(target, args);
      }
    };
    runtime.whitespaceSearchWatchers.add(watcher);
    return true;
  }

  function getWhitespaceSearchFilteredOptions(component, query) {
    const search = String(component.search || "");
    const normalizedQuery = query.toLowerCase();
    let options = component.options.concat();

    if (component.internalSearch) {
      options = component.groupValues
        ? component.filterAndFlat(options, normalizedQuery, component.label)
        : options.filter((option) => matchesNativeSearch(component.customLabel(option, component.label), normalizedQuery));
      if (component.hideSelected) {
        options = options.filter(component.isNotSelected);
      }
    } else if (component.groupValues) {
      options = component.flatAndStrip(options);
    }

    const normalizedSearch = search.toLowerCase();
    if (component.taggable && normalizedSearch.length && !component.isExistingOption(normalizedSearch)) {
      options.unshift({ isTag: true, label: search });
    }
    return options.slice(0, component.optionsLimit);
  }

  function matchesNativeSearch(value, query) {
    const text = String(value === undefined ? "undefined" : value === null ? "null" : value === false ? "false" : value)
      .toLowerCase();
    if (query.startsWith("~")) {
      return query
        .slice(1)
        .split(" ")
        .every((term) => text.includes(term.trim()));
    }
    return text.includes(query.trim());
  }

  function patchWhitespaceSearchUnderline(component) {
    const seen = new Set();
    for (let owner = component; owner && !seen.has(owner); owner = owner.$parent) {
      seen.add(owner);
      patchWhitespaceSearchUnderlineOwner(owner, component);
    }
  }

  function patchWhitespaceSearchUnderlineOwner(owner, component) {
    const existing = runtime.whitespaceSearchUnderlines.get(owner);
    if (existing) {
      existing.targets.add(component);
      return;
    }

    const originalUnderline = owner.underline;
    if (typeof originalUnderline !== "function") {
      return;
    }
    const targets = new Set([component]);

    function whitespaceSearchUnderline(text, search) {
      const terms = getWhitespaceSearchTerms(search);
      if (terms.length < 2 || !text || !isWhitespaceSearchQueryForTarget(targets, search)) {
        return originalUnderline.apply(this, arguments);
      }

      const source = String(text);
      const normalized = source.toLowerCase();
      const normalizedTerms = Array.from(new Set(terms.map((term) => term.toLowerCase()))).sort(
        (left, right) => right.length - left.length
      );
      const escape = (value) => originalUnderline.call(this, value, "");
      let result = "";
      let plain = "";

      for (let index = 0; index < source.length;) {
        const match = normalizedTerms.find((term) => normalized.startsWith(term, index));
        if (!match) {
          plain += source[index];
          index += 1;
          continue;
        }
        result += escape(plain);
        result += `<strong>${escape(source.slice(index, index + match.length))}</strong>`;
        plain = "";
        index += match.length;
      }
      return `${result}${escape(plain)}`;
    }

    owner.underline = whitespaceSearchUnderline;
    runtime.whitespaceSearchUnderlines.set(owner, { targets });
  }

  function isWhitespaceSearchQueryForTarget(targets, search) {
    for (const target of targets) {
      if (target?.search === search) {
        return true;
      }
    }
    return false;
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
