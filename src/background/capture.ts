export async function captureVisibleTab(): Promise<{ dataUrl: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      // Get current window to ensure we have the right context
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.windowId) {
        reject(new Error("No active tab found"));
        return;
      }

      chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, (dataUrl) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message || "Failed to capture tab"));
          return;
        }
        if (!dataUrl) {
          reject(new Error("Empty capture result"));
          return;
        }
        resolve({ dataUrl });
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error("Capture failed"));
    }
  });
}
