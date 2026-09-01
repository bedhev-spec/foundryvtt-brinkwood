/**
 * Extend the base ActiveEffect class to implement system-specific logic.
 * @extends {ActiveEffect}
 */

export class BladesActiveEffect extends foundry.documents.ActiveEffect {
  /**
   * Is this active effect currently suppressed?
   * @type {boolean}
   */
  isSuppressed = false;

  /* --------------------------------------------- */
  /** @inheritdoc */
  apply(actor, change) {
    if ( this.isSuppressed ) return null;
    //this allows for math and actor data references in the change values. Probably not necessary for
    // blades, but it was simple, and you never know what users will do. Probably ruin everything.
    change.value = foundry.dice.Roll.replaceFormulaData(change.value, actor.system);
    try {
      change.value = foundry.dice.Roll.safeEval(change.value).toString();
    } catch (e) {
      // this is a valid case, e.g., if the effect change simply is a string
    }
    let parsed;
    try{
      parsed = JSON.parse(change.value);
    }
    catch(e){
    }
    if(parsed instanceof Array){
      change.value = parsed;
    }

		return super.apply(actor, change);
  }
  /* --------------------------------------------- */

  /**
   * Determine whether this Active Effect is suppressed or not.
   */
  determineSuppression() {
    this.isSuppressed = false;
  }


  /**
   * Manage Active Effect instances through the Actor Sheet via effect control buttons.
   * @param {MouseEvent} event      The left-click event on the effect control
   * @param {Actor|Item} owner      The owning entity which manages this effect
   */
  static onManageActiveEffect(event, owner, { gmOnly = false } = {}) {
    event.preventDefault();
    if (!owner?.isOwner) return;
    if (gmOnly && !game.user.isGM) return;
    const a = event.currentTarget;
    const effectElement = a.closest("[data-effect-id]");
    const categoryElement = a.closest("[data-effect-type]");
    const effect = effectElement?.dataset.effectId
      ? owner.effects.get(effectElement.dataset.effectId)
      : null;
    // Read data-effect-action (avoids collision with ApplicationV2's data-action dispatch)
    const action = a.dataset.effectAction;
    switch ( action ) {
      case "create":
        return owner.createEmbeddedDocuments("ActiveEffect", [{
          name: "New Effect",
          img: "systems/brinkwood/styles/assets/icons/Icon.3_13.png",
          origin: owner.uuid,
          "duration.rounds": categoryElement?.dataset.effectType === "temporary" ? 1 : undefined,
          disabled: categoryElement?.dataset.effectType === "inactive",
        }]);
      case "edit":
        return effect?.sheet.render({ force: true });
      case "delete":
        return effect.delete();
      case "toggle":
        return effect.update({ disabled: !effect.disabled });
    }
  }


  /**
   * Prepare the data structure for Active Effects which are currently applied to an Actor or Item.
   * @param {ActiveEffect[]} effects    The array of Active Effect instances to prepare sheet data for
   * @return {object}                   Data for rendering
   */
  static prepareActiveEffectCategories(effects) {

    // Define effect header categories
    const categories = {
      temporary: {
        type: "temporary",
        label: "Temporary Effects",
        canCreate: true,
        effects: []
      },
      passive: {
        type: "passive",
        label: "Passive Effects",
        canCreate: true,
        effects: []
      },
      inactive: {
        type: "inactive",
        label: "Inactive Effects",
        canCreate: true,
        effects: []
      },
      suppressed: {
        type: "suppressed",
        label: "Suppressed Effects",
        canCreate: false,
        effects: []
      }

    };

    // Iterate over active effects, classifying them into categories
    // Use the synchronous sourceName getter (v13 replaced async _getSourceName())
    for ( let e of effects ) {
      if ( e.isSuppressed ) categories.suppressed.effects.push(e);
      else if ( e.disabled ) categories.inactive.effects.push(e);
      else if ( e.isTemporary ) categories.temporary.effects.push(e);
      else categories.passive.effects.push(e);
    }
    return categories;
  }

}

/**
 * Cap numeric "custom" active-effect changes at 4.
 * Replaces the former private _applyCustom override with the public v13 hook.
 * The base ActiveEffect._applyCustom fires this hook; we intercept it here to
 * apply the system-specific cap without subclassing private API.
 */
Hooks.on("applyActiveEffect", (actor, change, current, delta, changes) => {
  if (change.mode !== CONST.ACTIVE_EFFECT_MODES.CUSTOM) return;
  const newValue = (current + delta > 4) ? 4 : current + delta;
  changes[change.key] = newValue;
});

// Portions of this code are copyright 2021 Andrew Clayton
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
