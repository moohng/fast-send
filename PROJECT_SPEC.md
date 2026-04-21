# FastSend 项目开发规范 (v2.0 - 多端工业版)

## 1. 项目愿景
打造一个极简、安全、高性能的局域网多端同步工具，支持浏览器、Windows、macOS、Android 和 iOS。

## 2. 核心技术栈
- **后端 (Server)**: Node.js + TypeScript + Express + Socket.io
- **前端 (Client)**: React + Vite + TypeScript + Tailwind CSS
- **存储 (Database)**: SQLite (better-sqlite3) 用于持久化存储共享历史
- **跨端方案**: 
  - 桌面端: Electron
  - 移动端: Capacitor (后期集成)
- **发现协议**: mDNS / Bonjour

## 3. 目录结构规范 (Monorepo)
```text
/
├── packages/
│   ├── server/           # 后端服务
│   │   ├── src/
│   │   │   ├── core/     # 数据库 & Socket 逻辑
│   │   │   ├── services/ # 业务逻辑 (文件、网络)
│   │   │   └── index.ts
│   └── client/           # 前端单页应用
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/    # 封装 Socket 和 API 调用
│       │   └── App.tsx
├── uploads/              # 物理文件存储目录
├── PROJECT_SPEC.md       # 本规范
└── package.json          # 根目录 Workspace 管理
```

## 4. 开发与严谨性规范
- **TypeScript**: 开启 `strict: true`。严禁使用 `any`。所有 API 通信数据必须定义 Interface。
- **模块化**: 逻辑必须解耦。数据库逻辑不应出现在路由文件中。
- **测试与检测**:
  - 提交前必须通过 `npm run check` (tsc --noEmit)。
  - 每个核心模块必须包含 JSDoc 注释，说明输入输出和副作用。
- **UI 设计**: 遵循响应式设计，适配手机、平板和桌面。

## 5. 多端打包流程
- **桌面端**: 通过 `electron-builder` 打包 `packages/server` (作为后台进程) 和 `packages/client` (作为渲染进程)。
