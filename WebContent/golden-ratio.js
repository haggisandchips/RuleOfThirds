// Pure golden-ratio spiral geometry, hoisted out to its own file so it can
// be shared between the content script (the full-size overlay) and the
// options page (the direction/starting-point thumbnail previews) without
// duplicating the algorithm, and unit tested without a DOM (see /test).
//
// `var` and `function` (unlike `const`/`class`) are safe to redeclare if
// this file is injected into the same page more than once - the content
// script re-injects it on every toolbar-icon click without a page reload,
// and a `const`/`class` redeclaration throws instead of just re-running.

var PHI = 1.618;
var QUARTER_TURN = Math.PI / 2;
var GOLDEN_RATIO_DEPTH = 13;

function Rectangle(x, y, width, height, rotation, counterClockwise) {

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rotation = rotation;
    this.counterClockwise = counterClockwise;
}

function Control(initialRotation, counterClockwise, width, height, x, y) {

    this.initialRotation = initialRotation;
    this.counterClockwise = counterClockwise;
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
}

function configureControl(direction, start, w, h) {

    const style = start + '-' + direction;

    switch (style) {
        case 'bottom-left-clockwise':
            return new Control(2, false, w, h * PHI, w, h);
        case 'top-left-clockwise':
            return new Control(3, false, w * PHI, h, 0, h);
        case 'top-right-clockwise':
            return new Control(0, false, w, h * PHI, 0, 0);
        case 'bottom-right-clockwise':
            return new Control(1, false, w * PHI, h, w, 0);
        case 'bottom-left-counter-clockwise':
            return new Control(0, true, w * PHI, h, 0, 0);
        case 'bottom-right-counter-clockwise':
            return new Control(3, true, w, h * PHI, 0, h);
        case 'top-right-counter-clockwise':
            return new Control(2, true, w * PHI, h, w, h);
        case 'top-left-counter-clockwise':
            return new Control(1, true, w, h * PHI, w, 0);
        default:
            // direction/start are validated as an enum by content.js's
            // sanitizeOptions before they ever reach here in the real
            // overlay, but this file is also called directly by the
            // options page's thumbnails (fixed, always-valid data
            // attributes) - falls back to the same default as a
            // freshly-installed extension (bottom-left-clockwise) rather
            // than returning undefined for calculateSections to crash on.
            return new Control(2, false, w, h * PHI, w, h);
    }
}

function calculateSections(direction, start, w, h) {

    const control = configureControl(direction, start, w, h);

    let rotation = control.initialRotation,
        width = control.width,
        height = control.height,
        x = control.x,
        y = control.y;

    const sections = [];
    for (let ii = 0; ii < GOLDEN_RATIO_DEPTH; ii++) {

        const sectionWidth = width / PHI;
        const sectionHeight = height / PHI;

        switch (rotation) {
            case 0:
                if (control.counterClockwise) {
                    y = y + (height - sectionHeight);
                } else {
                    x = x + (width - sectionWidth);
                }
                break;
            case 1:
                if (control.counterClockwise) {
                    x = x - (width - sectionWidth);
                } else {
                    y = y + (height - sectionHeight);
                }
                break;
            case 2:
                if (control.counterClockwise) {
                    y = y - (height - sectionHeight);
                } else {
                    x = x - (width - sectionWidth);
                }
                break;
            case 3:
                if (control.counterClockwise) {
                    x = x + (width - sectionWidth);
                } else {
                    y = y - (height - sectionHeight);
                }
                break;
        }

        sections.push(new Rectangle(x, y, sectionWidth, sectionHeight, rotation, control.counterClockwise));

        width = sectionWidth;
        height = sectionHeight;
        rotation = (control.counterClockwise ? rotation + 3 : rotation + 1) % 4;
    }

    return sections;
}

// Traces the spiral into `ctx` as a path - the caller sets strokeStyle/
// lineWidth and calls ctx.stroke(), so this is reusable for both the
// full-size overlay and the small options-page preview thumbnails.
function traceGoldenSpiralPath(ctx, w, h, direction, start) {

    const sections = calculateSections(direction, start, w - 2, h - 2);

    ctx.beginPath();

    sections.forEach(section => {
        let startRotation, endRotation;
        if (section.counterClockwise) {
            endRotation = section.rotation;
            startRotation = (endRotation + 5) % 4;
        } else {
            startRotation = section.rotation;
            endRotation = (startRotation + 1) % 4;
        }

        const x = section.x + 1, y = section.y + 1;

        ctx.ellipse(x, y, section.width, section.height, 0, startRotation * QUARTER_TURN, endRotation * QUARTER_TURN, section.counterClockwise);
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {PHI, QUARTER_TURN, GOLDEN_RATIO_DEPTH, configureControl, calculateSections, traceGoldenSpiralPath};
}
