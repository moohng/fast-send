# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览
FastSend 是一个基于局域网的多端同步工具（PC, Mobile, Browser），支持文本、文件、剪贴板的实时同步。采用 Monorepo 架构。

## 核心架构
- **Monorepo**: 使用 NPM Workspaces 管理。
  - `packages/server`: Express + Socket.io 后端，负责数据持久化 (SQLite) 和实时通信。在生产环境中自动托管前端静态资源并打开浏览器。
  - `packages/client`: React + Vite 前端，适配移动端和 Web 端。
- **通信逻辑**: 
  - 自动发现: mDNS (Bonjour) + 局域网暴力扫描。
  - 数据传输: Socket.io (文本/状态) + HTTP Chunked Upload (大文件)。
- **持久化**: `better-sqlite3` 存储消息历史和应用设置，数据存储在用户目录 `~/.fastsend/fast-send.db`。

## 常用命令

### 开发命令
- `npm run dev`: 启动开发模式（同时启动 Client 和 Server 开发服务器）。
- `npm run client`: 仅启动前端开发服务器（`localhost:5173`）。
- `npm run server`: 仅运行后端服务开发模式。

### 构建与打包
- `npm run build`: 构建所有 packages。
- `npm run build:exe`: 打包生成桌面端可执行程序（使用 Node.js SEA 方案，输出至 `out/`）。
- `npm run build:mobile`: 构建前端并同步到 Capacitor Android 项目。
- `npm run sync`: 仅同步 Capacitor 配置和代码到 Android。

### 检测与维护
- `npm run check`: 全局 TypeScript 类型检查。

## 关键技术规范
- **语言**: 沟通与代码注释必须使用 **简体中文**。
- **打包**: 使用 `esbuild` 预打包后端，再通过 Node.js SEA 注入二进制，生成免安装的可执行文件。
- **环境**: 开发时需注意 Android/iOS 的混合内容限制，启用 `cleartext`。
- **持久化**: 应用设置（如下载路径）存储在 SQLite 的 `settings` 表中，不再依赖 Electron 存储。
- **同步**: 移动端 App 实现“静默自动同步”逻辑，图片/视频保存至 `DCIM/FastSend`。

## 开发热更新 (HMR) 技巧
- **移动端**: 修改 `packages/client/capacitor.config.ts` 中的 `server.url` 指向电脑局域网 IP 可开启真机热更新。
