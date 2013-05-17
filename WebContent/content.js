/*
 * License, blah, blah, blah ...
 */
var MIN_SIZE = 50;

// TODO Move this to a function call

var images = document.getElementsByTagName("img");
for (var ii = 0; ii < images.length; ii++) {

    var image = $(images[ii]);
    var w = image.width();
    var h = image.height();

    if(image.is(':visible') && (w >= MIN_SIZE || h >= MIN_SIZE)) {

        // Outline the image so I can see which images are being processed
        image.css('outline', '#fff solid 1px');

        var offset = image.offset();
        var x = offset.left;
        var y = offset.top;

        console.log(w + 'x' + h + ' image found at ' + x + ',' + y);

        var canvas = document.createElement('canvas');

        // TODO Will <img> sizes always match the image itself - what if there is a margin?

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

        // calc size for intersection highlight (2% of shortest image dimension)
        var radius = Math.min(w, h) / 50;

        // thick dark red
        ctx.strokeStyle = '#c00';

        // Add 'glow'
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


        // TODO Add circles with glow around the intersections

        // Add canvas to div so that we can position as per image
        var holder = document.createElement('div');
        // TODO holder.setAttribute('data-extension-id', id);
        holder.appendChild(canvas);

        // Insert holder into document just before image
        image.before(holder);

        // TODO Add listener to image so we can remove canvas if image is hidden, moves or resizes

        // TODO What about z-index?

        // TODO What if image is positioned as well?
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

// TODO Add function call to remove all grids (use extension id)
// Background script should then implement toggle functionality to call the two functions alternately (and style browser button)