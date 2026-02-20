import Dexie, { Table } from 'dexie';
import type { UnifiedBook } from '@/types/book';

/**
 * Book interface representing a stored book in the database
 */
export interface Book {
  id?: number;              // Auto-increment primary key
  title: string;            // Book title (extracted from metadata or filename)
  author: string;           // Author name (extracted from metadata or 'Unknown')
  format: 'epub' | 'txt';   // File format
  cover: Blob | null;       // Cover image as Blob (more efficient than Base64)
  data: ArrayBuffer;        // Raw book file data
  addTime: number;          // Timestamp when book was imported
  chapterCount?: number;    // Total number of chapters (for progress calculation)
}

/**
 * Progress interface representing reading progress for a book
 */
export interface Progress {
  id?: number;              // Auto-increment primary key
  bookId: number;           // Foreign key to books table
  chapterIndex: number;     // Current chapter index (0-based)
  chapterTitle?: string;    // Current chapter title for display
  position: string | number; // CFI string for EPUB, scroll position for TXT
  updateTime: number;       // Timestamp of last update
}

/**
 * 将 UnifiedBook 转换为 Book (用于存储)
 */
export function unifiedBookToBook(unifiedBook: UnifiedBook): Book {
  return {
    id: unifiedBook.id,
    title: unifiedBook.title,
    author: unifiedBook.author,
    format: unifiedBook.format,
    cover: unifiedBook.cover,
    data: unifiedBook.rawData,
    addTime: unifiedBook.addTime,
    chapterCount: unifiedBook.chapters.length
  };
}

/**
 * 将 Book 转换为 UnifiedBook (用于读取)
 * 注意：chapters 需要通过适配器重新解析
 */
export function bookToUnifiedBook(book: Book): Partial<UnifiedBook> {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    format: book.format,
    cover: book.cover,
    rawData: book.data,
    addTime: book.addTime,
    chapters: [] // 需要通过适配器解析
  };
}

/**
 * LibraryDatabase class extending Dexie for IndexedDB operations
 */
class LibraryDatabase extends Dexie {
  books!: Table<Book>;
  progress!: Table<Progress>;

  constructor() {
    super('LibraryDatabase');
    
    // Define database schema
    // Version 1: Initial schema
    this.version(1).stores({
      books: '++id, title, format, addTime',
      progress: '++id, bookId, updateTime'
    });
    
    // Version 2: Add chapterCount to books
    this.version(2).stores({
      books: '++id, title, format, addTime, chapterCount',
      progress: '++id, bookId, updateTime'
    });
    
    // Version 3: Add chapterTitle to progress
    this.version(3).stores({
      books: '++id, title, format, addTime, chapterCount',
      progress: '++id, bookId, updateTime, chapterTitle'
    }).upgrade(tx => {
      // Migration: existing progress records will keep their data
      return tx.table('progress').toCollection().modify(progress => {
        if (!progress.chapterTitle) {
          progress.chapterTitle = `第 ${progress.chapterIndex + 1} 章`;
        }
      });
    });
  }
}

// Export singleton database instance
export const db = new LibraryDatabase();

/**
 * 获取下一个可用的书籍 ID
 * 优先使用最小的可用 ID（填补删除后的空缺）
 */
export async function getNextAvailableBookId(): Promise<number> {
  const allBooks = await db.books.orderBy('id').toArray();
  
  if (allBooks.length === 0) {
    return 1; // 第一本书从 1 开始
  }
  
  // 查找第一个空缺的 ID
  for (let i = 0; i < allBooks.length; i++) {
    const expectedId = i + 1;
    if (allBooks[i].id !== expectedId) {
      return expectedId; // 找到空缺，返回这个 ID
    }
  }
  
  // 没有空缺，返回下一个 ID
  return allBooks.length + 1;
}
