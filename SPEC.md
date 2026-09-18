# Rule of Thirds — Open Findings

A prioritized backlog of concerns and improvement ideas identified in a
pre-v1.8-publish audit of `main` (golden-ratio work excluded — tracked
separately on `feature/golden-ratio` for a future v1.9). Pick items off in
priority order as time allows; none of these block day-to-day use.

## High priority

1. **`content.js:168` — `offsetParent` check skips fixed-position images.**
   `if (!image.offsetParent) continue;` is also `null` for `position: fixed`
   elements (and any fixed-ancestor image), not just hidden ones — common in
   lightboxes/modals/fixed heroes. Those images silently never get a grid.
   Fix: check visibility via `getClientRects().length` / computed
   `display`/`visibility` and use `getBoundingClientRect()` for positioning
   instead of `offsetLeft`/`offsetTop` (also wrong under `position: fixed`).

2. ~~**`content.js:228-242` (`removeUndersizedImages`) — redundant image fetch on every toggle.**~~ **Fixed.**
   Replaced the `new Image()` re-fetch with a direct `image.naturalWidth`/
   `naturalHeight` check in `renderImageOverlay`, done before the canvas is
   even created (per the original TODO) rather than after. `resolveImageSrc`
   and `removeUndersizedImages` were both removed as dead code, along with
   their now-obsolete tests, since nothing else called them.

3. ~~**`manifest.json:18-23` — `notifications` permission for one low-value toast.**~~ **Fixed.**
   Replaced `chrome.notifications` with a badge + tooltip on the tab's own
   toolbar icon (`showRefusalBadge` in `service_worker.js`) and dropped the
   `notifications` permission from `manifest.json` entirely. Not click-
   verified live in a browser — `chrome://` pages are blocked from browser-
   automation navigation, so this couldn't be reloaded and tested end to
   end; the logic reuses the same `chrome.action.*` calls `setActionIcon`
   already relies on.

4. ~~**`manifest.json:6` — stale store-listing description.**~~ **Fixed.**
   Now reads "A customisable grid and circle overlay for visualising the
   Rule of Thirds - adjustable rows, columns, colours and opacity." (122
   chars, under the Chrome Web Store's 132-char manifest description limit).

5. **`WebContent/options/options.js` — Customise "Control" canvas has no keyboard access.**
   `grid-customise-control` (`options.html:142`, listeners added
   `options.js:643-646`) only has `click`/`mousemove`/`mouseleave`
   listeners — no `tabindex`, no keyboard handler, no `role`/`aria-label`.
   A keyboard-only user cannot reach or operate per-line/per-circle
   show-hide at all (WCAG 2.1.1 + 1.1.1 failure on a core feature). Fix:
   `tabindex="0"`, an appropriate `role`/`aria-label`, visible `:focus`
   styling, and either keyboard-driven target traversal or an equivalent
   non-canvas control list.

6. **`options.js:saveOptions` — no upper bound on Rows/Columns/Radius, and save failures are silent.**
   `options.html:64,68,90` have no `max`; `clampInt` (`options.js:199-203`)
   only enforces a minimum. A very large grid can make `circleLines` exceed
   `chrome.storage.sync`'s ~8KB per-item quota, and `saveOptions`
   (`options.js:39-100`) never checks `chrome.runtime.lastError` in the
   `chrome.storage.sync.set` callback (`options.js:96-98`) — the "Options saved." toast fires
   even on a silent quota failure. (Note: no *upper bound* on grid size is
   intentional per the v1.7 changelog's performance-warning note — the real
   bug is the missing `lastError` check masking a failed save. Add the
   `lastError` check; a sane `max` is optional polish on top.)

7. **`grid-render.test.js` — the v1.8 "filled circle" feature has zero test assertions.**
   `createRecordingContext()` tracks a `fill` counter but no test ever reads
   `calls.fill`; every test hardcodes `circleStyle: 'outline'`. The
   `circleStyle === 'filled'` branch in `grid-render.js`'s `drawGridOverlay`
   (`grid-render.js:72-76`) is completely untested. Add a test asserting `calls.fill > 0` for
   `circleStyle: 'filled'` and that filled circles don't also `stroke()`.

8. **`options.js:438-439` — low-contrast "disabled" indicator on the Control canvas.**
   `GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR = '#b0b0b0'` on white is only
   ~2.2:1 contrast, under WCAG 1.4.11's 3:1 minimum — and it's the only
   signal distinguishing hidden vs. shown on the sole interactive control.
   Darken to ~`#787878` or darker for 3:1+.

## Medium priority

9. **`service_worker.js:44-48` — icon state can desync on SPA navigation.**
   Icon reset relies on `tabs.onUpdated` with `status === 'loading'`, which
   doesn't fire for client-side (pushState) navigations — common on exactly
   the kind of sites (Instagram, Pinterest, X) this extension targets. The
   toolbar icon can keep showing "active" after the framework has wiped the
   DOM (and the `#rule-of-thirds` control element with it). Not a crash;
   worth a known-limitations note if not fixed.

10. **`content.js:161-182` (`applyGrids`) — no live updates for lazy-loaded/infinite-scroll images.**
    Images are snapshotted once per click; anything added afterward never
    gets a grid until toggled off/on again. Confirm this is intended before
    treating it as a bug — fixing it would mean a `MutationObserver`.

11. **`service_worker.js:24-26` — iframes never get the grid.**
    `executeScript` targets `{tabId}` only (no `allFrames: true`), so
    same-origin iframe content (embeds/widgets) is silently skipped. Likely
    fine given `activeTab` scoping — confirm as intentional.

12. **`content.js` `sanitizeOptions` / `grid-render.js` `hexToRgba` — colour values aren't sanitized.**
    Numeric options are defensively re-validated but `lineColour`/
    `circleColour` pass straight through. A malformed stored value makes
    `hexToRgba` emit `rgba(NaN, NaN, NaN, …)`, which canvas silently no-ops
    — the grid can render as nothing with no error. Add the same kind of
    defensive check already used for the numeric fields.

13. **No DPI/zoom scaling on canvases.** Both the content-script overlay
    canvas (`content.js:205-224`, `createCanvas`) and the two Options
    "Customise" canvases (`options.js:424-436`, `setCanvasSize`) size their
    backing store 1:1 to CSS pixels with no `devicePixelRatio` scaling —
    lines/circles render soft on Retina/high-DPI or zoomed displays. Scale
    by `window.devicePixelRatio` and compensate with `ctx.scale()`.

14. **Options page gives no "why doesn't this do anything" affordance when a section is off.**
    Unchecking Grid's/Circles' "Enabled" doesn't disable/grey the dependent
    fields (Rows/Columns/Radius/Colour/Opacity) — they stay fully
    interactive despite being inert. Toggle a `disabled`/dimmed state on
    dependent fields based on the section's Enabled checkbox.

15. **Customise feature has weak discoverability.** Two side-by-side
    canvases captioned only "Hide / Show" / "Preview" — nothing explains
    that the left one is clickable. Add one line of help text under the
    heading.

16. **`options.js:103-107` (`restoreDefaultOptions`, bound at `options.js:655`) has no confirmation or undo.**
    One click immediately overwrites and saves all customization with no
    way back. Add a confirm step, or an Undo action on the toast.

17. **`versions/history.html` — "Control" label doesn't match the shipped UI.**
    The v1.8 entry describes "a 'Control' map for clicking lines and
    circles on or off", but the actual on-page caption
    (`options.html:141`) is "Hide / Show" — "Control" only exists as an
    internal id/class. Update the changelog wording to match ("Hide /
    Show"), or rename the UI caption.

18. **`test/content.test.js` — `sanitizeLineStates` has no direct tests.**
    It's only exercised indirectly via `sanitizeOptions`/
    `sanitizeCircleStates`, which do get dedicated tests (missing array,
    explicit-false-only rule, resizing). Add the same direct tests for the
    simpler 1D case for symmetry/coverage.

19. **No test verifies the circle-radius geometric clamp.**
    `drawGridOverlay` (`grid-render.js:57-60`) and `options.js`'s
    `renderGridCustomiseReference` (`options.js:474`) both compute
    `radius = Math.min(w/cols/2, h/rows/2, options.circleRadius)`,
    but `createRecordingContext.arc()` only counts calls, never records the
    radius argument — this clamp is unverified in both places. Capture
    `arc(x, y, r, ...)` args in the fake context and assert `r` is clamped
    when `circleRadius` exceeds the cell size.

## Low priority / code quality / nice-to-haves

20. **Leftover `console.log` calls** — `service_worker.js:7-8,22`;
    `content.js:78,98,163,199`. Fine for dev, noisy for a public release;
    strip or gate behind a debug flag.

21. **Misleading re-injection guard comment** — `content.js:76`
    (`if (typeof rotInit === 'undefined') { const rotInit = ... }`). Because
    `const rotInit` is block-scoped, this `typeof` check is always true on
    every injection — it doesn't actually prevent re-running `rotInit()`.
    The real double-registration protection is the
    `document.getElementById('rule-of-thirds')` check inside `rotInit`
    itself. Harmless today, but the header comment claiming this makes the
    `const` "safe to redeclare" is misleading for future maintainers —
    clarify or remove the dead guard.

22. **Blanket top-level `try/catch` in `service_worker.js:1-51`** swallows
    listener-registration errors into a `console.log` nobody sees in
    production; `chrome.*.addListener` essentially never throws
    synchronously. Likely vestigial — consider removing or narrowing.

23. ~~**Awkward IIFE in `removeUndersizedImages`**~~ **Fixed by #2's rewrite** —
    the function (and its IIFE/`onerror` gap) no longer exists.

24. **`manifest.json:32` hardcodes "100 x 50"**, duplicating `MIN_LONG`/
    `MIN_SHORT` in `content.js:82` with nothing keeping them in sync — a
    silent-drift trap if those constants ever change. The same title also
    only describes the "add" direction, not that clicking again removes the
    grid (`toggleGrids()`'s actual behaviour) — minor wording nice-to-have.

25. **`options.js:277` — `255 ^ average`** in `computePreviewBackground` is
    an obscure way to write `255 - average` for an 8-bit channel. Behaviour
    is correct; readability nit only.

26. **Inconsistent focus styling.** Quick-swatch buttons and "Restore
    Defaults" (`style.css`) rely on the default browser focus outline,
    unlike `input[type=number]:focus`'s custom style. Add matching
    `:focus`/`:focus-visible` styling for consistency.

27. **White quick-swatch (`#ffffff`) has no static border** — nearly
    invisible against the `#fafafa` page background when unselected.

28. **Narrow-viewport Customise layout degrades before it visibly "breaks".**
    Control is a fixed 200×200 square; Preview shrinks via
    `Math.max(1, …)` and can become a useless sliver well before the single
    600px breakpoint kicks in. Consider stacking Control above Preview
    below some width.

29. **Field caption text is small** — `0.8rem` (~12.8px). Passes contrast
    (~5.7:1) but is on the small side; ~0.85–0.9rem would read more
    comfortably.

30. **`options.js:323-332` (`loadPreviewPhoto`) has no `image.onerror` handler.**
    A failed webp load fails silently — the background photo toggle does
    nothing with no feedback.

## Already checked and solid (no action needed)

- Minimal permission footprint otherwise (`activeTab` + `scripting`, no
  broad `host_permissions`), used only on a user gesture.
- `executeScript` failure path is handled, not left to throw unhandled.
- Grid/circle math is division-safe — row/column counts are bounded ≥1, no
  divide-by-zero paths found.
- `removeGrids()` cleans up via a stable `[data-extension="rule-of-thirds"]`
  selector — robust even if a prior apply partially failed.
- No `eval`/inline-script usage.
- `content.js` `readOptions()` defaults and `options.js` `DEFAULT_OPTIONS`
  agree on every shared key.
- `manifest.json` `version` ("1.8") matches `history.html`'s top entry.
- All other v1.8 changelog claims were traced to matching code and are
  accurate; the "removed Materialize CSS/JS" claim is accurate too.
