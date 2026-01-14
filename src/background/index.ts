console.log('Shadow Tagger Background Worker Running');
chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' }).catch(() => {
            // Ignore errors caused by restricted pages (e.g. chrome://) or content script not yet loaded
        });
    }
});
export { };
