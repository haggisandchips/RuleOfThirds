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
            showToast("Sorry, this page doesn't allow the Rule of Thirds grid to be added.");
        });
    });
} catch (e) {
    console.log(e);
}

function showToast(message) {

    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Rule of Thirds',
        message
    });
}