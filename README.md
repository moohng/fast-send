# FastSend 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://golang.org/)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB?style=flat&logo=react)](https://reactjs.org/)

**FastSend** 是一款极简、快速的局域网文件与文本传输工具。无需公网、无需注册，只要在同一个 Wi-Fi 下，即可实现电脑、手机之间的秒速传输。

> “像空气一样自然的传输体验。”

---

## ✨ 核心特性

- **🚀 极速传输**：基于本地局域网，速度仅受限于您的路由器带宽，大文件传输不再等待。
- **📱 跨端支持**：提供 Windows 客户端、Android 原生 App 以及 Web 网页端，实现真正的全平台覆盖。
- **🔍 自动发现**：内置 mDNS 服务，设备接入同一局域网即可自动发现，无需手动输入 IP。
- **📋 剪贴板同步**：支持电脑与手机间的剪贴板内容自动同步（可选开启），大幅提升办公效率。
- **📁 大文件支持**：采用分块上传与断点续传技术，稳定传输 GB 级别的超大文件。
- **🔒 私密安全**：数据仅在局域网内流转，不经过任何第三方服务器，保护您的隐私安全。
- **📦 自动分类**：智能识别传输内容，自动分类为图片、视频、文档和文件。

---

## 🛠️ 技术栈

### 后端 (Go)
- **Gin**: 高性能 Web 框架，处理 API 接口。
- **Zeroconf**: 实现 mDNS 设备自动发现。
- **SQLite**: 轻量级数据库，用于存储传输记录。
- **Systray**: 优雅的系统托盘支持。
- **Embed**: 将前端产物打包进单个可执行文件。

### 前端 (React)
- **React + TypeScript**: 构建现代化的响应式界面。
- **Capacitor**: 实现 Web 技术的移动端原生调用。
- **Lucide React**: 简洁精美的图标库。
- **React Virtuoso**: 高性能长列表渲染。

---

## 🚀 快速开始

### 方案 A：直接运行（推荐）
1. 从 [Releases](https://github.com/your-username/fast-send/releases) 页面下载对应系统的压缩包。
2. 解压并运行 `fast-send.exe` (Windows)。
3. 在系统托盘找到图标，点击 **“打开主界面”** 即可开始使用。

### 方案 B：源码编译
```bash
# 克隆仓库
git clone https://github.com/moohng/fast-send.git
cd fast-send

# 安装依赖
npm install

# 编译前端并构建 Go 二进制文件
npm run build:all
```

---

## 📸 界面预览

<div align="center">
  <div style="display: inline-flex; gap: 10px;">
    <img src="./design/screenshot/main.webp" width="300" alt="主界面" />
    <img src="./design/screenshot/qrcode.webp" width="300" alt="扫码连接" />
    <img src="./design/screenshot/settings.webp" width="300" alt="设置面板" />
  </div>
  <br/>
  <i>主界面 & 扫码快速连接 & 深度自定义设置</i>
</div>

---

## 🤝 参与贡献

我们欢迎任何形式的贡献，无论是修复 Bug、新增特性还是改进文档。

1. Fork 本仓库。
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)。
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)。
4. 推送到分支 (`git push origin feature/AmazingFeature`)。
5. 开启一个 Pull Request。

---

## 📄 开源协议

本项目基于 **MIT** 协议开源，详情请参阅 [LICENSE](LICENSE) 文件。

---

## 📬 关注我们

如果您喜欢这个项目，或者想了解更多关于前端开发、跨端技术以及效率工具的分享，欢迎关注我的个人公众号：

<div align="center">
  <img src="https://img.jimukit.com/common/xinghefe_1.webp" />
  <br/>
  <b>扫码或搜索“前端星河”，一起探索前端技术的浩瀚星空。</b>
</div>

---

<p align="center">Made with ❤️ by FastSend Team</p>
