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

// --- Overlay context menu ---
//
// A small, generic, keyboard-accessible replacement for the page's own
// right-click menu when it's opened on the overlay - deliberately built
// around a declarative list of items (see showOverlayContextMenu's `items`
// parameter) rather than bespoke DOM for "Enable Resize" and "Reset"
// specifically, since more per-image overrides are expected to grow this
// menu later. Follows the WAI-ARIA menu pattern (role="menu" containing
// role="menuitem"/"menuitemcheckbox", arrow keys to move between them,
// Enter/Space to activate, Escape or a click outside to close and return
// focus to whatever opened it).
//
// Only one instance is ever open at a time - opening a new one closes
// whichever was already showing, same as a native context menu.
//
// KNOWN GAP: "keyboard-accessible" above is about the menu's own internals
// once it's open, not how to open it - the overlay's container has
// tabIndex=-1 (a valid focus() target so returning focus here on close
// works) but is deliberately not in the page's own Tab order, so there's
// currently no keyboard path to trigger the browser's own Shift+F10/Menu-
// key "contextmenu" event on it at all. The resize handles (see
// createResizeHandles below) are pointer-only too - role="presentation"/
// aria-hidden="true", no keyboard equivalent for nudging one. Flagged
// rather than fixed here since a real fix (Tab reaching the overlay,
// Tab/arrow keys between handles, arrow keys to nudge, Shift+arrow for
// bigger steps) is a proper feature in its own right, not a quick patch.
var openOverlayMenu = null;

function closeOverlayContextMenu() {

    if (!openOverlayMenu) {
        return;
    }

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

    if (openOverlayMenu && !openOverlayMenu.element.contains(event.target)) {
        closeOverlayContextMenu();
    }
}

// `items` is an array of:
//   {type: 'checkbox', label, checked, onToggle(newChecked)}
//   {type: 'action', label, onActivate()}
//   {type: 'separator'}
// `returnFocusTo` gets focus back once the menu closes (Escape, a click
// outside, or an item being activated all close it).
function showOverlayContextMenu(x, y, items, returnFocusTo) {

    closeOverlayContextMenu();

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('data-extension', 'rule-of-thirds');
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
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

        // A real bordered box (checked: a tick inside it) rather than a
        // character-plus-blank-space hack, so it reads as an actual
        // checkbox rather than unexplained indentation - only added for a
        // checkbox item below, so a plain action item (eg "Reset") stays
        // flush left rather than indented to match. `currentColor` (not a
        // fixed colour) so this stays visible against both this item's
        // normal background and the teal background the focus/blur
        // handlers below switch its text colour against.
        const checkbox = document.createElement('span');
        checkbox.setAttribute('aria-hidden', 'true');
        checkbox.style.display = 'inline-flex';
        checkbox.style.alignItems = 'center';
        checkbox.style.justifyContent = 'center';
        checkbox.style.width = '14px';
        checkbox.style.height = '14px';
        checkbox.style.flexShrink = '0';
        checkbox.style.boxSizing = 'border-box';
        checkbox.style.fontSize = '11px';
        checkbox.style.lineHeight = '1';

        const label = document.createElement('span');
        label.textContent = item.label;

        if (item.type === 'checkbox') {
            menuItem.setAttribute('role', 'menuitemcheckbox');
            menuItem.setAttribute('aria-checked', item.checked ? 'true' : 'false');
            checkbox.style.border = '1.5px solid currentColor';
            checkbox.style.borderRadius = '3px';
            checkbox.textContent = item.checked ? '✓' : '';
            menuItem.append(checkbox);
        } else {
            menuItem.setAttribute('role', 'menuitem');
        }

        menuItem.append(label);

        function activate() {
            if (item.type === 'checkbox') {
                item.onToggle(!item.checked);
            } else {
                item.onActivate();
            }
            closeOverlayContextMenu();
        }

        // outline:none above removes the browser's default focus ring (it
        // sits awkwardly against this menu's own box-shadow styling) - this
        // is what replaces it, a themed highlight instead of no visible
        // indicator at all.
        menuItem.addEventListener('focus', () => { menuItem.style.background = RESIZE_HANDLE_COLOUR; menuItem.style.color = '#fff'; });
        menuItem.addEventListener('blur', () => { menuItem.style.background = ''; menuItem.style.color = ''; });
        menuItem.addEventListener('mouseenter', () => menuItem.focus());
        menuItem.addEventListener('click', activate);
        menuItem.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate();
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
            closeOverlayContextMenu();
        }
    });

    document.body.append(menu);

    // Keeps the menu fully on-screen rather than letting it spill past the
    // right/bottom edge of the viewport when opened near a corner.
    const bounds = menu.getBoundingClientRect();
    if (bounds.right > window.innerWidth) {
        menu.style.left = Math.max(0, window.innerWidth - bounds.width) + 'px';
    }
    if (bounds.bottom > window.innerHeight) {
        menu.style.top = Math.max(0, window.innerHeight - bounds.height) + 'px';
    }

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

            function currentOverride() {
                return controlElement.imageOverrides.get(image) || {resizeEnabled: false, rect: null};
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
                    Object.keys(RESIZE_HANDLES).forEach(handleId => {
                        const position = resizeHandlePosition(rect, handleId);
                        handleElements[handleId].style.left = position.x + 'px';
                        handleElements[handleId].style.top = position.y + 'px';
                    });
                }
            }

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
                redraw();
            }

            // Snaps the grid back to covering the whole image, and turns
            // "Enable Resize" back off too if it was on - having Reset
            // leave resize mode active would just leave 8 handles sitting
            // at the full image's own edges, ready to immediately drag it
            // out of shape again, when the point of Reset is a clean slate.
            function resetOverride() {

                const override = currentOverride();
                override.rect = null;
                if (override.resizeEnabled) {
                    override.resizeEnabled = false;
                    if (handleElements) {
                        Object.values(handleElements).forEach(element => element.remove());
                        handleElements = null;
                    }
                }
                controlElement.imageOverrides.set(image, override);
                redraw();
            }

            registerOverlayContextMenu(container, currentOverride, setResizeEnabled, resetOverride);

            if (currentOverride().resizeEnabled) {
                handleElements = createResizeHandles(container, w, h, currentOverride, setRect, redraw);
            }
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
                        setRect(dragResizeRect(startRect, handleId, moveEvent.clientX - startX, moveEvent.clientY - startY, w, h));
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

        // The overlay's own right-click menu (see showOverlayContextMenu) -
        // "Enable Resize" toggles the 8 handles above on or off without
        // touching whatever rectangle is already set (so turning resize
        // off leaves the grid exactly as last positioned, for a clean,
        // uncluttered view of it), and "Reset" discards this image's
        // override entirely, back to covering the whole image.
        function registerOverlayContextMenu(container, currentOverride, setResizeEnabled, resetOverride) {

            container.addEventListener('contextmenu', (event) => {

                event.preventDefault();

                const override = currentOverride();

                showOverlayContextMenu(event.clientX, event.clientY, [
                    {
                        type: 'checkbox',
                        label: 'Enable Resize',
                        checked: override.resizeEnabled,
                        onToggle: setResizeEnabled
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
            container.style.margin = computedStyle.margin;
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
                if (image.style['margin'] !== 'auto') {
                    container.style.left = image.offsetLeft + parseInt(computedStyle.borderLeftWidth) + 'px';
                    container.style.top = image.offsetTop + parseInt(computedStyle.borderTopWidth) + 'px';
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
        MIN_RESIZE_DIMENSION, RESIZE_HANDLES, activeResizeRect, resizeHandlePosition, dragResizeRect, resizeMaskRects, resizeBorderRects
    };
}