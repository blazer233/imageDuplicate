const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const { OllamaEmbeddings } = require('@langchain/community/embeddings/ollama');

class ImageProcessor {
    constructor() {
        this.embeddings = new OllamaEmbeddings({
            model: 'llava',
            baseUrl: 'http://localhost:11434'
        });
        this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
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
     * 预处理图片（调整大小、格式转换等）
     * @param {string} imagePath - 原始图片路径
     * @returns {Promise<Buffer>} - 处理后的图片数据
     */
    async preprocessImage(imagePath) {
        try {
            const image = sharp(imagePath);
            const metadata = await image.metadata();
            
            // 如果图片太大，调整到合适的大小以提高处理效率
            let processedImage = image;
            if (metadata.width > 1024 || metadata.height > 1024) {
                processedImage = image.resize(1024, 1024, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            // 转换为RGB格式（LLaVA模型通常需要RGB格式）
            return await processedImage
                .toFormat('jpeg')
                .toBuffer();
        } catch (error) {
            console.error(`预处理图片失败: ${imagePath}`, error);
            throw error;
        }
    }

    /**
     * 从图片中提取特征向量
     * @param {string} imagePath - 图片路径
     * @returns {Promise<number[]>} - 特征向量
     */
    async extractFeatures(imagePath) {
        try {
            // 预处理图片
            const processedImageBuffer = await this.preprocessImage(imagePath);
            
            // 将图片转换为base64格式
            const base64Image = processedImageBuffer.toString('base64');
            
            // 使用LLaVA模型提取特征向量
            const embedding = await this.embeddings.embedQuery(base64Image);
            
            return embedding;
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
                    metadata: metadata
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
            const metadata = await sharp(imagePath).metadata();
            
            return {
                path: imagePath,
                filename: path.basename(imagePath),
                size: stats.size,
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                created: stats.birthtime,
                modified: stats.mtime
            };
        } catch (error) {
            console.error(`获取图片元数据失败: ${imagePath}`, error);
            return {
                path: imagePath,
                filename: path.basename(imagePath),
                error: error.message
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