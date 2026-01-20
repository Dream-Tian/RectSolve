export class ActionButtons {
  private container: HTMLDivElement;
  private onHistory: () => void;
  private onSearch: () => void;
  private onSettings: () => void;
  private position: 'left' | 'right';
  private eventListeners: Array<{ element: HTMLElement; event: string; handler: EventListener }> = [];

  constructor(callbacks: {
    onHistory: () => void;
    onSearch: () => void;
    onSettings: () => void;
  }, position: 'left' | 'right' = 'right') {
    this.onHistory = callbacks.onHistory;
    this.onSearch = callbacks.onSearch;
    this.onSettings = callbacks.onSettings;
    this.position = position;
    this.container = this.createButtons();
    this.bindEvents();
    this.initializeConfig();
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
      console.error('[ActionButtons] Config init error', e);
    }
  }

  private updateOpacity(val: number) {
      this.container.style.setProperty('--rs-opacity', String(val));
  }

  private updateTheme(theme: string) {
      if (theme === 'dark') {
          this.container.classList.add('rectsolve-dark-theme');
      } else {
          this.container.classList.remove('rectsolve-dark-theme');
      }
  }

  private createButtons(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'rectsolve-action-buttons';
    if (this.position === 'left') {
      container.classList.add('on-left');
    }
    container.innerHTML = `
      <style>
        /* Dark theme for action buttons */
        .rectsolve-dark-theme #rectsolve-action-buttons .action-buttons-wrapper {
          background: rgba(31, 41, 55, var(--rs-opacity, 1));
          border-color: #374151;
          box-shadow: -2px 0 8px rgba(0, 0, 0, 0.5);
        }

        .rectsolve-dark-theme #rectsolve-action-buttons.on-left .action-buttons-wrapper {
          border-color: #374151;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.5);
        }

        .rectsolve-dark-theme .action-btn {
          background: transparent !important;
          color: #d1d5db !important;
          border-color: #374151 !important;
        }

        .rectsolve-dark-theme .action-btn:hover {
          background: #374151 !important;
        }

        #rectsolve-action-buttons {
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          z-index: 2147483646;
          font-family: KaiTi, "楷体", STKaiti, serif;
          transition: right 0.8s cubic-bezier(0.4, 0, 0.2, 1), left 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        #rectsolve-action-buttons.on-left {
          right: auto;
          left: 0;
        }

        #rectsolve-action-buttons.sidebar-open {
          right: 320px;
        }

        #rectsolve-action-buttons.on-left.sidebar-open {
          right: auto;
          left: 320px;
        }

        #rectsolve-action-buttons.on-left .action-buttons-wrapper {
          border-left: none;
          border-right: 1px solid #e5e7eb;
          border-radius: 0 8px 8px 0;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
        }

        .action-buttons-wrapper {
          background: rgba(255, 255, 255, var(--rs-opacity, 1));
          border: 1px solid #e5e7eb;
          border-right: none;
          border-radius: 8px 0 0 8px;
          box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .action-btn {
          width: 48px;
          height: 48px;
          background: transparent;
          border: none;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          color: #374151;
          font-weight: 500;
        }

        .action-btn:last-child {
          border-bottom: none;
        }

        .action-btn:hover {
          background: #f9fafb;
        }
      </style>

      <div class="action-buttons-wrapper">
        <div class="action-btn" data-action="history" role="button" aria-label="打开历史记录" tabindex="0">历史</div>
        <div class="action-btn" data-action="search" role="button" aria-label="开始框选搜题" tabindex="0">搜题</div>
        <div class="action-btn" data-action="settings" role="button" aria-label="打开设置" tabindex="0">设置</div>
      </div>
    `;

    return container;
  }

  private addEventListener(element: HTMLElement, event: string, handler: EventListener) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  private bindEvents() {
    const buttons = this.container.querySelectorAll('.action-btn');
    buttons.forEach(btn => {
      const clickHandler = () => {
        const action = (btn as HTMLElement).dataset.action;
        console.log('[ActionButtons] Button clicked:', action);
        if (action === 'history') this.onHistory();
        else if (action === 'search') this.onSearch();
        else if (action === 'settings') this.onSettings();
      };

      this.addEventListener(btn as HTMLElement, 'click', clickHandler);

      // Keyboard navigation support
      const keyHandler = (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          clickHandler();
        }
      };
      this.addEventListener(btn as HTMLElement, 'keydown', keyHandler);
    });
  }

  private cleanup() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }

  public show() {
    if (!this.container.parentNode) {
      this.container.style.display = 'block'; // Ensure visible on mount
      document.body.appendChild(this.container);
    } else {
      this.container.style.display = 'block';
    }
  }

  public hide() {
    this.container.style.display = 'none';
  }

  public setSidebarOpen(isOpen: boolean) {
    if (isOpen) {
      this.container.classList.add('sidebar-open');
    } else {
      this.container.classList.remove('sidebar-open');
    }
  }

  public isVisible(): boolean {
    return !!this.container.parentNode && this.container.style.display !== 'none';
  }
}
