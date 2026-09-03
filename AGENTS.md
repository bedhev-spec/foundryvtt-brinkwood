# Brinkwood sheet and CSS guidance

- Give each visual concern one owner. Put repeated controls and tab states in shared SCSS primitives; keep sheet files focused on sheet-specific geometry, scrolling, and variables.
- Treat `scss/` as the source of truth. After changing SCSS, rebuild `styles/blades.css` and verify parity with the commands in `scss/README.md`.
- Keep legacy compatibility overrides narrow, scoped, and documented; do not use them as a broad late-cascade repair layer.
- Preserve Foundry v13 `ApplicationV2` sheet, template, tab, form, and view-state contracts. Use the existing Foundry v13 sheet-migration and sheet-CSS cascade-audit skills for relevant work.

See `scss/README.md` for ownership and build details.

## ApplicationV2 scroll ownership

- Every `BladesItemSheet.PARTS` descriptor must declare `scrollable: [""]`. Each Item template renders one root `<form>`, and that root is the vertical scroll owner; in Foundry v13 a blank selector means the template-part root, while `"form"` would search only descendants.
- Item Effect create, edit, toggle, and delete actions use the embedded document's normal render path. Do not force a parent Item-sheet render, disable the focused Effect control, or repair scroll with `requestAnimationFrame`, timeouts, or post-render capture/restore code.
- Preserve this contract with `tests/item-effect-scroll-lifecycle.test.mjs` and a live Foundry regression covering every Effect section `+`, existing Effect actions, and Edit followed by a nested Effect save. A stubbed Handlebars mixin cannot prove replacement-DOM scroll behavior.

## Automatic trait loading boundaries

- A sheet or controller delegates automatic trait loading through one actor command; it does not reproduce grant logic, call migration code, or persist traits itself.
- `BladesActor` owns trait grant invariants: provenance tagging and adoption, per-source serialization, idempotent embedded-document creation, and deletion of source-tagged grants.
- Migration owns elected-GM authority and migration-version orchestration. It calls the actor command and records the version only after successful completion.
- Templates are presentation only. They render prepared `canDelete` state and do not decide permissions or invoke persistence paths.
- Regression coverage for automatic trait loading must include idempotency, concurrent requests, permission/authority behavior, and a failed migration retry.
