import { BladesActorSheet } from "./blades-actor-sheet.js";

export class BladesActorSheetV2 extends BladesActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "pc", "character", "character-v2"],
    position: { width: 800, height: 900 },
    form: { submitOnChange: true },
    tabGroups: { primary: "traits" },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood/templates/actor-sheet-v2.html" },
  };
}
