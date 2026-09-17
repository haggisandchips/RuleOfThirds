const DEFAULT_OPTIONS = {
    renderGrid: 'enabled',
    gridRows: 3,
    gridColumns: 3,
    lineColour: '#000',
    renderCircle: 'enabled',
    circleColour: '#f00',
    circleRadius: 5
};

const MIN_GRID_LINES = 1;
const MIN_CIRCLE_RADIUS = 1;

// Restores options from chrome.storage
const loadOptions = () => {

    chrome.storage.sync.get(
        DEFAULT_OPTIONS,
        (options) => setOptions(options)
    );
};

// Saves options to chrome.storage
const saveOptions = (event) => {

    const renderGrid = getSelectedOption('render-grid');

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

    const lineColour = getSelectedOption('line-colour');
    const renderCircle = getSelectedOption('render-circle');
    const circleColour = getSelectedOption('circle-colour');
    const circleRadius = parseValidInt('circle-radius', MIN_CIRCLE_RADIUS, DEFAULT_OPTIONS.circleRadius);

    chrome.storage.sync.set(
        {
            renderGrid,
            gridRows,
            gridColumns,
            lineColour,
            renderCircle,
            circleColour,
            circleRadius
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

    selectOption('render-grid', options.renderGrid);
    document.getElementById('grid-rows').value = options.gridRows;
    document.getElementById('grid-columns').value = options.gridColumns;
    selectOption('line-colour', options.lineColour);
    selectOption('render-circle', options.renderCircle);
    selectOption('circle-colour', options.circleColour);
    document.getElementById('circle-radius').value = options.circleRadius;
}

const TOAST_DISPLAY_MS = 2000;

function showToast(message) {

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

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
    document.getElementById('restoreDefaults').addEventListener('click', restoreDefaultOptions);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {DEFAULT_OPTIONS, MIN_GRID_LINES, MIN_CIRCLE_RADIUS, clampInt, minGridLines, computeGridLineMinimums};
}
