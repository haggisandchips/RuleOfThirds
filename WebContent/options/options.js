const DEFAULT_OPTIONS = {
    renderGrid: 'enabled',
    gridRows: 3,
    gridColumns: 3,
    lineColour: '#000',
    renderCircle: 'enabled',
    circleColour: '#f00',
    circleRadius: 5
};

const MIN_GRID_LINES = 2;
const MIN_CIRCLE_RADIUS = 1;

// Restores options from chrome.storage
const loadOptions = () => {

    chrome.storage.sync.get(
        DEFAULT_OPTIONS,
        (options) => setOptions(options)
    );
};

// Saves options to chrome.storage
const saveOptions = () => {

    const renderGrid = getSelectedOption('render-grid');
    const gridRows = parseValidInt('grid-rows', MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows);
    const gridColumns = parseValidInt('grid-columns', MIN_GRID_LINES, DEFAULT_OPTIONS.gridColumns);
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
            M.toast({
                html: 'Options saved.',
                displayLength: 2000
            });
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

    M.updateTextFields();
}

// Reads a number input, clamping it to `min` and falling back to `fallback`
// when the field is blank or not a number, then reflects the corrected
// value back into the field so the UI never shows an unsaved bad value.
function parseValidInt(elementId, min, fallback) {

    const element = document.getElementById(elementId);
    const parsed = parseInt(element.value, 10);
    const value = Number.isNaN(parsed) ? fallback : Math.max(parsed, min);

    element.value = value;
    return value;
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

document.addEventListener('DOMContentLoaded', loadOptions);
document.querySelectorAll('input').forEach(input => input.addEventListener('change', saveOptions));
document.getElementById('restoreDefaults').addEventListener('click', restoreDefaultOptions);
