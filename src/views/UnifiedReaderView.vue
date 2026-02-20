<template>
  <div class="unified-reader-view">
    <div v-if="loading" class="loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>加载书籍中...</p>
    </div>

    <div v-else-if="error" class="error">
      <el-icon><WarningFilled /></el-icon>
      <p>{{ error }}</p>
      <el-button @click="goBack">返回书架</el-button>
    </div>

    <UnifiedReader v-else-if="bookLoaded" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useReaderStore } from '@/store/reader';
import { useUnifiedLibrary } from '@/composables/useUnifiedLibrary';
import UnifiedReader from '@/components/UnifiedReader.vue';
import { Loading, WarningFilled } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const readerStore = useReaderStore();
const { getUnifiedBook } = useUnifiedLibrary();

const bookId = computed(() => Number(route.params.bookId));
const loading = ref(true);
const error = ref('');
const bookLoaded = computed(() => readerStore.activeBook !== null);

async function loadBook() {
  try {
    console.log('[UnifiedReaderView] 加载书籍:', bookId.value);

    const book = await getUnifiedBook(bookId.value);
    
    if (!book) {
      error.value = '书籍不存在';
      return;
    }

    // 设置活动书籍
    readerStore.setActiveBook(book);

    // 加载第一章
    await readerStore.loadChapter(0);

    console.log('[UnifiedReaderView] 书籍加载成功');
  } catch (err) {
    console.error('[UnifiedReaderView] 加载失败:', err);
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push('/');
}

onMounted(async () => {
  await loadBook();
});

onUnmounted(() => {
  // 清理资源
  readerStore.cleanup();
});
</script>

<style scoped>
.unified-reader-view {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
}

.loading,
.error {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.error {
  color: #f56c6c;
}

.loading .el-icon,
.error .el-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}
</style>
