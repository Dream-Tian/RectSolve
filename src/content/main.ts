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
    // Get position, theme, and smartSelection config
    const result = await chrome.storage.sync.get(['position', 'theme', 'smartSelection']);
    const position = result.position || 'right';
    const theme = result.theme || 'light';
    const smartSelectionEnabled = result.smartSelection !== false; // Default true
  
    // Apply theme
    applyTheme(theme);
  
    floatingWindow = new FloatingWindow();
  
    overlay = new SelectionOverlay({
      minSize: 20,
      smartSelectionEnabled,
      onComplete: (rect) => {
        console.log('[RectSolve Content] Selection complete:', rect);
  
        floatingWindow?.show(rect.x + rect.w, rect.y);
        floatingWindow?.showLoading();
  
        // Use Port for streaming response
        const port = chrome.runtime.connect({ name: 'stream' });
        
        port.onMessage.addListener((msg) => {
          if (msg.type === 'image') {
            // Initialize streaming with image
            floatingWindow?.initStreamingContent(msg.imageDataUrl);
          } else if (msg.type === 'chunk') {
            // Append streaming chunk
            floatingWindow?.appendStreamingChunk(msg.content);
          } else if (msg.type === 'done') {
            // Finalize streaming
            floatingWindow?.finalizeStreamingContent(true);
            historySidebar?.refresh();
            port.disconnect();
          } else if (msg.type === 'error') {
            floatingWindow?.showError(msg.error);
            port.disconnect();
          }
        });
        
        port.postMessage({
          type: 'CAPTURE_SOLVE_STREAM',
          rect,
          dpr: window.devicePixelRatio || 1,
          tabId: undefined // Will be filled by background
        });
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
    // historySidebar.show(); // Don't show by default
  
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
    // actionButtons.show(); // Don't show by default
  
    console.log('[RectSolve Content] Initialized (UI hidden by default)');
  }

  // Toggle UI visibility
  function toggleUI() {
    if (!actionButtons) return;
  
    if (actionButtons.isVisible()) {
      actionButtons.hide();
      historySidebar?.hide();
    } else {
      actionButtons.show();
      // Don't show sidebar by default when toggling UI on
      // historySidebar?.show(); 
    }
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
      } else if (changes.smartSelection) {
         console.log('[RectSolve Content] Smart selection changed, updating overlay');
         // Only re-create overlay, don't touch sidebar
         if (overlay) {
            overlay.unmount();
            overlay = null;
         }
         // Get current config to recreate overlay
         chrome.storage.sync.get(['smartSelection'], (result) => {
            const smartSelectionEnabled = result.smartSelection !== false;
             overlay = new SelectionOverlay({
              minSize: 20,
              smartSelectionEnabled,
              onComplete: (rect) => {
                console.log('[RectSolve Content] Selection complete:', rect);
                floatingWindow?.show(rect.x + rect.w, rect.y);
                floatingWindow?.showLoading();
                
                // Use Port for streaming response
                const port = chrome.runtime.connect({ name: 'stream' });
                
                port.onMessage.addListener((msg) => {
                  if (msg.type === 'image') {
                    floatingWindow?.initStreamingContent(msg.imageDataUrl);
                  } else if (msg.type === 'chunk') {
                    floatingWindow?.appendStreamingChunk(msg.content);
                  } else if (msg.type === 'done') {
                    floatingWindow?.finalizeStreamingContent(true);
                    historySidebar?.refresh();
                    port.disconnect();
                  } else if (msg.type === 'error') {
                    floatingWindow?.showError(msg.error);
                    port.disconnect();
                  }
                });
                
                port.postMessage({
                  type: 'CAPTURE_SOLVE_STREAM',
                  rect,
                  dpr: window.devicePixelRatio || 1,
                  tabId: undefined
                });
              },
              onCancel: () => {
                console.log('[RectSolve Content] Selection cancelled');
              }
            });
         });
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
    } else if (message.type === 'TOGGLE_UI') {
      toggleUI();
    }
  });

  init();
}

