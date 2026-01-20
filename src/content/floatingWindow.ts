import { renderMarkdown } from './renderer';

const WINDOW_STYLES = `
:host {
  --rs-primary: #2563eb;
  --rs-primary-hover: #1d4ed8;
  --rs-bg: #ffffff;
  --rs-text: #111827;
  --rs-text-secondary: #6b7280;
  --rs-border: #e5e7eb;
  --rs-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --rs-radius: 12px;
  --rs-font: KaiTi, "楷体", STKaiti, serif;
}

.rs-window {
  position: fixed;
  width: 500px;
  max-height: 700px;
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
  background: #ffffff;
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
  background: #ffffff;
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
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 13px;
  color: #0f172a;
}

.rs-content pre {
  background: #f8fafc;
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
  background: #f8fafc;
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

.hidden { display: none !important; }

.rs-footer {
  padding: 12px 16px;
  background: #ffffff;
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
  background: white;
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

.rs-spinner {
  width: 24px;
  height: 24px;
  color: var(--rs-primary);
  animation: rs-spin 1s linear infinite;
}

@keyframes rs-spin {
  100% { transform: rotate(360deg); }
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
  background: #f9fafb;
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
  
  // Multi-turn conversation state
  private conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private currentImageUrl: string = '';
  private currentSystemPrompt: string = '';
  private lastMarkdown: string = '';

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
      <div class="rs-header">
        <div class="rs-brand">
          <svg class="rs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--rs-primary);">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
          <div class="rs-title">RectSolve AI</div>
        </div>
        <button class="rs-close-btn" title="关闭">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="rs-body">
        <div class="rs-preview hidden">
          <div class="rs-preview-label">题目截图</div>
          <img class="rs-preview-img" src="" alt="题目截图" />
        </div>
        <div class="rs-loading hidden">
          <svg class="rs-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>正在生成回答...</span>
        </div>
        <div class="rs-content"></div>
      </div>
      <div class="rs-footer">
        <span class="rs-status">Ready</span>
        <div class="rs-actions">
          <button class="rs-action-btn" id="rs-copy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            复制
          </button>
        </div>
      </div>
      <div class="rs-followup hidden">
        <input type="text" class="rs-followup-input" placeholder="继续追问...（如：能换种解法吗）" />
        <button class="rs-followup-send">发送</button>
      </div>
    `;

    this.shadow.appendChild(windowEl);

    this.contentArea = windowEl.querySelector('.rs-content');
    this.header = windowEl.querySelector('.rs-header');

    windowEl.querySelector('.rs-close-btn')?.addEventListener('click', () => this.hide());
    windowEl.querySelector('#rs-copy')?.addEventListener('click', () => this.copyContent());
    
    // Follow-up send handler
    const followupInput = windowEl.querySelector('.rs-followup-input') as HTMLInputElement;
    const followupSend = windowEl.querySelector('.rs-followup-send') as HTMLButtonElement;
    
    followupSend?.addEventListener('click', () => this.sendFollowUp(followupInput));
    followupInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendFollowUp(followupInput);
      }
    });
  }

  private bindEvents() {
    if (!this.header) return;

    this.header.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      const win = this.shadow.querySelector('.rs-window') as HTMLElement;
      const rect = win.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    });

    this.mouseMoveHandler = (e: MouseEvent) => {
      if (!this.isDragging) return;
      const win = this.shadow.querySelector('.rs-window') as HTMLElement;

      const x = Math.max(0, Math.min(e.clientX - this.dragOffset.x, window.innerWidth - win.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - this.dragOffset.y, window.innerHeight - win.offsetHeight));

      win.style.left = `${x}px`;
      win.style.top = `${y}px`;
      win.style.transform = 'none';
    };

    this.mouseUpHandler = () => {
      this.isDragging = false;
    };

    window.addEventListener('mousemove', this.mouseMoveHandler);
    window.addEventListener('mouseup', this.mouseUpHandler);
  }

  public cleanup() {
    if (this.mouseMoveHandler) {
      window.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    if (this.mouseUpHandler) {
      window.removeEventListener('mouseup', this.mouseUpHandler);
      this.mouseUpHandler = null;
    }
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

    // Show loading
    this.updateStatus('追问中...');
    const sendBtn = this.shadow.querySelector('.rs-followup-send') as HTMLButtonElement;
    if (sendBtn) sendBtn.disabled = true;

    try {
      // Call FOLLOW_UP API
      const response = await chrome.runtime.sendMessage({
        type: 'FOLLOW_UP',
        messages: this.conversationMessages,
        imageDataUrl: this.currentImageUrl,
        systemPrompt: this.currentSystemPrompt
      });

      if (response && response.success && response.markdown) {
        // Append new response to conversation (this is done in showContent)
        // Append to content area instead of replacing
        if (this.contentArea) {
          const divider = document.createElement('div');
          divider.innerHTML = '<hr style="border: none; border-top: 1px solid var(--rs-border); margin: 16px 0;">';
          this.contentArea.appendChild(divider.firstChild!);
          
          const newContent = document.createElement('div');
          newContent.innerHTML = await renderMarkdown(response.markdown);
          Array.from(newContent.childNodes).forEach(node => this.contentArea!.appendChild(node));
          
          // Store assistant response
          this.conversationMessages.push({ role: 'assistant', content: response.markdown });
          this.lastMarkdown = response.markdown;
        }
        this.updateStatus('Done');
      } else {
        this.updateStatus(`追问失败: ${response?.error || '未知错误'}`);
      }
    } catch (error) {
      this.updateStatus(`追问失败: ${(error as Error).message}`);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
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

  public showError(message: string) {
    const loading = this.shadow.querySelector('.rs-loading');
    const content = this.shadow.querySelector('.rs-content');
    loading?.classList.add('hidden');
    content?.classList.remove('hidden');

    // Provide user-friendly error messages
    let friendlyMessage = message;
    if (message.includes('Missing configuration')) {
      friendlyMessage = '请先在设置中配置 API 信息';
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
        </div>`;
    }
    this.updateStatus("Error");
  }

  private updateStatus(text: string) {
    const status = this.shadow.querySelector('.rs-status');
    if (status) status.textContent = text;
  }

  private async copyContent() {
    if (!this.contentArea) return;
    const text = this.contentArea.innerText;
    try {
      await navigator.clipboard.writeText(text);
      this.updateStatus("已复制到剪贴板");
      setTimeout(() => this.updateStatus("Done"), 2000);
    } catch (error) {
      this.updateStatus("复制失败");
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
      const trimmed = history.slice(0, 10);
      await chrome.storage.local.set({ rectsolve_history: JSON.stringify(trimmed) });
      
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

  private async getHistory(): Promise<Array<{ markdown: string; imageDataUrl?: string; timestamp: number }>> {
    try {
      const result = await chrome.storage.local.get('rectsolve_history');
      const data = result.rectsolve_history;
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[FloatingWindow] Failed to read history:', error);
      return [];
    }
  }
}
