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

// Draws the grid lines and intersection circles into `ctx`, following the
// same enabled/disabled rules everywhere this is used:
//  - a line only draws while its axis is enabled overall (renderGrid) AND
//    that specific line is enabled (gridRowLines/gridColumnLines);
//  - a circle only draws while Circles is enabled overall (renderCircle)
//    AND the row line and column line it sits on are both enabled AND
//    that specific circle is enabled (circleLines) - independent of
//    whether the grid lines themselves are being rendered.
function drawGridOverlay(ctx, w, h, options) {

    var gridRows = options.gridRows;
    var gridColumns = options.gridColumns;
    var rowLines = options.gridRowLines;
    var columnLines = options.gridColumnLines;

    if (options.renderGrid) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(options.lineColour, options.lineOpacity);

        ctx.beginPath();
        for (var y = 1; y < gridRows; y++) {
            if (rowLines[y - 1]) {
                ctx.moveTo(0, y * h / gridRows);
                ctx.lineTo(w, y * h / gridRows);
            }
        }
        for (var x = 1; x < gridColumns; x++) {
            if (columnLines[x - 1]) {
                ctx.moveTo(x * w / gridColumns, 0);
                ctx.lineTo(x * w / gridColumns, h);
            }
        }
        ctx.stroke();
    }

    if (options.renderCircle) {
        var radius = Math.min(
            (w / gridColumns) / 2,
            (h / gridRows) / 2,
            options.circleRadius);
        ctx.strokeStyle = hexToRgba(options.circleColour, options.circleOpacity);
        ctx.fillStyle = hexToRgba(options.circleColour, options.circleOpacity);

        for (var cx = 1; cx < gridColumns; cx++) {
            for (var cy = 1; cy < gridRows; cy++) {
                if (!columnLines[cx - 1] || !rowLines[cy - 1] || !options.circleLines[cy - 1][cx - 1]) {
                    continue;
                }

                ctx.beginPath();
                ctx.arc(cx * w / gridColumns, cy * h / gridRows, radius, 0, 2 * Math.PI, true);
                if (options.circleStyle === 'filled') {
                    ctx.fill();
                } else {
                    ctx.stroke();
                }
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {hexToRgba, drawGridOverlay};
}
