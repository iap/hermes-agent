# Pilot — the logs page rebuilt on `@trade/ui`

A throwaway integration spike: `web/src/pages/LogsPage.tsx` rebuilt with
[`@trade/ui`](https://github.com/trade/ui) components, to prove (or kill) the idea of the Hermes
dashboard consuming that library. **Not a merge candidate as-is** — see "If it sticks".

## What changed

- The page's own controls are now library components: file switcher → `Tabs`; level / component /
  lines filters → `Field` + `Select` (listbox variant); refresh → `Button`; error notice →
  `Banner`; auto-refresh → `Switch`; layout → `Stack`.
- The library's `--ui-*` theme roles are mapped onto the dashboard's live theme tokens in
  `web/src/pages/pilot-trade-ui.css`, scoped under `.pilot-trade-ui` — the port inherits the
  active Hermes theme instead of importing a second visual language.
- Everything else is untouched: state, `api.getLogs` data flow, routing, i18n, plugin slots,
  page-header wiring, the log viewer, and the card shell.

## Deliberate gaps

The library ships no `Card`, `Badge`, `Spinner`, or segmented control, so those keep the
dashboard's existing primitives. Log lines stay in the dashboard's own viewer (`DataTable` is not
applicable to a wrapped log stream). No second chat surface, per `web/AGENTS.md`.

## Verification

- `npm run typecheck` — clean. `npm run lint` — no new problems. `npm run test` — no new failures
  (two timing-flaky `SessionsPage` tests fail under full-suite load on a slow macOS 12 host **with
  and without this change**; both pass in isolation).
- `LogsPage.test.tsx` — renders the ported controls (3 tabs / 3 fields / 3 comboboxes), shows
  fetched lines, and drives the tab switch through the page's own data flow.
- `npm run build` — passes; the library's JS and CSS are in the bundle (vendor chunks) and the
  scoped bridge sits in the route's CSS chunk.

## How to look at it

Run the dashboard as usual (`hermes web --no-open` + `npm run -w web dev`) and open `/logs`.
Nothing else needs configuring.

## Findings

- **Coexistence is real:** the prefixed static CSS and Tailwind v4 interleave without conflicts;
  the token bridge made the port look native to the dashboard with ~40 lines of CSS.
- **`Field` + `Select` (listbox) wiring worked as documented** — id/aria flow, no glue needed.
- **Library gaps found in anger:** no segmented filter control (the natural primitive for this
  toolbar), no `Card` / `Badge` / `Spinner`. The Tabs-as-file-switcher substitution is acceptable
  but visually heavier than the segmented control it replaced.
- **Typography:** the controls bring the library's own type scale; if this page graduates from
  pilot, do a floors pass against the dashboard's rules (nothing below `text-xs`).
- **Motion:** nothing to observe here — the library is deliberate about zero motion, and an ops
  surface does not miss it.

## If it sticks

1. Decide distribution: a public repo cannot depend on a token-gated registry (public npm scope
   vs private-only usage).
2. Publish `@trade/ui@0.1.0`, install from the registry instead of a local tarball, and continue
   page-by-page (or stop here).
