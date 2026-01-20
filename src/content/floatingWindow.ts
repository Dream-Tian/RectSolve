import { renderMarkdown } from './renderer';
import { i18n } from '../utils/i18n';

// Inline storage functions to avoid chunk splitting (same as historySidebar.ts)
const STORAGE_KEYS = {
  BASE_URL: 'baseUrl',
  API_KEY: 'apiKey',
  DEFAULT_MODEL: 'defaultModel',
  SYSTEM_PROMPT: 'systemPrompt',
  RESPONSE_LANGUAGE: 'responseLanguage',
  HISTORY_LIMIT: 'historyLimit'
} as const;

async function getConfig() {
  const result = await chrome.storage.sync.get([
    STORAGE_KEYS.BASE_URL,
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.DEFAULT_MODEL,
    STORAGE_KEYS.SYSTEM_PROMPT,
    STORAGE_KEYS.RESPONSE_LANGUAGE,
    STORAGE_KEYS.HISTORY_LIMIT
  ]);

  return {
    baseUrl: result[STORAGE_KEYS.BASE_URL] || '',
    apiKey: result[STORAGE_KEYS.API_KEY] || '',
    defaultModel: result[STORAGE_KEYS.DEFAULT_MODEL] || '',
    systemPrompt: result[STORAGE_KEYS.SYSTEM_PROMPT] || '',
    responseLanguage: result[STORAGE_KEYS.RESPONSE_LANGUAGE] || 'zh',
    historyLimit: result[STORAGE_KEYS.HISTORY_LIMIT] || 20
  };
}

const WINDOW_STYLES = `
:host {
  --rs-primary: #2563eb;
  --rs-primary-hover: #1d4ed8;
  --rs-bg-rgb: 255, 255, 255;
  --rs-opacity: 1;
  --rs-bg: rgba(var(--rs-bg-rgb), var(--rs-opacity));
  --rs-bg-secondary: #f9fafb;
  --rs-text: #111827;
  --rs-text-secondary: #6b7280;
  --rs-border: #e5e7eb;
  --rs-border-subtle: #f3f4f6;
  --rs-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --rs-radius: 12px;
  --rs-font: KaiTi, "楷体", STKaiti, serif;
}

.rs-window {
  position: fixed;
  width: 500px;
  min-width: 300px;
  max-width: 90vw;
  height: auto;
  min-height: 200px;
  max-height: 90vh;
  background: var(--rs-bg);
  border: 1px solid var(--rs-border);
  box-shadow: var(--rs-shadow);
  border-radius: var(--rs-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  font-family: var(--rs-font);
}

.rs-window.visible {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.rs-header {
  background: var(--rs-bg);
  padding: 14px 16px;
  border-bottom: 1px solid var(--rs-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}

.rs-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rs-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--rs-text);
}

.rs-close-btn {
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rs-close-btn:hover {
  background: #f3f4f6;
  color: var(--rs-text);
}

.rs-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  min-height: 100px;
  position: relative;
  background: var(--rs-bg);
}

.rs-content {
  padding: 20px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--rs-text);
}

/* Markdown Elements */
.rs-content p {
  margin-bottom: 1em;
  text-indent: 0;
}

.rs-content h1, .rs-content h2, .rs-content h3 {
  margin-top: 1.2em;
  margin-bottom: 0.6em;
  font-weight: 600;
  color: var(--rs-text);
  text-indent: 0;
  line-height: 1.3;
}

.rs-content h1 { font-size: 1.4em; }
.rs-content h2 { font-size: 1.2em; }
.rs-content h3 { font-size: 1.1em; }

.rs-content code {
  background: rgba(241, 245, 249, var(--rs-opacity));
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 13px;
  color: #0f172a;
}

.rs-content pre {
  background: rgba(248, 250, 252, var(--rs-opacity));
  border: 1px solid var(--rs-border);
  color: #334155;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1em 0;
}

.rs-content pre code {
  background: none;
  padding: 0;
  color: inherit;
  font-size: 13px;
}

.rs-content img {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid var(--rs-border);
  margin: 1em 0;
}

.rs-content ul, .rs-content ol {
  padding-left: 1.5em;
  margin-bottom: 1em;
}

.rs-content li {
  margin-bottom: 0.4em;
}

.rs-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  font-size: 14px;
}

.rs-content th, .rs-content td {
  border: 1px solid var(--rs-border);
  padding: 8px 12px;
  text-align: left;
}

.rs-content th {
  background: rgba(248, 250, 252, var(--rs-opacity));
  font-weight: 600;
  color: var(--rs-text);
}

/* KaTeX Math */
.rs-content .katex {
  font-size: 1.15em;
}

.rs-content .katex-display {
  margin: 1.5em 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 8px 0;
}

.rs-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: var(--rs-text-secondary);
  gap: 16px;
}

.rs-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.1) 50%);
  border-bottom-right-radius: var(--rs-radius);
  z-index: 10;
}

.rs-resize-handle:hover {
  background: linear-gradient(135deg, transparent 50%, rgba(37, 99, 235, 0.5) 50%);
}

.hidden { display: none !important; }

.rs-footer {
  padding: 12px 16px;
  background: var(--rs-bg);
  border-top: 1px solid var(--rs-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.rs-status {
  font-size: 13px;
  color: var(--rs-text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.rs-actions {
  display: flex;
  gap: 10px;
}

.rs-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--rs-bg);
  border: 1px solid var(--rs-border);
  border-radius: 6px;
  font-size: 13px;
  font-family: var(--rs-font);
  color: var(--rs-text);
  cursor: pointer;
  transition: all 0.2s;
}

.rs-action-btn:hover {
  background: #f8fafc;
  border-color: var(--rs-primary);
  color: var(--rs-primary);
}

.rs-action-btn svg {
  width: 14px;
  height: 14px;
}

.rs-morph-sq {
  width: 32px;
  height: 32px;
  background: var(--rs-primary);
  opacity: 0.9;
  animation: rs-morph 2s ease-in-out infinite;
}

@keyframes rs-morph {
  0% { transform: scale(1) rotate(0deg); border-radius: 4px; }
  50% { transform: scale(0.6) rotate(180deg); border-radius: 50%; width: 32px; }
  100% { transform: scale(1) rotate(360deg); border-radius: 4px; }
}

.rs-animating-dots::after {
  content: '';
  display: inline-block;
  width: 12px;
  text-align: left;
  animation: rs-dots 2s steps(1) infinite;
}

@keyframes rs-dots {
  0%, 100% { content: ''; }
  25% { content: '.'; }
  50% { content: '..'; }
  75% { content: '...'; }
}

.rs-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  color: #ef4444;
  gap: 12px;
}

.rs-error-icon {
  width: 48px;
  height: 48px;
  color: #fee2e2;
  background: #ef4444;
  border-radius: 50%;
  padding: 12px;
}

.rs-icon {
  width: 16px;
  height: 16px;
}

.rs-preview {
  padding: 12px 20px 0 20px;
  border-bottom: 1px solid var(--rs-border);
  background: rgba(249, 250, 251, var(--rs-opacity));
}

.rs-preview.hidden {
  display: none;
}

.rs-preview img {
  max-width: 100%;
  max-height: 150px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid var(--rs-border);
  cursor: pointer;
  transition: transform 0.2s;
}

.rs-preview img:hover {
  transform: scale(1.02);
}

.rs-preview-label {
  font-size: 12px;
  color: var(--rs-text-secondary);
  margin-bottom: 8px;
}

.rs-followup {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--rs-border);
  background: var(--rs-bg);
  flex-shrink: 0;
}

.rs-followup.hidden {
  display: none;
}

.rs-footer-chips {
  display: flex;
  gap: 6px;
  margin-left: 12px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(2px);
  transition: all 0.2s ease;
  pointer-events: none;
}

.rs-footer-chips.visible {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: auto;
}

.rs-chip-mini {
  padding: 2px 8px;
  font-size: 11px;
  color: var(--rs-text-secondary);
  background: rgba(var(--rs-bg-rgb), 0.5);
  border: 1px solid var(--rs-border);
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.rs-chip-mini:hover {
  color: var(--rs-primary);
  border-color: var(--rs-primary);
  background: rgba(var(--rs-bg-rgb), 0.8);
}

.rs-followup-row {
  display: flex;

  gap: 8px;
  width: 100%;
}

.rs-followup-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--rs-border);
  border-radius: 6px;
  font-family: var(--rs-font);
  font-size: 14px;
  color: var(--rs-text);
  background: var(--rs-bg);
  outline: none;
  transition: border-color 0.2s;
}

.rs-followup-input:focus {
  border-color: var(--rs-primary);
}

.rs-followup-input::placeholder {
  color: var(--rs-text-secondary);
}

.rs-followup-send {
  padding: 8px 16px;
  background: var(--rs-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-family: var(--rs-font);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.rs-followup-send:hover {
  background: var(--rs-primary-hover);
}

.rs-followup-send:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.rs-retry-btn {
  margin-top: 8px;
  padding: 6px 12px;
  background: var(--rs-bg);
  color: var(--rs-text);
  border: 1px solid var(--rs-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.rs-retry-btn:hover {
  background: var(--rs-border);
}

/* Streaming cursor animation */
.rs-streaming-cursor {
  display: inline;
  color: var(--rs-primary);
  animation: blink 1s step-end infinite;
  font-weight: bold;
}

@keyframes blink {
  50% { opacity: 0; }
}
`;

export class FloatingWindow {
  private container: HTMLElement;
  private shadow: ShadowRoot;
  private contentArea: HTMLElement | null = null;
  private header: HTMLElement | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseUpHandler: (() => void) | null = null;
  
  private isResizing = false;
  private resizeStart = { width: 0, height: 0, x: 0, y: 0 };
  
  // Multi-turn conversation state
  private conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private currentImageUrl: string = '';
  private currentSystemPrompt: string = '';
  private lastMarkdown: string = '';

  // Event listener tracking for proper cleanup
  private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListenerOrEventListenerObject }> = [];

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'rect-solve-host';
    this.container.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      top: 0;
      left: 0;
    `;

    this.shadow = this.container.attachShadow({ mode: 'open' });
    this.renderInitialUI();
    this.bindEvents();
    this.initializeConfig();
  }

  private renderInitialUI() {
    const style = document.createElement('style');
    style.textContent = WINDOW_STYLES;
    this.shadow.appendChild(style);

    // Inject KaTeX CSS into Shadow DOM for proper formula rendering
    const katexCss = document.createElement('link');
    katexCss.rel = 'stylesheet';
    katexCss.href = chrome.runtime.getURL('katex/katex.min.css');
    this.shadow.appendChild(katexCss);

    const windowEl = document.createElement('div');
    windowEl.className = 'rs-window';
    windowEl.innerHTML = `
      <style>
        /*!
          Theme: GitHub Dark
          Description: Dark theme as seen on github.com
          Author: github.com
          Maintainer: @Hirse
          Updated: 2021-05-15, 2021-06-22
        */
        .hljs{color:#c9d1d9;background:#0d1117}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#ff7b72}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#d2a8ff}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id{color:#79c0ff}.hljs-regexp,.hljs-string,.hljs-meta .hljs-string{color:#a5d6ff}.hljs-built_in,.hljs-symbol{color:#ffa657}.hljs-comment,.hljs-code,.hljs-formula{color:#8b949e}.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo{color:#7ee787}.hljs-subst{color:#c9d1d9}.hljs-section{color:#1f6feb;font-weight:700}.hljs-bullet{color:#f2cc60}.hljs-emphasis{color:#c9d1d9;font-style:italic}.hljs-strong{color:#c9d1d9;font-weight:700}.hljs-addition{color:#aff5b4;background-color:#033a16}.hljs-deletion{color:#ffdcd7;background-color:#67060c}

        .rs-window .katex {
             color: var(--rs-text);
        }
        .rs-window .katex-display {
             color: var(--rs-text);
        }

        .rs-question-box {
            margin: 20px 0 10px 0;
            padding: 12px 14px;
            border: 1px solid var(--rs-primary);
            border-left-width: 4px;
            border-radius: 6px;
            background: rgba(var(--rs-bg-rgb), 0.5);
            position: relative;
        }

        .rs-question-label {
            font-size: 12px;
            color: var(--rs-primary);
            margin-bottom: 4px;
            font-weight: 600;
        }

        .rs-question-content {
            font-size: 14px;
            color: var(--rs-text);
            line-height: 1.5;
        }
      </style>
      <div class="rs-header">
        <div class="rs-brand">
          <svg class="rs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--rs-primary);">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
          <div class="rs-title">${i18n.t('app_name')}</div>
        </div>
        <button class="rs-close-btn" title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="rs-body">
        <div class="rs-preview hidden">
          <div class="rs-preview-label">${i18n.t('problem_screenshot')}</div>
          <img class="rs-preview-img" src="" alt="Screenshot" />
        </div>
        <div class="rs-loading hidden">
          <div class="rs-morph-sq"></div>
          <span class="rs-animating-dots">${i18n.t('generating')}</span>
        </div>
        <div class="rs-content"></div>
      </div>
      <div class="rs-footer">
        <div style="display: flex; align-items: center;">
            <span class="rs-status">Ready</span>
            <div class="rs-footer-chips">
                <div class="rs-chip-mini">详细解释</div>
                <div class="rs-chip-mini">举个例子</div>
            </div>
        </div>
        <div class="rs-actions">
          <button class="rs-action-btn" id="rs-copy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            ${i18n.t('copy')}
          </button>
        </div>
      </div>
      <div class="rs-followup hidden">
        <div class="rs-followup-row">
            <input type="text" class="rs-followup-input" placeholder="${i18n.t('follow_up_placeholder')}" />
            <button class="rs-followup-send" disabled>${i18n.t('send')}</button>
        </div>
      </div>
      <div class="rs-resize-handle"></div>
    `;

    this.shadow.appendChild(windowEl);

    this.contentArea = windowEl.querySelector('.rs-content');
    this.header = windowEl.querySelector('.rs-header');

    // Track all event listeners for proper cleanup
    const closeBtn = windowEl.querySelector('.rs-close-btn');
    if (closeBtn) {
      const closeHandler = () => this.hide();
      closeBtn.addEventListener('click', closeHandler);
      this.eventListeners.push({ element: closeBtn, event: 'click', handler: closeHandler });
    }
    
    const copyBtn = windowEl.querySelector('#rs-copy');
    if (copyBtn) {
      const copyHandler = () => this.copyContent();
      copyBtn.addEventListener('click', copyHandler);
      this.eventListeners.push({ element: copyBtn, event: 'click', handler: copyHandler });
    }
    
    // Follow-up send handler
    const followupInput = windowEl.querySelector('.rs-followup-input') as HTMLInputElement;
    const followupSend = windowEl.querySelector('.rs-followup-send') as HTMLButtonElement;
    
    if (followupSend) {
      const sendHandler = () => this.sendFollowUp(followupInput);
      followupSend.addEventListener('click', sendHandler);
      this.eventListeners.push({ element: followupSend, event: 'click', handler: sendHandler });
    }
    
    if (followupInput) {
      const keypressHandler = (e: Event) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          this.sendFollowUp(followupInput);
        }
      };
      followupInput.addEventListener('keypress', keypressHandler);
      this.eventListeners.push({ element: followupInput, event: 'keypress', handler: keypressHandler });
    }

    // Quick actions handlers
    const chipsContainer = windowEl.querySelector('.rs-footer-chips');
    const chips = windowEl.querySelectorAll('.rs-chip-mini');
    
    if (followupInput && chipsContainer) {
      const showChips = () => chipsContainer.classList.add('visible');
      const hideChips = () => {
        // Delay hiding to allow clicking on chips
        setTimeout(() => {
          if (document.activeElement !== followupInput) {
            chipsContainer.classList.remove('visible');
          }
        }, 200);
      };

      followupInput.addEventListener('focus', showChips);
      followupInput.addEventListener('blur', hideChips);
      
      this.eventListeners.push({ element: followupInput, event: 'focus', handler: showChips });
      this.eventListeners.push({ element: followupInput, event: 'blur', handler: hideChips });
    }

    chips.forEach(chip => {
        const chipHandler = () => {
            const text = chip.textContent;
            if (text && followupInput) {
                followupInput.value = text;
                this.sendFollowUp(followupInput);
                // Hide chips after selection
                chipsContainer?.classList.remove('visible');
            }
        };
        chip.addEventListener('click', chipHandler);
        this.eventListeners.push({ element: chip, event: 'click', handler: chipHandler });
    });
  }

  private bindEvents() {
    if (!this.header) return;

    // Dragging Logic
    const dragHandler = (e: Event) => {
      this.isDragging = true;
      const win = this.shadow.querySelector('.rs-window') as HTMLElement;
      const rect = win.getBoundingClientRect();
      this.dragOffset = {
        x: (e as MouseEvent).clientX - rect.left,
        y: (e as MouseEvent).clientY - rect.top
      };
      e.preventDefault(); // Prevent text selection
    };
    this.header.addEventListener('mousedown', dragHandler);
    this.eventListeners.push({ element: this.header, event: 'mousedown', handler: dragHandler });

    // Resizing Logic
    const resizeHandle = this.shadow.querySelector('.rs-resize-handle');
    if (resizeHandle) {
      const resizeHandler = (e: Event) => {
        // @ts-ignore
        this.isResizing = true;
        const win = this.shadow.querySelector('.rs-window') as HTMLElement;
        const rect = win.getBoundingClientRect();
        // Store initial dimensions and mouse position
        // @ts-ignore
        this.resizeStart = {
          width: rect.width,
          height: rect.height,
          x: (e as MouseEvent).clientX,
          y: (e as MouseEvent).clientY
        };
        e.preventDefault();
        e.stopPropagation(); // Prevent drag from triggering
      };
      resizeHandle.addEventListener('mousedown', resizeHandler);
      this.eventListeners.push({ element: resizeHandle, event: 'mousedown', handler: resizeHandler });
    }

    this.mouseMoveHandler = (e: MouseEvent) => {
      const win = this.shadow.querySelector('.rs-window') as HTMLElement;
      
      // Handle Resizing
      // @ts-ignore
      if (this.isResizing) {
        // @ts-ignore
        const start = this.resizeStart;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        
        const newWidth = Math.max(300, start.width + dx);
        const newHeight = Math.max(200, start.height + dy);
        
        win.style.width = `${newWidth}px`;
        win.style.height = `${newHeight}px`;
        return;
      }

      // Handle Dragging
      if (this.isDragging) {
        win.style.transform = 'none'; // reset transform to use absolute positioning
        win.style.left = `${e.clientX - this.dragOffset.x}px`;
        win.style.top = `${e.clientY - this.dragOffset.y}px`;
        // Remove bottom/right if they were set by CSS to ensure left/top positioning works
        win.style.bottom = 'auto';
        win.style.right = 'auto';
      }
    };

    this.mouseUpHandler = () => {
      this.isDragging = false;
      // @ts-ignore
      this.isResizing = false;
    };

    window.addEventListener('mousemove', this.mouseMoveHandler);
    window.addEventListener('mouseup', this.mouseUpHandler);
  }

  public cleanup() {
    // Remove global window listeners
    if (this.mouseMoveHandler) {
      window.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    if (this.mouseUpHandler) {
      window.removeEventListener('mouseup', this.mouseUpHandler);
      this.mouseUpHandler = null;
    }
    
    // Remove all tracked event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }

  public show(x: number, y: number) {
    if (!this.container.parentNode) {
      this.container.style.display = 'block'; // Ensure visible on mount
      document.body.appendChild(this.container);
    } else {
      this.container.style.display = 'block';
    }

    const win = this.shadow.querySelector('.rs-window') as HTMLElement;
    // ... rest of logic
    // (Existing centering logic remains, just ensure we don't duplicate appendChild)

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const winWidth = 500;
    const winHeight = 700;

    let finalX = x + 20;
    let finalY = y + 20;

    if (finalX + winWidth > viewportWidth) finalX = x - winWidth - 20;
    if (finalY + winHeight > viewportHeight) finalY = y - winHeight - 20;

    finalX = Math.max(10, finalX);
    finalY = Math.max(10, finalY);

    win.style.left = `${finalX}px`;
    win.style.top = `${finalY}px`;
    
    // Force reflow to ensure transition works
    void win.offsetWidth; 
    
    win.classList.add('visible');
  }

  public hide() {
    const win = this.shadow.querySelector('.rs-window') as HTMLElement;
    win.classList.remove('visible');
    setTimeout(() => {
      // Just hide, don't remove from DOM
      this.container.style.display = 'none';
      // Clear conversation context on close
      this.conversationMessages = [];
      this.currentImageUrl = '';
      this.currentSystemPrompt = '';
      this.lastMarkdown = '';
      // Hide follow-up input
      const followup = this.shadow.querySelector('.rs-followup');
      followup?.classList.add('hidden');
    }, 300);
  }

  private async sendFollowUp(input: HTMLInputElement) {
    const question = input.value.trim();
    if (!question || !this.currentImageUrl) return;

    // Clear input
    input.value = '';

    // Add user question to conversation
    this.conversationMessages.push({ role: 'user', content: question });

    // Show question immediately in UI
    if (this.contentArea) {
       const questionHtml = `
         <div class="rs-question-box">
             <div class="rs-question-label">追问</div>
             <div class="rs-question-content">${question.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
         </div>
       `;
       this.contentArea.insertAdjacentHTML('beforeend', questionHtml);
       this.contentArea.scrollTop = this.contentArea.scrollHeight;
    }

    // Show loading
    this.updateStatus('追问中...');
    const sendBtn = this.shadow.querySelector('.rs-followup-send') as HTMLButtonElement;
    if (sendBtn) sendBtn.disabled = true;

    // Initialize streaming follow-up
    this.initStreamingFollowUp();

    // Use Port for streaming response
    const port = chrome.runtime.connect({ name: 'stream' });
    
    port.onMessage.addListener((msg) => {
      if (msg.type === 'chunk') {
        this.appendStreamingFollowUpChunk(msg.content);
      } else if (msg.type === 'done') {
        this.finalizeStreamingFollowUp();
        if (sendBtn) sendBtn.disabled = false;
        port.disconnect();
      } else if (msg.type === 'error') {
        this.updateStatus(`追问失败: ${msg.error}`);
        if (sendBtn) sendBtn.disabled = false;
        port.disconnect();
      }
    });
    
    port.postMessage({
      type: 'FOLLOW_UP_STREAM',
      messages: this.conversationMessages,
      imageDataUrl: this.currentImageUrl,
      systemPrompt: this.currentSystemPrompt
    });
  }

  public showLoading() {
    const loading = this.shadow.querySelector('.rs-loading');
    const content = this.shadow.querySelector('.rs-content');
    loading?.classList.remove('hidden');
    content?.classList.add('hidden');
    this.updateStatus("Processing...");
  }

  public async showContent(markdown: string, saveToHistory: boolean = true, imageDataUrl?: string, systemPrompt?: string) {
    const loading = this.shadow.querySelector('.rs-loading');
    const content = this.shadow.querySelector('.rs-content');
    const preview = this.shadow.querySelector('.rs-preview');
    const previewImg = this.shadow.querySelector('.rs-preview-img') as HTMLImageElement;
    const followup = this.shadow.querySelector('.rs-followup');
    
    loading?.classList.add('hidden');
    content?.classList.remove('hidden');

    // Show preview image if available
    if (imageDataUrl && preview && previewImg) {
      previewImg.src = imageDataUrl;
      preview.classList.remove('hidden');
      // Store for multi-turn conversation
      this.currentImageUrl = imageDataUrl;
    } else {
      preview?.classList.add('hidden');
    }

    // Store system prompt for follow-ups
    if (systemPrompt) {
      this.currentSystemPrompt = systemPrompt;
    }

    if (this.contentArea) {
      try {
        this.contentArea.innerHTML = await renderMarkdown(markdown);
        this.lastMarkdown = markdown;
        
        // Initialize conversation if this is first response
        if (this.conversationMessages.length === 0 && this.currentImageUrl) {
          this.conversationMessages.push({ role: 'user', content: '请解答这道题' });
          this.conversationMessages.push({ role: 'assistant', content: markdown });
          // Show follow-up input
          followup?.classList.remove('hidden');
        } else if (this.conversationMessages.length > 0) {
          // Append assistant response for follow-up
          this.conversationMessages.push({ role: 'assistant', content: markdown });
          followup?.classList.remove('hidden');
        }
        
        // Save to history only if requested (first response)
        if (saveToHistory) {
          this.saveToHistory(markdown, imageDataUrl);
        }
      } catch (error) {
        this.contentArea.innerHTML = `<div class="rs-error">渲染错误: ${(error as Error).message}</div>`;
      }
    }
    this.updateStatus("Done");
  }

  // Streaming content display - called with incremental chunks
  private streamingContent: string = '';
  private streamingRenderTimeout: number | null = null;
  
  public initStreamingContent(imageDataUrl?: string, systemPrompt?: string) {
    this.streamingContent = '';
    const loading = this.shadow.querySelector('.rs-loading');
    const content = this.shadow.querySelector('.rs-content');
    const preview = this.shadow.querySelector('.rs-preview');
    const previewImg = this.shadow.querySelector('.rs-preview-img') as HTMLImageElement;
    
    loading?.classList.add('hidden');
    content?.classList.remove('hidden');
    
    if (imageDataUrl && preview && previewImg) {
      previewImg.src = imageDataUrl;
      preview.classList.remove('hidden');
      this.currentImageUrl = imageDataUrl;
    }
    
    if (systemPrompt) {
      this.currentSystemPrompt = systemPrompt;
    }
    
    if (this.contentArea) {
      this.contentArea.innerHTML = '<span class="rs-streaming-cursor">▌</span>';
    }
    
    this.updateStatus('Processing...');
  }
  
  public appendStreamingChunk(chunk: string) {
    this.streamingContent += chunk;
    
    // 使用节流渲染，避免频繁更新导致卡顿
    if (this.streamingRenderTimeout) {
      clearTimeout(this.streamingRenderTimeout);
    }
    
    this.streamingRenderTimeout = window.setTimeout(async () => {
      if (this.contentArea) {
        try {
          // 渲染当前累积的内容
          const rendered = await renderMarkdown(this.streamingContent);
          this.contentArea.innerHTML = rendered + '<span class="rs-streaming-cursor">▌</span>';
          // 自动滚动到底部
          this.contentArea.scrollTop = this.contentArea.scrollHeight;
        } catch {
          // 渲染失败时显示原始文本
          this.contentArea.innerHTML = this.streamingContent.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '<span class="rs-streaming-cursor">▌</span>';
        }
      }
    }, 50); // 50ms 节流
  }
  
  public async finalizeStreamingContent(saveToHistory: boolean = true) {
    // 清除节流定时器
    if (this.streamingRenderTimeout) {
      clearTimeout(this.streamingRenderTimeout);
      this.streamingRenderTimeout = null;
    }
    
    const followup = this.shadow.querySelector('.rs-followup');
    
    if (this.contentArea && this.streamingContent) {
      try {
        // 最终渲染，不带光标
        this.contentArea.innerHTML = await renderMarkdown(this.streamingContent);
        this.lastMarkdown = this.streamingContent;
        
        // 初始化对话历史
        if (this.conversationMessages.length === 0 && this.currentImageUrl) {
          this.conversationMessages.push({ role: 'user', content: '请解答这道题' });
          this.conversationMessages.push({ role: 'assistant', content: this.streamingContent });
          followup?.classList.remove('hidden');
        }
        
        // 保存到历史
        if (saveToHistory) {
          this.saveToHistory(this.streamingContent, this.currentImageUrl);
        }
      } catch (error) {
        this.contentArea.innerHTML = `<div class="rs-error">渲染错误: ${(error as Error).message}</div>`;
      }
    }
    
    this.updateStatus('Done');
  }
  
  // 追问的流式响应
  public initStreamingFollowUp() {
    this.streamingContent = '';
    
    if (this.contentArea) {
      // 添加分割线和新内容区域
      const divider = document.createElement('div');
      divider.className = 'rs-stream-divider';
      divider.innerHTML = '<hr style="border: none; border-top: 1px solid var(--rs-border); margin: 16px 0;">';
      this.contentArea.appendChild(divider);
      
      const streamArea = document.createElement('div');
      streamArea.className = 'rs-stream-area';
      streamArea.innerHTML = '<span class="rs-streaming-cursor">▌</span>';
      this.contentArea.appendChild(streamArea);
      
      this.contentArea.scrollTop = this.contentArea.scrollHeight;
    }
    
    this.updateStatus('追问中...');
  }
  
  public appendStreamingFollowUpChunk(chunk: string) {
    this.streamingContent += chunk;
    
    if (this.streamingRenderTimeout) {
      clearTimeout(this.streamingRenderTimeout);
    }
    
    this.streamingRenderTimeout = window.setTimeout(async () => {
      const streamArea = this.contentArea?.querySelector('.rs-stream-area');
      if (streamArea) {
        try {
          const rendered = await renderMarkdown(this.streamingContent);
          streamArea.innerHTML = rendered + '<span class="rs-streaming-cursor">▌</span>';
          this.contentArea!.scrollTop = this.contentArea!.scrollHeight;
        } catch {
          streamArea.innerHTML = this.streamingContent.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '<span class="rs-streaming-cursor">▌</span>';
        }
      }
    }, 50);
  }
  
  public async finalizeStreamingFollowUp() {
    if (this.streamingRenderTimeout) {
      clearTimeout(this.streamingRenderTimeout);
      this.streamingRenderTimeout = null;
    }
    
    const streamArea = this.contentArea?.querySelector('.rs-stream-area');
    if (streamArea && this.streamingContent) {
      try {
        streamArea.innerHTML = await renderMarkdown(this.streamingContent);
        this.conversationMessages.push({ role: 'assistant', content: this.streamingContent });
        this.lastMarkdown = this.streamingContent;
      } catch (error) {
        streamArea.innerHTML = `<div class="rs-error">渲染错误: ${(error as Error).message}</div>`;
      }
    }
    
    this.updateStatus('Done');
  }

  public showError(message: string, onRetry?: () => void) {
    const loading = this.shadow.querySelector('.rs-loading');
    const content = this.shadow.querySelector('.rs-content');
    loading?.classList.add('hidden');
    content?.classList.remove('hidden');

    // Provide user-friendly error messages
    let friendlyMessage = message;
    if (message.includes('Missing configuration')) {
      friendlyMessage = i18n.t('error_missing_config');
    } else if (message.includes('HTTP 401') || message.includes('Unauthorized')) {
      friendlyMessage = 'API Key 无效，请检查设置';
    } else if (message.includes('HTTP 429')) {
      friendlyMessage = 'API 请求过于频繁，请稍后再试';
    } else if (message.includes('HTTP 500') || message.includes('HTTP 502') || message.includes('HTTP 503')) {
      friendlyMessage = 'API 服务暂时不可用，请稍后再试';
    } else if (message.includes('Failed to fetch') || message.includes('Network')) {
      friendlyMessage = '网络连接失败，请检查网络设置';
    } else if (message.includes('Invalid selection')) {
      friendlyMessage = '选区无效，请重新框选';
    }

    if (this.contentArea) {
      this.contentArea.innerHTML = `
        <div class="rs-error">
          <svg class="rs-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>${friendlyMessage}</span>
          ${onRetry ? `<button class="rs-retry-btn">${i18n.t('retry') || 'Retry'}</button>` : ''}
        </div>`;
      
      if (onRetry) {
        const retryBtn = this.contentArea.querySelector('.rs-retry-btn');
        retryBtn?.addEventListener('click', onRetry);
        this.eventListeners.push({ element: retryBtn!, event: 'click', handler: onRetry });
      }
    }
    this.updateStatus("Error");
  }

  private updateStatus(text: string) {
    const status = this.shadow.querySelector('.rs-status');
    if (!status) return;

    let displayText = text;
    let shouldAnimate = false;

    if (text === 'Processing...' || text === '正在生成回答...') {
      displayText = i18n.t('generating');
      shouldAnimate = true;
    } else if (text === '追问中...') {
      displayText = i18n.t('follow_uping');
      shouldAnimate = true;
    } else if (text === 'Done') {
      displayText = i18n.t('done');
    } else if (text === 'Error') {
      displayText = i18n.t('error');
    }

    status.textContent = displayText;
    
    if (shouldAnimate) {
      status.classList.add('rs-animating-dots');
    } else {
      status.classList.remove('rs-animating-dots');
    }
  }

  private async copyContent() {
    if (!this.contentArea) return;
    const text = this.contentArea.innerText;
    try {
      await navigator.clipboard.writeText(text);
      this.updateStatus(i18n.t('copied'));
      setTimeout(() => this.updateStatus("Done"), 2000);
    } catch (error) {
      this.updateStatus(i18n.t('copy_failed'));
    }
  }

  private async saveToHistory(markdown: string, imageDataUrl?: string) {
    try {
      const history = await this.getHistory();
      history.unshift({
        markdown,
        imageDataUrl,
        timestamp: Date.now()
      });
      // Keep only last 10 items
      const config = await getConfig();
      const limit = config.historyLimit || 20;

      // Keep only last N items
      if (history.length > limit) {
         history.length = limit; // Truncate relative cheap
      }
      
      await chrome.storage.local.set({ rectsolve_history: JSON.stringify(history) });
      
      // Update statistics
      await this.updateStats();
    } catch (error) {
      console.error('[FloatingWindow] Failed to save history:', error);
    }
  }

  private async updateStats() {
    try {
      const result = await chrome.storage.local.get('rectsolve_stats');
      const stats = result.rectsolve_stats ? JSON.parse(result.rectsolve_stats) : {
        totalCount: 0,
        todayCount: 0,
        todayDate: '',
        firstUseDate: ''
      };

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Reset today count if date changed
      if (stats.todayDate !== today) {
        stats.todayCount = 0;
        stats.todayDate = today;
      }

      // Increment counts
      stats.totalCount += 1;
      stats.todayCount += 1;

      // Set first use date if not set
      if (!stats.firstUseDate) {
        stats.firstUseDate = today;
      }

      await chrome.storage.local.set({ rectsolve_stats: JSON.stringify(stats) });
    } catch (error) {
      console.error('[FloatingWindow] Failed to update stats:', error);
    }
  }

  private async initializeConfig() {
    try {
      const result = await chrome.storage.sync.get(['uiOpacity', 'theme']);
      if (result.uiOpacity !== undefined) this.updateOpacity(result.uiOpacity);
      if (result.theme) this.updateTheme(result.theme);

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync') {
          if (changes.uiOpacity) this.updateOpacity(changes.uiOpacity.newValue);
          if (changes.theme) this.updateTheme(changes.theme.newValue);
        }
      });
    } catch (e) {
      console.error('Config init error', e);
    }
  }

  private updateOpacity(val: number) {
      this.container.style.setProperty('--rs-opacity', String(val));
  }

  private updateTheme(theme: string) {
      const isDark = theme === 'dark';
      if (isDark) {
          // Dark Theme Palette - Optimized
          this.container.style.setProperty('--rs-bg-rgb', '31, 41, 55'); // Gray 800
          this.container.style.setProperty('--rs-bg-secondary', '#111827'); // Gray 900
          this.container.style.setProperty('--rs-text', '#f9fafb'); // Gray 50
          this.container.style.setProperty('--rs-text-secondary', '#d1d5db'); // Gray 300
          this.container.style.setProperty('--rs-border', '#4b5563'); // Gray 600
          this.container.style.setProperty('--rs-border-subtle', '#374151'); // Gray 700
          
          // Darken scrollbars
          const styleId = 'rs-dark-scroll-style';
          let styleFn = this.shadow.getElementById(styleId);
          if (!styleFn) {
            styleFn = document.createElement('style');
            styleFn.id = styleId;
            styleFn.textContent = `
              .rs-body::-webkit-scrollbar-track { background: #1f2937; }
              .rs-body::-webkit-scrollbar-thumb { background: #4b5563; }
              .rs-body::-webkit-scrollbar-thumb:hover { background: #6b7280; }
            `;
            this.shadow.appendChild(styleFn);
          }
      } else {
          // Light Theme Palette
          this.container.style.setProperty('--rs-bg-rgb', '255, 255, 255');
          this.container.style.setProperty('--rs-bg-secondary', '#f9fafb');
          this.container.style.setProperty('--rs-text', '#111827');
          this.container.style.setProperty('--rs-text-secondary', '#6b7280');
          this.container.style.setProperty('--rs-border', '#e5e7eb');
          this.container.style.setProperty('--rs-border-subtle', '#f3f4f6');
          
          const styleFn = this.shadow.getElementById('rs-dark-scroll-style');
          if (styleFn) styleFn.remove();
      }
  }

  private async getHistory(): Promise<Array<{ markdown: string; imageDataUrl?: string; timestamp: number }>> {
    try {
      // Check if chrome.storage is available (may be undefined after extension reload)
      if (!chrome?.storage?.local) {
        console.warn('[FloatingWindow] chrome.storage.local not available');
        return [];
      }
      const result = await chrome.storage.local.get('rectsolve_history');
      const data = result.rectsolve_history;
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[FloatingWindow] Failed to read history:', error);
      return [];
    }
  }
}
