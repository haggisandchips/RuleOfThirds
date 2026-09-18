// Pure helpers, hoisted out of rotInit() so they can be unit tested in
// isolation (see /test) and reused without touching the DOM or chrome.*.
// `function` declarations (unlike rotInit's `const`) are safe to redeclare
// if this file is injected into the same page more than once.

function resolveImageSrc(image) {

    return image.currentSrc || image.src;
}

function isMinSize(w, h, minLong, minShort) {

    return (w >= minLong && h >= minShort) || (h >= minLong && w >= minShort);
}

function shouldRender(computedStyle, w, h, minLong, minShort) {

    const visibility = computedStyle['visibility'];
    const display = computedStyle['display'];

    return visibility !== 'hidden' && display !== 'none' && isMinSize(w, h, minLong, minShort);
}

// Storage may hold values saved by an older version of the options page
// (numbers saved as strings, or missing bounds checks), so re-validate on
// every read rather than trusting what was persisted.
function sanitizeOptions(data) {

    const gridRows = sanitizeInt(data.gridRows, 1, 3);
    const gridColumns = sanitizeInt(data.gridColumns, 1, 3);

    return {
        ...data,
        gridRows,
        gridColumns,
        gridRowLines: sanitizeLineStates(data.gridRowLines, gridRows - 1),
        gridColumnLines: sanitizeLineStates(data.gridColumnLines, gridColumns - 1),
        circleRadius: sanitizeInt(data.circleRadius, 1, 5),
        lineOpacity: sanitizeInt(data.lineOpacity, 0, 100, 100),
        circleOpacity: sanitizeInt(data.circleOpacity, 0, 100, 100),
        circleLines: sanitizeCircleStates(data.circleLines, gridRows - 1, gridColumns - 1)
    };
}

function sanitizeInt(value, min, fallback, max = Infinity) {

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : Math.min(Math.max(parsed, min), max);
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

if (typeof rotInit === 'undefined') {

    console.log('Injecting function');

    const rotInit = function () {

        const MIN_LONG = 100, MIN_SHORT = 50;

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
                    console.log('Options changed - refreshing overlays');
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

            console.log('Applying grids');

            const images = document.getElementsByTagName('img');
            for (let ii = 0; ii < images.length; ii++) {
                const image = images[ii];
                if (!image.offsetParent) {
                    continue;
                }

                const computedStyle = getComputedStyle(image, null);
                const w = image.width;
                const h = image.height;

                if (shouldRender(computedStyle, w, h, MIN_LONG, MIN_SHORT)) {
                    renderImageOverlay(image, computedStyle, w, h);
                }
            }

            controlElement.setAttribute('active', 'true');
        }

        function renderImageOverlay(image, computedStyle, w, h) {

            const imageParent = image.offsetParent;
            const canvas = createCanvas(w, h, image, computedStyle);
            const ctx = canvas.getContext('2d');

            if (options.overlayStyle === 'golden-ratio') {
                drawGoldenSpiral(ctx, w, h);
            } else {
                drawGridOverlay(ctx, w, h, options);
            }

            imageParent.append(canvas);

            removeUndersizedImages(canvas, image);
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

            console.log('Removing grids');

            document.querySelectorAll('[data-extension="rule-of-thirds"]').forEach(element => element.remove());
            controlElement.setAttribute('active', 'false');
        }

        function createCanvas(w, h, image, computedStyle) {

            const canvas = document.createElement('canvas');

            canvas.width = w;
            canvas.height = h;
            canvas.style.overflow = 'hidden';
            canvas.style.position = 'absolute';

            if (image.style['margin'] !== 'auto') {
                canvas.style.left = image.offsetLeft + parseInt(computedStyle.borderLeftWidth) + 'px';
                canvas.style.top = image.offsetTop + parseInt(computedStyle.borderTopWidth) + 'px';
            }
            canvas.style.padding = computedStyle.padding;
            canvas.style.margin = computedStyle.margin;
            canvas.style.overflow = 'hidden';
            canvas.setAttribute('data-extension', 'rule-of-thirds');

            return canvas;
        }

        // TODO It would be better to use this approach before adding the canvas
        //      Also, when does this actually apply?
        function removeUndersizedImages(canvas, image) {

            const actualImage = new Image();

            actualImage.onload = function () {
                return function () {
                    const minSize = isMinSize(actualImage.width, actualImage.height, MIN_LONG, MIN_SHORT);
                    if (!minSize) {
                        canvas.remove();
                    }
                }
            }();

            actualImage.src = resolveImageSrc(image);
        }
    }

    // Guards Node (used by /test) where there's no page to attach to.
    if (typeof document !== 'undefined') {
        rotInit();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {resolveImageSrc, isMinSize, shouldRender, sanitizeInt, sanitizeOptions, sanitizeLineStates, sanitizeCircleStates};
}