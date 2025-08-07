/**
 * 图像处理模块
 * 负责图像的加载、预处理和特征提取
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Ollama } = require('ollama');

class ImageProcessor {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llava:latest';
    this.ollama = new Ollama({
      baseUrl: this.baseUrl,
      model: this.model,
    });
  }

  /**
   * 读取图像文件
   * @param {string} imagePath - 图像文件路径
   * @returns {Promise<Buffer>} - 图像数据
   */
  async readImage(imagePath) {
    try {
      return await fs.promises.readFile(imagePath);
    } catch (error) {
      console.error(`读取图像失败: ${imagePath}`, error);
      throw error;
    }
  }

  /**
   * 预处理图像（调整大小、标准化等）
   * @param {Buffer} imageBuffer - 图像数据
   * @returns {Promise<Buffer>} - 处理后的图像数据
   */
  async preprocessImage(imageBuffer) {
    try {
      // 调整图像大小为标准尺寸，保持宽高比
      return await sharp(imageBuffer)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();
    } catch (error) {
      console.error('图像预处理失败', error);
      throw error;
    }
  }

  /**
   * 提取图像特征向量
   * @param {Buffer} imageBuffer - 图像数据
   * @returns {Promise<number[]>} - 特征向量
   */
  async extractFeatures(imageBuffer) {
    try {
      // 将图像转换为base64格式
      const base64Image = imageBuffer.toString('base64');

      console.log('正在调用LLaVA模型提取特征...');
      const response = await this.ollama.embeddings({
        model: this.model,
        prompt: ' ',
        image: base64Image,
      });

      if (!response || !response.embedding) {
        throw new Error('LLaVA模型返回无效的嵌入向量');
      }

      return response.embedding;
    } catch (error) {
      console.error('特征提取失败', error);
      throw error;
    }
  }

  /**
   * 处理单个图像并返回其特征向量
   * @param {string} imagePath - 图像文件路径
   * @returns {Promise<{path: string, vector: number[]}>} - 图像路径和特征向量
   */
  async processImage(imagePath) {
    const imageBuffer = await this.readImage(imagePath);
    const processedImage = await this.preprocessImage(imageBuffer);
    const vector = await this.extractFeatures(processedImage);

    return {
      path: imagePath,
      vector: vector,
    };
  }

  /**
   * 批量处理图像目录
   * @param {string} directoryPath - 图像目录路径
   * @param {Array<string>} supportedExtensions - 支持的图像扩展名
   * @returns {Promise<Array<{path: string, vector: number[]}>>} - 图像路径和特征向量数组
   */
  async processDirectory(
    directoryPath,
    supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  ) {
    try {
      const files = await fs.promises.readdir(directoryPath);
      const imagePaths = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return supportedExtensions.includes(ext);
        })
        .map(file => path.join(directoryPath, file));

      console.log(`找到 ${imagePaths.length} 个图像文件进行处理`);

      const results = [];
      for (const imagePath of imagePaths) {
        try {
          console.log(`处理图像: ${imagePath}`);
          const result = await this.processImage(imagePath);
          results.push(result);
        } catch (error) {
          console.error(`处理图像失败: ${imagePath}`, error);
          // 继续处理下一个图像
        }
      }

      return results;
    } catch (error) {
      console.error(`处理目录失败: ${directoryPath}`, error);
      throw error;
    }
  }
}

module.exports = ImageProcessor;
