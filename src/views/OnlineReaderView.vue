<template>
  <div class="online-container" :class="{ dark: darkMode }">
    <el-card class="online-card">
      <div class="topbar">
        <div class="top-title">{{ book?.title || '在线阅读' }}</div>
        <div class="top-controls">
          <div class="ctrl">
            <span class="ctrl-label">夜间</span>
            <el-switch v-model="darkMode" />
          </div>
          <div class="ctrl slider">
            <span class="ctrl-label">字号</span>
            <el-slider v-model="fontSize" :min="14" :max="28" :step="1" :show-tooltip="false" />
          </div>
          <div class="ctrl slider">
            <span class="ctrl-label">行距</span>
            <el-slider v-model="lineHeight" :min="1.4" :max="2.4" :step="0.1" :show-tooltip="false" />
          </div>
        </div>
        <div class="top-actions">
          <el-button class="brand-btn" @click="openComments">段评</el-button>
          <el-button class="brand-btn" @click="backToDetail">返回详情</el-button>
          <el-button class="brand-btn" @click="backToStore">返回书城</el-button>
        </div>
      </div>

      <div class="layout">
        <div class="toc">
          <div class="toc-title">目录</div>
          <div class="toc-list">
            <button
                v-for="c in chapters"
                :key="c.chapterId"
                class="toc-item"
                :class="{ active: c.chapterId === currentChapterId }"
                @click="openChapter(c.chapterId)"
            >
              <span class="toc-text">{{ c.chapterTitle }}</span>
            </button>
          </div>
        </div>

        <div class="content">
          <div class="content-title">{{ currentTitle }}</div>
          <div ref="contentRef" class="content-body" :style="readerStyles" v-html="currentHtml" @click="onContentClick" @scroll="onScroll"></div>
        </div>
      </div>

      <el-drawer v-model="commentDrawer" direction="rtl" size="420px" :with-header="false">
        <div class="comment-panel">
          <div class="comment-head">
            <div class="comment-title">段评</div>
            <div class="comment-sub">{{ currentTitle || '未选择章节' }}</div>
          </div>

          <div class="comment-selected" v-if="selectedParagraphId">
            <div class="comment-selected-label">段落内容</div>
            <div class="comment-selected-id">{{ selectedParagraphText || '（空段落）' }}</div>
          </div>

          <div class="comment-editor">
            <el-input v-model="commentText" type="textarea" :rows="3" placeholder="写下你的段评..." />
            <div class="comment-editor-actions">
              <el-button class="brand-btn" :disabled="!canPublish" @click="publishComment">发布</el-button>
              <el-button @click="clearSelectedParagraph">取消选择</el-button>
            </div>
          </div>

          <div class="comment-section">
            <div class="section-title">热评</div>
            <div v-if="hotComments.length === 0" class="empty">暂无热评</div>
            <div v-for="c in hotComments" :key="c.id" class="comment-item">
              <div class="comment-content">{{ c.content }}</div>
              <div class="comment-meta">
                <span>👍 {{ c.likeCount || 0 }}</span>
                <el-button text class="like-btn" @click="toggleLike(c)">{{ c.liked ? '取消' : '点赞' }}</el-button>
              </div>
            </div>
          </div>

          <div class="comment-section">
            <div class="section-title">本段评论</div>
            <div v-if="paragraphComments.length === 0" class="empty">{{ selectedParagraphId ? '本段暂无评论' : '点击正文段落开始查看段评' }}</div>
            <div v-for="c in paragraphComments" :key="c.id" class="comment-item">
              <div class="comment-content">{{ c.content }}</div>
              <div class="comment-meta">
                <span>👍 {{ c.likeCount || 0 }}</span>
                <el-button text class="like-btn" @click="toggleLike(c)">{{ c.liked ? '取消' : '点赞' }}</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-drawer>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { db, type ServerBook, type ServerChapter } from '@/db';
import { fetchChapterCatalog, fetchChapterContents } from '@/api/chapter';
import { getBookInfoBase } from '@/api/book';
import { queryChapterComments, publishParagraphComment, likeComment, unlikeComment, type ParagraphComment } from '@/api/comment';
import { useProgress } from '@/composables/useProgress';

const route = useRoute();
const router = useRouter();

const bookId = computed(() => Number(route.params.bookId || 0));

const book = ref<ServerBook | null>(null);
const chapters = ref<ServerChapter[]>([]);
const currentChapterId = ref<number | null>(null);
const currentHtml = ref<string>('');

const darkMode = ref(false);
const fontSize = ref(18);
const lineHeight = ref(1.9);
const maxWidth = ref(900);

const readerStyles = computed(() => ({
  fontSize: `${fontSize.value}px`,
  lineHeight: String(lineHeight.value),
  maxWidth: `${maxWidth.value}px`
}));

const currentTitle = computed(() => {
  if (!currentChapterId.value) return '';
  const c = chapters.value.find(x => x.chapterId === currentChapterId.value);
  return c?.chapterTitle || '';
});

const { loadProgress, saveProgress } = useProgress();
const contentRef = ref<HTMLDivElement | null>(null);
let saveProgressTimer: number | null = null;

const currentChapterIndex = computed(() => {
  if (!currentChapterId.value) return 0;
  const idx = chapters.value.findIndex((c) => c.chapterId === currentChapterId.value);
  return idx >= 0 ? idx : 0;
});

function onScroll() {
  if (saveProgressTimer) {
    window.clearTimeout(saveProgressTimer);
  }
  saveProgressTimer = window.setTimeout(() => {
    saveOnlineProgress();
  }, 1000);
}

async function saveOnlineProgress() {
  if (!bookId.value || !contentRef.value) return;
  if (!currentChapterId.value) return;
  try {
    const scrollTop = contentRef.value.scrollTop;
    const title = currentTitle.value || `第 ${currentChapterIndex.value + 1} 章`;
    await saveProgress(bookId.value, currentChapterIndex.value, scrollTop, title);
  } catch {}
}

async function restoreOnlineProgress() {
  if (!bookId.value) return false;
  try {
    const p = await loadProgress(bookId.value);
    if (!p) return false;

    const idx = typeof p.chapterIndex === 'number' ? p.chapterIndex : 0;
    const target = chapters.value[Math.min(Math.max(idx, 0), Math.max(chapters.value.length - 1, 0))];
    if (!target) return false;

    await openChapter(target.chapterId, false);
    await nextTick();
    await new Promise((r) => setTimeout(r, 50));

    if (contentRef.value && typeof p.position === 'number') {
      contentRef.value.scrollTop = p.position;
    }

    return true;
  } catch {
    return false;
  }
}

function sanitizeHtml(raw: string): string {
  try {
    const doc = new DOMParser().parseFromString(raw || '', 'text/html');

    const blocked = doc.querySelectorAll('script, iframe, object, embed, link, meta, style');
    blocked.forEach(n => n.remove());

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    let node: Node | null = walker.currentNode;

    while (node) {
      const el = node as HTMLElement;
      const attrs = Array.from(el.attributes);
      for (const a of attrs) {
        const name = a.name.toLowerCase();
        const value = (a.value || '').trim();

        if (name.startsWith('on')) {
          el.removeAttribute(a.name);
          continue;
        }

        if (name === 'src' || name === 'href') {
          const v = value.toLowerCase();
          if (v.startsWith('javascript:') || v.startsWith('data:text/html')) {
            el.removeAttribute(a.name);
            continue;
          }
        }

        if (name === 'style') {
          el.removeAttribute(a.name);
          continue;
        }
      }

      if (el.tagName.toLowerCase() === 'a') {
        el.setAttribute('rel', 'noopener noreferrer');
        el.setAttribute('target', '_blank');
      }

      node = walker.nextNode();
    }

    return doc.body.innerHTML || '';
  } catch {
    return '';
  }
}

const SETTINGS_KEY = 'online_reader_settings';
watch([darkMode, fontSize, lineHeight, maxWidth], () => {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ darkMode: darkMode.value, fontSize: fontSize.value, lineHeight: lineHeight.value, maxWidth: maxWidth.value })
  );
});

function backToStore() {
  localStorage.setItem('bookshelf_default_tab', 'store');
  router.push('/');
}

function backToDetail() {
  router.push(`/store/detail/${bookId.value}`);
}

async function loadBookMeta() {
  const local = await db.serverBooks.get(bookId.value);
  if (local) {
    book.value = local;
    return;
  }
  try {
    const res = await getBookInfoBase(bookId.value);
    if (res.data?.code === 200 && res.data.data) {
      const b = res.data.data;
      const saved: ServerBook = {
        serverBookId: Number(b.id),
        title: b.title,
        author: b.author,
        coverUrl: b.coverUrl || undefined,
        description: b.description || undefined,
        addTime: Date.now()
      };
      await db.serverBooks.put({ ...(await db.serverBooks.get(bookId.value)), ...saved });
      book.value = await db.serverBooks.get(bookId.value) || saved;
    }
  } catch {}
}

async function syncCatalog() {
  const localChaps = await db.serverChapters.where('serverBookId').equals(bookId.value).toArray();
  const localTimeMap = new Map<number, number | undefined>();
  for (const c of localChaps) localTimeMap.set(c.chapterId, c.updateTime);

  try {
    const res = await fetchChapterCatalog(bookId.value);
    if (res.data?.code !== 200 || !res.data.data) return;

    const dto = res.data.data;
    const list = dto.bookChapters || dto.bookChapter || [];
    const mapped: ServerChapter[] = list.map((c: any) => ({
      chapterId: Number(c.id),
      serverBookId: bookId.value,
      chapterTitle: c.chapterTitle,
      sortOrder: Number(c.sortOrder || 0),
      updateTime: c.updateTime ? Date.parse(c.updateTime) : undefined
    }));

    await db.serverChapters.bulkPut(mapped);
    chapters.value = mapped.sort((a, b) => a.sortOrder - b.sortOrder);

    const remoteTimeMap = new Map<number, number | undefined>();
    for (const c of chapters.value) remoteTimeMap.set(c.chapterId, c.updateTime);

    const needUpdate: number[] = [];
    for (const c of chapters.value) {
      const localTime = localTimeMap.get(c.chapterId);
      const remoteTime = c.updateTime;
      if (!localTime || (remoteTime && localTime !== remoteTime)) {
        needUpdate.push(c.chapterId);
      }
    }

    if (needUpdate.length) {
      await fetchAndCacheContents(needUpdate, remoteTimeMap);
    }
  } catch {}
}

async function fetchAndCacheContents(chapterIds: number[], timeMap: Map<number, number | undefined>) {
  const chunkSize = 20;
  for (let i = 0; i < chapterIds.length; i += chunkSize) {
    const chunk = chapterIds.slice(i, i + chunkSize);
    try {
      const res = await fetchChapterContents(chunk);
      if (res.data?.code === 200 && res.data.data) {
        const list = res.data.data.contents || res.data.data;
        if (Array.isArray(list)) {
          await db.serverChapterContents.bulkPut(
            list.map((x: any) => ({
              chapterId: Number(x.chapterId),
              serverBookId: bookId.value,
              content: sanitizeHtml(x.content),
              updateTime: timeMap.get(Number(x.chapterId))
            }))
          );
        }
      }
    } catch {}
  }
}

async function openChapter(chapterId: number, resetScroll = true) {
  currentChapterId.value = chapterId;
  selectedParagraphId.value = '';
  commentText.value = '';
  refreshComments();

  const chapter = chapters.value.find(c => c.chapterId === chapterId);
  const remoteTime = chapter?.updateTime;

  const cached = await db.serverChapterContents.get(chapterId);
  if (cached?.content && (!remoteTime || cached.updateTime === remoteTime)) {
    currentHtml.value = sanitizeHtml(cached.content);
    await nextTick();
    if (resetScroll && contentRef.value) contentRef.value.scrollTop = 0;
    return;
  }

  try {
    const res = await fetchChapterContents([chapterId]);
    if (res.data?.code === 200 && res.data.data) {
      const list = res.data.data.contents || res.data.data;
      const item = Array.isArray(list) ? list[0] : null;
      if (item?.content) {
        await db.serverChapterContents.put({
          chapterId,
          serverBookId: bookId.value,
          content: sanitizeHtml(item.content),
          updateTime: remoteTime
        });
        currentHtml.value = sanitizeHtml(item.content);
        await nextTick();
        if (resetScroll && contentRef.value) contentRef.value.scrollTop = 0;
      }
    }
  } catch {
    ElMessage.error('章节加载失败');
  }
}

let prevHtmlOverflow = '';
let prevBodyOverflow = '';
let prevBodyOverscroll = '';

const commentDrawer = ref(false);
const selectedParagraphId = ref<string>('');
const selectedParagraphText = ref<string>('');
const commentText = ref('');
const hotComments = ref<ParagraphComment[]>([]);
const paragraphGroups = ref<{ paragraphId: string; comments: ParagraphComment[] }[]>([]);

const paragraphComments = computed(() => {
  const pid = selectedParagraphId.value;
  if (!pid) return [];
  const g = paragraphGroups.value.find(x => x.paragraphId === pid);
  return g?.comments || [];
});

const canPublish = computed(() => !!commentText.value.trim() && !!selectedParagraphId.value && !!currentChapterId.value);

function clearSelectedParagraph() {
  selectedParagraphId.value = '';
  selectedParagraphText.value = '';
  commentText.value = '';
}

async function refreshComments() {
  if (!commentDrawer.value) return;
  if (!bookId.value || !currentChapterId.value) return;
  try {
    const res = await queryChapterComments({ bookId: bookId.value, chapterId: currentChapterId.value, hotLimit: 3 });
    if (res.data?.code === 200 && res.data.data) {
      hotComments.value = res.data.data.hotComments || [];
      paragraphGroups.value = res.data.data.paragraphGroups || [];
    }
  } catch {}
}

function openComments() {
  commentDrawer.value = true;
  refreshComments();
}

function onContentClick(e: MouseEvent) {
  const el = e.target as HTMLElement | null;
  const p = el?.closest ? (el.closest('p') as HTMLElement | null) : null;
  const pid = p?.getAttribute('id') || '';
  if (!pid) return;

  const text = (p?.innerText || '').replace(/\s+/g, ' ').trim();
  selectedParagraphId.value = pid;
  selectedParagraphText.value = text.length > 180 ? `${text.slice(0, 180)}…` : text;

  if (!commentDrawer.value) commentDrawer.value = true;
  refreshComments();
}

async function publishComment() {
  if (!canPublish.value) return;
  try {
    const res = await publishParagraphComment({
      bookId: bookId.value,
      chapterId: currentChapterId.value as number,
      paragraphId: selectedParagraphId.value,
      content: commentText.value.trim()
    });
    if (res.data?.code === 200) {
      commentText.value = '';
      await refreshComments();
    }
  } catch {}
}

async function toggleLike(c: ParagraphComment) {
  try {
    const fn = c.liked ? unlikeComment : likeComment;
    const res = await fn({ chapterId: c.chapterId, commentId: c.id });
    if (res.data?.code === 200) {
      await refreshComments();
    }
  } catch {}
}

onMounted(async () => {
  try {
    prevHtmlOverflow = document.documentElement.style.overflow;
    prevBodyOverflow = document.body.style.overflow;
    prevBodyOverscroll = (document.body.style as any).overscrollBehavior || '';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    (document.body.style as any).overscrollBehavior = 'none';
  } catch {}

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.darkMode === 'boolean') darkMode.value = s.darkMode;
      if (typeof s.fontSize === 'number') fontSize.value = s.fontSize;
      if (typeof s.lineHeight === 'number') lineHeight.value = s.lineHeight;
      if (typeof s.maxWidth === 'number') maxWidth.value = s.maxWidth;
    }
  } catch {}

  if (!bookId.value) {
    ElMessage.error('参数错误');
    backToStore();
    return;
  }
  await loadBookMeta();
  await syncCatalog();

  const restored = await restoreOnlineProgress();
  if (!restored && chapters.value.length) {
    await openChapter(chapters.value[0].chapterId, false);
  }
});

onUnmounted(() => {
  try {
    if (saveProgressTimer) {
      window.clearTimeout(saveProgressTimer);
      saveProgressTimer = null;
    }
    saveOnlineProgress();
  } catch {}

  try {
    document.documentElement.style.overflow = prevHtmlOverflow;
    document.body.style.overflow = prevBodyOverflow;
    (document.body.style as any).overscrollBehavior = prevBodyOverscroll;
  } catch {}
});
</script>

<style scoped>
.online-container {
  height: 100vh;
  overflow: hidden;
  background:
      linear-gradient(rgba(0,0,0,.4), rgba(0,0,0,.6)),
      url('/bookshelf-bg.jpg') center/cover fixed;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 5%;
  box-sizing: border-box;
}

.online-card {
  width: 1100px;
  height: calc(100vh - 48px);
  max-height: calc(100vh - 48px);
  background: rgba(255,255,255,.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,.1);
  border: 1px solid rgba(0,0,0,.05);
  padding: 18px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.online-container.dark .online-card {
  background: rgba(16, 16, 22, 0.92);
  border-color: rgba(255,255,255,0.10);
  box-shadow: 0 10px 40px rgba(0,0,0,0.35);
}

.online-container.dark .ctrl {
  background: rgba(22,22,28,0.72);
  border-color: rgba(255,255,255,0.10);
}

.online-container.dark .ctrl-label {
  color: rgba(255,255,255,0.75);
}

.online-container.dark .toc {
  background: rgba(22,22,28,0.68);
  border-color: rgba(255,255,255,0.10);
}

.online-container.dark .toc-title {
  color: rgba(255,255,255,0.90);
}

.online-container.dark .toc-item {
  background: rgba(0,0,0,0.22);
  border-color: rgba(255,255,255,0.10);
}

.online-container.dark .toc-text {
  color: rgba(255,255,255,0.88);
}

.online-container.dark .content {
  background: rgba(22,22,28,0.68);
  border-color: rgba(255,255,255,0.10);
}

.online-container.dark .content-title {
  color: rgba(255,255,255,0.92);
}

:deep(.online-card > .el-card__body) {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.top-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
}
.ctrl {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 12px;
  background: rgba(255,255,255,0.75);
  border: 1px solid rgba(0,0,0,0.06);
}
.ctrl.slider {
  width: 220px;
}
.ctrl-label {
  color: #606266;
  font-weight: 700;
  font-size: 12px;
  width: 34px;
}
:deep(.ctrl .el-slider) {
  width: 150px;
}
:deep(.ctrl .el-switch) {
  --el-switch-on-color: #667eea;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.top-title {
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

.top-actions {
  display: flex;
  gap: 10px;
}

.brand-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(102,126,234,.35);
}
.brand-btn:hover { filter: brightness(1.05); }

.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.toc {
  background: rgba(255,255,255,0.9);
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,0.06);
  padding: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.toc-title {
  font-weight: 800;
  color: #303133;
  margin-bottom: 10px;
}

.toc-list {
  flex: 1;
  min-height: 0;
  overflow-y: scroll;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(102,126,234,0.55) rgba(0,0,0,0.06);
}

.online-container.dark .toc-list {
  scrollbar-color: rgba(102,126,234,0.60) rgba(255,255,255,0.08);
}

.toc-list::-webkit-scrollbar {
  width: 10px;
}
.toc-list::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.06);
  border-radius: 999px;
}
.toc-list::-webkit-scrollbar-thumb {
  background: rgba(102,126,234,0.45);
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,0.70);
}
.online-container.dark .toc-list::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.08);
}
.online-container.dark .toc-list::-webkit-scrollbar-thumb {
  background: rgba(102,126,234,0.60);
  border-color: rgba(22,22,28,0.80);
}

.toc-item {
  text-align: left;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.06);
  background: rgba(255,255,255,0.95);
  cursor: pointer;
}

.toc-item.active {
  border-color: rgba(102,126,234,0.35);
  box-shadow: 0 6px 18px rgba(102,126,234,0.18);
}

.toc-text {
  color: #303133;
  font-weight: 600;
}

.content {
  background: rgba(255,255,255,0.9);
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,0.06);
  padding: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}


.content-title {
  font-size: 16px;
  font-weight: 800;
  color: #303133;
  margin-bottom: 10px;
}

.content-body {
  flex: 1;
  min-height: 0;
  overflow-y: scroll;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  color: #303133;
  margin: 0 auto;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(102,126,234,0.55) rgba(0,0,0,0.06);
}

.online-container.dark .content-body {
  color: rgba(255,255,255,0.88);
  scrollbar-color: rgba(102,126,234,0.60) rgba(255,255,255,0.08);
}

.content-body::-webkit-scrollbar {
  width: 10px;
}
.content-body::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.06);
  border-radius: 999px;
}
.content-body::-webkit-scrollbar-thumb {
  background: rgba(102,126,234,0.45);
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,0.70);
}
.online-container.dark .content-body::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.08);
}
.online-container.dark .content-body::-webkit-scrollbar-thumb {
  background: rgba(102,126,234,0.60);
  border-color: rgba(22,22,28,0.80);
}

:deep(.content-body p) {
  margin: 0 0 0.9em;
  text-indent: 2em;
  letter-spacing: 0.2px;
}
:deep(.content-body h1),
:deep(.content-body h2),
:deep(.content-body h3) {
  margin: 0.8em 0 0.4em;
  text-indent: 0;
}
:deep(.content-body img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 12px auto;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
}
:deep(.content-body a) {
  color: #667eea;
  text-decoration: none;
}
:deep(.content-body a:hover) {
  text-decoration: underline;
}

.comment-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  box-sizing: border-box;
}
.comment-head {
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.online-container.dark .comment-head {
  border-bottom-color: rgba(255,255,255,0.10);
}
.comment-title {
  font-weight: 900;
  color: #303133;
}
.online-container.dark .comment-title {
  color: rgba(255,255,255,0.92);
}
.comment-sub {
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
}
.online-container.dark .comment-sub {
  color: rgba(255,255,255,0.60);
}
.comment-selected {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.06);
  background: rgba(255,255,255,0.75);
}
.online-container.dark .comment-selected {
  border-color: rgba(255,255,255,0.10);
  background: rgba(22,22,28,0.60);
}
.comment-selected-label {
  font-size: 12px;
  color: #909399;
}
.comment-selected-id {
  margin-top: 4px;
  font-weight: 700;
  word-break: break-word;
  white-space: pre-wrap;
  color: #303133;
  max-height: 96px;
  overflow: auto;
}
.online-container.dark .comment-selected-id {
  color: rgba(255,255,255,0.88);
}
.comment-editor-actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}
.comment-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.section-title {
  font-weight: 900;
  color: #303133;
}
.online-container.dark .section-title {
  color: rgba(255,255,255,0.92);
}
.comment-item {
  border: 1px solid rgba(0,0,0,0.06);
  background: rgba(255,255,255,0.75);
  border-radius: 14px;
  padding: 10px 12px;
}
.online-container.dark .comment-item {
  border-color: rgba(255,255,255,0.10);
  background: rgba(22,22,28,0.60);
}
.comment-content {
  color: #303133;
  line-height: 1.6;
  white-space: pre-wrap;
}
.online-container.dark .comment-content {
  color: rgba(255,255,255,0.88);
}
.comment-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #909399;
  font-size: 12px;
}
.online-container.dark .comment-meta {
  color: rgba(255,255,255,0.60);
}
.like-btn {
  color: #667eea;
}
.empty {
  color: #909399;
  font-size: 12px;
}
.online-container.dark .empty {
  color: rgba(255,255,255,0.60);
}
</style>