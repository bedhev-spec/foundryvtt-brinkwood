
import { BladesSheet } from "./blades-sheet.js";

/**
 * @extends {BladesSheet}
 */
export class BladesNPCSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "npc"],
    position: { width: 640 },
    form: { submitOnChange: true },
    window: { resizable: true },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood/templates/npc-sheet.html" },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );
    context.enrichedNotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.notes,
      { async: true, relativeTo: this.document, secrets: this.document.isOwner }
    );

    return context;
  }
}
