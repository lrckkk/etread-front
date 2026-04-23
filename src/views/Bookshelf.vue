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
            @click="(activeTab = 'store', loadMyBooks())"
          >
            <el-icon><ShoppingCart /></el-icon>
            <span>书城</span>

          </button>
          <button 
            class="nav-tab" 
            :class="{ active: activeTab === 'upload' }"
            @click="activeTab = 'upload'"
          >
            <el-icon><Upload /></el-icon>
            <span>上传</span>

          </button>
        </nav>
        <div class="user-section">
          <template v-if="auth.user">
            <el-avatar :src="auth.user.avatar" :size="40" />
            <span class="user-nickname">{{ auth.user.nickname }}</span>
            <el-button class="auth-btn" @click="onLogout"><span>退出</span></el-button>
          </template>
          <el-button v-else class="auth-btn" @click="router.push('/auth')"><span>登录/注册</span></el-button>
        </div>
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

        <div class="cloud-shelf" v-if="!loading">
          <div class="section-header">
            <h2>云端书架</h2>
            <div class="cloud-actions">
              <el-button class="auth-btn" :disabled="!auth.user" :loading="cloudShelfLoading" @click="loadCloudShelf">刷新</el-button>
            </div>
          </div>

          <div v-if="!auth.user" class="empty-state">
            <el-icon><Reading /></el-icon>
            <h3>未登录</h3>
            <p>登录后可查看加入书架的线上书籍</p>
          </div>

          <div v-else class="store-grid" v-loading="cloudShelfLoading">
            <div v-for="item of cloudShelfVisibleItems" :key="item.serverBookId" class="store-item" @click="openStoreDetail(item.serverBookId, 'library')">
              <div class="store-cover">
                <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" />
                <div v-else class="default-cover">
                  <span class="cover-letter">{{ item.title[0]?.toUpperCase() || '?' }}</span>
                </div>
              </div>
              <div class="store-meta">
                <div class="title" :title="item.title">{{ item.title }}</div>
                <div class="author" :title="item.author || '佚名'">{{ item.author || '佚名' }}</div>
              </div>
              <el-button class="danger-mini" @click.stop="removeCloudBook(item.serverBookId)">移除</el-button>
            </div>

            <div v-if="cloudShelfVisibleItems.length === 0 && !cloudShelfLoading" class="empty-state">
              <el-icon><Reading /></el-icon>
              <h3>暂无书籍</h3>
              <p>在书城详情页点击“收藏到书架”即可加入</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 书城视图：搜索 + 列表 -->
  <div v-show="activeTab === 'store'" class="store-view">
    <div class="store-toolbar">
      <el-input v-model="storeSearch.title" placeholder="书名" :prefix-icon="Search" clearable />
      <el-input v-model="storeSearch.author" placeholder="作者" clearable />
      <el-select v-model="storeSearch.minscore" placeholder="最低评分" clearable>
        <el-option v-for="s in ratingOptions" :key="`min_${s}`" :label="s.toFixed(1)" :value="s" />
      </el-select>
      <el-select v-model="storeSearch.maxscore" placeholder="最高评分" clearable>
        <el-option v-for="s in ratingOptions" :key="`max_${s}`" :label="s.toFixed(1)" :value="s" />
      </el-select>
      <el-input v-model="storeSearch.tagsStr" placeholder="标签（逗号分隔）" clearable />
      <el-button class="auth-btn" :loading="storeSearching" @click="runStoreSearch(1)">搜索</el-button>
      <el-button class="auth-btn" :disabled="storeSearching" @click="resetStoreSearch">重置</el-button>
    </div>
    <div class="store-grid" v-loading="storeSearching">
      <div v-for="item of storeVisibleItems" :key="item.serverBookId" class="store-item" @click="openStoreDetail(item.serverBookId)">
        <div class="store-cover">
          <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" />
          <div v-else class="default-cover">
            <span class="cover-letter">{{ item.title[0]?.toUpperCase() || '?' }}</span>
          </div>
        </div>
        <div class="store-meta">
          <div class="title" :title="item.title">{{ item.title }}</div>
          <div class="author" :title="item.author || '佚名'">{{ item.author || '佚名' }}</div>
        </div>
      </div>
      <div v-if="storeVisibleItems.length === 0 && !storeSearching" class="empty-state">
        <el-icon><Reading /></el-icon>
        <h3>暂无书籍</h3>
        <p>可尝试调整搜索条件，或清空条件后重新搜索</p>
      </div>
    </div>
    <div class="store-pagination" v-if="storePageCount > 1">
      <el-pagination
        background
        layout="prev, pager, next"
        :page-count="storePageCount"
        :page-size="storePageSize"
        :current-page="storePage"
        @current-change="onStorePageChange"
      />
    </div>
  </div>

      <!-- 上传视图：直接嵌入上传页面 -->
  <div v-show="activeTab === 'upload'" class="upload-embed">
    <StoreUpload @uploaded="onUploadDone" />
  </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUnifiedLibrary } from '@/composables/useUnifiedLibrary';
import { useProgress } from '@/composables/useProgress';
import { useAuthStore } from '@/store/auth';
import { ElMessage, ElMessageBox } from 'element-plus';
import { logout } from '@/api/auth';
import { 
  Upload, 
  Delete, 
  Loading, 
  Reading, 
  ShoppingCart,
  FolderOpened,
  VideoPlay,
  Search
} from '@element-plus/icons-vue';
import { searchBooks, getBookshelf, removeFromShelf } from '@/api/book';
import { db, type ServerBook } from '@/db';
import StoreUpload from '@/views/StoreUpload.vue';

const { books, loading, importing, importProgress, loadBooks, importBook, deleteBook } = useUnifiedLibrary();
const { getProgressPercentage, getProgressChapterTitle } = useProgress();
const router = useRouter();
const auth = useAuthStore();
const serverBooks = ref<ServerBook[]>([]);

const storeSearching = ref(false);
const storePage = ref(1);
const storePageSize = 10;
const storeHasNext = ref(false);
const ratingOptions = Array.from({ length: 11 }, (_, i) => i * 0.5);

const cloudShelfLoading = ref(false);
const cloudShelfBooks = ref<ServerBook[]>([]);
const cloudShelfVisibleItems = computed(() => cloudShelfBooks.value.filter(b => (b.status ?? 1) === 1));

const storeSearch = ref<{
  title: string;
  author: string;
  minscore: number | null;
  maxscore: number | null;
  tagsStr: string;
}>({
  title: '',
  author: '',
  minscore: null,
  maxscore: null,
  tagsStr: ''
});

function openStoreDetail(id: number, from: 'store' | 'library' = 'store') {
  router.push({
    path: `/store/detail/${id}`,
    query: from === 'library' ? { from: 'shelf' } : {}
  });
}

async function loadMyBooks() {
  await runStoreSearch(1);
}

const storeVisibleItems = computed(() => serverBooks.value.filter(b => (b.status ?? 1) === 1));

const storePageCount = computed(() => {
  if (storePage.value <= 1) return storeHasNext.value ? 2 : 1;
  return storeHasNext.value ? storePage.value + 1 : storePage.value;
});

function normalizeTags(v: string) {
  const raw = (v || '')
    .split(/[,，]/)
    .map(s => s.trim())
    .filter(Boolean);

  const normalized = raw.map((t) => {
    if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t;
    return `"${t}"`;
  });

  return Array.from(new Set(normalized));
}

async function runStoreSearch(page = 1) {
  storeSearching.value = true;
  try {
    const tags = normalizeTags(storeSearch.value.tagsStr);

    let minscore: number | null = typeof storeSearch.value.minscore === 'number' ? storeSearch.value.minscore : null;
    let maxscore: number | null = typeof storeSearch.value.maxscore === 'number' ? storeSearch.value.maxscore : null;
    if (typeof minscore === 'number' && typeof maxscore === 'number' && minscore > maxscore) {
      const t = minscore;
      minscore = maxscore;
      maxscore = t;
    }

    const dto: any = {
      title: storeSearch.value.title?.trim() || undefined,
      author: storeSearch.value.author?.trim() || undefined,
      minscore: typeof minscore === 'number' ? minscore : undefined,
      maxscore: typeof maxscore === 'number' ? maxscore : undefined,
      tags: tags.length ? tags : undefined
    };

    const res = await searchBooks(dto, page, storePageSize);
    if (res.data?.code !== 200) {
      ElMessage.error(res.data?.msg || '搜索失败');
      serverBooks.value = [];
      storeHasNext.value = false;
      storePage.value = 1;
      return;
    }

    const vo = res.data?.data;
    const list: any[] = (vo?.resultBooks || vo?.ResultBooks || []) as any[];
    const mapped: ServerBook[] = list
      .filter((b) => (b?.status ?? 1) === 1)
      .map((b) => {
        const addTime = b.createTime ? Date.parse(b.createTime) : Date.now();
        return {
          serverBookId: Number(b.id),
          title: b.title,
          author: b.author,
          coverUrl: b.coverUrl || b.cover_url || undefined,
          description: b.description || undefined,
          tags: b.tags || undefined,
          publisher: b.publisher || undefined,
          status: typeof b.status === 'number' ? b.status : undefined,
          addTime: Number.isFinite(addTime) ? addTime : Date.now()
        };
      })
      .filter((b) => Number.isFinite(b.serverBookId) && b.serverBookId > 0);

    for (const b of mapped) {
      try {
        await db.serverBooks.put(b);
      } catch {}
    }

    serverBooks.value = mapped;
    storeHasNext.value = mapped.length >= storePageSize;
    storePage.value = page;
  } catch (e: any) {
    ElMessage.error(e?.message ? String(e.message) : '搜索失败');
  } finally {
    storeSearching.value = false;
  }
}

function resetStoreSearch() {
  storeSearch.value = { title: '', author: '', minscore: null, maxscore: null, tagsStr: '' };
  runStoreSearch(1);
}

function onStorePageChange(p: number) {
  runStoreSearch(p);
}

function onUploadDone() {
  activeTab.value = 'store';
  runStoreSearch(1);
}

async function loadCloudShelf() {
  const uid = auth.user?.id ? Number(auth.user.id) : 0;
  if (!uid) {
    cloudShelfBooks.value = [];
    return;
  }
  cloudShelfLoading.value = true;
  try {
    const res = await getBookshelf(uid);
    if (res.data?.code !== 200 || !Array.isArray(res.data.data)) {
      cloudShelfBooks.value = [];
      return;
    }
    const list = res.data.data;
    cloudShelfBooks.value = list.map((b: any) => {
      const addTime = b.createTime ? Date.parse(b.createTime) : Date.now();
      return {
        serverBookId: Number(b.id),
        title: b.title,
        author: b.author,
        coverUrl: b.coverUrl || b.cover_url || undefined,
        description: b.description || undefined,
        tags: b.tags || undefined,
        publisher: b.publisher || undefined,
        status: typeof b.status === 'number' ? b.status : undefined,
        addTime: Number.isFinite(addTime) ? addTime : Date.now()
      };
    }).filter((x: ServerBook) => Number.isFinite(x.serverBookId) && x.serverBookId > 0);
  } catch {
    cloudShelfBooks.value = [];
  } finally {
    cloudShelfLoading.value = false;
  }
}

async function removeCloudBook(bookId: number) {
  try {
    const res = await removeFromShelf(bookId);
    if (res.data?.code !== 200) {
      ElMessage.error(res.data?.msg || '移除失败');
      return;
    }
    ElMessage.success('已移除');
    await loadCloudShelf();
  } catch (e: any) {
    ElMessage.error(e?.message ? String(e.message) : '移除失败');
  }
}

async function onLogout(): Promise<void> {
  try {
    const token = auth.user?.token || localStorage.getItem('auth_token') || '';
    if (token) {
      await logout(token);
    }
    auth.clear();
    ElMessage.success('已退出');
  } catch (error) {
    auth.clear();
    ElMessage.success('已退出');
  }
}

const fileInput = ref<HTMLInputElement | null>(null);
const progressMap = ref<Map<number, number>>(new Map());
const progressTextMap = ref<Map<number, string>>(new Map());
const coverUrlCache = ref<Map<number, string>>(new Map());
const isDragOver = ref(false);
const activeTab = ref('library');

watch(activeTab, (v) => {
  if (v === 'store') {
    runStoreSearch(1);
  }
  if (v === 'library') {
    loadCloudShelf();
  }
});

watch(
  () => auth.user?.id,
  () => {
    if (activeTab.value === 'library') {
      loadCloudShelf();
    }
  }
);


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
    const def = localStorage.getItem('bookshelf_default_tab');
    if (def) {
      activeTab.value = def;
      localStorage.removeItem('bookshelf_default_tab');
    }
    if (activeTab.value === 'store') await loadMyBooks();
    if (activeTab.value === 'library') await loadCloudShelf();
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

/* 书城样式 */
.store-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.08));
  border: 1px solid rgba(255,255,255,.35);
  box-shadow: 0 10px 30px rgba(16,24,40,.12);
  backdrop-filter: blur(10px);
}

.store-toolbar :deep(.el-input),
.store-toolbar :deep(.el-select) {
  width: 180px;
}

.store-toolbar :deep(.el-input__wrapper),
.store-toolbar :deep(.el-select__wrapper) {
  border-radius: 12px;
  background: rgba(255,255,255,.94);
  box-shadow: 0 4px 14px rgba(102,126,234,.12);
  border: 1px solid rgba(102,126,234,.18);
  padding-left: 10px;
  transition: all .25s ease;
}

.store-toolbar :deep(.el-input__inner),
.store-toolbar :deep(.el-select__input) {
  font-weight: 600;
  color: #3a3f55;
}

.store-toolbar :deep(.el-input__wrapper.is-focus),
.store-toolbar :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 2px rgba(102,126,234,.22), 0 8px 18px rgba(102,126,234,.2);
  border-color: rgba(102,126,234,.45);
}
.store-grid {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.store-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.store-cover {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.store-cover img { width: 100%; height: 100%; object-fit: cover; }
.store-meta .title { font-weight: 700; color: #303133; }
.store-meta .author { font-size: 12px; color: #909399; }
.store-item { cursor: pointer; }

.cloud-shelf {
  margin-top: 18px;
}

.danger-mini {
  margin-top: 10px;
  width: 100%;
  border-radius: 12px;
  border: none;
  color: #fff;
  font-weight: 700;
  background: linear-gradient(135deg, #f56c6c 0%, #f08c8c 100%);
  box-shadow: 0 8px 18px rgba(245,108,108,.25);
}

.danger-mini:hover {
  filter: brightness(1.05);
}

.store-pagination {
  margin-top: 14px;
  display: flex;
  justify-content: center;
  padding: 10px 12px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.08));
  border: 1px solid rgba(255,255,255,.35);
  box-shadow: 0 10px 24px rgba(16,24,40,.1);
  backdrop-filter: blur(8px);
}

.store-pagination :deep(.el-pagination.is-background .btn-prev),
.store-pagination :deep(.el-pagination.is-background .btn-next),
.store-pagination :deep(.el-pagination.is-background .el-pager li) {
  min-width: 34px;
  height: 34px;
  line-height: 34px;
  border-radius: 10px;
  font-weight: 700;
  color: #5a5f75;
  background: rgba(255,255,255,.9);
  border: 1px solid rgba(102,126,234,.15);
  box-shadow: 0 3px 10px rgba(102,126,234,.12);
}

.store-pagination :deep(.el-pagination.is-background .el-pager li.is-active) {
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  box-shadow: 0 8px 16px rgba(102,126,234,.35);
}

.store-pagination :deep(.el-pagination.is-background .btn-prev:hover),
.store-pagination :deep(.el-pagination.is-background .btn-next:hover),
.store-pagination :deep(.el-pagination.is-background .el-pager li:hover) {
  color: #667eea;
  transform: translateY(-1px);
}

.user-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-nickname {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.auth-btn {
  padding: 8px 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: .5px;
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.35);
  transition: transform .2s ease, filter .2s ease, box-shadow .2s ease;
}
.auth-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
  box-shadow: 0 10px 24px rgba(102, 126, 234, 0.45);
}
.auth-btn:active {
  transform: translateY(0);
}

.logout-btn {
  color: #667eea;
  font-weight: 600;
}
.logout-btn:hover {
  color: #764ba2;
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

.upload-embed {
  margin-top: -16px;
}

.upload-embed :deep(.upload-container) {
  min-height: unset;
  padding-top: 24px;
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
