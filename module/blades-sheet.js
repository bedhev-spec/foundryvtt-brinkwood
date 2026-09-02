/**
 * Base BladesSheet – extends ActorSheetV2 (ApplicationV2 lifecycle).
 * Provides shared context building, common listeners, and shared helpers for
 * all actor sheets in the Brinkwood system.
 */

import { BladesHelpers } from "./blades-helpers.js";
import { escapeHTML } from "./html-utils.js";
import { renderItemTooltip } from "./item-tooltip.js";
import { showRollStatistics } from "./roll-statistics.js";

export function lockSheetFormControls(html) {
  html.querySelectorAll("input, select").forEach(control => {
    control.disabled = true;
    control.setAttribute("aria-disabled", "true");
  });
  html.querySelectorAll("textarea").forEach(control => {
    control.readOnly = true;
    control.setAttribute("aria-readonly", "true");
  });
}

/** Read checked item picker inputs from either DialogV2 callback root. */
export function readItemPickerSelection(button, dialog) {
  const roots = [button?.form, dialog?.element?.querySelector("form")].filter(Boolean);
  for (const root of roots) {
    const selected = root.querySelectorAll(".items-to-add input:checked");
    if (root.querySelector(".items-to-add")) return Array.from(selected, input => input.value);
  }
  return [];
}

export class BladesSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {

  static DEFAULT_OPTIONS = {
    classes: ["brinkwood", "sheet", "actor"],
    form: { submitOnChange: true },
  };

  /* -------------------------------------------- */

  /**
   * Build the Handlebars context that mirrors the v1 getData() flat structure
   * so existing templates continue to work without modification.
   * @override
   */
  async _prepareContext(options) {
    const doc = this.document;
    const context = doc.toObject();                          // _id, name, img, type, system, …
    context.actor = this.actor;
    context.tabs = { primary: this.tabGroups.primary };
    context.items    = doc.items.map(i => i.toObject());    // plain-object items for templates
    context.isGM     = game.user.isGM;
    context.owner    = doc.isOwner;
    context.editable = this.isEditable;
    context.cssClass = this.isEditable ? "editable" : "locked";
    context.limited  = doc.limited;
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Set up common DOM event listeners after each render.
   * Replaces the v1 activateListeners(html) pattern.
   * @override
   */
  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = this.element;
    if (!this.isEditable) lockSheetFormControls(html);
    this._brinkwoodListenerController?.abort();
    this._brinkwoodListenerController = new AbortController();
    const listenerOptions = { signal: this._brinkwoodListenerController.signal };

    html.querySelectorAll('[role="tab"][data-action="tab"]').forEach(tab =>
      tab.addEventListener("keydown", event => {
        const tabs = Array.from(tab.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]') ?? []);
        if (!tabs.length) return;
        const current = tabs.indexOf(event.currentTarget);
        const key = event.key;
        const target = key === "Home" ? tabs[0]
          : key === "End" ? tabs.at(-1)
          : key === "ArrowRight" || key === "ArrowDown" ? tabs[(current + 1) % tabs.length]
          : key === "ArrowLeft" || key === "ArrowUp" ? tabs[(current - 1 + tabs.length) % tabs.length]
          : null;
        if (!target) return;
        event.preventDefault();
        tabs.forEach(control => { control.tabIndex = control === target ? 0 : -1; });
        target.focus();
        target.click();
      }, listenerOptions)
    );

    html.querySelectorAll('[data-action="editImage"][role="button"]').forEach(image =>
      image.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.currentTarget.click();
      }, listenerOptions)
    );

    if (this.isEditable) {
      html.querySelectorAll(".item-add-popup").forEach(el =>
        el.addEventListener("click", this._onItemAddClick.bind(this), listenerOptions)
      );
      html.querySelectorAll(".update-box").forEach(el =>
        el.addEventListener("click", this._onUpdateBoxClick.bind(this), listenerOptions)
      );
      html.querySelectorAll(".item-select").forEach(el =>
        el.addEventListener("click", this._onItemSelect.bind(this), listenerOptions)
      );
    }
    html.querySelectorAll(".roll-die-attribute").forEach(el =>
      el.addEventListener("click", this._onRollAttributeDieClick.bind(this), listenerOptions)
    );
    html.querySelectorAll(".roll-statistics-control").forEach(el =>
      el.addEventListener("click", () => showRollStatistics(), listenerOptions)
    );
  }

  /* -------------------------------------------- */

  async _onItemAddClick(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const el        = event.currentTarget;
    const item_type = el.dataset.itemType;
    const distinct  = el.dataset.distinct;
    const input_type = distinct !== undefined ? "radio" : "checkbox";

    const items = await BladesHelpers.getAllItemsByType(item_type, game);

    let htmlContent = `<form><div class="items-to-add">`;
    items.forEach(e => {
      let addition_price_load = ``;
      if (typeof e.system.load !== "undefined") {
        addition_price_load += `(${e.system.load})`;
      } else if (typeof e.system.price !== "undefined") {
        addition_price_load += `(${e.system.price})`;
      }
      const itemId = escapeHTML(e._id);
      const itemName = escapeHTML(game.i18n.localize(e.name));
      const itemDetails = escapeHTML(addition_price_load);
      const itemTooltip = escapeHTML(renderItemTooltip(e, key => game.i18n.localize(key)));
      const itemTooltipLabel = escapeHTML(game.i18n.localize("BITD.ItemDetails"));
      htmlContent += `<div class="item-picker-row">
        <input id="select-item-${itemId}" type="${input_type}" name="select_items" value="${itemId}">
        <label class="flex-horizontal" for="select-item-${itemId}">
          <span>${itemName}</span><span class="item-picker-row__detail">${itemDetails}</span>
        </label>
        <i class="tooltip fas fa-question-circle" tabindex="0" aria-label="${itemTooltipLabel}"
          data-tooltip-html="${itemTooltip}" data-tooltip-class="brinkwood-item-tooltip-shell"
          data-tooltip-direction="RIGHT"></i>
      </div>`;
    });
    htmlContent += `</div></form>`;

    const selectedIds = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${game.i18n.localize("Add")} ${item_type}` },
      content: htmlContent,
      ok: {
        label: game.i18n.localize("Add"),
        callback: (_event, button, dialog) => readItemPickerSelection(button, dialog),
      },
      rejectClose: false,
    });

    if (!selectedIds?.length) return;
    const itemsToAdd = items
      .filter(item => selectedIds.includes(item._id))
      .map(item => {
        const data = foundry.utils.deepClone(item);
        delete data._id;
        return data;
      });
    await this.document.createEmbeddedDocuments("Item", itemsToAdd);
  }

  /* -------------------------------------------- */

  async _onItemSelect(event) {
    if (!this.isEditable) return;
    const dataset  = event.currentTarget.dataset;
    const item     = this.actor.getEmbeddedDocument("Item", dataset.itemId);
    let update_data = {};
    switch (item.type) {
      case "trait":
        update_data = { "system.purchased": !item.system.purchased };
        break;
      case "item":
        update_data = { "system.equipped": !item.system.equipped };
        break;
    }
    await item.update(update_data);
  }

  /* -------------------------------------------- */

  async _onRollAttributeDieClick(event) {
    const target          = event.currentTarget;
    const attribute_name  = target.dataset.rollAttribute;
    const attribute_label = target.dataset.rollAttributeLabel;
    const attribute_value = parseInt(target.dataset.rollValue);
    this.actor.rollAttributePopup(attribute_name, attribute_label, attribute_value);
  }

  /* -------------------------------------------- */

  async _onUpdateBoxClick(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const el          = event.currentTarget;
    const item_id     = el.dataset.item;
    let   update_value = el.dataset.value;
    const update_type  = el.dataset.utype;

    if (update_value === undefined) {
      update_value = this.element.querySelector(`#fac-${update_type}-${item_id}`)?.value;
    }
    if (update_value === undefined) return;

    let update;
    if (update_type === "status") {
      update = { _id: item_id, system: { status: { value: update_value } } };
    } else if (update_type === "hold") {
      update = { _id: item_id, system: { hold:   { value: update_value } } };
    } else {
      return;
    }
    await this.actor.updateEmbeddedDocuments("Item", [update]);
  }

  /* -------------------------------------------- */

  /**
   * Attach localisation label / desc keys to the attributes object in-place.
   * Called by subclasses during _prepareContext.
   */
  setAttrLabels(attrs, type = "Actor") {
    for (const attr in attrs) {
      const attr_name = attr[0].toUpperCase() + attr.slice(1);
      attrs[attr]["label"] = `${type}.Actions.${attr_name}.Name`;
      attrs[attr]["desc"]  = `${type}.Actions.${attr_name}.Description`;
      for (const skill in attrs[attr].skills) {
        const skill_name = skill[0].toUpperCase() + skill.slice(1);
        attrs[attr].skills[skill]["label"] = `${type}.Actions.${skill_name}.Name`;
        attrs[attr].skills[skill]["desc"]  = `${type}.Actions.${skill_name}.Description`;
      }
    }
  }

  /* -------------------------------------------- */

}
