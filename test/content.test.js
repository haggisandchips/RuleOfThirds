const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isMinSize,
    shouldRender,
    sanitizeInt,
    sanitizeOptions,
    sanitizeLineStates,
    sanitizeCircleStates,
    sanitizeColour
} = require('../WebContent/content.js');

test('isMinSize accepts either orientation', () => {
    assert.equal(isMinSize(100, 50, 100, 50), true, 'exact landscape minimum');
    assert.equal(isMinSize(50, 100, 100, 50), true, 'exact portrait minimum');
});

test('isMinSize rejects images smaller than the minimum in both orientations', () => {
    assert.equal(isMinSize(99, 50, 100, 50), false);
    assert.equal(isMinSize(50, 99, 100, 50), false);
    assert.equal(isMinSize(10, 10, 100, 50), false);
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
        circleRadius: 1,
        circleStyle: 'outline',
        circleLines: [[true, true], [true, true]]
    });
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
