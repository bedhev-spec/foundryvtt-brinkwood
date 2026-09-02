
import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { preloadClockImages } from "./clock-utils.js";

export function formControlUpdate(control) {
  const { name, type } = control ?? {};
  if (!name || control.disabled || (type === "radio" && !control.checked)) return null;
  const value = type === "checkbox"
    ? control.checked
    : control.multiple
      ? Array.from(control.selectedOptions, option => option.value)
      : control.value ?? control.getAttribute?.("value") ?? "";
  return { [name]: value };
}

export function updateCharacterTrackerDisplay(element, value) {
  const group = element.parentElement;
  const tracker = element.closest?.(".character-tracker")
    ?? element.closest?.(".character-xp, .character-stress")
    ?? group;
  const color = tracker?.classList.contains("character-xp") ? "blue" : "red";

  group?.querySelectorAll(".dot-value").forEach(dot => {
    const filled = Number(dot.dataset.value) <= value;
    const tooth = dot.querySelector("img.big-teeth");
    if (tooth) {
      dot.setAttribute("aria-pressed", filled ? "true" : "false");
      tooth.src = `systems/brinkwood/styles/assets/teeth/stresstooth-${filled ? color : "halfgrey"}.png`;
      return;
    }

    dot.setAttribute("aria-pressed", filled ? "true" : "false");
    dot.classList.toggle("dot-value--filled", filled);
    dot.classList.toggle("dot-value--empty", !filled);
  });

  const output = tracker?.querySelector?.("output");
  const maxValue = Number(element.dataset.max_value);
  if (output && Number.isFinite(maxValue)) output.textContent = `${value} / ${maxValue}`;

  const skillLabel = group?.querySelector?.(".attribute-skill-label");
  if (!skillLabel) return;
  skillLabel.dataset.rollValue = String(value);

  const attribute = group.closest?.(".attribute");
  const attributeLabel = attribute?.querySelector(".attribute-label");
  if (attributeLabel) {
    attributeLabel.dataset.rollValue = String(
      attribute.querySelectorAll('.attributes-container .dot-value[data-value="1"].dot-value--filled').length
    );
  }
}

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {BladesSheet}
 */
export class BladesActorSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "pc", "character"],
    // ApplicationV2 accepts "auto" (also used by BladesClockSheet), allowing
    // the Legacy sheet to fit its rendered Traits content within Foundry's
    // viewport-constrained window instead of imposing a fixed 840px viewport.
    position: { width: 700, height: "auto" },
    form: { submitOnChange: false },
    tabGroups: { primary: "traits" },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood/templates/actor-sheet.html" },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    await preloadClockImages(4);

    // Prepare active effects
    context.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);
    this._isLegacyCharacterSheet = !this.constructor.DEFAULT_OPTIONS.classes.includes("character-v2");
    context.isCharacterSheet = this._isLegacyCharacterSheet;
    const visibleEffectTabs = Object.values(context.effects)
      .filter(section => section.visible)
      .map(section => section.type);
    if (!visibleEffectTabs.includes(this._activeEffectTab)) {
      this._activeEffectTab = visibleEffectTabs[0] ?? "temporary";
    }
    context.activeEffectTab = this._activeEffectTab;

    this.setAttrLabels(context.system.attributes);

    context.traits = context.items
      .filter(i => i.type === "trait")
      .sort((a, b) => (a.system.purchased > b.system.purchased ? -1 : 1));

    Object.entries(context.system.attributes).forEach(([name, attr]) => {
      context.system.attributes[name].value = Object.values(attr.skills).filter(s => s.value > 0).length;
    });

    // Calculate Load
    let loadout = 0;
    context.items.forEach(i => {
      loadout += (i.type === "item" && i.system.equipped) ? parseInt(i.system.load) : 0;
    });
    loadout = Math.max(0, Math.min(10, loadout));
    context.system.loadout = loadout;

    // Encumbrance Levels
    const load_level = [
      "BITD.Light","BITD.Light","BITD.Light","BITD.Light",
      "BITD.Normal","BITD.Normal","BITD.Heavy","BITD.Encumbered",
      "BITD.Encumbered","BITD.Encumbered","BITD.OverMax",
    ];
    const mule_level = [
      "BITD.Light","BITD.Light","BITD.Light","BITD.Light",
      "BITD.Light","BITD.Light","BITD.Normal","BITD.Normal",
      "BITD.Heavy","BITD.Encumbered","BITD.OverMax",
    ];
    const mule_present = context.items.some(i => i.type === "ability" && i.name === "(C) Mule");
    context.system.load_level  = mule_present ? mule_level[loadout] : load_level[loadout];
    context.system.load_levels = { "BITD.Light": "BITD.Light", "BITD.Normal": "BITD.Normal", "BITD.Heavy": "BITD.Heavy" };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );

    return context;
  }

  /* -------------------------------------------- */

  /** Reset transient Legacy navigation when the sheet is genuinely closed. */
  async close(options = {}) {
    const isLegacy = !this.constructor.DEFAULT_OPTIONS.classes.includes("character-v2");
    if (isLegacy) {
      this._legacyViewState = undefined;
      this.tabGroups.primary = "traits";
    }
    return super.close(options);
  }

  /* -------------------------------------------- */

  /**
  * The legacy actor sheet owns its viewport on the form, not on Foundry's
  * .window-content wrapper.  The wrapper can also scroll in older Foundry
  * themes, so retain both independently instead of guessing one owner.
  */
 _getLegacyScrollContainers() {
 const root = this.element;
 const form = root?.matches?.("form.actor-sheet") ? root : root?.querySelector?.("form.actor-sheet");
 const windowContent = root?.closest?.(".window-content") ?? root?.querySelector?.(".window-content");
 return [
 ["form", form],
 ["window", windowContent],
 ].filter(([, element]) => element);
 }

 _captureLegacyScrollPosition({ primaryTab } = {}) {
 if (!this._isLegacyCharacterSheet) return;
 const activePanel = this.element?.querySelector?.('.tab[data-group="primary"].active');
 const selectedPrimaryTab = primaryTab ?? activePanel?.dataset.tab ?? this.tabGroups.primary;
 this._legacyViewState = {
 primaryTab: selectedPrimaryTab,
 effectTab: this._activeEffectTab,
 scrollPositions: Object.fromEntries(this._getLegacyScrollContainers().map(([name, element]) => [name, {
 scrollTop: element.scrollTop,
 scrollLeft: element.scrollLeft,
 }])),
 };
 }

 _restoreLegacyScrollPosition() {
 if (!this._isLegacyCharacterSheet || !this._legacyViewState) return;
 const state = this._legacyViewState;
 if (state.primaryTab) this.tabGroups.primary = state.primaryTab;
 for (const [name, element] of this._getLegacyScrollContainers()) {
 const position = state.scrollPositions?.[name];
 if (!position) continue;
 element.scrollTop = position.scrollTop;
 element.scrollLeft = position.scrollLeft;
 }
 if (state.effectTab) this._activateEffectTab(state.effectTab);
 }

 /** @override */
 async _onRender(context, options) {
    await super._onRender(context, options);
    const html = this.element;

 this._characterSheetListenerController?.abort();
 this._restoreLegacyScrollPosition();
 if (!this.isEditable) return;
    this._characterSheetListenerController = new AbortController();
    const listenerOptions = { signal: this._characterSheetListenerController.signal };

 if (this._isLegacyCharacterSheet) {
 this._getLegacyScrollContainers().forEach(([, container]) => {
 container.addEventListener("scroll", () => this._captureLegacyScrollPosition(), listenerOptions);
 });
 html.addEventListener("click", event => {
 const action = event.target.closest?.(
 '[data-group="primary"][data-action="tab"], [data-effect-tab], .effect-control, .item-select, .item-add-popup, .item-delete'
 );
 if (!action) return;
 const primaryTab = action.matches('[data-group="primary"][data-action="tab"]') ? action.dataset.tab : undefined;
 this._captureLegacyScrollPosition({ primaryTab });
 }, { ...listenerOptions, capture: true });
 html.querySelectorAll("[data-effect-tab]").forEach(tab => {
        tab.addEventListener("click", event => this._onEffectTabClick(event), listenerOptions);
        tab.addEventListener("keydown", event => this._onEffectTabKeydown(event), listenerOptions);
      });
      html.querySelectorAll('input[name], select[name], textarea[name], prose-mirror[name]').forEach(control => {
        control.addEventListener("change", event => this._persistFormControl(event), listenerOptions);
        if (!control.matches("prose-mirror[name]")) {
          control.addEventListener("focusout", event => this._persistFormControl(event), listenerOptions);
        }
      });
    }

    // Open Inventory Item sheet
    html.querySelectorAll(".item-body").forEach(el =>
      el.addEventListener("click", ev => {
        const item = this.actor.items.get(ev.currentTarget.closest(".item").dataset.itemId);
        item.sheet.render({ force: true });
      }, listenerOptions)
    );

    html.querySelectorAll('.item-body[role="button"]').forEach(el =>
      el.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.currentTarget.click();
      }, listenerOptions)
    );

    // Delete Inventory Item
    html.querySelectorAll(".item-delete").forEach(el =>
      el.addEventListener("click", async ev => {
        const element = ev.currentTarget.closest(".item");
        await this.actor.deleteEmbeddedDocuments("Item", [element.dataset.itemId]);
        element.remove();
      }, listenerOptions)
    );

    // Dot rating controls
    html.querySelectorAll(".dot-value").forEach(el =>
      el.addEventListener("click", this._onDotChange.bind(this), listenerOptions)
    );

    html.querySelectorAll('input[name="system.scars"], input[name="system.oath"]').forEach(el =>
      el.addEventListener("click", this._onClockClick.bind(this), listenerOptions)
    );

    // Active effect controls - use data-effect-action to avoid AppV2 action dispatch
 html.querySelectorAll(".effect-control").forEach(el =>
 el.addEventListener("click", ev => {
 if (!this._isLegacyCharacterSheet) {
 return BladesActiveEffect.onManageActiveEffect(ev, this.actor, { gmOnly: true });
 }
 this._captureLegacyScrollPosition();
 const action = BladesActiveEffect.onManageActiveEffect(ev, this.actor, { gmOnly: true });
 Promise.resolve(action).finally(() => this._restoreLegacyScrollPosition());
 }, listenerOptions)
 );
  }

  /* -------------------------------------------- */

  _onEffectTabClick(event) {
    event.preventDefault();
    this._activateEffectTab(event.currentTarget.dataset.effectTab);
  }

  _onEffectTabKeydown(event) {
    const tabs = Array.from(
      event.currentTarget.closest('[role="tablist"]')?.querySelectorAll("[data-effect-tab]") ?? []
    );
    const current = tabs.indexOf(event.currentTarget);
    const target = event.key === "Home" ? tabs[0]
      : event.key === "End" ? tabs.at(-1)
      : event.key === "ArrowRight" || event.key === "ArrowDown" ? tabs[(current + 1) % tabs.length]
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? tabs[(current - 1 + tabs.length) % tabs.length]
      : null;
    if (!target) return;
    event.preventDefault();
    target.focus();
    this._activateEffectTab(target.dataset.effectTab);
  }

  _activateEffectTab(type) {
    const html = this.element;
    const nextTab = html.querySelector(`[data-effect-tab="${type}"]`);
    if (!nextTab) return;
    this._activeEffectTab = type;
    html.querySelectorAll("[data-effect-tab]").forEach(tab => {
      const active = tab === nextTab;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    html.querySelectorAll("[data-effect-panel]").forEach(panel => {
      panel.hidden = panel.dataset.effectPanel !== type;
    });
  }

  async _persistFormControl(event) {
    if (!this.isEditable) return;
    const control = event.currentTarget;
    // Clock radios have toggle-to-zero semantics in _onClockClick; a later
    // generic focus/change save would otherwise restore the selected segment.
    if (control.matches('input[name="system.scars"], input[name="system.oath"], [data-path]')) return;
    const update = formControlUpdate(control);
    if (update) {
      await this.document.update(update, { render: control.matches("prose-mirror[name]") });
    }
  }

  async _onDotChange(event) {
    event.preventDefault();
    const element  = event.currentTarget;
    const dataset  = element.dataset;
    if (!this.isEditable || !dataset.path) return;

    let new_value  = Number(dataset.value);
    const max_value = Number(dataset.max_value);
    const old_value = foundry.utils.getProperty(this.document, dataset.path);

    if (new_value === old_value && new_value === 1) new_value = 0;
    if (Number.isFinite(max_value) && new_value > max_value) new_value = max_value;

    await this.document.update({ [dataset.path]: new_value }, { render: false });
    this._updateTrackerDisplay(element, new_value);
  }

  _updateTrackerDisplay(element, value) {
    updateCharacterTrackerDisplay(element, value);
  }

  async _onClockClick(event) {
    const { name, value } = event.currentTarget;
    const selectedValue = Number(value);
    if (!this.isEditable || !["system.scars", "system.oath"].includes(name) || !Number.isInteger(selectedValue)) return;

    event.preventDefault();
    event.stopPropagation();
    const currentValue = Number(foundry.utils.getProperty(this.document, name));
    const clockValue = selectedValue === 1 && currentValue === 1 ? 0 : selectedValue;
    await this.document.update({ [name]: Math.min(4, Math.max(0, clockValue)) });
  }

  /* -------------------------------------------- */

}
