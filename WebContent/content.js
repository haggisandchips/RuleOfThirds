if (typeof rotInit === 'undefined') {

    console.log('Injecting function');

    const rotInit = function () {

        const MIN_LONG = 100, MIN_SHORT = 50;

        let controlElement = document.getElementById('rule-of-thirds');

        if (!controlElement) {

            // Add control element
            controlElement = document.createElement('div');
            controlElement.id = 'rule-of-thirds';
            controlElement.setAttribute('grids', 'false');
            document.body.appendChild(controlElement);

            chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

                console.log('Received message: ' + JSON.stringify(request));

                if (request.command === 'TOGGLE_ROT') {
                    toggleGrids();
                    sendResponse('TOGGLED');
                }
            });
        }

        function toggleGrids() {

            if (controlElement.getAttribute('grids') === 'false') {
                applyGrids();
            } else {
                removeGrids();
            }
        }

        function applyGrids() {

            console.log('Applying grids');

            const images = document.getElementsByTagName('img');
            for (let ii = 0; ii < images.length; ii++) {

                const image = images[ii];

                let w = image.width;
                let h = image.height;

                const computedStyle = getComputedStyle(image, null);
                const visibility = computedStyle['visibility'];
                const display = computedStyle['display'];

                if (visibility !== 'hidden' && display !== 'none' && isMinSize(w, h)) {

                    w = image.width;
                    h = image.height;

                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;

                    const ctx = canvas.getContext('2d');
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = '#000';

                    // Draw Rule of Thirds grid
                    ctx.beginPath();
                    ctx.moveTo(0, h / 3);
                    ctx.lineTo(w, h / 3);
                    ctx.moveTo(0, 2 * h / 3);
                    ctx.lineTo(w, 2 * h / 3);
                    ctx.moveTo(w / 3, 0);
                    ctx.lineTo(w / 3, h);
                    ctx.moveTo(2 * w / 3, 0);
                    ctx.lineTo(2 * w / 3, h);
                    ctx.stroke();

                    // Add circles with glow around the intersections
                    var radius = Math.min(w, h) / 50;
                    ctx.strokeStyle = '#c00';
                    ctx.shadowBlur = radius / 2;
                    ctx.shadowColor = '#a00';
                    ctx.beginPath();
                    ctx.arc(w / 3, h / 3, radius, 0, 2 * Math.PI, true);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(2 * w / 3, h / 3, radius, 0, 2 * Math.PI, true);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(w / 3, 2 * h / 3, radius, 0, 2 * Math.PI, true);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(2 * w / 3, 2 * h / 3, radius, 0, 2 * Math.PI, true);
                    ctx.stroke();

                    // Add canvas to the image's parent offset by the same amount
                    const holder = document.createElement('div');
                    holder.appendChild(canvas);
                    holder.style.position = 'absolute';
                    holder.style.left = image.offsetLeft + parseInt(computedStyle.borderLeftWidth) + 'px';
                    holder.style.top = image.offsetTop + parseInt(computedStyle.borderTopWidth) + 'px';
                    holder.style.padding = computedStyle.padding;
                    holder.style.margin = computedStyle.margin;
                    holder.setAttribute('data-extension', 'rule-of-thirds');

                    const parentElement = image.offsetParent ? image.offsetParent : document.body;
                    parentElement.append(holder);

                    const actualImage = new Image();
                    actualImage.onload = function (actualImage, holder) {
                        return function () {
                            const minSize = isMinSize(actualImage.width, actualImage.height);
                            if (!minSize) {
                                holder.remove();
                            }
                        }
                    }(actualImage, holder);
                    actualImage.src = image.attributes.getNamedItem('src').value;
                }

                controlElement.setAttribute('grids', 'true');
            }
        }

        function removeGrids() {

            console.log('Removing grids');

            document.querySelectorAll('[data-extension="rule-of-thirds"]').forEach(element => element.remove());
            controlElement.setAttribute('grids', 'false');
        }

        function isMinSize(w, h) {

            return (w >= MIN_LONG && h >= MIN_SHORT) || (h >= MIN_LONG && w >= MIN_SHORT);
        }
    }
    rotInit();
}