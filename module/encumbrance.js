const LOAD_LEVELS = Object.freeze([
  "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light",
  "BITD.Normal", "BITD.Normal", "BITD.Heavy", "BITD.Encumbered",
  "BITD.Encumbered", "BITD.Encumbered", "BITD.OverMax",
]);

const MULE_LOAD_LEVELS = Object.freeze([
  "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light",
  "BITD.Light", "BITD.Light", "BITD.Normal", "BITD.Normal",
  "BITD.Heavy", "BITD.Encumbered", "BITD.OverMax",
]);

/** Return the localized encumbrance key for an already-calculated loadout. */
export function encumbranceLevelForLoadout(loadout, hasMule) {
  const normalizedLoadout = Math.max(0, Math.min(10, loadout));
  return (hasMule ? MULE_LOAD_LEVELS : LOAD_LEVELS)[normalizedLoadout];
}

/** Mule is an ability rule shared by Character and Mask sheets. */
export function hasMuleAbility(items) {
  return items.some(item => item.type === "ability" && item.name === "(C) Mule");
}
