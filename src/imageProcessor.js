const fs = require('fs-extra');
const path = require('path');

class ImageProcessor {
  constructor() {
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    this.extractor = null;
  }

  async initialize() {
    if (!this.extractor) {
      const { pipeline } = await import('@xenova/transformers');
      this.extractor = await pipeline(
        'image-feature-extraction',
        'Xenova/clip-vit-base-patch16'
      );
    }
  }

  /**
   * 检查文件是否为支持的图片格式
   * @param {string} filePath - 文件路径
   * @returns {boolean} - 是否为支持的图片格式
   */
  isSupportedImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedFormats.includes(ext);
  }

  /**
   * 从图片中提取特征向量
   * @param {string} imagePath - 图片路径
   * @returns {Promise<number[]>} - 特征向量
   */
  async extractFeatures(imagePath) {
    try {
      await this.initialize();
      const embedding = await this.extractor(imagePath, {
        pooling: 'mean',
        normalize: true,
      });
      return embedding.data;
    } catch (error) {
      console.error(`提取图片特征失败: ${imagePath}`, error);
      throw error;
    }
  }

  /**
   * 批量处理图片并提取特征
   * @param {string[]} imagePaths - 图片路径数组
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Array<{path: string, features: number[], metadata: Object}>>} - 处理结果
   */
  async batchProcessImages(imagePaths, progressCallback = null) {
    const results = [];

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];

      try {
        // 更新进度
        if (progressCallback) {
          progressCallback(i + 1, imagePaths.length, imagePath);
        }

        // 提取特征
        const features = await this.extractFeatures(imagePath);

        // 获取图片元数据
        const metadata = await this.getImageMetadata(imagePath);

        results.push({
          path: imagePath,
          features: features,
          metadata: metadata,
        });
      } catch (error) {
        console.error(`处理图片失败: ${imagePath}`, error);
        // 继续处理其他图片，不中断整个流程
      }
    }

    return results;
  }

  /**
   * 获取图片元数据
   * @param {string} imagePath - 图片路径
   * @returns {Promise<Object>} - 图片元数据
   */
  async getImageMetadata(imagePath) {
    try {
      const stats = await fs.stat(imagePath);

      return {
        path: imagePath,
        filename: path.basename(imagePath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      };
    } catch (error) {
      console.error(`获取图片元数据失败: ${imagePath}`, error);
      return {
        path: imagePath,
        filename: path.basename(imagePath),
        error: error.message,
      };
    }
  }

  /**
   * 递归扫描目录获取所有支持的图片文件
   * @param {string} directory - 目录路径
   * @returns {Promise<string[]>} - 图片文件路径数组
   */
  async scanDirectory(directory) {
    const imageFiles = [];

    try {
      const items = await fs.readdir(directory);

      for (const item of items) {
        const fullPath = path.join(directory, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          // 递归扫描子目录
          const subImages = await this.scanDirectory(fullPath);
          imageFiles.push(...subImages);
        } else if (stat.isFile() && this.isSupportedImage(fullPath)) {
          imageFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`扫描目录失败: ${directory}`, error);
    }

    return imageFiles;
  }
}

module.exports = ImageProcessor;
