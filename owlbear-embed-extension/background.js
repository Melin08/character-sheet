/**
 * Background Service Worker for Codex Owlbear Rodeo Stream Controller
 * Routes mouse, drag, wheel, and keyboard events from the Character Sheet stream
 * directly into the open Owlbear Rodeo tab.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  if (message.type === "OBR_REMOTE_INPUT") {
    chrome.tabs.query({ url: ["*://*.owlbear.rodeo/*", "*://*.owlbear.app/*"] }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ ok: false, reason: "no_owlbear_tab" });
        return;
      }
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        }
      });
      sendResponse({ ok: true, count: tabs.length });
    });
    return true;
  }

  if (message.type === "OBR_CHECK_BRIDGE") {
    chrome.tabs.query({ url: ["*://*.owlbear.rodeo/*", "*://*.owlbear.app/*"] }, (tabs) => {
      sendResponse({
        ok: true,
        extensionInstalled: true,
        owlbearTabsOpen: (tabs && tabs.length) || 0
      });
    });
    return true;
  }

  return false;
});
