import { escapeHTML } from "./html-utils.js";

function formatTooltipDescription(description) {
  const match = description.match(/^<p(?:\s[^>]*)?>([\s\S]*)<\/p>$/i);
  if (!match || (description.match(/<p(?:\s[^>]*)?>/gi) ?? []).length !== 1) return description;

  const sentences = match[1]
    .split(/(?<=[.!?])\s+(?=(?:<[^>]+>)*[A-ZÀ-ÖØ-Þ])/u)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  if (sentences.length < 3) return description;

  const paragraphs = [];
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(`<p>${sentences.slice(index, index + 2).join(" ")}</p>`);
  }
  return paragraphs.join("");
}

function renderTooltipDescriptionBlock(description, enrichDescription) {
  const enriched = String(enrichDescription(String(description ?? "")) ?? "").trim();
  if (!enriched) return "";
  return `<div class="brinkwood-item-tooltip__description">${formatTooltipDescription(enriched)}</div>`;
}

export function renderDescriptionTooltip(
  description,
  enrichDescription = value => `<p>${escapeHTML(value)}</p>`,
) {
  const descriptionBlock = renderTooltipDescriptionBlock(description, enrichDescription);
  if (!descriptionBlock) return "";
  return `<section class="brinkwood-item-tooltip brinkwood-item-tooltip--description-only">${descriptionBlock}</section>`;
}

/**
 * Render the information shown by an item-picker help control.
 *
 * `enrichDescription` is deliberately supplied by the Foundry caller: it
 * can use Foundry's rich-text enricher while keeping this formatter testable and
 * safe when used outside a rendered Foundry application.
 */
export function renderItemTooltip(
  item,
  localize = key => key,
  enrichDescription = escapeHTML,
  { includeStats = true } = {},
) {
  const system = item?.system ?? {};
  const fields = [
    ["BITD.Load", system.load],
    ["BITD.Uses", system.uses],
    ["BITD.NumberAvailable", system.num_available],
    ["BITD.Class", system.class]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  const rows = includeStats ? fields.map(([label, value]) => `
    <div class="brinkwood-item-tooltip__stat">
      <span>${escapeHTML(localize(label))}</span>
      <strong>${escapeHTML(value)}</strong>
    </div>`).join("") : "";
  const additionalInfo = String(system.additional_info ?? "").trim();
  const description = renderTooltipDescriptionBlock(system.description, enrichDescription);

  return `
    <section class="brinkwood-item-tooltip">
      <header>${escapeHTML(localize(item?.name ?? ""))}</header>
      ${rows ? `<div class="brinkwood-item-tooltip__stats">${rows}</div>` : ""}
      ${description}
      ${additionalInfo ? `<p>${escapeHTML(additionalInfo)}</p>` : ""}
    </section>`;
}
