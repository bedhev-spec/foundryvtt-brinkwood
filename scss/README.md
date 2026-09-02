# Brinkwood SCSS

`scss/` is the source of truth; `styles/blades.css` is the committed generated stylesheet.

## Ownership map

- `import/sheet-tabs.scss` owns reusable tab colors, hover, focus, active, and transition visuals.
- `import/general-styles.scss` imports shared tab styling.
- `import/character-sheet.scss` owns character-sheet layout, geometry, and scrolling.
- `import/legacy-character-effects.scss` and `import/legacy-character-sheet-polish.scss` are narrow compatibility layers. Shared `.bw-checkbox-x` visuals live in `import/general-styles.scss`; sheets own only their size and placement. Keep an override sheet-scoped, documented, and limited to behavior that cannot live with its primary owner.

Prefer a shared primitive when controls repeat across sheets. Keep rules DRY, but do not create abstractions for a single sheet-specific layout rule: the clearest single owner wins.

## Build and parity

Install the pinned local dependencies from the repository root:

    pnpm install --frozen-lockfile

Build the committed stylesheet:

    pnpm run build:css

Verify that the committed stylesheet exactly matches SCSS source:

    pnpm run check:css

`@parcel/watcher` is an optional Sass filesystem watcher. Its build is explicitly disabled in `pnpm-workspace.yaml`; Brinkwood's one-shot CSS build does not use it.
