import assert from "node:assert/strict";
import test from "node:test";

// The projection and handler are deliberately exported from the shared sheet.
// Stub only its ApplicationV2 inheritance so they can be tested outside Foundry.
globalThis.foundry ??= {};
class DataField {
  constructor(options = {}) {
    this.options = options;
  }
}
class SchemaField extends DataField {
  constructor(schema, options = {}) {
    super(options);
    this.schema = schema;
  }
}
class ArrayField extends DataField {
  constructor(element, options = {}) {
    super(options);
    this.element = element;
  }
}
foundry.abstract ??= { TypeDataModel: class {} };
foundry.data ??= {};
foundry.data.fields ??= {
  ArrayField,
  BooleanField: DataField,
  HTMLField: DataField,
  NumberField: DataField,
  ObjectField: DataField,
  SchemaField,
  StringField: DataField,
};
foundry.applications ??= {};
foundry.applications.api ??= {};
foundry.applications.api.HandlebarsApplicationMixin ??= Base => Base;
foundry.applications.sheets ??= {};
foundry.applications.sheets.ActorSheetV2 ??= class {
  async _onRender() {}
};

const {
  bindLoadoutControls,
  calculateLoadoutWeight,
  onLoadoutItemLoadChange,
  onLoadoutItemLoadKeydown,
  onLoadoutLevelChange,
  onLoadoutItemOpen,
  onLoadoutItemToggle,
  prepareLoadoutCatalogue,
} = await import("../module/character/loadout.js");

test("load tier immediately projects capacity and overload state through the loadout owner", async () => {
  const attributes = new Map();
  const display = {
    textContent: "6/6",
    classList: { values: new Set(), toggle(name, enabled) { enabled ? this.values.add(name) : this.values.delete(name); } },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
  };
  const control = { value: "BITD.Normal" };
  const updates = [];
  const sheet = {
    isEditable: true,
    actor: { items: [{ type: "item", system: { equipped: true, load: 6 } }] },
    element: { querySelector: selector => selector === ".loadout__weight" ? display : null },
    document: { update: async (update, options) => updates.push({ update, options }) },
  };

  await onLoadoutLevelChange(sheet, { currentTarget: control });

  assert.equal(display.textContent, "6/5");
  assert.equal(display.classList.values.has("is-overloaded"), true);
  assert.equal(attributes.get("aria-label"), "6/5 — Overloaded");
  assert.equal(attributes.get("title"), "Overloaded");
  assert.deepEqual(updates, [{
    update: { "system.selected_load_level": "BITD.Normal" },
    options: { render: false },
  }]);
});

test("rapid load-tier changes serialize persistence and stale failure cannot roll back the latest choice", async () => {
  let rejectFirst;
  const firstUpdate = new Promise((_resolve, reject) => { rejectFirst = reject; });
  const persisted = [];
  const display = {
    textContent: "0/3",
    classList: { toggle() {} },
    setAttribute() {},
    removeAttribute() {},
  };
  const sheet = {
    isEditable: true,
    actor: { items: [], system: { selected_load_level: "BITD.Light" } },
    element: { querySelector: selector => selector === ".loadout__weight" ? display : null },
    document: {
      update(update) {
        persisted.push(update["system.selected_load_level"]);
        return persisted.length === 1 ? firstUpdate : Promise.resolve();
      },
    },
  };
  const normal = { value: "BITD.Normal" };
  const heavy = { value: "BITD.Heavy" };

  const first = onLoadoutLevelChange(sheet, { currentTarget: normal });
  const second = onLoadoutLevelChange(sheet, { currentTarget: heavy });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(persisted, ["BITD.Normal"], "the second write waits for the first");
  assert.equal(display.textContent, "0/6", "the latest selection owns the optimistic display");

  rejectFirst(new Error("stale failure"));
  await Promise.all([first, second]);

  assert.deepEqual(persisted, ["BITD.Normal", "BITD.Heavy"]);
  assert.equal(display.textContent, "0/6", "a stale failure cannot roll back the newer selection");
  assert.equal(heavy.value, "BITD.Heavy");
});

const standardItem = (id, name, load = 1) => ({
  _id: id, name, type: "item", system: { load }, flags: {},
});

test("loadout projection lists every standard entry without embedding unchecked items", () => {
  const catalogue = Array.from({ length: 27 }, (_, index) => standardItem(`standard-${index}`, `Item ${index}`));
  const rows = prepareLoadoutCatalogue(catalogue, []);

  assert.equal(rows.length, 27);
  assert.ok(rows.every(row => !row.selected && row.actorItemId === null));
});

test("loadout projection adopts legacy items, uses provenance, and keeps custom actor items", () => {
  const catalogue = [standardItem("rope", "Rope"), standardItem("lamp", "Lamp")];
  const owned = [
    { _id: "actor-rope", name: "Rope", type: "item", system: { load: 1, equipped: true }, flags: {} },
    { _id: "actor-lamp", name: "Renamed lamp", type: "item", system: { load: 4, equipped: false }, flags: { brinkwood: { loadoutSourceId: "lamp" } } },
    { _id: "custom", name: "Family keepsake", type: "item", system: { load: 1, equipped: true }, flags: {} },
  ];
  const rows = prepareLoadoutCatalogue(catalogue, owned);

  assert.equal(rows.length, 3);
  assert.deepEqual(rows.find(row => row.sourceId === "rope").actorItemId, "actor-rope");
  assert.equal(rows.find(row => row.sourceId === "rope").selected, true);
  assert.equal(rows.find(row => row.sourceId === "rope").system.load, 1);
  assert.deepEqual(rows.find(row => row.sourceId === "lamp").actorItemId, "actor-lamp");
  assert.equal(rows.find(row => row.sourceId === "lamp").system.load, 4);
  assert.equal(rows.find(row => row.sourceId === "custom").isCustom, true);
});

test("loadout weight includes only equipped items and remains bounded", () => {
  assert.equal(calculateLoadoutWeight([
    { type: "item", system: { equipped: true, load: "3" } },
    { type: "item", system: { equipped: false, load: 9 } },
    { type: "trait", system: { equipped: true, load: 9 } },
  ]), 3);
  assert.equal(calculateLoadoutWeight([{ type: "item", system: { equipped: true, load: 14 } }]), 10);
});

test("loadout checkbox updates an existing item once, preserves it when cleared, and respects permissions", async () => {
  const updates = [];
  const existing = {
    type: "item", id: "actor-rope", flags: { brinkwood: { loadoutSourceId: "rope" } },
    update: async update => updates.push(update),
  };
  const sheet = {
    isEditable: true,
    actor: { items: [existing] },
    document: { createEmbeddedDocuments: async () => assert.fail("existing source must not be duplicated") },
  };
  await onLoadoutItemToggle(sheet, { currentTarget: { checked: false, dataset: { loadoutSourceId: "rope" } } });
  await onLoadoutItemToggle(sheet, { currentTarget: { checked: true, dataset: { loadoutSourceId: "rope" } } });
  assert.deepEqual(updates, [{ "system.equipped": false }, { "system.equipped": true }]);

  sheet.isEditable = false;
  await onLoadoutItemToggle(sheet, { currentTarget: { checked: true, dataset: { loadoutSourceId: "rope" } } });
  assert.equal(updates.length, 2);
});

test("selecting an unchecked standard item creates one equipped embedded item with provenance", async () => {
  const created = [];
  const source = standardItem("spyglass", "Spyglass", 2);
  globalThis.game = {
    user: { isGM: true },
    user: { isGM: true },
    items: [],
    packs: [{ metadata: { name: "item" }, getDocuments: async () => [{ toObject: () => source }] }],
  };
  foundry.utils = { deepClone: value => structuredClone(value) };
  const sheet = {
    isEditable: true,
    actor: { items: [] },
    document: { createEmbeddedDocuments: async (_type, data) => created.push(...data) },
  };

  await onLoadoutItemToggle(sheet, {
    currentTarget: { checked: true, dataset: { loadoutSourceId: "spyglass" } },
  });

  assert.equal(created.length, 1);
  assert.equal(created[0]._id, undefined);
  assert.equal(created[0].system.equipped, true);
  assert.equal(created[0].flags.brinkwood.loadoutSourceId, "spyglass");
});

test("checkbox toggle snapshots currentTarget before catalogue resolution clears the browser event", async () => {
  const created = [];
  const source = standardItem("powder", "Black Powder", 1);
  const event = { currentTarget: { checked: true, dataset: { loadoutSourceId: "powder" } } };
  globalThis.game = {
    items: [],
    packs: [{
      metadata: { name: "item" },
      getDocuments: async () => {
        event.currentTarget = null;
        return [{ toObject: () => source }];
      },
    }],
  };
  foundry.utils = { deepClone: value => structuredClone(value) };
  const sheet = {
    isEditable: true,
    actor: { items: [] },
    document: { createEmbeddedDocuments: async (_type, data) => created.push(...data) },
  };

  await onLoadoutItemToggle(sheet, event);

  assert.equal(created.length, 1);
  assert.equal(created[0].system.equipped, true);
});

test("the rendered checkbox creates an equipped item from a v13 Map-like collection and the next context counts its load", async () => {
  class FakeCheckbox {
    constructor() {
      this.checked = true;
      this.dataset = { loadoutSourceId: "spyglass" };
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    async dispatchChange() {
      await this.listeners.get("change")?.({ currentTarget: this });
    }
  }

  const checkbox = new FakeCheckbox();
  const root = {
    querySelectorAll(selector) {
      return selector === ".loadout-item-select" ? [checkbox] : [];
    },
  };
  const items = new Map();
  const source = standardItem("spyglass", "Spyglass", 2);
  globalThis.game = {
    items: [],
    packs: [{ metadata: { name: "item" }, getDocuments: async () => [{ toObject: () => source }] }],
  };
  foundry.utils = { deepClone: value => structuredClone(value) };
  const renderedLoads = [];
  const sheet = {
    isEditable: true,
    element: root,
    actor: { items },
    document: {
      async createEmbeddedDocuments(_type, data) {
        const created = { ...data[0], _id: "actor-spyglass" };
        items.set(created._id, created);
        return [created];
      },
    },
    render: async () => renderedLoads.push(calculateLoadoutWeight(Array.from(items.values()))),
  };

  bindLoadoutControls(sheet, root, {});
  await checkbox.dispatchChange();

  assert.equal(items.size, 1);
  assert.equal(items.get("actor-spyglass").system.equipped, true);
  assert.equal(calculateLoadoutWeight(Array.from(items.values())), 2);
  assert.deepEqual(renderedLoads, [2]);
});

test("loadout open binding does not toggle or create, and respects GM edit permissions", async () => {
  class FakeOpenControl {
    constructor(dataset) {
      this.dataset = dataset;
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    async click() {
      const event = { prevented: false, preventDefault() { this.prevented = true; }, currentTarget: this };
      await this.listeners.get("click")?.(event);
      return event;
    }
  }

  const renders = [];
  const owned = {
    _id: "actor-spyglass",
    type: "item",
    flags: { brinkwood: { loadoutSourceId: "spyglass" } },
    sheet: { render: options => renders.push({ item: "owned", options }) },
  };
  const openOwned = new FakeOpenControl({ itemId: "actor-spyglass", loadoutSourceId: "spyglass" });
  const root = {
    querySelectorAll(selector) {
      return selector === ".loadout-item-open" ? [openOwned] : [];
    },
  };
  globalThis.game = { user: { isGM: false }, items: new Map(), packs: [] };
  const sheet = {
    isEditable: false,
    element: root,
    actor: { items: new Map([[owned._id, owned]]) },
    document: { createEmbeddedDocuments: async () => assert.fail("opening must not create an item") },
  };

  bindLoadoutControls(sheet, root, {});
  const event = await openOwned.click();
  assert.equal(event.prevented, true);
  assert.deepEqual(renders, [{ item: "owned", options: { force: true, editable: false } }]);

  const source = {
    _id: "catalogue-lantern",
    type: "item",
    flags: {},
    sheet: { render: options => renders.push({ item: "source", options }) },
  };
  let requestedSourceId;
  game.user.isGM = true;
  game.packs = [{
    metadata: { name: "item" },
    getDocument: async id => {
      requestedSourceId = id;
      return source;
    },
  }];

  await onLoadoutItemOpen(sheet, {
    preventDefault() {},
    currentTarget: { dataset: { loadoutSourceId: "catalogue-lantern" } },
  });
  assert.equal(requestedSourceId, "catalogue-lantern");
  assert.deepEqual(renders.at(-1), { item: "source", options: { force: true, editable: true } });
});

test("loadout load edits update owned items or create an unequipped actor copy only", async () => {
  const updates = [];
  const owned = {
    _id: "actor-rope",
    type: "item",
    flags: { brinkwood: { loadoutSourceId: "rope" } },
    update: async data => updates.push(data),
  };
  const created = [];
  const source = standardItem("lantern", "Lantern", 1);
  globalThis.game = {
    user: { isGM: true },
    items: [],
    packs: [{ metadata: { name: "item" }, getDocuments: async () => [{ toObject: () => source }] }],
  };
  foundry.utils = { deepClone: value => structuredClone(value) };
  const sheet = {
    isEditable: true,
    actor: { items: new Map([[owned._id, owned]]) },
    document: { createEmbeddedDocuments: async (_type, data) => created.push(...data) },
    render: async () => {},
  };

  await onLoadoutItemLoadChange(sheet, {
    currentTarget: { value: "4", dataset: { itemId: "actor-rope", loadoutSourceId: "rope" } },
  });
  await onLoadoutItemLoadChange(sheet, {
    currentTarget: { value: "2", dataset: { loadoutSourceId: "lantern" } },
  });

  assert.deepEqual(updates, [{ "system.load": 4 }]);
  assert.equal(created.length, 1);
  assert.equal(created[0].system.load, 2);
  assert.equal(created[0].system.equipped, false);
  assert.equal(created[0].flags.brinkwood.loadoutSourceId, "lantern");

  game.user.isGM = false;
  let restored = 0;
  sheet.render = async () => { restored += 1; };
  await onLoadoutItemLoadChange(sheet, {
    currentTarget: { value: "5", dataset: { itemId: "actor-rope", loadoutSourceId: "rope" } },
  });
  assert.equal(updates.length, 1);
  assert.equal(restored, 1);
});

test("Enter commits a load edit through its sole handler and suppresses form submission", async () => {
  let commits = 0;
  let blurred = false;
  const sheet = { isEditable: true, actor: {}, document: {}, render: async () => { commits += 1; } };
  const event = {
    key: "Enter",
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
    currentTarget: { blur: () => { blurred = true; } },
  };

  await onLoadoutItemLoadKeydown(sheet, event);

  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(commits, 1);
  assert.equal(blurred, true);
});

test("queued toggle and GM load edit reconcile one actor copy without duplicates", async () => {
  let releaseSource;
  const sourceReady = new Promise(resolve => { releaseSource = resolve; });
  const items = new Map();
  const source = standardItem("rope", "Rope", 1);
  const actor = { items };
  const created = [];
  const sheet = { isEditable: true, actor, document: {
    async createEmbeddedDocuments(_type, data) {
      const document = { ...data[0], _id: "owned-rope", async update(change) {
        this.system.load = change["system.load"] ?? this.system.load;
        this.system.equipped = change["system.equipped"] ?? this.system.equipped;
      } };
      created.push(document);
      items.set(document._id, document);
    },
  }, render: async () => {} };
  globalThis.game = { user: { isGM: true }, items: [], packs: [{ metadata: { name: "item" }, getDocument: async () => { await sourceReady; return source; } }] };
  foundry.utils = { deepClone: value => structuredClone(value) };

  const toggle = onLoadoutItemToggle(sheet, { currentTarget: { checked: true, dataset: { loadoutSourceId: "rope", loadoutItemName: "Rope" } } });
  const edit = onLoadoutItemLoadChange(sheet, { currentTarget: { value: "4", dataset: { loadoutSourceId: "rope", loadoutItemName: "Rope" } } });
  releaseSource();
  await Promise.all([toggle, edit]);

  assert.equal(created.length, 1);
  assert.equal(created[0].system.equipped, true);
  assert.equal(created[0].system.load, 4);
});
