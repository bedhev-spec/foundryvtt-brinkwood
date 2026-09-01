
import { BladesSheet } from "./blades-sheet.js";
import {
  clockImagePath,
  clockValueAfterClick,
  normalizeClockState,
  preloadClockImages
} from "./clock-utils.js";

/**
 * Extend the basic BladesSheet for the Clock actor type.
 * @extends {BladesSheet}
 */
export class BladesClockSheet extends BladesSheet {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor", "clock"],
    position: { width: 700, height: 970 },
    form: { submitOnChange: true },
  };

  static PARTS = {
    sheet: { template: "systems/brinkwood/templates/actors/clock-sheet.html" },
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // v13: {{#select}} block helper removed — feed selectOptions a value map.
    context.clockSizes = { "4": "4", "6": "6", "8": "8" };
    await preloadClockImages(context.system.type);
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    this._clockSheetListenerController?.abort();
    if (!this.isEditable) return;
    this._clockSheetListenerController = new AbortController();
    const listenerOptions = { signal: this._clockSheetListenerController.signal };

    this.element.querySelectorAll('input[name="system.value"]').forEach(input =>
      input.addEventListener("click", this._onClockSegmentClick.bind(this), listenerOptions)
    );
  }

  async _onClockSegmentClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const value = clockValueAfterClick(
      event.currentTarget.value,
      this.actor.system.value,
      this.actor.system.type
    );
    if (value === null) return;

    await this._updateClock({
      "system.type": this.actor.system.type,
      "system.value": value
    });
  }

  /* -------------------------------------------- */

  /**
   * Override form submission to also update the prototype token texture and
   * any active scene tokens.  Fixes v13 texture field names
   * (texture.src / texture.scaleX / texture.scaleY / texture.tint, not the
   * old img / scale / mirrorX / mirrorY / tint / displayName).
   * @override
   */
  async _processSubmitData(event, form, submitData) {
    return this._updateClock(submitData);
  }

  async _updateClock(submitData) {
    const { type, value } = normalizeClockState(
      submitData["system.type"] ?? this.actor.system.type,
      submitData["system.value"] ?? this.actor.system.value
    );
    const image_path = clockImagePath(type, value);
    submitData["system.type"] = type;
    submitData["system.value"] = value;
    submitData["img"] = image_path;
    submitData["prototypeToken.texture.src"] = image_path;

    // Build token update payload using v13 texture field names
    const tokenUpdate = {
      "texture.src":    image_path,
      "texture.scaleX": 1,
      "texture.scaleY": 1,
      "texture.tint":   "",
      width:  1,
      height: 1,
    };

    const tokens = this.actor.getActiveTokens();
    if (tokens.length) {
      const updates = tokens.map(token => foundry.utils.mergeObject({ _id: token.id }, tokenUpdate));
      await foundry.documents.TokenDocument.updateDocuments(updates, { parent: game.scenes.current });
    }

    // Delegate the actor update to the base class
    return this.document.update(submitData);
  }

  /* -------------------------------------------- */

}
