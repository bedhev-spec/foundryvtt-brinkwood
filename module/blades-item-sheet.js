/**
 * Extend the basic ItemSheet – uses ItemSheetV2 (ApplicationV2 lifecycle).
 * @extends {ItemSheetV2}
 */
import { BladesActiveEffect } from "./blades-active-effect.js";
import { lockSheetFormControls } from "./blades-sheet.js";
import { captureSheetViewState, restoreSheetViewState } from "./sheet-view-state.js";

/** Brinkwood item fields, including Load, remain GM-authored. */
export function prepareItemSheetPermissions(doc, { isGM = game.user.isGM, sheetEditable = true } = {}) {
  const canEditFields = Boolean(isGM && sheetEditable);

  return {
    canEditFields,
    canEditLoad: canEditFields,
  };
}

export class BladesItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
) {

  /**
   * Supported item-type → template mapping.
   * Simple types all share the same template.
   */
  static SIMPLE_TYPES = new Set(["profession", "upbringing", "crew_reputation", "associates", "mask", "pact"]);

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "item"],
    position: { width: 560, height: 700 },
    window: { resizable: true },
    form: { closeOnSubmit: false, submitOnChange: true },
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
    context.item     = doc;
    context.isGM     = game.user.isGM;
    context.owner    = doc.isOwner;
    const permissions = prepareItemSheetPermissions(doc, { sheetEditable: this.isEditable });
    context.editable = permissions.canEditFields;
    context.canEditLoad = permissions.canEditLoad;
    context.cssClass = permissions.canEditFields ? "editable" : "locked";
    context.effects  = await BladesActiveEffect.prepareActiveEffectCategories(doc.effects, { owner: doc });
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { async: true, relativeTo: doc, secrets: doc.isOwner }
    );
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._itemSheetListenerController?.abort();
    this._itemSheetListenerController = new AbortController();
    const listenerOptions = { signal: this._itemSheetListenerController.signal };
    const html = this.element;
    this._bindEffectDisclosureState?.(html);

    if (!context.editable) {
      lockSheetFormControls(html);
      return;
    }

    html.querySelectorAll('[data-action="editImage"][role="button"]').forEach(el =>
      el.addEventListener("keydown", event => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        event.currentTarget.click();
      }, listenerOptions)
    );

    // Active effect controls - use data-effect-action to avoid AppV2 action dispatch.
    // Mutations are serialized per control so a rapid double-click cannot issue
    // duplicate embedded-document requests.
    html.querySelectorAll(".effect-control[data-effect-action]").forEach(el =>
      el.addEventListener("click", ev => this._onItemEffectControl(ev), listenerOptions)
    );
  }

  async _onItemEffectControl(ev) {
    const control = ev.currentTarget;
    if (!control || this._pendingItemEffectControls?.has(control)) return;
    const viewState = captureSheetViewState(this.element);
    this._pendingItemEffectControls ??= new WeakSet();
    this._pendingItemEffectControls.add(control);
    const wasDisabled = control.disabled;
    control.disabled = true;
    try {
      await BladesActiveEffect.onManageActiveEffect(ev, this.document, { gmOnly: true });
      // Do not resurrect a sheet which was closed while the mutation ran.
      if (!this._itemSheetListenerController?.signal.aborted && this.element?.isConnected) {
        await this.render({ force: true });
      }
    } catch (error) {
      ui.notifications?.error?.("Unable to update this item effect.");
    } finally {
      // Restore the actual Item-sheet form/window scroll owners after either
      // a successful replacement render or a failed reconciliation.
      if (!this._itemSheetListenerController?.signal.aborted && this.element?.isConnected) {
        restoreSheetViewState(this.element, viewState);
      }
      this._pendingItemEffectControls.delete(control);
      if (!this._itemSheetListenerController?.signal.aborted) control.disabled = wasDisabled;
    }
  }

  _bindEffectDisclosureState(html) {
    html.querySelectorAll('[data-effect-details-toggle]').forEach(toggle => {
      toggle.addEventListener("click", event => {
        event.preventDefault();
        const card = event.currentTarget.closest('[data-effect-id]');
        const details = card?.querySelector('[data-effect-details]');
        if (!details) return;
        details.hidden = !details.hidden;
        event.currentTarget.setAttribute("aria-expanded", String(!details.hidden));
      }, { signal: this._itemSheetListenerController?.signal });
    });
  }

  /* -------------------------------------------- */

}
