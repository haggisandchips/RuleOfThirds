/*
 * License, blah, blah, blah ...
 */
var id = chrome.i18n.getMessage("@@extension_id");

chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.executeScript(null, { file: "jquery-1.9.1.min.js" }, function() {
        chrome.tabs.executeScript(null, { file: "content.js" });
    });
});
