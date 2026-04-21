import { app, BrowserWindow, Tray, Menu, nativeImage, Notification } from 'electron';
import * as path from 'path';
import { fork, ChildProcess } from 'child_process';
import isDev from 'electron-is-dev';
import * as net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;
let serverConfig: any = null;

async function findPort(startPort: number): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, '0.0.0.0');
        server.on('listening', () => {
            server.close();
            resolve(startPort);
        });
        server.on('error', () => {
            resolve(findPort(startPort + 1));
        });
    });
}

async function startServer() {
    const port = await findPort(3000);
    const serverPath = isDev 
        ? path.join(__dirname, '../packages/server/src/index.ts')
        : path.join(__dirname, '../packages/server/dist/index.js');

    const options = isDev ? { execArgv: ['-r', 'ts-node/register'] } : {};
    
    serverProcess = fork(serverPath, [], {
        ...options,
        env: { ...process.env, PORT: port.toString() }
    });

    serverProcess.on('message', (msg: any) => {
        if (msg.type === 'server-ready') {
            serverConfig = msg.config;
            updateTray();
            // 在开发模式下，UI 已经由 Vite 加载，但我们需要通知前端服务器端口
            if (mainWindow) {
                mainWindow.webContents.send('server-config', serverConfig);
            }
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        icon: path.join(__dirname, '../packages/client/public/vite.svg'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') // 稍后创建
        },
        title: 'FastSend - 局域网共享',
        show: false
    });

    // 开发模式优先加载 Vite，生产模式加载前端打包后的 HTML
    const devUrl = 'http://localhost:5173';
    const prodUrl = `file://${path.join(__dirname, '../packages/client/dist/index.html')}`;
    
    const url = isDev ? devUrl : prodUrl;
    
    mainWindow.loadURL(url);

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    if (isDev) {
        mainWindow.webContents.openDevTools();
        // 开发模式下如果 Vite 没启动，显示友好提示
        mainWindow.webContents.on('did-fail-load', () => {
            if (isDev) {
                setTimeout(() => mainWindow?.loadURL(devUrl), 2000);
            }
        });
    }

    mainWindow.on('close', (event) => {
        if (!(app as any).isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
        return false;
    });
}

function updateTray() {
    const iconPath = path.join(__dirname, '../packages/client/public/vite.svg');
    const icon = nativeImage.createFromPath(iconPath);
    
    if (!tray) {
        tray = new Tray(icon);
        tray.setToolTip('FastSend 局域网共享');
        tray.on('click', () => mainWindow?.show());
    }

    const contextMenu = Menu.buildFromTemplate([
      { label: '打开主界面', click: () => mainWindow?.show() },
      { label: `服务地址: ${serverConfig?.url || '启动中...'}`, enabled: false },
      { type: 'separator' },
      { label: '清空所有记录', click: async () => {
          if (serverConfig) {
              const http = await import('http');
              const req = http.request(`${serverConfig.url}/api/items`, { method: 'DELETE' });
              req.end();
          }
      }},
      { type: 'separator' },
      { label: '退出应用', click: () => {
          (app as any).isQuitting = true;
          app.quit();
      }}
    ]);

    tray.setContextMenu(contextMenu);
}

app.on('ready', () => {
    startServer();
    createWindow();
    updateTray();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (serverProcess) serverProcess.kill();
});
