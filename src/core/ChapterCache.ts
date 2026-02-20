/**
 * 滑动窗口章节缓存管理器
 * 实现 LRU (最近最少使用) 算法
 * 在内存中仅保留：当前章 + 前1章 + 后2章
 */

import type { UnifiedBook, ContentLayer } from '@/types/book';
import { TxtAdapter } from '@/adapters/TxtAdapter';
import { EpubAdapter } from '@/adapters/EpubAdapter';

interface CacheEntry {
  chapterId: number;
  layers: ContentLayer[];
  lastAccess: number;
}

export class ChapterCache {
  private cache: Map<number, CacheEntry> = new Map();
  private readonly MAX_CACHE_SIZE = 5; // 最多缓存5章
  private book: UnifiedBook;
  private prefetchQueue: Set<number> = new Set();

  constructor(book: UnifiedBook) {
    this.book = book;
  }

  /**
   * 获取章节内容（带缓存）
   */
  async getChapter(chapterId: number): Promise<ContentLayer[]> {
    console.log('[ChapterCache] 请求章节:', chapterId);

    // 检查缓存
    if (this.cache.has(chapterId)) {
      const entry = this.cache.get(chapterId)!;
      entry.lastAccess = Date.now();
      console.log('[ChapterCache] 命中缓存');
      return entry.layers;
    }

    // 缓存未命中，加载章节
    const layers = await this.loadChapter(chapterId);

    // 存入缓存
    this.cache.set(chapterId, {
      chapterId,
      layers,
      lastAccess: Date.now()
    });

    // 更新书籍对象
    this.book.chapters[chapterId].layers = layers;
    this.book.chapters[chapterId].isLoaded = true;

    // 清理缓存
    this.evictIfNeeded();

    // 触发预加载
    this.schedulePrefetch(chapterId);

    return layers;
  }

  /**
   * 加载章节内容
   */
  private async loadChapter(chapterId: number): Promise<ContentLayer[]> {
    console.log('[ChapterCache] 加载章节:', chapterId);

    if (this.book.format === 'txt') {
      return await TxtAdapter.loadChapter(this.book, chapterId);
    } else {
      return await EpubAdapter.loadChapter(this.book, chapterId);
    }
  }

  /**
   * LRU 缓存清理
   * 当缓存超过限制时，清理最久未访问的章节
   */
  private evictIfNeeded(): void {
    if (this.cache.size <= this.MAX_CACHE_SIZE) {
      return;
    }

    console.log('[ChapterCache] 缓存已满，执行 LRU 清理');

    // 找到最久未访问的章节
    let oldestChapterId: number | null = null;
    let oldestTime = Infinity;

    for (const [chapterId, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestChapterId = chapterId;
      }
    }

    if (oldestChapterId !== null) {
      console.log('[ChapterCache] 清理章节:', oldestChapterId);
      this.cache.delete(oldestChapterId);

      // 清理书籍对象中的数据
      const chapter = this.book.chapters[oldestChapterId];
      if (chapter) {
        chapter.layers = [];
        chapter.isLoaded = false;
      }

      // 清理图片 Blob URL
      this.cleanupBlobUrls(oldestChapterId);
    }
  }

  /**
   * 清理章节中的 Blob URL
   */
  private cleanupBlobUrls(chapterId: number): void {
    const chapter = this.book.chapters[chapterId];
    if (!chapter) return;

    for (const layer of chapter.layers) {
      if (layer.image && layer.image.startsWith('blob:')) {
        URL.revokeObjectURL(layer.image);
      }
    }
  }

  /**
   * 调度预加载
   * 预加载：当前章 + 前1章 + 后2章
   */
  private schedulePrefetch(currentChapterId: number): void {
    const prefetchIds: number[] = [];

    // 前1章
    if (currentChapterId > 0) {
      prefetchIds.push(currentChapterId - 1);
    }

    // 后2章
    for (let i = 1; i <= 2; i++) {
      const nextId = currentChapterId + i;
      if (nextId < this.book.chapters.length) {
        prefetchIds.push(nextId);
      }
    }

    // 过滤已缓存的章节
    const toFetch = prefetchIds.filter(id => !this.cache.has(id) && !this.prefetchQueue.has(id));

    if (toFetch.length === 0) {
      return;
    }

    console.log('[ChapterCache] 调度预加载:', toFetch);

    // 使用 requestIdleCallback 或 setTimeout 异步预加载
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => this.prefetchChapters(toFetch));
    } else {
      setTimeout(() => this.prefetchChapters(toFetch), 100);
    }
  }

  /**
   * 预加载章节
   */
  private async prefetchChapters(chapterIds: number[]): Promise<void> {
    for (const chapterId of chapterIds) {
      if (this.cache.has(chapterId)) continue;

      this.prefetchQueue.add(chapterId);

      try {
        console.log('[ChapterCache] 预加载章节:', chapterId);
        await this.getChapter(chapterId);
      } catch (error) {
        console.error('[ChapterCache] 预加载失败:', chapterId, error);
      } finally {
        this.prefetchQueue.delete(chapterId);
      }
    }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    console.log('[ChapterCache] 清空缓存');

    // 清理所有 Blob URL
    for (const [chapterId] of this.cache.entries()) {
      this.cleanupBlobUrls(chapterId);
    }

    this.cache.clear();
    this.prefetchQueue.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; maxSize: number; cachedChapters: number[] } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      cachedChapters: Array.from(this.cache.keys())
    };
  }
}
