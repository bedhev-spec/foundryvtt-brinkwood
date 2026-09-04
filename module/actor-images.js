export const DEFAULT_MASK_ACTOR_IMAGE = "systems/brinkwood/styles/assets/icons/mask-actor-default.png";

const FOUNDRY_DEFAULT_ACTOR_IMAGE = "icons/svg/mystery-man.svg";

/** Preserve custom portraits while replacing Foundry's generic Actor image. */
export function maskActorImage(image) {
  const current = String(image ?? "").trim();
  return !current || current === FOUNDRY_DEFAULT_ACTOR_IMAGE
    ? DEFAULT_MASK_ACTOR_IMAGE
    : current;
}
