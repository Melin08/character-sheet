/**
 * Content Script running on the Adventurer Codex Character Sheet page.
 * Bridges stream pointer/wheel/keyboard events to the extension background worker.
 */
(function () {
  window.postMessage({ type: "OBR_EXTENSION_INSTALLED", version: "2.0.0" }, "*");

  window.addEventListener("message", (ev) => {
    if (ev.source !== window || !ev.data || typeof ev.data !== "object") return;
    if (ev.data.source === "codex-sheet" && ev.data.type === "OBR_REMOTE_INPUT") {
      try {
        chrome.runtime.sendMessage(ev.data, (resp) => {
          if (resp && resp.ok && resp.count > 0) {
            window.postMessage({ type: "OBR_STREAM_BRIDGE_READY", via: "extension" }, "*");
          }
        });
      } catch (e) {}
    } else if (ev.data.source === "codex-sheet" && ev.data.type === "OBR_CHECK_BRIDGE") {
      try {
        chrome.runtime.sendMessage({ type: "OBR_CHECK_BRIDGE" }, (resp) => {
          if (resp && resp.ok) {
            window.postMessage({
              type: "OBR_EXTENSION_STATUS",
              extensionInstalled: true,
              owlbearTabsOpen: resp.owlbearTabsOpen || 0
            }, "*");
          }
        });
      } catch (e) {}
    }
  });
})();
