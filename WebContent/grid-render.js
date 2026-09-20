// Pure grid+circle overlay rendering, shared between the content script (the
// full-size overlay drawn onto a page's images) and the options page (the
// "Customise" preview), so both draw from exactly the same rules instead of
// two copies that can drift apart.
//
// `var` and `function` (unlike `const`/`class`) are safe to redeclare if
// this file is injected into the same page more than once - the content
// script re-injects it on every toolbar-icon click without a page reload.

// Converts a "#rrggbb" colour plus a 0-100 opacity percentage into an
// rgba() string a canvas context can use directly as a strokeStyle/fillStyle.
function hexToRgba(hex, opacityPercent) {

    var r = parseInt(hex.substring(1, 3), 16);
    var g = parseInt(hex.substring(3, 5), 16);
    var b = parseInt(hex.substring(5, 7), 16);

    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (opacityPercent / 100) + ')';
}

// Converts a weights array (relative band sizes - eg [1, 1, 1] for equal
// thirds, or [1, 0.618, 1] for a Phi Grid) into the fractional (0..1)
// positions, along that axis, of the dividing lines between those bands.
function weightedLinePositions(weights) {

    var total = 0;
    for (var ii = 0; ii < weights.length; ii++) {
        total += weights[ii];
    }

    var positions = [];
    var cumulative = 0;
    for (var ii = 0; ii < weights.length - 1; ii++) {
        cumulative += weights[ii];
        positions.push(cumulative / total);
    }
    return positions;
}

// The smallest band in a weights array, as a fraction of the full axis
// length - used to size circles so they never overlap a neighbouring line
// even when the bands aren't all equal (eg a Phi Grid's narrower centre
// band), generalising the equal-grid case's simple `1 / count`.
function smallestWeightedBand(weights) {

    var total = 0;
    for (var ii = 0; ii < weights.length; ii++) {
        total += weights[ii];
    }
    return Math.min.apply(null, weights) / total;
}

// Shared by every "weighted grid" overlay style (see drawGridOverlay/
// drawPhiGridOverlay below - Grid's equal thirds is just the special case
// where every weight is 1) - draws dividing lines and intersection circles
// from row/column weight arrays instead of assuming equal spacing,
// following the same enabled/disabled rules everywhere this is used:
//  - a line only draws while its axis is enabled overall (linesEnabled) AND
//    that specific line is enabled (rowLines/columnLines);
//  - a circle only draws while Circles is enabled overall (circlesEnabled)
//    AND the row line and column line it sits on are both enabled AND
//    that specific circle is enabled (circleLines) - independent of
//    whether the dividing lines themselves are being rendered.
function drawWeightedGridOverlay(ctx, w, h, rowWeights, columnWeights, options) {

    var rowPositions = weightedLinePositions(rowWeights);
    var columnPositions = weightedLinePositions(columnWeights);

    if (options.linesEnabled) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(options.lineColour, options.lineOpacity);

        ctx.beginPath();
        rowPositions.forEach(function (frac, index) {
            if (options.rowLines[index]) {
                ctx.moveTo(0, frac * h);
                ctx.lineTo(w, frac * h);
            }
        });
        columnPositions.forEach(function (frac, index) {
            if (options.columnLines[index]) {
                ctx.moveTo(frac * w, 0);
                ctx.lineTo(frac * w, h);
            }
        });
        ctx.stroke();
    }

    if (options.circlesEnabled) {
        var radius = Math.min(
            (smallestWeightedBand(rowWeights) * h) / 2,
            (smallestWeightedBand(columnWeights) * w) / 2,
            options.circleRadius);
        ctx.strokeStyle = hexToRgba(options.circleColour, options.circleOpacity);
        ctx.fillStyle = hexToRgba(options.circleColour, options.circleOpacity);

        columnPositions.forEach(function (cxFrac, columnIndex) {
            rowPositions.forEach(function (cyFrac, rowIndex) {
                if (!options.columnLines[columnIndex] || !options.rowLines[rowIndex] || !options.circleLines[rowIndex][columnIndex]) {
                    return;
                }

                ctx.beginPath();
                ctx.arc(cxFrac * w, cyFrac * h, radius, 0, 2 * Math.PI, true);
                if (options.circleStyle === 'filled') {
                    ctx.fill();
                } else {
                    ctx.stroke();
                }
            });
        });
    }
}

// Grid: dividing lines/circles spaced in equal bands (however many rows/
// columns are configured) - the special case of drawWeightedGridOverlay
// where every band is the same size.
function drawGridOverlay(ctx, w, h, options) {

    var rowWeights = new Array(options.gridRows).fill(1);
    var columnWeights = new Array(options.gridColumns).fill(1);

    drawWeightedGridOverlay(ctx, w, h, rowWeights, columnWeights, {
        linesEnabled: options.renderGrid,
        rowLines: options.gridRowLines,
        columnLines: options.gridColumnLines,
        lineColour: options.lineColour,
        lineOpacity: options.lineOpacity,
        circlesEnabled: options.renderCircle,
        circleLines: options.circleLines,
        circleColour: options.circleColour,
        circleOpacity: options.circleOpacity,
        circleRadius: options.circleRadius,
        circleStyle: options.circleStyle
    });
}

// Phi Grid: fixed at 3 bands per axis (see options.phiRatio), spaced by the
// same ratio in both directions instead of equal thirds - eg the classic
// "Phi Grid" composition guide's default 1 : 0.618 : 1. Circles reuse
// exactly the same appearance settings as Grid's Circles section.
function drawPhiGridOverlay(ctx, w, h, options) {

    drawWeightedGridOverlay(ctx, w, h, options.phiRatio, options.phiRatio, {
        linesEnabled: options.renderPhiGrid,
        rowLines: options.phiRowLines,
        columnLines: options.phiColumnLines,
        lineColour: options.lineColour,
        lineOpacity: options.lineOpacity,
        circlesEnabled: options.renderCircle,
        circleLines: options.phiCircleLines,
        circleColour: options.circleColour,
        circleOpacity: options.circleOpacity,
        circleRadius: options.circleRadius,
        circleStyle: options.circleStyle
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        hexToRgba, weightedLinePositions, smallestWeightedBand,
        drawWeightedGridOverlay, drawGridOverlay, drawPhiGridOverlay
    };
}
