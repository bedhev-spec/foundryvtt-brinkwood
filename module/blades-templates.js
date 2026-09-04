/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [
    // Actor Sheet Partials
    "systems/brinkwood/templates/parts/attributes.html",
    "systems/brinkwood/templates/parts/mask-attributes.html",
    "systems/brinkwood/templates/parts/sheet-identity-field.html",
    "systems/brinkwood/templates/parts/sheet-identity-name.html",
    "systems/brinkwood/templates/parts/sheet-identity-portrait.html",
    "systems/brinkwood/templates/parts/sheet-identity-row.html",
    "systems/brinkwood/templates/parts/sheet-identity-tracker.html",
    "systems/brinkwood/templates/parts/active-effects.html",
    "systems/brinkwood/templates/parts/actor-active-effects.html",
		"systems/brinkwood/templates/chat/roll-calculation.html",
    "systems/brinkwood/templates/parts/actor/downtime.html",
    "systems/brinkwood/templates/parts/actor/trait-card.html",
		"systems/brinkwood/templates/parts/teeth-section.html",
		"systems/brinkwood/templates/rebelion-sheet/sedition-section.html",
		"systems/brinkwood/templates/rebelion-sheet/aspect-section.html"
  ];

  // Load the template parts
  return foundry.applications.handlebars.loadTemplates(templatePaths);
};
