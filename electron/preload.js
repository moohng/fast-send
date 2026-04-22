const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ... 其他保持不变
    onServerConfig: (callback) => ipcRenderer.on('server-config', (_event, value) => callback(value)),
    requestConfig: () => ipcRenderer.send('request-server-config'),
    getServerUrl: () => ipcRenderer.invoke('get-server-url'),
    toggleClipboardSync: (enabled) => ipcRenderer.send('toggle-clipboard-sync', enabled),
    toggleAutoWriteClipboard: (enabled) => ipcRenderer.send('toggle-auto-write-clipboard', enabled),
    toggleImageClipboardSync: (enabled) => ipcRenderer.send('toggle-image-clipboard-sync', enabled),
    onClipboardSyncStatus: (callback) => ipcRenderer.on('clipboard-sync-status', (_event, value) => callback(value)),
    selectDownloadPath: () => ipcRenderer.invoke('select-download-path'),
    openFolder: (path) => ipcRenderer.send('open-folder', path),
    showItemInFolder: (fileName) => ipcRenderer.send('show-item-in-folder', fileName),
    zipFolder: (path) => ipcRenderer.invoke('zip-folder', path),
    checkIsDirectory: (path) => ipcRenderer.invoke('check-is-directory', path),
    getFileFromPath: (path) => webUtils.getFileFromPath(path) // 直接返回 File 对象
});
