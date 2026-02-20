import { ref } from 'vue';
import { db, type Progress } from '@/db';
import { ElMessage } from 'element-plus';

/**
 * Composable for managing reading progress tracking
 * Provides functions for loading, saving, and calculating reading progress
 */
export function useProgress() {
  const currentProgress = ref<Progress | null>(null);

  /**
   * Load progress for a specific book from IndexedDB
   * @param bookId - The ID of the book to load progress for
   * @returns The progress record or undefined if not found
   * Requirements: 7.1, 7.2
   */
  async function loadProgress(bookId: number): Promise<Progress | undefined> {
    try {
      const progress = await db.progress
        .where('bookId')
        .equals(bookId)
        .first();
      
      currentProgress.value = progress || null;
      return progress;
    } catch (error) {
      console.error('Failed to load progress:', error);
      ElMessage.error('Failed to load reading progress from database.');
      currentProgress.value = null;
      return undefined;
    }
  }

  /**
   * Save reading progress for a book
   * Updates existing progress record or creates a new one
   * @param bookId - The ID of the book
   * @param chapterIndex - Current chapter index (0-based)
   * @param position - CFI string for EPUB or scroll position for TXT
   * @param chapterTitle - Current chapter title for display
   * Requirements: 7.1, 7.2
   */
  async function saveProgress(
    bookId: number,
    chapterIndex: number,
    position: string | number,
    chapterTitle?: string
  ): Promise<void> {
    try {
      const existing = await db.progress
        .where('bookId')
        .equals(bookId)
        .first();

      const progressData = {
        chapterIndex,
        chapterTitle: chapterTitle || `第 ${chapterIndex + 1} 章`,
        position,
        updateTime: Date.now()
      };

      if (existing) {
        // Update existing progress record
        await db.progress.update(existing.id!, progressData);
      } else {
        // Create new progress record
        await db.progress.add({
          bookId,
          ...progressData
        });
      }
      
      // Update current progress ref
      currentProgress.value = {
        bookId,
        ...progressData
      };
    } catch (error: any) {
      console.error('Failed to save progress:', error);
      
      // Check for storage quota exceeded error
      if (error?.name === 'QuotaExceededError' || 
          error?.message?.includes('quota') ||
          error?.message?.includes('storage')) {
        ElMessage.error('Storage quota exceeded. Unable to save reading progress.');
      } else {
        ElMessage.error('Failed to save reading progress. Your position may not be saved.');
      }
      
      throw error;
    }
  }

  /**
   * Calculate reading progress percentage for a book
   * Returns a value between 0 and 100 based on saved position
   * @param bookId - The ID of the book
   * @returns Progress percentage (0-100)
   * Requirements: 3.5
   */
  async function getProgressPercentage(bookId: number): Promise<number> {
    try {
      const progress = await loadProgress(bookId);
      if (!progress) return 0;
      
      // 获取书籍信息以获取总章节数
      const book = await db.books.get(bookId);
      if (!book || !book.chapterCount) {
        console.warn('[useProgress] 书籍章节数未找到:', bookId);
        return 0;
      }
      
      const totalChapters = book.chapterCount;
      const percentage = ((progress.chapterIndex + 1) / totalChapters) * 100;
      
      console.log('[useProgress] 进度计算:', {
        bookId,
        currentChapter: progress.chapterIndex + 1,
        totalChapters,
        percentage: Math.round(percentage)
      });
      
      return Math.round(Math.min(100, percentage));
    } catch (error) {
      console.error('Failed to calculate progress percentage:', error);
      return 0;
    }
  }

  /**
   * Get chapter title for display
   * @param bookId - The ID of the book
   * @returns Chapter title string
   */
  async function getProgressChapterTitle(bookId: number): Promise<string> {
    try {
      const progress = await loadProgress(bookId);
      if (!progress) return '';
      
      // 返回保存的章节标题
      return progress.chapterTitle || `第 ${progress.chapterIndex + 1} 章`;
    } catch (error) {
      console.error('Failed to get chapter title:', error);
      return '';
    }
  }

  return {
    currentProgress,
    loadProgress,
    saveProgress,
    getProgressPercentage,
    getProgressChapterTitle
  };
}
