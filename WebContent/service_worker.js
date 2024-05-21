try {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {

            console.log('Injecting scripts.');

            chrome.scripting.executeScript({
                target: {tabId: tab.id}, files: ['content.js']
            });
        }
    });

    chrome.action.onClicked.addListener(tab => {

        console.log("Browser action clicked");

        (async () => {
            const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
            await chrome.tabs.sendMessage(tab.id, {command: "TOGGLE_ROT"});
        })();
    });
} catch (e) {
    console.log(e);
}