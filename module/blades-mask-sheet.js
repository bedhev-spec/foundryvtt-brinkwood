
import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { capitalize } from "./blades-helpers.js";

/**
 * Extend the basic BladesSheet for the Mask actor type.
 * @extends {BladesSheet}
 */
export class BladesMaskSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "pc", "mask"],
    position: { width: 700, height: 970 },
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
      context.system.type_lang       = `BITD.${capitalize(typeName)}`;
      context.system.mask_attributes = context.system.attributes[typeName] ?? [];
      context.system.xp_tooltip      =
        game.i18n.localize("Mask.XP.Tooltip") +
        game.i18n.localize(`Mask.XP.${capitalize(typeName)}`);
    }

    // Look for Mule ability
    context.items.forEach(i => {
      if (i.type === "ability" && i.name === "(C) Mule") mule_present = 1;
    });

    context.system.load_level  = mule_present ? mule_level[loadout] : load_level[loadout];
    context.system.load_levels = { "BITD.Light": "BITD.Light", "BITD.Normal": "BITD.Normal", "BITD.Heavy": "BITD.Heavy" };

    context.system.description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = this.element;

    if (!this.isEditable) return;

    // Open inventory item sheet
    html.querySelectorAll(".item-body").forEach(el =>
      el.addEventListener("click", ev => {
        const item = this.actor.items.get(ev.currentTarget.closest(".item").dataset.itemId);
        item.sheet.render(true);
      })
    );

    // Delete inventory item
    html.querySelectorAll(".item-delete").forEach(el =>
      el.addEventListener("click", async ev => {
        const element = ev.currentTarget.closest(".item");
        await this.actor.deleteEmbeddedDocuments("Item", [element.dataset.itemId]);
        element.remove();
      })
    );

    // Dot rating controls
    html.querySelectorAll(".dot-value").forEach(el =>
      el.addEventListener("click", this._onDotChange.bind(this))
    );

    // Active effect controls
    html.querySelectorAll(".effect-control").forEach(el =>
      el.addEventListener("click", ev => BladesActiveEffect.onManageActiveEffect(ev, this.actor))
    );
  }

  /* -------------------------------------------- */

  async _onDotChange(event) {
    event.preventDefault();
    const element   = event.currentTarget;
    const dataset   = element.dataset;

    let new_value   = parseInt(dataset.value);
    const max_value = parseInt(dataset.max_value);
    const actor_data = foundry.utils.deepClone(this.actor.toObject());
    const old_value = this._dig(actor_data.system, dataset.path);

    if (new_value === old_value && new_value === 1) new_value = 0;
    if (new_value > max_value) new_value = max_value;

    this._setDeep(actor_data.system, dataset.path, new_value);
    await this.actor.update(actor_data);
  }

  /* -------------------------------------------- */

  _dig(from, selector) {
    return selector
      .split(".")
      .filter(t => t !== "")
      .reduce((prev, cur) => prev && prev[cur], from);
  }

  _setDeep(from, selector, value) {
    const path = selector.split(".").filter(t => t !== "");
    path.reduce((prev, cur, idx) => {
      if (idx === path.length - 1) prev[cur] = value;
      return prev && prev[cur];
    }, from);
  }

  /* -------------------------------------------- */

}
