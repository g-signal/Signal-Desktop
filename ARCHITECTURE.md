# Signal-Desktop Windows 架构详解

## 📋 目录
1. [技术栈概览](#技术栈概览)
2. [应用架构](#应用架构)
3. [进程模型](#进程模型)
4. [目录结构](#目录结构)
5. [构建系统](#构建系统)
6. [数据存储](#数据存储)
7. [通信机制](#通信机制)
8. [Windows 特定功能](#windows-特定功能)

---

## 技术栈概览

### 核心框架
```
Electron v36.3.2
├─ Chromium (渲染引擎)
├─ Node.js v22.15.0 (后端运行时)
└─ V8 JavaScript 引擎
```

### 前端技术栈
- **UI 框架**: React 18.3.x + React Redux
- **UI 组件**:
  - @radix-ui/react-tooltip (工具提示)
  - @popperjs/core (定位引擎)
  - Framer Motion (动画)
- **样式**: SASS/SCSS + CSS Modules
- **状态管理**: Redux + Redux-Logger
- **路由**: React Router (自定义路由)

### 后端技术栈
- **加密库**: @signalapp/libsignal-client (Signal 协议)
- **数据库**: @signalapp/sqlcipher (加密 SQLite)
- **通信**:
  - WebSocket (持久连接)
  - Fetch API (REST 请求)
- **媒体通信**: @signalapp/ringrtc (WebRTC 封装)

### 构建工具
- **编译器**: TypeScript 5.6.3 + esbuild 0.24.0
- **打包工具**: electron-builder 26.0.14
- **协议**: protobufjs (Protocol Buffers)
- **样式编译**: sass 1.80.7

---

## 应用架构

### 分层架构图

```
┌─────────────────────────────────────────────────────────┐
│                    Signal Desktop (Windows)              │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
┌───────▼────────┐                   ┌───────▼────────┐
│  Main Process  │ ◄────IPC────────► │ Renderer Process│
│   (Node.js)    │                   │   (Chromium)    │
└───────┬────────┘                   └───────┬────────┘
        │                                     │
        │                                     │
┌───────▼────────────────────────────────────▼──────────┐
│              Preload Scripts (Bridge)                  │
│  - preload.ts (主窗口)                                 │
│  - context.ts (上下文桥接)                             │
│  - sandboxedInit.ts (沙盒初始化)                       │
└────────────────────────────────────────────────────────┘
        │                                     │
┌───────▼─────────┐               ┌──────────▼──────────┐
│  System Layer   │               │   UI Layer          │
│                 │               │                     │
│ • SQL Database  │               │ • React Components  │
│ • File System   │               │ • Redux Store       │
│ • Native Modules│               │ • Stylesheets       │
│ • OS APIs       │               │ • HTML Windows      │
└─────────────────┘               └─────────────────────┘
```

---

## 进程模型

### 1. Main Process (主进程)
**入口**: `app/main.js` (编译自 `app/main.ts`)

**职责**:
- 应用生命周期管理
- 窗口创建和管理
- 系统托盘控制
- 原生菜单
- 自动更新
- 系统权限管理
- IPC 消息路由

**关键模块**:
```javascript
// app/main.ts
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { MainSQL } from '../ts/sql/main';
import { SystemTrayService } from './SystemTrayService';
import * as updater from '../ts/updater/index';
```

### 2. Renderer Process (渲染进程)
**入口**: `background.html` → `preload.bundle.js`

**职责**:
- UI 渲染 (React 组件)
- 用户交互处理
- 状态管理 (Redux)
- 消息加密/解密
- WebSocket 连接管理

**窗口类型**:
```
ts/windows/
├─ main/          # 主窗口 (聊天界面)
├─ about/         # 关于窗口
├─ calling-tools/ # 通话工具
├─ debuglog/      # 调试日志
├─ loading/       # 加载屏幕
├─ permissions/   # 权限请求
└─ screenShare/   # 屏幕共享
```

### 3. Preload Scripts (预加载脚本)
**入口**: `preload.wrapper.ts`

**职责**:
- 在渲染进程访问 Node.js API 之前执行
- 提供安全的上下文桥接 (contextBridge)
- 暴露受限的 API 给渲染进程
- 初始化全局对象

**关键文件**:
```
preload.wrapper.ts    → preload.wrapper.js
preload.ts            → preload.bundle.js (6.3MB)
```

---

## 目录结构

```
Signal-Desktop/
│
├─ app/                      # 主进程代码 (Electron Main)
│  ├─ main.js/.ts           # 应用入口
│  ├─ config.js/.ts         # 配置加载
│  ├─ menu.ts               # 原生菜单
│  ├─ SystemTrayService.ts  # 系统托盘
│  ├─ sql_channel.ts        # 数据库 IPC
│  ├─ attachment_channel.ts # 附件处理
│  └─ updateDefaultSession.ts # Session 配置
│
├─ ts/                       # TypeScript 源码
│  ├─ components/           # React UI 组件
│  ├─ state/                # Redux 状态管理
│  │  ├─ ducks/            # Redux modules
│  │  ├─ selectors/        # 数据选择器
│  │  └─ smart/            # 智能容器组件
│  ├─ textsecure/          # Signal 协议实现
│  │  ├─ WebAPI.ts         # REST API 客户端
│  │  ├─ WebSocket.ts      # WebSocket 客户端
│  │  └─ storage/          # 安全存储
│  ├─ sql/                 # 数据库层
│  │  ├─ main.ts           # 主进程 SQL
│  │  ├─ Client.ts         # SQL 客户端
│  │  └─ migrations/       # 数据库迁移
│  ├─ services/            # 业务服务
│  │  ├─ calling.ts        # 通话服务
│  │  ├─ backups/          # 备份/恢复
│  │  └─ senderCertificate.ts
│  ├─ util/                # 工具函数
│  ├─ windows/             # 窗口实现
│  ├─ updater/             # 自动更新
│  └─ logging/             # 日志系统
│
├─ build/                   # 构建资源
│  ├─ icons/               # 应用图标
│  │  └─ win/
│  │     └─ icon.ico       # Windows 图标
│  └─ entitlements.*       # macOS 权限
│
├─ config/                  # 配置文件
│  ├─ default.json         # 默认配置
│  └─ production.json      # 生产配置
│
├─ protos/                  # Protocol Buffers 定义
│  └─ *.proto              # Signal 协议定义
│
├─ stylesheets/             # 样式文件
│  ├─ manifest.scss        # 主样式入口
│  └─ components/          # 组件样式
│
├─ _locales/                # 国际化翻译
│  ├─ en/
│  ├─ zh_CN/
│  └─ ...
│
├─ images/                  # 静态资源
├─ fonts/                   # 字体文件
├─ sounds/                  # 音效文件
│
├─ *.html                   # 窗口 HTML 模板
│  ├─ background.html      # 主窗口
│  ├─ about.html           # 关于窗口
│  ├─ settings.html        # 设置窗口
│  └─ ...
│
├─ bundles/                 # 编译后的 JS bundles
├─ release/                 # 打包输出目录
│  └─ Signal-*.exe         # Windows 安装程序
│
├─ package.json             # NPM 配置
├─ tsconfig.json            # TypeScript 配置
└─ electron-builder (配置在 package.json 中)
```

---

## 构建系统

### 构建流程

```
Source Files → Transpilation → Bundling → Packaging → Distribution
    │              │              │           │            │
    │              │              │           │            └─► .exe installer
    │              │              │           └─► electron-builder (NSIS)
    │              │              └─► esbuild (bundles)
    │              └─► TypeScript Compiler (tsc)
    └─► .ts/.tsx/.scss/.proto
```

### 构建命令解析

#### 开发模式
```bash
pnpm start  # electron . (直接启动,无需编译)
```

#### 完整构建
```bash
pnpm build
```
等价于:
```bash
run-s generate build:esbuild:prod build:release
```

分解为:
1. **generate** (生成资源)
   ```bash
   - build-protobuf      # 编译 .proto → .js
   - build:esbuild       # 编译 TS → JS
   - build:icu-types     # 生成 i18n 类型
   - build:compact-locales # 压缩翻译
   - sass                # 编译 SCSS → CSS
   - get-expire-time     # 生成过期时间
   - copy-components     # 复制组件
   ```

2. **build:esbuild:prod** (生产编译)
   ```bash
   node scripts/esbuild.js --prod
   ```
   - 编译 TypeScript
   - Tree-shaking (移除死代码)
   - Minification (压缩)
   - Source maps

3. **build:release** (打包)
   ```bash
   electron-builder --config.directories.output=release
   ```

### Windows 构建配置

```json
// package.json > build > win
{
  "win": {
    "artifactName": "${name}-win-${arch}-${version}.${ext}",
    "icon": "build/icons/win/icon.ico",
    "target": ["nsis"],  // NSIS 安装程序
    "signtoolOptions": {
      "certificateSubjectName": "Signal Messenger, LLC",
      "signingHashAlgorithms": ["sha256"]
    }
  },
  "nsis": {
    "deleteAppDataOnUninstall": true,
    "differentialPackage": true  // 增量更新
  }
}
```

### 编译产物

```
bundles/
├─ background.js         # 主窗口逻辑
├─ preload.bundle.js     # 预加载脚本 (6.3MB)
└─ [other-windows].js

app/
├─ main.js               # 主进程
├─ config.js
└─ [other-modules].js

stylesheets/
└─ manifest.css          # 编译后的样式
```

---

## 数据存储

### SQLCipher 数据库
**位置**: `%APPDATA%\Signal\sql\db.sqlite`

**特点**:
- 加密存储 (AES-256)
- 全文搜索支持
- 自动迁移

**表结构** (部分):
```sql
messages            # 消息
conversations       # 会话
identityKeys        # 身份密钥
preKeys            # 预共享密钥
sessions           # 会话状态
senderKeys         # 发送者密钥
attachments        # 附件元数据
stickers           # 贴纸
reactions          # 表情反应
```

### 配置文件
```
%APPDATA%\Signal\
├─ config.json           # 用户配置
├─ ephemeral.json        # 临时配置
├─ sql/
│  └─ db.sqlite          # 主数据库
├─ attachments.noindex/  # 附件存储
├─ stickers.noindex/     # 贴纸缓存
└─ logs/                 # 日志文件
```

### Windows Registry (注册表)
```
HKEY_CURRENT_USER\Software\Signal
├─ InstallLocation
├─ Version
└─ UninstallString
```

---

## 通信机制

### 1. IPC 通信 (进程间)

```typescript
// 主进程 → 渲染进程
mainWindow.webContents.send('update-available', updateInfo);

// 渲染进程 → 主进程
ipcRenderer.invoke('sql-query', { sql, params });

// 双向通信
ipcMain.handle('get-attachment', async (event, id) => {
  return await loadAttachment(id);
});
```

**通道示例**:
```
sql/*              # 数据库操作
attachment/*       # 附件管理
window/*           # 窗口控制
settings/*         # 设置同步
updater/*          # 更新控制
```

### 2. WebSocket 通信 (服务器)

```typescript
// ts/textsecure/WebSocket.ts
const client = new WebSocketClient({
  tlsOptions: {
    ca: certificateAuthority,
    rejectUnauthorized: false  // (已修改)
  }
});

client.connect('wss://chat.ba-chat.com/v1/websocket/');
```

**消息类型**:
- `PUT /api/v1/message` - 发送消息
- `GET /api/v1/message` - 接收消息
- `WebSocket` - 实时推送

### 3. REST API (服务器)

```typescript
// ts/textsecure/WebAPI.ts
await fetch(`${serverUrl}/v1/accounts/whoami`, {
  method: 'GET',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'User-Agent': getUserAgent(version)
  },
  agent: httpsAgent
});
```

---

## Windows 特定功能

### 1. Windows 通知系统

```typescript
// @indutny/simple-windows-notifications
import { WindowsNotifications } from './WindowsNotifications';

new Notification('Signal', {
  body: message.text,
  icon: senderAvatar,
  tag: conversationId
});
```

### 2. 系统托盘

```typescript
// app/SystemTrayService.ts
const tray = new Tray('build/icons/win/icon.ico');
tray.setContextMenu(contextMenu);
tray.on('click', () => focusAndForceToTop(mainWindow));
```

### 3. 自动启动

```typescript
// Windows Registry
app.setLoginItemSettings({
  openAtLogin: true,
  path: process.execPath,
  args: ['--start-in-tray']
});
```

### 4. 屏幕共享

```typescript
// ts/calling/ScreenShare.ts
desktopCapturer.getSources({
  types: ['window', 'screen'],
  thumbnailSize: { width: 150, height: 150 }
});
```

### 5. Windows 更新器

```typescript
// ts/updater/windows.ts
import { autoUpdater } from 'electron-updater';

autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://updates2.ba-chat.com/desktop'
});

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall();
});
```

### 6. 原生模块 (Node Addons)

```
node_modules/@signalapp/
├─ libsignal-client/    # Rust 加密库
│  └─ prebuilds/
│     └─ win32-x64/
│        └─ libsignal-client.node
│
├─ ringrtc/             # WebRTC (C++)
│  └─ build/
│     └─ windows/
│        └─ ringrtc.node
│
└─ sqlcipher/           # SQLCipher (C)
   └─ prebuilds/
      └─ win32-x64/
         └─ better_sqlite3.node
```

---

## 安全机制

### 1. 内容安全策略 (CSP)

```html
<!-- background.html -->
<meta http-equiv="Content-Security-Policy"
  content="
    default-src 'none';
    script-src 'self' 'sha256-...';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: emoji: attachment:;
    connect-src 'self' https: wss: attachment:;
  "
/>
```

### 2. Context Isolation (上下文隔离)

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('SignalContext', {
  sendMessage: (data) => ipcRenderer.invoke('send-message', data),
  // 只暴露安全的 API
});
```

### 3. 端到端加密

```typescript
// @signalapp/libsignal-client
import * as libsignal from '@signalapp/libsignal-client';

const ciphertext = await libsignal.encrypt(
  plaintext,
  recipientAddress,
  sessionStore
);
```

---

## 性能优化

### 1. Lazy Loading (懒加载)

```typescript
// React.lazy + Suspense
const ConversationView = lazy(() =>
  import('./components/ConversationView')
);
```

### 2. Virtual Scrolling (虚拟滚动)

```typescript
// @tanstack/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 64
});
```

### 3. Bundle Splitting (代码分割)

```javascript
// esbuild.js
esbuild.build({
  splitting: true,
  format: 'esm',
  entryPoints: [
    'background.ts',
    'preload.ts',
    'about.ts',
    // ...
  ]
});
```

---

## 调试技巧

### 开发者工具

```bash
# 启动时自动打开 DevTools
pnpm start -- --enable-logging

# React DevTools
pnpm run run-with-devtools
```

### 日志查看

```
%APPDATA%\Signal\logs\
├─ app.log          # 应用日志
├─ main.log         # 主进程日志
└─ preload.log      # 预加载日志
```

### 远程调试

```bash
# 主进程调试
electron --inspect=5858 .

# 渲染进程调试
chrome://inspect (Chrome DevTools)
```

---

## 总结

Signal-Desktop 是一个**复杂的多进程桌面应用**:

1. **架构模式**: 采用 Electron 的**多进程架构**，主进程管理系统资源，渲染进程负责 UI
2. **技术栈**: React + Redux + TypeScript + Electron + WebRTC + Protocol Buffers
3. **安全性**: 端到端加密、内容安全策略、上下文隔离、加密数据库
4. **平台特性**: Windows 通知、系统托盘、自动更新、原生模块
5. **构建系统**: TypeScript + esbuild + electron-builder + NSIS

**关键设计特点**:
- ✅ 安全第一 (E2EE, CSP, Context Isolation)
- ✅ 跨平台 (Windows, macOS, Linux)
- ✅ 性能优化 (虚拟滚动, 懒加载, 代码分割)
- ✅ 可维护性 (TypeScript, 模块化, 清晰分层)

---

**生成时间**: 2025-11-11
**版本**: Signal-Desktop 7.64.0
