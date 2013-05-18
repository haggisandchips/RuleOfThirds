/*
 * License, blah, blah, blah ...
 */

var MIN_SIZE = 100, MIN_SIZE_OTHER = MIN_SIZE / 2;

function toggleGrids(id) {

    if($('#' + id).length == 0) {
        applyGrids(id);
    } else {
        removeGrids(id);
    }
}

function applyGrids(id) {

    // Set flag to indicate that grids have been applied
    var flag = document.createElement('div');
    flag.id = id;
    document.body.appendChild(flag);

    var images = document.getElementsByTagName("img");
    for (var ii = 0; ii < images.length; ii++) {

        var image = $(images[ii]);

        var w = image.width();
        var h = image.height();

        // TODO Determine if image position is 'fixed' (including ancestry) and omit them as well
        if(image.css('visibility') !== 'hidden' && isMinSize(w, h)) {

            var offset = image.offset();
            var w = image.width();
            var h = image.height();
            var x = offset.left;
            var y = offset.top;

            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;

            var ctx = canvas.getContext('2d');
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000';

            // Draw Rule of Thirds grid
            ctx.beginPath();
            ctx.moveTo(0, h/3);
            ctx.lineTo(w, h/3);
            ctx.moveTo(0, 2 * h/3);
            ctx.lineTo(w, 2 * h/3);
            ctx.moveTo(w/3, 0);
            ctx.lineTo(w/3, h);
            ctx.moveTo(2 * w/3, 0);
            ctx.lineTo(2 * w/3, h);
            ctx.stroke();

            // Add circles with glow around the intersections
            var radius = Math.min(w, h) / 50;
            ctx.strokeStyle = '#c00';
            ctx.shadowBlur = radius / 2;
            ctx.shadowColor = '#a00';
            ctx.beginPath();
            ctx.arc(w/3, h/3, radius, 0, 360, true);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(2 * w/3, h/3, radius, 0, 360, true);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(w/3, 2 * h/3, radius, 0, 360, true);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(2 * w/3, 2 * h/3, radius, 0, 360, true);
            ctx.stroke();

            // Add canvas to the image's parent offset by the same amount
            var holder = document.createElement('div');
            holder.appendChild(canvas);
            holder.style.position = 'absolute';
            var parentOffset = image.position();
            holder.style.left = parentOffset.left + parseInt(image.css('border-left-width')) + 'px';
            holder.style.top = parentOffset.top + parseInt(image.css('border-top-width')) + 'px';
            holder.style.padding = image.css('padding');
            holder.style.margin = image.css('margin');
            holder.setAttribute('data-extension-id', id);
            image.offsetParent().append(holder);

            var actualImage = new Image();
            actualImage.onload = function(actualImage, holder) {
                return function() {
                    var minSize = isMinSize(actualImage.width, actualImage.height);
                    if(!minSize) {
                        $(holder).remove();
                    }
                }
            }(actualImage, holder);
            actualImage.src = image.attr('src');
        }
    }
}

function removeGrids(id) {

    $("[data-extension-id='" + id + "']").remove();
    $('#' + id).remove();
}

function isMinSize(w, h) {

    return (w >= MIN_SIZE && h >= MIN_SIZE_OTHER) || (h >= MIN_SIZE && w >= MIN_SIZE_OTHER);
}