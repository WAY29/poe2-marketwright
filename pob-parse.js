(function (root, factory) {
  const api = factory(
    typeof require === "function"
      ? { zlib: require("zlib"), fs: require("fs"), path: require("path") }
      : {}
  );
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.Poe2MarketwrightPobParse = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (node) {
  const NUMBER_RE = /([-+]?\d+(?:\.\d+)?)/g;
  const TAG_RE = /\{([a-zA-Z]+)\}/g;
  const SPEC_LINE_RE = /^([A-Za-z][A-Za-z ]*): (.+)$/;
  const FLAG_LINES = new Set(["Corrupted", "Twice Corrupted", "Mirrored", "Sanctified"]);
  const SPEC_KEYS = new Set([
    "unique id",
    "item level",
    "quality",
    "sockets",
    "rune",
    "levelreq",
    "implicits",
    "armour",
    "evasion",
    "energy shield",
    "ward",
    "spirit",
    "charm slots",
    "radius",
    "limited to",
    "note",
    "league",
    "catalyst",
    "catalystquality",
    "crafted",
    "prefix",
    "suffix",
    "variant",
    "selected variant",
    "has alt variant",
    "selected alt variant",
    "requires class",
    "class",
    "talisman tier",
    "cluster jewel skill",
    "cluster jewel node count"
  ]);
  const TAG_SOURCE_ORDER = ["rune", "enchant", "implicit", "fractured", "desecrated", "crafted", "skill"];

  function decodeBase64(code) {
    const cleaned = String(code || "")
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    if (!cleaned) {
      throw new Error("Empty PoB code");
    }
    const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
    if (typeof Buffer === "function") {
      return Buffer.from(padded, "base64");
    }
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function decodePobCode(code) {
    const bytes = decodeBase64(code);
    if (!node.zlib) {
      throw new Error("zlib is required to decode PoB codes synchronously");
    }
    try {
      return node.zlib.inflateSync(bytes).toString("utf8");
    } catch (error) {
      return node.zlib.inflateRawSync(bytes).toString("utf8");
    }
  }

  async function decodePobCodeAsync(code) {
    if (node.zlib) {
      return decodePobCode(code);
    }
    const bytes = decodeBase64(code);
    const decompress = async (format) => {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
      return new Response(stream).text();
    };
    try {
      return await decompress("deflate");
    } catch (error) {
      return decompress("deflate-raw");
    }
  }

  function decodeXmlEntities(text) {
    return String(text || "")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  function normalizeAffixKey(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\n+/g, " ")
      .replace(/[−–—]/g, "-")
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

  function extractNumbers(text) {
    return (String(text || "").match(NUMBER_RE) || []).map((value) => Number(value));
  }

  function polarityFlip(pattern) {
    if (pattern.includes("increased")) {
      return pattern.replaceAll("increased", "reduced");
    }
    if (pattern.includes("reduced")) {
      return pattern.replaceAll("reduced", "increased");
    }
    return null;
  }

  function isPolarityFlip(from, to) {
    return (
      (from.includes("increased") && to.includes("reduced")) ||
      (from.includes("reduced") && to.includes("increased"))
    );
  }

  function candidatePatterns(line) {
    const pattern = normalizeAffixKey(line);
    const keys = [pattern];
    const flipped = polarityFlip(pattern);
    if (flipped && flipped !== pattern) {
      keys.push(flipped);
    }
    if (String(line || "").toLowerCase().startsWith("bonded:")) {
      const stripped = normalizeAffixKey(String(line).slice(7));
      keys.push(stripped);
      const strippedFlip = polarityFlip(stripped);
      if (strippedFlip && strippedFlip !== stripped) {
        keys.push(strippedFlip);
      }
    }
    return keys;
  }

  function parseTagsAndLine(rawLine) {
    const tags = [];
    const line = String(rawLine || "")
      .replace(TAG_RE, (_, tag) => {
        tags.push(tag.toLowerCase());
        return "";
      })
      .trim();
    return { tags, line };
  }

  function preferredSource(tags, implicitBudget) {
    for (const tag of TAG_SOURCE_ORDER) {
      if (tags.includes(tag)) {
        return tag;
      }
    }
    return implicitBudget > 0 ? "implicit" : "explicit";
  }

  function parseNameLines(rarity, lines) {
    const first = lines[0] || "";
    if (rarity === "NORMAL" || rarity === "MAGIC") {
      return { name: first, title: "", consumed: first ? 1 : 0 };
    }
    const second = lines[1] || "";
    if (second && !SPEC_LINE_RE.test(second) && !FLAG_LINES.has(second) && !second.startsWith("{")) {
      return { name: first, title: first, baseHint: second, consumed: 2 };
    }
    return { name: first, title: first, consumed: first ? 1 : 0 };
  }

  function isModContinuation(line) {
    if (!line || FLAG_LINES.has(line) || line.startsWith("{")) {
      return false;
    }
    const spec = line.match(SPEC_LINE_RE);
    return !(spec && SPEC_KEYS.has(spec[1].toLowerCase()));
  }

  function parseItemText(raw, lookup) {
    const lines = decodeXmlEntities(raw)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const item = {
      rarity: "RARE",
      name: "",
      title: "",
      baseName: "",
      uniqueId: "",
      itemLevel: null,
      quality: null,
      sockets: "",
      runes: [],
      levelReq: null,
      implicitCount: 0,
      properties: {},
      corrupted: false,
      mirrored: false,
      sanctified: false,
      mods: []
    };
    if (!lines.length) {
      return item;
    }

    let index = 0;
    const rarityMatch = lines[0].match(/^Rarity:\s*(.+)$/i);
    if (rarityMatch) {
      item.rarity = rarityMatch[1].trim().toUpperCase();
      index = 1;
    }
    const names = parseNameLines(item.rarity, lines.slice(index));
    item.name = names.name;
    item.title = names.title || "";
    if (names.baseHint) {
      item.baseName = names.baseHint;
    }
    index += names.consumed;

    let implicitBudget = 0;
    let seenImplicitsHeader = false;
    while (index < lines.length) {
      const line = lines[index];
      index += 1;
      if (FLAG_LINES.has(line)) {
        if (line.includes("Corrupted")) {
          item.corrupted = true;
        }
        if (line === "Mirrored") {
          item.mirrored = true;
        }
        if (line === "Sanctified") {
          item.sanctified = true;
        }
        continue;
      }
      const spec = line.match(SPEC_LINE_RE);
      if (spec && SPEC_KEYS.has(spec[1].toLowerCase())) {
        const key = spec[1].toLowerCase();
        const value = spec[2].trim();
        if (key === "unique id") {
          item.uniqueId = value;
        } else if (key === "item level") {
          item.itemLevel = Number(value);
        } else if (key === "quality") {
          item.quality = Number(String(value).match(/-?\d+/)?.[0] || value);
        } else if (key === "sockets") {
          item.sockets = value;
        } else if (key === "rune") {
          item.runes.push(value);
        } else if (key === "levelreq") {
          item.levelReq = Number(value);
        } else if (key === "implicits") {
          item.implicitCount = Number(value) || 0;
          implicitBudget = item.implicitCount;
          seenImplicitsHeader = true;
          if (lookup) {
            const resolved = lookup.resolveBase(item);
            item.baseName = resolved.baseName || item.baseName;
            item.selection = resolved.selection || item.selection;
            item.uniqueType = resolved.uniqueType || item.uniqueType;
          }
        } else if (
          key === "armour" ||
          key === "evasion" ||
          key === "energy shield" ||
          key === "ward" ||
          key === "spirit" ||
          key === "charm slots" ||
          key === "radius" ||
          key === "limited to"
        ) {
          item.properties[key] = value;
        }
        continue;
      }
      if (!seenImplicitsHeader) {
        continue;
      }
      let parsed = parseTagsAndLine(line);
      if (!parsed.line) {
        continue;
      }
      const source = preferredSource(parsed.tags, implicitBudget);
      let mod = matchMod(parsed, source, lookup, item.selection?.id);
      if (!mod.matched && isModContinuation(lines[index])) {
        const joined = parseTagsAndLine(`${parsed.line} ${lines[index]}`);
        const joinedMod = matchMod(joined, source, lookup, item.selection?.id);
        if (joinedMod.matched) {
          parsed = joined;
          mod = joinedMod;
          index += 1;
        }
      }
      if (implicitBudget > 0) {
        implicitBudget -= 1;
      }
      item.mods.push(mod);
    }

    if (lookup) {
      const resolved = lookup.resolveBase(item);
      item.baseName = resolved.baseName || item.baseName;
      item.selection = resolved.selection || null;
      item.uniqueType = resolved.uniqueType || null;
    }
    if (!item.baseName && item.name) {
      item.baseName = item.name;
    }
    if (item.title && item.baseName && item.rarity !== "NORMAL" && item.rarity !== "MAGIC") {
      item.name = `${item.title}, ${item.baseName}`;
    }
    return item;
  }

  function matchMod(parsed, source, lookup, pageId) {
    const values = extractNumbers(parsed.line);
    const pattern = normalizeAffixKey(parsed.line);
    let match = null;
    let flipped = false;
    if (lookup) {
      for (const key of candidatePatterns(parsed.line)) {
        match = lookup.matchStat(key, source, pageId);
        if (match) {
          flipped = isPolarityFlip(pattern, key);
          break;
        }
      }
    }
    return {
      raw: parsed.tags.length ? `{${parsed.tags.join("}{")}}${parsed.line}` : parsed.line,
      line: parsed.line,
      tags: parsed.tags,
      source,
      values: flipped ? values.map((value) => -value) : values,
      polarityFlipped: flipped,
      pattern: match?.pattern || pattern,
      statId: match?.statId || null,
      candidates: match?.candidates || [],
      matched: Boolean(match?.statId)
    };
  }

  function attributeValue(attrs, name) {
    return attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || "";
  }

  function extractXmlText(xml, tag) {
    return String(xml || "").match(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`))?.[0] || "";
  }

  function parseBuildMeta(xml) {
    const open = String(xml || "").match(/<Build\b([^>]*)>/);
    if (!open) {
      return {};
    }
    const attrs = open[1];
    return {
      className: attributeValue(attrs, "className"),
      ascendClassName: attributeValue(attrs, "ascendClassName"),
      level: Number(attributeValue(attrs, "level") || 0) || null,
      mainSocketGroup: Number(attributeValue(attrs, "mainSocketGroup") || 0) || null
    };
  }

  function parseItemSets(xml) {
    const sets = [];
    const re = /<ItemSet\b([^>]*)>([\s\S]*?)<\/ItemSet>/g;
    let match;
    while ((match = re.exec(xml))) {
      const slots = [];
      const slotRe = /<Slot\b([^>]*)\/?>/g;
      let slotMatch;
      while ((slotMatch = slotRe.exec(match[2]))) {
        const itemId = Number(attributeValue(slotMatch[1], "itemId") || 0);
        if (!itemId) {
          continue;
        }
        slots.push({
          name: attributeValue(slotMatch[1], "name"),
          itemId,
          active: attributeValue(slotMatch[1], "active") === "true"
        });
      }
      sets.push({
        id: Number(attributeValue(match[1], "id") || 0),
        title: attributeValue(match[1], "title") || "Default",
        useSecondWeaponSet: attributeValue(match[1], "useSecondWeaponSet") === "true",
        slots
      });
    }
    return sets;
  }

  function parseItemsXml(xml, lookup) {
    const items = [];
    const re = /<Item\b([^>]*)>([\s\S]*?)<\/Item>/g;
    let match;
    while ((match = re.exec(xml))) {
      const raw = match[2].replace(/<[^>]+>/g, "").replace(/^\s+|\s+$/g, "");
      const item = parseItemText(raw, lookup);
      item.id = Number(attributeValue(match[1], "id") || 0);
      items.push(item);
    }
    return items;
  }

  function attachSlots(items, itemSets) {
    const byId = new Map(items.map((item) => [item.id, item]));
    for (const item of items) {
      item.slots = [];
    }
    for (const set of itemSets) {
      for (const slot of set.slots) {
        const item = byId.get(slot.itemId);
        if (item) {
          item.slots.push({ setId: set.id, setTitle: set.title, name: slot.name });
        }
      }
    }
  }

  function createLookup(data) {
    const stats = data?.displayMetadata?.stats || {};
    const byPattern = new Map();
    for (const [statId, record] of Object.entries(stats)) {
      const en = record && typeof record === "object" ? record.en : "";
      const key = normalizeAffixKey(en);
      if (!key) {
        continue;
      }
      const source = String(statId).split(".")[0];
      let bucket = byPattern.get(key);
      if (!bucket) {
        bucket = { all: [], bySource: new Map() };
        byPattern.set(key, bucket);
      }
      bucket.all.push(statId);
      if (!bucket.bySource.has(source)) {
        bucket.bySource.set(source, []);
      }
      bucket.bySource.get(source).push(statId);
    }

    const itemNames = new Map();
    const addName = (name, extra) => {
      const key = String(name || "").trim().toLowerCase();
      if (!key) {
        return;
      }
      itemNames.set(key, { ...(itemNames.get(key) || {}), name: String(name), ...extra });
    };
    for (const [name, selection] of Object.entries(data?.itemNameToSelection || {})) {
      addName(name, { selection });
    }
    for (const [name, page] of Object.entries(data?.itemNameToPage || {})) {
      addName(name, { page });
    }
    for (const name of Object.keys(data?.displayMetadata?.items || {})) {
      addName(name, { name });
    }
    const uniqueTypes = new Map(
      Object.entries(data?.uniqueItemTypeByName || {}).map(([key, value]) => [key.toLowerCase(), value])
    );
    const sortedNames = [...itemNames.keys()].sort((left, right) => right.length - left.length);
    const pageStatIds = new Map();
    const pageHashes = new Map();
    for (const [page, groups] of Object.entries(data?.affixEffectsByPage || {})) {
      const ids = new Set();
      const hashes = new Set();
      for (const list of Object.values(groups || {})) {
        if (Array.isArray(list)) {
          for (const id of list) {
            ids.add(id);
            hashes.add(String(id).split(".").slice(1).join("."));
          }
        }
      }
      pageStatIds.set(page, ids);
      pageHashes.set(page, hashes);
    }
    const logicalPages = new Map();
    for (const [logicalId, spec] of Object.entries(data?.logicalCategories || {})) {
      const slugs = (spec?.pageSlugs || []).filter((slug) => pageStatIds.has(slug));
      if (slugs.length) {
        logicalPages.set(logicalId, slugs);
      }
    }

    const statHash = (statId) => String(statId).split(".").slice(1).join(".");
    const pickFromBucket = (bucket, source, key) => {
      if (!bucket) {
        return null;
      }
      const preferred = (source && bucket.bySource.get(source)) || [];
      return {
        pattern: key,
        statId: preferred[0] || bucket.all[0] || null,
        candidates: bucket.all.slice()
      };
    };
    const pickSourceId = (bucket, source, hash) => {
      const wanted = `${source}.${hash}`;
      if (bucket.bySource.get(source)?.includes(wanted)) {
        return wanted;
      }
      return bucket.all.find((id) => statHash(id) === hash) || null;
    };
    const pagesFor = (pageId) => {
      if (pageStatIds.has(pageId)) {
        return [pageId];
      }
      return logicalPages.get(pageId) || [];
    };
    const variantOnPage = (page, bucket, source) => {
      if (!bucket) {
        return { sourceId: null, hash: null };
      }
      const ids = pageStatIds.get(page);
      const hashes = pageHashes.get(page);
      const sourceHit = ((source && bucket.bySource.get(source)) || []).find((id) => ids?.has(id));
      if (sourceHit) {
        return { sourceId: sourceHit, hash: statHash(sourceHit) };
      }
      const hashHit = bucket.all.find((id) => hashes?.has(statHash(id)));
      return { sourceId: null, hash: hashHit ? statHash(hashHit) : null };
    };
    const chooseLocal = (localBucket, globalBucket, source, pageId) => {
      const pages = pagesFor(pageId);
      if (!pages.length) {
        return { useLocal: false, hash: null };
      }
      const sourceRows = [];
      const hashRows = [];
      for (const page of pages) {
        const local = variantOnPage(page, localBucket, source);
        const global = variantOnPage(page, globalBucket, source);
        if (local.sourceId || global.sourceId) {
          sourceRows.push({ local, global });
        }
        if (local.hash || global.hash) {
          hashRows.push({ local, global });
        }
      }
      const rows = sourceRows.length ? sourceRows : hashRows;
      if (!rows.length) {
        return { useLocal: false, hash: null };
      }
      const localOf = (row) => (sourceRows.length ? row.local.sourceId : row.local.hash);
      const globalOf = (row) => (sourceRows.length ? row.global.sourceId : row.global.hash);
      const localHash = rows.find((row) => row.local.hash)?.local.hash || null;
      const globalHash = rows.find((row) => row.global.hash)?.global.hash || null;
      if (rows.every((row) => localOf(row)) && localHash) {
        return { useLocal: true, hash: localHash };
      }
      return { useLocal: false, hash: globalHash };
    };

    return {
      matchStat(pattern, source, pageId) {
        const exactLocal = /\(local\)$/.test(pattern);
        const base = pattern.replace(/\s*\(local\)$/i, "").trim();
        const keys = [pattern];
        if (/s$/.test(pattern)) {
          keys.push(pattern.replace(/s$/, ""));
        }
        if (exactLocal) {
          for (const key of keys) {
            const match = pickFromBucket(byPattern.get(key), source, key);
            if (match) {
              return match;
            }
          }
          return null;
        }
        const localKey = `${base} (local)`;
        const globalBucket = byPattern.get(base);
        const localBucket = byPattern.get(localKey);
        if (!localBucket) {
          for (const key of keys) {
            const match = pickFromBucket(byPattern.get(key), source, key);
            if (match) {
              return match;
            }
          }
          return null;
        }
        const chosen = chooseLocal(localBucket, globalBucket, source, pageId);
        if (chosen.hash) {
          const bucket = chosen.useLocal ? localBucket : globalBucket;
          const statId = pickSourceId(bucket, source, chosen.hash);
          if (statId) {
            return {
              pattern: chosen.useLocal ? localKey : base,
              statId,
              candidates: bucket.all.slice()
            };
          }
        }
        return pickFromBucket(globalBucket, source, base) || pickFromBucket(localBucket, source, localKey);
      },
      resolveBase(item) {
        const title = (item.title || "").toLowerCase();
        const hinted = (item.baseName || "").toLowerCase();
        const combined = `${title} ${hinted}`.trim();
        const uniqueType = uniqueTypes.get(combined) || uniqueTypes.get(title) || null;
        const uniqueBase = typeof uniqueType === "string" ? uniqueType.toLowerCase() : "";
        const candidates = [hinted, uniqueBase, (item.name || "").toLowerCase()].filter(Boolean);
        for (const candidate of candidates) {
          if (itemNames.has(candidate)) {
            const entry = itemNames.get(candidate);
            return {
              baseName: item.baseName || entry.name,
              selection: entry.selection || null,
              uniqueType
            };
          }
        }
        if (item.rarity === "NORMAL" || item.rarity === "MAGIC") {
          const haystack = (item.name || "").toLowerCase();
          for (const key of sortedNames) {
            if (haystack.includes(key)) {
              const entry = itemNames.get(key);
              return { baseName: entry.name, selection: entry.selection || null, uniqueType };
            }
          }
        }
        return { baseName: item.baseName, selection: null, uniqueType };
      }
    };
  }

  function parsePobXml(xml, data) {
    const lookup = data ? createLookup(data) : null;
    const itemSets = parseItemSets(extractXmlText(xml, "Items") || xml);
    const items = parseItemsXml(extractXmlText(xml, "Items") || xml, lookup);
    attachSlots(items, itemSets);
    return {
      build: parseBuildMeta(xml),
      items,
      itemSets
    };
  }

  function parsePobCode(code, data) {
    return parsePobXml(decodePobCode(code), data);
  }

  async function parsePobCodeAsync(code, data) {
    return parsePobXml(await decodePobCodeAsync(code), data);
  }

  async function previewPobBuild(code) {
    return parseBuildMeta(await decodePobCodeAsync(code));
  }

  function loadExtensionData(dataOrPath) {
    if (dataOrPath && typeof dataOrPath === "object") {
      return dataOrPath;
    }
    if (!node.fs || !node.path) {
      throw new Error("Filesystem access is required to load affix data");
    }
    const filePath = dataOrPath || node.path.join(__dirname, "data", "affix-filter-data.json");
    return JSON.parse(node.fs.readFileSync(filePath, "utf8"));
  }

  if (typeof require !== "undefined" && require.main === module) {
    const input = process.argv[2];
    if (!input) {
      console.error("Usage: node pob-parse.js <code-or-file>");
      process.exit(1);
    }
    const code = node.fs.existsSync(input) ? node.fs.readFileSync(input, "utf8") : input;
    const parsed = parsePobCode(code, loadExtensionData());
    const summary = {
      build: parsed.build,
      items: parsed.items.map((item) => ({
        id: item.id,
        rarity: item.rarity,
        name: item.name,
        baseName: item.baseName,
        selection: item.selection,
        slots: item.slots,
        corrupted: item.corrupted,
        mods: item.mods.map((mod) => ({
          line: mod.line,
          source: mod.source,
          statId: mod.statId,
          matched: mod.matched,
          values: mod.values
        }))
      }))
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }

  return {
    decodePobCode,
    decodePobCodeAsync,
    normalizeAffixKey,
    parseItemText,
    parsePobCode,
    parsePobCodeAsync,
    parseBuildMeta,
    previewPobBuild,
    createLookup,
    loadExtensionData
  };
});
