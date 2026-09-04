
import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { capitalize } from "./blades-helpers.js";
import { encumbranceLevelForLoadout, hasMuleAbility } from "./encumbrance.js";
import { renderMaskPickerTooltip } from "./mask-picker-tooltip.js";
import { maskActorImage } from "./actor-images.js";
import { formControlUpdate, handleActorNameEnter, persistActorNameChange, queueDocumentPathUpdate } from "./sheet-dom.js";
import { normalizedTraitSourceName, traitHasCompendiumProvenance } from "./trait-grant-matching.js";

export { handleActorNameEnter as handleMaskNameEnter };

export const MASK_SHEET_DEFAULT_WIDTH = 700;
// A Character sheet at its 700px default has a 212px Attribute column:
// (700px - 40px form padding - 24px inter-column gaps) / 3.
// Foundry's ApplicationV2 inner frame also consumes horizontal space, so the
// configured target includes enough clearance for the 200px portrait, identity
// details, the Character-sized Attribute family, and both 20px gaps.
export const MASK_SHEET_ATTRIBUTES_WIDTH = 760;
export const MASK_SHEET_VIEWPORT_GUTTER = 32;
const MASK_SHEET_RESIZING_CLASS = "mask-sheet--attribute-resizing";
const MASK_SHEET_RESIZE_DURATION = 180;

const itemId = item => item?.id ?? item?._id;

/** Return only source-tagged traits belonging to the currently selected Mask. */
export function getMaskTraitsForSource(items, maskItem) {
  const sourceItemId = itemId(maskItem);
  if (!sourceItemId) return [];
  return Array.from(items ?? []).filter(item =>
    item.type === "trait"
    && item.flags?.brinkwood?.traitGrant?.sourceItemType === "mask"
    && item.flags?.brinkwood?.traitGrant?.sourceItemId === sourceItemId
  );
}

/** Return ungranted compendium Traits associated with the selected Mask Type. */
export function getEligibleMaskTraits(items, actorItems, maskItem) {
  const sourceItemId = itemId(maskItem);
  if (!sourceItemId) return [];
  const existingTraits = Array.from(actorItems ?? []).filter(item => item.type === "trait");
  const existingTraitSourceIds = new Set(existingTraits
    .map(item => item.flags?.brinkwood?.traitGrant?.traitSourceId)
    .filter(Boolean));
  const maskType = normalizedTraitSourceName(maskItem.name);
  return Array.from(items ?? []).filter(item =>
    item.type === "trait"
    && normalizedTraitSourceName(item.system?.class) === maskType
    && !existingTraitSourceIds.has(itemId(item))
    && !existingTraits.some(existing => traitHasCompendiumProvenance(existing, item))
    && Boolean(item.name?.trim())
    && !existingTraits.some(existing =>
      existing.name === item.name
      && normalizedTraitSourceName(existing.system?.class) === normalizedTraitSourceName(item.system?.class))
  );
}

/**
 * Return the width used when a configured Mask adds its Attribute column.
 * A previously wider manual resize always wins; this helper never shrinks.
 */
export function maskSheetWidthForAttributes(currentWidth, viewportWidth) {
  const current = Number.isFinite(currentWidth) ? currentWidth : MASK_SHEET_DEFAULT_WIDTH;
  const viewportLimit = Number.isFinite(viewportWidth)
    ? Math.max(0, viewportWidth - MASK_SHEET_VIEWPORT_GUTTER)
    : MASK_SHEET_ATTRIBUTES_WIDTH;
  return Math.max(current, Math.min(MASK_SHEET_ATTRIBUTES_WIDTH, viewportLimit));
}

export function getMaskTypePresentation(typeName, attributes) {
  const maskAttributes = attributes[typeName];
  const typeLang = `BITD.${capitalize(typeName)}`;
  return {
    attributes: maskAttributes ?? [],
    label: maskAttributes ? `${typeLang}Short` : "BITD.Mask",
    typeLang,
    xpKey: maskAttributes ? `Mask.XP.${capitalize(typeName)}` : null
  };
}

export function updateMaskDotDisplay(element, value, maxValue) {
  const group = element.parentElement;
  const color = element.dataset.path === "experience.value" ? "blue" : "red";

  group?.querySelectorAll(".dot-value").forEach(dot => {
    const filled = Number(dot.dataset.value) <= value;
    dot.setAttribute("aria-pressed", filled ? "true" : "false");
    dot.classList?.toggle("dot-value--filled", filled);
    dot.classList?.toggle("dot-value--empty", !filled);
    const tooth = dot.querySelector("img");
    if (tooth) {
      tooth.src = `systems/brinkwood/styles/assets/teeth/stresstooth-${filled ? color : "halfgrey"}.png`;
    } else {
      dot.textContent = filled ? "●" : "○";
    }
  });

  const tracker = group?.closest?.(".mask-tracker");
  const output = tracker?.querySelector("output");
  if (output) output.textContent = `${value} / ${maxValue}`;

  const skillLabel = group?.closest?.(".mask-skill")?.querySelector(".attribute-skill-label");
  if (skillLabel) skillLabel.dataset.rollValue = String(value);
}

/**
 * Extend the basic BladesSheet for the Mask actor type.
 * @extends {BladesSheet}
 */
export class BladesMaskSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "pc", "mask"],
    // An unconfigured Mask keeps the compact initial sheet. Its selected Mask
    // Type adds Attribute UI and expands the already-open ApplicationV2 frame.
    position: { width: MASK_SHEET_DEFAULT_WIDTH, height: 840 },
    // Explicit change handlers below are the only Mask persistence path.
    form: { submitOnChange: false },
    tabGroups: { primary: "traits" },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood/templates/mask-sheet.html" },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this._ensureValidPrimaryTab(context);

    context.img = maskActorImage(context.img);

    context.system.mask_attributes = context.system.attributes[context.system.type] ?? [];
    context.maskAttributesLabel = "BITD.Mask";

    // Prepare active effects
    context.effects = await BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects, { owner: this.actor });
    this._prepareEffectTabs(context);

    this.setAttrLabels(context.system.attributes, "Mask");

    context.system.oath = game.user.character?.system?.oath || 0;

    // Mask Traits are the automatic, source-tagged grants of the selected
    // Mask Type. Other actor traits remain untouched but do not belong here.
    context.maskItem = context.items.find(item => item.type === "mask") ?? null;
    context.traits = getMaskTraitsForSource(context.items, context.maskItem)
      .map(trait => ({
        ...trait,
        canDelete: context.isGM && !trait.flags?.brinkwood?.traitGrant,
      }))
      .sort((a, b) => (a.system.purchased > b.system.purchased ? -1 : 1));

    // Calculate Load
    let loadout = 0;
    context.items.forEach(i => {
      loadout += (i.type === "item") ? parseInt(i.system.load) : 0;
    });
    loadout = Math.max(0, Math.min(10, loadout));
    context.system.loadout = loadout;

    // Mask configuration is actor-owned and enforces a single embedded source.
    // Keep a dedicated presentation object so templates never infer it from an
    // arbitrary item loop.
    context.canAddMaskTraits = Boolean(context.maskItem) && context.editable;
    context.maskTypeLabel = context.maskItem?.name ?? "";
    context.identityRows = [{
      itemType: "mask",
      label: "BITD.Mask",
      deleteLabel: "BITD.TitleDeleteItem",
      reselect: true,
      item: context.maskItem?.name?.trim() ? context.maskItem : null,
    }];

    // Determine mask type from configured mask item
    context.system.type = context.maskItem?.name.toLowerCase() ?? "";
    context.system.mask_attributes = [];
    if (context.system.type) {
      const typeName = context.system.type;
      const presentation = getMaskTypePresentation(typeName, context.system.attributes);
      context.system.type_lang       = presentation.typeLang;
      context.maskAttributesLabel    = presentation.label;
      context.system.mask_attributes = presentation.attributes;
      context.system.xp_tooltip      =
        game.i18n.localize("Mask.XP.Tooltip") +
        (presentation.xpKey ? game.i18n.localize(presentation.xpKey) : "");
    }

    context.system.load_level = encumbranceLevelForLoadout(loadout, hasMuleAbility(context.items));
    context.system.load_levels = { "BITD.Light": "BITD.Light", "BITD.Normal": "BITD.Normal", "BITD.Heavy": "BITD.Heavy" };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );

    return context;
  }

  /** Keep a remembered Mask tab when available; otherwise use its first tab. */
  _ensureValidPrimaryTab(context) {
    const validTabs = ["traits", "mask-notes"];
    if (context.isGM) validTabs.push("effects");
    if (validTabs.includes(this.tabGroups.primary)) return;
    this.tabGroups.primary = "traits";
    context.tabs.primary = "traits";
  }

  /** Expand after Mask Type configuration; clearing it returns the sheet to its compact width. */
  async _expandForMaskAttributes() {
    const currentWidth = Number(this.position?.width) || MASK_SHEET_DEFAULT_WIDTH;
    const viewportWidth = globalThis.window?.innerWidth ?? globalThis.document?.documentElement?.clientWidth;
    const nextWidth = maskSheetWidthForAttributes(currentWidth, viewportWidth);
    return this._resizeForMaskAttributes(nextWidth);
  }

  async _shrinkForMaskAttributes() {
    return this._resizeForMaskAttributes(MASK_SHEET_DEFAULT_WIDTH);
  }

  async _resizeForMaskAttributes(nextWidth) {
    const currentWidth = Number(this.position?.width) || MASK_SHEET_DEFAULT_WIDTH;
    if (nextWidth === currentWidth || typeof this.setPosition !== "function") return;
    const stopTransition = this._startMaskAttributeResizeTransition();
    try {
      return await this.setPosition({ width: nextWidth });
    } catch (error) {
      stopTransition?.();
      throw error;
    }
  }

  _startMaskAttributeResizeTransition() {
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return null;
    const frame = this.element?.closest?.(".brinkwood.actor.mask") ?? this.element;
    if (!frame?.classList) return null;

    frame.classList.add(MASK_SHEET_RESIZING_CLASS);
    // Commit the transient class before ApplicationV2 writes its inline width.
    void frame.offsetWidth;

    let timeout;
    const stop = () => {
      globalThis.clearTimeout(timeout);
      frame.removeEventListener?.("transitionend", onTransitionEnd);
      frame.classList.remove(MASK_SHEET_RESIZING_CLASS);
    };
    const onTransitionEnd = event => {
      if (event.target === frame && event.propertyName === "width") stop();
    };
    frame.addEventListener?.("transitionend", onTransitionEnd);
    timeout = globalThis.setTimeout(stop, MASK_SHEET_RESIZE_DURATION + 80);
    return stop;
  }

  async _syncMaskAttributeAvailability(hasMaskType) {
    const available = Boolean(hasMaskType);
    const wasAvailable = Boolean(this._maskAttributesAvailable);
    const becameAvailable = available && !this._maskAttributesAvailable;
    this._maskAttributesAvailable = available;
    if (becameAvailable) await this._expandForMaskAttributes();
    else if (!available && wasAvailable) await this._shrinkForMaskAttributes();
  }

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    await this._syncMaskAttributeAvailability(Boolean(context.maskItem));
    this._maskSheetListenerController?.abort();
    const html = this.element;
    this._maskSheetListenerController = new AbortController();
    const listenerOptions = { signal: this._maskSheetListenerController.signal };
    this._bindSheetViewState(html, listenerOptions);
    html.querySelector('input[name="name"]')?.addEventListener(
      "keydown", handleActorNameEnter, listenerOptions);

    // Open inventory item sheet
    html.querySelectorAll(".item-body").forEach(el =>
      el.addEventListener("click", ev => {
        if (ev.currentTarget.classList.contains("item-add-popup")) return;
        const item = this.actor.items.get(ev.currentTarget.closest(".item").dataset.itemId);
        item?.sheet.render({ force: true });
      }, listenerOptions)
    );

    if (!this.isEditable) return;

    html.querySelectorAll('input[name], select[name], textarea[name], prose-mirror[name]').forEach(control =>
      control.addEventListener("change", event => this._persistFormControl(event), listenerOptions)
    );

    // Delete inventory item. The identity Mask is configuration, so removal
    // goes through the actor command that also removes its source-tagged trait.
    html.querySelectorAll(".item-delete").forEach(el =>
      el.addEventListener("click", async ev => {
        const element = ev.currentTarget.closest(".item");
        const item = this.actor.items.get(element.dataset.itemId);
        if (item?.type === "mask") {
          await this.actor.clearMaskConfiguration();
        } else {
          await this.actor.deleteEmbeddedDocuments("Item", [element.dataset.itemId]);
        }
        element.remove();
      }, listenerOptions)
    );

    // Dot rating controls
    html.querySelectorAll(".dot-value").forEach(el =>
      el.addEventListener("click", this._onDotChange.bind(this), listenerOptions)
    );

    // Active effect controls
    html.querySelectorAll(".effect-control[data-effect-action]").forEach(el =>
      el.addEventListener("click", ev => this._onActorEffectControl(
        ev,
        () => BladesActiveEffect.onManageActiveEffect(ev, this.actor, { gmOnly: true }),
      ), listenerOptions)
    );
  }

  /* -------------------------------------------- */

  async _persistFormControl(event) {
    if (!this.isEditable) return;
    const control = event.currentTarget;
    if (control.matches('input[name="name"]')) return persistActorNameChange(this, event);

    const update = formControlUpdate(control);
    if (update) await this.document.update(update, { render: control.matches("prose-mirror[name]") });
  }

  /* -------------------------------------------- */

  async _onDotChange(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const element   = event.currentTarget;
    const dataset   = element.dataset;

    let new_value   = parseInt(dataset.value);
    const max_value = parseInt(dataset.max_value);
    if (!dataset.path) return;
    const path = `system.${dataset.path}`;
    await queueDocumentPathUpdate(this.actor, path, async () => {
      const old_value = foundry.utils.getProperty(this.actor, path);
      let queuedValue = new_value;
      if (queuedValue === old_value && queuedValue === 1) queuedValue = 0;
      if (queuedValue > max_value) queuedValue = max_value;

      await this.actor.update({ [path]: queuedValue }, { render: false });
      this._updateDotDisplay(element, queuedValue, max_value);
    });
  }

  _updateDotDisplay(element, value, maxValue) {
    updateMaskDotDisplay(element, value, maxValue);
  }

  _getItemPickerInputType(itemType, distinct) {
    return itemType === "mask" ? "radio" : super._getItemPickerInputType(itemType, distinct);
  }

  _renderItemPickerTooltip(item, enrichedDescription) {
    return renderMaskPickerTooltip(item, enrichedDescription);
  }

  /** Limit the shared Trait picker to still-missing grants for this Mask Type. */
  async _getItemPickerItems(itemType) {
    const items = await super._getItemPickerItems(itemType);
    if (itemType !== "trait") return items;
    const maskItem = this.actor.items.find(item => item.type === "mask");
    return getEligibleMaskTraits(items, this.actor.items, maskItem);
  }

  /** Route Mask picker selections through the actor-owned grant commands. */
  async _createPickedItems(items, { itemType, selectedItems = [] } = {}) {
    if (itemType === "trait") {
      const maskItem = this.actor.items.find(item => item.type === "mask");
      const traitSourceIds = selectedItems.map(itemId).filter(Boolean);
      if (!this.isEditable || !maskItem || !traitSourceIds.length) return [];
      return this.actor.repairTraitGrantsForSourceIds([itemId(maskItem)], false, traitSourceIds);
    }
    if (itemType !== "mask") return super._createPickedItems(items, { itemType });
    const [mask] = items;
    return mask ? this.actor.configureMask(mask) : [];
  }

}
