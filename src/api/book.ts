import httpBook from '@/config/httpBook';

export function uploadBook(params: {
    file: File;
    cover?: File;
    title: string;
    author?: string;
    description?: string;
    tags?: string[];
}) {
    const fd = new FormData();
    fd.append('file', params.file);
    if (params.cover) fd.append('cover', params.cover);
    fd.append('title', params.title);
    if (params.author) fd.append('author', params.author);
    if (params.description) fd.append('description', params.description);
    if (params.tags && params.tags.length) {
        params.tags.forEach((t, i) => {
            fd.append('tags', t);
            fd.append(`tags[${i}]`, t);
        });
    }
    return httpBook.post('/book/upload', fd);
}

export function updateBookInfo(
    bookid: number,
    data: {
        title?: string;
        author?: string;
        description?: string;
        tags?: string[];
        cover?: File;
    }
) {
    const fd = new FormData();
    fd.append('bookid', String(bookid));
    if (data.title) fd.append('title', data.title);
    if (data.author) fd.append('author', data.author);
    if (data.description) fd.append('description', data.description);
    if (data.tags && data.tags.length) {
        data.tags.forEach((t, i) => {
            fd.append('tags', t);
            fd.append(`tags[${i}]`, t);
        });
    }
    if (data.cover) fd.append('cover', data.cover);
    return httpBook.post('/book/updateinfo', fd);
}

export function deleteBookApi(bookid: number) {
    const fd = new FormData();
    fd.append('bookid', String(bookid));
    return httpBook.post('/book/delete', fd);
}

export function getMyBooks() {
    return httpBook.get('/book/mine');
}

export function getBookDetail(bookid: number) {
    return httpBook.get('/book/detail', { params: { bookid } });
}

export function getBookInfoBase(bookId: number) {
    return httpBook.get(`/book/info/${bookId}`);
}

export function listAllTags() {
    return httpBook.get('/book/tags');
}

export function addToShelf(bookId: number) {
    const fd = new FormData();
    fd.append('bookId', String(bookId));
    return httpBook.post('/book/shelf/add', fd);
}

export function removeFromShelf(bookId: number) {
    const fd = new FormData();
    fd.append('bookId', String(bookId));
    return httpBook.post('/book/shelf/remove', fd);
}

export function getBookshelf(userId: number) {
    return httpBook.get(`/book/bookshelf/${userId}`);
}

export function searchBooks(
    dto: {
        id?: number;
        title?: string;
        author?: string;
        publisher?: number;
        tags?: string[];
        minwordcount?: number;
        maxwordcount?: number;
        minscore?: number;
        maxscore?: number;
        createtime?: string;
        updatetime?: string;
    },
    page = 1,
    size = 10
) {
    const fd = new FormData();
    if (dto.id != null) fd.append('id', String(dto.id));
    if (dto.title) fd.append('title', dto.title);
    if (dto.author) fd.append('author', dto.author);
    if (dto.publisher != null) fd.append('publisher', String(dto.publisher));
    if (dto.minwordcount != null) fd.append('minwordcount', String(dto.minwordcount));
    if (dto.maxwordcount != null) fd.append('maxwordcount', String(dto.maxwordcount));
    if (dto.minscore != null) fd.append('minscore', String(dto.minscore));
    if (dto.maxscore != null) fd.append('maxscore', String(dto.maxscore));
    if (dto.createtime) fd.append('createtime', dto.createtime);
    if (dto.updatetime) fd.append('updatetime', dto.updatetime);
    if (dto.tags && dto.tags.length) {
        dto.tags.forEach((t, i) => {
            fd.append('tags', t);
            fd.append(`tags[${i}]`, t);
        });
    }
    return httpBook.post(`/book/info/search?page=${page}&size=${size}`, fd);
}

export function addBookReview(params: { bookId: number; rating: number; content: string }) {
    const fd = new FormData();
    fd.append('bookId', String(params.bookId));
    fd.append('rating', String(params.rating));
    fd.append('content', params.content);
    return httpBook.post('/book/review/add', fd);
}

export function listBookReviews(bookId: number, page = 1, size = 10) {
    return httpBook.get(`/book/review/list/${bookId}`, { params: { page, size } });
}

export function getHotList(limit?: number) {
    return httpBook.get('/book/hotList', { params: { limit } });
}

export function getRecommend(limit?: number) {
    return httpBook.get('/book/recommend', { params: { limit } });
}