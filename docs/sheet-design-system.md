# Sheet design system

## Validated baseline

As of 2026-09-04, the Character and Mask main-information UI is the live Foundry visual and behavioral reference. Preserve it unless a requested change explicitly replaces part of this contract. Automated tests alone do not authorize a visual change.

Reuse complete shared components. A sheet may change a component's data, behavior, or decoration, but it must not recreate or override the component's internal geometry.

## Component ownership

| Component | Owner | Contract |
| --- | --- | --- |
| Name field | `templates/parts/sheet-identity-name.html`, `scss/import/sheet-identity.scss` | `identityId`, `name`, optional class, shared box geometry, and focus treatment |
| Identity field | `templates/parts/sheet-identity-field.html`, `scss/import/sheet-identity.scss` | Shared text-field markup, box geometry, and focus treatment |
| Portrait | `templates/parts/sheet-identity-portrait.html`, `scss/import/sheet-identity.scss` | `img`, `name`, and `editable` |
| Identity row | `templates/parts/sheet-identity-row.html`, `scss/import/sheet-identity.scss` | Complete separator-free label/picker, selected value/tooltip, and remove control |
| Identity rows list | Sheet container plus `scss/import/sheet-identity.scss` | Fixed row rhythm; Character may paint separators, while Mask's standalone row does not |
| Tracker | `templates/parts/sheet-identity-tracker.html`, `scss/import/sheet-identity.scss` | `id`, class, tracker value, path, colour, and optional roll/label behavior |
| Picker modal | `module/blades-sheet.js` | Item-type selection behavior |
| Picker tooltip | `module/item-tooltip.js`, `scss/import/tooltip.scss` | Foundry-enriched Item description without changing trigger geometry |
| Trait card | `templates/parts/actor/trait-card.html` | Item identity and purchase/delete state |
| Effect card | Active-effect partials and effect SCSS | Prepared effect category data and its controls |
| Attributes list / Attribute / Skill | Attribute partials | Prepared actor attribute and rating data |
| Notes | `templates/parts/sheet-notes.html`, `scss/import/sheet-notes.scss`, `module/sheet-dom.js` | Explicit `editable`, `fieldName`, `fieldValue`, `documentUuid`, and `enrichedContent` inputs; Foundry ProseMirror editing plus one shared rich-text persistence path |

Each visual concern has one owner. Shared SCSS owns repeated controls and component states; sheet SCSS owns only sheet-level placement, scrolling, and variables.

## Identity row geometry

- Character and Mask render the same `sheet-identity-row.html` component. Sheet-specific selectors must not reposition its selected value or remove control.
- A sheet may position the complete identity container, such as Character's 10px vertical offset, without changing geometry inside the shared row.
- A row has a fixed 28px height. Its label, picker, selected Item text, and remove cross share one vertically centered content line.
- The value/action track has a fixed 18px remove column. Selected Item text is end-aligned immediately beside that column.
- Empty and selected states reserve the same tracks. Selecting or removing an Item must not change row height, gaps, separator position, or neighboring-row rhythm.
- Character separators are paint-only decoration belonging to the rows-list variant. They must not participate in row layout or create Character-only offsets.
- Long selected values may ellipsize horizontally; they must not wrap or alter vertical geometry.

## Native and tooltip reset contract

- Foundry's native button rules can add centering and box styling. Reusable component buttons explicitly own alignment, padding, border, font, line-height, width, and height.
- Content-only identity tooltip triggers use `.tooltip-trigger--plain`.
- Generic tooltip chrome in `scss/import/tooltip.scss` must exclude plain triggers. It must not add padding, borders, filters, or other geometry to an identity row.
- Picker labels own their hover glow and keyboard `:focus-visible` treatment. Interactive labels, remove controls, and picker rows use `cursor: pointer`.
- Generic tooltip triggers use `cursor: help`; plain identity tooltip wrappers use the default cursor. A selected Mask value uses `cursor: pointer` only when `row.reselect` makes that value an interactive reselect control.

## Validation

For component changes, verify:

1. Focused Character and Mask identity tests, including empty and selected states.
2. Stable row height and separator position before selection, after selection, and after removal.
3. SCSS-to-`styles/blades.css` parity using the commands in `scss/README.md`.
4. Live Foundry rendering on both sheets. When a screenshot and static tests disagree, compare `getBoundingClientRect()` and `getComputedStyle()` for the corresponding component nodes.
