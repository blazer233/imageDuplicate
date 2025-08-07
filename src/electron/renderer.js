// 获取DOM元素
const elements = {
  // 标签页
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  
  // 查找相似图片
  imagePathInput: document.getElementById('image-path'),
  selectImageBtn: document.getElementById('select-image-btn'),
  similarLimit: document.getElementById('similar-limit'),
  findSimilarBtn: document.getElementById('find-similar-btn'),
  similarResults: document.getElementById('similar-results'),
  similarResultsGrid: document.getElementById('similar-results-grid'),
  
  // 设置
  defaultImageDirectory: document.getElementById('default-image-directory'),
  selectDefaultDirectoryBtn: document.getElementById('select-default-directory-btn'),
  modelSelect: document.getElementById('model-select'),
  defaultThreshold: document.getElementById('default-threshold'),
  defaultThresholdValue: document.getElementById('default-threshold-value'),
  defaultLimit: document.getElementById('default-limit'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  
  // 加载动画
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingMessage: document.getElementById('loading-message')
};

// 初始化应用
async function initializeApp() {
  try {
    // 显示加载动画
    showLoading('正在初始化...');
    
    // 加载模型列表
    const modelsResult = await window.electronAPI.getModels();
    console.log(modelsResult);
    if (modelsResult.success) {
      const { models } = modelsResult;
      const { modelSelect } = elements;
      modelSelect.innerHTML = '';
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
      });
    } else {
      showError(`加载模型列表失败: ${modelsResult.error}`);
    }

    // 加载设置
    const settings = await window.electronAPI.getSettings();
    
    // 应用设置
    if (settings.defaultImageDirectory) {
      elements.defaultImageDirectory.value = settings.defaultImageDirectory;
    }
    if (settings.model) {
      elements.modelSelect.value = settings.model;
    }
    
    elements.defaultThreshold.value = settings.similarityThreshold;
    elements.defaultThresholdValue.textContent = settings.similarityThreshold;
    
    elements.similarLimit.value = settings.maxResults;
    elements.defaultLimit.value = settings.maxResults;
    
    // 初始化图像查重器
    const initResult = await window.electronAPI.initializeFinder();
    if (!initResult.success) {
      throw new Error(`初始化失败: ${initResult.error}`);
    }
    
    // 隐藏加载动画
    hideLoading();
  } catch (error) {
    hideLoading();
    showError(`初始化应用失败: ${error.message}`);
  }
}

// 显示加载动画
function showLoading(message = '正在处理...') {
  elements.loadingMessage.textContent = message;
  elements.loadingOverlay.classList.remove('hidden');
}

// 隐藏加载动画
function hideLoading() {
  elements.loadingOverlay.classList.add('hidden');
}

// 显示错误消息
function showError(message) {
  alert(message);
}

// 标签页切换
elements.tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    // 移除所有标签页的active类
    elements.tabButtons.forEach(btn => btn.classList.remove('active'));
    elements.tabPanes.forEach(pane => pane.classList.remove('active'));
    
    // 添加当前标签页的active类
    button.classList.add('active');
    const tabId = button.dataset.tab;
    document.getElementById(tabId).classList.add('active');
  });
});

// 选择目录
elements.selectDefaultDirectoryBtn.addEventListener('click', async () => {
  const directoryPath = await window.electronAPI.selectDirectory();
  if (directoryPath) {
    elements.defaultImageDirectory.value = directoryPath;
  }
});

// 选择图片
elements.selectImageBtn.addEventListener('click', async () => {
  const imagePath = await window.electronAPI.selectImage();
  if (imagePath) {
    elements.imagePathInput.value = imagePath;
    elements.findSimilarBtn.disabled = false;
  }
});

// 相似度阈值滑块更新




elements.defaultThreshold.addEventListener('input', () => {
  elements.defaultThresholdValue.textContent = elements.defaultThreshold.value;
});



// 查找相似图片
elements.findSimilarBtn.addEventListener('click', async () => {
  const imagePath = elements.imagePathInput.value;
  if (!imagePath) {
    showError('请先选择图片');
    return;
  }
  
  // 获取设置中的默认目录
  let searchDirectory = '';
  try {
    const settings = await window.electronAPI.getSettings();
    if (settings.defaultImageDirectory) {
      searchDirectory = settings.defaultImageDirectory;
    } else {
      showError('请在设置中配置默认图片目录');
      return;
    }
  } catch (error) {
    showError(`获取默认目录失败: ${error.message}`);
    return;
  }
  
  const settings = await window.electronAPI.getSettings();
  const threshold = parseFloat(settings.similarityThreshold);
  const limit = parseInt(elements.similarLimit.value);
  
  try {
    showLoading('正在查找相似图片...');
    const result = await window.electronAPI.findSimilar(imagePath, threshold, limit, searchDirectory);
    hideLoading();
    
    if (result.success) {
      displaySimilarResults(imagePath, result.similarImages);
    } else {
      showError(`查找失败: ${result.error}`);
    }
  } catch (error) {
    hideLoading();
    showError(`查找过程出错: ${error.message}`);
  }
});



// 保存设置
elements.saveSettingsBtn.addEventListener('click', async () => {
  const settings = {
    defaultImageDirectory: elements.defaultImageDirectory.value,
    model: elements.modelSelect.value,
    similarityThreshold: parseFloat(elements.defaultThreshold.value),
    maxResults: parseInt(elements.defaultLimit.value)
  };
  
  try {
    const result = await window.electronAPI.saveSettings(settings);
    if (result.success) {
      // 显示加载动画
      showLoading('正在重新初始化...');
      
      // 更新其他页面的设置
      elements.defaultThreshold.value = settings.similarityThreshold;
      elements.defaultThresholdValue.textContent = settings.similarityThreshold;
      elements.defaultLimit.value = settings.maxResults;
      
      // 重新初始化图像查重器
      const initResult = await window.electronAPI.initializeFinder();
      if (initResult.success) {
        hideLoading();
        alert('设置已保存并应用');
      } else {
        hideLoading();
        showError(`重新初始化失败: ${initResult.error}`);
      }
    }
  } catch (error) {
    hideLoading();
    showError(`保存设置失败: ${error.message}`);
  }
});

// 显示相似图片结果
function displaySimilarResults(originalImagePath, results) {
  // 清空结果区域
  elements.similarResultsGrid.innerHTML = '';
  
  // 添加原始图片
  const originalItem = createResultItem(originalImagePath, 1.0, '原始图片');
  elements.similarResultsGrid.appendChild(originalItem);
  
  // 添加相似图片
  if (results.length === 0) {
    const noResults = document.createElement('p');
    noResults.textContent = '未找到相似图片';
    elements.similarResultsGrid.appendChild(noResults);
  } else {
    results.forEach(result => {
      const item = createResultItem(result.path, result.score);
      elements.similarResultsGrid.appendChild(item);
    });
  }
  
  // 显示结果区域
  elements.similarResults.classList.remove('hidden');
}



// 创建结果项
function createResultItem(imagePath, score, label = null) {
  const item = document.createElement('div');
  item.className = 'result-item';
  
  // 图片
  const img = document.createElement('img');
  img.src = `file://${imagePath}`;
  img.alt = pathUtils.basename(imagePath);
  img.onerror = () => {
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="%23f0f0f0"/><text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="%23999">图片加载失败</text></svg>';
  };
  item.appendChild(img);
  
  // 信息
  const info = document.createElement('div');
  info.className = 'result-info';
  
  // 文件名
  const fileName = document.createElement('p');
  fileName.textContent = pathUtils.basename(imagePath);
  fileName.title = imagePath;
  info.appendChild(fileName);
  
  // 相似度
  const similarity = document.createElement('p');
  similarity.className = 'similarity-score';
  similarity.textContent = label || `相似度: ${(score * 100).toFixed(2)}%`;
  info.appendChild(similarity);
  
  item.appendChild(info);
  
  return item;
}

// 自定义路径处理函数
const pathUtils = {
  basename: (filePath) => {
    if (!filePath) return '';
    return filePath.split(/[\\/]/).pop();
  },
  
  // 获取文件扩展名
  extname: (filePath) => {
    if (!filePath) return '';
    const basename = pathUtils.basename(filePath);
    const dotIndex = basename.lastIndexOf('.');
    return dotIndex !== -1 ? basename.slice(dotIndex) : '';
  }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', initializeApp);