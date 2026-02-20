import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, Book, Progress } from './index';

describe('Database Schema', () => {
  // Clean up database before and after each test
  beforeEach(async () => {
    await db.books.clear();
    await db.progress.clear();
  });

  afterEach(async () => {
    await db.books.clear();
    await db.progress.clear();
  });

  describe('Database Initialization', () => {
    it('should initialize database with correct name', () => {
      expect(db.name).toBe('LibraryDatabase');
    });

    it('should have books table defined', () => {
      expect(db.books).toBeDefined();
      expect(db.books.name).toBe('books');
    });

    it('should have progress table defined', () => {
      expect(db.progress).toBeDefined();
      expect(db.progress.name).toBe('progress');
    });
  });

  describe('Books Table', () => {
    it('should create book with all required fields', async () => {
      const testBook: Book = {
        title: 'Test Book',
        author: 'Test Author',
        format: 'epub',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      };

      const bookId = await db.books.add(testBook);
      expect(bookId).toBeDefined();
      expect(typeof bookId).toBe('number');

      const retrievedBook = await db.books.get(bookId);
      expect(retrievedBook).toBeDefined();
      expect(retrievedBook?.title).toBe('Test Book');
      expect(retrievedBook?.author).toBe('Test Author');
      expect(retrievedBook?.format).toBe('epub');
      expect(retrievedBook?.cover).toBeNull();
      expect(retrievedBook?.data).toBeInstanceOf(ArrayBuffer);
      expect(retrievedBook?.addTime).toBe(testBook.addTime);
    });

    it('should auto-increment book id', async () => {
      const book1: Book = {
        title: 'Book 1',
        author: 'Author 1',
        format: 'txt',
        cover: null,
        data: new ArrayBuffer(50),
        addTime: Date.now()
      };

      const book2: Book = {
        title: 'Book 2',
        author: 'Author 2',
        format: 'epub',
        cover: null,
        data: new ArrayBuffer(50),
        addTime: Date.now()
      };

      const id1 = await db.books.add(book1);
      const id2 = await db.books.add(book2);

      expect(id2).toBeGreaterThan(id1);
    });

    it('should support Blob cover storage', async () => {
      const coverBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      
      const book: Book = {
        title: 'Book with Cover',
        author: 'Author',
        format: 'epub',
        cover: coverBlob,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      };

      const bookId = await db.books.add(book);
      const retrievedBook = await db.books.get(bookId);

      expect(retrievedBook?.cover).toBeInstanceOf(Blob);
      expect(retrievedBook?.cover?.type).toBe('image/jpeg');
    });

    it('should query books by title index', async () => {
      const book: Book = {
        title: 'Searchable Book',
        author: 'Author',
        format: 'epub',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      };

      await db.books.add(book);
      const results = await db.books.where('title').equals('Searchable Book').toArray();

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Searchable Book');
    });

    it('should query books by format index', async () => {
      const epubBook: Book = {
        title: 'EPUB Book',
        author: 'Author',
        format: 'epub',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      };

      const txtBook: Book = {
        title: 'TXT Book',
        author: 'Author',
        format: 'txt',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      };

      await db.books.add(epubBook);
      await db.books.add(txtBook);

      const epubResults = await db.books.where('format').equals('epub').toArray();
      const txtResults = await db.books.where('format').equals('txt').toArray();

      expect(epubResults).toHaveLength(1);
      expect(txtResults).toHaveLength(1);
      expect(epubResults[0].format).toBe('epub');
      expect(txtResults[0].format).toBe('txt');
    });

    it('should order books by addTime index', async () => {
      const book1: Book = {
        title: 'First Book',
        author: 'Author',
        format: 'epub',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: 1000
      };

      const book2: Book = {
        title: 'Second Book',
        author: 'Author',
        format: 'txt',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: 2000
      };

      await db.books.add(book1);
      await db.books.add(book2);

      const booksAsc = await db.books.orderBy('addTime').toArray();
      const booksDesc = await db.books.orderBy('addTime').reverse().toArray();

      expect(booksAsc[0].title).toBe('First Book');
      expect(booksAsc[1].title).toBe('Second Book');
      expect(booksDesc[0].title).toBe('Second Book');
      expect(booksDesc[1].title).toBe('First Book');
    });
  });

  describe('Progress Table', () => {
    it('should create progress record with all required fields', async () => {
      const testProgress: Progress = {
        bookId: 1,
        chapterIndex: 5,
        position: 'epubcfi(/6/4[chap01ref]!/4/2/2[id001]/1:0)',
        updateTime: Date.now()
      };

      const progressId = await db.progress.add(testProgress);
      expect(progressId).toBeDefined();
      expect(typeof progressId).toBe('number');

      const retrievedProgress = await db.progress.get(progressId);
      expect(retrievedProgress).toBeDefined();
      expect(retrievedProgress?.bookId).toBe(1);
      expect(retrievedProgress?.chapterIndex).toBe(5);
      expect(retrievedProgress?.position).toBe(testProgress.position);
      expect(retrievedProgress?.updateTime).toBe(testProgress.updateTime);
    });

    it('should support both string and number position types', async () => {
      const epubProgress: Progress = {
        bookId: 1,
        chapterIndex: 0,
        position: 'epubcfi(/6/4[chap01ref]!/4/2/2[id001]/1:0)',
        updateTime: Date.now()
      };

      const txtProgress: Progress = {
        bookId: 2,
        chapterIndex: 3,
        position: 1500,
        updateTime: Date.now()
      };

      const id1 = await db.progress.add(epubProgress);
      const id2 = await db.progress.add(txtProgress);

      const retrieved1 = await db.progress.get(id1);
      const retrieved2 = await db.progress.get(id2);

      expect(typeof retrieved1?.position).toBe('string');
      expect(typeof retrieved2?.position).toBe('number');
    });

    it('should query progress by bookId index', async () => {
      const progress1: Progress = {
        bookId: 1,
        chapterIndex: 0,
        position: 100,
        updateTime: Date.now()
      };

      const progress2: Progress = {
        bookId: 2,
        chapterIndex: 0,
        position: 200,
        updateTime: Date.now()
      };

      await db.progress.add(progress1);
      await db.progress.add(progress2);

      const results = await db.progress.where('bookId').equals(1).toArray();

      expect(results).toHaveLength(1);
      expect(results[0].bookId).toBe(1);
    });

    it('should order progress by updateTime index', async () => {
      const progress1: Progress = {
        bookId: 1,
        chapterIndex: 0,
        position: 100,
        updateTime: 1000
      };

      const progress2: Progress = {
        bookId: 1,
        chapterIndex: 1,
        position: 200,
        updateTime: 2000
      };

      await db.progress.add(progress1);
      await db.progress.add(progress2);

      const progressAsc = await db.progress.orderBy('updateTime').toArray();
      const progressDesc = await db.progress.orderBy('updateTime').reverse().toArray();

      expect(progressAsc[0].updateTime).toBe(1000);
      expect(progressAsc[1].updateTime).toBe(2000);
      expect(progressDesc[0].updateTime).toBe(2000);
      expect(progressDesc[1].updateTime).toBe(1000);
    });
  });

  describe('Database Operations', () => {
    it('should delete book record', async () => {
      const book: Book = {
        title: 'Book to Delete',
        author: 'Author',
        format: 'epub',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      };

      const bookId = await db.books.add(book);
      await db.books.delete(bookId);

      const retrievedBook = await db.books.get(bookId);
      expect(retrievedBook).toBeUndefined();
    });

    it('should update book record', async () => {
      const book: Book = {
        title: 'Original Title',
        author: 'Author',
        format: 'epub',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      };

      const bookId = await db.books.add(book);
      await db.books.update(bookId, { title: 'Updated Title' });

      const updatedBook = await db.books.get(bookId);
      expect(updatedBook?.title).toBe('Updated Title');
    });

    it('should clear all books', async () => {
      await db.books.add({
        title: 'Book 1',
        author: 'Author',
        format: 'epub',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      });

      await db.books.add({
        title: 'Book 2',
        author: 'Author',
        format: 'txt',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      });

      await db.books.clear();
      const count = await db.books.count();
      expect(count).toBe(0);
    });

    it('should count records in tables', async () => {
      await db.books.add({
        title: 'Book 1',
        author: 'Author',
        format: 'epub',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      });

      await db.books.add({
        title: 'Book 2',
        author: 'Author',
        format: 'txt',
        cover: null,
        data: new ArrayBuffer(100),
        addTime: Date.now()
      });

      const bookCount = await db.books.count();
      expect(bookCount).toBe(2);
    });
  });
});
