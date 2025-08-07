const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const ImageDuplicateFinder = require('../imageDuplicateFinder');
const fs = require('fs');

// 创建配置存储
const store = new Store();

// 创建图片重复查找器实例
const imageDuplicateFinder = new ImageDuplicateFinder();

let mainWindow;

function createWindow() {
    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'), // 如果有图标的话
        title: '图片重复查找器'
    });

    // 加载应用的 index.html
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // 打开开发者工具（开发模式）
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // 当窗口关闭时触发
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 当 Electron 完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        // 在 macOS 上，当点击 dock 图标并且没有其他窗口打开时，
        // 通常在应用程序中重新创建一个窗口。
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 当所有窗口都关闭时退出应用
app.on('window-all-closed', () => {
    // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
    // 否则绝大部分应用及其菜单栏会保持激活。
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC 处理器

// 初始化系统
ipcMain.handle('initialize-system', async () => {
    try {
        await imageDuplicateFinder.initialize();
        return { success: true, message: '系统初始化成功' };
    } catch (error) {
        return { success: false, message: `初始化失败: ${error.message}` };
    }
});

// 检查 Ollama 服务
ipcMain.handle('check-ollama-service', async () => {
    try {
        const isAvailable = await imageDuplicateFinder.checkOllamaService();
        return { 
            success: true, 
            available: isAvailable,
            message: isAvailable ? 'Ollama 服务可用' : 'Ollama 服务不可用'
        };
    } catch (error) {
        return { 
            success: false, 
            available: false,
            message: `检查服务失败: ${error.message}` 
        };
    }
});

// 选择目录
ipcMain.handle('select-directory', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: '选择图片目录'
        });

        if (!result.canceled && result.filePaths.length > 0) {
            return { 
                success: true, 
                path: result.filePaths[0] 
            };
        } else {
            return { 
                success: false, 
                message: '未选择目录' 
            };
        }
    } catch (error) {
        return { 
            success: false, 
            message: `选择目录失败: ${error.message}` 
        };
    }
});

// 选择图片文件
ipcMain.handle('select-image', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
            ],
            title: '选择图片文件'
        });

        if (!result.canceled && result.filePaths.length > 0) {
            return { 
                success: true, 
                path: result.filePaths[0] 
            };
        } else {
            return { 
                success: false, 
                message: '未选择图片' 
            };
        }
    } catch (error) {
        return { 
            success: false, 
            message: `选择图片失败: ${error.message}` 
        };
    }
});

// 索引目录
ipcMain.handle('index-directory', async (event, directory) => {
    try {
        const result = await imageDuplicateFinder.indexDirectory(directory, (current, total, filePath) => {
            // 发送进度更新
            mainWindow.webContents.send('index-progress', {
                current,
                total,
                filePath,
                percentage: Math.round((current / total) * 100)
            });
        });

        return result;
    } catch (error) {
        return { 
            success: false, 
            message: `索引失败: ${error.message}` 
        };
    }
});

// 查找相似图片
ipcMain.handle('find-similar-images', async (event, imagePath, maxResults, similarityThreshold) => {
    try {
        const result = await imageDuplicateFinder.findSimilarImages(
            imagePath, 
            maxResults || 10, 
            similarityThreshold || 0.8
        );
        return result;
    } catch (error) {
        return { 
            success: false, 
            message: `查找失败: ${error.message}` 
        };
    }
});



// 获取系统统计信息
ipcMain.handle('get-stats', async () => {
    try {
        const stats = imageDuplicateFinder.getStats();
        return { success: true, stats };
    } catch (error) {
        return { 
            success: false, 
            message: `获取统计信息失败: ${error.message}` 
        };
    }
});

// 重置数据库
ipcMain.handle('reset-database', async () => {
    try {
        const result = await imageDuplicateFinder.resetDatabase();
        return result;
    } catch (error) {
        return { 
            success: false, 
            message: `重置数据库失败: ${error.message}` 
        };
    }
});

// 验证图片文件
ipcMain.handle('validate-image', async (event, imagePath) => {
    try {
        const result = await imageDuplicateFinder.validateImage(imagePath);
        return result;
    } catch (error) {
        return { 
            valid: false, 
            message: `验证失败: ${error.message}` 
        };
    }
});

// 保存设置
ipcMain.handle('save-settings', async (event, settings) => {
    try {
        store.set('settings', settings);
        return { success: true, message: '设置保存成功' };
    } catch (error) {
        return { 
            success: false, 
            message: `保存设置失败: ${error.message}` 
        };
    }
});

// 加载设置
ipcMain.handle('load-settings', async () => {
    try {
        const settings = store.get('settings', {
            defaultDirectory: '',
            model: 'llava',
            similarityThreshold: 0.8,
            maxResults: 10,
            minGroupSize: 2
        });
        return { success: true, settings };
    } catch (error) {
        return { 
            success: false, 
            message: `加载设置失败: ${error.message}` 
        };
    }
});

// 打开文件位置
ipcMain.handle('open-file-location', async (event, filePath) => {
    try {
        await shell.showItemInFolder(filePath);
        return { success: true };
    } catch (error) {
        return { 
            success: false, 
            message: `打开文件位置失败: ${error.message}` 
        };
    }
});

// 打开文件
ipcMain.handle('open-file', async (event, filePath) => {
    try {
        await shell.openPath(filePath);
        return { success: true };
    } catch (error) {
        return { 
            success: false, 
            message: `打开文件失败: ${error.message}` 
        };
    }
}); 

ipcMain.handle('get-indexed-images', async () => {
    try {
        const metaPath = path.join(__dirname, '../../vector_db/metadata.json');
        if (fs.existsSync(metaPath)) {
            const data = fs.readFileSync(metaPath, 'utf-8');
            return { success: true, images: JSON.parse(data) };
        } else {
            return { success: true, images: [] };
        }
    } catch (e) {
        return { success: false, message: e.message };
    }
}); 