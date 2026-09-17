const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_OPTIONS,
    MIN_GRID_LINES,
    MIN_CIRCLE_RADIUS,
    clampInt,
    minGridLines,
    computeGridLineMinimums
} = require('../WebContent/options/options.js');

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
