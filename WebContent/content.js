// Pure helpers, hoisted out of rotInit() so they can be unit tested in
// isolation (see /test) and reused without touching the DOM or chrome.*.
// `function` declarations (unlike rotInit's `const`) are safe to redeclare
// if this file is injected into the same page more than once.

// `eitherOrientation` (on by default) lets the width/height minimums apply
// swapped too, so a tall portrait image can qualify using its height for
// the width minimum and vice versa. Off, the minimums apply exactly as
// given - eg the default 100/50 then only accepts images at least 100 wide,
// which in practice means landscape-shaped images only.
function isMinSize(w, h, minWidth, minHeight, eitherOrientation = true) {

    if (eitherOrientation) {
        return (w >= minWidth && h >= minHeight) || (h >= minWidth && w >= minHeight);
    }
    return w >= minWidth && h >= minHeight;
}

function shouldRender(computedStyle, w, h, minWidth, minHeight, eitherOrientation = true) {

    const visibility = computedStyle['visibility'];
    const display = computedStyle['display'];

    return visibility !== 'hidden' && display !== 'none' && isMinSize(w, h, minWidth, minHeight, eitherOrientation);
}

// Phi Grid is always 3 bands per axis (see PHI_GRID_BAND_COUNT in
// options.js) - unlike Grid, it has no user-editable row/column count.
// `var`, not `const` - like every other top-level declaration in this file
// (see HEX_COLOUR_PATTERN below), it must be safe to redeclare when this
// file is injected into the same page more than once.
var PHI_GRID_LINE_COUNT = 2;
var DEFAULT_PHI_RATIO = [1, 0.618, 1];
// Matches the Options page's MAX_PHI_RATIO - already far more skewed than
// any real composition guide needs, just enough to rule out a ratio so
// lopsided the narrow band collapses toward an unusable sliver.
var MAX_PHI_RATIO = 100;

// Storage may hold a ratio saved by an older/corrupted version, or with the
// wrong number of entries - falls back per-entry (not as a whole array) so
// a single bad value doesn't discard two otherwise-valid ones.
function sanitizePhiRatio(value) {

    if (!Array.isArray(value) || value.length !== DEFAULT_PHI_RATIO.length) {
        return DEFAULT_PHI_RATIO.slice();
    }
    return value.map((entry, index) => {
        const parsed = parseFloat(entry);
        return Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_PHI_RATIO ? parsed : DEFAULT_PHI_RATIO[index];
    });
}

// overlayStyle/goldenRatioDirection/goldenRatioStart all drive a lookup
// (OVERLAY_STYLE_DRAWERS below, configureControl in golden-ratio.js) that
// has no safe fallback of its own for a value outside its known set - an
// unrecognized one throws and aborts applyOverlays() partway through,
// leaving some images without an overlay and the toolbar icon out of sync.
// Storage could hold anything (a sync conflict with an older/newer
// version, manual tampering), so every enum-shaped field is validated here
// rather than trusted as-is.
var VALID_OVERLAY_STYLES = ['grid', 'phi-grid', 'golden-ratio'];
var VALID_GOLDEN_RATIO_DIRECTIONS = ['clockwise', 'counter-clockwise'];
var VALID_GOLDEN_RATIO_STARTS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function sanitizeEnum(value, validValues, fallback) {

    return validValues.includes(value) ? value : fallback;
}

// Storage may hold values saved by an older version of the options page
// (numbers saved as strings, or missing bounds checks), so re-validate on
// every read rather than trusting what was persisted.
function sanitizeOptions(data) {

    // 9 rows/columns matches the max the options page itself enforces (see
    // MAX_GRID_LINES in options.js) - capped here too in case a larger
    // value was already synced from before that limit existed.
    const gridRows = sanitizeInt(data.gridRows, 1, 3, 9);
    const gridColumns = sanitizeInt(data.gridColumns, 1, 3, 9);

    return {
        ...data,
        gridRows,
        gridColumns,
        minImageWidth: sanitizeInt(data.minImageWidth, 1, 100),
        minImageHeight: sanitizeInt(data.minImageHeight, 1, 50),
        gridRowLines: sanitizeLineStates(data.gridRowLines, gridRows - 1),
        gridColumnLines: sanitizeLineStates(data.gridColumnLines, gridColumns - 1),
        circleRadius: sanitizeInt(data.circleRadius, 1, 5),
        lineOpacity: sanitizeInt(data.lineOpacity, 0, 100, 100),
        circleOpacity: sanitizeInt(data.circleOpacity, 0, 100, 100),
        resizeMaskOpacity: sanitizeInt(data.resizeMaskOpacity, 0, 50, 100),
        circleLines: sanitizeCircleStates(data.circleLines, gridRows - 1, gridColumns - 1),
        lineColour: sanitizeColour(data.lineColour, '#ffffff'),
        circleColour: sanitizeColour(data.circleColour, '#ff0000'),
        phiRatio: sanitizePhiRatio(data.phiRatio),
        phiRowLines: sanitizeLineStates(data.phiRowLines, PHI_GRID_LINE_COUNT),
        phiColumnLines: sanitizeLineStates(data.phiColumnLines, PHI_GRID_LINE_COUNT),
        phiCircleLines: sanitizeCircleStates(data.phiCircleLines, PHI_GRID_LINE_COUNT, PHI_GRID_LINE_COUNT),
        overlayStyle: sanitizeEnum(data.overlayStyle, VALID_OVERLAY_STYLES, 'grid'),
        goldenRatioDirection: sanitizeEnum(data.goldenRatioDirection, VALID_GOLDEN_RATIO_DIRECTIONS, 'clockwise'),
        goldenRatioStart: sanitizeEnum(data.goldenRatioStart, VALID_GOLDEN_RATIO_STARTS, 'bottom-left')
    };
}

function sanitizeInt(value, min, fallback, max = Infinity) {

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : Math.min(Math.max(parsed, min), max);
}

// `var`, not `const` - like every other top-level declaration in this file,
// it must be safe to redeclare when this file is injected into the same
// page more than once (see the file-header comment above).
var HEX_COLOUR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// A malformed stored colour (eg from external tampering, a future format
// change, or plain corruption) would otherwise reach hexToRgba() as-is,
// which turns it into rgba(NaN, NaN, NaN, ...) - canvas silently draws
// nothing for that, so the overlay can vanish with no error or explanation.
function sanitizeColour(value, fallback) {

    return typeof value === 'string' && HEX_COLOUR_PATTERN.test(value) ? value : fallback;
}

// Storage may hold a shorter/longer array than the current grid size (eg
// after Rows/Columns changed on another synced browser), and only an
// explicit `false` should ever disable a line - anything else defaults to
// enabled, including entries missing entirely.
function sanitizeLineStates(lines, count) {

    const result = [];
    for (let ii = 0; ii < count; ii++) {
        result.push(Array.isArray(lines) ? lines[ii] !== false : true);
    }
    return result;
}

// Same "explicit false only" rule as sanitizeLineStates, applied per row, so
// a saved circle grid that's short/long (or from before this option
// existed) still resizes cleanly to the current row/column counts.
function sanitizeCircleStates(rows, rowCount, columnCount) {

    const result = [];
    for (let ii = 0; ii < rowCount; ii++) {
        result.push(sanitizeLineStates(Array.isArray(rows) ? rows[ii] : undefined, columnCount));
    }
    return result;
}

// --- Overlay resize ("Enable Resize" on the overlay's right-click menu) ---
//
// A resize rectangle is always in the same coordinate space the overlay is
// drawn in - CSS pixels relative to the image's own top-left corner,
// {x, y, w, h}. It's deliberately never persisted to chrome.storage (see
// rotInit's imageOverrides comment) - pulled out as pure functions here
// purely so the clamping/dragging maths can be unit tested without a real
// pointer or DOM.

// Below this, a handle would be fiddlier to grab accurately than it's
// worth, and a resize could invert the rectangle inside-out.
var MIN_RESIZE_DIMENSION = 20;

// Each handle moves a subset of the rectangle's four edges - a corner
// handle (eg 'se') moves both its adjacent edges, an edge-midpoint handle
// (eg 'e') only the one edge it sits on. `fx`/`fy` (0, 0.5 or 1) place the
// handle itself as a fraction of the rectangle's width/height, and
// `cursor` is the resize cursor to show while hovering/dragging it.
var RESIZE_HANDLES = {
    nw: {edges: ['n', 'w'], fx: 0, fy: 0, cursor: 'nwse-resize'},
    n: {edges: ['n'], fx: 0.5, fy: 0, cursor: 'ns-resize'},
    ne: {edges: ['n', 'e'], fx: 1, fy: 0, cursor: 'nesw-resize'},
    e: {edges: ['e'], fx: 1, fy: 0.5, cursor: 'ew-resize'},
    se: {edges: ['s', 'e'], fx: 1, fy: 1, cursor: 'nwse-resize'},
    s: {edges: ['s'], fx: 0.5, fy: 1, cursor: 'ns-resize'},
    sw: {edges: ['s', 'w'], fx: 0, fy: 1, cursor: 'nesw-resize'},
    w: {edges: ['w'], fx: 0, fy: 0.5, cursor: 'ew-resize'}
};

// The rectangle an overlay draws into for a given image - an override's
// own rect if one is set (see rotInit's imageOverrides), or the whole
// image otherwise. Pulled out as its own function so drawing and handle
// placement both derive the rectangle the same way.
function activeResizeRect(override, imageWidth, imageHeight) {

    return (override && override.rect) || {x: 0, y: 0, w: imageWidth, h: imageHeight};
}

function resizeHandlePosition(rect, handleId) {

    const handle = RESIZE_HANDLES[handleId];
    return {x: rect.x + rect.w * handle.fx, y: rect.y + rect.h * handle.fy};
}

// Drags one handle of `startRect` by (dx, dy) - the pointer's total
// movement since the drag began, not a per-frame delta - and returns the
// resulting rectangle.
//
// Clamped to stay fully within the image, (0, 0) to (imageWidth,
// imageHeight): dragging a handle out over the rest of the page would let
// the overlay grow past its own image and start overlapping unrelated
// page content, including another image's own overlay. Also clamped to
// MIN_RESIZE_DIMENSION so a handle can never invert the rectangle or
// shrink it to nothing.
function dragResizeRect(startRect, handleId, dx, dy, imageWidth, imageHeight) {

    const edges = RESIZE_HANDLES[handleId].edges;

    let left = startRect.x;
    let top = startRect.y;
    let right = startRect.x + startRect.w;
    let bottom = startRect.y + startRect.h;

    if (edges.includes('n')) { top += dy; }
    if (edges.includes('s')) { bottom += dy; }
    if (edges.includes('w')) { left += dx; }
    if (edges.includes('e')) { right += dx; }

    left = Math.max(0, left);
    top = Math.max(0, top);
    right = Math.min(imageWidth, right);
    bottom = Math.min(imageHeight, bottom);

    // The edge(s) this handle doesn't move are never touched above, so
    // they're still exactly where they started - safe to measure the
    // minimum size against.
    if (edges.includes('n')) { top = Math.min(top, bottom - MIN_RESIZE_DIMENSION); }
    if (edges.includes('s')) { bottom = Math.max(bottom, top + MIN_RESIZE_DIMENSION); }
    if (edges.includes('w')) { left = Math.min(left, right - MIN_RESIZE_DIMENSION); }
    if (edges.includes('e')) { right = Math.max(right, left + MIN_RESIZE_DIMENSION); }

    return {x: left, y: top, w: right - left, h: bottom - top};
}

// Same drag semantics as dragResizeRect above (the handle's own edges
// move, the others stay put) but the rectangle's aspect ratio - width
// divided by height, taken from `startRect` itself, whatever it happens
// to be when the drag begins, not necessarily the image's own ratio - is
// preserved throughout (see the "Maintain Aspect Ratio" context-menu
// item). A corner handle lets whichever axis the pointer has moved
// further along, proportionally, drive the resize, deriving the other
// axis from the ratio; an edge handle (only one axis of its own) derives
// its other axis the same way, growing/shrinking evenly around the
// rectangle's own centre on that axis, since there's no edge of the
// user's own dragging to anchor it to instead.
function dragResizeRectLocked(startRect, handleId, dx, dy, imageWidth, imageHeight, aspectRatio = startRect.w / startRect.h) {

    const edges = RESIZE_HANDLES[handleId].edges;
    const drivesWidth = edges.includes('w') || edges.includes('e');
    const drivesHeight = edges.includes('n') || edges.includes('s');

    const free = dragResizeRect(startRect, handleId, dx, dy, imageWidth, imageHeight);

    let w = free.w;
    let h = free.h;

    if (drivesWidth && drivesHeight) {
        // Cross-multiplied rather than dividing, so this compares the two
        // axes' proportional change without risking a divide-by-zero.
        const widthChanged = Math.abs(free.w - startRect.w) * startRect.h;
        const heightChanged = Math.abs(free.h - startRect.h) * startRect.w;
        if (widthChanged >= heightChanged) {
            h = w / aspectRatio;
        } else {
            w = h * aspectRatio;
        }
    } else if (drivesWidth) {
        h = w / aspectRatio;
    } else {
        w = h * aspectRatio;
    }

    let x = startRect.x;
    let y = startRect.y;
    if (edges.includes('w')) {
        x = startRect.x + startRect.w - w;
    } else if (!drivesWidth) {
        x = startRect.x + (startRect.w - w) / 2;
    }
    if (edges.includes('n')) {
        y = startRect.y + startRect.h - h;
    } else if (!drivesHeight) {
        y = startRect.y + (startRect.h - h) / 2;
    }

    return fitRectToImage({x, y, w, h}, aspectRatio, imageWidth, imageHeight);
}

// Shrinks or grows `rect` - preserving `aspectRatio` throughout, so this
// is only ever used to finish off dragResizeRectLocked above - until it
// fits within (0, 0) to (imageWidth, imageHeight) and is at least
// MIN_RESIZE_DIMENSION along its smaller axis, then repositions it
// (without resizing, so the ratio stays exact) to stay fully on the
// image. Width-then-height order for both the shrink and the grow pass,
// so whichever axis is tightest for this particular ratio is what ends
// up governing the final size.
function fitRectToImage(rect, aspectRatio, imageWidth, imageHeight) {

    let w = rect.w;
    let h = rect.h;

    if (w > imageWidth) { w = imageWidth; h = w / aspectRatio; }
    if (h > imageHeight) { h = imageHeight; w = h * aspectRatio; }
    if (w < MIN_RESIZE_DIMENSION) { w = MIN_RESIZE_DIMENSION; h = w / aspectRatio; }
    if (h < MIN_RESIZE_DIMENSION) { h = MIN_RESIZE_DIMENSION; w = h * aspectRatio; }

    const x = Math.min(Math.max(rect.x, 0), imageWidth - w);
    const y = Math.min(Math.max(rect.y, 0), imageHeight - h);

    return {x, y, w, h};
}

// Translates `startRect` by (dx, dy) - the pointer's total movement since
// the drag began, same convention as dragResizeRect/dragResizeRectLocked -
// without resizing it at all, clamped so it can't be dragged outside the
// image. Used to move the resize rectangle by dragging anywhere inside it
// that isn't a handle or the orientation flip control (both sit on top of
// the canvas as separate elements, so a pointerdown starting on either
// never reaches the canvas's own listener this drives - no exclusion
// logic needed here beyond that).
function dragMoveRect(startRect, dx, dy, imageWidth, imageHeight) {

    const x = Math.min(Math.max(startRect.x + dx, 0), imageWidth - startRect.w);
    const y = Math.min(Math.max(startRect.y + dy, 0), imageHeight - startRect.h);

    return {x, y, w: startRect.w, h: startRect.h};
}

// --- Forced aspect-ratio presets ("Resize Options" submenu) ---
//
// Each ratio is expressed in its landscape form (>= 1) - effectiveAspectRatio
// below flips it for a portrait image/orientation. `label` is what shows in
// the submenu; `original` is a distinct case (see effectiveAspectRatio and
// applyForcedAspectRatio in rotInit) meaning "do not force a specific ratio",
// not "the image's own ratio" - selecting it just returns resizing to its
// plain Maintain Aspect Ratio behaviour (whatever shape the rectangle
// already has).
var ASPECT_RATIO_PRESETS = {
    original: {label: 'Original', ratio: null},
    square: {label: 'Square', ratio: 1},
    '5x4': {label: '5 x 4', ratio: 5 / 4},
    '8x6': {label: '8 x 6', ratio: 4 / 3},
    '7x5': {label: '7 x 5', ratio: 7 / 5},
    '6x4': {label: '6 x 4', ratio: 3 / 2},
    '16x9': {label: '16 x 9', ratio: 16 / 9}
};

// Whether a forced preset should currently apply in its landscape form
// (its own ratio, >= 1) or its portrait form (inverted) - starts out
// driven by the image's own actual shape (a square counts as landscape,
// >= not >), then flipped by orientationFlipped (the on-canvas flip
// control/submenu action) on top of that.
function targetOrientationIsLandscape(orientationFlipped, imageWidth, imageHeight) {

    const imageIsLandscape = imageWidth >= imageHeight;
    return imageIsLandscape !== orientationFlipped;
}

// The actual w/h ratio to resize to for a given preset - its landscape
// figure (ASPECT_RATIO_PRESETS' own ratio) if the image itself is
// landscape, or that figure inverted (portrait) if it's not - flipped
// again if orientationFlipped (the on-canvas flip control/submenu action)
// is set. Returns null for 'original', same as the preset itself, so a
// caller can use that to mean "nothing forced" without a separate check.
function effectiveAspectRatio(presetId, orientationFlipped, imageWidth, imageHeight) {

    const preset = ASPECT_RATIO_PRESETS[presetId];
    if (!preset || preset.ratio === null) {
        return null;
    }

    const targetIsLandscape = targetOrientationIsLandscape(orientationFlipped, imageWidth, imageHeight);

    return targetIsLandscape ? preset.ratio : 1 / preset.ratio;
}

// Preset ids in the order the "Resize Options" submenu should list them -
// 'original' always first, the rest ascending by each preset's own
// (landscape) ratio - fixed regardless of the image's shape or the
// orientation flip, so flipping between portrait and landscape never
// reshuffles the list out from under the user.
function orderedAspectRatioPresetIds() {

    const ids = Object.keys(ASPECT_RATIO_PRESETS)
        .filter(id => id !== 'original')
        .sort((a, b) => ASPECT_RATIO_PRESETS[a].ratio - ASPECT_RATIO_PRESETS[b].ratio);

    return ['original', ...ids];
}

// The largest rectangle at aspectRatio that fits between (anchorX,
// anchorY) and the image's own bottom-right corner - "as large as
// possible" for a forced-ratio preset, anchored whereever the resize
// rectangle's top-left corner already was (or (0, 0), the image's own,
// if it hadn't been resized yet - activeResizeRect already resolves that).
function maxRectAtAnchor(anchorX, anchorY, aspectRatio, imageWidth, imageHeight) {

    const availableWidth = imageWidth - anchorX;
    const availableHeight = imageHeight - anchorY;

    let w = availableWidth;
    let h = w / aspectRatio;
    if (h > availableHeight) {
        h = availableHeight;
        w = h * aspectRatio;
    }

    return {x: anchorX, y: anchorY, w, h};
}

// Whether the on-canvas orientation flip control's little rectangle icon
// (see createOrientationFlipControl) should be drawn tall (offering
// portrait) or wide (offering landscape), and its tooltip - always the
// shape it would switch *to*, not the one it's currently at, so eg a
// currently-landscape overlay shows the portrait icon it's offering to
// switch to, matching the equivalent "Switch to Portrait"/"Switch to
// Landscape" submenu action's own label. A CSS-sized rectangle rather
// than a Unicode glyph (eg U+25AC/U+25AE), which at this small a size
// render more like a dash than a recognisable rectangle in most fonts.
function orientationFlipDisplay(ratio) {

    return ratio >= 1
        ? {targetIsPortrait: true, title: 'Switch to portrait'}
        : {targetIsPortrait: false, title: 'Switch to landscape'};
}

// The (up to) four non-overlapping rectangles covering everything OUTSIDE
// `rect` within a `w`x`h` canvas - the "cropped" part of the image a
// resized overlay no longer applies to, dimmed (see resizeMaskOpacity on
// the Options page) so it's obvious at a glance which part of the image
// the composition guide currently covers, rather than looking untouched.
//
// Deliberately four non-overlapping strips (not four overlapping full-
// width/height rectangles) so a translucent fill doesn't stack extra
// opacity into the corners. Degenerates to four zero-area rectangles (so
// nothing is drawn) when `rect` already covers the whole canvas - callers
// don't need to special-case "not actually resized" themselves.
function resizeMaskRects(rect, w, h) {

    return [
        {x: 0, y: 0, w: w, h: rect.y}, // above
        {x: 0, y: rect.y + rect.h, w: w, h: h - (rect.y + rect.h)}, // below
        {x: 0, y: rect.y, w: rect.x, h: rect.h}, // left
        {x: rect.x + rect.w, y: rect.y, w: w - (rect.x + rect.w), h: rect.h} // right
    ];
}

// The four 1px-wide strips forming a border exactly one pixel *outside*
// `rect` - drawn in the main Line Colour (at the Cropped Area Opacity, not
// the line's own opacity) so there's a visible edge marking exactly where
// a resized overlay stops, without that line ever overlapping the overlay
// style's own drawing inside `rect` itself.
//
// Same non-overlapping-strip approach as resizeMaskRects (top/bottom span
// the full outer width including corners; left/right only the height
// between them) so the translucent fill doesn't stack extra opacity into
// the corners. Naturally invisible (clipped by the canvas's own bounds)
// once `rect` already covers the whole image, the same way
// resizeMaskRects naturally degenerates to zero-area rectangles then -
// callers don't need to special-case "not actually resized" here either.
function resizeBorderRects(rect) {

    const outerX = rect.x - 1;
    const outerY = rect.y - 1;
    const outerW = rect.w + 2;
    const outerH = rect.h + 2;

    return [
        {x: outerX, y: outerY, w: outerW, h: 1}, // top
        {x: outerX, y: outerY + outerH - 1, w: outerW, h: 1}, // bottom
        {x: outerX, y: outerY + 1, w: 1, h: outerH - 2}, // left
        {x: outerX + outerW - 1, y: outerY + 1, w: 1, h: outerH - 2} // right
    ];
}

// Diameter of a handle's own visible circle, in CSS pixels - centred on
// its resizeHandlePosition() by createResizeHandles() below.
var RESIZE_HANDLE_SIZE = 12;
// Matches the Options page's own --color-primary, for visual continuity
// between the overlay and its own extension UI - this file runs on
// arbitrary third-party pages, so it can't reach that CSS variable, only
// its value.
var RESIZE_HANDLE_COLOUR = '#26a69a';

// Short and long side, in CSS pixels, of the on-canvas orientation-flip
// control (see createOrientationFlipControl) - a plain 6x4/4x6 photo
// shape (their ratio, 60/40 = 3/2, matches the '6x4' preset's own),
// oriented tall or wide by redraw() (orientationFlipDisplay), and sized
// well past the resize handles above so it reads as its own distinct
// control rather than a 9th handle.
var ORIENTATION_FLIP_SHORT_SIDE = 40;
var ORIENTATION_FLIP_LONG_SIDE = 60;

// --- Overlay context menu ---
//
// A small, generic, keyboard-accessible replacement for the page's own
// right-click menu when it's opened on the overlay - deliberately built
// around a declarative list of items (see showOverlayContextMenu's `items`
// parameter) rather than bespoke DOM for each menu entry, since the menu
// keeps growing (per-image overrides, now the "Resize Options" submenu).
// Follows the WAI-ARIA menu pattern (role="menu" containing role=
// "menuitem"/"menuitemcheckbox"/"menuitemradio", arrow keys to move
// between them, Enter/Space to activate, Escape or a click outside to
// close and return focus to whatever opened it) plus its submenu
// extension (role="menuitem" with aria-haspopup/aria-expanded, ArrowRight/
// click/hover to open, ArrowLeft/Escape to close just that level).
//
// Only one menu (root + at most one open submenu) is ever showing at a
// time - opening a new root menu closes whichever was already showing,
// same as a native context menu.
//
// KNOWN GAP: "keyboard-accessible" above is about the menu's own internals
// once it's open, not how to open it - the overlay's container has
// tabIndex=-1 (a valid focus() target so returning focus here on close
// works) but is deliberately not in the page's own Tab order, so there's
// currently no keyboard path to trigger the browser's own Shift+F10/Menu-
// key "contextmenu" event on it at all. The resize handles (see
// createResizeHandles below), the orientation flip control (see
// createOrientationFlipControl), and dragging the rectangle itself to
// move it (see the canvas's own pointerdown listener in renderImageOverlay)
// are pointer-only too - role="presentation"/aria-hidden="true" for the
// first two, no keyboard equivalent for nudging a handle, moving the
// rectangle, or flipping orientation (the latter does at least have a
// menu fallback - "Switch to Portrait"/"Switch to Landscape" on the
// Resize Options submenu - the other two have no keyboard equivalent at
// all). Flagged
// rather than fixed here since a real fix (Tab reaching the overlay,
// Tab/arrow keys between handles, arrow keys to nudge, Shift+arrow for
// bigger steps) is a proper feature in its own right, not a quick patch.
var openOverlayMenu = null;
var openOverlaySubmenu = null;

// `returnFocus` - whether to move focus back to the item that opened this
// submenu. false when the whole menu (root included) is about to close
// anyway, since there would be nothing left to return focus to.
function closeOverlaySubmenu(returnFocus) {

    if (!openOverlaySubmenu) {
        return;
    }

    const {element, parentItem} = openOverlaySubmenu;
    element.remove();
    if (parentItem) {
        parentItem.setAttribute('aria-expanded', 'false');
    }
    openOverlaySubmenu = null;

    if (returnFocus && parentItem && typeof parentItem.focus === 'function') {
        parentItem.focus();
    }
}

function closeOverlayContextMenu() {

    if (!openOverlayMenu) {
        return;
    }

    closeOverlaySubmenu(false);

    const {element, returnFocusTo} = openOverlayMenu;
    element.remove();
    document.removeEventListener('pointerdown', onOverlayMenuPointerDown, true);
    document.removeEventListener('scroll', closeOverlayContextMenu, true);
    openOverlayMenu = null;

    // The trigger (the overlay's own container) rather than the page's
    // default focus target, so keyboard users land back exactly where
    // they opened the menu from.
    if (returnFocusTo && typeof returnFocusTo.focus === 'function') {
        returnFocusTo.focus();
    }
}

function onOverlayMenuPointerDown(event) {

    if (!openOverlayMenu) {
        return;
    }

    const inRoot = openOverlayMenu.element.contains(event.target);
    const inSubmenu = openOverlaySubmenu && openOverlaySubmenu.element.contains(event.target);
    if (!inRoot && !inSubmenu) {
        closeOverlayContextMenu();
    }
}

// Positions an already-appended (so its own size can be measured) menu
// element at (x, y), nudged back on-screen if it would otherwise spill
// past the right/bottom edge of the viewport.
function positionMenuElement(element, x, y) {

    element.style.left = x + 'px';
    element.style.top = y + 'px';

    const bounds = element.getBoundingClientRect();
    if (bounds.right > window.innerWidth) {
        element.style.left = Math.max(0, window.innerWidth - bounds.width) + 'px';
    }
    if (bounds.bottom > window.innerHeight) {
        element.style.top = Math.max(0, window.innerHeight - bounds.height) + 'px';
    }
}

// Builds a styled role="menu" element from `items` - shared between the
// root menu and any submenu, so both look and behave identically. Doesn't
// position or append it itself - the caller does that once the element's
// own size can be measured. `onEscape`/`onArrowLeft` let the root menu and
// a submenu react to those keys differently (close everything vs close
// just this one level and return to its parent item).
//
// `items` is an array of:
//   {type: 'checkbox', label, checked, onToggle(newChecked)}
//   {type: 'radio', label, checked, onToggle(newChecked)}
//   {type: 'action', label, onActivate()}
//   {type: 'submenu', label, items: [...]}
//   {type: 'separator'}
function buildMenuElement(items, onEscape, onArrowLeft, closesSubmenuOnHover) {

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('data-extension', 'rule-of-thirds');
    menu.style.position = 'fixed';
    // Higher than anything a host page would plausibly use, so the menu
    // never ends up hidden behind the page's own fixed-position content.
    menu.style.zIndex = '2147483647';
    menu.style.background = '#fff';
    menu.style.color = '#212121';
    menu.style.border = '1px solid #d0d0d0';
    menu.style.borderRadius = '4px';
    menu.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.25)';
    menu.style.padding = '4px 0';
    menu.style.minWidth = '180px';
    menu.style.font = '14px "Helvetica Neue", Helvetica, Arial, sans-serif';

    const focusableItems = [];
    // Every radio-type item's own {item, menuItem, dot} - not just the
    // DOM, the underlying `item` object too, so selecting one can reset
    // every *other* radio in the same group back to unchecked (both its
    // DOM and its own `checked` flag) - without this, re-clicking a radio
    // that was checked earlier but has since been superseded by a
    // different one wouldn't realise it needs to do anything.
    const radioEntries = [];

    items.forEach(item => {

        if (item.type === 'separator') {
            const separator = document.createElement('div');
            separator.setAttribute('role', 'separator');
            separator.style.margin = '4px 0';
            separator.style.borderTop = '1px solid #d0d0d0';
            menu.append(separator);
            return;
        }

        const menuItem = document.createElement('div');
        menuItem.tabIndex = -1;
        menuItem.style.display = 'flex';
        menuItem.style.alignItems = 'center';
        menuItem.style.gap = '0.5rem';
        menuItem.style.padding = '6px 14px';
        menuItem.style.cursor = 'pointer';
        menuItem.style.outline = 'none';
        menuItem.style.userSelect = 'none';

        // A real bordered box/circle (checked: a tick or dot inside it)
        // rather than a character-plus-blank-space hack, so it reads as
        // an actual checkbox/radio rather than unexplained indentation -
        // only added for a checkbox/radio item below, so a plain action
        // or submenu item (eg "Reset") stays flush left rather than
        // indented to match. `currentColor` (not a fixed colour) so this
        // stays visible against both this item's normal background and
        // the teal background the focus/blur handlers below switch its
        // text colour against.
        const indicator = document.createElement('span');
        indicator.setAttribute('aria-hidden', 'true');
        indicator.style.display = 'inline-flex';
        indicator.style.alignItems = 'center';
        indicator.style.justifyContent = 'center';
        indicator.style.width = '14px';
        indicator.style.height = '14px';
        indicator.style.flexShrink = '0';
        indicator.style.boxSizing = 'border-box';
        indicator.style.fontSize = '11px';
        indicator.style.lineHeight = '1';

        const label = document.createElement('span');
        label.textContent = item.label;
        label.style.flex = '1 1 auto';

        if (item.type === 'checkbox') {
            menuItem.setAttribute('role', 'menuitemcheckbox');
            menuItem.setAttribute('aria-checked', item.checked ? 'true' : 'false');
            indicator.style.border = '1.5px solid currentColor';
            indicator.style.borderRadius = '3px';
            indicator.textContent = item.checked ? '✓' : '';
            menuItem.append(indicator);
        } else if (item.type === 'radio') {
            menuItem.setAttribute('role', 'menuitemradio');
            menuItem.setAttribute('aria-checked', item.checked ? 'true' : 'false');
            indicator.style.border = '1.5px solid currentColor';
            indicator.style.borderRadius = '50%';
            // Always created (not conditionally, only when checked) so
            // selecting a different radio in the same group can toggle
            // this dot's visibility in place - see activate() below,
            // which keeps the menu open rather than closing and rebuilding
            // it from scratch every time.
            const dot = document.createElement('span');
            dot.setAttribute('data-radio-dot', '');
            dot.style.width = '6px';
            dot.style.height = '6px';
            dot.style.borderRadius = '50%';
            dot.style.background = 'currentColor';
            dot.style.visibility = item.checked ? 'visible' : 'hidden';
            indicator.append(dot);
            menuItem.append(indicator);
            radioEntries.push({item, menuItem, dot});
        } else if (item.type === 'submenu') {
            menuItem.setAttribute('role', 'menuitem');
            menuItem.setAttribute('aria-haspopup', 'true');
            menuItem.setAttribute('aria-expanded', 'false');
        } else {
            menuItem.setAttribute('role', 'menuitem');
        }

        menuItem.append(label);

        if (item.type === 'submenu') {
            const arrow = document.createElement('span');
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '▶';
            arrow.style.fontSize = '10px';
            arrow.style.flexShrink = '0';
            menuItem.append(arrow);
        }

        // Checkbox/radio items update themselves in place and leave the
        // menu open - unlike an action (eg "Reset"), a setting is
        // something you typically want to keep adjusting (tick Maintain
        // Aspect Ratio, then pick a ratio, maybe flip orientation, all in
        // one sitting) rather than having the menu vanish and need
        // reopening after each individual change.
        function activate() {

            if (item.type === 'submenu') {
                openOverlaySubmenuFor(menuItem, item.items);
                return;
            }

            if (item.type === 'checkbox') {
                item.checked = !item.checked;
                menuItem.setAttribute('aria-checked', item.checked ? 'true' : 'false');
                indicator.textContent = item.checked ? '✓' : '';
                item.onToggle(item.checked);
                return;
            }

            if (item.type === 'radio') {
                if (!item.checked) {
                    // Resets every *other* radio in this same group - both
                    // its DOM and its own `checked` flag (see radioEntries
                    // above) - before checking this one.
                    radioEntries.forEach(entry => {
                        const checked = entry.item === item;
                        entry.item.checked = checked;
                        entry.menuItem.setAttribute('aria-checked', checked ? 'true' : 'false');
                        entry.dot.style.visibility = checked ? 'visible' : 'hidden';
                    });
                    item.onToggle(true);
                }
                return;
            }

            item.onActivate();
            closeOverlayContextMenu();
        }

        // outline:none above removes the browser's default focus ring (it
        // sits awkwardly against this menu's own box-shadow styling) - this
        // is what replaces it, a themed highlight instead of no visible
        // indicator at all.
        menuItem.addEventListener('focus', () => { menuItem.style.background = RESIZE_HANDLE_COLOUR; menuItem.style.color = '#fff'; });
        menuItem.addEventListener('blur', () => { menuItem.style.background = ''; menuItem.style.color = ''; });
        menuItem.addEventListener('mouseenter', () => {
            menuItem.focus();
            if (item.type === 'submenu') {
                openOverlaySubmenuFor(menuItem, item.items);
            } else if (closesSubmenuOnHover && openOverlaySubmenu) {
                // Only at the root level - hovering one of the submenu's
                // *own* items (this same branch, when buildMenuElement is
                // building that submenu) must never close the very menu
                // it's a part of.
                closeOverlaySubmenu(false);
            }
        });
        menuItem.addEventListener('click', activate);
        menuItem.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate();
            } else if (event.key === 'ArrowRight' && item.type === 'submenu') {
                event.preventDefault();
                openOverlaySubmenuFor(menuItem, item.items);
            }
        });

        menu.append(menuItem);
        focusableItems.push(menuItem);
    });

    menu.addEventListener('keydown', event => {

        const currentIndex = focusableItems.indexOf(document.activeElement);

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusableItems[(currentIndex + 1) % focusableItems.length].focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusableItems[(currentIndex - 1 + focusableItems.length) % focusableItems.length].focus();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            onEscape();
        } else if (event.key === 'ArrowLeft' && onArrowLeft) {
            event.preventDefault();
            onArrowLeft();
        }
    });

    return {element: menu, focusableItems};
}

// Opens (or, hovering across several submenu items in a row, replaces)
// the one submenu a menu can have open at a time, positioned immediately
// to the right of whichever item it belongs to (positionMenuElement pulls
// it back on-screen if that would spill off the right/bottom edge).
function openOverlaySubmenuFor(parentItem, items) {

    if (openOverlaySubmenu && openOverlaySubmenu.parentItem === parentItem) {
        return;
    }
    closeOverlaySubmenu(false);

    const {element: submenu, focusableItems} = buildMenuElement(
        items,
        () => closeOverlaySubmenu(true),
        () => closeOverlaySubmenu(true)
    );

    document.body.append(submenu);
    const parentBounds = parentItem.getBoundingClientRect();
    positionMenuElement(submenu, parentBounds.right, parentBounds.top);

    parentItem.setAttribute('aria-expanded', 'true');
    openOverlaySubmenu = {element: submenu, parentItem};

    if (focusableItems.length) {
        focusableItems[0].focus();
    }
}

// `returnFocusTo` gets focus back once the whole menu closes (Escape, a
// click outside, or an item being activated all close it) - see
// buildMenuElement's own doc comment for the shape of `items`.
function showOverlayContextMenu(x, y, items, returnFocusTo) {

    closeOverlayContextMenu();

    const {element: menu, focusableItems} = buildMenuElement(items, closeOverlayContextMenu, null, true);

    document.body.append(menu);
    positionMenuElement(menu, x, y);

    openOverlayMenu = {element: menu, returnFocusTo};

    if (focusableItems.length) {
        focusableItems[0].focus();
    }

    // Deferred so the same right-click that opened the menu (which is a
    // pointerdown too) doesn't immediately bubble up and close it again.
    setTimeout(() => document.addEventListener('pointerdown', onOverlayMenuPointerDown, true), 0);
    document.addEventListener('scroll', closeOverlayContextMenu, true);
}

// This check is always true: `rotInit` is declared with `const` *inside*
// this block, so it's block-scoped and never persists between separate
// injections of this file into the same tab (each toolbar click re-runs
// chrome.scripting.executeScript). What actually stops setup - and the
// chrome.storage.onChanged listener below - from running twice is the
// `document.getElementById('rule-of-thirds')` check inside rotInit itself.
if (typeof rotInit === 'undefined') {

    const rotInit = function () {

        let options;

        const promise = readOptions();

        let controlElement = document.getElementById('rule-of-thirds');
        if (!controlElement) {
            // Add control element
            controlElement = document.createElement('div');
            controlElement.id = 'rule-of-thirds';
            controlElement.setAttribute('active', 'false');
            // Per-image resize state (the "Enable Resize" context-menu
            // item) - attached directly to this persistent element rather
            // than a variable inside this closure, since a *fresh*
            // rotInit() closure runs on every toolbar click (see the
            // file-header comment on the `if` this sits inside) but
            // #rule-of-thirds itself survives across them. A plain
            // variable here would silently reset on every click instead
            // of only when the whole overlay is deliberately toggled off
            // (see toggleOverlays). Deliberately never written to
            // chrome.storage - this is transient by design, lost on
            // toggle-off/on or a full page reload, whichever comes first.
            controlElement.imageOverrides = new Map();
            document.body.appendChild(controlElement);

            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'sync'/* && changes.options?.newValue*/) {
                    if (controlElement.getAttribute('active') === 'true') {
                        readOptions().then(() => {
                            removeOverlays();
                            applyOverlays();
                        })
                    }
                }
            });

            // Every overlay's own position (see createOverlayContainer) is
            // only ever computed once, when it's applied - a page resize
            // (eg the window itself, or a responsive layout reflowing at a
            // new breakpoint) can move or resize the underlying image
            // without anything here finding out, leaving the overlay
            // behind. Simplest fix is the same one already used for an
            // options change above - remove and reapply every overlay from
            // scratch - debounced since resizing (eg dragging the window's
            // edge) fires this repeatedly, and only the last firing's redo
            // is still relevant once it settles.
            let resizeReapplyTimer = null;
            window.addEventListener('resize', () => {
                if (controlElement.getAttribute('active') === 'true') {
                    clearTimeout(resizeReapplyTimer);
                    resizeReapplyTimer = setTimeout(() => {
                        removeOverlays();
                        applyOverlays();
                    }, 200);
                }
            });

            // Clicking anywhere can change which image is actually showing
            // without a window resize or options change - eg Flickr's
            // built-in click-to-zoom, which swaps in a differently sized/
            // positioned <img> with nothing else to notice. Not scoped to
            // clicks that land on an <img> or this extension's own markup
            // (tried that first, and it missed Flickr's actual click
            // target: an invisible hit-testing layer of its own -
            // <span class="facade-of-protection-zoom"> - sitting on top of
            // both the image and our overlay, which is neither) - sites can
            // and do interpose their own click-catching layers over an
            // image, so there's no reliable element-type check to scope by.
            // Same recovery, and the same unconditional-while-active
            // trade-off, as the resize listener above.
            let clickReapplyTimer = null;
            window.addEventListener('click', () => {
                if (controlElement.getAttribute('active') === 'true') {
                    clearTimeout(clickReapplyTimer);
                    clickReapplyTimer = setTimeout(() => {
                        removeOverlays();
                        applyOverlays();
                    }, 200);
                }
            }, true);
        }

        promise.then(() => {
            toggleOverlays();
            reportState();
        });

        async function readOptions() {

            return new Promise((resolve) => {
                chrome.storage.sync.get(
                    {
                        overlayStyle: 'grid',
                        renderGrid: true,
                        gridRows: 3,
                        gridColumns: 3,
                        gridRowLines: [true, true],
                        gridColumnLines: [true, true],
                        lineColour: '#ffffff',
                        lineOpacity: 100,
                        renderCircle: true,
                        circleColour: '#ff0000',
                        circleOpacity: 100,
                        resizeMaskOpacity: 50,
                        circleRadius: 5,
                        circleStyle: 'outline',
                        circleLines: [[true, true], [true, true]],
                        minImageWidth: 100,
                        minImageHeight: 50,
                        eitherOrientation: true,
                        renderPhiGrid: true,
                        phiRatio: DEFAULT_PHI_RATIO,
                        phiRowLines: [true, true],
                        phiColumnLines: [true, true],
                        phiCircleLines: [[true, true], [true, true]],
                        goldenRatioDirection: 'clockwise',
                        goldenRatioStart: 'bottom-left'
                    },
                    (data) => {
                        options = sanitizeOptions(data);
                        resolve();
                    }
                );
            });
        }

        function toggleOverlays() {

            if (controlElement.getAttribute('active') === 'false') {
                applyOverlays();
            } else {
                // Resize is explicitly transient (see imageOverrides
                // above) - turning the overlay off is the one point
                // that's guaranteed to happen between any two "sessions"
                // of using it, so it's the natural place to drop every
                // per-image adjustment and start clean next time.
                controlElement.imageOverrides.clear();
                closeOverlayContextMenu();
                removeOverlays();
            }
        }

        // Lets the service worker reflect this tab's on/off state on the
        // toolbar icon - it has no other way to know, since applying and
        // removing the overlay only ever changes DOM state inside this page.
        function reportState() {

            chrome.runtime.sendMessage({
                type: 'rule-of-thirds-state',
                active: controlElement.getAttribute('active') === 'true'
            });
        }

        function applyOverlays() {

            const images = document.getElementsByTagName('img');
            for (let ii = 0; ii < images.length; ii++) {
                const image = images[ii];
                // getClientRects() is empty whenever the image generates no
                // box at all (display:none on itself or an ancestor, or not
                // actually in the rendered tree) - unlike offsetParent,
                // which is also null for a position:fixed image even though
                // it's fully visible, wrongly skipping it.
                if (image.getClientRects().length === 0) {
                    continue;
                }

                const computedStyle = getComputedStyle(image, null);
                const w = image.width;
                const h = image.height;

                if (shouldRender(computedStyle, w, h, options.minImageWidth, options.minImageHeight, options.eitherOrientation)) {
                    renderImageOverlay(image, computedStyle, w, h);
                }
            }

            controlElement.setAttribute('active', 'true');
        }

        function renderImageOverlay(image, computedStyle, w, h) {

            // The displayed size can pass shouldRender()'s check while the
            // image's actual source is much smaller (eg a small icon
            // stretched via CSS/HTML width/height) - naturalWidth/Height
            // reflect the real, already-loaded source, so no extra fetch is
            // needed to catch that case.
            if (!isMinSize(image.naturalWidth, image.naturalHeight, options.minImageWidth, options.minImageHeight, options.eitherOrientation)) {
                return;
            }

            const container = createOverlayContainer(w, h, image, computedStyle);
            const canvas = createCanvas(w, h);
            container.append(canvas);
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;

            let handleElements = null;
            let flipControl = null;

            function currentOverride() {
                return controlElement.imageOverrides.get(image) || {
                    resizeEnabled: false, rect: null, maintainAspectRatio: false,
                    aspectRatioPreset: 'original', aspectOrientationFlipped: false
                };
            }

            function setRect(rect) {
                const override = currentOverride();
                override.rect = rect;
                controlElement.imageOverrides.set(image, override);
            }

            // Redraws the overlay into whichever rectangle currentOverride()
            // currently resolves to, and (if resize is enabled) moves the
            // handles to match - called once up front and again on every
            // pointermove while dragging a handle, so this repaints the
            // existing canvas/handle elements in place rather than tearing
            // anything down and rebuilding it.
            function redraw() {

                const rect = activeResizeRect(currentOverride(), w, h);

                // The backing store is sized up by devicePixelRatio in
                // createCanvas() for a crisp result on HiDPI/zoomed
                // displays - resetting the transform first (rather than
                // ctx.scale() accumulating on top of a previous redraw's
                // translate()) keeps every redraw starting from the same
                // clean slate.
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, w, h);

                // Dims whatever's outside `rect` (nothing is drawn if it's
                // still the whole image - see resizeMaskRects) so it's
                // obvious at a glance which part of the image a resized
                // overlay currently applies to, drawn before the overlay
                // itself so it never covers the grid/spiral lines.
                ctx.fillStyle = hexToRgba('#000000', options.resizeMaskOpacity);
                resizeMaskRects(rect, w, h).forEach(maskRect => ctx.fillRect(maskRect.x, maskRect.y, maskRect.w, maskRect.h));

                // Marks exactly where the resize rectangle ends, in the
                // main Line Colour but at the Cropped Area Opacity (not
                // the line's own opacity) - see resizeBorderRects.
                ctx.fillStyle = hexToRgba(options.lineColour, options.resizeMaskOpacity);
                resizeBorderRects(rect).forEach(borderRect => ctx.fillRect(borderRect.x, borderRect.y, borderRect.w, borderRect.h));

                ctx.translate(rect.x, rect.y);

                OVERLAY_STYLE_DRAWERS[options.overlayStyle](ctx, rect.w, rect.h, options);

                if (handleElements) {
                    // A single-edge handle (n/e/s/w) has no edge of its
                    // own to anchor the other, ratio-derived axis to, so
                    // dragResizeRectLocked grows/shrinks it evenly around
                    // the rectangle's centre instead - unlike every
                    // corner handle, which drives both axes from the
                    // drag itself. With Maintain Aspect Ratio on, that
                    // makes the edge handles feel inert rather than
                    // genuinely useful, so they're hidden entirely -
                    // only the 4 corners remain.
                    const hideEdgeHandles = currentOverride().maintainAspectRatio;
                    Object.keys(RESIZE_HANDLES).forEach(handleId => {
                        const position = resizeHandlePosition(rect, handleId);
                        const element = handleElements[handleId];
                        element.style.left = position.x + 'px';
                        element.style.top = position.y + 'px';
                        element.hidden = hideEdgeHandles && RESIZE_HANDLES[handleId].edges.length === 1;
                    });
                }

                if (flipControl) {
                    // The control itself is drawn as a 6x4/4x6 photo
                    // shape - the ratio actually being maintained right
                    // now, whether that's a forced preset's own ratio
                    // (rect already conforms to it exactly, see
                    // applyForcedAspectRatio) or, for "Original", just
                    // whatever shape the rectangle currently happens to
                    // be - there's no other ratio to show for that case.
                    const display = orientationFlipDisplay(rect.w / rect.h);
                    flipControl.title = display.title;
                    const flipWidth = display.targetIsPortrait ? ORIENTATION_FLIP_SHORT_SIDE : ORIENTATION_FLIP_LONG_SIDE;
                    const flipHeight = display.targetIsPortrait ? ORIENTATION_FLIP_LONG_SIDE : ORIENTATION_FLIP_SHORT_SIDE;
                    flipControl.style.width = flipWidth + 'px';
                    flipControl.style.height = flipHeight + 'px';
                    flipControl.style.left = (rect.x + rect.w / 2 - flipWidth / 2) + 'px';
                    flipControl.style.top = (rect.y + rect.h / 2 - flipHeight / 2) + 'px';
                }
            }

            // Shows/hides the on-canvas orientation flip control (see
            // createOrientationFlipControl) - shown for every preset
            // except "Square" (flipping a square's orientation would be
            // meaningless, since it's the same shape either way),
            // including "Original" - maintaining the rectangle's own
            // current shape is still a shape to flip, even with no
            // preset forcing it.
            function syncFlipControl() {

                const override = currentOverride();
                const shouldShow = override.resizeEnabled && override.maintainAspectRatio && override.aspectRatioPreset !== 'square';

                if (shouldShow && !flipControl) {
                    flipControl = createOrientationFlipControl(container, toggleOrientationFlipped);
                } else if (!shouldShow && flipControl) {
                    flipControl.remove();
                    flipControl = null;
                }
            }

            // "Resize Options" > a preset other than "Original", combined
            // with Maintain Aspect Ratio, forces the rectangle to exactly
            // that ratio rather than just following whatever shape a drag
            // leaves it in - this is what does the forcing: snaps to the
            // largest rectangle at that ratio, anchored at the rectangle's
            // own current top-left corner (or the image's, (0, 0), if it
            // hasn't been resized yet - activeResizeRect already resolves
            // that). Called whenever any of the three things that could
            // newly make this apply do - Enable Resize, Maintain Aspect
            // Ratio, or the preset/orientation themselves changing - and
            // harmlessly does nothing otherwise.
            function applyForcedAspectRatio() {

                const override = currentOverride();
                if (!override.resizeEnabled || !override.maintainAspectRatio) {
                    return;
                }

                const ratio = effectiveAspectRatio(override.aspectRatioPreset, override.aspectOrientationFlipped, w, h);
                if (ratio === null) {
                    return;
                }

                const anchor = activeResizeRect(override, w, h);
                setRect(maxRectAtAnchor(anchor.x, anchor.y, ratio, w, h));
                redraw();
            }

            // Drags the rectangle itself (not resizing it - see
            // dragMoveRect) when the pointer goes down anywhere inside it
            // that isn't a handle or the orientation flip control - both
            // are separate elements layered on top of this canvas, so a
            // pointerdown starting on either is delivered to that element
            // instead and never reaches this listener at all; no
            // exclusion check needed here for them. A pointerdown outside
            // the rectangle (the dimmed, cropped-out area) is ignored too
            // - there's nothing there to drag.
            canvas.addEventListener('pointerdown', event => {

                const override = currentOverride();
                if (!override.resizeEnabled) {
                    return;
                }

                const startRect = activeResizeRect(override, w, h);
                if (event.offsetX < startRect.x || event.offsetX > startRect.x + startRect.w ||
                    event.offsetY < startRect.y || event.offsetY > startRect.y + startRect.h) {
                    return;
                }

                event.preventDefault();

                const startX = event.clientX;
                const startY = event.clientY;
                canvas.setPointerCapture(event.pointerId);

                function onPointerMove(moveEvent) {
                    setRect(dragMoveRect(startRect, moveEvent.clientX - startX, moveEvent.clientY - startY, w, h));
                    redraw();
                }

                function onPointerUp() {
                    canvas.removeEventListener('pointermove', onPointerMove);
                    canvas.removeEventListener('pointerup', onPointerUp);
                }

                canvas.addEventListener('pointermove', onPointerMove);
                canvas.addEventListener('pointerup', onPointerUp, {once: true});
            });

            function setResizeEnabled(enabled) {

                const override = currentOverride();
                override.resizeEnabled = enabled;
                controlElement.imageOverrides.set(image, override);

                if (enabled && !handleElements) {
                    handleElements = createResizeHandles(container, w, h, currentOverride, setRect, redraw);
                } else if (!enabled && handleElements) {
                    Object.values(handleElements).forEach(element => element.remove());
                    handleElements = null;
                }
                // A hint that the rectangle itself (not just its handles)
                // is now draggable - the canvas's own pointerdown listener
                // above already only acts within it regardless.
                canvas.style.cursor = enabled ? 'move' : '';
                syncFlipControl();
                applyForcedAspectRatio();
                redraw();
            }

            function setMaintainAspectRatio(enabled) {

                const override = currentOverride();
                override.maintainAspectRatio = enabled;
                controlElement.imageOverrides.set(image, override);
                syncFlipControl();
                applyForcedAspectRatio();
                // Needed even when applyForcedAspectRatio doesn't itself
                // redraw (eg still on the 'original' preset) - toggling
                // this hides/shows the edge handles (see redraw's own
                // hideEdgeHandles), which needs a redraw of its own to
                // take effect immediately rather than on the next one.
                redraw();
            }

            // "If user changes aspect after resizing then take same
            // approach" - see applyForcedAspectRatio.
            function setAspectRatioPreset(presetId) {

                const override = currentOverride();
                override.aspectRatioPreset = presetId;
                // Unlike every other preset (which forces a shape via
                // applyForcedAspectRatio below), "Original" means "force
                // nothing", so switching back to it needs its own
                // explicit effect: releasing whatever shape a previously
                // forced preset left behind, back to the image's own
                // actual (original) shape - otherwise, since
                // applyForcedAspectRatio does nothing for a null ratio,
                // switching back to "Original" would leave the overlay
                // looking untouched by the switch.
                if (presetId === 'original') {
                    override.rect = null;
                }
                controlElement.imageOverrides.set(image, override);
                syncFlipControl();
                applyForcedAspectRatio();
                redraw();
            }

            // The on-canvas flip control and the submenu's fallback action
            // (see registerOverlayContextMenu) both call this - it's what
            // lets a forced preset apply as portrait instead of landscape,
            // or vice versa, overriding what the image's own shape would
            // otherwise pick (see effectiveAspectRatio).
            function toggleOrientationFlipped() {

                const override = currentOverride();
                override.aspectOrientationFlipped = !override.aspectOrientationFlipped;
                controlElement.imageOverrides.set(image, override);

                if (override.aspectRatioPreset === 'original') {
                    // applyForcedAspectRatio has no forced ratio to
                    // reapply here - the rectangle's own current shape
                    // is the only ratio there is, so flipping transposes
                    // that shape directly instead, anchored the same way.
                    const anchor = activeResizeRect(override, w, h);
                    setRect(maxRectAtAnchor(anchor.x, anchor.y, anchor.h / anchor.w, w, h));
                    redraw();
                } else {
                    applyForcedAspectRatio();
                }
            }

            // Snaps the grid back to covering the whole image, and turns
            // "Enable Resize"/"Maintain Aspect Ratio" (and its own Resize
            // Options) back off too if any were set - having Reset leave
            // resize mode active would just leave 8 handles sitting at the
            // full image's own edges, ready to immediately drag it out of
            // shape again, when the point of Reset is a clean slate.
            function resetOverride() {

                const override = currentOverride();
                override.rect = null;
                override.maintainAspectRatio = false;
                override.aspectRatioPreset = 'original';
                override.aspectOrientationFlipped = false;
                if (override.resizeEnabled) {
                    override.resizeEnabled = false;
                    if (handleElements) {
                        Object.values(handleElements).forEach(element => element.remove());
                        handleElements = null;
                    }
                }
                controlElement.imageOverrides.set(image, override);
                syncFlipControl();
                redraw();
            }

            registerOverlayContextMenu(container, w, h, currentOverride, setResizeEnabled, setMaintainAspectRatio, setAspectRatioPreset, toggleOrientationFlipped, resetOverride);

            if (currentOverride().resizeEnabled) {
                handleElements = createResizeHandles(container, w, h, currentOverride, setRect, redraw);
                canvas.style.cursor = 'move';
            }
            syncFlipControl();
            redraw();

            (image.offsetParent || document.body).append(container);
        }

        // One draggable handle per entry in RESIZE_HANDLES - small circles
        // layered on top of the canvas as real DOM elements (not drawn on
        // the canvas itself) so each can capture its own pointer events
        // independently, rather than hand-rolling hit-testing against
        // canvas coordinates.
        function createResizeHandles(container, w, h, currentOverride, setRect, redraw) {

            const elements = {};

            Object.keys(RESIZE_HANDLES).forEach(handleId => {

                const handle = document.createElement('div');
                handle.setAttribute('role', 'presentation');
                handle.setAttribute('aria-hidden', 'true');
                handle.style.position = 'absolute';
                handle.style.width = RESIZE_HANDLE_SIZE + 'px';
                handle.style.height = RESIZE_HANDLE_SIZE + 'px';
                handle.style.marginLeft = (-RESIZE_HANDLE_SIZE / 2) + 'px';
                handle.style.marginTop = (-RESIZE_HANDLE_SIZE / 2) + 'px';
                handle.style.boxSizing = 'border-box';
                handle.style.borderRadius = '50%';
                handle.style.background = RESIZE_HANDLE_COLOUR;
                handle.style.border = '1px solid #fff';
                handle.style.boxShadow = '0 0 2px rgba(0, 0, 0, 0.6)';
                handle.style.cursor = RESIZE_HANDLES[handleId].cursor;
                handle.style.touchAction = 'none';

                handle.addEventListener('pointerdown', (event) => {

                    event.preventDefault();
                    event.stopPropagation();

                    const startRect = activeResizeRect(currentOverride(), w, h);
                    const startX = event.clientX;
                    const startY = event.clientY;

                    handle.setPointerCapture(event.pointerId);

                    function onPointerMove(moveEvent) {

                        const dx = moveEvent.clientX - startX;
                        const dy = moveEvent.clientY - startY;
                        const override = currentOverride();

                        if (!override.maintainAspectRatio) {
                            setRect(dragResizeRect(startRect, handleId, dx, dy, w, h));
                        } else {
                            // A forced non-"Original" preset drags at that
                            // fixed ratio; otherwise (still Maintain Aspect
                            // Ratio, but "Original") dragResizeRectLocked's
                            // own default - startRect's own current shape -
                            // applies, same as before this feature existed.
                            const forcedRatio = effectiveAspectRatio(override.aspectRatioPreset, override.aspectOrientationFlipped, w, h);
                            setRect(forcedRatio === null
                                ? dragResizeRectLocked(startRect, handleId, dx, dy, w, h)
                                : dragResizeRectLocked(startRect, handleId, dx, dy, w, h, forcedRatio));
                        }
                        redraw();
                    }

                    function onPointerUp() {
                        handle.removeEventListener('pointermove', onPointerMove);
                        handle.removeEventListener('pointerup', onPointerUp);
                    }

                    handle.addEventListener('pointermove', onPointerMove);
                    handle.addEventListener('pointerup', onPointerUp, {once: true});
                });

                container.append(handle);
                elements[handleId] = handle;
            });

            return elements;
        }

        // A 9th, visually distinct control (a solid teal 6x4/4x6
        // rectangle at the resize rectangle's own centre, where none of
        // the 8 resize handles sit) for switching the rectangle's shape
        // between portrait and landscape while Maintain Aspect Ratio is
        // on - the "come up with a way to switch" part of Resize
        // Options. A modifier key held mid-drag was
        // considered and dropped: it's invisible until discovered by
        // accident and easy to trigger without realising, whereas a
        // control that's only ever shown while it's actually relevant
        // (see syncFlipControl) is self-explanatory by being there at
        // all. The submenu's own "Switch to Portrait/Landscape" action
        // (see registerOverlayContextMenu) does the same thing, for
        // anyone who'd rather use the menu.
        function createOrientationFlipControl(container, onFlip) {

            const flip = document.createElement('div');
            flip.setAttribute('role', 'presentation');
            flip.setAttribute('aria-hidden', 'true');
            // Size, position and title are set by redraw()
            // (orientationFlipDisplay) - it always runs immediately after
            // this is created (see syncFlipControl/applyForcedAspectRatio),
            // so there's no meaningful placeholder to set here first.
            flip.style.position = 'absolute';
            flip.style.boxSizing = 'border-box';
            flip.style.background = RESIZE_HANDLE_COLOUR;
            flip.style.border = '3px solid #fff';
            flip.style.cursor = 'pointer';
            flip.style.touchAction = 'none';

            // Same reasoning as each resize handle's own pointerdown
            // below - stops this reaching the page underneath, and stops
            // a click here also being read as "click outside the menu"
            // by a context menu that happened to still be open.
            flip.addEventListener('pointerdown', event => {
                event.preventDefault();
                event.stopPropagation();
            });
            flip.addEventListener('click', event => {
                event.stopPropagation();
                onFlip();
            });

            container.append(flip);
            return flip;
        }

        // The overlay's own right-click menu (see showOverlayContextMenu) -
        // "Enable Resize" toggles the 8 handles above on or off without
        // touching whatever rectangle is already set (so turning resize
        // off leaves the grid exactly as last positioned, for a clean,
        // uncluttered view of it), and "Reset" discards this image's
        // override entirely, back to covering the whole image. "Resize
        // Options" (see below) covers Maintain Aspect Ratio and its own
        // forced-preset controls.
        function registerOverlayContextMenu(container, w, h, currentOverride, setResizeEnabled, setMaintainAspectRatio, setAspectRatioPreset, toggleOrientationFlipped, resetOverride) {

            container.addEventListener('contextmenu', (event) => {

                event.preventDefault();

                const override = currentOverride();

                const resizeOptionsItems = [
                    {
                        type: 'checkbox',
                        label: 'Maintain Aspect Ratio',
                        checked: override.maintainAspectRatio,
                        onToggle: setMaintainAspectRatio
                    },
                    {type: 'separator'},
                    ...orderedAspectRatioPresetIds().map(presetId => ({
                        type: 'radio',
                        label: ASPECT_RATIO_PRESETS[presetId].label,
                        checked: override.aspectRatioPreset === presetId,
                        onToggle: () => setAspectRatioPreset(presetId)
                    }))
                ];

                // Same condition as the on-canvas control (syncFlipControl)
                // - meaningless only for "Square", where there's no
                // orientation to flip either way.
                if (override.maintainAspectRatio && override.aspectRatioPreset !== 'square') {
                    const rect = activeResizeRect(override, w, h);
                    const ratio = rect.w / rect.h;
                    resizeOptionsItems.push({type: 'separator'});
                    resizeOptionsItems.push({
                        type: 'action',
                        label: ratio >= 1 ? 'Switch to Portrait' : 'Switch to Landscape',
                        onActivate: toggleOrientationFlipped
                    });
                }

                showOverlayContextMenu(event.clientX, event.clientY, [
                    {
                        type: 'checkbox',
                        label: 'Enable Resize',
                        checked: override.resizeEnabled,
                        onToggle: setResizeEnabled
                    },
                    {
                        type: 'submenu',
                        label: 'Resize Options',
                        items: resizeOptionsItems
                    },
                    {type: 'separator'},
                    {
                        type: 'action',
                        label: 'Reset',
                        onActivate: resetOverride
                    }
                ], container);
            });
        }

        // Every overlay style's draw function shares this one signature -
        // adding a new style (alongside Grid/Phi Grid/Fibonacci Spiral)
        // means adding one more entry here, not a new branch in
        // renderImageOverlay.
        const OVERLAY_STYLE_DRAWERS = {
            grid: drawGridOverlay,
            'phi-grid': drawPhiGridOverlay,
            'golden-ratio': drawGoldenSpiral
        };

        // Fibonacci Spiral, Grid and Phi Grid are mutually-exclusive
        // overlay "modes" (see Composition Overlay on the Options page) -
        // only ever one at a time, never more than one at once.
        function drawGoldenSpiral(ctx, w, h, options) {

            ctx.lineWidth = 1;
            ctx.strokeStyle = hexToRgba(options.lineColour, options.lineOpacity);

            traceGoldenSpiralPath(ctx, w, h, options.goldenRatioDirection, options.goldenRatioStart);

            ctx.stroke();
        }

        function removeOverlays() {

            document.querySelectorAll('[data-extension="rule-of-thirds"]').forEach(element => element.remove());
            controlElement.setAttribute('active', 'false');
        }

        // The top-left corner that `position: absolute` will actually resolve `left`/`top`
        // against once appended inside `appendTarget` - the nearest ancestor from there
        // (inclusive) with a `position` other than `static`, in viewport coordinates. Not
        // necessarily appendTarget itself: a <td>/<th>/<table> can be an element's
        // offsetParent (per the DOM's own, table-aware definition of that property) without
        // being `position`-ed at all, in which case it's NOT a valid CSS containing block,
        // and absolute positioning actually resolves against the next positioned ancestor
        // further up instead - possibly nowhere near the table itself (eg a wiki page's
        // table-based layout, where the real containing block can be a `position: relative`
        // wrapper several levels above the table). If no ancestor is positioned at all, the
        // containing block is the page's own initial containing block, which scrolls with
        // the document - hence the scrollX/scrollY fallback (not needed once there IS a
        // positioned ancestor, since that ancestor's own rect already reflects the current
        // scroll position).
        function containingBlockOrigin(appendTarget) {

            let ancestor = appendTarget;
            while (ancestor && getComputedStyle(ancestor).position === 'static') {
                ancestor = ancestor.parentElement;
            }

            if (!ancestor) {
                return {left: -window.scrollX, top: -window.scrollY};
            }

            const rect = ancestor.getBoundingClientRect();
            return {left: rect.left, top: rect.top};
        }

        // Positions and sizes a wrapper over the image - everything for
        // that image (the drawing canvas, and the resize handles when
        // enabled) is appended inside this one element, so removeOverlays()
        // only has to find and remove this single data-extension node per
        // image, not track its children separately.
        function createOverlayContainer(w, h, image, computedStyle) {

            const container = document.createElement('div');

            container.style.width = w + 'px';
            container.style.height = h + 'px';
            // No overflow:hidden here (unlike the canvas this used to be
            // set on) - a resize handle straddles the edge of its
            // rectangle by design (see RESIZE_HANDLE_SIZE), including the
            // full-image rectangle's own edges, and hiding that overflow
            // would clip every handle in half.
            container.style.padding = computedStyle.padding;
            container.setAttribute('data-extension', 'rule-of-thirds');
            // Not in the page's own tab order (a plain image wasn't
            // before, and this shouldn't change that) - but still a valid
            // focus() target, which showOverlayContextMenu relies on to
            // return focus here (rather than falling back to <body>) once
            // its context menu closes. outline:none since this is an
            // invisible interaction layer, not a control anyone tabs to
            // themselves - the browser's default focus ring would
            // otherwise flash around the whole image right after closing
            // the menu.
            container.tabIndex = -1;
            container.style.outline = 'none';

            if (image.offsetParent) {
                container.style.position = 'absolute';
                if (image.style['margin'] === 'auto') {
                    // The image's own rendered position (below) already fully accounts for
                    // any margin it has - copying it onto the container too, on top of
                    // explicit left/top, would double it up (an absolutely-positioned
                    // element's margin still shifts it further from its own left/top).
                    // margin:auto is the one case with nothing to measure instead: there's
                    // no fixed offset to read off the image, only the same auto-margin
                    // centering the browser already does for it - copying the (auto-
                    // resolved) margin here, and leaving left/top unset, makes the
                    // container centre itself the same way.
                    container.style.margin = computedStyle.margin;
                } else {
                    // Deliberately not image.offsetLeft/offsetTop (which are relative to
                    // image.offsetParent) - see containingBlockOrigin above for why that
                    // can point at the wrong place entirely. Measuring both the image and
                    // the real containing block in the same (viewport) coordinates and
                    // taking their difference sidesteps the mismatch regardless of where
                    // offsetParent happens to be.
                    const origin = containingBlockOrigin(image.offsetParent);
                    const imageRect = image.getBoundingClientRect();
                    container.style.left = (imageRect.left - origin.left + parseInt(computedStyle.borderLeftWidth)) + 'px';
                    container.style.top = (imageRect.top - origin.top + parseInt(computedStyle.borderTopWidth)) + 'px';
                }
            } else {
                // offsetParent is null exactly when the image's own position
                // is `fixed` (the only case that reaches here - the
                // getClientRects() check above already filters out images
                // that aren't rendered at all). There's no positioned
                // ancestor to measure an offset against, so the container is
                // fixed-positioned too, using the image's on-screen
                // (viewport-relative) rect instead.
                const rect = image.getBoundingClientRect();
                container.style.position = 'fixed';
                container.style.left = rect.left + 'px';
                container.style.top = rect.top + 'px';
            }

            return container;
        }

        // Just the drawing surface now - sized and positioned by its
        // createOverlayContainer() wrapper, not itself (see above).
        function createCanvas(w, h) {

            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;

            // Backing store at devicePixelRatio for a crisp result on
            // HiDPI/zoomed displays, CSS size kept at the logical w/h so it
            // still occupies the same on-page space (see the ctx.scale()
            // call in renderImageOverlay's redraw(), which is what actually
            // draws sharper rather than just bigger).
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.position = 'absolute';
            canvas.style.left = '0';
            canvas.style.top = '0';
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';

            return canvas;
        }

    }

    // Guards Node (used by /test) where there's no page to attach to.
    if (typeof document !== 'undefined') {
        rotInit();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isMinSize, shouldRender, sanitizeInt, sanitizeOptions, sanitizeLineStates, sanitizeCircleStates, sanitizeColour, sanitizeEnum,
        MIN_RESIZE_DIMENSION, RESIZE_HANDLES, activeResizeRect, resizeHandlePosition, dragResizeRect, dragResizeRectLocked, fitRectToImage,
        resizeMaskRects, resizeBorderRects, ASPECT_RATIO_PRESETS, effectiveAspectRatio, targetOrientationIsLandscape, orderedAspectRatioPresetIds,
        maxRectAtAnchor, orientationFlipDisplay, dragMoveRect
    };
}