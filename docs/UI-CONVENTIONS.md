# UI Conventions

The UI is built on the `sign-design` primitives in [`styles/sign-design.css`](../styles/sign-design.css)
and `components/sign-design/`. Shadcn/Radix primitives in `components/ui/` are still
used for dialogs, dropdowns, toasts, and the document viewer chrome.

Because the two systems coexist, there are a few non-obvious rules. Each one below
caused a real bug at some point — they are cheap to re-introduce.

## Never write `var(--accent)` in sign-design code

The two systems use colliding variable names with incompatible value formats:

| System | Variables | Value format |
|---|---|---|
| sign-design | `--brand-accent`, `--brand-accent-2`, `--brand-accent-fg`, `--brand-accent-tint` | full CSS colors (`#38486B`) |
| shadcn | `--accent`, `--background`, `--foreground`, … | bare HSL components (`217 33% 17%`), consumed as `hsl(var(--accent))` |

Writing `color: var(--accent)` in sign-design code resolves to an HSL component
string, which is invalid as a color and silently renders as nothing. Always use the
`--brand-*` names outside of `components/ui/`.

## The inline accent override is intentional

`TweaksProvider` and the pre-paint `<script>` in `app/layout.tsx` unconditionally set
`--brand-accent`, `--brand-accent-2`, and `--brand-accent-tint` inline on `<html>` from
the user's tweak value (default `#38486B`). This pins the accent in both light and dark
mode.

The `[data-theme="dark"][data-palette="*"]` rules in `sign-design.css` that lighten the
accent for dark mode are therefore dead by design. Do not "fix" this by deferring to the
palette CSS — that was tried and reverted.

## Both theme systems must stay in sync

ZeroUI's `ThemeManager` (`components/theme-manager.tsx`) sets `<body data-theme>` from
`localStorage['theme-preference']`; shadcn primitives resolve their HSL tokens off that
attribute. `TweaksProvider` writes **both** `<body data-theme>` and
`localStorage['theme-preference']` on every dark/light toggle so the two stay in lockstep.

Don't remove `ThemeManager` — dialogs, dropdowns, and the document viewer still depend on
shadcn tokens. Tweaks persist to `localStorage['nutrient-sign:tweaks']`.

## `.data-table` action cells use `text-align`, not flex

`display: flex` on a `<td>` overrides `display: table-cell` and drops the cell out of row
layout, so the row's `border-bottom` stops short of the actions column. Use
`text-align: right` plus `> * + * { margin-left: 8px }`. The mobile breakpoint
(`max-width: 640px`) may use flex, because `td`s are `display: block` there.

## `FieldTile` is polymorphic

`FieldTile` renders as a `<Link>` when given `href`, otherwise as a `<button>`. Never wrap
it in another `<Link>` — nested interactive elements are invalid HTML and produce a stark
focus ring on hover.

## Pre-existing type errors

`pnpm tsc --noEmit` is not clean; roughly 19 errors predate the current UI and live mostly
in `components/theme-manager.tsx`, `components/ui/*`, `lib/nutrient-viewer.ts`, and the
send-wizard step files. When changing UI code, diff against the previous output rather
than expecting zero errors, and fix only what your change introduced.
