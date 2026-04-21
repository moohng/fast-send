const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onServerConfig: (callback) => ipcRenderer.on('server-config', (_event, value) => callback(value)),
    requestConfig: () => ipcRenderer.send('request-server-config')
});
