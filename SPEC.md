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

7. **`weightedLinePositions`/`smallestWeightedBand` are duplicated**
   between `grid-render.js` and `options.js`, justified by a comment about
   keeping `options.js` directly unit-testable without a DOM - nothing
   enforces the two copies stay in sync if one changes. Consider a
   cross-check test, or accept the duplication as deliberate debt.

8. ~~**No test pins `configureControl`'s undefined-return behaviour.**~~ **Fixed as part of #3.**

9. **`phiRatio` has no upper bound** - `sanitizePhiRatio` and the UI's
   `clampFloat`/`MIN_PHI_RATIO` only enforce a floor (0.01). A very large
   typed value produces a visually degenerate grid (two bands collapse
   toward zero width) but doesn't crash - low-priority UX nit.

10. **Accessibility of the Phi Grid and Fibonacci Spiral sections on the
    Options page**, generally. The original Customise controls (Grid/
    Circles, the Hide/Show canvas) were reviewed for accessibility - the
    newer sections haven't had the same pass. Check keyboard operability,
    focus order, and screen-reader behaviour beyond the specific labelling
    gaps already called out in #4/#5 above.
