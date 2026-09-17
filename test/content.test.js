const test = require('node:test');
const assert = require('node:assert/strict');

const {
    resolveImageSrc,
    isMinSize,
    shouldRender,
    sanitizeInt,
    sanitizeOptions,
    hexToRgba
} = require('../WebContent/content.js');

test('resolveImageSrc prefers currentSrc over src', () => {
    assert.equal(
        resolveImageSrc({currentSrc: 'https://example.com/a.jpg', src: 'https://example.com/b.jpg'}),
        'https://example.com/a.jpg'
    );
});

test('resolveImageSrc falls back to src when currentSrc is empty', () => {
    assert.equal(
        resolveImageSrc({currentSrc: '', src: 'https://example.com/b.jpg'}),
        'https://example.com/b.jpg'
    );
});

test('resolveImageSrc never throws for an image with no src at all', () => {
    // This is the bug that used to crash applyGrids() partway through the
    // page whenever an <img> had no literal `src` attribute (srcset-only,
    // lazy-loaded placeholders, etc).
    assert.doesNotThrow(() => resolveImageSrc({currentSrc: '', src: ''}));
});

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
        renderGrid: 'enabled',
        gridRows: '3',
        gridColumns: '',
        lineColour: '#000',
        lineOpacity: '150',
        renderCircle: 'enabled',
        circleColour: '#f00',
        circleOpacity: '-10',
        circleRadius: '-1',
        circleStyle: 'outline'
    });

    assert.deepEqual(result, {
        renderGrid: 'enabled',
        gridRows: 3,
        gridColumns: 3,
        lineColour: '#000',
        lineOpacity: 100,
        renderCircle: 'enabled',
        circleColour: '#f00',
        circleOpacity: 0,
        circleRadius: 1,
        circleStyle: 'outline'
    });
});

test('hexToRgba converts a hex colour and opacity percentage to an rgba() string', () => {
    assert.equal(hexToRgba('#ff0000', 100), 'rgba(255, 0, 0, 1)');
    assert.equal(hexToRgba('#00ff00', 50), 'rgba(0, 255, 0, 0.5)');
    assert.equal(hexToRgba('#0000ff', 0), 'rgba(0, 0, 255, 0)');
});
