# 图片重复查找系统

这是一个基于大模型的图片重复查找系统，利用 LLaVA 模型提取图片特征向量，并使用 FAISS 向量数据库进行高效相似度搜索。项目提供了 Electron 桌面应用界面，方便用户进行操作。

## ✨ 功能特点

- **强大的特征提取**: 使用 LLaVA 多模态大模型提取图片的高维特征向量。
- **高效的相似度搜索**: 利用 FAISS 向量数据库存储和检索特征向量，实现快速查找。
- **直观的图形化界面**: 提供基于 Electron 的桌面应用，支持 Windows、macOS 和 Linux。
- **灵活的查找方式**:
    - **查找相似图片**: 上传一张图片，在指定目录中查找与之相似的图片。
    - **查找重复图片**: 在指定目录中查找所有重复的图片组。
- **可配置参数**: 支持自定义相似度阈值和最大返回结果数。
- **配置持久化**: 使用 `electron-store` 保存用户设置。

## 🖼️ 应用截图

*应用主界面截图*
![App Screenshot](https://via.placeholder.com/800x600.png?text=App+Screenshot+Here)

*(请替换为实际的应用截图)*

## 🛠️ 技术栈

- **核心框架**: [Electron](https://www.electronjs.org/)
- **AI 模型**: [LLaVA](https://llava-vl.github.io/) (通过 [Ollama](https://ollama.ai/) 部署)
- **向量数据库**: [FAISS](https://github.com/facebookresearch/faiss) (使用 `faiss-node`)
- **图像处理**: [Sharp](https://sharp.pixelplumbing.com/)
- **语言模型集成**: [LangChain.js](https://js.langchain.com/)

## 🚀 系统架构

系统主要由以下模块组成：

1.  **Electron 应用 (`src/electron`)**:
    -   `main.js`: 主进程，负责应用生命周期、窗口管理和与后端的 IPC 通信。
    -   `renderer.js`: 渲染进程，负责 UI 逻辑和用户交互。
    -   `preload.js`: 预加载脚本，安全地将主进程的 API 暴露给渲染进程。
    -   `index.html` / `styles.css`: 应用的界面和样式。
2.  **核心逻辑 (`src`)**:
    -   `imageDuplicateFinder.js`: 核心业务逻辑，整合图像处理和向量存储功能。
    -   `imageProcessor.js`: 负责图像的加载、预处理，并调用 LLaVA 模型提取特征向量。
    -   `vectorStore.js`: 封装了 FAISS 向量数据库的初始化、增、删、查等操作。
3.  **向量数据库 (`vector_db`)**:
    -   `faiss.index`: 存储 FAISS 索引文件。
    -   `docstore.json`: 存储与向量关联的元数据（如图片路径）。

## 📦 安装与启动

### 前提条件

- [Node.js](https://nodejs.org/) v14.0 或更高版本
- 本地已通过 [Ollama](https://ollama.ai/) 部署了 LLaVA 模型。

### 安装步骤

1.  克隆本项目到本地：
    ```bash
    git clone https://github.com/your-username/image-duplicate-finder.git
    cd image-duplicate-finder
    ```

2.  安装项目依赖：
    ```bash
    npm install
    ```

### 启动应用

使用以下命令启动 Electron 应用：

```bash
npm start
```

### 构建应用

如果你想为你的操作系统构建一个可执行的应用安装包，可以运行：

```bash
npm run build
```

构建成功后，安装包将位于 `dist` 目录下。

## 📖 使用方法

1.  **启动应用**: 运行 `npm start`。
2.  **设置 (首次使用)**:
    -   点击 "设置" 标签页。
    -   点击 "浏览..." 选择一个你存放图片的默认目录。
    -   可以根据需要调整默认的相似度阈值和返回结果数量。
    -   点击 "保存设置"。
3.  **查找相似图片**:
    -   切换到 "查找相似图片" 标签页。
    -   点击 "选择图片..." 按钮，选择一张本地图片。
    -   应用会自动在你设置的默认目录中查找相似图片。
    -   结果会以卡片形式展示出来。
4.  **查找重复图片**:
    -   (此功能在 `renderer.js` 中尚未完全实现，但后端逻辑已具备)
    -   切换到 "查找重复图片" 标签页。
    -   选择一个目录，点击 "查找重复图片"。
    -   应用会找出该目录中所有相似度超过阈值的图片组。

## 📝 注意事项

- **Ollama 服务**: 请确保本地的 Ollama 服务正在运行，并且 LLaVA 模型已经下载。默认连接地址是 `http://localhost:11434`。
- **特征提取**: 首次处理图片时，特征提取过程可能比较耗时，请耐心等待。提取后的特征向量会存入本地的 FAISS 数据库，后续查询会非常快。
- **相似度阈值**: 这是一个重要的参数，建议设置在 `0.7` 到 `0.9` 之间。值越高，匹配到的图片越相似。可以根据你的实际需求进行调整。

## 💡 未来改进

- [ ] 在 "查找重复图片" 标签页中完成前端 UI 和交互逻辑。
- [ ] 增加批量删除重复图片的功能。
- [ ] 优化索引过程，增加进度条显示。
- [ ] 支持更多的 AI 模型。
- [ ] 增加更详细的错误处理和提示。

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。
