
import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {BladesSheet}
 */
export class BladesActorSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "pc"],
    position: { width: 700, height: 970 },
    form: { submitOnChange: true },
    tabs: [{ navSelector: ".tabs", contentSelector: ".tab-content", initial: "abilities" }],
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood/templates/actor-sheet.html" },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Prepare active effects
    context.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);

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

    context.system.description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;

    if (!this.isEditable) return;

    // Open Inventory Item sheet
    html.querySelectorAll(".item-body").forEach(el =>
      el.addEventListener("click", ev => {
        const item = this.actor.items.get(ev.currentTarget.closest(".item").dataset.itemId);
        item.sheet.render(true);
      })
    );

    // Delete Inventory Item
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

    // Active effect controls – use data-effect-action to avoid AppV2 action dispatch
    html.querySelectorAll(".effect-control").forEach(el =>
      el.addEventListener("click", ev => BladesActiveEffect.onManageActiveEffect(ev, this.actor))
    );
  }

  /* -------------------------------------------- */

  async _onDotChange(event) {
    event.preventDefault();
    const element  = event.currentTarget;
    const dataset  = element.dataset;

    let new_value  = parseInt(dataset.value);
    const max_value = parseInt(dataset.max_value);
    const old_value = foundry.utils.getProperty(this.actor, dataset.path);

    if (new_value === old_value && new_value === 1) new_value = 0;
    if (new_value > max_value) new_value = max_value;

    await this.actor.update({ [dataset.path]: new_value });
  }

  /* -------------------------------------------- */

}
