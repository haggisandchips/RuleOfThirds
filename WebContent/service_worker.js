try {
    chrome.action.onClicked.addListener(tab => {

        console.log("Browser action clicked");

        chrome.scripting.executeScript({
            target: {tabId: tab.id}, files: ['content.js']
        });
    });
} catch (e) {
    console.log(e);
}