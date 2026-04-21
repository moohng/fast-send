import express, { Request, Response } from 'express';
import * as http from 'http';
import { Server } from 'socket.io';
import * as path from 'path';
import cors from 'cors';
import * as qrcodeTerminal from 'qrcode-terminal';
import * as QRCode from 'qrcode';
import multer from 'multer';
import * as fs from 'fs';

import { getLocalIP } from './utils/network';
import { db } from './core/database';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, '../../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
}

app.use('/download', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// --- API ---

app.get('/api/config', async (req: Request, res: Response) => {
    const localIP = getLocalIP();
    const clientUrl = req.query.url as string;
    
    // 基础 URL
    let finalUrl = clientUrl || `http://${localIP}:${PORT}`;
    
    // 关键修复：如果前端传来的是 localhost 或 127.0.0.1，自动替换为物理局域网 IP
    // 这样即便你在电脑用 localhost 调试，生成的二维码也会指向局域网 IP，方便手机扫码
    if (finalUrl.includes('localhost')) {
        finalUrl = finalUrl.replace('localhost', localIP);
    } else if (finalUrl.includes('127.0.0.1')) {
        finalUrl = finalUrl.replace('127.0.0.1', localIP);
    }
    
    const qrDataUrl = await QRCode.toDataURL(finalUrl);
    res.json({ ip: localIP, url: finalUrl, qr: qrDataUrl });
});

app.get('/api/items', (req: Request, res: Response) => {
    res.json(db.getAll());
});

app.post('/api/text', (req: Request, res: Response) => {
    const { content } = req.body;
    if (!content) return res.status(400).send({ error: 'Content required' });
    const itemData = { type: 'text' as const, content, time: new Date().toLocaleTimeString() };
    const item = db.add(itemData);
    io.emit('new-item', item);
    res.json(item);
});

app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) return res.status(400).send({ error: 'File required' });
    const itemData = {
        type: 'file' as const,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
        time: new Date().toLocaleTimeString(),
    };
    const item = db.add(itemData);
    io.emit('new-item', item);
    res.json(item);
});

app.post('/api/clear', (req: Request, res: Response) => {
    db.clear();
    io.emit('items-cleared');
    res.json({ success: true });
});

const localIP = getLocalIP();
const displayUrl = `http://${localIP}:${PORT}`;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=========================================`);
    console.log(`🚀 FastSend Server (v2.0) 已启动!`);
    console.log(`服务端监控: ${displayUrl}`);
    console.log(`=========================================\n`);
    qrcodeTerminal.generate(displayUrl, { small: true });
});
