import express from 'express';
import type { Request, Response } from 'express';
import * as http from 'http';
import { Server } from 'socket.io';
import * as path from 'path';
import cors from 'cors';
import * as qrcodeTerminal from 'qrcode-terminal';
import * as QRCode from 'qrcode';
import multer from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';

import { getLocalIP } from './utils/network.ts';
import { db, setStoragePath } from './core/database.ts';
import { discovery } from './core/discovery.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerInstance {
    app: express.Application;
    server: http.Server;
    io: Server;
    port: number;
    stop: () => void;
}

const DEFAULT_PORT = 3000;
const BASE_DIR = path.join(os.homedir(), '.fastsend');

// 维护全局在线设备列表
const activeDevices = new Map<string, { id: string, name: string, type: string, ip: string, lastSeen: number }>();

export async function startServer(port: number = DEFAULT_PORT, customBaseDir?: string): Promise<ServerInstance> {
    const finalBaseDir = customBaseDir || BASE_DIR;
    const finalUploadDir = path.join(finalBaseDir, 'uploads');
    const finalDbPath = path.join(finalBaseDir, 'database.json');

    if (!fs.existsSync(finalUploadDir)) fs.mkdirSync(finalUploadDir, { recursive: true });
    setStoragePath(finalDbPath);

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: "*" } });

    app.use(cors());
    app.use(express.json());
    app.use('/download', express.static(finalUploadDir));

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, finalUploadDir),
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
    });
    const upload = multer({ storage: storage });

    const broadcastDevices = () => {
        io.emit('devices-update', Array.from(activeDevices.values()));
    };

    io.on('connection', (socket) => {
        socket.on('register', (data) => {
            const userAgent = socket.handshake.headers['user-agent'] || '';
            let deviceName = 'Web Device';
            if (userAgent.includes('iPhone')) deviceName = 'iPhone';
            else if (userAgent.includes('Android')) deviceName = 'Android';
            else if (userAgent.includes('Windows')) deviceName = 'Windows PC';
            
            activeDevices.set(socket.id, {
                id: data.id || socket.id,
                name: deviceName,
                type: data.type || 'web',
                ip: socket.handshake.address,
                lastSeen: Date.now()
            });
            broadcastDevices();
        });

        socket.on('disconnect', () => {
            activeDevices.delete(socket.id);
            broadcastDevices();
        });
    });

    // 定期清理过期设备 (心跳检查)
    setInterval(() => {
        const now = Date.now();
        let changed = false;
        for (const [id, dev] of activeDevices.entries()) {
            if (now - dev.lastSeen > 30000) { // 30秒无响应视为离线
                activeDevices.delete(id);
                changed = true;
            }
        }
        if (changed) broadcastDevices();
    }, 10000);

    app.get('/api/config', async (req: Request, res: Response) => {
        const localIP = getLocalIP();
        const url = `http://${localIP}:${port}`;
        const qrDataUrl = await QRCode.toDataURL(url);
        res.json({ ip: localIP, url: url, qr: qrDataUrl });
    });

    app.get('/api/items', (req: Request, res: Response) => res.json(db.getAll()));

    app.post('/api/text', (req: Request, res: Response) => {
        const { content, senderId } = req.body;
        const item = db.add({ 
            type: 'text', content, senderId: String(senderId), 
            time: new Date().toLocaleTimeString(), fullTime: new Date().toISOString()
        });
        io.emit('new-item', item);
        res.json(item);
    });

    app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
        if (!req.file) return res.status(400).send();
        const item = db.add({
            type: 'file', filename: req.file.filename, originalName: req.file.originalname,
            size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
            senderId: String(req.body.senderId), time: new Date().toLocaleTimeString(), fullTime: new Date().toISOString()
        });
        io.emit('new-item', item);
        res.json(item);
    });

    app.delete('/api/items/:id', (req: Request, res: Response) => {
        const id = parseInt(req.params.id);
        const item = db.getAll().find(i => i.id === id);
        if (item && item.type === 'file' && item.filename) {
            const filePath = path.join(finalUploadDir, item.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        if (db.remove(id)) {
            io.emit('item-removed', id);
            res.json({ success: true });
        } else res.status(404).send();
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(port, '0.0.0.0', () => {
            discovery.startBroadcasting(port, os.hostname());
            resolve({ app, server, io, port, stop: () => { discovery.stop(); server.close(); } });
        });
    });
}

if (process.env.START_SERVER === 'true') {
    startServer().catch(console.error);
}
