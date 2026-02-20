# 开发指南

## 环境要求

- Node.js 20.19.0+ 或 22.12.0+
- npm 或 yarn

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview

# 运行测试
npm run test

# 测试覆盖率
npm run test:coverage
```

## 代码规范

### TypeScript

- 使用严格模式
- 为所有函数添加类型注解
- 使用接口定义数据结构

### Vue 3

- 使用 `<script setup>` 语法
- 使用 Composition API
- 遵循 Vue 3 风格指南

### 注释

- 为复杂逻辑添加注释
- 使用 JSDoc 注释函数

## 项目结构

```
src/
├── adapters/          # 格式适配器
│   ├── TxtAdapter.ts
│   └── EpubAdapter.ts
├── components/        # 可复用组件
│   └── UnifiedReader.vue
├── composables/       # 业务逻辑
│   ├── useUnifiedLibrary.ts
│   └── useProgress.ts
├── core/             # 核心模块
│   └── ChapterCache.ts
├── db/               # 数据库
│   └── index.ts
├── store/            # 状态管理
│   └── reader.ts
├── types/            # 类型定义
│   └── book.ts
├── views/            # 页面视图
│   ├── Bookshelf.vue
│   └── UnifiedReaderView.vue
├── router/           # 路由
│   └── index.ts
├── assets/           # 静态资源
├── App.vue           # 根组件
└── main.js           # 入口文件
```

## 核心概念

### 1. 适配器模式

所有格式通过适配器转换为 `UnifiedBook`：

```typescript
export class TxtAdapter {
  static async parse(
    arrayBuffer: ArrayBuffer,
    filename: string
  ): Promise<UnifiedBook> {
    // 解析 TXT 为 UnifiedBook
  }
  
  static async loadChapter(
    book: UnifiedBook,
    chapterId: number
  ): Promise<ContentLayer[]> {
    // 加载章节内容
  }
}
```

### 2. ContentLayer 架构

图文分层存储：

```typescript
interface ContentLayer {
  paragraphs: string[];     // 段落数组
  startGlobalIndex: number; // 段落索引
  image?: string;           // 可选图片
}
```

### 3. 缓存管理

滑动窗口缓存 + LRU：

```typescript
class ChapterCache {
  private cache: Map<number, ContentLayer[]>;
  private maxSize = 5;
  
  async getChapter(id: number): Promise<ContentLayer[]> {
    // 检查缓存 → 加载 → 预加载
  }
}
```

### 4. 状态管理

使用 Pinia：

```typescript
export const useReaderStore = defineStore('reader', () => {
  const activeBook = ref<UnifiedBook | null>(null);
  const currentLayers = ref<ContentLayer[]>([]);
  
  function setActiveBook(book: UnifiedBook) {
    // ...
  }
  
  return { activeBook, currentLayers, setActiveBook };
});
```

## 添加新功能

### 添加新格式支持

1. **创建适配器**：

```typescript
// src/adapters/PdfAdapter.ts
export class PdfAdapter {
  static async parse(
    arrayBuffer: ArrayBuffer,
    filename: string
  ): Promise<UnifiedBook> {
    // 解析 PDF
  }
  
  static async loadChapter(
    book: UnifiedBook,
    chapterId: number
  ): Promise<ContentLayer[]> {
    // 加载章节
  }
}
```

2. **注册适配器**：

```typescript
// src/composables/useUnifiedLibrary.ts
if (file.name.endsWith('.pdf')) {
  unifiedBook = await PdfAdapter.parse(arrayBuffer, file.name);
}
```

### 添加书签功能

1. **扩展数据模型**：

```typescript
// src/db/index.ts
export interface Bookmark {
  id?: number;
  bookId: number;
  chapterId: number;
  paragraphIndex: number;  // 利用 startGlobalIndex
  note?: string;
  createTime: number;
}
```

2. **添加数据库表**：

```typescript
this.version(4).stores({
  books: '++id, title, format, addTime, chapterCount',
  progress: '++id, bookId, updateTime',
  bookmarks: '++id, bookId, chapterId, createTime'
});
```

3. **创建 Composable**：

```typescript
// src/composables/useBookmarks.ts
export function useBookmarks() {
  async function addBookmark(bookmark: Bookmark) {
    await db.bookmarks.add(bookmark);
  }
  
  async function getBookmarks(bookId: number) {
    return await db.bookmarks
      .where('bookId')
      .equals(bookId)
      .toArray();
  }
  
  return { addBookmark, getBookmarks };
}
```

### 添加笔记功能

利用 `startGlobalIndex` 定位段落：

```typescript
interface Note {
  id?: number;
  bookId: number;
  chapterId: number;
  paragraphIndex: number;  // 全局段落索引
  content: string;
  createTime: number;
}

// 定位笔记
function locateNote(note: Note, layers: ContentLayer[]) {
  for (const layer of layers) {
    const start = layer.startGlobalIndex;
    const end = start + layer.paragraphs.length;
    
    if (note.paragraphIndex >= start && note.paragraphIndex < end) {
      const localIndex = note.paragraphIndex - start;
      return layer.paragraphs[localIndex];
    }
  }
}
```

## 调试技巧

### 1. 查看数据库

```javascript
// 浏览器控制台
const { db } = await import('./src/db/index.ts');

// 查看所有书籍
const books = await db.books.toArray();
console.table(books);

// 查看进度
const progress = await db.progress.toArray();
console.table(progress);
```

### 2. 查看缓存状态

```javascript
// 在阅读器中
const readerStore = useReaderStore();
const stats = readerStore.getCacheStats();
console.log('缓存统计:', stats);
```

### 3. 调试进度恢复

查看控制台日志：
- `[UnifiedReader] 开始加载全书`
- `[UnifiedReader] 找到保存的进度`
- `[UnifiedReader] ✅ 进度恢复成功`

### 4. 性能分析

```javascript
// 使用 Performance API
performance.mark('start-load');
await loadAllChapters();
performance.mark('end-load');
performance.measure('load-time', 'start-load', 'end-load');
```

## 测试

### 单元测试

```typescript
// src/adapters/TxtAdapter.test.ts
import { describe, it, expect } from 'vitest';
import { TxtAdapter } from './TxtAdapter';

describe('TxtAdapter', () => {
  it('should parse TXT file', async () => {
    const buffer = new TextEncoder().encode('第一章\n内容');
    const book = await TxtAdapter.parse(buffer, 'test.txt');
    
    expect(book.title).toBe('test');
    expect(book.chapters.length).toBeGreaterThan(0);
  });
});
```

### 集成测试

```typescript
// src/db/index.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';

describe('Database', () => {
  beforeEach(async () => {
    await db.books.clear();
  });
  
  it('should add and retrieve book', async () => {
    const bookId = await db.books.add({
      title: 'Test',
      author: 'Author',
      format: 'txt',
      cover: null,
      data: new ArrayBuffer(0),
      addTime: Date.now()
    });
    
    const book = await db.books.get(bookId);
    expect(book?.title).toBe('Test');
  });
});
```

## 性能优化

### 1. 减少重渲染

```vue
<script setup>
// 使用 computed 缓存计算结果
const visibleLayers = computed(() => {
  return allLayers.value.slice(startIndex, endIndex);
});
</script>
```

### 2. 懒加载图片

```vue
<img 
  v-if="layer.image" 
  :src="layer.image" 
  loading="lazy"
/>
```

### 3. 虚拟滚动（未来）

对于超长章节，可以实现虚拟滚动：

```typescript
const visibleLayers = computed(() => {
  const start = Math.floor(scrollTop / LAYER_HEIGHT);
  const end = start + VISIBLE_COUNT;
  return layers.slice(start, end);
});
```

## 常见问题

### Q: 如何清空数据库？

```javascript
const { db } = await import('./src/db/index.ts');
await db.delete();
location.reload();
```

### Q: 如何手动更新章节数？

```javascript
const { db } = await import('./src/db/index.ts');
const { EpubAdapter } = await import('./src/adapters/EpubAdapter.ts');

const book = await db.books.get(1);
const unifiedBook = await EpubAdapter.parse(book.data, book.title);
await db.books.update(1, { 
  chapterCount: unifiedBook.chapters.length 
});
```

### Q: 如何调试进度不恢复？

1. 检查控制台日志
2. 查看 progress 表是否有记录
3. 确认 chapterCount 是否正确
4. 检查 scrollTop 值是否合理

## 部署

### 构建

```bash
npm run build
```

### 部署到静态服务器

```bash
# 将 dist 目录部署到任何静态服务器
# 例如：Nginx, Apache, GitHub Pages, Vercel, Netlify
```

### 配置

确保服务器支持：
- SPA 路由（所有路径返回 index.html）
- HTTPS（IndexedDB 需要）
- 正确的 MIME 类型

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交代码
4. 推送到分支
5. 创建 Pull Request

## 资源

- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [Dexie.js 文档](https://dexie.org/)
- [Epub.js 文档](https://github.com/futurepress/epub.js/)

## 许可证

MIT License
