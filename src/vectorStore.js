const fs = require('fs');
const path = require('path');
const { Index, MetricType } = require('faiss-node');

// --- 核心配置 ---
const INDEX_FILE = 'faiss.index'; // Faiss索引文件名
const METADATA_FILE = 'metadata.json'; // 元数据文件名

class VectorStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.indexPath = path.join(this.dbPath, INDEX_FILE);
    this.metadataPath = path.join(this.dbPath, METADATA_FILE);
    this.index = null;
    this.metadata = []; // 存储 { id, path } 的数组
    this.isInitialized = false;
  }

  /**
   * 初始化或加载数据库
   * @param {number} dimensions - 向量维度
   */
  async initialize(dimensions) {
    if (this.isInitialized) return;

    this.dimensions = dimensions; // Store the dimension

    try {
      // 确保数据库目录存在
      await fs.promises.mkdir(this.dbPath, { recursive: true });

      // 尝试加载现有索引和元数据
      await this._load();
      console.log(`成功加载现有索引，包含 ${this.index.ntotal()} 个向量。`);

    } catch (error) {
      // 如果加载失败，则创建一个新的索引
      console.log('未找到现有索引，将创建一个新的索引。');
      this.index = new Index(this.dimensions, MetricType.METRIC_L2); // Use stored dimension
      this.metadata = [];
      // 对于新的空索引，不需要立即保存，等待有数据添加后再保存
    }
    
    this.isInitialized = true;
  }

  /**
   * 内部加载方法
   */
  async _load() {
    // 加载Faiss索引
    const indexData = await fs.promises.readFile(this.indexPath);
    this.index = Index.read(indexData);

    // 加载元数据
    const metadataJson = await fs.promises.readFile(this.metadataPath, 'utf-8');
    this.metadata = JSON.parse(metadataJson);

    if (!this.index || !this.metadata) {
      throw new Error('索引或元数据加载不完整。');
    }
  }

  /**
   * 添加向量和元数据
   * @param {Array<{path: string, vector: number[]}>} imageVectors - 图像向量数组
   */
  async addVectors(imageVectors) {
    if (!this.isInitialized) throw new Error('向量存储未初始化');

    const vectors = imageVectors.map(iv => iv.vector);
    const paths = imageVectors.map(iv => iv.path);

    if (vectors.length === 0) return;

    // 调试日志：检查每个向量的维度
    for (let i = 0; i < vectors.length; i++) {
      if (!Array.isArray(vectors[i])) {
        console.error(`[DEBUG] vectorStore.js: vectors[${i}] is not an array. Type: ${typeof vectors[i]}`);
        throw new Error("Vector is not an array.");
      }
      if (vectors[i].length !== this.dimensions) {
        console.error(`[DEBUG] vectorStore.js: Vector at index ${i} has incorrect dimension. Expected ${this.dimensions}, got ${vectors[i].length}`);
        throw new Error("Incorrect vector dimension.");
      }
    }
    console.log(`[DEBUG] vectorStore.js: All ${vectors.length} vectors have correct dimension ${this.dimensions}.`);

    // 1. 将二维数组压平为一维的 Float32Array
    const flatVectors = new Float32Array(vectors.flat());

    // 2. 将压平后的向量添加到Faiss索引
    this.index.add(flatVectors);

    // 为新向量创建元数据
    const newMetadata = paths.map((path, i) => {
      // id 对应于向量在 Faiss 索引中的位置
      const id = this.index.ntotal() - vectors.length + i;
      return { id, path };
    });

    this.metadata.push(...newMetadata);
    console.log(`成功添加 ${vectors.length} 个新向量。`);
  }

  /**
   * 查找相似向量
   * @param {number[]} queryVector - 查询向量
   * @param {number} k - 返回结果数量
   * @returns {Promise<Array<{path: string, score: number}>>}
   */
  async findSimilar(queryVector, k) {
    if (!this.isInitialized || this.index.ntotal() === 0) {
      console.log('索引为空或未初始化，无法查找。');
      return [];
    }

    // 在Faiss中执行搜索
    const { labels, distances } = this.index.search(queryVector, k);

    // 构建结果
    const results = [];
    for (let i = 0; i < labels.length; i++) {
      const id = labels[i];
      const distance = distances[i];

      // 根据id查找元数据
      const meta = this.metadata.find(m => m.id === id);

      if (meta) {
        results.push({
          path: meta.path,
          score: 1 - distance, // 将L2距离转换为相似度分数
        });
      }
    }

    return results;
  }

  /**
   * 保存索引和元数据到文件
   */
  async save() {
    if (!this.isInitialized) throw new Error('向量存储未初始化');

    // 写入Faiss索引
    const indexData = this.index.write();
    await fs.promises.writeFile(this.indexPath, indexData);

    // 写入元数据
    await fs.promises.writeFile(this.metadataPath, JSON.stringify(this.metadata, null, 2));

    console.log(`索引已成功保存到 ${this.dbPath}`);
  }

  /**
   * 根据路径删除向量
   * @param {string} imagePath - 图像文件路径
   * @returns {Promise<boolean>}
   */
  async deleteByPath(imagePath) {
    if (!this.isInitialized) return false;

    const idsToDelete = this.metadata
      .filter(m => m.path === imagePath)
      .map(m => m.id);

    if (idsToDelete.length > 0) {
      // 从Faiss索引中删除
      this.index.removeIds(idsToDelete);

      // 从元数据中删除
      this.metadata = this.metadata.filter(m => !idsToDelete.includes(m.id));
      
      console.log(`成功删除与路径 ${imagePath} 相关的 ${idsToDelete.length} 个向量。`);
      return true;
    }

    return false;
  }

  /**
   * 获取所有已索引的图片路径
   * @returns {Promise<string[]>}
   */
  async getAllImagePaths() {
    if (!this.isInitialized) return [];
    return this.metadata.map(m => m.path);
  }

  /**
   * 重置数据库
   */
  async reset() {
    if (fs.existsSync(this.dbPath)) {
      await fs.promises.rm(this.dbPath, { recursive: true, force: true });
      console.log(`数据库目录 ${this.dbPath} 已被清除。`);
    }
    // 清理内存状态
    this.index = null;
    this.metadata = [];
    this.isInitialized = false;
    // 重新创建目录，为下一次初始化做准备
    await fs.promises.mkdir(this.dbPath, { recursive: true });
  }
}

module.exports = VectorStore;
