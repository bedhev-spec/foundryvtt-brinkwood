export const DEFAULT_MASK_ACTOR_IMAGE = "systems/brinkwood/styles/assets/icons/mask-actor-default.png";
export const DEFAULT_NPC_ACTOR_IMAGE = "systems/brinkwood/styles/assets/icons/npc-actor-default.png";

const FOUNDRY_DEFAULT_ACTOR_IMAGE = "icons/svg/mystery-man.svg";

function actorImageOrDefault(image, fallback) {
  const current = String(image ?? "").trim();
  return !current || current === FOUNDRY_DEFAULT_ACTOR_IMAGE ? fallback : current;
}

/** Preserve custom portraits while replacing Foundry's generic Actor image. */
export function maskActorImage(image) {
  return actorImageOrDefault(image, DEFAULT_MASK_ACTOR_IMAGE);
}

/** Preserve custom portraits while replacing Foundry's generic NPC image. */
export function npcActorImage(image) {
  return actorImageOrDefault(image, DEFAULT_NPC_ACTOR_IMAGE);
}
