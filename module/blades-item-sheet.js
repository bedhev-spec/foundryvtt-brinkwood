/**
 * Extend the basic ItemSheet – uses ItemSheetV2 (ApplicationV2 lifecycle).
 * @extends {ItemSheetV2}
 */
import { BladesActiveEffect } from "./blades-active-effect.js";

export class BladesItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
) {

  /**
   * Supported item-type → template mapping.
   * Simple types all share the same template.
   */
  static SIMPLE_TYPES = new Set(["profession", "upbringing", "crew_reputation", "mask", "pact"]);

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "item"],
    position: { width: 560 },
    window: { resizable: true },
    form: { submitOnChange: true },
    tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
  };

  /**
   * All known PARTS; _configureRenderOptions selects the active one per render.
   */
  static PARTS = {
    simple:        { template: "systems/brinkwood/templates/items/simple.html" },
    item:          { template: "systems/brinkwood/templates/items/item.html" },
    class:         { template: "systems/brinkwood/templates/items/class.html" },
    trait:         { template: "systems/brinkwood/templates/items/trait.html" },
    moot_decision: { template: "systems/brinkwood/templates/items/moot_decision.html" },
  };

  /* -------------------------------------------- */

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    const partId = BladesItemSheet.SIMPLE_TYPES.has(this.document.type)
      ? "simple"
      : this.document.type;
    options.parts = [partId];
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const doc     = this.document;
    const context = doc.toObject();               // _id, name, img, type, system …
    context.isGM     = game.user.isGM;
    context.owner    = doc.isOwner;
    context.editable = this.isEditable;
    context.cssClass = this.isEditable ? "editable" : "locked";
    context.effects  = BladesActiveEffect.prepareActiveEffectCategories(doc.effects);
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    const html = this.element;

    if (!this.isEditable) return;

    // Active effect controls – use data-effect-action to avoid AppV2 action dispatch
    html.querySelectorAll(".effect-control").forEach(el =>
      el.addEventListener("click", ev => {
        if (this.document.isEmbedded) return ui.notifications.warn(game.i18n.localize("BITD.EffectWarning"));
        BladesActiveEffect.onManageActiveEffect(ev, this.document);
      })
    );
  }

  /* -------------------------------------------- */

}
