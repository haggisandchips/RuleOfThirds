chrome.runtime.onInstalled.addListener((details) => {
    const reason = details.reason

    switch (reason) {
        case 'update':
            chrome.tabs.create({url:'versions/history.html'});
            break;
        default:
            break;
    }

    // removeAll() first since onInstalled can fire more than once in a
    // dev/reload cycle (and again on every browser update) - create()
    // alone would then fail with a "duplicate id" error on the second
    // and later calls.
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'rule-of-thirds-guide',
            title: 'How to Use',
            contexts: ['action']
        });
    });
});

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'rule-of-thirds-guide') {
        chrome.tabs.create({url: 'guide/guide.html'});
    }
});

chrome.action.onClicked.addListener(tab => {

    // Read fresh on every click rather than once at startup, so a
    // change made in Options takes effect the next time the grid is
    // toggled on - it can't reach into the frames of a tab where the
    // grid is already active, since injection only happens here.
    chrome.storage.sync.get({applyToFrames: false}, ({applyToFrames}) => {
        chrome.scripting.executeScript({
            target: {tabId: tab.id, allFrames: applyToFrames}, files: ['grid-render.js', 'content.js']
        }).catch(() => {
            showRefusalBadge(tab.id);
        });
    });
});

// content.js reports the grid's new on/off state after every toggle, so
// the toolbar icon can reflect whether this specific tab currently has
// the grid applied.
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message && message.type === 'rule-of-thirds-state' && sender.tab && sender.tab.id !== undefined) {
        setActionIcon(sender.tab.id, message.active);
    }
});

// A full page load always drops the content script's own state (a
// fresh document has no #rule-of-thirds element to read), so the icon
// needs to reset in step with it - otherwise it would keep showing
// "active" for a page the grid was never (re-)added to since the last
// load. `changeInfo.url` also covers client-side (pushState) route
// changes on single-page sites (Instagram, Pinterest, X, ...), which
// never go through a 'loading'/'complete' status at all - the SPA's
// own re-render on a route change just as often wipes out the grid
// without the icon ever finding out.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' || changeInfo.url) {
        setActionIcon(tabId, false);
    }
});

function setActionIcon(tabId, active) {

    chrome.action.setIcon({
        tabId,
        path: active
            ? {19: 'icon19.png', 38: 'icon38.png'}
            : {19: 'icon19-inactive.png', 38: 'icon38-inactive.png'}
    });
}

// Refuses to request the "notifications" permission for this one edge case
// (CSP/chrome:// pages that reject script injection) - a badge + tooltip on
// the tab's own toolbar icon gives the same feedback without widening the
// extension's permission footprint.
const REFUSAL_BADGE_TEXT = '!';
const REFUSAL_BADGE_COLOR = '#d32f2f';
const REFUSAL_BADGE_DURATION_MS = 4000;
const REFUSAL_TITLE = "Sorry, this page doesn't allow the Rule of Thirds grid to be added.";
const DEFAULT_TITLE = chrome.runtime.getManifest().action.default_title;

function showRefusalBadge(tabId) {

    chrome.action.setBadgeText({tabId, text: REFUSAL_BADGE_TEXT});
    chrome.action.setBadgeBackgroundColor({tabId, color: REFUSAL_BADGE_COLOR});
    chrome.action.setTitle({tabId, title: REFUSAL_TITLE});

    setTimeout(() => {
        chrome.action.setBadgeText({tabId, text: ''});
        chrome.action.setTitle({tabId, title: DEFAULT_TITLE});
    }, REFUSAL_BADGE_DURATION_MS);
}