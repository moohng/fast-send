const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const os = require('os');
const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

const PORT = 3000;
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use('/download', express.static(uploadDir));

let sharedItems = [];

// Improved IP detection to prioritize 192.168 or 10.x networks
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    let preferredIP = null;
    
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && !alias.internal) {
                // Prioritize common home LAN ranges
                if (alias.address.startsWith('192.168.') || alias.address.startsWith('10.')) {
                    return alias.address;
                }
                preferredIP = alias.address;
            }
        }
    }
    return preferredIP || 'localhost';
}

const localIP = getLocalIP();
const url = `http://${localIP}:${PORT}`;

// --- API ---
app.get('/api/config', async (req, res) => {
    const qrDataUrl = await QRCode.toDataURL(url);
    res.json({ ip: localIP, url: url, qr: qrDataUrl });
});

app.get('/api/items', (req, res) => res.json(sharedItems));

app.post('/api/text', (req, res) => {
    const { content } = req.body;
    if (content) {
        const item = { type: 'text', content, time: new Date().toLocaleTimeString(), id: Date.now() };
        sharedItems.unshift(item);
        io.emit('new-item', item);
        res.json({ success: true });
    } else res.status(400).send();
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        const item = {
            type: 'file',
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
            time: new Date().toLocaleTimeString(),
            id: Date.now()
        };
        sharedItems.unshift(item);
        io.emit('new-item', item);
        res.json({ success: true });
    } else res.status(400).send();
});

// --- UI ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>FastSend</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <script src="/socket.io/socket.io.js"></script>
            <style>
                @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-in { animation: slideIn 0.3s ease-out forwards; }
            </style>
        </head>
        <body class="bg-slate-50 min-h-screen text-slate-800">
            <div class="max-w-lg mx-auto pb-20">
                <header class="bg-white border-b sticky top-0 z-10 px-4 py-3 flex justify-between items-center shadow-sm">
                    <div class="flex items-center gap-2">
                        <span class="text-2xl">🚀</span>
                        <h1 class="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">FastSend</h1>
                    </div>
                    <button onclick="toggleQR()" class="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
                    </button>
                </header>

                <div id="qrOverlay" class="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center p-6" onclick="toggleQR()">
                    <div class="bg-white p-6 rounded-2xl shadow-2xl text-center" onclick="event.stopPropagation()">
                        <img id="qrImage" class="w-64 h-64 mx-auto mb-4" src="" alt="QR">
                        <p class="text-sm font-medium text-slate-600">手机扫码快速访问</p>
                        <p id="urlLabel" class="text-xs text-blue-500 mt-1 select-all font-mono"></p>
                    </div>
                </div>

                <div class="p-4 space-y-4">
                    <div class="bg-white rounded-2xl shadow-sm border p-1 flex">
                        <button onclick="setTab('text')" id="tab-text" class="flex-1 py-2 rounded-xl text-sm font-medium bg-blue-50 text-blue-600">文字</button>
                        <button onclick="setTab('file')" id="tab-file" class="flex-1 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50">文件</button>
                    </div>

                    <div id="panel-text" class="bg-white rounded-2xl shadow-sm border p-4">
                        <textarea id="textInput" class="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none h-24 resize-none" placeholder="输入内容..."></textarea>
                        <button onclick="sendText()" class="w-full mt-3 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200">发送</button>
                    </div>

                    <div id="panel-file" class="hidden bg-white rounded-2xl shadow-sm border p-4">
                        <input type="file" id="fileInput" class="hidden">
                        <label for="fileInput" class="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 py-10 rounded-2xl hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer">
                            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
                            </div>
                            <span id="fileLabel" class="text-sm font-medium text-slate-600 text-center px-4">选择文件</span>
                        </label>
                        <button id="uploadBtn" onclick="uploadFile()" class="hidden w-full mt-3 bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all">确认上传</button>
                    </div>
                </div>

                <div class="px-4">
                    <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">最近共享</h2>
                    <div id="itemsList" class="space-y-3"></div>
                </div>
            </div>

            <script>
                const socket = io();
                const itemsList = document.getElementById('itemsList');
                let currentItems = [];

                socket.on('new-item', (item) => {
                    currentItems.unshift(item);
                    renderItems();
                });

                async function init() {
                    const cfg = await (await fetch('/api/config')).json();
                    document.getElementById('qrImage').src = cfg.qr;
                    document.getElementById('urlLabel').innerText = cfg.url;
                    
                    const res = await fetch('/api/items');
                    currentItems = await res.json();
                    renderItems();
                }

                function renderItems() {
                    if (currentItems.length === 0) {
                        itemsList.innerHTML = '<div class="text-center py-20 text-slate-300 font-medium">暂无内容</div>';
                        return;
                    }
                    itemsList.innerHTML = currentItems.map(item => \`
                        <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 animate-in">
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase">\${item.type}</span>
                                <span class="text-[10px] text-slate-400">\${item.time}</span>
                            </div>
                            \${item.type === 'text' 
                                ? \`<div class="text-slate-700 break-all leading-relaxed whitespace-pre-wrap cursor-pointer hover:text-blue-600" onclick="copyText('\${item.content.replace(/'/g, "\\\\'")}')">\${item.content}</div>\`
                                : \`<div class="flex items-center justify-between">
                                    <div class="min-w-0 flex-1">
                                        <div class="text-sm font-bold text-slate-800 truncate">\${item.originalName}</div>
                                        <div class="text-[10px] text-slate-400">\${item.size}</div>
                                    </div>
                                    <a href="/download/\${item.filename}" download="\${item.originalName}" class="ml-4 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-700 active:scale-95 transition-all">下载</a>
                                  </div>\`
                            }
                        </div>
                    \`).join('');
                }

                function setTab(type) {
                    const isText = type === 'text';
                    document.getElementById('panel-text').classList.toggle('hidden', !isText);
                    document.getElementById('panel-file').classList.toggle('hidden', isText);
                    document.getElementById('tab-text').className = isText ? 'flex-1 py-2 rounded-xl text-sm font-medium bg-blue-50 text-blue-600' : 'flex-1 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50';
                    document.getElementById('tab-file').className = !isText ? 'flex-1 py-2 rounded-xl text-sm font-medium bg-blue-50 text-blue-600' : 'flex-1 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50';
                }

                function toggleQR() {
                    document.getElementById('qrOverlay').classList.toggle('hidden');
                }

                async function sendText() {
                    const input = document.getElementById('textInput');
                    if (!input.value.trim()) return;
                    await fetch('/api/text', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: input.value })
                    });
                    input.value = '';
                }

                async function uploadFile() {
                    const fileInput = document.getElementById('fileInput');
                    const uploadBtn = document.getElementById('uploadBtn');
                    if (fileInput.files.length === 0) return;
                    const formData = new FormData();
                    formData.append('file', fileInput.files[0]);
                    uploadBtn.disabled = true;
                    uploadBtn.innerText = "上传中...";
                    await fetch('/api/upload', { method: 'POST', body: formData });
                    uploadBtn.disabled = false;
                    uploadBtn.innerText = "确认上传";
                    uploadBtn.classList.add('hidden');
                    document.getElementById('fileLabel').innerText = "选择文件";
                    fileInput.value = '';
                }

                document.getElementById('fileInput').onchange = (e) => {
                    if (e.target.files[0]) {
                        document.getElementById('fileLabel').innerText = e.target.files[0].name;
                        document.getElementById('uploadBtn').classList.remove('hidden');
                    }
                };

                function copyText(text) {
                    navigator.clipboard.writeText(text);
                }

                init();
            </script>
        </body>
        </html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=========================================`);
    console.log(`🚀 FastSend 已修复 IP 识别逻辑!`);
    console.log(`局域网地址: ${url}`);
    console.log(`=========================================\n`);
    qrcodeTerminal.generate(url, { small: true });
});
