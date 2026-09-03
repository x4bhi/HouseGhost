/**
 * HouseGhost Core Engine - Background Service Worker
 * Made by x4bhi
 */
(function () {
  "use strict";

  console.log('[HouseGhost] Background service worker loaded');

  // Initialization
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      chrome.tabs.create({
        url: chrome.runtime.getURL("onboarding.html")
      });
      // Set default 4K settings
      chrome.storage.local.set({
        houseghost_enabled: true,
        force4k_enabled: false,
        maxBitrate: 16000,
        forceHEVC: true,
        forceVP9: true,
        spoofHDCP: true,
        playbackActive: false,
        currentResolution: null,
        currentBitrate: null,
        currentCodec: null,
        isHDR: false,
        videoId: null,
        lastUpdated: null
      });
    }
  });

  // Handle messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateStats') {
      chrome.storage.local.set({
        playbackActive: message.stats.playbackActive,
        currentResolution: message.stats.currentResolution,
        currentBitrate: message.stats.currentBitrate,
        currentCodec: message.stats.currentCodec,
        isHDR: message.stats.isHDR,
        videoId: message.stats.videoId,
        lastUpdated: Date.now()
      });
      return false;
    }

    if (message.type === 'log') {
      console.log('[HouseGhost 4K Guard]', message.data);
    }
    
    // Toggle declarative rules based on 4K setting
    if (message.action === 'TOGGLE_4K_RULES') {
      const enabled = message.enabled;
      if (chrome.declarativeNetRequest) {
        chrome.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: enabled ? ["ruleset_1"] : [],
          disableRulesetIds: enabled ? [] : ["ruleset_1"]
        });
      }
    }
  });

  // Clear stats when tab is closed or navigates away
  chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.set({
      playbackActive: false,
      currentResolution: null,
      lastUpdated: null
    });
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && !changeInfo.url.includes('netflix.com')) {
      chrome.storage.local.set({
        playbackActive: false,
        currentResolution: null,
        lastUpdated: null
      });
    }
  });
})();