// Inline storage functions to avoid chunk splitting
const STORAGE_KEYS = {
  BASE_URL: 'baseUrl',
  API_KEY: 'apiKey',
  DEFAULT_MODEL: 'defaultModel',
  POSITION: 'position',
  THEME: 'theme'
} as const;

// Config cache to reduce storage reads
let configCache: {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  position: string;
  theme: string;
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
    STORAGE_KEYS.THEME
  ]);

  configCache = {
    baseUrl: result[STORAGE_KEYS.BASE_URL] || '',
    apiKey: result[STORAGE_KEYS.API_KEY] || '',
    defaultModel: result[STORAGE_KEYS.DEFAULT_MODEL] || '',
    position: result[STORAGE_KEYS.POSITION] || 'right',
    theme: result[STORAGE_KEYS.THEME] || 'light'
  };

  return configCache;
}

async function saveConfig(config: { baseUrl?: string; apiKey?: string; defaultModel?: string; position?: string; theme?: string }) {
  const toSave: Record<string, string> = {};

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

  await chrome.storage.sync.set(toSave);

  // Invalidate cache
  configCache = null;
}

function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();

  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  normalized = normalized.replace(/\/+$/, '');

  if (!normalized.endsWith('/v1')) {
    normalized += '/v1';
  }

  return normalized;
}

export class HistorySidebar {
  private container: HTMLDivElement;
  private isExpanded = false;
  private currentTab: 'history' | 'settings' = 'history';
  private onSelectHistory: (markdown: string) => void;
  private onClose?: () => void;
  private position: 'left' | 'right';
  private eventListeners: Array<{ element: HTMLElement | Document; event: string; handler: EventListener }> = [];
  private tempEventListeners: Array<{ element: HTMLElement | Document; event: string; handler: EventListener }> = [];
  private statusTimeout: number | null = null;

  constructor(onSelectHistory: (markdown: string) => void, onClose?: () => void, position: 'left' | 'right' = 'right') {
    this.onSelectHistory = onSelectHistory;
    this.onClose = onClose;
    this.position = position;
    this.container = this.createSidebar();
    this.bindEvents();
  }

  private createSidebar(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'rectsolve-history-sidebar';
    if (this.position === 'left') {
      container.classList.add('on-left');
    }
    container.innerHTML = `
      <style>
        /* Dark theme variables */
        .rectsolve-dark-theme #rectsolve-history-sidebar {
          background: #1f2937;
          border-color: #374151;
          box-shadow: -5px 0 25px rgba(0, 0, 0, 0.5);
        }

        .rectsolve-dark-theme #rectsolve-history-sidebar.on-left {
          box-shadow: 5px 0 25px rgba(0, 0, 0, 0.5);
          border-color: #374151;
        }

        .rectsolve-dark-theme .sidebar-header {
          background: #1f2937 !important;
          border-color: #374151 !important;
          color: #f3f4f6 !important;
        }

        .rectsolve-dark-theme .sidebar-tab-btn {
          background: #374151 !important;
          color: #d1d5db !important;
          border-color: #4b5563 !important;
        }

        .rectsolve-dark-theme .sidebar-tab-btn.active {
          background: #3b82f6 !important;
          color: white !important;
          border-color: #3b82f6 !important;
        }

        .rectsolve-dark-theme .sidebar-body {
          background: #111827 !important;
        }

        .rectsolve-dark-theme .history-item {
          background: #1f2937 !important;
          border-color: #374151 !important;
        }

        .rectsolve-dark-theme .history-item:hover {
          border-color: #3b82f6 !important;
        }

        .rectsolve-dark-theme .history-time,
        .rectsolve-dark-theme .history-preview {
          color: #d1d5db !important;
        }

        .rectsolve-dark-theme .empty-text {
          color: #9ca3af !important;
        }

        .rectsolve-dark-theme .custom-select-trigger {
          background: #374151 !important;
          border-color: #4b5563 !important;
          color: #f3f4f6 !important;
        }

        .rectsolve-dark-theme .custom-select-dropdown {
          background: #1f2937 !important;
          border-color: #4b5563 !important;
        }

        .rectsolve-dark-theme .custom-select-option {
          color: #d1d5db !important;
        }

        .rectsolve-dark-theme .custom-select-option:hover {
          background: #374151 !important;
        }

        .rectsolve-dark-theme .custom-select-option.selected {
          background: #1e40af !important;
          color: #93c5fd !important;
        }

        /* Dark theme for settings page */
        .rectsolve-dark-theme .sidebar-body label {
          color: #f3f4f6 !important;
        }

        .rectsolve-dark-theme .sidebar-body input[type="text"],
        .rectsolve-dark-theme .sidebar-body input[type="password"] {
          background: #374151 !important;
          border-color: #4b5563 !important;
          color: #f3f4f6 !important;
        }

        .rectsolve-dark-theme .sidebar-body input[type="text"]::placeholder,
        .rectsolve-dark-theme .sidebar-body input[type="password"]::placeholder {
          color: #9ca3af !important;
        }

        .rectsolve-dark-theme .sidebar-body .position-btn,
        .rectsolve-dark-theme .sidebar-body .theme-btn,
        .rectsolve-dark-theme .sidebar-body #settings-test,
        .rectsolve-dark-theme .sidebar-body #settings-fetch {
          background: #374151 !important;
          color: #d1d5db !important;
          border-color: #4b5563 !important;
        }

        /* Selected state for position and theme buttons */
        .position-btn.selected,
        .theme-btn.selected {
          background: #2563eb !important;
          color: white !important;
          border-color: #2563eb !important;
        }

        .rectsolve-dark-theme .sidebar-body .position-btn.selected,
        .rectsolve-dark-theme .sidebar-body .theme-btn.selected {
          background: #2563eb !important;
          color: white !important;
          border-color: #2563eb !important;
        }

        .rectsolve-dark-theme .sidebar-body .position-btn:hover,
        .rectsolve-dark-theme .sidebar-body .theme-btn:hover,
        .rectsolve-dark-theme .sidebar-body #settings-test:hover,
        .rectsolve-dark-theme .sidebar-body #settings-fetch:hover:not(:disabled) {
          background: #4b5563 !important;
        }

        .rectsolve-dark-theme .sidebar-body #settings-fetch:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .rectsolve-dark-theme .sidebar-body #settings-status {
          background: #374151 !important;
          color: #f3f4f6 !important;
          border-color: #4b5563 !important;
        }

        /* Dark theme for shortcuts section */
        .rectsolve-dark-theme .sidebar-body #open-shortcuts {
          background: #374151 !important;
          color: #d1d5db !important;
          border-color: #4b5563 !important;
        }

        .rectsolve-dark-theme .sidebar-body #open-shortcuts:hover {
          background: #4b5563 !important;
        }

        .rectsolve-dark-theme .sidebar-body code {
          background: #374151 !important;
          color: #f3f4f6 !important;
          border-color: #4b5563 !important;
        }

        .rectsolve-dark-theme .sidebar-body .shortcuts-container {
          background: #1f2937 !important;
          border-color: #4b5563 !important;
        }

        .rectsolve-dark-theme .sidebar-body .shortcuts-container span {
          color: #9ca3af !important;
        }

        #rectsolve-history-sidebar {
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%) translateX(100%);
          width: 320px;
          height: 80vh;
          max-height: 800px;
          background: white;
          box-shadow: -5px 0 25px rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
          border-right: none;
          border-radius: 16px 0 0 16px;
          z-index: 2147483645;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          font-family: KaiTi, "楷体", STKaiti, serif;
        }

        #rectsolve-history-sidebar.on-left {
          right: auto;
          left: 0;
          transform: translateY(-50%) translateX(-100%);
          box-shadow: 5px 0 25px rgba(0, 0, 0, 0.1);
          border-right: 1px solid #e5e7eb;
          border-left: none;
          border-radius: 0 16px 16px 0;
        }

        #rectsolve-history-sidebar.expanded {
          transform: translateY(-50%) translateX(0) !important;
        }

        .sidebar-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 16px 0 0 16px;
        }

        .sidebar-header {
          padding: 16px 20px;
          background: white;
          border-bottom: 1px solid #f3f4f6;
          color: #111827;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sidebar-tabs {
          display: flex;
          gap: 8px;
        }

        .sidebar-tab-btn {
          flex: 1;
          padding: 8px 16px;
          background: transparent;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: KaiTi, "楷体", STKaiti, serif;
          white-space: nowrap;
          min-width: 90px;
        }

        .sidebar-tab-btn.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .sidebar-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sidebar-title {
          font-size: 16px;
          font-weight: 600;
          font-family: KaiTi, "楷体", STKaiti, serif;
        }

        .sidebar-close {
          background: transparent;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .sidebar-close:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .sidebar-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: #f9fafb;
        }

        .history-item {
          background: white;
          border: 1px solid transparent;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .history-item:hover {
          border-color: #bfdbfe;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          transform: translateX(-2px);
        }

        .history-time {
          font-size: 12px;
          color: #9ca3af;
          margin-bottom: 6px;
          font-family: KaiTi, "楷体", STKaiti, serif;
        }

        .history-preview {
          font-size: 14px;
          color: #374151;
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          font-family: KaiTi, "楷体", STKaiti, serif;
        }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          color: #9ca3af;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .empty-text {
          font-size: 14px;
        }

        .custom-select {
          position: relative;
          width: 100%;
        }

        .custom-select-trigger {
          width: 100%;
          padding: 8px 32px 8px 8px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .custom-select-trigger:hover {
          border-color: #d1d5db;
        }

        .custom-select-trigger.active {
          border-color: #2563eb;
        }

        .custom-select-arrow {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 12px;
          height: 8px;
          pointer-events: none;
          transition: transform 0.2s;
        }

        .custom-select-trigger.active .custom-select-arrow {
          transform: translateY(-50%) rotate(180deg);
        }

        .custom-select-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          max-height: 200px;
          overflow-y: auto;
          z-index: 1000;
          display: none;
        }

        .custom-select-dropdown.active {
          display: block;
        }

        .custom-select-option {
          padding: 10px 12px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.15s;
          font-family: inherit;
        }

        .custom-select-option:hover {
          background: #f3f4f6;
        }

        .custom-select-option.selected {
          background: #eff6ff;
          color: #2563eb;
          font-weight: 500;
        }

        .custom-select-option:first-child {
          border-radius: 6px 6px 0 0;
        }

        .custom-select-option:last-child {
          border-radius: 0 0 6px 6px;
        }
      </style>

      <div class="sidebar-content">
        <div class="sidebar-header">
          <div class="sidebar-tabs" role="tablist" aria-label="侧边栏标签页">
            <button class="sidebar-tab-btn active" data-tab="history" role="tab" aria-selected="true" aria-controls="history-panel">历史记录</button>
            <button class="sidebar-tab-btn" data-tab="settings" role="tab" aria-selected="false" aria-controls="settings-panel">设置</button>
          </div>
          <button class="sidebar-close" aria-label="关闭侧边栏">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sidebar-body" role="tabpanel" id="history-panel" aria-labelledby="history-tab">
          <div class="empty-state">
            <div class="empty-text">暂无历史记录</div>
          </div>
        </div>
      </div>
    `;

    return container;
  }

  private addEventListener(element: HTMLElement | Document, event: string, handler: EventListener, temporary: boolean = false) {
    element.addEventListener(event, handler);
    if (temporary) {
      this.tempEventListeners.push({ element, event, handler });
    } else {
      this.eventListeners.push({ element, event, handler });
    }
  }

  private bindEvents() {
    const closeBtn = this.container.querySelector('.sidebar-close') as HTMLElement;
    this.addEventListener(closeBtn, 'click', () => {
      this.collapse();
    });

    const tabBtns = this.container.querySelectorAll('.sidebar-tab-btn');
    tabBtns.forEach(btn => {
      this.addEventListener(btn as HTMLElement, 'click', () => {
        const tab = (btn as HTMLElement).dataset.tab as 'history' | 'settings';
        this.switchTab(tab);
      });
    });
  }

  private switchTab(tab: 'history' | 'settings') {
    this.currentTab = tab;

    const tabBtns = this.container.querySelectorAll('.sidebar-tab-btn');
    tabBtns.forEach(btn => {
      const isActive = (btn as HTMLElement).dataset.tab === tab;
      if (isActive) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    this.cleanupEventListeners();

    if (tab === 'history') {
      this.refreshHistory();
    } else {
      this.showSettings();
    }
  }

  public expand(tab: 'history' | 'settings' = 'history') {
    this.show(); // Ensure it's in the DOM
    this.isExpanded = true;
    this.container.classList.add('expanded');
    this.switchTab(tab);
  }

  private collapse() {
    this.isExpanded = false;
    this.container.classList.remove('expanded');
    if (this.onClose) {
      this.onClose();
    }
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
          <div class="shortcuts-container" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-size: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="color: #6b7280;">开始框选</span>
              <code id="shortcut-selection" style="background: white; padding: 6px 10px; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 400; color: #374151; border: 1px solid #e5e7eb; min-width: 70px; text-align: center; display: inline-block;">...</code>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="color: #6b7280;">打开历史</span>
              <code id="shortcut-history" style="background: white; padding: 6px 10px; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 400; color: #374151; border: 1px solid #e5e7eb; min-width: 70px; text-align: center; display: inline-block;">...</code>
            </div>
            <button id="open-shortcuts" style="width: 100%; margin-top: 8px; padding: 8px; background: white; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 13px; transition: all 0.2s;">
              自定义快捷键
            </button>
          </div>
        </div>

        <div id="settings-status" style="margin-top: 10px; padding: 10px; border-radius: 6px; display: none; font-size: 14px;"></div>
      </div>
    `;

    const baseUrlInput = body.querySelector('#settings-baseUrl') as HTMLInputElement;
    const apiKeyInput = body.querySelector('#settings-apiKey') as HTMLInputElement;
    const modelTrigger = body.querySelector('#settings-model-trigger') as HTMLElement;
    const modelText = body.querySelector('#settings-model-text') as HTMLElement;
    const modelDropdown = body.querySelector('#settings-model-dropdown') as HTMLElement;
    const positionRightBtn = body.querySelector('#position-right') as HTMLButtonElement;
    const positionLeftBtn = body.querySelector('#position-left') as HTMLButtonElement;
    const themeLightBtn = body.querySelector('#theme-light') as HTMLButtonElement;
    const themeDarkBtn = body.querySelector('#theme-dark') as HTMLButtonElement;
    const shortcutSelectionEl = body.querySelector('#shortcut-selection') as HTMLElement;
    const shortcutHistoryEl = body.querySelector('#shortcut-history') as HTMLElement;
    const openShortcutsBtn = body.querySelector('#open-shortcuts') as HTMLButtonElement;

    console.log('[HistorySidebar] Open shortcuts button found:', !!openShortcutsBtn);

    let selectedModel = '';
    let selectedPosition = config.position || 'right';
    let selectedTheme = config.theme || 'light';

    if (baseUrlInput) baseUrlInput.value = config.baseUrl || '';
    if (apiKeyInput) apiKeyInput.value = config.apiKey || '';

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
    if (openShortcutsBtn) {
      this.addEventListener(openShortcutsBtn, 'click', () => {
        console.log('[HistorySidebar] Opening shortcuts settings - button clicked');
        try {
          // Send message without callback (true fire and forget)
          chrome.runtime.sendMessage({ type: 'OPEN_SHORTCUTS' });
          console.log('[HistorySidebar] Message sent');
        } catch (error) {
          console.error('[HistorySidebar] Exception sending message:', error);
        }
      }, true);
    } else {
      console.error('[HistorySidebar] Open shortcuts button not found!');
    }

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
      this.container.style.display = 'flex'; // Ensure visible on mount (flex)
      document.body.appendChild(this.container);
    } else {
      this.container.style.display = 'flex';
    }
  }

  public hide() {
    // Just hide, don't remove from DOM to keep state
    this.container.style.display = 'none';
  }

  public refresh() {
    if (this.isExpanded) {
      this.refreshHistory();
    }
  }
}
