import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MASK_ACTOR_IMAGE,
  DEFAULT_NPC_ACTOR_IMAGE,
  maskActorImage,
  npcActorImage,
} from "../module/actor-images.js";

test("actor image helpers replace only Foundry's generic portrait", () => {
  for (const emptyImage of [undefined, null, "", "   ", "icons/svg/mystery-man.svg"]) {
    assert.equal(maskActorImage(emptyImage), DEFAULT_MASK_ACTOR_IMAGE);
    assert.equal(npcActorImage(emptyImage), DEFAULT_NPC_ACTOR_IMAGE);
  }

  const customPortrait = "worlds/test/images/custom-npc.webp";
  assert.equal(maskActorImage(customPortrait), customPortrait);
  assert.equal(npcActorImage(customPortrait), customPortrait);
  assert.notEqual(DEFAULT_NPC_ACTOR_IMAGE, DEFAULT_MASK_ACTOR_IMAGE);
});
