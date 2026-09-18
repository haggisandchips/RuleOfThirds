const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_OPTIONS,
    MIN_GRID_LINES,
    MIN_CIRCLE_RADIUS,
    clampInt,
    minGridLines,
    computeGridLineMinimums,
    resizeLineStates,
    resetLineStates,
    resizeCircleStates,
    resetCircleStates,
    computePreviewBackground,
    findGridCustomiseTarget,
    renderGridCustomiseReference,
    drawPreviewBackground
} = require('../WebContent/options/options.js');

// A fake canvas context that just records the strokeStyle in effect at each
// stroke() call, in order, so renderGridCustomiseReference's black/grey
// choice can be asserted without a real canvas.
function createColourRecordingContext() {
    let currentStrokeStyle = null;
    const strokes = [];
    return {
        strokes,
        fillStyle: null,
        fillRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        arc() {},
        stroke() { strokes.push(currentStrokeStyle); },
        set strokeStyle(value) { currentStrokeStyle = value; },
        get strokeStyle() { return currentStrokeStyle; }
    };
}

function baseGridOptions(overrides) {
    return Object.assign({
        renderGrid: true,
        gridRows: 3,
        gridColumns: 3,
        gridRowLines: [true, true],
        gridColumnLines: [true, true],
        renderCircle: true,
        circleRadius: 5,
        circleLines: [[true, true], [true, true]]
    }, overrides);
}

test('clampInt parses a valid numeric string', () => {
    assert.equal(clampInt('3', MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows), 3);
});

test('clampInt falls back when the field is blank', () => {
    // A blank <input type="number"> reads as "" - Number('') is 0, which
    // used to silently save as 0 and render nothing instead of the default.
    assert.equal(clampInt('', MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows), DEFAULT_OPTIONS.gridRows);
});

test('clampInt falls back when the field is not a number', () => {
    assert.equal(clampInt('abc', MIN_CIRCLE_RADIUS, DEFAULT_OPTIONS.circleRadius), DEFAULT_OPTIONS.circleRadius);
});

test('clampInt clamps to the minimum instead of accepting 0 or negative values', () => {
    assert.equal(clampInt('0', MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows), MIN_GRID_LINES);
    assert.equal(clampInt('-5', MIN_CIRCLE_RADIUS, DEFAULT_OPTIONS.circleRadius), MIN_CIRCLE_RADIUS);
});

test('clampInt passes through an already-valid value unchanged', () => {
    assert.equal(clampInt('12', MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows), 12);
});

test('minGridLines stays at the base minimum when the other dimension is not 1', () => {
    assert.equal(minGridLines(3), MIN_GRID_LINES);
    assert.equal(minGridLines(2), MIN_GRID_LINES);
});

test('minGridLines rises to 2 when the other dimension is 1', () => {
    assert.equal(minGridLines(1), 2);
});

test('computeGridLineMinimums raises only the field being edited', () => {
    // Columns is already 1, user is editing rows: rows can no longer go to 1.
    assert.deepEqual(
        computeGridLineMinimums(3, 1, 'grid-rows'),
        {gridRowsMin: 2, gridColumnsMin: MIN_GRID_LINES}
    );
    // Rows is already 1, user is editing columns: columns can no longer go to 1.
    assert.deepEqual(
        computeGridLineMinimums(1, 3, 'grid-columns'),
        {gridRowsMin: MIN_GRID_LINES, gridColumnsMin: 2}
    );
});

test('computeGridLineMinimums does not raise the field the user is not editing', () => {
    // Rows is 1 but the user is editing rows itself, not columns - columns'
    // minimum should not move just because rows happens to already be 1.
    assert.deepEqual(
        computeGridLineMinimums(1, 3, 'grid-rows'),
        {gridRowsMin: MIN_GRID_LINES, gridColumnsMin: MIN_GRID_LINES}
    );
});

test('computeGridLineMinimums leaves both at the base minimum with no trigger', () => {
    assert.deepEqual(
        computeGridLineMinimums(1, 1, undefined),
        {gridRowsMin: MIN_GRID_LINES, gridColumnsMin: MIN_GRID_LINES}
    );
});

test('resizeLineStates pads a shorter array with enabled (true) lines', () => {
    assert.deepEqual(resizeLineStates([false], 3), [false, true, true]);
});

test('resizeLineStates truncates a longer array, keeping the surviving lines\' states', () => {
    assert.deepEqual(resizeLineStates([false, true, false], 1), [false]);
});

test('resizeLineStates treats a missing or non-array value as no existing lines', () => {
    assert.deepEqual(resizeLineStates(undefined, 2), [true, true]);
    assert.deepEqual(resizeLineStates(null, 0), []);
});

test('resetLineStates always returns every line enabled, regardless of prior state', () => {
    assert.deepEqual(resetLineStates(3), [true, true, true]);
    assert.deepEqual(resetLineStates(0), []);
});

test('resizeCircleStates pads a shorter grid with enabled (true) circles', () => {
    assert.deepEqual(resizeCircleStates([[false]], 2, 2), [[false, true], [true, true]]);
});

test('resizeCircleStates truncates a larger grid, keeping the surviving circles\' states', () => {
    assert.deepEqual(resizeCircleStates([[false, true, false], [true, true, true]], 1, 1), [[false]]);
});

test('resizeCircleStates treats a missing or non-array value as no existing circles', () => {
    assert.deepEqual(resizeCircleStates(undefined, 2, 1), [[true], [true]]);
    assert.deepEqual(resizeCircleStates(null, 0, 0), []);
});

test('resetCircleStates always returns every circle enabled, regardless of prior state', () => {
    assert.deepEqual(resetCircleStates(2, 2), [[true, true], [true, true]]);
    assert.deepEqual(resetCircleStates(0, 0), []);
});

test('computePreviewBackground stays light even when both colours are white', () => {
    // A full XOR/complement of white would be solid black - blended back
    // toward white instead so the preview never goes dark.
    const [r, g, b] = computePreviewBackground('#ffffff', '#ffffff').match(/\d+/g).map(Number);
    assert.ok(r > 150 && g > 150 && b > 150, 'background should read as light, not dark');
});

test('computePreviewBackground is deterministic for the default line/circle colours', () => {
    assert.equal(computePreviewBackground('#ffffff', '#ff0000'), 'rgb(191, 223, 223)');
});

test('findGridCustomiseTarget prefers a circle over its own crossing lines when both are within range', () => {
    const options = {
        gridRows: 3, gridColumns: 3,
        gridRowLines: [true, true], gridColumnLines: [true, true],
        renderGrid: true, renderCircle: true
    };
    // A 90x90 preview puts the (1,1) intersection at (30, 30).
    const target = findGridCustomiseTarget(30, 30, 90, 90, options);
    assert.deepEqual(target, {type: 'circle', row: 0, column: 0});
});

test('findGridCustomiseTarget falls back to a line when the click is away from any intersection', () => {
    const options = {
        gridRows: 3, gridColumns: 3,
        gridRowLines: [true, true], gridColumnLines: [true, true],
        renderGrid: true, renderCircle: true
    };
    // x=5 is far from both column lines (30, 60), y=60 matches row index 1.
    const target = findGridCustomiseTarget(5, 60, 90, 90, options);
    assert.deepEqual(target, {type: 'row', index: 1});
});

test('findGridCustomiseTarget still targets a disabled line itself (to re-enable it), just never a circle sitting on one', () => {
    const options = {
        gridRows: 3, gridColumns: 3,
        gridRowLines: [false, true], gridColumnLines: [true, true],
        renderGrid: true, renderCircle: true
    };
    // Row 0's line is disabled, so there's no circle to click at (30, 30) -
    // but the (disabled) line itself is still a valid target to re-enable.
    assert.deepEqual(findGridCustomiseTarget(30, 30, 90, 90, options), {type: 'row', index: 0});
});

test('findGridCustomiseTarget finds nothing when both Grid and Circles are disabled', () => {
    const options = {
        gridRows: 3, gridColumns: 3,
        gridRowLines: [true, true], gridColumnLines: [true, true],
        renderGrid: false, renderCircle: false
    };
    assert.equal(findGridCustomiseTarget(30, 30, 90, 90, options), null);
});

test('renderGridCustomiseReference draws everything in the enabled colour when nothing is hidden', () => {
    const ctx = createColourRecordingContext();
    renderGridCustomiseReference(ctx, 90, 90, baseGridOptions());

    // 2 row lines + 2 column lines + 4 circles (a 3x3 grid).
    assert.equal(ctx.strokes.length, 8);
    assert.ok(ctx.strokes.every(colour => colour === '#000000'));
});

test('renderGridCustomiseReference draws a disabled line in grey, everything else unaffected', () => {
    const ctx = createColourRecordingContext();
    renderGridCustomiseReference(ctx, 90, 90, baseGridOptions({gridRowLines: [false, true]}));

    // Both row lines are still drawn (one grey), but row 0's circles are
    // skipped entirely (no crossing to sit on): 2 rows + 2 columns + 2
    // circles (row 1's only) = 6 strokes.
    assert.equal(ctx.strokes.length, 6);
    assert.deepEqual(ctx.strokes, ['#b0b0b0', '#000000', '#000000', '#000000', '#000000', '#000000']);
});

test('renderGridCustomiseReference draws a disabled circle in grey without affecting its crossing lines', () => {
    const ctx = createColourRecordingContext();
    renderGridCustomiseReference(ctx, 90, 90, baseGridOptions({circleLines: [[false, true], [true, true]]}));

    assert.equal(ctx.strokes.length, 8);
    // 2 row + 2 column strokes (all enabled), then 4 circle strokes in
    // row-major order (rowIndex outer, columnIndex inner), the first of
    // which is the disabled one.
    assert.deepEqual(ctx.strokes.slice(0, 4), ['#000000', '#000000', '#000000', '#000000']);
    assert.deepEqual(ctx.strokes.slice(4), ['#b0b0b0', '#000000', '#000000', '#000000']);
});

test('renderGridCustomiseReference draws nothing for an axis whose master toggle is off', () => {
    const gridOffCtx = createColourRecordingContext();
    renderGridCustomiseReference(gridOffCtx, 90, 90, baseGridOptions({renderGrid: false}));
    assert.equal(gridOffCtx.strokes.length, 4, 'only the 4 circles remain');

    const circleOffCtx = createColourRecordingContext();
    renderGridCustomiseReference(circleOffCtx, 90, 90, baseGridOptions({renderCircle: false}));
    assert.equal(circleOffCtx.strokes.length, 4, 'only the 4 lines remain');
});

// A fake canvas context that records drawImage/fillRect calls and the
// globalCompositeOperation in effect at each, so drawPreviewBackground's
// image-vs-plain-fill branching can be asserted without a real canvas.
function createBackgroundRecordingContext() {
    const calls = [];
    return {
        calls,
        fillStyle: null,
        globalCompositeOperation: 'source-over',
        drawImage() { calls.push({type: 'drawImage', op: this.globalCompositeOperation}); },
        fillRect() { calls.push({type: 'fillRect', op: this.globalCompositeOperation, colour: this.fillStyle}); }
    };
}

test('drawPreviewBackground multiplies the computed colour over the photo when enabled and loaded', () => {
    const ctx = createBackgroundRecordingContext();
    const fakeImage = {};
    drawPreviewBackground(ctx, 90, 90, {previewBackgroundImage: true, lineColour: '#ffffff', circleColour: '#ff0000'}, fakeImage);

    assert.deepEqual(ctx.calls.map(c => c.type), ['drawImage', 'fillRect']);
    assert.equal(ctx.calls[0].op, 'source-over', 'the photo itself draws normally');
    assert.equal(ctx.calls[1].op, 'multiply', 'the tint colour multiplies over it');
    assert.equal(ctx.calls[1].colour, computePreviewBackground('#ffffff', '#ff0000'));
    assert.equal(ctx.globalCompositeOperation, 'source-over', 'reset afterwards for subsequent drawing');
});

test('drawPreviewBackground falls back to a plain fill when the toggle is off', () => {
    const ctx = createBackgroundRecordingContext();
    const fakeImage = {};
    drawPreviewBackground(ctx, 90, 90, {previewBackgroundImage: false, lineColour: '#ffffff', circleColour: '#ff0000'}, fakeImage);

    assert.deepEqual(ctx.calls.map(c => c.type), ['fillRect']);
    assert.equal(ctx.calls[0].op, 'source-over');
});

test('drawPreviewBackground falls back to a plain fill when the image has not loaded yet', () => {
    const ctx = createBackgroundRecordingContext();
    drawPreviewBackground(ctx, 90, 90, {previewBackgroundImage: true, lineColour: '#ffffff', circleColour: '#ff0000'}, null);

    assert.deepEqual(ctx.calls.map(c => c.type), ['fillRect']);
});
