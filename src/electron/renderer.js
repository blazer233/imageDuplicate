// 全局变量
let currentSettings = {};
let isIndexing = false;

// DOM 元素
const elements = {
    // 导航
    navBtns: document.querySelectorAll('.nav-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // 设置页面
    
    similarityThreshold: document.getElementById('similarityThreshold'),
    similarityValue: document.getElementById('similarityValue'),
    maxResults: document.getElementById('maxResults'),
    
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    
    resetDbBtn: document.getElementById('resetDbBtn'),
    systemStatus: document.getElementById('systemStatus'),
    
    // 索引页面
    indexDirectory: document.getElementById('indexDirectory'),
    selectIndexDirectoryBtn: document.getElementById('selectIndexDirectoryBtn'),
    startIndexBtn: document.getElementById('startIndexBtn'),
    stopIndexBtn: document.getElementById('stopIndexBtn'),
    indexProgress: document.getElementById('indexProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    currentFile: document.getElementById('currentFile'),
    indexResult: document.getElementById('indexResult'),
    indexedImages: document.getElementById('indexedImages'),
    indexedImagesList: document.getElementById('indexedImagesList'),
    
    // 搜索页面
    searchImage: document.getElementById('searchImage'),
    selectSearchImageBtn: document.getElementById('selectSearchImageBtn'),
    searchBtn: document.getElementById('searchBtn'),
    searchResult: document.getElementById('searchResult'),
    selectedImagePreview: document.getElementById('selectedImagePreview')
};

// 初始化应用
async function initializeApp() {
    try {
        // 初始化系统
        const initResult = await window.electronAPI.initializeSystem();
        if (!initResult.success) {
            showError('系统初始化失败: ' + initResult.message);
        }
        
        // 加载设置
        await loadSettings();
        
        // 检查系统状态
        await checkSystemStatus();
        
        // 设置事件监听器
        setupEventListeners();
        
        console.log('应用初始化完成');
    } catch (error) {
        console.error('应用初始化失败:', error);
        showError('应用初始化失败: ' + error.message);
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 导航切换
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // 设置页面事件
    elements.similarityThreshold.addEventListener('input', updateSimilarityValue);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    
    elements.resetDbBtn.addEventListener('click', resetDatabase);
    
    // 索引页面事件
    elements.selectIndexDirectoryBtn.addEventListener('click', selectIndexDirectory);
    elements.startIndexBtn.addEventListener('click', startIndexing);
    elements.stopIndexBtn.addEventListener('click', stopIndexing);
    
    // 搜索页面事件
    elements.selectSearchImageBtn.addEventListener('click', selectSearchImage);
    elements.searchBtn.addEventListener('click', searchSimilarImages);
    

    
    // 监听索引进度
    window.electronAPI.onIndexProgress(handleIndexProgress);
}

// 切换选项卡
function switchTab(tabName) {
    // 移除所有活动状态
    elements.navBtns.forEach(btn => btn.classList.remove('active'));
    elements.tabContents.forEach(content => content.classList.remove('active'));
    
    // 添加活动状态
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');

    if (tabName === 'indexed-list') {
        showIndexedImages();
    }
}

// 加载设置
async function loadSettings() {
    try {
        const result = await window.electronAPI.loadSettings();
        if (result.success) {
            currentSettings = result.settings;
            
            // 更新UI
            // elements.defaultDirectory.value = currentSettings.defaultDirectory || ''; // This line was removed
            
            elements.similarityThreshold.value = currentSettings.similarityThreshold || 0.8;
            elements.maxResults.value = currentSettings.maxResults || 10;
            
            
            // 更新显示值
            updateSimilarityValue();
            // updateDuplicateThresholdValue(); // This line was removed
            
            console.log('设置加载成功');
        } else {
            showError('加载设置失败: ' + result.message);
        }
    } catch (error) {
        console.error('加载设置失败:', error);
        showError('加载设置失败: ' + error.message);
    }
}

// 保存设置
async function saveSettings() {
    try {
        const settings = {
            // defaultDirectory: elements.defaultDirectory.value, // This line was removed
            
            similarityThreshold: parseFloat(elements.similarityThreshold.value),
            maxResults: parseInt(elements.maxResults.value),
            
        };
        
        const result = await window.electronAPI.saveSettings(settings);
        if (result.success) {
            currentSettings = settings;
            showSuccess('设置保存成功');
        } else {
            showError('保存设置失败: ' + result.message);
        }
    } catch (error) {
        console.error('保存设置失败:', error);
        showError('保存设置失败: ' + error.message);
    }
}



// 重置数据库
async function resetDatabase() {
    if (!confirm('确定要重置数据库吗？此操作将删除所有已索引的图片数据，且不可恢复。')) {
        return;
    }
    
    try {
        elements.resetDbBtn.disabled = true;
        elements.resetDbBtn.textContent = '重置中...';
        
        const result = await window.electronAPI.resetDatabase();
        if (result.success) {
            showSuccess('数据库重置成功');
            await checkSystemStatus();
            await showIndexedImages(); // 在重置后刷新已索引图片
        } else {
            showError('重置数据库失败: ' + result.message);
        }
    } catch (error) {
        console.error('重置数据库失败:', error);
        showError('重置数据库失败: ' + error.message);
    } finally {
        elements.resetDbBtn.disabled = false;
        elements.resetDbBtn.textContent = '重置数据库';
    }
}

// 检查系统状态
async function checkSystemStatus() {
    try {
        const result = await window.electronAPI.getStats();
        if (result.success) {
            const stats = result.stats;
            updateSystemStatus(stats);
        } else {
            updateSystemStatus({ initialized: false, message: result.message });
        }
    } catch (error) {
        console.error('获取系统状态失败:', error);
        updateSystemStatus({ initialized: false, message: error.message });
    }
}

// 更新系统状态显示
function updateSystemStatus(stats) {
    let html = '';
    
    if (stats.initialized) {
        html = `
            <div class="status-item">
                <span class="status-label">系统状态:</span>
                <span class="status-value success">已初始化</span>
            </div>
            <div class="status-item">
                <span class="status-label">模型名称:</span>
                <span class="status-value">${stats.modelName}</span>
            </div>
            <div class="status-item">
                <span class="status-label">已索引图片:</span>
                <span class="status-value">${stats.vectorStore?.totalVectors || 0}</span>
            </div>
            <div class="status-item">
                <span class="status-label">向量维度:</span>
                <span class="status-value">${stats.vectorStore?.dimension || 0}</span>
            </div>
            <div class="status-item">
                <span class="status-label">数据库路径:</span>
                <span class="status-value">${stats.vectorStore?.dbPath}</span>
            </div>
            <div class="status-item">
                <span class="status-label">索引文件大小:</span>
                <span class="status-value">${formatFileSize(stats.vectorStore?.indexSize || 0)}</span>
            </div>
            <div class="status-item">
                <span class="status-label">元数据文件大小:</span>
                <span class="status-value">${formatFileSize(stats.vectorStore?.metadataSize || 0)}</span>
            </div>
            <div class="status-item">
                <span class="status-label">最后修改时间:</span>
                <span class="status-value">${stats.vectorStore?.lastModified ? new Date(stats.vectorStore.lastModified).toLocaleString() : 'N/A'}</span>
            </div>
            <div class="status-item">
                <span class="status-label">应用版本:</span>
                <span class="status-value">${stats.appVersion}</span>
            </div>
            <div class="status-item">
                <span class="status-label">Node.js 版本:</span>
                <span class="status-value">${stats.nodeVersion}</span>
            </div>
            <div class="status-item">
                <span class="status-label">Electron 版本:</span>
                <span class="status-value">${stats.electronVersion}</span>
            </div>
            <div class="status-item">
                <span class="status-label">支持格式:</span>
                <span class="status-value">${stats.supportedFormats?.join(', ') || ''}</span>
            </div>
        `;
    } else {
        html = `
            <div class="status-item">
                <span class="status-label">系统状态:</span>
                <span class="status-value error">未初始化</span>
            </div>
            <div class="status-item">
                <span class="status-label">错误信息:</span>
                <span class="status-value error">${stats.message || '未知错误'}</span>
            </div>
        `;
    }
    
    elements.systemStatus.innerHTML = html;
}

// 选择索引目录
async function selectIndexDirectory() {
    try {
        const result = await window.electronAPI.selectDirectory();
        if (result.success) {
            elements.indexDirectory.value = result.path;
        } else {
            showError('选择目录失败: ' + result.message);
        }
    } catch (error) {
        console.error('选择目录失败:', error);
        showError('选择目录失败: ' + error.message);
    }
}

// 开始索引
async function startIndexing() {
    const directory = elements.indexDirectory.value.trim();
    if (!directory) {
        showError('请选择要索引的目录');
        return;
    }
    
    try {
        isIndexing = true;
        elements.startIndexBtn.disabled = true;
        elements.stopIndexBtn.disabled = false;
        elements.indexProgress.style.display = 'block';
        elements.indexResult.innerHTML = '';
        
        const result = await window.electronAPI.indexDirectory(directory);
        
        if (result.success) {
            showSuccess(`索引完成: ${result.message}`);
            await checkSystemStatus();
            await showIndexedImages(); // 在索引后刷新已索引图片
        } else {
            showError('索引失败: ' + result.message);
        }
    } catch (error) {
        console.error('索引失败:', error);
        showError('索引失败: ' + error.message);
    } finally {
        isIndexing = false;
        elements.startIndexBtn.disabled = false;
        elements.stopIndexBtn.disabled = true;
        elements.indexProgress.style.display = 'none';
    }
}

// 停止索引
function stopIndexing() {
    isIndexing = false;
    elements.startIndexBtn.disabled = false;
    elements.stopIndexBtn.disabled = true;
    elements.indexProgress.style.display = 'none';
    showWarning('索引已停止');
}

// 处理索引进度
function handleIndexProgress(data) {
    if (!isIndexing) return;
    
    elements.progressFill.style.width = data.percentage + '%';
    elements.progressText.textContent = `进度: ${data.current}/${data.total} (${data.percentage}%)`;
    elements.currentFile.textContent = `当前文件: ${data.filePath}`;
}

// 选择搜索图片
async function selectSearchImage() {
    try {
        const result = await window.electronAPI.selectImage();
        if (result.success) {
            elements.searchImage.value = result.path;
            showSelectedImagePreview(result.path);
        } else {
            showError('选择图片失败: ' + result.message);
            elements.selectedImagePreview.innerHTML = '';
        }
    } catch (error) {
        console.error('选择图片失败:', error);
        showError('选择图片失败: ' + error.message);
        elements.selectedImagePreview.innerHTML = '';
    }
}

function showSelectedImagePreview(imagePath) {
    if (!imagePath) {
        elements.selectedImagePreview.innerHTML = '';
        return;
    }
    const ext = imagePath.split('.').pop().toLowerCase();
    if (["jpg","jpeg","png","gif","webp"].includes(ext)) {
        elements.selectedImagePreview.innerHTML = `<img src="file://${imagePath}" alt="预览" style="max-width:200px;max-height:120px;border-radius:8px;box-shadow:none;">`;
    } else {
        elements.selectedImagePreview.innerHTML = '<span style="color:#888;">不支持预览</span>';
    }
}

// 搜索相似图片
async function searchSimilarImages() {
    const imagePath = elements.searchImage.value.trim();
    if (!imagePath) {
        showError('请选择要搜索的图片');
        return;
    }
    try {
        elements.searchBtn.disabled = true;
        elements.searchBtn.textContent = '搜索中...';
        // 直接用设置页的参数
        const maxResults = parseInt(elements.maxResults.value);
        const threshold = parseFloat(elements.similarityThreshold.value);
        const result = await window.electronAPI.findSimilarImages(imagePath, maxResults, threshold);
        if (result.success) {
            displaySearchResults(result);
        } else {
            showError('搜索失败: ' + result.message);
        }
    } catch (error) {
        console.error('搜索失败:', error);
        showError('搜索失败: ' + error.message);
    } finally {
        elements.searchBtn.disabled = false;
        elements.searchBtn.textContent = '查找相似图片';
    }
}

// 显示搜索结果
function displaySearchResults(result) {
    let html = `<h3>搜索结果 (${result.results.length} 个结果)</h3>`;
    if (result.results.length === 0) {
        html += '<p>未找到相似的图片</p>';
    } else {
        result.results.forEach((item, index) => {
            const ext = (item.metadata.filename || '').split('.').pop().toLowerCase();
            let imgTag = '';
            if (["jpg","jpeg","png","gif","webp"].includes(ext)) {
                imgTag = `<img src="file://${item.metadata.path}" alt="缩略图" style="max-width:80px;max-height:80px;border-radius:6px;vertical-align:middle;margin-right:12px;box-shadow:none;">`;
            }
            html += `
                <div class="result-item" style="display:flex;align-items:center;gap:16px;">
                    ${imgTag}
                    <div style="flex:1;">
                        <h4 style="margin-bottom:4px;">${item.metadata.filename}</h4>
                        <p>路径: ${item.metadata.path}</p>
                        <p>大小: ${formatFileSize(item.metadata.size)}</p>
                        <p>尺寸: ${item.metadata.width} × ${item.metadata.height}</p>
                        <p class="similarity">相似度: ${(item.similarity * 100).toFixed(2)}%</p>
                        <div class="actions">
                            <button onclick="openFile('${item.metadata.path}')">打开文件</button>
                            <button onclick="openFileLocation('${item.metadata.path}')">显示位置</button>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    elements.searchResult.innerHTML = html;
}

// 展示已索引图片
async function showIndexedImages() {
    try {
        const res = await window.electronAPI.getIndexedImages();
        if (res.success && res.images.length > 0) {
            let html = `<div style="font-size:0.95em;">共${res.images.length}张图片</div>`;
            res.images.forEach(item => {
                const ext = (item.filename || '').split('.').pop().toLowerCase();
                let imgTag = '';
                if (["jpg","jpeg","png","gif","webp"].includes(ext)) {
                    imgTag = `<img src="file://${item.path}" alt="缩略图" style="max-width:60px;max-height:60px;border-radius:6px;vertical-align:middle;margin-right:12px;box-shadow:none;">`;
                }
                html += `<div class="result-item" style="display:flex;align-items:center;gap:16px;">
                    ${imgTag}
                    <div style="flex:1;">
                        <h4 style="margin-bottom:4px;">${item.filename}</h4>
                        <p>路径: ${item.path}</p>
                        <p>大小: ${formatFileSize(item.size)}</p>
                        <p>尺寸: ${item.width} × ${item.height}</p>
                    </div>
                </div>`;
            });
            elements.indexedImagesList.innerHTML = html;
        } else {
            elements.indexedImagesList.innerHTML = '<span style="color:#888;">暂无已索引图片</span>';
        }
    } catch (e) {
        elements.indexedImagesList.innerHTML = '<span style="color:#888;">暂无已索引图片</span>';
    }
}

// 工具函数
function updateSimilarityValue() {
    elements.similarityValue.textContent = elements.similarityThreshold.value;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showError(message) {
    showMessage(message, 'error');
}

function showWarning(message) {
    showMessage(message, 'warning');
}

function showMessage(message, type = 'info') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        max-width: 400px;
        word-wrap: break-word;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    `;
    
    // 设置背景色
    switch (type) {
        case 'success':
            messageEl.style.backgroundColor = '#28a745';
            break;
        case 'error':
            messageEl.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            messageEl.style.backgroundColor = '#ffc107';
            messageEl.style.color = '#333';
            break;
        default:
            messageEl.style.backgroundColor = '#17a2b8';
    }
    
    document.body.appendChild(messageEl);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 3000);
}

// 全局函数（供HTML调用）
window.openFile = async function(filePath) {
    try {
        await window.electronAPI.openFile(filePath);
    } catch (error) {
        showError('打开文件失败: ' + error.message);
    }
};

window.openFileLocation = async function(filePath) {
    try {
        await window.electronAPI.openFileLocation(filePath);
    } catch (error) {
        showError('打开文件位置失败: ' + error.message);
    }
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    showIndexedImages();
}); 