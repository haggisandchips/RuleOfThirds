const DEFAULT_OPTIONS = {
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
    previewBackgroundImage: true,
    applyToFrames: false,
    minImageWidth: 100,
    minImageHeight: 50,
    eitherOrientation: true,
    renderPhiGrid: true,
    phiRatio: [1, 0.618, 1],
    phiRowLines: [true, true],
    phiColumnLines: [true, true],
    phiCircleLines: [[true, true], [true, true]],
    goldenRatioDirection: 'clockwise',
    goldenRatioStart: 'bottom-left'
};

const MIN_GRID_LINES = 1;
// 9 rows/columns keeps a nice synergy with the Rule of Thirds itself (3x3)
// while still ruling out a grid large enough to blow chrome.storage.sync's
// per-item quota via circleLines.
const MAX_GRID_LINES = 9;
const MIN_CIRCLE_RADIUS = 1;
const MIN_OPACITY = 0;
const MIN_IMAGE_SIZE = 1;
// Unlike Grid, Phi Grid's row/column count is fixed, not user-editable -
// only the ratio between its (always 3) bands can be changed.
const PHI_GRID_BAND_COUNT = 3;
const PHI_RATIO_INPUT_IDS = ['phi-ratio-1', 'phi-ratio-2', 'phi-ratio-3'];
const MIN_PHI_RATIO = 0.01;
const PHI_RATIO_DECIMALS = 3;

// Per-line/per-circle enabled state for the "Customise" preview - kept as
// plain module state (rather than re-read from the DOM) since there's no
// input element backing each one, only the preview canvas itself. Grid and
// Phi Grid each get their own independent set, even though both are
// "weighted grid" styles sharing the same Customise UI (see
// weightedGridStyles below) - they're still separate overlays, so hiding a
// line in one shouldn't silently affect the other.
let gridRowLineStates = DEFAULT_OPTIONS.gridRowLines.slice();
let gridColumnLineStates = DEFAULT_OPTIONS.gridColumnLines.slice();
let circleLineStates = DEFAULT_OPTIONS.circleLines.map(row => row.slice());
let phiRowLineStates = DEFAULT_OPTIONS.phiRowLines.slice();
let phiColumnLineStates = DEFAULT_OPTIONS.phiColumnLines.slice();
let phiCircleLineStates = DEFAULT_OPTIONS.phiCircleLines.map(row => row.slice());

// Restores options from chrome.storage
const loadOptions = () => {

    chrome.storage.sync.get(
        DEFAULT_OPTIONS,
        (options) => setOptions(options)
    );
};

// Saves options to chrome.storage. successMessage/successAction let a
// caller other than a plain field edit (eg restoreDefaultOptions) show
// something other than the default "Options saved." toast.
const saveOptions = (event, successMessage = 'Options saved.', successAction) => {

    const overlayStyle = getSelectedOption('overlay-style');
    const renderGrid = document.getElementById('render-grid').checked;
    syncDependentFieldsEnabled();

    // The field the user is actively editing has its minimum raised to 2
    // whenever the *other* field is currently 1, so it's impossible to type
    // your way into a 1x1 grid. The untouched field keeps the base minimum -
    // it was already valid before this edit, so it can't newly need raising.
    const changedElementId = event && event.target && event.target.id;
    const currentGridRows = clampInt(document.getElementById('grid-rows').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows, MAX_GRID_LINES);
    const currentGridColumns = clampInt(document.getElementById('grid-columns').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridColumns, MAX_GRID_LINES);
    const {gridRowsMin, gridColumnsMin} = computeGridLineMinimums(currentGridRows, currentGridColumns, changedElementId);

    const gridRows = parseValidInt('grid-rows', gridRowsMin, DEFAULT_OPTIONS.gridRows, MAX_GRID_LINES);
    const gridColumns = parseValidInt('grid-columns', gridColumnsMin, DEFAULT_OPTIONS.gridColumns, MAX_GRID_LINES);

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
    const circleStyle = getSelectedOption('circle-style', DEFAULT_OPTIONS.circleStyle);
    const previewBackgroundImage = document.getElementById('preview-background-image').checked;
    const applyToFrames = document.getElementById('apply-to-frames').checked;
    const minImageWidth = parseValidInt('min-image-width', MIN_IMAGE_SIZE, DEFAULT_OPTIONS.minImageWidth);
    const minImageHeight = parseValidInt('min-image-height', MIN_IMAGE_SIZE, DEFAULT_OPTIONS.minImageHeight);
    const eitherOrientation = document.getElementById('either-orientation').checked;
    const renderPhiGrid = document.getElementById('render-phi-grid').checked;
    const phiRatio = readPhiRatio();
    const goldenRatioDirection = getSelectedOption('golden-ratio-direction');
    const goldenRatioStart = getSelectedOption('golden-ratio-start');

    chrome.storage.sync.set(
        {
            overlayStyle,
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
            circleLines: circleLineStates,
            previewBackgroundImage,
            applyToFrames,
            minImageWidth,
            minImageHeight,
            eitherOrientation,
            renderPhiGrid,
            phiRatio,
            phiRowLines: phiRowLineStates,
            phiColumnLines: phiColumnLineStates,
            phiCircleLines: phiCircleLineStates,
            goldenRatioDirection,
            goldenRatioStart
        },
        () => {
            showToast(chrome.runtime.lastError
                ? 'Could not save options: ' + chrome.runtime.lastError.message
                : successMessage, successAction);
        }
    );
};

// Resets to defaults, but keeps a snapshot of whatever was configured a
// moment ago so the save toast's "Undo" action can put it straight back -
// cheaper than a confirmation prompt, and just as safe since nothing is
// actually lost.
const restoreDefaultOptions = () => {

    const previousOptions = buildLiveGridCustomiseOptions();

    setOptions(DEFAULT_OPTIONS);
    saveOptions(undefined, 'Options reset to defaults.', {
        label: 'Undo',
        onClick: () => {
            setOptions(previousOptions);
            saveOptions();
        }
    });
};

// Restores just the Phi Grid ratio to its default (1 : 0.618 : 1), leaving
// every other option - including Phi Grid's own Enabled toggle - untouched,
// unlike the page-wide Restore Defaults above.
const restorePhiRatioDefaults = () => {

    const previousRatio = readPhiRatio();

    writePhiRatio(DEFAULT_OPTIONS.phiRatio);
    saveOptions(undefined, 'Ratio reset to default.', {
        label: 'Undo',
        onClick: () => {
            writePhiRatio(previousRatio);
            saveOptions();
        }
    });
};

function setOptions(options) {

    selectOption('overlay-style', options.overlayStyle);
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
    document.getElementById('preview-background-image').checked = options.previewBackgroundImage;
    document.getElementById('apply-to-frames').checked = options.applyToFrames;
    document.getElementById('min-image-width').value = options.minImageWidth;
    document.getElementById('min-image-height').value = options.minImageHeight;
    document.getElementById('either-orientation').checked = options.eitherOrientation;
    document.getElementById('render-phi-grid').checked = options.renderPhiGrid;
    writePhiRatio(options.phiRatio);
    phiRowLineStates = resizeLineStates(options.phiRowLines, PHI_GRID_BAND_COUNT - 1);
    phiColumnLineStates = resizeLineStates(options.phiColumnLines, PHI_GRID_BAND_COUNT - 1);
    phiCircleLineStates = resizeCircleStates(options.phiCircleLines, PHI_GRID_BAND_COUNT - 1, PHI_GRID_BAND_COUNT - 1);
    syncDependentFieldsEnabled();
    selectOption('golden-ratio-direction', options.goldenRatioDirection);
    selectOption('golden-ratio-start', options.goldenRatioStart);
    syncGoldenRatioThumbnailSelection();
    syncOverlayStyleVisibility();
    // Depends on every field set above, since an accurate preview needs all
    // of them (colours, opacity, style, both enabled toggles, and the photo
    // toggle) - layoutGridCustomiseCanvases() sizes the canvases and then
    // renders.
    layoutGridCustomiseCanvases();
}

// Line Colour/Opacity only ever affect anything while Grid itself is
// enabled (drawGridOverlay only reads them inside its
// `if (options.renderGrid)` branch); Circles' Radius/Style/Colour/Opacity
// are the same story for Circles. Disabling (and dimming, via the
// `input:disabled`/`.quick-swatch:disabled` rules in style.css) those
// fields while their section is off makes that dependency visible instead
// of leaving fully-interactive controls that silently do nothing.
const GRID_ONLY_FIELD_IDS = ['line-colour', 'line-opacity'];
const CIRCLE_ONLY_FIELD_IDS = ['circle-radius', 'circle-style-outline', 'circle-style-filled', 'circle-colour', 'circle-opacity'];

// Rows/Columns are different: they position BOTH the grid lines (while
// Grid is enabled) AND the circle intersections (while Circles is enabled,
// independent of Grid - drawGridOverlay's circle loop reads gridRows/
// gridColumns inside its own `if (options.renderCircle)` branch, not
// gated on renderGrid at all). Only disable them once *neither* section
// would use them.
const GRID_DIMENSION_FIELD_IDS = ['grid-rows', 'grid-columns'];

function syncDependentFieldsEnabled() {

    const gridEnabled = document.getElementById('render-grid').checked;
    const circleEnabled = document.getElementById('render-circle').checked;

    setFieldsEnabled(GRID_DIMENSION_FIELD_IDS, gridEnabled || circleEnabled);
    setSectionFieldsEnabled(GRID_ONLY_FIELD_IDS, 'line-colour-quick', gridEnabled);
    setSectionFieldsEnabled(CIRCLE_ONLY_FIELD_IDS, 'circle-colour-quick', circleEnabled);
}

function setFieldsEnabled(fieldIds, enabled) {

    fieldIds.forEach(id => { document.getElementById(id).disabled = !enabled; });
}

function setSectionFieldsEnabled(fieldIds, quickSwatchGroupId, enabled) {

    setFieldsEnabled(fieldIds, enabled);
    document.querySelectorAll('#' + quickSwatchGroupId + ' .quick-swatch').forEach(button => { button.disabled = !enabled; });
}

// Each thumbnail is a clickable preview of one direction/starting-point
// combination - drawn once since they don't depend on saved options, only
// on the fixed direction/start pair baked into their data attributes.
function drawGoldenRatioThumbnails() {

    document.querySelectorAll('.golden-ratio-thumb').forEach(button => {
        const canvas = button.querySelector('canvas');
        const ctx = canvas.getContext('2d');

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#666';
        traceGoldenSpiralPath(ctx, canvas.width, canvas.height, button.dataset.direction, button.dataset.start);
        ctx.stroke();
    });
}

// Highlights whichever thumbnail matches the current direction/starting-
// point radios, whether they were just set by a thumbnail click or the
// radios themselves. aria-pressed carries that same state to assistive
// tech - the border-colour highlight alone is only visible, not exposed.
function syncGoldenRatioThumbnailSelection() {

    const direction = getSelectedOption('golden-ratio-direction');
    const start = getSelectedOption('golden-ratio-start');

    document.querySelectorAll('.golden-ratio-thumb').forEach(button => {
        const selected = button.dataset.direction === direction && button.dataset.start === start;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', selected);
    });
}

// Every overlay style's settings are mutually exclusive - only the active
// style's are shown, though all of them remain saved in storage so
// switching back and forth doesn't lose any style's configuration. Each row
// declares which style(s) it belongs to via data-overlay-styles (a
// space-separated list, since eg Circles/Customise belong to both Grid and
// Phi Grid) - adding another overlay style later just means adding that
// value to whichever rows need it, not a new branch here.
function syncOverlayStyleVisibility() {

    const overlayStyle = getSelectedOption('overlay-style');

    document.querySelectorAll('[data-overlay-styles]').forEach(row => {
        const styles = row.dataset.overlayStyles.split(' ');
        row.style.display = styles.includes(overlayStyle) ? '' : 'none';
    });

    syncGridPhiGridColumnWidths(overlayStyle);
}

// Phi Grid's own content (the Ratio row, its help text and "Restore
// Default Ratio" button) needs more room than Grid's plain Rows/Columns
// fields, so the shared Grid/Circles row's column split widens for it -
// Grid's own split is untouched. One more entry here, not a new branch,
// if a future weighted-grid style needs its own split too.
const GRID_PHI_GRID_COLUMN_WIDTHS = {
    grid: {left: 'm3', right: 'm9'},
    'phi-grid': {left: 'm4', right: 'm8'}
};

function syncGridPhiGridColumnWidths(overlayStyle) {

    const widths = GRID_PHI_GRID_COLUMN_WIDTHS[overlayStyle];
    if (!widths) {
        return;
    }

    const left = document.getElementById('grid-phi-grid-columns-left');
    const right = document.getElementById('grid-phi-grid-columns-right');

    Object.values(GRID_PHI_GRID_COLUMN_WIDTHS).forEach(other => {
        left.classList.remove(other.left);
        right.classList.remove(other.right);
    });
    left.classList.add(widths.left);
    right.classList.add(widths.right);
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
// An actionable toast (eg "Undo") stays up longer, so there's a realistic
// chance to click it before it's gone.
const TOAST_ACTION_DISPLAY_MS = 6000;

// `action`, if given, is {label, onClick} - eg restoreDefaultOptions's
// Undo button.
function showToast(message, action) {

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

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    let dismissTimeoutId;

    function dismiss() {
        clearTimeout(dismissTimeoutId);
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), {once: true});
    }

    if (action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'toast-action';
        button.textContent = action.label;
        button.addEventListener('click', () => {
            action.onClick();
            dismiss();
        });
        toast.appendChild(button);
    }

    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    dismissTimeoutId = setTimeout(dismiss, action ? TOAST_ACTION_DISPLAY_MS : TOAST_DISPLAY_MS);
}

// Reads a number input, clamping it to `min` and falling back to `fallback`
// when the field is blank or not a number, then reflects the corrected
// value back into the field so the UI never shows an unsaved bad value.
function parseValidInt(elementId, min, fallback, max) {

    const element = document.getElementById(elementId);
    const value = clampInt(element.value, min, fallback, max);

    element.value = value;
    return value;
}

// Pure clamping logic, split out from parseValidInt so it can be unit
// tested without a DOM (see /test).
function clampInt(value, min, fallback, max = Infinity) {

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : Math.min(Math.max(parsed, min), max);
}

// Same contract as parseValidInt/clampInt, but for the Phi Grid ratio
// fields - a decimal (eg 0.618), not a whole number, so parseInt would
// truncate it to 0. `decimals`, if given, rounds the result (see
// roundTo) - the field is left showing that rounded value, not whatever
// extra precision was typed.
function parseValidFloat(elementId, min, fallback, decimals) {

    const element = document.getElementById(elementId);
    const value = clampFloat(element.value, min, fallback, decimals);

    element.value = value;
    return value;
}

function clampFloat(value, min, fallback, decimals) {

    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
        return fallback;
    }
    const clamped = Math.max(parsed, min);
    return decimals === undefined ? clamped : roundTo(clamped, decimals);
}

// Rounds to at most `decimals` places without padding trailing zeros - eg
// roundTo(1, 3) is 1, not 1.000, since the result is a plain number and
// JS's own number-to-string conversion (assigning it to an <input>'s
// .value, or String(...)) never adds them back.
function roundTo(value, decimals) {

    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

// Reads/writes the three Phi Grid ratio fields as one array, in the same
// order they're declared in options.html (outer, middle, outer).
function readPhiRatio() {

    return PHI_RATIO_INPUT_IDS.map((id, index) => parseValidFloat(id, MIN_PHI_RATIO, DEFAULT_OPTIONS.phiRatio[index], PHI_RATIO_DECIMALS));
}

function writePhiRatio(ratio) {

    PHI_RATIO_INPUT_IDS.forEach((id, index) => { document.getElementById(id).value = roundTo(ratio[index], PHI_RATIO_DECIMALS); });
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

// A background derived from the configured colours (average, then
// inverted to get a contrasting complement) so the preview stays
// visible without needing a colour picker of its own. Only colours that are
// actually enabled feed into it - a disabled line/circle's colour never
// renders anywhere, so it shouldn't be able to tint the background either.
// With neither enabled there's nothing on the canvas to contrast with, so
// it just falls back to plain white.
function computePreviewBackground(lineColour, circleColour, renderGrid, renderCircle) {

    const activeColours = [];
    if (renderGrid) {
        activeColours.push(parseHexColour(lineColour));
    }
    if (renderCircle) {
        activeColours.push(parseHexColour(circleColour));
    }

    if (activeColours.length === 0) {
        return '#ffffff';
    }

    const channels = ['r', 'g', 'b'].map(channel => {
        const sum = activeColours.reduce((total, colour) => total + colour[channel], 0);
        const average = Math.round(sum / activeColours.length);
        const complement = 255 - average;
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

// The full set of "live" (not-yet-saved) options, read straight from the
// form plus the customise-only line/circle states - a superset covering
// every overlay style's own fields (Grid's, Phi Grid's, and the ones they
// share), so it can be handed to whichever style's draw function is
// currently active without the caller needing to build a different shape
// per style.
function buildLiveGridCustomiseOptions() {

    return {
        renderGrid: document.getElementById('render-grid').checked,
        gridRows: clampInt(document.getElementById('grid-rows').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows, MAX_GRID_LINES),
        gridColumns: clampInt(document.getElementById('grid-columns').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridColumns, MAX_GRID_LINES),
        gridRowLines: gridRowLineStates,
        gridColumnLines: gridColumnLineStates,
        renderPhiGrid: document.getElementById('render-phi-grid').checked,
        phiRatio: readPhiRatio(),
        phiRowLines: phiRowLineStates,
        phiColumnLines: phiColumnLineStates,
        phiCircleLines: phiCircleLineStates,
        lineColour: document.getElementById('line-colour').value,
        lineOpacity: clampInt(document.getElementById('line-opacity').value, MIN_OPACITY, DEFAULT_OPTIONS.lineOpacity),
        renderCircle: document.getElementById('render-circle').checked,
        circleColour: document.getElementById('circle-colour').value,
        circleOpacity: clampInt(document.getElementById('circle-opacity').value, MIN_OPACITY, DEFAULT_OPTIONS.circleOpacity),
        circleRadius: clampInt(document.getElementById('circle-radius').value, MIN_CIRCLE_RADIUS, DEFAULT_OPTIONS.circleRadius),
        circleStyle: getSelectedOption('circle-style', DEFAULT_OPTIONS.circleStyle),
        circleLines: circleLineStates,
        previewBackgroundImage: document.getElementById('preview-background-image').checked
    };
}

// Grid and Phi Grid are both "weighted grid" overlay styles: same circles/
// Customise machinery, just different row/column weights and their own
// independent line/circle visibility (see the module state above). Every
// Customise function goes through this instead of checking the overlay
// style itself, so adding a third weighted-grid style later means adding
// one more entry here, not a new branch scattered through rendering,
// hit-testing and keyboard navigation.
function weightedGridStyles(liveOptions) {

    return {
        grid: {
            rowWeights: new Array(liveOptions.gridRows).fill(1),
            columnWeights: new Array(liveOptions.gridColumns).fill(1),
            linesEnabled: liveOptions.renderGrid,
            rowLineStates: gridRowLineStates,
            columnLineStates: gridColumnLineStates,
            circleLineStates: circleLineStates,
            drawOverlay: drawGridOverlay
        },
        'phi-grid': {
            rowWeights: liveOptions.phiRatio,
            columnWeights: liveOptions.phiRatio,
            linesEnabled: liveOptions.renderPhiGrid,
            rowLineStates: phiRowLineStates,
            columnLineStates: phiColumnLineStates,
            circleLineStates: phiCircleLineStates,
            drawOverlay: drawPhiGridOverlay
        }
    };
}

// Only meaningful while a weighted-grid style (Grid or Phi Grid) is active -
// the Customise Control canvas is hidden (and unfocusable/unclickable) for
// any other style, so nothing calls this while eg Fibonacci Spiral is
// selected.
function currentWeightedGridStyle(liveOptions) {

    return weightedGridStyles(liveOptions)[getSelectedOption('overlay-style')];
}

// The generic "shape" every Customise function (renderGridCustomiseReference/
// findGridCustomiseTarget/listGridCustomiseTargets/drawGridCustomiseFocus)
// operates on, resolved for whichever weighted-grid style is currently
// active.
function currentCustomiseShape(liveOptions) {

    const style = currentWeightedGridStyle(liveOptions);

    return {
        rowWeights: style.rowWeights,
        columnWeights: style.columnWeights,
        linesEnabled: style.linesEnabled,
        rowLines: style.rowLineStates,
        columnLines: style.columnLineStates,
        circlesEnabled: liveOptions.renderCircle,
        circleLines: style.circleLineStates,
        circleRadius: liveOptions.circleRadius
    };
}

// Local duplicate of grid-render.js's weight math (see its own comments for
// the rationale) - kept self-contained, like every other file in this
// extension, so these stay directly unit-testable via a plain
// `require('../WebContent/options/options.js')` without also needing
// grid-render.js's browser-global side of things.
function weightedLinePositions(weights) {

    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const positions = [];
    let cumulative = 0;
    for (let ii = 0; ii < weights.length - 1; ii++) {
        cumulative += weights[ii];
        positions.push(cumulative / total);
    }
    return positions;
}

function smallestWeightedBand(weights) {

    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return Math.min(...weights) / total;
}

// The greyscale photo used as an optional Preview background - loaded once
// and reused on every redraw. Falls back to the plain computed background
// colour until it's finished loading (or if it's switched off/fails).
const PREVIEW_PHOTO_SRC = 'preview-background.webp';
let previewPhotoImage = null;
let previewPhotoLoaded = false;

function loadPreviewPhoto() {

    const image = new Image();
    image.onload = () => {
        previewPhotoLoaded = true;
        renderGridCustomisePreview();
    };
    // previewPhotoLoaded simply never becomes true on failure, so the
    // preview already falls back to a plain colour fill (see
    // drawPreviewBackground) - this is just so a failure is discoverable
    // in devtools instead of silently leaving the toggle looking broken.
    image.onerror = () => {
        console.warn('Rule of Thirds: failed to load the Customise preview background photo (' + PREVIEW_PHOTO_SRC + ')');
    };
    image.src = PREVIEW_PHOTO_SRC;
    previewPhotoImage = image;
}

// Fills the Preview canvas's background: either the plain computed colour,
// or (when enabled and loaded) that same colour multiplied over the
// greyscale photo, which tints it to match without needing a colour picker
// of its own - white areas of the photo take the full computed colour,
// black areas stay black, since multiply can only ever darken.
function drawPreviewBackground(ctx, w, h, options, image) {

    const backgroundColour = computePreviewBackground(options.lineColour, options.circleColour, options.renderGrid, options.renderCircle);

    if (options.previewBackgroundImage && image) {
        ctx.drawImage(image, 0, 0, w, h);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = backgroundColour;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
    } else {
        ctx.fillStyle = backgroundColour;
        ctx.fillRect(0, 0, w, h);
    }
}

// Redraws both "Customise" canvases - called whenever anything they depend
// on changes (on load, on a form change, or on a click in the control
// canvas).
//
// "Preview" is a faithful, accurate-colour render: a hidden line or circle
// is simply never drawn, exactly like the real overlay - it gives no clue
// by itself that it could be turned back on, and isn't interactive.
// "Control" exists purely to supply that clue (and the interactivity): a
// fixed white/black/grey reference map, drawn the same way regardless of
// the user's actual colours, so there's always an obvious, unambiguous spot
// to click.
function renderGridCustomisePreview() {

    const liveOptions = buildLiveGridCustomiseOptions();
    const style = currentWeightedGridStyle(liveOptions);
    if (!style) {
        // Customise (the Preview/Hide-Show canvases) only applies to
        // weighted-grid styles (Grid, Phi Grid) - its whole row is hidden
        // for any other style (eg Fibonacci Spiral, which has no per-line
        // state for currentWeightedGridStyle to resolve), so there's
        // nothing to draw.
        return;
    }

    // setTransform() (not scale()) since this function redraws the same
    // two persistent canvases repeatedly over the page's lifetime -
    // scale() would compound on every call instead of just re-applying
    // the same devicePixelRatio each time.
    const dpr = window.devicePixelRatio || 1;

    const previewCanvas = document.getElementById('grid-customise-preview');
    const previewCtx = previewCanvas.getContext('2d');
    const previewSize = getCanvasLogicalSize(previewCanvas);
    previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawPreviewBackground(previewCtx, previewSize.width, previewSize.height, {
        previewBackgroundImage: liveOptions.previewBackgroundImage,
        lineColour: liveOptions.lineColour,
        circleColour: liveOptions.circleColour,
        renderGrid: style.linesEnabled,
        renderCircle: liveOptions.renderCircle
    }, previewPhotoLoaded ? previewPhotoImage : null);
    style.drawOverlay(previewCtx, previewSize.width, previewSize.height, liveOptions);

    const controlCanvas = document.getElementById('grid-customise-control');
    const controlCtx = controlCanvas.getContext('2d');
    const controlSize = getCanvasLogicalSize(controlCanvas);
    controlCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shape = currentCustomiseShape(liveOptions);
    renderGridCustomiseReference(controlCtx, controlSize.width, controlSize.height, shape);

    if (document.activeElement === controlCanvas) {
        const targets = listGridCustomiseTargets(shape);
        if (targets.length > 0) {
            customiseFocusIndex = Math.min(customiseFocusIndex, targets.length - 1);
            drawGridCustomiseFocus(controlCtx, controlSize.width, controlSize.height, shape, targets[customiseFocusIndex]);
        }
    }
}

// "Control" is a fixed 200x200 square, kept side by side with "Preview" -
// which then claims whatever width is left in the row, up to its native
// photo resolution (1080 wide) so it's never upscaled blurry. Both canvases
// get their width/height *attributes* (not just CSS) set to match, so the
// actual pixel backing store stays crisp as the window resizes rather than
// being CSS-stretched. Re-run on load and on every resize of the row
// itself (see the ResizeObserver setup below).
const CONTROL_SIZE = 200;
const PREVIEW_MAX_WIDTH = 1080;
const PREVIEW_ASPECT_RATIO = 240 / 360;

// A small buffer subtracted from the row budget below, so the two widths
// never sum to *exactly* the row's available width - which is fragile to
// the sub-pixel rounding clientWidth/getComputedStyle can introduce, and
// would wrap Control onto its own line despite technically fitting.
const LAYOUT_SAFETY_MARGIN = 4;

// Below this, sharing the row with Control's fixed 200px would squeeze
// Preview into a barely-useful sliver well before anything looks visually
// "broken" - stack Control above Preview instead once side-by-side would
// leave Preview narrower than this.
const MIN_SIDE_BY_SIDE_PREVIEW_WIDTH = 200;

function layoutGridCustomiseCanvases() {

    const col = document.getElementById('grid-customise-col');
    const colStyle = getComputedStyle(col);
    const gap = parseFloat(colStyle.columnGap) || 0;
    // clientWidth includes this element's own left/right padding (it's a
    // ".col", which has some) - that padding isn't space available to lay
    // the two canvases out in, so it has to come off too.
    const paddingX = parseFloat(colStyle.paddingLeft) + parseFloat(colStyle.paddingRight);
    const availableWidth = col.clientWidth - paddingX;

    const sideBySidePreviewWidth = availableWidth - CONTROL_SIZE - gap - LAYOUT_SAFETY_MARGIN;
    const stacked = sideBySidePreviewWidth < MIN_SIDE_BY_SIDE_PREVIEW_WIDTH;
    col.classList.toggle('grid-customise-col-stacked', stacked);

    const previewWidth = Math.max(1, Math.min(stacked ? availableWidth : sideBySidePreviewWidth, PREVIEW_MAX_WIDTH));
    const previewHeight = Math.round(previewWidth * PREVIEW_ASPECT_RATIO);

    setCanvasSize('grid-customise-preview', previewWidth, previewHeight);
    setCanvasSize('grid-customise-control', CONTROL_SIZE, CONTROL_SIZE);

    // Both panels start at the same top edge (see .grid-customise-col's
    // align-items:flex-start) - nudge Control's panel down by half the
    // height difference so its canvas lands centred against Preview's,
    // which CSS alone can't do now Preview's own panel is taller (it has
    // the photo toggle under its canvas that Control's doesn't). Not
    // needed when stacked - they're no longer side by side, so there's no
    // vertical alignment between them to correct for.
    const controlPanel = document.getElementById('grid-customise-control').closest('.grid-customise-panel');
    controlPanel.style.marginTop = stacked ? '' : Math.max(0, (previewHeight - CONTROL_SIZE) / 2) + 'px';

    renderGridCustomisePreview();
}

function setCanvasSize(canvasId, width, height) {

    const canvas = document.getElementById(canvasId);
    const dpr = window.devicePixelRatio || 1;

    // Backing store at devicePixelRatio for a crisp result on HiDPI/zoomed
    // displays - width/height stay the logical size everywhere else (see
    // getCanvasLogicalSize(), read back from style.width/height below,
    // since canvas.width/height themselves are now the scaled-up backing
    // store, not something render code should compute against directly).
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    // Without an explicit CSS size, a canvas's box is its bitmap resolution
    // *plus* its border on top (border-box only reinterprets an explicit
    // width/height, and there isn't one here otherwise) - enough to tip the
    // row a few pixels over budget and wrap when the numbers are meant to
    // add up exactly. Setting these too keeps the border inside the box.
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
}

// Recovers the logical (CSS-pixel) size set by setCanvasSize() - needed
// since canvas.width/height are now the devicePixelRatio-scaled backing
// store, not the size any drawing code should actually compute against.
function getCanvasLogicalSize(canvas) {

    return {
        width: parseInt(canvas.style.width, 10),
        height: parseInt(canvas.style.height, 10)
    };
}

const GRID_CUSTOMISE_REFERENCE_ENABLED_COLOUR = '#000000';
// #b0b0b0 on white was only ~2.2:1 contrast, under WCAG 1.4.11's 3:1
// minimum for this UI component - #787878 gets ~4.4:1, comfortably clear
// of it, while staying visibly lighter than the enabled colour.
const GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR = '#787878';

// Draws every line/circle position a weighted-grid `shape` (see
// currentCustomiseShape) could have, in black when it's enabled and grey
// when it's not - a permanently legible map of what's clickable,
// independent of whatever colours the user has actually chosen. A
// line/circle whose axis is disabled overall (linesEnabled/circlesEnabled)
// is left off entirely, same as the real preview: there's nothing to
// un-hide if the master toggle for it is off.
function renderGridCustomiseReference(ctx, w, h, shape) {

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;

    const rowPositions = weightedLinePositions(shape.rowWeights);
    const columnPositions = weightedLinePositions(shape.columnWeights);

    if (shape.linesEnabled) {
        rowPositions.forEach((frac, index) => {
            const y = frac * h;
            ctx.strokeStyle = shape.rowLines[index] ? GRID_CUSTOMISE_REFERENCE_ENABLED_COLOUR : GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        });

        columnPositions.forEach((frac, index) => {
            const x = frac * w;
            ctx.strokeStyle = shape.columnLines[index] ? GRID_CUSTOMISE_REFERENCE_ENABLED_COLOUR : GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        });
    }

    if (shape.circlesEnabled) {
        const radius = Math.min(
            (smallestWeightedBand(shape.rowWeights) * h) / 2,
            (smallestWeightedBand(shape.columnWeights) * w) / 2,
            shape.circleRadius);

        rowPositions.forEach((cyFrac, rowIndex) => {
            if (!shape.rowLines[rowIndex]) {
                return;
            }
            columnPositions.forEach((cxFrac, columnIndex) => {
                if (!shape.columnLines[columnIndex]) {
                    return;
                }
                const enabled = shape.circleLines[rowIndex][columnIndex];
                ctx.strokeStyle = enabled ? GRID_CUSTOMISE_REFERENCE_ENABLED_COLOUR : GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR;
                ctx.beginPath();
                ctx.arc(cxFrac * w, cyFrac * h, radius, 0, 2 * Math.PI);
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
// renderGridCustomiseReference/drawWeightedGridOverlay's own rule.
function findGridCustomiseTarget(x, y, w, h, shape) {

    const rowPositions = weightedLinePositions(shape.rowWeights);
    const columnPositions = weightedLinePositions(shape.columnWeights);

    if (shape.circlesEnabled) {
        for (let columnIndex = 0; columnIndex < columnPositions.length; columnIndex++) {
            if (!shape.columnLines[columnIndex]) {
                continue;
            }
            for (let rowIndex = 0; rowIndex < rowPositions.length; rowIndex++) {
                if (!shape.rowLines[rowIndex]) {
                    continue;
                }
                const cx = columnPositions[columnIndex] * w;
                const cy = rowPositions[rowIndex] * h;
                if (Math.hypot(x - cx, y - cy) <= GRID_CUSTOMISE_CIRCLE_HIT_TOLERANCE) {
                    return {type: 'circle', row: rowIndex, column: columnIndex};
                }
            }
        }
    }

    if (shape.linesEnabled) {
        for (let rowIndex = 0; rowIndex < rowPositions.length; rowIndex++) {
            const ly = rowPositions[rowIndex] * h;
            if (Math.abs(y - ly) <= GRID_CUSTOMISE_LINE_HIT_TOLERANCE) {
                return {type: 'row', index: rowIndex};
            }
        }
        for (let columnIndex = 0; columnIndex < columnPositions.length; columnIndex++) {
            const lx = columnPositions[columnIndex] * w;
            if (Math.abs(x - lx) <= GRID_CUSTOMISE_LINE_HIT_TOLERANCE) {
                return {type: 'column', index: columnIndex};
            }
        }
    }

    return null;
}

// Enumerates every line/circle the Control canvas can currently toggle, in
// the same reading order (rows, then columns, then circles) and the same
// eligibility rules as findGridCustomiseTarget (a circle only counts once
// both of its crossing lines are enabled) - drives keyboard navigation,
// since a canvas has no DOM children of its own to tab between.
function listGridCustomiseTargets(shape) {

    const targets = [];

    if (shape.linesEnabled) {
        shape.rowLines.forEach((enabled, index) => {
            targets.push({type: 'row', index, enabled, label: 'Row line ' + (index + 1)});
        });
        shape.columnLines.forEach((enabled, index) => {
            targets.push({type: 'column', index, enabled, label: 'Column line ' + (index + 1)});
        });
    }

    if (shape.circlesEnabled) {
        shape.rowLines.forEach((rowEnabled, rowIndex) => {
            if (!rowEnabled) {
                return;
            }
            shape.columnLines.forEach((columnEnabled, columnIndex) => {
                if (!columnEnabled) {
                    return;
                }
                targets.push({
                    type: 'circle', row: rowIndex, column: columnIndex,
                    enabled: shape.circleLines[rowIndex][columnIndex],
                    label: 'Circle at row ' + (rowIndex + 1) + ', column ' + (columnIndex + 1)
                });
            });
        });
    }

    return targets;
}

// Shared by the click handler and the keyboard Enter/Space handler - the
// same toggle findGridCustomiseTarget's and listGridCustomiseTargets'
// results both feed into. Mutates whichever style's state arrays are
// currently active (see currentWeightedGridStyle) in place, rather than
// hardcoding Grid's, so this keeps working unmodified as more weighted-grid
// styles are added.
function toggleGridCustomiseTarget(target, rowLineStates, columnLineStates, circleLineStates) {

    if (target.type === 'row') {
        rowLineStates[target.index] = !rowLineStates[target.index];
    } else if (target.type === 'column') {
        columnLineStates[target.index] = !columnLineStates[target.index];
    } else {
        circleLineStates[target.row][target.column] = !circleLineStates[target.row][target.column];
    }
}

const GRID_CUSTOMISE_FOCUS_COLOUR = '#26a69a'; // matches --color-primary in css/style.css

const GRID_CUSTOMISE_FOCUS_MARKER_SIZE = 10;

// Draws the Control canvas's only visible focus indicator - a canvas gets
// no native browser focus ring of its own the way a real form control
// would. A row/column line gets a small chevron at the canvas edge instead
// of a highlight traced along its whole length, so the line's own black/
// grey colour - its actual shown/hidden state - stays fully visible rather
// than being painted over; a circle gets a ring drawn around it instead of
// over it, for the same reason.
function drawGridCustomiseFocus(ctx, w, h, shape, target) {

    if (!target) {
        return;
    }

    const rowPositions = weightedLinePositions(shape.rowWeights);
    const columnPositions = weightedLinePositions(shape.columnWeights);

    const marker = GRID_CUSTOMISE_FOCUS_MARKER_SIZE;
    ctx.strokeStyle = GRID_CUSTOMISE_FOCUS_COLOUR;
    ctx.lineWidth = 3;
    ctx.beginPath();

    if (target.type === 'row') {
        const y = rowPositions[target.index] * h;
        ctx.moveTo(marker, y - marker);
        ctx.lineTo(0, y);
        ctx.lineTo(marker, y + marker);
    } else if (target.type === 'column') {
        const x = columnPositions[target.index] * w;
        ctx.moveTo(x - marker, marker);
        ctx.lineTo(x, 0);
        ctx.lineTo(x + marker, marker);
    } else {
        const radius = Math.min(
            (smallestWeightedBand(shape.rowWeights) * h) / 2,
            (smallestWeightedBand(shape.columnWeights) * w) / 2,
            shape.circleRadius) + 4;
        const x = columnPositions[target.column] * w;
        const y = rowPositions[target.row] * h;
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
    }

    ctx.stroke();
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

// Only "Control" is interactive - "Preview" is purely informational, since
// a hidden circle draws nothing there for the user to aim at (see
// onGridCustomiseHover for the pointer feedback that keeps Control itself
// unambiguous to click).
function onGridCustomiseClick(event) {

    const canvas = event.currentTarget;
    const {x, y} = gridCustomiseEventPosition(event);
    const liveOptions = buildLiveGridCustomiseOptions();
    const style = currentWeightedGridStyle(liveOptions);
    const shape = currentCustomiseShape(liveOptions);

    const target = findGridCustomiseTarget(x, y, canvas.width, canvas.height, shape);
    if (!target) {
        return;
    }

    toggleGridCustomiseTarget(target, style.rowLineStates, style.columnLineStates, style.circleLineStates);

    // Keeps keyboard focus in step with the mouse, so switching to the
    // keyboard afterwards continues from the line/circle just clicked
    // rather than wherever the focus ring last was.
    const targets = listGridCustomiseTargets(currentCustomiseShape(buildLiveGridCustomiseOptions()));
    const clickedIndex = targets.findIndex(candidate =>
        candidate.type === target.type && candidate.index === target.index &&
        candidate.row === target.row && candidate.column === target.column);
    if (clickedIndex !== -1) {
        customiseFocusIndex = clickedIndex;
    }

    renderGridCustomisePreview();
    saveOptions();
}

// Index into listGridCustomiseTargets() of the line/circle keyboard focus
// currently sits on - clamped defensively wherever it's read, since Rows/
// Columns can change the target list's length at any time.
let customiseFocusIndex = 0;

const GRID_CUSTOMISE_NAVIGATION_KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End', 'Enter', ' '];

function onGridCustomiseKeyDown(event) {

    if (!GRID_CUSTOMISE_NAVIGATION_KEYS.includes(event.key)) {
        return;
    }

    const liveOptions = buildLiveGridCustomiseOptions();
    const style = currentWeightedGridStyle(liveOptions);
    const targets = listGridCustomiseTargets(currentCustomiseShape(liveOptions));
    if (targets.length === 0) {
        return;
    }
    event.preventDefault();
    customiseFocusIndex = Math.min(customiseFocusIndex, targets.length - 1);

    switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
            customiseFocusIndex = (customiseFocusIndex + 1) % targets.length;
            break;
        case 'ArrowLeft':
        case 'ArrowUp':
            customiseFocusIndex = (customiseFocusIndex - 1 + targets.length) % targets.length;
            break;
        case 'Home':
            customiseFocusIndex = 0;
            break;
        case 'End':
            customiseFocusIndex = targets.length - 1;
            break;
        case 'Enter':
        case ' ':
            toggleGridCustomiseTarget(targets[customiseFocusIndex], style.rowLineStates, style.columnLineStates, style.circleLineStates);
            saveOptions();
            break;
    }

    renderGridCustomisePreview();
    announceGridCustomiseFocus(listGridCustomiseTargets(currentCustomiseShape(buildLiveGridCustomiseOptions()))[customiseFocusIndex]);
}

// The Control canvas has no DOM children a screen reader can read, so its
// current keyboard-selected line/circle - and whether toggling it would
// show or hide it - is announced through this live region instead.
function announceGridCustomiseFocus(target) {

    const liveRegion = document.getElementById('grid-customise-status');
    if (liveRegion && target) {
        liveRegion.textContent = target.label + ': ' + (target.enabled ? 'shown' : 'hidden') + '. Press Enter or Space to toggle.';
    }
}

// Switches the cursor to a pointer only while actually hovering a line or
// circle, so the canvas doesn't look uniformly clickable when most of it
// isn't a valid target.
function onGridCustomiseHover(event) {

    const canvas = event.currentTarget;
    const {x, y} = gridCustomiseEventPosition(event);

    const target = findGridCustomiseTarget(x, y, canvas.width, canvas.height, currentCustomiseShape(buildLiveGridCustomiseOptions()));
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

// Falls back rather than throwing when nothing in the group is checked yet
// - the static HTML marks no radio `checked` by default, so this can
// briefly be true if a render is triggered (eg by the background photo's
// `onload`, or ResizeObserver's own first callback) before
// chrome.storage.sync.get resolves and setOptions() has run.
function getSelectedOption(elementName, fallback) {

    const checked = document.querySelector('input[name="' + elementName + '"]:checked');
    return checked ? checked.value : fallback;
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

    const gridCustomiseControl = document.getElementById('grid-customise-control');
    gridCustomiseControl.addEventListener('click', onGridCustomiseClick);
    gridCustomiseControl.addEventListener('mousemove', onGridCustomiseHover);
    gridCustomiseControl.addEventListener('mouseleave', () => { gridCustomiseControl.style.cursor = 'default'; });
    gridCustomiseControl.addEventListener('keydown', onGridCustomiseKeyDown);
    gridCustomiseControl.addEventListener('focus', () => {
        const targets = listGridCustomiseTargets(currentCustomiseShape(buildLiveGridCustomiseOptions()));
        if (targets.length === 0) {
            return;
        }
        customiseFocusIndex = Math.min(customiseFocusIndex, targets.length - 1);
        renderGridCustomisePreview();
        announceGridCustomiseFocus(targets[customiseFocusIndex]);
    });
    // Re-renders on blur too, purely to erase the focus ring - it has no
    // reason to still show once keyboard focus has left the canvas.
    gridCustomiseControl.addEventListener('blur', () => renderGridCustomisePreview());

    document.querySelectorAll('.quick-swatch').forEach(swatch => swatch.addEventListener('click', () => {
        const colourInputId = swatch.closest('.quick-swatch-group').dataset.for;
        document.getElementById(colourInputId).value = swatch.dataset.value;
        syncQuickPickSelection(colourInputId);
        saveOptions();
    }));

    document.getElementById('restoreDefaults').addEventListener('click', restoreDefaultOptions);
    document.getElementById('restorePhiRatioDefaults').addEventListener('click', restorePhiRatioDefaults);

    loadPreviewPhoto();

    // ResizeObserver rather than a plain window 'resize' listener, since
    // what actually matters is the row's own width - which can also change
    // from things a window resize wouldn't catch (eg a scrollbar appearing).
    new ResizeObserver(() => layoutGridCustomiseCanvases()).observe(document.getElementById('grid-customise-col'));

    document.querySelectorAll('input[name="overlay-style"]').forEach(input => input.addEventListener('change', syncOverlayStyleVisibility));

    drawGoldenRatioThumbnails();

    document.querySelectorAll('input[name="golden-ratio-direction"], input[name="golden-ratio-start"]').forEach(input => input.addEventListener('change', syncGoldenRatioThumbnailSelection));

    document.querySelectorAll('.golden-ratio-thumb').forEach(button => button.addEventListener('click', () => {
        selectOption('golden-ratio-direction', button.dataset.direction);
        selectOption('golden-ratio-start', button.dataset.start);
        syncGoldenRatioThumbnailSelection();
        saveOptions();
    }));
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_OPTIONS, MIN_GRID_LINES, MAX_GRID_LINES, MIN_CIRCLE_RADIUS, MIN_PHI_RATIO, PHI_RATIO_DECIMALS, clampInt, clampFloat, roundTo, minGridLines, computeGridLineMinimums,
        resizeLineStates, resetLineStates, resizeCircleStates, resetCircleStates,
        weightedLinePositions, smallestWeightedBand,
        computePreviewBackground, findGridCustomiseTarget, renderGridCustomiseReference, drawPreviewBackground,
        listGridCustomiseTargets, drawGridCustomiseFocus
    };
}
