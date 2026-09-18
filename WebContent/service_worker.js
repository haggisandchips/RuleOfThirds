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
            target: {tabId: tab.id}, files: ['grid-render.js', 'golden-ratio.js', 'content.js']
        }).catch(() => {
            showToast("Sorry, this page doesn't allow the Rule of Thirds grid to be added.");
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

function showToast(message) {

    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Rule of Thirds',
        message
    });
}