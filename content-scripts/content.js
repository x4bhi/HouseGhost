(function () {
  "use strict";

  let isProtectionEnabled = true;

  const MODAL_CLASSES = [
    "layout-item_styles__zc08zp30 default-ltr-cache-7vbe6a ermvlvv0",
    "default-ltr-cache-1sfbp89 e1qcljkj0",
    "default-ltr-iqcdef-cache-ohh5jx e53rikt0",
    "css-1nym653 modal-enter-done",
    "nf-modal interstitial-full-screen",
    "nf-modal uma-modal two-section-uma",
    "nf-modal extended-diacritics-language interstitial-full-screen",
    "e38lgv32 default-ltr-yhcdbf-cache-fn1p85",
    "default-ltr-yhcdbf-cache-f4de5d e1ih54e40",
    "nf-modal interstitial-dialog",
    "ermvlvv0",
    "e1qcljkj0",
    "e53rikt0",
    "interstitial-full-screen",
    "two-section-uma"
  ];

  const MODAL_SELECTORS = [
    ".nf-modal.interstitial-full-screen",
    ".nf-modal.uma-modal.two-section-uma",
    ".nf-modal.extended-diacritics-language.interstitial-full-screen",
    ".css-1nym653.modal-enter-done",
    ".nf-modal.interstitial-dialog",
    "[class*=\"interstitial-full-screen\"]",
    "[class*=\"two-section-uma\"]",
    "[class*=\"ermvlvv0\"]",
    "[class*=\"e1qcljkj0\"]",
    "[class*=\"e53rikt0\"]",
    "[data-uia*=\"interstitial\"]",
    "[data-uia*=\"uma-modal\"]"
  ];

  // Concealment styles
  function injectConcealmentCSS() {
    if (document.getElementById("houseghost-conceal-css")) return;
    const style = document.createElement("style");
    style.id = "houseghost-conceal-css";
    style.textContent = [
      ".nf-modal.interstitial-full-screen,",
      ".nf-modal.uma-modal.two-section-uma,",
      ".nf-modal.extended-diacritics-language.interstitial-full-screen,",
      ".css-1nym653.modal-enter-done,",
      ".nf-modal.interstitial-dialog,",
      "[class*=\"interstitial-full-screen\"],",
      "[class*=\"two-section-uma\"],",
      "[class*=\"ermvlvv0\"],",
      "[class*=\"e1qcljkj0\"],",
      "[class*=\"e53rikt0\"],",
      "[data-uia*=\"interstitial\"],",
      "[data-uia*=\"uma-modal\"] {",
      "  display: none !important;",
      "  visibility: hidden !important;",
      "  pointer-events: none !important;",
      "  opacity: 0 !important;",
      "  z-index: -9999 !important;",
      "  height: 0 !important;",
      "  width: 0 !important;",
      "  overflow: hidden !important;",
      "}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  // Purge restriction modals
  function purgeModals() {
    if (!isProtectionEnabled) return;

    let removedAny = false;
    MODAL_CLASSES.forEach(function (cls) {
      try {
        const elems = document.getElementsByClassName(cls);
        while (elems.length > 0) {
          elems[0].parentNode && elems[0].parentNode.removeChild(elems[0]);
          removedAny = true;
        }
      } catch (e) {}
    });

    MODAL_SELECTORS.forEach(function (sel) {
      try {
        const nodes = document.querySelectorAll(sel);
        nodes.forEach(function (el) {
          el.parentNode && el.parentNode.removeChild(el);
          removedAny = true;
        });
      } catch (e) {}
    });

    if (removedAny) {
      const video = document.querySelector("video");
      if (video && video.paused) {
        video.play().catch(function () {});
      }
    }
  }

  // Inject filter script
  function injectFilterScript() {
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("ghost-filter.js");
      script.onload = function () { script.remove(); };
      (document.head || document.documentElement).appendChild(script);
    } catch (err) {
      console.warn("[HouseGhost] Script injection:", err);
    }
  }

  // Sync 4K state to localStorage for synchronous access by 4k-guard.js
  // IMPORTANT: Store as string 'true'/'false' to match strict === comparison in 4k-guard.js
  function sync4KFlag(enabled) {
    try {
      window.localStorage.setItem('HG_4K_ENABLED', enabled ? 'true' : 'false');
    } catch (e) {}
  }

  // Check initial state from storage
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ houseghost_enabled: true, force4k_enabled: false }, function (data) {
      // Sync 4K toggle state to localStorage (explicit string 'true'/'false')
      sync4KFlag(data.force4k_enabled === true);

      isProtectionEnabled = data.houseghost_enabled !== false;
      if (isProtectionEnabled) {
        injectConcealmentCSS();
        injectFilterScript();
        purgeModals();
      }
    });
  } else {
    injectConcealmentCSS();
    injectFilterScript();
    purgeModals();
  }

  // MutationObserver for continuous modal cleanup
  const observer = new MutationObserver(function () {
    if (isProtectionEnabled) {
      purgeModals();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
      });
      purgeModals();
    });
  } else {
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
    purgeModals();
  }

  // Periodic backup check
  setInterval(function () {
    if (isProtectionEnabled) {
      purgeModals();
    }
  }, 500);

  // Listen for live toggle state changes from popup
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.action === "STATE_CHANGE") {
        isProtectionEnabled = msg.enabled;
        if (isProtectionEnabled) {
          purgeModals();
        }
      }
      if (msg && msg.action === "TOGGLE_4K") {
        // Sync flag to localStorage, then reload to re-run 4k-guard.js with correct state
        sync4KFlag(msg.enabled === true);
        location.reload();
      }
    });
  }

  // ============================================
  // 4K ENGINE: STATS MESSAGE RELAY
  // Relay stats from 4k-guard (MAIN world) â†’ background.js via chrome.runtime
  // NOTE: History/pushState wrapping is handled by 4k-guard.js to avoid double-wrapping
  // ============================================

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'NETFLIX_4K_STATS') {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'updateStats',
          stats: event.data.stats
        }).catch(function () {});
      }
    }
  });

  // Detect new video page loads and signal 4k-guard to reinitialize
  let lastVideoId = null;
  const getVideoId = function () {
    const match = location.pathname.match(/\/watch\/(\d+)/);
    return match ? match[1] : null;
  };
  lastVideoId = getVideoId();

  // Watch for player container appearing (SPA navigation signal to 4k-guard)
  const containerObserver = new MutationObserver(function (mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.tagName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
            window.postMessage({ type: 'NETFLIX_4K_REINIT', reason: 'video element' }, '*');
          }
        }
      }
    }
  });

  const startContainerObserver = function () {
    if (document.body) {
      containerObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      setTimeout(startContainerObserver, 50);
    }
  };
  startContainerObserver();
})();