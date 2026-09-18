const test = require('node:test');
const assert = require('node:assert/strict');

const {PHI, calculateSections, configureControl} = require('../WebContent/golden-ratio.js');

test('configureControl anchors the initial rotation to the chosen starting corner', () => {
    assert.equal(configureControl('clockwise', 'bottom-left', 100, 60).initialRotation, 2);
    assert.equal(configureControl('clockwise', 'top-left', 100, 60).initialRotation, 3);
    assert.equal(configureControl('clockwise', 'top-right', 100, 60).initialRotation, 0);
    assert.equal(configureControl('clockwise', 'bottom-right', 100, 60).initialRotation, 1);
});

test('configureControl flips counterClockwise based on direction', () => {
    assert.equal(configureControl('clockwise', 'bottom-left', 100, 60).counterClockwise, false);
    assert.equal(configureControl('counter-clockwise', 'bottom-left', 100, 60).counterClockwise, true);
});

test('calculateSections produces 13 sections, each shrinking by PHI from the last', () => {
    const sections = calculateSections('clockwise', 'bottom-left', 100, 60);

    assert.equal(sections.length, 13);

    for (let ii = 1; ii < sections.length; ii++) {
        assert.ok(Math.abs(sections[ii - 1].width / sections[ii].width - PHI) < 1e-9);
        assert.ok(Math.abs(sections[ii - 1].height / sections[ii].height - PHI) < 1e-9);
    }
});

test('calculateSections rotates through all 4 quadrants in order for a clockwise spiral', () => {
    const sections = calculateSections('clockwise', 'top-left', 100, 60);

    for (let ii = 1; ii < sections.length; ii++) {
        assert.equal(sections[ii].rotation, (sections[ii - 1].rotation + 1) % 4);
    }
});

test('calculateSections rotates backwards through quadrants for a counter-clockwise spiral', () => {
    const sections = calculateSections('counter-clockwise', 'top-left', 100, 60);

    for (let ii = 1; ii < sections.length; ii++) {
        assert.equal(sections[ii].rotation, (sections[ii - 1].rotation + 3) % 4);
    }
});
