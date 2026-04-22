import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, clipboard, dialog, shell, Notification } from 'electron';
import * as path from 'path';
import * as net from 'net';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as os from 'os';
import Store from 'electron-store';
import archiver from 'archiver';
import * as QRCode from 'qrcode';
import crypto from 'crypto';

// 导入重构后的 Server 逻辑
import { startServer } from '../packages/server/src/index.ts';
import type { ServerInstance } from '../packages/server/src/index.ts';
import { db } from '../packages/server/src/core/database.ts';
import { getLocalIP } from '../packages/server/src/utils/network.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();
// 桌面端存储路径：优先使用设置的下载目录
let downloadPath = store.get('downloadPath') as string || path.join(app.getPath('downloads'), 'FastSend');
if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverInstance: ServerInstance | null = null;
let serverConfig: any = null;

// 状态管理
let isClipboardSyncEnabled = store.get('isClipboardSyncEnabled') as boolean || false;
let isAutoWriteClipboard = store.get('isAutoWriteClipboard') as boolean || false;
let isImageClipboardSyncEnabled = store.get('isImageClipboardSyncEnabled') as boolean || false;

let lastClipboardText = '';
let lastImageHash = '';
let lastNotificationId = 0;

async function findPort(startPort: number): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.unref();
        server.on('error', () => resolve(findPort(startPort + 1)));
        server.listen(startPort, '0.0.0.0', () => {
            server.close(() => resolve(startPort));
        });
    });
}

function startClipboardMonitor() {
    setInterval(() => {
        if (!isClipboardSyncEnabled) return;
        const text = clipboard.readText();
        if (text && text !== lastClipboardText && text.trim().length > 0) {
            lastClipboardText = text;
            const newItem = db.add({ 
                type: 'text', content: text, senderId: 'CLIPBOARD_SYNC', 
                time: new Date().toLocaleTimeString(), fullTime: new Date().toISOString() 
            });
            if (serverInstance) serverInstance.io.emit('new-item', newItem);
        }
        if (isImageClipboardSyncEnabled) {
            const image = clipboard.readImage();
            if (!image.isEmpty()) {
                const buffer = image.toPNG();
                const hash = crypto.createHash('md5').update(buffer).digest('hex');
                if (hash !== lastImageHash) {
                    lastImageHash = hash;
                    const filename = `clipboard-${Date.now()}.png`;
                    const fullPath = path.join(downloadPath, filename);
                    fs.writeFileSync(fullPath, buffer);
                    const stats = fs.statSync(fullPath);
                    const newItem = db.add({
                        type: 'file', filename, originalName: filename,
                        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                        senderId: 'CLIPBOARD_IMAGE', time: new Date().toLocaleTimeString(), fullTime: new Date().toISOString()
                    });
                    if (serverInstance) serverInstance.io.emit('new-item', newItem);
                }
            }
        }
    }, 1500);
}

async function startBackend() {
    try {
        const port = await findPort(3000);
        // 使用 downloadPath 作为 Server 的存储目录
        serverInstance = await startServer(port, path.dirname(downloadPath));
        
        serverInstance.io.on('connection', (socket) => {
            socket.on('register', () => {
                socket.emit('clipboard-config', { isClipboardSyncEnabled, isAutoWriteClipboard, isImageClipboardSyncEnabled });
            });
        });

        const originalEmit = serverInstance.io.emit.bind(serverInstance.io);
        serverInstance.io.emit = (event: string, ...args: any[]) => {
            if (event === 'new-item') {
                const item = args[0];
                if (isAutoWriteClipboard && item.id !== lastNotificationId) {
                    lastNotificationId = item.id;
                    if (item.type === 'text' && !['CLIPBOARD_SYNC', 'DESKTOP'].includes(item.senderId)) {
                        if (item.content !== clipboard.readText()) {
                            clipboard.writeText(item.content);
                            lastClipboardText = item.content;
                            new Notification({ title: 'FastSend', body: '已自动同步文本到剪贴板' }).show();
                        }
                    }
                }
            }
            return originalEmit(event, ...args);
        };

        const ip = getLocalIP();
        const clientPort = isDev ? 5173 : port;
        const url = `http://${ip}:${clientPort}`;
        const qr = await QRCode.toDataURL(url);
        serverConfig = { ip, port, url, qr, downloadPath };
        if (mainWindow) mainWindow.webContents.send('server-config', serverConfig);
        updateTray();
    } catch (err) {
        dialog.showErrorBox('Server Error', `后端服务启动失败: ${err}`);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1050, height: 850,
        icon: path.join(__dirname, '../packages/client/public/vite.svg'),
        webPreferences: {
            nodeIntegration: false, contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'FastSend', show: false
    });

    if (isDev) mainWindow.loadURL('http://localhost:5173');
    else mainWindow.loadFile(path.join(__dirname, '../packages/client/dist/index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        if (serverConfig) mainWindow?.webContents.send('server-config', serverConfig);
    });

    // IPC 注册
    ipcMain.on('request-server-config', (event) => {
        if (serverConfig) {
            serverConfig.ip = getLocalIP();
            serverConfig.url = `http://${serverConfig.ip}:${serverConfig.port}`;
            serverConfig.downloadPath = downloadPath;
            event.reply('server-config', serverConfig);
        }
    });

    ipcMain.handle('get-server-url', async () => {
        const ip = getLocalIP();
        const port = serverConfig ? serverConfig.port : 3000;
        return `http://${ip}:${port}`;
    });

    ipcMain.on('toggle-clipboard-sync', (event, enabled) => {
        isClipboardSyncEnabled = enabled;
        store.set('isClipboardSyncEnabled', enabled);
        updateTray();
    });

    ipcMain.on('toggle-auto-write-clipboard', (event, enabled) => {
        isAutoWriteClipboard = enabled;
        store.set('isAutoWriteClipboard', enabled);
        updateTray();
    });

    ipcMain.on('toggle-image-clipboard-sync', (event, enabled) => {
        isImageClipboardSyncEnabled = enabled;
        store.set('isImageClipboardSyncEnabled', enabled);
        updateTray();
    });

    ipcMain.handle('select-download-path', async () => {
        const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
        if (!result.canceled && result.filePaths.length > 0) {
            downloadPath = result.filePaths[0];
            store.set('downloadPath', downloadPath);
            return downloadPath;
        }
        return null;
    });

    ipcMain.on('open-folder', (event, p) => {
        const target = p || downloadPath;
        if (fs.existsSync(target)) shell.openPath(target);
    });

    ipcMain.on('show-item-in-folder', (event, fileName) => {
        let fullPath = path.join(downloadPath, fileName);
        if (!fs.existsSync(fullPath)) {
            fullPath = path.join(os.homedir(), '.fastsend', 'uploads', fileName);
        }
        if (fs.existsSync(fullPath)) {
            shell.showItemInFolder(fullPath);
        } else {
            new Notification({ title: 'FastSend', body: `无法定位文件: 文件可能已被移动或删除` }).show();
        }
    });

    ipcMain.handle('check-is-directory', async (event, p: string) => {
        try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
    });

    ipcMain.handle('zip-folder', async (event, folderPath: string) => {
        const folderName = path.basename(folderPath);
        const zipName = `${Date.now()}-${folderName}.zip`;
        const zipPath = path.join(downloadPath, zipName);
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            output.on('close', () => {
                const stats = fs.statSync(zipPath);
                const newItem = db.add({
                    id: Date.now(), type: 'file', filename: zipName,
                    originalName: `${folderName}.zip`, size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                    senderId: 'DESKTOP', time: new Date().toLocaleTimeString(), fullTime: new Date().toISOString()
                });
                if (serverInstance) serverInstance.io.emit('new-item', newItem);
                resolve(true);
            });
            archive.on('error', (err) => reject(err));
            archive.pipe(output);
            archive.directory(folderPath, folderName);
            archive.finalize();
        });
    });

    ipcMain.handle('get-file-data', async (event, filePath: string) => {
        try {
            const buffer = fs.readFileSync(filePath);
            const name = path.basename(filePath);
            return { buffer, name };
        } catch (e) {
            console.error(e);
            return null;
        }
    });

    mainWindow.on('close', (event) => {
        if (!(app as any).isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
        return false;
    });
}

function updateTray() {
    const iconPath = path.join(__dirname, isDev ? '../packages/client/public/vite.svg' : '../packages/client/dist/vite.svg');
    const icon = nativeImage.createFromPath(iconPath);
    if (!tray) {
        tray = new Tray(icon);
        tray.on('double-click', () => mainWindow?.show());
    }
    const contextMenu = Menu.buildFromTemplate([
      { label: '打开主界面', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: `同步文本剪贴板: ${isClipboardSyncEnabled ? '√' : '×'}`, click: () => {
          isClipboardSyncEnabled = !isClipboardSyncEnabled;
          store.set('isClipboardSyncEnabled', isClipboardSyncEnabled);
          updateTray();
      }},
      { label: `同步图片剪贴板: ${isImageClipboardSyncEnabled ? '√' : '×'}`, click: () => {
          isImageClipboardSyncEnabled = !isImageClipboardSyncEnabled;
          store.set('isImageClipboardSyncEnabled', isImageClipboardSyncEnabled);
          updateTray();
      }},
      { label: `自动接收局域网文本: ${isAutoWriteClipboard ? '√' : '×'}`, click: () => {
          isAutoWriteClipboard = !isAutoWriteClipboard;
          store.set('isAutoWriteClipboard', isAutoWriteClipboard);
          updateTray();
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
    startBackend();
    createWindow();
    startClipboardMonitor();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
