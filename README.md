# 浏览器扩展：框选题目区域 → AI 解答（OpenAI-compatible）

## 0. 目标
做一个浏览器扩展（Chrome/Edge，Manifest V3），用户点击扩展按钮进入“框选模式”，鼠标拖拽画出矩形框选题目区域；扩展对该区域截图并调用第三方 OpenAI-compatible（支持视觉/图像输入）模型，返回“详细解答”，并在网页上以悬浮窗形式渲染展示（Markdown + 图片 + 公式）。

---

## 1. 术语
- **Content Script**：注入网页的脚本，负责框选交互、悬浮窗 UI、结果渲染
- **Background (Service Worker)**：扩展后台，负责截图、裁剪、发 API、存储配置
- **OpenAI-compatible**：支持 `/v1/models`、`/v1/chat/completions` 等接口形态
- **DPR**：`devicePixelRatio`，截图像素与 CSS 像素的比例

---

## 2. 用户流程（MVP）
1. 用户点击扩展按钮（或快捷键） → 进入框选模式（遮罩层出现、鼠标变十字）
2. 用户拖拽框出题目区域 → 松开鼠标确认
3. 扩展弹出悬浮窗：显示“识别中/解答中”进度
4. 返回结果后：悬浮窗展示结构化的详细解答（支持公式、图片）
5. 用户可：复制结果、重试、重新框选、切换模型、关闭悬浮窗

---

## 3. 功能需求

### 3.1 触发与框选
- 触发方式：
  - 必选：点击扩展按钮进入框选
  - 可选：快捷键（如 `Ctrl+Shift+S`）进入框选
- 框选交互：
  - 全屏遮罩层 + 矩形选择框
  - `Esc` 取消框选并清理遮罩
  - 最小框选尺寸限制（例如宽/高 < 20px 视为无效）
  - 框选完成后立即退出框选模式，避免遮罩残留
- 坐标规范：
  - 框选矩形 `rect` 以**视口坐标（CSS 像素）**表示：`{ x, y, w, h }`
  - 同时携带 `dpr = window.devicePixelRatio` 给后台用于裁剪换算

### 3.2 截图与裁剪（可视区）
- 使用 `chrome.tabs.captureVisibleTab` 截当前可视区
- 在后台裁剪截图得到选区图像：
  - `sx = rect.x * dpr`，`sw = rect.w * dpr`（y/h 同理）
  - 对选区图像做尺寸上限（例如最长边 1536px）与压缩（JPEG/PNG）以控带宽与延迟
- 限制说明（MVP 接受）：
  - 仅支持**当前可视区**截图；若题目在屏幕外需要用户先滚动到可见
  - 后续增强：支持滚动拼接全页截图或自动滚动捕获

### 3.3 第三方 AI（OpenAI-compatible）
- 配置项（Options 页）：
  - `baseUrl`：如 `https://api.xxx.com`（内部自动补 `/v1`）
  - `apiKey`：只存扩展 `storage`，不暴露给网页
  - `model`：默认模型（从模型列表选择）
- 认证方式（默认）：
  - Header：`Authorization: Bearer <apiKey>`
  - Header：`Content-Type: application/json`
  - 兼容预留：可选支持自定义头（如 `X-API-Key`）但非 MVP 必需
- 动态获取模型：
  - 请求 `GET {baseUrl}/v1/models`
  - 从 `data[].id` 填充下拉框
  - 缓存模型列表（带时间戳，例如 10 分钟）减少请求
- 解题请求：
  - `POST {baseUrl}/v1/chat/completions`
  - 需要模型支持“图像输入”（否则需 OCR 方案）
  - 提示词要求模型输出：
    - 只输出 Markdown（不要 HTML）
    - 数学公式用 LaTeX：行内 `\( ... \)`，行间 `$$ ... $$`
    - 输出结构：题意复述（可选）→ 思路 → 详细步骤 → 最终答案 → 注意点

### 3.4 悬浮窗 UI（富文本 + 公式 + 图片）
- 悬浮窗能力：
  - 固定在页面上层（高 `z-index`），不受页面滚动影响
  - 可拖拽移动；可关闭；可“重新框选”
  - 运行状态：空闲 / 框选中 / 解答中 / 完成 / 错误
- 渲染链路（推荐）：
  - Markdown → HTML：`marked`（或 `markdown-it`）
  - HTML 清洗：`DOMPurify`（防 XSS，模型输出不可完全信任）
  - 公式渲染：KaTeX（auto-render 支持 `$$ $$`、`\(...\)`）
- 图片展示：
  - 支持 Markdown 图片 `![](url)` 渲染；限制允许协议（建议仅 `https:` 与 `data:`）
  - 图片最大宽度适配悬浮窗容器

### 3.5 错误处理与降级
- 常见错误：
  - 未配置 `baseUrl` / `apiKey`
  - 用户未授权目标域名请求（optional host permissions）
  - 页面不可注入/不可截图（如 `chrome://`、Chrome Web Store 等）
  - 模型不支持视觉输入导致返回报错
  - 网络超时/限流/401
- 降级策略（MVP）：
  - 明确错误提示 + “去设置页”按钮
  - 允许“重试”与“重新框选”
  - 若 KaTeX/Markdown 库缺失：降级为纯文本展示（不崩溃）

---

## 4. 技术方案（推荐架构）
- `background.js`（Service Worker）
  - 监听扩展按钮点击：注入 content script + CSS
  - 处理消息：
    - `LIST_MODELS`：拉取 `/v1/models`
    - `CAPTURE_SOLVE`：截图 → 裁剪 → 调 `/v1/chat/completions` → 回传 Markdown
  - 图像裁剪：`createImageBitmap + OffscreenCanvas`
  - 配置读取：`chrome.storage.sync`
- `content.js`
  - 框选遮罩层：pointer 事件收集 `rect`
  - 悬浮窗：Shadow DOM 隔离样式
  - 渲染：Markdown + DOMPurify + KaTeX
- `options.html / options.js`
  - 编辑 `baseUrl/apiKey`
  - 请求域名权限：`chrome.permissions.request({ origins: [...] })`
  - 动态拉取模型并保存默认模型

---

## 5. 权限与 Manifest（MVP 最小化）
建议权限（按需添加，越少越好）：
- `activeTab`：用户点击扩展按钮后，允许对当前标签页注入/截图
- `scripting`：按需注入脚本和样式（避免常驻 `<all_urls>`）
- `storage`：保存 baseUrl、apiKey、默认 model
- `optional_host_permissions`：`https://*/*`（或更细粒度），由用户在 Options 授权具体域名
- `web_accessible_resources`：用于 KaTeX 字体/CSS 等资源加载

---

## 6. 安全与隐私要求
- **API Key 不进入网页环境**：只在 background 存取与使用；content script 通过消息调用
- **输出内容必须 sanitize**：模型输出不可完全信任，渲染前必须 DOMPurify
- **数据最小化**：
  - 只上传用户框选区域截图，不上传整页
  - 可选：提供“本次请求包含截图”提示
- **日志**：
  - 不在控制台输出 apiKey
  - 错误日志避免打印完整响应体（可能含敏感信息）

---

## 7. 交付物清单（你需要做的东西）
- [ ] 扩展骨架：`manifest.json`（MV3）
- [ ] 后台逻辑：截图、裁剪、请求 AI、模型列表获取与缓存
- [ ] 内容脚本：框选遮罩、矩形计算、消息交互
- [ ] 悬浮窗 UI：状态机、拖拽、复制、重试、重新框选
- [ ] 富文本渲染：Markdown + DOMPurify + KaTeX（含字体资源配置）
- [ ] Options 页：配置 baseUrl/apiKey、授权域名、拉取模型并保存默认
- [ ] 兼容与错误提示：不可注入/不可截图页面的提示、超时重试提示
- [ ] 简易验收用例（见下一节）

---

## 8. 测试与验收（手工用例）
- 基本链路：
  - [ ] 设置页填写 baseUrl/apiKey → 授权域名 → 拉取模型成功 → 保存默认模型
  - [ ] 任意网页点击扩展按钮 → 遮罩出现 → 框选 → 悬浮窗显示加载 → 返回 Markdown 解答
- 坐标与裁剪：
  - [ ] 在不同缩放（页面 zoom 80%/125%）和不同 DPR（如 1 / 2）下框选不偏移
- 富文本：
  - [ ] 公式 `\(x^2\)`、`$$\int$$` 能正确渲染
  - [ ] Markdown 表格/代码块渲染正常
- 错误：
  - [ ] apiKey 错误 → 明确提示 401
  - [ ] 模型不支持图像 → 明确提示并引导更换模型
  - [ ] 在不可注入页面点击按钮 → 明确提示原因

---

## 9. 后续增强（非 MVP）
- 全页/长题：滚动拼接截图 + 自动定位框选
- OCR 方案：当模型不支持视觉输入时，先 OCR 再走文本模型
- 历史记录：保存最近 N 次解题（仅本地、可清理）
- 多模型对比：同一截图并行请求多个模型
- 题目区域自动检测：用轻量 CV 或模型先“找题目区域”再裁剪

---
