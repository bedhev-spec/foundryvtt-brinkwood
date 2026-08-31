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

/* -------------------------------------------- */
/*  Actor: character                            */
/* -------------------------------------------- */

export class CharacterData extends TypeDataModel {

  /**
   * Attribute structure exposed to BladesHelpers so that it can replace
   * the legacy `game.system.model.Actor.character.attributes` reference.
   * Only top-level keys and skill keys are needed by the helpers.
   */
  static ATTRIBUTES = {
    insight: { skills: { hunt: {}, study: {}, survey: {}, tinker: {} } },
    prowess: { skills: { finesse: {}, prowl: {}, skirmish: {}, wreck: {} } },
    resolve: { skills: { attune: {}, command: {}, consort: {}, sway: {} } }
  };

  /** @override */
  static defineSchema() {
    return {
      alias:            new fields.StringField({ required: false, initial: "" }),
      look:             new fields.StringField({ required: false, initial: "" }),
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
      experience_clues:    new fields.ArrayField(new fields.StringField()),
      loadout:             new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
      load_level:          new fields.StringField({ required: false, initial: "" }),
      selected_load_level: new fields.StringField({ required: false, initial: "" }),
      base_max_load:       new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
      // Hyphenated key and complex object structures — use ObjectField to preserve data as-is
      bans:          new fields.ObjectField(),
      "armor-uses":  new fields.ObjectField(),
      // Dynamic skill/attribute nesting — preserve verbatim
      attributes:    new fields.ObjectField()
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
      description_short:    new fields.StringField({ required: false, initial: "" }),
      description:          new fields.HTMLField({ required: false, initial: "" }),
      associated_class:     new fields.StringField({ required: false, initial: "" }),
      associated_faction:   new fields.StringField({ required: false, initial: "" }),
      associated_crew_type: new fields.StringField({ required: false, initial: "" }),
      notes:                new fields.StringField({ required: false, initial: "" })
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
  static ATTRIBUTES = {
    lies:      { skills: { deceive: {}, hide: {}, reveal: {}, educate: {} } },
    ruin:      { skills: { corrupt: {}, crack: {}, quarry: {}, spoil: {} } },
    terror:    { skills: { frighten: {}, awe: {}, disarm: {}, explode: {} } },
    violence:  { skills: { slaughter: {}, carnage: {}, direct: {}, cover: {} } },
    riot:      { skills: { rouse: {}, burn: {}, inspire: {}, provoke: {} } },
    torment:   { skills: { drain: {}, vivisect: {}, suture: {}, tend: {} } },
    judgement: { skills: { snipe: {}, scout: {}, read: {}, slip: {} } }
  };

  /** @override */
  static defineSchema() {
    return {
      // system.name is used on the Actor document (distinct from Document name)
      name:       new fields.StringField({ required: false, initial: "" }),
      type:       new fields.StringField({ required: false, initial: "" }),
      essence:    trackedValueField(0, 8),
      experience: new fields.SchemaField({
        name:  new fields.StringField({ required: false, initial: "Experience" }),
        value: new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true }),
        max:   new fields.NumberField({ required: false, nullable: false, initial: 8, integer: true })
      }),
      // Dynamic attribute nesting — preserve verbatim
      attributes: new fields.ObjectField()
    };
  }
}

/* -------------------------------------------- */
/*  Actor: 🕛 clock                             */
/* -------------------------------------------- */

export class ClockActorData extends TypeDataModel {

  /** @override */
  static defineSchema() {
    return {
      name:  new fields.StringField({ required: false, initial: "" }),
      // Clock size (4, 6, 8 …); stored as a number in template.json
      type:  new fields.NumberField({ required: false, nullable: false, initial: 4, integer: true }),
      value: new fields.NumberField({ required: false, nullable: false, initial: 0, integer: true })
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
      // Complex arrays of settlement/front objects — preserve verbatim
      aspects:  new fields.ArrayField(new fields.ObjectField()),
      towns:    new fields.ArrayField(new fields.ObjectField()),
      villages: new fields.ArrayField(new fields.ObjectField()),
      lands:    new fields.ArrayField(new fields.ObjectField())
    };
  }
}
