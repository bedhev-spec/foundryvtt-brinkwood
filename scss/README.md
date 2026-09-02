# CSS build

Install the pinned local dependencies from the repository root:

    pnpm install --frozen-lockfile

Build the committed stylesheet:

    pnpm run build:css

Verify that the committed stylesheet exactly matches the SCSS source:

    pnpm run check:css

`@parcel/watcher` is an optional Sass filesystem watcher. Its build is explicitly
disabled in `pnpm-workspace.yaml`; Brinkwood's one-shot CSS build does not use it.
