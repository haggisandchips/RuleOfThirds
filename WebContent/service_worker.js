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
        createOverlayMenuItems();
    });
});

// EXPERIMENTAL (feature/native-context-menu): the overlay's own right-click
// menu (Enable Resize, Resize Options, Reset), native instead of a custom
// DOM menu built and positioned by content.js. `contexts: ['all']` rather
// than `['image']` deliberately - the overlay's own container sits on top
// of the image to catch drag/resize pointer events, which would make
// Chrome's own hit-testing resolve a right-click there to our container,
// not the <img> itself, so `'image'` wouldn't reliably match. Relevance is
// instead decided entirely by content.js, same as the custom menu it
// replaces: every item starts hidden, and content.js's own contextmenu
// listener shows/hides and syncs them (see rule-of-thirds-menu-sync below)
// before the native menu renders - a real race (message passing is
// asynchronous, nothing here can block the menu from opening), accepted as
// this experiment's main open question rather than solved outright.
//
// Preset ids/labels/order duplicated from content.js's ASPECT_RATIO_PRESETS
// / orderedAspectRatioPresetIds() - no good way to share code between the
// service worker and an on-demand-injected content script in this
// manifest's setup, and this list changes rarely enough that keeping both
// in sync by hand is an acceptable cost for now.
const OVERLAY_ASPECT_RATIO_PRESETS = [
    {id: 'original', label: 'Original'},
    {id: 'square', label: 'Square'},
    {id: '5x4', label: '5 x 4'},
    {id: '8x6', label: '8 x 6'},
    {id: '7x5', label: '7 x 5'},
    {id: '6x4', label: '6 x 4'},
    {id: '16x9', label: '16 x 9'}
];

function createOverlayMenuItems() {

    chrome.contextMenus.create({
        id: 'rot-enable-resize',
        title: 'Enable Resize',
        type: 'checkbox',
        contexts: ['all'],
        visible: false
    });
    chrome.contextMenus.create({
        id: 'rot-resize-options',
        title: 'Resize Options',
        contexts: ['all'],
        visible: false
    });
    chrome.contextMenus.create({
        id: 'rot-maintain-aspect',
        parentId: 'rot-resize-options',
        title: 'Maintain Aspect Ratio',
        type: 'checkbox',
        contexts: ['all']
    });
    chrome.contextMenus.create({
        id: 'rot-presets-sep',
        parentId: 'rot-resize-options',
        type: 'separator',
        contexts: ['all']
    });
    OVERLAY_ASPECT_RATIO_PRESETS.forEach(preset => {
        chrome.contextMenus.create({
            id: 'rot-preset-' + preset.id,
            parentId: 'rot-resize-options',
            title: preset.label,
            type: 'radio',
            contexts: ['all']
        });
    });
    chrome.contextMenus.create({
        id: 'rot-flip-sep',
        parentId: 'rot-resize-options',
        type: 'separator',
        contexts: ['all'],
        visible: false
    });
    chrome.contextMenus.create({
        id: 'rot-flip-orientation',
        parentId: 'rot-resize-options',
        title: 'Switch to Portrait',
        contexts: ['all'],
        visible: false
    });
    chrome.contextMenus.create({
        id: 'rot-sep2',
        type: 'separator',
        contexts: ['all'],
        visible: false
    });
    chrome.contextMenus.create({
        id: 'rot-reset',
        title: 'Reset',
        contexts: ['all'],
        visible: false
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'rule-of-thirds-guide') {
        chrome.tabs.create({url: 'guide/guide.html'});
        return;
    }
    if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('rot-') && tab && tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, {type: 'rule-of-thirds-menu-action', id: info.menuItemId, checked: info.checked});
    }
});

// content.js's own contextmenu listener (unconditional, like its resize/
// click listeners) sends this on every right-click, win or lose - either
// the full current state for one of its overlays (to sync and reveal the
// items above before the native menu renders), or just {relevant: false}
// to hide them again for a right-click anywhere else on the page, so they
// don't linger visible from the last relevant one.
chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'rule-of-thirds-menu-sync') {
        return;
    }

    if (!message.relevant) {
        ['rot-enable-resize', 'rot-resize-options', 'rot-sep2', 'rot-reset'].forEach(id => {
            chrome.contextMenus.update(id, {visible: false});
        });
        return;
    }

    const state = message.state;
    chrome.contextMenus.update('rot-enable-resize', {visible: true, checked: state.resizeEnabled});
    chrome.contextMenus.update('rot-resize-options', {visible: true});
    chrome.contextMenus.update('rot-maintain-aspect', {checked: state.maintainAspectRatio});
    OVERLAY_ASPECT_RATIO_PRESETS.forEach(preset => {
        chrome.contextMenus.update('rot-preset-' + preset.id, {checked: state.aspectRatioPreset === preset.id});
    });
    chrome.contextMenus.update('rot-flip-sep', {visible: state.showFlip});
    chrome.contextMenus.update('rot-flip-orientation', {visible: state.showFlip, title: state.flipLabel || 'Switch to Portrait'});
    chrome.contextMenus.update('rot-sep2', {visible: true});
    chrome.contextMenus.update('rot-reset', {visible: true});
});

chrome.action.onClicked.addListener(tab => {

    // Read fresh on every click rather than once at startup, so a
    // change made in Options takes effect the next time the overlay is
    // toggled on - it can't reach into the frames of a tab where the
    // overlay is already active, since injection only happens here.
    chrome.storage.sync.get({applyToFrames: false}, ({applyToFrames}) => {
        chrome.scripting.executeScript({
            target: {tabId: tab.id, allFrames: applyToFrames}, files: ['grid-render.js', 'golden-ratio.js', 'content.js']
        }).catch(() => {
            showRefusalBadge(tab.id);
        });
    });
});

// content.js reports the overlay's new on/off state after every toggle, so
// the toolbar icon can reflect whether this specific tab currently has
// the overlay applied.
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message && message.type === 'rule-of-thirds-state' && sender.tab && sender.tab.id !== undefined) {
        setActionIcon(sender.tab.id, message.active);
    }
});

// A full page load always drops the content script's own state (a
// fresh document has no #rule-of-thirds element to read), so the icon
// needs to reset in step with it - otherwise it would keep showing
// "active" for a page the overlay was never (re-)added to since the last
// load. `changeInfo.url` also covers client-side (pushState) route
// changes on single-page sites (Instagram, Pinterest, X, ...), which
// never go through a 'loading'/'complete' status at all - the SPA's
// own re-render on a route change just as often wipes out the overlay
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
const REFUSAL_TITLE = "Sorry, this page doesn't allow the Rule of Thirds overlay to be added.";
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