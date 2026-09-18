const DEFAULT_OPTIONS = {
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
    circleLines: [[true, true], [true, true]]
};

const MIN_GRID_LINES = 1;
const MIN_CIRCLE_RADIUS = 1;
const MIN_OPACITY = 0;

// Per-line/per-circle enabled state for the "Customise" preview - kept as
// plain module state (rather than re-read from the DOM) since there's no
// input element backing each one, only the preview canvas itself.
let gridRowLineStates = DEFAULT_OPTIONS.gridRowLines.slice();
let gridColumnLineStates = DEFAULT_OPTIONS.gridColumnLines.slice();
let circleLineStates = DEFAULT_OPTIONS.circleLines.map(row => row.slice());

// Restores options from chrome.storage
const loadOptions = () => {

    chrome.storage.sync.get(
        DEFAULT_OPTIONS,
        (options) => setOptions(options)
    );
};

// Saves options to chrome.storage
const saveOptions = (event) => {

    const renderGrid = document.getElementById('render-grid').checked;

    // The field the user is actively editing has its minimum raised to 2
    // whenever the *other* field is currently 1, so it's impossible to type
    // your way into a 1x1 grid. The untouched field keeps the base minimum -
    // it was already valid before this edit, so it can't newly need raising.
    const changedElementId = event && event.target && event.target.id;
    const currentGridRows = clampInt(document.getElementById('grid-rows').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows);
    const currentGridColumns = clampInt(document.getElementById('grid-columns').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridColumns);
    const {gridRowsMin, gridColumnsMin} = computeGridLineMinimums(currentGridRows, currentGridColumns, changedElementId);

    const gridRows = parseValidInt('grid-rows', gridRowsMin, DEFAULT_OPTIONS.gridRows);
    const gridColumns = parseValidInt('grid-columns', gridColumnsMin, DEFAULT_OPTIONS.gridColumns);

    // Resizing the grid shifts every line's (and circle's) position, so one
    // left disabled at its old position would silently apply to a different
    // line/circle - resetting everything to enabled avoids that surprise.
    // Otherwise just keep the arrays the correct size defensively.
    if (changedElementId === 'grid-rows' || changedElementId === 'grid-columns') {
        gridRowLineStates = resetLineStates(gridRows - 1);
        gridColumnLineStates = resetLineStates(gridColumns - 1);
        circleLineStates = resetCircleStates(gridRows - 1, gridColumns - 1);
    } else {
        gridRowLineStates = resizeLineStates(gridRowLineStates, gridRows - 1);
        gridColumnLineStates = resizeLineStates(gridColumnLineStates, gridColumns - 1);
        circleLineStates = resizeCircleStates(circleLineStates, gridRows - 1, gridColumns - 1);
    }
    renderGridCustomisePreview();

    const lineColour = document.getElementById('line-colour').value;
    const lineOpacity = parseValidInt('line-opacity', MIN_OPACITY, DEFAULT_OPTIONS.lineOpacity);
    const renderCircle = document.getElementById('render-circle').checked;
    const circleColour = document.getElementById('circle-colour').value;
    const circleOpacity = parseValidInt('circle-opacity', MIN_OPACITY, DEFAULT_OPTIONS.circleOpacity);
    const circleRadius = parseValidInt('circle-radius', MIN_CIRCLE_RADIUS, DEFAULT_OPTIONS.circleRadius);
    const circleStyle = getSelectedOption('circle-style');

    chrome.storage.sync.set(
        {
            renderGrid,
            gridRows,
            gridColumns,
            gridRowLines: gridRowLineStates,
            gridColumnLines: gridColumnLineStates,
            lineColour,
            lineOpacity,
            renderCircle,
            circleColour,
            circleOpacity,
            circleRadius,
            circleStyle,
            circleLines: circleLineStates
        },
        () => {
            showToast('Options saved.');
        }
    );
};

// Saves options to chrome.storage
const restoreDefaultOptions = () => {

    setOptions(DEFAULT_OPTIONS);
    saveOptions();
};

function setOptions(options) {

    document.getElementById('render-grid').checked = options.renderGrid;
    document.getElementById('grid-rows').value = options.gridRows;
    document.getElementById('grid-columns').value = options.gridColumns;
    gridRowLineStates = resizeLineStates(options.gridRowLines, options.gridRows - 1);
    gridColumnLineStates = resizeLineStates(options.gridColumnLines, options.gridColumns - 1);
    circleLineStates = resizeCircleStates(options.circleLines, options.gridRows - 1, options.gridColumns - 1);
    document.getElementById('line-colour').value = options.lineColour;
    syncQuickPickSelection('line-colour');
    document.getElementById('line-opacity').value = options.lineOpacity;
    updateOpacityLabel('line-opacity');
    document.getElementById('render-circle').checked = options.renderCircle;
    document.getElementById('circle-colour').value = options.circleColour;
    syncQuickPickSelection('circle-colour');
    document.getElementById('circle-opacity').value = options.circleOpacity;
    updateOpacityLabel('circle-opacity');
    document.getElementById('circle-radius').value = options.circleRadius;
    selectOption('circle-style', options.circleStyle);
    // Depends on every field set above, since an accurate preview needs all
    // of them (colours, opacity, style, and both enabled toggles).
    renderGridCustomisePreview();
}

// Shows the slider's current value as text (eg "75%"), since the native
// range input has no built-in way to display its own numeric value.
function updateOpacityLabel(opacityInputId) {

    document.getElementById(opacityInputId + '-value').textContent = document.getElementById(opacityInputId).value + '%';
}

// Highlights whichever quick-pick swatch matches the colour input's current
// value (and un-highlights the rest), whether that value was just set via
// a quick-pick click or the native picker landed on the same colour.
function syncQuickPickSelection(colourInputId) {

    const value = document.getElementById(colourInputId).value;
    const quickGroup = document.getElementById(colourInputId + '-quick');

    quickGroup.querySelectorAll('.quick-swatch').forEach(swatch => {
        swatch.classList.toggle('selected', swatch.dataset.value === value);
    });
}

const TOAST_DISPLAY_MS = 2000;

function showToast(message) {

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // Number spinners fire many rapid 'change' events, each triggering a
    // save. Without this, every one of those saves would queue its own
    // toast, flooding the page with "Options saved." notifications.
    container.replaceChildren();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), {once: true});
    }, TOAST_DISPLAY_MS);
}

// Reads a number input, clamping it to `min` and falling back to `fallback`
// when the field is blank or not a number, then reflects the corrected
// value back into the field so the UI never shows an unsaved bad value.
function parseValidInt(elementId, min, fallback) {

    const element = document.getElementById(elementId);
    const value = clampInt(element.value, min, fallback);

    element.value = value;
    return value;
}

// Pure clamping logic, split out from parseValidInt so it can be unit
// tested without a DOM (see /test).
function clampInt(value, min, fallback) {

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : Math.max(parsed, min);
}

// Defensively matches a line-state array to the current line count (eg
// when loading a value saved before Rows/Columns last changed elsewhere) -
// NOT used when the user edits Rows/Columns themselves, since that always
// resets every line back to enabled instead (see resetLineStates).
function resizeLineStates(states, count) {

    const result = (Array.isArray(states) ? states : []).slice(0, count);
    while (result.length < count) {
        result.push(true);
    }
    return result;
}

// Every line defaults back to enabled whenever Rows/Columns itself changes,
// since resizing the grid shifts each line's position - keeping an old
// disabled flag at the same index would silently apply it to a different
// line instead.
function resetLineStates(count) {

    return new Array(count).fill(true);
}

// 2D equivalents of resizeLineStates/resetLineStates, for the per-intersection
// circle toggles - each row is just a line-state array in its own right.
function resizeCircleStates(states, rowCount, columnCount) {

    const result = [];
    for (let ii = 0; ii < rowCount; ii++) {
        result.push(resizeLineStates(Array.isArray(states) ? states[ii] : undefined, columnCount));
    }
    return result;
}

function resetCircleStates(rowCount, columnCount) {

    const result = [];
    for (let ii = 0; ii < rowCount; ii++) {
        result.push(resetLineStates(columnCount));
    }
    return result;
}

// Blended most of the way back to white so the preview background stays a
// light backdrop (rather than the harsh, sometimes near-black result of a
// straight XOR/complement) whatever colours the user has actually picked -
// eg white lines on a white background would otherwise be invisible.
const GRID_CUSTOMISE_BACKGROUND_WHITE_BLEND = 0.75;

// A background derived from the two configured colours (average, then
// XORed against white to get a contrasting complement) so the preview
// stays visible without needing a colour picker of its own.
function computePreviewBackground(lineColour, circleColour) {

    const line = parseHexColour(lineColour);
    const circle = parseHexColour(circleColour);

    const channels = ['r', 'g', 'b'].map(channel => {
        const average = Math.round((line[channel] + circle[channel]) / 2);
        const complement = 255 ^ average;
        return Math.round(complement + (255 - complement) * GRID_CUSTOMISE_BACKGROUND_WHITE_BLEND);
    });

    return 'rgb(' + channels.join(', ') + ')';
}

function parseHexColour(hex) {

    return {
        r: parseInt(hex.substring(1, 3), 16),
        g: parseInt(hex.substring(3, 5), 16),
        b: parseInt(hex.substring(5, 7), 16)
    };
}

// The full set of "live" (not-yet-saved) grid/circle options, read straight
// from the form plus the customise-only line/circle states - everything
// drawGridOverlay() and the Customise preview itself need.
function buildLiveGridCustomiseOptions() {

    return {
        renderGrid: document.getElementById('render-grid').checked,
        gridRows: clampInt(document.getElementById('grid-rows').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows),
        gridColumns: clampInt(document.getElementById('grid-columns').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridColumns),
        gridRowLines: gridRowLineStates,
        gridColumnLines: gridColumnLineStates,
        lineColour: document.getElementById('line-colour').value,
        lineOpacity: clampInt(document.getElementById('line-opacity').value, MIN_OPACITY, DEFAULT_OPTIONS.lineOpacity),
        renderCircle: document.getElementById('render-circle').checked,
        circleColour: document.getElementById('circle-colour').value,
        circleOpacity: clampInt(document.getElementById('circle-opacity').value, MIN_OPACITY, DEFAULT_OPTIONS.circleOpacity),
        circleRadius: clampInt(document.getElementById('circle-radius').value, MIN_CIRCLE_RADIUS, DEFAULT_OPTIONS.circleRadius),
        circleStyle: getSelectedOption('circle-style'),
        circleLines: circleLineStates
    };
}

// Redraws both "Customise" canvases - called whenever anything they depend
// on changes (on load, on a form change, or on a click in the reference
// canvas).
//
// "Preview" is a faithful, accurate-colour render: a hidden line or circle
// is simply never drawn, exactly like the real overlay - it gives no clue
// by itself that it could be turned back on, and isn't interactive.
// "Hide / Show" exists purely to supply that clue (and the interactivity):
// a fixed white/black/grey reference map, drawn the same way regardless of
// the user's actual colours, so there's always an obvious, unambiguous spot
// to click.
function renderGridCustomisePreview() {

    const previewCanvas = document.getElementById('grid-customise-preview');
    const previewCtx = previewCanvas.getContext('2d');
    const liveOptions = buildLiveGridCustomiseOptions();

    previewCtx.fillStyle = computePreviewBackground(liveOptions.lineColour, liveOptions.circleColour);
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    drawGridOverlay(previewCtx, previewCanvas.width, previewCanvas.height, liveOptions);

    const referenceCanvas = document.getElementById('grid-customise-reference');
    renderGridCustomiseReference(referenceCanvas.getContext('2d'), referenceCanvas.width, referenceCanvas.height, liveOptions);
}

const GRID_CUSTOMISE_REFERENCE_ENABLED_COLOUR = '#000000';
const GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR = '#b0b0b0';

// Draws every line/circle position the grid could have, in black when it's
// enabled and grey when it's not - a permanently legible map of what's
// clickable, independent of whatever colours the user has actually chosen.
// A line/circle whose axis is disabled overall (renderGrid/renderCircle) is
// left off entirely, same as the real preview: there's nothing to un-hide
// if the master toggle for it is off.
function renderGridCustomiseReference(ctx, w, h, options) {

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;

    if (options.renderGrid) {
        options.gridRowLines.forEach((enabled, index) => {
            const y = (index + 1) * h / options.gridRows;
            ctx.strokeStyle = enabled ? GRID_CUSTOMISE_REFERENCE_ENABLED_COLOUR : GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        });

        options.gridColumnLines.forEach((enabled, index) => {
            const x = (index + 1) * w / options.gridColumns;
            ctx.strokeStyle = enabled ? GRID_CUSTOMISE_REFERENCE_ENABLED_COLOUR : GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        });
    }

    if (options.renderCircle) {
        const radius = Math.min((w / options.gridColumns) / 2, (h / options.gridRows) / 2, options.circleRadius);

        options.gridRowLines.forEach((rowEnabled, rowIndex) => {
            if (!rowEnabled) {
                return;
            }
            options.gridColumnLines.forEach((columnEnabled, columnIndex) => {
                if (!columnEnabled) {
                    return;
                }
                const enabled = options.circleLines[rowIndex][columnIndex];
                const x = (columnIndex + 1) * w / options.gridColumns;
                const y = (rowIndex + 1) * h / options.gridRows;
                ctx.strokeStyle = enabled ? GRID_CUSTOMISE_REFERENCE_ENABLED_COLOUR : GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.stroke();
            });
        });
    }
}

const GRID_CUSTOMISE_LINE_HIT_TOLERANCE = 8;
const GRID_CUSTOMISE_CIRCLE_HIT_TOLERANCE = 10;

// Pure hit-testing so it can be unit tested without a canvas/DOM: given a
// click position (in the preview's own pixel coordinates), decides which
// line or circle - if any - the click was meant for. Circles are checked
// first since they sit on top of a line intersection; a circle is only ever
// a target when both of its lines are enabled, since that's the only time
// it's eligible to be drawn (or ghosted) at all - matching
// drawGridCustomiseGhosts/drawGridOverlay's own rule.
function findGridCustomiseTarget(x, y, w, h, options) {

    const gridRows = options.gridRows;
    const gridColumns = options.gridColumns;

    if (options.renderCircle) {
        for (let columnIndex = 0; columnIndex < gridColumns - 1; columnIndex++) {
            if (!options.gridColumnLines[columnIndex]) {
                continue;
            }
            for (let rowIndex = 0; rowIndex < gridRows - 1; rowIndex++) {
                if (!options.gridRowLines[rowIndex]) {
                    continue;
                }
                const cx = (columnIndex + 1) * w / gridColumns;
                const cy = (rowIndex + 1) * h / gridRows;
                if (Math.hypot(x - cx, y - cy) <= GRID_CUSTOMISE_CIRCLE_HIT_TOLERANCE) {
                    return {type: 'circle', row: rowIndex, column: columnIndex};
                }
            }
        }
    }

    if (options.renderGrid) {
        for (let rowIndex = 0; rowIndex < gridRows - 1; rowIndex++) {
            const ly = (rowIndex + 1) * h / gridRows;
            if (Math.abs(y - ly) <= GRID_CUSTOMISE_LINE_HIT_TOLERANCE) {
                return {type: 'row', index: rowIndex};
            }
        }
        for (let columnIndex = 0; columnIndex < gridColumns - 1; columnIndex++) {
            const lx = (columnIndex + 1) * w / gridColumns;
            if (Math.abs(x - lx) <= GRID_CUSTOMISE_LINE_HIT_TOLERANCE) {
                return {type: 'column', index: columnIndex};
            }
        }
    }

    return null;
}

// Converts a mouse event's page position into the canvas's own pixel
// coordinates. Scales by canvas-pixels-per-CSS-pixel defensively, though
// the two match 1:1 today.
function gridCustomiseEventPosition(event) {

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
}

// Only the "Hide / Show" reference canvas is interactive - "Preview" is
// purely informational, since a hidden circle draws nothing there for the
// user to aim at (see gridCustomiseEventPosition's caller for the pointer
// feedback that keeps the reference canvas itself unambiguous to click).
function onGridCustomiseClick(event) {

    const canvas = event.currentTarget;
    const {x, y} = gridCustomiseEventPosition(event);

    const target = findGridCustomiseTarget(x, y, canvas.width, canvas.height, buildLiveGridCustomiseOptions());
    if (!target) {
        return;
    }

    if (target.type === 'row') {
        gridRowLineStates[target.index] = !gridRowLineStates[target.index];
    } else if (target.type === 'column') {
        gridColumnLineStates[target.index] = !gridColumnLineStates[target.index];
    } else {
        circleLineStates[target.row][target.column] = !circleLineStates[target.row][target.column];
    }

    renderGridCustomisePreview();
    saveOptions();
}

// Switches the cursor to a pointer only while actually hovering a line or
// circle, so the canvas doesn't look uniformly clickable when most of it
// isn't a valid target.
function onGridCustomiseHover(event) {

    const canvas = event.currentTarget;
    const {x, y} = gridCustomiseEventPosition(event);

    const target = findGridCustomiseTarget(x, y, canvas.width, canvas.height, buildLiveGridCustomiseOptions());
    canvas.style.cursor = target ? 'pointer' : 'default';
}

// A 1x1 grid draws no lines in either direction, so once one dimension is 1,
// the other dimension's floor rises to 2.
function minGridLines(otherDimensionValue) {

    return otherDimensionValue === 1 ? 2 : MIN_GRID_LINES;
}

// Only the field actively being edited gets the raised minimum - the other
// field was already valid before this edit, so its own minimum stays put.
function computeGridLineMinimums(currentGridRows, currentGridColumns, changedElementId) {

    return {
        gridRowsMin: changedElementId === 'grid-rows' ? minGridLines(currentGridColumns) : MIN_GRID_LINES,
        gridColumnsMin: changedElementId === 'grid-columns' ? minGridLines(currentGridRows) : MIN_GRID_LINES
    };
}

function selectOption(elementName, value) {

    document.getElementsByName(elementName).forEach(element => {
        if (element.value === value) {
            element.checked = true;
        }
    });
}

function getSelectedOption(elementName) {

    return document.querySelector('input[name="' + elementName + '"]:checked').value;
}

// Guards Node (used by /test) where there's no page to attach to.
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', loadOptions);
    document.querySelectorAll('input').forEach(input => input.addEventListener('change', saveOptions));

    // 'input' (not just 'change') so the selection ring tracks the native
    // colour picker live, in case it's dragged onto a quick-pick colour.
    document.getElementById('line-colour').addEventListener('input', () => syncQuickPickSelection('line-colour'));
    document.getElementById('circle-colour').addEventListener('input', () => syncQuickPickSelection('circle-colour'));

    document.getElementById('line-opacity').addEventListener('input', () => updateOpacityLabel('line-opacity'));
    document.getElementById('circle-opacity').addEventListener('input', () => updateOpacityLabel('circle-opacity'));

    const gridCustomiseReference = document.getElementById('grid-customise-reference');
    gridCustomiseReference.addEventListener('click', onGridCustomiseClick);
    gridCustomiseReference.addEventListener('mousemove', onGridCustomiseHover);
    gridCustomiseReference.addEventListener('mouseleave', () => { gridCustomiseReference.style.cursor = 'default'; });

    document.querySelectorAll('.quick-swatch').forEach(swatch => swatch.addEventListener('click', () => {
        const colourInputId = swatch.closest('.quick-swatch-group').dataset.for;
        document.getElementById(colourInputId).value = swatch.dataset.value;
        syncQuickPickSelection(colourInputId);
        saveOptions();
    }));

    document.getElementById('restoreDefaults').addEventListener('click', restoreDefaultOptions);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_OPTIONS, MIN_GRID_LINES, MIN_CIRCLE_RADIUS, clampInt, minGridLines, computeGridLineMinimums,
        resizeLineStates, resetLineStates, resizeCircleStates, resetCircleStates,
        computePreviewBackground, findGridCustomiseTarget, renderGridCustomiseReference
    };
}
