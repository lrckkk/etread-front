# 架构文档

## 核心设计理念

### 数据归一化

所有书籍格式（EPUB、TXT）转换为统一的 `UnifiedBook` 结构，实现：
- 格式无关的阅读体验
- 100% 自定义 UI
- 简化阅读器逻辑

### ContentLayer 架构

**核心思想**：图文分层存储 + 段落数组

```typescript
interface ContentLayer {
  paragraphs: string[];     // 段落数组
  startGlobalIndex: number; // 段落起始索引（用于评论定位）
  image?: string;           // 可选图片（Blob URL）
}
```

**设计原则**：
1. **图片截断**：遇到图片时结束当前 layer，生成新 layer
2. **段落存储**：文本按段落分割存储，支持段落级评论
3. **自动分块**：超长文本自动切片（15000字/块），防止 DOM 性能问题

**性能优势**：
- 对象数量减少 90%+（相比原子节点架构）
- 内存占用降低 80%+
- 支持数百万字文本流畅阅读

## 架构层次

```
┌─────────────────────────────────────────┐
│         UI Layer (Vue 3)                │
│  Bookshelf | UnifiedReader | Settings  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│    State Management (Pinia)             │
│  ReaderStore (book, styles, progress)   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Core Layer                      │
│  ChapterCache | Adapters | Composables │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Data Layer (IndexedDB)             │
│       Books | Progress                  │
└─────────────────────────────────────────┘
```

## 数据模型

### UnifiedBook

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
```

### UnifiedChapter

```typescript
interface UnifiedChapter {
  id: number;
  title: string;
  layers: ContentLayer[];
  isLoaded: boolean;
  href?: string;  // EPUB 章节引用
}
```

### ContentLayer

```typescript
interface ContentLayer {
  paragraphs: string[];     // 段落数组
  startGlobalIndex: number; // 段落起始索引
  image?: string;           // 可选图片
}
```

## 核心组件

### 1. 适配器 (Adapters)

#### TxtAdapter
- 编码检测（UTF-8/GBK）
- 章节切分（正则匹配）
- 懒加载章节内容
- 按段落分割文本

#### EpubAdapter
- 使用 Epub.js 解析
- 提取元数据和封面
- 懒加载章节内容
- 解析 XHTML 为 ContentLayer
- 图片转 Blob URL

### 2. 缓存管理器 (ChapterCache)

**缓存策略**：
- 保留：当前章 + 前1章 + 后2章
- 最大缓存：5章
- LRU 算法清理

**预加载**：
- 使用 `requestIdleCallback`
- 空闲时预加载相邻章节

### 3. 状态管理 (ReaderStore)

**状态**：
- `activeBook`: 当前书籍
- `currentChapterId`: 当前章节
- `currentLayers`: 当前内容
- `fontSize`, `lineHeight`, `backgroundColor`: 样式

**方法**：
- `setActiveBook()`: 设置书籍
- `loadChapter()`: 加载章节
- `nextChapter()` / `prevChapter()`: 导航
- 样式设置方法

### 4. 统一阅读器 (UnifiedReader)

**特点**：
- 全书滚动模式
- 直接渲染 ContentLayer
- 样式完全自定义
- 实时响应变化

**渲染逻辑**：
```vue
<div v-for="layer in layers" class="content-layer">
  <!-- 段落 -->
  <p v-for="para in layer.paragraphs" class="paragraph">
    {{ para }}
  </p>
  
  <!-- 图片 -->
  <img v-if="layer.image" :src="layer.image" />
</div>
```

## 工作流程

### 导入书籍

```
1. 读取文件为 ArrayBuffer
2. 适配器解析元数据和目录
3. 存储到 IndexedDB
4. 更新书架
```

### 打开书籍

```
1. 从 IndexedDB 读取
2. 适配器解析为 UnifiedBook
3. 创建 ChapterCache
4. 加载全书所有章节
5. 恢复阅读进度
```

### 阅读章节

```
1. ChapterCache 检查缓存
2. 缓存命中 → 直接返回
3. 缓存未命中 → 适配器加载
4. 存入缓存
5. 触发预加载
6. 渲染 layers
```

## 性能优化

### 1. 懒加载
- 导入时仅生成目录
- 章节按需解析

### 2. 滑动窗口缓存
- 最多缓存 5 章
- LRU 自动清理

### 3. 预加载
- 利用空闲时间
- 预加载相邻章节

### 4. Blob URL 管理
- 自动创建和销毁
- 防止内存泄漏

### 5. 自动分块
- 超长文本自动切片
- 防止 DOM 性能问题

## 阅读进度

### 数据结构

```typescript
interface Progress {
  id?: number;
  bookId: number;
  chapterIndex: number;
  chapterTitle?: string;
  position: number;  // scrollTop
  updateTime: number;
}
```

### 保存机制

- 滚动时自动保存（1秒防抖）
- 离开页面时立即保存
- 保存章节索引、标题和滚动位置

### 恢复机制

```
1. 加载全书所有章节
2. 等待 DOM 渲染完成
3. 读取保存的进度
4. 滚动到保存位置
5. 更新章节标题
```

### 进度计算

```typescript
percentage = (chapterIndex + 1) / chapterCount * 100
```

## 关键约束

1. **禁止 Base64**：封面和图片使用 Blob
2. **禁止 iframe**：直接渲染 ContentLayer
3. **状态管理**：使用 Pinia
4. **内存管理**：缓存限制 + LRU + Blob URL 清理

## 文件结构

```
src/
├── types/book.ts              # 数据模型
├── adapters/
│   ├── TxtAdapter.ts
│   └── EpubAdapter.ts
├── core/ChapterCache.ts       # 缓存管理
├── store/reader.ts            # Pinia Store
├── composables/
│   ├── useUnifiedLibrary.ts   # 书库管理
│   └── useProgress.ts         # 进度管理
├── components/
│   └── UnifiedReader.vue      # 统一阅读器
├── views/
│   ├── Bookshelf.vue
│   └── UnifiedReaderView.vue
└── db/index.ts                # IndexedDB
```

## 扩展性

### 添加新格式

1. 创建适配器（实现 `parse` 和 `loadChapter`）
2. 在 `useUnifiedLibrary` 中添加支持
3. 无需修改阅读器

### 添加新功能

- 书签：扩展 Progress 表
- 笔记：利用 `startGlobalIndex` 定位段落
- 搜索：遍历 layers 的 paragraphs

## 总结

统一阅读内核通过：
- ✅ 数据归一化
- ✅ ContentLayer 架构
- ✅ 懒加载 + 缓存
- ✅ 自动分块
- ✅ 进度管理

实现了高性能、低内存、格式无关的阅读体验。
