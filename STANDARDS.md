# 项目规范 (Project Standards)

## 1. 语言规范
- **沟通语言**：任何时候，必须使用 **简体中文** 与用户进行沟通。
- **代码注释**：核心逻辑和复杂函数必须包含 **简体中文** 注释。
- **文档说明**：所有项目文档、提交信息、计划方案均使用 **简体中文**。

## 2. 技术栈与严谨性
- **TypeScript**：项目必须全面使用 TypeScript，确保类型安全。
- **类型检查**：每完成一个功能点，必须运行 `npm run check` 或对应的 `tsc` 检测。
- **Monorepo**：使用 NPM Workspaces 管理 `packages/client` 和 `packages/server`。

## 3. 文件结构与可维护性
- **模块化**：前端组件应提取到 `components` 目录，通用类型定义在 `types.ts`。
- **环境一致性**：文件保存必须使用 **UTF-8 (无 BOM)** 编码，以避免 Windows 环境下的解析错误。
- **Git 管理**：禁止将 `node_modules`、`fast-send-data.json` 或大型二进制文件提交至 Git。

## 4. UI/UX 规范
- **响应式**：必须兼容移动端和桌面端，避免横向溢出。
- **交互友好**：操作菜单应易于访问（如使用三点图标），关键操作需有 Toast 或状态反馈。

## 5. Electron 架构规范 (Phase 4 增补)
- **后端集成**：后端服务（Express/Socket.io）直接在 Electron 主进程中运行，避免 fork 导致的 ASAR 路径和依赖丢失问题。
- **路径引用**：在生产环境下使用 `process.resourcesPath` 和 `app.asar` 定位资源，而非简单的 `__dirname`。
- **IPC 通信**：前端与主进程通过 `preload.js` 暴露的 `electronAPI` 进行握手，动态获取服务器配置（如端口、IP）。
- **静态托管**：主进程后端必须显式使用 `express.static` 托管 `packages/client/dist` 目录，以供局域网其他设备访问。
- **数据持久化**：应用数据及上传文件统一存储在用户目录（`~/.fastsend`），解决安装后的写入权限问题。
