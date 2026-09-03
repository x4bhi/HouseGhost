/**
 * HouseGhost Core Engine - Content Guardian & Modal Purger
 * Made by x4bhi
 */
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

  // ============================================
  // IMMEDIATE SYNCHRONOUS INIT (document_start)
  // These run BEFORE any Netflix JS loads
  // ============================================

  // 1. Inject concealment CSS immediately - no waiting
  function injectConcealmentCSS() {
    if (document.getElementById("houseghost-conceal-css")) return;
    var style = document.createElement("style");
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

  // 2. Inject ghost-filter.js immediately - intercepts fetch/XHR before Netflix requests
  function injectFilterScript() {
    if (document._hg_filter_injected) return;
    document._hg_filter_injected = true;
    try {
      var script = document.createElement("script");
      script.src = chrome.runtime.getURL("ghost-filter.js");
      script.onload = function () { script.remove(); };
      (document.head || document.documentElement).appendChild(script);
    } catch (err) {
      console.warn("[HouseGhost] Script injection:", err);
    }
  }

  // Run both immediately at document_start - synchronously
  injectConcealmentCSS();
  injectFilterScript();

  // ============================================
  // ASYNC: Load stored state and apply flags
  // ============================================

  function sync4KFlag(enabled) {
    try {
      window.localStorage.setItem("HG_4K_ENABLED", enabled ? "true" : "false");
    } catch (e) {}
  }

  function purgeModals() {
    if (!isProtectionEnabled) return;
    var removedAny = false;

    MODAL_CLASSES.forEach(function (cls) {
      try {
        var elems = document.getElementsByClassName(cls);
        while (elems.length > 0) {
          elems[0].parentNode && elems[0].parentNode.removeChild(elems[0]);
          removedAny = true;
        }
      } catch (e) {}
    });

    MODAL_SELECTORS.forEach(function (sel) {
      try {
        var nodes = document.querySelectorAll(sel);
        nodes.forEach(function (el) {
          el.parentNode && el.parentNode.removeChild(el);
          removedAny = true;
        });
      } catch (e) {}
    });

    if (removedAny) {
      var video = document.querySelector("video");
      if (video && video.paused) {
        video.play().catch(function () {});
      }
    }
  }

  // Async: read stored prefs - only affects purge enable/disable and 4K flag
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ houseghost_enabled: true, force4k_enabled: false }, function (data) {
      // Sync 4K toggle to localStorage as explicit string for 4k-guard.js synchronous check
      sync4KFlag(data.force4k_enabled === true);
      // If user disabled protection, mark it
      isProtectionEnabled = data.houseghost_enabled !== false;
      // Run initial purge with correct state
      if (isProtectionEnabled) {
        purgeModals();
      } else {
        // If disabled, also remove our concealment style so Netflix looks normal
        var style = document.getElementById("houseghost-conceal-css");
        if (style) style.remove();
      }
    });
  } else {
    // Fallback: no chrome API (shouldn't happen in extension context)
    purgeModals();
  }

  // ============================================
  // CONTINUOUS MODAL GUARD
  // ============================================

  var observer = new MutationObserver(function () {
    if (isProtectionEnabled) {
      purgeModals();
    }
  });

  function startObserver() {
    var target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
      });
      purgeModals();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver);
  } else {
    startObserver();
  }

  // Periodic backup purge every 500ms
  setInterval(function () {
    if (isProtectionEnabled) {
      purgeModals();
    }
  }, 500);

  // ============================================
  // MESSAGE LISTENER (from popup.js)
  // ============================================

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (!msg) return;

      if (msg.action === "STATE_CHANGE") {
        isProtectionEnabled = msg.enabled;
        if (isProtectionEnabled) {
          injectConcealmentCSS();
          purgeModals();
        } else {
          var style = document.getElementById("houseghost-conceal-css");
          if (style) style.remove();
        }
      }

      if (msg.action === "TOGGLE_4K") {
        // Sync flag to localStorage, then reload so 4k-guard.js re-evaluates
        sync4KFlag(msg.enabled === true);
        location.reload();
      }
    });
  }

  // ============================================
  // 4K ENGINE: STATS RELAY
  // Relay stats messages from 4k-guard (MAIN world) -> background.js
  // ============================================

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === "NETFLIX_4K_STATS") {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: "updateStats",
          stats: event.data.stats
        }).catch(function () {});
      }
    }
  });

  // ============================================
  // 4K ENGINE: VIDEO ELEMENT SIGNAL
  // Notify 4k-guard when new video elements appear (SPA navigation)
  // ============================================

  var containerObserver = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];
      for (var j = 0; j < mutation.addedNodes.length; j++) {
        var node = mutation.addedNodes[j];
        if (node.nodeType === 1) {
          if (node.tagName === "VIDEO" || (node.querySelector && node.querySelector("video"))) {
            window.postMessage({ type: "NETFLIX_4K_REINIT", reason: "video element" }, "*");
            break;
          }
        }
      }
    }
  });

  function startContainerObserver() {
    if (document.body) {
      containerObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      setTimeout(startContainerObserver, 50);
    }
  }
  startContainerObserver();

})();