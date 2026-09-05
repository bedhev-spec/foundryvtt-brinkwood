import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  documents: {
    Item: class {
      async _preCreate() {}
    },
  },
  abstract: { TypeDataModel: class {} },
  data: { fields: {} },
};
globalThis.game = { user: { id: "current-user" } };

const { BladesItem } = await import("../module/blades-item.js");

function parentWith(items) {
  const deleted = [];
  return {
    documentName: "Actor",
    items,
    deleteEmbeddedDocuments: async (...args) => { deleted.push(args); },
    deleted,
  };
}

test("configured Mask creation bypasses the legacy distinct-item deletion", async () => {
  const parent = parentWith([{ id: "mask-old", type: "mask", name: "Terror" }]);

  await BladesItem.prototype._preCreate.call(
    { parent },
    { type: "mask", name: "Violence" },
    { brinkwoodConfigureMask: true },
    game.user,
  );

  assert.deepEqual(parent.deleted, []);
});

test("ordinary distinct Mask creation still removes the prior Mask", async () => {
  const parent = parentWith([{ id: "mask-old", type: "mask", name: "Terror" }]);

  await BladesItem.prototype._preCreate.call(
    { parent },
    { type: "mask", name: "Violence" },
    {},
    game.user,
  );

  assert.deepEqual(parent.deleted, [["Item", ["mask-old"]]]);
});
