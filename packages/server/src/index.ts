import express, { Request, Response } from 'express';
import * as http from 'http';
import { Server } from 'socket.io';
import * as path from 'path';
import cors from 'cors';
import * as qrcodeTerminal from 'qrcode-terminal';
import * as QRCode from 'qrcode';
import multer from 'multer';
import * as fs from 'fs';
import * as os from 'os';

import { getLocalIP } from './utils/network';
import { db } from './core/database';
import { discovery } from './core/discovery';

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

const activeDevices = new Map<string, { name: string, ip: string, lastSeen: number }>();

io.on('connection', (socket) => {
    const rawUA = socket.handshake.headers['user-agent'];
    const userAgent = (Array.isArray(rawUA) ? rawUA[0] : rawUA) || 'Unknown Device';
    
    let deviceName = 'Web Device';
    if (userAgent.includes('iPhone')) deviceName = 'iPhone';
    else if (userAgent.includes('Android')) deviceName = 'Android';
    else if (userAgent.includes('Windows')) deviceName = 'Windows PC';
    else if (userAgent.includes('Macintosh')) deviceName = 'Mac';

    activeDevices.set(socket.id, { 
        name: deviceName, 
        ip: socket.handshake.address,
        lastSeen: Date.now() 
    });

    io.emit('devices-update', Array.from(activeDevices.values()));
    socket.on('disconnect', () => {
        activeDevices.delete(socket.id);
        io.emit('devices-update', Array.from(activeDevices.values()));
    });
});

// --- API ---

app.get('/api/config', async (req: Request, res: Response) => {
    const localIP = getLocalIP();
    const rawUrl = req.query.url;
    const clientUrl = typeof rawUrl === 'string' ? rawUrl : undefined;
    let finalUrl = clientUrl || `http://${localIP}:${PORT}`;
    if (finalUrl.indexOf('localhost') !== -1) finalUrl = finalUrl.replace('localhost', localIP);
    else if (finalUrl.indexOf('127.0.0.1') !== -1) finalUrl = finalUrl.replace('127.0.0.1', localIP);
    const qrDataUrl = await QRCode.toDataURL(finalUrl);
    res.json({ ip: localIP, url: finalUrl, qr: qrDataUrl });
});

app.get('/api/items', (req: Request, res: Response) => res.json(db.getAll()));

app.post('/api/text', (req: Request, res: Response) => {
    const { content, senderId } = req.body;
    if (!content) return res.status(400).send();
    const item = db.add({ type: 'text', content, senderId: String(senderId), time: new Date().toLocaleTimeString() });
    io.emit('new-item', item);
    res.json(item);
});

app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
    const senderId = req.body.senderId;
    if (!req.file) return res.status(400).send();
    const item = db.add({
        type: 'file',
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
        senderId: String(senderId),
        time: new Date().toLocaleTimeString(),
    });
    io.emit('new-item', item);
    res.json(item);
});

app.delete('/api/items/:id', (req: Request, res: Response) => {
    const idParam = req.params.id;
    if (typeof idParam !== 'string') return res.status(400).send();
    const id = parseInt(idParam);
    if (db.remove(id)) {
        io.emit('item-removed', id);
        res.json({ success: true });
    } else res.status(404).send();
});

app.post('/api/clear', (req: Request, res: Response) => {
    db.clear();
    io.emit('items-cleared');
    res.json({ success: true });
});

const localIP = getLocalIP();
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FastSend v2.1 Started at ${localIP}:${PORT}`);
    discovery.startBroadcasting(PORT, os.hostname());
    qrcodeTerminal.generate(`http://${localIP}:${PORT}`, { small: true });
});
