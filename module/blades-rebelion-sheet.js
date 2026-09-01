
import { BladesSheet } from "./blades-sheet.js";

/**
 * Extend the basic BladesSheet for the Rebelion actor type.
 * @extends {BladesSheet}
 */
export class BladesRebelionSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "pc", "rebelion"],
    position: { width: 500, height: 870 },
    form: { submitOnChange: true },
    tabGroups: { primary: "overview" },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood/templates/rebelion-sheet.html" },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const decision_list = await game.packs.get("brinkwood.moot-decisions").getDocuments();
    context.system.aspects.forEach(a => {
      // Bug fix: use proper comparator instead of invalid .sort(d => d.rank)
      a.moot_decisions = decision_list
        .filter(d => d.system.aspect === a.name)
        .sort((a, b) => a.system.rank - b.system.rank);
    });

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = this.element;

    if (!this.isEditable) return;

    html.querySelectorAll(".dot-value").forEach(el =>
      el.addEventListener("click", this._onDotChange.bind(this))
    );
  }

  /* -------------------------------------------- */

  async _onDotChange(event) {
    event.preventDefault();
    const element   = event.currentTarget;
    const dataset   = element.dataset;

    const actor_data = foundry.utils.deepClone(this.actor.toObject());
    let new_value    = parseInt(dataset.value);
    const max_value  = parseInt(dataset.max_value);
    const old_value  = foundry.utils.getProperty(actor_data, dataset.path);

    if (new_value === old_value && new_value === 1) new_value = 0;
    if (new_value > max_value) new_value = max_value;

    foundry.utils.setProperty(actor_data, dataset.path, new_value);
    await this.actor.update(actor_data);
  }

  /* -------------------------------------------- */

}
