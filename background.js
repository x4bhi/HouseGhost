(function () {
  "use strict";

  // Installation handler
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      chrome.tabs.create({
        url: chrome.runtime.getURL("onboarding.html")
      });
    }
  });
})();