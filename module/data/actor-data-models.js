/**
 * TypeDataModel definitions for Actor document types in the Brinkwood system.
 * Registered in blades.js via CONFIG.Actor.dataModels.
 *
 * All schemas are intentionally permissive (ObjectField for complex sub-trees)
 * so that legacy LevelDB pack data loads without validation errors.
 */

const { TypeDataModel } = foundry.abstract;
const { fields } = foundry.data;

/* -------------------------------------------- */
/*  Shared helpers                              */
/* -------------------------------------------- */

/**
 * Tracked numeric value field group (value + max pair).
 * @param {number} [valueDef=0]
 * @param {number} [maxDef=0]
 * @returns {foundry.data.fields.SchemaField}
 */
function trackedValueField(valueDef = 0, maxDef = 0) {
  return new fields.SchemaField({
    value: new fields.NumberField({ required: false, nullable: false, initial: valueDef, integer: true }),
    max:   new fields.NumberField({ required: false, nullable: false, initial: maxDef,   integer: true })
  });
}

function skillGroup(...skills) {
  return { skills: Object.fromEntries(skills.map(skill => [skill, { value: 0 }])) };
}

const CHARACTER_ATTRIBUTES = {
  insight: skillGroup("hunt", "study", "survey", "tinker"),
  prowess: skillGroup("finesse", "prowl", "skirmish", "wreck"),
  resolve: skillGroup("attune", "command", "consort", "sway")
};

const MASK_ATTRIBUTES = {
  lies: skillGroup("deceive", "hide", "reveal", "educate"),
  ruin: skillGroup("corrupt", "crack", "quarry", "spoil"),
  terror: skillGroup("frighten", "awe", "disarm", "explode"),
  violence: skillGroup("slaughter", "carnage", "direct", "cover"),
  riot: skillGroup("rouse", "burn", "inspire", "provoke"),
  torment: skillGroup("drain", "vivisect", "suture", "tend"),
  judgement: skillGroup("snipe", "scout", "read", "slip")
};

const REBELLION_ASPECTS = ["Organization", "Influence", "Force"].map(name => ({
  name,
  progress: [0, 0, 0],
  max_progress: [4, 6, 8],
  decisions: []
}));

const settlement = (name, max) => ({
  name,
  sedition: { clock: { value: 0, max }, level: 0 }
});

const REBELLION_TOWNS = ["Innisfirth", "Drancaster", "Stamlegih", "Grismont"]
  .map(name => settlement(name, 8));
const REBELLION_VILLAGES = [
  "Cliffsblack", "Flaypool", "Fletchgrove", "Finford",
  "Hogswick", "Ironholme", "Oldleigh", "Shepforth"
].map(name => settlement(name, 6));
const REBELLION_LANDS = ["The Veins", "Riverlands"].map(name => settlement(name, 6));

const initialClone = value => () => foundry.utils.deepClone(value);

/* -------------------------------------------- */
/*  Actor: character                            */
/* -------------------------------------------- */

export class CharacterData extends TypeDataModel {

  /**
   * Attribute structure exposed to BladesHelpers so that it can replace
   * the legacy `game.system.model.Actor.character.attributes` reference.
   * Only top-level keys and skill keys are needed by the helpers.
   */
  static ATTRIBUTES = CHARACTER_ATTRIBUTES;

  /** @override */
  static defineSchema() {
    return {
      alias:            new fields.StringField({ required: false, initial: "" }),
      look:             new fields.StringField({ required: false, initial: "" }),
      description:      new fields.HTMLField({ required: false, initial: "" }),
      associates_label: new fields.StringField({ required: false, initial: "BITD.Acquaintances" }),
      stress: new fields.SchemaField({
        value:        new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
        max:          new fields.NumberField({ required: false, nullable: false, initial: 6, integer: true }),
        max_default:  new fields.NumberField({ required: false, nullable: false, initial: 6, integer: true }),
        name_default: new fields.StringField({ required: false, initial: "BITD.Stress" }),
        name:         new fields.StringField({ required: false, initial: "BITD.Stress" })
      }),
      oath:    new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
      scars:   new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
      experience: new fields.SchemaField({
        value:        new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
        max:          new fields.NumberField({ required: false, nullable: false, initial: 8, integer: true }),
        max_default:  new fields.NumberField({ required: false, nullable: false, initial: 8, integer: true }),
        name_default: new fields.StringField({ required: false, initial: "BITD.Experience" }),
        name:         new fields.StringField({ required: false, initial: "BITD.Experience" })
      }),
      experience_clues:    new fields.ArrayField(new fields.StringField(), {
        initial: initialClone(["BITD.ClassExpClue3", "BITD.ClassExpClue2"])
      }),
      loadout:             new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
      load_level:          new fields.StringField({ required: false, initial: "" }),
      selected_load_level: new fields.StringField({ required: false, initial: "" }),
      base_max_load:       new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
      bans: new fields.ObjectField({
        initial: initialClone({
          light: { one: "", two: "" },
          medium: { one: "", two: "" },
          heavy: { one: "" }
        })
      }),
      "armor-uses": new fields.ObjectField({
        initial: initialClone({ armor: 0, heavy: 0, special: 0 })
      }),
      attributes: new fields.ObjectField({ initial: initialClone(CHARACTER_ATTRIBUTES) })
    };
  }
}

/* -------------------------------------------- */
/*  Actor: npc                                  */
/* -------------------------------------------- */

export class NpcData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      name:                 new fields.StringField({ required: false, initial: "" }),
      description_short:    new fields.StringField({ required: false, initial: "" }),
      description:          new fields.HTMLField({ required: false, initial: "" }),
      associated_class:     new fields.StringField({ required: false, initial: "" }),
      associated_faction:   new fields.StringField({ required: false, initial: "" }),
      associated_crew_type: new fields.StringField({ required: false, initial: "" }),
      notes:                new fields.HTMLField({ required: false, initial: "" })
    };
  }
}

/* -------------------------------------------- */
/*  Actor: mask                                 */
/* -------------------------------------------- */

export class MaskActorData extends TypeDataModel {

  /**
   * Attribute structure exposed to BladesHelpers to replace the legacy
   * `game.system.model.Actor.mask.attributes` reference.
   */
  static ATTRIBUTES = MASK_ATTRIBUTES;

  /** @override */
  static defineSchema() {
    return {
      // system.name is used on the Actor document (distinct from Document name)
      name:       new fields.StringField({ required: false, initial: "" }),
      type:       new fields.StringField({ required: false, initial: "" }),
      description: new fields.HTMLField({ required: false, initial: "" }),
      essence:    trackedValueField(0, 8),
      experience: new fields.SchemaField({
        name:  new fields.StringField({ required: false, initial: "Experience" }),
        value: new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
        max:   new fields.NumberField({ required: false, nullable: false, initial: 8, integer: true })
      }),
      attributes: new fields.ObjectField({ initial: initialClone(MASK_ATTRIBUTES) })
    };
  }
}

/* -------------------------------------------- */
/*  Actor: rebelion                             */
/* -------------------------------------------- */

export class RebelionData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      name:    new fields.StringField({ required: false, initial: "Rebelion Record" }),
      tyranny: trackedValueField(0, 4),
      heat:    trackedValueField(0, 10),
      aspects: new fields.ArrayField(new fields.ObjectField(), {
        initial: initialClone(REBELLION_ASPECTS)
      }),
      towns: new fields.ArrayField(new fields.ObjectField(), {
        initial: initialClone(REBELLION_TOWNS)
      }),
      villages: new fields.ArrayField(new fields.ObjectField(), {
        initial: initialClone(REBELLION_VILLAGES)
      }),
      lands: new fields.ArrayField(new fields.ObjectField(), {
        initial: initialClone(REBELLION_LANDS)
      })
    };
  }
}
