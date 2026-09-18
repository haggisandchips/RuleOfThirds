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
        circleLines: sanitizeCircleStates(data.circleLines, gridRows - 1, gridColumns - 1),
        lineColour: sanitizeColour(data.lineColour, '#ffffff'),
        circleColour: sanitizeColour(data.circleColour, '#ff0000')
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
// nothing for that, so the grid can vanish with no error or explanation.
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
            document.body.appendChild(controlElement);

            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'sync'/* && changes.options?.newValue*/) {
                    if (controlElement.getAttribute('active') === 'true') {
                        readOptions().then(() => {
                            removeGrids();
                            applyGrids();
                        })
                    }
                }
            });
        }

        promise.then(() => {
            toggleGrids();
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
                        circleRadius: 5,
                        circleStyle: 'outline',
                        circleLines: [[true, true], [true, true]],
                        minImageWidth: 100,
                        minImageHeight: 50,
                        eitherOrientation: true,
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

        function toggleGrids() {

            if (controlElement.getAttribute('active') === 'false') {
                applyGrids();
            } else {
                removeGrids();
            }
        }

        // Lets the service worker reflect this tab's on/off state on the
        // toolbar icon - it has no other way to know, since applying and
        // removing the grid only ever changes DOM state inside this page.
        function reportState() {

            chrome.runtime.sendMessage({
                type: 'rule-of-thirds-state',
                active: controlElement.getAttribute('active') === 'true'
            });
        }

        function applyGrids() {

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

            const canvas = createCanvas(w, h, image, computedStyle);
            const ctx = canvas.getContext('2d');

            // The backing store is sized up by devicePixelRatio in
            // createCanvas() for a crisp result on HiDPI/zoomed displays -
            // this scales the context back down so every subsequent draw
            // call can keep using CSS-pixel coordinates (w/h) unchanged.
            ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

            if (options.overlayStyle === 'golden-ratio') {
                drawGoldenSpiral(ctx, w, h);
            } else {
                drawGridOverlay(ctx, w, h, options);
            }

            (image.offsetParent || document.body).append(canvas);
        }

        // Golden Ratio and Grid/Circles are mutually-exclusive overlay
        // "modes" (see Overlay Style on the Options page) - only ever one
        // or the other, never both at once.
        function drawGoldenSpiral(ctx, w, h) {

            ctx.lineWidth = 1;
            ctx.strokeStyle = hexToRgba(options.lineColour, options.lineOpacity);

            traceGoldenSpiralPath(ctx, w, h, options.goldenRatioDirection, options.goldenRatioStart);

            ctx.stroke();
        }

        function removeGrids() {

            document.querySelectorAll('[data-extension="rule-of-thirds"]').forEach(element => element.remove());
            controlElement.setAttribute('active', 'false');
        }

        function createCanvas(w, h, image, computedStyle) {

            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;

            // Backing store at devicePixelRatio for a crisp result on
            // HiDPI/zoomed displays, CSS size kept at the logical w/h so it
            // still occupies the same on-page space (see the ctx.scale()
            // call in renderImageOverlay, which is what actually draws
            // sharper rather than just bigger).
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            canvas.style.overflow = 'hidden';
            canvas.style.padding = computedStyle.padding;
            canvas.style.margin = computedStyle.margin;
            canvas.setAttribute('data-extension', 'rule-of-thirds');

            if (image.offsetParent) {
                canvas.style.position = 'absolute';
                if (image.style['margin'] !== 'auto') {
                    canvas.style.left = image.offsetLeft + parseInt(computedStyle.borderLeftWidth) + 'px';
                    canvas.style.top = image.offsetTop + parseInt(computedStyle.borderTopWidth) + 'px';
                }
            } else {
                // offsetParent is null exactly when the image's own position
                // is `fixed` (the only case that reaches here - the
                // getClientRects() check above already filters out images
                // that aren't rendered at all). There's no positioned
                // ancestor to measure an offset against, so the canvas is
                // fixed-positioned too, using the image's on-screen
                // (viewport-relative) rect instead.
                const rect = image.getBoundingClientRect();
                canvas.style.position = 'fixed';
                canvas.style.left = rect.left + 'px';
                canvas.style.top = rect.top + 'px';
            }

            return canvas;
        }

    }

    // Guards Node (used by /test) where there's no page to attach to.
    if (typeof document !== 'undefined') {
        rotInit();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {isMinSize, shouldRender, sanitizeInt, sanitizeOptions, sanitizeLineStates, sanitizeCircleStates, sanitizeColour};
}