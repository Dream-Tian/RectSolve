# RectSolve - AI Problem Solver

[English](README.md) | [中文文档](README_zh-CN.md)

RectSolve is a powerful browser extension that allows you to capture any problem area on a webpage and get real-time solutions using OpenAI-compatible vision models (e.g., GPT-4o, Claude 3.5 Sonnet). Results are displayed in a sleek floating window with support for mathematical formula rendering, history management, and smart interaction.

## ✨ Key Features

*   **Smart Selection**: Capture and crop problem areas on any webpage, with automatic handling for high-DPI screens.
*   **AI Solutions**: Support for any OpenAI-compatible model with vision capabilities. Streaming Markdown output provides instant feedback.
*   **Math Rendering**: Built-in KaTeX support ensures perfect rendering of LaTeX mathematical formulas.
*   **History Sidebar**: Review past solutions, search, delete, and manage your history in a convenient sidebar.
*   **Quick Actions**:
    *   **Shortcuts**: Default `Shift+Cmd+S` to start selection, `Shift+Cmd+D` to open history (customizable).
    *   **Floating Button**: Persistent access point at the bottom right of the page.
*   **Customization**:
    *   Customize API Base URL and API Key.
    *   Dynamically fetch and switch between AI models.
    *   **Dark Mode**: Seamlessly adapts to system dark/light themes.
    *   **Smart Snapping**: Automatically snaps selection to text elements for precision.

## 🚀 Installation

### Development Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-repo/RectSolve.git
    cd RectSolve
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Build the project**
    ```bash
    npm run build
    ```
    After building, the extension files will be in the `dist/` directory.

### Load into Chrome

1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **"Developer mode"** in the top right corner.
3.  Click **"Load unpacked"**.
4.  Select the **`dist/`** directory in your project root.

## 📖 Usage Guide

1.  **Configure API**:
    *   Open the sidebar (click the floating icon or use shortcut).
    *   Switch to the **Settings** tab.
    *   Enter your API Base URL (e.g., `https://api.openai.com/v1`) and API Key.
    *   Click "Test Connection" and select a vision-capable model (e.g., `gpt-4o`).

2.  **Solve Problems**:
    *   Click the "Crop" icon in the floating button or press `Shift+Cmd+S`.
    *   The screen will dim. Drag to select the problem area.
    *   Release the mouse and wait for the AI analysis.

3.  **View History**:
    *   Click the "Clock" icon or press `Shift+Cmd+D` to open the sidebar and view all past records.

## 🛠️ Tech Stack

*   **Build Tool**: Vite
*   **Language**: TypeScript
*   **UI Rendering**: Native Web Components / Shadow DOM
*   **Math Rendering**: KaTeX
*   **Markdown**: marked
*   **Highlighter**: highlight.js
*   **Model Support**: OpenAI Compatible (Vision)

## 📄 Directory Structure

```
RectSolve/
├── dist/               # Build output (load this directory)
├── src/
│   ├── background/     # Service Worker (background logic)
│   ├── content/        # Content Scripts (injected logic)
│   │   ├── historySidebar.ts  # Sidebar UI
│   │   ├── selection.ts       # Screenshot & Selection logic
│   │   └── ...
│   ├── options/        # Options page
│   └── assets/         # Static assets
├── manifest.json       # Extension manifest
└── ...
```

## 📝 License

MIT
