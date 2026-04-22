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
import { Bonjour } from 'bonjour-service';

const bonjour = new Bonjour();

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
const devicesByClientId = new Map<string, { id: string, name: string, type: string, ip: string, lastSocketId: string }>();
const socketToClientId = new Map<string, string>();

export async function startServer(port: number = DEFAULT_PORT, customBaseDir?: string): Promise<ServerInstance> {
    const finalBaseDir = customBaseDir || BASE_DIR;
    const finalUploadDir = path.join(finalBaseDir, 'uploads');
    const finalChunkDir = path.join(finalBaseDir, 'chunks'); // 分片临时目录
    const finalDbPath = path.join(finalBaseDir, 'database.json');

    if (!fs.existsSync(finalUploadDir)) await fs.promises.mkdir(finalUploadDir, { recursive: true });
    if (!fs.existsSync(finalChunkDir)) await fs.promises.mkdir(finalChunkDir, { recursive: true });
    setStoragePath(finalDbPath);

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: "*" } });

    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true
    }));
    app.use(express.json());
    app.use('/download', express.static(finalUploadDir));

    // 处理 OPTIONS 预检请求
    app.options('*', cors() as any);

    // Multer 配置用于接收分片
    const chunkStorage = multer.diskStorage({
        destination: async (req, file, cb) => {
            const hash = req.body.hash;
            const dir = path.join(finalChunkDir, hash);
            try {
                if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
                cb(null, dir);
            } catch (err: any) {
                cb(err, dir);
            }
        },
        filename: (req, file, cb) => cb(null, req.body.index) 
    });
    const uploadChunk = multer({ storage: chunkStorage });

    // 1. 接收分片接口
    app.post('/api/upload/chunk', uploadChunk.single('chunk'), (req: Request, res: Response) => {
        res.json({ success: true });
    });

    // 2. 合并分片接口
    app.post('/api/upload/merge', async (req: Request, res: Response) => {
        const { hash, fileName, total, senderId } = req.body;
        const chunkDir = path.join(finalChunkDir, hash);
        const fixedFileName = Buffer.from(fileName, 'latin1').toString('utf8');
        const finalFileName = `${Date.now()}-${fixedFileName}`;
        const finalFilePath = path.join(finalUploadDir, finalFileName);

        try {
            if (!fs.existsSync(chunkDir)) return res.status(400).json({ error: 'Chunks not found' });

            const writeStream = fs.createWriteStream(finalFilePath);
            
            // 顺序合并分片
            for (let i = 0; i < total; i++) {
                const chunkPath = path.join(chunkDir, String(i));
                const readStream = fs.createReadStream(chunkPath);
                
                await new Promise<void>((resolve, reject) => {
                    readStream.pipe(writeStream, { end: false });
                    readStream.on('end', resolve);
                    readStream.on('error', reject);
                });
                await fs.promises.unlink(chunkPath); // 异步删除分片
            }
            
            writeStream.end();
            await new Promise((resolve) => writeStream.on('finish', resolve));

            await fs.promises.rm(chunkDir, { recursive: true, force: true }); // 异步删除目录

            const stats = await fs.promises.stat(finalFilePath);
            const item = db.add({
                type: 'file', filename: finalFileName, originalName: fixedFileName,
                size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                senderId: String(senderId), time: new Date().toLocaleTimeString(), fullTime: new Date().toISOString()
            });
            io.emit('new-item', item);
            res.json(item);
        } catch (err) {
            console.error('Merge error:', err);
            if (fs.existsSync(finalFilePath)) await fs.promises.unlink(finalFilePath).catch(() => {});
            res.status(500).json({ error: 'Merge failed' });
        }
    });

    // 3. 检查分片状态
    app.get('/api/upload/check/:hash', async (req: Request, res: Response) => {
        const chunkDir = path.join(finalChunkDir, req.params.hash);
        if (fs.existsSync(chunkDir)) {
            const files = await fs.promises.readdir(chunkDir);
            const chunks = files.map(Number).sort((a, b) => a - b);
            res.json({ uploaded: chunks });
        } else {
            res.json({ uploaded: [] });
        }
    });

    // (原有的 text 和 delete 接口保持不变)
    app.get('/api/config', async (req: Request, res: Response) => {
        const localIP = getLocalIP();
        res.json({ ip: localIP, url: `http://${localIP}:${port}`, qr: await QRCode.toDataURL(`http://${localIP}:${port}`) });
    });
    app.get('/api/items', (req: Request, res: Response) => res.json(db.getAll()));
    app.post('/api/text', (req: Request, res: Response) => {
        const item = db.add({ type: 'text', content: req.body.content, senderId: String(req.body.senderId), time: new Date().toLocaleTimeString(), fullTime: new Date().toISOString() });
        io.emit('new-item', item);
        res.json(item);
    });
    app.delete('/api/items/:id', async (req: Request, res: Response) => {
        const id = parseInt(req.params.id);
        const item = db.getAll().find(i => i.id === id);
        if (item && item.type === 'file' && item.filename) {
            const filePath = path.join(finalUploadDir, item.filename);
            if (fs.existsSync(filePath)) await fs.promises.unlink(filePath).catch(() => {});
        }
        if (db.remove(id)) { io.emit('item-removed', id); res.json({ success: true }); }
        else res.status(404).send();
    });

    const broadcastDevices = () => io.emit('devices-update', Array.from(devicesByClientId.values()));

    io.on('connection', (socket) => {
        socket.on('register', (data) => {
            const clientId = data.id || socket.id;
            const userAgent = socket.handshake.headers['user-agent'] || '';
            let deviceName = 'Web Device';
            if (userAgent.includes('iPhone')) deviceName = 'iPhone';
            else if (userAgent.includes('Android')) deviceName = 'Android';
            else if (userAgent.includes('Windows')) deviceName = 'Windows PC';
            else if (userAgent.includes('Macintosh')) deviceName = 'Mac';
            const oldInfo = devicesByClientId.get(clientId);
            if (oldInfo) socketToClientId.delete(oldInfo.lastSocketId);
            devicesByClientId.set(clientId, {
                id: clientId, name: deviceName, type: data.type || 'web',
                ip: socket.handshake.address.replace('::ffff:', ''), lastSocketId: socket.id
            });
            socketToClientId.set(socket.id, clientId);
            broadcastDevices();
        });
        socket.on('disconnect', () => {
            const clientId = socketToClientId.get(socket.id);
            if (clientId) {
                const deviceInfo = devicesByClientId.get(clientId);
                if (deviceInfo && deviceInfo.lastSocketId === socket.id) {
                    setTimeout(() => {
                        const currentInfo = devicesByClientId.get(clientId);
                        if (currentInfo && currentInfo.lastSocketId === socket.id) {
                            devicesByClientId.delete(clientId);
                            socketToClientId.delete(socket.id);
                            broadcastDevices();
                        }
                    }, 2000);
                } else socketToClientId.delete(socket.id);
            }
        });
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(port, '0.0.0.0', () => {
            discovery.startBroadcasting(port, os.hostname());
            bonjour.publish({ name: `FastSend-${os.hostname()}`, type: 'fastsend', port, protocol: 'tcp' });
            resolve({ app, server, io, port, stop: () => { discovery.stop(); bonjour.destroy(); server.close(); } });
        });
    });
}

if (process.env.START_SERVER === 'true') startServer().catch(console.error);
