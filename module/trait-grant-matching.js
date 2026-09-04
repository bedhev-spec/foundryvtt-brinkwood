/** Normalize published source names before comparing Mask and Trait classes. */
export const normalizedTraitSourceName = value => String(value ?? "")
  .trim()
  .toLocaleLowerCase()
  .replace(/^judgement$/, "judgment");

/** Read the supported Foundry compendium provenance locations from a document. */
export function compendiumSourceMetadata(item) {
  return [
    item?.uuid,
    item?.flags?.core?.sourceId,
    item?._stats?.compendiumSource,
    item?.getFlag?.("core", "sourceId"),
  ].filter(value => typeof value === "string" && value.length);
}

/** Determine whether an embedded Trait came from this exact compendium Trait. */
export function traitHasCompendiumProvenance(embeddedTrait, compendiumTrait) {
  const compendiumId = compendiumTrait?.id ?? compendiumTrait?._id;
  const expectedSources = new Set(compendiumSourceMetadata(compendiumTrait));
  if (compendiumId) expectedSources.add(compendiumId);
  return compendiumSourceMetadata(embeddedTrait).some(source =>
    expectedSources.has(source) || (compendiumId && source.endsWith(`.${compendiumId}`))
  );
}
