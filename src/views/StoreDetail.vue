<template>
  <div class="detail-container">
    <el-card class="detail-card" v-if="item">
      <div class="detail-header">
        <div class="cover">
          <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" />
          <div v-else class="default-cover">
            <span class="cover-letter">{{ item.title?.[0]?.toUpperCase() || '?' }}</span>
          </div>
        </div>
        <div class="meta">
          <h2 class="title">{{ item.title || '未命名书籍' }}</h2>
          <p class="author">作者：{{ item.author || '佚名' }}</p>
          <p class="type">类型：{{ item.tags || '未知' }}</p>
          <p class="uploader">上传人：{{ item.publisher || '未知' }}</p>
          <p class="type">字数：{{ item.wordCount ?? '未知' }}</p>
          <p class="type">评分：{{ avgScoreText }}（{{ ratingCount }} 人）</p>
          <p class="desc" v-if="item.description">简介：{{ item.description }}</p>
          <div class="actions">
            <el-button type="primary" class="brand-btn" @click="readNow">立即阅读</el-button>
            <el-button class="brand-btn" @click="openReviewDialog">写书评</el-button>
            <el-button class="brand-btn" :disabled="collected || collecting" @click="collect">{{ collected ? '已收藏' : '收藏到书架' }}</el-button>
            <el-button class="danger-btn" @click="submitDelete">删除书籍</el-button>
            <el-button class="brand-btn" @click="goBack">{{ backText }}</el-button>
          </div>
        </div>
      </div>

      <div class="reviews">
        <div class="reviews-header">
          <div class="reviews-title">书评</div>
          <div class="reviews-summary">
            <el-rate :model-value="avgScore" disabled />
            <span class="reviews-score">{{ avgScoreText }}</span>
            <span class="reviews-count">（{{ ratingCount }} 人评分）</span>
          </div>
        </div>

        <div class="reviews-list" v-loading="reviewsLoading">
          <div v-if="reviews.length === 0" class="reviews-empty">暂无书评</div>
          <div v-for="r in reviews" :key="r.id" class="review-item">
            <div class="review-top">
              <el-rate :model-value="r.rating" disabled />
              <div class="review-meta">
                <span class="review-user">用户 {{ r.userId }}</span>
                <span class="review-time">{{ formatTime(r.createTime) }}</span>
              </div>
            </div>
            <div class="review-content">{{ r.content }}</div>
          </div>
        </div>

        <div class="reviews-pagination" v-if="reviewsTotal > pageSize">
          <el-pagination
            background
            layout="prev, pager, next"
            :total="reviewsTotal"
            :page-size="pageSize"
            :current-page="reviewPage"
            @current-change="onReviewPageChange"
          />
        </div>
      </div>

      <el-dialog v-model="reviewDialog" title="写书评" width="520px" :close-on-click-modal="false">
        <div class="review-form">
          <div class="review-form-row">
            <span class="review-form-label">评分</span>
            <el-rate v-model="newRating" />
          </div>
          <el-input v-model="newContent" type="textarea" :rows="4" placeholder="写下你的书评..." />
        </div>
        <template #footer>
          <el-button @click="reviewDialog = false">取消</el-button>
          <el-button class="brand-btn" :disabled="!canSubmitReview" @click="submitReview">发布</el-button>
        </template>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getBookInfoBase, deleteBookApi, addBookReview, listBookReviews, addToShelf, getBookshelf } from '@/api/book';
import { useAuthStore } from '@/store/auth';
import { db } from '@/db';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const fromShelf = computed(() => String(route.query.from || '') === 'shelf');
const backText = computed(() => (fromShelf.value ? '返回书架' : '返回书城'));

const collected = ref(false);
const collecting = ref(false);

const id = computed(() => Number(route.params.id || 0));
const detail = ref<any | null>(null);
const item = computed(() => detail.value);
const bookId = computed(() => Number(item.value?.id ?? item.value?.serverBookId ?? id.value ?? 0));

const avgScore = computed(() => {
  const a = item.value?.averageScore;
  if (typeof a === 'number' && Number.isFinite(a)) return a;
  const total = Number(item.value?.totalScore ?? item.value?.total_score ?? 0);
  const count = Number(item.value?.ratingCount ?? item.value?.rating_count ?? 0);
  return count > 0 ? total / count : 0;
});

const ratingCount = computed(() => Number(item.value?.ratingCount ?? item.value?.rating_count ?? 0));
const avgScoreText = computed(() => avgScore.value.toFixed(1));

const reviewsLoading = ref(false);
const reviews = ref<any[]>([]);
const reviewsTotal = ref(0);
const reviewPage = ref(1);
const pageSize = 10;

const reviewDialog = ref(false);
const newRating = ref(0);
const newContent = ref('');
const canSubmitReview = computed(() => newRating.value > 0 && !!newContent.value.trim() && !!bookId.value);

function formatTime(v: any) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function openReviewDialog() {
  reviewDialog.value = true;
}

async function loadReviews(page = 1) {
  if (!bookId.value) return;
  reviewsLoading.value = true;
  try {
    const res = await listBookReviews(bookId.value, page, pageSize);
    if (res.data?.code === 200 && res.data.data) {
      const p = res.data.data;
      reviews.value = p.records || [];
      reviewsTotal.value = Number(p.total || 0);
      reviewPage.value = Number(p.current || page);
    }
  } catch {
  } finally {
    reviewsLoading.value = false;
  }
}

function onReviewPageChange(p: number) {
  loadReviews(p);
}

async function submitReview() {
  if (!canSubmitReview.value) return;
  try {
    const res = await addBookReview({ bookId: bookId.value, rating: newRating.value, content: newContent.value.trim() });
    if (res.data?.code !== 200) {
      ElMessage.error(res.data?.msg || '发布失败');
      return;
    }
    ElMessage.success('发布成功');
    reviewDialog.value = false;
    newRating.value = 0;
    newContent.value = '';
    await loadReviews(1);
    try {
      const base = await getBookInfoBase(bookId.value);
      if (base.data?.code === 200 && base.data.data) {
        detail.value = { ...(detail.value || {}), ...base.data.data };
      }
    } catch {}
  } catch {
    ElMessage.error('发布失败');
  }
}

async function checkCollected() {
  const uid = auth.user?.id ? Number(auth.user.id) : 0;
  const bid = bookId.value;
  if (!uid || !bid) {
    collected.value = false;
    return;
  }
  try {
    const res = await getBookshelf(uid);
    if (res.data?.code !== 200 || !Array.isArray(res.data.data)) {
      collected.value = false;
      return;
    }
    collected.value = res.data.data.some((b: any) => Number(b?.id) === bid);
  } catch {
    collected.value = false;
  }
}

onMounted(async () => {
  try {
    const local = await db.serverBooks.get(id.value);
    if (local) detail.value = { ...local, id: local.serverBookId };
  } catch {}

  try {
    const res = await getBookInfoBase(id.value);
    if (res.data?.code === 200 && res.data.data) {
      detail.value = { ...(detail.value || {}), ...res.data.data };
    }
  } catch {}

  await loadReviews(1);
  await checkCollected();
});

watch([bookId, () => auth.user?.id], () => {
  checkCollected();
});

function goBack() {
  router.push('/');
  localStorage.setItem('bookshelf_default_tab', fromShelf.value ? 'library' : 'store');
}

function readNow() {
  if (!bookId.value) {
    ElMessage.error('书籍不存在');
    return;
  }
  router.push(`/online/${bookId.value}`);
}

async function collect() {
  if (!bookId.value) {
    ElMessage.error('书籍不存在');
    return;
  }
  if (collected.value || collecting.value) {
    return;
  }
  collecting.value = true;
  try {
    const res = await addToShelf(bookId.value);
    if (res.data?.code !== 200) {
      const msg = res.data?.msg || '加入书架失败';
      if (String(msg).includes('已在书架') || String(msg).includes('已收藏')) {
        collected.value = true;
        return;
      }
      ElMessage.error(msg);
      return;
    }
    collected.value = true;
    ElMessage.success('已加入书架');
  } catch (e: any) {
    ElMessage.error(e?.message ? String(e.message) : '加入书架失败');
  } finally {
    collecting.value = false;
  }
}

async function submitDelete() {
  if (!bookId.value) {
    ElMessage.error('书籍不存在');
    return;
  }
  try {
    await ElMessageBox.confirm('确定删除该书籍？此操作不可撤销', '删除确认', {
      type: 'warning',
      center: true,
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      customClass: 'brand_dialog',
      closeOnClickModal: false
    });
    const res = await deleteBookApi(bookId.value);
    if (res.data?.code !== 200) {
      ElMessage.error(res.data?.msg || '删除失败');
      return;
    }

    try {
      await db.serverBooks.delete(bookId.value);
      await db.serverChapters.where('serverBookId').equals(bookId.value).delete();
      await db.serverChapterContents.where('serverBookId').equals(bookId.value).delete();
    } catch {}

    ElMessage.success('删除成功');
    goBack();
  } catch {}
}
</script>
<style scoped>
.detail-container {
  min-height: 100vh;
  background:
      linear-gradient(rgba(0,0,0,.4), rgba(0,0,0,.6)),
      url('/bookshelf-bg.jpg') center/cover fixed;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 5%;
}
.detail-card {
  width: 980px;
  background: rgba(255,255,255,.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,.1);
  border: 1px solid rgba(0,0,0,.05);
  padding: 24px;
}
.detail-header {
  display: flex;
  gap: 24px;
}
.cover {
  width: 280px;
  aspect-ratio: 2/3;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.cover img { width: 100%; height: 100%; object-fit: cover; }
.default-cover {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 64px; font-weight: 800;
}
.meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.title {
  font-size: 24px;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
  margin: 0;
}
.author, .type, .uploader { color: #606266; }
.desc { color: #303133; line-height: 1.6; }
.actions { margin-top: 8px; display: flex; gap: 12px; flex-wrap: wrap; }

.reviews {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(0,0,0,0.06);
}
.reviews-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.reviews-title {
  font-size: 16px;
  font-weight: 900;
  color: #303133;
}
.reviews-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #606266;
}
.reviews-score {
  font-weight: 900;
  color: #303133;
}
.reviews-count {
  color: #909399;
  font-size: 12px;
}
.reviews-list {
  background: rgba(255,255,255,0.75);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 18px;
  padding: 12px;
  min-height: 80px;
}
.reviews-empty {
  color: #909399;
  text-align: center;
  padding: 18px 0;
}
.review-item {
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.9);
}
.review-item + .review-item {
  margin-top: 10px;
}
.review-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.review-meta {
  display: flex;
  gap: 10px;
  color: #909399;
  font-size: 12px;
  white-space: nowrap;
}
.review-content {
  margin-top: 8px;
  color: #303133;
  line-height: 1.6;
  white-space: pre-wrap;
}
.reviews-pagination {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
.review-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.review-form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.review-form-label {
  color: #606266;
  font-weight: 700;
  width: 42px;
}
:deep(.el-dialog__footer .brand-btn) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
  border-radius: 12px;
}
.brand-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none; color: #fff; border-radius: 12px;
  box-shadow: 0 6px 18px rgba(102,126,234,.35);
}
.brand-btn:hover { filter: brightness(1.05); }

.danger-btn {
  background: linear-gradient(135deg, #f56c6c 0%, #f08c8c 100%);
  border: none; color: #fff; border-radius: 12px;
  box-shadow: 0 6px 18px rgba(245,108,108,.35);
}
.danger-btn:hover { filter: brightness(1.05); }

.cancel-btn {
  background: rgba(255,255,255,0.9);
  border: 1px solid rgba(0,0,0,0.08);
  color: #606266; border-radius: 12px;
}

:deep(.brand_dialog .el-message-box__header) {
  padding-bottom: 4px;
}
:deep(.brand_dialog .el-message-box__title) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
  font-weight: 800;
}
:deep(.brand_dialog .el-message-box__btns) {
  display: flex; gap: 8px;
}
:deep(.brand_dialog .el-message-box__btns .el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important;
  color: #fff !important;
  border-radius: 12px !important;
  box-shadow: 0 6px 18px rgba(102,126,234,.35) !important;
}
:deep(.brand_dialog .el-message-box__btns .el-button:not(.el-button--primary)) {
  background: rgba(255,255,255,0.9) !important;
  border: 1px solid rgba(0,0,0,0.08) !important;
  color: #606266 !important;
  border-radius: 12px !important;
}
.brand-btn:hover { filter: brightness(1.05); }

.danger-btn {
  background: linear-gradient(135deg, #f56c6c 0%, #f08c8c 100%);
  border: none; color: #fff; border-radius: 12px;
  box-shadow: 0 6px 18px rgba(245,108,108,.35);
}
.danger-btn:hover { filter: brightness(1.05); }

.cancel-btn {
  background: rgba(255,255,255,0.9);
  border: 1px solid rgba(0,0,0,0.08);
  color: #606266; border-radius: 12px;
}

:deep(.brand_dialog .el-message-box__header) {
  padding-bottom: 4px;
}
:deep(.brand_dialog .el-message-box__title) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
  font-weight: 800;
}
:deep(.brand_dialog .el-message-box__btns) {
  display: flex; gap: 8px;
}
:deep(.brand_dialog .el-message-box__btns .el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important;
  color: #fff !important;
  border-radius: 12px !important;
  box-shadow: 0 6px 18px rgba(102,126,234,.35) !important;
}
:deep(.brand_dialog .el-message-box__btns .el-button:not(.el-button--primary)) {
  background: rgba(255,255,255,0.9) !important;
  border: 1px solid rgba(0,0,0,0.08) !important;
  color: #606266 !important;
  border-radius: 12px !important;
}
</style>

<style>
/* 全局样式：MessageBox 是 Teleport 到 body 的元素，scoped 无法覆盖，这里提供非 scoped 覆盖 */
.brand_dialog .el-message-box__btns .el-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important;
  color: #fff !important;
  border-radius: 12px !important;
  box-shadow: 0 6px 18px rgba(102,126,234,.35) !important;
}
.brand_dialog .el-message-box__btns .el-button:not(.el-button--primary) {
  background: rgba(255,255,255,0.9) !important;
  border: 1px solid rgba(0,0,0,0.08) !important;
  color: #606266 !important;
  border-radius: 12px !important;
}
.brand_dialog .el-message-box__title {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
  font-weight: 800;
}
/* 将默认的黄色警示图标改为品牌色，并稍微缩小，避免突兀 */
.brand_dialog .el-message-box__status {
  color: #667eea !important;
  font-size: 18px !important;
}
</style>