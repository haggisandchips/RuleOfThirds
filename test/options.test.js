const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_OPTIONS,
    MIN_GRID_LINES,
    MIN_CIRCLE_RADIUS,
    clampInt
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
