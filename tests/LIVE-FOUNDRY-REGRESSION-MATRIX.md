# Live Foundry v13 release regression matrix

This is a manual release gate for a running, real Foundry VTT v13 world. It
complements the fast Node suite; it does **not** execute Foundry and must never
be reported as automated coverage. Run `npm test`, `npm run validate`, and the
CSS parity check before this matrix.

## Preconditions and evidence

- Use a disposable world on the exact Foundry v13 build recorded in
  `system.json`, with the candidate Brinkwood system installed from the release
  artifact. Disable modules other than the module used for the planned clock
  overlay, if it is part of the release.
- Create two active GM accounts (`GM-A`, `GM-B`), one owner player, and one
  non-owner player. Start both GM sessions before the trait-migration cases.
- Seed one Character with a long translated name, notes, and description; a
  Mask with a selectable type; one NPC; one Rebellion record; and one Item of
  every registered Item sheet/template type. Give the Character an embedded
  consequence, scar, and oath clock.
- Record the Foundry build, system version/commit or archive checksum, browser
  and zoom, world name, tester, date, screenshots at 700/620/480/410 px, and
  any console errors. Record PASS, FAIL, or NOT APPLICABLE with a short note
  for every row. A FAIL blocks release until it is fixed or explicitly waived.

## Matrix

| ID | Live scenario | Pass evidence |
| --- | --- | --- |
| L01 | Open every registered Actor sheet and every registered Item sheet/template as an owner. Close and reopen each. | Each sheet is registered, renders without console errors, has its expected title/content, and can be reopened. |
| L02 | On Character, Mask, NPC, and Rebellion sheets, visit every primary tab/view state, make an intentional document edit, and let the sheet rerender. Repeat after close/reopen. | The selected tab/view state survives document-driven rerender when its contract requires it; tab controls remain usable by mouse and keyboard. |
| L03 | For a normal Character named input, make one value change, then blur/press Enter once. Inspect the document update count in the browser/Foundry debug tooling. Repeat for a Character embedded clock dot. | Exactly one authoritative document commit occurs per intentional normal-field edit. The embedded clock updates through its dedicated control path without duplicate generic persistence. |
| L04 | On every Item sheet Effect section, use `+` to create an Effect. For an existing Effect, edit, toggle, and delete it. Then choose Edit, save the Item, and save a nested Effect. | Every action persists correctly. The Item sheet remains usable after replacement DOM: its root form keeps its vertical scroll position and the focused control is sensible/visible. |
| L05 | Edit and save every Actor and Item ProseMirror field, including a long localized value. Reopen the sheet and switch tabs after saving. | Rich text persists once, renders as expected, does not lose content on rerender, and does not leave an editor or focus trap behind. |
| L06 | As the owner player, make allowed edits. As the non-owner player, try all visible Actor, Mask, Item, Effect, trait, and form actions. As a GM, repeat privileged actions. | Owner and GM behavior works; non-owner controls are absent or disabled where required, and direct UI interaction cannot persist unauthorized changes. |
| L07 | With both GMs active, trigger the character trait migration/reconciliation at the same time. Repeat the initiating action while the first reconciliation is still pending. | Only the deterministically elected GM performs migration work; each source-tagged trait is created once, with no duplicate grants or unintended deletion of manual traits. |
| L08 | Force one trait reconciliation failure (for example, temporarily make the trait pack unavailable), then restore it and retry the migration. | The migration version is not advanced on failure; retry succeeds and remains idempotent. Capture the error and final version evidence. |
| L09 | At 700, 620, 480, and 410 CSS px, exercise the Character and Mask header, all primary tabs, Item Effect actions, and long localized text. Tab through each interactive control; inspect active focus and text/background contrast. | No clipped essential controls, unintended horizontal scrolling, inaccessible tab order, invisible focus indicator, or insufficient readable contrast. |

## Clock boundary

Do not test a dedicated Clock Actor or scene-token synchronization here: that
feature is being removed in favour of an overlay module. L03 covers only the
Character's embedded consequence, scar, and oath clocks, which remain part of
the system.

## Sign-off

Attach the completed evidence to the release issue or pull request. State the
exact matrix revision used, all waivers, and whether the clock-overlay module
was enabled. Do not substitute a green Node suite for this sign-off.
