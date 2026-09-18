try {
    chrome.runtime.onInstalled.addListener((details) => {
        const currentVersion = chrome.runtime.getManifest().version
        const previousVersion = details.previousVersion
        const reason = details.reason

        console.log(`Previous Version: ${previousVersion }`)
        console.log(`Current Version: ${currentVersion }`)

        switch (reason) {
            case 'update':
                chrome.tabs.create({url:'versions/history.html'});
                break;
            default:
                break;
        }

    });

    chrome.action.onClicked.addListener(tab => {

        console.log("Browser action clicked");

        chrome.scripting.executeScript({
            target: {tabId: tab.id}, files: ['grid-render.js', 'content.js']
        }).catch(() => {
            showRefusalBadge(tab.id);
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

    // A page load always drops the content script's own state (a fresh
    // document has no #rule-of-thirds element to read), so the icon needs
    // to reset in step with it - otherwise it would keep showing "active"
    // for a page the grid was never (re-)added to since the last load.
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === 'loading') {
            setActionIcon(tabId, false);
        }
    });
} catch (e) {
    console.log(e);
}

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