(function () {
  const sessionId = new URLSearchParams(location.search).get("session") || "";
  const fallbackMessages = {
    favoritesFullViewTitle: "Favorites",
    favoritesPanelItems: "Items",
    favoritesPanelLinks: "Links",
    closeFavoritesFullView: "Close full favorites view",
    openFavoritesCompactView: "Use compact favorites view",
    favoritesPanelUnavailable: "Open a trade search result to view favorites for this league",
    favoritesSearch: "Search favorites",
    favoritesPanelSearchLinks: "Search bookmarks",
    favoritesEmpty: "No favorites in this league",
    favoritesNoMatches: "No matching favorites",
    favoritesPanelNoLinkMatches: "No matching bookmarks",
    linkFavoritesEmpty: "No saved bookmarks",
    favoriteMoreMods: "+$1 more",
    favoriteTooltipItem: "Item",
    favoriteTooltipBaseType: "Base type",
    favoriteTooltipCategory: "Category",
    favoriteTooltipRarity: "Rarity: $1",
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
    renameFavorite: "Rename favorite",
    deleteFavorite: "Delete favorite",
    undoFavoriteDelete: "Undo",
    favoriteDeleted: "Favorite deleted",
    favoriteFolderDeleted: "Folder deleted",
    createFavoriteFolder: "Create folder",
    renameFavoriteFolder: "Rename folder",
    deleteFavoriteFolder: "Delete folder",
    confirmDeleteFavoriteFolder: "Delete folder and $1 favorites",
    cancelFavoriteFolderDelete: "Cancel",
    moveFavorite: "Move favorite",
    moveFavoriteToRoot: "Top level",
    dropFavoriteAtRoot: "Drop here to move to the top level",
    dropFavoriteFolderAtTop: "Drop here to move folder to the top",
    reorderFavorite: "Drag to reorder favorite",
    reorderFavoriteFolder: "Drag to reorder folder",
    expandFavoriteFolder: "Expand folder",
    collapseFavoriteFolder: "Collapse folder",
    collapseAllFavoriteFolders: "Collapse all folders",
    expandAllFavoriteFolders: "Expand all folders",
    renameLinkFavorite: "Rename bookmark",
    moveLinkFavorite: "Move bookmark",
    deleteLinkFavorite: "Delete bookmark",
    renameLinkFavoriteFolder: "Rename folder",
    deleteLinkFavoriteFolder: "Delete folder",
    createLinkFavorite: "Save current search",
    createLinkFavoriteUnavailable: "Open a search result before saving",
    createLinkFavoriteFolder: "Create folder",
    importLinkFavorites: "Import bookmarks",
    exportLinkFavorites: "Export bookmarks to clipboard",
    importLinkFavoritesPlaceholder: "Paste exported bookmark JSON",
    confirmLinkFavoriteImport: "Import",
    cancelLinkFavoriteImport: "Cancel",
    confirmDeleteLinkFavoriteFolder: "Delete folder and $1 bookmarks",
    cancelLinkFavoriteFolderDelete: "Cancel",
    moveLinkFavoriteToRoot: "Top level",
    dropLinkFavoriteAtRoot: "Drop here to move to the top level",
    dropLinkFavoriteFolderAtTop: "Drop here to move folder to the top",
    reorderLinkFavorite: "Drag to reorder bookmark",
    reorderLinkFavoriteFolder: "Drag to reorder folder",
    expandLinkFavoriteFolder: "Expand folder",
    collapseLinkFavoriteFolder: "Collapse folder",
    collapseAllLinkFavoriteFolders: "Collapse all folders",
    expandAllLinkFavoriteFolders: "Expand all folders",
    linkHistory: "History",
    linkHistoryEmpty: "No search history",
    clearLinkHistory: "Clear history",
    confirmClearLinkHistory: "Clear $1 history entries?",
    linkFavoriteFolderNameRequired: "Folder name is required"
  };
  const icons = {
    edit: "M2.5 11.8V14h2.2l6.5-6.5-2.2-2.2-6.5 6.5zm10.2-6.2a.9.9 0 0 0 0-1.3L11.3 2.9a.9.9 0 0 0-1.3 0L9 4l2.2 2.2 1.5-1.5z",
    delete: "M4 4.5h8l-.6 9H4.6l-.6-9zm2-2h4l.6 1H13v1.5H3V3.5h2.4L6 2.5zm1 4v5h1.5v-5H7zm2.5 0v5H11v-5H9.5z",
    move: "M3 4h6V2l4 3-4 3V6H3V4zm10 8H7v2l-4-3 4-3v2h6v2z",
    bookmark: "M4 1.75h8a1 1 0 0 1 1 1v11.1l-5-2.85-5 2.85V2.75a1 1 0 0 1 1-1z",
    folderAdd: "M1.75 4.25h4l1.2 1.5h7.3v7.5H1.75v-9zm9.5 3v2h-2v1.5h2v2h1.5v-2h2V9.25h-2v-2h-1.5z",
    import: "M7.25 1.5h1.5v6.1l2.1-2.1 1.05 1.05L8 10.25 4.2 6.55l1.05-1.05 2 2V1.5zm-5.5 9.2h12.5v3.8H1.75v-3.8zm1.5 1.5v.8h9.5v-.8h-9.5z",
    export: "M8 1.5 4.25 5.25h2.35v4.5h2.8v-4.5h2.35L8 1.5zM1.75 10.5h12.5v4H1.75v-4zm1.5 1.5V13h9.5V12h-9.5z",
    collapse: "M3.2 2.5 8 7.3l4.8-4.8v2.15L8 9.45 3.2 4.65V2.5zm0 6.05L8 13.35l4.8-4.8v2.15L8 15.5 3.2 10.7V8.55z",
    expand: "M3.2 13.5 8 8.7l4.8 4.8v-2.15L8 6.55 3.2 11.35v2.15zm0-6.05L8 2.65l4.8 4.8V5.3L8 .5 3.2 5.3v2.15z",
    drag: "M6 3h1.5v1.5H6V3zm2.5 0H10v1.5H8.5V3zM6 7.25h1.5v1.5H6V7.25zm2.5 0H10v1.5H8.5V7.25zM6 11.5h1.5V13H6v-1.5zm2.5 0H10V13H8.5z"
  };
  const LINK_FAVORITE_TOOLTIP_SHOW_DELAY = 420;
  const LINK_FAVORITE_TOOLTIP_HIDE_DELAY = 180;
  const LINK_FAVORITE_TOOLTIP_DISMISS_DELAY = 100;
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
  const FAVORITES_PANEL_DRAG_TYPE = "application/x-poe2-marketwright-favorite-drag";

  const ui = {
    title: document.querySelector("#favorites-panel-title"),
    league: document.querySelector("#favorites-panel-league"),
    compact: document.querySelector("#favorites-panel-compact"),
    close: document.querySelector("#favorites-panel-close"),
    itemsTab: document.querySelector("#favorites-panel-items-tab"),
    linksTab: document.querySelector("#favorites-panel-links-tab"),
    content: document.querySelector("#favorites-panel-content"),
    tooltip: document.querySelector("#favorites-panel-tooltip")
  };
  const local = {
    state: null,
    messages: null,
    messageLanguage: null,
    tab: "items",
    itemSearch: "",
    linkSearch: "",
    editing: null,
    creatingFavoriteFolder: false,
    confirmingFavoriteFolderId: null,
    movingFavoriteSignature: null,
    creatingFolder: false,
    importing: false,
    confirmingFolderId: null,
    confirmingHistoryClear: false,
    movingLinkId: null,
    drag: null,
    panelHovered: false,
    tooltipShowTimer: null,
    tooltipHideTimer: null,
    tooltipDismissTimer: null,
    tooltipPointer: null
  };

  function t(key, substitutions = []) {
    const values = Array.isArray(substitutions) ? substitutions : [substitutions];
    const entry = local.messages?.[key];
    const message = entry?.message || globalThis.chrome?.i18n?.getMessage?.(key, values.map(String));
    const template = message || fallbackMessages[key] || key;
    const namedValues = entry?.placeholders || {};
    const withNamedSubstitutions = Object.entries(namedValues).reduce((text, [name, placeholder]) => {
      const index = Number(String(placeholder?.content || "").match(/^\$(\d+)$/)?.[1]);
      return Number.isInteger(index) && index > 0
        ? text.replaceAll(`$${name.toUpperCase()}$`, String(values[index - 1] ?? ""))
        : text;
    }, template);
    return values.reduce((text, value, index) => text.replaceAll(`$${index + 1}`, String(value)), withNamedSubstitutions);
  }

  async function loadMessages(language) {
    const locale = String(language || "").startsWith("zh_CN")
      ? "zh_CN"
      : String(language || "").startsWith("zh_TW")
        ? "zh_TW"
        : "en";
    if (local.messageLanguage === locale) {
      return;
    }
    local.messageLanguage = locale;
    try {
      const response = await fetch(globalThis.chrome?.runtime?.getURL?.(`_locales/${locale}/messages.json`));
      if (!response.ok) {
        throw new Error(`Unable to load ${locale} messages: ${response.status}`);
      }
      local.messages = await response.json();
    } catch (error) {
      local.messages = null;
      console.debug(`[PoE2 Marketwright] unable to load ${locale} messages`, error);
    }
  }

  function createElement(tagName, className, text = null) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text != null) {
      element.textContent = text;
    }
    return element;
  }

  function createIconButton(title, icon, className = "") {
    const button = createElement("button", `favorites-panel-action-button ${className}`.trim());
    button.type = "button";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${icon}"></path></svg>`;
    return button;
  }

  function makeTextButton(text, className = "") {
    const button = createElement("button", `favorites-panel-text-button ${className}`.trim(), text);
    button.type = "button";
    return button;
  }

  async function request(command, payload = {}) {
    const response = await chrome.runtime.sendMessage({
      type: "favorites-panel-request",
      sessionId,
      command,
      payload
    });
    if (!response?.ok) {
      throw new Error(response?.error || "favorites_panel_request_failed");
    }
    if (response.state) {
      await setState(response.state);
    }
    return response;
  }

  async function setState(nextState) {
    local.state = nextState;
    await loadMessages(nextState?.uiLanguage);
    local.tab = nextState?.favoritesPanelTab === "links" ? "links" : "items";
    render();
  }

  function render() {
    const state = local.state;
    const searchFocus = captureSearchFocus();
    hideLinkFavoriteTooltip();
    ui.title.textContent = t("favoritesFullViewTitle");
    ui.league.textContent = state?.available ? state.league : "";
    ui.league.title = state?.league || "";
    ui.compact.title = t("openFavoritesCompactView");
    ui.compact.setAttribute("aria-label", ui.compact.title);
    ui.close.title = t("closeFavoritesFullView");
    ui.close.setAttribute("aria-label", ui.close.title);
    ui.itemsTab.textContent = t("favoritesPanelItems");
    ui.linksTab.textContent = t("favoritesPanelLinks");
    ui.itemsTab.setAttribute("aria-selected", String(local.tab === "items"));
    ui.linksTab.setAttribute("aria-selected", String(local.tab === "links"));
    ui.itemsTab.tabIndex = local.tab === "items" ? 0 : -1;
    ui.linksTab.tabIndex = local.tab === "links" ? 0 : -1;
    ui.content.replaceChildren();

    if (!state?.available) {
      ui.content.appendChild(createElement("p", "favorites-panel-unavailable", t("favoritesPanelUnavailable")));
      return;
    }
    ui.content.appendChild(local.tab === "links" ? renderLinks(state) : renderItems(state));
    restoreSearchFocus(searchFocus);
  }

  function captureSearchFocus() {
    const search = document.activeElement;
    if (!search?.classList?.contains("favorites-panel-search")) {
      return null;
    }
    return {
      tab: local.tab,
      selectionStart: Number.isInteger(search.selectionStart) ? search.selectionStart : null,
      selectionEnd: Number.isInteger(search.selectionEnd) ? search.selectionEnd : null
    };
  }

  function restoreSearchFocus(focus) {
    if (!focus || focus.tab !== local.tab) {
      return;
    }
    const search = ui.content?.querySelector(".favorites-panel-search");
    if (!search) {
      return;
    }
    search.focus({ preventScroll: true });
    if (Number.isInteger(focus.selectionStart) && Number.isInteger(focus.selectionEnd)) {
      search.setSelectionRange?.(focus.selectionStart, focus.selectionEnd);
    }
  }

  function makeSearch(value, placeholder, onInput) {
    const search = createElement("input", "favorites-panel-search");
    search.type = "search";
    search.autocomplete = "off";
    search.spellcheck = false;
    search.value = value;
    search.placeholder = placeholder;
    search.setAttribute("aria-label", placeholder);
    search.addEventListener("input", () => onInput(search.value));
    return search;
  }

  function getFavoriteModifierPresentation(modifier) {
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

  function getFavoriteTooltipLink(favorite) {
    const name = favorite?.displayName || favorite?.originalName || favorite?.baseName || "";
    const baseName = favorite?.baseName || "";
    const itemValues = [
      name && { text: name, heading: true },
      baseName && baseName !== name && `${t("favoriteTooltipBaseType")}: ${baseName}`,
      (favorite?.itemType || favorite?.category) &&
        `${t("favoriteTooltipCategory")}: ${favorite.itemType || favorite.category}`,
      t("favoriteTooltipRarity", String(favorite?.rarity || "").toUpperCase())
    ].filter(Boolean);
    const modifiers = (favorite?.mods || [])
      .map(getFavoriteModifierPresentation)
      .filter((modifier) => modifier.text)
      .map((modifier) => (modifier.source ? modifier : modifier.text));
    return {
      filterGroups: [
        ...(itemValues.length ? [{ label: t("favoriteTooltipItem"), hideLabel: true, values: itemValues }] : []),
        ...(modifiers.length ? [{ label: t("favoriteTooltipModifiers"), values: modifiers }] : [])
      ]
    };
  }

  function renderItems(state) {
    const root = createElement("div");
    const toolbar = createElement("div", "favorites-panel-toolbar");
    const results = createElement("div", "favorites-panel-results");
    toolbar.appendChild(
      makeSearch(local.itemSearch, t("favoritesSearch"), (value) => {
        local.itemSearch = value;
        renderItemResults(state, results);
      })
    );
    const createFolder = createIconButton(t("createFavoriteFolder"), icons.folderAdd);
    createFolder.disabled = !state.favoritesEnabled;
    createFolder.addEventListener("click", () => {
      local.creatingFavoriteFolder = true;
      render();
    });
    const folders = state.favoriteFolders?.folders || [];
    const allCollapsed = folders.length > 0 && folders.every((folder) => folder.collapsed);
    const collapseAll = createIconButton(
      t(allCollapsed ? "expandAllFavoriteFolders" : "collapseAllFavoriteFolders"),
      allCollapsed ? icons.expand : icons.collapse
    );
    collapseAll.disabled = !state.favoritesEnabled || folders.length === 0;
    collapseAll.addEventListener("click", () => run("toggle-all-favorite-folders"));
    toolbar.append(createFolder, collapseAll);
    root.append(toolbar, results);
    renderItemResults(state, results);
    return root;
  }

  function renderItemResults(state, root) {
    root.replaceChildren();
    if (state.deletedFavorite) {
      const feedback = createElement("div", "favorites-panel-feedback");
      feedback.appendChild(createElement("span", "", t(state.deletedFavorite.kind === "folder" ? "favoriteFolderDeleted" : "favoriteDeleted")));
      const undo = makeTextButton(t("undoFavoriteDelete"));
      undo.addEventListener("click", () => run("undo-favorite"));
      feedback.appendChild(undo);
      root.appendChild(feedback);
    }
    if (local.creatingFavoriteFolder) {
      const input = createElement("input", "favorites-panel-folder-input");
      input.type = "text";
      input.placeholder = t("createFavoriteFolder");
      input.setAttribute("aria-label", t("createFavoriteFolder"));
      let cancelled = false;
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
        if (event.key === "Escape") {
          cancelled = true;
          local.creatingFavoriteFolder = false;
          render();
        }
      });
      input.addEventListener("blur", () => {
        local.creatingFavoriteFolder = false;
        if (cancelled || !input.value.trim()) {
          render();
          return;
        }
        run("create-favorite-folder", { name: input.value });
      }, { once: true });
      root.appendChild(input);
      window.setTimeout(() => input.focus(), 0);
    }
    const query = local.itemSearch.trim().toLocaleLowerCase();
    const matches = (favorite) => !query || [
        ...(favorite.searchTerms || []),
        favorite.displayName,
        favorite.baseName,
        favorite.itemType,
        favorite.rarity,
        ...(favorite.mods || []).map((mod) => mod?.text)
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query));
    const folders = state.favoriteFolders?.folders || [];
    const rootFavorites = getFavoritesForFolder(state, null).filter(matches);
    const rootList = createElement("div", "favorites-panel-link-list favorites-panel-root");
    setGroupDropTarget(rootList, null, "favorite");
    if (rootFavorites.length) {
      for (const favorite of rootFavorites) {
        rootList.appendChild(renderFavoriteRow(state, favorite, null));
      }
    } else if (!folders.length) {
      rootList.appendChild(createElement("p", "favorites-panel-empty", query ? t("favoritesNoMatches") : t("favoritesEmpty")));
    }
    rootList.appendChild(createElement("div", "favorites-panel-root-drop-area", t("dropFavoriteAtRoot")));
    const folderList = createElement("div", "favorites-panel-list");
    if (folders.length) {
      const folderTopDropArea = createElement("div", "favorites-panel-folder-top-drop-area", t("dropFavoriteFolderAtTop"));
      setFolderTopDropTarget(folderTopDropArea, folders, "favorite-folder");
      folderList.appendChild(folderTopDropArea);
    }
    let visibleFolderCount = 0;
    for (const folder of folders) {
      const favorites = getFavoritesForFolder(state, folder.id).filter(matches);
      if (query && !favorites.length && !folder.name.toLocaleLowerCase().includes(query)) {
        continue;
      }
      folderList.appendChild(renderFavoriteFolder(state, folder, favorites));
      visibleFolderCount += 1;
    }
    if (!visibleFolderCount && query && !rootFavorites.length) {
      folderList.appendChild(createElement("p", "favorites-panel-empty", t("favoritesNoMatches")));
    }
    root.append(folderList, rootList);
  }

  function getFavoritesForFolder(state, folderId) {
    const ids = folderId
      ? state.favoriteFolders?.folderFavoriteSignatures?.[folderId] || []
      : state.favoriteFolders?.rootFavoriteSignatures || [];
    const favorites = state.favorites || [];
    return ids.map((signature) => favorites.find((favorite) => favorite.signature === signature)).filter(Boolean);
  }

  function renderFavoriteRow(state, favorite, folderId) {
    if (!favorite) {
      favorite = state;
      state = local.state || {};
      folderId = null;
    }
    const editing = local.editing?.kind === "favorite" && local.editing.id === favorite.signature;
    const row = createElement("article", "favorites-panel-item-row favorites-panel-link-row");
    setDropTarget(row, { kind: "favorite", id: favorite.signature, folderId });
    const drag = createIconButton(t("reorderFavorite"), icons.drag, "favorites-panel-drag-handle");
    setDragSource(drag, { kind: "favorite", id: favorite.signature, folderId });
    const launch = createElement(editing ? "div" : "button", "favorites-panel-item-launch");
    if (editing) {
      appendEditableName(
        launch,
        "favorite",
        favorite.signature,
        favorite.displayName || favorite.baseName || "",
        (name) => run("rename-favorite", { signature: favorite.signature, name })
      );
    } else {
      launch.type = "button";
      launch.setAttribute("aria-label", favorite.displayName || favorite.baseName || "");
      bindLinkFavoriteTooltip(launch, getFavoriteTooltipLink(favorite));
      launch.addEventListener("click", () => run("launch-favorite", { signature: favorite.signature }));
      appendEditableName(
        launch,
        "favorite",
        favorite.signature,
        favorite.displayName || favorite.baseName || "",
        (name) => run("rename-favorite", { signature: favorite.signature, name })
      );
      const time = Number(favorite.createdAt);
      if (Number.isFinite(time) && time > 0) {
        launch.appendChild(createElement("span", "favorites-panel-link-time", new Intl.DateTimeFormat().format(time)));
      }
      const visibleMods = (favorite.mods || []).slice(0, 3);
      for (const mod of visibleMods) {
        launch.appendChild(renderLinkFavoriteStat(getFavoriteModifierPresentation(mod)));
      }
      const moreCount = Math.max(0, (favorite.mods || []).length - visibleMods.length);
      if (moreCount) {
        launch.appendChild(createElement("span", "favorites-panel-more", t("favoriteMoreMods", moreCount)));
      }
    }
    const actions = createElement("div", "favorites-panel-row-actions");
    if (local.movingFavoriteSignature === favorite.signature) {
      const select = createElement("select", "favorites-panel-move-select");
      select.setAttribute("aria-label", t("moveFavorite"));
      const groups = [{ id: "", name: t("moveFavoriteToRoot") }].concat(
        (state.favoriteFolders?.folders || []).map((folder) => ({ id: folder.id, name: folder.name }))
      );
      for (const group of groups) {
        const option = createElement("option", "", group.name);
        option.value = group.id;
        option.selected = group.id === (folderId || "");
        select.appendChild(option);
      }
      select.addEventListener("change", () => run("move-favorite", { signature: favorite.signature, folderId: select.value || null }));
      select.addEventListener("blur", () => {
        local.movingFavoriteSignature = null;
        render();
      }, { once: true });
      actions.appendChild(select);
      window.setTimeout(() => select.focus(), 0);
    } else {
      const rename = createIconButton(t("renameFavorite"), icons.edit);
      rename.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        local.editing = { kind: "favorite", id: favorite.signature };
        notifyParentHover();
        render();
      });
      const move = createIconButton(t("moveFavorite"), icons.move);
      move.addEventListener("click", () => {
        local.movingFavoriteSignature = favorite.signature;
        render();
      });
      const remove = createIconButton(t("deleteFavorite"), icons.delete, "favorites-panel-delete");
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        run("delete-favorite", { signature: favorite.signature });
      });
      actions.append(rename, move, remove);
    }
    row.append(drag, launch, actions);
    return row;
  }

  function renderFavoriteFolder(state, folder, favorites) {
    const section = createElement("section", "favorites-panel-folder");
    const header = createElement("div", "favorites-panel-folder-header");
    setDropTarget(header, { kind: "favorite-folder", id: folder.id });
    setGroupDropTarget(header, folder.id, "favorite");
    const drag = createIconButton(t("reorderFavoriteFolder"), icons.drag, "favorites-panel-drag-handle");
    setDragSource(drag, { kind: "favorite-folder", id: folder.id });
    const collapse = createIconButton(
      t(folder.collapsed ? "expandFavoriteFolder" : "collapseFavoriteFolder"),
      folder.collapsed ? icons.expand : icons.collapse
    );
    collapse.setAttribute("aria-expanded", String(!folder.collapsed));
    collapse.addEventListener("click", () => run("toggle-favorite-folder", { folderId: folder.id, collapsed: !folder.collapsed }));
    const nameHost = createElement("div", "favorites-panel-folder-name");
    appendEditableName(nameHost, "favorite-folder", folder.id, folder.name || "", (name) => run("rename-favorite-folder", { folderId: folder.id, name }));
    const actions = createElement("div", "favorites-panel-folder-actions");
    const rename = createIconButton(t("renameFavoriteFolder"), icons.edit);
    rename.addEventListener("click", () => {
      local.editing = { kind: "favorite-folder", id: folder.id };
      notifyParentHover();
      render();
    });
    const remove = createIconButton(t("deleteFavoriteFolder"), icons.delete, "favorites-panel-delete");
    remove.addEventListener("click", () => {
      local.confirmingFavoriteFolderId = folder.id;
      render();
    });
    actions.append(rename, remove);
    header.append(drag, collapse, nameHost, actions);
    section.appendChild(header);
    if (!folder.collapsed) {
      const list = createElement("div", "favorites-panel-link-list");
      setGroupDropTarget(list, folder.id, "favorite");
      for (const favorite of favorites) {
        list.appendChild(renderFavoriteRow(state, favorite, folder.id));
      }
      section.appendChild(list);
    }
    if (local.confirmingFavoriteFolderId === folder.id) {
      const confirm = createElement("div", "favorites-panel-confirm");
      const count = getFavoritesForFolder(state, folder.id).length;
      confirm.appendChild(createElement("span", "", t("confirmDeleteFavoriteFolder", count)));
      const buttons = createElement("div", "favorites-panel-confirm-actions");
      const cancel = makeTextButton(t("cancelFavoriteFolderDelete"));
      cancel.addEventListener("click", () => {
        local.confirmingFavoriteFolderId = null;
        render();
      });
      const remove = makeTextButton(t("deleteFavoriteFolder"), "favorites-panel-confirm-delete");
      remove.addEventListener("click", () => run("delete-favorite-folder", { folderId: folder.id, confirm: true }));
      buttons.append(cancel, remove);
      confirm.appendChild(buttons);
      section.appendChild(confirm);
    }
    return section;
  }

  function appendEditableName(parent, kind, id, initialValue, save) {
    if (local.editing?.kind !== kind || local.editing.id !== id) {
      parent.appendChild(createElement("span", "favorites-panel-name", initialValue));
      return;
    }
    const input = createElement("input", "favorites-panel-rename-input");
    input.type = "text";
    input.value = initialValue;
    input.setAttribute(
      "aria-label",
      t(kind === "folder" ? "renameLinkFavoriteFolder" : kind === "favorite-folder" ? "renameFavoriteFolder" : kind === "link" ? "renameLinkFavorite" : "renameFavorite")
    );
    let finished = false;
    const finishEditing = () => {
      local.editing = null;
      notifyParentHover();
    };
    const commit = () => {
      if (finished) {
        return;
      }
      finished = true;
      finishEditing();
      const value = input.value.trim();
      if (value && value !== initialValue) {
        void save(value);
      } else {
        render();
      }
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
      if (event.key === "Escape") {
        finished = true;
        finishEditing();
        render();
      }
    });
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("mousedown", (event) => event.stopPropagation());
    input.addEventListener("blur", commit, { once: true });
    parent.appendChild(input);
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  function renderLinks(state) {
    const root = createElement("div");
    const toolbar = createElement("div", "favorites-panel-toolbar");
    const results = createElement("div", "favorites-panel-results");
    toolbar.appendChild(
      makeSearch(local.linkSearch, t("favoritesPanelSearchLinks"), (value) => {
        local.linkSearch = value;
        renderLinkResults(state, results);
      })
    );
    const saveRoot = createIconButton(
      state.canSaveCurrentLink ? t("createLinkFavorite") : t("createLinkFavoriteUnavailable"),
      icons.bookmark
    );
    saveRoot.disabled = !state.canSaveCurrentLink || !state.linkFavoritesEnabled;
    saveRoot.addEventListener("click", () => run("save-link"));
    const createFolder = createIconButton(t("createLinkFavoriteFolder"), icons.folderAdd);
    createFolder.disabled = !state.linkFavoritesEnabled;
    createFolder.addEventListener("click", () => {
      local.creatingFolder = true;
      render();
    });
    const importButton = createIconButton(t("importLinkFavorites"), icons.import);
    importButton.disabled = !state.linkFavoritesEnabled;
    importButton.addEventListener("click", () => {
      local.importing = true;
      local.creatingFolder = false;
      render();
    });
    const exportButton = createIconButton(t("exportLinkFavorites"), icons.export);
    exportButton.disabled = !state.linkFavoritesEnabled;
    exportButton.addEventListener("click", () => run("export-links"));
    const folders = state.linkFavorites?.folders || [];
    const allCollapsed = folders.length > 0 && folders.every((folder) => folder.collapsed);
    const collapseAll = createIconButton(
      t(allCollapsed ? "expandAllLinkFavoriteFolders" : "collapseAllLinkFavoriteFolders"),
      allCollapsed ? icons.expand : icons.collapse
    );
    collapseAll.disabled = !state.linkFavoritesEnabled || folders.length === 0;
    collapseAll.addEventListener("click", () => run("toggle-all-folders"));
    toolbar.append(saveRoot, createFolder, importButton, exportButton, collapseAll);
    root.append(toolbar, results);
    renderLinkResults(state, results);
    return root;
  }

  function renderLinkResults(state, root) {
    root.replaceChildren();
    const folders = state.linkFavorites?.folders || [];
    if (state.feedback) {
      const feedback = createElement("div", "favorites-panel-feedback");
      feedback.dataset.state = state.feedback.state || "ready";
      feedback.appendChild(createElement("span", "", state.feedback.text || ""));
      if (state.deletedLinkCount) {
        const undo = makeTextButton(t("undoFavoriteDelete"));
        undo.addEventListener("click", () => run("undo-link"));
        feedback.appendChild(undo);
      }
      root.appendChild(feedback);
    }

    if (local.importing) {
      root.appendChild(renderImportForm());
      return;
    }
    if (local.creatingFolder) {
      const input = createElement("input", "favorites-panel-folder-input");
      input.type = "text";
      input.placeholder = t("createLinkFavoriteFolder");
      input.setAttribute("aria-label", t("createLinkFavoriteFolder"));
      let cancelled = false;
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
        if (event.key === "Escape") {
          cancelled = true;
          local.creatingFolder = false;
          render();
        }
      });
      input.addEventListener(
        "blur",
        () => {
          local.creatingFolder = false;
          if (cancelled || !input.value.trim()) {
            render();
            return;
          }
          run("create-folder", { name: input.value });
        },
        { once: true }
      );
      root.appendChild(input);
      window.setTimeout(() => input.focus(), 0);
    }

    const query = local.linkSearch.trim().toLocaleLowerCase();
    const rootLinks = getLinksForFolder(state, null).filter((link) => matchesLink(link, query));
    const rootList = createElement("div", "favorites-panel-link-list favorites-panel-root");
    setGroupDropTarget(rootList, null);
    if (rootLinks.length) {
      for (const link of rootLinks) {
        rootList.appendChild(renderLinkRow(state, link));
      }
    } else if (!folders.length) {
      rootList.appendChild(createElement("p", "favorites-panel-empty", t("linkFavoritesEmpty")));
    }
    rootList.appendChild(createElement("div", "favorites-panel-root-drop-area", t("dropLinkFavoriteAtRoot")));
    const folderList = createElement("div", "favorites-panel-list");
    if (folders.length) {
      const folderTopDropArea = createElement(
        "div",
        "favorites-panel-folder-top-drop-area",
        t("dropLinkFavoriteFolderAtTop")
      );
      setFolderTopDropTarget(folderTopDropArea, folders);
      folderList.appendChild(folderTopDropArea);
    }
    let visibleFolderCount = 0;
    for (const folder of folders) {
      const links = getLinksForFolder(state, folder.id).filter((link) => matchesLink(link, query));
      if (query && !links.length && !folder.name.toLocaleLowerCase().includes(query)) {
        continue;
      }
      folderList.appendChild(renderFolder(state, folder, links));
      visibleFolderCount += 1;
    }
    if (!visibleFolderCount && query && !rootLinks.length) {
      folderList.appendChild(createElement("p", "favorites-panel-empty", t("favoritesPanelNoLinkMatches")));
    }
    root.appendChild(folderList);
    root.appendChild(rootList);
    if (state.linkHistoryEnabled) {
      const history = renderHistory(state, query);
      root.appendChild(history);
      if (state.focusLinkHistory) {
        window.setTimeout(() => history.scrollIntoView?.({ block: "start" }), 0);
      }
    }
  }

  function renderImportForm() {
    const form = createElement("form", "favorites-panel-confirm");
    const textarea = createElement("textarea", "favorites-panel-import-input");
    textarea.placeholder = t("importLinkFavoritesPlaceholder");
    textarea.setAttribute("aria-label", t("importLinkFavorites"));
    textarea.spellcheck = false;
    const actions = createElement("div", "favorites-panel-confirm-actions");
    const cancel = makeTextButton(t("cancelLinkFavoriteImport"));
    cancel.type = "button";
    cancel.addEventListener("click", () => {
      local.importing = false;
      render();
    });
    const submit = makeTextButton(t("confirmLinkFavoriteImport"));
    submit.type = "submit";
    actions.append(cancel, submit);
    form.append(textarea, actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      run("import-links", { text: textarea.value }).finally(() => {
        local.importing = false;
      });
    });
    window.setTimeout(() => textarea.focus(), 0);
    return form;
  }

  function getLinksForFolder(state, folderId) {
    const ids = folderId ? state.linkFavorites?.folderLinkIds?.[folderId] || [] : state.linkFavorites?.rootLinkIds || [];
    const links = state.linkFavorites?.links || [];
    return ids.map((id) => links.find((link) => link.id === id)).filter(Boolean);
  }

  function matchesLink(link, query) {
    return !query || [
      link.displayName,
      link.url,
      link.localizedSnapshot?.type,
      link.localizedSnapshot?.category,
      link.localizedSnapshot?.rarity,
      ...(link.localizedSnapshot?.stats || []).map((stat) => stat?.text),
      ...(link.filterGroups || []).flatMap((group) => [group?.label, ...(group?.values || [])])
    ].some((value) => String(value || "").toLocaleLowerCase().includes(query));
  }

  function isLinkFavoriteStatFilterGroup(group) {
    const label = String(group?.label || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
    return label === "stat filters" || label === "stat filter" || label === "\u7be9\u9078\u5668" || label === "\u7b5b\u9009\u5668";
  }

  function getLinkFavoriteStatFilters(link) {
    if (Array.isArray(link?.localizedSnapshot?.stats) && link.localizedSnapshot.stats.length) {
      return link.localizedSnapshot.stats;
    }
    return (link.filterGroups || [])
      .filter(isLinkFavoriteStatFilterGroup)
      .flatMap((group) => group?.values || [])
      .filter(Boolean);
  }

  function formatLinkFavoriteStatFilter(value) {
    const formatter = globalThis.Poe2MarketwrightFavorites?.createLinkFavoriteTools?.().formatLinkFavoriteStatFilter;
    if (typeof formatter !== "function") {
      return { text: String(value || ""), source: null };
    }
    const formatted = formatter(value);
    return { ...formatted, source: getLocalizedFavoriteModifierSource(formatted.source) };
  }

  function getLinkFavoriteTooltipValue(value) {
    if (value && typeof value === "object" && "text" in value) {
      return {
        text: String(value.text || ""),
        source: getLocalizedFavoriteModifierSource(value.source),
        ...(value.heading ? { heading: true } : {}),
        ...(value.disabled ? { disabled: true } : {}),
        ...(Number.isFinite(Number(value.weight)) ? { weight: Number(value.weight) } : {})
      };
    }
    return { text: String(value || ""), source: null };
  }

  function formatLinkFavoriteRange(minimum, maximum) {
    const min = String(minimum ?? "").trim();
    const max = String(maximum ?? "").trim();
    return min || max ? `${min} - ${max}`.trim() : "";
  }

  function formatLinkFavoriteFilterGroupValue(value) {
    if (value && typeof value === "object" && "text" in value) {
      return getLinkFavoriteTooltipValue(value);
    }
    const formatter = globalThis.Poe2MarketwrightFavorites?.createLinkFavoriteTools?.().formatLinkFavoriteFilterRange;
    return {
      text: typeof formatter === "function" ? formatter(value) : String(value || ""),
      source: null
    };
  }

  function getLinkFavoriteStatGroupTooltipLabel(group) {
    const localizedLabel = String(group?.label || "").trim();
    if (localizedLabel) {
      return localizedLabel;
    }
    const type = String(group?.type || "and").trim().toLocaleLowerCase().replace(/[\s-]+/g, "_");
    const relation = {
      and: t("favoriteTooltipStatGroupAnd"),
      or: t("favoriteTooltipStatGroupOr"),
      count: t("favoriteTooltipStatGroupCount"),
      weighted: t("favoriteTooltipStatGroupWeighted"),
      not: t("favoriteTooltipStatGroupNot"),
      if: t("favoriteTooltipStatGroupIf")
    }[type] || type.toUpperCase().replaceAll("_", " ");
    const rawMin = group?.value?.min;
    const rawMax = group?.value?.max;
    const min = rawMin == null || rawMin === "" ? Number.NaN : Number(rawMin);
    const max = rawMax == null || rawMax === "" ? Number.NaN : Number(rawMax);
    const range = formatLinkFavoriteRange(Number.isFinite(min) ? min : "", Number.isFinite(max) ? max : "");
    return `${t("favoriteTooltipStatFilters")}: ${relation}${range ? ` (${range})` : ""}`;
  }

  function getLinkFavoriteStructuredStatGroups(snapshot) {
    return (snapshot?.statGroups || [])
      .map((group) => {
        const values = (group?.filters || [])
          .filter(Boolean)
          .map((value) => getLinkFavoriteTooltipValue(value))
          .filter((value) => value.text);
        return values.length ? { label: getLinkFavoriteStatGroupTooltipLabel(group), values } : null;
      })
      .filter(Boolean);
  }

  function getLinkFavoriteTooltipGroups(link) {
    const snapshot = link?.localizedSnapshot;
    const snapshotItemValues = [snapshot?.type, snapshot?.category, snapshot?.rarity]
      .filter(Boolean)
      .map((text) => ({ text, source: null }));
    const structuredStatGroups = getLinkFavoriteStructuredStatGroups(snapshot);
    return [
      ...(snapshotItemValues.length ? [{ label: t("favoriteTooltipItem"), values: snapshotItemValues }] : []),
      ...(link.filterGroups || [])
      .filter((group) => !structuredStatGroups.length || !isLinkFavoriteStatFilterGroup(group))
      .map((group) => {
        const label = String(group?.label || "").trim();
        const statFilters = isLinkFavoriteStatFilterGroup(group);
        const values = (group?.values || [])
          .filter(Boolean)
          .map((value) =>
            statFilters ? formatLinkFavoriteStatFilter(value) : formatLinkFavoriteFilterGroupValue(value)
          );
        return label && values.length ? { label, ...(group.hideLabel ? { hideLabel: true } : {}), values } : null;
      })
      .filter(Boolean),
      ...(structuredStatGroups.length
        ? structuredStatGroups
        : [])
    ];
  }

  function renderLinkFavoriteStat(stat, fallback = "", className = "") {
    const line = createElement("span", `favorites-panel-mod favorites-panel-link-stat ${className}`.trim());
    if (stat.source?.key && stat.source?.label) {
      line.appendChild(
        createElement(
          "span",
          `favorites-panel-link-stat-source favorites-panel-link-stat-source-${stat.source.key}`,
          stat.source.label
        )
      );
      line.appendChild(document.createTextNode(" "));
    }
    if (stat.disabled) {
      line.appendChild(createElement("span", "favorites-panel-link-favorite-stat-disabled", t("favoriteTooltipDisabled")));
      line.appendChild(document.createTextNode(" "));
    }
    if (Number.isFinite(Number(stat.weight))) {
      line.appendChild(
        createElement("span", "favorites-panel-link-favorite-stat-weight", t("favoriteTooltipWeight", stat.weight))
      );
      line.appendChild(document.createTextNode(" "));
    }
    line.appendChild(document.createTextNode(stat.text || fallback));
    return line;
  }

  function renderLinkFavoriteStatFilter(value) {
    if (value && typeof value === "object" && "text" in value) {
      return renderLinkFavoriteStat(value);
    }
    return renderLinkFavoriteStat(formatLinkFavoriteStatFilter(value), String(value || ""));
  }

  function renderLinkFavoriteTooltip(link) {
    const root = createElement("div", "favorites-panel-tooltip-content");
    for (const group of getLinkFavoriteTooltipGroups(link)) {
      const section = createElement("section", "favorites-panel-tooltip-group");
      if (group.label && !group.hideLabel) {
        section.appendChild(createElement("span", "favorites-panel-tooltip-group-label", group.label));
      }
      const values = createElement("div", "favorites-panel-tooltip-values");
      for (const value of group.values) {
        values.appendChild(
          value.source || value.disabled || Number.isFinite(Number(value.weight))
            ? renderLinkFavoriteStat(value, "", "favorites-panel-tooltip-stat")
            : createElement(
                "span",
                `favorites-panel-tooltip-value${value.heading ? " favorites-panel-tooltip-value-heading" : ""}`,
                value.text
              )
        );
      }
      section.appendChild(values);
      root.appendChild(section);
    }
    return root;
  }

  function clearLinkFavoriteTooltipShowTimer() {
    if (local.tooltipShowTimer) {
      window.clearTimeout(local.tooltipShowTimer);
      local.tooltipShowTimer = null;
    }
  }

  function clearLinkFavoriteTooltipHideTimer() {
    if (local.tooltipHideTimer) {
      window.clearTimeout(local.tooltipHideTimer);
      local.tooltipHideTimer = null;
    }
  }

  function clearLinkFavoriteTooltipDismissTimer() {
    if (local.tooltipDismissTimer) {
      window.clearTimeout(local.tooltipDismissTimer);
      local.tooltipDismissTimer = null;
    }
  }

  function clearLinkFavoriteTooltipTimers() {
    clearLinkFavoriteTooltipShowTimer();
    clearLinkFavoriteTooltipHideTimer();
    clearLinkFavoriteTooltipDismissTimer();
  }

  function hideLinkFavoriteTooltip() {
    clearLinkFavoriteTooltipShowTimer();
    clearLinkFavoriteTooltipHideTimer();
    if (!ui.tooltip) {
      return;
    }
    ui.tooltip.classList.remove("favorites-panel-tooltip-visible");
    ui.tooltip.setAttribute("aria-hidden", "true");
    clearLinkFavoriteTooltipDismissTimer();
    local.tooltipDismissTimer = window.setTimeout(() => {
      if (ui.tooltip.classList.contains("favorites-panel-tooltip-visible")) {
        return;
      }
      ui.tooltip.hidden = true;
      ui.tooltip.replaceChildren();
      local.tooltipDismissTimer = null;
    }, LINK_FAVORITE_TOOLTIP_DISMISS_DELAY);
  }

  function scheduleLinkFavoriteTooltipHide() {
    clearLinkFavoriteTooltipShowTimer();
    clearLinkFavoriteTooltipHideTimer();
    local.tooltipHideTimer = window.setTimeout(hideLinkFavoriteTooltip, LINK_FAVORITE_TOOLTIP_HIDE_DELAY);
  }

  function getLinkFavoriteTooltipPosition(pointer, tooltipRect, viewport) {
    const margin = 8;
    const gap = 12;
    const width = Math.max(0, Number(tooltipRect?.width) || 0);
    const height = Math.max(0, Number(tooltipRect?.height) || 0);
    const viewportWidth = Math.max(0, Number(viewport?.width) || 0);
    const viewportHeight = Math.max(0, Number(viewport?.height) || 0);
    const x = Number(pointer?.x) || 0;
    const y = Number(pointer?.y) || 0;
    const left = Math.min(Math.max(margin, x - width / 2), Math.max(margin, viewportWidth - width - margin));
    const aboveTop = y - height - gap;
    const belowTop = y + gap;
    const aboveFits = aboveTop >= margin;
    const belowFits = belowTop + height <= viewportHeight - margin;
    const placement = aboveFits || (!belowFits && y >= viewportHeight - y) ? "above" : "below";
    const desiredTop = placement === "above" ? aboveTop : belowTop;
    const top = Math.min(Math.max(margin, desiredTop), Math.max(margin, viewportHeight - height - margin));
    const arrowX = Math.min(Math.max(14, x - left), Math.max(14, width - 14));
    return {
      left: Math.round(left),
      top: Math.round(top),
      placement,
      arrowX: Math.round(arrowX)
    };
  }

  function getLinkFavoriteTooltipPointer(anchor) {
    if (local.tooltipPointer) {
      return local.tooltipPointer;
    }
    const rect = anchor.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top };
  }

  function showLinkFavoriteTooltip(anchor, link) {
    const groups = getLinkFavoriteTooltipGroups(link);
    if (!ui.tooltip || !groups.length) {
      return;
    }
    clearLinkFavoriteTooltipTimers();
    ui.tooltip.replaceChildren(renderLinkFavoriteTooltip(link));
    ui.tooltip.hidden = false;
    ui.tooltip.setAttribute("aria-hidden", "false");
    ui.tooltip.classList.remove("favorites-panel-tooltip-visible");
    ui.tooltip.style.visibility = "hidden";
    const tooltipRect = ui.tooltip.getBoundingClientRect();
    const position = getLinkFavoriteTooltipPosition(getLinkFavoriteTooltipPointer(anchor), tooltipRect, {
      width: window.innerWidth,
      height: window.innerHeight
    });
    ui.tooltip.style.left = `${position.left}px`;
    ui.tooltip.style.top = `${position.top}px`;
    ui.tooltip.style.setProperty("--favorites-panel-tooltip-arrow-x", `${position.arrowX}px`);
    ui.tooltip.dataset.placement = position.placement;
    ui.tooltip.style.visibility = "";
    window.requestAnimationFrame(() => {
      if (!ui.tooltip.hidden && ui.tooltip.getAttribute("aria-hidden") === "false") {
        ui.tooltip.classList.add("favorites-panel-tooltip-visible");
      }
    });
  }

  function scheduleLinkFavoriteTooltipShow(anchor, link, event) {
    clearLinkFavoriteTooltipShowTimer();
    clearLinkFavoriteTooltipHideTimer();
    clearLinkFavoriteTooltipDismissTimer();
    local.tooltipPointer = { x: event.clientX, y: event.clientY };
    local.tooltipShowTimer = window.setTimeout(() => {
      local.tooltipShowTimer = null;
      showLinkFavoriteTooltip(anchor, link);
    }, LINK_FAVORITE_TOOLTIP_SHOW_DELAY);
  }

  function bindLinkFavoriteTooltip(anchor, link) {
    if (!getLinkFavoriteTooltipGroups(link).length) {
      return;
    }
    anchor.setAttribute("aria-describedby", "favorites-panel-tooltip");
    anchor.addEventListener("pointerenter", (event) => scheduleLinkFavoriteTooltipShow(anchor, link, event));
    anchor.addEventListener("pointermove", (event) => {
      local.tooltipPointer = { x: event.clientX, y: event.clientY };
    });
    anchor.addEventListener("pointerleave", scheduleLinkFavoriteTooltipHide);
    anchor.addEventListener("focus", () => {
      local.tooltipPointer = null;
      showLinkFavoriteTooltip(anchor, link);
    });
    anchor.addEventListener("blur", hideLinkFavoriteTooltip);
  }

  function renderLinkRow(state, link) {
    const row = createElement("article", "favorites-panel-link-row");
    setDropTarget(row, { kind: "link", id: link.id, folderId: link.folderId || null });
    const editing = local.editing?.kind === "link" && local.editing.id === link.id;
    const drag = createIconButton(t("reorderLinkFavorite"), icons.drag, "favorites-panel-drag-handle");
    setDragSource(drag, { kind: "link", id: link.id, folderId: link.folderId || null });
    const launch = createElement(editing ? "div" : "button", "favorites-panel-link-launch");
    if (editing) {
      appendEditableName(launch, "link", link.id, link.displayName || "", (name) => run("rename-link", { linkId: link.id, name }));
    } else {
      launch.type = "button";
      launch.setAttribute("aria-label", link.displayName || "");
      bindLinkFavoriteTooltip(launch, link);
      launch.appendChild(createElement("span", "favorites-panel-name", link.displayName || ""));
      const time = Number(link.lastUsedAt || link.createdAt);
      if (Number.isFinite(time) && time > 0) {
        launch.appendChild(createElement("span", "favorites-panel-link-time", new Intl.DateTimeFormat().format(time)));
      }
      const statFilters = getLinkFavoriteStatFilters(link);
      for (const filter of statFilters.slice(0, 3)) {
        launch.appendChild(renderLinkFavoriteStatFilter(filter));
      }
      const moreCount = Math.max(0, statFilters.length - 3);
      if (moreCount) {
        launch.appendChild(createElement("span", "favorites-panel-more", t("favoriteMoreMods", moreCount)));
      }
      launch.addEventListener("click", () => run("open-link", { linkId: link.id }));
    }
    const actions = createElement("div", "favorites-panel-row-actions");
    if (local.movingLinkId === link.id) {
      const select = createElement("select", "favorites-panel-move-select");
      select.setAttribute("aria-label", t("moveLinkFavorite"));
      const groups = [{ id: "", name: t("moveLinkFavoriteToRoot") }].concat(
        (state.linkFavorites?.folders || []).map((folder) => ({ id: folder.id, name: folder.name }))
      );
      for (const group of groups) {
        const option = createElement("option", "", group.name);
        option.value = group.id;
        option.selected = group.id === (link.folderId || "");
        select.appendChild(option);
      }
      select.addEventListener("change", () => run("move-link", { linkId: link.id, folderId: select.value || null }));
      select.addEventListener("blur", () => {
        local.movingLinkId = null;
        render();
      }, { once: true });
      actions.appendChild(select);
      window.setTimeout(() => select.focus(), 0);
    } else {
      const rename = createIconButton(t("renameLinkFavorite"), icons.edit);
      rename.addEventListener("click", () => {
        local.editing = { kind: "link", id: link.id };
        notifyParentHover();
        render();
      });
      const move = createIconButton(t("moveLinkFavorite"), icons.move);
      move.addEventListener("click", () => {
        local.movingLinkId = link.id;
        render();
      });
      const remove = createIconButton(t("deleteLinkFavorite"), icons.delete, "favorites-panel-delete");
      remove.addEventListener("click", () => run("delete-link", { linkId: link.id }));
      actions.append(rename, move, remove);
    }
    row.append(drag, launch, actions);
    return row;
  }

  function renderHistoryRow(state, link) {
    const row = createElement("article", "favorites-panel-link-row favorites-panel-history-row");
    const launch = createElement("button", "favorites-panel-link-launch");
    launch.type = "button";
    launch.setAttribute("aria-label", link.displayName || "");
    bindLinkFavoriteTooltip(launch, link);
    launch.appendChild(createElement("span", "favorites-panel-name", link.displayName || ""));
    const time = Number(link.lastUsedAt || link.createdAt);
    if (Number.isFinite(time) && time > 0) {
      launch.appendChild(createElement("span", "favorites-panel-link-time", new Intl.DateTimeFormat().format(time)));
    }
    const statFilters = getLinkFavoriteStatFilters(link);
    for (const filter of statFilters.slice(0, 3)) {
      launch.appendChild(renderLinkFavoriteStatFilter(filter));
    }
    const moreCount = Math.max(0, statFilters.length - 3);
    if (moreCount) {
      launch.appendChild(createElement("span", "favorites-panel-more", t("favoriteMoreMods", moreCount)));
    }
    launch.addEventListener("click", () => run("open-history", { linkId: link.id }));
    const actions = createElement("div", "favorites-panel-row-actions");
    const save = createIconButton(t("createLinkFavorite"), icons.bookmark);
    save.disabled = !state.linkFavoritesEnabled;
    save.addEventListener("click", () => run("save-history", { linkId: link.id }));
    const remove = createIconButton(t("deleteLinkFavorite"), icons.delete, "favorites-panel-delete");
    remove.addEventListener("click", () => run("delete-history", { linkId: link.id }));
    actions.append(save, remove);
    row.append(launch, actions);
    return row;
  }

  function renderHistory(state, query) {
    const section = createElement("section", "favorites-panel-folder favorites-panel-history");
    const header = createElement("div", "favorites-panel-folder-header");
    const collapsed = Boolean(state.linkFavorites?.historyCollapsed);
    const collapse = createIconButton(
      t(collapsed ? "expandLinkFavoriteFolder" : "collapseLinkFavoriteFolder"),
      collapsed ? icons.expand : icons.collapse
    );
    collapse.setAttribute("aria-expanded", String(!collapsed));
    collapse.addEventListener("click", () => run("toggle-history", { collapsed: !collapsed }));
    const name = createElement("div", "favorites-panel-folder-name", t("linkHistory"));
    const actions = createElement("div", "favorites-panel-folder-actions");
    const clear = createIconButton(t("clearLinkHistory"), icons.delete, "favorites-panel-delete");
    const history = (state.linkFavorites?.history || []).filter((link) => matchesLink(link, query));
    clear.disabled = history.length === 0;
    clear.addEventListener("click", () => {
      local.confirmingHistoryClear = true;
      render();
    });
    actions.append(clear);
    header.append(collapse, name, actions);
    section.appendChild(header);
    if (!collapsed) {
      const list = createElement("div", "favorites-panel-link-list");
      if (history.length) {
        for (const link of history) {
          list.appendChild(renderHistoryRow(state, link));
        }
      } else {
        list.appendChild(createElement("p", "favorites-panel-empty", t(query ? "favoritesPanelNoLinkMatches" : "linkHistoryEmpty")));
      }
      section.appendChild(list);
    }
    if (local.confirmingHistoryClear) {
      const confirm = createElement("div", "favorites-panel-confirm");
      confirm.appendChild(createElement("span", "", t("confirmClearLinkHistory", (state.linkFavorites?.history || []).length)));
      const buttons = createElement("div", "favorites-panel-confirm-actions");
      const cancel = makeTextButton(t("cancelLinkFavoriteFolderDelete"));
      cancel.addEventListener("click", () => {
        local.confirmingHistoryClear = false;
        render();
      });
      const remove = makeTextButton(t("clearLinkHistory"), "favorites-panel-confirm-delete");
      remove.addEventListener("click", () => run("clear-history", { confirm: true }));
      buttons.append(cancel, remove);
      confirm.appendChild(buttons);
      section.appendChild(confirm);
    }
    return section;
  }

  function renderFolder(state, folder, links) {
    const section = createElement("section", "favorites-panel-folder");
    const header = createElement("div", "favorites-panel-folder-header");
    setDropTarget(header, { kind: "folder", id: folder.id });
    setGroupDropTarget(header, folder.id);
    const drag = createIconButton(t("reorderLinkFavoriteFolder"), icons.drag, "favorites-panel-drag-handle");
    setDragSource(drag, { kind: "folder", id: folder.id });
    const collapse = createIconButton(
      t(folder.collapsed ? "expandLinkFavoriteFolder" : "collapseLinkFavoriteFolder"),
      folder.collapsed ? icons.expand : icons.collapse
    );
    collapse.setAttribute("aria-expanded", String(!folder.collapsed));
    collapse.addEventListener("click", () => run("toggle-folder", { folderId: folder.id, collapsed: !folder.collapsed }));
    const nameHost = createElement("div", "favorites-panel-folder-name");
    appendEditableName(nameHost, "folder", folder.id, folder.name || "", (name) => run("rename-folder", { folderId: folder.id, name }));
    const actions = createElement("div", "favorites-panel-folder-actions");
    const save = createIconButton(
      state.canSaveCurrentLink ? t("createLinkFavorite") : t("createLinkFavoriteUnavailable"),
      icons.bookmark
    );
    save.disabled = !state.canSaveCurrentLink || !state.linkFavoritesEnabled;
    save.addEventListener("click", () => run("save-link", { folderId: folder.id }));
    const rename = createIconButton(t("renameLinkFavoriteFolder"), icons.edit);
    rename.addEventListener("click", () => {
      local.editing = { kind: "folder", id: folder.id };
      notifyParentHover();
      render();
    });
    const remove = createIconButton(t("deleteLinkFavoriteFolder"), icons.delete, "favorites-panel-delete");
    remove.addEventListener("click", () => {
      local.confirmingFolderId = folder.id;
      render();
    });
    actions.append(save, rename, remove);
    header.append(drag, collapse, nameHost, actions);
    section.appendChild(header);
    if (!folder.collapsed) {
      const list = createElement("div", "favorites-panel-link-list");
      setGroupDropTarget(list, folder.id);
      for (const link of links) {
        list.appendChild(renderLinkRow(state, link));
      }
      section.appendChild(list);
    }
    if (local.confirmingFolderId === folder.id) {
      const confirm = createElement("div", "favorites-panel-confirm");
      const count = getLinksForFolder(state, folder.id).length;
      confirm.appendChild(createElement("span", "", t("confirmDeleteLinkFavoriteFolder", count)));
      const buttons = createElement("div", "favorites-panel-confirm-actions");
      const cancel = makeTextButton(t("cancelLinkFavoriteFolderDelete"));
      cancel.addEventListener("click", () => {
        local.confirmingFolderId = null;
        render();
      });
      const remove = makeTextButton(t("confirmDeleteLinkFavoriteFolder", count), "favorites-panel-confirm-delete");
      remove.addEventListener("click", () => run("delete-folder", { folderId: folder.id, confirm: true }));
      buttons.append(cancel, remove);
      confirm.appendChild(buttons);
      section.appendChild(confirm);
    }
    return section;
  }

  function setDragSource(element, source) {
    element.draggable = true;
    element.setAttribute("draggable", "true");
    element.addEventListener("dragstart", (event) => {
      local.drag = source;
      ui.content?.classList.add("favorites-panel-drag-active", `favorites-panel-dragging-${source.kind}`);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(FAVORITES_PANEL_DRAG_TYPE, JSON.stringify(source));
        event.dataTransfer.setData("text/plain", JSON.stringify(source));
      }
      element.classList.add("favorites-panel-dragging");
      notifyParentHover();
    });
    element.addEventListener("dragend", () => {
      local.drag = null;
      ui.content?.classList.remove("favorites-panel-drag-active", `favorites-panel-dragging-${source.kind}`);
      element.classList.remove("favorites-panel-dragging");
      clearDragStyles();
      notifyParentHover();
    });
  }

  function getFavoritePanelDragSource(event) {
    if (local.drag) {
      return local.drag;
    }
    const raw = event.dataTransfer?.getData?.(FAVORITES_PANEL_DRAG_TYPE);
    if (!raw) {
      return null;
    }
    try {
      const source = JSON.parse(raw);
      if (!source || typeof source.id !== "string" || !source.id) {
        return null;
      }
      if (source.kind === "link") {
        return { kind: "link", id: source.id, folderId: source.folderId || null };
      }
      if (source.kind === "favorite") {
        return { kind: "favorite", id: source.id, folderId: source.folderId || null };
      }
      return source.kind === "folder" || source.kind === "favorite-folder" ? { kind: source.kind, id: source.id } : null;
    } catch (error) {
      return null;
    }
  }

  function clearDropPosition(element) {
    if (element.dataset) {
      delete element.dataset.dropPosition;
    }
  }

  function clearDragStyles() {
    document.querySelectorAll(".favorites-panel-drop-target").forEach((target) => {
      target.classList.remove("favorites-panel-drop-target");
      clearDropPosition(target);
    });
  }

  function getDropPosition(element, event) {
    const rect = element.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  }

  function setDropTarget(element, target) {
    element.addEventListener("dragover", (event) => {
      const source = getFavoritePanelDragSource(event);
      if (!source || source.kind !== target.kind || source.id === target.id) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      element.dataset.dropPosition = getDropPosition(element, event);
      element.classList.add("favorites-panel-drop-target");
    });
    element.addEventListener("dragleave", (event) => {
      if (!element.contains?.(event.relatedTarget)) {
        element.classList.remove("favorites-panel-drop-target");
        clearDropPosition(element);
      }
    });
    element.addEventListener("drop", (event) => {
      const source = getFavoritePanelDragSource(event);
      if (!source || source.kind !== target.kind || source.id === target.id) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      element.classList.remove("favorites-panel-drop-target");
      const placeAfter = getDropPosition(element, event) === "after";
      clearDropPosition(element);
      void drop(source, target, placeAfter);
    });
  }

  function setGroupDropTarget(element, folderId, kind = "link") {
    element.addEventListener("dragover", (event) => {
      const source = getFavoritePanelDragSource(event);
      if (source?.kind !== kind || source.folderId === folderId) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      element.classList.add("favorites-panel-drop-target");
    });
    element.addEventListener("dragleave", (event) => {
      if (!element.contains?.(event.relatedTarget)) {
        element.classList.remove("favorites-panel-drop-target");
      }
    });
    element.addEventListener("drop", (event) => {
      const source = getFavoritePanelDragSource(event);
      if (source?.kind !== kind || source.folderId === folderId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      element.classList.remove("favorites-panel-drop-target");
      void drop(source, folderId ? { kind: kind === "favorite" ? "favorite-folder" : "folder", id: folderId } : { kind: "root" });
    });
  }

  function setFolderTopDropTarget(element, folders, kind = "folder") {
    element.addEventListener("dragover", (event) => {
      const source = getFavoritePanelDragSource(event);
      if (source?.kind !== kind) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      element.dataset.dropPosition = "before";
      element.classList.add("favorites-panel-drop-target");
    });
    element.addEventListener("dragleave", (event) => {
      if (!element.contains?.(event.relatedTarget)) {
        element.classList.remove("favorites-panel-drop-target");
        clearDropPosition(element);
      }
    });
    element.addEventListener("drop", (event) => {
      const source = getFavoritePanelDragSource(event);
      const firstFolderId = folders[0]?.id;
      if (source?.kind !== kind || !firstFolderId || source.id === firstFolderId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      element.classList.remove("favorites-panel-drop-target");
      clearDropPosition(element);
      void drop(source, { kind, id: firstFolderId }, false);
    });
  }

  async function drop(source, target, placeAfter = true) {
    if (source.kind === "link") {
      if (target.kind === "link") {
        if ((source.folderId || null) === (target.folderId || null)) {
          await run("reorder-link", {
            linkId: source.id,
            folderId: target.folderId || null,
            targetId: target.id,
            placeAfter
          });
        } else {
          await run("move-link", {
            linkId: source.id,
            folderId: target.folderId || null,
            targetId: target.id,
            placeAfter
          });
        }
        return;
      }
      await run("move-link", { linkId: source.id, folderId: target.kind === "folder" ? target.id : null });
      return;
    }
    if (source.kind === "favorite") {
      if (target.kind === "favorite") {
        if ((source.folderId || null) === (target.folderId || null)) {
          await run("reorder-favorite", {
            signature: source.id,
            folderId: target.folderId || null,
            targetSignature: target.id,
            placeAfter
          });
        } else {
          await run("move-favorite", {
            signature: source.id,
            folderId: target.folderId || null,
            targetSignature: target.id,
            placeAfter
          });
        }
        return;
      }
      await run("move-favorite", { signature: source.id, folderId: target.kind === "favorite-folder" ? target.id : null });
      return;
    }
    if (target.kind === "folder") {
      await run("reorder-folder", { folderId: source.id, targetId: target.id, placeAfter });
    } else if (target.kind === "favorite-folder") {
      await run("reorder-favorite-folder", { folderId: source.id, targetId: target.id, placeAfter });
    }
  }

  async function run(command, payload) {
    try {
      await request(command, payload);
      if (command === "delete-folder") {
        local.confirmingFolderId = null;
      }
      if (command === "clear-history") {
        local.confirmingHistoryClear = false;
      }
      if (command === "create-folder") {
        local.creatingFolder = false;
      }
      if (command === "create-favorite-folder") {
        local.creatingFavoriteFolder = false;
      }
      if (command === "delete-favorite-folder") {
        local.confirmingFavoriteFolderId = null;
      }
      if (command === "import-links") {
        local.importing = false;
      }
      if (command === "move-link") {
        local.movingLinkId = null;
      }
      render();
    } catch (error) {
      console.debug("[PoE2 Marketwright] favorites panel command failed", error);
    }
  }

  function notifyParentHover() {
    const parent = window.parent;
    if (!parent || parent === window || typeof parent.postMessage !== "function") {
      return;
    }
    const hovered = Boolean(local.panelHovered || local.drag || local.editing);
    parent.postMessage({ type: "poe2-marketwright-favorites-panel-hover", hovered }, "*");
  }

  function bindUi() {
    ui.itemsTab.addEventListener("click", () => run("select-tab", { tab: "items" }));
    ui.linksTab.addEventListener("click", () => run("select-tab", { tab: "links" }));
    ui.compact.addEventListener("click", () => run("set-view-mode", { mode: "compact" }));
    ui.close.addEventListener("click", () => run("close-panel"));
    ui.tooltip?.addEventListener("pointerenter", clearLinkFavoriteTooltipHideTimer);
    ui.tooltip?.addEventListener("pointerleave", scheduleLinkFavoriteTooltipHide);
    document.documentElement.addEventListener("pointerenter", () => {
      local.panelHovered = true;
      notifyParentHover();
    });
    document.documentElement.addEventListener("pointerleave", () => {
      local.panelHovered = false;
      notifyParentHover();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideLinkFavoriteTooltip();
      }
    });
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === "favorites-panel-state" && message.sessionId === sessionId && message.state) {
        void setState(message.state);
      }
    });
  }

  async function bootstrap(attempt = 0) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) {
      return;
    }
    try {
      await request("get-state");
    } catch (error) {
      if (attempt < 4 && String(error?.message || "") === "unknown_panel_session") {
        window.setTimeout(() => bootstrap(attempt + 1), 160 * (attempt + 1));
      }
    }
  }

  if (globalThis.chrome?.runtime?.getURL) {
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
      document.documentElement.style.setProperty(name, `url("${chrome.runtime.getURL(path)}")`);
    }
  }

  bindUi();
  bootstrap();
})();
