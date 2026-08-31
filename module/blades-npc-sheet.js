
import { BladesSheet } from "./blades-sheet.js";

/**
 * @extends {BladesSheet}
 */
export class BladesNPCSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor"],
    position: { width: 900 },
    form: { submitOnChange: true },
    window: { resizable: true },
    tabs: [{ navSelector: ".tabs", contentSelector: ".tab-content" }],
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood/templates/npc-sheet.html" },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

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
    // Editable-only listeners can be added here as needed.
  }

  /* -------------------------------------------- */

}
