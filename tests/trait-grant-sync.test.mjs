import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  documents: { Actor: class {
    constructor(items = []) {
      this.items = items;
      this.databaseDeletes = [];
    }

    async deleteEmbeddedDocuments(embeddedName, ids, operation = {}) {
      const removed = this.items.filter(item => ids.includes(item.id ?? item._id));
      this.databaseDeletes.push([embeddedName, ids, operation]);
      this.items = this.items.filter(item => !ids.includes(item.id ?? item._id));
      // Foundry invokes lifecycle callbacks during the database operation, but
      // their asynchronous follow-up work is not the sheet's deletion promise.
      this._onDeleteEmbeddedDocuments(embeddedName, removed, ids, operation, "gm-user");
      return removed;
    }

    async _onCreateEmbeddedDocuments() {}
    async _onDeleteEmbeddedDocuments() {}
  } },
  abstract: { TypeDataModel: class {} },
  data: { fields: {} }
};
globalThis.game = { packs: new Map() };

const { BladesActor } = await import("../module/blades-actor.js");

function compendiumTrait(id, name, sourceName) {
  return {
    id,
    type: "trait",
    system: { class: sourceName },
    toObject: () => ({ _id: id, name, type: "trait", system: { class: sourceName } })
  };
}

test("upbringing/profession traits are found without an indexed compendium query and tagged to their source", async () => {
  const apprenticeTrait = compendiumTrait("trait-apprentice", "Keen Eye", "Apprentice");
  const otherTrait = compendiumTrait("trait-other", "Other", "Other");
  game.packs.set("brinkwood.trait", { getDocuments: async () => [apprenticeTrait, otherTrait] });
  const creates = [];
  const actor = {
    items: [],
    createEmbeddedDocuments: async (type, data) => creates.push({ type, data })
  };

  await BladesActor.prototype._addTraits.call(actor, { id: "upbringing-1", type: "upbringing", name: "Apprentice" });

  assert.equal(creates.length, 1);
  assert.equal(creates[0].type, "Item");
  assert.deepEqual(creates[0].data[0].flags.brinkwood.traitGrant, {
    sourceItemId: "upbringing-1",
    sourceItemType: "upbringing",
    traitSourceId: "trait-apprentice"
  });
  assert.equal(creates[0].data[0]._id, undefined);
});

test("trait grants are idempotent and removal preserves untagged/manual traits", async () => {
  const trait = compendiumTrait("trait-apprentice", "Keen Eye", "Apprentice");
  game.packs.set("brinkwood.trait", { getDocuments: async () => [trait] });
  const creates = [];
  const deletes = [];
  const actor = {
    items: [
      { id: "granted", type: "trait", flags: { brinkwood: { traitGrant: { sourceItemId: "upbringing-1", sourceItemType: "upbringing", traitSourceId: "trait-apprentice" } } } },
      { id: "manual", type: "trait", system: { class: "Apprentice" }, flags: {} },
      { id: "profession-grant", type: "trait", flags: { brinkwood: { traitGrant: { sourceItemId: "profession-1", sourceItemType: "profession", traitSourceId: "trait-apprentice" } } } }
    ],
    createEmbeddedDocuments: async (...args) => creates.push(args),
    deleteEmbeddedDocuments: async (...args) => deletes.push(args)
  };
  const source = { id: "upbringing-1", type: "upbringing", name: "Apprentice" };

  await BladesActor.prototype._addTraits.call(actor, source);
  await BladesActor.prototype._deleteTraits.call(actor, source);

  assert.equal(creates.length, 0);
  assert.deepEqual(deletes, [["Item", ["granted"]]]);
});

test("batch removal deletes only grants belonging to each removed upbringing or profession", async () => {
  const deletes = [];
  const actor = {
    items: [
      { id: "upbringing-grant", type: "trait", flags: { brinkwood: { traitGrant: { sourceItemId: "upbringing-1", sourceItemType: "upbringing" } } } },
      { id: "profession-grant", type: "trait", flags: { brinkwood: { traitGrant: { sourceItemId: "profession-1", sourceItemType: "profession" } } } },
      { id: "other-upbringing-grant", type: "trait", flags: { brinkwood: { traitGrant: { sourceItemId: "upbringing-2", sourceItemType: "upbringing" } } } },
      { id: "manual-shared-trait", type: "trait", flags: {} }
    ],
    deleteEmbeddedDocuments: async (...args) => deletes.push(args)
  };

  await BladesActor.prototype._deleteTraits.call(actor, { id: "upbringing-1", type: "upbringing" });
  await BladesActor.prototype._deleteTraits.call(actor, { id: "profession-1", type: "profession" });

  assert.deepEqual(deletes, [
    ["Item", ["upbringing-grant"]],
    ["Item", ["profession-grant"]]
  ]);
});

test("the sheet's public deletion path awaits removal of only the source's granted traits", async () => {
  const upbringing = { id: "upbringing-1", type: "upbringing", name: "Apprentice", system: { logic: "" } };
  const actor = new BladesActor([
    upbringing,
    { id: "granted", type: "trait", flags: { brinkwood: { traitGrant: {
      sourceItemId: upbringing.id,
      sourceItemType: upbringing.type,
      traitSourceId: "trait-apprentice"
    } } } },
    { id: "manual", name: "Keen Eye", type: "trait", system: { class: "Apprentice" }, flags: {} },
    { id: "other-grant", type: "trait", flags: { brinkwood: { traitGrant: {
      sourceItemId: "profession-1",
      sourceItemType: "profession",
      traitSourceId: "trait-apprentice"
    } } } }
  ]);
  actor._modActionPoints = async () => {};

  // This is the exact API and identifier payload used by the sheet click.
  await actor.deleteEmbeddedDocuments("Item", [upbringing.id]);

  assert.deepEqual(actor.databaseDeletes.map(([, ids]) => ids), [
    [upbringing.id, "granted"]
  ]);
  assert.deepEqual(actor.items.map(item => item.id), ["manual", "other-grant"]);
});

test("reconciliation backfills only existing upbringing and profession choices", async () => {
  const sources = [
    { type: "upbringing", name: "Apprentice" },
    { type: "profession", name: "Ascetic" },
    { type: "mask", name: "The Fox" },
    { type: "class", name: "Rebel" }
  ];
  const added = [];
  const actor = {
    items: sources,
    _addTraits: async item => added.push(item.name)
  };

  await BladesActor.prototype.reconcileTraitGrants.call(actor);

  assert.deepEqual(added, ["Apprentice", "Ascetic"]);
});
