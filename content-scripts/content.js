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
    "[class*='interstitial-full-screen']",
    "[class*='two-section-uma']",
    "[class*='ermvlvv0']",
    "[class*='e1qcljkj0']",
    "[class*='e53rikt0']",
    "[data-uia*='interstitial']",
    "[data-uia*='uma-modal']"
  ];

  // Concealment styles
  function injectConcealmentCSS() {
    if (document.getElementById("houseghost-conceal-css")) return;
    const style = document.createElement("style");
    style.id = "houseghost-conceal-css";
    style.textContent = 
      .nf-modal.interstitial-full-screen,
      .nf-modal.uma-modal.two-section-uma,
      .nf-modal.extended-diacritics-language.interstitial-full-screen,
      .css-1nym653.modal-enter-done,
      .nf-modal.interstitial-dialog,
      [class*='interstitial-full-screen'],
      [class*='two-section-uma'],
      [class*='ermvlvv0'],
      [class*='e1qcljkj0'],
      [class*='e53rikt0'],
      [data-uia*='interstitial'],
      [data-uia*='uma-modal'] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
        opacity: 0 !important;
        z-index: -9999 !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
      }
    ;
    (document.head || document.documentElement).appendChild(style);
  }

  // Purge restriction modals
  function purgeModals() {
    if (!isProtectionEnabled) return;

    let removedAny = false;
    MODAL_CLASSES.forEach((cls) => {
      try {
        const elems = document.getElementsByClassName(cls);
        while (elems.length > 0) {
          elems[0].parentNode?.removeChild(elems[0]);
          removedAny = true;
        }
      } catch {}
    });

    MODAL_SELECTORS.forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          el.parentNode?.removeChild(el);
          removedAny = true;
        });
      } catch {}
    });

    if (removedAny) {
      const video = document.querySelector("video");
      if (video && video.paused) {
        video.play().catch(() => {});
      }
    }
  }

  // Inject filter script
  function injectFilterScript() {
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("ghost-filter.js");
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (err) {
      console.warn("[HouseGhost] Script injection:", err);
    }
  }

  // Check initial state
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get({ houseghost_enabled: true }, (data) => {
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

  // Observer
  const observer = new MutationObserver(() => {
    if (isProtectionEnabled) {
      purgeModals();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
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

  setInterval(() => {
    if (isProtectionEnabled) {
      purgeModals();
    }
  }, 500);

  // Message listener for live state toggle
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === "STATE_CHANGE") {
        isProtectionEnabled = msg.enabled;
        if (isProtectionEnabled) {
          purgeModals();
        }
      }
    });
  }
})();