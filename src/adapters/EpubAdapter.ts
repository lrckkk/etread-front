/**
 * EPUB 格式适配器
 * 将 EPUB 文件转换为统一的 UnifiedBook 结构
 * 使用 ContentLayer 架构：图文分层存储
 * 核心：不使用 Epub.js 渲染器，仅用其解析能力
 */

import ePub from 'epubjs';
import type { Book } from 'epubjs';
import type { UnifiedBook, UnifiedChapter, ContentLayer } from '@/types/book';

export class EpubAdapter {
  /**
   * Maximum characters per ContentLayer to prevent DOM performance issues
   */
  private static readonly MAX_LAYER_LENGTH = 15000;

  /**
   * 解析 EPUB 文件为 UnifiedBook
   */
  static async parse(
    arrayBuffer: ArrayBuffer,
    filename: string
  ): Promise<UnifiedBook> {
    console.log('[EpubAdapter] 开始解析 EPUB 文件:', filename);

    // 1. 使用 Epub.js 打开书籍
    const epubBook: Book = ePub(arrayBuffer);
    await epubBook.ready;

    // 2. 提取元数据
    const metadata = await epubBook.loaded.metadata;
    const title = metadata.title || filename.replace(/\.epub$/i, '');
    const author = metadata.creator || 'Unknown';

    console.log('[EpubAdapter] 书籍信息:', { title, author });

    // 3. 提取封面
    const cover = await this.extractCover(epubBook);

    // 4. 提取目录结构（懒加载，不解析内容）
    const chapters = await this.extractChapters(epubBook);
    console.log('[EpubAdapter] 检测到章节数:', chapters.length);

    // 5. 构建 UnifiedBook
    const book: UnifiedBook = {
      title,
      author,
      cover,
      format: 'epub',
      chapters,
      rawData: arrayBuffer,
      addTime: Date.now()
    };

    return book;
  }

  /**
   * 提取封面
   */
  private static async extractCover(epubBook: Book): Promise<Blob | null> {
    try {
      const coverUrl = await epubBook.coverUrl();
      if (!coverUrl) return null;

      // 从 Blob URL 获取 Blob
      const response = await fetch(coverUrl);
      const blob = await response.blob();
      
      console.log('[EpubAdapter] 封面提取成功');
      return blob;
    } catch (error) {
      console.warn('[EpubAdapter] 封面提取失败:', error);
      return null;
    }
  }

  /**
   * 提取章节结构（仅目录，不解析内容）
   */
  private static async extractChapters(epubBook: Book): Promise<UnifiedChapter[]> {
    const navigation = await epubBook.loaded.navigation;
    const toc = navigation.toc;

    const chapters: UnifiedChapter[] = [];
    let validChapterIndex = 0;

    // 遍历目录，验证每个章节是否真实存在
    for (let i = 0; i < toc.length; i++) {
      const item = toc[i];
      const href = item.href;
      
      // 验证章节是否存在于 spine 中
      const section = epubBook.spine.get(href);
      
      if (section) {
        // 章节存在，添加到列表
        chapters.push({
          id: validChapterIndex++,
          title: item.label,
          href: href,  // 保存 href 用于后续加载
          layers: [],
          isLoaded: false
        });
      } else {
        // 章节不存在，跳过并记录警告
        console.warn('[EpubAdapter] 跳过无效章节:', {
          title: item.label,
          href: href
        });
      }
    }

    // 如果没有目录，使用 spine（书脊）
    if (chapters.length === 0) {
      const spine = epubBook.spine;
      const spineItems = (spine as any).items || [];
      for (let i = 0; i < spineItems.length; i++) {
        chapters.push({
          id: i,
          title: `Chapter ${i + 1}`,
          layers: [],
          isLoaded: false
        });
      }
    }

    console.log('[EpubAdapter] 有效章节数:', chapters.length);
    return chapters;
  }

  /**
   * 懒加载：解析指定章节的内容
   * 将 XHTML 转换为 ContentLayer 数组
   * 核心：两个图片之间的文本合并为一个 layer
   */
  static async loadChapter(
    book: UnifiedBook,
    chapterId: number
  ): Promise<ContentLayer[]> {
    console.log('[EpubAdapter] 懒加载章节:', chapterId);

    const chapter = book.chapters[chapterId];
    if (!chapter) {
      throw new Error(`章节 ${chapterId} 不存在`);
    }

    // 如果已加载，直接返回
    if (chapter.isLoaded && chapter.layers.length > 0) {
      console.log('[EpubAdapter] 章节已缓存，直接返回');
      return chapter.layers;
    }

    // 重新打开 EPUB
    const epubBook: Book = ePub(book.rawData);
    await epubBook.ready;

    let section: any = null;
    
    try {
      // 优先使用章节保存的 href
      if (chapter.href) {
        console.log('[EpubAdapter] 使用保存的 href 加载章节:', chapter.href);
        section = epubBook.spine.get(chapter.href);
      } else {
        // 回退到使用索引
        console.log('[EpubAdapter] 使用索引加载章节:', chapterId);
        section = epubBook.spine.get(chapterId);
      }

      if (!section) {
        console.error('[EpubAdapter] 无法找到章节，返回空内容');
        // 返回空的 layer 而不是抛出错误
        return [{
          paragraphs: [`章节 "${chapter.title}" 内容不存在或无法加载`],
          startGlobalIndex: 0
        }];
      }

      // 加载章节的 XHTML 内容
      await section.load(epubBook.load.bind(epubBook));
      
      const document = section.document;
      if (!document) {
        console.warn('[EpubAdapter] 章节文档为空');
        return [{
          paragraphs: [`章节 "${chapter.title}" 内容为空`],
          startGlobalIndex: 0
        }];
      }

      // 解析 HTML 为 ContentLayer，传入 section 用于路径解析
      const layers = await this.parseHTML(document, epubBook, section);

      console.log('[EpubAdapter] 章节解析完成，layers 数:', layers.length);
      return layers;
      
    } catch (error) {
      console.error('[EpubAdapter] 章节加载失败:', {
        chapterId,
        title: chapter.title,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // 返回错误提示而不是抛出异常
      return [{
        paragraphs: [
          `章节 "${chapter.title}" 加载失败`,
          `错误信息: ${error instanceof Error ? error.message : String(error)}`
        ],
        startGlobalIndex: 0
      }];
    }
  }

  /**
   * 解析 HTML 文档为 ContentLayer 数组
   * 核心算法：遇到图片时截断，生成新的 layer
   */
  private static async parseHTML(
    document: Document,
    epubBook: Book,
    section: any
  ): Promise<ContentLayer[]> {
    const layers: ContentLayer[] = [];
    const body = document.body;

    if (!body) return layers;

    // 当前累积的段落数组
    let currentParagraphs: string[] = [];
    // 章节级段落计数器
    let chapterParaCounter = 0;

    // 递归遍历 DOM 树
    await this.traverseDOM(body, layers, currentParagraphs, epubBook, section, chapterParaCounter);

    // 处理最后剩余的段落
    if (currentParagraphs.length > 0) {
      this.addParagraphsWithChunking(layers, currentParagraphs, chapterParaCounter);
    }

    return layers;
  }

  /**
   * Add paragraphs to layers with automatic chunking
   * Splits large paragraph arrays into multiple layers to prevent DOM performance issues
   */
  private static addParagraphsWithChunking(
    layers: ContentLayer[],
    paragraphs: string[],
    startGlobalIndex: number,
    image?: string
  ): number {
    // Calculate total character count
    const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
    
    if (totalChars <= this.MAX_LAYER_LENGTH) {
      // Within limit, add as single layer
      layers.push({ 
        paragraphs: [...paragraphs], 
        startGlobalIndex,
        image 
      });
      return startGlobalIndex + paragraphs.length;
    }

    // Need to chunk - split paragraphs into multiple layers
    let currentChunk: string[] = [];
    let currentChunkSize = 0;
    let currentStartIndex = startGlobalIndex;
    let isFirstChunk = true;

    for (const para of paragraphs) {
      if (currentChunkSize + para.length > this.MAX_LAYER_LENGTH && currentChunk.length > 0) {
        // Current chunk is full, create a layer
        layers.push({
          paragraphs: [...currentChunk],
          startGlobalIndex: currentStartIndex,
          image: isFirstChunk ? image : undefined
        });
        
        currentStartIndex += currentChunk.length;
        currentChunk = [];
        currentChunkSize = 0;
        isFirstChunk = false;
      }
      
      currentChunk.push(para);
      currentChunkSize += para.length;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      layers.push({
        paragraphs: [...currentChunk],
        startGlobalIndex: currentStartIndex,
        image: isFirstChunk ? image : undefined
      });
      currentStartIndex += currentChunk.length;
    }

    return currentStartIndex;
  }

  /**
   * 递归遍历 DOM 节点
   * 核心：遇到图片时截断文本，生成新 layer
   */
  private static async traverseDOM(
    element: Element,
    layers: ContentLayer[],
    currentParagraphs: string[],
    epubBook: Book,
    section: any,
    chapterParaCounter: number
  ): Promise<number> {
    for (const child of Array.from(element.children)) {
      const tagName = child.tagName.toLowerCase();

      // 处理段落 - 作为独立段落存储
      if (tagName === 'p') {
        const text = child.textContent?.trim();
        if (text) {
          currentParagraphs.push(text);
        }
      }
      // 处理标题 - 也作为段落处理
      else if (/^h[1-6]$/.test(tagName)) {
        const text = child.textContent?.trim();
        if (text) {
          currentParagraphs.push(text);
        }
      }
      // 处理图片 - 截断当前段落，生成新 layer
      else if (tagName === 'img') {
        const src = child.getAttribute('src');
        console.log('[EpubAdapter] 发现图片标签，src:', src);
        
        if (src) {
          let internalPath = '';  // 在 try 外部声明
          try {
            console.log('[EpubAdapter] 开始处理图片:', src);
            console.log('[EpubAdapter] 当前章节路径 section.href:', section.href);
            console.log('[EpubAdapter] 当前章节完整路径 section.canonical:', section.canonical);
            
            // 【关键修正】：手动解析相对路径
            
            // 使用 canonical 路径（完整路径）而不是 href
            const basePath = section.canonical || section.href;
            
            if (src.startsWith('http://') || src.startsWith('https://')) {
              // 绝对 URL，直接使用
              throw new Error('External images not supported');
            } else if (src.startsWith('/')) {
              // 绝对路径（相对于 EPUB 根目录）
              internalPath = src; // 保留开头的斜杠
            } else {
              // 相对路径，需要基于当前章节路径解析
              const sectionDir = basePath.substring(0, basePath.lastIndexOf('/'));
              console.log('[EpubAdapter] 章节目录:', sectionDir);
              
              // 手动解析相对路径
              const parts = sectionDir.split('/').filter(p => p); // 过滤空字符串
              const srcParts = src.split('/');
              
              for (const part of srcParts) {
                if (part === '..') {
                  parts.pop(); // 返回上一级
                } else if (part !== '.' && part !== '') {
                  parts.push(part);
                }
              }
              
              internalPath = '/' + parts.join('/'); // 添加开头的斜杠以匹配 archive
            }
            
            console.log('[EpubAdapter] 修正后的内部路径:', internalPath);
            
            // 使用 archive.request 方法加载图片，指定为 blob 类型
            const imageData = await epubBook.archive.request(internalPath, 'blob');
            
            // 确保返回的是 Blob 类型
            if (!(imageData instanceof Blob)) {
              throw new Error('Image data is not a Blob');
            }
            
            const imageBlob = imageData as Blob;
            console.log('[EpubAdapter] 图片 Blob:', {
              size: imageBlob.size,
              type: imageBlob.type
            });
            
            const blobUrl = URL.createObjectURL(imageBlob);
            console.log('[EpubAdapter] Blob URL 创建成功:', blobUrl);

            // 截断：将当前累积的段落生成一个或多个 layer（应用分块）
            if (currentParagraphs.length > 0) {
              chapterParaCounter = this.addParagraphsWithChunking(
                layers, 
                currentParagraphs, 
                chapterParaCounter,
                blobUrl
              );
              currentParagraphs.length = 0;  // 清空累积
              console.log('[EpubAdapter] 图片附加到段落 layer');
            } else {
              // 如果没有段落，创建只有图片的 layer
              layers.push({
                paragraphs: [],
                startGlobalIndex: chapterParaCounter,
                image: blobUrl
              });
              console.log('[EpubAdapter] 创建纯图片 layer');
            }
            
            console.log('[EpubAdapter] 图片 layer 已添加，当前 layers 总数:', layers.length);
          } catch (error) {
            console.error('[EpubAdapter] 图片加载失败:', {
              src,
              internalPath: internalPath,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        } else {
          console.warn('[EpubAdapter] 图片标签没有 src 属性');
        }
      }
      // 递归处理其他容器元素
      else if (child.children.length > 0) {
        chapterParaCounter = await this.traverseDOM(
          child, 
          layers, 
          currentParagraphs, 
          epubBook, 
          section, 
          chapterParaCounter
        );
      }
      // 处理纯文本节点
      else {
        const text = child.textContent?.trim();
        if (text) {
          currentParagraphs.push(text);
        }
      }
    }
    
    return chapterParaCounter;
  }
}
