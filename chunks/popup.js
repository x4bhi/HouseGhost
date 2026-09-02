document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("protection-toggle");
  const card = document.getElementById("control-card");
  const statusLabel = document.getElementById("status-label");
  const versionText = document.getElementById("version-text");

  // Load version
  if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest?.version && versionText) {
      versionText.textContent = "v" + manifest.version;
    }
  }

  // Update UI State
  function updateUI(isEnabled) {
    if (toggle) toggle.checked = isEnabled;
    if (card) {
      if (isEnabled) {
        card.classList.remove("paused");
      } else {
        card.classList.add("paused");
      }
    }
    if (statusLabel) {
      statusLabel.textContent = isEnabled ? "Protection Active" : "Protection Paused";
    }
  }

  // Load Initial State from Storage
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get({ houseghost_enabled: true }, (data) => {
      const isEnabled = data.houseghost_enabled !== false;
      updateUI(isEnabled);
    });
  }

  // Toggle Change Listener
  if (toggle) {
    toggle.addEventListener("change", () => {
      const isEnabled = toggle.checked;
      updateUI(isEnabled);

      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({ houseghost_enabled: isEnabled });

        // Notify active tab
        if (chrome.tabs?.query) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "STATE_CHANGE",
                enabled: isEnabled
              }).catch(() => {});
            }
          });
        }
      }
    });
  }
});