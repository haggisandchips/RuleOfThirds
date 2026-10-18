

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

var PHI_GRID_LINE_COUNT = 2;
var DEFAULT_PHI_RATIO = [1, 0.618, 1];

var MAX_PHI_RATIO = 100;

function sanitizePhiRatio(value) {
    if (!Array.isArray(value) || value.length !== DEFAULT_PHI_RATIO.length) {
        return DEFAULT_PHI_RATIO.slice();
    }
    return value.map((entry, index) => {
        const parsed = parseFloat(entry);
        return Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_PHI_RATIO ? parsed : DEFAULT_PHI_RATIO[index];
    });
}

var VALID_OVERLAY_STYLES = ['grid', 'phi-grid', 'golden-ratio'];
var VALID_GOLDEN_RATIO_DIRECTIONS = ['clockwise', 'counter-clockwise'];
var VALID_GOLDEN_RATIO_STARTS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function sanitizeEnum(value, validValues, fallback) {
    return validValues.includes(value) ? value : fallback;
}

function sanitizeOptions(data) {
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

        lineWidth: sanitizeInt(data.lineWidth, 1, 1, 9),
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

var HEX_COLOUR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function sanitizeColour(value, fallback) {
    return typeof value === 'string' && HEX_COLOUR_PATTERN.test(value) ? value : fallback;
}

function sanitizeLineStates(lines, count) {
    const result = [];
    for (let ii = 0; ii < count; ii++) {
        result.push(Array.isArray(lines) ? lines[ii] !== false : true);
    }
    return result;
}

function sanitizeCircleStates(rows, rowCount, columnCount) {
    const result = [];
    for (let ii = 0; ii < rowCount; ii++) {
        result.push(sanitizeLineStates(Array.isArray(rows) ? rows[ii] : undefined, columnCount));
    }
    return result;
}

var MIN_RESIZE_DIMENSION = 20;

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

function activeResizeRect(override, imageWidth, imageHeight) {
    return (override && override.rect) || {x: 0, y: 0, w: imageWidth, h: imageHeight};
}

function resizeHandlePosition(rect, handleId) {
    const handle = RESIZE_HANDLES[handleId];
    return {x: rect.x + rect.w * handle.fx, y: rect.y + rect.h * handle.fy};
}

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

    if (edges.includes('n')) { top = Math.min(top, bottom - MIN_RESIZE_DIMENSION); }
    if (edges.includes('s')) { bottom = Math.max(bottom, top + MIN_RESIZE_DIMENSION); }
    if (edges.includes('w')) { left = Math.min(left, right - MIN_RESIZE_DIMENSION); }
    if (edges.includes('e')) { right = Math.max(right, left + MIN_RESIZE_DIMENSION); }

    return {x: left, y: top, w: right - left, h: bottom - top};
}

function dragResizeRectLocked(startRect, handleId, dx, dy, imageWidth, imageHeight, aspectRatio = startRect.w / startRect.h) {
    const edges = RESIZE_HANDLES[handleId].edges;
    const drivesWidth = edges.includes('w') || edges.includes('e');
    const drivesHeight = edges.includes('n') || edges.includes('s');

    const free = dragResizeRect(startRect, handleId, dx, dy, imageWidth, imageHeight);

    let w = free.w;
    let h = free.h;

    if (drivesWidth && drivesHeight) {
        const widthChanged = Math.abs(free.w - startRect.w) * startRect.h;
        const heightChanged = Math.abs(free.h - startRect.h) * startRect.w;
        if (widthChanged >= heightChanged) {
            h = w / aspectRatio;
        } else {
            w = h * aspectRatio;
        }
    } else if (drivesWidth) {
        h = w / aspectRatio;
    } else {
        w = h * aspectRatio;
    }

    let x = startRect.x;
    let y = startRect.y;
    if (edges.includes('w')) {
        x = startRect.x + startRect.w - w;
    } else if (!drivesWidth) {
        x = startRect.x + (startRect.w - w) / 2;
    }
    if (edges.includes('n')) {
        y = startRect.y + startRect.h - h;
    } else if (!drivesHeight) {
        y = startRect.y + (startRect.h - h) / 2;
    }

    return fitRectToImage({x, y, w, h}, aspectRatio, imageWidth, imageHeight);
}

function fitRectToImage(rect, aspectRatio, imageWidth, imageHeight) {
    let w = rect.w;
    let h = rect.h;

    if (w > imageWidth) { w = imageWidth; h = w / aspectRatio; }
    if (h > imageHeight) { h = imageHeight; w = h * aspectRatio; }
    if (w < MIN_RESIZE_DIMENSION) { w = MIN_RESIZE_DIMENSION; h = w / aspectRatio; }
    if (h < MIN_RESIZE_DIMENSION) { h = MIN_RESIZE_DIMENSION; w = h * aspectRatio; }

    const x = Math.min(Math.max(rect.x, 0), imageWidth - w);
    const y = Math.min(Math.max(rect.y, 0), imageHeight - h);

    return {x, y, w, h};
}

function dragMoveRect(startRect, dx, dy, imageWidth, imageHeight) {
    const x = Math.min(Math.max(startRect.x + dx, 0), imageWidth - startRect.w);
    const y = Math.min(Math.max(startRect.y + dy, 0), imageHeight - startRect.h);

    return {x, y, w: startRect.w, h: startRect.h};
}

var ASPECT_RATIO_PRESETS = {
    original: {label: 'Original', ratio: null},
    square: {label: 'Square', ratio: 1},
    '5x4': {label: '5 x 4', ratio: 5 / 4},
    '8x6': {label: '8 x 6', ratio: 4 / 3},
    '7x5': {label: '7 x 5', ratio: 7 / 5},
    '6x4': {label: '6 x 4', ratio: 3 / 2},
    '16x9': {label: '16 x 9', ratio: 16 / 9}
};

function targetOrientationIsLandscape(orientationFlipped, imageWidth, imageHeight) {
    const imageIsLandscape = imageWidth >= imageHeight;
    return imageIsLandscape !== orientationFlipped;
}

function effectiveAspectRatio(presetId, orientationFlipped, imageWidth, imageHeight) {
    const preset = ASPECT_RATIO_PRESETS[presetId];
    if (!preset || preset.ratio === null) {
        return null;
    }

    const targetIsLandscape = targetOrientationIsLandscape(orientationFlipped, imageWidth, imageHeight);

    return targetIsLandscape ? preset.ratio : 1 / preset.ratio;
}

function orderedAspectRatioPresetIds() {
    const ids = Object.keys(ASPECT_RATIO_PRESETS)
        .filter(id => id !== 'original')
        .sort((a, b) => ASPECT_RATIO_PRESETS[a].ratio - ASPECT_RATIO_PRESETS[b].ratio);

    return ['original', ...ids];
}

function maxRectAtAnchor(anchorX, anchorY, aspectRatio, imageWidth, imageHeight) {
    const availableWidth = imageWidth - anchorX;
    const availableHeight = imageHeight - anchorY;

    let w = availableWidth;
    let h = w / aspectRatio;
    if (h > availableHeight) {
        h = availableHeight;
        w = h * aspectRatio;
    }

    return {x: anchorX, y: anchorY, w, h};
}

function rotateRectInPlace(rect, imageWidth, imageHeight) {
    let w = rect.h;
    let h = rect.w;
    const aspectRatio = w / h;

    if (w > imageWidth) { w = imageWidth; h = w / aspectRatio; }
    if (h > imageHeight) { h = imageHeight; w = h * aspectRatio; }

    const centreX = rect.x + rect.w / 2;
    const centreY = rect.y + rect.h / 2;

    const x = Math.min(Math.max(centreX - w / 2, 0), imageWidth - w);
    const y = Math.min(Math.max(centreY - h / 2, 0), imageHeight - h);

    return {x, y, w, h};
}

function orientationFlipDisplay(ratio) {
    return ratio >= 1
        ? {targetIsPortrait: true, title: 'Switch to portrait'}
        : {targetIsPortrait: false, title: 'Switch to landscape'};
}

function resizeMaskRects(rect, w, h) {
    return [
        {x: 0, y: 0, w: w, h: rect.y},
        {x: 0, y: rect.y + rect.h, w: w, h: h - (rect.y + rect.h)},
        {x: 0, y: rect.y, w: rect.x, h: rect.h},
        {x: rect.x + rect.w, y: rect.y, w: w - (rect.x + rect.w), h: rect.h}
    ];
}

function resizeBorderRects(rect) {
    const outerX = rect.x - 1;
    const outerY = rect.y - 1;
    const outerW = rect.w + 2;
    const outerH = rect.h + 2;

    return [
        {x: outerX, y: outerY, w: outerW, h: 1},
        {x: outerX, y: outerY + outerH - 1, w: outerW, h: 1},
        {x: outerX, y: outerY + 1, w: 1, h: outerH - 2},
        {x: outerX + outerW - 1, y: outerY + 1, w: 1, h: outerH - 2}
    ];
}

var RESIZE_HANDLE_SIZE = 12;

var RESIZE_HANDLE_COLOUR = '#26a69a';

var ORIENTATION_FLIP_SHORT_SIDE = 40;
var ORIENTATION_FLIP_LONG_SIDE = 60;

var OVERLAY_Z_INDEX = 2147483647;

function extensionContextIsValid() {
    return !!chrome.runtime?.id;
}

if (typeof rotInit === 'undefined') {
    const rotInit = function () {
        let options;

        const promise = readOptions();

        const desiredActive = globalThis.__rotPendingActive === true;
        delete globalThis.__rotPendingActive;

        let controlElement = document.getElementById('rule-of-thirds');
        if (!controlElement) {
            controlElement = document.createElement('div');
            controlElement.id = 'rule-of-thirds';
            controlElement.active = false;

            controlElement.imageOverrides = new Map();
            document.body.appendChild(controlElement);

            chrome.storage.onChanged.addListener((changes, area) => {
                if (!extensionContextIsValid()) {
                    return;
                }
                if (area === 'sync') {
                    if (controlElement.active === true) {
                        readOptions().then(() => {
                            removeOverlays();
                            applyOverlays();
                        })
                    }
                }
            });

            let resizeReapplyTimer = null;
            window.addEventListener('resize', () => {
                if (!extensionContextIsValid()) {
                    return;
                }
                if (controlElement.active === true) {
                    clearTimeout(resizeReapplyTimer);
                    resizeReapplyTimer = setTimeout(() => {
                        removeOverlays();
                        applyOverlays();
                    }, 200);
                }
            });

            let clickReapplyTimer = null;
            window.addEventListener('click', () => {
                if (!extensionContextIsValid()) {
                    return;
                }
                if (controlElement.active === true) {
                    clearTimeout(clickReapplyTimer);
                    clickReapplyTimer = setTimeout(() => {
                        removeOverlays();
                        applyOverlays();
                    }, 200);
                }
            }, true);

            let activeContextMenuTarget = null;
            let lastSyncedMenuContainer;
            function syncOverlayMenuFor(target, force) {
                if (!extensionContextIsValid() || controlElement.active !== true) {
                    return;
                }

                const menuContainer = target && target.closest && target.closest('[data-extension="rule-of-thirds"]');
                if (!force && menuContainer === lastSyncedMenuContainer) {
                    return;
                }
                lastSyncedMenuContainer = menuContainer || null;

                const menuContext = menuContainer && menuContainer.__rotMenuContext;
                if (!menuContext) {
                    activeContextMenuTarget = null;
                    chrome.runtime.sendMessage({type: 'rule-of-thirds-menu-sync', relevant: false});
                    return;
                }

                const {w, h, currentOverride, setResizeEnabled, setMaintainAspectRatio, setAspectRatioPreset, toggleOrientationFlipped, resetOverride} = menuContext;
                activeContextMenuTarget = {setResizeEnabled, setMaintainAspectRatio, setAspectRatioPreset, toggleOrientationFlipped, resetOverride};

                const override = currentOverride();

                const showFlip = override.maintainAspectRatio && override.aspectRatioPreset !== 'square';
                let flipLabel;
                if (showFlip) {
                    const rect = activeResizeRect(override, w, h);
                    flipLabel = (rect.w / rect.h) >= 1 ? 'Switch to Portrait' : 'Switch to Landscape';
                }

                chrome.runtime.sendMessage({
                    type: 'rule-of-thirds-menu-sync',
                    relevant: true,
                    state: {
                        resizeEnabled: override.resizeEnabled,
                        maintainAspectRatio: override.maintainAspectRatio,
                        aspectRatioPreset: override.aspectRatioPreset,
                        showFlip,
                        flipLabel
                    }
                });
            }

            window.addEventListener('mouseover', event => syncOverlayMenuFor(event.target), true);
            window.addEventListener('contextmenu', event => syncOverlayMenuFor(event.target, true), true);

            window.addEventListener('mouseout', event => {
                if (event.relatedTarget === null) {
                    syncOverlayMenuFor(null);
                }
            }, true);

            chrome.runtime.onMessage.addListener((message) => {
                if (!message || message.type !== 'rule-of-thirds-menu-action' || !activeContextMenuTarget) {
                    return;
                }

                const target = activeContextMenuTarget;
                if (message.id === 'rot-enable-resize') {
                    target.setResizeEnabled(message.checked);
                } else if (message.id === 'rot-maintain-aspect') {
                    target.setMaintainAspectRatio(message.checked);
                } else if (message.id === 'rot-flip-orientation') {
                    target.toggleOrientationFlipped();
                } else if (message.id === 'rot-reset') {
                    target.resetOverride();
                } else if (message.id && message.id.startsWith('rot-preset-')) {
                    target.setAspectRatioPreset(message.id.slice('rot-preset-'.length));
                }

                if (lastSyncedMenuContainer) {
                    syncOverlayMenuFor(lastSyncedMenuContainer, true);
                }
            });
        }

        function imageOverrides() {
            if (!(controlElement.imageOverrides instanceof Map)) {
                controlElement.imageOverrides = new Map();
            }
            return controlElement.imageOverrides;
        }

        promise.then(() => {
            applyDesiredState(desiredActive);
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
                        lineWidth: 1,
                        renderCircle: true,
                        circleColour: '#ff0000',
                        circleOpacity: 100,
                        resizeMaskOpacity: 50,
                        showFlipControl: true,
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

        function applyDesiredState(desiredActive) {
            imageOverrides().clear();
            removeOverlays();
            if (desiredActive) {
                applyOverlays();
            }
        }

        function reportState() {
            chrome.runtime.sendMessage({
                type: 'rule-of-thirds-state',
                active: controlElement.active === true
            });
        }

        function applyOverlays() {
            const images = document.getElementsByTagName('img');
            for (let ii = 0; ii < images.length; ii++) {
                const image = images[ii];

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

            controlElement.active = true;
        }

        function renderImageOverlay(image, computedStyle, w, h) {
            if (!isMinSize(image.naturalWidth, image.naturalHeight, options.minImageWidth, options.minImageHeight, options.eitherOrientation)) {
                return;
            }

            const appendTarget = image.offsetParent ? stackingContextCeiling(image.offsetParent) : document.body;

            const container = createOverlayContainer(w, h, image, computedStyle, appendTarget);
            const canvas = createCanvas(w, h);
            container.append(canvas);
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;

            let handleElements = null;
            let flipControl = null;

            function currentOverride() {
                return imageOverrides().get(image) || {
                    resizeEnabled: false, rect: null, maintainAspectRatio: false,
                    aspectRatioPreset: 'original', aspectOrientationFlipped: false
                };
            }

            function setRect(rect) {
                const override = currentOverride();
                override.rect = rect;
                imageOverrides().set(image, override);
            }

            function redraw() {
                const rect = activeResizeRect(currentOverride(), w, h);

                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, w, h);

                ctx.fillStyle = hexToRgba('#000000', options.resizeMaskOpacity);
                resizeMaskRects(rect, w, h).forEach(maskRect => ctx.fillRect(maskRect.x, maskRect.y, maskRect.w, maskRect.h));

                ctx.fillStyle = hexToRgba(options.lineColour, options.resizeMaskOpacity);
                resizeBorderRects(rect).forEach(borderRect => ctx.fillRect(borderRect.x, borderRect.y, borderRect.w, borderRect.h));

                ctx.translate(rect.x, rect.y);

                OVERLAY_STYLE_DRAWERS[options.overlayStyle](ctx, rect.w, rect.h, options);

                if (handleElements) {
                    const hideEdgeHandles = currentOverride().maintainAspectRatio;
                    Object.keys(RESIZE_HANDLES).forEach(handleId => {
                        const position = resizeHandlePosition(rect, handleId);
                        const element = handleElements[handleId];
                        element.style.left = position.x + 'px';
                        element.style.top = position.y + 'px';
                        element.hidden = hideEdgeHandles && RESIZE_HANDLES[handleId].edges.length === 1;
                    });
                }

                if (flipControl) {
                    const display = orientationFlipDisplay(rect.w / rect.h);
                    flipControl.title = display.title;
                    const flipWidth = display.targetIsPortrait ? ORIENTATION_FLIP_SHORT_SIDE : ORIENTATION_FLIP_LONG_SIDE;
                    const flipHeight = display.targetIsPortrait ? ORIENTATION_FLIP_LONG_SIDE : ORIENTATION_FLIP_SHORT_SIDE;
                    flipControl.style.width = flipWidth + 'px';
                    flipControl.style.height = flipHeight + 'px';
                    flipControl.style.left = (rect.x + rect.w / 2 - flipWidth / 2) + 'px';
                    flipControl.style.top = (rect.y + rect.h / 2 - flipHeight / 2) + 'px';
                }
            }

            function syncFlipControl() {
                const override = currentOverride();
                const shouldShow = options.showFlipControl && override.resizeEnabled && override.maintainAspectRatio && override.aspectRatioPreset !== 'square';

                if (shouldShow && !flipControl) {
                    flipControl = createOrientationFlipControl(container, toggleOrientationFlipped);
                } else if (!shouldShow && flipControl) {
                    flipControl.remove();
                    flipControl = null;
                }
            }

            function applyForcedAspectRatio() {
                const override = currentOverride();
                if (!override.resizeEnabled || !override.maintainAspectRatio) {
                    return;
                }

                const ratio = effectiveAspectRatio(override.aspectRatioPreset, override.aspectOrientationFlipped, w, h);
                if (ratio === null) {
                    return;
                }

                const anchor = activeResizeRect(override, w, h);
                setRect(maxRectAtAnchor(anchor.x, anchor.y, ratio, w, h));
                redraw();
            }

            canvas.addEventListener('pointerdown', event => {
                const override = currentOverride();
                if (!override.resizeEnabled) {
                    return;
                }

                const startRect = activeResizeRect(override, w, h);
                if (event.offsetX < startRect.x || event.offsetX > startRect.x + startRect.w ||
                    event.offsetY < startRect.y || event.offsetY > startRect.y + startRect.h) {
                    return;
                }

                event.preventDefault();

                const startX = event.clientX;
                const startY = event.clientY;
                canvas.setPointerCapture(event.pointerId);

                function onPointerMove(moveEvent) {
                    setRect(dragMoveRect(startRect, moveEvent.clientX - startX, moveEvent.clientY - startY, w, h));
                    redraw();
                }

                function onPointerUp() {
                    canvas.removeEventListener('pointermove', onPointerMove);
                    canvas.removeEventListener('pointerup', onPointerUp);
                }

                canvas.addEventListener('pointermove', onPointerMove);
                canvas.addEventListener('pointerup', onPointerUp, {once: true});
            });

            function setResizeEnabled(enabled) {
                const override = currentOverride();
                override.resizeEnabled = enabled;
                imageOverrides().set(image, override);

                if (enabled && !handleElements) {
                    handleElements = createResizeHandles(container, w, h, currentOverride, setRect, redraw);
                } else if (!enabled && handleElements) {
                    Object.values(handleElements).forEach(element => element.remove());
                    handleElements = null;
                }

                canvas.style.cursor = enabled ? 'move' : '';
                syncFlipControl();
                applyForcedAspectRatio();
                redraw();
            }

            function setMaintainAspectRatio(enabled) {
                const override = currentOverride();
                override.maintainAspectRatio = enabled;
                imageOverrides().set(image, override);
                syncFlipControl();
                applyForcedAspectRatio();

                redraw();
            }

            function setAspectRatioPreset(presetId) {
                const override = currentOverride();
                override.aspectRatioPreset = presetId;

                if (presetId === 'original') {
                    override.rect = null;
                }
                imageOverrides().set(image, override);
                syncFlipControl();
                applyForcedAspectRatio();
                redraw();
            }

            function toggleOrientationFlipped() {
                const override = currentOverride();
                override.aspectOrientationFlipped = !override.aspectOrientationFlipped;
                imageOverrides().set(image, override);

                const anchor = activeResizeRect(override, w, h);
                setRect(rotateRectInPlace(anchor, w, h));
                redraw();
            }

            function resetOverride() {
                const override = currentOverride();
                override.rect = null;
                override.maintainAspectRatio = false;
                override.aspectRatioPreset = 'original';
                override.aspectOrientationFlipped = false;
                if (override.resizeEnabled) {
                    override.resizeEnabled = false;
                    if (handleElements) {
                        Object.values(handleElements).forEach(element => element.remove());
                        handleElements = null;
                    }
                }
                imageOverrides().set(image, override);
                syncFlipControl();
                redraw();
            }

            registerOverlayContextMenu(container, w, h, currentOverride, setResizeEnabled, setMaintainAspectRatio, setAspectRatioPreset, toggleOrientationFlipped, resetOverride);

            if (currentOverride().resizeEnabled) {
                handleElements = createResizeHandles(container, w, h, currentOverride, setRect, redraw);
                canvas.style.cursor = 'move';
            }
            syncFlipControl();
            redraw();

            appendTarget.append(container);
        }

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
                        const dx = moveEvent.clientX - startX;
                        const dy = moveEvent.clientY - startY;
                        const override = currentOverride();

                        if (!override.maintainAspectRatio) {
                            setRect(dragResizeRect(startRect, handleId, dx, dy, w, h));
                        } else {
                            const forcedRatio = effectiveAspectRatio(override.aspectRatioPreset, override.aspectOrientationFlipped, w, h);
                            setRect(forcedRatio === null
                                ? dragResizeRectLocked(startRect, handleId, dx, dy, w, h)
                                : dragResizeRectLocked(startRect, handleId, dx, dy, w, h, forcedRatio));
                        }
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

        function createOrientationFlipControl(container, onFlip) {
            const flip = document.createElement('div');
            flip.setAttribute('role', 'presentation');
            flip.setAttribute('aria-hidden', 'true');

            flip.style.position = 'absolute';
            flip.style.boxSizing = 'border-box';
            flip.style.background = RESIZE_HANDLE_COLOUR;
            flip.style.border = '3px solid #fff';
            flip.style.cursor = 'pointer';
            flip.style.touchAction = 'none';

            flip.addEventListener('pointerdown', event => {
                event.preventDefault();
                event.stopPropagation();
            });
            flip.addEventListener('click', event => {
                event.stopPropagation();
                onFlip();
            });

            container.append(flip);
            return flip;
        }

        function registerOverlayContextMenu(container, w, h, currentOverride, setResizeEnabled, setMaintainAspectRatio, setAspectRatioPreset, toggleOrientationFlipped, resetOverride) {
            container.__rotMenuContext = {w, h, currentOverride, setResizeEnabled, setMaintainAspectRatio, setAspectRatioPreset, toggleOrientationFlipped, resetOverride};
        }

        const OVERLAY_STYLE_DRAWERS = {
            grid: drawGridOverlay,
            'phi-grid': drawPhiGridOverlay,
            'golden-ratio': drawGoldenSpiral
        };

        function drawGoldenSpiral(ctx, w, h, options) {
            ctx.lineWidth = options.lineWidth;
            ctx.strokeStyle = hexToRgba(options.lineColour, options.lineOpacity);

            traceGoldenSpiralPath(ctx, w, h, options.goldenRatioDirection, options.goldenRatioStart);

            ctx.stroke();
        }

        function removeOverlays() {
            document.querySelectorAll('[data-extension="rule-of-thirds"]').forEach(element => element.remove());
            controlElement.active = false;

            if (extensionContextIsValid()) {
                chrome.runtime.sendMessage({type: 'rule-of-thirds-menu-sync', relevant: false});
            }
        }

        function elementScale(el) {
            const transform = getComputedStyle(el).transform;
            if (!transform || transform === 'none') {
                return {x: 1, y: 1};
            }

            const matrix = transform.match(/matrix\(([^,]+),([^,]+),([^,]+),([^,]+),/);
            return matrix ? {x: parseFloat(matrix[1]), y: parseFloat(matrix[4])} : {x: 1, y: 1};
        }

        function stackingContextCeiling(ancestor) {
            while (ancestor && ancestor !== document.body) {
                const style = getComputedStyle(ancestor);
                if (style.position === 'static' || style.zIndex === 'auto') {
                    return ancestor;
                }
                ancestor = ancestor.parentElement;
            }
            return ancestor || document.body;
        }

        function containingBlockOrigin(appendTarget) {
            let ancestor = appendTarget;
            while (ancestor && getComputedStyle(ancestor).position === 'static') {
                ancestor = ancestor.parentElement;
            }

            if (!ancestor) {
                return {left: -window.scrollX, top: -window.scrollY, scale: {x: 1, y: 1}};
            }

            const rect = ancestor.getBoundingClientRect();
            return {left: rect.left, top: rect.top, scale: elementScale(ancestor)};
        }

        function createOverlayContainer(w, h, image, computedStyle, appendTarget) {
            const container = document.createElement('div');

            container.style.width = w + 'px';
            container.style.height = h + 'px';

            container.style.padding = computedStyle.padding;

            container.style.zIndex = OVERLAY_Z_INDEX;
            container.setAttribute('data-extension', 'rule-of-thirds');

            if (image.offsetParent) {
                container.style.position = 'absolute';
                if (image.style['margin'] === 'auto') {
                    container.style.margin = computedStyle.margin;
                } else {
                    const origin = containingBlockOrigin(appendTarget);
                    const imageRect = image.getBoundingClientRect();
                    container.style.left = ((imageRect.left - origin.left) / origin.scale.x + parseInt(computedStyle.borderLeftWidth)) + 'px';
                    container.style.top = ((imageRect.top - origin.top) / origin.scale.y + parseInt(computedStyle.borderTopWidth)) + 'px';
                }
            } else {
                const rect = image.getBoundingClientRect();
                container.style.position = 'fixed';
                container.style.left = rect.left + 'px';
                container.style.top = rect.top + 'px';
            }

            return container;
        }

        function createCanvas(w, h) {
            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;

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

    if (typeof document !== 'undefined') {
        rotInit();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isMinSize, shouldRender, sanitizeInt, sanitizeOptions, sanitizeLineStates, sanitizeCircleStates, sanitizeColour, sanitizeEnum,
        MIN_RESIZE_DIMENSION, RESIZE_HANDLES, activeResizeRect, resizeHandlePosition, dragResizeRect, dragResizeRectLocked, fitRectToImage,
        resizeMaskRects, resizeBorderRects, ASPECT_RATIO_PRESETS, effectiveAspectRatio, targetOrientationIsLandscape, orderedAspectRatioPresetIds,
        maxRectAtAnchor, rotateRectInPlace, orientationFlipDisplay, dragMoveRect
    };
}