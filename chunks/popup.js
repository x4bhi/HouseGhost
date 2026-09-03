/**
 * HouseGhost Core Engine - Popup Controller
 * Made by x4bhi
 */
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("protection-toggle");
  const card = document.getElementById("control-card");
  const statusLabel = document.getElementById("status-label");
  const versionText = document.getElementById("version-text");

  const toggle4k = document.getElementById("force4k-toggle");
  const card4k = document.getElementById("4k-control-card");

  const statsHud = document.getElementById("live-stats-hud");
  const statRes = document.getElementById("stat-res");

  // Load version
  if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest?.version && versionText) {
      versionText.textContent = "v" + manifest.version;
    }
  }

  // Update UI State for Bypass Engine
  function updateUI(isEnabled) {
    if (toggle) toggle.checked = isEnabled;
    if (card) {
      card.classList.toggle("paused", !isEnabled);
    }
    if (statusLabel) {
      statusLabel.textContent = isEnabled ? "Protection Active" : "Protection Paused";
    }
  }

  // Update UI State for 4K Mode
  function update4KUI(isEnabled) {
    if (toggle4k) toggle4k.checked = isEnabled;
    if (card4k) {
      card4k.classList.toggle("paused", !isEnabled);
    }
  }

  // Load Initial State from Storage
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get({ houseghost_enabled: true, force4k_enabled: false }, (data) => {
      updateUI(data.houseghost_enabled !== false);
      update4KUI(data.force4k_enabled === true);
    });
  }

  // Toggle Change Listener â€” Bypass Engine
  if (toggle) {
    toggle.addEventListener("change", () => {
      const isEnabled = toggle.checked;
      updateUI(isEnabled);

      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({ houseghost_enabled: isEnabled });

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

  // Toggle Change Listener â€” Ultra HD 4K Mode
  if (toggle4k) {
    toggle4k.addEventListener("change", () => {
      const isEnabled = toggle4k.checked;
      update4KUI(isEnabled);

      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({ force4k_enabled: isEnabled });

        // Notify background.js to toggle declarativeNetRequest ruleset
        if (chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            action: "TOGGLE_4K_RULES",
            enabled: isEnabled
          }).catch(() => {});
        }

        // Notify content.js to sync localStorage and reload the Netflix tab
        if (chrome.tabs?.query) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id && tabs[0].url && tabs[0].url.includes("netflix.com")) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "TOGGLE_4K",
                enabled: isEnabled
              }).catch(() => {});
            }
          });
        }
      }
    });
  }

  // Live Stats HUD â€” polls storage set by background.js from 4k-guard postMessage
  async function updateStats() {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url?.includes("netflix.com")) {
        if (statsHud) statsHud.style.display = "none";
        return;
      }

      const stats = await chrome.storage.local.get([
        "playbackActive",
        "currentResolution",
        "lastUpdated"
      ]);

      const isRecent = stats.lastUpdated && (Date.now() - stats.lastUpdated) < 10000;

      if (stats.playbackActive && isRecent && stats.currentResolution) {
        if (statsHud) statsHud.style.display = "block";
        if (statRes) statRes.textContent = stats.currentResolution;
      } else {
        if (statsHud) statsHud.style.display = "none";
      }
    } catch (e) {
      // Silent fail â€” popup may open while no tab is active
    }
  }

  if (statsHud) {
    updateStats();
    setInterval(updateStats, 2000);
  }
});