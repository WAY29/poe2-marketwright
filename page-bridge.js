(function () {
  if (window.__poe2MarketwrightPageBridgeLoaded) {
    return;
  }
  window.__poe2MarketwrightPageBridgeLoaded = true;

  const SOURCE = "poe2-marketwright";
  const UPDATE_TYPE = "POE2_MARKETWRIGHT_UPDATE";
  const READY_TYPE = "POE2_MARKETWRIGHT_READY";
  const STATE_TYPE = "POE2_MARKETWRIGHT_STATE";
  const NUMBER_RE = /([-+]?\d+(?:\.\d+)?)/g;
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

  const runtime = {
    app: null,
    originalKnownStats: null,
    lastPayload: {
      enabled: false,
      allowedKeys: [],
      allowedStatIds: []
    },
    lastFilterStats: null
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== SOURCE || event.data.type !== UPDATE_TYPE) {
      return;
    }

    runtime.lastPayload = event.data.payload || runtime.lastPayload;
    applyKnownStatsFilter();
    notifyState();
  });

  waitForTradeApp();
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
    return true;
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
    const allowedKeys = new Set(payload.allowedKeys || []);
    const allowedIds = new Set(payload.allowedStatIds || []);
    const shouldFilter = Boolean(payload.enabled && (allowedKeys.size > 0 || allowedIds.size > 0));
    const stats = {
      total: 0,
      kept: 0,
      hidden: 0,
      skipped: false
    };

    const nextKnownStats = runtime.originalKnownStats.map((group) => {
      const entries = Array.isArray(group.entries) ? group.entries : [];
      if (!shouldFilter || !FILTERABLE_STAT_GROUPS.has(group.id)) {
        return {
          ...group,
          entries: entries.slice()
        };
      }

      const filteredEntries = entries.filter((entry) => {
        stats.total += 1;
        const id = String(entry?.id || "");
        const key = normalizeStatKey(entry?.text || entry?.type || "");
        const keep = (id && allowedIds.has(id)) || (key && allowedKeys.has(key));
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
