# Rule of Thirds — Open Findings

A prioritized backlog of concerns and improvement ideas identified in a code
audit of `feature/golden-ratio` after adding Phi Grid and renaming Golden
Ratio to Fibonacci Spiral. Pick items off in priority order as time allows;
none of these block day-to-day use except where noted.

## High priority

1. ~~**`content.js` — two top-level `const` declarations broke re-injection, silently disabling the toolbar toggle.**~~ **Fixed.**
   `PHI_GRID_LINE_COUNT` and `DEFAULT_PHI_RATIO` were declared with `const`
   at the top of `content.js`, unlike every other top-level identifier in
   the file (`HEX_COLOUR_PATTERN` etc. all use `var`, exactly because this
   file gets re-injected into the same page on every toolbar click).
   `const` throws `Uncaught SyntaxError: Identifier '...' has already been
   declared` on the second injection - which aborts the whole script before
   `rotInit()` even runs, so nothing after that point executes at all: no
   toggle, no overlay change, nothing. Reported live as "extension toggle
   does not switch off any more". Changed both to `var`; confirmed fixed by
   injecting `grid-render.js`/`golden-ratio.js`/`content.js` three times in
   a row into the same page (toggle on → off → on), no errors, canvas
   count tracked correctly each time.

2. ~~**`options.js` — switching to Fibonacci Spiral threw inside `saveOptions`, so the change never reached `chrome.storage.sync`.**~~ **Fixed.**
   `renderGridCustomisePreview()` unconditionally called
   `currentWeightedGridStyle()`/`currentCustomiseShape()`, which only have
   entries for `grid`/`phi-grid` - for `golden-ratio` they return
   `undefined`, and the very next line read `.linesEnabled` off it,
   throwing `TypeError: Cannot read properties of undefined (reading
   'linesEnabled')`. Since `renderGridCustomisePreview()` runs *inside*
   `saveOptions()`, before the `chrome.storage.sync.set()` call at the end,
   the throw meant the new `overlayStyle` was never actually saved -
   matching the reported "switching to fibonacci spiral does not update
   live" (Phi Grid worked because it *is* in the lookup). Added an early
   return when the current style has no weighted-grid entry, since the
   whole Customise section is hidden for Fibonacci Spiral anyway - nothing
   to draw. Confirmed fixed live: switching to Fibonacci Spiral now shows
   the "Options saved." toast, and switching back to Grid/Phi Grid still
   re-renders Customise correctly.

3. ~~**`overlayStyle`/`goldenRatioDirection`/`goldenRatioStart` are read from storage unvalidated, and a bad value crashes the whole render loop.**~~ **Fixed.**
   `content.js`'s `sanitizeOptions` bounds-checks `gridRows`, `phiRatio`,
   colours, etc., but passed these three straight through via `...data`.
   `golden-ratio.js`'s `configureControl` switch had no `default` - an
   unrecognized `direction`/`start` pair returned `undefined`, and
   `calculateSections` immediately destructured `control.initialRotation`
   off it, throwing. Separately, `OVERLAY_STYLE_DRAWERS[options.overlayStyle](...)`
   would throw `TypeError: ... is not a function` if `overlayStyle` wasn't
   exactly `grid`/`phi-grid`/`golden-ratio`. Either throw would have
   happened inside `applyOverlays()`'s loop over every `<img>` with no
   `try`/`catch` anywhere in the file, aborting mid-loop (skipping the
   overlay on every remaining image) *and* skipping the trailing
   `controlElement.setAttribute('active', 'true')` - since `toggleOverlays()`
   and `reportState()` are chained in the same `.then()`, the toolbar icon
   would have silently desynced too. Added `sanitizeEnum` and three
   `VALID_*` lists to `content.js` - `sanitizeOptions` now validates all
   three fields (falling back to `grid`/`clockwise`/`bottom-left`), and
   `configureControl` also got a defensive `default:` case (same fallback)
   as a second line of defence for any other caller. Covered by new tests
   in `content.test.js` and `golden-ratio.test.js` (closes #8 too).

## Worth doing

4. ~~**Duplicate `aria-label="Outer ratio"`** on both `phi-ratio-1` and
   `phi-ratio-3` in `options.html`.~~ **Fixed.** Relabelled "First outer
   ratio" / "Second outer ratio".

5. ~~**Fibonacci Spiral thumbnail selection isn't exposed to assistive
   tech.**~~ **Fixed.** `syncGoldenRatioThumbnailSelection` now sets
   `aria-pressed` on each of the 8 thumbnail buttons alongside the CSS
   `.selected` class (which stays default `false` in `options.html` until
   the first sync).

6. ~~**Phi Grid's Ratio fields don't grey out when Phi Grid is disabled**~~
   **Fixed.** Wired `PHI_RATIO_INPUT_IDS` into `syncDependentFieldsEnabled`,
   same as `GRID_DIMENSION_FIELD_IDS` - the ratio positions Circles'
   intersections too (independent of Phi Grid's own "Enabled"), so it only
   dims once *neither* section would use it. Verified live: disabling Phi
   Grid alone leaves it enabled (Circles still needs it), disabling both
   dims it.

7. ~~**`weightedLinePositions`/`smallestWeightedBand` are duplicated**
   between `grid-render.js` and `options.js`.~~ **Fixed (partial).** The
   duplication itself is staying (still needed for `options.js` to stay
   unit-testable without a DOM-oriented sibling file), but added a
   cross-check test in `options.test.js` that requires both copies and
   compares their output across a spread of weight arrays, so any future
   drift between them fails the suite instead of going unnoticed.

8. ~~**No test pins `configureControl`'s undefined-return behaviour.**~~ **Fixed as part of #3.**

9. ~~**`phiRatio` has no upper bound**~~ **Fixed.** Added a `MAX_PHI_RATIO`
   of 100 (generous enough for any real use, just ruling out a ratio so
   lopsided the narrow band collapses toward an unusable sliver) - enforced
   in both `content.js`'s `sanitizePhiRatio` (falls back to the default for
   that entry, same as the existing floor/non-numeric handling) and the
   Options page's `clampFloat` (now takes an optional `max`), plus a
   matching `max="100"` on the three `<input>`s.

10. ~~**Accessibility of the Phi Grid and Fibonacci Spiral sections on the
    Options page**, generally.~~ **Fixed (the gap this turned up).** #4/#6
    (Phi Grid) and #5 (Fibonacci Spiral) covered the labelling/state gaps
    already known about. Live-tested keyboard operability and focus order
    with real Tab presses (not just `.focus()` calls, which don't reliably
    trigger `:focus-visible`): tab order through both sections is sensible,
    and every custom control gets a themed focus ring - except the
    Fibonacci Spiral thumbnails, which had no `:focus-visible` rule at all
    and fell back to the browser's unstyled default outline, inconsistent
    with every other custom control on the page (`quick-swatch`,
    `btn-large`/`btn-small`, `grid-customise-control`,
    `overlay-style-option`). Added a matching `.golden-ratio-thumb:focus-visible`
    rule; confirmed live (`outline-style: solid`, themed colour) after a
    real Tab press onto the first thumbnail.

11. ~~**Fibonacci Spiral thumbnails were 8 separate Tab stops with only
    click/Enter/Space activation**, unlike a native radio group.~~
    **Fixed.** Flagged in review: the 8 thumbnails are functionally a
    single mutually-exclusive choice (same underlying state as the
    direction/start radios), so the expected pattern (WAI-ARIA radiogroup,
    and this codebase's own Customise Control canvas precedent) is one Tab
    stop with arrow keys moving *within* the group, not eight. Converted to
    `role="radiogroup"`/`role="radio"` with `aria-checked` and a roving
    `tabindex` (only the selected thumbnail is `0`), and added arrow-key
    navigation where moving focus also selects immediately - "selection
    follows focus", matching native `<input type="radio">` behaviour (Home/
    End jump to the first/last thumbnail). Confirmed live: Tab lands
    directly on the currently-selected thumbnail, ArrowRight/Down and
    ArrowLeft/Up move and select (wrapping at both ends), the direction/
    start radios and visual highlight stay in sync throughout. Documented
    in `guide.html`.
