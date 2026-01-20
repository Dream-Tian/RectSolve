// Inline storage functions to avoid chunk splitting
const STORAGE_KEYS = {
  BASE_URL: 'baseUrl',
  API_KEY: 'apiKey',
  DEFAULT_MODEL: 'defaultModel',
  POSITION: 'position',
  THEME: 'theme',
  SMART_SELECTION: 'smartSelection',
  SYSTEM_PROMPT: 'systemPrompt',
  RESPONSE_LANGUAGE: 'responseLanguage'
} as const;

// Config cache to reduce storage reads
let configCache: {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  position: string;
  theme: string;
  smartSelection: boolean;
  systemPrompt: string;
  responseLanguage: string;
} | null = null;

async function getConfig() {
  if (configCache) {
    return configCache;
  }

  const result = await chrome.storage.sync.get([
    STORAGE_KEYS.BASE_URL,
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.DEFAULT_MODEL,
    STORAGE_KEYS.POSITION,
    STORAGE_KEYS.THEME,
    STORAGE_KEYS.SMART_SELECTION,
    STORAGE_KEYS.SYSTEM_PROMPT,
    STORAGE_KEYS.RESPONSE_LANGUAGE
  ]);

  configCache = {
    baseUrl: result[STORAGE_KEYS.BASE_URL] || '',
    apiKey: result[STORAGE_KEYS.API_KEY] || '',
    defaultModel: result[STORAGE_KEYS.DEFAULT_MODEL] || '',
    position: result[STORAGE_KEYS.POSITION] || 'right',
    theme: result[STORAGE_KEYS.THEME] || 'light',
    smartSelection: result[STORAGE_KEYS.SMART_SELECTION] !== false,
    systemPrompt: result[STORAGE_KEYS.SYSTEM_PROMPT] || '',
    responseLanguage: result[STORAGE_KEYS.RESPONSE_LANGUAGE] || 'zh'
  };

  return configCache;
}

async function saveConfig(config: { baseUrl?: string; apiKey?: string; defaultModel?: string; position?: string; theme?: string; smartSelection?: boolean; systemPrompt?: string; responseLanguage?: string }) {
  const toSave: Record<string, string | boolean> = {};

  if (config.baseUrl !== undefined) {
    toSave[STORAGE_KEYS.BASE_URL] = config.baseUrl;
  }
  if (config.apiKey !== undefined) {
    toSave[STORAGE_KEYS.API_KEY] = config.apiKey;
  }
  if (config.defaultModel !== undefined) {
    toSave[STORAGE_KEYS.DEFAULT_MODEL] = config.defaultModel;
  }
  if (config.position !== undefined) {
    toSave[STORAGE_KEYS.POSITION] = config.position;
  }
  if (config.theme !== undefined) {
    toSave[STORAGE_KEYS.THEME] = config.theme;
  }
  if (config.smartSelection !== undefined) {
    toSave[STORAGE_KEYS.SMART_SELECTION] = config.smartSelection;
  }
  if (config.systemPrompt !== undefined) {
    toSave[STORAGE_KEYS.SYSTEM_PROMPT] = config.systemPrompt;
  }
  if (config.responseLanguage !== undefined) {
    toSave[STORAGE_KEYS.RESPONSE_LANGUAGE] = config.responseLanguage;
  }

  await chrome.storage.sync.set(toSave);

  // Invalidate cache
  configCache = null;
}

// Helper to normalize Base URL
function normalizeBaseUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '');
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized;
  }
  return normalized;
}

export class HistorySidebar {
  private container: HTMLDivElement;
  private isExpanded: boolean = false;
  private onSelectHistory: (markdown: string) => void;
  private onClose: () => void;
  private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListenerOrEventListenerObject }> = [];
  private tempEventListeners: Array<{ element: EventTarget; event: string; handler: EventListenerOrEventListenerObject }> = [];
  private statusTimeout: number | null = null;

  constructor(onSelectHistory: (markdown: string) => void, onClose: () => void, position: string = 'right') {
    this.onSelectHistory = onSelectHistory;
    this.onClose = onClose;

    this.container = document.createElement('div');
    this.container.className = `rectsolve-sidebar ${position}`;
    this.container.style.display = 'none';
    this.container.innerHTML = `
      <style>
        .rectsolve-sidebar {
          position: fixed;
          top: 50%;
          transform: translate(120%, -50%); /* Start off-screen (right) */
          height: 70vh;
          width: 320px;
          background: white;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          z-index: 2147483647;
          display: flex;
          flex-direction: column;
          font-family: KaiTi, "楷体", STKaiti, serif;
          transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          opacity: 0;
          pointer-events: none;
        }

        .rectsolve-sidebar.visible {
          transform: translate(0, -50%);
          opacity: 1;
          pointer-events: auto;
        }
        
        .rectsolve-sidebar.left {
           transform: translate(-120%, -50%); /* Start off-screen (left) */
        }
        
        .rectsolve-sidebar.left.visible {
           transform: translate(0, -50%);
        }
/* ... rest of CSS ... */


        .rectsolve-sidebar.right {
          right: 0;
          border-right: none;
          border-radius: 12px 0 0 12px;
        }

        .rectsolve-sidebar.left {
          left: 0;
          border-left: none;
          border-radius: 0 12px 12px 0;
        }

        .sidebar-header {
          padding: 20px 20px 10px 24px;
          display: flex;
          align-items: center;
        }

        .sidebar-title {
          font-size: 16px; /* Smaller title */
          font-weight: 600;
          color: #111827;
        }

        .sidebar-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-tabs {
          display: flex;
          align-items: center;
          border-bottom: 1px solid #e5e7eb;
          padding: 0 16px;
        }

        .sidebar-tab {
          padding: 12px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          font-size: 15px;
          color: #6b7280;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .sidebar-tab.active {
          color: #2563eb;
          border-bottom-color: #2563eb;
          font-weight: 500;
        }

        .sidebar-close {
          margin-left: auto; /* Push to right */
          background: none;
          border: none;
          font-size: 20px;
          color: #9ca3af;
          cursor: pointer;
          padding: 6px;
          line-height: 1;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .sidebar-close:hover {
          color: #374151;
          background: #f3f4f6;
        }

        .sidebar-body {
          flex: 1;
          overflow-y: auto;
        }

        /* Dark Mode */
        .rectsolve-dark-theme .rectsolve-sidebar {
            background: #1f2937;
            border-color: #374151;
        }
        .rectsolve-dark-theme .sidebar-tabs {
            border-color: #374151;
        }
        .rectsolve-dark-theme .sidebar-title {
            color: #f3f4f6;
        }
        .rectsolve-dark-theme .sidebar-close {
            color: #9ca3af;
        }
        .rectsolve-dark-theme .sidebar-close:hover {
            color: #d1d5db;
            background: #374151;
        }
        .rectsolve-dark-theme .sidebar-tab {
            color: #9ca3af;
        }
        .rectsolve-dark-theme .sidebar-tab.active {
            color: #60a5fa;
            border-bottom-color: #60a5fa;
        }

        /* History Items Styles - Keeping existing */
        .history-item {
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          cursor: pointer;
          transition: background 0.2s;
        }
        .history-item:hover {
          background: #f9fafb;
        }
        .history-time {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }
        .history-preview {
          font-size: 14px;
          color: #374151;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .rectsolve-dark-theme .history-item {
            border-color: #374151;
        }
        .rectsolve-dark-theme .history-item:hover {
            background: #374151;
        }
        .rectsolve-dark-theme .history-time {
            color: #9ca3af;
        }
        .rectsolve-dark-theme .history-preview {
            color: #d1d5db;
        }

        /* Settings UI Styles - Keeping existing */
        .custom-select {
          position: relative;
          width: 100%;
          font-family: inherit;
        }
        /* ... existing settings styles ... */
        .custom-select-trigger {
          /* ... */
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px;
          font-size: 14px;
          font-weight: 400;
          color: #374151;
          height: 38px;
          line-height: 22px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        /* ... abbreviating common styles to avoid gigantic block, just ensuring structure ... */
        /* Note: For replace tool, I need to include the full content of the replaced block or it will be cut. */
        /* Re-including critical Settings styles */
        .custom-select-trigger:hover { border-color: #d1d5db; }
        .custom-select-trigger.active { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1); }
        .custom-select-arrow { transition: transform 0.2s; }
        .custom-select-trigger.active .custom-select-arrow { transform: rotate(180deg); }
        .custom-select-dropdown {
          position: absolute; display: block; top: 100%; left: 0; right: 0;
          border: 1px solid #e5e7eb; border-radius: 6px; background: #fff;
          font-weight: 300; color: #374151; z-index: 9999; margin-top: 4px;
          opacity: 0; visibility: hidden; transform: translateY(-10px);
          transition: all 0.2s cubic-bezier(0.5, 0, 0, 1.25);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          max-height: 200px; overflow-y: auto;
        }
        .custom-select-dropdown.active { opacity: 1; visibility: visible; transform: translateY(0); }
        .custom-select-option { padding: 8px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
        .custom-select-option:hover { background-color: #f3f4f6; color: #111827; }
        .custom-select-option.selected { background-color: #eff6ff; color: #2563eb; font-weight: 500; }
        .rectsolve-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .rectsolve-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; }
        .rectsolve-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        .rectsolve-switch input:checked + .rectsolve-slider { background-color: #2563eb !important; }
        .rectsolve-switch input:focus + .rectsolve-slider { box-shadow: 0 0 1px #2563eb; }
        .rectsolve-switch input:checked + .rectsolve-slider:before { transform: translateX(20px); }
        .shortcut-box { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-family: system-ui, -apple-system, sans-serif; font-weight: 500; font-size: 13px; color: #374151; min-width: 100px; text-align: center; background: #fff; display: inline-block; }
        .position-btn.selected, .theme-btn.selected, .lang-btn.selected { background-color: #eff6ff !important; color: #2563eb !important; border-color: #2563eb !important; }
        .shortcuts-container button:hover { background-color: #f3f4f6 !important; }
        .rectsolve-dark-theme .custom-select-trigger, .rectsolve-dark-theme .custom-select-dropdown { background: #374151; border-color: #4b5563; color: #e5e7eb; }
        .rectsolve-dark-theme .custom-select-option:hover { background-color: #4b5563; color: #f3f4f6; }
        .rectsolve-dark-theme .custom-select-option.selected { background-color: #1f2937; color: #60a5fa; }
        .rectsolve-dark-theme .rectsolve-sidebar input[type="text"], .rectsolve-dark-theme .rectsolve-sidebar input[type="password"] { background: #374151 !important; border-color: #4b5563 !important; color: #e5e7eb !important; }
        .rectsolve-dark-theme .rectsolve-sidebar button { background: #374151 !important; border-color: #4b5563 !important; color: #e5e7eb !important; }
        .rectsolve-dark-theme .rectsolve-sidebar .sidebar-tab, .rectsolve-dark-theme .rectsolve-sidebar .sidebar-close { background: transparent !important; border-color: transparent !important; }
        .rectsolve-dark-theme .rectsolve-sidebar .sidebar-tab.active { border-bottom: 2px solid #60a5fa !important; color: #60a5fa !important; border-color: transparent transparent #60a5fa transparent !important; }
        .rectsolve-dark-theme .rectsolve-sidebar .custom-select-arrow path { fill: #9ca3af !important; }
        .rectsolve-dark-theme .rectsolve-sidebar .shortcut-box { background: #374151 !important; border-color: #4b5563 !important; color: #e5e7eb !important; }
        .rectsolve-dark-theme .position-btn.selected, .rectsolve-dark-theme .theme-btn.selected, .rectsolve-dark-theme .lang-btn.selected { background-color: #1f2937 !important; border-color: #60a5fa !important; color: #60a5fa !important; }
        .rectsolve-dark-theme .shortcuts-container { background: #1f2937 !important; border-color: #4b5563 !important; }
        .rectsolve-dark-theme .rectsolve-sidebar span { color: #9ca3af !important; }
        .rectsolve-dark-theme .rectsolve-sidebar label { color: #e5e7eb !important; }
        .rectsolve-dark-theme .rectsolve-sidebar #stats-total { color: #60a5fa !important; }
        .rectsolve-dark-theme .rectsolve-sidebar #stats-today { color: #34d399 !important; }
        .rectsolve-dark-theme .rectsolve-sidebar #stats-first-use { color: #e5e7eb !important; }
        .rectsolve-dark-theme .rectsolve-sidebar [style*="background: #f9fafb"] { background: #374151 !important; border-color: #4b5563 !important; }
        .rectsolve-dark-theme .rectsolve-sidebar [style*="color: #6b7280"] { color: #9ca3af !important; }
        .rectsolve-dark-theme .rectsolve-sidebar textarea { background: #374151 !important; border-color: #4b5563 !important; color: #e5e7eb !important; }
      </style>
      <div class="sidebar-header">
        <div class="sidebar-title">RectSolve</div>
      </div>
      <div class="sidebar-content">
        <div class="sidebar-tabs">
          <button class="sidebar-tab active" data-tab="history">历史</button>
          <button class="sidebar-tab" data-tab="settings">设置</button>
          <button class="sidebar-close">×</button>
        </div>
        <div class="sidebar-body"></div>
      </div>
    `;

    // Bind close button
    const closeBtn = this.container.querySelector('.sidebar-close');
    if (closeBtn) {
        this.addEventListener(closeBtn, 'click', () => {
            this.hide();
            this.onClose();
        });
    }

    // Bind tabs
    const tabs = this.container.querySelectorAll('.sidebar-tab');
    tabs.forEach(tab => {
        this.addEventListener(tab, 'click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabName = (tab as HTMLElement).dataset.tab;
            if (tabName === 'history') {
                this.refreshHistory();
            } else if (tabName === 'settings') {
                this.showSettings();
            }
        });
    });

    document.body.appendChild(this.container);
  }

  private addEventListener(element: EventTarget, event: string, handler: EventListenerOrEventListenerObject, isTemp: boolean = false) {
    element.addEventListener(event, handler);
    if (isTemp) {
        this.tempEventListeners.push({ element, event, handler });
    } else {
        this.eventListeners.push({ element, event, handler });
    }
  }

  public expand(tab: 'history' | 'settings') {
      this.show();
      // click the tab
      const tabBtn = this.container.querySelector(`.sidebar-tab[data-tab="${tab}"]`) as HTMLElement;
      if(tabBtn) tabBtn.click();
  }
  
  public collapse() {
      this.hide();
      this.onClose();
  }
  private async showSettings() {
    const body = this.container.querySelector('.sidebar-body') as HTMLElement;
    const config = await getConfig();

    body.innerHTML = `
      <div style="padding: 16px; font-family: KaiTi, '楷体', STKaiti, serif;">
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 15px; text-align: left;">API Base URL</label>
          <input type="text" id="settings-baseUrl"
            style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-family: inherit; font-size: 14px; box-sizing: border-box;">
        </div>

        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 15px; text-align: left;">API Key</label>
          <input type="password" id="settings-apiKey"
            style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-family: inherit; font-size: 14px; box-sizing: border-box;">
        </div>

        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 15px; text-align: left;">默认模型</label>
          <div class="custom-select" id="settings-model-wrapper">
             <div class="custom-select-trigger" id="settings-model-trigger">
               <span id="settings-model-text">请先测试连接</span>
               <svg class="custom-select-arrow" xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8">
                 <path fill="#374151" d="M1.41 0L6 4.59 10.59 0 12 1.41l-6 6-6-6z"/>
               </svg>
             </div>
             <div class="custom-select-dropdown" id="settings-model-dropdown">
               <div class="custom-select-option selected" data-value="">请先测试连接</div>
             </div>
           </div>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <button id="settings-test" style="flex: 1; padding: 10px; background: white; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-family: inherit; font-weight: 600; font-size: 15px;">
            测试连接
          </button>
          <button id="settings-fetch" disabled style="flex: 1; padding: 10px; background: white; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-family: inherit; font-weight: 600; font-size: 15px;">
            获取模型
          </button>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 15px; text-align: left;">自定义 Prompt</label>
          <textarea id="settings-system-prompt" rows="4"
            placeholder="留空使用默认 Prompt。示例：你是一个耐心的老师，请用简单易懂的语言解释..."
            style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-family: inherit; font-size: 13px; box-sizing: border-box; resize: vertical;"></textarea>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 15px; text-align: left;">回答语言</label>
          <div style="display: flex; gap: 8px;">
            <button id="lang-zh" class="lang-btn" style="flex: 1; padding: 8px; background: white; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 14px; transition: all 0.2s;">
              中文
            </button>
            <button id="lang-en" class="lang-btn" style="flex: 1; padding: 8px; background: white; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 14px; transition: all 0.2s;">
              English
            </button>
          </div>
        </div>

       <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <label style="font-weight: 600; font-size: 15px;">启用智能框选</label>
           <label class="rectsolve-switch" style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" id="settings-smart-selection" style="opacity: 0; width: 0; height: 0; margin: 0; padding: 0; position: absolute;">
            <span class="rectsolve-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px;"></span>
          </label>
        </div>


        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 15px; text-align: left;">显示位置</label>
          <div style="display: flex; gap: 8px;">
            <button id="position-right" class="position-btn" style="flex: 1; padding: 8px; background: white; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 14px; transition: all 0.2s;">
              右侧
            </button>
            <button id="position-left" class="position-btn" style="flex: 1; padding: 8px; background: white; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 14px; transition: all 0.2s;">
              左侧
            </button>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 15px; text-align: left;">主题</label>
          <div style="display: flex; gap: 8px;">
            <button id="theme-light" class="theme-btn" style="flex: 1; padding: 8px; background: white; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 14px; transition: all 0.2s;">
              浅色
            </button>
            <button id="theme-dark" class="theme-btn" style="flex: 1; padding: 8px; background: white; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 14px; transition: all 0.2s;">
              深色
            </button>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
           <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 15px; text-align: left;">快捷键</label>
           <div style="margin-top: 12px;">
              <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                 <label style="font-weight: 600; font-size: 15px;">开始框选</label>
                 <div style="display: flex; align-items: center; gap: 8px;">
                    <div id="shortcut-start-selection" class="shortcut-box">未设置</div>
                    <svg style="cursor: pointer; width: 16px; height: 16px; color: #9ca3af;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="shortcut-edit-btn">
                       <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                 </div>
              </div>
              <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                 <label style="font-weight: 600; font-size: 15px;">打开历史</label>
                 <div style="display: flex; align-items: center; gap: 8px;">
                    <div id="shortcut-open-history" class="shortcut-box">未设置</div>
                    <svg style="cursor: pointer; width: 16px; height: 16px; color: #9ca3af;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="shortcut-edit-btn">
                       <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                 </div>
              </div>
              <button id="open-shortcuts" style="display: none;"></button>
           </div>
        </div>

        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <label style="display: block; margin-bottom: 12px; font-weight: 600; font-size: 15px; text-align: left;">使用统计</label>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
            <div style="text-align: center; padding: 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <div id="stats-total" style="font-size: 24px; font-weight: 700; color: #2563eb;">0</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">累计解题</div>
            </div>
            <div style="text-align: center; padding: 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <div id="stats-today" style="font-size: 24px; font-weight: 700; color: #10b981;">0</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">今日解题</div>
            </div>
            <div style="text-align: center; padding: 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <div id="stats-first-use" style="font-size: 14px; font-weight: 600; color: #374151;">-</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">首次使用</div>
            </div>
          </div>
        </div>

        <div id="settings-status" style="margin-top: 10px; padding: 10px; border-radius: 6px; display: none; font-size: 14px;"></div>
      </div>
    `;

    const baseUrlInput = body.querySelector('#settings-baseUrl') as HTMLInputElement;
    const apiKeyInput = body.querySelector('#settings-apiKey') as HTMLInputElement;
    const smartSelectionCheckbox = body.querySelector('#settings-smart-selection') as HTMLInputElement;
    // ... other selectors ...
    const modelTrigger = body.querySelector('#settings-model-trigger') as HTMLElement;
    const modelText = body.querySelector('#settings-model-text') as HTMLElement;
    const modelDropdown = body.querySelector('#settings-model-dropdown') as HTMLElement;
    const positionRightBtn = body.querySelector('#position-right') as HTMLButtonElement;
    const positionLeftBtn = body.querySelector('#position-left') as HTMLButtonElement;
    const themeLightBtn = body.querySelector('#theme-light') as HTMLButtonElement;
    const themeDarkBtn = body.querySelector('#theme-dark') as HTMLButtonElement;
    const openShortcutsBtn = body.querySelector('#open-shortcuts') as HTMLButtonElement;
    const shortcutSelectionEl = body.querySelector('#shortcut-start-selection') as HTMLElement;
    const shortcutHistoryEl = body.querySelector('#shortcut-open-history') as HTMLElement;

    let selectedModel = '';
    let selectedPosition = config.position || 'right';
    let selectedTheme = config.theme || 'light';
    let smartSelectionEnabled = config.smartSelection;

    if (baseUrlInput) baseUrlInput.value = config.baseUrl || '';
    if (apiKeyInput) apiKeyInput.value = config.apiKey || '';
    if (smartSelectionCheckbox) smartSelectionCheckbox.checked = smartSelectionEnabled;

    // Load and auto-save system prompt
    const systemPromptTextarea = body.querySelector('#settings-system-prompt') as HTMLTextAreaElement;
    if (systemPromptTextarea) {
      systemPromptTextarea.value = config.systemPrompt || '';
      this.addEventListener(systemPromptTextarea, 'blur', async () => {
        await saveConfig({ systemPrompt: systemPromptTextarea.value.trim() });
      });
    }

    // Language selector
    const langZhBtn = body.querySelector('#lang-zh') as HTMLButtonElement;
    const langEnBtn = body.querySelector('#lang-en') as HTMLButtonElement;
    let selectedLanguage = config.responseLanguage || 'zh';

    const updateLanguageButtons = () => {
      langZhBtn?.classList.toggle('selected', selectedLanguage === 'zh');
      langEnBtn?.classList.toggle('selected', selectedLanguage === 'en');
    };
    updateLanguageButtons();

    if (langZhBtn) {
      this.addEventListener(langZhBtn, 'click', async () => {
        selectedLanguage = 'zh';
        updateLanguageButtons();
        await saveConfig({ responseLanguage: 'zh' });
      });
    }
    if (langEnBtn) {
      this.addEventListener(langEnBtn, 'click', async () => {
        selectedLanguage = 'en';
        updateLanguageButtons();
        await saveConfig({ responseLanguage: 'en' });
      });
    }

    // Load and display statistics
    const statsTotalEl = body.querySelector('#stats-total') as HTMLElement;
    const statsTodayEl = body.querySelector('#stats-today') as HTMLElement;
    const statsFirstUseEl = body.querySelector('#stats-first-use') as HTMLElement;
    
    const loadStats = async () => {
      try {
        const result = await chrome.storage.local.get('rectsolve_stats');
        if (result.rectsolve_stats) {
          const stats = JSON.parse(result.rectsolve_stats);
          const today = new Date().toISOString().split('T')[0];
          
          if (statsTotalEl) statsTotalEl.textContent = stats.totalCount || '0';
          if (statsTodayEl) {
            // Show today's count only if date matches
            statsTodayEl.textContent = stats.todayDate === today ? (stats.todayCount || '0') : '0';
          }
          if (statsFirstUseEl && stats.firstUseDate) {
            // Format date as YYYY/MM/DD
            statsFirstUseEl.textContent = stats.firstUseDate.replace(/-/g, '/');
          }
        }
      } catch (error) {
        console.error('[HistorySidebar] Failed to load stats:', error);
      }
    };
    loadStats();

    if (smartSelectionCheckbox) {
      this.addEventListener(smartSelectionCheckbox, 'change', async () => {
        smartSelectionEnabled = smartSelectionCheckbox.checked;
        try {
            await saveConfig({ smartSelection: smartSelectionEnabled });
            this.showSettingsStatus(statusDiv, '设置已保存', 'success');
        } catch (error) {
            console.error('[HistorySidebar] Failed to save smart selection config:', error);
            this.showSettingsStatus(statusDiv, '保存失败', 'error');
        }
      });
    }

    // ... rest of event listeners ...

    // Load shortcuts from storage (cached by background script)
    const loadShortcuts = async () => {
      try {
        console.log('[HistorySidebar] Loading shortcuts...');

        // Wait for background to refresh shortcuts cache
        await chrome.runtime.sendMessage({ type: 'REFRESH_SHORTCUTS' });

        const result = await chrome.storage.local.get('shortcuts');
        const shortcuts = result.shortcuts as Record<string, string> | undefined;

        console.log('[HistorySidebar] Loaded shortcuts from storage:', shortcuts);

        if (!shortcuts || Object.keys(shortcuts).length === 0) {
          console.warn('[HistorySidebar] No shortcuts found in storage');
          if (shortcutSelectionEl) shortcutSelectionEl.textContent = '未设置';
          if (shortcutHistoryEl) shortcutHistoryEl.textContent = '未设置';
          return;
        }

        if (shortcutSelectionEl) {
          const selectionShortcut = shortcuts['start-selection'] || '未设置';
          console.log('[HistorySidebar] Setting start-selection to:', selectionShortcut);
          shortcutSelectionEl.textContent = selectionShortcut;
        }
        if (shortcutHistoryEl) {
          const historyShortcut = shortcuts['open-history'] || '未设置';
          console.log('[HistorySidebar] Setting open-history to:', historyShortcut);
          shortcutHistoryEl.textContent = historyShortcut;
        }
      } catch (error) {
        console.error('[HistorySidebar] Error loading shortcuts:', error);
        if (shortcutSelectionEl) shortcutSelectionEl.textContent = '未设置';
        if (shortcutHistoryEl) shortcutHistoryEl.textContent = '未设置';
      }
    };

    // Load shortcuts immediately
    loadShortcuts();

    // Open shortcuts settings
    const openShortcutsHandler = () => {
        console.log('[HistorySidebar] Opening shortcuts settings');
        try {
          chrome.runtime.sendMessage({ type: 'OPEN_SHORTCUTS' });
        } catch (e) {
          console.error('[HistorySidebar] Failed to open shortcuts:', e);
        }
    };

    if (openShortcutsBtn) {
      this.addEventListener(openShortcutsBtn, 'click', openShortcutsHandler);
    }
    
    const editBtns = body.querySelectorAll('.shortcut-edit-btn');
    editBtns.forEach(btn => {
        this.addEventListener(btn, 'click', openShortcutsHandler);
    });


    // Auto-save helper function
    const autoSave = async () => {
      const baseUrl = baseUrlInput?.value.trim();
      const apiKey = apiKeyInput?.value.trim();

      if (!baseUrl || !apiKey || !selectedModel) {
        return;
      }

      try {
        const normalizedUrl = normalizeBaseUrl(baseUrl);
        await saveConfig({
          baseUrl: normalizedUrl,
          apiKey,
          defaultModel: selectedModel,
          position: selectedPosition,
          theme: selectedTheme
        });
        this.showSettingsStatus(statusDiv, '配置已自动保存', 'success');
      } catch (error) {
        console.error('[HistorySidebar] Auto-save failed:', error);
      }
    };

    // Auto-save on input blur
    if (baseUrlInput) {
      this.addEventListener(baseUrlInput, 'blur', autoSave, true);
    }
    if (apiKeyInput) {
      this.addEventListener(apiKeyInput, 'blur', autoSave, true);
    }

    // Set position button states
    if (selectedPosition === 'right') {
      positionRightBtn.classList.add('selected');
      positionLeftBtn.classList.remove('selected');
    } else {
      positionLeftBtn.classList.add('selected');
      positionRightBtn.classList.remove('selected');
    }

    // Set theme button states
    if (selectedTheme === 'light') {
      themeLightBtn.classList.add('selected');
      themeDarkBtn.classList.remove('selected');
    } else {
      themeDarkBtn.classList.add('selected');
      themeLightBtn.classList.remove('selected');
    }

    // Position button handlers
    this.addEventListener(positionRightBtn, 'click', async () => {
      selectedPosition = 'right';
      positionRightBtn.classList.add('selected');
      positionLeftBtn.classList.remove('selected');
      await autoSave();
    }, true);

    this.addEventListener(positionLeftBtn, 'click', async () => {
      selectedPosition = 'left';
      positionLeftBtn.classList.add('selected');
      positionRightBtn.classList.remove('selected');
      await autoSave();
    }, true);

    // Theme button handlers
    this.addEventListener(themeLightBtn, 'click', async () => {
      selectedTheme = 'light';
      themeLightBtn.classList.add('selected');
      themeDarkBtn.classList.remove('selected');
      document.documentElement.classList.remove('rectsolve-dark-theme');
      await autoSave();
    }, true);

    this.addEventListener(themeDarkBtn, 'click', async () => {
      selectedTheme = 'dark';
      themeDarkBtn.classList.add('selected');
      themeLightBtn.classList.remove('selected');
      document.documentElement.classList.add('rectsolve-dark-theme');
      await autoSave();
    }, true);

    if (config.defaultModel) {
      selectedModel = config.defaultModel;
      if (modelText) modelText.textContent = config.defaultModel;
      modelDropdown.innerHTML = `<div class="custom-select-option selected" data-value="${config.defaultModel}">${config.defaultModel}</div>`;
    }

    // Custom select toggle
    if (modelTrigger) {
      const toggleHandler = (e: Event) => {
        e.stopPropagation();
        modelTrigger.classList.toggle('active');
        modelDropdown.classList.toggle('active');
      };
      this.addEventListener(modelTrigger, 'click', toggleHandler, true);
    }

    // Close dropdown when clicking outside
    const closeDropdownHandler = () => {
      if (modelTrigger && modelDropdown) {
        modelTrigger.classList.remove('active');
        modelDropdown.classList.remove('active');
      }
    };
    this.addEventListener(document, 'click', closeDropdownHandler, true);

    // Handle option selection
    const optionSelectHandler = async (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('custom-select-option')) {
        const value = target.dataset.value || '';
        selectedModel = value;
        if (modelText) modelText.textContent = target.textContent || '';

        // Update selected state
        modelDropdown.querySelectorAll('.custom-select-option').forEach(opt => {
          opt.classList.remove('selected');
        });
        target.classList.add('selected');

        // Close dropdown
        modelTrigger.classList.remove('active');
        modelDropdown.classList.remove('active');

        // Auto-save when model is selected
        await autoSave();
      }
    };
    this.addEventListener(modelDropdown, 'click', optionSelectHandler, true);

    const testBtn = body.querySelector('#settings-test') as HTMLButtonElement;
    const fetchBtn = body.querySelector('#settings-fetch') as HTMLButtonElement;
    const statusDiv = body.querySelector('#settings-status') as HTMLElement;

    let cachedModels: string[] = [];

    // Test connection
    if (testBtn) {
      const testHandler = async () => {
        const baseUrl = baseUrlInput?.value.trim();
        const apiKey = apiKeyInput?.value.trim();

        if (!baseUrl || !apiKey) {
          this.showSettingsStatus(statusDiv, '请填写 Base URL 和 API Key', 'error');
          return;
        }

        testBtn.disabled = true;
        this.showSettingsStatus(statusDiv, '测试连接中...', 'info');

        try {
          const normalizedUrl = normalizeBaseUrl(baseUrl);

          // Send message to background script for secure API call
          const response = await chrome.runtime.sendMessage({
            type: 'FETCH_MODELS',
            baseUrl: normalizedUrl,
            apiKey: apiKey
          });

          if (!response.success) {
            cachedModels = [];
            fetchBtn.disabled = true;
            throw new Error(response.error || 'Unknown error');
          }

          if (response.models && Array.isArray(response.models)) {
            cachedModels = response.models;

            modelDropdown.innerHTML = '';
            cachedModels.forEach(modelId => {
              const option = document.createElement('div');
              option.className = 'custom-select-option';
              option.dataset.value = modelId;
              option.textContent = modelId;
              modelDropdown.appendChild(option);
            });

            this.showSettingsStatus(statusDiv, `连接成功！已加载 ${cachedModels.length} 个模型`, 'success');
            fetchBtn.disabled = false;
          } else {
            cachedModels = [];
            fetchBtn.disabled = true;
            throw new Error('响应格式不正确');
          }
        } catch (error) {
          cachedModels = [];
          fetchBtn.disabled = true;
          this.showSettingsStatus(statusDiv, `连接失败: ${(error as Error).message}`, 'error');
        } finally {
          testBtn.disabled = false;
        }
      };
      this.addEventListener(testBtn, 'click', testHandler, true);
    }

    // Fetch models
    if (fetchBtn) {
      const fetchHandler = () => {
        if (cachedModels.length === 0) {
          this.showSettingsStatus(statusDiv, '请先测试连接', 'error');
          return;
        }

        modelDropdown.innerHTML = '';
        cachedModels.forEach(modelId => {
          const option = document.createElement('div');
          option.className = 'custom-select-option';
          option.dataset.value = modelId;
          option.textContent = modelId;
          modelDropdown.appendChild(option);
        });

        this.showSettingsStatus(statusDiv, `已加载 ${cachedModels.length} 个模型`, 'success');
      };
      this.addEventListener(fetchBtn, 'click', fetchHandler, true);
    }
  }

  private showSettingsStatus(statusDiv: HTMLElement, message: string, type: 'success' | 'error' | 'info') {
    if (!statusDiv) return;

    if (this.statusTimeout !== null) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }

    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    if (type === 'success') {
      statusDiv.style.background = '#d4edda';
      statusDiv.style.color = '#155724';
      statusDiv.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
      statusDiv.style.background = '#f8d7da';
      statusDiv.style.color = '#721c24';
      statusDiv.style.border = '1px solid #f5c6cb';
    } else {
      statusDiv.style.background = '#d1ecf1';
      statusDiv.style.color = '#0c5460';
      statusDiv.style.border = '1px solid #bee5eb';
    }

    this.statusTimeout = window.setTimeout(() => {
      statusDiv.style.display = 'none';
      this.statusTimeout = null;
    }, 3000);
  }

  private cleanupEventListeners() {
    this.tempEventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.tempEventListeners = [];
  }

  private cleanup() {
    if (this.statusTimeout !== null) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }

    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    this.cleanupEventListeners();
  }

  private async getHistory(): Promise<Array<{ markdown: string; timestamp: number }>> {
    try {
      const result = await chrome.storage.local.get('rectsolve_history');
      const data = result.rectsolve_history;
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[HistorySidebar] Failed to read history:', error);
      return [];
    }
  }

  private async refreshHistory() {
    const history = await this.getHistory();
    const body = this.container.querySelector('.sidebar-body') as HTMLElement;

    if (history.length === 0) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="empty-text">暂无历史记录</div>
        </div>
      `;
      return;
    }

    body.innerHTML = '';

    history.forEach((item, index) => {
      const date = new Date(item.timestamp).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.dataset.index = String(index);

      const timeDiv = document.createElement('div');
      timeDiv.className = 'history-time';
      timeDiv.textContent = date;

      const previewDiv = document.createElement('div');
      previewDiv.className = 'history-preview';
      const preview = item.markdown.substring(0, 80).replace(/\n/g, ' ').replace(/#/g, '');
      previewDiv.textContent = preview;

      historyItem.appendChild(timeDiv);
      historyItem.appendChild(previewDiv);

      const clickHandler = () => {
        this.onSelectHistory(item.markdown);
        this.collapse();
      };
      this.addEventListener(historyItem, 'click', clickHandler, true);

      body.appendChild(historyItem);
    });
  }

  public show() {
    if (!this.container.parentNode) {
      document.body.appendChild(this.container);
    }
    // Ensure element is in DOM and layout
    this.container.style.display = 'flex';
    
    // Force reflow
    const _ = this.container.offsetHeight;
    
    // Use double RAF to ensure transition plays
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.container.classList.add('visible');
      });
    });
  }

  public hide() {
    this.container.classList.remove('visible');
    
    // Wait for transition (0.8s) to finish before hiding display
    setTimeout(() => {
        if (!this.container.classList.contains('visible')) {
           this.container.style.display = 'none';
        }
    }, 800);
  }

  public refresh() {
    if (this.isExpanded) {
      this.refreshHistory();
    }
  }
}
