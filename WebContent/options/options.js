const DEFAULT_OPTIONS = {
    renderGrid: true,
    gridRows: 3,
    gridColumns: 3,
    lineColour: '#ffffff',
    lineOpacity: 100,
    renderCircle: true,
    circleColour: '#ff0000',
    circleOpacity: 100,
    circleRadius: 5,
    circleStyle: 'outline'
};

const MIN_GRID_LINES = 1;
const MIN_CIRCLE_RADIUS = 1;
const MIN_OPACITY = 0;

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
            lineColour,
            lineOpacity,
            renderCircle,
            circleColour,
            circleOpacity,
            circleRadius,
            circleStyle
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

    document.querySelectorAll('.quick-swatch').forEach(swatch => swatch.addEventListener('click', () => {
        const colourInputId = swatch.closest('.quick-swatch-group').dataset.for;
        document.getElementById(colourInputId).value = swatch.dataset.value;
        syncQuickPickSelection(colourInputId);
        saveOptions();
    }));

    document.getElementById('restoreDefaults').addEventListener('click', restoreDefaultOptions);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {DEFAULT_OPTIONS, MIN_GRID_LINES, MIN_CIRCLE_RADIUS, clampInt, minGridLines, computeGridLineMinimums};
}
