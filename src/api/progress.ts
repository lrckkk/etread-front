import httpBook from '@/config/httpBook';

export interface ProgressReq {
    bookId: number;
    currentChapterId: number;
    readPercentage: number;
}

export interface ProgressVO {
    userId: number;
    bookId: number;
    currentChapterId: number;
    readPercentage: number;
    lastReadTime?: string;
}

export function syncProgress(params: ProgressReq) {
    const fd = new FormData();
    fd.append('bookId', String(params.bookId));
    fd.append('currentChapterId', String(params.currentChapterId));
    fd.append('readPercentage', String(params.readPercentage));
    return httpBook.put('/book/progress/sync', fd);
}

export function getMyProgress(bookId: number) {
    return httpBook.get('/book/progress/my', { params: { bookId } });
}

export function getProgressHistory() {
    return httpBook.get('/book/progress/history');
}