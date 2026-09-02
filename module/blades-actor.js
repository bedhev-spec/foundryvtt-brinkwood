import { bladesRoll } from "./blades-roll.js";
import { readRollDialogValues } from "./roll-resolution.js";
import { BladesHelpers } from "./blades-helpers.js";

/**
 * Extend the basic Actor
 * @extends {Actor}
 */
export class BladesActor extends foundry.documents.Actor {

  /** @override */
  static async create(data, options={}) {

    data.prototypeToken = data.prototypeToken || {};

    // For Crew and Character set the Token to sync with charsheet.
    if ( ['character', '🕛 clock'].includes(data.type) ) {
      data.prototypeToken.actorLink = true;
    }
    return super.create(data, options);
  }

  async _onCreate( data, options, userId ) {
    await super._onCreate(data, options, userId);

    //load basic items for characters
    if ( data.type == "character" ) {
      await this._loadBasicItems();
    }

  }

  /** @override */

  /* -------------------------------------------- */

  rollAttributePopup(attribute_name, attribute_label, attribute_value) {

    let content = `
        <h2>${game.i18n.localize('BITD.Roll')} ${game.i18n.localize(attribute_label)}</h2>
        <form>
          <div class="form-group">
            <label>${game.i18n.localize('BITD.Modifier')}:</label>
            <select id="mod" name="mod">
              ${this.createListOfDiceMods(-3,+3,0)}
            </select>
          </div>`;
    if (BladesHelpers.isAttributeAction(attribute_label)) {
      content += `
            <div class="form-group">
              <label>${game.i18n.localize('BITD.Position')}:</label>
              <select id="pos" name="pos">
                <option value="controlled">${game.i18n.localize('BITD.PositionControlled')}</option>
                <option value="risky" selected>${game.i18n.localize('BITD.PositionRisky')}</option>
                <option value="desperate">${game.i18n.localize('BITD.PositionDesperate')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${game.i18n.localize('BITD.Effect')}:</label>
              <select id="fx" name="fx">
                <option value="limited">${game.i18n.localize('BITD.EffectLimited')}</option>
                <option value="standard" selected>${game.i18n.localize('BITD.EffectStandard')}</option>
                <option value="great">${game.i18n.localize('BITD.EffectGreat')}</option>
              </select>
            </div>`;
    } else {
        content += `
            <input id="pos" name="pos" type="hidden" value="">
            <input id="fx" name="fx" type="hidden" value="">`;
    }
    content += `
        <div class="form-group">
          <label>${game.i18n.localize('BITD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div><br/>
        </form>
      `;

    // Replace legacy Dialog with DialogV2
    foundry.applications.api.DialogV2.prompt({
      window: { title: `${game.i18n.localize('BITD.Roll')} ${game.i18n.localize(attribute_label)}` },
      content: content,
      ok: {
        icon: "<i class='fas fa-check'></i>",
        label: game.i18n.localize('BITD.Roll'),
        callback: async (_event, _button, dialog) => {
          const { modifier, position, effect, note } = readRollDialogValues(dialog);
          await this.rollAttribute(attribute_label, modifier, attribute_value, position, effect, note);
        },
      },
      rejectClose: false,
    });

  }

  /* -------------------------------------------- */

  async rollAttribute(attribute_label = "", additional_dice_amount = 0, attribute_value = 0, position, effect, note) {
    let dice_amount = 0;
    if (attribute_label !== "") {
			dice_amount = attribute_value;
    }
    else {
      dice_amount = 1;
    }

    await bladesRoll(dice_amount, attribute_label, position, effect, note, {
      modifiers: [{ label: "BITD.Modifier", value: additional_dice_amount }]
    });
  }

  /* -------------------------------------------- */

  /**
   * Create <options> for available actions
   *  which can be performed.
   */
  createListOfActions() {

    let text, attribute, skill;
    let attributes = this.system.attributes;

    for ( attribute in attributes ) {

      const skills = attributes[attribute].skills;

      text += `<optgroup label="${attribute} Actions">`;
      text += `<option value="${attribute}">${attribute} (Resist)</option>`;

      for ( skill in skills ) {
        text += `<option value="${skill}">${skill}</option>`;
      }

      text += `</optgroup>`;

    }

    return text;

  }

  /* -------------------------------------------- */

  /**
   * Creates <options> modifiers for dice roll.
   *
   * @param {int} rs
   *  Min die modifier
   * @param {int} re
   *  Max die modifier
   * @param {int} s
   *  Selected die
   */
  createListOfDiceMods(rs, re, s) {

    var text = ``;
    var i = 0;

    if ( s == "" ) {
      s = 0;
    }

    for ( i  = rs; i <= re; i++ ) {
      var plus = "";
      if ( i >= 0 ) { plus = "+" };
      text += `<option value="${i}"`;
      if ( i == s ) {
        text += ` selected`;
      }

      text += `>${plus}${i}d</option>`;
    }

    return text;

  }

  /* -------------------------------------------- */

  async _onCreateEmbeddedDocuments( name, ...args ) {
    await super._onCreateEmbeddedDocuments(name, ...args);
    for (const newItem of args[0] ?? []) {
      if (["profession", "upbringing", "mask"].includes(newItem.type)) await this._addTraits(newItem);
      if (["profession", "upbringing", "mask", "class"].includes(newItem.type)) {
        await this._modActionPoints(newItem);
      }
    }
  }

  async deleteEmbeddedDocuments(embeddedName, ids, operation={}) {
    const removedItems = embeddedName === "Item" && Array.isArray(ids)
      ? ids.map(id => this.items.get?.(id)
        ?? this.items.find?.(entry => (entry.id ?? entry._id) === id)).filter(Boolean)
      : [];
    const sourceKeys = new Set(removedItems
      .filter(item => ["profession", "upbringing", "mask"].includes(item.type))
      .map(item => `${item.type}:${item.id ?? item._id}`));
    const grantIds = embeddedName === "Item"
      ? this.items.filter(item => {
        const grant = item.flags?.brinkwood?.traitGrant;
        return item.type === "trait"
          && sourceKeys.has(`${grant?.sourceItemType}:${grant?.sourceItemId}`);
      }).map(item => item.id ?? item._id)
      : [];
    const deleteIds = [...new Set([...ids, ...grantIds])];

    // The sheet awaits this public deletion path. Include exact source-tagged
    // grants in the same Foundry database operation instead of starting a
    // second asynchronous deletion from a post-delete lifecycle callback.
    const result = await super.deleteEmbeddedDocuments(embeddedName, deleteIds, operation);
    for (const removedItem of removedItems) {
      if (["profession", "upbringing", "mask", "class"].includes(removedItem.type)) {
        await this._modActionPoints(removedItem, true);
      }
    }
    return result;
  }

  async _modActionPoints(data, remove=false) {
		const bonus_points = data.system?.logic.replaceAll(' ','').split("\n").map(bonus => bonus.split('='));
    const max_value = 4;
		const mod = remove ? -1 : 1;
		let system = {};
		bonus_points.forEach(bonus => {
			const key = bonus[0];
			const bonus_value = parseInt(bonus[1]);
			let value = parseInt(foundry.utils.getProperty(this, key)) + mod*bonus_value;
      value = (value > max_value) ? max_value : value;
			value = (value < 0 ? 0 : value);
      foundry.utils.setProperty(system, key, value);
   	});
		await this.update(system);
	}

  async _addTraits(data) {
    const traitPack = game.packs.get("brinkwood.trait");
    if (!traitPack) return;

    // Compendium queries are indexed-field dependent in v13.  Hydrate then
    // filter so every mapped upbringing/profession works consistently.
    const traits = (await traitPack.getDocuments())
      .filter(trait => trait.type === "trait" && trait.system.class === data.name);
    const sourceItemId = data.id ?? data._id;
    const alreadyGranted = new Set(this.items
      .filter(item => item.type === "trait" && item.flags?.brinkwood?.traitGrant?.sourceItemId === sourceItemId)
      .map(item => item.flags.brinkwood.traitGrant.traitSourceId));
    const createdTraits = traits
      .filter(trait => !alreadyGranted.has(trait.id ?? trait._id))
      .map(trait => {
        const traitData = trait.toObject();
        const traitSourceId = trait.id ?? trait._id;
        delete traitData._id;
        traitData.flags ??= {};
        traitData.flags.brinkwood ??= {};
        traitData.flags.brinkwood.traitGrant = {
          sourceItemId,
          sourceItemType: data.type,
          traitSourceId
        };
        return traitData;
      });

    if (createdTraits.length) await this.createEmbeddedDocuments("Item", createdTraits);
  }

  async _deleteTraits(data) {
    const sourceItemId = data.id ?? data._id;
    const charTraits = this.items
      .filter(item => item.type === "trait"
        && item.flags?.brinkwood?.traitGrant?.sourceItemId === sourceItemId
        && item.flags.brinkwood.traitGrant.sourceItemType === data.type)
      .map(item => item.id ?? item._id);
    if (charTraits.length) await this.deleteEmbeddedDocuments("Item", charTraits);
  }

  /**
   * Backfill grants for choices embedded before the v13 trait sync repair.
   * This only adds missing, source-tagged traits; untagged manual/shared
   * traits are never inferred to belong to a source or deleted.
   */
  async reconcileTraitGrants() {
    const traitSources = this.items.filter(item =>
      item.type === "upbringing" || item.type === "profession");
    for (const source of traitSources) await this._addTraits(source);
  }

  async _loadBasicItems() {
    // Load and create basic items from compendium
    const basicItems = await game.packs.get("brinkwood.item").getDocuments({'system.class': ""});
    await this.createEmbeddedDocuments("Item", basicItems.map(item => item.toObject()));

    // Load and create custom basic items (convert to plain objects to avoid duplication issues)
    const customBasicItems = game.items.filter(i => i.type == "item" && i.system.class == "");
    await this.createEmbeddedDocuments("Item", customBasicItems.map(item => item.toObject()));
  }
}
