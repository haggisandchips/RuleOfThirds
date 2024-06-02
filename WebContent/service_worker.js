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
            target: {tabId: tab.id}, files: ['content.js']
        });
    });
} catch (e) {
    console.log(e);
}