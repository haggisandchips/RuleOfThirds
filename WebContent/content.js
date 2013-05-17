/*
 * License, blah, blah, blah ...
 */

var MIN_SIZE = 50;

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

        if(image.is(':visible') && (w >= MIN_SIZE || h >= MIN_SIZE)) {

            var offset = image.offset();
            var x = offset.left;
            var y = offset.top;

            console.log(w + 'x' + h + ' image found at ' + x + ',' + y);

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

            // Add canvas to div so that we can position as per image
            var holder = document.createElement('div');
            holder.setAttribute('data-extension-id', id);
            holder.appendChild(canvas);

            // Insert holder into document just before image
            image.before(holder);

            // Position canvas holder at the same location as the image and absolutely to not disrupt the page
            holder.style.position = 'absolute';
            holder.style.left = x;
            holder.style.top = y;

            // Allow for padding and margins
            holder.style.paddingLeft = image.css('padding-left');
            holder.style.paddingRight = image.css('padding-right');
            holder.style.paddingTop = image.css('padding-top');
            holder.style.paddingBottom = image.css('padding-bottom');
            holder.style.marginLeft = image.css('margin-left');
            holder.style.marginRight = image.css('margin-right');
            holder.style.marginTop = image.css('margin-top');
            holder.style.marginBottom = image.css('margin-bottom');
        }
    }
}

function removeGrids(id) {

    $("[data-extension-id='" + id + "']").remove();
    $('#' + id).remove();
}

