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
    uiLanguage: null,
    pageLanguage: null,
    pageTranslationEnabled: true,
    filteringEnabled: true,
    tierEnabled: true,
    tierMode: "minimum",
    pobCopyEnabled: true,
    currencyConversionEnabled: true,
    favoritesEnabled: true,
    favorites: [],
    favoritesDrawerOpen: false,
    favoritesViewMode: "compact",
    favoritesPanelOpen: false,
    favoritesPanelTab: "items",
    linkFavoritesEnabled: true,
    linkFavorites: { version: 2, leagues: {} },
    linkFavoritesDrawerOpen: false,
    sidebarPosition: "left",
    idleTransparencyEnabled: true,
    idleTransparency: 50,
    selection: "auto",
    collapsed: false,
    panelPosition: null,
    collapsedPosition: null
  };
  const ROOT_ID = "poe2-trade2-affix-filter-root";
  const COLLAPSED_PANEL_SIZE = 36;
  const HIDDEN_CLASS = "poe2-trade2-affix-filter-hidden";
  const FAVORITE_SPECIAL_MODIFIER_SOURCES = new Set([
    "crafted",
    "desecrated",
    "enchant",
    "fractured",
    "implicit",
    "rune",
    "sanctum",
    "skill",
    "augment"
  ]);
  const FAVORITE_SPECIAL_MODIFIER_SOURCE_MESSAGE_KEYS = Object.freeze({
    crafted: "favoriteModifierSourceCrafted",
    desecrated: "favoriteModifierSourceDesecrated",
    fractured: "favoriteModifierSourceFractured",
    enchant: "favoriteModifierSourceEnchant",
    augment: "favoriteModifierSourceAugment",
    implicit: "favoriteModifierSourceImplicit",
    sanctum: "favoriteModifierSourceSanctum",
    skill: "favoriteModifierSourceSkill"
  });
  const BRIDGE_SOURCE = "poe2-marketwright";
  const BRIDGE_UPDATE_TYPE = "POE2_MARKETWRIGHT_UPDATE";
  const BRIDGE_TIER_UPDATE_TYPE = "POE2_MARKETWRIGHT_TIER_UPDATE";
  const BRIDGE_READY_TYPE = "POE2_MARKETWRIGHT_READY";
  const BRIDGE_STATE_TYPE = "POE2_MARKETWRIGHT_STATE";
  const BRIDGE_SEARCH_SNAPSHOT_TYPE = "POE2_MARKETWRIGHT_SEARCH_SNAPSHOT";
  const LINK_FAVORITE_STAT_GROUPS_VERSION = 3;
  const TRADE_ROOT_SELECTOR = "#trade";
  const NATIVE_TRADE_CACHE_KEYS = [
    "lscache-trade2items",
    "lscache-trade2stats",
    "lscache-trade2data",
    "lscache-trade2filters"
  ];
  const NATIVE_TRADE_CACHE_MARKER_KEY = "poe2-marketwright:trade-native-search-localization";
  const LEGACY_NATIVE_ITEM_CACHE_MARKER_KEY = "poe2-marketwright:trade-item-localization";
  const LOCALIZED_ALIAS_LOCALES = ["zh_CN", "zh_TW"];
  const SUPPORTED_UI_LANGUAGES = Object.freeze(["en", "zh_CN", "zh_TW"]);
  const SUPPORTED_PAGE_LANGUAGES = Object.freeze(["en", "zh_CN", "zh_TW", "zh_CN_en", "zh_TW_en"]);
  // Keep Trade filter terminology consistent when official data has a missing or legacy translation.
  const TRADE_TERM_LOCALIZATION_OVERRIDES = Object.freeze({
    "type filters": { en: "Type Filters", zh_CN: "类型筛选器", zh_TW: "類別篩選器" },
    "equipment filters": { en: "Equipment Filters", zh_CN: "装备筛选器", zh_TW: "裝備篩選器" },
    requirements: { en: "Requirements", zh_CN: "物品需求", zh_TW: "物品需求" },
    "endgame filters": { en: "Endgame Filters", zh_CN: "终局筛选器", zh_TW: "終局篩選器" },
    miscellaneous: { en: "Miscellaneous", zh_CN: "其他", zh_TW: "其他" },
    "stat filters": { en: "Stat Filters", zh_CN: "属性筛选器", zh_TW: "屬性篩選器" },
    "weighted sum": { en: "WEIGHTED SUM", zh_CN: "加权总和", zh_TW: "加權總和" },
    "crucible passive tree path": {
      en: "Crucible Passive Tree Path",
      zh_CN: "熔炉被动技能树路径",
      zh_TW: "熔爐被動技能樹路徑"
    },
    "runic ward": { en: "Runic Ward", zh_CN: "符文结界", zh_TW: "符文保護" },
    "includes base value, local modifiers, and maximum quality": {
      en: "Includes base value, local modifiers, and maximum quality",
      zh_CN: "包含基础数值、本地词缀与最高品质",
      zh_TW: "包含基礎數值、本地詞綴與最高品質"
    },
    "includes base value and local modifiers": {
      en: "Includes base value and local modifiers",
      zh_CN: "包含基础数值与本地词缀",
      zh_TW: "包含基礎數值與本地詞綴"
    },
    "increased item rarity": { en: "Increased Item Rarity", zh_CN: "提高物品稀有度", zh_TW: "增加物品稀有度" },
    "check each stat meets the `min` and `max` (if provided, otherwise existence) requirements before multiplying the stat value by the `weight` and finally summing them together. use the group's `min` and `max` to filter items based on the total summed value.": {
      en: "Check each stat meets the `min` and `max` (if provided, otherwise existence) requirements before multiplying the stat value by the `weight` and finally summing them together. Use the group's `min` and `max` to filter items based on the total summed value.",
      zh_CN: "每项满足 `min` 与 `max`（若未设置，则检查是否存在）条件的属性数值，都会先乘以权重再求和。\n使用该组的 `min` 与 `max`，按加权总和筛选物品。",
      zh_TW: "每個符合 `min` 與 `max`（若未設定，則檢查是否存在）條件的屬性數值，都會先乘以權重再加總。\n使用此群組的 `min` 與 `max`，依加權總和篩選物品。"
    },
    "each stat value that meets the `min` and `max` (if provided, otherwise existence) requirements will be multiplied by the `weight` before being summed together. use the group's `min` and `max` to filter items based on the total summed value.": {
      en: "Each stat value that meets the `min` and `max` (if provided, otherwise existence) requirements will be multiplied by the `weight` before being summed together. Use the group's `min` and `max` to filter items based on the total summed value.",
      zh_CN: "每项满足 `min` 与 `max`（若未设置，则检查是否存在）条件的属性数值，都会先乘以权重再求和。\n使用该组的 `min` 与 `max`，按加权总和筛选物品。",
      zh_TW: "每個符合 `min` 與 `max`（若未設定，則檢查是否存在）條件的屬性數值，都會先乘以權重再加總。\n使用此群組的 `min` 與 `max`，依加權總和篩選物品。"
    },
    "match items that meet each stat's `min` and `max` requirements if the stat is present.": {
      en: "Match items that meet each stat's `min` and `max` requirements if the stat is present.",
      zh_CN: "若该属性存在，则匹配满足每项属性 `min` 与 `max` 要求的物品。",
      zh_TW: "若該屬性存在，則配對符合每項屬性 `min` 與 `max` 要求的物品。"
    },
    "count each stat that meets the `min` and `max` (if provided, otherwise existence) requirements. use the group's `min` and `max` to filter items based on the count of matching stats.": {
      en: "Count each stat that meets the `min` and `max` (if provided, otherwise existence) requirements. Use the group's `min` and `max` to filter items based on the count of matching stats.",
      zh_CN: "计算每项符合 `min` 与 `max`（若未设置，则检查是否存在）条件的属性。\n使用该组的 `min` 与 `max`，按匹配属性数量筛选物品。",
      zh_TW: "計算每項符合 `min` 與 `max`（若未設定，則檢查是否存在）條件的屬性。\n使用此群組的 `min` 與 `max`，依匹配屬性數量篩選物品。"
    },
    "filter by the mods that you want to be able to allocate at once. use a lower `min` value for partial matches.": {
      en: "Filter by the mods that you want to be able to allocate at once. Use a lower `min` value for partial matches.",
      zh_CN: "筛选你希望能同时配置的词缀。\n使用较低的 `min` 值以匹配部分结果。",
      zh_TW: "篩選你希望能同時配置的詞綴。\n使用較低的 `min` 值以配對部分結果。"
    }
  });
  const ITEM_SEARCH_ROOT_SELECTOR =
    "#trade .top .search-panel > .search-bar:not(.search-advanced) .search-left .multiselect.search-select";
  const ITEM_SEARCH_INPUT_SELECTOR = `${ITEM_SEARCH_ROOT_SELECTOR} input.multiselect__input`;
  const TYPE_FILTER_GROUP_SELECTOR = "#trade .search-advanced-pane.blue > .filter-group";
  const TRADE_LOCALIZATION_SELECTOR = [
    ".search-panel",
    ".search-advanced-pane",
    ".filter-group",
    ".multiselect__tags",
    ".multiselect__content-wrapper",
    ".search-results",
    ".results",
    ".result",
    ".item"
  ].join(",");
  const TRADE_ADVANCED_FILTER_COPY_SELECTOR = [
    ".search-advanced-pane .filter-group-header",
    ".search-advanced-pane .filter-group-title",
    ".search-advanced-pane .filter-title"
  ].join(",");
  const TRADE_FILTER_TIP_SELECTOR = ".search-advanced-pane .filter-tip > p";
  const TRADE_TOOLTIP_COPY_PREFIXES = Object.freeze([
    "check each stat meets",
    "each stat value that meets",
    "match items that meet",
    "count each stat",
    "filter by the mods",
    "includes base value",
    "increased item rarity"
  ]);
  const TRADE_LOCALIZATION_EXCLUDED_SELECTOR = [
    "[data-field='account']",
    "[data-field='whisper']",
    ".whisper-btn",
    ".item-note",
    ".result-note",
    ".listing-account",
    ".seller",
    ".profile"
  ].join(",");
  const TRADE_LOCALIZATION_SOURCE_KEY = "__poe2MarketwrightSourceText";
  const TRADE_LOCALIZATION_RENDER_KEY = "__poe2MarketwrightRenderedText";
  const TRADE_STAT_SOURCE_HTML_KEY = "__poe2MarketwrightStatSourceHtml";
  const TRADE_STAT_RENDER_KEY = "__poe2MarketwrightStatRender";
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
    tierSelectorLabel: "Tier",
    tierFeatureTitle: "Tier selection",
    tierMode: "Tier mode",
    tierModeMinimum: "Minimum",
    tierModeExact: "Exact",
    enableTierSelection: "Enable Tier selection",
    disableTierSelection: "Disable Tier selection",
    generalSettingsTitle: "General",
    language: "Language",
    tradePageLanguage: "Trade page language",
    tradePageTranslation: "Trade page translation",
    sidebarPosition: "Sidebar position",
    sidebarPositionLeft: "Left",
    sidebarPositionRight: "Right",
    idleTransparency: "Idle transparency",
    idleTransparencyOpacity: "Idle opacity: $1%",
    enableIdleTransparency: "Enable idle transparency",
    disableIdleTransparency: "Disable idle transparency",
    languageEnglish: "English",
    languageSimplifiedChinese: "Simplified Chinese",
    languageTraditionalChinese: "Traditional Chinese",
    languageSimplifiedChineseBilingual: "Simplified Chinese (English)",
    languageTraditionalChineseBilingual: "Traditional Chinese (English)",
    enableTradePageTranslation: "Enable Trade page translation",
    disableTradePageTranslation: "Disable Trade page translation",
    favoriteTooltipItem: "Item",
    favoriteTooltipBaseType: "Base type",
    favoriteTooltipCategory: "Category",
    favoriteTooltipModifiers: "Modifiers",
    favoriteTooltipStatFilters: "Stat Filters",
    favoriteTooltipStatGroupAnd: "AND",
    favoriteTooltipStatGroupOr: "OR",
    favoriteTooltipStatGroupCount: "COUNT",
    favoriteTooltipStatGroupWeighted: "WEIGHTED SUM",
    favoriteTooltipStatGroupNot: "NOT",
    favoriteTooltipStatGroupIf: "IF",
    favoriteTooltipWeight: "WEIGHT: $1",
    favoriteTooltipDisabled: "DISABLED",
    favoriteModifierSourceCrafted: "CRAFTED",
    favoriteModifierSourceDesecrated: "DESECRATED",
    favoriteModifierSourceFractured: "FRACTURED",
    favoriteModifierSourceEnchant: "ENCHANT",
    favoriteModifierSourceAugment: "AUGMENT",
    favoriteModifierSourceImplicit: "IMPLICIT",
    favoriteModifierSourceSanctum: "SANCTUM",
    favoriteModifierSourceSkill: "SKILL",
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
    linkFavoritesTitle: "Link bookmarks",
    linkFavoritesLeague: "Bookmarks: $1",
    linkFavoritesLeagueUnavailable: "Bookmarks: league unavailable",
    linkFavoritesEmpty: "No saved bookmarks",
    linkFavoriteUnnamedSearch: "Unnamed search",
    createLinkFavorite: "Save current search",
    createLinkFavoriteUnavailable: "Open a search result before saving",
    createLinkFavoriteFolder: "Create folder",
    importLinkFavorites: "Import bookmarks",
    importLinkFavoritesPlaceholder: "Paste exported bookmark JSON",
    confirmLinkFavoriteImport: "Import",
    cancelLinkFavoriteImport: "Cancel",
    linkFavoriteImported: "Imported $1 bookmarks in $2 folders; skipped $3",
    linkFavoriteImportInvalid: "Paste valid bookmark export JSON",
    exportLinkFavorites: "Export bookmarks to clipboard",
    linkFavoriteExported: "Bookmarks copied to clipboard",
    linkFavoriteExportFailed: "Unable to copy bookmarks",
    renameLinkFavoriteFolder: "Rename folder",
    deleteLinkFavoriteFolder: "Delete folder",
    confirmDeleteLinkFavoriteFolder: "Delete folder and $1 bookmarks",
    cancelLinkFavoriteFolderDelete: "Cancel",
    renameLinkFavorite: "Rename bookmark",
    moveLinkFavorite: "Move bookmark",
    deleteLinkFavorite: "Delete bookmark",
    moveLinkFavoriteToRoot: "Top level",
    dropLinkFavoriteAtRoot: "Drop here to move to the top level",
    dropLinkFavoriteFolderAtTop: "Drop here to move folder to the top",
    linkFavoriteSaved: "Bookmark saved",
    linkFavoriteDeleted: "$1 bookmark deletion(s) can be undone",
    linkFavoriteDuplicateFolder: "A folder with that name already exists",
    linkFavoriteFolderNameRequired: "Folder name is required",
    linkFavoriteFolderDeleted: "Folder deleted",
    enableLinkFavorites: "Enable link bookmarks",
    disableLinkFavorites: "Disable link bookmarks",
    toggleLinkFavoritesDrawer: "Toggle link bookmarks",
    expandLinkFavoritesDrawer: "Expand link bookmarks",
    collapseLinkFavoritesDrawer: "Collapse link bookmarks",
    closeLinkFavoritesDrawer: "Close link bookmarks",
    reorderLinkFavorite: "Drag to reorder bookmark",
    reorderLinkFavoriteFolder: "Drag to reorder folder",
    expandLinkFavoriteFolder: "Expand folder",
    collapseLinkFavoriteFolder: "Collapse folder",
    collapseAllLinkFavoriteFolders: "Collapse all folders",
    expandAllLinkFavoriteFolders: "Expand all folders",
    closeFavoritesDrawer: "Close favorites",
    favoriteTooltipRarity: "Rarity: $1",
    openFavoritesFullView: "Use full favorites view",
    openFavoritesCompactView: "Use compact favorites view",
    favoritesFullViewTitle: "Favorites",
    closeFavoritesFullView: "Close full favorites view"
  };
  const EXTENSION_CONTEXT_INVALIDATED_RE = /extension context invalidated|context invalidated|message port closed/i;

  const runtime = {
    data: null,
    messages: null,
    state: { ...DEFAULT_STATE },
    allPatterns: new Set(),
    allStatIds: new Set(),
    itemLookupEntries: [],
    categoryLookupEntries: [],
    categoryAliasToSelection: {},
    tradeLocalization: null,
    tradeStatTemplates: new Map(),
    tradeStatsById: new Map(),
    tradeSearchRecords: { items: [], stats: [], categories: [] },
    tradeLocalizationObserver: null,
    tradeLocalizationTimer: null,
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
    tierBridgeMappingsSent: false,
    tierBridgeSignature: "",
    tradeSearchSnapshots: new Map(),
    lastFilterStats: null,
    favoriteLeague: null,
    linkFavoriteLeague: null,
    linkFavoriteLocationHref: null,
    pobCopy: null,
    favorites: null,
    currencyConversion: null,
    deletedFavorite: null,
    deletedFavoriteTimer: null,
    deletedLinkFavorites: [],
    deletedLinkFavoritesTimer: null,
    pendingLinkFavoriteFolderDeleteId: null,
    linkFavoriteFeedback: null,
    linkFavoriteFeedbackTimer: null,
    linkFavoriteImporting: false,
    linkFavoriteImportText: "",
    compactLinkFavoriteTooltipShowTimer: null,
    compactLinkFavoriteTooltipHideTimer: null,
    compactLinkFavoriteTooltipDismissTimer: null,
    compactLinkFavoriteTooltipPointer: null,
    favoritesPanelSessionId: null,
    ui: {}
  };

  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));

  async function bootstrap() {
    runtime.state = await loadState();
    await loadUiMessages(runtime.state.uiLanguage);
    initializePobCopy();
    initializeFavorites();
    initializeCurrencyConversion();
    bindPageBridgeMessages();

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
    initializeTradeLocalization();
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

  function resolveUiLanguage(value) {
    if (SUPPORTED_UI_LANGUAGES.includes(value)) {
      return value;
    }
    const browserLanguage = globalThis.chrome?.i18n?.getUILanguage?.() || "";
    const normalized = String(browserLanguage).replace("-", "_");
    return SUPPORTED_UI_LANGUAGES.includes(normalized) ? normalized : "en";
  }

  function resolvePageLanguage(value) {
    if (SUPPORTED_PAGE_LANGUAGES.includes(value)) {
      return value;
    }
    const browserLanguage = globalThis.chrome?.i18n?.getUILanguage?.() || "";
    const normalized = String(browserLanguage).replace("-", "_");
    return SUPPORTED_PAGE_LANGUAGES.includes(normalized) ? normalized : "en";
  }

  function getMessageLocale(language) {
    const normalized = String(language || "");
    if (normalized.startsWith("zh_CN")) {
      return "zh_CN";
    }
    if (normalized.startsWith("zh_TW")) {
      return "zh_TW";
    }
    return "en";
  }

  async function loadUiMessages(language) {
    const locale = getMessageLocale(resolveUiLanguage(language));
    try {
      const loadMessages = async (messageLocale) => {
        const response = await fetch(chrome.runtime.getURL(`_locales/${messageLocale}/messages.json`));
        if (!response.ok) {
          throw new Error(`Unable to load ${messageLocale} messages: ${response.status}`);
        }
        return response.json();
      };
      runtime.messages = await loadMessages(locale);
    } catch (error) {
      runtime.messages = null;
      console.debug(`[PoE2 Marketwright] unable to load ${locale} messages`, error);
    }
  }

  async function loadState() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const savedState = stored[STORAGE_KEY] || {};
    return {
      ...DEFAULT_STATE,
      ...savedState,
      uiLanguage: resolveUiLanguage(savedState.uiLanguage),
      pageLanguage: resolvePageLanguage(savedState.pageLanguage || savedState.uiLanguage),
      pageTranslationEnabled:
        typeof savedState.pageTranslationEnabled === "boolean"
          ? savedState.pageTranslationEnabled
          : DEFAULT_STATE.pageTranslationEnabled,
      tierEnabled:
        typeof savedState.tierEnabled === "boolean" ? savedState.tierEnabled : DEFAULT_STATE.tierEnabled,
      tierMode: normalizeTierMode(savedState.tierMode),
      favoritesEnabled:
        typeof savedState.favoritesEnabled === "boolean"
          ? savedState.favoritesEnabled
          : DEFAULT_STATE.favoritesEnabled,
      favorites: Array.isArray(savedState.favorites) ? savedState.favorites : [],
      favoritesDrawerOpen:
        typeof savedState.favoritesDrawerOpen === "boolean"
          ? savedState.favoritesDrawerOpen
          : DEFAULT_STATE.favoritesDrawerOpen,
      favoritesViewMode: savedState.favoritesViewMode === "full" ? "full" : DEFAULT_STATE.favoritesViewMode,
      favoritesPanelOpen:
        typeof savedState.favoritesPanelOpen === "boolean"
          ? savedState.favoritesPanelOpen
          : DEFAULT_STATE.favoritesPanelOpen,
      favoritesPanelTab: savedState.favoritesPanelTab === "links" ? "links" : DEFAULT_STATE.favoritesPanelTab,
      linkFavoritesEnabled:
        typeof savedState.linkFavoritesEnabled === "boolean"
          ? savedState.linkFavoritesEnabled
          : DEFAULT_STATE.linkFavoritesEnabled,
      linkFavorites: getLinkFavoriteTools()?.normalizeLinkFavoritesState(savedState.linkFavorites) || DEFAULT_STATE.linkFavorites,
      linkFavoritesDrawerOpen:
        typeof savedState.linkFavoritesDrawerOpen === "boolean"
          ? savedState.linkFavoritesDrawerOpen
          : DEFAULT_STATE.linkFavoritesDrawerOpen,
      sidebarPosition: savedState.sidebarPosition === "right" ? "right" : DEFAULT_STATE.sidebarPosition,
      idleTransparencyEnabled:
        typeof savedState.idleTransparencyEnabled === "boolean"
          ? savedState.idleTransparencyEnabled
          : DEFAULT_STATE.idleTransparencyEnabled,
      idleTransparency: normalizeIdleTransparency(savedState.idleTransparency),
      panelPosition: normalizePanelPosition(savedState.panelPosition),
      collapsedPosition: normalizePanelPosition(savedState.collapsedPosition),
      filteringEnabled:
        typeof savedState.filteringEnabled === "boolean"
          ? savedState.filteringEnabled
          : typeof savedState.enabled === "boolean"
            ? savedState.enabled
            : DEFAULT_STATE.filteringEnabled
    };
  }

  function normalizeIdleTransparency(value) {
    const opacity = Number(value);
    return Number.isInteger(opacity) && opacity >= 20 && opacity <= 90 && opacity % 10 === 0
      ? opacity
      : DEFAULT_STATE.idleTransparency;
  }

  function normalizeTierMode(value) {
    return value === "exact" ? "exact" : "minimum";
  }

  function normalizePanelPosition(position) {
    return Number.isFinite(position?.top) ? { top: position.top } : null;
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

  function applyUiTextureUrls(target) {
    if (!target?.style || !globalThis.chrome?.runtime?.getURL) {
      return;
    }
    const textures = {
      "--mw-tex-panel": "images/ui/panel-fill.png",
      "--mw-tex-metal": "images/ui/metal-fill.png",
      "--mw-tex-brass": "images/ui/brass-fill.png",
      "--mw-tex-btn": "images/ui/btn-face.png",
      "--mw-tex-btn-on": "images/ui/btn-selected.png",
      "--mw-tex-input": "images/ui/input-recess.png",
      "--mw-tex-frame": "images/ui/frame-border.png",
      "--mw-tex-radio-off": "images/ui/radio-off.png",
      "--mw-tex-radio-on": "images/ui/radio-on.png"
    };
    for (const [name, path] of Object.entries(textures)) {
      target.style.setProperty(name, `url("${chrome.runtime.getURL(path)}")`);
    }
  }

  function mountPanel() {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <aside class="poe2-marketwright-link-favorites-drawer" aria-live="polite">
        <div class="poe2-marketwright-link-favorites-header">
          <div class="poe2-marketwright-link-favorites-header-row">
            <span id="poe2-marketwright-link-favorites-league" class="poe2-marketwright-link-favorites-league"></span>
            <div class="poe2-marketwright-link-favorites-header-actions">
              <div id="poe2-marketwright-link-favorites-feedback" class="poe2-marketwright-link-favorite-feedback" aria-live="polite" hidden>
                <span id="poe2-marketwright-link-favorites-feedback-text" class="poe2-marketwright-link-favorites-feedback-text"></span>
                <button id="poe2-marketwright-link-favorites-feedback-undo" class="poe2-marketwright-link-favorites-feedback-undo" type="button" hidden></button>
              </div>
              <button id="poe2-marketwright-link-favorites-import" class="poe2-marketwright-link-favorites-header-action" type="button" aria-label="" title="">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M7.25 1.5h1.5v6.1l2.1-2.1 1.05 1.05L8 10.25 4.2 6.55l1.05-1.05 2 2V1.5zm-5.5 9.2h12.5v3.8H1.75v-3.8zm1.5 1.5v.8h9.5v-.8h-9.5z"></path></svg>
              </button>
              <button id="poe2-marketwright-link-favorites-export" class="poe2-marketwright-link-favorites-header-action" type="button" aria-label="" title="">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.5 4.25 5.25h2.35v4.5h2.8v-4.5h2.35L8 1.5zM1.75 10.5h12.5v4H1.75v-4zm1.5 1.5V13h9.5V12h-9.5z"></path></svg>
              </button>
              <button id="poe2-marketwright-link-favorites-save-root" class="poe2-marketwright-link-favorites-header-action" type="button" aria-label="" title="">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 1.75h8a1 1 0 0 1 1 1v11.1l-5-2.85-5 2.85V2.75a1 1 0 0 1 1-1z"></path></svg>
              </button>
              <button id="poe2-marketwright-link-favorites-collapse-all" class="poe2-marketwright-link-favorites-header-action" type="button" aria-label="" title="">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.2 2.5 8 7.3l4.8-4.8v2.15L8 9.45 3.2 4.65V2.5zm0 6.05L8 13.35l4.8-4.8v2.15L8 15.5 3.2 10.7V8.55z"></path></svg>
              </button>
              <button id="poe2-marketwright-link-favorites-new-folder" class="poe2-marketwright-link-favorites-header-action" type="button" aria-label="" title="">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M1.75 4.25h4l1.2 1.5h7.3v7.5H1.75v-9zm9.5 3v2h-2v1.5h2v2h1.5v-2h2V9.25h-2v-2h-1.5z"></path></svg>
              </button>
              <button id="poe2-marketwright-link-favorites-close" class="poe2-marketwright-link-favorites-close" type="button" aria-label="" title="">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M4 4l8 8m0-8l-8 8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div id="poe2-marketwright-link-favorites-list" class="poe2-marketwright-link-favorites-list"></div>
      </aside>
      <aside class="poe2-marketwright-favorites-drawer" aria-live="polite">
        <div class="poe2-marketwright-favorites-header">
          <div class="poe2-marketwright-favorites-header-row">
            <span id="poe2-marketwright-favorites-league" class="poe2-marketwright-favorites-league"></span>
            <div class="poe2-marketwright-favorites-header-actions">
              <div id="poe2-marketwright-favorites-feedback" class="poe2-marketwright-favorite-feedback" aria-live="polite" hidden>
                <span id="poe2-marketwright-favorites-feedback-text" class="poe2-marketwright-favorites-feedback-text"></span>
                <button id="poe2-marketwright-favorites-feedback-undo" class="poe2-marketwright-favorites-feedback-undo" type="button"></button>
              </div>
              <button id="poe2-marketwright-favorites-close" class="poe2-marketwright-favorites-close" type="button" aria-label="" title="">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M4 4l8 8m0-8l-8 8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"></path>
                </svg>
              </button>
            </div>
          </div>
          <label class="poe2-marketwright-favorites-search-field">
            <input id="poe2-marketwright-favorites-search" type="search" autocomplete="off" spellcheck="false">
          </label>
        </div>
        <div id="poe2-marketwright-favorites-list" class="poe2-marketwright-favorites-list"></div>
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
        <section class="poe2-trade2-affix-filter-feature poe2-trade2-affix-filter-settings-feature">
          <div class="poe2-trade2-affix-filter-feature-header">
            <span id="poe2-trade2-affix-filter-settings-title" class="poe2-trade2-affix-filter-feature-title"></span>
          </div>
          <label class="poe2-trade2-affix-filter-field">
            <span id="poe2-trade2-affix-filter-language-label" class="poe2-trade2-affix-filter-field-label"></span>
            <select id="poe2-trade2-affix-filter-language"></select>
          </label>
          <label class="poe2-trade2-affix-filter-field">
            <span id="poe2-trade2-affix-filter-page-language-label" class="poe2-trade2-affix-filter-field-label"></span>
            <select id="poe2-trade2-affix-filter-page-language"></select>
          </label>
          <div class="poe2-trade2-affix-filter-feature-header">
            <span id="poe2-trade2-affix-filter-page-translation-title" class="poe2-trade2-affix-filter-field-label"></span>
            <button id="poe2-trade2-affix-filter-page-translation-enabled" class="poe2-trade2-affix-filter-toggle poe2-trade2-affix-filter-feature-toggle" type="button"></button>
          </div>
          <div class="poe2-trade2-affix-filter-field">
            <span id="poe2-trade2-affix-filter-sidebar-position-label" class="poe2-trade2-affix-filter-field-label"></span>
            <div id="poe2-trade2-affix-filter-sidebar-position" class="poe2-marketwright-segmented-control" role="radiogroup" aria-labelledby="poe2-trade2-affix-filter-sidebar-position-label">
              <button class="poe2-marketwright-segmented-option" type="button" data-sidebar-position="left" role="radio" aria-checked="false"></button>
              <button class="poe2-marketwright-segmented-option" type="button" data-sidebar-position="right" role="radio" aria-checked="false"></button>
            </div>
          </div>
          <div class="poe2-trade2-affix-filter-feature-header">
            <span id="poe2-trade2-affix-filter-idle-transparency-title" class="poe2-trade2-affix-filter-field-label"></span>
            <button id="poe2-trade2-affix-filter-idle-transparency-enabled" class="poe2-trade2-affix-filter-toggle poe2-trade2-affix-filter-feature-toggle" type="button"></button>
          </div>
          <label class="poe2-trade2-affix-filter-field">
            <span id="poe2-trade2-affix-filter-idle-transparency-opacity-label" class="poe2-trade2-affix-filter-field-label"></span>
            <input id="poe2-trade2-affix-filter-idle-transparency-opacity" type="range" min="20" max="90" step="10">
          </label>
        </section>
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
        <section class="poe2-trade2-affix-filter-feature poe2-marketwright-tier-feature">
          <div class="poe2-trade2-affix-filter-feature-header">
            <span id="poe2-marketwright-tier-title" class="poe2-trade2-affix-filter-feature-title"></span>
            <button id="poe2-marketwright-tier-enabled" class="poe2-trade2-affix-filter-toggle poe2-trade2-affix-filter-feature-toggle" type="button"></button>
          </div>
          <div class="poe2-trade2-affix-filter-field">
            <span id="poe2-marketwright-tier-mode-label" class="poe2-trade2-affix-filter-field-label"></span>
            <div id="poe2-marketwright-tier-mode" class="poe2-marketwright-segmented-control" role="radiogroup" aria-labelledby="poe2-marketwright-tier-mode-label">
              <button class="poe2-marketwright-segmented-option" type="button" data-tier-mode="minimum" role="radio" aria-checked="false"></button>
              <button class="poe2-marketwright-segmented-option" type="button" data-tier-mode="exact" role="radio" aria-checked="false"></button>
            </div>
          </div>
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
          <button id="poe2-marketwright-favorites-view-mode" class="poe2-marketwright-favorites-view-mode" type="button" aria-label="" title=""></button>
          <button id="poe2-marketwright-favorites-enabled" class="poe2-trade2-affix-filter-toggle poe2-trade2-affix-filter-feature-toggle" type="button"></button>
        </section>
        <section class="poe2-trade2-affix-filter-feature poe2-marketwright-link-favorites-feature">
          <button id="poe2-marketwright-link-favorites-disclosure" class="poe2-marketwright-link-favorites-disclosure" type="button" aria-label="" title="">
            <span id="poe2-marketwright-link-favorites-title" class="poe2-trade2-affix-filter-feature-title"></span>
          </button>
          <button id="poe2-marketwright-link-favorites-view-mode" class="poe2-marketwright-favorites-view-mode" type="button" aria-label="" title=""></button>
          <button id="poe2-marketwright-link-favorites-enabled" class="poe2-trade2-affix-filter-toggle poe2-trade2-affix-filter-feature-toggle" type="button"></button>
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

    const compactLinkFavoriteTooltip = document.createElement("aside");
    compactLinkFavoriteTooltip.id = "poe2-marketwright-link-favorite-tooltip";
    compactLinkFavoriteTooltip.className = "poe2-marketwright-link-favorite-tooltip";
    compactLinkFavoriteTooltip.setAttribute("role", "tooltip");
    compactLinkFavoriteTooltip.setAttribute("aria-hidden", "true");
    compactLinkFavoriteTooltip.hidden = true;
    root.appendChild(compactLinkFavoriteTooltip);
    applyUiTextureUrls(document.documentElement);
    document.documentElement.appendChild(root);

    const favoritesPanelFrame = document.createElement("iframe");
    favoritesPanelFrame.id = "poe2-marketwright-favorites-panel-frame";
    favoritesPanelFrame.title = t("favoritesFullViewTitle");
    favoritesPanelFrame.hidden = true;
    favoritesPanelFrame.setAttribute("aria-hidden", "true");
    favoritesPanelFrame.src = chrome.runtime.getURL(
      `favorites-panel.html?session=${encodeURIComponent(getFavoritesPanelSessionId())}`
    );
    document.documentElement.appendChild(favoritesPanelFrame);

    runtime.ui.root = root;
    runtime.ui.favoritesPanelFrame = favoritesPanelFrame;
    runtime.ui.compactLinkFavoriteTooltip = compactLinkFavoriteTooltip;
    compactLinkFavoriteTooltip.addEventListener("pointerenter", clearCompactLinkFavoriteTooltipHideTimer);
    compactLinkFavoriteTooltip.addEventListener("pointerleave", scheduleCompactLinkFavoriteTooltipHide);
    runtime.ui.panel = root.querySelector(".poe2-trade2-affix-filter-panel");
    runtime.ui.linkFavoritesDrawer = root.querySelector(".poe2-marketwright-link-favorites-drawer");
    runtime.ui.linkFavoritesClose = root.querySelector("#poe2-marketwright-link-favorites-close");
    runtime.ui.linkFavoritesImport = root.querySelector("#poe2-marketwright-link-favorites-import");
    runtime.ui.linkFavoritesExport = root.querySelector("#poe2-marketwright-link-favorites-export");
    runtime.ui.linkFavoritesSaveRoot = root.querySelector("#poe2-marketwright-link-favorites-save-root");
    runtime.ui.linkFavoritesCollapseAll = root.querySelector("#poe2-marketwright-link-favorites-collapse-all");
    runtime.ui.linkFavoritesNewFolder = root.querySelector("#poe2-marketwright-link-favorites-new-folder");
    runtime.ui.linkFavoritesDisclosure = root.querySelector("#poe2-marketwright-link-favorites-disclosure");
    runtime.ui.linkFavoritesEnabled = root.querySelector("#poe2-marketwright-link-favorites-enabled");
    runtime.ui.linkFavoritesLeague = root.querySelector("#poe2-marketwright-link-favorites-league");
    runtime.ui.linkFavoritesList = root.querySelector("#poe2-marketwright-link-favorites-list");
    runtime.ui.linkFavoritesFeedback = root.querySelector("#poe2-marketwright-link-favorites-feedback");
    runtime.ui.linkFavoritesFeedbackText = root.querySelector("#poe2-marketwright-link-favorites-feedback-text");
    runtime.ui.linkFavoritesFeedbackUndo = root.querySelector("#poe2-marketwright-link-favorites-feedback-undo");
    runtime.ui.favoritesDrawer = root.querySelector(".poe2-marketwright-favorites-drawer");
    runtime.ui.favoritesClose = root.querySelector("#poe2-marketwright-favorites-close");
    runtime.ui.favoritesDisclosure = root.querySelector("#poe2-marketwright-favorites-disclosure");
    runtime.ui.favoritesEnabled = root.querySelector("#poe2-marketwright-favorites-enabled");
    runtime.ui.favoritesLeague = root.querySelector("#poe2-marketwright-favorites-league");
    runtime.ui.favoritesSearch = root.querySelector("#poe2-marketwright-favorites-search");
    runtime.ui.favoritesList = root.querySelector("#poe2-marketwright-favorites-list");
    runtime.ui.favoritesFeedback = root.querySelector("#poe2-marketwright-favorites-feedback");
    runtime.ui.favoritesFeedbackText = root.querySelector("#poe2-marketwright-favorites-feedback-text");
    runtime.ui.favoritesFeedbackUndo = root.querySelector("#poe2-marketwright-favorites-feedback-undo");
    runtime.ui.collapse = root.querySelector("#poe2-trade2-affix-filter-collapse");
    runtime.ui.expand = root.querySelector("#poe2-trade2-affix-filter-expand");
    runtime.ui.enabled = root.querySelector("#poe2-trade2-affix-filter-enabled");
    runtime.ui.tierEnabled = root.querySelector("#poe2-marketwright-tier-enabled");
    runtime.ui.tierModeOptions = Array.from(root.querySelectorAll("[data-tier-mode]"));
    runtime.ui.pobEnabled = root.querySelector("#poe2-trade2-affix-filter-pob-enabled");
    runtime.ui.currencyEnabled = root.querySelector("#poe2-trade2-affix-filter-currency-enabled");
    runtime.ui.currencyRefresh = root.querySelector("#poe2-trade2-affix-filter-currency-refresh");
    runtime.ui.favoritesViewModes = [
      root.querySelector("#poe2-marketwright-favorites-view-mode"),
      root.querySelector("#poe2-marketwright-link-favorites-view-mode")
    ].filter(Boolean);
    runtime.ui.favoritesViewMode = runtime.ui.favoritesViewModes[0] || null;
    runtime.ui.currencyLeague = root.querySelector("#poe2-trade2-affix-filter-currency-league");
    runtime.ui.settingsTitle = root.querySelector("#poe2-trade2-affix-filter-settings-title");
    runtime.ui.languageLabel = root.querySelector("#poe2-trade2-affix-filter-language-label");
    runtime.ui.language = root.querySelector("#poe2-trade2-affix-filter-language");
    runtime.ui.pageLanguageLabel = root.querySelector("#poe2-trade2-affix-filter-page-language-label");
    runtime.ui.pageLanguage = root.querySelector("#poe2-trade2-affix-filter-page-language");
    runtime.ui.pageTranslationTitle = root.querySelector("#poe2-trade2-affix-filter-page-translation-title");
    runtime.ui.pageTranslationEnabled = root.querySelector("#poe2-trade2-affix-filter-page-translation-enabled");
    runtime.ui.sidebarPositionLabel = root.querySelector("#poe2-trade2-affix-filter-sidebar-position-label");
    runtime.ui.sidebarPositionOptions = Array.from(root.querySelectorAll("[data-sidebar-position]"));
    runtime.ui.idleTransparencyTitle = root.querySelector("#poe2-trade2-affix-filter-idle-transparency-title");
    runtime.ui.idleTransparencyEnabled = root.querySelector("#poe2-trade2-affix-filter-idle-transparency-enabled");
    runtime.ui.idleTransparencyOpacityLabel = root.querySelector("#poe2-trade2-affix-filter-idle-transparency-opacity-label");
    runtime.ui.idleTransparencyOpacity = root.querySelector("#poe2-trade2-affix-filter-idle-transparency-opacity");
    runtime.ui.statTitle = root.querySelector("#poe2-trade2-affix-filter-stat-title");
    runtime.ui.tierTitle = root.querySelector("#poe2-marketwright-tier-title");
    runtime.ui.tierModeLabel = root.querySelector("#poe2-marketwright-tier-mode-label");
    runtime.ui.pobTitle = root.querySelector("#poe2-trade2-affix-filter-pob-title");
    runtime.ui.favoritesTitle = root.querySelector("#poe2-marketwright-favorites-title");
    runtime.ui.linkFavoritesTitle = root.querySelector("#poe2-marketwright-link-favorites-title");
    runtime.ui.currencyTitle = root.querySelector("#poe2-trade2-affix-filter-currency-title");
    runtime.ui.selection = root.querySelector("#poe2-trade2-affix-filter-selection");
    runtime.ui.status = root.querySelector("#poe2-trade2-affix-filter-status");
    runtime.ui.meta = root.querySelector("#poe2-trade2-affix-filter-meta");
    runtime.ui.dragHandle = root.querySelector(".poe2-trade2-affix-filter-header");

    updateStaticUiText();
    const leagueContext = runtime.currencyConversion?.getActiveLeagueContext?.();
    updateCurrencyLeague(leagueContext?.league, leagueContext?.searchUrl);
    populateSelectionOptions(runtime.ui.selection);
    populateLanguageOptions(runtime.ui.language);
    populatePageLanguageOptions(runtime.ui.pageLanguage);

    runtime.ui.selection.value = runtime.state.selection;
    runtime.ui.language.value = runtime.state.uiLanguage;
    runtime.ui.pageLanguage.value = runtime.state.pageLanguage;
    runtime.ui.idleTransparencyOpacity.value = String(runtime.state.idleTransparency);
    updateToggleButton();
    renderFavoriteDrawer();
    renderLinkFavoritesDrawer();
    applyFavoritesDrawerState();
    applyLinkFavoritesDrawerState();
    applyPanelCollapsed();
    applySidebarPosition();
    applyPanelPosition();
    applyFavoritesView();
    bindPanelDrag();
    bindIdleTransparency();
    void registerFavoritesPanelSession();

    runtime.ui.collapse.addEventListener("click", () => {
      runAsync(() => setPanelCollapsed(true), "collapse panel");
    });

    runtime.ui.expand.addEventListener("click", () => {
      if (runtime.ui.suppressExpandClick) {
        return;
      }
      runAsync(() => setPanelCollapsed(false), "expand panel");
    });

    for (const button of runtime.ui.favoritesViewModes) {
      button.addEventListener("click", () => {
        const nextMode = getFavoritesViewMode() === "full" ? "compact" : "full";
        setFavoritesViewMode(nextMode).catch((error) => handleAsyncError(error, "change favorites view mode"));
      });
    }

    runtime.ui.favoritesDisclosure.addEventListener("click", () => {
      toggleFavoritesView("items").catch((error) => handleAsyncError(error, "toggle favorites view"));
    });

    runtime.ui.favoritesClose.addEventListener("click", () => {
      runAsync(() => setFavoritesDrawerOpen(false), "close favorites drawer");
    });

    runtime.ui.linkFavoritesDisclosure.addEventListener("click", () => {
      toggleFavoritesView("links").catch((error) => handleAsyncError(error, "toggle link favorites view"));
    });

    runtime.ui.linkFavoritesClose.addEventListener("click", () => {
      runAsync(() => setLinkFavoritesDrawerOpen(false), "close link favorites drawer");
    });

    runtime.ui.linkFavoritesImport.addEventListener("click", () => {
      if (runtime.ui.linkFavoritesImport.disabled) {
        return;
      }
      runtime.linkFavoriteCreatingFolder = false;
      runtime.linkFavoriteImporting = true;
      renderLinkFavoritesDrawer();
    });

    runtime.ui.linkFavoritesExport.addEventListener("click", () => {
      if (runtime.ui.linkFavoritesExport.disabled) {
        return;
      }
      runAsync(exportLinkFavorites, "export link favorites");
    });

    runtime.ui.linkFavoritesNewFolder.addEventListener("click", () => {
      if (runtime.ui.linkFavoritesNewFolder.disabled) {
        return;
      }
      runtime.linkFavoriteCreatingFolder = true;
      renderLinkFavoritesDrawer();
    });

    runtime.ui.linkFavoritesSaveRoot.addEventListener("click", () => {
      if (runtime.ui.linkFavoritesSaveRoot.disabled) {
        return;
      }
      runAsync(() => createCurrentLinkFavorite(null), "save current root link favorite");
    });

    runtime.ui.linkFavoritesCollapseAll.addEventListener("click", () => {
      if (runtime.ui.linkFavoritesCollapseAll.disabled) {
        return;
      }
      runAsync(toggleAllLinkFavoriteFoldersCollapsed, "toggle all link favorite folders");
    });

    runtime.ui.linkFavoritesFeedbackUndo.addEventListener("click", () => {
      runAsync(undoDeletedLinkFavorite, "undo link favorite deletion");
    });

    runtime.ui.favoritesSearch.addEventListener("input", renderFavoriteDrawer);
    runtime.ui.favoritesFeedbackUndo.addEventListener("click", () => {
      runAsync(undoDeletedFavorite, "undo favorite deletion");
    });

    runtime.ui.enabled.addEventListener("click", () => {
      runtime.state.filteringEnabled = !runtime.state.filteringEnabled;
      runAsync(async () => {
        await saveState();
        scheduleRefresh();
      }, "toggle stat filtering");
    });

    runtime.ui.tierEnabled.addEventListener("click", () => {
      runtime.state.tierEnabled = !runtime.state.tierEnabled;
      updateTierControls();
      runAsync(async () => {
        await saveState();
        scheduleRefresh();
      }, "toggle Tier selection");
    });

    runtime.ui.tierModeOptions.forEach((option) => {
      option.addEventListener("click", () => {
        runtime.state.tierMode = normalizeTierMode(option.dataset.tierMode);
        updateTierControls();
        runAsync(async () => {
          await saveState();
          scheduleRefresh();
        }, "change Tier mode");
      });
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

    runtime.ui.linkFavoritesEnabled.addEventListener("click", () => {
      runtime.state.linkFavoritesEnabled = !runtime.state.linkFavoritesEnabled;
      if (!runtime.state.linkFavoritesEnabled) {
        runtime.state.linkFavoritesDrawerOpen = false;
      }
      updateLinkFavoritesToggleButton();
      applyLinkFavoritesDrawerState();
      applyPanelPosition();
      renderLinkFavoritesDrawer();
      runAsync(async () => {
        await saveState();
        scheduleRefresh();
      }, "toggle link favorites");
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

    runtime.ui.language.addEventListener("change", () => {
      runAsync(() => setUiLanguage(runtime.ui.language.value), "change display language");
    });
    runtime.ui.pageLanguage.addEventListener("change", () => {
      runAsync(() => setPageLanguage(runtime.ui.pageLanguage.value), "change Trade page language");
    });
    runtime.ui.pageTranslationEnabled.addEventListener("click", () => {
      runAsync(() => setPageTranslationEnabled(!isPageTranslationEnabled()), "toggle Trade page translation");
    });
    runtime.ui.sidebarPositionOptions.forEach((option) => {
      option.addEventListener("click", () => {
        runAsync(() => setSidebarPosition(option.dataset.sidebarPosition), "change sidebar position");
      });
    });
    runtime.ui.idleTransparencyEnabled.addEventListener("click", () => {
      runAsync(() => setIdleTransparencyEnabled(!isIdleTransparencyEnabled()), "toggle idle transparency");
    });
    runtime.ui.idleTransparencyOpacity.addEventListener("input", () => {
      setIdleTransparency(runtime.ui.idleTransparencyOpacity.value);
    });
    runtime.ui.idleTransparencyOpacity.addEventListener("change", () => {
      runAsync(() => saveState(), "change idle transparency");
    });
  }

  function updateStaticUiText() {
    runtime.ui.collapse.setAttribute("aria-label", t("collapsePanel"));
    runtime.ui.collapse.title = t("collapsePanel");
    runtime.ui.expand.setAttribute("aria-label", t("expandPanel"));
    runtime.ui.expand.title = t("expandPanel");
    runtime.ui.settingsTitle.textContent = t("generalSettingsTitle");
    runtime.ui.languageLabel.textContent = t("language");
    runtime.ui.pageLanguageLabel.textContent = t("tradePageLanguage");
    runtime.ui.pageTranslationTitle.textContent = t("tradePageTranslation");
    runtime.ui.sidebarPositionLabel.textContent = t("sidebarPosition");
    runtime.ui.sidebarPositionOptions.forEach((option) => {
      option.textContent = t(option.dataset.sidebarPosition === "right" ? "sidebarPositionRight" : "sidebarPositionLeft");
    });
    runtime.ui.idleTransparencyTitle.textContent = t("idleTransparency");
    runtime.ui.statTitle.textContent = t("statFilterTitle");
    runtime.ui.tierTitle.textContent = t("tierFeatureTitle");
    runtime.ui.tierModeLabel.textContent = t("tierMode");
    runtime.ui.pobTitle.textContent = t("pobCopyTitle");
    runtime.ui.favoritesTitle.textContent = t("favoritesTitle");
    runtime.ui.linkFavoritesTitle.textContent = t("linkFavoritesTitle");
    runtime.ui.currencyTitle.textContent = t("currencyConversionTitle");
    runtime.ui.currencyRefresh.setAttribute("aria-label", t("refreshCurrencyConversion"));
    runtime.ui.currencyRefresh.title = t("refreshCurrencyConversion");
    updateFavoritesViewModeButton();
    runtime.ui.favoritesSearch.placeholder = t("favoritesSearch");
    runtime.ui.favoritesSearch.setAttribute("aria-label", t("favoritesSearch"));
    runtime.ui.favoritesFeedbackText.textContent = t("favoriteDeleted");
    runtime.ui.favoritesFeedbackUndo.textContent = t("undoFavoriteDelete");
    runtime.ui.favoritesFeedbackUndo.title = t("undoFavoriteDelete");
    runtime.ui.favoritesClose.setAttribute("aria-label", t("closeFavoritesDrawer"));
    runtime.ui.favoritesClose.title = t("closeFavoritesDrawer");
    runtime.ui.linkFavoritesImport.setAttribute("aria-label", t("importLinkFavorites"));
    runtime.ui.linkFavoritesImport.title = t("importLinkFavorites");
    runtime.ui.linkFavoritesExport.setAttribute("aria-label", t("exportLinkFavorites"));
    runtime.ui.linkFavoritesExport.title = t("exportLinkFavorites");
    runtime.ui.linkFavoritesNewFolder.setAttribute("aria-label", t("createLinkFavoriteFolder"));
    runtime.ui.linkFavoritesSaveRoot.setAttribute("aria-label", t("createLinkFavorite"));
    runtime.ui.linkFavoritesSaveRoot.title = t("createLinkFavorite");
    runtime.ui.linkFavoritesCollapseAll.setAttribute("aria-label", t("collapseAllLinkFavoriteFolders"));
    runtime.ui.linkFavoritesCollapseAll.title = t("collapseAllLinkFavoriteFolders");
    runtime.ui.linkFavoritesFeedbackUndo.textContent = t("undoFavoriteDelete");
    runtime.ui.linkFavoritesFeedbackUndo.title = t("undoFavoriteDelete");
    runtime.ui.linkFavoritesClose.setAttribute("aria-label", t("closeLinkFavoritesDrawer"));
    runtime.ui.linkFavoritesClose.title = t("closeLinkFavoritesDrawer");
    runtime.ui.tierModeOptions.forEach((option) => {
      option.textContent = t(option.dataset.tierMode === "exact" ? "tierModeExact" : "tierModeMinimum");
    });
    updateSidebarPositionControls();
    applyFavoritesDrawerState();
    applyLinkFavoritesDrawerState();
  }

  function populateLanguageOptions(select) {
    if (!select) {
      return;
    }
    select.replaceChildren();
    const labels = {
      en: t("languageEnglish"),
      zh_CN: t("languageSimplifiedChinese"),
      zh_TW: t("languageTraditionalChinese")
    };
    for (const language of SUPPORTED_UI_LANGUAGES) {
      const option = document.createElement("option");
      option.value = language;
      option.textContent = labels[language];
      select.appendChild(option);
    }
  }

  function populatePageLanguageOptions(select) {
    if (!select) {
      return;
    }
    select.replaceChildren();
    const labels = {
      en: t("languageEnglish"),
      zh_CN: t("languageSimplifiedChinese"),
      zh_TW: t("languageTraditionalChinese"),
      zh_CN_en: t("languageSimplifiedChineseBilingual"),
      zh_TW_en: t("languageTraditionalChineseBilingual")
    };
    for (const language of SUPPORTED_PAGE_LANGUAGES) {
      const option = document.createElement("option");
      option.value = language;
      option.textContent = labels[language];
      select.appendChild(option);
    }
  }

  async function setUiLanguage(language) {
    const nextLanguage = resolveUiLanguage(language);
    if (runtime.state.uiLanguage === nextLanguage) {
      runtime.ui.language.value = nextLanguage;
      return;
    }
    runtime.state.uiLanguage = nextLanguage;
    await loadUiMessages(nextLanguage);
    refreshLocalizedUi();
    await saveState();
  }

  async function setPageLanguage(language) {
    const nextLanguage = resolvePageLanguage(language);
    if (runtime.state.pageLanguage === nextLanguage) {
      runtime.ui.pageLanguage.value = nextLanguage;
      return;
    }
    runtime.state.pageLanguage = nextLanguage;
    runtime.ui.pageLanguage.value = nextLanguage;
    clearNativeTradeItemSearchCache();
    refreshTradeLocalization();
    await saveState();
    reloadTradePageForNativeLocalization();
  }

  async function setPageTranslationEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (runtime.state.pageTranslationEnabled === nextEnabled) {
      return;
    }
    runtime.state.pageTranslationEnabled = nextEnabled;
    clearNativeTradeItemSearchCache();
    if (nextEnabled) {
      startTradeLocalizationObserver();
    }
    refreshTradeLocalization();
    if (!nextEnabled) {
      runtime.tradeLocalizationObserver?.disconnect();
      runtime.tradeLocalizationObserver = null;
    }
    updatePageTranslationToggleButton();
    await saveState();
    reloadTradePageForNativeLocalization();
  }

  function getSidebarPosition() {
    return runtime.state.sidebarPosition === "right" ? "right" : "left";
  }

  async function setSidebarPosition(position) {
    const nextPosition = position === "right" ? "right" : "left";
    runtime.state.sidebarPosition = nextPosition;
    updateSidebarPositionControls();
    applySidebarPosition();
    applyPanelPosition();
    await saveState();
  }

  function isIdleTransparencyEnabled() {
    return runtime.state.idleTransparencyEnabled !== false;
  }

  async function setIdleTransparencyEnabled(enabled) {
    runtime.state.idleTransparencyEnabled = Boolean(enabled);
    updateIdleTransparencyControls();
    applyIdleTransparency();
    await saveState();
  }

  function setIdleTransparency(value) {
    runtime.state.idleTransparency = normalizeIdleTransparency(value);
    updateIdleTransparencyControls();
    applyIdleTransparency();
  }

  function reloadTradePageForNativeLocalization() {
    window.location.reload();
  }

  function clearNativeTradeItemSearchCache() {
    try {
      for (const cacheKey of NATIVE_TRADE_CACHE_KEYS) {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}-cacheexpiration`);
      }
      localStorage.removeItem(NATIVE_TRADE_CACHE_MARKER_KEY);
      localStorage.removeItem(LEGACY_NATIVE_ITEM_CACHE_MARKER_KEY);
    } catch (error) {
      console.debug("[PoE2 Marketwright] unable to clear native item cache", error);
    }
  }

  function refreshLocalizedUi() {
    if (!runtime.ui.root) {
      return;
    }
    updateStaticUiText();
    populateLanguageOptions(runtime.ui.language);
    runtime.ui.language.value = runtime.state.uiLanguage;
    populatePageLanguageOptions(runtime.ui.pageLanguage);
    runtime.ui.pageLanguage.value = runtime.state.pageLanguage;
    const selection = runtime.state.selection;
    populateSelectionOptions(runtime.ui.selection);
    runtime.ui.selection.value = selection;
    runtime.ui.favoritesPanelFrame.title = t("favoritesFullViewTitle");
    runtime.pobCopy?.setLabels?.({
      ready: t("pobCopyReady"),
      loading: t("pobCopyLoading"),
      ok: t("pobCopyOk"),
      error: t("pobCopyError")
    });
    runtime.favorites?.setLabels?.({
      add: t("favoriteSave"),
      remove: t("favoriteRemove"),
      loading: t("favoriteLoading"),
      saved: t("favoriteSaved"),
      removed: t("favoriteRemoved"),
      error: t("favoriteError")
    });
    runtime.currencyConversion?.setLabels?.({
      showExalted: t("showExalted"),
      showChaos: t("showChaos"),
      showDivine: t("showDivine"),
      currencyExalted: t("currencyExalted"),
      currencyChaos: t("currencyChaos"),
      currencyDivine: t("currencyDivine"),
      loading: t("currencyLoading"),
      unavailable: t("currencyUnavailable")
    });
    updateToggleButton();
    renderFavoriteDrawer();
    renderLinkFavoritesDrawer();
    publishFavoritesPanelState();
    scheduleRefresh();
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
    const entry = runtime.messages?.[key];
    const message = entry?.message || globalThis.chrome?.i18n?.getMessage?.(
      key,
      values.map((value) => String(value))
    );
    const template = message || fallback || I18N_FALLBACKS[key] || key;
    const namedValues = entry?.placeholders || {};
    const withNamedSubstitutions = Object.entries(namedValues).reduce((text, [name, placeholder]) => {
      const index = Number(String(placeholder?.content || "").match(/^\$(\d+)$/)?.[1]);
      return Number.isInteger(index) && index > 0
        ? text.replaceAll(`$${name.toUpperCase()}$`, String(values[index - 1] ?? ""))
        : text;
    }, template);
    return values.reduce((text, value, index) => text.replaceAll(`$${index + 1}`, String(value)), withNamedSubstitutions);
  }

  function updateFavoritesViewModeButton() {
    const buttons = runtime.ui?.favoritesViewModes || [runtime.ui?.favoritesViewMode].filter(Boolean);
    if (!buttons.length) {
      return;
    }
    const full = getFavoritesViewMode() === "full";
    const title = t(full ? "openFavoritesCompactView" : "openFavoritesFullView");
    const path = full
      ? "M4 4h8v8H4V4zm1.5 1.5v5h5v-5h-5zM2 2h12v12H2V2zm1.5 1.5v9h9v-9h-9z"
      : "M2 2h12v12H2V2zm1.5 1.5v9h5v-9h-5zm6.5 0v9h2.5v-9H10z";
    for (const button of buttons) {
      button.setAttribute("aria-label", title);
      button.setAttribute("aria-pressed", String(full));
      button.title = title;
      button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${path}"></path></svg>`;
    }
  }

  function getFavoriteTools() {
    const factory = globalThis.Poe2MarketwrightFavorites?.createFavoriteTools;
    return factory ? factory() : null;
  }

  function getLinkFavoriteTools() {
    const factory = globalThis.Poe2MarketwrightFavorites?.createLinkFavoriteTools;
    return factory ? factory() : null;
  }

  function getFavoritesViewMode() {
    return runtime.state?.favoritesViewMode === "full" ? "full" : "compact";
  }

  function getFavoritesPanelTab() {
    return runtime.state?.favoritesPanelTab === "links" ? "links" : "items";
  }

  function isFavoritesFullViewFallbackActive() {
    return false;
  }

  function getFavoritesPanelSessionId() {
    if (runtime.favoritesPanelSessionId) {
      return runtime.favoritesPanelSessionId;
    }
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    runtime.favoritesPanelSessionId = `favorites-${id}`.replace(/[^a-zA-Z0-9_-]/g, "");
    return runtime.favoritesPanelSessionId;
  }

  async function registerFavoritesPanelSession() {
    if (!chrome.runtime?.sendMessage) {
      return;
    }
    try {
      await chrome.runtime.sendMessage({
        type: "favorites-panel-register",
        sessionId: getFavoritesPanelSessionId()
      });
    } catch (error) {
      if (!isExtensionContextInvalidated(error)) {
        console.debug("[PoE2 Marketwright] unable to register favorites panel", error);
      }
    }
  }

  function applyFavoritesView() {
    const visible = getFavoritesViewMode() === "full" && runtime.state.favoritesPanelOpen;
    const frame = runtime.ui?.favoritesPanelFrame;
    if (frame) {
      frame.hidden = !visible;
      frame.setAttribute("aria-hidden", String(!visible));
    }
    if (!visible) {
      runtime.favoritesPanelHovered = false;
      updateIdleTransparencyState();
    }
    runtime.ui?.root?.classList?.toggle("poe2-marketwright-favorites-full-view-open", visible);
    applyFavoritesDrawerState();
    applyLinkFavoritesDrawerState();
    updateFavoritesViewModeButton();
  }

  function applySidebarPosition() {
    const right = getSidebarPosition() === "right";
    runtime.ui?.root?.classList?.toggle("poe2-marketwright-sidebar-right", right);
    runtime.ui?.favoritesPanelFrame?.classList?.toggle("poe2-marketwright-sidebar-right", right);
  }

  function bindIdleTransparency() {
    const root = runtime.ui?.root;
    if (!root) {
      return;
    }
    root.addEventListener("pointerenter", () => setSidebarHovered(true));
    root.addEventListener("pointerleave", () => setSidebarHovered(false));
    root.addEventListener("focusin", updateIdleTransparencyState);
    root.addEventListener("focusout", () => {
      window.setTimeout?.(updateIdleTransparencyState, 0);
    });
    window.addEventListener("message", (event) => {
      if (
        event.source !== runtime.ui?.favoritesPanelFrame?.contentWindow ||
        event.data?.type !== "poe2-marketwright-favorites-panel-hover"
      ) {
        return;
      }
      setFavoritesPanelHovered(event.data.hovered === true);
    });
    applyIdleTransparency();
  }

  function setSidebarHovered(hovered) {
    runtime.sidebarHovered = Boolean(hovered);
    updateIdleTransparencyState();
  }

  function setFavoritesPanelHovered(hovered) {
    runtime.favoritesPanelHovered = Boolean(hovered);
    updateIdleTransparencyState();
  }

  function isIdleTransparencySuppressed() {
    const active = document.activeElement;
    return Boolean(
      runtime.linkFavoriteDrag ||
      active?.classList?.contains("poe2-marketwright-favorite-rename-input") ||
      active?.classList?.contains("poe2-marketwright-link-favorite-rename-input")
    );
  }

  function updateIdleTransparencyState() {
    window.clearTimeout?.(runtime.idleTransparencyTimer);
    if (
      runtime.sidebarHovered ||
      runtime.favoritesPanelHovered ||
      isIdleTransparencySuppressed() ||
      !isIdleTransparencyEnabled()
    ) {
      applyIdleTransparency();
      return;
    }
    if (!window.setTimeout) {
      applyIdleTransparency();
      return;
    }
    runtime.idleTransparencyTimer = window.setTimeout(applyIdleTransparency, 200);
  }

  function applyIdleTransparency() {
    const idle = Boolean(
      isIdleTransparencyEnabled() &&
        !runtime.sidebarHovered &&
        !runtime.favoritesPanelHovered &&
        !isIdleTransparencySuppressed()
    );
    const opacity = String(normalizeIdleTransparency(runtime.state.idleTransparency) / 100);
    for (const element of [runtime.ui?.root, runtime.ui?.favoritesPanelFrame]) {
      element?.classList?.toggle("poe2-marketwright-idle", idle);
      element?.style?.setProperty("--poe2-marketwright-idle-opacity", opacity);
    }
  }

  async function setFavoritesViewMode(mode) {
    const nextMode = mode === "full" ? "full" : "compact";
    const previousMode = getFavoritesViewMode();
    const tab = previousMode === "full"
      ? getFavoritesPanelTab()
      : runtime.state.linkFavoritesDrawerOpen
        ? "links"
        : "items";
    const wasOpen = previousMode === "full"
      ? Boolean(runtime.state.favoritesPanelOpen)
      : Boolean(runtime.state.favoritesDrawerOpen || runtime.state.linkFavoritesDrawerOpen);
    runtime.state.favoritesViewMode = nextMode;
    runtime.state.favoritesPanelTab = tab;
    runtime.state.favoritesDrawerOpen = nextMode === "compact" && wasOpen && tab === "items";
    runtime.state.linkFavoritesDrawerOpen = nextMode === "compact" && wasOpen && tab === "links";
    const shouldOpen = nextMode === "full" && wasOpen;
    runtime.state.favoritesPanelOpen = shouldOpen;
    applyFavoritesView();
    renderFavoriteDrawer();
    renderLinkFavoritesDrawer();
    await saveState();
    publishFavoritesPanelState();
  }

  async function toggleFavoritesView(tab) {
    const nextTab = tab === "links" ? "links" : "items";
    if (getFavoritesViewMode() === "full") {
      const shouldOpen = !runtime.state.favoritesPanelOpen || getFavoritesPanelTab() !== nextTab;
      await setFavoritesPanelOpen(shouldOpen, nextTab);
      return;
    }
    if (nextTab === "items") {
      await setFavoritesDrawerOpen(!runtime.state.favoritesDrawerOpen);
      return;
    }
    await setLinkFavoritesDrawerOpen(!runtime.state.linkFavoritesDrawerOpen);
  }

  async function setFavoritesPanelOpen(open, tab = getFavoritesPanelTab()) {
    runtime.state.favoritesPanelTab = tab === "links" ? "links" : "items";
    runtime.state.favoritesPanelOpen = Boolean(open);
    runtime.state.favoritesDrawerOpen = false;
    runtime.state.linkFavoritesDrawerOpen = false;
    if (!open) {
      runtime.linkFavoriteImporting = false;
      runtime.linkFavoriteImportText = "";
    }
    applyFavoritesView();
    renderFavoriteDrawer();
    renderLinkFavoritesDrawer();
    await saveState();
    publishFavoritesPanelState();
  }

  function getFavoritesPanelState() {
    const favoriteLeague = getCurrentFavoriteLeague();
    const linkContext = getCurrentLinkFavoriteContext();
    const league = linkContext?.league || favoriteLeague;
    const favorites = league
      ? (runtime.state.favorites || [])
          .filter((favorite) => favorite?.league === league)
          .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
      : [];
    const leagueState = league ? getLinkFavoriteLeagueState(runtime.state.linkFavorites, league) : null;
    const folders = (leagueState?.folderOrder || [])
      .map((folderId) => getLinkFavoriteFolder(leagueState, folderId))
      .filter(Boolean);
    return {
      available: Boolean(league),
      league: league || null,
      uiLanguage: runtime.state.uiLanguage,
      favoritesViewMode: getFavoritesViewMode(),
      favoritesPanelOpen: Boolean(runtime.state.favoritesPanelOpen),
      favoritesPanelTab: getFavoritesPanelTab(),
      favoritesEnabled: Boolean(runtime.state.favoritesEnabled),
      linkFavoritesEnabled: Boolean(runtime.state.linkFavoritesEnabled),
      favorites: favorites.map(getFavoritePresentation),
      linkFavorites: {
        folders,
        links: (leagueState?.links || []).map(getLinkFavoritePresentation),
        rootLinkIds: leagueState?.rootLinkIds || [],
        folderLinkIds: leagueState?.folderLinkIds || {}
      },
      canSaveCurrentLink: Boolean(linkContext),
      deletedFavorite: Boolean(runtime.deletedFavorite),
      deletedLinkCount: runtime.deletedLinkFavorites.length,
      feedback: runtime.linkFavoriteFeedback || null
    };
  }

  function publishFavoritesPanelState() {
    if (!chrome.runtime?.sendMessage || !runtime.favoritesPanelSessionId) {
      return;
    }
    Promise.resolve(
      chrome.runtime.sendMessage({
        type: "favorites-panel-state-update",
        sessionId: runtime.favoritesPanelSessionId,
        state: getFavoritesPanelState()
      })
    ).catch((error) => {
      if (!isExtensionContextInvalidated(error)) {
        console.debug("[PoE2 Marketwright] unable to update favorites panel", error);
      }
    });
  }

  async function handleFavoritesPanelCommand(command, payload = {}) {
    switch (command) {
      case "get-state":
        break;
      case "close-panel":
        await setFavoritesPanelOpen(false);
        break;
      case "set-view-mode":
        await setFavoritesViewMode(payload.mode);
        break;
      case "select-tab":
        await setFavoritesPanelOpen(true, payload.tab);
        break;
      case "rename-favorite": {
        const favorite = runtime.state.favorites.find((entry) => entry?.signature === payload.signature);
        if (favorite) {
          await renameFavorite(favorite, payload.name);
        }
        break;
      }
      case "delete-favorite": {
        const favorite = runtime.state.favorites.find((entry) => entry?.signature === payload.signature);
        if (favorite) {
          await deleteFavorite(favorite);
        }
        break;
      }
      case "undo-favorite":
        await undoDeletedFavorite();
        break;
      case "launch-favorite": {
        const favorite = runtime.state.favorites.find((entry) => entry?.signature === payload.signature);
        if (favorite) {
          await launchFavoriteSearch(favorite);
        }
        break;
      }
      case "open-link":
        await launchLinkFavorite(payload.linkId);
        break;
      case "create-folder":
        await createLinkFavoriteFolder(payload.name);
        break;
      case "rename-folder":
        await renameLinkFavoriteFolder(payload.folderId, payload.name);
        break;
      case "delete-folder":
        if (payload.confirm === true) {
          await deleteLinkFavoriteFolder(payload.folderId);
        }
        break;
      case "save-link":
        await createCurrentLinkFavorite(payload.folderId || null);
        break;
      case "import-links":
        await importLinkFavorites(payload.text);
        break;
      case "export-links":
        await exportLinkFavorites();
        break;
      case "rename-link":
        await renameLinkFavorite(payload.linkId, payload.name);
        break;
      case "move-link":
        await moveLinkFavorite(payload.linkId, payload.folderId || null, payload.targetId || null, payload.placeAfter !== false);
        break;
      case "delete-link":
        await deleteLinkFavorite(payload.linkId);
        break;
      case "undo-link":
        await undoDeletedLinkFavorite();
        break;
      case "reorder-link":
        await reorderLinkFavorite(payload.linkId, payload.folderId || null, payload.targetId, payload.placeAfter !== false);
        break;
      case "reorder-folder":
        await reorderLinkFavoriteFolder(payload.folderId, payload.targetId, payload.placeAfter !== false);
        break;
      case "toggle-folder":
        await setLinkFavoriteFolderCollapsed(payload.folderId, Boolean(payload.collapsed));
        break;
      case "toggle-all-folders":
        await toggleAllLinkFavoriteFoldersCollapsed();
        break;
      default:
        return { ok: false, error: "unsupported_panel_command" };
    }
    return { ok: true, state: getFavoritesPanelState() };
  }

  function bindFavoritesPanelMessages() {
    if (!chrome.runtime?.onMessage) {
      return;
    }
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (
        message?.type !== "favorites-panel-command" ||
        message.sessionId !== runtime.favoritesPanelSessionId ||
        sender?.id !== chrome.runtime.id
      ) {
        return;
      }
      handleFavoritesPanelCommand(message.command, message.payload)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
      return true;
    });
  }

  function getCurrentFavoriteLeague() {
    return getFavoriteTools()?.getLeagueFromTradeUrl(window.location.href) || null;
  }

  function getCurrentLinkFavoriteContext() {
    const tools = getLinkFavoriteTools();
    if (!tools) {
      return null;
    }
    let current;
    try {
      current = tools.validateTradeSearchUrl(window.location.href);
    } catch (error) {
      return null;
    }

    const displaySnapshot = runtime.tradeSearchSnapshots?.get(`${current.league}\u0000${current.queryId}`) || null;
    let filterGroups = [];
    try {
      filterGroups = getCurrentLinkFavoriteFilterGroups();
    } catch (error) {
      // Trade replaces advanced-filter nodes during updates; the URL is still a valid bookmark.
    }
    let displayName = t("linkFavoriteUnnamedSearch");
    try {
      displayName = getCurrentLinkFavoriteDisplayName() || displayName;
    } catch (error) {
      // A transient search-bar render must not disable link bookmarking.
    }
    return {
      ...current,
      displayName,
      ...(filterGroups.length ? { filterGroups } : {}),
      ...(displaySnapshot ? { displaySnapshot } : {})
    };
  }

  function getCurrentLinkFavoriteLeague() {
    return getFavoriteTools()?.getLeagueFromTradeUrl(window.location.href) || getCurrentLinkFavoriteContext()?.league || null;
  }

  function getCurrentLinkFavoriteDisplayName() {
    return getLinkFavoriteDisplayNameFromSelections(
      collectMultiselectSelectedTexts(getItemSearchRoot() || getItemSearchInput()),
      collectMultiselectSelectedTexts(getTypeCategoryMultiselect())
    );
  }

  function getCurrentLinkFavoriteFilterGroups() {
    const groups = [];
    for (const group of document.querySelectorAll(TYPE_FILTER_GROUP_SELECTOR)) {
      const label = getLinkFavoriteFilterGroupLabel(group);
      const values = getLinkFavoriteFilterGroupValues(group);
      if (label && values.length && !isLinkFavoriteExcludedFilterGroup(label)) {
        groups.push({ label, values });
      }
    }
    return getLinkFavoriteTools()?.normalizeLinkFavoriteFilterGroups?.(groups) || groups;
  }

  function getLinkFavoriteFilterGroupLabel(group) {
    const header = group.querySelector(
      ".filter-group-header .filter-group-title, .filter-group-header .filter-title, .filter-group-title, .filter-group-header"
    );
    return getLinkFavoriteFilterText(header?.textContent || "");
  }

  function isLinkFavoriteExcludedFilterGroup(label) {
    const normalized = normalizeLookupText(label);
    return normalized === "trade filters" || normalized === "交易過濾" || normalized === "交易过滤";
  }

  function getLinkFavoriteFilterGroupValues(group) {
    const body = group.querySelector(".filter-group-body") || group;
    const directFields = Array.from(body.children || []).filter(
      (element) => element.matches?.(".filter, .filter-property")
    );
    const fields = directFields.length
      ? directFields
      : Array.from(body.querySelectorAll(".filter.filter-property, .filter"));
    const values = [];
    for (const field of fields) {
      const label = getLinkFavoriteFilterFieldLabel(field);
      const fieldValues = getLinkFavoriteFilterFieldValues(field, label);
      if (!fieldValues.length) {
        continue;
      }
      const value = fieldValues.join(" / ");
      values.push(label && value !== label ? `${label}: ${value}` : value);
    }
    return values;
  }

  function getLinkFavoriteFilterFieldLabel(field) {
    const selectors = [
      ".filter-title",
      ".filter-label",
      ".filter-name",
      ".filter-property-name",
      "[data-field-label]",
      "label"
    ];
    for (const selector of selectors) {
      const label = field.querySelector(selector);
      const text = getLinkFavoriteFilterText(getLinkFavoriteFilterFieldLabelText(label));
      if (text) {
        return text;
      }
    }
    return "";
  }

  function getLinkFavoriteFilterFieldLabelText(label) {
    const explicit = label?.getAttribute?.("data-field-label");
    if (explicit) {
      return explicit;
    }
    const directText = getLinkFavoriteFilterText(
      Array.from(label?.childNodes || [])
        .filter((node) => node?.nodeType === 3)
        .map((node) => node.nodeValue || "")
        .join(" ")
    );
    return directText || label?.textContent || "";
  }

  function getLinkFavoriteFilterFieldValues(field, fieldLabel) {
    const values = [];
    const range = { min: "", max: "" };
    const addValue = (value) => {
      const text = getLinkFavoriteFilterText(value);
      if (text && !isIgnorableSelectionText(text) && !values.includes(text)) {
        values.push(text);
      }
    };

    for (const multiselect of field.querySelectorAll(".multiselect")) {
      if (multiselect.parentElement?.closest?.(".multiselect")) {
        continue;
      }
      for (const value of collectMultiselectSelectedTexts(multiselect)) {
        addValue(value);
      }
    }

    for (const select of field.querySelectorAll("select")) {
      const option = select.selectedOptions?.[0];
      addValue(option?.textContent || select.value || "");
    }

    for (const input of field.querySelectorAll("input")) {
      const type = String(input.type || "text").toLowerCase();
      if (input.closest(".multiselect") || type === "hidden" || type === "button" || type === "submit") {
        continue;
      }
      if (type === "checkbox" || type === "radio") {
        if (input.checked) {
          addValue(input.getAttribute("aria-label") || input.name || input.value || fieldLabel);
        }
        continue;
      }
      const value = getLinkFavoriteFilterText(input.value || "");
      if (!value) {
        continue;
      }
      const ariaLabel = getLinkFavoriteFilterText(input.getAttribute("aria-label") || "");
      const qualifier = getLinkFavoriteFilterText(
        input.placeholder || (ariaLabel.length <= 48 ? ariaLabel : "") || input.name || ""
      );
      const bound = getLinkFavoriteRangeBound(qualifier);
      if (bound) {
        range[bound] = value;
        continue;
      }
      addValue(qualifier && qualifier !== fieldLabel ? `${qualifier} ${value}` : value);
    }

    const formattedRange = formatLinkFavoriteRange(range.min, range.max);
    if (formattedRange) {
      addValue(formattedRange);
    }

    for (const button of field.querySelectorAll("button.selected, button.active, [role='button'][aria-pressed='true']")) {
      addValue(button.textContent || button.getAttribute("aria-label") || "");
    }

    return values;
  }

  function getLinkFavoriteFilterText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getLinkFavoriteRangeBound(label) {
    const normalized = getLinkFavoriteFilterText(label).toLocaleLowerCase();
    if (/^(?:min(?:imum)?|\u6700\u5c0f(?:\u503c)?)$/.test(normalized)) {
      return "min";
    }
    if (/^(?:max(?:imum)?|\u6700\u5927(?:\u503c)?)$/.test(normalized)) {
      return "max";
    }
    return null;
  }

  function formatLinkFavoriteRange(minimum, maximum) {
    const min = getLinkFavoriteFilterText(minimum);
    const max = getLinkFavoriteFilterText(maximum);
    return min || max ? `${min} - ${max}`.trim() : "";
  }

  function getLocalizedLinkFavoriteFilterLabel(value) {
    const text = getLinkFavoriteFilterText(value);
    if (!text || !isPageTranslationEnabled()) {
      return text;
    }
    const localized = getLocalizedTradeText(text);
    if (localized !== text) {
      return localized;
    }
    return text;
  }

  function localizeLinkFavoriteFilterValue(value) {
    const text = getLinkFavoriteFilterText(value);
    const separatorIndex = text.search(/[:\uff1a]/);
    if (separatorIndex < 0) {
      return getLocalizedLinkFavoriteFilterLabel(text);
    }
    const label = text.slice(0, separatorIndex);
    return `${getLocalizedLinkFavoriteFilterLabel(label)}${text.slice(separatorIndex)}`;
  }

  function localizeLinkFavoriteFilterGroups(groups) {
    return (groups || []).map((group) => ({
      ...group,
      label: getLocalizedLinkFavoriteFilterLabel(group?.label),
      values: (group?.values || []).map(localizeLinkFavoriteFilterValue)
    }));
  }

  function getLinkFavoriteDisplayNameFromSelections(itemTexts, categoryTexts) {
    const findSelectionName = (texts, lookup) => {
      for (const text of texts) {
        const displayText = String(text).replace(/\s+/g, " ").trim();
        for (const segment of splitCandidateText(text)) {
          if (lookup(segment)) {
            return normalizeLookupText(displayText) === segment ? displayText : segment;
          }
        }
      }
      return null;
    };
    const baseName = findSelectionName(
      itemTexts,
      (segment) => Boolean(lookupItemNameSelection(segment))
    );
    if (baseName) {
      return baseName;
    }
    const categoryName = findSelectionName(
      categoryTexts,
      (segment) => Boolean(lookupSelectionSegment(segment))
    );
    return categoryName || t("linkFavoriteUnnamedSearch");
  }

  function getFavoriteItemClassification(item) {
    if (!runtime.data) {
      return null;
    }
    const baseName = String(item?.typeLine || item?.baseType || "").trim();
    const selection = lookupItemNameSelection(normalizeLookupText(baseName));
    const category = selection?.kind === "page" ? FAVORITE_TRADE_CATEGORY_BY_PAGE[selection.id] : null;
    if (!baseName || !category) {
      return null;
    }
    return {
      baseName,
      category,
      itemType: FAVORITE_TRADE_CATEGORY_LABELS[category] || category,
      selection: { kind: selection.kind, id: selection.id }
    };
  }

  function getDisplayMetadata() {
    return runtime.data?.displayMetadata || {};
  }

  function getLocalizedDisplayText(record, fallback) {
    return getLocalizedDisplayTextForLanguage(record, fallback, runtime.state.uiLanguage);
  }

  function getLocalizedDisplayTextForLanguage(record, fallback, languageValue) {
    const language = resolvePageLanguage(languageValue);
    if (language === "en") {
      return String(record?.en || fallback || "");
    }
    const locale = getMessageLocale(language);
    const localized = String(record?.[locale] || record?.en || fallback || "");
    const english = String(record?.en || fallback || "");
    return language.endsWith("_en") && localized && english && localized !== english
      ? `${localized} (${english})`
      : localized;
  }

  function getFavoriteItemRecord(name) {
    const items = getDisplayMetadata().items || {};
    return items[name] || items[normalizeLookupText(name)] || null;
  }

  function getFavoriteSelection(favorite) {
    const selection = favorite?.itemSelection;
    if (selection?.kind && selection?.id) {
      return selection;
    }
    return lookupItemNameSelection(normalizeLookupText(favorite?.baseName || ""));
  }

  function getLocalizedFavoriteBaseName(favorite) {
    return getLocalizedDisplayText(getFavoriteItemRecord(favorite?.baseName), favorite?.baseName);
  }

  function getLocalizedFavoriteItemType(favorite) {
    const selection = getFavoriteSelection(favorite);
    return selection ? localizeSelectionLabel(selection, favorite?.itemType || favorite?.category) : favorite?.itemType || favorite?.category || "";
  }

  function getLocalizedFavoriteCategory(category) {
    const pageId = Object.entries(FAVORITE_TRADE_CATEGORY_BY_PAGE).find(([, value]) => value === category)?.[0];
    const fallback = FAVORITE_TRADE_CATEGORY_LABELS[category] || category || "";
    return pageId ? localizeSelectionLabel({ kind: "page", id: pageId }, fallback) : fallback;
  }

  function getLocalizedFavoriteRarity(rarity) {
    const labels = {
      normal: { en: "Normal", zh_CN: "普通", zh_TW: "普通" },
      magic: { en: "Magic", zh_CN: "魔法", zh_TW: "魔法" },
      rare: { en: "Rare", zh_CN: "稀有", zh_TW: "稀有" },
      unique: { en: "Unique", zh_CN: "传奇", zh_TW: "傳奇" }
    };
    return getLocalizedDisplayText(labels[String(rarity || "").toLowerCase()], rarity);
  }

  function formatLocalizedFavoriteModifier(modifier) {
    const text = String(modifier?.text || "");
    const localizedTemplate = getLocalizedDisplayText(getDisplayMetadata().stats?.[modifier?.id], text);
    const numbers = text.match(NUMBER_RE) || [];
    let numberIndex = 0;
    const localizedText = localizedTemplate.replace(/#/g, (placeholder, offset, template) => {
      const value = numbers[numberIndex++] || placeholder;
      return template[offset - 1] === "+" ? value.replace(/^\+/, "") : value;
    });
    return { ...modifier, text: localizedText || text };
  }

  function formatLocalizedLinkSnapshotStat(stat) {
    const metadata = getDisplayMetadata().stats?.[stat?.id];
    const englishTemplate = String(metadata?.en || stat?.id || "");
    const values = [stat?.value?.min, stat?.value?.max].filter(Number.isFinite).map(String);
    let valueIndex = 0;
    const englishText = englishTemplate.replace(/#/g, () => values[valueIndex++] || values.at(-1) || "#");
    return {
      ...formatLocalizedFavoriteModifier({ id: stat?.id, text: englishText, source: String(stat?.id || "").split(".", 1)[0] }),
      source: getLocalizedFavoriteModifierSource(String(stat?.id || "").split(".", 1)[0]),
      ...(stat?.disabled === true ? { disabled: true } : {}),
      ...(Number.isFinite(Number(stat?.weight)) ? { weight: Number(stat.weight) } : {})
    };
  }

  function getLinkFavoritePresentation(link) {
    const snapshot = link?.displaySnapshot;
    const filterGroups = localizeLinkFavoriteFilterGroups(link?.filterGroups);
    if (!snapshot) {
      return { ...link, filterGroups };
    }
    const type = getLocalizedDisplayText(getFavoriteItemRecord(snapshot.type), snapshot.type);
    const statGroups = (snapshot.statGroups || [])
      .map((group) => {
        const filters = (group?.filters || []).map(formatLocalizedLinkSnapshotStat).filter((stat) => stat.text);
        if (!filters.length) {
          return null;
        }
        const rawMin = group?.value?.min;
        const rawMax = group?.value?.max;
        const min = rawMin == null || rawMin === "" ? Number.NaN : Number(rawMin);
        const max = rawMax == null || rawMax === "" ? Number.NaN : Number(rawMax);
        return {
          type: String(group?.type || "and"),
          ...(Number.isFinite(min) || Number.isFinite(max)
            ? { value: { ...(Number.isFinite(min) ? { min } : {}), ...(Number.isFinite(max) ? { max } : {}) } }
            : {}),
          filters
        };
      })
      .filter(Boolean);
    const stats = statGroups.flatMap((group) => group.filters);
    return {
      ...link,
      filterGroups,
      localizedSnapshot: {
        ...(type ? { type } : {}),
        ...(snapshot.category ? { category: getLocalizedFavoriteCategory(snapshot.category) } : {}),
        ...(snapshot.rarity ? { rarity: getLocalizedFavoriteRarity(snapshot.rarity) } : {}),
        ...(stats.length ? { stats } : {}),
        ...(statGroups.length ? { statGroups } : {})
      }
    };
  }

  function getFavoritePresentation(favorite) {
    const baseName = getLocalizedFavoriteBaseName(favorite);
    const automaticName = String(favorite?.originalName || favorite?.displayName || "").trim();
    const automaticNameRecord = getFavoriteItemRecord(automaticName);
    const displayName =
      favorite?.nameSource === "automatic"
        ? automaticNameRecord
          ? getLocalizedDisplayText(automaticNameRecord, baseName)
          : automaticName || baseName
        : favorite?.displayName || baseName;
    const mods = (favorite?.mods || []).map(formatLocalizedFavoriteModifier);
    return {
      ...favorite,
      displayName,
      originalName: favorite?.nameSource === "automatic" ? "" : favorite?.originalName || "",
      baseName,
      itemType: getLocalizedFavoriteItemType(favorite),
      rarity: getLocalizedFavoriteRarity(favorite?.rarity),
      mods,
      searchTerms: [
        favorite?.displayName,
        favorite?.originalName,
        favorite?.baseName,
        favorite?.itemType,
        favorite?.rarity,
        baseName,
        getLocalizedFavoriteItemType(favorite),
        getLocalizedFavoriteRarity(favorite?.rarity),
        ...mods.map((modifier) => modifier.text),
        ...(favorite?.mods || []).map((modifier) => modifier?.text)
      ].filter(Boolean)
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
    return favorites.filter((favorite) =>
      getFavoritePresentation(favorite).searchTerms.some((term) => String(term).toLowerCase().includes(search))
    );
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

  function getCompactFavoriteModifierPresentation(modifier) {
    return {
      text: String(modifier?.text || ""),
      source: getLocalizedFavoriteModifierSource(modifier?.source)
    };
  }

  function getLocalizedFavoriteModifierSource(source) {
    const sourceKey = String(source?.key || source || "").trim().toLowerCase();
    const displaySourceKey = sourceKey === "rune" ? "augment" : sourceKey;
    const messageKey = FAVORITE_SPECIAL_MODIFIER_SOURCE_MESSAGE_KEYS[displaySourceKey];
    return FAVORITE_SPECIAL_MODIFIER_SOURCES.has(sourceKey) && messageKey
      ? { key: displaySourceKey, label: t(messageKey) }
      : null;
  }

  function getFavoriteTooltipItemValues(favorite) {
    const name = favorite?.displayName || favorite?.originalName || favorite?.baseName || "";
    const baseName = favorite?.baseName || "";
    return [
      name && { text: name, source: null, heading: true },
      baseName && baseName !== name && { text: `${t("favoriteTooltipBaseType")}: ${baseName}`, source: null },
      (favorite?.itemType || favorite?.category) && {
        text: `${t("favoriteTooltipCategory")}: ${favorite.itemType || favorite.category}`,
        source: null
      },
      { text: t("favoriteTooltipRarity", String(favorite?.rarity || "").toUpperCase()), source: null }
    ].filter(Boolean);
  }

  function getCompactFavoritePresentation(favorite) {
    const itemValues = getFavoriteTooltipItemValues(favorite);
    const modifiers = (favorite?.mods || []).map(getCompactFavoriteModifierPresentation).filter((modifier) => modifier.text);
    return {
      stats: modifiers,
      tooltipGroups: [
        ...(itemValues.length ? [{ label: t("favoriteTooltipItem"), hideLabel: true, values: itemValues }] : []),
        ...(modifiers.length ? [{ label: t("favoriteTooltipModifiers"), values: modifiers }] : [])
      ]
    };
  }

  function renderFavoriteDrawer() {
    if (!runtime.ui.favoritesList) {
      return;
    }
    hideCompactLinkFavoriteTooltip();
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
      renderFavoriteFeedback();
      return;
    }

    const favorites = getVisibleFavorites();
    if (!favorites.length) {
      const status = document.createElement("div");
      status.className = "poe2-marketwright-favorites-empty";
      status.textContent = runtime.ui.favoritesSearch.value.trim() ? t("favoritesNoMatches") : t("favoritesEmpty");
      runtime.ui.favoritesList.appendChild(status);
      renderFavoriteFeedback();
      return;
    }

    for (const favorite of favorites) {
      const presentationFavorite = getFavoritePresentation(favorite);
      const row = document.createElement("article");
      row.className = "poe2-marketwright-favorite-row";

      const launch = document.createElement("button");
      launch.type = "button";
      launch.className = "poe2-marketwright-favorite-launch";
      launch.setAttribute("aria-label", presentationFavorite.displayName || presentationFavorite.baseName || "");
      const presentation = getCompactFavoritePresentation(presentationFavorite);
      bindCompactLinkFavoriteTooltip(launch, presentation);
      launch.addEventListener("click", () => {
        void launchFavoriteSearch(favorite, launch, row);
      });

      const name = document.createElement("span");
      name.className = "poe2-marketwright-favorite-name";
      name.textContent = presentationFavorite.displayName || presentationFavorite.baseName;
      launch.appendChild(name);
      const visibleMods = presentation.stats.slice(0, 3);
      for (const mod of visibleMods) {
        launch.appendChild(renderCompactLinkFavoriteStat(mod));
      }
      const extraModCount = Math.max(0, (presentationFavorite.mods?.length || 0) - visibleMods.length);
      if (extraModCount) {
        const more = document.createElement("span");
        more.className = "poe2-marketwright-favorite-more";
        more.textContent = t("favoriteMoreMods", extraModCount);
        launch.appendChild(more);
      }

      const actions = document.createElement("div");
      actions.className = "poe2-marketwright-favorite-actions";
      const renameButton = createFavoriteIconButton(
        "poe2-marketwright-favorite-action",
        t("renameFavorite"),
        "M2.5 11.8V14h2.2l6.5-6.5-2.2-2.2-6.5 6.5zm10.2-6.2a.9.9 0 0 0 0-1.3L11.3 2.9a.9.9 0 0 0-1.3 0L9 4l2.2 2.2 1.5-1.5z"
      );
      renameButton.addEventListener("click", (event) => {
        event.stopPropagation();
        startFavoriteRename(favorite, launch);
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
    renderFavoriteFeedback();
  }

  function renderFavoriteFeedback() {
    if (!runtime.ui.favoritesFeedback) {
      return;
    }
    runtime.ui.favoritesFeedback.hidden = !runtime.deletedFavorite;
  }

  async function replaceFavorites(nextFavorites) {
    const previousFavorites = runtime.state.favorites;
    runtime.state.favorites = nextFavorites;
    runtime.favorites?.setFavorites(nextFavorites);
    renderFavoriteDrawer();
    try {
      await saveState();
      publishFavoritesPanelState();
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
        entry?.signature === favorite.signature ? { ...entry, displayName: name, nameSource: "custom" } : entry
      )
    );
  }

  function startFavoriteRename(favorite, hostNode) {
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
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("mousedown", (event) => event.stopPropagation());
    input.addEventListener("blur", commit, { once: true });
    hostNode.replaceWith(input);
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
      renderFavoriteFeedback();
    }, 5000);
    renderFavoriteFeedback();
    publishFavoritesPanelState();
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
    publishFavoritesPanelState();
  }

  async function launchFavoriteSearch(favorite, launchButton, row) {
    const tools = getFavoriteTools();
    if (!tools) {
      throw new Error("Favorite tools are unavailable");
    }
    const hasRow = Boolean(launchButton && row);
    let status = null;
    if (hasRow) {
      launchButton.disabled = true;
      row.dataset.status = "loading";
      status = document.createElement("span");
      status.className = "poe2-marketwright-favorite-search-status";
      status.textContent = t("favoriteSearchLoading");
      row.appendChild(status);
    }
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
      if (hasRow) {
        row.dataset.status = "error";
        status.textContent = t("favoriteSearchError");
        launchButton.disabled = false;
        return;
      }
      throw error;
    }
  }

  function getLinkFavoriteLeagueState(state, league, create = false) {
    if (!league) {
      return null;
    }
    if (!state.leagues[league] && create) {
      state.leagues[league] = {
        folders: [],
        folderOrder: [],
        links: [],
        rootLinkIds: [],
        folderLinkIds: {}
      };
    }
    return state.leagues[league] || null;
  }

  function cloneLinkFavoritesState() {
    return JSON.parse(JSON.stringify(runtime.state.linkFavorites));
  }

  function getLinkFavoriteFolder(leagueState, folderId) {
    return leagueState?.folders.find((folder) => folder.id === folderId) || null;
  }

  function getLinkFavoriteLink(leagueState, linkId) {
    return leagueState?.links.find((link) => link.id === linkId) || null;
  }

  function getLinkFavoriteLinkIds(leagueState, folderId) {
    return folderId ? leagueState?.folderLinkIds?.[folderId] || [] : leagueState?.rootLinkIds || [];
  }

  function getLinkFavoriteLinks(leagueState, folderId) {
    return getLinkFavoriteLinkIds(leagueState, folderId)
      .map((linkId) => getLinkFavoriteLink(leagueState, linkId))
      .filter(Boolean);
  }

  function showLinkFavoriteFeedback(key, substitutions = [], state = "ready") {
    runtime.linkFavoriteFeedback = { key, text: t(key, substitutions), state };
    if (runtime.linkFavoriteFeedbackTimer) {
      window.clearTimeout(runtime.linkFavoriteFeedbackTimer);
    }
    runtime.linkFavoriteFeedbackTimer = window.setTimeout(() => {
      runtime.linkFavoriteFeedback = null;
      runtime.linkFavoriteFeedbackTimer = null;
      renderLinkFavoritesDrawer();
    }, 2600);
    renderLinkFavoritesDrawer();
    publishFavoritesPanelState();
  }

  function clearLinkFavoriteFeedback() {
    if (runtime.linkFavoriteFeedbackTimer) {
      window.clearTimeout(runtime.linkFavoriteFeedbackTimer);
    }
    runtime.linkFavoriteFeedback = null;
    runtime.linkFavoriteFeedbackTimer = null;
    publishFavoritesPanelState();
  }

  async function replaceLinkFavorites(nextLinkFavorites) {
    const tools = getLinkFavoriteTools();
    if (!tools) {
      throw new Error("Link favorite tools are unavailable");
    }
    const previous = runtime.state.linkFavorites;
    runtime.state.linkFavorites = tools.normalizeLinkFavoritesState(nextLinkFavorites);
    renderLinkFavoritesDrawer();
    try {
      await saveState();
      publishFavoritesPanelState();
    } catch (error) {
      runtime.state.linkFavorites = previous;
      renderLinkFavoritesDrawer();
      throw error;
    }
  }

  function createLinkFavoriteIconButton(className, title, path) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${path}"></path></svg>`;
    return button;
  }

  function getLinkFavoriteFolderNameKey(name) {
    return String(name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  }

  async function createLinkFavoriteFolder(name) {
    const league = getCurrentLinkFavoriteLeague();
    const normalizedName = String(name || "").trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      runtime.linkFavoriteCreatingFolder = false;
      showLinkFavoriteFeedback("linkFavoriteFolderNameRequired", [], "error");
      return;
    }
    if (!league) {
      runtime.linkFavoriteCreatingFolder = false;
      showLinkFavoriteFeedback("createLinkFavoriteUnavailable", [], "error");
      return;
    }
    const next = cloneLinkFavoritesState();
    const leagueState = getLinkFavoriteLeagueState(next, league, true);
    const key = getLinkFavoriteFolderNameKey(normalizedName);
    if (leagueState.folders.some((folder) => getLinkFavoriteFolderNameKey(folder.name) === key)) {
      runtime.linkFavoriteCreatingFolder = false;
      showLinkFavoriteFeedback("linkFavoriteDuplicateFolder", [], "error");
      return;
    }
    const id = getLinkFavoriteTools().createLinkFavoriteId("folder");
    leagueState.folders.push({ id, name: normalizedName, createdAt: Date.now(), collapsed: false });
    leagueState.folderOrder.push(id);
    leagueState.folderLinkIds[id] = [];
    runtime.linkFavoriteCreatingFolder = false;
    await replaceLinkFavorites(next);
  }

  async function renameLinkFavoriteFolder(folderId, name) {
    const league = getCurrentLinkFavoriteLeague();
    const normalizedName = String(name || "").trim().replace(/\s+/g, " ");
    const next = cloneLinkFavoritesState();
    const leagueState = getLinkFavoriteLeagueState(next, league);
    const folder = getLinkFavoriteFolder(leagueState, folderId);
    if (!folder) {
      return;
    }
    if (!normalizedName) {
      showLinkFavoriteFeedback("linkFavoriteFolderNameRequired", [], "error");
      return;
    }
    const key = getLinkFavoriteFolderNameKey(normalizedName);
    if (
      leagueState.folders.some(
        (entry) => entry.id !== folderId && getLinkFavoriteFolderNameKey(entry.name) === key
      )
    ) {
      showLinkFavoriteFeedback("linkFavoriteDuplicateFolder", [], "error");
      return;
    }
    folder.name = normalizedName;
    await replaceLinkFavorites(next);
  }

  async function createCurrentLinkFavorite(folderId = null) {
    const context = getCurrentLinkFavoriteContext();
    if (!context) {
      showLinkFavoriteFeedback("createLinkFavoriteUnavailable", [], "error");
      return;
    }
    const next = cloneLinkFavoritesState();
    const leagueState = getLinkFavoriteLeagueState(next, context.league, true);
    const folder = folderId ? getLinkFavoriteFolder(leagueState, folderId) : null;
    if (folderId && !folder) {
      showLinkFavoriteFeedback("createLinkFavoriteUnavailable", [], "error");
      return;
    }
    const record = getLinkFavoriteTools().createLinkFavoriteRecord({
      ...context,
      folderId,
      createdAt: Date.now()
    });
    leagueState.links.push(record);
    getLinkFavoriteLinkIds(leagueState, folderId).push(record.id);
    await replaceLinkFavorites(next);
    showLinkFavoriteFeedback("linkFavoriteSaved");
  }

  async function importLinkFavorites(sourceText) {
    const league = getCurrentLinkFavoriteLeague();
    const tools = getLinkFavoriteTools();
    if (!league || !tools?.importExternalLinkFavorites) {
      showLinkFavoriteFeedback("createLinkFavoriteUnavailable", [], "error");
      return;
    }
    try {
      const result = tools.importExternalLinkFavorites(runtime.state.linkFavorites, sourceText, league);
      await replaceLinkFavorites(result.state);
      runtime.linkFavoriteImporting = false;
      runtime.linkFavoriteImportText = "";
      showLinkFavoriteFeedback("linkFavoriteImported", [result.importedLinks, result.importedFolders, result.skippedLinks]);
    } catch (error) {
      console.warn("[PoE2 Marketwright] link favorite import failed", error);
      showLinkFavoriteFeedback("linkFavoriteImportInvalid", [], "error");
    }
  }

  async function exportLinkFavorites() {
    const league = getCurrentLinkFavoriteLeague();
    const tools = getLinkFavoriteTools();
    if (!league || !tools?.exportExternalLinkFavorites) {
      showLinkFavoriteFeedback("createLinkFavoriteUnavailable", [], "error");
      return;
    }
    try {
      const exported = tools.exportExternalLinkFavorites(runtime.state.linkFavorites, league);
      await navigator.clipboard.writeText(JSON.stringify(exported, null, 2));
      showLinkFavoriteFeedback("linkFavoriteExported");
    } catch (error) {
      console.warn("[PoE2 Marketwright] link favorite export failed", error);
      showLinkFavoriteFeedback("linkFavoriteExportFailed", [], "error");
    }
  }

  async function renameLinkFavorite(linkId, name) {
    const league = getCurrentLinkFavoriteLeague();
    const normalizedName = String(name || "").trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      renderLinkFavoritesDrawer();
      return;
    }
    const next = cloneLinkFavoritesState();
    const link = getLinkFavoriteLink(getLinkFavoriteLeagueState(next, league), linkId);
    if (!link || link.displayName === normalizedName) {
      renderLinkFavoritesDrawer();
      return;
    }
    link.displayName = normalizedName;
    await replaceLinkFavorites(next);
  }

  async function moveLinkFavorite(linkId, targetFolderId, targetId = null, placeAfter = true) {
    const league = getCurrentLinkFavoriteLeague();
    const next = cloneLinkFavoritesState();
    const leagueState = getLinkFavoriteLeagueState(next, league);
    const link = getLinkFavoriteLink(leagueState, linkId);
    const targetFolder = targetFolderId ? getLinkFavoriteFolder(leagueState, targetFolderId) : null;
    if (!link || (targetFolderId && !targetFolder)) {
      return;
    }
    if ((link.folderId || null) === (targetFolderId || null)) {
      renderLinkFavoritesDrawer();
      return;
    }
    const sourceIds = getLinkFavoriteLinkIds(leagueState, link.folderId);
    const sourceIndex = sourceIds.indexOf(linkId);
    if (sourceIndex >= 0) {
      sourceIds.splice(sourceIndex, 1);
    }
    link.folderId = targetFolderId || null;
    if (targetFolder) {
      targetFolder.collapsed = false;
    }
    const targetIds = getLinkFavoriteLinkIds(leagueState, link.folderId);
    const targetIndex = targetId ? targetIds.indexOf(targetId) : -1;
    if (targetIndex >= 0) {
      targetIds.splice(targetIndex + (placeAfter ? 1 : 0), 0, linkId);
    } else {
      targetIds.push(linkId);
    }
    await replaceLinkFavorites(next);
  }

  function enqueueDeletedLinkFavorite(link, index) {
    runtime.deletedLinkFavorites.push({
      link,
      index,
      expiresAt: Date.now() + 5000
    });
    scheduleDeletedLinkFavoriteExpiry();
  }

  function scheduleDeletedLinkFavoriteExpiry() {
    if (runtime.deletedLinkFavoritesTimer) {
      window.clearTimeout(runtime.deletedLinkFavoritesTimer);
    }
    const now = Date.now();
    runtime.deletedLinkFavorites = runtime.deletedLinkFavorites.filter((entry) => entry.expiresAt > now);
    const nextExpiry = runtime.deletedLinkFavorites[0]?.expiresAt;
    if (nextExpiry) {
      runtime.deletedLinkFavoritesTimer = window.setTimeout(() => {
        runtime.deletedLinkFavoritesTimer = null;
        scheduleDeletedLinkFavoriteExpiry();
        renderLinkFavoritesDrawer();
      }, Math.max(1, nextExpiry - Date.now()));
    } else {
      runtime.deletedLinkFavoritesTimer = null;
    }
  }

  async function deleteLinkFavorite(linkId) {
    const league = getCurrentLinkFavoriteLeague();
    const next = cloneLinkFavoritesState();
    const leagueState = getLinkFavoriteLeagueState(next, league);
    const link = getLinkFavoriteLink(leagueState, linkId);
    if (!link) {
      return;
    }
    const linkIds = getLinkFavoriteLinkIds(leagueState, link.folderId);
    const index = linkIds.indexOf(linkId);
    if (index >= 0) {
      linkIds.splice(index, 1);
    }
    leagueState.links = leagueState.links.filter((entry) => entry.id !== linkId);
    await replaceLinkFavorites(next);
    enqueueDeletedLinkFavorite(link, Math.max(0, index));
    showLinkFavoriteFeedback("linkFavoriteDeleted", [runtime.deletedLinkFavorites.length]);
  }

  async function undoDeletedLinkFavorite() {
    scheduleDeletedLinkFavoriteExpiry();
    const entry = runtime.deletedLinkFavorites.shift();
    if (!entry) {
      clearLinkFavoriteFeedback();
      renderLinkFavoritesDrawer();
      return;
    }
    const next = cloneLinkFavoritesState();
    const leagueState = getLinkFavoriteLeagueState(next, entry.link.league, true);
    const folderExists = entry.link.folderId && getLinkFavoriteFolder(leagueState, entry.link.folderId);
    const folderId = folderExists ? entry.link.folderId : null;
    const restored = { ...entry.link, folderId };
    if (!getLinkFavoriteLink(leagueState, restored.id)) {
      leagueState.links.push(restored);
      const targetIds = getLinkFavoriteLinkIds(leagueState, folderId);
      targetIds.splice(Math.min(entry.index, targetIds.length), 0, restored.id);
    }
    scheduleDeletedLinkFavoriteExpiry();
    await replaceLinkFavorites(next);
    if (!runtime.deletedLinkFavorites.length && runtime.linkFavoriteFeedback?.key === "linkFavoriteDeleted") {
      clearLinkFavoriteFeedback();
      renderLinkFavoritesDrawer();
    }
  }

  async function deleteLinkFavoriteFolder(folderId) {
    const league = getCurrentLinkFavoriteLeague();
    const next = cloneLinkFavoritesState();
    const leagueState = getLinkFavoriteLeagueState(next, league);
    const folder = getLinkFavoriteFolder(leagueState, folderId);
    if (!folder) {
      return;
    }
    const linkIds = new Set(getLinkFavoriteLinkIds(leagueState, folderId));
    leagueState.links = leagueState.links.filter((link) => !linkIds.has(link.id));
    leagueState.folders = leagueState.folders.filter((entry) => entry.id !== folderId);
    leagueState.folderOrder = leagueState.folderOrder.filter((id) => id !== folderId);
    delete leagueState.folderLinkIds[folderId];
    runtime.pendingLinkFavoriteFolderDeleteId = null;
    await replaceLinkFavorites(next);
    showLinkFavoriteFeedback("linkFavoriteFolderDeleted");
  }

  async function reorderLinkFavorite(linkId, folderId, targetId, placeAfter) {
    const league = getCurrentLinkFavoriteLeague();
    const next = cloneLinkFavoritesState();
    const linkIds = getLinkFavoriteLinkIds(getLinkFavoriteLeagueState(next, league), folderId);
    const sourceIndex = linkIds.indexOf(linkId);
    const targetIndex = linkIds.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return;
    }
    linkIds.splice(sourceIndex, 1);
    const nextTargetIndex = linkIds.indexOf(targetId);
    linkIds.splice(nextTargetIndex + (placeAfter ? 1 : 0), 0, linkId);
    await replaceLinkFavorites(next);
  }

  async function reorderLinkFavoriteFolder(folderId, targetId, placeAfter) {
    const league = getCurrentLinkFavoriteLeague();
    const next = cloneLinkFavoritesState();
    const folderIds = getLinkFavoriteLeagueState(next, league)?.folderOrder || [];
    const sourceIndex = folderIds.indexOf(folderId);
    const targetIndex = folderIds.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return;
    }
    folderIds.splice(sourceIndex, 1);
    const nextTargetIndex = folderIds.indexOf(targetId);
    folderIds.splice(nextTargetIndex + (placeAfter ? 1 : 0), 0, folderId);
    await replaceLinkFavorites(next);
  }

  async function setLinkFavoriteFolderCollapsed(folderId, collapsed) {
    const league = getCurrentLinkFavoriteLeague();
    const next = cloneLinkFavoritesState();
    const folder = getLinkFavoriteFolder(getLinkFavoriteLeagueState(next, league), folderId);
    if (!folder || folder.collapsed === Boolean(collapsed)) {
      return;
    }
    folder.collapsed = Boolean(collapsed);
    await replaceLinkFavorites(next);
  }

  async function setAllLinkFavoriteFoldersCollapsed(collapsed) {
    const league = getCurrentLinkFavoriteLeague();
    const next = cloneLinkFavoritesState();
    const leagueState = getLinkFavoriteLeagueState(next, league);
    if (!leagueState) {
      return;
    }
    const nextCollapsed = Boolean(collapsed);
    let changed = false;
    for (const folder of leagueState.folders) {
      if (folder.collapsed !== nextCollapsed) {
        folder.collapsed = nextCollapsed;
        changed = true;
      }
    }
    if (changed) {
      await replaceLinkFavorites(next);
    }
  }

  async function toggleAllLinkFavoriteFoldersCollapsed() {
    const leagueState = getLinkFavoriteLeagueState(runtime.state.linkFavorites, getCurrentLinkFavoriteLeague());
    const folders = leagueState?.folders || [];
    if (!folders.length) {
      return;
    }
    await setAllLinkFavoriteFoldersCollapsed(folders.some((folder) => !folder.collapsed));
  }

  function startLinkFavoriteRename(hostNode, initialName, label, save) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "poe2-marketwright-link-favorite-rename-input";
    input.value = initialName || "";
    input.setAttribute("aria-label", label);
    let cancelled = false;
    const commit = () => {
      if (!cancelled) {
        runAsync(() => save(input.value), "rename link favorite");
      }
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      } else if (event.key === "Escape") {
        cancelled = true;
        renderLinkFavoritesDrawer();
      }
    });
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("mousedown", (event) => event.stopPropagation());
    input.addEventListener("blur", commit, { once: true });
    hostNode.replaceWith(input);
    input.focus();
    input.select();
  }

  function clearLinkFavoriteDragStyles() {
    document.querySelectorAll(".poe2-marketwright-link-favorite-drop-target").forEach((element) => {
      element.classList.remove("poe2-marketwright-link-favorite-drop-target");
      clearLinkFavoriteDropPosition(element);
    });
  }

  function setLinkFavoriteDropPosition(target, position) {
    if (target.dataset) {
      target.dataset.dropPosition = position;
    }
  }

  function clearLinkFavoriteDropPosition(target) {
    if (target.dataset) {
      delete target.dataset.dropPosition;
    }
  }

  function setLinkFavoriteDragSource(handle, drag) {
    handle.draggable = true;
    handle.addEventListener("dragstart", (event) => {
      runtime.linkFavoriteDrag = drag;
      runtime.ui.linkFavoritesList?.classList.add(
        "poe2-marketwright-link-favorites-drag-active",
        `poe2-marketwright-link-favorites-dragging-${drag.kind}`
      );
      event.dataTransfer?.setData("text/plain", `${drag.kind}:${drag.id}`);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
      }
      handle.classList.add("poe2-marketwright-link-favorite-dragging");
      updateIdleTransparencyState();
    });
    handle.addEventListener("dragend", () => {
      runtime.linkFavoriteDrag = null;
      runtime.ui.linkFavoritesList?.classList.remove(
        "poe2-marketwright-link-favorites-drag-active",
        `poe2-marketwright-link-favorites-dragging-${drag.kind}`
      );
      handle.classList.remove("poe2-marketwright-link-favorite-dragging");
      clearLinkFavoriteDragStyles();
      updateIdleTransparencyState();
    });
  }

  function setLinkFavoriteDropTarget(target, drop) {
    target.addEventListener("dragover", (event) => {
      const drag = runtime.linkFavoriteDrag;
      if (!drag || drag.kind !== drop.kind || drag.id === drop.id) {
        return;
      }
      event.preventDefault();
      event.dataTransfer && (event.dataTransfer.dropEffect = "move");
      const rect = target.getBoundingClientRect();
      setLinkFavoriteDropPosition(target, event.clientY > rect.top + rect.height / 2 ? "after" : "before");
      target.classList.add("poe2-marketwright-link-favorite-drop-target");
    });
    target.addEventListener("dragleave", (event) => {
      if (!target.contains?.(event.relatedTarget)) {
        target.classList.remove("poe2-marketwright-link-favorite-drop-target");
        clearLinkFavoriteDropPosition(target);
      }
    });
    target.addEventListener("drop", (event) => {
      const drag = runtime.linkFavoriteDrag;
      if (!drag || drag.kind !== drop.kind) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      target.classList.remove("poe2-marketwright-link-favorite-drop-target");
      const rect = target.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      clearLinkFavoriteDropPosition(target);
      if (drag.kind === "link") {
        if (drag.folderId !== drop.folderId) {
          runAsync(
            () => moveLinkFavorite(drag.id, drop.folderId, drop.id, placeAfter),
            "move link favorite by drag"
          );
          return;
        }
        runAsync(
          () => reorderLinkFavorite(drag.id, drop.folderId, drop.id, placeAfter),
          "reorder link favorite"
        );
      } else {
        runAsync(() => reorderLinkFavoriteFolder(drag.id, drop.id, placeAfter), "reorder link favorite folder");
      }
    });
  }

  function setLinkFavoriteGroupDropTarget(target, folderId) {
    target.addEventListener("dragover", (event) => {
      if (runtime.linkFavoriteDrag?.kind !== "link" || runtime.linkFavoriteDrag.folderId === folderId) {
        return;
      }
      event.preventDefault();
      event.dataTransfer && (event.dataTransfer.dropEffect = "move");
      target.classList.add("poe2-marketwright-link-favorite-drop-target");
    });
    target.addEventListener("dragleave", (event) => {
      if (!target.contains?.(event.relatedTarget)) {
        target.classList.remove("poe2-marketwright-link-favorite-drop-target");
        clearLinkFavoriteDropPosition(target);
      }
    });
    target.addEventListener("drop", (event) => {
      const drag = runtime.linkFavoriteDrag;
      if (drag?.kind !== "link") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      target.classList.remove("poe2-marketwright-link-favorite-drop-target");
      clearLinkFavoriteDropPosition(target);
      if (drag.folderId !== folderId) {
        runAsync(() => moveLinkFavorite(drag.id, folderId), "move link favorite by drag");
      }
    });
  }

  function setLinkFavoriteFolderTopDropTarget(target) {
    target.addEventListener("dragover", (event) => {
      if (runtime.linkFavoriteDrag?.kind !== "folder") {
        return;
      }
      event.preventDefault();
      event.dataTransfer && (event.dataTransfer.dropEffect = "move");
      setLinkFavoriteDropPosition(target, "before");
      target.classList.add("poe2-marketwright-link-favorite-drop-target");
    });
    target.addEventListener("dragleave", (event) => {
      if (!target.contains?.(event.relatedTarget)) {
        target.classList.remove("poe2-marketwright-link-favorite-drop-target");
        clearLinkFavoriteDropPosition(target);
      }
    });
    target.addEventListener("drop", (event) => {
      const drag = runtime.linkFavoriteDrag;
      if (drag?.kind !== "folder") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      target.classList.remove("poe2-marketwright-link-favorite-drop-target");
      clearLinkFavoriteDropPosition(target);
      const leagueState = getLinkFavoriteLeagueState(runtime.state.linkFavorites, getCurrentLinkFavoriteLeague());
      const firstFolderId = leagueState?.folderOrder?.[0];
      if (firstFolderId && drag.id !== firstFolderId) {
        runAsync(() => reorderLinkFavoriteFolder(drag.id, firstFolderId, false), "move link favorite folder to top");
      }
    });
  }

  function createLinkFavoriteDragHandle(title, drag) {
    const handle = createLinkFavoriteIconButton(
      "poe2-marketwright-link-favorite-drag-handle",
      title,
      "M6 3h1.5v1.5H6V3zm2.5 0H10v1.5H8.5V3zM6 7.25h1.5v1.5H6V7.25zm2.5 0H10v1.5H8.5V7.25zM6 11.5h1.5V13H6v-1.5zm2.5 0H10V13H8.5v-1.5z"
    );
    setLinkFavoriteDragSource(handle, drag);
    return handle;
  }

  function createLinkFavoriteMoveSelect(link) {
    const select = document.createElement("select");
    select.className = "poe2-marketwright-link-favorite-move-select";
    select.setAttribute("aria-label", t("moveLinkFavorite"));
    const leagueState = getLinkFavoriteLeagueState(runtime.state.linkFavorites, link.league);
    const groups = [{ id: "", name: t("moveLinkFavoriteToRoot") }].concat(
      (leagueState?.folderOrder || [])
        .map((folderId) => getLinkFavoriteFolder(leagueState, folderId))
        .filter(Boolean)
        .map((folder) => ({ id: folder.id, name: folder.name }))
    );
    for (const group of groups) {
      const option = document.createElement("option");
      option.value = group.id;
      option.textContent = group.name;
      option.selected = group.id === (link.folderId || "");
      select.appendChild(option);
    }
    select.addEventListener("change", () => runAsync(() => moveLinkFavorite(link.id, select.value || null), "move link favorite"));
    select.addEventListener("blur", () => window.setTimeout(renderLinkFavoritesDrawer, 0), { once: true });
    return select;
  }

  function isCompactLinkFavoriteStatFilterGroup(group) {
    const label = String(group?.label || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
    return ["stat filters", "stat filter", "\u5c5e\u6027\u7b5b\u9009\u5668", "\u5c6c\u6027\u7be9\u9078\u5668", "\u7be9\u9078\u5668", "\u7b5b\u9009\u5668"].includes(label);
  }

  function formatCompactLinkFavoriteStatFilter(value) {
    const formatter = getLinkFavoriteTools()?.formatLinkFavoriteStatFilter;
    const formatted = typeof formatter === "function" ? formatter(value) : { text: String(value || ""), source: null };
    return { ...formatted, source: getLocalizedFavoriteModifierSource(formatted.source) };
  }

  function getCompactLinkFavoriteStatGroupLabel(group) {
    const type = String(group?.type || "and").trim().toLocaleLowerCase().replace(/[\s-]+/g, "_");
    const relation = {
      and: t("favoriteTooltipStatGroupAnd", [], "AND"),
      or: t("favoriteTooltipStatGroupOr", [], "OR"),
      count: t("favoriteTooltipStatGroupCount", [], "COUNT"),
      weighted: t("favoriteTooltipStatGroupWeighted", [], "WEIGHTED SUM"),
      not: t("favoriteTooltipStatGroupNot", [], "NOT"),
      if: t("favoriteTooltipStatGroupIf", [], "IF")
    }[type] || type.toUpperCase().replaceAll("_", " ");
    const rawMin = group?.value?.min;
    const rawMax = group?.value?.max;
    const min = rawMin == null || rawMin === "" ? Number.NaN : Number(rawMin);
    const max = rawMax == null || rawMax === "" ? Number.NaN : Number(rawMax);
    const range = formatLinkFavoriteRange(Number.isFinite(min) ? min : "", Number.isFinite(max) ? max : "");
    return `${t("favoriteTooltipStatFilters", [], "Stat Filters")}: ${relation}${range ? ` (${range})` : ""}`;
  }

  function formatCompactLinkFavoriteFilterGroupValue(value) {
    const formatter = getLinkFavoriteTools()?.formatLinkFavoriteFilterRange;
    return typeof formatter === "function" ? formatter(value) : String(value || "");
  }

  function getCompactLinkFavoriteStructuredStatGroups(snapshot) {
    return (snapshot?.statGroups || [])
      .map((group) => {
        const values = (group?.filters || [])
          .filter(Boolean)
          .map((value) =>
            value && typeof value === "object" && "text" in value
              ? {
                  text: String(value.text || ""),
                  source: getLocalizedFavoriteModifierSource(value.source),
                  ...(value.disabled ? { disabled: true } : {}),
                  ...(Number.isFinite(Number(value.weight)) ? { weight: Number(value.weight) } : {})
                }
              : formatCompactLinkFavoriteStatFilter(value)
          )
          .filter((value) => value.text);
        return values.length ? { label: getCompactLinkFavoriteStatGroupLabel(group), values } : null;
      })
      .filter(Boolean);
  }

  function getCompactLinkFavoritePresentation(link) {
    const snapshot = link?.localizedSnapshot;
    const snapshotItemValues = [snapshot?.type, snapshot?.category, snapshot?.rarity]
      .filter(Boolean)
      .map((text) => ({ text, source: null }));
    const snapshotStats = (snapshot?.stats || []).map((stat) => ({
      ...stat,
      source: getLocalizedFavoriteModifierSource(stat?.source)
    }));
    const structuredStatGroups = getCompactLinkFavoriteStructuredStatGroups(snapshot);
    const tooltipGroups = [
      ...(snapshotItemValues.length ? [{ label: t("favoriteTooltipItem"), values: snapshotItemValues }] : []),
      ...(link?.filterGroups || [])
      .filter((group) => !structuredStatGroups.length || !isCompactLinkFavoriteStatFilterGroup(group))
      .map((group) => {
        const label = String(group?.label || "").trim();
        const statFilters = isCompactLinkFavoriteStatFilterGroup(group);
        const values = (group?.values || [])
          .filter(Boolean)
          .map((value) =>
            statFilters
              ? formatCompactLinkFavoriteStatFilter(value)
              : { text: formatCompactLinkFavoriteFilterGroupValue(value), source: null }
          );
        return label && values.length ? { label, values } : null;
      })
      .filter(Boolean),
      ...(structuredStatGroups.length
        ? structuredStatGroups
        : [])
    ];
    return {
      stats: snapshotStats.length
        ? snapshotStats
        : tooltipGroups.filter((group) => isCompactLinkFavoriteStatFilterGroup(group)).flatMap((group) => group.values),
      tooltipGroups
    };
  }

  function renderCompactLinkFavoriteStat(stat, className = "") {
    const line = document.createElement("span");
    line.className = `poe2-marketwright-link-favorite-stat ${className}`.trim();
    if (stat.source?.key && stat.source?.label) {
      const source = document.createElement("span");
      source.className = `poe2-marketwright-link-favorite-stat-source poe2-marketwright-link-favorite-stat-source-${stat.source.key}`;
      source.textContent = stat.source.label;
      line.appendChild(source);
      line.appendChild(document.createTextNode(" "));
    }
    if (stat.disabled) {
      const disabled = document.createElement("span");
      disabled.className = "poe2-marketwright-link-favorite-stat-disabled";
      disabled.textContent = t("favoriteTooltipDisabled");
      line.append(disabled, document.createTextNode(" "));
    }
    if (Number.isFinite(Number(stat.weight))) {
      const weight = document.createElement("span");
      weight.className = "poe2-marketwright-link-favorite-stat-weight";
      weight.textContent = t("favoriteTooltipWeight", stat.weight, "WEIGHT: $1");
      line.append(weight, document.createTextNode(" "));
    }
    line.appendChild(document.createTextNode(stat.text || ""));
    return line;
  }

  function renderCompactLinkFavoriteTooltip(presentation) {
    const root = document.createElement("div");
    root.className = "poe2-marketwright-link-favorite-tooltip-content";
    for (const group of presentation.tooltipGroups) {
      const section = document.createElement("section");
      section.className = "poe2-marketwright-link-favorite-tooltip-group";
      const label = document.createElement("span");
      label.className = "poe2-marketwright-link-favorite-tooltip-group-label";
      label.textContent = group.label;
      const values = document.createElement("div");
      values.className = "poe2-marketwright-link-favorite-tooltip-values";
      for (const value of group.values) {
        if (value.source || value.disabled || Number.isFinite(Number(value.weight))) {
          values.appendChild(renderCompactLinkFavoriteStat(value, "poe2-marketwright-link-favorite-tooltip-stat"));
          continue;
        }
        const item = document.createElement("span");
        item.className = `poe2-marketwright-link-favorite-tooltip-value${value.heading ? " poe2-marketwright-link-favorite-tooltip-value-heading" : ""}`;
        item.textContent = value.text;
        values.appendChild(item);
      }
      if (!group.hideLabel) {
        section.appendChild(label);
      }
      section.appendChild(values);
      root.appendChild(section);
    }
    return root;
  }

  function clearCompactLinkFavoriteTooltipShowTimer() {
    if (runtime.compactLinkFavoriteTooltipShowTimer) {
      window.clearTimeout(runtime.compactLinkFavoriteTooltipShowTimer);
      runtime.compactLinkFavoriteTooltipShowTimer = null;
    }
  }

  function clearCompactLinkFavoriteTooltipHideTimer() {
    if (runtime.compactLinkFavoriteTooltipHideTimer) {
      window.clearTimeout(runtime.compactLinkFavoriteTooltipHideTimer);
      runtime.compactLinkFavoriteTooltipHideTimer = null;
    }
  }

  function clearCompactLinkFavoriteTooltipDismissTimer() {
    if (runtime.compactLinkFavoriteTooltipDismissTimer) {
      window.clearTimeout(runtime.compactLinkFavoriteTooltipDismissTimer);
      runtime.compactLinkFavoriteTooltipDismissTimer = null;
    }
  }

  function clearCompactLinkFavoriteTooltipTimers() {
    clearCompactLinkFavoriteTooltipShowTimer();
    clearCompactLinkFavoriteTooltipHideTimer();
    clearCompactLinkFavoriteTooltipDismissTimer();
  }

  function hideCompactLinkFavoriteTooltip() {
    clearCompactLinkFavoriteTooltipShowTimer();
    clearCompactLinkFavoriteTooltipHideTimer();
    const tooltip = runtime.ui.compactLinkFavoriteTooltip;
    if (!tooltip) {
      return;
    }
    tooltip.classList.remove("poe2-marketwright-link-favorite-tooltip-visible");
    tooltip.setAttribute("aria-hidden", "true");
    clearCompactLinkFavoriteTooltipDismissTimer();
    runtime.compactLinkFavoriteTooltipDismissTimer = window.setTimeout(() => {
      if (tooltip.classList.contains("poe2-marketwright-link-favorite-tooltip-visible")) {
        return;
      }
      tooltip.hidden = true;
      tooltip.replaceChildren();
      runtime.compactLinkFavoriteTooltipDismissTimer = null;
    }, 100);
  }

  function scheduleCompactLinkFavoriteTooltipHide() {
    clearCompactLinkFavoriteTooltipShowTimer();
    clearCompactLinkFavoriteTooltipHideTimer();
    runtime.compactLinkFavoriteTooltipHideTimer = window.setTimeout(hideCompactLinkFavoriteTooltip, 180);
  }

  function getCompactLinkFavoriteTooltipPosition(pointer, tooltipRect) {
    const margin = 8;
    const gap = 12;
    const width = Math.max(0, Number(tooltipRect?.width) || 0);
    const height = Math.max(0, Number(tooltipRect?.height) || 0);
    const x = Number(pointer?.x) || 0;
    const y = Number(pointer?.y) || 0;
    const left = Math.min(Math.max(margin, x - width / 2), Math.max(margin, window.innerWidth - width - margin));
    const aboveTop = y - height - gap;
    const belowTop = y + gap;
    const aboveFits = aboveTop >= margin;
    const belowFits = belowTop + height <= window.innerHeight - margin;
    const placement = aboveFits || (!belowFits && y >= window.innerHeight - y) ? "above" : "below";
    const desiredTop = placement === "above" ? aboveTop : belowTop;
    const top = Math.min(Math.max(margin, desiredTop), Math.max(margin, window.innerHeight - height - margin));
    const arrowX = Math.min(Math.max(14, x - left), Math.max(14, width - 14));
    return { left: Math.round(left), top: Math.round(top), placement, arrowX: Math.round(arrowX) };
  }

  function getCompactLinkFavoriteTooltipPointer(anchor) {
    if (runtime.compactLinkFavoriteTooltipPointer) {
      return runtime.compactLinkFavoriteTooltipPointer;
    }
    const rect = anchor.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top };
  }

  function showCompactLinkFavoriteTooltip(anchor, presentation) {
    const tooltip = runtime.ui.compactLinkFavoriteTooltip;
    if (!tooltip || !presentation.tooltipGroups.length) {
      return;
    }
    clearCompactLinkFavoriteTooltipTimers();
    tooltip.replaceChildren(renderCompactLinkFavoriteTooltip(presentation));
    tooltip.hidden = false;
    tooltip.setAttribute("aria-hidden", "false");
    tooltip.classList.remove("poe2-marketwright-link-favorite-tooltip-visible");
    tooltip.style.visibility = "hidden";
    const position = getCompactLinkFavoriteTooltipPosition(getCompactLinkFavoriteTooltipPointer(anchor), tooltip.getBoundingClientRect());
    tooltip.style.left = `${position.left}px`;
    tooltip.style.top = `${position.top}px`;
    tooltip.style.setProperty("--poe2-marketwright-link-favorite-tooltip-arrow-x", `${position.arrowX}px`);
    tooltip.dataset.placement = position.placement;
    tooltip.style.visibility = "";
    window.requestAnimationFrame(() => {
      if (!tooltip.hidden && tooltip.getAttribute("aria-hidden") === "false") {
        tooltip.classList.add("poe2-marketwright-link-favorite-tooltip-visible");
      }
    });
  }

  function scheduleCompactLinkFavoriteTooltipShow(anchor, presentation, event) {
    clearCompactLinkFavoriteTooltipShowTimer();
    clearCompactLinkFavoriteTooltipHideTimer();
    clearCompactLinkFavoriteTooltipDismissTimer();
    runtime.compactLinkFavoriteTooltipPointer = { x: event.clientX, y: event.clientY };
    runtime.compactLinkFavoriteTooltipShowTimer = window.setTimeout(() => {
      runtime.compactLinkFavoriteTooltipShowTimer = null;
      showCompactLinkFavoriteTooltip(anchor, presentation);
    }, 420);
  }

  function bindCompactLinkFavoriteTooltip(anchor, presentation) {
    if (!presentation.tooltipGroups.length) {
      return;
    }
    anchor.setAttribute("aria-describedby", "poe2-marketwright-link-favorite-tooltip");
    anchor.addEventListener("pointerenter", (event) => scheduleCompactLinkFavoriteTooltipShow(anchor, presentation, event));
    anchor.addEventListener("pointermove", (event) => {
      runtime.compactLinkFavoriteTooltipPointer = { x: event.clientX, y: event.clientY };
    });
    anchor.addEventListener("pointerleave", scheduleCompactLinkFavoriteTooltipHide);
    anchor.addEventListener("focus", () => {
      runtime.compactLinkFavoriteTooltipPointer = null;
      showCompactLinkFavoriteTooltip(anchor, presentation);
    });
    anchor.addEventListener("blur", hideCompactLinkFavoriteTooltip);
  }

  function renderLinkFavoriteRow(link) {
    const row = document.createElement("article");
    row.className = "poe2-marketwright-link-favorite-row";
    row.dataset.linkFavoriteId = link.id;
    setLinkFavoriteDropTarget(row, { kind: "link", id: link.id, folderId: link.folderId || null });

    const dragHandle = createLinkFavoriteDragHandle(t("reorderLinkFavorite"), {
      kind: "link",
      id: link.id,
      folderId: link.folderId || null
    });

    const launch = document.createElement("button");
    launch.type = "button";
    launch.className = "poe2-marketwright-link-favorite-launch";
    const presentation = getCompactLinkFavoritePresentation(getLinkFavoritePresentation(link));
    const name = document.createElement("span");
    name.className = "poe2-marketwright-link-favorite-name";
    name.textContent = link.displayName;
    launch.appendChild(name);
    for (const stat of presentation.stats.slice(0, 3)) {
      launch.appendChild(renderCompactLinkFavoriteStat(stat));
    }
    const moreCount = Math.max(0, presentation.stats.length - 3);
    if (moreCount) {
      const more = document.createElement("span");
      more.className = "poe2-marketwright-link-favorite-more";
      more.textContent = t("favoriteMoreMods", moreCount);
      launch.appendChild(more);
    }
    bindCompactLinkFavoriteTooltip(launch, presentation);
    launch.addEventListener("click", () => runAsync(() => launchLinkFavorite(link.id), "open link favorite"));

    const actions = document.createElement("div");
    actions.className = "poe2-marketwright-link-favorite-actions";
    const renameButton = createLinkFavoriteIconButton(
      "poe2-marketwright-link-favorite-action",
      t("renameLinkFavorite"),
      "M2.5 11.8V14h2.2l6.5-6.5-2.2-2.2-6.5 6.5zm10.2-6.2a.9.9 0 0 0 0-1.3L11.3 2.9a.9.9 0 0 0-1.3 0L9 4l2.2 2.2 1.5-1.5z"
    );
    renameButton.addEventListener("click", () => startLinkFavoriteRename(launch, link.displayName, t("renameLinkFavorite"), (name) => renameLinkFavorite(link.id, name)));
    const moveButton = createLinkFavoriteIconButton(
      "poe2-marketwright-link-favorite-action",
      t("moveLinkFavorite"),
      "M3 4h6V2l4 3-4 3V6H3V4zm10 8H7v2l-4-3 4-3v2h6v2z"
    );
    moveButton.addEventListener("click", () => {
      actions.replaceChildren(createLinkFavoriteMoveSelect(link));
      actions.querySelector("select")?.focus();
    });
    const deleteButton = createLinkFavoriteIconButton(
      "poe2-marketwright-link-favorite-action poe2-marketwright-link-favorite-delete",
      t("deleteLinkFavorite"),
      "M4 4.5h8l-.6 9H4.6l-.6-9zm2-2h4l.6 1H13v1.5H3V3.5h2.4L6 2.5zm1 4v5h1.5v-5H7zm2.5 0v5H11v-5H9.5z"
    );
    deleteButton.addEventListener("click", () => runAsync(() => deleteLinkFavorite(link.id), "delete link favorite"));
    actions.append(renameButton, moveButton, deleteButton);
    row.append(dragHandle, launch, actions);
    return row;
  }

  function createCurrentLinkFavoriteIconButton(folderId) {
    const available = Boolean(getCurrentLinkFavoriteContext());
    const title = available ? t("createLinkFavorite") : t("createLinkFavoriteUnavailable");
    const save = createLinkFavoriteIconButton(
      "poe2-marketwright-link-favorite-action poe2-marketwright-link-favorite-save",
      title,
      "M4 1.75h8a1 1 0 0 1 1 1v11.1l-5-2.85-5 2.85V2.75a1 1 0 0 1 1-1z"
    );
    save.disabled = !runtime.state.linkFavoritesEnabled || !available;
    save.addEventListener("click", () => runAsync(() => createCurrentLinkFavorite(folderId), "save current link favorite"));
    return save;
  }

  function renderLinkFavoriteGroup(leagueState, folder) {
    const folderId = folder.id;
    const group = document.createElement("section");
    group.className = "poe2-marketwright-link-favorite-group";
    group.dataset.folderId = folderId;
    const header = document.createElement("div");
    header.className = "poe2-marketwright-link-favorite-group-header";
    const collapsed = Boolean(folder.collapsed);

    const dragHandle = createLinkFavoriteDragHandle(t("reorderLinkFavoriteFolder"), { kind: "folder", id: folder.id });
    header.appendChild(dragHandle);
    setLinkFavoriteDropTarget(header, { kind: "folder", id: folder.id });
    setLinkFavoriteGroupDropTarget(header, folderId);
    const collapse = createLinkFavoriteIconButton(
      "poe2-marketwright-link-favorite-collapse",
      t(collapsed ? "expandLinkFavoriteFolder" : "collapseLinkFavoriteFolder"),
      collapsed
        ? "M3.2 2.5 8 7.3l4.8-4.8v2.15L8 9.45 3.2 4.65V2.5zm0 6.05L8 13.35l4.8-4.8v2.15L8 15.5 3.2 10.7V8.55z"
        : "M3.2 13.5 8 8.7l4.8 4.8v-2.15L8 6.55 3.2 11.35v2.15zm0-6.05L8 2.65l4.8 4.8V5.3L8 .5 3.2 5.3v2.15z"
    );
    collapse.dataset.collapsed = String(collapsed);
    collapse.setAttribute("aria-expanded", String(!collapsed));
    collapse.addEventListener("click", () => runAsync(() => setLinkFavoriteFolderCollapsed(folder.id, !collapsed), "toggle link favorite folder"));
    header.appendChild(collapse);

    const name = document.createElement("span");
    name.className = "poe2-marketwright-link-favorite-group-name";
    name.textContent = folder.name;
    header.appendChild(name);

    const save = createCurrentLinkFavoriteIconButton(folderId);
    const rename = createLinkFavoriteIconButton(
      "poe2-marketwright-link-favorite-action",
      t("renameLinkFavoriteFolder"),
      "M2.5 11.8V14h2.2l6.5-6.5-2.2-2.2-6.5 6.5zm10.2-6.2a.9.9 0 0 0 0-1.3L11.3 2.9a.9.9 0 0 0-1.3 0L9 4l2.2 2.2 1.5-1.5z"
    );
    rename.addEventListener("click", () => startLinkFavoriteRename(name, folder.name, t("renameLinkFavoriteFolder"), (value) => renameLinkFavoriteFolder(folder.id, value)));
    const remove = createLinkFavoriteIconButton(
      "poe2-marketwright-link-favorite-action poe2-marketwright-link-favorite-delete",
      t("deleteLinkFavoriteFolder"),
      "M4 4.5h8l-.6 9H4.6l-.6-9zm2-2h4l.6 1H13v1.5H3V3.5h2.4L6 2.5zm1 4v5h1.5v-5H7zm2.5 0v5H11v-5H9.5z"
    );
    remove.addEventListener("click", () => {
      runtime.pendingLinkFavoriteFolderDeleteId = folder.id;
      renderLinkFavoritesDrawer();
    });
    header.append(save, rename, remove);
    group.appendChild(header);

    if (!collapsed) {
      const links = getLinkFavoriteLinks(leagueState, folderId);
      const list = document.createElement("div");
      list.className = "poe2-marketwright-link-favorite-list";
      setLinkFavoriteGroupDropTarget(list, folderId);
      for (const link of links) {
        list.appendChild(renderLinkFavoriteRow(link));
      }
      group.appendChild(list);
    }

    if (runtime.pendingLinkFavoriteFolderDeleteId === folder.id) {
      const confirm = document.createElement("div");
      confirm.className = "poe2-marketwright-link-favorite-folder-confirm";
      const count = getLinkFavoriteLinkIds(leagueState, folder.id).length;
      const message = document.createElement("span");
      message.textContent = t("confirmDeleteLinkFavoriteFolder", count);
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = t("cancelLinkFavoriteFolderDelete");
      cancel.addEventListener("click", () => {
        runtime.pendingLinkFavoriteFolderDeleteId = null;
        renderLinkFavoritesDrawer();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "poe2-marketwright-link-favorite-folder-confirm-delete";
      remove.textContent = t("confirmDeleteLinkFavoriteFolder", count);
      remove.addEventListener("click", () => runAsync(() => deleteLinkFavoriteFolder(folder.id), "delete link favorite folder"));
      confirm.append(message, cancel, remove);
      group.appendChild(confirm);
    }
    return group;
  }

  function renderLinkFavoriteImportForm() {
    const form = document.createElement("form");
    form.className = "poe2-marketwright-link-favorite-import";
    const textarea = document.createElement("textarea");
    textarea.className = "poe2-marketwright-link-favorite-import-input";
    textarea.value = runtime.linkFavoriteImportText;
    textarea.placeholder = t("importLinkFavoritesPlaceholder");
    textarea.setAttribute("aria-label", t("importLinkFavorites"));
    textarea.spellcheck = false;
    textarea.addEventListener("input", () => {
      runtime.linkFavoriteImportText = textarea.value;
    });
    const actions = document.createElement("div");
    actions.className = "poe2-marketwright-link-favorite-import-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = t("cancelLinkFavoriteImport");
    cancel.addEventListener("click", () => {
      runtime.linkFavoriteImporting = false;
      runtime.linkFavoriteImportText = "";
      renderLinkFavoritesDrawer();
    });
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "poe2-marketwright-link-favorite-import-submit";
    submit.textContent = t("confirmLinkFavoriteImport");
    actions.append(cancel, submit);
    form.append(textarea, actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      runtime.linkFavoriteImportText = textarea.value;
      runAsync(() => importLinkFavorites(textarea.value), "import link favorites");
    });
    return form;
  }

  function renderLinkFavoritesDrawer() {
    runtime.linkFavoriteLocationHref = location.href;
    if (!runtime.ui.linkFavoritesList) {
      return;
    }
    hideCompactLinkFavoriteTooltip();
    const league = getCurrentLinkFavoriteLeague();
    runtime.linkFavoriteLeague = league;
    runtime.ui.linkFavoritesLeague.textContent = league ? t("linkFavoritesLeague", league) : t("linkFavoritesLeagueUnavailable");
    runtime.ui.linkFavoritesLeague.title = league || "";
    runtime.ui.linkFavoritesList.replaceChildren();
    const importing = runtime.linkFavoriteImporting;
    if (runtime.ui.linkFavoritesImport) {
      runtime.ui.linkFavoritesImport.disabled = !league || !runtime.state.linkFavoritesEnabled;
      runtime.ui.linkFavoritesImport.title = league ? t("importLinkFavorites") : t("createLinkFavoriteUnavailable");
      runtime.ui.linkFavoritesImport.setAttribute("aria-label", runtime.ui.linkFavoritesImport.title);
    }
    if (runtime.ui.linkFavoritesExport) {
      runtime.ui.linkFavoritesExport.disabled = !league || !runtime.state.linkFavoritesEnabled || importing;
      runtime.ui.linkFavoritesExport.title = league ? t("exportLinkFavorites") : t("createLinkFavoriteUnavailable");
      runtime.ui.linkFavoritesExport.setAttribute("aria-label", runtime.ui.linkFavoritesExport.title);
    }
    runtime.ui.linkFavoritesNewFolder.disabled = !league || !runtime.state.linkFavoritesEnabled || importing;
    runtime.ui.linkFavoritesNewFolder.title = league ? t("createLinkFavoriteFolder") : t("createLinkFavoriteUnavailable");
    const canSaveRoot = Boolean(getCurrentLinkFavoriteContext());
    runtime.ui.linkFavoritesSaveRoot.disabled = !runtime.state.linkFavoritesEnabled || !canSaveRoot || importing;
    runtime.ui.linkFavoritesSaveRoot.title = canSaveRoot ? t("createLinkFavorite") : t("createLinkFavoriteUnavailable");
    runtime.ui.linkFavoritesSaveRoot.setAttribute("aria-label", runtime.ui.linkFavoritesSaveRoot.title);
    if (runtime.ui.linkFavoritesCollapseAll) {
      runtime.ui.linkFavoritesCollapseAll.disabled = true;
      runtime.ui.linkFavoritesCollapseAll.title = t("collapseAllLinkFavoriteFolders");
      runtime.ui.linkFavoritesCollapseAll.setAttribute("aria-label", runtime.ui.linkFavoritesCollapseAll.title);
    }
    scheduleDeletedLinkFavoriteExpiry();
    const undoCount = runtime.deletedLinkFavorites.length;
    const feedback = undoCount
      ? { text: t("linkFavoriteDeleted", undoCount), state: "ready" }
      : runtime.linkFavoriteFeedback;
    runtime.ui.linkFavoritesFeedback.hidden = !feedback;
    runtime.ui.linkFavoritesFeedback.dataset.state = feedback?.state || "";
    runtime.ui.linkFavoritesFeedbackText.textContent = feedback?.text || "";
    runtime.ui.linkFavoritesFeedbackUndo.hidden = undoCount === 0;
    runtime.ui.linkFavoritesFeedbackUndo.disabled = undoCount === 0;
    if (!league) {
      runtime.linkFavoriteImporting = false;
      runtime.linkFavoriteImportText = "";
      const status = document.createElement("div");
      status.className = "poe2-marketwright-link-favorites-empty";
      status.textContent = t("createLinkFavoriteUnavailable");
      runtime.ui.linkFavoritesList.appendChild(status);
      return;
    }

    if (importing) {
      runtime.ui.linkFavoritesList.appendChild(renderLinkFavoriteImportForm());
      return;
    }

    const leagueState = getLinkFavoriteLeagueState(runtime.state.linkFavorites, league, true);
    const folders = leagueState.folderOrder
      .map((folderId) => getLinkFavoriteFolder(leagueState, folderId))
      .filter(Boolean);
    if (runtime.ui.linkFavoritesCollapseAll) {
      const allCollapsed = folders.length > 0 && folders.every((folder) => folder.collapsed);
      const title = t(allCollapsed ? "expandAllLinkFavoriteFolders" : "collapseAllLinkFavoriteFolders");
      runtime.ui.linkFavoritesCollapseAll.disabled = !runtime.state.linkFavoritesEnabled || folders.length === 0;
      runtime.ui.linkFavoritesCollapseAll.title = title;
      runtime.ui.linkFavoritesCollapseAll.setAttribute("aria-label", title);
      runtime.ui.linkFavoritesCollapseAll.setAttribute("aria-expanded", String(!allCollapsed));
    }
    const root = document.createElement("div");
    root.className = "poe2-marketwright-link-favorite-root";
    setLinkFavoriteGroupDropTarget(root, null);
    const rootLinks = getLinkFavoriteLinks(leagueState, null);
    if (rootLinks.length) {
      for (const link of rootLinks) {
        root.appendChild(renderLinkFavoriteRow(link));
      }
    } else if (!folders.length) {
      const empty = document.createElement("div");
      empty.className = "poe2-marketwright-link-favorites-empty";
      empty.textContent = t("linkFavoritesEmpty");
      root.appendChild(empty);
    }
    const rootDropArea = document.createElement("div");
    rootDropArea.className = "poe2-marketwright-link-favorite-root-drop-area";
    rootDropArea.textContent = t("dropLinkFavoriteAtRoot");
    root.appendChild(rootDropArea);
    if (folders.length) {
      const folderTopDropArea = document.createElement("div");
      folderTopDropArea.className = "poe2-marketwright-link-favorite-folder-top-drop-area";
      folderTopDropArea.textContent = t("dropLinkFavoriteFolderAtTop");
      setLinkFavoriteFolderTopDropTarget(folderTopDropArea);
      runtime.ui.linkFavoritesList.appendChild(folderTopDropArea);
    }
    for (const folder of folders) {
      runtime.ui.linkFavoritesList.appendChild(renderLinkFavoriteGroup(leagueState, folder));
    }
    runtime.ui.linkFavoritesList.appendChild(root);
    if (runtime.linkFavoriteCreatingFolder) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "poe2-marketwright-link-favorite-folder-input";
      input.placeholder = t("createLinkFavoriteFolder");
      input.setAttribute("aria-label", t("createLinkFavoriteFolder"));
      let cancelled = false;
      const commit = () => {
        if (!cancelled) {
          runAsync(() => createLinkFavoriteFolder(input.value), "create link favorite folder");
        }
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        } else if (event.key === "Escape") {
          cancelled = true;
          runtime.linkFavoriteCreatingFolder = false;
          renderLinkFavoritesDrawer();
        }
      });
      input.addEventListener("blur", commit, { once: true });
      runtime.ui.linkFavoritesList.appendChild(input);
      window.setTimeout(() => input.focus(), 0);
    }
  }

  async function launchLinkFavorite(linkId) {
    const league = getCurrentLinkFavoriteLeague();
    const link = getLinkFavoriteLink(getLinkFavoriteLeagueState(runtime.state.linkFavorites, league), linkId);
    if (!link) {
      return;
    }
    const url = link.url;
    try {
      const next = cloneLinkFavoritesState();
      const savedLink = getLinkFavoriteLink(getLinkFavoriteLeagueState(next, league), linkId);
      if (savedLink) {
        savedLink.lastUsedAt = Date.now();
        await replaceLinkFavorites(next);
      }
    } catch (error) {
      console.debug("[PoE2 Marketwright] unable to record link favorite usage", error);
    }
    window.location.assign(url);
  }

  async function setFavoritesDrawerOpen(open) {
    if (!runtime.state.favoritesEnabled) {
      return;
    }
    if (getFavoritesViewMode() === "full") {
      await setFavoritesPanelOpen(open, "items");
      return;
    }
    const nextOpen = Boolean(open);
    if (runtime.state.favoritesDrawerOpen === nextOpen) {
      return;
    }
    runtime.state.favoritesDrawerOpen = nextOpen;
    if (nextOpen) {
      runtime.state.linkFavoritesDrawerOpen = false;
      runtime.linkFavoriteImporting = false;
      runtime.linkFavoriteImportText = "";
    }
    applyFavoritesDrawerState();
    applyLinkFavoritesDrawerState();
    applyPanelPosition();
    await saveState();
    publishFavoritesPanelState();
  }

  async function setLinkFavoritesDrawerOpen(open) {
    if (!runtime.state.linkFavoritesEnabled) {
      return;
    }
    if (getFavoritesViewMode() === "full") {
      await setFavoritesPanelOpen(open, "links");
      return;
    }
    const nextOpen = Boolean(open);
    if (runtime.state.linkFavoritesDrawerOpen === nextOpen) {
      return;
    }
    runtime.state.linkFavoritesDrawerOpen = nextOpen;
    if (nextOpen) {
      runtime.state.favoritesDrawerOpen = false;
    } else {
      runtime.linkFavoriteImporting = false;
      runtime.linkFavoriteImportText = "";
    }
    applyFavoritesDrawerState();
    applyLinkFavoritesDrawerState();
    applyPanelPosition();
    await saveState();
    publishFavoritesPanelState();
  }

  function applyFavoritesDrawerState() {
    if (!runtime.ui.root || !runtime.ui.favoritesDisclosure) {
      return;
    }
    const open = Boolean(
      runtime.state.favoritesEnabled &&
        !runtime.state.collapsed &&
        ((getFavoritesViewMode() === "compact" && runtime.state.favoritesDrawerOpen) ||
          (isFavoritesFullViewFallbackActive() && getFavoritesPanelTab() === "items"))
    );
    runtime.ui.root.classList.toggle("poe2-marketwright-favorites-open", open);
    runtime.ui.favoritesDisclosure.disabled = !runtime.state.favoritesEnabled;
    runtime.ui.favoritesDisclosure.setAttribute("aria-expanded", String(open));
    runtime.ui.favoritesDisclosure.setAttribute("aria-label", t(open ? "collapseFavoritesDrawer" : "expandFavoritesDrawer"));
    runtime.ui.favoritesDisclosure.title = t(open ? "collapseFavoritesDrawer" : "expandFavoritesDrawer");
  }

  function applyLinkFavoritesDrawerState() {
    if (!runtime.ui.root || !runtime.ui.linkFavoritesDisclosure) {
      return;
    }
    const open = Boolean(
      runtime.state.linkFavoritesEnabled &&
        !runtime.state.collapsed &&
        ((getFavoritesViewMode() === "compact" && runtime.state.linkFavoritesDrawerOpen) ||
          (isFavoritesFullViewFallbackActive() && getFavoritesPanelTab() === "links"))
    );
    runtime.ui.root.classList.toggle("poe2-marketwright-link-favorites-open", open);
    runtime.ui.linkFavoritesDisclosure.disabled = !runtime.state.linkFavoritesEnabled;
    runtime.ui.linkFavoritesDisclosure.setAttribute("aria-expanded", String(open));
    runtime.ui.linkFavoritesDisclosure.setAttribute(
      "aria-label",
      t(open ? "collapseLinkFavoritesDrawer" : "expandLinkFavoritesDrawer")
    );
    runtime.ui.linkFavoritesDisclosure.title = t(open ? "collapseLinkFavoritesDrawer" : "expandLinkFavoritesDrawer");
  }

  async function setPanelCollapsed(collapsed) {
    if (runtime.state.collapsed === collapsed) {
      return;
    }

    if (collapsed) {
      const panelRect = runtime.ui.root?.getBoundingClientRect();
      if (panelRect && panelRect.width > 0 && panelRect.height > 0) {
        runtime.state.panelPosition = { top: clampPanelTop(panelRect.top) };
      }
      const rect = runtime.ui.collapse?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        runtime.state.collapsedPosition = { top: clampPanelTop(rect.top + (rect.height - COLLAPSED_PANEL_SIZE) / 2) };
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
    applyLinkFavoritesDrawerState();
  }

  function applyPanelPosition() {
    const position = runtime.state.collapsed ? runtime.state.collapsedPosition : runtime.state.panelPosition;
    runtime.ui.root.style.left = "";
    runtime.ui.root.style.right = "";
    runtime.ui.root.style.top = position && Number.isFinite(position.top)
      ? `${clampPanelTop(position.top)}px`
      : "";
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
      runtime.ui.root.style.top = `${clampPanelTop(event.clientY - dragState.offsetY)}px`;
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
      if (wasCollapsedHandle && wasMoved) {
        runtime.state.collapsedPosition = { top: clampPanelTop(rect.top) };
      } else if (!wasCollapsedHandle) {
        runtime.state.panelPosition = { top: clampPanelTop(rect.top) };
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
      applyFavoritesView();
      if (runtime.state.collapsed && !runtime.state.collapsedPosition) {
        return;
      }
      if (!runtime.state.collapsed && !runtime.state.panelPosition) {
        return;
      }
      const rect = runtime.ui.root.getBoundingClientRect();
      if (runtime.state.collapsed) {
        runtime.state.collapsedPosition = { top: clampPanelTop(rect.top) };
      } else {
        runtime.state.panelPosition = { top: clampPanelTop(rect.top) };
      }
      applyPanelPosition();
    });
  }

  function clampPanelTop(top) {
    const margin = 8;
    const rect = runtime.ui.root.getBoundingClientRect();
    const height = rect.height || (runtime.state.collapsed ? COLLAPSED_PANEL_SIZE : 188);
    return Math.max(margin, Math.min(top, window.innerHeight - height - margin));
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
    const english = fallback || selection.id;
    const locale = getMessageLocale(runtime.state.uiLanguage);
    return getLocalizedDisplayText(
      {
        en: english,
        [locale]: t(`${prefix}_${toI18nId(selection.id)}`, [], english)
      },
      english
    );
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

  function initializeTradeLocalization() {
    const localization = runtime.data?.tradeLocalization;
    if (!localization || typeof localization !== "object") {
      return;
    }
    runtime.tradeLocalization = localization;
    runtime.tradeSearchRecords = {
      items: Array.isArray(localization.search?.items) ? localization.search.items : [],
      stats: Array.isArray(localization.search?.stats) ? localization.search.stats : [],
      categories: Array.isArray(localization.search?.categories) ? localization.search.categories : []
    };
    runtime.tradeStatTemplates = new Map();
    runtime.tradeStatsById = new Map();
    for (const record of runtime.tradeSearchRecords.stats) {
      const statId = String(record?.id || "").trim();
      if (statId) {
        runtime.tradeStatsById.set(statId, record);
      }
      const key = normalizeStatKey(record?.en || "");
      if (!key || !record?.en) {
        continue;
      }
      const existing = runtime.tradeStatTemplates.get(key);
      if (!existing) {
        runtime.tradeStatTemplates.set(key, record);
      } else if (
        existing.zh_CN !== record.zh_CN ||
        existing.zh_TW !== record.zh_TW ||
        existing.en !== record.en
      ) {
        runtime.tradeStatTemplates.set(key, null);
      }
    }
    if (isPageTranslationEnabled()) {
      startTradeLocalizationObserver();
    }
    refreshTradeLocalization();
  }

  function startTradeLocalizationObserver() {
    if (!runtime.tradeLocalizationObserver && document.documentElement) {
      runtime.tradeLocalizationObserver = new MutationObserver(scheduleTradeLocalizationRefresh);
      runtime.tradeLocalizationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "title", "aria-label"]
      });
    }
  }

  function scheduleTradeLocalizationRefresh() {
    if (runtime.tradeLocalizationTimer) {
      return;
    }
    runtime.tradeLocalizationTimer = window.setTimeout(() => {
      runtime.tradeLocalizationTimer = null;
      refreshTradeLocalization();
    }, 50);
  }

  function refreshTradeLocalization() {
    if (!runtime.tradeLocalization || !document.querySelector(TRADE_ROOT_SELECTOR)) {
      return;
    }
    const root = document.querySelector(TRADE_ROOT_SELECTOR);
    for (const element of getTradeAdvancedFilterCopyElements(root)) {
      localizeTradeElement(element, { allowAdvancedFilterCopy: true });
    }
    for (const element of getTradeLocalizationElements(root)) {
      localizeTradeElement(element);
    }
    for (const element of root.querySelectorAll("[placeholder], [title], [aria-label]")) {
      if (element.closest(TRADE_LOCALIZATION_SELECTOR)) {
        localizeTradeAttributes(element);
      }
    }
    localizeTradeFilterTipCopy(root);
  }

  function getTradeLocalizationElements(root) {
    const elements = new Set(root.querySelectorAll(TRADE_LOCALIZATION_SELECTOR));
    if (root.matches?.(TRADE_LOCALIZATION_SELECTOR)) {
      elements.add(root);
    }
    return elements;
  }

  function getTradeAdvancedFilterCopyElements(root) {
    return new Set(root.querySelectorAll(TRADE_ADVANCED_FILTER_COPY_SELECTOR));
  }

  function localizeTradeFilterTipCopy(root) {
    for (const element of root.querySelectorAll?.(TRADE_FILTER_TIP_SELECTOR) || []) {
      let source = element[TRADE_LOCALIZATION_SOURCE_KEY] ?? getTradeFilterTipText(element);
      element[TRADE_LOCALIZATION_SOURCE_KEY] = source;
      const current = getTradeFilterTipText(element);
      if (
        element[TRADE_LOCALIZATION_RENDER_KEY] !== undefined &&
        current !== element[TRADE_LOCALIZATION_RENDER_KEY]
      ) {
        source = current;
        element[TRADE_LOCALIZATION_SOURCE_KEY] = source;
      }
      if (!isTradeTooltipCopy(source)) {
        continue;
      }
      const localized = !isPageTranslationEnabled() || resolvePageLanguage(runtime.state.pageLanguage) === "en"
        ? source
        : getLocalizedTradeText(source);
      if (localized !== current) {
        replaceTradeFilterTipText(element, localized);
      }
      element[TRADE_LOCALIZATION_RENDER_KEY] = localized;
    }
  }

  function getTradeFilterTipText(element) {
    const read = (node) => {
      if (node?.nodeType === 3) {
        return node.nodeValue || "";
      }
      if (node?.nodeType !== 1) {
        return "";
      }
      if (String(node.nodeName || "").toUpperCase() === "BR") {
        return "\n";
      }
      return Array.from(node.childNodes || [], read).join("");
    };
    return read(element);
  }

  function replaceTradeFilterTipText(element, value) {
    const lines = String(value).split("\n");
    const nodes = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (index > 0) {
        nodes.push(document.createElement("br"));
      }
      nodes.push(document.createTextNode(lines[index]));
    }
    element.replaceChildren(...nodes);
  }

  function isTradeTooltipCopy(value) {
    const normalized = normalizeLookupText(value);
    return TRADE_TOOLTIP_COPY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }

  function localizeTradeElement(element, options = {}) {
    if (isExcludedTradeLocalizationElement(element, options)) {
      return;
    }
    const visit = (current) => {
      if (current.nodeType === 3) {
        let source = current[TRADE_LOCALIZATION_SOURCE_KEY] ?? current.nodeValue ?? "";
        current[TRADE_LOCALIZATION_SOURCE_KEY] = source;
        if (
          current[TRADE_LOCALIZATION_RENDER_KEY] !== undefined &&
          current.nodeValue !== current[TRADE_LOCALIZATION_RENDER_KEY]
        ) {
          source = current.nodeValue ?? "";
          current[TRADE_LOCALIZATION_SOURCE_KEY] = source;
        }
        const localized = getLocalizedTradeText(source, current.parentElement);
        if (localized !== current.nodeValue) {
          current.nodeValue = localized;
        }
        current[TRADE_LOCALIZATION_RENDER_KEY] = localized;
        return;
      }
      if (current.nodeType !== 1 || isExcludedTradeLocalizationElement(current, options)) {
        return;
      }
      if (current.matches?.("[data-field^='stat.']")) {
        localizeTradeStatElement(current);
        return;
      }
      localizeTradeAttributes(current, options);
      for (const child of current.childNodes || []) {
        visit(child);
      }
    };
    visit(element);
  }

  function localizeTradeStatElement(element) {
    if (!isPageTranslationEnabled()) {
      if (element[TRADE_STAT_SOURCE_HTML_KEY] !== undefined) {
        element.innerHTML = element[TRADE_STAT_SOURCE_HTML_KEY];
        delete element[TRADE_STAT_SOURCE_HTML_KEY];
        delete element[TRADE_STAT_RENDER_KEY];
      }
      return;
    }

    const currentText = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    if (currentText !== element[TRADE_STAT_RENDER_KEY]) {
      element[TRADE_LOCALIZATION_SOURCE_KEY] = currentText;
      element[TRADE_STAT_SOURCE_HTML_KEY] = element.innerHTML;
    }
    const source = element[TRADE_LOCALIZATION_SOURCE_KEY] || currentText;
    const display = getTradeStatDisplay(source, element);
    if (!display) {
      return;
    }

    const isResultStat = Boolean(element.closest(".search-results, .results, .result, .item"));
    const rendered = getTradeStatRenderText(display, isResultStat);
    if (element[TRADE_STAT_RENDER_KEY] === rendered) {
      return;
    }

    element.replaceChildren();
    const localized = document.createElement("span");
    localized.className = "poe2-marketwright-result-stat-localized";
    localized.textContent = display.primary;
    element.appendChild(localized);
    if (display.english) {
      const original = document.createElement("span");
      original.className = isResultStat
        ? "poe2-marketwright-result-stat-original"
        : "poe2-marketwright-inline-stat-original";
      original.textContent = isResultStat ? display.english : ` (${display.english})`;
      element.appendChild(original);
    }
    element[TRADE_STAT_RENDER_KEY] = rendered;
  }

  function getTradeStatRenderText(display, isResultStat) {
    if (!display?.english) {
      return String(display?.primary || "");
    }
    return isResultStat
      ? `${display.primary} ${display.english}`
      : `${display.primary} (${display.english})`;
  }

  function localizeTradeAttributes(element, options = {}) {
    if (isExcludedTradeLocalizationElement(element, options)) {
      return;
    }
    for (const attribute of ["placeholder", "title", "aria-label"]) {
      if (!element.hasAttribute?.(attribute)) {
        continue;
      }
      const sourceKey = `${TRADE_LOCALIZATION_SOURCE_KEY}:${attribute}`;
      const renderKey = `${TRADE_LOCALIZATION_RENDER_KEY}:${attribute}`;
      let source = element[sourceKey] ?? element.getAttribute(attribute) ?? "";
      element[sourceKey] = source;
      if (element[renderKey] !== undefined && element.getAttribute(attribute) !== element[renderKey]) {
        source = element.getAttribute(attribute) ?? "";
        element[sourceKey] = source;
      }
      const localized = getLocalizedTradeText(source);
      if (localized !== element.getAttribute(attribute)) {
        element.setAttribute(attribute, localized);
      }
      element[renderKey] = localized;
    }
  }

  function isExcludedTradeLocalizationElement(element, { allowAdvancedFilterCopy = false } = {}) {
    return !(element instanceof Element) ||
      Boolean(
        runtime.ui.root?.contains(element) ||
          // Search controls come from localized native Trade caches. A DOM
          // pass here would translate while Vue is filtering and corrupt its
          // display/search state.
          element.closest(ITEM_SEARCH_ROOT_SELECTOR) ||
          (!allowAdvancedFilterCopy && element.closest("#trade .search-advanced-pane")) ||
          element.closest(TRADE_LOCALIZATION_EXCLUDED_SELECTOR) ||
          element.closest(".poe2-marketwright, .poe2-trade2-affix-filter")
      );
  }

  function getLocalizedTradeText(value, element = null) {
    const source = String(value || "");
    if (!isPageTranslationEnabled()) {
      return source;
    }
    const match = source.match(/^(\s*)(.*?)(\s*)$/s);
    const leading = match?.[1] || "";
    const text = match?.[2] || "";
    const trailing = match?.[3] || "";
    if (!text) {
      return source;
    }
    const override = getTradeTermLocalizationOverride(text);
    if (override) {
      return `${leading}${getLocalizedTradePageText(override, text, false)}${trailing}`;
    }
    if (!runtime.tradeLocalization) {
      return source;
    }
    const statDisplay = getTradeStatDisplay(text, element);
    if (statDisplay) {
      const bilingual = statDisplay.english ? ` (${statDisplay.english})` : "";
      return `${leading}${statDisplay.primary}${bilingual}${trailing}`;
    }
    const exact = runtime.tradeLocalization.strings?.[text] || runtime.tradeLocalization.clientStrings?.[text];
    if (exact) {
      return `${leading}${getLocalizedTradePageText(exact, text, false)}${trailing}`;
    }
    const item = runtime.tradeSearchRecords.items?.find((record) => record?.en === text);
    return item
      ? `${leading}${getLocalizedTradePageText(item, text, false)}${trailing}`
      : source;
  }

  function getTradeTermLocalizationOverride(value) {
    const normalized = normalizeLookupText(value);
    const exact = TRADE_TERM_LOCALIZATION_OVERRIDES[normalized];
    if (exact) {
      return exact;
    }
    const weightedSumVersion = normalized.match(/^weighted sum (v\d+)$/);
    if (!weightedSumVersion) {
      return null;
    }
    const version = weightedSumVersion[1].toUpperCase();
    return {
      en: `WEIGHTED SUM ${version}`,
      zh_CN: `加权总和 ${version}`,
      zh_TW: `加權總和 ${version}`
    };
  }

  function getTradeStatRecordForElement(element) {
    const statElement = element?.closest?.("[data-field^='stat.']");
    const field = String(statElement?.getAttribute?.("data-field") || "");
    if (!field.startsWith("stat.")) {
      return null;
    }
    return runtime.tradeStatsById.get(field.slice("stat.".length)) || null;
  }

  function getLocalizedTradePageText(record, fallback, bilingual) {
    const language = resolvePageLanguage(runtime.state.pageLanguage);
    if (language === "en") {
      return String(record?.en || fallback || "");
    }
    const locale = getMessageLocale(language);
    const localized = String(record?.[locale] || record?.en || fallback || "");
    const english = String(record?.en || fallback || "");
    return bilingual && language.endsWith("_en") && localized && english && localized !== english
      ? `${localized} (${english})`
      : localized;
  }

  function getTradeStatDisplay(text, element = null) {
    const localized = getLocalizedTradeStatTemplate(text, getTradeStatRecordForElement(element));
    if (!localized) {
      return null;
    }
    const language = resolvePageLanguage(runtime.state.pageLanguage);
    if (language === "en") {
      return { primary: localized.en, english: null };
    }
    const locale = getMessageLocale(language);
    const primary = String(localized[locale] || localized.en || text);
    const english = String(localized.en || text);
    return {
      primary,
      english: language.endsWith("_en") && primary !== english ? english : null
    };
  }

  function getLocalizedTradeStatTemplate(text, record = null) {
    const template = record || runtime.tradeStatTemplates.get(normalizeStatKey(text));
    if (!template) {
      return null;
    }
    const values = String(text).match(NUMBER_RE) || [];
    let index = 0;
    const format = (language) => {
      const target = String(template[language] || template.en || "");
      return target.replace(/#/g, (placeholder, offset) => {
        const value = values[index++] || placeholder;
        return target[offset - 1] === "+" ? value.replace(/^\+/, "") : value;
      });
    };
    const language = resolvePageLanguage(runtime.state.pageLanguage);
    if (language === "en") {
      return { en: format("en") };
    }
    const locale = getMessageLocale(language);
    index = 0;
    const localized = format(locale);
    index = 0;
    const english = format("en");
    return {
      en: english,
      [locale]: localized
    };
  }

  function isPageTranslationEnabled() {
    return runtime.state.pageTranslationEnabled !== false;
  }

  function bindGlobalListeners() {
    bindFavoritesPanelMessages();
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
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideCompactLinkFavoriteTooltip();
      }
    });
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
      const linkFavoriteLeague = getCurrentLinkFavoriteLeague();
      if (
        linkFavoriteLeague !== runtime.linkFavoriteLeague ||
        location.href !== runtime.linkFavoriteLocationHref
      ) {
        renderLinkFavoritesDrawer();
        publishFavoritesPanelState();
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

      if (event.data.type === BRIDGE_SEARCH_SNAPSHOT_TYPE) {
        const payload = event.data.payload || {};
        const snapshot = buildLinkFavoriteDisplaySnapshot(payload.query);
        const league = String(payload.league || "").trim();
        const queryId = String(payload.queryId || "").trim();
        if (snapshot && league && queryId) {
          runtime.tradeSearchSnapshots.set(`${league}\u0000${queryId}`, snapshot);
          if (runtime.tradeSearchSnapshots.size > 12) {
            runtime.tradeSearchSnapshots.delete(runtime.tradeSearchSnapshots.keys().next().value);
          }
        }
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

  function buildLinkFavoriteDisplaySnapshot(payload) {
    const query = payload?.query && typeof payload.query === "object" ? payload.query : payload;
    if (!query || typeof query !== "object") {
      return null;
    }
    const typeFilters = query.filters?.type_filters?.filters || {};
    const type = String(query.type || "").trim();
    const category = String(typeFilters.category?.option || "").trim();
    const rarity = String(typeFilters.rarity?.option || "").trim();
    const normalizeStat = (stat) => {
      const id = String(stat?.id || "").trim();
      if (!id) {
        return null;
      }
      const min = Number(stat?.value?.min);
      const max = Number(stat?.value?.max);
      const weight = Number(stat?.value?.weight);
      return {
        id,
        ...(Number.isFinite(min) || Number.isFinite(max)
          ? { value: { ...(Number.isFinite(min) ? { min } : {}), ...(Number.isFinite(max) ? { max } : {}) } }
          : {}),
        ...(stat?.disabled === true ? { disabled: true } : {}),
        ...(Number.isFinite(weight) ? { weight } : {})
      };
    };
    const statGroups = (Array.isArray(query.stats) ? query.stats : [])
      .slice(0, 16)
      .map((group) => {
        const filters = (Array.isArray(group?.filters) ? group.filters : [])
          .slice(0, 16)
          .map(normalizeStat)
          .filter(Boolean);
        if (!filters.length) {
          return null;
        }
        const rawMin = group?.value?.min;
        const rawMax = group?.value?.max;
        const min = rawMin == null || rawMin === "" ? Number.NaN : Number(rawMin);
        const max = rawMax == null || rawMax === "" ? Number.NaN : Number(rawMax);
        const rawType = String(group?.type || "and").trim().toLocaleLowerCase().replace(/[\s-]+/g, "_") || "and";
        return {
          type: rawType === "weight2" ? "weighted" : rawType,
          ...(Number.isFinite(min) || Number.isFinite(max)
            ? { value: { ...(Number.isFinite(min) ? { min } : {}), ...(Number.isFinite(max) ? { max } : {}) } }
            : {}),
          filters
        };
      })
      .filter(Boolean);
    return type || category || rarity || statGroups.length
      ? {
          ...(type ? { type } : {}),
          ...(category ? { category } : {}),
          ...(rarity ? { rarity } : {}),
          ...(statGroups.length ? { statGroups } : {}),
          ...(statGroups.length ? { statGroupsVersion: LINK_FAVORITE_STAT_GROUPS_VERSION } : {})
        }
      : null;
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
    syncTierBridge(inferActiveSelection());

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

    return chooseActiveSelection(itemSelection, categorySelection);
  }

  function chooseActiveSelection(itemSelection, categorySelection) {
    if (itemSelection?.uniqueItemType) {
      return itemSelection;
    }
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
    if (!group) {
      return null;
    }
    const body = group.querySelector(".filter-group-body") || group;
    const fields = Array.from(body.children).filter((child) => child.matches?.(".filter.filter-property"));
    if (!fields.length) {
      fields.push(...(body.querySelectorAll?.(".filter.filter-property") || []));
    }
    const categoryField =
      fields.find((field) => isCategoryFilterField(field)) ||
      fields.find((field) => field.matches(".filter-property.full-span")) ||
      fields[0];

    return categoryField?.querySelector(".multiselect.filter-select, .multiselect, select") || null;
  }

  function findTypeFilterGroup() {
    const groups = new Set([
      ...document.querySelectorAll(TYPE_FILTER_GROUP_SELECTOR),
      ...document.querySelectorAll("#trade .filter-group")
    ]);
    for (const group of groups) {
      const text = normalizeLookupText(group.textContent || "");
      if (/(type filters?|類別過濾|类别过滤|類別篩選器|类别筛选器)/.test(text) && /(item category|道具分類|道具分类)/.test(text)) {
        return group;
      }
    }
    return document.querySelector(TYPE_FILTER_GROUP_SELECTOR) || document.querySelector("#trade .filter-group");
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
        ...itemSelection,
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
          ...itemSelection,
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
      return addUniqueItemType(override, itemName);
    }

    const itemSlug = runtime.data.itemNameToPage?.[itemName];
    if (itemSlug) {
      return addUniqueItemType({
        kind: "page",
        id: itemSlug
      }, itemName);
    }

    return null;
  }

  function addUniqueItemType(selection, itemName) {
    const uniqueItemType = runtime.data.uniqueItemTypeByName?.[itemName];
    return uniqueItemType ? { ...selection, uniqueItemType } : selection;
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
      return mergeUniqueItemTypeArtifacts(selection, runtime.pagePatternCache.get(selection.id), "allowedPatterns");
    }

    if (selection.kind === "logical") {
      if (!runtime.logicalPatternCache.has(selection.id)) {
        const record = runtime.data.logicalCategories[selection.id];
        runtime.logicalPatternCache.set(
          selection.id,
          new Set((record ? record.allowedPatterns : []).map(normalizeStatKey).filter(Boolean))
        );
      }
      return mergeUniqueItemTypeArtifacts(selection, runtime.logicalPatternCache.get(selection.id), "allowedPatterns");
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
      return mergeUniqueItemTypeArtifacts(selection, runtime.pageStatIdCache.get(selection.id), "allowedStatIds");
    }

    if (selection.kind === "logical") {
      if (!runtime.logicalStatIdCache.has(selection.id)) {
        const record = runtime.data.logicalCategories[selection.id];
        runtime.logicalStatIdCache.set(selection.id, new Set(record ? record.allowedStatIds || [] : []));
      }
      return mergeUniqueItemTypeArtifacts(selection, runtime.logicalStatIdCache.get(selection.id), "allowedStatIds");
    }

    return null;
  }

  function mergeUniqueItemTypeArtifacts(selection, allowedValues, field) {
    const values = runtime.data.uniqueItemTypeArtifacts?.[selection?.uniqueItemType]?.[field];
    if (!Array.isArray(values) || !values.length) {
      return allowedValues;
    }
    const normalizedValues = field === "allowedPatterns"
      ? values.map(normalizeStatKey).filter(Boolean)
      : values.map(String).filter(Boolean);
    return new Set([...allowedValues, ...normalizedValues]);
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
    updateTierControls();
    updatePobCopyToggleButton();
    updateFavoritesToggleButton();
    updateLinkFavoritesToggleButton();
    updateCurrencyConversionToggleButton();
    updatePageTranslationToggleButton();
    updateIdleTransparencyControls();
  }

  function updateTierControls() {
    if (!runtime.ui.tierEnabled || !runtime.ui.tierModeOptions?.length) {
      return;
    }
    const enabled = Boolean(runtime.state.tierEnabled);
    runtime.ui.tierEnabled.textContent = enabled ? t("toggleOn") : t("toggleOff");
    runtime.ui.tierEnabled.setAttribute("aria-pressed", String(enabled));
    runtime.ui.tierEnabled.title = enabled ? t("disableTierSelection") : t("enableTierSelection");
    updateSegmentedOptions(runtime.ui.tierModeOptions, runtime.state.tierMode, "tierMode", !enabled);
  }

  function updateSidebarPositionControls() {
    updateSegmentedOptions(runtime.ui.sidebarPositionOptions, getSidebarPosition(), "sidebarPosition");
  }

  function updateSegmentedOptions(options, activeValue, key, disabled = false) {
    options?.forEach((option) => {
      const active = option.dataset[key] === activeValue;
      option.classList.toggle("poe2-marketwright-segmented-option-active", active);
      option.setAttribute("aria-checked", String(active));
      option.disabled = disabled;
      option.setAttribute("aria-disabled", String(disabled));
    });
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

  function updateLinkFavoritesToggleButton() {
    if (!runtime.ui.linkFavoritesEnabled) {
      return;
    }
    const enabled = Boolean(runtime.state.linkFavoritesEnabled);
    runtime.ui.linkFavoritesEnabled.textContent = enabled ? t("toggleOn") : t("toggleOff");
    runtime.ui.linkFavoritesEnabled.setAttribute("aria-pressed", String(enabled));
    runtime.ui.linkFavoritesEnabled.title = enabled ? t("disableLinkFavorites") : t("enableLinkFavorites");
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

  function updatePageTranslationToggleButton() {
    if (!runtime.ui.pageTranslationEnabled) {
      return;
    }
    const enabled = isPageTranslationEnabled();
    runtime.ui.pageTranslationEnabled.textContent = enabled ? t("toggleOn") : t("toggleOff");
    runtime.ui.pageTranslationEnabled.setAttribute("aria-pressed", String(enabled));
    runtime.ui.pageTranslationEnabled.title = enabled
      ? t("disableTradePageTranslation")
      : t("enableTradePageTranslation");
    runtime.ui.pageLanguage.disabled = !enabled;
    runtime.ui.pageLanguage.setAttribute("aria-disabled", String(!enabled));
  }

  function updateIdleTransparencyControls() {
    if (!runtime.ui.idleTransparencyEnabled) {
      return;
    }
    const enabled = isIdleTransparencyEnabled();
    const opacity = normalizeIdleTransparency(runtime.state.idleTransparency);
    runtime.ui.idleTransparencyEnabled.textContent = enabled ? t("toggleOn") : t("toggleOff");
    runtime.ui.idleTransparencyEnabled.setAttribute("aria-pressed", String(enabled));
    runtime.ui.idleTransparencyEnabled.title = enabled
      ? t("disableIdleTransparency")
      : t("enableIdleTransparency");
    runtime.ui.idleTransparencyOpacityLabel.textContent = t("idleTransparencyOpacity", opacity);
    runtime.ui.idleTransparencyOpacity.value = String(opacity);
    runtime.ui.idleTransparencyOpacity.disabled = !enabled;
    runtime.ui.idleTransparencyOpacity.setAttribute("aria-disabled", String(!enabled));
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
      uiLanguage: runtime.state.uiLanguage,
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
      payload.uiLanguage,
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

  function syncTierBridge(selection) {
    const tierMappings = runtime.data?.tierMappings || {};
    const tierPageId = selection?.kind === "page" ? selection.id : null;
    const tierEnabled = Boolean(runtime.state.tierEnabled);
    const tierMode = normalizeTierMode(runtime.state.tierMode);
    const pageLabels = Object.fromEntries(
      Object.keys(tierMappings).map((pageId) => {
        const page = runtime.data?.pageCategories?.[pageId];
        return [pageId, localizeSelectionLabel({ kind: "page", id: pageId }, page?.label || pageId)];
      })
    );
    const signature = [tierPageId || "", runtime.state.uiLanguage || "", tierEnabled, tierMode].join("|");
    if (runtime.tierBridgeMappingsSent && signature === runtime.tierBridgeSignature) {
      return;
    }
    const includeMappings = !runtime.tierBridgeMappingsSent;
    runtime.tierBridgeMappingsSent = true;
    runtime.tierBridgeSignature = signature;
    window.postMessage(
      {
        source: BRIDGE_SOURCE,
        type: BRIDGE_TIER_UPDATE_TYPE,
        payload: {
          ...(includeMappings ? { tierMappings } : {}),
          tierPageId,
          tierEnabled,
          tierMode,
          tierPageLabels: pageLabels,
          tierLabel: t("tierSelectorLabel", [], "Tier")
        }
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
