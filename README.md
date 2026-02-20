# 本地阅读模块

一个基于 Vue 3 + TypeScript 构建的纯前端电子书阅读应用，支持 EPUB 和 TXT 格式，所有数据完全存储在浏览器本地。

## 核心特性

- 📚 **多格式支持**：EPUB 和 TXT 格式
- 💾 **本地存储**：IndexedDB 存储，完全离线可用
- 📖 **全书滚动**：一次加载全书，流畅滚动阅读
- 📍 **进度追踪**：自动保存和恢复阅读位置
- 🎨 **现代界面**：精美书架，沉浸式阅读体验
- ⚡ **高性能**：ContentLayer 架构，内存占用低

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 运行测试
npm run test
```

## 项目结构

```
src/
├── adapters/          # 格式适配器（EPUB/TXT → UnifiedBook）
├── components/        # UnifiedReader 统一阅读器
├── composables/       # 业务逻辑（书库、进度管理）
├── core/             # ChapterCache 缓存管理
├── db/               # IndexedDB 数据库
├── store/            # Pinia 状态管理
├── types/            # TypeScript 类型定义
└── views/            # 页面视图（书架、阅读器）
```

## 核心架构

### 统一数据模型

所有格式转换为统一的 `UnifiedBook` 结构：

```typescript
interface UnifiedBook {
  id?: number;
  title: string;
  author: string;
  cover: Blob | null;
  format: 'epub' | 'txt';
  chapters: UnifiedChapter[];
  rawData: ArrayBuffer;
  addTime: number;
}

interface UnifiedChapter {
  id: number;
  title: string;
  layers: ContentLayer[];  // 图文分层
  isLoaded: boolean;
}

interface ContentLayer {
  paragraphs: string[];     // 段落数组
  startGlobalIndex: number; // 段落起始索引
  image?: string;           // 可选图片
}
```

### ContentLayer 架构

**核心设计**：图文分层存储，大幅减少对象数量

- **图片截断**：遇到图片时生成新 layer
- **段落数组**：文本按段落存储，支持段落级评论
- **自动分块**：超长文本自动切片（15000字/块）

**性能优势**：
- 对象数量减少 90%+
- 内存占用降低 80%+
- 支持数百万字文本流畅阅读

### 阅读进度存储

使用 IndexedDB 存储进度：

```typescript
interface Progress {
  id?: number;
  bookId: number;
  chapterIndex: number;     // 当前章节索引
  chapterTitle?: string;    // 章节标题
  position: number;         // 滚动位置（scrollTop）
  updateTime: number;
}
```

**进度功能**：
- 滚动时自动保存（1秒防抖）
- 打开书籍自动恢复位置
- 书架显示进度百分比和章节标题

## 技术栈

- **Vue 3** + **TypeScript** + **Vite**
- **Element Plus** - UI 组件库
- **Pinia** - 状态管理
- **Dexie.js** - IndexedDB 封装
- **Epub.js** - EPUB 解析
- **Vitest** - 单元测试

## 使用指南

### 导入书籍

1. 拖拽 .epub 或 .txt 文件到导入区域
2. 或点击"选择文件"按钮选择文件
3. 等待导入完成

### 阅读书籍

1. 点击书籍封面打开
2. 全书加载完成后自动跳转到上次位置
3. 滚动阅读，进度自动保存
4. 点击目录按钮查看章节列表

### 调整设置

- **背景色**：白色/护眼/夜间
- **字体大小**：12-32px
- **行高**：1.0-3.0

## 数据存储

### IndexedDB 表结构

**books 表**：
- 书籍元数据（标题、作者、格式）
- 封面（Blob）
- 原始数据（ArrayBuffer）
- 章节数量（chapterCount）

**progress 表**：
- 书籍 ID
- 章节索引和标题
- 滚动位置
- 更新时间

### 存储容量

- Chrome：可用磁盘空间的 60%
- Firefox：可用磁盘空间的 50%
- Safari：约 1GB

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ 移动端浏览器

## 常见问题

**Q: 清除浏览器数据会删除书籍吗？**
A: 是的，建议定期备份重要书籍。

**Q: 支持跨设备同步吗？**
A: 当前版本不支持，数据仅存储在本地浏览器。

**Q: 可以导入多大的文件？**
A: 理论上无限制，建议单个文件不超过 100MB。

**Q: 进度如何保存？**
A: 滚动时自动保存，打开时自动恢复。

## 开发指南

详见 `DEVELOPMENT.md`

## 架构文档

详见 `ARCHITECTURE.md`

## 更新日志

### v2.0 (当前版本)
- ✨ 统一阅读内核架构
- ✨ ContentLayer 图文分层
- ✨ 全书滚动模式
- ✨ 阅读进度自动保存和恢复
- ✨ 现代化书架界面
- ⚡ 性能大幅提升

### v0.1.0
- 🎉 初始版本

## 许可证

MIT License

---

**享受阅读的乐趣！📚✨**
