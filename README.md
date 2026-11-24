# RectSolve — 网页框选 AI 解题助手

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-4285f4.svg)](https://developer.chrome.com/docs/extensions/develop/migrate)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/build-Vite%206-646cff.svg)](https://vite.dev/)
[![Version](https://img.shields.io/badge/version-1.0.0-informational.svg)](https://github.com/Dream-Tian/RectSolve)

**中文** | [English](README.en.md)

> 在任意网页上框选题目，调用 OpenAI 兼容的视觉模型，把解答流式渲染在页面内的悬浮窗里；公式走 KaTeX，代码带语法高亮。

RectSolve 是一个 Manifest V3 浏览器扩展。框选时不弹新标签页，解答直接出现在当前页面右侧的悬浮窗中，做完一题可以接着框下一题。

## 目录

- [功能](#功能)
- [环境要求](#环境要求)
- [安装](#安装)
- [配置](#配置)
- [使用](#使用)
- [快捷键](#快捷键)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [权限与隐私](#权限与隐私)
- [开发与测试](#开发与测试)
- [已知限制](#已知限制)
- [许可证](#许可证)

## 功能

- **框选解题**：在网页上拖拽框选题目区域，自动处理高 DPI 屏幕的坐标换算。
- **流式解答**：支持任意具备视觉能力的 OpenAI 兼容模型，Markdown 边生成边显示。
- **公式与代码**：内置 KaTeX 渲染 LaTeX 公式，highlight.js 高亮代码块。
- **历史记录**：侧边栏保留过往解答，支持搜索、删除，条数上限可调。
- **快捷入口**：页面右下角常驻悬浮按钮，也可用键盘快捷键触发框选或打开历史。
- **智能吸附**：开启后框选会自动贴齐页面上的文本元素，选区更准确。
- **外观与语言**：浅色 / 深色主题跟随系统，悬浮球透明度可调，界面支持中文与英文。
- **模型配置**：填写 API Base URL 与 API Key，测试连通性、拉取模型列表并指定默认模型。

## 环境要求

- Chrome 或其他 Chromium 内核浏览器（Edge、Brave 等），需支持 Manifest V3。
- 一个 OpenAI 兼容、支持图片输入的模型服务（OpenAI、Claude 中转、New API 等均可）。
- 从源码构建需要 Node.js 18+ 与 npm。

## 安装

### 从源码构建

```bash
git clone https://github.com/Dream-Tian/RectSolve.git
cd RectSolve
npm install
npm run build
```

构建产物在 `dist/`。

### 加载到浏览器

1. 打开 `chrome://extensions/`。
2. 开启右上角的**开发者模式**。
3. 点**加载已解压的扩展程序**，选择项目根目录下的 `dist/` 文件夹。

## 配置

首次使用需要配置模型服务。点扩展图标打开侧边栏，或右键图标进入**选项**：

1. 填写 API Base URL（例如 `https://api.openai.com/v1`）和 API Key。
2. 点**测试连接**确认地址与密钥可用。
3. 点**获取模型列表**，选择一个支持视觉输入的模型（如 `gpt-4o`）作为默认模型。
4. 点**授权 API 域名**，允许扩展访问该服务地址。
5. 点**保存配置**。

## 使用

1. 点悬浮球上的裁剪图标，或按快捷键进入框选。
2. 屏幕变暗后拖拽框选题目，松开鼠标。
3. 解答在悬浮窗中流式出现；可以继续追问，或直接框选下一题。

点时钟图标或按快捷键打开历史侧边栏，可以搜索、回看和删除记录。

## 快捷键

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| 开始框选 | `⌘ ⇧ S` | `Ctrl + Shift + S` |
| 打开历史记录 | `⌘ ⇧ H` | `Ctrl + Shift + H` |

快捷键由 `manifest.json` 的 `commands` 声明，可在 `chrome://extensions/shortcuts` 中改成自己顺手的组合。

## 技术栈

- **构建**：Vite
- **语言**：TypeScript
- **UI**：原生 Web Components / Shadow DOM，避免与宿主页面样式互相污染
- **公式**：KaTeX
- **Markdown**：marked（配合 marked-highlight）
- **代码高亮**：highlight.js
- **模型**：任意 OpenAI 兼容的视觉模型

## 目录结构

```text
RectSolve/
├── src/
│   ├── background/     # Service Worker：截图、裁剪、API 请求、命令分发
│   ├── content/        # 注入页面的逻辑：框选、悬浮窗、历史侧边栏
│   ├── options/        # 选项页
│   ├── types/          # 类型定义
│   ├── utils/          # 配置、本地存储、i18n
│   └── assets/         # 图标等静态资源
├── manifest.json       # Manifest V3 配置
├── vite.config.ts
└── dist/               # 构建产物（加载这个目录）
```

## 权限与隐私

- `host_permissions: <all_urls>`：扩展需要在任意网页注入框选遮罩与悬浮窗；调用模型服务时还会单独申请对应域名的权限。
- 截图只发送给你自己配置的模型服务，扩展本身不经过任何中转服务器。
- 配置与历史记录保存在浏览器本地的 `chrome.storage` 中，不会自动上传；卸载扩展会被清除。
- API Key 以明文保存在扩展的本地存储里，请勿在公用电脑上配置。

## 开发与测试

```bash
npm run dev         # 监听源码变化并重新构建
npm run build       # 生产构建
npm run type-check  # tsc --noEmit
npm test            # Vitest 单元测试
```

改完代码后，在 `chrome://extensions/` 里点扩展卡片上的刷新按钮重新加载 `dist/`。

## 已知限制

- 依赖网页可截图，`chrome://` 页面和扩展商店等受保护页面无法注入。
- 需要模型支持图片输入，纯文本模型不可用。
- 框选区域会按最长边 1536 px 缩放，并以 JPEG（质量 0.8）上传；极小字号可能影响识别。
- 历史记录仅保存在本机，不跨设备同步。
- 目前只提供 Chromium 版本，未适配 Firefox 的扩展 API。

## 许可证

本项目基于 [MIT License](LICENSE) 开源，Copyright (c) 2026 Dream-Tian。