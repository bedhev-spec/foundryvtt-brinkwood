/**
 * Perform the legacy 0.5.4 actor migration for the entire World.
 * @return {Promise<void>} A Promise which resolves once the migration is complete.
 */
export const migrateWorld = async function() {
  ui.notifications.info(`Applying Brinkwood Actors migration for version ${game.version}. Please be patient and do not close your game or shut down your server.`, {permanent: true});

  const currentVersion = String(game.settings.get("brinkwood", "systemMigrationVersion") ?? "0");

  if (foundry.utils.isNewerVersion("0.5.4", currentVersion)) {
    const classPack = game.packs.get("brinkwood.class");
    const professionPack = game.packs.get("brinkwood.profession");
    const [classIndex, professionIndex] = await Promise.all([
      classPack.getIndex({fields: ["name"]}),
      professionPack.getIndex({fields: ["name"]})
    ]);

    for (const actor of game.actors) {
      const oldClass = actor.items.find(item => item.type === "class");
      const oldProfession = actor.items.find(item => item.type === "profession");

      if (oldClass) {
        const entry = classIndex.find(item => item.name === oldClass.name);
        const replacement = entry ? await classPack.getDocument(entry._id) : null;
        if (replacement) {
          const update = replacement.toObject();
          delete update._id;
          await oldClass.update(update);
        }
      }

      if (oldProfession) {
        const entry = professionIndex.find(item => item.name === oldProfession.name);
        const replacement = entry ? await professionPack.getDocument(entry._id) : null;
        if (replacement) {
          const update = replacement.toObject();
          delete update._id;
          await oldProfession.update(update);
        }
      }
    }
  }

  await game.settings.set("brinkwood", "systemMigrationVersion", game.system.version);
  ui.notifications.info(`Brinkwood System Migration version ${game.system.version} completed!`, {permanent: true});
};
