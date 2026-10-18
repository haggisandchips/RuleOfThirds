

function hexToRgba(hex, opacityPercent) {
    var r = parseInt(hex.substring(1, 3), 16);
    var g = parseInt(hex.substring(3, 5), 16);
    var b = parseInt(hex.substring(5, 7), 16);

    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (opacityPercent / 100) + ')';
}

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

function smallestWeightedBand(weights) {
    var total = 0;
    for (var ii = 0; ii < weights.length; ii++) {
        total += weights[ii];
    }
    return Math.min.apply(null, weights) / total;
}

function drawWeightedGridOverlay(ctx, w, h, rowWeights, columnWeights, options) {
    var rowPositions = weightedLinePositions(rowWeights);
    var columnPositions = weightedLinePositions(columnWeights);

    if (options.linesEnabled) {
        ctx.lineWidth = options.lineWidth;
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

        ctx.lineWidth = 1;
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

function drawGridOverlay(ctx, w, h, options) {
    var rowWeights = new Array(options.gridRows).fill(1);
    var columnWeights = new Array(options.gridColumns).fill(1);

    drawWeightedGridOverlay(ctx, w, h, rowWeights, columnWeights, {
        linesEnabled: options.renderGrid,
        rowLines: options.gridRowLines,
        columnLines: options.gridColumnLines,
        lineColour: options.lineColour,
        lineOpacity: options.lineOpacity,
        lineWidth: options.lineWidth,
        circlesEnabled: options.renderCircle,
        circleLines: options.circleLines,
        circleColour: options.circleColour,
        circleOpacity: options.circleOpacity,
        circleRadius: options.circleRadius,
        circleStyle: options.circleStyle
    });
}

function drawPhiGridOverlay(ctx, w, h, options) {
    drawWeightedGridOverlay(ctx, w, h, options.phiRatio, options.phiRatio, {
        linesEnabled: options.renderPhiGrid,
        rowLines: options.phiRowLines,
        columnLines: options.phiColumnLines,
        lineColour: options.lineColour,
        lineOpacity: options.lineOpacity,
        lineWidth: options.lineWidth,
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
