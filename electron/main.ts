import { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain } from 'electron';
import * as path from 'path';
import * as net from 'net';
import { fileURLToPath } from 'url';
import express from 'express';
import * as http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as QRCode from 'qrcode';
import multer from 'multer';
import * as fs from 'fs';
import * as os from 'os';

// 兼容 ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 基础工具逻辑 ---
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        if (!iface) continue;
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

// --- 数据持久化逻辑 ---
const STORAGE_PATH = path.join(os.homedir(), '.fastsend', 'data.json');
const UPLOAD_DIR = path.join(os.homedir(), '.fastsend', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadData() {
    try {
        if (fs.existsSync(STORAGE_PATH)) return JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8'));
    } catch (e) {}
    return [];
}
function saveData(data: any[]) {
    try {
        fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2));
    } catch (e) {}
}
let sharedItems = loadData();

// --- 全局变量 ---
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverConfig: any = null;
const isDev = !app.isPackaged;

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

// --- 后端服务启动 ---
async function startBackend() {
    const port = await findPort(3000);
    const expressApp = express();
    const server = http.createServer(expressApp);
    const io = new Server(server, { cors: { origin: "*" } });

    expressApp.use(cors());
    expressApp.use(express.json());

    // 1. 托管静态资源（关键修复：让局域网设备能打开网页）
    const clientDist = path.join(__dirname, '../packages/client/dist');
    if (fs.existsSync(clientDist)) {
        expressApp.use(express.static(clientDist));
    }

    expressApp.use('/download', express.static(UPLOAD_DIR));

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOAD_DIR),
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
    });
    const upload = multer({ storage: storage });

    const activeDevices = new Map();

    io.on('connection', (socket) => {
        activeDevices.set(socket.id, { 
            name: socket.handshake.headers['user-agent']?.includes('Mobi') ? 'Mobile Device' : 'Desktop Device', 
            ip: socket.handshake.address 
        });
        io.emit('devices-update', Array.from(activeDevices.values()));
        socket.on('disconnect', () => {
            activeDevices.delete(socket.id);
            io.emit('devices-update', Array.from(activeDevices.values()));
        });
    });

    expressApp.get('/api/config', async (req, res) => {
        const localIP = getLocalIP();
        const url = `http://${localIP}:${port}`;
        const qrDataUrl = await QRCode.toDataURL(url);
        res.json({ ip: localIP, url: url, qr: qrDataUrl });
    });

    expressApp.get('/api/items', (req, res) => res.json(sharedItems));

    expressApp.post('/api/text', (req, res) => {
        const { content, senderId } = req.body;
        const newItem = { 
            id: Date.now(), 
            type: 'text', 
            content, 
            senderId, 
            time: new Date().toLocaleTimeString(), 
            fullTime: new Date().toISOString() 
        };
        sharedItems.unshift(newItem);
        if (sharedItems.length > 100) sharedItems.pop();
        saveData(sharedItems);
        io.emit('new-item', newItem);
        res.json(newItem);
    });

    expressApp.post('/api/upload', upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).send();
        const newItem = {
            id: Date.now(),
            type: 'file',
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
            senderId: req.body.senderId,
            time: new Date().toLocaleTimeString(),
            fullTime: new Date().toISOString()
        };
        sharedItems.unshift(newItem);
        saveData(sharedItems);
        io.emit('new-item', newItem);
        res.json(newItem);
    });

    expressApp.delete('/api/items/:id', (req, res) => {
        sharedItems = sharedItems.filter((i: any) => i.id !== parseInt(req.params.id));
        saveData(sharedItems);
        io.emit('item-removed', parseInt(req.params.id));
        res.json({ success: true });
    });

    expressApp.delete('/api/items', (req, res) => {
        sharedItems = [];
        saveData(sharedItems);
        io.emit('items-cleared');
        res.json({ success: true });
    });

    server.listen(port, '0.0.0.0', async () => {
        const ip = getLocalIP();
        serverConfig = { ip, port, url: `http://${ip}:${port}` };
        console.log('Backend running on', serverConfig.url);
        if (mainWindow) mainWindow.webContents.send('server-config', serverConfig);
        updateTray();
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1050,
        height: 850,
        minWidth: 400,
        minHeight: 600,
        icon: path.join(__dirname, '../packages/client/public/vite.svg'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'FastSend',
        show: false
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../packages/client/dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        if (serverConfig) mainWindow?.webContents.send('server-config', serverConfig);
    });

    ipcMain.on('request-server-config', (event) => {
        if (serverConfig) event.reply('server-config', serverConfig);
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
        tray.setToolTip('FastSend 局域网共享');
        tray.on('double-click', () => mainWindow?.show());
    }

    const contextMenu = Menu.buildFromTemplate([
      { label: '打开主界面', click: () => mainWindow?.show() },
      { label: `地址: ${serverConfig?.url || '启动中...'}`, enabled: false },
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
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
