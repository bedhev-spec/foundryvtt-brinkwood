/**
 * Shared, DOM-only helpers for ApplicationV2 sheet navigation.  They keep
 * native Foundry primary tabs in charge while preserving transient sheet view
 * state across renders triggered by form controls or effect actions.
 */

export function getSheetScrollContainers(root) {
  const tabViewport = root?.querySelector?.(".sheet-tab-content > .tab.active");
  // Bounded actor sheets keep their header and tabs fixed. Their active panel
  // is the only scroll owner, so restoring outer scroll would move fixed UI.
  if (tabViewport) return [["tab", tabViewport]];

  const form = root?.matches?.("form") || root?.matches?.("form.actor-sheet")
    ? root
    : root?.querySelector?.("form") ?? root?.querySelector?.("form.actor-sheet");
  const windowContent = root?.closest?.(".window-content") ?? root?.querySelector?.(".window-content");
  return [["form", form], ["window", windowContent]].filter(([, element]) => element);
}

export function captureSheetViewState(root, { primaryTab, effectTab } = {}) {
  const activePanel = root?.querySelector?.('.tab[data-group="primary"].active');
  return {
    primaryTab: primaryTab ?? activePanel?.dataset.tab,
    effectTab,
    scrollPositions: Object.fromEntries(getSheetScrollContainers(root).map(([name, element]) => [name, {
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
    }])),
  };
}

export function restoreSheetViewState(root, state, { setPrimaryTab, activateEffectTab } = {}) {
  if (!state) return;
  if (state.primaryTab) setPrimaryTab?.(state.primaryTab);
  for (const [name, element] of getSheetScrollContainers(root)) {
    const position = state.scrollPositions?.[name];
    if (!position) continue;
    element.scrollTop = position.scrollTop;
    element.scrollLeft = position.scrollLeft;
  }
  // A bounded viewport can replace the inner tab pane during a rerender.
  // Ensure stale outer positions cannot shift the fixed header into view.
  if (root?.querySelector?.(".sheet-tab-content")) {
    const form = root.matches?.("form.actor-sheet") ? root : root.querySelector?.("form.actor-sheet");
    const windowContent = root.closest?.(".window-content") ?? root.querySelector?.(".window-content");
    for (const element of [form, windowContent]) {
      if (!element) continue;
      element.scrollTop = 0;
      element.scrollLeft = 0;
    }
  }
  if (state.effectTab) activateEffectTab?.(state.effectTab);
}

export function normalizeEffectTab(effects, activeTab, fallback = "temporary") {
  const visible = Object.values(effects ?? {}).filter(section => section.visible).map(section => section.type);
  return visible.includes(activeTab) ? activeTab : visible[0] ?? fallback;
}

export function activateEffectTab(root, type) {
  const nextTab = root?.querySelector?.(`[data-effect-tab="${type}"]`);
  if (!nextTab) return false;
  root.querySelectorAll("[data-effect-tab]").forEach(tab => {
    const active = tab === nextTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  root.querySelectorAll("[data-effect-panel]").forEach(panel => {
    panel.hidden = panel.dataset.effectPanel !== type;
  });
  return true;
}

export function bindEffectTabs(root, { signal, onActivate } = {}) {
  root?.querySelectorAll?.("[data-effect-tab]").forEach(tab => {
    tab.addEventListener("click", event => {
      event.preventDefault();
      onActivate?.(event.currentTarget.dataset.effectTab);
    }, { signal });
    tab.addEventListener("keydown", event => {
      const tabs = Array.from(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll("[data-effect-tab]") ?? []);
      const current = tabs.indexOf(event.currentTarget);
      const target = event.key === "Home" ? tabs[0]
        : event.key === "End" ? tabs.at(-1)
        : event.key === "ArrowRight" || event.key === "ArrowDown" ? tabs[(current + 1) % tabs.length]
        : event.key === "ArrowLeft" || event.key === "ArrowUp" ? tabs[(current - 1 + tabs.length) % tabs.length]
        : null;
      if (!target) return;
      event.preventDefault();
      target.focus();
      onActivate?.(target.dataset.effectTab);
    }, { signal });
  });
}
