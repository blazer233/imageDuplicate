const { FaissStore } = require('@langchain/community/vectorstores/faiss');
const fs = require('fs');
const path = require('path');

class VectorStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.vectorStore = null;
  }

  async initialize(embeddings, dimensions) {
    const indexPath = path.join(this.dbPath, 'faiss.index');
    try {
      await fs.promises.access(indexPath);
      this.vectorStore = await FaissStore.load(this.dbPath, embeddings);
      console.log('Vector database loaded successfully');
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('Database index not found, creating new vector database');
        await fs.promises.mkdir(this.dbPath, { recursive: true });
        // Pass dummy data to fromTexts to ensure the index is created with the correct dimensions
        this.vectorStore = await FaissStore.fromTexts(
          ['init'],
          [{}],
          embeddings,
          {
            dimensions: dimensions,
          }
        );
        console.log('New vector database created');
      } else {
        console.error('Failed to load database:', error.message);
        throw error;
      }
    }
  }

  async addVectors(imageVectors) {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    const vectors = imageVectors.map(iv => iv.vector);
    const metadatas = imageVectors.map(iv => ({ path: iv.path }));

    await this.vectorStore.addVectors(vectors, metadatas);
  }

  async findSimilar(queryVector, k, threshold) {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    const results = await this.vectorStore.similaritySearchVectorWithScore(
      queryVector,
      k
    );

    return results
      .filter(([_, score]) => score >= threshold)
      .map(([doc, score]) => ({
        path: doc.metadata.path,
        score: score, // score is already the similarity
      }));
  }

  async save() {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }
    await this.vectorStore.save(this.dbPath);
  }

  async deleteByPath(imagePath) {
    if (!this.vectorStore || !this.vectorStore.docstore) {
      return false;
    }

    const idsToDelete = [];
    for (const [id, doc] of this.vectorStore.docstore._map) {
      if (doc.metadata.path === imagePath) {
        idsToDelete.push(id);
      }
    }

    if (idsToDelete.length > 0) {
      await this.vectorStore.delete({ ids: idsToDelete });
      console.log(`Deleted ${idsToDelete.length} vector(s) for path: ${imagePath}`);
      return true;
    }

    return false;
  }

  async getAllImagePaths() {
    if (!this.vectorStore || !this.vectorStore.docstore) {
      return [];
    }

    const paths = [];
    for (const doc of this.vectorStore.docstore._map.values()) {
      paths.push(doc.metadata.path);
    }

    return paths;
  }

  async reset() {
    if (fs.existsSync(this.dbPath)) {
      await fs.promises.rm(this.dbPath, { recursive: true, force: true });
    }
    this.vectorStore = null;
  }
}

module.exports = VectorStore;