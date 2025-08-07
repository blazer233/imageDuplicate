const { contextBridge, ipcRenderer } = require('electron');

// 在window对象上暴露API，供渲染进程使用
contextBridge.exposeInMainWorld('electronAPI', {
  // 目录和文件选择
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  getLastDirectory: () => ipcRenderer.invoke('get-last-directory'),
  
  // 图像处理功能
  initializeFinder: () => ipcRenderer.invoke('initialize-finder'),
  indexDirectory: (directoryPath) => ipcRenderer.invoke('index-directory', directoryPath),
  findSimilar: (imagePath, threshold, limit, directoryPath) => ipcRenderer.invoke('find-similar', imagePath, threshold, limit, directoryPath),
  findDuplicates: (directoryPath, threshold) => ipcRenderer.invoke('find-duplicates', directoryPath, threshold),
  removeImage: (imagePath) => ipcRenderer.invoke('remove-image', imagePath),
  
  // 配置管理
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getModels: () => ipcRenderer.invoke('get-models')
});