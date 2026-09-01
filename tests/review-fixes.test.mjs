import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

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

class ObjectField extends DataField {}

globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: {
    fields: {
      ArrayField,
      BooleanField: DataField,
      HTMLField: DataField,
      NumberField: DataField,
      ObjectField,
      SchemaField,
      StringField: DataField
    }
  },
  utils: {
    deepClone: value => structuredClone(value),
    isNewerVersion: (target, current) => {
      const parts = version => version.split(".").map(Number);
      const left = parts(target);
      const right = parts(current);
      for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        if ((left[index] ?? 0) !== (right[index] ?? 0)) {
          return (left[index] ?? 0) > (right[index] ?? 0);
        }
      }
      return false;
    }
  }
};

function fieldDefault(field) {
  if (field instanceof SchemaField) {
    return Object.fromEntries(Object.entries(field.schema).map(([key, child]) => [key, fieldDefault(child)]));
  }
  const initial = field.options.initial;
  if (typeof initial === "function") return initial();
  if (initial !== undefined) return structuredClone(initial);
  if (field instanceof ArrayField) return [];
  if (field instanceof ObjectField) return {};
  return undefined;
}

const schemaDefaults = Model => Object.fromEntries(
  Object.entries(Model.defineSchema()).map(([key, field]) => [key, fieldDefault(field)])
);

test("typed actor models retain template defaults for new actors", async () => {
  const template = JSON.parse(await read("template.json"));
  const { CharacterData, ClockActorData, MaskActorData, NpcData, RebelionData } = await import("../module/data/actor-data-models.js");

  assert.deepEqual(schemaDefaults(CharacterData), template.Actor.character);
  assert.deepEqual(schemaDefaults(MaskActorData), template.Actor.mask);
  assert.deepEqual(schemaDefaults(NpcData), template.Actor.npc);
  assert.deepEqual(schemaDefaults(ClockActorData), template.Actor["🕛 clock"]);
  assert.deepEqual(schemaDefaults(RebelionData), template.Actor.rebelion);
});

test("typed Item defaults retain their declared template values", async () => {
  const template = JSON.parse(await read("template.json"));
  const { ClassData, ItemData, TraitData } = await import("../module/data/item-data-models.js");
  const item = template.Item.item;
  const trait = template.Item.trait;
  const defaultTemplate = template.Item.templates.default;
  const classTemplate = template.Item.class;

  const itemDefaults = schemaDefaults(ItemData);
  assert.equal(itemDefaults.description, defaultTemplate.description);
  for (const key of ["class", "load", "uses", "additional_info", "equipped", "num_available"]) {
    assert.deepEqual(itemDefaults[key], item[key]);
  }

  const traitDefaults = schemaDefaults(TraitData);
  assert.equal(traitDefaults.description, defaultTemplate.description);
  for (const key of ["class", "price", "purchased", "class_default"]) {
    assert.deepEqual(traitDefaults[key], trait[key]);
  }

  const classDefaults = schemaDefaults(ClassData);
  assert.equal(classDefaults.description, defaultTemplate.description);
  assert.deepEqual(classDefaults.experience_clues, classTemplate.experience_clues);
  assert.ok(ClassData.defineSchema().experience_clues instanceof ArrayField);
  assert.ok(ClassData.defineSchema().experience_clues.element instanceof DataField);
});

test("associates render through the simple item-sheet part", async () => {
  const source = await read("module/blades-item-sheet.js");
  assert.match(source, /SIMPLE_TYPES[^;]+"associates"/s);
});

test("mask and rebellion sheets use the ApplicationV2 tab contract", async () => {
  const [maskSource, rebellionSource, maskTemplate, rebellionTemplate] = await Promise.all([
    read("module/blades-mask-sheet.js"),
    read("module/blades-rebelion-sheet.js"),
    read("templates/mask-sheet.html"),
    read("templates/rebelion-sheet.html")
  ]);

  assert.match(maskSource, /tabGroups:\s*\{\s*primary:\s*"traits"\s*\}/);
  assert.match(rebellionSource, /tabGroups:\s*\{\s*primary:\s*"overview"\s*\}/);
  for (const source of [maskSource, rebellionSource]) {
    assert.match(source, /async _onRender\(context, options\)\s*\{\s*await super\._onRender/);
  }
  for (const template of [maskTemplate, rebellionTemplate]) {
    assert.match(template, /data-action="tab"/);
    assert.match(template, /data-group="primary"/);
    assert.doesNotMatch(template, /data-group="primary-tabs"/);
  }
});

test("character clocks can return from one segment to empty", async () => {
  const source = await read("module/blades-actor-sheet.js");

  assert.match(source, /addEventListener\("click", this\._onClockClick\.bind\(this\)/);
  assert.match(source, /selectedValue === 1 && currentValue === 1 \? 0 : selectedValue/);
});

test("clock-sheet segments fill and empty contiguous clock progress", async () => {
  const {
    clockImagePath,
    clockValueAfterClick,
    normalizeClockLabel,
    normalizeClockState,
    preloadClockImages
  } = await import("../module/clock-utils.js");
  const source = await read("module/blades-clock-sheet.js");

  assert.equal(clockValueAfterClick(3, 1, 4), 3);
  assert.equal(clockValueAfterClick(3, 3, 4), 2);
  assert.equal(clockValueAfterClick(1, 1, 4), 0);
  assert.equal(clockValueAfterClick(2, 4, 4), 1);
  assert.match(source, /input\[name="system\.value"\]/);
  assert.match(source, /addEventListener\("click", this\._onClockSegmentClick\.bind\(this\)/);

  assert.equal(normalizeClockLabel({ hash: {} }), "");
  assert.equal(normalizeClockLabel("oath"), "oath");
  assert.deepEqual(normalizeClockState("4", 8), { type: "4", value: 4 });
  assert.deepEqual(normalizeClockState("8", -1), { type: "8", value: 0 });
  assert.match(source, /submitData\["prototypeToken\.texture\.src"\] = image_path/);
  for (const type of [4, 6, 8]) {
    for (let value = 0; value <= type; value += 1) {
      const path = clockImagePath(type, value);
      assert.equal(path, `systems/brinkwood/styles/assets/progressclocks-svg/Progress Clock ${type}-${value}.svg`);
      const svg = await read(path.replace("systems/brinkwood/", ""));
      if (value === type) assert.match(svg, /stroke="#EEEAE0"/);
    }
  }

  const loaded = [];
  globalThis.Image = class {
    set src(value) {
      loaded.push(value);
      queueMicrotask(() => this.onload());
    }
  };
  await preloadClockImages(4);
  delete globalThis.Image;
  assert.equal(loaded.length, 5);
  assert.equal(loaded.at(0), clockImagePath(4, 0));
  assert.equal(loaded.at(-1), clockImagePath(4, 4));
});

test("item-picker interpolations are escaped before entering HTML", async () => {
  const source = await read("module/blades-sheet.js");
  const { escapeHTML } = await import("../module/html-utils.js");
  const { renderItemTooltip } = await import("../module/item-tooltip.js");
  const payload = `&<>"'`;

  assert.equal(escapeHTML(payload), "&amp;&lt;&gt;&quot;&#39;");
  assert.match(source, /const itemId = escapeHTML\(e\._id\)/);
  assert.match(source, /const itemName = escapeHTML\(game\.i18n\.localize\(e\.name\)\)/);
  assert.match(source, /const itemDetails = escapeHTML\(addition_price_load\)/);
  assert.match(source, /data-tooltip-html="\$\{itemTooltip\}"/);
  assert.match(source, /data-tooltip-class="brinkwood-item-tooltip-shell"/);
  assert.match(source, /tabindex="0" aria-label="\$\{itemTooltipLabel\}"/);

  const tooltip = renderItemTooltip({
    name: "Shortbow",
    system: {
      load: 3,
      uses: 0,
      num_available: 1,
      class: "Ranger",
      additional_info: '<script>alert("no")</script>'
    }
  });
  assert.match(tooltip, /Shortbow/);
  assert.match(tooltip, /BITD\.Load/);
  assert.match(tooltip, /<strong>3<\/strong>/);
  assert.doesNotMatch(tooltip, /<script>/);
});

test("loadout item sheet uses compact semantic sections", async () => {
  const [template, styles] = await Promise.all([
    read("templates/items/item.html"),
    read("scss/import/item-sheet.scss")
  ]);

  assert.match(template, /class="\{\{cssClass\}\} loadout-item-sheet"/);
  assert.match(template, /data-action="editImage" data-edit="img"/);
  assert.match(template, /loadout-item-sheet__grid/);
  assert.match(template, /type="number" min="0" step="1" name="system\.load"/);
  assert.match(styles, /grid-template-columns: 104px minmax\(0, 1fr\)/);
  assert.match(styles, /background: var\(--bw-ink\)/);
});

test("legacy migration preserves effects and updates embedded items in place", async () => {
  let migrationVersion = "0.5";
  const updates = [];
  const makeItem = type => ({ type, name: type, update: async data => updates.push([type, data]) });
  const actor = {
    items: [makeItem("class"), makeItem("profession")],
    effects: { size: 1 },
    deleteEmbeddedDocuments: async () => assert.fail("Active Effects must not be deleted")
  };
  const pack = type => ({
    getIndex: async () => [{ _id: `${type}-id`, name: type }],
    getDocument: async () => ({ toObject: () => ({ _id: `${type}-id`, name: type, type, system: { migrated: true } }) })
  });

  globalThis.game = {
    version: "13.351",
    system: { version: "6.0.3" },
    actors: [actor],
    packs: { get: id => pack(id.split(".").at(-1)) },
    settings: {
      get: () => migrationVersion,
      set: async (_system, _key, value) => { migrationVersion = value; }
    }
  };
  globalThis.ui = { notifications: { info: () => {} } };

  const { migrateWorld } = await import("../module/migration.js");
  await migrateWorld();
  await migrateWorld();

  assert.equal(updates.length, 2);
  assert.equal(migrationVersion, "6.0.3");
  for (const [, update] of updates) assert.equal(update._id, undefined);
});

test("test manifest targets the 0.6.10 character V2 branch", async () => {
  const manifest = JSON.parse(await read("system-test.json"));
  for (const field of ["url", "manifest", "download"]) {
    assert.match(manifest[field], /codex\/redesign-character-sheet-ui/);
  }
});
