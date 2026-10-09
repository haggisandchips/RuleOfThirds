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
// menu (Enable Resize, Maintain Aspect Ratio, Aspect Ratios, Reset), native
// instead of a custom DOM menu built and positioned by content.js.
//
// contexts: ['all'] - confirmed live (via a throwaway diagnostic menu item,
// not just theorised) that this is actually necessary: a right-click on the
// overlay's own <canvas> matches neither 'page' nor 'image' (nor, tried as
// one explicit list, every other specific context there is) - only 'all'
// catches it, suggesting 'all' isn't simply the union of the named contexts
// but a true wildcard, and a <canvas> element doesn't positively match any
// of the named ones. 'all' also includes 'action' (the toolbar icon's own
// right-click menu), where these items would be actively misleading (no
// "target image" up there to act on) - tried excluding just 'action' via an
// explicit list instead, which is what broke the canvas case above. Left
// relying on the same default-hidden-until-synced behaviour as everywhere
// else instead: content.js can never sync a "show" for the toolbar icon's
// own context (it's outside any page's DOM), so these only appear there if
// stale visible:true state carried over from an earlier *page* sync - the
// same staleness class as this experiment's main open question below, not
// a new problem contexts filtering could have solved on its own.
//
// Relevance is decided entirely by content.js, same as the custom menu it
// replaces: every item starts hidden, and content.js's own contextmenu/
// mouseover listeners show/hide and sync them (see rule-of-thirds-menu-sync
// below) before the native menu renders - a real race (message passing is
// asynchronous, nothing here can block the menu from opening), accepted as
// this experiment's main open question rather than solved outright.
const OVERLAY_MENU_CONTEXTS = ['all'];

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
        contexts: OVERLAY_MENU_CONTEXTS,
        visible: false
    });
    chrome.contextMenus.create({
        id: 'rot-maintain-aspect',
        title: 'Maintain Aspect Ratio',
        type: 'checkbox',
        contexts: OVERLAY_MENU_CONTEXTS,
        visible: false
    });
    chrome.contextMenus.create({
        id: 'rot-resize-options',
        title: 'Aspect Ratios',
        contexts: OVERLAY_MENU_CONTEXTS,
        visible: false
    });
    OVERLAY_ASPECT_RATIO_PRESETS.forEach(preset => {
        chrome.contextMenus.create({
            id: 'rot-preset-' + preset.id,
            parentId: 'rot-resize-options',
            title: preset.label,
            type: 'radio',
            contexts: OVERLAY_MENU_CONTEXTS
        });
    });
    chrome.contextMenus.create({
        id: 'rot-flip-sep',
        parentId: 'rot-resize-options',
        type: 'separator',
        contexts: OVERLAY_MENU_CONTEXTS,
        visible: false
    });
    chrome.contextMenus.create({
        id: 'rot-flip-orientation',
        parentId: 'rot-resize-options',
        title: 'Switch to Portrait',
        contexts: OVERLAY_MENU_CONTEXTS,
        visible: false
    });
    chrome.contextMenus.create({
        id: 'rot-sep2',
        type: 'separator',
        contexts: OVERLAY_MENU_CONTEXTS,
        visible: false
    });
    chrome.contextMenus.create({
        id: 'rot-reset',
        title: 'Reset',
        contexts: OVERLAY_MENU_CONTEXTS,
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
        ['rot-enable-resize', 'rot-maintain-aspect', 'rot-resize-options', 'rot-sep2', 'rot-reset'].forEach(id => {
            chrome.contextMenus.update(id, {visible: false});
        });
        return;
    }

    const state = message.state;
    chrome.contextMenus.update('rot-enable-resize', {visible: true, checked: state.resizeEnabled});
    // Maintain Aspect Ratio only means anything once Resize itself is on; Aspect Ratios (the
    // preset/flip submenu) one level further still - only worth showing once there's a ratio
    // actually being maintained to apply a preset or flip to.
    chrome.contextMenus.update('rot-maintain-aspect', {visible: state.resizeEnabled, checked: state.maintainAspectRatio});
    chrome.contextMenus.update('rot-resize-options', {visible: state.resizeEnabled && state.maintainAspectRatio});
    OVERLAY_ASPECT_RATIO_PRESETS.forEach(preset => {
        chrome.contextMenus.update('rot-preset-' + preset.id, {checked: state.aspectRatioPreset === preset.id});
    });
    chrome.contextMenus.update('rot-flip-sep', {visible: state.showFlip});
    chrome.contextMenus.update('rot-flip-orientation', {visible: state.showFlip, title: state.flipLabel || 'Switch to Portrait'});
    chrome.contextMenus.update('rot-sep2', {visible: true});
    chrome.contextMenus.update('rot-reset', {visible: true});
});

// --- Per-tab on/off state ---
//
// The service worker, not the page, is the single source of truth for whether a given tab's
// overlay is currently on - chrome.storage.session, keyed per tab, rather than the page's own
// DOM (which content.js used to write an 'active' attribute to and read back on its own next
// injection - mutable, page-script-touchable, and already observed losing other plain JS state
// the same way on some SPA page rebuilds). chrome.storage.session specifically, not a plain
// in-memory Map, so a mid-session MV3 service-worker idle restart doesn't silently forget a tab
// that's still actually showing the overlay.
function tabActiveKey(tabId) {

    return `rot-active-${tabId}`;
}

function getTabActive(tabId) {

    const key = tabActiveKey(tabId);
    return new Promise(resolve => {
        chrome.storage.session.get({[key]: false}, items => resolve(items[key]));
    });
}

function setTabActive(tabId, active) {

    return chrome.storage.session.set({[tabActiveKey(tabId)]: active});
}

function clearTabActive(tabId) {

    return chrome.storage.session.remove(tabActiveKey(tabId));
}

// Every read-decide-write-inject sequence for a tab is chained onto this queue (one promise per
// tab) rather than left to run as soon as it's triggered. A toggle here is an absolute "set to
// X" instruction now, not a self-correcting flip of whatever the page's own DOM said (see
// content.js's applyDesiredState) - unlike a flip, two of these overlapping (eg a fast double-
// click on the toolbar icon, or a click racing a navigation reset) aren't safe to let interleave:
// they could both read the same not-yet-persisted state, both decide the same new state, and
// collapse two toggles into one. `.then(fn, fn)` so one rejected action never wedges every later
// one for that tab.
const tabActionQueues = new Map();

function enqueueTabAction(tabId, action) {

    const queued = (tabActionQueues.get(tabId) || Promise.resolve()).then(action, action);
    tabActionQueues.set(tabId, queued);
    return queued;
}

// Resolved by the rule-of-thirds-state listener below once content.js's own injection has
// actually finished applying the instruction it was given - chaining the queue only on the two
// executeScript calls below isn't enough on its own, since those resolve once the script's
// initial synchronous code has run, not once its own async readOptions()-then-apply chain has:
// two overlapping injections' independent chains could still finish out of order and the
// later-finishing one would silently overwrite whichever one the service worker now believes is
// current. Raced against a timeout so one non-reporting page (eg extensionContextIsValid() false
// mid-chain) can't wedge that tab's queue forever.
const pendingStateReports = new Map();

function timeout(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));
}

chrome.action.onClicked.addListener(tab => {
    enqueueTabAction(tab.id, () => toggleTab(tab));
});

async function toggleTab(tab) {

    // Read fresh on every click rather than once at startup, so a
    // change made in Options takes effect the next time the overlay is
    // toggled on - it can't reach into the frames of a tab where the
    // overlay is already active, since injection only happens here.
    const {applyToFrames} = await new Promise(resolve => chrome.storage.sync.get({applyToFrames: false}, resolve));
    const target = {tabId: tab.id, allFrames: applyToFrames};

    const wasActive = await getTabActive(tab.id);
    const newActive = !wasActive;

    try {
        // Stashed in this injection's own isolated-world global object - invisible to the
        // page's own scripts, unlike the DOM attribute this replaces - and consumed immediately
        // by the files injection right below, so content.js is told what to do rather than
        // having to infer it. A chrome.tabs.sendMessage can't do this job instead: the very
        // first toggle-on for a tab has no content-script listener yet to receive one.
        await chrome.scripting.executeScript({
            target, func: active => { globalThis.__rotPendingActive = active; }, args: [newActive]
        });
        await chrome.scripting.executeScript({
            target, files: ['grid-render.js', 'golden-ratio.js', 'content.js']
        });
    } catch {
        showRefusalBadge(tab.id);
        return;
    }

    await setTabActive(tab.id, newActive);

    await Promise.race([
        new Promise(resolve => pendingStateReports.set(tab.id, {resolve})),
        timeout(2000)
    ]);
}

// content.js reports the overlay's new on/off state after every toggle, so the toolbar icon can
// reflect whether this specific tab currently has the overlay applied - and, if a toggle for
// this tab is currently queued waiting on it (see toggleTab above), lets that queue proceed.
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message && message.type === 'rule-of-thirds-state' && sender.tab && sender.tab.id !== undefined) {
        setActionIcon(sender.tab.id, message.active);

        const pending = pendingStateReports.get(sender.tab.id);
        if (pending) {
            pendingStateReports.delete(sender.tab.id);
            pending.resolve();
        }
    }
});

// A full page load always drops the content script's own state (a fresh document has no
// #rule-of-thirds element, and this tab's own stored state needs resetting in step with it, not
// just the icon - otherwise the next click would believe the tab was still on and turn it "off"
// instead of on). `changeInfo.url` also covers client-side (pushState) route changes on
// single-page sites (Instagram, Pinterest, X, ...), which never go through a
// 'loading'/'complete' status at all - the SPA's own re-render on a route change just as often
// wipes out the overlay without anything else finding out. Routed through the same per-tab
// queue as a click, so a slow in-flight toggle can't finish after this and leave stale state
// behind; the icon reset itself stays outside the queue, since it's cosmetic (no stored state to
// corrupt) and should happen immediately rather than wait behind an in-flight click.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' || changeInfo.url) {
        setActionIcon(tabId, false);
        enqueueTabAction(tabId, () => clearTabActive(tabId));
    }
});

// Same reasoning as the onUpdated reset above - a closed tab can't possibly still be "on" from
// this extension's point of view. Not also deleting tabId's own entry from tabActionQueues/
// pendingStateReports - tab ids are never reused by Chrome, so those maps only grow within one
// service-worker lifetime, already bounded by MV3's own idle-restart cycle.
chrome.tabs.onRemoved.addListener(tabId => {
    enqueueTabAction(tabId, () => clearTabActive(tabId));
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