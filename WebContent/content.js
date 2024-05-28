if (typeof rotInit === 'undefined') {

    console.log('Injecting function');

    const rotInit = function () {

        const MIN_LONG = 100, MIN_SHORT = 50;

        let options;

        const promise = readOptions();

        let controlElement = document.getElementById('rule-of-thirds');
        if (!controlElement) {
            // Add control element
            controlElement = document.createElement('div');
            controlElement.id = 'rule-of-thirds';
            controlElement.setAttribute('active', 'false');
            document.body.appendChild(controlElement);

            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'sync'/* && changes.options?.newValue*/) {
                    console.log('Options changed - refreshing overlays');
                    if (controlElement.getAttribute('active') === 'true') {
                        readOptions().then(() => {
                            removeGrids();
                            applyGrids();
                        })
                    }
                }
            });
        }

        promise.then(toggleGrids);

        async function readOptions() {

            return new Promise((resolve) => {
                chrome.storage.sync.get(
                    {
                        overlayStyle: 'grid',
                        renderGrid: 'enabled',
                        gridRows: 3,
                        gridColumns: 3,
                        lineColour: '#000',
                        renderCircle: 'enabled',
                        circleColour: '#f00',
                        circleRadius: 5
                    },
                    (data) => {
                        options = data;
                        resolve();
                    }
                );
            });
        }

        function toggleGrids() {

            if (controlElement.getAttribute('active') === 'false') {
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
                if (!image.offsetParent) {
                    continue;
                }

                const computedStyle = getComputedStyle(image, null);
                const w = image.width;
                const h = image.height;

                if (shouldRender(computedStyle, w, h)) {
                    const canvas = createCanvas(w, h, image, computedStyle);

                    // Draw Rule of Thirds grid
                    switch (options.overlayStyle) {
                        case 'grid':
                            drawGrid(canvas.getContext('2d'), w, h);
                            break;
                    }

                    image.offsetParent.append(canvas);

                    removeUndersizedImages(canvas, image);
                }
            }

            controlElement.setAttribute('active', 'true');
        }

        function removeGrids() {

            console.log('Removing grids');

            document.querySelectorAll('[data-extension="rule-of-thirds"]').forEach(element => element.remove());
            controlElement.setAttribute('active', 'false');
        }

        function shouldRender(computedStyle, w, h) {

            const visibility = computedStyle['visibility'];
            const display = computedStyle['display'];

            return visibility !== 'hidden' && display !== 'none' && isMinSize(w, h);
        }

        function isMinSize(w, h) {

            return (w >= MIN_LONG && h >= MIN_SHORT) || (h >= MIN_LONG && w >= MIN_SHORT);
        }

        function createCanvas(w, h, image, computedStyle) {

            const canvas = document.createElement('canvas');

            canvas.width = w;
            canvas.height = h;
            canvas.style.overflow = 'hidden';
            canvas.style.position = 'absolute';

            if (image.style['margin'] !== 'auto') {
                canvas.style.left = image.offsetLeft + parseInt(computedStyle.borderLeftWidth) + 'px';
                canvas.style.top = image.offsetTop + parseInt(computedStyle.borderTopWidth) + 'px';
            }
            canvas.style.padding = computedStyle.padding;
            canvas.style.margin = computedStyle.margin;
            canvas.style.overflow = 'hidden';
            canvas.setAttribute('data-extension', 'rule-of-thirds');

            return canvas;
        }

        // TODO It would be better to use this approach before adding the canvas
        //      Also, when does this actually apply?
        function removeUndersizedImages(canvas, image) {

            const actualImage = new Image();

            actualImage.onload = function () {
                return function () {
                    const minSize = isMinSize(actualImage.width, actualImage.height);
                    if (!minSize) {
                        canvas.remove();
                    }
                }
            }();

            actualImage.src = image.attributes.getNamedItem('src').value;
        }

        function drawGrid(ctx, w, h, sections) {

            const gridRows = options.gridRows;
            const gridColumns = options.gridColumns;

            if (options.renderGrid === 'enabled') {
                ctx.lineWidth = 1;
                ctx.strokeStyle = options.lineColour;

                ctx.beginPath();
                for (let y = 1; y < gridRows; y++) {
                    ctx.moveTo(0, y * h / gridRows);
                    ctx.lineTo(w, y * h / gridRows);
                }
                for (let x = 1; x < gridColumns; x++) {
                    ctx.moveTo(x * w / gridColumns, 0);
                    ctx.lineTo(x * w / gridColumns, h);
                }
                ctx.stroke();
            }

            if (options.renderCircle === 'enabled') {
                // Add circles around the intersections
                const radius = Math.min(
                    (w / options.gridColumns) / 2,
                    (h / options.gridRows) / 2,
                    options.circleRadius);
                ctx.strokeStyle = options.circleColour;

                for (let x = 1; x < gridColumns; x++) {
                    for (let y = 1; y < gridRows; y++) {
                        ctx.beginPath();
                        ctx.arc(x * w / gridColumns, y * h / gridRows, radius, 0, 2 * Math.PI, true);
                        ctx.stroke();
                    }
                }
            }
        }
    }

    rotInit();
}