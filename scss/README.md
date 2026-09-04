# Brinkwood SCSS

`scss/` is the source of truth; `styles/blades.css` is the committed generated stylesheet.

## Ownership map

- `import/sheet-tabs.scss` owns reusable tab colors, hover, focus, active, transition visuals, and bounded active-panel scrolling; sheet files own sizing and geometry.
- `import/general-styles.scss` imports shared tab styling.
- `import/character-sheet.scss` owns character-sheet layout, geometry, and scrolling.
- Character effects, identity, tracker, and armor rules live with their active owners rather than a late compatibility stylesheet. Shared `.bw-checkbox-x` visuals live in `import/general-styles.scss`; sheets own only their size and placement.

Prefer a shared primitive when controls repeat across sheets. Keep rules DRY, but do not create abstractions for a single sheet-specific layout rule: the clearest single owner wins.

## Build and parity

Install the pinned local dependencies from the repository root:

    pnpm install --frozen-lockfile

Build the committed stylesheet:

    pnpm run build:css

Verify that the committed stylesheet exactly matches SCSS source:

    pnpm run check:css

`@parcel/watcher` is an optional Sass filesystem watcher. Its build is explicitly disabled in `pnpm-workspace.yaml`; Brinkwood's one-shot CSS build does not use it.
