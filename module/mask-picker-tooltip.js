import { escapeHTML } from "./html-utils.js";

/**
 * Mask selection is configuration, not an inventory comparison. Its picker
 * tooltip therefore presents only the localized Mask name and rich-text rule
 * description instead of serializing generic item system fields.
 */
export function renderMaskPickerTooltip(item, enrichedDescription) {
  const name = escapeHTML(game.i18n.localize(item.name));
  return `<section class="mask-picker-tooltip"><h3>${name}</h3>${enrichedDescription}</section>`;
}
