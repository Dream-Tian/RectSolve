import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  })
);

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


// Helper to escape HTML characters
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function renderMarkdown(markdown: string): Promise<string> {
  console.log('[RectSolve] Rendering markdown...');

  // Strategy: Protect math blocks from marked parser
  // We replace math blocks with placeholders, parse markdown, then restore math
  const mathBlocks: string[] = [];
  const placeholderPrefix = "%%%MATH_BLOCK_";
  const placeholderSuffix = "%%%";

  // Regex to capture:
  // 1. $$ ... $$ (Display math)
  // 2. \[ ... \] (Display mathalt)
  // 3. \( ... \) (Inline math)
  // 4. $ ... $ (Inline math, careful with this one)
  // Note: We prioritize finding these before markdown parsing
  // The regex must handle multi-line content for display math
  const mathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$[^$]*?\$)/g;

  const protectedMarkdown = markdown.replace(mathRegex, (match) => {
    // Store the math content
    const id = mathBlocks.length;
    mathBlocks.push(match);
    return `${placeholderPrefix}${id}${placeholderSuffix}`;
  });

  const rawHtml = marked.parse(protectedMarkdown) as string;

  let cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'code', 'pre', 'img', 'strong', 'em', 'a', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span'],
    ALLOWED_ATTR: ['src', 'alt', 'href', 'class', 'style'],
    ALLOWED_URI_REGEXP: /^(https:|data:image\/)/
  });

  // Restore math blocks
  // IMPORTANT: We must NOT let the browser parse the math as HTML tags if it contains < or >
  // But KaTeX expects generated HTML to render into.
  // Actually, we should just restore the original LaTeX string. 
  // KaTeX auto-render will look for delimiters in the text content of the element.
  // However, since we are inserting into innerHTML, we must escape HTML entities 
  // to prevent XSS and broken HTML, BUT keep the backslashes.
  
  cleanHtml = cleanHtml.replace(new RegExp(`${placeholderPrefix}(\\d+)${placeholderSuffix}`, 'g'), (match, idStr) => {
    const id = parseInt(idStr);
    const mathContent = mathBlocks[id];
    // We escape HTML special chars so that < and > don't break the HTML structure
    // e.g. "x < y" becomes "x &lt; y" which is valid text content
    return escapeHtml(mathContent);
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

