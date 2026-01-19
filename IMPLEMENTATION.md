# RectSolve - AI 驱动的框选解题浏览器扩展

## 项目状态

✅ **Phase 1-5 已完成**：基础架构、Options 页面、选区交互、后台服务、渲染管线

🔧 **当前阶段**：Phase 6 - 错误处理与边缘情况优化

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建扩展

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

### 3. 加载扩展到 Chrome

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `dist/` 目录

### 4. 配置 API

1. 点击扩展图标旁的"详情"
2. 点击"扩展程序选项"
3. 填写以下信息：
   - **API Base URL**: 例如 `https://api.openai.com`（会自动添加 `/v1` 后缀）
   - **API Key**: 你的 API 密钥
4. 点击"测试连接"验证配置
5. 点击"获取模型列表"并选择支持视觉输入的模型（如 `gpt-4-vision-preview`）
6. 点击"授权 API 域名"授予权限
7. 点击"保存配置"

### 5. 使用扩展

1. 在任意网页上点击扩展图标
2. 页面会出现半透明遮罩，鼠标变为十字光标
3. 拖拽鼠标框选题目区域
4. 松开鼠标后，悬浮窗会显示"AI 思考中..."
5. 几秒后，AI 的详细解答会显示在悬浮窗中
6. 悬浮窗支持拖拽移动，点击 × 关闭

## 项目结构

```
RectSolve/
├── manifest.json                 # Chrome 扩展配置
├── package.json                  # 依赖管理
├── vite.config.ts                # Vite 构建配置
├── tsconfig.json                 # TypeScript 配置
├── src/
│   ├── assets/                   # 图标资源
│   ├── background/               # Service Worker
│   │   ├── main.ts               # 入口 + 消息监听
│   │   ├── capture.ts            # 截图逻辑
│   │   ├── cropper.ts            # 图像裁剪（DPR 处理）
│   │   └── apiClient.ts          # OpenAI API 调用
│   ├── content/                  # Content Script
│   │   ├── main.ts               # 入口 + 协调器
│   │   ├── selection.ts          # 选区交互
│   │   ├── floatingWindow.ts    # 悬浮窗（Shadow DOM）
│   │   └── renderer.ts           # Markdown + KaTeX 渲染
│   ├── options/                  # Options 页面
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── options.css
│   ├── utils/                    # 工具函数
│   │   └── storage.ts            # chrome.storage 封装
│   └── types/                    # TypeScript 类型定义
│       └── index.ts
└── dist/                         # 构建产物
```

## 核心技术

- **Manifest V3**: Chrome 扩展最新标准
- **TypeScript**: 类型安全
- **Vite**: 快速构建工具
- **Shadow DOM**: 样式隔离
- **OffscreenCanvas**: Service Worker 图像处理
- **Marked**: Markdown 解析
- **DOMPurify**: XSS 防护
- **KaTeX**: LaTeX 公式渲染

## 关键实现细节

### DPR 处理

截图坐标转换使用精确的 DPR 计算：

```typescript
const sx = clamp(Math.round(rect.x * dpr), 0, bitmap.width - 1);
const sy = clamp(Math.round(rect.y * dpr), 0, bitmap.height - 1);
const sw = clamp(Math.round(rect.w * dpr), 1, bitmap.width - sx);
const sh = clamp(Math.round(rect.h * dpr), 1, bitmap.height - sy);
```

### 安全渲染管线

```
Markdown → marked.parse() → DOMPurify.sanitize() → KaTeX.render() → Shadow DOM
```

### Shadow DOM 隔离

悬浮窗使用 Shadow DOM 完全隔离样式，避免与宿主页面冲突。

## 开发命令

```bash
# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run type-check
```

## 已知限制（MVP）

1. **仅支持可视区截图**：题目必须在当前屏幕可见范围内
2. **需要模型支持视觉输入**：不支持纯文本模型
3. **不支持特殊页面**：`chrome://` 和 Chrome Web Store 页面无法注入

## 后续增强计划

- [ ] 滚动拼接截图（支持长题目）
- [ ] OCR 方案（当模型不支持视觉时）
- [ ] 历史记录功能
- [ ] 多模型对比
- [ ] 题目区域自动检测

## 故障排查

### 扩展无法加载

- 检查 `dist/` 目录是否存在
- 确认 `manifest.json` 在 `dist/` 目录中
- 查看 Chrome 扩展页面的错误信息

### 点击图标无反应

- 打开 DevTools Console 查看错误
- 确认不是在受限页面（`chrome://`）
- 检查 Service Worker 是否正常运行

### API 调用失败

- 确认 API Key 正确
- 检查是否授权了 API 域名权限
- 查看 Network 面板的请求详情
- 确认模型支持视觉输入

### 公式渲染异常

- 检查 Markdown 中的 LaTeX 语法
- 确认使用了正确的分隔符：`\\(...)` 或 `$$...$$`
- 查看 Console 是否有 KaTeX 错误

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
