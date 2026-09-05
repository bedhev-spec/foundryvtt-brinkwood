import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  documents: {
    Actor: class {
      constructor(items = []) {
        this.items = items;
      }

      async deleteEmbeddedDocuments(_embeddedName, ids) {
        const sourceKeys = new Set(this.items
          .filter(item => ids.includes(item.id ?? item._id) && item.type === "mask")
          .map(item => `mask:${item.id ?? item._id}`));
        this.items = this.items.filter(item => {
          if (ids.includes(item.id ?? item._id)) return false;
          const grant = item.flags?.brinkwood?.traitGrant;
          return !sourceKeys.has(`${grant?.sourceItemType}:${grant?.sourceItemId}`);
        });
      }

      async _onCreateEmbeddedDocuments() {}
      async _onDeleteEmbeddedDocuments() {}
    },
  },
  abstract: { TypeDataModel: class {} },
  data: { fields: {} },
  utils: { deepClone: value => structuredClone(value) },
};
globalThis.game = { packs: new Map() };

const { BladesActor } = await import("../module/blades-actor.js");

const grantFor = (id, sourceId, name) => ({
  id,
  type: "trait",
  name,
  flags: { brinkwood: { traitGrant: {
    sourceItemId: sourceId,
    sourceItemType: "mask",
    traitSourceId: `source-${id}`,
  } } },
});

function configuredActor({ failRepair = false } = {}) {
  const oldMask = { id: "mask-old", type: "mask", name: "Judgement", system: { logic: "" } };
  const oldGrant = grantFor("trait-old", oldMask.id, "Old automatic trait");
  const manualTrait = { id: "trait-manual", type: "trait", name: "Custom", flags: {} };
  const actor = new BladesActor([oldMask, oldGrant, manualTrait]);
  actor.system = { experience: { value: 6 }, essence: { value: 3 } };
  actor._modActionPoints = async () => {};
  let createCount = 0;
  actor.createEmbeddedDocuments = async (_type, [data], operation) => {
    assert.equal(operation?.brinkwoodConfigureMask, true);
    createCount += 1;
    const source = { ...data, id: `mask-new-${createCount}` };
    actor.items.push(source, grantFor(`trait-new-${createCount}`, source.id, "New automatic trait"));
    return [source];
  };
  actor.syncTraitGrantsForSources = async () => {
    if (failRepair) throw new Error("grant repair failed");
  };
  return { actor, oldMask, oldGrant, manualTrait };
}

test("Mask configuration replaces its source and tagged grant but preserves persistent state and manual traits", async () => {
  const { actor, manualTrait } = configuredActor();

  await BladesActor.prototype.configureMask.call(actor, {
    type: "mask",
    name: "Violence",
    system: { logic: "" },
  });

  assert.deepEqual(actor.items.filter(item => item.type === "mask").map(item => item.name), ["Violence"]);
  assert.deepEqual(actor.items.filter(item => item.flags?.brinkwood?.traitGrant).map(item => item.id), ["trait-new-1"]);
  assert.equal(actor.items.includes(manualTrait), true);
  assert.deepEqual(actor.system, { experience: { value: 6 }, essence: { value: 3 } });
});

test("Mask configuration rolls back the new source when its trait grant cannot be established", async () => {
  const { actor, oldMask, oldGrant, manualTrait } = configuredActor({ failRepair: true });

  await assert.rejects(
    BladesActor.prototype.configureMask.call(actor, { type: "mask", name: "Violence", system: {} }),
    /grant repair failed/,
  );

  assert.deepEqual(actor.items, [oldMask, oldGrant, manualTrait]);
});

test("Mask configuration rejects non-Mask picker data", async () => {
  const { actor } = configuredActor();
  await assert.rejects(
    BladesActor.prototype.configureMask.call(actor, { type: "trait", name: "Nope" }),
    /requires an Item of type 'mask'/,
  );
});

test("concurrent Mask configuration requests serialize to one final source", async () => {
  const { actor, manualTrait } = configuredActor();

  await Promise.all([
    BladesActor.prototype.configureMask.call(actor, { type: "mask", name: "Terror", system: {} }),
    BladesActor.prototype.configureMask.call(actor, { type: "mask", name: "Violence", system: {} }),
  ]);

  assert.deepEqual(actor.items.filter(item => item.type === "mask").map(item => item.name), ["Violence"]);
  assert.deepEqual(actor.items.filter(item => item.flags?.brinkwood?.traitGrant).map(item => item.id), ["trait-new-2"]);
  assert.equal(actor.items.includes(manualTrait), true);
});

test("Judgement configuration grants Judgment traits and replaces only source-tagged traits", async () => {
  const oldMask = { id: "mask-old", type: "mask", name: "Violence", system: {} };
  const oldGrant = grantFor("trait-old", oldMask.id, "Old automatic trait");
  const manualTrait = {
    id: "trait-manual",
    type: "trait",
    name: "Pronounce Sentence",
    system: { class: "Judgment" },
    flags: {},
  };
  const judgmentTrait = {
    id: "trait-judgment",
    type: "trait",
    name: "Pronounce Sentence",
    system: { class: "Judgment", description: "A Mask judgement trait." },
    toObject() {
      return {
        type: this.type,
        name: this.name,
        system: structuredClone(this.system),
        flags: {},
      };
    },
  };
  game.packs.clear();
  game.packs.set("brinkwood.trait", { getDocuments: async () => [judgmentTrait] });

  const actor = new BladesActor([oldMask, oldGrant, manualTrait]);
  actor.system = { experience: { value: 6 }, essence: { value: 3 } };
  actor._modActionPoints = async () => {};
  let nextId = 0;
  actor.createEmbeddedDocuments = async (_type, data) => {
    const created = data.map(entry => ({ ...structuredClone(entry), id: `created-${++nextId}` }));
    actor.items.push(...created);
    for (const source of created.filter(entry => entry.type === "mask")) {
      await BladesActor.prototype._addTraits.call(actor, source);
    }
    return created;
  };

  await BladesActor.prototype.configureMask.call(actor, {
    type: "mask",
    name: "Judgement",
    system: {},
  });

  assert.deepEqual(actor.items.filter(item => item.type === "mask").map(item => item.name), ["Judgement"]);
  assert.equal(actor.items.includes(oldGrant), false);
  assert.equal(actor.items.includes(manualTrait), true);
  assert.equal(manualTrait.flags.brinkwood?.traitGrant, undefined);
  const automaticTraits = actor.items.filter(item => item.flags?.brinkwood?.traitGrant);
  assert.equal(automaticTraits.length, 1);
  assert.equal(automaticTraits[0].name, "Pronounce Sentence");
  assert.deepEqual(automaticTraits[0].flags.brinkwood.traitGrant, {
    sourceItemId: "created-1",
    sourceItemType: "mask",
    traitSourceId: "trait-judgment",
  });
  assert.deepEqual(actor.system, { experience: { value: 6 }, essence: { value: 3 } });
});
