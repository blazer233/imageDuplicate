const ImageProcessor = require('./imageProcessor');
const VectorStore = require('./vectorStore');

class ImageDuplicateFinder {
  constructor() {
    this.imageProcessor = new ImageProcessor();
    this.vectorStore = new VectorStore();
    this.isInitialized = false;
  }

  /**
   * 初始化系统
   */
  async initialize() {
    try {
      console.log('初始化图片重复查找系统...');

      // 初始化向量数据库
      await this.vectorStore.initialize();

      this.isInitialized = true;
      console.log('系统初始化完成');

      return true;
    } catch (error) {
      console.error('系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 索引指定目录下的所有图片
   * @param {string} directory - 目录路径
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Object>} - 索引结果
   */
  async indexDirectory(directory, progressCallback = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log(`开始索引目录: ${directory}`);

      // 扫描目录获取所有图片文件
      const imageFiles = await this.imageProcessor.scanDirectory(directory);
      console.log(`找到 ${imageFiles.length} 个图片文件`);

      if (imageFiles.length === 0) {
        return {
          success: true,
          message: '未找到支持的图片文件',
          indexedCount: 0,
          totalFiles: 0,
        };
      }

      // 批量处理图片并提取特征
      const processedImages = await this.imageProcessor.batchProcessImages(
        imageFiles,
        progressCallback
      );

      console.log(`成功处理 ${processedImages.length} 个图片`);

      // 准备向量数据
      const vectors = processedImages.map(item => ({
        vector: item.features,
        metadata: item.metadata,
      }));

      // 添加到向量数据库
      await this.vectorStore.addVectors(vectors);

      const stats = this.vectorStore.getStats();

      return {
        success: true,
        message: `成功索引 ${processedImages.length} 个图片`,
        indexedCount: processedImages.length,
        totalFiles: imageFiles.length,
        stats: stats,
      };
    } catch (error) {
      console.error('索引目录失败:', error);
      throw error;
    }
  }

  /**
   * 查找与指定图片相似的图片
   * @param {string} imagePath - 查询图片路径
   * @param {number} maxResults - 最大结果数量
   * @param {number} similarityThreshold - 相似度阈值
   * @returns {Promise<Array>} - 相似图片列表
   */
  async findSimilarImages(
    imagePath,
    maxResults = 10,
    similarityThreshold = 0.8
  ) {
    await this.initialize(); // 强制每次查找都重新加载数据库
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.vectorStore.isEmpty()) {
        return {
          success: false,
          message: '数据库为空，请先索引图片',
          results: [],
        };
      }

      console.log(`查找与图片相似的图片: ${imagePath}`);

      // 提取查询图片的特征
      const queryFeatures = await this.imageProcessor.extractFeatures(
        imagePath
      );
      const queryMetadata = await this.imageProcessor.getImageMetadata(
        imagePath
      );

      // 搜索相似图片
      const similarResults = await this.vectorStore.searchSimilar(
        queryFeatures,
        maxResults,
        similarityThreshold
      );

      console.log(`找到 ${similarResults.length} 个相似图片`);

      return {
        success: true,
        message: `找到 ${similarResults.length} 个相似图片`,
        queryImage: {
          path: imagePath,
          metadata: queryMetadata,
        },
        results: similarResults,
      };
    } catch (error) {
      console.error('查找相似图片失败:', error);
      throw error;
    }
  }

  /**
   * 获取系统统计信息
   * @returns {Object} - 统计信息
   */
  async getStats() {
    if (!this.isInitialized) {
      return {
        initialized: false,
        message: '系统未初始化',
      };
    }

    const vectorStats = await this.vectorStore.getStats();

    return {
      initialized: true,
      modelName: 'Xenova/clip-vit-base-patch16',
      vectorStore: vectorStats,
      supportedFormats: this.imageProcessor.supportedFormats,
    };
  }

  /**
   * 重置数据库
   */
  async resetDatabase() {
    try {
      console.log('重置数据库...');
      await this.vectorStore.clear();
      console.log('数据库重置完成');

      return {
        success: true,
        message: '数据库重置完成',
      };
    } catch (error) {
      console.error('重置数据库失败:', error);
      throw error;
    }
  }

  /**
   * 验证图片文件
   * @param {string} imagePath - 图片路径
   * @returns {Promise<Object>} - 验证结果
   */
  async validateImage(imagePath) {
    try {
      const isValid = this.imageProcessor.isSupportedImage(imagePath);

      if (!isValid) {
        return {
          valid: false,
          message: '不支持的图片格式',
        };
      }

      const metadata = await this.imageProcessor.getImageMetadata(imagePath);

      return {
        valid: true,
        metadata: metadata,
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message,
      };
    }
  }
}

module.exports = ImageDuplicateFinder;
