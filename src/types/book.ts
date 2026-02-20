/**
 * 统一阅读内核 - 数据模型定义
 * 核心理念：ContentLayer 架构 - 图文分层存储 + 段落索引
 */

/**
 * 内容层（ContentLayer）
 * 将两个图片之间的所有文本按段落存储
 * 支持段落级别的精确定位（为评论功能预留）
 * 
 * 索引计数规则：
 * - 每个段落占用 1 个索引位
 * - 图片（如果存在）占用 1 个独立索引位
 * - startIndex 记录该 Layer 第一段的全局绝对索引
 * 
 * 示例：
 * Layer 1: paragraphs=['段1', '段2', '段3'], image='blob:...', startIndex=0
 *   - 段1: index=0
 *   - 段2: index=1
 *   - 段3: index=2
 *   - 图片: index=3
 * Layer 2: paragraphs=['段4', '段5'], startIndex=4
 *   - 段4: index=4
 *   - 段5: index=5
 */
export interface ContentLayer {
  paragraphs: string[];     // 段落数组，每个元素是一个段落
  startIndex: number;       // 该 Layer 第一段在整个章节中的全局绝对索引
  image?: string;           // 可选的图片 Blob URL（紧随段落之后，占用独立索引）
}

/**
 * 定位信息接口（为未来评论功能预留）
 * 可以通过 layer.startIndex + paragraphOffset 精确定位到任何段落
 */
export interface ContentLocation {
  layerIndex: number;       // Layer 在章节中的索引
  globalIndex: number;      // 全局段落索引（跨 Layer）
  paragraphOffset: number;  // 段落在 Layer 内的偏移
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

