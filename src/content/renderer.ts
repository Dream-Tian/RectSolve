import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.use({
  gfm: true,
  breaks: true,
});

// KaTeX will be loaded dynamically from extension resources into page context
let katexLoaded = false;
let katexLoadPromise: Promise<void> | null = null;

const katexAutoRenderOptions = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ],
  throwOnError: false,
  errorColor: '#cc0000',
  strict: false
};

async function loadKaTeX(): Promise<void> {
  if (katexLoaded) return;
  if (katexLoadPromise) return katexLoadPromise;

  katexLoadPromise = new Promise((resolve, reject) => {
    console.log('[RectSolve] Loading KaTeX from extension...');

    // Load KaTeX CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('katex/katex.min.css');
    document.head.appendChild(link);

    // Load KaTeX JS into page context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('katex/katex.min.js');
    script.onload = () => {
      console.log('[RectSolve] KaTeX core loaded');
      // Load auto-render extension
      const autoRenderScript = document.createElement('script');
      autoRenderScript.src = chrome.runtime.getURL('katex/auto-render.min.js');
      autoRenderScript.onload = () => {
        console.log('[RectSolve] KaTeX auto-render loaded');
        katexLoaded = true;
        resolve();
      };
      autoRenderScript.onerror = () => {
        console.error('[RectSolve] Failed to load KaTeX auto-render');
        reject(new Error('Failed to load KaTeX auto-render'));
      };
      document.head.appendChild(autoRenderScript);
    };
    script.onerror = () => {
      console.error('[RectSolve] Failed to load KaTeX');
      reject(new Error('Failed to load KaTeX'));
    };
    document.head.appendChild(script);
  });

  return katexLoadPromise;
}

async function renderMathInPageContext(target: HTMLElement): Promise<boolean> {
  const elementId = `rectsolve-katex-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const eventName = `rectsolve-katex-done-${elementId}`;
  target.id = elementId;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener(eventName, onDone as EventListener);
      resolve(false);
    }, 5000);

    const onDone = (event: Event) => {
      clearTimeout(timeout);
      const detail = (event as CustomEvent).detail as { ok?: boolean } | undefined;
      window.removeEventListener(eventName, onDone as EventListener);
      resolve(Boolean(detail?.ok));
    };

    window.addEventListener(eventName, onDone as EventListener, { once: true });

    window.dispatchEvent(new CustomEvent('rectsolve-katex-render-request', {
      detail: {
        elementId,
        eventName,
        options: katexAutoRenderOptions
      }
    }));
  });
}

export async function renderMarkdown(markdown: string): Promise<string> {
  console.log('[RectSolve] Rendering markdown...');

  const rawHtml = marked.parse(markdown) as string;

  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'code', 'pre', 'img', 'strong', 'em', 'a', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span'],
    ALLOWED_ATTR: ['src', 'alt', 'href', 'class', 'style'],
    ALLOWED_URI_REGEXP: /^(https:|data:image\/)/
  });

  // Try to load and render KaTeX
  try {
    await loadKaTeX();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanHtml;

    // Temporarily attach to DOM for page context rendering
    const container = document.createElement('div');
    container.style.display = 'none';
    container.appendChild(tempDiv);
    document.documentElement.appendChild(container);

    console.log('[RectSolve] Rendering math with KaTeX...');
    const rendered = await renderMathInPageContext(tempDiv);
    if (!rendered) {
      console.warn('[RectSolve] renderMathInElement not available in page context');
    } else {
      console.log('[RectSolve] Math rendering complete');
    }

    container.remove();

    return tempDiv.innerHTML;
  } catch (error) {
    console.error('[RectSolve] Failed to load KaTeX:', error);
    return cleanHtml;
  }
}

