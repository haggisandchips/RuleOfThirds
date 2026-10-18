chrome.runtime.onInstalled.addListener((details) => {
    const reason = details.reason

    switch (reason) {
        case 'update':
            chrome.tabs.create({url:'versions/history.html'});
            break;
        default:
            break;
    }

    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'rule-of-thirds-guide',
            title: 'How to Use',
            contexts: ['action']
        });
        createOverlayMenuItems();
    });
});

const OVERLAY_MENU_CONTEXTS = ['all'];

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

    chrome.contextMenus.update('rot-maintain-aspect', {visible: true, enabled: state.resizeEnabled, checked: state.maintainAspectRatio});
    chrome.contextMenus.update('rot-resize-options', {visible: true, enabled: state.resizeEnabled && state.maintainAspectRatio});
    OVERLAY_ASPECT_RATIO_PRESETS.forEach(preset => {
        chrome.contextMenus.update('rot-preset-' + preset.id, {checked: state.aspectRatioPreset === preset.id});
    });
    chrome.contextMenus.update('rot-flip-sep', {visible: true});
    chrome.contextMenus.update('rot-flip-orientation', {visible: true, enabled: state.showFlip, title: state.flipLabel || 'Switch to Portrait'});
    chrome.contextMenus.update('rot-sep2', {visible: true});
    chrome.contextMenus.update('rot-reset', {visible: true});
});

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

const tabActionQueues = new Map();

function enqueueTabAction(tabId, action) {
    const queued = (tabActionQueues.get(tabId) || Promise.resolve()).then(action, action);
    tabActionQueues.set(tabId, queued);
    return queued;
}

const pendingStateReports = new Map();

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

chrome.action.onClicked.addListener(tab => {
    enqueueTabAction(tab.id, () => toggleTab(tab));
});

async function toggleTab(tab) {
    const {applyToFrames} = await new Promise(resolve => chrome.storage.sync.get({applyToFrames: false}, resolve));
    const target = {tabId: tab.id, allFrames: applyToFrames};

    const wasActive = await getTabActive(tab.id);
    const newActive = !wasActive;

    try {
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' || changeInfo.url) {
        setActionIcon(tabId, false);
        enqueueTabAction(tabId, () => clearTabActive(tabId));
    }
});

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