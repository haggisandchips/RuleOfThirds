const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isMinSize,
    shouldRender,
    sanitizeInt,
    sanitizeOptions,
    sanitizeLineStates,
    sanitizeCircleStates,
    sanitizeColour,
    sanitizeEnum,
    MIN_RESIZE_DIMENSION,
    RESIZE_HANDLES,
    activeResizeRect,
    resizeHandlePosition,
    dragResizeRect,
    resizeMaskRects,
    resizeBorderRects
} = require('../WebContent/content.js');

test('isMinSize accepts either orientation by default', () => {
    assert.equal(isMinSize(100, 50, 100, 50), true, 'exact landscape minimum');
    assert.equal(isMinSize(50, 100, 100, 50), true, 'exact portrait minimum');
});

test('isMinSize rejects images smaller than the minimum in both orientations', () => {
    assert.equal(isMinSize(99, 50, 100, 50), false);
    assert.equal(isMinSize(50, 99, 100, 50), false);
    assert.equal(isMinSize(10, 10, 100, 50), false);
});

test('isMinSize with eitherOrientation explicitly true behaves the same as the default', () => {
    assert.equal(isMinSize(100, 50, 100, 50, true), true, 'exact landscape minimum');
    assert.equal(isMinSize(50, 100, 100, 50, true), true, 'exact portrait minimum');
});

test('isMinSize with eitherOrientation false rejects a swapped (portrait) match', () => {
    // Would pass under the default eitherOrientation - only rejected once the
    // flip itself is disabled.
    assert.equal(isMinSize(50, 100, 100, 50, false), false);
});

test('isMinSize with eitherOrientation false accepts a literal (unswapped) match', () => {
    assert.equal(isMinSize(100, 50, 100, 50, false), true);
    assert.equal(isMinSize(200, 200, 100, 50, false), true);
});

test('shouldRender is false when the image is hidden, regardless of size', () => {
    assert.equal(
        shouldRender({visibility: 'hidden', display: 'block'}, 200, 200, 100, 50),
        false
    );
    assert.equal(
        shouldRender({visibility: 'visible', display: 'none'}, 200, 200, 100, 50),
        false
    );
});

test('shouldRender is true for a visible, adequately-sized image', () => {
    assert.equal(
        shouldRender({visibility: 'visible', display: 'block'}, 200, 200, 100, 50),
        true
    );
});

test('shouldRender is false for a visible but undersized image', () => {
    assert.equal(
        shouldRender({visibility: 'visible', display: 'block'}, 10, 10, 100, 50),
        false
    );
});

test('shouldRender passes eitherOrientation through to isMinSize', () => {
    // A 50x100 portrait image meets the 100x50 minimum only via the flip -
    // rejected once eitherOrientation is turned off.
    assert.equal(
        shouldRender({visibility: 'visible', display: 'block'}, 50, 100, 100, 50, false),
        false
    );
    assert.equal(
        shouldRender({visibility: 'visible', display: 'block'}, 50, 100, 100, 50, true),
        true
    );
});

test('sanitizeInt parses legacy string values from chrome.storage', () => {
    assert.equal(sanitizeInt('3', 2, 3), 3);
    assert.equal(sanitizeInt('7', 2, 3), 7);
});

test('sanitizeInt falls back on blank or non-numeric values', () => {
    assert.equal(sanitizeInt('', 2, 3), 3);
    assert.equal(sanitizeInt('abc', 2, 3), 3);
    assert.equal(sanitizeInt(undefined, 2, 3), 3);
});

test('sanitizeInt clamps values below the minimum instead of rendering nothing', () => {
    assert.equal(sanitizeInt('0', 2, 3), 2);
    assert.equal(sanitizeInt('-5', 2, 3), 2);
});

test('sanitizeInt clamps values above an optional maximum', () => {
    assert.equal(sanitizeInt('150', 0, 100, 100), 100);
    assert.equal(sanitizeInt('50', 0, 100, 100), 50);
});

test('sanitizeOptions clamps the numeric fields and leaves everything else untouched', () => {
    const result = sanitizeOptions({
        renderGrid: true,
        gridRows: '3',
        gridColumns: '',
        lineColour: '#000000',
        lineOpacity: '150',
        renderCircle: true,
        circleColour: '#ff0000',
        circleOpacity: '-10',
        circleRadius: '-1',
        circleStyle: 'outline'
    });

    assert.deepEqual(result, {
        renderGrid: true,
        gridRows: 3,
        gridColumns: 3,
        gridRowLines: [true, true],
        gridColumnLines: [true, true],
        lineColour: '#000000',
        lineOpacity: 100,
        renderCircle: true,
        circleColour: '#ff0000',
        circleOpacity: 0,
        resizeMaskOpacity: 50,
        circleRadius: 1,
        circleStyle: 'outline',
        circleLines: [[true, true], [true, true]],
        minImageWidth: 100,
        minImageHeight: 50,
        phiRatio: [1, 0.618, 1],
        phiRowLines: [true, true],
        phiColumnLines: [true, true],
        phiCircleLines: [[true, true], [true, true]],
        overlayStyle: 'grid',
        goldenRatioDirection: 'clockwise',
        goldenRatioStart: 'bottom-left'
    });
});

test('sanitizeOptions clamps minImageWidth/minImageHeight and falls back to the defaults', () => {
    const result = sanitizeOptions({minImageWidth: '0', minImageHeight: 'abc'});

    assert.equal(result.minImageWidth, 1, 'clamped up to the minimum of 1, not the 100 fallback');
    assert.equal(result.minImageHeight, 50, 'falls back to 50 for a non-numeric value');
});

test('sanitizeColour passes through a valid #rrggbb value unchanged', () => {
    assert.equal(sanitizeColour('#a1b2c3', '#ffffff'), '#a1b2c3');
});

test('sanitizeColour falls back for anything that is not a valid 6-digit hex colour', () => {
    // hexToRgba() hard-codes 6-digit substring offsets, so even a
    // technically-valid CSS shorthand like #000 would parse into garbage -
    // only a full #rrggbb value is actually safe to pass through.
    assert.equal(sanitizeColour('#000', '#ffffff'), '#ffffff');
    assert.equal(sanitizeColour('red', '#ffffff'), '#ffffff');
    assert.equal(sanitizeColour('#gggggg', '#ffffff'), '#ffffff');
    assert.equal(sanitizeColour(undefined, '#ffffff'), '#ffffff');
    assert.equal(sanitizeColour(null, '#ffffff'), '#ffffff');
    assert.equal(sanitizeColour(12, '#ffffff'), '#ffffff');
});

test('sanitizeOptions falls back to the default colours for malformed stored values', () => {
    const result = sanitizeOptions({lineColour: 'not-a-colour', circleColour: null});

    assert.equal(result.lineColour, '#ffffff');
    assert.equal(result.circleColour, '#ff0000');
});

test('sanitizeOptions caps gridRows/gridColumns at 9', () => {
    const result = sanitizeOptions({gridRows: '20', gridColumns: '12'});

    assert.equal(result.gridRows, 9);
    assert.equal(result.gridColumns, 9);
});

test('sanitizeOptions treats a missing line-state array as every line enabled', () => {
    const result = sanitizeOptions({gridRows: 4, gridColumns: 2});

    assert.deepEqual(result.gridRowLines, [true, true, true]);
    assert.deepEqual(result.gridColumnLines, [true]);
});

test('sanitizeOptions only disables a line on an explicit false, and resizes to the current grid', () => {
    const result = sanitizeOptions({
        gridRows: 3,
        gridColumns: 4,
        gridRowLines: [false, 'not a boolean'],
        gridColumnLines: [true, false]
    });

    assert.deepEqual(result.gridRowLines, [false, true]);
    // Grew from 2 stored entries to 3 (gridColumns 4 => 3 lines) - the new
    // trailing entry has no stored data, so it defaults to enabled.
    assert.deepEqual(result.gridColumnLines, [true, false, true]);
});

test('sanitizeLineStates treats a missing array as every line enabled', () => {
    const result = sanitizeLineStates(undefined, 3);
    assert.deepEqual(result, [true, true, true]);
});

test('sanitizeLineStates only disables a line on an explicit false', () => {
    const result = sanitizeLineStates([false, 'not a boolean', true], 3);
    assert.deepEqual(result, [false, true, true]);
});

test('sanitizeLineStates resizes to the current count', () => {
    // Grew from 2 stored entries to 3 - the new trailing entry has no
    // stored data, so it defaults to enabled.
    const result = sanitizeLineStates([false, false], 3);
    assert.deepEqual(result, [false, false, true]);
});

test('sanitizeLineStates returns an empty array for a count of 0', () => {
    assert.deepEqual(sanitizeLineStates([false, true], 0), []);
});

test('sanitizeCircleStates treats a missing circle grid as every circle enabled', () => {
    const result = sanitizeCircleStates(undefined, 2, 3);
    assert.deepEqual(result, [[true, true, true], [true, true, true]]);
});

test('sanitizeCircleStates only disables a circle on an explicit false, per row', () => {
    const result = sanitizeCircleStates([[false, true], ['not an array']], 2, 2);
    assert.deepEqual(result, [[false, true], [true, true]]);
});

test('sanitizeCircleStates resizes each row to the current column count', () => {
    // Columns grew from 2 to 3 stored entries per row - the new trailing
    // entry has no stored data, so it defaults to enabled.
    const result = sanitizeCircleStates([[false, false]], 2, 3);
    assert.deepEqual(result, [[false, false, true], [true, true, true]]);
});

test('sanitizeOptions falls back to the default Phi ratio when missing or malformed', () => {
    assert.deepEqual(sanitizeOptions({}).phiRatio, [1, 0.618, 1]);
    assert.deepEqual(sanitizeOptions({phiRatio: 'not an array'}).phiRatio, [1, 0.618, 1]);
    assert.deepEqual(sanitizeOptions({phiRatio: [1, 2]}).phiRatio, [1, 0.618, 1], 'wrong length falls back entirely');
});

test('sanitizeOptions falls back per-entry for an invalid Phi ratio value, not the whole array', () => {
    const result = sanitizeOptions({phiRatio: [2, 'not a number', -1]});
    assert.deepEqual(result.phiRatio, [2, 0.618, 1]);
});

test('sanitizeOptions falls back per-entry for a Phi ratio value over the maximum', () => {
    const result = sanitizeOptions({phiRatio: [1, 999999, 1]});
    assert.deepEqual(result.phiRatio, [1, 0.618, 1]);
});

test('sanitizeOptions accepts a Phi ratio value exactly at the maximum', () => {
    const result = sanitizeOptions({phiRatio: [1, 100, 1]});
    assert.deepEqual(result.phiRatio, [1, 100, 1]);
});

test('sanitizeOptions treats a missing Phi Grid line/circle state as every line/circle enabled', () => {
    const result = sanitizeOptions({});
    assert.deepEqual(result.phiRowLines, [true, true]);
    assert.deepEqual(result.phiColumnLines, [true, true]);
    assert.deepEqual(result.phiCircleLines, [[true, true], [true, true]]);
});

test('sanitizeEnum passes through a value that is in the valid set', () => {
    assert.equal(sanitizeEnum('phi-grid', ['grid', 'phi-grid'], 'grid'), 'phi-grid');
});

test('sanitizeEnum falls back for a value outside the valid set, including missing/wrong-type values', () => {
    assert.equal(sanitizeEnum('not-a-style', ['grid', 'phi-grid'], 'grid'), 'grid');
    assert.equal(sanitizeEnum(undefined, ['grid', 'phi-grid'], 'grid'), 'grid');
    assert.equal(sanitizeEnum(null, ['grid', 'phi-grid'], 'grid'), 'grid');
    assert.equal(sanitizeEnum(42, ['grid', 'phi-grid'], 'grid'), 'grid');
});

test('sanitizeOptions falls back to safe defaults for a corrupted overlayStyle/goldenRatioDirection/goldenRatioStart', () => {
    const result = sanitizeOptions({
        overlayStyle: 'not-a-real-style',
        goldenRatioDirection: 'diagonally',
        goldenRatioStart: 'the-middle'
    });

    assert.equal(result.overlayStyle, 'grid');
    assert.equal(result.goldenRatioDirection, 'clockwise');
    assert.equal(result.goldenRatioStart, 'bottom-left');
});

test('sanitizeOptions leaves a valid overlayStyle/goldenRatioDirection/goldenRatioStart untouched', () => {
    const result = sanitizeOptions({
        overlayStyle: 'golden-ratio',
        goldenRatioDirection: 'counter-clockwise',
        goldenRatioStart: 'top-right'
    });

    assert.equal(result.overlayStyle, 'golden-ratio');
    assert.equal(result.goldenRatioDirection, 'counter-clockwise');
    assert.equal(result.goldenRatioStart, 'top-right');
});

test('activeResizeRect falls back to the whole image when there is no override', () => {
    assert.deepEqual(activeResizeRect(undefined, 200, 100), {x: 0, y: 0, w: 200, h: 100});
    assert.deepEqual(activeResizeRect({resizeEnabled: true, rect: null}, 200, 100), {x: 0, y: 0, w: 200, h: 100});
});

test('activeResizeRect returns the override\'s own rect when one is set', () => {
    const rect = {x: 10, y: 20, w: 30, h: 40};
    assert.deepEqual(activeResizeRect({resizeEnabled: true, rect}, 200, 100), rect);
});

test('resizeHandlePosition places every handle at the expected fraction of the rectangle', () => {
    const rect = {x: 100, y: 200, w: 40, h: 20};

    assert.deepEqual(resizeHandlePosition(rect, 'nw'), {x: 100, y: 200});
    assert.deepEqual(resizeHandlePosition(rect, 'n'), {x: 120, y: 200});
    assert.deepEqual(resizeHandlePosition(rect, 'ne'), {x: 140, y: 200});
    assert.deepEqual(resizeHandlePosition(rect, 'e'), {x: 140, y: 210});
    assert.deepEqual(resizeHandlePosition(rect, 'se'), {x: 140, y: 220});
    assert.deepEqual(resizeHandlePosition(rect, 's'), {x: 120, y: 220});
    assert.deepEqual(resizeHandlePosition(rect, 'sw'), {x: 100, y: 220});
    assert.deepEqual(resizeHandlePosition(rect, 'w'), {x: 100, y: 210});
});

test('RESIZE_HANDLES covers all 8 handles with a cursor for each', () => {
    assert.deepEqual(Object.keys(RESIZE_HANDLES).sort(), ['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w']);
    Object.values(RESIZE_HANDLES).forEach(handle => assert.equal(typeof handle.cursor, 'string'));
});

test('dragResizeRect: a corner handle moves both its adjacent edges, not the other two', () => {
    const rect = {x: 50, y: 50, w: 100, h: 80};
    const result = dragResizeRect(rect, 'se', 20, 10, 1000, 1000);

    assert.deepEqual(result, {x: 50, y: 50, w: 120, h: 90});
});

test('dragResizeRect: an edge-midpoint handle only moves the one edge it sits on', () => {
    const rect = {x: 50, y: 50, w: 100, h: 80};
    const result = dragResizeRect(rect, 'e', 20, 999, 1000, 1000);

    assert.deepEqual(result, {x: 50, y: 50, w: 120, h: 80}, 'dy is ignored entirely for a purely horizontal handle');
});

test('dragResizeRect: dragging the top-left corner outward moves x/y and grows w/h to compensate', () => {
    const rect = {x: 50, y: 50, w: 100, h: 80};
    const result = dragResizeRect(rect, 'nw', -20, -10, 1000, 1000);

    assert.deepEqual(result, {x: 30, y: 40, w: 120, h: 90});
});

test('dragResizeRect clamps to the image bounds rather than letting a handle drag outside it', () => {
    const rect = {x: 10, y: 10, w: 80, h: 60};

    // Dragging the bottom-right corner far past the image's own edge.
    const grown = dragResizeRect(rect, 'se', 10000, 10000, 100, 100);
    assert.deepEqual(grown, {x: 10, y: 10, w: 90, h: 90});

    // Dragging the top-left corner past the image's own top-left origin.
    const shrunkToOrigin = dragResizeRect(rect, 'nw', -10000, -10000, 100, 100);
    assert.deepEqual(shrunkToOrigin, {x: 0, y: 0, w: 90, h: 70});
});

test('dragResizeRect never inverts or collapses the rectangle below MIN_RESIZE_DIMENSION', () => {
    const rect = {x: 40, y: 40, w: 100, h: 100};

    // Dragging the right edge far past the left edge.
    const collapsedHorizontally = dragResizeRect(rect, 'e', -10000, 0, 1000, 1000);
    assert.equal(collapsedHorizontally.w, MIN_RESIZE_DIMENSION);
    assert.equal(collapsedHorizontally.x, rect.x, 'the untouched left edge stays put');

    // Dragging the bottom edge far past the top edge.
    const collapsedVertically = dragResizeRect(rect, 's', 0, -10000, 1000, 1000);
    assert.equal(collapsedVertically.h, MIN_RESIZE_DIMENSION);
    assert.equal(collapsedVertically.y, rect.y, 'the untouched top edge stays put');
});

test('resizeMaskRects covers nothing when the rectangle already fills the whole canvas', () => {
    const rects = resizeMaskRects({x: 0, y: 0, w: 200, h: 100}, 200, 100);
    rects.forEach(rect => assert.equal(rect.w * rect.h, 0));
});

test('resizeMaskRects tiles the area outside the rectangle without gaps or overlap', () => {
    const rect = {x: 20, y: 10, w: 100, h: 50};
    const w = 200;
    const h = 100;
    const rects = resizeMaskRects(rect, w, h);

    const totalArea = rects.reduce((sum, r) => sum + r.w * r.h, 0);
    assert.equal(totalArea, w * h - rect.w * rect.h, 'the four strips together cover exactly the area outside the rectangle');

    assert.deepEqual(rects, [
        {x: 0, y: 0, w: 200, h: 10},
        {x: 0, y: 60, w: 200, h: 40},
        {x: 0, y: 10, w: 20, h: 50},
        {x: 120, y: 10, w: 80, h: 50}
    ]);
});

test('resizeBorderRects traces a 1px frame exactly one pixel outside the rectangle, without gaps or overlap', () => {
    const rect = {x: 20, y: 10, w: 100, h: 50};
    const rects = resizeBorderRects(rect);

    // A 1px frame's area is its perimeter: two strips as long as the
    // (1px wider) rectangle, plus two as long as the (1px taller) one,
    // each already 1px thick.
    const totalArea = rects.reduce((sum, r) => sum + r.w * r.h, 0);
    assert.equal(totalArea, 2 * (rect.w + 2) + 2 * rect.h);

    assert.deepEqual(rects, [
        {x: 19, y: 9, w: 102, h: 1},
        {x: 19, y: 60, w: 102, h: 1},
        {x: 19, y: 10, w: 1, h: 50},
        {x: 120, y: 10, w: 1, h: 50}
    ]);
});
