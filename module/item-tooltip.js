import { escapeHTML } from "./html-utils.js";

const TYPE_GRANT_SUMMARY_KEYS = Object.freeze({
  upbringing: "BITD.UpbringingGrantSummary",
  profession: "BITD.ProfessionGrantSummary",
  class: "BITD.ClassGrantSummary"
});

export function renderItemTooltip(item, localize = key => key) {
  const system = item?.system ?? {};
  const grantSummaryKey = TYPE_GRANT_SUMMARY_KEYS[item?.type];
  const fields = [
    ["BITD.Load", system.load],
    ["BITD.Uses", system.uses],
    ["BITD.NumberAvailable", system.num_available],
    ["BITD.Class", system.class]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  const rows = fields.map(([label, value]) => `
    <div class="brinkwood-item-tooltip__stat">
      <span>${escapeHTML(localize(label))}</span>
      <strong>${escapeHTML(value)}</strong>
    </div>`).join("");
  const additionalInfo = String(system.additional_info ?? "").trim();

  return `
    <section class="brinkwood-item-tooltip">
      <header>${escapeHTML(localize(item?.name ?? ""))}</header>
      <div class="brinkwood-item-tooltip__stats">${rows}</div>
      ${grantSummaryKey ? `<p>${escapeHTML(localize(grantSummaryKey))}</p>` : ""}
      ${additionalInfo ? `<p>${escapeHTML(additionalInfo)}</p>` : ""}
    </section>`;
}
