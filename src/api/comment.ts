import httpComment from '@/config/httpComment';

export interface ParagraphComment {
    id: number;
    bookId: number;
    chapterId: number;
    paragraphId: string;
    userId: number;
    content: string;
    likeCount: number;
    liked?: boolean;
    parentId?: number | null;
    replyToUserId?: number | null;
    createTime?: string;
    replies?: ParagraphComment[];
}

export interface ParagraphCommentGroup {
    paragraphId: string;
    comments: ParagraphComment[];
}

export interface ChapterCommentResult {
    paragraphGroups: ParagraphCommentGroup[];
    hotComments: ParagraphComment[];
}

export function queryChapterComments(params: { bookId: number; chapterId: number; hotLimit?: number }) {
    const fd = new FormData();
    fd.append('bookId', String(params.bookId));
    fd.append('chapterId', String(params.chapterId));
    fd.append('hotLimit', String(params.hotLimit ?? 3));
    return httpComment.post('/comment/chapter', fd);
}

export function publishParagraphComment(params: {
    bookId: number;
    chapterId: number;
    paragraphId: string;
    content: string;
    parentId?: number;
    replyToUserId?: number;
}) {
    const fd = new FormData();
    fd.append('bookId', String(params.bookId));
    fd.append('chapterId', String(params.chapterId));
    fd.append('paragraphId', params.paragraphId);
    fd.append('content', params.content);
    if (typeof params.parentId === 'number') fd.append('parentId', String(params.parentId));
    if (typeof params.replyToUserId === 'number') fd.append('replyToUserId', String(params.replyToUserId));
    return httpComment.post('/comment/publish', fd);
}

export function likeComment(params: { chapterId: number; commentId: number }) {
    const fd = new FormData();
    fd.append('chapterId', String(params.chapterId));
    fd.append('commentId', String(params.commentId));
    return httpComment.post('/comment/like', fd);
}

export function unlikeComment(params: { chapterId: number; commentId: number }) {
    const fd = new FormData();
    fd.append('chapterId', String(params.chapterId));
    fd.append('commentId', String(params.commentId));
    return httpComment.post('/comment/unlike', fd);
}