
import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { capitalize } from "./blades-helpers.js";

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
    position: { width: 700, height: 840 },
    form: { submitOnChange: true },
    tabGroups: { primary: "traits" },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood/templates/mask-sheet.html" },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.system.mask_attributes = context.system.attributes[context.system.type] ?? [];
    context.maskAttributesLabel = "BITD.Mask";

    // Prepare active effects
    context.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);

    this.setAttrLabels(context.system.attributes, "Mask");

    context.system.oath = game.user.character?.system?.oath || 0;

    context.traits = context.items
      .filter(i => i.type === "trait")
      .sort((a, b) => (a.system.purchased > b.system.purchased ? -1 : 1));

    // Calculate Load
    let loadout = 0;
    context.items.forEach(i => {
      loadout += (i.type === "item") ? parseInt(i.system.load) : 0;
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

    let mule_present = 0;
    // Determine mask type from equipped mask item
    context.system.type = context.items.find(i => i.type === "mask")?.name.toLowerCase() ?? context.system.type;
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

    // Look for Mule ability
    context.items.forEach(i => {
      if (i.type === "ability" && i.name === "(C) Mule") mule_present = 1;
    });

    context.system.load_level  = mule_present ? mule_level[loadout] : load_level[loadout];
    context.system.load_levels = { "BITD.Light": "BITD.Light", "BITD.Normal": "BITD.Normal", "BITD.Heavy": "BITD.Heavy" };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._maskSheetListenerController?.abort();
    const html = this.element;
    this._maskSheetListenerController = new AbortController();
    const listenerOptions = { signal: this._maskSheetListenerController.signal };

    // Open inventory item sheet
    html.querySelectorAll(".item-body").forEach(el =>
      el.addEventListener("click", ev => {
        const item = this.actor.items.get(ev.currentTarget.closest(".item").dataset.itemId);
        item?.sheet.render({ force: true });
      }, listenerOptions)
    );

    if (!this.isEditable) return;

    // Delete inventory item
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

    // Active effect controls
    html.querySelectorAll(".effect-control").forEach(el =>
      el.addEventListener("click", ev => BladesActiveEffect.onManageActiveEffect(ev, this.actor, { gmOnly: true }), listenerOptions)
    );
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
    const old_value = foundry.utils.getProperty(this.actor.system, dataset.path);

    if (new_value === old_value && new_value === 1) new_value = 0;
    if (new_value > max_value) new_value = max_value;

    await this.actor.update({ [`system.${dataset.path}`]: new_value }, { render: false });
    this._updateDotDisplay(element, new_value, max_value);
  }

  _updateDotDisplay(element, value, maxValue) {
    updateMaskDotDisplay(element, value, maxValue);
  }

}
