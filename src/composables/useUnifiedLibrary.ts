/**
 * 统一书库管理 Composable
 * 使用新的适配器系统和 UnifiedBook 模型
 */

import { ref } from 'vue';
import { db, type Book, unifiedBookToBook, getNextAvailableBookId } from '@/db';
import type { UnifiedBook } from '@/types/book';
import { TxtAdapter } from '@/adapters/TxtAdapter';
import { EpubAdapter } from '@/adapters/EpubAdapter';
import { ElMessage } from 'element-plus';

export interface ImportResult {
  success: boolean;
  bookId?: number;
  error?: string;
}

export function useUnifiedLibrary() {
  const books = ref<Book[]>([]);
  const loading = ref(false);
  const importing = ref(false);
  const importProgress = ref(0);

  /**
   * 加载所有书籍
   */
  async function loadBooks(): Promise<void> {
    loading.value = true;
    try {
      books.value = await db.books.orderBy('addTime').reverse().toArray();
      console.log('[useUnifiedLibrary] 加载书籍数:', books.value.length);
    } catch (error) {
      console.error('[useUnifiedLibrary] 加载书籍失败:', error);
      ElMessage.error('加载书籍失败');
      books.value = [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取单本书籍（返回 UnifiedBook）
   */
  async function getUnifiedBook(bookId: number): Promise<UnifiedBook | null> {
    try {
      const book = await db.books.get(bookId);
      if (!book) {
        console.error('[useUnifiedLibrary] 书籍不存在:', bookId);
        return null;
      }

      console.log('[useUnifiedLibrary] 解析书籍:', book.title);

      // 使用适配器解析为 UnifiedBook
      let unifiedBook: UnifiedBook;
      
      if (book.format === 'txt') {
        unifiedBook = await TxtAdapter.parse(book.data, book.title);
      } else {
        unifiedBook = await EpubAdapter.parse(book.data, book.title);
      }

      // 保留数据库ID
      unifiedBook.id = book.id;

      return unifiedBook;
    } catch (error) {
      console.error('[useUnifiedLibrary] 获取书籍失败:', error);
      ElMessage.error('获取书籍失败');
      return null;
    }
  }

  /**
   * 导入书籍
   */
  async function importBook(file: File): Promise<ImportResult> {
    // 验证文件格式
    if (!file.name.match(/\.(epub|txt)$/i)) {
      const errorMsg = '不支持的文件格式，请选择 EPUB 或 TXT 文件';
      ElMessage.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    importing.value = true;
    importProgress.value = 0;

    try {
      console.log('[useUnifiedLibrary] 开始导入:', file.name);

      // 读取文件
      importProgress.value = 10;
      const arrayBuffer = await file.arrayBuffer();
      importProgress.value = 30;

      // 使用适配器解析
      let unifiedBook: UnifiedBook;
      
      if (file.name.endsWith('.txt')) {
        unifiedBook = await TxtAdapter.parse(arrayBuffer, file.name);
      } else {
        unifiedBook = await EpubAdapter.parse(arrayBuffer, file.name);
      }

      importProgress.value = 70;

      // 获取下一个可用的 ID
      const nextId = await getNextAvailableBookId();
      unifiedBook.id = nextId;
      
      // 转换为 Book 并存储
      const book = unifiedBookToBook(unifiedBook);
      console.log('[useUnifiedLibrary] 书籍信息:', {
        id: book.id,
        title: book.title,
        chapterCount: book.chapterCount,
        format: book.format
      });
      
      // 使用 put 而不是 add，这样可以指定 ID
      await db.books.put(book);

      importProgress.value = 100;

      console.log('[useUnifiedLibrary] 导入成功，ID:', nextId);

      // 重新加载书籍列表
      await loadBooks();

      return { success: true, bookId: nextId };
    } catch (error) {
      console.error('[useUnifiedLibrary] 导入失败:', error);
      const errorMsg = error instanceof Error ? error.message : '导入失败';
      ElMessage.error(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      importing.value = false;
      importProgress.value = 0;
    }
  }

  /**
   * 删除书籍
   */
  async function deleteBook(bookId: number): Promise<void> {
    try {
      console.log('[useUnifiedLibrary] 开始删除书籍:', bookId);

      // 删除书籍
      await db.books.delete(bookId);
      console.log('[useUnifiedLibrary] 书籍记录已删除');

      // 删除相关进度
      const deletedCount = await db.progress.where('bookId').equals(bookId).delete();
      console.log('[useUnifiedLibrary] 进度记录已删除，数量:', deletedCount);

      // 重新加载书籍列表
      await loadBooks();

      console.log('[useUnifiedLibrary] ✅ 删除成功');
    } catch (error) {
      console.error('[useUnifiedLibrary] ❌ 删除失败:', error);
      throw error;
    }
  }

  return {
    books,
    loading,
    importing,
    importProgress,
    loadBooks,
    getUnifiedBook,
    importBook,
    deleteBook
  };
}
