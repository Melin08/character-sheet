/**
 * Content Script running inside Owlbear Rodeo (*://*.owlbear.rodeo/*, *://*.owlbear.app/*).
 * Receives remote mouse, drag, wheel, and keyboard input from the Adventurer Codex Live Stream
 * and dispatches native PointerEvent, MouseEvent, WheelEvent, and KeyboardEvent on the map canvas.
 */
(function () {
  if (window.__OBR_STREAM_RECEIVER_ACTIVE__) return;
  window.__OBR_STREAM_RECEIVER_ACTIVE__ = true;

  let lastDownTarget = null;
  let downPos = { x: 0, y: 0 };
  let cursorIndicator = null;
  let hideCursorTimer = null;

  function ensureCursorIndicator() {
    if (cursorIndicator && document.body && document.body.contains(cursorIndicator)) return cursorIndicator;
    if (!document.body) return null;
    const el = document.createElement("div");
    el.id = "codex-remote-stream-cursor";
    el.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:18px",
      "height:18px",
      "margin-left:-9px",
      "margin-top:-9px",
      "border:2px solid #d4af37",
      "background:rgba(212,175,55,0.22)",
      "border-radius:50%",
      "pointer-events:none",
      "z-index:2147483647",
      "box-shadow:0 0 10px rgba(212,175,55,0.8)",
      "transition:transform 0.05s ease, opacity 0.2s ease",
      "opacity:0"
    ].join(";");
    document.body.appendChild(el);
    cursorIndicator = el;
    return cursorIndicator;
  }

  function showCursorAt(x, y, isPressed) {
    const ind = ensureCursorIndicator();
    if (!ind) return;
    ind.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${isPressed ? 0.78 : 1})`;
    ind.style.opacity = "1";
    ind.style.background = isPressed ? "rgba(74,222,128,0.45)" : "rgba(212,175,55,0.22)";
    ind.style.borderColor = isPressed ? "#4ade80" : "#d4af37";
    if (hideCursorTimer) clearTimeout(hideCursorTimer);
    hideCursorTimer = setTimeout(() => {
      if (ind) ind.style.opacity = "0";
    }, 1400);
  }

  function dispatchRemoteInput(pkt) {
    if (!pkt || pkt.type !== "OBR_REMOTE_INPUT") return;

    const W = window.innerWidth || document.documentElement.clientWidth || 1280;
    const H = window.innerHeight || document.documentElement.clientHeight || 720;
    const clientX = Math.max(1, Math.min(W - 1, Math.round((pkt.nx ?? 0.5) * W)));
    const clientY = Math.max(1, Math.min(H - 1, Math.round((pkt.ny ?? 0.5) * H)));

    const button = pkt.button ?? 0;
    const buttons = pkt.buttons ?? (pkt.action === "mousedown" ? (1 << button) : 0);
    const commonInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      screenX: clientX,
      screenY: clientY,
      button,
      buttons,
      shiftKey: Boolean(pkt.shiftKey),
      ctrlKey: Boolean(pkt.ctrlKey),
      altKey: Boolean(pkt.altKey),
      metaKey: Boolean(pkt.metaKey)
    };

    const pointerInit = {
      ...commonInit,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      width: 1,
      height: 1,
      pressure: buttons ? 0.5 : 0
    };

    const hitTarget = document.elementFromPoint(clientX, clientY) || document.body;

    if (pkt.action === "mousedown") {
      showCursorAt(clientX, clientY, true);
      lastDownTarget = hitTarget;
      downPos = { x: clientX, y: clientY };
      if (hitTarget && typeof hitTarget.focus === "function" && hitTarget !== document.body) {
        try { hitTarget.focus({ preventScroll: true }); } catch (e) {}
      }
      hitTarget.dispatchEvent(new PointerEvent("pointerover", pointerInit));
      hitTarget.dispatchEvent(new MouseEvent("mouseover", commonInit));
      hitTarget.dispatchEvent(new PointerEvent("pointerdown", pointerInit));
      hitTarget.dispatchEvent(new MouseEvent("mousedown", commonInit));
    } else if (pkt.action === "mousemove") {
      showCursorAt(clientX, clientY, buttons > 0);
      const moveTarget = (buttons > 0 && lastDownTarget) ? lastDownTarget : hitTarget;
      moveTarget.dispatchEvent(new PointerEvent("pointermove", pointerInit));
      moveTarget.dispatchEvent(new MouseEvent("mousemove", commonInit));
      if (moveTarget !== window) {
        window.dispatchEvent(new PointerEvent("pointermove", pointerInit));
        window.dispatchEvent(new MouseEvent("mousemove", commonInit));
      }
    } else if (pkt.action === "mouseup") {
      showCursorAt(clientX, clientY, false);
      const upTarget = lastDownTarget || hitTarget;
      upTarget.dispatchEvent(new PointerEvent("pointerup", pointerInit));
      upTarget.dispatchEvent(new MouseEvent("mouseup", commonInit));
      if (upTarget !== window) {
        window.dispatchEvent(new PointerEvent("pointerup", pointerInit));
        window.dispatchEvent(new MouseEvent("mouseup", commonInit));
      }

      const dist = Math.hypot(clientX - downPos.x, clientY - downPos.y);
      if (dist < 6 && button === 0) {
        hitTarget.dispatchEvent(new MouseEvent("click", { ...commonInit, buttons: 0, detail: 1 }));
      } else if (dist < 6 && button === 2) {
        hitTarget.dispatchEvent(new MouseEvent("contextmenu", { ...commonInit, buttons: 0 }));
      }
      lastDownTarget = null;
    } else if (pkt.action === "dblclick") {
      showCursorAt(clientX, clientY, true);
      hitTarget.dispatchEvent(new MouseEvent("dblclick", { ...commonInit, detail: 2 }));
    } else if (pkt.action === "wheel") {
      showCursorAt(clientX, clientY, false);
      hitTarget.dispatchEvent(new WheelEvent("wheel", {
        ...commonInit,
        deltaX: pkt.deltaX || 0,
        deltaY: pkt.deltaY || 0,
        deltaZ: 0,
        deltaMode: 0
      }));
    } else if (pkt.action === "keydown" || pkt.action === "keyup") {
      const keyTarget = document.activeElement || document.body;
      const keyInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        key: pkt.key || "",
        code: pkt.code || "",
        shiftKey: Boolean(pkt.shiftKey),
        ctrlKey: Boolean(pkt.ctrlKey),
        altKey: Boolean(pkt.altKey),
        metaKey: Boolean(pkt.metaKey)
      };
      keyTarget.dispatchEvent(new KeyboardEvent(pkt.action, keyInit));
      window.dispatchEvent(new KeyboardEvent(pkt.action, keyInit));
    }
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "OBR_REMOTE_INPUT") {
        dispatchRemoteInput(msg);
      }
    });
  }

  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "OBR_REMOTE_INPUT") {
      dispatchRemoteInput(ev.data);
    }
  });
})();
