const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_OPTIONS,
    MIN_GRID_LINES,
    MAX_GRID_LINES,
    MIN_CIRCLE_RADIUS,
    MIN_PHI_RATIO,
    PHI_RATIO_DECIMALS,
    clampInt,
    clampFloat,
    roundTo,
    minGridLines,
    computeGridLineMinimums,
    resizeLineStates,
    resetLineStates,
    resizeCircleStates,
    resetCircleStates,
    weightedLinePositions,
    smallestWeightedBand,
    computePreviewBackground,
    findGridCustomiseTarget,
    renderGridCustomiseReference,
    drawPreviewBackground,
    listGridCustomiseTargets,
    drawGridCustomiseFocus
} = require('../WebContent/options/options.js');

// A fake canvas context that just records the strokeStyle in effect at each
// stroke() call, in order, so renderGridCustomiseReference's black/grey
// choice can be asserted without a real canvas.
function createColourRecordingContext() {
    let currentStrokeStyle = null;
    const strokes = [];
    const arcRadii = [];
    return {
        strokes,
        arcRadii,
        fillStyle: null,
        fillRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        arc(x, y, radius) { arcRadii.push(radius); },
        stroke() { strokes.push(currentStrokeStyle); },
        set strokeStyle(value) { currentStrokeStyle = value; },
        get strokeStyle() { return currentStrokeStyle; }
    };
}

// A "shape" for a 3x3 equal-thirds weighted grid (see weightedGridStyles in
// options.js) - Grid's own case, and structurally identical to what a Phi
// Grid shape looks like with a different rowWeights/columnWeights.
function baseShape(overrides) {
    return Object.assign({
        linesEnabled: true,
        rowWeights: [1, 1, 1],
        columnWeights: [1, 1, 1],
        rowLines: [true, true],
        columnLines: [true, true],
        circlesEnabled: true,
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

test('clampInt clamps to an optional maximum', () => {
    assert.equal(clampInt('20', MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows, MAX_GRID_LINES), MAX_GRID_LINES);
    assert.equal(clampInt('9', MIN_GRID_LINES, DEFAULT_OPTIONS.gridRows, MAX_GRID_LINES), 9);
});

test('clampFloat parses a decimal value, unlike clampInt which would truncate it', () => {
    assert.equal(clampFloat('0.618', MIN_PHI_RATIO, 1), 0.618);
});

test('clampFloat falls back when the field is blank or not a number', () => {
    assert.equal(clampFloat('', MIN_PHI_RATIO, 1), 1);
    assert.equal(clampFloat('abc', MIN_PHI_RATIO, 1), 1);
});

test('clampFloat clamps to the minimum instead of accepting 0 or negative values', () => {
    assert.equal(clampFloat('0', MIN_PHI_RATIO, 1), MIN_PHI_RATIO);
    assert.equal(clampFloat('-5', MIN_PHI_RATIO, 1), MIN_PHI_RATIO);
});

test('clampFloat leaves the value unrounded when no decimals argument is given', () => {
    assert.equal(clampFloat('0.123456', MIN_PHI_RATIO, 1), 0.123456);
});

test('clampFloat rounds to the given number of decimal places', () => {
    assert.equal(clampFloat('0.123456', MIN_PHI_RATIO, 1, 3), 0.123);
    assert.equal(clampFloat('1', MIN_PHI_RATIO, 1, 3), 1, 'a whole number stays whole, not padded to 1.000');
});

test('roundTo rounds without padding trailing zeros', () => {
    assert.equal(roundTo(1, 3), 1);
    assert.equal(roundTo(0.618, 3), 0.618);
    assert.equal(roundTo(0.61849, 3), 0.618);
    assert.equal(roundTo(0.6185, PHI_RATIO_DECIMALS), 0.619, 'rounds half up, same as Math.round');
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
    const [r, g, b] = computePreviewBackground('#ffffff', '#ffffff', true, true).match(/\d+/g).map(Number);
    assert.ok(r > 150 && g > 150 && b > 150, 'background should read as light, not dark');
});

test('computePreviewBackground is deterministic for the default line/circle colours', () => {
    assert.equal(computePreviewBackground('#ffffff', '#ff0000', true, true), 'rgb(191, 223, 223)');
});

test('computePreviewBackground ignores a disabled circle colour entirely', () => {
    // With circles off, the background should match what a line-only
    // average would give - ie the same as if both colours were the line
    // colour - not be pulled toward the (irrelevant) circle colour.
    const lineOnly = computePreviewBackground('#ffffff', '#ffffff', true, true);
    assert.equal(computePreviewBackground('#ffffff', '#ff0000', true, false), lineOnly);
});

test('computePreviewBackground ignores a disabled line colour entirely', () => {
    const circleOnly = computePreviewBackground('#ff0000', '#ff0000', true, true);
    assert.equal(computePreviewBackground('#ffffff', '#ff0000', false, true), circleOnly);
});

test('computePreviewBackground falls back to plain white when neither is enabled', () => {
    assert.equal(computePreviewBackground('#ffffff', '#ff0000', false, false), '#ffffff');
});

test('weightedLinePositions splits equal weights into even fractions', () => {
    assert.deepEqual(weightedLinePositions([1, 1, 1]), [1 / 3, 2 / 3]);
});

test('smallestWeightedBand finds the narrowest band as a fraction of the whole', () => {
    assert.equal(smallestWeightedBand([1, 1, 1]), 1 / 3);
    assert.ok(Math.abs(smallestWeightedBand([1, 0.618, 1]) - 0.618 / 2.618) < 1e-9);
});

test('findGridCustomiseTarget places intersections according to a Phi Grid ratio, not equal thirds', () => {
    const weights = [1, 0.618, 1];
    const shape = baseShape({rowWeights: weights, columnWeights: weights});
    // A large axis so the Phi ratio's intersection and the equal-thirds
    // position it's being compared against are well outside each other's
    // hit tolerance.
    const size = 900;
    const phiPosition = weightedLinePositions(weights)[0] * size;
    const equalThirdsPosition = size / 3;

    assert.deepEqual(findGridCustomiseTarget(phiPosition, phiPosition, size, size, shape), {type: 'circle', row: 0, column: 0});
    assert.equal(findGridCustomiseTarget(equalThirdsPosition, equalThirdsPosition, size, size, shape), null,
        'the equal-thirds position is not a target for a Phi Grid ratio');
});

test('findGridCustomiseTarget prefers a circle over its own crossing lines when both are within range', () => {
    // A 90x90 preview puts the (1,1) intersection at (30, 30).
    const target = findGridCustomiseTarget(30, 30, 90, 90, baseShape());
    assert.deepEqual(target, {type: 'circle', row: 0, column: 0});
});

test('findGridCustomiseTarget falls back to a line when the click is away from any intersection', () => {
    // x=5 is far from both column lines (30, 60), y=60 matches row index 1.
    const target = findGridCustomiseTarget(5, 60, 90, 90, baseShape());
    assert.deepEqual(target, {type: 'row', index: 1});
});

test('findGridCustomiseTarget still targets a disabled line itself (to re-enable it), just never a circle sitting on one', () => {
    // Row 0's line is disabled, so there's no circle to click at (30, 30) -
    // but the (disabled) line itself is still a valid target to re-enable.
    const shape = baseShape({rowLines: [false, true]});
    assert.deepEqual(findGridCustomiseTarget(30, 30, 90, 90, shape), {type: 'row', index: 0});
});

test('findGridCustomiseTarget finds nothing when both lines and circles are disabled', () => {
    const shape = baseShape({linesEnabled: false, circlesEnabled: false});
    assert.equal(findGridCustomiseTarget(30, 30, 90, 90, shape), null);
});

test('renderGridCustomiseReference draws everything in the enabled colour when nothing is hidden', () => {
    const ctx = createColourRecordingContext();
    renderGridCustomiseReference(ctx, 90, 90, baseShape());

    // 2 row lines + 2 column lines + 4 circles (a 3x3 grid).
    assert.equal(ctx.strokes.length, 8);
    assert.ok(ctx.strokes.every(colour => colour === '#000000'));
});

test('renderGridCustomiseReference draws a disabled line in grey, everything else unaffected', () => {
    const ctx = createColourRecordingContext();
    renderGridCustomiseReference(ctx, 90, 90, baseShape({rowLines: [false, true]}));

    // Both row lines are still drawn (one grey), but row 0's circles are
    // skipped entirely (no crossing to sit on): 2 rows + 2 columns + 2
    // circles (row 1's only) = 6 strokes.
    assert.equal(ctx.strokes.length, 6);
    assert.deepEqual(ctx.strokes, ['#787878', '#000000', '#000000', '#000000', '#000000', '#000000']);
});

test('renderGridCustomiseReference draws a disabled circle in grey without affecting its crossing lines', () => {
    const ctx = createColourRecordingContext();
    renderGridCustomiseReference(ctx, 90, 90, baseShape({circleLines: [[false, true], [true, true]]}));

    assert.equal(ctx.strokes.length, 8);
    // 2 row + 2 column strokes (all enabled), then 4 circle strokes in
    // row-major order (rowIndex outer, columnIndex inner), the first of
    // which is the disabled one.
    assert.deepEqual(ctx.strokes.slice(0, 4), ['#000000', '#000000', '#000000', '#000000']);
    assert.deepEqual(ctx.strokes.slice(4), ['#787878', '#000000', '#000000', '#000000']);
});

test('renderGridCustomiseReference draws nothing for an axis whose master toggle is off', () => {
    const gridOffCtx = createColourRecordingContext();
    renderGridCustomiseReference(gridOffCtx, 90, 90, baseShape({linesEnabled: false}));
    assert.equal(gridOffCtx.strokes.length, 4, 'only the 4 circles remain');

    const circleOffCtx = createColourRecordingContext();
    renderGridCustomiseReference(circleOffCtx, 90, 90, baseShape({circlesEnabled: false}));
    assert.equal(circleOffCtx.strokes.length, 4, 'only the 4 lines remain');
});

test('renderGridCustomiseReference clamps the circle radius to fit the grid cell', () => {
    const ctx = createColourRecordingContext();
    // A 90x90 3x3 grid gives 30x30 cells, so the largest radius that fits
    // without overlap is 15 - circleRadius asks for far more than that.
    renderGridCustomiseReference(ctx, 90, 90, baseShape({circleRadius: 999}));

    assert.ok(ctx.arcRadii.every(r => r === 15), `expected every radius clamped to 15, got ${ctx.arcRadii}`);
});

test('listGridCustomiseTargets lists every line and circle, in row/column/circle order', () => {
    const targets = listGridCustomiseTargets(baseShape());

    assert.deepEqual(targets.map(t => t.type), ['row', 'row', 'column', 'column', 'circle', 'circle', 'circle', 'circle']);
    assert.deepEqual(targets.map(t => t.label), [
        'Row line 1', 'Row line 2', 'Column line 1', 'Column line 2',
        'Circle at row 1, column 1', 'Circle at row 1, column 2',
        'Circle at row 2, column 1', 'Circle at row 2, column 2'
    ]);
});

test('listGridCustomiseTargets still lists a disabled line as a target (to re-enable it)', () => {
    const targets = listGridCustomiseTargets(baseShape({rowLines: [false, true]}));
    const rowTargets = targets.filter(t => t.type === 'row');

    assert.equal(rowTargets[0].enabled, false);
    assert.equal(rowTargets[1].enabled, true);
});

test('listGridCustomiseTargets omits a circle whose crossing line is disabled, even though the line itself is still listed', () => {
    const targets = listGridCustomiseTargets(baseShape({rowLines: [false, true]}));

    assert.equal(targets.filter(t => t.type === 'row').length, 2, 'both row lines remain valid targets');
    assert.equal(targets.filter(t => t.type === 'circle').length, 2, 'row 0 has no crossing to hang a circle on, so only row 1\'s 2 circles remain');
});

test('listGridCustomiseTargets returns no line targets when lines are disabled, independent of circles', () => {
    const targets = listGridCustomiseTargets(baseShape({linesEnabled: false}));

    assert.equal(targets.some(t => t.type === 'row' || t.type === 'column'), false);
    assert.equal(targets.filter(t => t.type === 'circle').length, 4, 'circle visibility does not depend on linesEnabled');
});

test('listGridCustomiseTargets returns no circle targets when circles are disabled', () => {
    const targets = listGridCustomiseTargets(baseShape({circlesEnabled: false}));

    assert.equal(targets.some(t => t.type === 'circle'), false);
});

test('drawGridCustomiseFocus does nothing when there is no target', () => {
    const ctx = createColourRecordingContext();
    drawGridCustomiseFocus(ctx, 90, 90, baseShape(), null);

    assert.equal(ctx.strokes.length, 0);
});

test('drawGridCustomiseFocus strokes a single highlight in the focus colour for a row, column or circle target', () => {
    const shape = baseShape();

    const rowCtx = createColourRecordingContext();
    drawGridCustomiseFocus(rowCtx, 90, 90, shape, {type: 'row', index: 0});
    assert.deepEqual(rowCtx.strokes, ['#26a69a']);

    const columnCtx = createColourRecordingContext();
    drawGridCustomiseFocus(columnCtx, 90, 90, shape, {type: 'column', index: 0});
    assert.deepEqual(columnCtx.strokes, ['#26a69a']);

    const circleCtx = createColourRecordingContext();
    drawGridCustomiseFocus(circleCtx, 90, 90, shape, {type: 'circle', row: 0, column: 0});
    assert.deepEqual(circleCtx.strokes, ['#26a69a']);
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
    drawPreviewBackground(ctx, 90, 90, {previewBackgroundImage: true, lineColour: '#ffffff', circleColour: '#ff0000', renderGrid: true, renderCircle: true}, fakeImage);

    assert.deepEqual(ctx.calls.map(c => c.type), ['drawImage', 'fillRect']);
    assert.equal(ctx.calls[0].op, 'source-over', 'the photo itself draws normally');
    assert.equal(ctx.calls[1].op, 'multiply', 'the tint colour multiplies over it');
    assert.equal(ctx.calls[1].colour, computePreviewBackground('#ffffff', '#ff0000', true, true));
    assert.equal(ctx.globalCompositeOperation, 'source-over', 'reset afterwards for subsequent drawing');
});

test('drawPreviewBackground falls back to a plain fill when the toggle is off', () => {
    const ctx = createBackgroundRecordingContext();
    const fakeImage = {};
    drawPreviewBackground(ctx, 90, 90, {previewBackgroundImage: false, lineColour: '#ffffff', circleColour: '#ff0000', renderGrid: true, renderCircle: true}, fakeImage);

    assert.deepEqual(ctx.calls.map(c => c.type), ['fillRect']);
    assert.equal(ctx.calls[0].op, 'source-over');
});

test('drawPreviewBackground falls back to a plain fill when the image has not loaded yet', () => {
    const ctx = createBackgroundRecordingContext();
    drawPreviewBackground(ctx, 90, 90, {previewBackgroundImage: true, lineColour: '#ffffff', circleColour: '#ff0000', renderGrid: true, renderCircle: true}, null);

    assert.deepEqual(ctx.calls.map(c => c.type), ['fillRect']);
});

test('drawPreviewBackground does not let a disabled circle colour influence the tint', () => {
    const ctx = createBackgroundRecordingContext();
    const fakeImage = {};
    drawPreviewBackground(ctx, 90, 90, {previewBackgroundImage: true, lineColour: '#ffffff', circleColour: '#ff0000', renderGrid: true, renderCircle: false}, fakeImage);

    assert.equal(ctx.calls[1].colour, computePreviewBackground('#ffffff', '#ff0000', true, false));
    assert.equal(ctx.calls[1].colour, computePreviewBackground('#ffffff', '#ffffff', true, true), 'should match a line-only average, unaffected by the disabled circle colour');
});
