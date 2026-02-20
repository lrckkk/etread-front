/**
 * 统一阅读内核 - 数据模型定义
 * 核心理念：ContentLayer 架构 - 图文分层存储
 */

/**
 * 内容层（ContentLayer）
 * 将两个图片之间的所有文本按段落存储
 * 支持段落级别的评论功能
 */
export interface ContentLayer {
  paragraphs: string[];     // 段落数组，每个元素是一个段落
  startGlobalIndex: number; // 当前 Layer 第一段在整个章节中的绝对段落序号
  image?: string;           // 可选的图片 Blob URL（紧随文本之后）
}

/**
 * 统一章节结构
 */
export interface UnifiedChapter {
  id: number;              // 章节索引
  title: string;           // 章节名称
  layers: ContentLayer[];  // 图文分层数组
  isLoaded: boolean;       // 是否已解析
  href?: string;           // EPUB 章节的 href（可选，仅用于 EPUB）
}

/**
 * 统一书籍类
 * 所有格式的书籍都转换为这个统一结构
 */
export interface UnifiedBook {
  // 基本元数据
  id?: number;
  title: string;
  author: string;
  cover: Blob | null;
  format: 'epub' | 'txt';
  
  // 章节数据
  chapters: UnifiedChapter[];
  
  // 原始数据（供按需解析使用）
  rawData: ArrayBuffer;
  
  // 添加时间
  addTime: number;
}

/**
 * 阅读进度
 */
export interface ReadingProgress {
  bookId: number;
  chapterId: number;     // 当前章节ID
  layerIndex: number;    // 当前层索引
  scrollOffset: number;  // 滚动偏移量
  updateTime: number;
}

