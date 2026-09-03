
import { BladesSheet } from "./blades-sheet.js";
import {
  bindLoadoutControls,
  calculateLoadoutWeight,
  prepareLoadoutCapacity,
  prepareLoadoutCatalogue,
} from "./character/loadout.js";
import { encumbranceLevelForLoadout, hasMuleAbility } from "./encumbrance.js";
import { BladesHelpers } from "./blades-helpers.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { preloadClockImages } from "./clock-utils.js";
import { formControlUpdate } from "./sheet-dom.js";

export { prepareLoadoutCapacity } from "./character/loadout.js";

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
// A stable ApplicationV2 frame prevents a long tab from resizing and moving
// the window. The character sheet's active tab owns overflow inside it.
position: { width: 700, height: 1170 },
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

    this._ensureValidPrimaryTab(context);

    // Prepare active effects
    context.effects = await BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects, { owner: this.actor });
    this._prepareEffectTabs(context);

    this.setAttrLabels(context.system.attributes);

    context.traits = context.items
      .filter(i => i.type === "trait")
      .map(trait => {
        const canDelete = context.isGM && !trait.flags?.brinkwood?.traitGrant;
        return { ...trait, canDelete };
      });

    // This is display-only data. Selecting an entry is the only path that
    // creates its embedded item on the actor.
    context.loadoutItems = prepareLoadoutCatalogue(
      await BladesHelpers.getAllItemsByType("item", game),
      context.items,
    );

    Object.entries(context.system.attributes).forEach(([name, attr]) => {
      context.system.attributes[name].value = Object.values(attr.skills).filter(s => s.value > 0).length;
    });

    // Calculate Load
    const loadout = calculateLoadoutWeight(context.items);
    context.system.loadout = loadout;
    Object.assign(context, prepareLoadoutCapacity(loadout, context.system.selected_load_level));

    context.system.load_level = encumbranceLevelForLoadout(loadout, hasMuleAbility(context.items));
    context.system.load_levels = { "BITD.Light": "BITD.Light", "BITD.Normal": "BITD.Normal", "BITD.Heavy": "BITD.Heavy" };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );

    return context;
  }

  /** Keep a valid user-selected tab through rerenders; only fall back on no valid state. */
  _ensureValidPrimaryTab(context) {
    const validTabs = ["traits", "loadout", "character-notes", "downtime"];
    if (context.isGM) validTabs.push("effects");
    if (validTabs.includes(this.tabGroups.primary)) return;

    this.tabGroups.primary = "traits";
    context.tabs.primary = "traits";
  }

  /* -------------------------------------------- */

  /** Reset transient navigation when the sheet is genuinely closed. */
  async close(options = {}) {
    this._sheetViewState = undefined;
    this.tabGroups.primary = "traits";
    return super.close(options);
  }

  /* -------------------------------------------- */
  /** @override */
  async _onRender(context, options) {
     await super._onRender(context, options);
     const html = this.element;

     this._characterSheetListenerController?.abort();
     this._characterSheetListenerController = new AbortController();
     const listenerOptions = { signal: this._characterSheetListenerController.signal };
     this._bindSheetViewState(html, listenerOptions);
     bindLoadoutControls(this, html, listenerOptions);
     if (!this.isEditable) return;

       html.querySelectorAll('input[name], select[name], textarea[name], prose-mirror[name]').forEach(control => {
        control.addEventListener("change", event => this._persistFormControl(event), listenerOptions);
      });

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
        if (!element) return;
        const item = this.actor.items.get(element.dataset.itemId);
        if (!item) return;
        if (item.type === "trait" && (!game.user.isGM || item.flags?.brinkwood?.traitGrant)) return;
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
 html.querySelectorAll(".effect-control[data-effect-action]").forEach(el =>
 el.addEventListener("click", ev => {
  this._captureSheetViewState();
  const action = BladesActiveEffect.onManageActiveEffect(ev, this.actor, { gmOnly: true });
  Promise.resolve(action).finally(() => this._restoreSheetViewState());
 }, listenerOptions)
 );
  }

  async _persistFormControl(event) {
    if (!this.isEditable) return;
    const control = event.currentTarget;
    // Clock radios have toggle-to-zero semantics in _onClockClick; a later
    // generic focus/change save would otherwise restore the selected segment.
    if (control.matches('select[name="system.selected_load_level"]')) return;
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
