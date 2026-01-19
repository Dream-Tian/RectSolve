import { SelectionOverlay } from './selection';
import { FloatingWindow } from './floatingWindow';
import { HistorySidebar } from './historySidebar';
import { ActionButtons } from './actionButtons';
import type { CaptureResponse } from '@/types';

// Prevent multiple initializations
if ((window as any).RectSolveContentScriptInitialized) {
  console.log('[RectSolve Content] Already initialized, skipping');
} else {
  (window as any).RectSolveContentScriptInitialized = true;
  console.log('[RectSolve Content] Content script loaded');

let overlay: SelectionOverlay | null = null;
let floatingWindow: FloatingWindow | null = null;
let historySidebar: HistorySidebar | null = null;
let actionButtons: ActionButtons | null = null;

function startSelection() {
  if (overlay) {
    chrome.runtime.sendMessage({ type: 'PRE_CAPTURE' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[RectSolve Content] Pre-capture failed:', chrome.runtime.lastError);
      }
      overlay?.mount();
    });
  }
}

function applyTheme(theme: string) {
  if (theme === 'dark') {
    document.documentElement.classList.add('rectsolve-dark-theme');
  } else {
    document.documentElement.classList.remove('rectsolve-dark-theme');
  }
}

async function init() {
  // Get position and theme config
  const result = await chrome.storage.sync.get(['position', 'theme']);
  const position = result.position || 'right';
  const theme = result.theme || 'light';

  // Apply theme
  applyTheme(theme);

  floatingWindow = new FloatingWindow();

  overlay = new SelectionOverlay({
    minSize: 20,
    onComplete: (rect) => {
      console.log('[RectSolve Content] Selection complete:', rect);

      floatingWindow?.show(rect.x + rect.w, rect.y);
      floatingWindow?.showLoading();

      chrome.runtime.sendMessage(
        {
          type: 'CAPTURE_SOLVE',
          rect,
          dpr: window.devicePixelRatio || 1
        },
        (response: CaptureResponse) => {
          if (chrome.runtime.lastError) {
            floatingWindow?.showError(chrome.runtime.lastError.message || 'Unknown error');
            return;
          }

          if (response && response.success && response.markdown) {
            floatingWindow?.showContent(response.markdown);
            // Refresh history sidebar
            historySidebar?.refresh();
          } else if (response && !response.success && response.error) {
            floatingWindow?.showError(response.error);
          } else {
            floatingWindow?.showError('Unexpected response format');
          }
        }
      );
    },
    onCancel: () => {
      console.log('[RectSolve Content] Selection cancelled');
    }
  });

  // Create history sidebar
  historySidebar = new HistorySidebar((markdown) => {
    // Show selected history in floating window
    floatingWindow?.show(window.innerWidth / 2, window.innerHeight / 2);
    floatingWindow?.showLoading();
    setTimeout(() => {
      floatingWindow?.showContent(markdown, false);
    }, 100);
  }, () => {
    // On close callback
    actionButtons?.setSidebarOpen(false);
  }, position);
  historySidebar.show();

  // Create action buttons
  actionButtons = new ActionButtons({
    onHistory: () => {
      historySidebar?.expand('history');
      actionButtons?.setSidebarOpen(true);
    },
    onSearch: () => {
      startSelection();
    },
    onSettings: () => {
      historySidebar?.expand('settings');
      actionButtons?.setSidebarOpen(true);
    }
  }, position);
  actionButtons.show();

  console.log('[RectSolve Content] Initialized with action buttons and history sidebar');
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.position) {
      console.log('[RectSolve Content] Position changed, reloading components');

      // Cleanup old components properly
      if (floatingWindow) {
        floatingWindow.cleanup();
        floatingWindow = null;
      }
      if (overlay) {
        overlay.unmount();
        overlay = null;
      }
      if (historySidebar) {
        historySidebar.hide();
        historySidebar = null;
      }
      if (actionButtons) {
        actionButtons.hide();
        actionButtons = null;
      }

      // Reinitialize with new position
      init();
    }

    if (changes.theme) {
      console.log('[RectSolve Content] Theme changed:', changes.theme.newValue);
      applyTheme(changes.theme.newValue);
    }
  }
});

// Listen for keyboard shortcut commands
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'COMMAND') {
    console.log('[RectSolve Content] Command received:', message.command);

    if (message.command === 'start-selection') {
      startSelection();
    } else if (message.command === 'open-history') {
      historySidebar?.expand('history');
      actionButtons?.setSidebarOpen(true);
    }
  }
});

init();
}

