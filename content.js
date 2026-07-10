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
    filteringEnabled: true,
    pobCopyEnabled: true,
    currencyConversionEnabled: true,
    favoritesEnabled: true,
    favorites: [],
    favoritesDrawerOpen: false,
    selection: "auto",
    collapsed: false,
    panelPosition: null,
    collapsedPosition: null
  };
  const ROOT_ID = "poe2-trade2-affix-filter-root";
  const COLLAPSED_PANEL_SIZE = 36;
  const HIDDEN_CLASS = "poe2-trade2-affix-filter-hidden";
  const BRIDGE_SCRIPT_ID = "poe2-marketwright-page-bridge";
  const BRIDGE_SOURCE = "poe2-marketwright";
  const BRIDGE_UPDATE_TYPE = "POE2_MARKETWRIGHT_UPDATE";
  const BRIDGE_READY_TYPE = "POE2_MARKETWRIGHT_READY";
  const BRIDGE_STATE_TYPE = "POE2_MARKETWRIGHT_STATE";
  const TRADE_ROOT_SELECTOR = "#trade";
  const LOCALIZED_ALIAS_LOCALES = ["zh_CN", "zh_TW"];
  const ITEM_SEARCH_ROOT_SELECTOR =
    "#trade .top .search-panel > .search-bar:not(.search-advanced) .search-left .multiselect.search-select";
  const ITEM_SEARCH_INPUT_SELECTOR = `${ITEM_SEARCH_ROOT_SELECTOR} input.multiselect__input`;
  const TYPE_FILTER_GROUP_SELECTOR = "#trade .search-advanced-pane.blue > .filter-group";
  const FAVORITE_TRADE_CATEGORY_BY_PAGE = Object.freeze({
    Strongbox: "map",
    Relics: "sanctum.relic",
    Inscribed_Ultimatum: "map.ultimatum",
    Claws: "weapon.claw",
    Daggers: "weapon.dagger",
    Wands: "weapon.wand",
    One_Hand_Swords: "weapon.onesword",
    One_Hand_Axes: "weapon.oneaxe",
    One_Hand_Maces: "weapon.onemace",
    Sceptres: "weapon.sceptre",
    Spears: "weapon.spear",
    Flails: "weapon.flail",
    Bows: "weapon.bow",
    Staves: "weapon.staff",
    Two_Hand_Swords: "weapon.twosword",
    Two_Hand_Axes: "weapon.twoaxe",
    Two_Hand_Maces: "weapon.twomace",
    Quarterstaves: "weapon.warstaff",
    Crossbows: "weapon.crossbow",
    Traps: "weapon",
    Talismans: "weapon.talisman",
    Amulets: "accessory.amulet",
    Rings: "accessory.ring",
    Belts: "accessory.belt",
    Gloves_str: "armour.gloves",
    Gloves_dex: "armour.gloves",
    Gloves_int: "armour.gloves",
    Gloves_str_dex: "armour.gloves",
    Gloves_str_int: "armour.gloves",
    Gloves_dex_int: "armour.gloves",
    Boots_str: "armour.boots",
    Boots_dex: "armour.boots",
    Boots_int: "armour.boots",
    Boots_str_dex: "armour.boots",
    Boots_str_int: "armour.boots",
    Boots_dex_int: "armour.boots",
    Body_Armours_str: "armour.chest",
    Body_Armours_dex: "armour.chest",
    Body_Armours_int: "armour.chest",
    Body_Armours_str_dex: "armour.chest",
    Body_Armours_str_int: "armour.chest",
    Body_Armours_dex_int: "armour.chest",
    Body_Armours_str_dex_int: "armour.chest",
    Helmets_str: "armour.helmet",
    Helmets_dex: "armour.helmet",
    Helmets_int: "armour.helmet",
    Helmets_str_dex: "armour.helmet",
    Helmets_str_int: "armour.helmet",
    Helmets_dex_int: "armour.helmet",
    Quivers: "armour.quiver",
    Shields_str: "armour.shield",
    Shields_str_dex: "armour.shield",
    Shields_str_int: "armour.shield",
    Bucklers: "armour.buckler",
    Foci: "armour.focus",
    Ruby: "jewel",
    Emerald: "jewel",
    Sapphire: "jewel",
    Diamond: "jewel",
    "Time-Lost_Ruby": "jewel",
    "Time-Lost_Emerald": "jewel",
    "Time-Lost_Sapphire": "jewel",
    "Time-Lost_Diamond": "jewel",
    Life_Flasks: "flask.life",
    Mana_Flasks: "flask.mana",
    Charms: "flask.charm",
    Urn_Relic: "sanctum.relic",
    Amphora_Relic: "sanctum.relic",
    Vase_Relic: "sanctum.relic",
    Seal_Relic: "sanctum.relic",
    Coffer_Relic: "sanctum.relic",
    Tapestry_Relic: "sanctum.relic",
    Incense_Relic: "sanctum.relic",
    Breach_Tablet: "map.tablet",
    Expedition_Tablet: "map.tablet",
    Delirium_Tablet: "map.tablet",
    Ritual_Tablet: "map.tablet",
    Irradiated_Tablet: "map.tablet",
    Overseer_Tablet: "map.tablet",
    Abyss_Tablet: "map.tablet",
    Temple_Tablet: "map.tablet",
    Waystones_low_tier: "map.waystone",
    Waystones_mid_tier: "map.waystone",
    Waystones_top_tier: "map.waystone"
  });
  const FAVORITE_TRADE_CATEGORY_LABELS = Object.freeze({
    map: "Any Endgame Item",
    "map.ultimatum": "Ultimatum Key",
    "sanctum.relic": "Relic",
    "weapon.claw": "Claw",
    "weapon.dagger": "Dagger",
    "weapon.wand": "Wand",
    "weapon.onesword": "One-Handed Sword",
    "weapon.oneaxe": "One-Handed Axe",
    "weapon.onemace": "One-Handed Mace",
    "weapon.sceptre": "Sceptre",
    "weapon.spear": "Spear",
    "weapon.flail": "Flail",
    "weapon.bow": "Bow",
    "weapon.staff": "Staff",
    "weapon.twosword": "Two-Handed Sword",
    "weapon.twoaxe": "Two-Handed Axe",
    "weapon.twomace": "Two-Handed Mace",
    "weapon.warstaff": "Quarterstaff",
    "weapon.crossbow": "Crossbow",
    weapon: "Any Weapon",
    "weapon.talisman": "Talisman",
    "accessory.amulet": "Amulet",
    "accessory.ring": "Ring",
    "accessory.belt": "Belt",
    "armour.gloves": "Gloves",
    "armour.boots": "Boots",
    "armour.chest": "Body Armour",
    "armour.helmet": "Helmet",
    "armour.quiver": "Quiver",
    "armour.shield": "Shield",
    "armour.buckler": "Buckler",
    "armour.focus": "Focus",
    jewel: "Jewel",
    "flask.life": "Life Flask",
    "flask.mana": "Mana Flask",
    "flask.charm": "Charm",
    "map.tablet": "Tablet",
    "map.waystone": "Waystone"
  });
  const LOOKUP_SPLIT_RE = /[\n\r|]+/;
  const NUMBER_RE = /([-+]?\d+(?:\.\d+)?)/g;
  const STAT_GROUP_PREFIX_RE =
    /^(pseudo|explicit|implicit|fractured|crafted|enchant|rune|augment|desecrated|sanctum|skill)\s*[:：-]?\s*/i;
  const PSEUDO_STAT_GROUP_PREFIX_RE = /^pseudo\s*[:：-]?\s*/i;
  const PSEUDO_STAT_ID_RE = /\bpseudo\.[\w.-]+\b/i;
  const TRADE_STAT_ID_RE =
    /\b(?:pseudo|explicit|implicit|fractured|crafted|enchant|rune|desecrated|sanctum|skill)\.[\w.|-]+\b/i;
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
  const I18N_FALLBACKS = {
    actionTitle: "PoE2 Marketwright",
    autoDetect: "Auto detect",
    selectionGroupTypes: "Types",
    selectionGroupExactBases: "Exact bases",
    collapsePanel: "Collapse panel",
    expandPanel: "Expand panel",
    statusOff: "Off",
    statusAutoUnknown: "Auto: Unknown",
    statusSelection: "$1: $2",
    selectionSourceAuto: "Auto",
    selectionSourceManual: "Manual",
    statsText: "Available $1 / Keep $2 / Ignore $3",
    statFilterTitle: "Stat filter",
    pobCopyTitle: "PoB Copy Button",
    currencyConversionTitle: "Price Conversion",
    toggleOn: "ON",
    toggleOff: "OFF",
    enableFiltering: "Enable filtering",
    disableFiltering: "Disable filtering",
    enablePobCopy: "Enable PoB copy button",
    disablePobCopy: "Disable PoB copy button",
    favoritesTitle: "Favorites",
    enableFavorites: "Enable favorites",
    disableFavorites: "Disable favorites",
    enableCurrencyConversion: "Enable price conversion",
    disableCurrencyConversion: "Disable price conversion",
    refreshCurrencyConversion: "Refresh Poe2Scout prices",
    showExalted: "Show in Exalted Orbs",
    showChaos: "Show in Chaos Orbs",
    showDivine: "Show in Divine Orbs",
    currencyExalted: "Exalted Orb",
    currencyChaos: "Chaos Orb",
    currencyDivine: "Divine Orb",
    currencyLoading: "Loading...",
    currencyUnavailable: "Rate unavailable",
    currencyLeague: "League: $1",
    currencyLeagueUnavailable: "League: unavailable",
    pobCopyReady: "PoB Copy",
    pobCopyLoading: "Loading...",
    pobCopyOk: "Copied!",
    pobCopyError: "Failed",
    toggleFavoritesDrawer: "Toggle favorites",
    expandFavoritesDrawer: "Expand favorites",
    collapseFavoritesDrawer: "Collapse favorites",
    favoritesSearch: "Search favorites",
    favoritesLeague: "Favorites: $1",
    favoritesLeagueUnavailable: "Favorites: league unavailable",
    favoritesEmpty: "No favorites in this league",
    favoritesNoMatches: "No matching favorites",
    favoriteMoreMods: "+$1 more",
    renameFavorite: "Rename favorite",
    deleteFavorite: "Delete favorite",
    undoFavoriteDelete: "Undo",
    favoriteDeleted: "Favorite deleted",
    favoriteSearchLoading: "Creating search...",
    favoriteSearchError: "Search failed. Retry.",
    favoriteSave: "Save favorite",
    favoriteRemove: "Remove favorite",
    favoriteLoading: "Loading item...",
    favoriteSaved: "Saved",
    favoriteRemoved: "Removed",
    favoriteError: "Unable to save favorite",
    closeFavoritesDrawer: "Close favorites",
    favoriteTooltipRarity: "Rarity: $1"
  };
  const EXTENSION_CONTEXT_INVALIDATED_RE = /extension context invalidated|context invalidated|message port closed/i;

  const runtime = {
    data: null,
    state: { ...DEFAULT_STATE },
    allPatterns: new Set(),
    allStatIds: new Set(),
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
    selectionSignature: "",
    selectionPollTimer: null,
    bridgeStats: null,
    bridgePayloadSignature: "",
    lastFilterStats: null,
    favoriteLeague: null,
    pobCopy: null,
    favorites: null,
    currencyConversion: null,
    deletedFavorite: null,
    deletedFavoriteTimer: null,
    ui: {}
  };

  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));

  async function bootstrap() {
    runtime.state = await loadState();
    initializePobCopy();
    initializeFavorites();
    initializeCurrencyConversion();
    bindPageBridgeMessages();
    injectPageBridge();

    runtime.data = await loadData();
    runtime.allPatterns = new Set((runtime.data.allPatterns || []).map(normalizeStatKey).filter(Boolean));
    runtime.allStatIds = new Set((runtime.data.allStatIds || []).map(String).filter(Boolean));
    runtime.itemLookupEntries = Array.from(
      new Set([
        ...Object.keys(runtime.data.itemNameToSelection || {}),
        ...Object.keys(runtime.data.itemNameToPage || {})
      ])
    ).sort(compareLookupLengthDesc);
    const localizedAliasMessages = await loadLocalizedAliasMessages();
    runtime.categoryAliasToSelection = buildExpandedCategoryAliasMap(runtime.data.categoryAliasToSelection || {});
    addLocalizedSelectionAliases(localizedAliasMessages);
    runtime.categoryLookupEntries = Object.keys(runtime.categoryAliasToSelection).sort(compareLookupLengthDesc);
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

  async function loadLocalizedAliasMessages() {
    const messagesByLocale = {};
    await Promise.all(
      LOCALIZED_ALIAS_LOCALES.map(async (locale) => {
        try {
          const response = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
          if (response.ok) {
            messagesByLocale[locale] = await response.json();
          }
        } catch (error) {
          console.debug(`[PoE2 Marketwright] unable to load ${locale} aliases`, error);
        }
      })
    );
    return messagesByLocale;
  }

  async function loadState() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const savedState = stored[STORAGE_KEY] || {};
    return {
      ...DEFAULT_STATE,
      ...savedState,
      favoritesEnabled:
        typeof savedState.favoritesEnabled === "boolean"
          ? savedState.favoritesEnabled
          : DEFAULT_STATE.favoritesEnabled,
      favorites: Array.isArray(savedState.favorites) ? savedState.favorites : [],
      favoritesDrawerOpen:
        typeof savedState.favoritesDrawerOpen === "boolean"
          ? savedState.favoritesDrawerOpen
          : DEFAULT_STATE.favoritesDrawerOpen,
      filteringEnabled:
        typeof savedState.filteringEnabled === "boolean"
          ? savedState.filteringEnabled
          : typeof savedState.enabled === "boolean"
            ? savedState.enabled
            : DEFAULT_STATE.filteringEnabled
    };
  }

  async function saveState() {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: runtime.state
      });
      return true;
    } catch (error) {
      if (isExtensionContextInvalidated(error)) {
        return false;
      }
      throw error;
    }
  }

  function isExtensionContextInvalidated(error) {
    return EXTENSION_CONTEXT_INVALIDATED_RE.test(String(error?.message || error || ""));
  }

  function handleAsyncError(error, operation) {
    if (isExtensionContextInvalidated(error)) {
      return;
    }
    console.error(`[PoE2 Marketwright] ${operation} failed`, {
      error,
      message: error?.message || String(error),
      requestedLeague: error?.requestedLeague || error?.details?.requestedLeague || null,
      searchUrl: error?.searchUrl || error?.details?.searchUrl || null,
      details: error?.details || null
    });
  }

  function runAsync(task, operation) {
    Promise.resolve().then(task).catch((error) => handleAsyncError(error, operation));
  }

  function mountPanel() {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <aside class="poe2-marketwright-favorites-drawer" aria-live="polite">
        <div class="poe2-marketwright-favorites-header">
          <div class="poe2-marketwright-favorites-header-row">
            <span id="poe2-marketwright-favorites-league" class="poe2-marketwright-favorites-league"></span>
            <button id="poe2-marketwright-favorites-close" class="poe2-marketwright-favorites-close" type="button" aria-label="" title="">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M4 4l8 8m0-8l-8 8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"></path>
              </svg>
            </button>
          </div>
          <label class="poe2-marketwright-favorites-search-field">
            <input id="poe2-marketwright-favorites-search" type="search" autocomplete="off" spellcheck="false">
          </label>
        </div>
        <div id="poe2-marketwright-favorites-list" class="poe2-marketwright-favorites-list"></div>
        <div id="poe2-marketwright-favorites-undo" class="poe2-marketwright-favorites-undo" hidden>
          <span id="poe2-marketwright-favorites-undo-text"></span>
          <button id="poe2-marketwright-favorites-undo-button" type="button"></button>
        </div>
      </aside>
      <div class="poe2-trade2-affix-filter-panel">
        <div class="poe2-trade2-affix-filter-header">
          <span class="poe2-trade2-affix-filter-brand" aria-hidden="true">M</span>
          <button id="poe2-trade2-affix-filter-collapse" class="poe2-trade2-affix-filter-collapse-toggle" type="button" aria-label="" title="">
            <svg class="poe2-trade2-affix-filter-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M5 3l5 5-5 5V3z"></path>
            </svg>
          </button>
        </div>
        <section class="poe2-trade2-affix-filter-feature poe2-trade2-affix-filter-stat-feature">
          <div class="poe2-trade2-affix-filter-feature-header">
            <span id="poe2-trade2-affix-filter-stat-title" class="poe2-trade2-affix-filter-feature-title"></span>
            <button id="poe2-trade2-affix-filter-enabled" class="poe2-trade2-affix-filter-toggle poe2-trade2-affix-filter-feature-toggle" type="button"></button>
          </div>
          <div id="poe2-trade2-affix-filter-status" class="poe2-trade2-affix-filter-status"></div>
          <label class="poe2-trade2-affix-filter-field">
            <select id="poe2-trade2-affix-filter-selection"></select>
          </label>
          <div id="poe2-trade2-affix-filter-meta" class="poe2-trade2-affix-filter-meta"></div>
        </section>
        <section class="poe2-trade2-affix-filter-feature poe2-trade2-affix-filter-pob-feature">
          <div class="poe2-trade2-affix-filter-feature-header">
            <span id="poe2-trade2-affix-filter-pob-title" class="poe2-trade2-affix-filter-feature-title"></span>
            <button id="poe2-trade2-affix-filter-pob-enabled" class="poe2-trade2-affix-filter-toggle poe2-trade2-affix-filter-feature-toggle" type="button"></button>
          </div>
        </section>
        <section class="poe2-trade2-affix-filter-feature poe2-marketwright-favorites-feature">
          <button id="poe2-marketwright-favorites-disclosure" class="poe2-marketwright-favorites-disclosure" type="button" aria-label="" title="">
            <span id="poe2-marketwright-favorites-title" class="poe2-trade2-affix-filter-feature-title"></span>
          </button>
          <button id="poe2-marketwright-favorites-enabled" class="poe2-trade2-affix-filter-toggle poe2-trade2-affix-filter-feature-toggle" type="button"></button>
        </section>
        <section class="poe2-trade2-affix-filter-feature poe2-trade2-affix-filter-currency-feature">
          <div class="poe2-trade2-affix-filter-feature-header">
            <span id="poe2-trade2-affix-filter-currency-title" class="poe2-trade2-affix-filter-feature-title"></span>
            <button id="poe2-trade2-affix-filter-currency-refresh" class="poe2-trade2-affix-filter-currency-refresh" type="button" aria-label="" title="">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M13.5 4.5V1.75l-1.2 1.2A5.5 5.5 0 1 0 13.2 9h-1.6a4 4 0 1 1-.5-4.9L9.7 5.5h3.8z"></path>
              </svg>
            </button>
            <button id="poe2-trade2-affix-filter-currency-enabled" class="poe2-trade2-affix-filter-toggle poe2-trade2-affix-filter-feature-toggle" type="button"></button>
          </div>
          <div id="poe2-trade2-affix-filter-currency-league" class="poe2-trade2-affix-filter-currency-league" aria-live="polite"></div>
        </section>
      </div>
      <button id="poe2-trade2-affix-filter-expand" class="poe2-trade2-affix-filter-collapsed-button" type="button" aria-label="" title="">
        <span class="poe2-trade2-affix-filter-mark" aria-hidden="true">M</span>
      </button>
    `;

    document.documentElement.appendChild(root);

    runtime.ui.root = root;
    runtime.ui.panel = root.querySelector(".poe2-trade2-affix-filter-panel");
    runtime.ui.favoritesDrawer = root.querySelector(".poe2-marketwright-favorites-drawer");
    runtime.ui.favoritesClose = root.querySelector("#poe2-marketwright-favorites-close");
    runtime.ui.favoritesDisclosure = root.querySelector("#poe2-marketwright-favorites-disclosure");
    runtime.ui.favoritesEnabled = root.querySelector("#poe2-marketwright-favorites-enabled");
    runtime.ui.favoritesLeague = root.querySelector("#poe2-marketwright-favorites-league");
    runtime.ui.favoritesSearch = root.querySelector("#poe2-marketwright-favorites-search");
    runtime.ui.favoritesList = root.querySelector("#poe2-marketwright-favorites-list");
    runtime.ui.favoritesUndo = root.querySelector("#poe2-marketwright-favorites-undo");
    runtime.ui.favoritesUndoText = root.querySelector("#poe2-marketwright-favorites-undo-text");
    runtime.ui.favoritesUndoButton = root.querySelector("#poe2-marketwright-favorites-undo-button");
    runtime.ui.collapse = root.querySelector("#poe2-trade2-affix-filter-collapse");
    runtime.ui.expand = root.querySelector("#poe2-trade2-affix-filter-expand");
    runtime.ui.enabled = root.querySelector("#poe2-trade2-affix-filter-enabled");
    runtime.ui.pobEnabled = root.querySelector("#poe2-trade2-affix-filter-pob-enabled");
    runtime.ui.currencyEnabled = root.querySelector("#poe2-trade2-affix-filter-currency-enabled");
    runtime.ui.currencyRefresh = root.querySelector("#poe2-trade2-affix-filter-currency-refresh");
    runtime.ui.currencyLeague = root.querySelector("#poe2-trade2-affix-filter-currency-league");
    runtime.ui.statTitle = root.querySelector("#poe2-trade2-affix-filter-stat-title");
    runtime.ui.pobTitle = root.querySelector("#poe2-trade2-affix-filter-pob-title");
    runtime.ui.favoritesTitle = root.querySelector("#poe2-marketwright-favorites-title");
    runtime.ui.currencyTitle = root.querySelector("#poe2-trade2-affix-filter-currency-title");
    runtime.ui.selection = root.querySelector("#poe2-trade2-affix-filter-selection");
    runtime.ui.status = root.querySelector("#poe2-trade2-affix-filter-status");
    runtime.ui.meta = root.querySelector("#poe2-trade2-affix-filter-meta");
    runtime.ui.dragHandle = root.querySelector(".poe2-trade2-affix-filter-header");

    updateStaticUiText();
    const leagueContext = runtime.currencyConversion?.getActiveLeagueContext?.();
    updateCurrencyLeague(leagueContext?.league, leagueContext?.searchUrl);
    populateSelectionOptions(runtime.ui.selection);

    runtime.ui.selection.value = runtime.state.selection;
    updateToggleButton();
    renderFavoriteDrawer();
    applyFavoritesDrawerState();
    applyPanelCollapsed();
    applyPanelPosition();
    bindPanelDrag();

    runtime.ui.collapse.addEventListener("click", () => {
      runAsync(() => setPanelCollapsed(true), "collapse panel");
    });

    runtime.ui.expand.addEventListener("click", () => {
      if (runtime.ui.suppressExpandClick) {
        return;
      }
      runAsync(() => setPanelCollapsed(false), "expand panel");
    });

    runtime.ui.favoritesDisclosure.addEventListener("click", () => {
      runAsync(
        () => setFavoritesDrawerOpen(!runtime.state.favoritesDrawerOpen),
        "toggle favorites drawer"
      );
    });

    runtime.ui.favoritesClose.addEventListener("click", () => {
      runAsync(() => setFavoritesDrawerOpen(false), "close favorites drawer");
    });

    runtime.ui.favoritesSearch.addEventListener("input", renderFavoriteDrawer);
    runtime.ui.favoritesUndoButton.addEventListener("click", () => {
      runAsync(undoDeletedFavorite, "undo favorite deletion");
    });

    runtime.ui.enabled.addEventListener("click", () => {
      runtime.state.filteringEnabled = !runtime.state.filteringEnabled;
      runAsync(async () => {
        await saveState();
        scheduleRefresh();
      }, "toggle stat filtering");
    });

    runtime.ui.pobEnabled.addEventListener("click", () => {
      runtime.state.pobCopyEnabled = !runtime.state.pobCopyEnabled;
      runtime.pobCopy?.setEnabled(runtime.state.pobCopyEnabled);
      updatePobCopyToggleButton();
      runAsync(async () => {
        await saveState();
        scheduleRefresh();
      }, "toggle PoB copy");
    });

    runtime.ui.favoritesEnabled.addEventListener("click", () => {
      runtime.state.favoritesEnabled = !runtime.state.favoritesEnabled;
      runtime.favorites?.setEnabled(runtime.state.favoritesEnabled);
      if (!runtime.state.favoritesEnabled) {
        runtime.state.favoritesDrawerOpen = false;
      }
      updateFavoritesToggleButton();
      applyFavoritesDrawerState();
      runAsync(async () => {
        await saveState();
        scheduleRefresh();
      }, "toggle favorites");
    });

    runtime.ui.currencyEnabled.addEventListener("click", () => {
      runtime.state.currencyConversionEnabled = !runtime.state.currencyConversionEnabled;
      runtime.currencyConversion?.setEnabled(runtime.state.currencyConversionEnabled);
      updateCurrencyConversionToggleButton();
      runAsync(async () => {
        await saveState();
        scheduleRefresh();
      }, "toggle currency conversion");
    });

    runtime.ui.currencyRefresh.addEventListener("click", () => {
      if (runtime.ui.currencyRefresh.disabled) {
        return;
      }
      runtime.ui.currencyRefresh.disabled = true;
      runtime.ui.currencyRefresh.dataset.loading = "true";
      runAsync(async () => {
        try {
          await runtime.currencyConversion?.refresh();
        } finally {
          runtime.ui.currencyRefresh.disabled = false;
          delete runtime.ui.currencyRefresh.dataset.loading;
        }
      }, "refresh currency conversion");
    });

    runtime.ui.selection.addEventListener("change", () => {
      runtime.state.selection = runtime.ui.selection.value;
      runAsync(async () => {
        await saveState();
        scheduleRefreshAfterDomUpdate();
      }, "change stat selection");
    });
  }

  function updateStaticUiText() {
    runtime.ui.collapse.setAttribute("aria-label", t("collapsePanel"));
    runtime.ui.collapse.title = t("collapsePanel");
    runtime.ui.expand.setAttribute("aria-label", t("expandPanel"));
    runtime.ui.expand.title = t("expandPanel");
    runtime.ui.statTitle.textContent = t("statFilterTitle");
    runtime.ui.pobTitle.textContent = t("pobCopyTitle");
    runtime.ui.favoritesTitle.textContent = t("favoritesTitle");
    runtime.ui.currencyTitle.textContent = t("currencyConversionTitle");
    runtime.ui.currencyRefresh.setAttribute("aria-label", t("refreshCurrencyConversion"));
    runtime.ui.currencyRefresh.title = t("refreshCurrencyConversion");
    runtime.ui.favoritesSearch.placeholder = t("favoritesSearch");
    runtime.ui.favoritesSearch.setAttribute("aria-label", t("favoritesSearch"));
    runtime.ui.favoritesUndoText.textContent = t("favoriteDeleted");
    runtime.ui.favoritesUndoButton.textContent = t("undoFavoriteDelete");
    runtime.ui.favoritesUndoButton.title = t("undoFavoriteDelete");
    runtime.ui.favoritesClose.setAttribute("aria-label", t("closeFavoritesDrawer"));
    runtime.ui.favoritesClose.title = t("closeFavoritesDrawer");
    applyFavoritesDrawerState();
  }

  function updateCurrencyLeague(league, searchUrl = null) {
    if (!runtime.ui.currencyLeague) {
      return;
    }
    const detected = typeof league === "string" && league.trim() ? league.trim() : null;
    runtime.ui.currencyLeague.textContent = detected ? t("currencyLeague", detected) : t("currencyLeagueUnavailable");
    runtime.ui.currencyLeague.title = searchUrl || "";
    runtime.ui.currencyLeague.dataset.state = detected ? "ready" : "unavailable";
  }

  function initializePobCopy() {
    const factory = globalThis.Poe2MarketwrightPobCopy?.createPobCopyFeature;
    if (!factory) {
      return;
    }

    runtime.pobCopy = factory({
      enabled: runtime.state.pobCopyEnabled,
      labels: {
        ready: t("pobCopyReady"),
        loading: t("pobCopyLoading"),
        ok: t("pobCopyOk"),
        error: t("pobCopyError")
      }
    });
    runtime.pobCopy.start();
  }

  function initializeFavorites() {
    const factory = globalThis.Poe2MarketwrightFavorites?.createFavoriteFeature;
    if (!factory) {
      return;
    }

    runtime.favorites = factory({
      enabled: runtime.state.favoritesEnabled,
      favorites: runtime.state.favorites,
      getFavorites: () => runtime.state.favorites,
      getLeague: getCurrentFavoriteLeague,
      getItemClassification: getFavoriteItemClassification,
      onToggleFavorite: toggleFavorite,
      labels: {
        add: t("favoriteSave"),
        remove: t("favoriteRemove"),
        loading: t("favoriteLoading"),
        saved: t("favoriteSaved"),
        removed: t("favoriteRemoved"),
        error: t("favoriteError")
      }
    });
    runtime.favorites.start();
  }

  function initializeCurrencyConversion() {
    const factory = globalThis.Poe2MarketwrightCurrencyConversion?.createCurrencyConversionFeature;
    if (!factory) {
      return;
    }

    runtime.currencyConversion = factory({
      enabled: runtime.state.currencyConversionEnabled,
      labels: {
        showExalted: t("showExalted"),
        showChaos: t("showChaos"),
        showDivine: t("showDivine"),
        currencyExalted: t("currencyExalted"),
        currencyChaos: t("currencyChaos"),
        currencyDivine: t("currencyDivine"),
        loading: t("currencyLoading"),
        unavailable: t("currencyUnavailable")
      },
      onLeagueChange: updateCurrencyLeague
    });
    runtime.currencyConversion.start();
  }

  function t(key, substitutions = [], fallback = "") {
    const values = Array.isArray(substitutions) ? substitutions : [substitutions];
    const message = globalThis.chrome?.i18n?.getMessage?.(
      key,
      values.map((value) => String(value))
    );
    const template = message || fallback || I18N_FALLBACKS[key] || key;
    return values.reduce((text, value, index) => text.replaceAll(`$${index + 1}`, String(value)), template);
  }

  function getFavoriteTools() {
    const factory = globalThis.Poe2MarketwrightFavorites?.createFavoriteTools;
    return factory ? factory() : null;
  }

  function getCurrentFavoriteLeague() {
    return getFavoriteTools()?.getLeagueFromTradeUrl(window.location.href) || null;
  }

  function getFavoriteItemClassification(item) {
    if (!runtime.data) {
      return null;
    }
    const baseName = String(item?.typeLine || item?.baseType || "").trim();
    const selection = lookupItemNameSelection(normalizeLookupText(baseName));
    const category = selection?.kind === "page" ? FAVORITE_TRADE_CATEGORY_BY_PAGE[selection.id] : null;
    if (!baseName || !category) {
      console.warn("[PoE2 Marketwright] unable to classify favorite item", {
        baseName: baseName || null,
        selection: selection || null
      });
      return null;
    }
    return {
      baseName,
      category,
      itemType: FAVORITE_TRADE_CATEGORY_LABELS[category] || category
    };
  }

  function getVisibleFavorites() {
    const league = getCurrentFavoriteLeague();
    runtime.favoriteLeague = league;
    const search = String(runtime.ui.favoritesSearch?.value || "").trim().toLowerCase();
    const favorites = (runtime.state.favorites || [])
      .filter((favorite) => favorite?.league === league)
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
    if (!search) {
      return favorites;
    }
    return favorites.filter((favorite) => String(favorite.displayName || "").toLowerCase().includes(search));
  }

  function createFavoriteIconButton(className, title, path) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${path}"></path></svg>`;
    return button;
  }

  function buildFavoriteTooltip(favorite) {
    const lines = [
      t("favoriteTooltipRarity", String(favorite.rarity || "").toUpperCase()),
      favorite.originalName || favorite.displayName || "",
      favorite.baseName || "",
      favorite.itemType || "",
      ...(Array.isArray(favorite.mods) ? favorite.mods.map((mod) => mod?.text || "") : [])
    ];
    return lines.filter(Boolean).join("\n");
  }

  function renderFavoriteDrawer() {
    if (!runtime.ui.favoritesList) {
      return;
    }
    const league = getCurrentFavoriteLeague();
    runtime.favoriteLeague = league;
    runtime.ui.favoritesLeague.textContent = league ? t("favoritesLeague", league) : t("favoritesLeagueUnavailable");
    runtime.ui.favoritesLeague.title = league || "";
    runtime.ui.favoritesList.replaceChildren();

    if (!league) {
      const status = document.createElement("div");
      status.className = "poe2-marketwright-favorites-empty";
      status.textContent = t("favoritesLeagueUnavailable");
      runtime.ui.favoritesList.appendChild(status);
      renderFavoriteUndo();
      return;
    }

    const favorites = getVisibleFavorites();
    if (!favorites.length) {
      const status = document.createElement("div");
      status.className = "poe2-marketwright-favorites-empty";
      status.textContent = runtime.ui.favoritesSearch.value.trim() ? t("favoritesNoMatches") : t("favoritesEmpty");
      runtime.ui.favoritesList.appendChild(status);
      renderFavoriteUndo();
      return;
    }

    for (const favorite of favorites) {
      const row = document.createElement("article");
      row.className = "poe2-marketwright-favorite-row";

      const launch = document.createElement("button");
      launch.type = "button";
      launch.className = "poe2-marketwright-favorite-launch";
      launch.setAttribute("aria-label", favorite.displayName || favorite.baseName || "");
      launch.title = buildFavoriteTooltip(favorite);
      launch.addEventListener("click", () => {
        void launchFavoriteSearch(favorite, launch, row);
      });

      const name = document.createElement("span");
      name.className = "poe2-marketwright-favorite-name";
      name.textContent = favorite.displayName || favorite.baseName;
      const meta = document.createElement("span");
      meta.className = "poe2-marketwright-favorite-meta";
      meta.textContent = [favorite.baseName, favorite.itemType, favorite.rarity].filter(Boolean).join(" / ");
      const mods = document.createElement("span");
      mods.className = "poe2-marketwright-favorite-mods";
      const visibleMods = Array.isArray(favorite.mods) ? favorite.mods.slice(0, 3) : [];
      for (const mod of visibleMods) {
        const line = document.createElement("span");
        const text = mod?.text || "";
        line.textContent = text;
        mods.appendChild(line);
      }
      const extraModCount = Math.max(0, (favorite.mods?.length || 0) - visibleMods.length);
      if (extraModCount) {
        const more = document.createElement("span");
        more.className = "poe2-marketwright-favorite-more";
        more.textContent = t("favoriteMoreMods", extraModCount);
        mods.appendChild(more);
      }
      launch.append(name, meta, mods);

      const actions = document.createElement("div");
      actions.className = "poe2-marketwright-favorite-actions";
      const renameButton = createFavoriteIconButton(
        "poe2-marketwright-favorite-action",
        t("renameFavorite"),
        "M2.5 11.8V14h2.2l6.5-6.5-2.2-2.2-6.5 6.5zm10.2-6.2a.9.9 0 0 0 0-1.3L11.3 2.9a.9.9 0 0 0-1.3 0L9 4l2.2 2.2 1.5-1.5z"
      );
      renameButton.addEventListener("click", (event) => {
        event.stopPropagation();
        startFavoriteRename(favorite, name);
      });
      const deleteButton = createFavoriteIconButton(
        "poe2-marketwright-favorite-action poe2-marketwright-favorite-delete",
        t("deleteFavorite"),
        "M4 4.5h8l-.6 9H4.6l-.6-9zm2-2h4l.6 1H13v1.5H3V3.5h2.4L6 2.5zm1 4v5h1.5v-5H7zm2.5 0v5H11v-5H9.5z"
      );
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        runAsync(() => deleteFavorite(favorite), "delete favorite");
      });
      actions.append(renameButton, deleteButton);
      row.append(launch, actions);
      runtime.ui.favoritesList.appendChild(row);
    }
    renderFavoriteUndo();
  }

  function renderFavoriteUndo() {
    if (!runtime.ui.favoritesUndo) {
      return;
    }
    runtime.ui.favoritesUndo.hidden = !runtime.deletedFavorite;
  }

  async function replaceFavorites(nextFavorites) {
    const previousFavorites = runtime.state.favorites;
    runtime.state.favorites = nextFavorites;
    runtime.favorites?.setFavorites(nextFavorites);
    renderFavoriteDrawer();
    try {
      await saveState();
    } catch (error) {
      runtime.state.favorites = previousFavorites;
      runtime.favorites?.setFavorites(previousFavorites);
      renderFavoriteDrawer();
      throw error;
    }
  }

  async function toggleFavorite(favorite) {
    const existingIndex = runtime.state.favorites.findIndex(
      (entry) => entry?.signature === favorite.signature
    );
    if (existingIndex >= 0) {
      await replaceFavorites(runtime.state.favorites.filter((_, index) => index !== existingIndex));
      return;
    }
    await replaceFavorites([favorite, ...runtime.state.favorites]);
  }

  async function renameFavorite(favorite, displayName) {
    const name = String(displayName || "").trim();
    if (!name || name === favorite.displayName) {
      renderFavoriteDrawer();
      return;
    }
    await replaceFavorites(
      runtime.state.favorites.map((entry) =>
        entry?.signature === favorite.signature ? { ...entry, displayName: name } : entry
      )
    );
  }

  function startFavoriteRename(favorite, nameNode) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "poe2-marketwright-favorite-rename-input";
    input.value = favorite.displayName || "";
    input.setAttribute("aria-label", t("renameFavorite"));
    let cancelled = false;
    const commit = () => {
      if (!cancelled) {
        runAsync(() => renameFavorite(favorite, input.value), "rename favorite");
      }
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      } else if (event.key === "Escape") {
        cancelled = true;
        renderFavoriteDrawer();
      }
    });
    input.addEventListener("blur", commit, { once: true });
    nameNode.replaceWith(input);
    input.focus();
    input.select();
  }

  async function deleteFavorite(favorite) {
    const existing = runtime.state.favorites.find((entry) => entry?.signature === favorite.signature);
    if (!existing) {
      return;
    }
    await replaceFavorites(runtime.state.favorites.filter((entry) => entry?.signature !== favorite.signature));
    if (runtime.deletedFavoriteTimer) {
      window.clearTimeout(runtime.deletedFavoriteTimer);
    }
    runtime.deletedFavorite = existing;
    runtime.deletedFavoriteTimer = window.setTimeout(() => {
      runtime.deletedFavorite = null;
      runtime.deletedFavoriteTimer = null;
      renderFavoriteUndo();
    }, 5000);
    renderFavoriteUndo();
  }

  async function undoDeletedFavorite() {
    const favorite = runtime.deletedFavorite;
    if (!favorite) {
      return;
    }
    runtime.deletedFavorite = null;
    if (runtime.deletedFavoriteTimer) {
      window.clearTimeout(runtime.deletedFavoriteTimer);
      runtime.deletedFavoriteTimer = null;
    }
    await replaceFavorites([favorite, ...runtime.state.favorites]);
  }

  async function launchFavoriteSearch(favorite, launchButton, row) {
    const tools = getFavoriteTools();
    if (!tools) {
      throw new Error("Favorite tools are unavailable");
    }
    launchButton.disabled = true;
    row.dataset.status = "loading";
    const status = document.createElement("span");
    status.className = "poe2-marketwright-favorite-search-status";
    status.textContent = t("favoriteSearchLoading");
    row.appendChild(status);
    try {
      const response = await fetch(
        new URL(`/api/trade2/search/${encodeURIComponent(favorite.league)}`, window.location.origin),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(tools.createTradeSearchPayload(favorite))
        }
      );
      if (!response.ok) {
        throw new Error(`Trade search failed: ${response.status}`);
      }
      const result = await response.json();
      if (!result?.id || typeof result.id !== "string") {
        throw new Error("Trade search returned no query id");
      }
      window.location.assign(
        new URL(
          `/trade2/search/poe2/${encodeURIComponent(favorite.league)}/${encodeURIComponent(result.id)}`,
          window.location.origin
        ).toString()
      );
    } catch (error) {
      console.debug("[PoE2 Marketwright] favorite search failed", error);
      row.dataset.status = "error";
      status.textContent = t("favoriteSearchError");
      launchButton.disabled = false;
    }
  }

  async function setFavoritesDrawerOpen(open) {
    if (!runtime.state.favoritesEnabled) {
      return;
    }
    const nextOpen = Boolean(open);
    if (runtime.state.favoritesDrawerOpen === nextOpen) {
      return;
    }
    runtime.state.favoritesDrawerOpen = nextOpen;
    applyFavoritesDrawerState();
    applyPanelPosition();
    await saveState();
  }

  function applyFavoritesDrawerState() {
    if (!runtime.ui.root || !runtime.ui.favoritesDisclosure) {
      return;
    }
    const open = Boolean(
      runtime.state.favoritesEnabled && runtime.state.favoritesDrawerOpen && !runtime.state.collapsed
    );
    runtime.ui.root.classList.toggle("poe2-marketwright-favorites-open", open);
    runtime.ui.favoritesDisclosure.disabled = !runtime.state.favoritesEnabled;
    runtime.ui.favoritesDisclosure.setAttribute("aria-expanded", String(open));
    runtime.ui.favoritesDisclosure.setAttribute("aria-label", t(open ? "collapseFavoritesDrawer" : "expandFavoritesDrawer"));
    runtime.ui.favoritesDisclosure.title = t(open ? "collapseFavoritesDrawer" : "expandFavoritesDrawer");
  }

  async function setPanelCollapsed(collapsed) {
    if (runtime.state.collapsed === collapsed) {
      return;
    }

    if (collapsed) {
      const rect = runtime.ui.collapse?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        runtime.state.collapsedPosition = {
          left: rect.left + (rect.width - COLLAPSED_PANEL_SIZE) / 2,
          top: rect.top + (rect.height - COLLAPSED_PANEL_SIZE) / 2
        };
      }
    } else {
      runtime.state.collapsedPosition = null;
    }

    runtime.state.collapsed = collapsed;
    applyPanelCollapsed();
    applyPanelPosition();
    await saveState();
  }

  function applyPanelCollapsed() {
    const collapsed = Boolean(runtime.state.collapsed);
    runtime.ui.root.classList.toggle("poe2-trade2-affix-filter-collapsed", collapsed);
    runtime.ui.collapse?.setAttribute("aria-expanded", String(!collapsed));
    runtime.ui.expand?.setAttribute("aria-expanded", String(!collapsed));
    applyFavoritesDrawerState();
  }

  function applyPanelPosition() {
    if (runtime.state.collapsed) {
      const position = runtime.state.collapsedPosition;
      if (
        position &&
        Number.isFinite(position.left) &&
        Number.isFinite(position.top)
      ) {
        const clamped = clampPanelPosition(position.left, position.top);
        runtime.ui.root.style.left = `${clamped.left}px`;
        runtime.ui.root.style.top = `${clamped.top}px`;
        runtime.ui.root.style.right = "auto";
        return;
      }

      runtime.ui.root.style.left = "";
      runtime.ui.root.style.top = "";
      runtime.ui.root.style.right = "";
      return;
    }

    const position = runtime.state.panelPosition;
    if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) {
      runtime.ui.root.style.left = "";
      runtime.ui.root.style.top = "";
      runtime.ui.root.style.right = "";
      return;
    }

    const clamped = clampPanelPosition(position.left, position.top);
    runtime.ui.root.style.left = `${clamped.left}px`;
    runtime.ui.root.style.top = `${clamped.top}px`;
    runtime.ui.root.style.right = "auto";
  }

  function bindPanelDrag() {
    const handles = [runtime.ui.dragHandle, runtime.ui.expand].filter(Boolean);
    if (!handles.length) {
      return;
    }

    let dragState = null;

    const startDrag = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const isCollapsedHandle = event.currentTarget === runtime.ui.expand;
      if (event.button !== 0 || (!isCollapsedHandle && target?.closest("button, select, input, option"))) {
        return;
      }

      const rect = runtime.ui.root.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        isCollapsedHandle
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      runtime.ui.root.classList.add("poe2-trade2-affix-filter-dragging");
      if (!isCollapsedHandle) {
        event.preventDefault();
      }
    };

    const moveDrag = (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      if (Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) > 3) {
        dragState.moved = true;
      }
      const position = clampPanelPosition(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
      runtime.ui.root.style.left = `${position.left}px`;
      runtime.ui.root.style.top = `${position.top}px`;
      runtime.ui.root.style.right = "auto";
      event.preventDefault();
    };

    const finishDrag = (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const handle = event.currentTarget;
      handle.releasePointerCapture?.(event.pointerId);
      runtime.ui.root.classList.remove("poe2-trade2-affix-filter-dragging");
      const wasCollapsedHandle = dragState.isCollapsedHandle;
      const wasMoved = dragState.moved;
      const rect = runtime.ui.root.getBoundingClientRect();
      if (!wasCollapsedHandle || wasMoved) {
        runtime.state.panelPosition = clampPanelPosition(rect.left, rect.top);
      }
      if (wasCollapsedHandle && wasMoved) {
        runtime.ui.suppressExpandClick = true;
        window.setTimeout(() => {
          runtime.ui.suppressExpandClick = false;
        }, 0);
      }
      dragState = null;
      if (!wasCollapsedHandle || wasMoved) {
        runAsync(() => saveState(), "save panel position");
      }
    };

    for (const handle of handles) {
      handle.addEventListener("pointerdown", startDrag);
      handle.addEventListener("pointermove", moveDrag);
      handle.addEventListener("pointerup", finishDrag);
      handle.addEventListener("pointercancel", finishDrag);
    }

    window.addEventListener("resize", () => {
      if (!runtime.state.panelPosition) {
        return;
      }
      const rect = runtime.ui.root.getBoundingClientRect();
      runtime.state.panelPosition = clampPanelPosition(rect.left, rect.top);
      applyPanelPosition();
    });
  }

  function clampPanelPosition(left, top) {
    const margin = 8;
    const rect = runtime.ui.root.getBoundingClientRect();
    const width = rect.width || (runtime.state.collapsed ? COLLAPSED_PANEL_SIZE : 238);
    const height = rect.height || (runtime.state.collapsed ? COLLAPSED_PANEL_SIZE : 188);
    const drawerWidth =
      runtime.state.favoritesDrawerOpen && !runtime.state.collapsed
        ? (runtime.ui.favoritesDrawer?.getBoundingClientRect().width || 340) + 6
        : 0;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const minLeft = Math.min(margin + drawerWidth, maxLeft);
    return {
      left: Math.max(minLeft, Math.min(left, maxLeft)),
      top: Math.max(margin, Math.min(top, window.innerHeight - height - margin))
    };
  }

  function populateSelectionOptions(select) {
    select.innerHTML = "";

    const autoOption = document.createElement("option");
    autoOption.value = "auto";
    autoOption.textContent = t("autoDetect");
    select.appendChild(autoOption);

    const logicalGroup = document.createElement("optgroup");
    logicalGroup.label = t("selectionGroupTypes");
    const pageGroup = document.createElement("optgroup");
    pageGroup.label = t("selectionGroupExactBases");

    for (const option of runtime.data.selectionOptions || []) {
      const element = document.createElement("option");
      element.value = encodeSelection(option.kind, option.id);
      element.textContent = localizeSelectionLabel(option, option.label);
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

  function localizeSelectionLabel(selection, fallback) {
    if (!selection?.kind || !selection?.id) {
      return fallback || "";
    }
    const prefix = selection.kind === "logical" ? "selectionLogical" : "selectionPage";
    return t(`${prefix}_${toI18nId(selection.id)}`, [], fallback || selection.id);
  }

  function toI18nId(id) {
    return String(id).replace(/[^A-Za-z0-9_]/g, "_");
  }

  function addLocalizedSelectionAliases(messagesByLocale) {
    const messagesList = Object.values(messagesByLocale || {});
    if (!messagesList.length) {
      return;
    }

    for (const option of runtime.data.selectionOptions || []) {
      const selection = {
        kind: option.kind,
        id: option.id
      };
      const prefix = option.kind === "logical" ? "selectionLogical" : "selectionPage";
      const key = `${prefix}_${toI18nId(option.id)}`;
      for (const messages of messagesList) {
        addSelectionAlias(messages[key]?.message, selection);
      }
    }
  }

  function addSelectionAlias(alias, selection) {
    const normalized = normalizeLookupText(alias || "");
    if (!normalized || isIgnorableSelectionText(normalized)) {
      return;
    }
    if (!runtime.categoryAliasToSelection[normalized]) {
      runtime.categoryAliasToSelection[normalized] = selection;
    }
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
    bindTradeInteractionListeners();
    startSelectionPolling();

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

  function bindTradeInteractionListeners() {
    const eventTypes = ["input", "change", "compositionend", "keyup", "paste", "cut", "click", "pointerup", "blur"];
    for (const type of eventTypes) {
      document.addEventListener(
        type,
        (event) => {
          if (isTradeSelectionEventTarget(event.target)) {
            scheduleRefreshAfterDomUpdate();
            scheduleControlListenerRefresh();
          }
        },
        true
      );
    }
  }

  function isTradeSelectionEventTarget(target) {
    if (!(target instanceof Element) || runtime.ui.root?.contains(target)) {
      return false;
    }
    if (target.closest(ITEM_SEARCH_ROOT_SELECTOR)) {
      return true;
    }
    const typeFilterGroup = findTypeFilterGroup();
    if (typeFilterGroup?.contains(target)) {
      return true;
    }
    return Boolean(target.closest(OPTION_SELECTOR) || target.closest(OPTION_ROOT_SELECTOR));
  }

  function startSelectionPolling() {
    if (runtime.selectionPollTimer) {
      return;
    }
    runtime.selectionSignature = getSelectionDomSignature();
    runtime.selectionPollTimer = window.setInterval(() => {
      const favoriteLeague = getCurrentFavoriteLeague();
      if (favoriteLeague !== runtime.favoriteLeague) {
        renderFavoriteDrawer();
      }
      const signature = getSelectionDomSignature();
      if (signature === runtime.selectionSignature) {
        return;
      }
      runtime.selectionSignature = signature;
      scheduleRefreshAfterDomUpdate();
      scheduleControlListenerRefresh();
    }, 250);
  }

  function getSelectionDomSignature() {
    const itemRoot = getItemSearchRoot();
    const itemInput = getItemSearchInput();
    const categoryRoot = getTypeCategoryMultiselect();
    const activeElement = document.activeElement;
    const activeValue =
      activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
        ? activeElement.value
        : "";

    return [
      location.href,
      itemInput?.value || "",
      collectMultiselectSelectedTexts(itemRoot || itemInput).join("|"),
      collectMultiselectSelectedTexts(categoryRoot).join("|"),
      isActiveSelectionElement(activeElement, itemRoot, categoryRoot) ? activeValue : ""
    ].join("\n");
  }

  function isActiveSelectionElement(activeElement, itemRoot, categoryRoot) {
    if (!(activeElement instanceof Element) || runtime.ui.root?.contains(activeElement)) {
      return false;
    }
    return Boolean(
      activeElement.closest(ITEM_SEARCH_ROOT_SELECTOR) ||
        itemRoot?.contains(activeElement) ||
        categoryRoot?.contains(activeElement) ||
        findTypeFilterGroup()?.contains(activeElement)
    );
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
        if (!runtime.data || !runtime.ui.root) {
          syncPageBridge(null, null);
          return;
        }
        scheduleRefresh();
        return;
      }

      if (event.data.type !== BRIDGE_STATE_TYPE) {
        return;
      }

      const payload = event.data.payload || {};
      runtime.bridgeStats = payload.filterStats || null;
      if (runtime.data && runtime.ui.root) {
        scheduleRefresh();
      }
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

    if (
      !runtime.state.filteringEnabled ||
      !((allowedPatterns && allowedPatterns.size > 0) || (allowedStatIds && allowedStatIds.size > 0))
    ) {
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
    if (!runtime.state.filteringEnabled) {
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

    const itemSelection = lookupItemNameSelection(segment);
    if (itemSelection) {
      return {
        kind: itemSelection.kind,
        id: itemSelection.id,
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
        const itemSelection = lookupItemNameSelection(itemName);
        if (!itemSelection) {
          continue;
        }
        return {
          kind: itemSelection.kind,
          id: itemSelection.id,
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

  function lookupItemNameSelection(itemName) {
    const override = runtime.data.itemNameToSelection?.[itemName];
    if (override?.kind && override?.id) {
      return override;
    }

    const itemSlug = runtime.data.itemNameToPage?.[itemName];
    if (itemSlug) {
      return {
        kind: "page",
        id: itemSlug
      };
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
    if (!selection || !runtime.state.filteringEnabled) {
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
    if (!selection || !runtime.state.filteringEnabled) {
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
    runtime.ui.selection.value = runtime.state.selection;
    updateToggleButton();

    if (!runtime.state.filteringEnabled) {
      runtime.ui.status.textContent = t("statusOff");
      runtime.ui.meta.textContent = buildMetaText(0, true);
      return;
    }

    if (!selection || !record) {
      runtime.ui.status.textContent = t("statusAutoUnknown");
      runtime.ui.meta.textContent = buildMetaText(0, true);
      return;
    }

    const label = localizeSelectionLabel(selection, record.label || selection.id);
    const selectionSource = selection.source === "manual" ? t("selectionSourceManual") : t("selectionSourceAuto");
    const patternCount = allowedPatterns ? allowedPatterns.size : 0;
    runtime.ui.status.textContent = t("statusSelection", [selectionSource, label]);
    runtime.ui.meta.textContent = buildMetaText(patternCount);
  }

  function buildMetaText(patternCount, forceEmpty = false) {
    if (forceEmpty) {
      return t("statsText", [0, 0, 0]);
    }

    const fallbackKeep = Math.max(0, (runtime.lastFilterStats?.matched || 0) - (runtime.lastFilterStats?.hidden || 0));
    const keep = runtime.bridgeStats?.kept ?? fallbackKeep;
    const ignore = runtime.bridgeStats?.hidden ?? runtime.lastFilterStats?.hidden ?? 0;
    return t("statsText", [patternCount, keep, ignore]);
  }

  function updateToggleButton() {
    if (!runtime.ui.enabled) {
      return;
    }
    const enabled = Boolean(runtime.state.filteringEnabled);
    runtime.ui.enabled.textContent = enabled ? t("toggleOn") : t("toggleOff");
    runtime.ui.enabled.setAttribute("aria-pressed", String(enabled));
    runtime.ui.enabled.title = enabled ? t("disableFiltering") : t("enableFiltering");
    updatePobCopyToggleButton();
    updateFavoritesToggleButton();
    updateCurrencyConversionToggleButton();
  }

  function updatePobCopyToggleButton() {
    if (!runtime.ui.pobEnabled) {
      return;
    }
    const enabled = Boolean(runtime.state.pobCopyEnabled);
    runtime.ui.pobEnabled.textContent = enabled ? t("toggleOn") : t("toggleOff");
    runtime.ui.pobEnabled.setAttribute("aria-pressed", String(enabled));
    runtime.ui.pobEnabled.title = enabled ? t("disablePobCopy") : t("enablePobCopy");
  }

  function updateFavoritesToggleButton() {
    if (!runtime.ui.favoritesEnabled) {
      return;
    }
    const enabled = Boolean(runtime.state.favoritesEnabled);
    runtime.ui.favoritesEnabled.textContent = enabled ? t("toggleOn") : t("toggleOff");
    runtime.ui.favoritesEnabled.setAttribute("aria-pressed", String(enabled));
    runtime.ui.favoritesEnabled.title = enabled ? t("disableFavorites") : t("enableFavorites");
  }

  function updateCurrencyConversionToggleButton() {
    if (!runtime.ui.currencyEnabled) {
      return;
    }
    const enabled = Boolean(runtime.state.currencyConversionEnabled);
    runtime.ui.currencyEnabled.textContent = enabled ? t("toggleOn") : t("toggleOff");
    runtime.ui.currencyEnabled.setAttribute("aria-pressed", String(enabled));
    runtime.ui.currencyEnabled.title = enabled ? t("disableCurrencyConversion") : t("enableCurrencyConversion");
    runtime.ui.currencyRefresh.disabled = !enabled;
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
      const statId = getOptionStatId(option);
      const pattern = getOptionPatternKey(option);
      if (!isFilterableStatOption(statId, pattern)) {
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
      if (isPseudoStatOption(option, statId)) {
        if (
          isPseudoStatAllowed(option, statId, pattern, allowedPatterns, allowedStatIds) ||
          isClassifiedStatOption(statId, pattern)
        ) {
          affixOptionCount += 1;
        }
        continue;
      }
      if (
        isAllowedStatOption(statId, pattern, allowedPatterns, allowedStatIds) ||
        isFilterableStatOption(statId, pattern)
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
      if (isPseudoStatOption(option, statId)) {
        const shouldHide = shouldHidePseudoStatOption(option, statId, pattern, allowedPatterns, allowedStatIds);
        stats.matched += 1;
        if (shouldHide) {
          stats.hidden += 1;
        }
        option.classList.toggle(HIDDEN_CLASS, shouldHide);
        continue;
      }
      if (!isAllowedStatOption(statId, pattern, allowedPatterns, allowedStatIds) && !isFilterableStatOption(statId, pattern)) {
        continue;
      }
      const shouldHide = shouldHideStatOption(statId, pattern, allowedPatterns, allowedStatIds);
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
      const match = String(value).match(TRADE_STAT_ID_RE);
      if (match) {
        return match[0];
      }
    }

    return "";
  }

  function isPseudoStatOption(element, statId) {
    if (isPseudoStatId(statId)) {
      return true;
    }

    return collectOptionTexts(element).some(hasPseudoStatMarker);
  }

  function isPseudoStatAllowed(element, statId, pattern, allowedPatterns, allowedStatIds) {
    const optionTexts = collectOptionTexts(element);
    if (isAlwaysVisiblePseudoStat(statId, [pattern, ...optionTexts])) {
      return true;
    }
    if (isAllowedStatOption(statId, pattern, allowedPatterns, allowedStatIds)) {
      return true;
    }
    return isPseudoStatRelatedToAllowed([statId, pattern, ...optionTexts], allowedPatterns);
  }

  function shouldHidePseudoStatOption(element, statId, pattern, allowedPatterns, allowedStatIds) {
    if (isPseudoStatAllowed(element, statId, pattern, allowedPatterns, allowedStatIds)) {
      return false;
    }
    return true;
  }

  function shouldHideStatOption(statId, pattern, allowedPatterns, allowedStatIds) {
    return isFilterableStatOption(statId, pattern) && !isAllowedStatOption(statId, pattern, allowedPatterns, allowedStatIds);
  }

  function isAllowedStatOption(statId, pattern, allowedPatterns, allowedStatIds) {
    return Boolean((statId && allowedStatIds?.has(statId)) || (pattern && allowedPatterns?.has(pattern)));
  }

  function isClassifiedStatOption(statId, pattern) {
    return Boolean((statId && runtime.allStatIds.has(statId)) || (pattern && runtime.allPatterns.has(pattern)));
  }

  function isFilterableStatOption(statId, pattern) {
    return Boolean(statId || isClassifiedStatOption(statId, pattern));
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
      .replace(PSEUDO_STAT_GROUP_PREFIX_RE, "")
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

  function hasPseudoStatMarker(text) {
    const raw = String(text || "").replace(/\u00a0/g, " ");
    if (PSEUDO_STAT_ID_RE.test(raw)) {
      return true;
    }

    const collapsed = raw.replace(/\s+/g, " ").trim();
    if (PSEUDO_STAT_GROUP_PREFIX_RE.test(collapsed)) {
      return true;
    }

    return raw.split(/\n+/).some((line) => PSEUDO_STAT_GROUP_PREFIX_RE.test(line.trim()));
  }

  function isPseudoStatRelatedToAllowed(pseudoValues, allowedPatterns) {
    const pseudoTokenSets = buildStatRelevanceTokenSets(pseudoValues);
    if (!pseudoTokenSets.length) {
      return false;
    }

    for (const allowedPattern of allowedPatterns) {
      const allowedTokens = buildStatRelevanceTokens(allowedPattern);
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
      runtime.state.filteringEnabled &&
        ((allowedPatterns && allowedPatterns.size > 0) || (allowedStatIds && allowedStatIds.size > 0))
    );
    const payload = {
      enabled,
      pobCopyEnabled: Boolean(runtime.state.pobCopyEnabled),
      favoritesEnabled: Boolean(runtime.state.favoritesEnabled),
      currencyConversionEnabled: Boolean(runtime.state.currencyConversionEnabled),
      allowedKeys: enabled ? Array.from(allowedPatterns || []) : [],
      allowedStatIds: enabled ? Array.from(allowedStatIds || []) : [],
      allKeys: Array.from(runtime.allPatterns),
      allStatIds: Array.from(runtime.allStatIds)
    };
    const signature = [
      payload.enabled,
      payload.pobCopyEnabled,
      payload.favoritesEnabled,
      payload.currencyConversionEnabled,
      payload.allowedKeys.join("|"),
      payload.allowedStatIds.join("|"),
      payload.allKeys.join("|"),
      payload.allStatIds.join("|")
    ].join(":");
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
