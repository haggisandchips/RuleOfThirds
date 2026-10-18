const DEFAULT_OPTIONS = {
    overlayStyle: 'grid',
    renderGrid: true,
    gridRows: 3,
    gridColumns: 3,
    gridRowLines: [true, true],
    gridColumnLines: [true, true],
    lineColour: '#ffffff',
    lineOpacity: 100,
    lineWidth: 1,
    resizeMaskOpacity: 50,
    showFlipControl: true,
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

const MAX_GRID_LINES = 9;
const MIN_CIRCLE_RADIUS = 1;
const MIN_LINE_WIDTH = 1;

const MAX_LINE_WIDTH = 9;
const MIN_OPACITY = 0;
const MIN_IMAGE_SIZE = 1;

const PHI_GRID_BAND_COUNT = 3;
const PHI_RATIO_INPUT_IDS = ['phi-ratio-1', 'phi-ratio-2', 'phi-ratio-3'];
const MIN_PHI_RATIO = 0.01;

const MAX_PHI_RATIO = 100;
const PHI_RATIO_DECIMALS = 3;

const PHI_RATIO_PREVIEW_DEBOUNCE_MS = 150;

let gridRowLineStates = DEFAULT_OPTIONS.gridRowLines.slice();
let gridColumnLineStates = DEFAULT_OPTIONS.gridColumnLines.slice();
let circleLineStates = DEFAULT_OPTIONS.circleLines.map(row => row.slice());
let phiRowLineStates = DEFAULT_OPTIONS.phiRowLines.slice();
let phiColumnLineStates = DEFAULT_OPTIONS.phiColumnLines.slice();
let phiCircleLineStates = DEFAULT_OPTIONS.phiCircleLines.map(row => row.slice());

const loadOptions = () => {
    chrome.storage.sync.get(
        DEFAULT_OPTIONS,
        (options) => setOptions(options)
    );
};

const saveOptions = (event, successMessage = 'Options saved.', successAction) => {
    const overlayStyle = getSelectedOption('overlay-style');
    const renderGrid = document.getElementById('render-grid').checked;
    syncDependentFieldsEnabled();

    const changedElementId = event && event.target && event.target.id;
    const currentGridRows = clampInt(document.getElementById('grid-rows').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows, MAX_GRID_LINES);
    const currentGridColumns = clampInt(document.getElementById('grid-columns').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridColumns, MAX_GRID_LINES);
    const {gridRowsMin, gridColumnsMin} = computeGridLineMinimums(currentGridRows, currentGridColumns, changedElementId);

    const gridRows = parseValidInt('grid-rows', gridRowsMin, DEFAULT_OPTIONS.gridRows, MAX_GRID_LINES);
    const gridColumns = parseValidInt('grid-columns', gridColumnsMin, DEFAULT_OPTIONS.gridColumns, MAX_GRID_LINES);

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
    const lineWidth = parseValidInt('line-width', MIN_LINE_WIDTH, DEFAULT_OPTIONS.lineWidth, MAX_LINE_WIDTH);
    const resizeMaskOpacity = parseValidInt('resize-mask-opacity', MIN_OPACITY, DEFAULT_OPTIONS.resizeMaskOpacity);
    const showFlipControl = document.getElementById('show-flip-control').checked;
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
            lineWidth,
            resizeMaskOpacity,
            showFlipControl,
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
    document.getElementById('line-width').value = options.lineWidth;
    document.getElementById('resize-mask-opacity').value = options.resizeMaskOpacity;
    updateOpacityLabel('resize-mask-opacity');
    document.getElementById('show-flip-control').checked = options.showFlipControl;
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

    layoutGridCustomiseCanvases();
}

const LINE_OPTIONS_FIELD_IDS = ['line-colour', 'line-opacity', 'line-width'];
const CIRCLE_ONLY_FIELD_IDS = ['circle-radius', 'circle-style-outline', 'circle-style-filled', 'circle-colour', 'circle-opacity'];

const GRID_DIMENSION_FIELD_IDS = ['grid-rows', 'grid-columns'];

function syncDependentFieldsEnabled() {
    const gridEnabled = document.getElementById('render-grid').checked;
    const circleEnabled = document.getElementById('render-circle').checked;
    const phiGridEnabled = document.getElementById('render-phi-grid').checked;

    setFieldsEnabled(GRID_DIMENSION_FIELD_IDS, gridEnabled || circleEnabled);
    setSectionFieldsEnabled(LINE_OPTIONS_FIELD_IDS, 'line-colour-quick', gridEnabled || phiGridEnabled);
    setSectionFieldsEnabled(CIRCLE_ONLY_FIELD_IDS, 'circle-colour-quick', circleEnabled);

    setFieldsEnabled(PHI_RATIO_INPUT_IDS, phiGridEnabled || circleEnabled);
}

function setFieldsEnabled(fieldIds, enabled) {
    fieldIds.forEach(id => { document.getElementById(id).disabled = !enabled; });
}

function setSectionFieldsEnabled(fieldIds, quickSwatchGroupId, enabled) {
    setFieldsEnabled(fieldIds, enabled);
    document.querySelectorAll('#' + quickSwatchGroupId + ' .quick-swatch').forEach(button => { button.disabled = !enabled; });
}

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

function syncGoldenRatioThumbnailSelection() {
    const direction = getSelectedOption('golden-ratio-direction');
    const start = getSelectedOption('golden-ratio-start');

    document.querySelectorAll('.golden-ratio-thumb').forEach(button => {
        const selected = button.dataset.direction === direction && button.dataset.start === start;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-checked', selected);
        button.tabIndex = selected ? 0 : -1;
    });
}

const GOLDEN_RATIO_THUMB_NAVIGATION_KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];

function onGoldenRatioThumbKeyDown(event) {
    if (!GOLDEN_RATIO_THUMB_NAVIGATION_KEYS.includes(event.key)) {
        return;
    }
    event.preventDefault();

    const thumbs = Array.from(document.querySelectorAll('.golden-ratio-thumb'));
    const currentIndex = Math.max(thumbs.indexOf(event.currentTarget), 0);
    let nextIndex;

    switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
            nextIndex = (currentIndex + 1) % thumbs.length;
            break;
        case 'ArrowLeft':
        case 'ArrowUp':
            nextIndex = (currentIndex - 1 + thumbs.length) % thumbs.length;
            break;
        case 'Home':
            nextIndex = 0;
            break;
        case 'End':
            nextIndex = thumbs.length - 1;
            break;
    }

    const nextThumb = thumbs[nextIndex];
    selectOption('golden-ratio-direction', nextThumb.dataset.direction);
    selectOption('golden-ratio-start', nextThumb.dataset.start);
    syncGoldenRatioThumbnailSelection();
    nextThumb.focus();
    saveOptions();
}

function syncOverlayStyleVisibility() {
    const overlayStyle = getSelectedOption('overlay-style');

    document.querySelectorAll('[data-overlay-styles]').forEach(row => {
        const styles = row.dataset.overlayStyles.split(' ');
        row.style.display = styles.includes(overlayStyle) ? '' : 'none';
    });

    syncGridPhiGridColumnWidths(overlayStyle);
}

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

function updateOpacityLabel(opacityInputId) {
    document.getElementById(opacityInputId + '-value').textContent = document.getElementById(opacityInputId).value + '%';
}

function syncQuickPickSelection(colourInputId) {
    const value = document.getElementById(colourInputId).value;
    const quickGroup = document.getElementById(colourInputId + '-quick');

    quickGroup.querySelectorAll('.quick-swatch').forEach(swatch => {
        swatch.classList.toggle('selected', swatch.dataset.value === value);
    });
}

const TOAST_DISPLAY_MS = 2000;

const TOAST_ACTION_DISPLAY_MS = 6000;

function showToast(message, action) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

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

function parseValidInt(elementId, min, fallback, max) {
    const element = document.getElementById(elementId);
    const value = clampInt(element.value, min, fallback, max);

    element.value = value;
    return value;
}

function clampInt(value, min, fallback, max = Infinity) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : Math.min(Math.max(parsed, min), max);
}

function parseValidFloat(elementId, min, fallback, decimals, max, write = true) {
    const element = document.getElementById(elementId);
    const value = clampFloat(element.value, min, fallback, decimals, max);

    if (write) {
        element.value = value;
    }
    return value;
}

function clampFloat(value, min, fallback, decimals, max = Infinity) {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
        return fallback;
    }
    const clamped = Math.min(Math.max(parsed, min), max);
    return decimals === undefined ? clamped : roundTo(clamped, decimals);
}

function roundTo(value, decimals) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function readPhiRatio(write = true) {
    return PHI_RATIO_INPUT_IDS.map((id, index) => parseValidFloat(id, MIN_PHI_RATIO, DEFAULT_OPTIONS.phiRatio[index], PHI_RATIO_DECIMALS, MAX_PHI_RATIO, write));
}

function writePhiRatio(ratio) {
    PHI_RATIO_INPUT_IDS.forEach((id, index) => { document.getElementById(id).value = roundTo(ratio[index], PHI_RATIO_DECIMALS); });
}

function resizeLineStates(states, count) {
    const result = (Array.isArray(states) ? states : []).slice(0, count);
    while (result.length < count) {
        result.push(true);
    }
    return result;
}

function resetLineStates(count) {
    return new Array(count).fill(true);
}

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

const GRID_CUSTOMISE_BACKGROUND_WHITE_BLEND = 0.75;

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

function buildLiveGridCustomiseOptions(write = true) {
    return {
        renderGrid: document.getElementById('render-grid').checked,
        gridRows: clampInt(document.getElementById('grid-rows').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows, MAX_GRID_LINES),
        gridColumns: clampInt(document.getElementById('grid-columns').value, MIN_GRID_LINES, DEFAULT_OPTIONS.gridColumns, MAX_GRID_LINES),
        gridRowLines: gridRowLineStates,
        gridColumnLines: gridColumnLineStates,
        renderPhiGrid: document.getElementById('render-phi-grid').checked,
        phiRatio: readPhiRatio(write),
        phiRowLines: phiRowLineStates,
        phiColumnLines: phiColumnLineStates,
        phiCircleLines: phiCircleLineStates,
        lineColour: document.getElementById('line-colour').value,
        lineOpacity: clampInt(document.getElementById('line-opacity').value, MIN_OPACITY, DEFAULT_OPTIONS.lineOpacity),
        lineWidth: clampInt(document.getElementById('line-width').value, MIN_LINE_WIDTH, DEFAULT_OPTIONS.lineWidth, MAX_LINE_WIDTH),
        renderCircle: document.getElementById('render-circle').checked,
        circleColour: document.getElementById('circle-colour').value,
        circleOpacity: clampInt(document.getElementById('circle-opacity').value, MIN_OPACITY, DEFAULT_OPTIONS.circleOpacity),
        circleRadius: clampInt(document.getElementById('circle-radius').value, MIN_CIRCLE_RADIUS, DEFAULT_OPTIONS.circleRadius),
        circleStyle: getSelectedOption('circle-style', DEFAULT_OPTIONS.circleStyle),
        circleLines: circleLineStates,
        previewBackgroundImage: document.getElementById('preview-background-image').checked
    };
}

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

function currentWeightedGridStyle(liveOptions) {
    return weightedGridStyles(liveOptions)[getSelectedOption('overlay-style')];
}

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

const PREVIEW_PHOTO_SRC = 'preview-background.webp';
let previewPhotoImage = null;
let previewPhotoLoaded = false;

function loadPreviewPhoto() {
    const image = new Image();
    image.onload = () => {
        previewPhotoLoaded = true;
        renderGridCustomisePreview();
    };

    image.onerror = () => {
        console.warn('Rule of Thirds: failed to load the Customise preview background photo (' + PREVIEW_PHOTO_SRC + ')');
    };
    image.src = PREVIEW_PHOTO_SRC;
    previewPhotoImage = image;
}

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

function renderGridCustomisePreview(write = true) {
    const liveOptions = buildLiveGridCustomiseOptions(write);
    const style = currentWeightedGridStyle(liveOptions);
    if (!style) {
        return;
    }

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

const CONTROL_SIZE = 200;
const PREVIEW_MAX_WIDTH = 1080;
const PREVIEW_ASPECT_RATIO = 240 / 360;

const LAYOUT_SAFETY_MARGIN = 4;

const MIN_SIDE_BY_SIDE_PREVIEW_WIDTH = 200;

function layoutGridCustomiseCanvases() {
    const col = document.getElementById('grid-customise-col');
    const colStyle = getComputedStyle(col);
    const gap = parseFloat(colStyle.columnGap) || 0;

    const paddingX = parseFloat(colStyle.paddingLeft) + parseFloat(colStyle.paddingRight);
    const availableWidth = col.clientWidth - paddingX;

    const sideBySidePreviewWidth = availableWidth - CONTROL_SIZE - gap - LAYOUT_SAFETY_MARGIN;
    const stacked = sideBySidePreviewWidth < MIN_SIDE_BY_SIDE_PREVIEW_WIDTH;
    col.classList.toggle('grid-customise-col-stacked', stacked);

    const previewWidth = Math.max(1, Math.min(stacked ? availableWidth : sideBySidePreviewWidth, PREVIEW_MAX_WIDTH));
    const previewHeight = Math.round(previewWidth * PREVIEW_ASPECT_RATIO);

    setCanvasSize('grid-customise-preview', previewWidth, previewHeight);
    setCanvasSize('grid-customise-control', CONTROL_SIZE, CONTROL_SIZE);

    const controlPanel = document.getElementById('grid-customise-control').closest('.grid-customise-panel');
    controlPanel.style.marginTop = stacked ? '' : Math.max(0, (previewHeight - CONTROL_SIZE) / 2) + 'px';

    renderGridCustomisePreview();
}

function setCanvasSize(canvasId, width, height) {
    const canvas = document.getElementById(canvasId);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
}

function getCanvasLogicalSize(canvas) {
    return {
        width: parseInt(canvas.style.width, 10),
        height: parseInt(canvas.style.height, 10)
    };
}

const GRID_CUSTOMISE_REFERENCE_ENABLED_COLOUR = '#000000';

const GRID_CUSTOMISE_REFERENCE_DISABLED_COLOUR = '#787878';

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

function toggleGridCustomiseTarget(target, rowLineStates, columnLineStates, circleLineStates) {
    if (target.type === 'row') {
        rowLineStates[target.index] = !rowLineStates[target.index];
    } else if (target.type === 'column') {
        columnLineStates[target.index] = !columnLineStates[target.index];
    } else {
        circleLineStates[target.row][target.column] = !circleLineStates[target.row][target.column];
    }
}

const GRID_CUSTOMISE_FOCUS_COLOUR = '#26a69a';

const GRID_CUSTOMISE_FOCUS_BAND_FILL = 'rgba(38, 166, 154, 0.35)';

const GRID_CUSTOMISE_FOCUS_BAND_MARGIN = 15;

function drawGridCustomiseFocus(ctx, w, h, shape, target) {
    if (!target) {
        return;
    }

    const rowPositions = weightedLinePositions(shape.rowWeights);
    const columnPositions = weightedLinePositions(shape.columnWeights);

    if (target.type === 'row') {
        const y = rowPositions[target.index] * h;
        ctx.fillStyle = GRID_CUSTOMISE_FOCUS_BAND_FILL;
        ctx.fillRect(0, y - GRID_CUSTOMISE_FOCUS_BAND_MARGIN, w, GRID_CUSTOMISE_FOCUS_BAND_MARGIN * 2);
        ctx.strokeStyle = GRID_CUSTOMISE_FOCUS_COLOUR;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, y - GRID_CUSTOMISE_FOCUS_BAND_MARGIN + 0.5, w - 1, GRID_CUSTOMISE_FOCUS_BAND_MARGIN * 2 - 1);
    } else if (target.type === 'column') {
        const x = columnPositions[target.index] * w;
        ctx.fillStyle = GRID_CUSTOMISE_FOCUS_BAND_FILL;
        ctx.fillRect(x - GRID_CUSTOMISE_FOCUS_BAND_MARGIN, 0, GRID_CUSTOMISE_FOCUS_BAND_MARGIN * 2, h);
        ctx.strokeStyle = GRID_CUSTOMISE_FOCUS_COLOUR;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - GRID_CUSTOMISE_FOCUS_BAND_MARGIN + 0.5, 0.5, GRID_CUSTOMISE_FOCUS_BAND_MARGIN * 2 - 1, h - 1);
    } else {
        const radius = Math.min(
            (smallestWeightedBand(shape.rowWeights) * h) / 2,
            (smallestWeightedBand(shape.columnWeights) * w) / 2,
            shape.circleRadius) + 4;
        const x = columnPositions[target.column] * w;
        const y = rowPositions[target.row] * h;
        ctx.strokeStyle = GRID_CUSTOMISE_FOCUS_COLOUR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

function gridCustomiseEventPosition(event) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
}

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

function announceGridCustomiseFocus(target) {
    const liveRegion = document.getElementById('grid-customise-status');
    if (liveRegion && target) {
        liveRegion.textContent = target.label + ': ' + (target.enabled ? 'shown' : 'hidden') + '. Press Enter or Space to toggle.';
    }
}

function onGridCustomiseHover(event) {
    const canvas = event.currentTarget;
    const {x, y} = gridCustomiseEventPosition(event);

    const target = findGridCustomiseTarget(x, y, canvas.width, canvas.height, currentCustomiseShape(buildLiveGridCustomiseOptions()));
    canvas.style.cursor = target ? 'pointer' : 'default';
}

function minGridLines(otherDimensionValue) {
    return otherDimensionValue === 1 ? 2 : MIN_GRID_LINES;
}

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

function getSelectedOption(elementName, fallback) {
    const checked = document.querySelector('input[name="' + elementName + '"]:checked');
    return checked ? checked.value : fallback;
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', loadOptions);
    document.querySelectorAll('input').forEach(input => input.addEventListener('change', saveOptions));

    document.getElementById('line-colour').addEventListener('input', () => syncQuickPickSelection('line-colour'));
    document.getElementById('circle-colour').addEventListener('input', () => syncQuickPickSelection('circle-colour'));

    document.getElementById('line-opacity').addEventListener('input', () => updateOpacityLabel('line-opacity'));
    document.getElementById('circle-opacity').addEventListener('input', () => updateOpacityLabel('circle-opacity'));
    document.getElementById('resize-mask-opacity').addEventListener('input', () => updateOpacityLabel('resize-mask-opacity'));

    let phiRatioPreviewTimeoutId;
    document.querySelectorAll('.phi-ratio-row input').forEach(input => input.addEventListener('input', () => {
        clearTimeout(phiRatioPreviewTimeoutId);
        phiRatioPreviewTimeoutId = setTimeout(() => {
            renderGridCustomisePreview(false);
            chrome.storage.sync.set({phiRatio: readPhiRatio(false)});
        }, PHI_RATIO_PREVIEW_DEBOUNCE_MS);
    }));

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

    new ResizeObserver(() => layoutGridCustomiseCanvases()).observe(document.getElementById('grid-customise-col'));

    document.querySelectorAll('input[name="overlay-style"]').forEach(input => input.addEventListener('change', syncOverlayStyleVisibility));

    drawGoldenRatioThumbnails();

    document.querySelectorAll('input[name="golden-ratio-direction"], input[name="golden-ratio-start"]').forEach(input => input.addEventListener('change', syncGoldenRatioThumbnailSelection));

    document.querySelectorAll('.golden-ratio-thumb').forEach(button => {
        button.addEventListener('click', () => {
            selectOption('golden-ratio-direction', button.dataset.direction);
            selectOption('golden-ratio-start', button.dataset.start);
            syncGoldenRatioThumbnailSelection();
            saveOptions();
        });
        button.addEventListener('keydown', onGoldenRatioThumbKeyDown);
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_OPTIONS, MIN_GRID_LINES, MAX_GRID_LINES, MIN_CIRCLE_RADIUS, MIN_PHI_RATIO, MAX_PHI_RATIO, PHI_RATIO_DECIMALS, clampInt, clampFloat, roundTo, minGridLines, computeGridLineMinimums,
        resizeLineStates, resetLineStates, resizeCircleStates, resetCircleStates,
        weightedLinePositions, smallestWeightedBand,
        computePreviewBackground, findGridCustomiseTarget, renderGridCustomiseReference, drawPreviewBackground,
        listGridCustomiseTargets, drawGridCustomiseFocus
    };
}
