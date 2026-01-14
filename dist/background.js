console.log("Shadow Tagger Background Worker Running");chrome.action.onClicked.addListener(e=>{e.id&&chrome.tabs.sendMessage(e.id,{type:"TOGGLE_OVERLAY"}).catch(()=>{})});
