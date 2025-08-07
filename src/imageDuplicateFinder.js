/**
 * 图片重复查找模块
 * 整合图像处理和向量存储功能，实现图片重复查找
 */

const fs = require('fs');
const path = require('path');
const ImageProcessor = require('./imageProcessor');
const VectorStore = require('./vectorStore');

class ImageDuplicateFinder {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:11434',
      model: config.model || 'llava:latest',
      defaultImageDirectory: config.defaultImageDirectory || ''
    };
    this.imageProcessor = new ImageProcessor(this.config);
    this.vectorStore = new VectorStore(path.join(__dirname, '..', 'vector_db'));
    this.initialized = false;
    this.vectorDimension = 768;
  }

  /**
   * 初始化系统
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log('初始化图片重复查找系统...');
      await this.vectorStore.initialize(this.imageProcessor.ollama, this.vectorDimension);
      this.initialized = true;
      console.log('系统初始化完成');
    } catch (error) {
      console.error('系统初始化失败', error);
      throw error;
    }
  }

  /**
   * 索引图像目录
   * @param {string} directoryPath - 图像目录路径
   * @returns {Promise<number>} - 成功索引的图像数量
   */
  async indexDirectory(directoryPath) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`开始索引目录: ${directoryPath}`);
      
      // 检查目录是否存在
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`目录不存在: ${directoryPath}`);
      }

      // 处理目录中的所有图像
      const imageVectors = await this.imageProcessor.processDirectory(directoryPath);

      if (imageVectors.length === 0) {
        console.log('目录中没有找到可处理的图像');
        return 0;
      }

      // 验证所有向量的维度是否一致
      for (const imageVector of imageVectors) {
        if (imageVector.vector.length !== this.vectorDimension) {
          console.warn(`图像 ${imageVector.path} 的向量维度不匹配，已跳过`);
          continue;
        }
        await this.vectorStore.addVectors([imageVector]);
      }
      
      console.log(`成功索引 ${imageVectors.length} 张图像`);
      return imageVectors.length;
    } catch (error) {
      console.error('索引目录失败', error);
      throw error;
    }
  }

  /**
   * 查找与给定图像相似的图像
   * @param {string} imagePath - 图像文件路径
   * @param {number} maxResults - 最大结果数量
   * @param {number} similarityThreshold - 相似度阈值 (0-1)
   * @returns {Promise<Array<{path: string, score: number}>>} - 相似图像结果
   */
  async findSimilarImages(imagePath, maxResults = 5, similarityThreshold = 0.8) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`查找与 ${imagePath} 相似的图像...`);
      
      // 检查文件是否存在
      if (!fs.existsSync(imagePath)) {
        throw new Error(`文件不存在: ${imagePath}`);
      }

      // 处理查询图像
      const { vector } = await this.imageProcessor.processImage(imagePath);
      
      // 查找相似图像
      const similarImages = await this.vectorStore.findSimilar(
        vector, 
        maxResults, 
        similarityThreshold
      );
      
      console.log(`找到 ${similarImages.length} 个相似图像`);
      return similarImages;
    } catch (error) {
      console.error('查找相似图像失败', error);
      throw error;
    }
  }

  /**
   * 在目录中查找所有重复图像
   * @param {string} directoryPath - 图像目录路径
   * @param {number} similarityThreshold - 相似度阈值 (0-1)
   * @returns {Promise<Array<{original: string, duplicates: Array<{path: string, score: number}>}>>} - 重复图像组
   */
  async findAllDuplicates(directoryPath, similarityThreshold = 0.8) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`在目录 ${directoryPath} 中查找所有重复图像...`);
      
      // 检查目录是否存在
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`目录不存在: ${directoryPath}`);
      }

      // 先索引目录
      await this.indexDirectory(directoryPath);
      
      // 获取所有已索引的图像路径
      const allPaths = await this.vectorStore.getAllImagePaths();
      
      // 查找重复
      const duplicateGroups = [];
      const processedPaths = new Set();
      
      for (const imagePath of allPaths) {
        // 跳过已处理的图像
        if (processedPaths.has(imagePath)) continue;
        
        // 查找相似图像
        const similarImages = await this.findSimilarImages(
          imagePath, 
          10, 
          similarityThreshold
        );
        
        // 过滤掉自身
        const duplicates = similarImages.filter(img => img.path !== imagePath);
        
        // 如果有重复，添加到结果
        if (duplicates.length > 0) {
          duplicateGroups.push({
            original: imagePath,
            duplicates: duplicates
          });
          
          // 标记所有重复项为已处理
          processedPaths.add(imagePath);
          duplicates.forEach(dup => processedPaths.add(dup.path));
        }
      }
      
      console.log(`找到 ${duplicateGroups.length} 组重复图像`);
      return duplicateGroups;
    } catch (error) {
      console.error('查找所有重复图像失败', error);
      throw error;
    }
  }

  /**
   * 从存储中删除图像
   * @param {string} imagePath - 图像文件路径
   * @returns {Promise<boolean>} - 是否成功删除
   */
  async removeImage(imagePath) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      return await this.vectorStore.deleteByPath(imagePath);
    } catch (error) {
      console.error('删除图像失败', error);
      throw error;
    }
  }

  /**
   * 重置向量数据库
   * @returns {Promise<void>}
   */
  async reset() {
    try {
      console.log('重置向量数据库...');
      await this.vectorStore.reset();
      this.initialized = false;
      await this.initialize();
      console.log('向量数据库已重置');
    } catch (error) {
      console.error('重置向量数据库失败', error);
      throw error;
    }
  }
}

module.exports = ImageDuplicateFinder;