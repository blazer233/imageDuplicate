const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ImageDuplicateFinder = require('../imageDuplicateFinder');


// 使用动态导入electron-store
let store;
let storeInitialized = false;

// 初始化store的Promise
const storeInitPromise = (async () => {
  try {
    const { default: Store } = await import('electron-store');
    store = new Store();
    storeInitialized = true;
    console.log('配置存储初始化成功');
  } catch (error) {
    console.error('配置存储初始化失败:', error);
  }
})();

// 获取store的函数，确保store已初始化
async function getStore() {
  if (!storeInitialized) {
    await storeInitPromise;
  }
  return store;
}

// 全局变量，保存主窗口引用
let mainWindow;

// 图像查重器实例
let imageFinder;

/**
 * 创建主窗口
 */
function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 加载应用的主页面
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 初始化图像查重器（稍后会在initialize-finder中配置）
  imageFinder = null;

  // 开发环境下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * 应用准备就绪时创建窗口
 */
app.whenReady().then(() => {
  createWindow();

  // 在macOS上，当所有窗口都关闭时，通常会重新创建一个窗口
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

/**
 * 当所有窗口关闭时退出应用（Windows & Linux）
 */
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC通信处理

/**
 * 选择图片目录
 */
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (!result.canceled) {
    // 保存选择的目录到配置中
    const storeInstance = await getStore();
    storeInstance.set('lastImageDirectory', result.filePaths[0]);
    return result.filePaths[0];
  }
  return null;
});

/**
 * 选择单个图片文件
 */
ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
    ],
  });

  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

/**
 * 初始化图像查重器
 */
ipcMain.handle('initialize-finder', async () => {
  try {
    // 获取配置
    const storeInstance = await getStore();
    const config = {
      baseUrl: 'http://localhost:11434',
      model: storeInstance.get('model', 'llava:latest'), // Add this line
      defaultImageDirectory: storeInstance.get('defaultImageDirectory', ''),
    };

    // 创建图像查重器实例
    imageFinder = new ImageDuplicateFinder(config);

    // 初始化
    await imageFinder.initialize();
    return { success: true };
  } catch (error) {
    console.error('初始化失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 索引目录中的图片
 */
ipcMain.handle('index-directory', async (event, directoryPath) => {
  try {
    // 检查目录是否存在
    if (!fs.existsSync(directoryPath)) {
      return { success: false, error: '目录不存在' };
    }

    // 索引目录
    const result = await imageFinder.indexDirectory(directoryPath);
    return { success: true, count: result.length };
  } catch (error) {
    console.error('索引目录失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 查找相似图片
 */
ipcMain.handle(
  'find-similar',
  async (event, imagePath, threshold = 0.8, limit = 10, directoryPath) => {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(imagePath)) {
        return { success: false, error: '图片文件不存在' };
      }

      // 检查目录是否存在
      if (directoryPath && !fs.existsSync(directoryPath)) {
        return { success: false, error: '搜索目录不存在' };
      }

      // 如果提供了目录，先索引该目录
      if (directoryPath) {
        console.log(`索引目录: ${directoryPath}`);
        await imageFinder.indexDirectory(directoryPath);
      }

      // 查找相似图片
      const similarImages = await imageFinder.findSimilarImages(
        imagePath,
        limit,
        threshold
      );
      return { success: true, similarImages };
    } catch (error) {
      console.error('查找相似图片失败:', error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * 查找所有重复图片
 */
ipcMain.handle(
  'find-duplicates',
  async (event, directoryPath, threshold = 0.8) => {
    try {
      // 检查目录是否存在
      if (!fs.existsSync(directoryPath)) {
        return { success: false, error: '目录不存在' };
      }

      // 查找所有重复图片
      const duplicateGroups = await imageFinder.findAllDuplicates(
        directoryPath,
        threshold
      );
      return { success: true, duplicateGroups };
    } catch (error) {
      console.error('查找重复图片失败:', error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * 删除图片
 */
ipcMain.handle('remove-image', async (event, imagePath) => {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
      return { success: false, error: '图片文件不存在' };
    }

    // 从向量存储中删除图片
    const success = await imageFinder.removeImage(imagePath);
    return { success };
  } catch (error) {
    console.error('删除图片失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 获取上次使用的图片目录
 */
ipcMain.handle('get-last-directory', async () => {
  const storeInstance = await getStore();
  return storeInstance.get('lastImageDirectory', '');
});

/**
 * 保存配置
 */
ipcMain.handle('save-settings', async (event, settings) => {
  const storeInstance = await getStore();
  const oldDirectory = storeInstance.get('defaultImageDirectory');

  // Check if the directory has changed
  if (
    settings.defaultImageDirectory &&
    oldDirectory !== settings.defaultImageDirectory
  ) {
    console.log('Default directory changed. Resetting vector database...');
    if (imageFinder) {
      await imageFinder.reset(); // This method needs to be created
    }
  }

  for (const [key, value] of Object.entries(settings)) {
    storeInstance.set(key, value);
  }
  return { success: true };
});

ipcMain.handle('get-models', async () => {
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    console.log(response);
    const data = await response.json();
    const models = data.models.map(m => m.name);
    return { success: true, models };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * 获取配置
 */
ipcMain.handle('get-settings', async () => {
  const storeInstance = await getStore();
  return {
    lastImageDirectory: storeInstance.get('lastImageDirectory', ''),
    similarityThreshold: storeInstance.get('similarityThreshold', 0.8),
    maxResults: storeInstance.get('maxResults', 10),
    defaultImageDirectory: storeInstance.get('defaultImageDirectory', ''),
    model: storeInstance.get('model', 'llava:latest'), // Add this line
  };
});
