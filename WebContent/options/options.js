const DEFAULT_OPTIONS = {
    renderGrid: 'enabled',
    gridRows: 3,
    gridColumns: 3,
    lineColour: '#000',
    renderCircle: 'enabled',
    circleColour: '#f00',
    circleRadius: 5
};

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
    const gridRows = document.getElementById('grid-rows').value;
    const gridColumns = document.getElementById('grid-columns').value;
    const lineColour = getSelectedOption('line-colour');
    const renderCircle = getSelectedOption('render-circle');
    const circleColour = getSelectedOption('circle-colour');
    const circleRadius = document.getElementById('circle-radius').value;

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
