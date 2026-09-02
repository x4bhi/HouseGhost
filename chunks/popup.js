import { a as applyI18n } from "./i18n.js";

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();

  const versionEl = document.getElementById("version");
  if (versionEl && typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    versionEl.textContent = manifest?.version ?  : "v1.0.0";
  }
});