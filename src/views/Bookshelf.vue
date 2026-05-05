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

      <!-- ================= 书架视图 ================= -->
      <div v-show="activeTab === 'library'" class="library-view content-stack">
        <div class="summary panel">
          <div class="summary-left">
            <div class="summary-title">{{ auth.user?.nickname ? `欢迎回来，${auth.user.nickname}` : '欢迎来到 ETRead' }}</div>
          </div>
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-label">本地藏书</div>
              <div class="summary-value">{{ books.length }}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">云端书架</div>
              <div class="summary-value">{{ auth.user ? cloudShelfVisibleItems.length : '-' }}</div>
            </div>
          </div>
        </div>

        <!-- 导入区域 -->
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

        <!-- Loading -->
        <div v-if="loading" class="loading-container">
          <el-icon class="is-loading"><Loading /></el-icon>
          <p>加载书架中...</p>
        </div>

        <!-- Empty -->
        <div v-else-if="books.length === 0" class="empty-state">
          <el-icon><Reading /></el-icon>
          <h3>书架空空如也</h3>
          <p>导入你的第一本书开始阅读吧！</p>
        </div>

        <!-- 本地藏书 -->
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

              <button class="delete-btn" @click.stop="confirmDelete(book.id!)" title="删除书籍">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- 云端书架 -->
        <div class="cloud-shelf panel" v-if="!loading">
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

          <div v-else class="store-surface" v-loading="cloudShelfLoading">
            <div class="store-grid">
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
            </div>

            <div v-if="cloudShelfVisibleItems.length === 0 && !cloudShelfLoading" class="empty-state">
              <el-icon><Reading /></el-icon>
              <h3>暂无书籍</h3>
              <p>在书城详情页点击"收藏到书架"即可加入</p>
            </div>
          </div>
        </div>

        <!-- 阅读历史 -->
        <div class="reading-history panel" v-if="!loading && auth.user" v-loading="readingHistoryLoading">
          <div class="section-header">
            <h2>阅读历史</h2>
            <el-button class="auth-btn" size="small" @click="loadReadingHistory">刷新</el-button>
          </div>

          <div v-if="readingHistory.length === 0" class="empty-state">
            <el-icon><Reading /></el-icon>
            <h3>暂无阅读记录</h3>
            <p>开始阅读后会自动记录</p>
          </div>

          <div v-else class="history-list">
            <div v-for="item in readingHistory" :key="item.bookId" class="history-item" @click="openHistoryBook(item.bookId)">
              <div class="history-cover">
                <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" />
                <div v-else class="default-cover small">
                  <span class="cover-letter">{{ item.title?.[0]?.toUpperCase() || '?' }}</span>
                </div>
              </div>
              <div class="history-info">
                <div class="history-title">{{ item.title }}</div>
                <div class="history-author">{{ item.author }}</div>
                <div class="history-progress-bar">
                  <el-progress :percentage="item.displayPercentage || 0" :stroke-width="6" />
                </div>
                <div class="history-meta">
                  <span class="history-chapter">读到第 {{ item.displayChapter || 1 }} 章</span>
                  <span class="history-time">{{ formatReadTime(item.displayTime) }}</span>
                </div>
              </div>
              <div class="history-action">
                <el-button type="primary" size="small" round>继续阅读</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- ================= 书架视图结束 ================= -->

      <!-- ================= 书城视图 ================= -->
      <div v-show="activeTab === 'store'" class="store-view content-stack">
        <div class="store-surface" v-loading="hotBooksLoading">
          <!-- 热门推荐区域 -->
          <div class="hot-recommend-section" v-if="hotBooks.length > 0 || recommendBooks.length > 0">
            <div class="hr-section" v-if="hotBooks.length > 0">
              <div class="hr-header">
                <span class="hr-title">🔥 热门书籍</span>
              </div>
              <div class="hr-grid">
                <div v-for="item of hotBooks.slice(0, 5)" :key="item.serverBookId" class="hr-item" @click="openStoreDetail(item.serverBookId)">
                  <div class="hr-cover">
                    <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" />
                    <div v-else class="default-cover">
                      <span class="cover-letter">{{ item.title[0]?.toUpperCase() || '?' }}</span>
                    </div>
                  </div>
                  <div class="hr-meta">
                    <div class="title" :title="item.title">{{ item.title }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="hr-section" v-if="recommendBooks.length > 0">
              <div class="hr-header">
                <span class="hr-title">✨ 为你推荐</span>
              </div>
              <div class="hr-grid">
                <div v-for="item of recommendBooks.slice(0, 5)" :key="item.serverBookId" class="hr-item" @click="openStoreDetail(item.serverBookId)">
                  <div class="hr-cover">
                    <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" />
                    <div v-else class="default-cover">
                      <span class="cover-letter">{{ item.title[0]?.toUpperCase() || '?' }}</span>
                    </div>
                  </div>
                  <div class="hr-meta">
                    <div class="title" :title="item.title">{{ item.title }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

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

          <div class="store-grid">
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
      </div>
      <!-- ================= 书城视图结束 ================= -->

      <!-- ================= 上传视图 ================= -->
      <div v-show="activeTab === 'upload'" class="upload-embed">
        <StoreUpload @uploaded="onUploadDone" />
      </div>
      <!-- ================= 上传视图结束 ================= -->

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
import { searchBooks, getBookshelf, removeFromShelf, listAllTags, getHotList, getRecommend, getBookDetail } from '@/api/book';
import { getProgressHistory } from '@/api/progress';
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

const hotBooksLoading = ref(false);
const hotBooks = ref<ServerBook[]>([]);
const recommendBooks = ref<ServerBook[]>([]);

const readingHistoryLoading = ref(false);
const readingHistory = ref<any[]>([]);

const availableStoreTags = ref<string[]>([]);

async function loadStoreTags() {
  try {
    const res = await listAllTags();
    if (res.data?.code === 200 && Array.isArray(res.data.data)) {
      availableStoreTags.value = res.data.data
        .map((x: any) => String(x?.tagName || '').trim())
        .filter(Boolean);
    } else {
      availableStoreTags.value = [];
    }
  } catch {
    availableStoreTags.value = [];
  }
}

async function loadHotAndRecommend() {
  hotBooksLoading.value = true;
  try {
    const [hotRes, recRes] = await Promise.all([
      getHotList(10),
      getRecommend(10)
    ]);

    console.log('[Bookshelf] 热门API响应:', hotRes);
    console.log('[Bookshelf] 推荐API响应:', recRes);

    if (hotRes.data?.code === 200 && Array.isArray(hotRes.data.data)) {
      hotBooks.value = hotRes.data.data.map((b: any) => ({
        serverBookId: Number(b.bookId),
        title: b.title,
        author: b.author,
        coverUrl: b.coverUrl || b.cover_url || undefined,
        description: b.description || undefined,
        addTime: Date.now()
      })).filter((b: ServerBook) => Number.isFinite(b.serverBookId));
      console.log('[Bookshelf] 解析后热门书籍:', hotBooks.value);
    } else {
      console.warn('[Bookshelf] 热门API返回异常:', hotRes.data);
    }

    if (recRes.data?.code === 200 && Array.isArray(recRes.data.data)) {
      recommendBooks.value = recRes.data.data.map((b: any) => ({
        serverBookId: Number(b.bookId),
        title: b.title,
        author: b.author,
        coverUrl: b.coverUrl || b.cover_url || undefined,
        description: b.description || undefined,
        addTime: Date.now()
      })).filter((b: ServerBook) => Number.isFinite(b.serverBookId));
      console.log('[Bookshelf] 解析后推荐书籍:', recommendBooks.value);
    } else {
      console.warn('[Bookshelf] 推荐API返回异常:', recRes.data);
    }
  } catch (e) {
    console.error('[Bookshelf] 加载热门推荐失败:', e);
  } finally {
    hotBooksLoading.value = false;
  }
}

async function loadReadingHistory() {
  if (!auth.user) return;

  readingHistoryLoading.value = true;
  try {
    const res = await getProgressHistory();
    if (res.data?.code === 200 && Array.isArray(res.data.data)) {
      const historyList = res.data.data;

      // 获取每本书的详细信息
      const historyWithDetails = await Promise.all(
        historyList.map(async (item) => {
          // 处理 readPercentage - 后端可能返回 0-1 的小数或 0-100 的百分比
          let percentage = item.readPercentage || 0;
          if (percentage <= 1) {
            percentage = percentage * 100; // 转换为百分比
          }

          // 处理章节数 - 从0开始
          const chapterNum = (item.currentChapterId || 0) + 1;

          // 处理时间
          let lastReadTime = item.lastReadTime;
          if (lastReadTime && typeof lastReadTime === 'object') {
            lastReadTime = new Date(lastReadTime).toISOString();
          }

          try {
            // 从服务器获取书籍详情
            const bookRes = await getBookDetail(item.bookId);
            if (bookRes.data?.code === 200 && bookRes.data?.data) {
              return {
                ...item,
                displayPercentage: Math.round(percentage),
                displayChapter: chapterNum,
                displayTime: lastReadTime,
                title: bookRes.data.data.title || '未知书籍',
                author: bookRes.data.data.author || '未知作者',
                coverUrl: bookRes.data.data.coverUrl || bookRes.data.data.cover_url || null
              };
            }
          } catch (e) {
            console.warn('[Bookshelf] 获取书籍详情失败:', item.bookId);
          }
          return {
            ...item,
            displayPercentage: Math.round(percentage),
            displayChapter: chapterNum,
            displayTime: lastReadTime,
            title: `书籍 ${item.bookId}`,
            author: '未知作者',
            coverUrl: null
          };
        })
      );

      // 按最后阅读时间排序
      historyWithDetails.sort((a, b) => {
        const timeA = a.displayTime ? new Date(a.displayTime).getTime() : 0;
        const timeB = b.displayTime ? new Date(b.displayTime).getTime() : 0;
        return timeB - timeA;
      });

      readingHistory.value = historyWithDetails;
      console.log('[Bookshelf] 阅读历史:', readingHistory.value);
    }
  } catch (e) {
    console.error('[Bookshelf] 加载阅读历史失败:', e);
  } finally {
    readingHistoryLoading.value = false;
  }
}

function openHistoryBook(bookId: number) {
  router.push(`/online/${bookId}`);
}

function formatReadTime(time: string | Date | undefined) {
  if (!time) return '未知';

  let date: Date;
  if (time instanceof Date) {
    date = time;
  } else if (typeof time === 'string') {
    date = new Date(time);
  } else {
    return '未知';
  }

  if (isNaN(date.getTime())) return '未知';

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${Math.floor(days / 30)}月前`;
}

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

  if (raw.length === 0) return [];

  const tagSet = new Set(availableStoreTags.value);

  const pick = (input: string) => {
    const t = String(input || '').trim();
    if (!t) return '';

    const candidates: string[] = [t];
    const quoted = t.length >= 2 && t.startsWith('"') && t.endsWith('"');

    if (quoted) {
      const unquoted = t.slice(1, -1).trim();
      if (unquoted) candidates.push(unquoted);
    } else {
      candidates.push(`"${t}"`);
    }

    for (const c of candidates) {
      if (tagSet.has(c)) return c;
    }

    return quoted ? (t.slice(1, -1).trim() || t) : t;
  };

  return Array.from(new Set(raw.map(pick).filter(Boolean)));
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

watch(activeTab, async (v) => {
  if (v === 'store') {
    await loadStoreTags();
    await loadHotAndRecommend();
    runStoreSearch(1);
  }
  if (v === 'library') {
    loadCloudShelf();
    loadReadingHistory();
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
    if (activeTab.value === 'library') {
      await loadCloudShelf();
      await loadReadingHistory();
    }
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
  background: linear-gradient(180deg, #faf8f5 0%, #f3efe9 100%);
  display: flex;
  flex-direction: column;
}

.app-header,
.main-content {
  position: relative;
  z-index: 1;
}

/* 顶部导航栏 */
.app-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(61, 54, 48, 0.06);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-sm);
}

.app-header,
.main-content {
  position: relative;
  z-index: 1;
}


/* 顶部导航栏 */
.app-header {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px) saturate(1.2);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
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
  color: #8b7355;
}

.app-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--primary-color);
  margin: 0;
}

.nav-tabs {
  display: flex;
  gap: 6px;
  padding: 6px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(10px) saturate(1.15);
  box-shadow: 0 10px 26px rgba(16, 24, 40, 0.10);
}

.content-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel {
  background: #ffffff;
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.summary {
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.summary-left {
  min-width: 0;
}

.summary-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-sub {
  margin-top: 6px;
  font-size: 13px;
  color: rgba(58, 63, 85, 0.78);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-cards {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.summary-card {
  min-width: 100px;
  padding: 12px 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  border: 1px solid rgba(102, 126, 234, 0.12);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.08);
  text-align: center;
  transition: all var(--transition-normal);
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.15);
}

.summary-label {
  font-size: 12px;
  color: rgba(90, 95, 117, 0.9);
  font-weight: 700;
}

.summary-value {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 900;
  color: #303133;
}

.store-surface {
  padding: 20px;
  background: #ffffff;
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.hot-recommend-section {
  margin-bottom: 20px;
}

.hr-section {
  margin-bottom: 16px;
}

.hr-header {
  margin-bottom: 12px;
}

.hr-title {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}

.hr-grid {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.hr-item {
  flex: 0 0 100px;
  cursor: pointer;
  text-align: center;
}

.hr-cover {
  width: 100px;
  height: 140px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  margin-bottom: 8px;
}

.hr-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hr-meta .title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 书城样式 */
.store-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px;
  border-radius: 14px;
  background: #f8f9fc;
  border: 1px solid rgba(0, 0, 0, 0.04);
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
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}
.store-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 14px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  transition: all var(--transition-normal);
}

.store-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}
.store-cover {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  background: linear-gradient(135deg, #8b7355 0%, #6b5640 100%);
}
.store-cover img { width: 100%; height: 100%; object-fit: cover; }
.store-meta .title { font-weight: 700; color: #303133; }
.store-meta .author { font-size: 12px; color: #909399; }
.store-item { cursor: pointer; }

.cloud-shelf {
  padding: 20px;
}

.reading-history {
  padding: 20px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.25s ease;
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.history-item:hover {
  background: rgba(102, 126, 234, 0.08);
  transform: translateX(6px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
}

.history-cover {
  flex-shrink: 0;
  width: 70px;
  height: 100px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.history-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.default-cover.small {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #8b7355 0%, #6b5640 100%);
  height: 100%;
}

.default-cover.small .cover-letter {
  font-size: 28px;
  font-weight: 800;
  color: white;
}

.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.history-title {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-author {
  font-size: 13px;
  color: #909399;
}

.history-progress-bar {
  margin-top: 4px;
}

.history-progress-bar :deep(.el-progress-bar__outer) {
  background-color: rgba(102, 126, 234, 0.15);
}

.history-progress-bar :deep(.el-progress-bar__inner) {
  background: linear-gradient(135deg, #8b7355 0%, #6b5640 100%);
}

.history-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #909399;
}

.history-chapter {
  color: #8b7355;
  font-weight: 600;
}

.history-action {
  flex-shrink: 0;
}

.history-action .el-button {
  background: linear-gradient(135deg, #8b7355 0%, #6b5640 100%);
  border: none;
  font-weight: 600;
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
  margin-top: 16px;
  display: flex;
  justify-content: center;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.store-pagination :deep(.el-pagination.is-background .btn-prev),
.store-pagination :deep(.el-pagination.is-background .btn-next),
.store-pagination :deep(.el-pagination.is-background .el-pager li) {
  min-width: 32px;
  height: 32px;
  line-height: 32px;
  border-radius: 8px;
  font-weight: 500;
  color: #606266;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.store-pagination :deep(.el-pagination.is-background .el-pager li.is-active) {
  color: #fff;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  border-color: transparent;
}

.store-pagination :deep(.el-pagination.is-background .btn-prev:hover),
.store-pagination :deep(.el-pagination.is-background .btn-next:hover),
.store-pagination :deep(.el-pagination.is-background .el-pager li:hover) {
  color: var(--primary-color);
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
  background: linear-gradient(135deg, #8b7355 0%, #6b5640 100%);
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
  color: #8b7355;
  font-weight: 600;
}
.logout-btn:hover {
  color: #6b5640;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 14px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  color: rgba(48, 49, 51, 0.74);
  transition: transform .2s ease, background .2s ease, box-shadow .2s ease, color .2s ease, border-color .2s ease;
  position: relative;
}

.nav-tab:hover {
  background: rgba(102, 126, 234, 0.08);
  color: var(--primary-color);
  transform: translateY(-1px);
}

.nav-tab.active {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: #fff;
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.25);
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
  padding: 24px 5% 32px;
}


/* 导入区域 */
.import-area {
  background: #ffffff;
  backdrop-filter: blur(16px);
  border: 2px dashed rgba(102, 126, 234, 0.25);
  border-radius: 20px;
  padding: 48px 32px;
  text-align: center;
  margin-bottom: 32px;
  transition: all var(--transition-normal);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.import-area:hover,
.import-area.drag-over {
  border-color: var(--primary-color);
  background: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.15);
}

.import-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.upload-icon {
  font-size: 64px;
  color: #8b7355;
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
  padding: 60px 32px;
  background: #ffffff;
  backdrop-filter: blur(16px);
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.loading-container .el-icon,
.empty-state .el-icon {
  font-size: 64px;
  color: var(--primary-color);
  opacity: 0.5;
  margin-bottom: 20px;
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.empty-state p,
.loading-container p {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

/* 书籍区域 */
.books-section {
  background: #ffffff;
  backdrop-filter: blur(16px);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.section-header h2 {
  font-size: 20px;
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
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 20px;
}

.book-card {
  position: relative;
  border-radius: 16px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.book-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
}

.book-cover-wrapper {
  position: relative;
  cursor: pointer;
  margin-bottom: 12px;
}

.book-cover {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  transition: all var(--transition-normal);
  position: relative;
}

.book-card:hover .book-cover {
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.default-cover {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-letter {
  font-size: 42px;
  font-weight: 700;
  color: white;
  opacity: 0.9;
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
  padding: 4px;
}

.book-title {
  font-size: 14px;
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
  min-height: 40px;
}

.book-author {
  font-size: 12px;
  color: #909399;
  margin: 0 0 6px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-progress {
  font-size: 12px;
  color: var(--primary-color);
  margin: 0 0 6px 0;
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
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: white;
  border-radius: 6px;
  font-weight: 600;
  font-size: 11px;
}

.chapter-count {
  color: #909399;
}

.delete-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(245, 108, 108, 0.85);
  backdrop-filter: blur(8px);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all var(--transition-normal);
  box-shadow: 0 4px 10px rgba(245, 108, 108, 0.3);
}

.book-card:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: #f56c6c;
  transform: scale(1.1);
}

.delete-btn .el-icon {
  font-size: 14px;
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
  color: #8b7355;
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
