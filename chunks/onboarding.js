import { a as applyI18n } from "./i18n.js";

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();

  const confirmBtn = document.getElementById("confirm-btn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      confirmBtn.setAttribute("disabled", "true");
      confirmBtn.style.opacity = "0.7";

      const targetUrl = "https://www.netflix.com";
      const fallbackRedirect = () => { window.location.href = targetUrl; };

      if (typeof chrome !== "undefined" && chrome.tabs) {
        try {
          if (chrome.tabs.getCurrent) {
            chrome.tabs.getCurrent((tab) => {
              if (tab && tab.id) {
                chrome.tabs.update(tab.id, { url: targetUrl }).catch(() => fallbackRedirect());
              } else {
                chrome.tabs.update({ url: targetUrl }).catch(() => fallbackRedirect());
              }
            });
          } else {
            chrome.tabs.update({ url: targetUrl }).catch(() => fallbackRedirect());
          }
        } catch {
          fallbackRedirect();
        }
      } else {
        fallbackRedirect();
      }
    });
  }
});