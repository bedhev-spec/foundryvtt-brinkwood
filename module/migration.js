/**
 * Perform the legacy 0.5.4 actor migration for the entire World.
 * @return {Promise<void>} A Promise which resolves once the migration is complete.
 */
export const migrateWorld = async function() {
  ui.notifications.info(`Applying Brinkwood Actors migration for version ${game.version}. Please be patient and do not close your game or shut down your server.`, {permanent: true});

  const currentVersion = game.settings.get("brinkwood", "systemMigrationVersion").toString();

  if (foundry.utils.isNewerVersion("0.5.4", currentVersion)) {
    const classPack = game.packs.get("brinkwood.class");
    const professionPack = game.packs.get("brinkwood.profession");
    const [classIndex, professionIndex] = await Promise.all([
      classPack.getIndex({fields: ["name"]}),
      professionPack.getIndex({fields: ["name"]})
    ]);

    for (const actor of game.actors) {
      const attributes = foundry.utils.deepClone(actor.system.attributes);
      const oldClass = actor.items.find(item => item.type === "class");
      const oldProfession = actor.items.find(item => item.type === "profession");

      if (actor.effects.size) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", actor.effects.map(effect => effect.id));
      }

      if (oldClass) {
        const entry = classIndex.find(item => item.name === oldClass.name);
        const replacement = entry ? await classPack.getDocument(entry._id) : null;
        if (replacement) {
          await oldClass.delete();
          await actor.createEmbeddedDocuments("Item", [replacement.toObject()]);
        }
      }

      if (oldProfession) {
        const entry = professionIndex.find(item => item.name === oldProfession.name);
        const replacement = entry ? await professionPack.getDocument(entry._id) : null;
        if (replacement) {
          await oldProfession.delete();
          await actor.createEmbeddedDocuments("Item", [replacement.toObject()]);
        }
      }

      await actor.update({"system.attributes": attributes});
    }
  }

  await game.settings.set("brinkwood", "systemMigrationVersion", game.system.version);
  ui.notifications.info(`Brinkwood System Migration version ${game.system.version} completed!`, {permanent: true});
};
