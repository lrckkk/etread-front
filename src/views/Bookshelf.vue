<template>
  <div class="bookshelf-container">
    <!-- 顶部导航栏 -->
    <header class="app-header">
      <div class="header-content">
        <div class="logo-section">
          <el-icon class="logo-icon"><Reading /></el-icon>
          <h1 class="app-title">我的书架</h1>
        </div>
        
        <nav class="nav-tabs">
          <button 
            class="nav-tab" 
            :class="{ active: activeTab === 'library' }"
            @click="activeTab = 'library'"
          >
            <el-icon><Reading /></el-icon>
            <span>书架</span>
          </button>
          <button 
            class="nav-tab" 
            :class="{ active: activeTab === 'store' }"
            @click="activeTab = 'store'"
          >
            <el-icon><ShoppingCart /></el-icon>
            <span>书城</span>
            <span class="coming-soon">即将上线</span>
          </button>
          <button 
            class="nav-tab" 
            :class="{ active: activeTab === 'upload' }"
            @click="activeTab = 'upload'"
          >
            <el-icon><Upload /></el-icon>
            <span>上传</span>
            <span class="coming-soon">即将上线</span>
          </button>
        </nav>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 书架视图 -->
      <div v-show="activeTab === 'library'" class="library-view">
        <!-- Import Area with drag-and-drop support -->
        <div 
          class="import-area" 
          :class="{ 'drag-over': isDragOver }"
          @drop.prevent="handleDrop" 
          @dragover.prevent="handleDragOver"
          @dragleave="handleDragLeave"
        >
          <div class="import-content">
            <el-icon class="upload-icon"><Upload /></el-icon>
            <h2>导入书籍</h2>
            <p class="import-hint">拖拽 EPUB 或 TXT 文件到这里，或点击按钮选择文件</p>
            <el-button @click="selectFile" type="primary" size="large" round>
              <el-icon><FolderOpened /></el-icon>
              选择文件
            </el-button>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept=".epub,.txt"
            style="display: none"
            @change="handleFileSelect"
          />
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-container">
          <el-icon class="is-loading"><Loading /></el-icon>
          <p>加载书架中...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="books.length === 0" class="empty-state">
          <el-icon><Reading /></el-icon>
          <h3>书架空空如也</h3>
          <p>导入你的第一本书开始阅读吧！</p>
        </div>

        <!-- Book Grid -->
        <div v-else class="books-section">
          <div class="section-header">
            <h2>我的藏书</h2>
            <span class="book-count">{{ books.length }} 本</span>
          </div>
          
          <div class="book-grid">
            <div v-for="book in books" :key="book.id" class="book-card">
              <div class="book-cover-wrapper" @click="openBook(book.id!)">
                <div class="book-cover">
                  <img 
                    v-if="book.cover" 
                    :src="getCoverUrl(book.id!)" 
                    :alt="book.title"
                    @error="handleImageError"
                  />
                  <div v-else class="default-cover">
                    <span class="cover-letter">{{ book.title[0]?.toUpperCase() || '?' }}</span>
                  </div>
                  <div class="cover-overlay">
                    <el-icon class="play-icon"><VideoPlay /></el-icon>
                  </div>
                </div>
                <div class="progress-ring" v-if="progressMap.get(book.id!) > 0">
                  <svg width="100%" height="100%" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
                    <circle 
                      cx="18" cy="18" r="16" fill="none" 
                      stroke="#fff" stroke-width="2"
                      :stroke-dasharray="`${progressMap.get(book.id!)} 100`"
                      stroke-linecap="round"
                      transform="rotate(-90 18 18)"
                    />
                  </svg>
                  <span class="progress-text">{{ Math.round(progressMap.get(book.id!) || 0) }}%</span>
                </div>
              </div>
              
              <div class="book-info">
                <h3 class="book-title" :title="book.title">{{ book.title }}</h3>
                <p class="book-author" :title="book.author">{{ book.author }}</p>
                <div class="book-progress" v-if="progressTextMap.get(book.id!)">
                  <span class="progress-chapter">读到: {{ getProgressText(book.id!) }}</span>
                </div>
                <div class="book-meta">
                  <span class="format-badge">{{ book.format.toUpperCase() }}</span>
                </div>
              </div>
              
              <button 
                class="delete-btn"
                @click.stop="confirmDelete(book.id!)"
                title="删除书籍"
              >
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 书城视图（占位） -->
      <div v-show="activeTab === 'store'" class="placeholder-view">
        <el-icon><ShoppingCart /></el-icon>
        <h2>书城功能</h2>
        <p>即将上线，敬请期待</p>
      </div>

      <!-- 上传视图（占位） -->
      <div v-show="activeTab === 'upload'" class="placeholder-view">
        <el-icon><Upload /></el-icon>
        <h2>上传功能</h2>
        <p>即将上线，敬请期待</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUnifiedLibrary } from '@/composables/useUnifiedLibrary';
import { useProgress } from '@/composables/useProgress';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  Upload, 
  Delete, 
  Loading, 
  Reading, 
  ShoppingCart,
  FolderOpened,
  VideoPlay
} from '@element-plus/icons-vue';

const { books, loading, importing, importProgress, loadBooks, importBook, deleteBook } = useUnifiedLibrary();
const { getProgressPercentage, getProgressChapterTitle } = useProgress();
const router = useRouter();

const fileInput = ref<HTMLInputElement | null>(null);
const progressMap = ref<Map<number, number>>(new Map());
const progressTextMap = ref<Map<number, string>>(new Map());
const coverUrlCache = ref<Map<number, string>>(new Map());
const isDragOver = ref(false);
const activeTab = ref('library');

/**
 * Get or create object URL for book cover
 * Caches URLs to prevent memory leaks and improve performance
 * Requirements: 3.2, 3.4
 */
function getCoverUrl(bookId: number): string {
  try {
    // Check if URL is already cached
    if (coverUrlCache.value.has(bookId)) {
      return coverUrlCache.value.get(bookId)!;
    }
    
    // Find the book and create URL from Blob
    const book = books.value.find(b => b.id === bookId);
    if (book?.cover) {
      const url = URL.createObjectURL(book.cover);
      coverUrlCache.value.set(bookId, url);
      return url;
    }
  } catch (error) {
    console.error('Failed to create cover URL:', error);
  }
  
  return '';
}

/**
 * Handle drag over event for drag-and-drop import
 * Requirements: 1.1
 */
function handleDragOver(event: DragEvent): void {
  isDragOver.value = true;
}

/**
 * Handle drag leave event
 */
function handleDragLeave(): void {
  isDragOver.value = false;
}

/**
 * Handle file drop for drag-and-drop import
 * Requirements: 1.1
 */
async function handleDrop(event: DragEvent): Promise<void> {
  isDragOver.value = false;
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    // Validate file type before processing
    const file = files[0];
    if (!file.name.match(/\.(epub|txt)$/i)) {
      ElMessage.error('Please drop an EPUB or TXT file.');
      return;
    }
    await processFile(file);
  }
}

/**
 * Open file selector dialog
 * Requirements: 1.2
 */
function selectFile(): void {
  fileInput.value?.click();
}

/**
 * Handle file selection from file picker
 * Requirements: 1.2
 */
async function handleFileSelect(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    await processFile(target.files[0]);
    // Reset input to allow selecting the same file again
    target.value = '';
  }
}

/**
 * Process and import a file
 * Requirements: 1.1, 1.2, 1.6
 */
async function processFile(file: File): Promise<void> {
  // Check if file is large (>50MB) to show progress
  const isLargeFile = file.size > 50 * 1024 * 1024;
  
  let loadingMessage: any;
  
  if (isLargeFile) {
    // Show progress message for large files
    loadingMessage = ElMessage({
      message: 'Importing large file... 0%',
      type: 'info',
      duration: 0,
      icon: Loading
    });
    
    // Watch import progress and update message
    const progressInterval = setInterval(() => {
      if (loadingMessage && importing.value) {
        loadingMessage.close();
        loadingMessage = ElMessage({
          message: `Importing large file... ${importProgress.value}%`,
          type: 'info',
          duration: 0,
          icon: Loading
        });
      } else {
        clearInterval(progressInterval);
      }
    }, 500);
  } else {
    loadingMessage = ElMessage({
      message: 'Importing book...',
      type: 'info',
      duration: 0,
      icon: Loading
    });
  }

  try {
    const result = await importBook(file);
    loadingMessage.close();
    
    if (result.success) {
      ElMessage.success('Book imported successfully');
      // Load progress for the newly imported book
      if (result.bookId) {
        const progress = await getProgressPercentage(result.bookId);
        progressMap.value.set(result.bookId, progress);
      }
    } else {
      ElMessage.error(result.error || 'Import failed');
    }
  } catch (error) {
    loadingMessage.close();
    ElMessage.error('An unexpected error occurred during import');
  }
}

/**
 * Confirm and delete a book
 * Requirements: 4.1, 4.4
 */
async function confirmDelete(bookId: number): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要删除这本书吗？这将永久删除书籍和所有阅读进度。',
      '删除书籍',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    );
    
    console.log('[Bookshelf] 开始删除书籍:', bookId);
    
    // Clean up cover URL before deleting
    cleanupCoverUrl(bookId);
    console.log('[Bookshelf] 封面 URL 已清理');
    
    await deleteBook(bookId);
    console.log('[Bookshelf] 数据库记录已删除');
    
    progressMap.value.delete(bookId);
    progressTextMap.value.delete(bookId);
    console.log('[Bookshelf] 内存缓存已清理');
    
    ElMessage.success('书籍删除成功');
  } catch (error) {
    // User cancelled deletion
    if (error !== 'cancel') {
      console.error('[Bookshelf] 删除失败:', error);
      ElMessage.error('删除书籍失败');
    }
  }
}

/**
 * Open a book for reading
 * Navigates to the UnifiedReader view with the book ID
 */
function openBook(bookId: number): void {
  router.push(`/reader/${bookId}`);
}

/**
 * Handle image loading errors
 */
function handleImageError(): void {
  console.error('Failed to load book cover image');
}

/**
 * Load progress for all books
 * Requirements: 3.2
 */
async function loadAllProgress(): Promise<void> {
  try {
    for (const book of books.value) {
      if (book.id) {
        try {
          const progress = await getProgressPercentage(book.id);
          progressMap.value.set(book.id, progress);
          
          const chapterTitle = await getProgressChapterTitle(book.id);
          if (chapterTitle) {
            progressTextMap.value.set(book.id, chapterTitle);
          }
        } catch (error) {
          console.error(`Failed to load progress for book ${book.id}:`, error);
          // Continue loading progress for other books
        }
      }
    }
  } catch (error) {
    console.error('Failed to load progress for books:', error);
  }
}

/**
 * Get progress text for display
 */
function getProgressText(bookId: number): string {
  return progressTextMap.value.get(bookId) || '';
}

/**
 * Clean up object URL for a specific book cover
 * Prevents memory leaks
 */
function cleanupCoverUrl(bookId: number): void {
  const url = coverUrlCache.value.get(bookId);
  if (url) {
    URL.revokeObjectURL(url);
    coverUrlCache.value.delete(bookId);
  }
}

/**
 * Clean up all cover URLs
 * Prevents memory leaks when component is unmounted
 */
function cleanupAllCoverUrls(): void {
  coverUrlCache.value.forEach(url => {
    URL.revokeObjectURL(url);
  });
  coverUrlCache.value.clear();
}

/**
 * Initialize component
 */
onMounted(async () => {
  try {
    await loadBooks();
    await loadAllProgress();
  } catch (error) {
    console.error('Failed to initialize bookshelf:', error);
    ElMessage.error('Failed to load bookshelf. Please refresh the page.');
  }
});

/**
 * Cleanup on unmount
 */
onUnmounted(() => {
  cleanupAllCoverUrls();
});
</script>

<style scoped>
/* 全局容器 */
.bookshelf-container {
  min-height: 100vh;
  background: 
    linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6)),
    url('/bookshelf-bg.jpg') center/cover fixed;
  backdrop-filter: blur(0);
  display: flex;
  flex-direction: column;
}

/* 顶部导航栏 */
.app-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.05);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 5%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 70px;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 32px;
  color: #667eea;
}

.app-title {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.nav-tabs {
  display: flex;
  gap: 8px;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: #606266;
  transition: all 0.3s ease;
  position: relative;
}

.nav-tab:hover {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.nav-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.nav-tab .el-icon {
  font-size: 18px;
}

.coming-soon {
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(255, 152, 0, 0.1);
  color: #ff9800;
  border-radius: 4px;
  font-weight: 600;
}

.nav-tab.active .coming-soon {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

/* 主内容区 */
.main-content {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 40px 5%;
}

/* 导入区域 */
.import-area {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 3px dashed rgba(102, 126, 234, 0.3);
  border-radius: 24px;
  padding: 60px 40px;
  text-align: center;
  margin-bottom: 40px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.import-area:hover,
.import-area.drag-over {
  border-color: #667eea;
  background: rgba(255, 255, 255, 1);
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(102, 126, 234, 0.2);
}

.import-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.upload-icon {
  font-size: 64px;
  color: #667eea;
  opacity: 0.8;
}

.import-content h2 {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin: 0;
}

.import-hint {
  color: #909399;
  font-size: 15px;
  margin: 0;
}

.import-area .el-button {
  margin-top: 8px;
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

/* 加载和空状态 */
.loading-container,
.empty-state {
  text-align: center;
  padding: 100px 40px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.loading-container .el-icon,
.empty-state .el-icon {
  font-size: 80px;
  color: #667eea;
  opacity: 0.6;
  margin-bottom: 24px;
}

.empty-state h3 {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 12px 0;
}

.empty-state p,
.loading-container p {
  font-size: 16px;
  color: #909399;
  margin: 0;
}

/* 书籍区域 */
.books-section {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 2px solid rgba(0, 0, 0, 0.05);
}

.section-header h2 {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin: 0;
}

.book-count {
  font-size: 16px;
  color: #909399;
  font-weight: 500;
}

/* 书籍网格 */
.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 24px;
}

.book-card {
  position: relative;
  transition: transform 0.3s ease;
}

.book-card:hover {
  transform: translateY(-8px);
}

.book-cover-wrapper {
  position: relative;
  cursor: pointer;
  margin-bottom: 12px;
}

.book-cover {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  position: relative;
}

.book-card:hover .book-cover {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.default-cover {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-letter {
  font-size: 72px;
  font-weight: 800;
  color: white;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.book-card:hover .cover-overlay {
  opacity: 1;
}

.play-icon {
  font-size: 48px;
  color: white;
}

.progress-ring {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 48px;
  height: 48px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 50%;
  padding: 6px;
}

.progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: white;
}

.book-info {
  padding: 0 4px;
}

.book-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 6px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
  min-height: 42px;
}

.book-author {
  font-size: 13px;
  color: #909399;
  margin: 0 0 8px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-progress {
  font-size: 12px;
  color: #667eea;
  margin: 0 0 8px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.progress-chapter {
  display: inline-block;
}

.book-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.format-badge {
  padding: 2px 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 6px;
  font-weight: 600;
}

.chapter-count {
  color: #909399;
}

.delete-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(245, 108, 108, 0.9);
  backdrop-filter: blur(10px);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4);
}

.book-card:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: #f56c6c;
  transform: scale(1.1);
}

.delete-btn .el-icon {
  font-size: 16px;
}

/* 占位视图 */
.placeholder-view {
  text-align: center;
  padding: 120px 40px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.placeholder-view .el-icon {
  font-size: 100px;
  color: #667eea;
  opacity: 0.4;
  margin-bottom: 24px;
}

.placeholder-view h2 {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 12px 0;
}

.placeholder-view p {
  font-size: 18px;
  color: #909399;
  margin: 0;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .book-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    height: auto;
    padding: 16px 5%;
    gap: 16px;
  }
  
  .nav-tabs {
    width: 100%;
    justify-content: center;
  }
  
  .nav-tab span:not(.coming-soon) {
    display: none;
  }
  
  .main-content {
    padding: 24px 4%;
  }
  
  .import-area {
    padding: 40px 24px;
  }
  
  .books-section {
    padding: 24px 16px;
  }
  
  .book-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 16px;
  }
  
  .cover-letter {
    font-size: 56px;
  }
}

@media (max-width: 480px) {
  .app-title {
    font-size: 20px;
  }
  
  .logo-icon {
    font-size: 28px;
  }
  
  .book-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }
  
  .book-title {
    font-size: 14px;
  }
  
  .cover-letter {
    font-size: 48px;
  }
}
</style>
