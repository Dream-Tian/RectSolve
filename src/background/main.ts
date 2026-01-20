import { captureVisibleTab } from './capture';
import { cropScreenshot } from './cropper';
import { callVisionChatCompletion } from './apiClient';
import { getConfig } from '@/utils/storage_shared';
import type { CaptureRequest, CaptureResponse } from '@/types';

// Message type guards
interface CaptureMessage {
  type: 'CAPTURE_SOLVE';
  rect: { x: number; y: number; w: number; h: number };
  dpr: number;
}

interface FetchModelsMessage {
  type: 'FETCH_MODELS';
  baseUrl: string;
  apiKey: string;
}

function isCaptureMessage(msg: any): msg is CaptureMessage {
  return (
    msg.type === 'CAPTURE_SOLVE' &&
    msg.rect &&
    typeof msg.rect.x === 'number' &&
    typeof msg.rect.y === 'number' &&
    typeof msg.rect.w === 'number' &&
    typeof msg.rect.h === 'number' &&
    typeof msg.dpr === 'number'
  );
}

function isFetchModelsMessage(msg: any): msg is FetchModelsMessage {
  return (
    msg.type === 'FETCH_MODELS' &&
    typeof msg.baseUrl === 'string' &&
    typeof msg.apiKey === 'string'
  );
}

// Cache shortcuts in storage on startup and when they change
async function cacheShortcuts() {
  console.log('[Background] Starting to cache shortcuts...');
  try {
    const commands = await chrome.commands.getAll();
    console.log('[Background] Got commands:', commands);

    const shortcutsMap: Record<string, string> = {};
    commands.forEach(cmd => {
      if (cmd.name) {
        // Cache all commands, even if shortcut is empty
        shortcutsMap[cmd.name] = cmd.shortcut || '';
        console.log(`[Background] Caching shortcut: ${cmd.name} = ${cmd.shortcut || '(none)'}`);
      }
    });

    await chrome.storage.local.set({ shortcuts: shortcutsMap });
    console.log('[Background] Shortcuts cached successfully:', shortcutsMap);
  } catch (error) {
    console.error('[Background] Failed to cache shortcuts:', error);
  }
}

console.log('[RectSolve Background] Service Worker initialized');

// Cache shortcuts immediately on initialization
cacheShortcuts();

// Re-cache when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed/updated, caching shortcuts...');
  cacheShortcuts();
});

// Re-cache on browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Browser startup, caching shortcuts...');
  cacheShortcuts();
});

const DEFAULT_PROMPT =
  "You are a meticulous math tutor. Solve the problem in the image. Output Markdown only, " +
  "with LaTeX formulas using \\( \\) for inline and $$ $$ for block equations. " +
  "Structure: brief restatement, approach, steps, final answer, notes.";

// Cache for screenshots to solve permission issues with activeTab
const screenshotCache = new Map<number, string>();

// Helper to accumulate token stats in storage
async function updateTokenStats(usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) {
  try {
    const result = await chrome.storage.local.get('rectsolve_token_stats');
    const today = new Date().toISOString().split('T')[0];
    
    let stats = result.rectsolve_token_stats ? JSON.parse(result.rectsolve_token_stats) : {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      todayPromptTokens: 0,
      todayCompletionTokens: 0,
      todayTokens: 0,
      todayDate: today
    };

    // Reset daily stats if date changed
    if (stats.todayDate !== today) {
      stats.todayPromptTokens = 0;
      stats.todayCompletionTokens = 0;
      stats.todayTokens = 0;
      stats.todayDate = today;
    }

    // Accumulate
    stats.totalPromptTokens += usage.prompt_tokens;
    stats.totalCompletionTokens += usage.completion_tokens;
    stats.totalTokens += usage.total_tokens;
    stats.todayPromptTokens += usage.prompt_tokens;
    stats.todayCompletionTokens += usage.completion_tokens;
    stats.todayTokens += usage.total_tokens;

    await chrome.storage.local.set({ rectsolve_token_stats: JSON.stringify(stats) });
    console.log('[Background] Token stats updated:', stats);
  } catch (error) {
    console.error('[Background] Failed to update token stats:', error);
  }
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  console.log('[RectSolve Background] Command received:', command);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Capture screenshot immediately to ensure we have activeTab permission
  // and to capture the clean state before any UI is shown
  try {
    const { dataUrl } = await captureVisibleTab();
    screenshotCache.set(tab.id, dataUrl);

    // Clear cache after 2 minutes to prevent memory leaks
    setTimeout(() => {
      if (tab.id && screenshotCache.has(tab.id)) {
        screenshotCache.delete(tab.id);
      }
    }, 120000);
  } catch (err) {
    console.warn('[Background] Pre-capture failed (will retry on solve):', err);
  }

  // Send command to content script
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'COMMAND', command });
  } catch (error) {
    console.error('[RectSolve Background] Failed to send command:', error);
  }
});



chrome.action.onClicked.addListener(async (tab) => {
  console.log('[RectSolve Background] Extension button clicked', tab.id);

  if (!tab.id) {
    console.error('[RectSolve Background] No tab ID');
    return;
  }

  // Helper to send toggle command
  const sendToggle = async () => {
    try {
      await chrome.tabs.sendMessage(tab.id!, { type: 'TOGGLE_UI' });
      console.log('[RectSolve Background] Sent TOGGLE_UI to tab', tab.id);
    } catch (err: any) {
      console.warn('[RectSolve Background] Failed to send TOGGLE_UI:', err);

      // If content script is missing (e.g. after reload), inject it and retry
      if (err.message && (err.message.includes('Receiving end does not exist') || err.message.includes('Could not establish connection'))) {
        console.log('[RectSolve Background] Injecting content script...');
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            files: ['content.js']
          });
          // Also inject katexBridge if needed (MAIN world)
          // Note: createScripting cannot easily inject into MAIN world with files in MV3 reliably without correct config,
          // but our manifest handles it. For dynamic injection, we focused on content.js (ISOLATED).

          // Wait a bit for script to initialize
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id!, { type: 'TOGGLE_UI' });
              console.log('[RectSolve Background] Sent TOGGLE_UI after injection');
            } catch (retryErr) {
              console.error('[RectSolve Background] Retry failed:', retryErr);
            }
          }, 100);
        } catch (injectErr) {
          console.error('[RectSolve Background] Script injection failed:', injectErr);
        }
      }
    }
  };

  await sendToggle();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  console.log('[Background] Message received:', message);

  if (!message || typeof message !== 'object') {
    console.log('[Background] Invalid message format');
    return false;
  }

  const msg = message as any;
  console.log('[Background] Processing message type:', msg.type);

  // Handle pre-capture request
  if (msg.type === 'PRE_CAPTURE') {
    console.log('[Background] Pre-capturing screenshot');
    (async () => {
      try {
        const { dataUrl } = await captureVisibleTab();
        const tabId = sender.tab?.id;
        if (tabId) {
          screenshotCache.set(tabId, dataUrl);
          setTimeout(() => {
            if (screenshotCache.has(tabId)) {
              screenshotCache.delete(tabId);
            }
          }, 120000);
        }
        sendResponse({ success: true });
      } catch (err) {
        console.error('[Background] Pre-capture failed:', err);
        sendResponse({ success: false, error: (err as Error).message });
      }
    })();
    return true;
  }

  // Handle open options page
  if (msg.type === 'OPEN_OPTIONS') {
    console.log('[Background] Opening options page');
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }

  // Handle refresh shortcuts (when user changes shortcuts)
  if (msg.type === 'REFRESH_SHORTCUTS') {
    console.log('[Background] Refreshing shortcuts cache');
    (async () => {
      await cacheShortcuts();
      sendResponse({ success: true });
    })();
    return true; // Keep channel open for async response
  }

  // Handle open shortcuts page
  if (msg.type === 'OPEN_SHORTCUTS') {
    console.log('[Background] Opening shortcuts page');
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
      .then(() => {
        console.log('[Background] Shortcuts page opened');
        sendResponse({ success: true });
      })
      .catch(err => {
        console.error('[Background] Failed to open shortcuts:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open for async response
  }

  // Handle fetch models (secure API call from background)
  if (msg.type === 'FETCH_MODELS') {
    if (!isFetchModelsMessage(msg)) {
      sendResponse({ success: false, error: 'Invalid FETCH_MODELS message format' });
      return false;
    }

    console.log('[Background] Fetching models');
    (async () => {
      const { baseUrl, apiKey } = msg;

      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        const models = data.data.map((m: any) => m.id);
        sendResponse({ success: true, models });
      } else {
        throw new Error('Invalid response format');
      }
    })().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      sendResponse({ success: false, error: message });
    });

    return true; // Keep channel open for async response
  }

  // Handle capture solve
  if (msg.type === 'CAPTURE_SOLVE') {
    if (!isCaptureMessage(msg)) {
      const response: CaptureResponse = { success: false, error: 'Invalid CAPTURE_SOLVE message format' };
      sendResponse(response);
      return false;
    }

    console.log('[Background] Processing capture solve');
    (async () => {
      const { rect, dpr } = msg;
      if (rect.w <= 0 || rect.h <= 0) {
        throw new Error('Invalid selection');
      }

      const config = await getConfig();
      if (!config?.baseUrl || !config?.apiKey || !config?.defaultModel) {
        throw new Error('Missing configuration. Please configure API settings in the options page.');
      }

      let dataUrl: string;
      const tabId = sender.tab?.id;

      // Try to use cached screenshot first
      if (tabId && screenshotCache.has(tabId)) {
        dataUrl = screenshotCache.get(tabId)!;
        screenshotCache.delete(tabId); // Consume the cache
      } else {
        const capture = await captureVisibleTab();
        dataUrl = capture.dataUrl;
      }

      const croppedBlob = await cropScreenshot(dataUrl, rect, dpr);
      const imageDataUrl = await blobToDataUrl(croppedBlob);
      const basePrompt = config.systemPrompt?.trim() || DEFAULT_PROMPT;
      const langInstruction = config.responseLanguage === 'en' 
        ? ' Please respond in English.' 
        : ' 请用中文回答。';
      const prompt = basePrompt + langInstruction;
      const result = await callVisionChatCompletion(config, imageDataUrl, prompt);

      // Accumulate token stats
      if (result.usage) {
        await updateTokenStats(result.usage);
      }

      const response: CaptureResponse = { success: true, markdown: result.content, imageDataUrl };
      sendResponse(response);
    })().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      const response: CaptureResponse = { success: false, error: message };
      sendResponse(response);
    });

    return true; // Keep channel open for async response
  }

  // Handle follow-up question
  if (msg.type === 'FOLLOW_UP') {
    console.log('[Background] Processing follow-up question');
    (async () => {
      const config = await getConfig();
      if (!config?.baseUrl || !config?.apiKey || !config?.defaultModel) {
        throw new Error('Missing configuration. Please configure API settings.');
      }

      const { messages, imageDataUrl, systemPrompt } = msg as { 
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        imageDataUrl: string;
        systemPrompt: string;
      };

      const langInstruction = config.responseLanguage === 'en' 
        ? ' Please respond in English.' 
        : ' 请用中文回答。';
      const fullSystemPrompt = (systemPrompt || DEFAULT_PROMPT) + langInstruction;

      // Build ChatMessage array for multi-turn
      const apiMessages: any[] = [];
      
      // First message includes image
      if (messages.length > 0) {
        const firstUserMsg = messages[0];
        apiMessages.push({
          role: "user",
          content: [
            { type: "text", text: fullSystemPrompt + "\n\n" + firstUserMsg.content },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        } as any);

        // Remaining messages are text-only
        for (let i = 1; i < messages.length; i++) {
          apiMessages.push({
            role: messages[i].role,
            content: messages[i].content,
          } as any);
        }
      }

      const { callMultiTurnChatCompletion } = await import('./apiClient');
      const result = await callMultiTurnChatCompletion(config, apiMessages as any);

      // Accumulate token stats
      if (result.usage) {
        await updateTokenStats(result.usage);
      }

      const response = { success: true, markdown: result.content };
      sendResponse(response);
    })().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      const response = { success: false, error: message };
      sendResponse(response);
    });

    return true; // Keep channel open for async response
  }

  console.log('[Background] Unknown message type:', msg.type);
  return false;
});

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

