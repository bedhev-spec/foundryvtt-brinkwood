# Brinkwood for Foundry VTT

An unofficial, work-in-progress Foundry VTT system for [Brinkwood: The Blood of Tyrants](https://brinkwood.net/), originally based on megastruktur's [Blades in the Dark system](https://github.com/megastruktur/foundryvtt-blades-in-the-dark).

The project is actively migrating its v11-era sheets and behavior to Foundry v13. Expect continued refactoring and occasional breaking changes until the migration is complete.

## Compatibility

- System version: `0.6.13`
- Minimum Foundry version: `13`
- Verified Foundry build: `13.351`

## Installation

Install or update the system in Foundry with this manifest URL:

```text
https://raw.githubusercontent.com/bedhev-spec/foundryvtt-brinkwood/integration/v13-follow-up/system.json
```

## Current functionality

- Character and Mask sheets
- Action, resistance, and Essence rolls
- Selectable Upbringings, Professions, Classes, Pacts, and Mask Types
- Automatic trait loading for supported identity choices
- Character loadout and capacity tracking
- Mask actions, abilities, and XP triggers
- Foundry Item and Active Effect management
- English localization and sheet tooltips

![Brinkwood character sheets](./images/brinkwood_sheets.png)

## Known work remaining

- Rebellion record sheet, including Moot decisions
- Blood alchemy
- Two-point Mask abilities such as Drink Deep and Multifaceted
- Fey dossier sheet
- Custom clocks on sheets
- Removal of remaining unused Blades in the Dark legacy code

## Developer documentation

- [Sheet design system](./docs/sheet-design-system.md): shared component ownership, geometry, and validation contracts
- [SCSS ownership and build](./scss/README.md): stylesheet ownership and CSS parity commands
- [Live Foundry regression matrix](./tests/LIVE-FOUNDRY-REGRESSION-MATRIX.md): checks that require the real Foundry runtime

## Contact

Open an issue on this repository, or contact `quad#8681` on the official Brinkwood or Foundry VTT Discord communities.

## Credits and license

Brinkwood is created by Far Horizons Co-op. This project is unofficial and is not associated with Far Horizons Co-op or the Brinkwood authors.

This project is licensed under the [GNU General Public License v3.0](./LICENSE.txt).
