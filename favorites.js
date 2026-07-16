(function () {
  const GLOBAL_NAME = "Poe2MarketwrightFavorites";
  const BUTTON_CLASS = "poe2-marketwright-favorite-button";
  const PROCESSED_ATTR = "data-poe2-marketwright-favorite";
  const MESSAGE_SOURCE = "poe2-marketwright-favorites";
  const ENGLISH_ORIGINS = new Set(["https://pathofexile.com", "https://www.pathofexile.com"]);
  const SUPPORTED_STAT_SOURCES = new Set([
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
  const COMBINED_STAT_SOURCES = new Set(["fractured", "desecrated"]);
  const NUMBER_RE = /-?\d+(?:\.\d+)?/g;
  const FAVORITE_FOLDERS_VERSION = 1;
  const LINK_FAVORITES_VERSION = 2;
  const LINK_FAVORITE_STAT_GROUPS_VERSION = 3;
  const TRADE_SEARCH_ORIGINS = new Set(["https://pathofexile.com", "https://www.pathofexile.com"]);
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

  function getExtendedModifierHash(item, sourceKey, index) {
    const source = String(sourceKey || "").replace(/Mods$/, "").toLowerCase();
    const hashes = item?.extended?.hashes?.[source];
    if (!Array.isArray(hashes)) {
      return null;
    }
    const indexedHash = hashes.find((entry) => Array.isArray(entry?.[1]) && entry[1].includes(index))?.[0];
    return indexedHash || hashes[index]?.[0] || null;
  }

  function getItemModifiers(item) {
    const modifiers = [];
    for (const [sourceKey, sourceMods] of Object.entries(item || {})) {
      if (!sourceKey.endsWith("Mods") || !Array.isArray(sourceMods)) {
        continue;
      }
      sourceMods.forEach((modifier, index) => {
        modifiers.push({
          hash: modifier?.hash || getExtendedModifierHash(item, sourceKey, index),
          description: typeof modifier === "string" ? modifier : modifier?.description
        });
      });
    }
    if (!Array.isArray(item?.skillMods)) {
      (Array.isArray(item?.grantedSkills) ? item.grantedSkills : []).forEach((skill, index) => {
        const values = (Array.isArray(skill?.values) ? skill.values : [])
          .map((value) => Array.isArray(value) ? value[0] : value)
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        modifiers.push({
          hash: getExtendedModifierHash(item, "skillMods", index),
          description: [String(skill?.name || "").trim(), ...values].filter(Boolean).join(": ")
        });
      });
    }
    return modifiers;
  }

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
      const parts = String(hash || "").trim().split(".");
      if (parts[0]?.toLowerCase() === "stat") {
        parts.shift();
      }
      const source = parts.shift()?.toLowerCase();
      const statId = parts.join(".");
      return source && statId && SUPPORTED_STAT_SOURCES.has(source) ? `${source}.${statId}` : null;
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

      for (const mod of getItemModifiers(item)) {
        const id = getStatId(mod?.hash);
        if (!id) {
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
        const separatorIndex = id.indexOf(".");
        const source = id.slice(0, separatorIndex);
        const baseStatId = id.slice(separatorIndex + 1);
        mods.push({ id, text, source });
        if (COMBINED_STAT_SOURCES.has(source) && next.value != null) {
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
          "Favorite requires at least one supported trade modifier"
        );
      }

      const stats = Array.from(groupedStats.values()).map((stat) => {
        if (stat.value == null) {
          return { id: stat.id };
        }
        return { id: stat.id, value: { min: stat.value, max: stat.value } };
      });
      const favorite = {
        version: 2,
        league: normalizedLeague,
        displayName: originalName || baseName,
        nameSource: "automatic",
        originalName,
        baseName,
        category,
        itemType,
        itemSelection:
          itemClassification?.selection?.kind && itemClassification?.selection?.id
            ? { kind: itemClassification.selection.kind, id: itemClassification.selection.id }
            : null,
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

    const createFavoriteFolderId = () => {
      const randomId = globalThis.crypto?.randomUUID?.();
      return randomId
        ? `folder-${randomId}`
        : `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };

    const normalizeFavoriteFoldersState = (storedState, favorites) => {
      const current = storedState?.version === FAVORITE_FOLDERS_VERSION ? storedState : { leagues: {} };
      const favoritesByLeague = new Map();
      for (const [position, favorite] of (Array.isArray(favorites) ? favorites : []).entries()) {
        const signature = String(favorite?.signature || "").trim();
        const league = String(favorite?.league || "").trim();
        if (!signature || !league) {
          continue;
        }
        const entries = favoritesByLeague.get(league) || [];
        if (!entries.some((entry) => entry.signature === signature)) {
          entries.push({ signature, position, createdAt: Number(favorite?.createdAt) || 0 });
        }
        favoritesByLeague.set(league, entries);
      }

      const leagues = {};
      const leagueNames = new Set([...Object.keys(current.leagues || {}), ...favoritesByLeague.keys()]);
      for (const league of leagueNames) {
        const rawState = current.leagues?.[league] || {};
        const validEntries = favoritesByLeague.get(league) || [];
        const validSignatures = new Set(validEntries.map((entry) => entry.signature));
        const folders = [];
        const folderIds = new Set();
        for (const rawFolder of Array.isArray(rawState.folders) ? rawState.folders : []) {
          const id = String(rawFolder?.id || "").trim();
          const name = String(rawFolder?.name || "").replace(/\s+/g, " ").trim();
          if (!id || !name || folderIds.has(id)) {
            continue;
          }
          folderIds.add(id);
          folders.push({
            id,
            name,
            createdAt: Number.isFinite(Number(rawFolder?.createdAt)) ? Number(rawFolder.createdAt) : 0,
            collapsed: Boolean(rawFolder?.collapsed)
          });
        }
        const folderOrder = [];
        for (const id of Array.isArray(rawState.folderOrder) ? rawState.folderOrder : []) {
          if (folderIds.has(id) && !folderOrder.includes(id)) {
            folderOrder.push(id);
          }
        }
        for (const folder of folders) {
          if (!folderOrder.includes(folder.id)) {
            folderOrder.push(folder.id);
          }
        }

        const assigned = new Set();
        const orderedSignatures = (source) => {
          const result = [];
          for (const signature of Array.isArray(source) ? source : []) {
            if (validSignatures.has(signature) && !assigned.has(signature)) {
              assigned.add(signature);
              result.push(signature);
            }
          }
          return result;
        };
        const rootFavoriteSignatures = orderedSignatures(rawState.rootFavoriteSignatures);
        const folderFavoriteSignatures = {};
        for (const folderId of folderOrder) {
          folderFavoriteSignatures[folderId] = orderedSignatures(rawState.folderFavoriteSignatures?.[folderId]);
        }
        for (const entry of validEntries
          .filter((entry) => !assigned.has(entry.signature))
          .sort((left, right) => right.createdAt - left.createdAt || left.position - right.position)) {
          rootFavoriteSignatures.push(entry.signature);
        }

        if (folders.length || rootFavoriteSignatures.length) {
          leagues[league] = { folders, folderOrder, rootFavoriteSignatures, folderFavoriteSignatures };
        }
      }
      return { version: FAVORITE_FOLDERS_VERSION, leagues };
    };

    return {
      createFavoriteFolderId,
      createFavoriteRecord,
      createTradeSearchPayload,
      getLeagueFromTradeUrl,
      normalizeFavoriteFoldersState
    };
  }

  function createLinkFavoriteTools() {
    const createLinkFavoriteError = (code, message, details = {}) => {
      const error = new Error(message);
      error.code = code;
      error.details = details;
      return error;
    };

    const createLinkFavoriteId = (prefix) => {
      const randomId = globalThis.crypto?.randomUUID?.();
      if (randomId) {
        return `${prefix}-${randomId}`;
      }
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };

    const normalizeTimestamp = (value, fallback = 0) => {
      const timestamp = Number(value);
      return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : fallback;
    };

    const normalizeId = (value) => {
      const id = String(value || "").trim();
      return id || null;
    };

    const normalizeName = (value) => String(value || "").replace(/\s+/g, " ").trim();

    const normalizeLinkFavoriteFilterGroups = (value) => {
      if (!Array.isArray(value)) {
        return [];
      }

      const groups = [];
      for (const rawGroup of value) {
        if (groups.length >= 24) {
          break;
        }
        const label = normalizeName(rawGroup?.label);
        if (!label || label.length > 120 || !Array.isArray(rawGroup?.values)) {
          continue;
        }
        const values = [];
        const seen = new Set();
        for (const rawValue of rawGroup.values) {
          if (values.length >= 16) {
            break;
          }
          const entry = normalizeName(rawValue);
          const key = entry.toLocaleLowerCase();
          if (!entry || entry.length > 300 || seen.has(key)) {
            continue;
          }
          seen.add(key);
          values.push(entry);
        }
        if (values.length) {
          groups.push({ label, values });
        }
      }
      return groups;
    };

    const LINK_FAVORITE_SPECIAL_SOURCES = [
      { key: "crafted", pattern: /^(crafted\b\s*|\u5de5\u85dd\s*|\u5de5\u827a\s*)/i },
      { key: "desecrated", pattern: /^(desecrated\b\s*|\u893b\u7006\s*|\u4eb5\u6e0e\s*)/i },
      { key: "fractured", pattern: /^(fractured\b\s*|\u7834\u88c2\s*)/i },
      { key: "enchant", pattern: /^(enchant\b\s*|\u9644\u9b54\s*)/i },
      { key: "augment", pattern: /^(augment\b\s*|\u589e\u5e45\s*)/i },
      { key: "implicit", pattern: /^(implicit\b\s*|\u96b1\u6027\s*|\u9690\u6027\s*)/i }
    ];
    const LINK_FAVORITE_RANDOM_PREFIX_RE = /^(?:random attribute|\u96a8\u6a5f\u5c6c\u6027|\u968f\u673a\u5c5e\u6027)\s*/i;
    const LINK_FAVORITE_MIN_VALUE_RE = /(?:minimum|min|\u6700\u5c0f(?:\u503c)?)\s*[:\uff1a]?\s*(-?\d+(?:\.\d+)?)/i;
    const LINK_FAVORITE_MAX_VALUE_RE = /(?:maximum|max|\u6700\u5927(?:\u503c)?)\s*[:\uff1a]?\s*(-?\d+(?:\.\d+)?)/i;

    const formatLinkFavoriteRange = (minimum, maximum) => {
      const min = String(minimum ?? "").trim();
      const max = String(maximum ?? "").trim();
      return min || max ? `${min} - ${max}`.trim() : "";
    };

    const formatLinkFavoriteFilterRange = (value) => {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      const minimum = text.match(LINK_FAVORITE_MIN_VALUE_RE);
      const maximum = text.match(LINK_FAVORITE_MAX_VALUE_RE);
      const thresholdIndex = Math.min(
        ...[minimum?.index, maximum?.index].filter((index) => Number.isInteger(index))
      );
      if (!Number.isFinite(thresholdIndex)) {
        return text;
      }
      const prefix = text.slice(0, thresholdIndex).trim();
      const range = formatLinkFavoriteRange(minimum?.[1], maximum?.[1]);
      return prefix ? `${prefix} ${range}` : range;
    };

    const formatLinkFavoriteStatFilter = (value) => {
      let text = String(value || "")
        .replace(/\[[^\]]*]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(LINK_FAVORITE_RANDOM_PREFIX_RE, "");
      let source = null;
      for (const candidate of LINK_FAVORITE_SPECIAL_SOURCES) {
        const match = text.match(candidate.pattern);
        if (!match) {
          continue;
        }
        source = { key: candidate.key, label: match[0].trim().toUpperCase() };
        text = text.slice(match[0].length).replace(/^[:\uff1a]\s*/, "").trim();
        break;
      }

      const minimum = text.match(LINK_FAVORITE_MIN_VALUE_RE);
      const maximum = text.match(LINK_FAVORITE_MAX_VALUE_RE);
      const values = [minimum?.[1], maximum?.[1]].filter(Boolean);
      const thresholdIndex = Math.min(
        ...[minimum?.index, maximum?.index].filter((index) => Number.isInteger(index))
      );
      if (Number.isFinite(thresholdIndex)) {
        text = text.slice(0, thresholdIndex).replace(/[\s:\uff1a]+$/, "").trim();
      }

      const threshold = values.length === 2 && values[0] !== values[1] ? values.join("-") : values[0] || "";
      const placeholders = text.match(/#/g) || [];
      if (placeholders.length) {
        let index = 0;
        text = text.replace(/#/g, () => {
          if (placeholders.length === 1) {
            return threshold || "#";
          }
          return values[index++] || values[values.length - 1] || "#";
        });
      } else if (threshold) {
        text = `${text} ${threshold}`.trim();
      }

      return { text, source };
    };

    const validateTradeSearchUrl = (value) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(String(value || ""));
      } catch (error) {
        throw createLinkFavoriteError("invalid_trade_search_url", "Link must be an official PoE2 trade search URL");
      }

      if (parsedUrl.protocol !== "https:" || !TRADE_SEARCH_ORIGINS.has(parsedUrl.origin)) {
        throw createLinkFavoriteError("invalid_trade_search_url", "Link must be an official PoE2 trade search URL", {
          origin: parsedUrl.origin
        });
      }

      // Official pages may use /trade2/search/poe2/{league}/{id} or /trade2/search/{league}/{id}.
      const match = parsedUrl.pathname.match(/^\/trade2\/search\/(?:poe2\/)?([^/]+)\/([^/]+)\/?$/i);
      if (!match) {
        throw createLinkFavoriteError("invalid_trade_search_url", "Link must include a PoE2 league and search id", {
          pathname: parsedUrl.pathname
        });
      }

      let league;
      let queryId;
      try {
        league = decodeURIComponent(match[1]).trim();
        queryId = decodeURIComponent(match[2]).trim();
      } catch (error) {
        throw createLinkFavoriteError("invalid_trade_search_url", "Link contains an invalid league or search id");
      }
      // Never treat the realm segment as a league if a bare /poe2/{id} path slips through.
      if (!league || !queryId || league.includes("/") || queryId.includes("/") || league.toLowerCase() === "poe2") {
        throw createLinkFavoriteError("invalid_trade_search_url", "Link must include a PoE2 league and search id", {
          pathname: parsedUrl.pathname,
          league,
          queryId
        });
      }

      parsedUrl.search = "";
      parsedUrl.hash = "";
      return { url: parsedUrl.toString(), league, queryId };
    };

    const normalizeLinkFavoriteDisplaySnapshot = (snapshot) => {
      if (!snapshot || typeof snapshot !== "object") {
        return null;
      }
      const normalizeValue = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      };
      const normalizeText = (value, limit = 160) => String(value || "").trim().slice(0, limit);
      const normalizeStat = (stat) => {
        const id = normalizeText(stat?.id);
        if (!/^(?:pseudo|explicit|implicit|fractured|crafted|enchant|rune|desecrated|sanctum|skill)\.[\w.|-]+$/i.test(id)) {
          return null;
        }
        const min = normalizeValue(stat?.value?.min);
        const max = normalizeValue(stat?.value?.max);
        const weight = normalizeValue(stat?.weight);
        return {
          id,
          ...(min != null || max != null
            ? { value: { ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) } }
            : {}),
          ...(stat?.disabled === true ? { disabled: true } : {}),
          ...(weight != null ? { weight } : {})
        };
      };
      const normalizeStatGroupType = (value) => {
        const type = normalizeText(value, 32).toLocaleLowerCase().replace(/[\s-]+/g, "_") || "and";
        if (!/^[a-z][a-z0-9_]*$/.test(type)) {
          return "and";
        }
        return type === "weight2" ? "weighted" : type;
      };
      const normalizeRange = (value) => {
        const min = value?.min == null || value.min === "" ? null : normalizeValue(value.min);
        const max = value?.max == null || value.max === "" ? null : normalizeValue(value.max);
        return min != null || max != null
          ? { ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) }
          : null;
      };
      const type = normalizeText(snapshot.type);
      const category = normalizeText(snapshot.category);
      const rarity = normalizeText(snapshot.rarity);
      const isStructuredSnapshot = Number(snapshot.statGroupsVersion) === LINK_FAVORITE_STAT_GROUPS_VERSION;
      if (Array.isArray(snapshot.stats) || (Array.isArray(snapshot.statGroups) && !isStructuredSnapshot)) {
        return null;
      }
      const statGroups = [];
      let statCount = 0;
      for (const rawGroup of isStructuredSnapshot && Array.isArray(snapshot.statGroups) ? snapshot.statGroups.slice(0, 16) : []) {
        if (statCount >= 80 || !Array.isArray(rawGroup?.filters)) {
          break;
        }
        const filters = [];
        for (const rawStat of rawGroup.filters) {
          if (statCount >= 80 || filters.length >= 16) {
            break;
          }
          const stat = normalizeStat(rawStat);
          if (stat) {
            filters.push(stat);
            statCount += 1;
          }
        }
        if (filters.length) {
          const value = normalizeRange(rawGroup.value);
          statGroups.push({
            type: normalizeStatGroupType(rawGroup.type),
            ...(value ? { value } : {}),
            filters
          });
        }
      }
      if (!type && !category && !rarity && !statGroups.length) {
        return null;
      }
      return {
        ...(type ? { type } : {}),
        ...(category ? { category } : {}),
        ...(rarity ? { rarity } : {}),
        ...(statGroups.length ? { statGroups } : {}),
        ...(statGroups.length ? { statGroupsVersion: LINK_FAVORITE_STAT_GROUPS_VERSION } : {})
      };
    };

    const createLinkFavoriteRecord = ({
      url,
      displayName,
      folderId = null,
      id = null,
      createdAt = Date.now(),
      filterGroups = [],
      displaySnapshot = null
    } = {}) => {
      const parsed = validateTradeSearchUrl(url);
      const name = normalizeName(displayName);
      if (!name) {
        throw createLinkFavoriteError("missing_link_favorite_name", "Link favorite requires a display name");
      }
      const normalizedFilterGroups = normalizeLinkFavoriteFilterGroups(filterGroups);
      const normalizedDisplaySnapshot = normalizeLinkFavoriteDisplaySnapshot(displaySnapshot);
      return {
        id: normalizeId(id) || createLinkFavoriteId("link"),
        league: parsed.league,
        queryId: parsed.queryId,
        url: parsed.url,
        displayName: name,
        folderId: normalizeId(folderId),
        createdAt: normalizeTimestamp(createdAt, Date.now()),
        lastUsedAt: null,
        ...(normalizedFilterGroups.length ? { filterGroups: normalizedFilterGroups } : {}),
        ...(normalizedDisplaySnapshot ? { displaySnapshot: normalizedDisplaySnapshot } : {})
      };
    };

    const normalizeLinkFavoriteRecord = (rawLink, league, allowFolder = true) => {
      const id = normalizeId(rawLink?.id);
      const displayName = normalizeName(rawLink?.displayName);
      if (!id || !displayName) {
        return null;
      }
      let parsed;
      try {
        parsed = validateTradeSearchUrl(rawLink?.url);
      } catch (error) {
        return null;
      }
      if (parsed.league !== league) {
        return null;
      }
      const filterGroups = normalizeLinkFavoriteFilterGroups(rawLink?.filterGroups);
      const displaySnapshot = normalizeLinkFavoriteDisplaySnapshot(rawLink?.displaySnapshot);
      return {
        id,
        league,
        queryId: parsed.queryId,
        url: parsed.url,
        displayName,
        folderId: allowFolder ? normalizeId(rawLink?.folderId) : null,
        createdAt: normalizeTimestamp(rawLink?.createdAt),
        lastUsedAt: rawLink?.lastUsedAt == null ? null : normalizeTimestamp(rawLink.lastUsedAt),
        ...(filterGroups.length ? { filterGroups } : {}),
        ...(displaySnapshot ? { displaySnapshot } : {})
      };
    };

    const normalizeLinkFavoriteHistory = (rawHistory, league) => {
      const byUrl = new Map();
      const historyIds = new Set();
      for (const rawLink of Array.isArray(rawHistory) ? rawHistory : []) {
        const record = normalizeLinkFavoriteRecord(rawLink, league, false);
        if (!record || historyIds.has(record.id)) {
          continue;
        }
        historyIds.add(record.id);
        const timestamp = record.lastUsedAt ?? record.createdAt;
        const previous = byUrl.get(record.url);
        if (!previous || timestamp >= (previous.lastUsedAt ?? previous.createdAt)) {
          byUrl.set(record.url, { ...record, lastUsedAt: timestamp });
        }
      }
      return Array.from(byUrl.values()).sort(
        (left, right) => (right.lastUsedAt ?? right.createdAt) - (left.lastUsedAt ?? left.createdAt)
      );
    };

    const upsertLinkFavoriteHistory = (history, context, limit, usedAt = Date.now()) => {
      const parsed = validateTradeSearchUrl(context?.url);
      const normalized = normalizeLinkFavoriteHistory(history, parsed.league);
      const existing = normalized.find((entry) => entry.url === parsed.url);
      const timestamp = normalizeTimestamp(usedAt, Date.now());
      const record = createLinkFavoriteRecord({
        ...existing,
        ...context,
        id: existing?.id || createLinkFavoriteId("history"),
        folderId: null,
        createdAt: existing?.createdAt ?? timestamp
      });
      record.lastUsedAt = timestamp;
      const maxEntries = Math.max(0, Math.floor(Number(limit)) || 0);
      return [record, ...normalized.filter((entry) => entry.url !== record.url)].slice(0, maxEntries);
    };

    const createEmptyLinkFavoritesState = () => ({ version: LINK_FAVORITES_VERSION, leagues: {} });

    const normalizeLeagueState = (league, state) => {
      const folders = [];
      const folderIds = new Set();
      for (const rawFolder of Array.isArray(state?.folders) ? state.folders : []) {
        const id = normalizeId(rawFolder?.id);
        const name = normalizeName(rawFolder?.name);
        if (!id || !name || folderIds.has(id)) {
          continue;
        }
        folderIds.add(id);
        folders.push({
          id,
          name,
          createdAt: normalizeTimestamp(rawFolder?.createdAt),
          collapsed: Boolean(rawFolder?.collapsed)
        });
      }

      const links = [];
      const linkIds = new Set();
      for (const rawLink of Array.isArray(state?.links) ? state.links : []) {
        const link = normalizeLinkFavoriteRecord(rawLink, league);
        if (!link || linkIds.has(link.id)) {
          continue;
        }
        linkIds.add(link.id);
        links.push({
          ...link,
          folderId: link.folderId && folderIds.has(link.folderId) ? link.folderId : null
        });
      }

      const history = normalizeLinkFavoriteHistory(state?.history, league);

      const orderedIds = (ids, validIds) => {
        const seen = new Set();
        const ordered = [];
        for (const id of Array.isArray(ids) ? ids : []) {
          if (validIds.has(id) && !seen.has(id)) {
            seen.add(id);
            ordered.push(id);
          }
        }
        return ordered;
      };
      const folderOrder = orderedIds(state?.folderOrder, folderIds);
      for (const folder of folders) {
        if (!folderOrder.includes(folder.id)) {
          folderOrder.push(folder.id);
        }
      }

      const rootLinkIds = orderedIds(
        state?.rootLinkIds,
        new Set(links.filter((link) => !link.folderId).map((link) => link.id))
      );
      const folderLinkIds = {};
      for (const folderId of folderOrder) {
        const folderLinks = new Set(links.filter((link) => link.folderId === folderId).map((link) => link.id));
        folderLinkIds[folderId] = orderedIds(state?.folderLinkIds?.[folderId], folderLinks);
      }
      for (const link of links) {
        const target = link.folderId ? folderLinkIds[link.folderId] : rootLinkIds;
        if (!target.includes(link.id)) {
          target.push(link.id);
        }
      }

      return {
        folders,
        folderOrder,
        links,
        rootLinkIds,
        folderLinkIds,
        ...(state?.historyCollapsed === true ? { historyCollapsed: true } : {}),
        ...(history.length ? { history } : {})
      };
    };

    const normalizeLinkFavoritesState = (storedState) => {
      const state = storedState && typeof storedState === "object" ? storedState : null;
      const current = state?.version === LINK_FAVORITES_VERSION ? state : createEmptyLinkFavoritesState();
      const leagues = {};
      for (const [rawLeague, leagueState] of Object.entries(current.leagues || {})) {
        const league = normalizeName(rawLeague);
        if (!league || !leagueState || typeof leagueState !== "object") {
          continue;
        }
        const normalized = normalizeLeagueState(league, leagueState);
        if (
          normalized.folders.length ||
          normalized.links.length ||
          normalized.folderOrder.length ||
          normalized.rootLinkIds.length ||
          normalized.history?.length ||
          normalized.historyCollapsed
        ) {
          leagues[league] = normalized;
        }
      }
      return { version: LINK_FAVORITES_VERSION, leagues };
    };

    const sortImportedEntries = (entries, indexKey) =>
      entries
        .map((entry, position) => ({ entry, position, index: Number(entry?.[indexKey]) }))
        .sort((left, right) => {
          const leftIndex = Number.isFinite(left.index) ? left.index : left.position;
          const rightIndex = Number.isFinite(right.index) ? right.index : right.position;
          return leftIndex - rightIndex || left.position - right.position;
        })
        .map(({ entry, position }) => ({ entry, position }));

    const createExternalLinkFavoriteBookmark = (link, index) => ({
      id: link.id,
      name: link.displayName,
      league: "Auto",
      poeVersion: "Poe2",
      endpoint: link.queryId,
      type: "search",
      idx: index,
      isDone: true
    });

    const exportExternalLinkFavorites = (storedState, leagueValue) => {
      const league = normalizeName(leagueValue);
      if (!league) {
        throw createLinkFavoriteError("missing_link_favorite_export_league", "A league is required");
      }
      const state = normalizeLinkFavoritesState(storedState);
      const leagueState = state.leagues[league];
      if (!leagueState) {
        return { folders: [], rootBookmarks: [] };
      }
      const linksById = new Map(leagueState.links.map((link) => [link.id, link]));
      const getBookmarks = (linkIds) =>
        (linkIds || [])
          .map((linkId) => linksById.get(linkId))
          .filter(Boolean)
          .map(createExternalLinkFavoriteBookmark);
      const folders = leagueState.folderOrder
        .map((folderId) => leagueState.folders.find((folder) => folder.id === folderId))
        .filter(Boolean)
        .map((folder, index) => ({
          id: folder.id,
          childIds: [],
          parentId: null,
          depth: 0,
          index,
          name: folder.name,
          bookmarks: getBookmarks(leagueState.folderLinkIds[folder.id]),
          isOpen: !folder.collapsed
        }));
      return { folders, rootBookmarks: getBookmarks(leagueState.rootLinkIds) };
    };

    const importExternalLinkFavorites = (storedState, sourceValue, destinationLeague, createdAt = Date.now()) => {
      const league = normalizeName(destinationLeague);
      if (!league) {
        throw createLinkFavoriteError("missing_link_favorite_import_league", "A destination league is required");
      }

      let source = sourceValue;
      if (typeof source === "string") {
        try {
          source = JSON.parse(source);
        } catch (error) {
          throw createLinkFavoriteError("invalid_link_favorite_import", "Import data is not valid JSON");
        }
      }
      if (!source || typeof source !== "object" || !Array.isArray(source.folders)) {
        throw createLinkFavoriteError("invalid_link_favorite_import", "Import data does not contain folders");
      }

      const next = normalizeLinkFavoritesState(storedState);
      const leagueState = next.leagues[league] || {
        folders: [],
        folderOrder: [],
        links: [],
        rootLinkIds: [],
        folderLinkIds: {}
      };
      next.leagues[league] = leagueState;

      const folderIds = new Set(leagueState.folders.map((folder) => folder.id));
      const linkIds = new Set(leagueState.links.map((link) => link.id));
      let importedFolders = 0;
      let importedLinks = 0;
      let skippedLinks = 0;

      const importBookmark = (rawBookmark, bookmarkPosition, folderId, fallbackId) => {
        if (String(rawBookmark?.poeVersion || "").toLowerCase() !== "poe2" || rawBookmark?.type !== "search") {
          skippedLinks += 1;
          return;
        }
        const sourceBookmarkId = normalizeId(rawBookmark?.id) || fallbackId;
        const prefixedId = sourceBookmarkId.startsWith("import-link-")
          ? sourceBookmarkId
          : `import-link-${sourceBookmarkId}`;
        const linkId = linkIds.has(sourceBookmarkId) ? sourceBookmarkId : prefixedId;
        if (linkIds.has(linkId)) {
          skippedLinks += 1;
          return;
        }
        const endpoint = normalizeId(rawBookmark?.endpoint);
        const displayName = normalizeName(rawBookmark?.name);
        if (!endpoint || !displayName) {
          skippedLinks += 1;
          return;
        }
        try {
          const record = createLinkFavoriteRecord({
            id: linkId,
            displayName,
            folderId,
            createdAt,
            url: `https://www.pathofexile.com/trade2/search/poe2/${encodeURIComponent(league)}/${encodeURIComponent(endpoint)}`
          });
          leagueState.links.push(record);
          const targetLinkIds = folderId ? leagueState.folderLinkIds[folderId] : leagueState.rootLinkIds;
          targetLinkIds.push(record.id);
          linkIds.add(record.id);
          importedLinks += 1;
        } catch (error) {
          skippedLinks += 1;
        }
      };

      for (const { entry: rawFolder, position: folderPosition } of sortImportedEntries(source.folders, "index")) {
        const folderName = normalizeName(rawFolder?.name);
        if (!folderName) {
          skippedLinks += Array.isArray(rawFolder?.bookmarks) ? rawFolder.bookmarks.length : 0;
          continue;
        }
        const rawFolderId = normalizeId(rawFolder?.id) || `folder-${folderPosition}`;
        const importedFolderId = rawFolderId.startsWith("import-folder-") ? rawFolderId : `import-folder-${rawFolderId}`;
        const folderId = folderIds.has(rawFolderId) ? rawFolderId : importedFolderId;
        if (!folderIds.has(folderId)) {
          leagueState.folders.push({
            id: folderId,
            name: folderName,
            createdAt: normalizeTimestamp(createdAt, Date.now()),
            collapsed: rawFolder?.isOpen === false
          });
          leagueState.folderOrder.push(folderId);
          leagueState.folderLinkIds[folderId] = [];
          folderIds.add(folderId);
          importedFolders += 1;
        }

        if (!leagueState.folderLinkIds[folderId]) {
          leagueState.folderLinkIds[folderId] = [];
        }

        for (const { entry: rawBookmark, position: bookmarkPosition } of sortImportedEntries(rawFolder?.bookmarks || [], "idx")) {
          importBookmark(rawBookmark, bookmarkPosition, folderId, `${rawFolderId}-${bookmarkPosition}`);
        }
      }

      for (const { entry: rawBookmark, position: bookmarkPosition } of sortImportedEntries(source.rootBookmarks || [], "idx")) {
        importBookmark(rawBookmark, bookmarkPosition, null, `root-${bookmarkPosition}`);
      }

      return {
        state: normalizeLinkFavoritesState(next),
        importedFolders,
        importedLinks,
        skippedLinks
      };
    };

    return {
      createEmptyLinkFavoritesState,
      createLinkFavoriteId,
      createLinkFavoriteRecord,
      exportExternalLinkFavorites,
      formatLinkFavoriteFilterRange,
      formatLinkFavoriteStatFilter,
      importExternalLinkFavorites,
      normalizeLinkFavoriteFilterGroups,
      normalizeLinkFavoriteDisplaySnapshot,
      normalizeLinkFavoriteHistory,
      normalizeLinkFavoritesState,
      upsertLinkFavoriteHistory,
      validateTradeSearchUrl
    };
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
      for (const [sourceKey, sourceMods] of Object.entries(item)) {
        if (!sourceKey.endsWith("Mods") || !Array.isArray(sourceMods)) {
          continue;
        }
        modifiers[sourceKey] = sourceMods.map((mod, index) => mod?.hash || getExtendedModifierHash(item, sourceKey, index));
      }
      if (!Array.isArray(item.skillMods) && Array.isArray(item.grantedSkills)) {
        modifiers.grantedSkills = item.grantedSkills.map((_, index) => getExtendedModifierHash(item, "skillMods", index));
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

    const setLabels = (nextLabels) => {
      Object.assign(labels, nextLabels || {});
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

    return { start, setEnabled, setFavorites, setLabels, handleApiMessage, storeResults };
  }

  globalThis[GLOBAL_NAME] = { createFavoriteTools, createFavoriteFeature, createLinkFavoriteTools };
})();
