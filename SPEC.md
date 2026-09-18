# Rule of Thirds — Open Findings

A prioritized backlog of concerns and improvement ideas identified in a
pre-v1.8-publish audit of `main` (golden-ratio work excluded — tracked
separately on `feature/golden-ratio` for a future v1.9). Pick items off in
priority order as time allows; none of these block day-to-day use.

## High priority

1. ~~**`content.js:168` — `offsetParent` check skips fixed-position images.**~~ **Fixed.**
   Reproduced first with a demo page (three images: normal flow, `<img>`
   itself `position: fixed`, and an image inside a `position: fixed`
   *ancestor*) before touching the code. That narrowed the actual bug: only
   the second case is affected — `offsetParent` is `null` only when the
   image's *own* computed position is `fixed`; an image merely nested
   inside a fixed ancestor (the common lightbox/modal pattern) already
   resolves `offsetParent` to that ancestor and was never broken. The
   original audit note overstated the blast radius.

   `applyGrids()` now checks `image.getClientRects().length === 0` instead
   of `!image.offsetParent` to decide whether an image is actually
   rendered (still correctly skips `display:none` on the image or any
   ancestor). `createCanvas()` now branches: with an `offsetParent`, it
   positions/appends exactly as before (unchanged, still scrolls with the
   page); without one, it appends the canvas to `document.body` as
   `position: fixed` itself, positioned via `image.getBoundingClientRect()`.
   Live-verified in the browser: the fixed-position image now gets its
   grid, and it stays correctly aligned on scroll, same as the other two.

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

5. ~~**`WebContent/options/options.js` — Customise "Control" canvas has no keyboard access.**~~ **Fixed.**
   Went with keyboard-driven target traversal on the canvas itself, rather
   than a parallel list of real controls — up to 9 rows/columns (SPEC #6)
   can mean 8 row lines + 8 column lines + up to 64 circles, too many to
   usefully lay out as individual buttons.

   `listGridCustomiseTargets(options)` (new, pure, tested) enumerates every
   line/circle in the same reading order and eligibility rules as the
   existing `findGridCustomiseTarget` hit-testing. The canvas is now
   `tabindex="0"` with `role="application"` (deliberate: its own Arrow/
   Enter/Space handling needs to take priority over a screen reader's
   default browse-mode key handling) and an `aria-label` explaining the
   controls. Arrow keys move a "keyboard focus index" through that list
   (wrapping; Home/End jump to the ends), Enter/Space toggles the current
   target via a `toggleGridCustomiseTarget` helper now shared with the
   click handler. A screen-reader-only `aria-live` region
   (`#grid-customise-status`, `.sr-only` in `style.css`) announces the
   current target and its shown/hidden state on every focus and move.

   For sighted keyboard users, `drawGridCustomiseFocus` (new, pure, tested)
   draws a teal indicator on the canvas itself (there's no native focus
   ring for canvas content), plus a `:focus-visible` outline around the
   canvas via CSS. First attempt traced the highlight directly over the
   focused line/circle, which completely hid whether it was actually
   shown or hidden (its black-vs-grey colour) — caught by re-reading my
   own diff, not by testing. Fixed by drawing a small edge chevron for
   lines and a ring *around* (not over) a circle instead, confirmed by
   sampling the actual canvas pixels afterward. Mouse clicks now also sync
   the keyboard focus index to whatever was clicked, so switching input
   methods mid-session doesn't leave the focus ring somewhere unrelated.

   Live-tested in a browser: real Tab key reaches the canvas in the
   natural tab order; Arrow/Enter/Space navigate and toggle correctly;
   the live region text and `role`/`aria-label` are present and accurate;
   pixel-sampled the canvas to confirm the disabled line still renders in
   its actual grey, not painted over by the focus indicator.

6. ~~**`options.js:saveOptions` — no upper bound on Rows/Columns/Radius, and save failures are silent.**~~ **Fixed.**
   Rows/Columns are now capped at 9 (`MAX_GRID_LINES` in `options.js`, `max="9"`
   on `options.html`'s inputs, and threaded through `clampInt`/`parseValidInt`
   and the live preview) — chosen deliberately over a larger technical
   maximum for its 3x3-grid synergy with the Rule of Thirds itself, and it
   also rules out `circleLines` ever approaching `chrome.storage.sync`'s
   per-item quota. `sanitizeOptions` in `content.js` now enforces the same
   cap defensively, in case a larger value was already synced from before
   this existed. `saveOptions`'s `chrome.storage.sync.set` callback now
   checks `chrome.runtime.lastError` and shows the actual error instead of
   a false "Options saved." (Radius was left unbounded — it doesn't
   contribute to the quota risk this item was really about.) Live-tested in
   a browser: typing 20 into Rows clamps to 9 and the preview updates to a
   9-row grid; a simulated `chrome.storage.sync.set` failure surfaces the
   `lastError` message in the toast instead of a false success.

7. ~~**`grid-render.test.js` — the v1.8 "filled circle" feature has zero test assertions.**~~ **Fixed.**
   Added a test asserting `circleStyle: 'filled'` calls `fill()` once per
   intersection and never `stroke()` for a circle, and added a
   complementary assertion to the existing outline test confirming the
   reverse (`fill` stays at 0).

8. ~~**`options.js:438-439` — low-contrast "disabled" indicator on the Control canvas.**~~ **Fixed.**
   `GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR` changed from `#b0b0b0`
   (~2.2:1 on white) to `#787878` (~4.4:1), clear of WCAG 1.4.11's 3:1
   minimum.

## Medium priority

9. ~~**`service_worker.js:44-48` — icon state can desync on SPA navigation.**~~ **Fixed.**
   `tabs.onUpdated` now also resets the icon on `changeInfo.url` (which
   Chrome fires for client-side/pushState route changes, unlike
   `status: 'loading'`), not just a full page load.

   Note this only fixes the *icon* lying about state after an SPA route
   change - it doesn't make the grid itself survive one. Investigated
   `business.pinterest.com` directly (DOM inspection, not the loaded
   extension - `chrome://extensions` can't be automated): its real content
   images (eg the ~1027x874 hero photo) have normal `offsetParent`/sizing
   and should already be picked up fine by the existing detection logic;
   no CSP was found that would block script injection either. So if the
   grid still doesn't appear there after this fix, the cause is something
   else - worth trying the main pin-browsing app (pinterest.com) too,
   where images are more likely lazy/virtualized (see #10).

10. **`content.js:161-182` (`applyGrids`) — no live updates for lazy-loaded/infinite-scroll images.**
    Images are snapshotted once per click; anything added afterward never
    gets a grid until toggled off/on again. Confirm this is intended before
    treating it as a bug — fixing it would mean a `MutationObserver`.

11. **`service_worker.js:24-26` — iframes never get the grid.**
    `executeScript` targets `{tabId}` only (no `allFrames: true`), so
    same-origin iframe content (embeds/widgets) is silently skipped. Likely
    fine given `activeTab` scoping — confirm as intentional.

12. ~~**`content.js` `sanitizeOptions` / `grid-render.js` `hexToRgba` — colour values aren't sanitized.**~~ **Fixed.**
    Added `sanitizeColour(value, fallback)` to `content.js`, falling back
    to the same defaults `readOptions()` already uses (`#ffffff`/`#ff0000`)
    for anything that isn't a full 6-digit `#rrggbb` string - `hexToRgba`
    hard-codes 6-digit substring offsets, so even a technically-valid CSS
    shorthand like `#000` would already have parsed into garbage. Only
    `content.js`'s path needed it: `options.js`'s colour inputs are native
    `<input type="color">`, which the browser itself always normalizes to
    `#rrggbb`.

13. ~~**No DPI/zoom scaling on canvases.**~~ **Fixed.**
    Both `content.js`'s overlay canvas and `options.js`'s two Customise
    canvases now size their backing store to `devicePixelRatio`, keeping
    CSS size at the logical dimensions.

    `content.js`'s canvas is freshly created on every apply, so a plain
    `ctx.scale(dpr, dpr)` once per canvas is enough. `options.js`'s two
    Customise canvases are persistent and redrawn repeatedly (every option
    change), so a relative `.scale()` would compound on each redraw -
    used `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` instead, which resets
    absolutely every time. Since `canvas.width`/`height` are now the scaled
    backing store rather than the logical size, added
    `getCanvasLogicalSize()` (reads back `canvas.style.width`/`height`) so
    drawing code keeps computing in CSS-pixel coordinates. Click/hover
    hit-testing needed no changes - it already scales by
    `canvas.width / rect.width`, which generalizes to any backing-store
    ratio including this one.

    Live-verified in a browser at a simulated `devicePixelRatio` of 2:
    backing stores measured at exactly 2x the CSS size; a real grid line
    drawn at content.js's dpr=2 landed at the exact expected scaled pixel
    column; clicking/toggling a line or circle in the Customise Control
    canvas still hit-tested and rendered correctly at the right scaled
    position; repeated clicks (stress-testing for transform compounding)
    kept landing on the same pixel row each time; and the keyboard focus
    ring (#5) still rendered at the correct scaled position too.

14. **Options page gives no "why doesn't this do anything" affordance when a section is off.**
    Unchecking Grid's/Circles' "Enabled" doesn't disable/grey the dependent
    fields (Rows/Columns/Radius/Colour/Opacity) — they stay fully
    interactive despite being inert. Toggle a `disabled`/dimmed state on
    dependent fields based on the section's Enabled checkbox.

15. ~~**Customise feature has weak discoverability.**~~ **Fixed.**
    Added a one-line `.help-text` note under the "Customise" heading:
    `Click a line or circle in the map below to show or hide it -
    "Preview" shows the result.`

16. ~~**`options.js:103-107` (`restoreDefaultOptions`, bound at `options.js:655`) has no confirmation or undo.**~~ **Fixed.**
    Went with the Undo-toast option rather than a confirm step.
    `restoreDefaultOptions` snapshots the current options before
    overwriting, and its toast now reads "Options reset to defaults." with
    an "Undo" button that restores the snapshot and re-saves. `showToast`
    gained an optional `action` parameter (`{label, onClick}`) and stays up
    longer (6s vs 2s) when one is present, and `saveOptions` gained
    optional `successMessage`/`successAction` parameters so a caller other
    than a plain field edit can show something other than "Options saved."
    Live-tested in a browser: restored defaults over custom values, then
    clicked Undo and confirmed both the UI and `chrome.storage.sync`
    itself were back to the exact pre-reset values.

17. ~~**`versions/history.html` — "Control" label doesn't match the shipped UI.**~~ **Fixed.**
    Updated the changelog wording to "Hide / Show" to match the actual
    on-page caption (`options.html:141`) — "Control" only ever existed as
    an internal id/class. Also fixed the same stale wording in
    `guide/guide.html`, which had inherited it.

18. ~~**`test/content.test.js` — `sanitizeLineStates` has no direct tests.**~~ **Fixed.**
    Added the same direct tests `sanitizeCircleStates` already had (missing
    array, explicit-false-only rule, resizing, plus a count-of-0 edge case).

19. ~~**No test verifies the circle-radius geometric clamp.**~~ **Fixed.**
    `createRecordingContext`/`createColourRecordingContext`'s fake `arc()`
    now records the radius argument (`arcRadii`), and a new test in each of
    `grid-render.test.js` and `options.test.js` asserts it's clamped to fit
    the grid cell when `circleRadius` asks for more, and left as-is when it
    already fits.

## Low priority / code quality / nice-to-haves

20. ~~**Leftover `console.log` calls**~~ **Fixed.**
    Stripped every flow-tracing `console.log` in both `service_worker.js`
    and `content.js` (`"Previous/Current Version"`, `"Browser action
    clicked"`, `"Injecting function"`, `"Applying/Removing grids"`, etc.).
    Kept the one genuine error log — `console.log(e)` in
    `service_worker.js`'s top-level `catch` block.

21. ~~**Misleading re-injection guard comment**~~ **Fixed.**
    Went with clarifying rather than removing the (harmless, always-true)
    dead guard, to avoid restructuring the file's outer scope without a
    way to live-test the result. Added a comment right at the
    `if (typeof rotInit === 'undefined')` check explaining it's always
    true and why, and pointing at the `document.getElementById`
    check inside `rotInit` as the real double-registration protection.

22. **Blanket top-level `try/catch` in `service_worker.js:1-51`** swallows
    listener-registration errors into a `console.log` nobody sees in
    production; `chrome.*.addListener` essentially never throws
    synchronously. Likely vestigial — consider removing or narrowing.

23. ~~**Awkward IIFE in `removeUndersizedImages`**~~ **Fixed by #2's rewrite** —
    the function (and its IIFE/`onerror` gap) no longer exists.

24. ~~**`manifest.json:32` hardcodes "100 x 50"**~~ **Partly fixed.**
    The title now says "Toggle..." instead of "Add...", so it describes the
    actual click-to-toggle behaviour instead of just the "add" direction.
    The "100 x 50"/`MIN_LONG`/`MIN_SHORT` duplication itself can't really
    be fixed - `manifest.json` is static JSON with no way to reference a
    JS constant - so added a comment next to `MIN_LONG`/`MIN_SHORT` in
    `content.js` flagging that they need to stay in sync by hand.

25. ~~**`options.js:277` — `255 ^ average`**~~ **Fixed.**
    Replaced with `255 - average` (equivalent for an 8-bit channel).
    Existing `computePreviewBackground` tests, including the exact
    deterministic `rgb(191, 223, 223)` expectation, still pass unchanged,
    confirming this was behaviour-preserving.

26. ~~**Inconsistent focus styling.**~~ **Fixed.**
    Added `:focus-visible` outlines to `.quick-swatch` (teal, distinct from
    `.selected`'s border-colour change so the two states don't look the
    same) and `.btn-large` (the darker `--color-primary-dark`, for contrast
    against the button's own teal fill). Live-verified with real Tab-key
    focus in a browser (not just a programmatic `.focus()`, which doesn't
    trigger `:focus-visible` at all).

27. ~~**White quick-swatch (`#ffffff`) has no static border**~~ **Fixed.**
    Added a permanent light grey border (`#d0d0d0`) via
    `[data-value="#ffffff"]`, ordered so `.selected` (equal specificity)
    still wins via source order when the white swatch is the selected one.
    Verified both states via computed style in a browser.

28. ~~**Narrow-viewport Customise layout degrades before it visibly "breaks".**~~ **Fixed.**
    `layoutGridCustomiseCanvases()` now stacks Control above Preview (via
    a new `.grid-customise-col-stacked` class - `flex-direction: column`)
    once sharing the row with Control's fixed 200px would leave Preview
    narrower than `MIN_SIDE_BY_SIDE_PREVIEW_WIDTH` (200px), instead of
    squeezing it down toward `Math.max(1, …)`. Also skips the side-by-side
    vertical-centring `marginTop` hack when stacked, since there's nothing
    to centre against once they're no longer side by side. Live-verified
    in a browser: forced a 380px container width, confirmed the stacked
    class applies and Preview claims the full width instead of being
    squeezed, then reverted to a wide container and confirmed it correctly
    un-stacks back to the normal side-by-side layout.

29. ~~**Field caption text is small**~~ **Fixed.**
    `label[for]`/`.field-caption` bumped from `0.8rem` to `0.875rem`.

30. ~~**`options.js:323-332` (`loadPreviewPhoto`) has no `image.onerror` handler.**~~ **Fixed.**
    Added an `onerror` handler that logs a `console.warn` - the existing
    fallback (plain computed-colour fill, since `previewPhotoLoaded` just
    stays `false`) already handles the UI gracefully, so this is purely
    about making the failure discoverable instead of silent. Live-verified
    in a browser by temporarily removing `preview-background.webp`: the
    warning fires and the preview still renders correctly via the
    fallback, no broken image or crash.

## Found during testing (not in the original audit)

31. ~~**`options.js:801-804` (`getSelectedOption`) throws if called before a radio group has anything checked.**~~ **Fixed.**
    Reported live from Chrome's own "Errors" panel on the Manage Extensions
    page: `Uncaught TypeError: Cannot read properties of null (reading
    'value')` at `options.js:803`. Root cause: the `circle-style` radios
    have no `checked` attribute in the static HTML, so
    `document.querySelector('input[name="circle-style"]:checked')` is
    `null` until `setOptions()` runs after `chrome.storage.sync.get`
    resolves — and `renderGridCustomisePreview()` can run before that,
    triggered independently by the background photo's `onload` or
    `ResizeObserver`'s own first callback, both of which can win the race
    against a real storage round-trip. Reproduced locally first (delayed
    a mocked `chrome.storage.sync.get` to simulate that race, hit the
    identical stack trace), then fixed `getSelectedOption` to take a
    `fallback` parameter (matching the pattern `clampInt` already uses)
    instead of assuming something is always checked, and re-ran the same
    reproduction to confirm it no longer throws.

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
