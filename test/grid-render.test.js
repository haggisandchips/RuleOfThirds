const test = require('node:test');
const assert = require('node:assert/strict');

const {hexToRgba, weightedLinePositions, smallestWeightedBand, drawGridOverlay, drawPhiGridOverlay} = require('../WebContent/grid-render.js');

test('hexToRgba converts a hex colour and opacity percentage to an rgba() string', () => {
    assert.equal(hexToRgba('#ff0000', 100), 'rgba(255, 0, 0, 1)');
    assert.equal(hexToRgba('#00ff00', 50), 'rgba(0, 255, 0, 0.5)');
    assert.equal(hexToRgba('#0000ff', 0), 'rgba(0, 0, 255, 0)');
});

// A minimal fake canvas context that just records which drawing calls were
// made, so drawGridOverlay's enabled/disabled rules can be asserted without
// a real DOM/canvas.
function createRecordingContext() {
    return {
        calls: {moveTo: 0, lineTo: 0, arc: 0, stroke: 0, fill: 0},
        arcRadii: [],
        beginPath() {},
        moveTo() { this.calls.moveTo++; },
        lineTo() { this.calls.lineTo++; },
        arc(x, y, radius) { this.calls.arc++; this.arcRadii.push(radius); },
        stroke() { this.calls.stroke++; },
        fill() { this.calls.fill++; }
    };
}

function baseOptions(overrides) {
    return Object.assign({
        renderGrid: true,
        gridRows: 3,
        gridColumns: 3,
        gridRowLines: [true, true],
        gridColumnLines: [true, true],
        lineColour: '#ffffff',
        lineOpacity: 100,
        renderCircle: true,
        circleColour: '#ff0000',
        circleOpacity: 100,
        circleRadius: 5,
        circleStyle: 'outline',
        circleLines: [[true, true], [true, true]]
    }, overrides);
}

test('drawGridOverlay draws a circle at every intersection when everything is enabled', () => {
    const ctx = createRecordingContext();
    drawGridOverlay(ctx, 90, 90, baseOptions());

    assert.equal(ctx.calls.arc, 4, 'a 3x3 grid has 4 intersections');
    assert.equal(ctx.calls.stroke > 0, true);
    assert.equal(ctx.calls.fill, 0, 'outline circles use stroke, not fill');
});

test('drawGridOverlay fills circles instead of stroking them when circleStyle is filled', () => {
    const ctx = createRecordingContext();
    drawGridOverlay(ctx, 90, 90, baseOptions({circleStyle: 'filled'}));

    assert.equal(ctx.calls.arc, 4, 'a 3x3 grid has 4 intersections');
    assert.equal(ctx.calls.fill, 4, 'every circle is filled');
    assert.equal(ctx.calls.stroke, 1, 'only the grid lines stroke - the filled circles do not');
});

test('drawGridOverlay clamps the circle radius to fit the grid cell', () => {
    const ctx = createRecordingContext();
    // A 90x90 3x3 grid gives 30x30 cells, so the largest radius that fits
    // without overlap is 15 - circleRadius asks for far more than that.
    drawGridOverlay(ctx, 90, 90, baseOptions({circleRadius: 999}));

    assert.ok(ctx.arcRadii.every(r => r === 15), `expected every radius clamped to 15, got ${ctx.arcRadii}`);
});

test('drawGridOverlay uses circleRadius as-is when it already fits the cell', () => {
    const ctx = createRecordingContext();
    drawGridOverlay(ctx, 90, 90, baseOptions({circleRadius: 3}));

    assert.ok(ctx.arcRadii.every(r => r === 3), `expected every radius to stay 3, got ${ctx.arcRadii}`);
});

test('drawGridOverlay skips a circle whose own circleLines entry is disabled', () => {
    const ctx = createRecordingContext();
    drawGridOverlay(ctx, 90, 90, baseOptions({circleLines: [[false, true], [true, true]]}));

    assert.equal(ctx.calls.arc, 3);
});

test('drawGridOverlay skips a circle whose row/column line is disabled, even if circleLines allows it', () => {
    const ctx = createRecordingContext();
    drawGridOverlay(ctx, 90, 90, baseOptions({gridRowLines: [false, true]}));

    assert.equal(ctx.calls.arc, 2, 'only the row that still has an enabled line keeps its 2 circles');
});

test('drawGridOverlay draws no circles at all when Circles is disabled', () => {
    const ctx = createRecordingContext();
    drawGridOverlay(ctx, 90, 90, baseOptions({renderCircle: false}));

    assert.equal(ctx.calls.arc, 0);
});

test('drawGridOverlay draws no lines at all when the grid is disabled, independent of circles', () => {
    const ctx = createRecordingContext();
    drawGridOverlay(ctx, 90, 90, baseOptions({renderGrid: false}));

    assert.equal(ctx.calls.moveTo, 0);
    assert.equal(ctx.calls.lineTo, 0);
    assert.equal(ctx.calls.arc, 4, 'circle visibility does not depend on renderGrid');
});

test('weightedLinePositions splits equal weights into even fractions', () => {
    assert.deepEqual(weightedLinePositions([1, 1, 1]), [1 / 3, 2 / 3]);
});

test('weightedLinePositions places lines according to a Phi Grid ratio', () => {
    const positions = weightedLinePositions([1, 0.618, 1]);
    const total = 2.618;

    assert.ok(Math.abs(positions[0] - 1 / total) < 1e-9);
    assert.ok(Math.abs(positions[1] - 1.618 / total) < 1e-9);
});

test('smallestWeightedBand finds the narrowest band as a fraction of the whole', () => {
    assert.equal(smallestWeightedBand([1, 1, 1]), 1 / 3);
    assert.ok(Math.abs(smallestWeightedBand([1, 0.618, 1]) - 0.618 / 2.618) < 1e-9);
});

function basePhiOptions(overrides) {
    return Object.assign({
        renderPhiGrid: true,
        phiRatio: [1, 0.618, 1],
        phiRowLines: [true, true],
        phiColumnLines: [true, true],
        lineColour: '#ffffff',
        lineOpacity: 100,
        renderCircle: true,
        circleColour: '#ff0000',
        circleOpacity: 100,
        circleRadius: 5,
        circleStyle: 'outline',
        phiCircleLines: [[true, true], [true, true]]
    }, overrides);
}

test('drawPhiGridOverlay draws a circle at every intersection when everything is enabled', () => {
    const ctx = createRecordingContext();
    drawPhiGridOverlay(ctx, 90, 90, basePhiOptions());

    assert.equal(ctx.calls.arc, 4, 'a 3x3 Phi Grid has 4 intersections, same as a 3x3 Grid');
    assert.equal(ctx.calls.stroke > 0, true);
});

test('drawPhiGridOverlay draws no lines at all when disabled, independent of circles', () => {
    const ctx = createRecordingContext();
    drawPhiGridOverlay(ctx, 90, 90, basePhiOptions({renderPhiGrid: false}));

    assert.equal(ctx.calls.moveTo, 0);
    assert.equal(ctx.calls.arc, 4, 'circle visibility does not depend on renderPhiGrid');
});

test('drawPhiGridOverlay clamps the circle radius to the narrower centre band, not the outer bands', () => {
    const ctx = createRecordingContext();
    // A 0.618-weighted centre band out of a 2.618 total, over a 90px axis,
    // is ~21.24px wide - half that (~10.62) is the largest radius that
    // fits without overlapping a neighbouring line.
    drawPhiGridOverlay(ctx, 90, 90, basePhiOptions({circleRadius: 999}));

    const expectedRadius = (0.618 / 2.618 * 90) / 2;
    assert.ok(ctx.arcRadii.every(r => Math.abs(r - expectedRadius) < 1e-9), `expected every radius clamped to ~${expectedRadius}, got ${ctx.arcRadii}`);
});

test('drawPhiGridOverlay skips a circle whose own phiCircleLines entry is disabled', () => {
    const ctx = createRecordingContext();
    drawPhiGridOverlay(ctx, 90, 90, basePhiOptions({phiCircleLines: [[false, true], [true, true]]}));

    assert.equal(ctx.calls.arc, 3);
});
