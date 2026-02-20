/**
 * 阅读器状态管理 (Pinia Store)
 * 管理当前阅读的书籍、章节、样式设置等
 * 使用 ContentLayer 架构优化内存
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UnifiedBook, ContentLayer } from '@/types/book';
import { ChapterCache } from '@/core/ChapterCache';

export const useReaderStore = defineStore('reader', () => {
  // ========== 状态 ==========
  
  // 当前活动的书籍
  const activeBook = ref<UnifiedBook | null>(null);
  
  // 当前章节ID
  const currentChapterId = ref<number>(0);
  
  // 当前章节内容（ContentLayer 数组）
  const currentLayers = ref<ContentLayer[]>([]);
  
  // 章节缓存管理器
  let chapterCache: ChapterCache | null = null;
  
  // 加载状态
  const loading = ref(false);
  
  // 错误信息
  const error = ref<string>('');

  // ========== 阅读样式设置 ==========
  
  // 字体大小 (px)
  const fontSize = ref<number>(18);
  
  // 行高
  const lineHeight = ref<number>(1.8);
  
  // 背景色
  const backgroundColor = ref<string>('#ffffff');
  
  // 文字颜色
  const textColor = ref<string>('#333333');
  
  // 内容最大宽度 (px)
  const maxWidth = ref<number>(900);

  // ========== 计算属性 ==========
  
  // 当前章节信息
  const currentChapter = computed(() => {
    if (!activeBook.value) return null;
    return activeBook.value.chapters[currentChapterId.value];
  });
  
  // 是否有上一章
  const hasPrevChapter = computed(() => {
    return currentChapterId.value > 0;
  });
  
  // 是否有下一章
  const hasNextChapter = computed(() => {
    if (!activeBook.value) return false;
    return currentChapterId.value < activeBook.value.chapters.length - 1;
  });
  
  // 阅读进度百分比
  const progressPercentage = computed(() => {
    if (!activeBook.value || activeBook.value.chapters.length === 0) return 0;
    return Math.round((currentChapterId.value / activeBook.value.chapters.length) * 100);
  });

  // 样式对象（用于绑定到渲染节点）
  const readerStyles = computed(() => ({
    fontSize: `${fontSize.value}px`,
    lineHeight: lineHeight.value.toString(),
    backgroundColor: backgroundColor.value,
    color: textColor.value,
    maxWidth: `${maxWidth.value}px`
  }));

  // ========== 方法 ==========
  
  /**
   * 设置活动书籍
   */
  function setActiveBook(book: UnifiedBook): void {
    console.log('[ReaderStore] 设置活动书籍:', book.title);
    
    // 清理旧的缓存
    if (chapterCache) {
      chapterCache.clear();
    }
    
    activeBook.value = book;
    currentChapterId.value = 0;
    currentLayers.value = [];
    error.value = '';
    
    // 创建新的缓存管理器
    chapterCache = new ChapterCache(book);
  }
  
  /**
   * 加载章节
   */
  async function loadChapter(chapterId: number): Promise<void> {
    if (!activeBook.value || !chapterCache) {
      throw new Error('没有活动的书籍');
    }
    
    if (chapterId < 0 || chapterId >= activeBook.value.chapters.length) {
      throw new Error('章节ID超出范围');
    }
    
    loading.value = true;
    error.value = '';
    
    try {
      console.log('[ReaderStore] 加载章节:', chapterId);
      const layers = await chapterCache.getChapter(chapterId);
      
      currentChapterId.value = chapterId;
      currentLayers.value = layers;
      
      console.log('[ReaderStore] 章节加载成功，layers 数:', layers.length);
    } catch (err) {
      console.error('[ReaderStore] 章节加载失败:', err);
      error.value = err instanceof Error ? err.message : '章节加载失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 上一章
   */
  async function prevChapter(): Promise<void> {
    if (!hasPrevChapter.value) {
      throw new Error('已经是第一章');
    }
    await loadChapter(currentChapterId.value - 1);
  }
  
  /**
   * 下一章
   */
  async function nextChapter(): Promise<void> {
    if (!hasNextChapter.value) {
      throw new Error('已经是最后一章');
    }
    await loadChapter(currentChapterId.value + 1);
  }
  
  /**
   * 跳转到指定章节
   */
  async function gotoChapter(chapterId: number): Promise<void> {
    await loadChapter(chapterId);
  }
  
  /**
   * 设置字体大小
   */
  function setFontSize(size: number): void {
    fontSize.value = Math.max(12, Math.min(32, size));
    savePreferences();
  }
  
  /**
   * 设置行高
   */
  function setLineHeight(height: number): void {
    lineHeight.value = Math.max(1.0, Math.min(3.0, height));
    savePreferences();
  }
  
  /**
   * 设置背景色
   */
  function setBackgroundColor(color: string): void {
    backgroundColor.value = color;
    
    // 自动调整文字颜色
    if (color === '#1a1a1a' || color === '#2c2c2c') {
      textColor.value = '#e0e0e0'; // 深色背景用浅色文字
    } else {
      textColor.value = '#333333'; // 浅色背景用深色文字
    }
    
    savePreferences();
  }
  
  /**
   * 保存偏好设置到 localStorage
   */
  function savePreferences(): void {
    const preferences = {
      fontSize: fontSize.value,
      lineHeight: lineHeight.value,
      backgroundColor: backgroundColor.value,
      textColor: textColor.value
    };
    localStorage.setItem('reader-preferences', JSON.stringify(preferences));
  }
  
  /**
   * 加载偏好设置
   */
  function loadPreferences(): void {
    const saved = localStorage.getItem('reader-preferences');
    if (saved) {
      try {
        const preferences = JSON.parse(saved);
        fontSize.value = preferences.fontSize || 18;
        lineHeight.value = preferences.lineHeight || 1.8;
        backgroundColor.value = preferences.backgroundColor || '#ffffff';
        textColor.value = preferences.textColor || '#333333';
      } catch (error) {
        console.error('[ReaderStore] 加载偏好设置失败:', error);
      }
    }
  }
  
  /**
   * 清理资源
   */
  function cleanup(): void {
    if (chapterCache) {
      chapterCache.clear();
    }
    activeBook.value = null;
    currentChapterId.value = 0;
    currentLayers.value = [];
    error.value = '';
  }
  
  /**
   * 获取缓存统计信息
   */
  function getCacheStats() {
    return chapterCache?.getStats() || null;
  }

  // 初始化时加载偏好设置
  loadPreferences();

  return {
    // 状态
    activeBook,
    currentChapterId,
    currentLayers,
    loading,
    error,
    
    // 样式设置
    fontSize,
    lineHeight,
    backgroundColor,
    textColor,
    maxWidth,
    
    // 计算属性
    currentChapter,
    hasPrevChapter,
    hasNextChapter,
    progressPercentage,
    readerStyles,
    
    // 方法
    setActiveBook,
    loadChapter,
    prevChapter,
    nextChapter,
    gotoChapter,
    setFontSize,
    setLineHeight,
    setBackgroundColor,
    savePreferences,
    loadPreferences,
    cleanup,
    getCacheStats
  };
});
