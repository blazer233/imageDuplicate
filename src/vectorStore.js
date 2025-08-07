const fs = require('fs-extra');
const path = require('path');
const faiss = require('faiss-node');

class VectorStore {
  constructor(dbPath = './vector_db') {
    this.dbPath = dbPath;
    this.indexPath = path.join(dbPath, 'faiss.index');
    this.metadataPath = path.join(dbPath, 'metadata.json');
    this.index = null;
    this.metadata = [];
    this.dimension = 4096; // LLaVA模型的默认维度
    this.faissIndex = null;
  }

  async initialize() {
    try {
      await fs.ensureDir(this.dbPath);
      await this.loadIndex();
      await this.loadMetadata();
      await this.buildFaissIndex();
      console.log('向量数据库初始化完成');
    } catch (error) {
      console.error('初始化向量数据库失败:', error);
      throw error;
    }
  }

  async buildFaissIndex() {
    if (this.index && this.index.vectors.length > 0) {
      try {
        this.faissIndex = new faiss.IndexFlatL2(this.dimension);
        const vectors = this.index.vectors.map(v => Float32Array.from(v));
        this.faissIndex.add(vectors);
      } catch (e) {
        this.faissIndex = null;
        console.error('FAISS索引构建失败:', e);
      }
    } else {
      this.faissIndex = null;
    }
  }

  async loadIndex() {
    try {
      if (await fs.pathExists(this.indexPath)) {
        const data = await fs.readJson(this.indexPath);
        this.index = {
          vectors: data.vectors || [],
          loaded: true,
        };
      } else {
        this.index = {
          vectors: [],
          loaded: false,
        };
      }
    } catch (error) {
      this.index = {
        vectors: [],
        loaded: false,
      };
    }
  }

  async loadMetadata() {
    try {
      if (await fs.pathExists(this.metadataPath)) {
        const data = await fs.readJson(this.metadataPath);
        this.metadata = data;
        console.log(`加载了 ${this.metadata.length} 条元数据记录`);
      } else {
        this.metadata = [];
        console.log('创建新的元数据文件');
      }
    } catch (error) {
      console.error('加载元数据失败:', error);
      this.metadata = [];
    }
  }

  async saveIndex() {
    try {
      await fs.writeFile(
        this.indexPath,
        JSON.stringify({
          vectors: this.index.vectors,
          dimension: this.dimension,
        })
      );
    } catch (error) {
      console.error('保存索引失败:', error);
      throw error;
    }
  }

  async saveMetadata() {
    try {
      await fs.writeJson(this.metadataPath, this.metadata, { spaces: 2 });
      console.log(`保存了 ${this.metadata.length} 条元数据记录`);
    } catch (error) {
      console.error('保存元数据失败:', error);
      throw error;
    }
  }

  async addVector(vector, metadata) {
    try {
      this.index.vectors.push(vector);
      const metadataEntry = {
        id: this.metadata.length,
        path: metadata.path,
        filename: metadata.filename,
        size: metadata.size,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        created: metadata.created,
        modified: metadata.modified,
        addedAt: new Date().toISOString(),
      };
      this.metadata.push(metadataEntry);
      console.log(`添加向量: ${metadata.filename}`);
    } catch (error) {
      console.error('添加向量失败:', error);
      throw error;
    }
  }

  async addVectors(vectors) {
    try {
      console.log(`开始批量添加 ${vectors.length} 个向量`);
      for (const { vector, metadata } of vectors) {
        await this.addVector(vector, metadata);
      }
      await this.saveIndex();
      await this.saveMetadata();
      await this.buildFaissIndex();
      console.log(`成功添加 ${vectors.length} 个向量`);
    } catch (error) {
      console.error('批量添加向量失败:', error);
      throw error;
    }
  }

  async searchSimilar(queryVector, k = 10, threshold = 0.8) {
    try {
      if (!this.faissIndex || !this.index.vectors.length) {
        return [];
      }
      const query = Float32Array.from(queryVector);
      const { distances, labels } = this.faissIndex.search(
        [query],
        Math.max(k, this.index.vectors.length)
      );
      const results = [];
      for (let i = 0; i < labels[0].length; i++) {
        const idx = labels[0][i];
        if (idx < 0) continue;
        const distance = distances[0][i];
        const similarity = 1 / (1 + distance);
        if (similarity >= threshold) {
          results.push({
            id: idx,
            distance,
            similarity,
            metadata: this.metadata[idx],
          });
        }
      }
      // 按相似度排序
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, k);
    } catch (error) {
      console.error('FAISS搜索相似向量失败:', error);
      throw error;
    }
  }

  async clear() {
    try {
      this.index.vectors = [];
      this.metadata = [];
      this.faissIndex = null;
      if (await fs.pathExists(this.indexPath)) {
        await fs.remove(this.indexPath);
      }
      if (await fs.pathExists(this.metadataPath)) {
        await fs.remove(this.metadataPath);
      }
      console.log('数据库已清空');
    } catch (error) {
      console.error('清空数据库失败:', error);
      throw error;
    }
  }

  isEmpty() {
    return this.index.vectors.length === 0;
  }

  getStats() {
    return {
      totalVectors: this.index.vectors.length,
      totalMetadata: this.metadata.length,
      dimension: this.dimension,
      dbPath: this.dbPath,
    };
  }
}

module.exports = VectorStore;
