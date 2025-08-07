const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 系统初始化
    initializeSystem: () => ipcRenderer.invoke('initialize-system'),
    
    // 检查Ollama服务
    checkOllamaService: () => ipcRenderer.invoke('check-ollama-service'),
    
    // 文件选择
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    selectImage: () => ipcRenderer.invoke('select-image'),
    
    // 图片处理
    indexDirectory: (directory) => ipcRenderer.invoke('index-directory', directory),
    findSimilarImages: (imagePath, maxResults, similarityThreshold) => 
        ipcRenderer.invoke('find-similar-images', imagePath, maxResults, similarityThreshold),

    
    // 系统信息
    getStats: () => ipcRenderer.invoke('get-stats'),
    resetDatabase: () => ipcRenderer.invoke('reset-database'),
    validateImage: (imagePath) => ipcRenderer.invoke('validate-image', imagePath),
    
    // 设置管理
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    
    // 文件操作
    openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    
    // 监听进度更新
    onIndexProgress: (callback) => {
        ipcRenderer.on('index-progress', (event, data) => callback(data));
    },
    
    // 移除监听器
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },

    getIndexedImages: () => ipcRenderer.invoke('get-indexed-images'),
}); 