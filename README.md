# RectSolve - AI 题目解答助手

RectSolve 是一款功能强大的浏览器扩展，允许用户通过框选网页上的任意题目区域，调用 OpenAI 兼容的 AI 模型（如 GPT-4o, Claude 3.5 Sonnet 等）进行实时解答。结果以精美的悬浮窗形式展示，支持数学公式渲染、历史记录查看和智能交互。

## ✨ 核心功能

*   **智能框选**：截图并裁剪网页上的题目区域，自动处理高分辨率屏幕 (DPR)。
*   **AI 解答**：支持任何兼容 OpenAI 接口的模型（需支持视觉输入），实时流式输出 Markdown 格式的解答。
*   **数学公式渲染**：内置 KaTeX 支持，完美渲染 LaTeX 数学公式。
*   **历史记录 sidebar**：侧边栏查看过往解题记录，支持搜索、删除和回顾。
*   **快捷操作**：
    *   **快捷键支持**：默认 `Shift+Cmd+S` 开启框选，`Shift+Cmd+D` 打开历史记录（可自定义）。
    *   **浮动按钮**：页面右下角常驻功能入口。
*   **个性化设置**：
    *   自定义 API Base URL 和 API Key。
    *   动态获取并切换 AI 模型。
    *   **深色模式**：完美适配系统的深色/浅色主题。
    *   **智能选区**：自动吸附文本元素，精准选区。

## 🚀 安装与使用

### 开发环境安装

1.  **克隆项目**
    ```bash
    git clone https://github.com/your-repo/RectSolve.git
    cd RectSolve
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **构建项目**
    ```bash
    npm run build
    ```
    构建完成后，生成的插件文件位于 `dist/` 目录。

### 加载到 Chrome

1.  打开 Chrome 浏览器，访问 `chrome://extensions/`。
2.  开启右上角的 **"开发者模式" (Developer mode)**。
3.  点击 **"加载已解压的扩展程序" (Load unpacked)**。
4.  选择项目根目录下的 **`dist/`** 文件夹。

## 📖 使用指南

1.  **配置 API**：
    *   加载插件后，打开侧边栏（点击右下角图标或使用快捷键）。
    *   切换到 **设置 (Settings)** 标签。
    *   输入你的 API Base URL (例如 `https://api.openai.com/v1`) 和 API Key。
    *   点击 "测试连接" 并选择一个支持视觉的模型（如 `gpt-4o`）。

2.  **开始解题**：
    *   点击右下角的 "裁剪" 图标，或按下快捷键 `Shift+Cmd+S`。
    *   屏幕变暗后，拖拽鼠标框选题目区域。
    *   松开鼠标，等待 AI 分析与解答。

3.  **查看历史**：
    *   点击右下角的 "时钟" 图标，或按下快捷键 `Shift+Cmd+D` 打开侧边栏查看所有记录。

## 🛠️ 技术栈

*   **构建工具**: Vite
*   **语言**: TypeScript
*   **UI 渲染**: 原生 Web Components / Shadow DOM
*   **公式渲染**: KaTeX
*   **Markdown**: marked
*   **代码高亮**: highlight.js

## 📄 目录结构

```
RectSolve/
├── dist/               # 构建产物 (直接加载这个文件夹)
├── src/
│   ├── background/     # Service Worker (后台逻辑)
│   ├── content/        # Content Scripts (注入页面的逻辑)
│   │   ├── historySidebar.ts  # 侧边栏 UI
│   │   ├── selection.ts       # 截图与框选逻辑
│   │   └── ...
│   ├── options/        # 选项页
│   └── assets/         # 资源文件
├── manifest.json       # 扩展配置文件
└── ...
```

## 📝 License

MIT
