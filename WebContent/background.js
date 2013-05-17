/*
 * License, blah, blah, blah ...
 */
var id = chrome.i18n.getMessage("@@extension_id");

chrome.browserAction.onClicked.addListener(function(tab) {

        // Inject jQuery
        chrome.tabs.executeScript(null, { file: "jquery-1.9.1.min.js" }, function() {

            // Inject content script
            chrome.tabs.executeScript(null, { file: "content.js" }, function() {

                // Toggle the grids
                chrome.tabs.executeScript(null, { code: "toggleGrids('" + id + "')"});
            });
        });
});
