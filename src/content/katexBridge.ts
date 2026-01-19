// This script runs in MAIN world to bypass page CSP
// It listens for KaTeX render requests from the content script

interface RenderRequest {
  elementId: string;
  eventName: string;
  options: any;
}

// Listen for render requests from content script (Isolated World)
window.addEventListener('rectsolve-katex-render-request', ((event: CustomEvent<RenderRequest>) => {
  const { elementId, eventName, options } = event.detail;

  try {
    const el = document.getElementById(elementId);
    if (!el || typeof (window as any).renderMathInElement !== 'function') {
      window.dispatchEvent(new CustomEvent(eventName, { detail: { ok: false } }));
      return;
    }

    (window as any).renderMathInElement(el, options);
    window.dispatchEvent(new CustomEvent(eventName, { detail: { ok: true } }));
  } catch (err) {
    window.dispatchEvent(new CustomEvent(eventName, { detail: { ok: false, error: String(err) } }));
  }
}) as EventListener);

console.log('[RectSolve] KaTeX bridge loaded in MAIN world');
