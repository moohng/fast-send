const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onServerConfig: (callback) => ipcRenderer.on('server-config', (_event, value) => callback(value)),
    requestConfig: () => ipcRenderer.send('request-server-config'),
    getServerUrl: () => ipcRenderer.invoke('get-server-url'),
    toggleClipboardSync: (enabled) => ipcRenderer.send('toggle-clipboard-sync', enabled),
    toggleAutoWriteClipboard: (enabled) => ipcRenderer.send('toggle-auto-write-clipboard', enabled),
    toggleImageClipboardSync: (enabled) => ipcRenderer.send('toggle-image-clipboard-sync', enabled),
    onClipboardSyncStatus: (callback) => ipcRenderer.on('clipboard-sync-status', (_event, value) => callback(value)),
    selectDownloadPath: () => ipcRenderer.invoke('select-download-path'),
    openFolder: (path) => ipcRenderer.send('open-folder', path),
    showItemInFolder: (fileName) => ipcRenderer.send('show-item-in-folder', fileName), // 新增：定位文件
    zipFolder: (path) => ipcRenderer.invoke('zip-folder', path),
    checkIsDirectory: (path) => ipcRenderer.invoke('check-is-directory', path)
});
