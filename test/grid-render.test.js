const test = require('node:test');
const assert = require('node:assert/strict');

const {hexToRgba, drawGridOverlay} = require('../WebContent/grid-render.js');

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
