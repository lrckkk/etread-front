<template>
  <div class="unified-reader" :style="{ backgroundColor: readerStyles.backgroundColor }">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-button @click="goBack" size="small">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>

      <div class="chapter-info">
        <span class="current-chapter">{{ currentChapterTitle }}</span>
      </div>

      <div class="toolbar-actions">
        <el-button @click="toggleToc" size="small" circle>
          <el-icon><List /></el-icon>
        </el-button>
        <el-button @click="showSettings = !showSettings" size="small" circle>
          <el-icon><Setting /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 目录侧边栏 -->
    <transition name="slide">
      <div v-if="showToc" class="toc-sidebar">
        <div class="toc-header">
          <h3>目录</h3>
          <el-button @click="toggleToc" size="small" circle>
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <div class="toc-content">
          <div
            v-for="chapter in chapters"
            :key="chapter.id"
            class="toc-item"
            :class="{ active: chapter.id === currentVisibleChapterId }"
            @click="jumpToChapter(chapter.id)"
          >
            <span class="toc-number">{{ chapter.id + 1 }}</span>
            <span class="toc-title">{{ chapter.title }}</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- 遮罩层 -->
    <transition name="fade">
      <div v-if="showToc" class="toc-overlay" @click="toggleToc"></div>
    </transition>

    <!-- 设置面板 -->
    <el-drawer
      v-model="showSettings"
      title="阅读设置"
      direction="rtl"
      size="300px"
    >
      <div class="settings-panel">
        <div class="setting-item">
          <label>背景色</label>
          <div class="color-options">
            <div 
              class="color-option"
              :class="{ active: backgroundColor === '#ffffff' }"
              style="background: #ffffff"
              @click="setBackgroundColor('#ffffff')"
            >
              白色
            </div>
            <div 
              class="color-option"
              :class="{ active: backgroundColor === '#f5f5dc' }"
              style="background: #f5f5dc"
              @click="setBackgroundColor('#f5f5dc')"
            >
              护眼
            </div>
            <div 
              class="color-option"
              :class="{ active: backgroundColor === '#1a1a1a' }"
              style="background: #1a1a1a; color: #fff"
              @click="setBackgroundColor('#1a1a1a')"
            >
              夜间
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label>字体大小: {{ fontSize }}px</label>
          <el-slider 
            v-model="fontSize" 
            :min="12" 
            :max="32" 
            @change="handleFontSizeChange"
          />
        </div>

        <div class="setting-item">
          <label>行高: {{ lineHeight }}</label>
          <el-slider 
            v-model="lineHeight" 
            :min="1.0" 
            :max="3.0" 
            :step="0.1"
            @change="handleLineHeightChange"
          />
        </div>
      </div>
    </el-drawer>

    <!-- 内容渲染区域 -->
    <div class="content-container" ref="contentContainer" @scroll="handleScroll">
      <div v-if="initialLoading" class="loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <p>正在加载全书...</p>
        <el-progress :percentage="loadingProgress" />
      </div>

      <div v-else class="content-wrapper" :style="contentWrapperStyle">
        <!-- 渲染所有章节 -->
        <div
          v-for="chapterData in allChapters"
          :key="chapterData.chapterId"
          class="chapter-section"
          :data-chapter-id="chapterData.chapterId"
        >
          <!-- 章节标题 -->
          <h2 class="chapter-title">{{ chapterData.title }}</h2>

          <!-- 渲染 ContentLayer -->
          <div
            v-for="(layer, layerIndex) in chapterData.layers"
            :key="`${chapterData.chapterId}-${layerIndex}`"
            class="content-layer"
          >
            <!-- 段落内容 -->
            <div v-if="layer.paragraphs && layer.paragraphs.length > 0">
              <p
                v-for="(para, paraIndex) in layer.paragraphs"
                :key="paraIndex"
                class="paragraph"
              >
                {{ para }}
              </p>
            </div>

            <!-- 图片内容 -->
            <div v-if="layer.image" class="layer-image">
              <img :src="layer.image" alt="Book image" />
            </div>
          </div>
        </div>

        <!-- 全书结束 -->
        <div class="end-notice">
          <el-icon><CircleCheck /></el-icon>
          <p>全书完</p>
          <el-button @click="goBack" type="primary">返回书架</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useReaderStore } from '@/store/reader';
import { useProgress } from '@/composables/useProgress';
import { storeToRefs } from 'pinia';
import type { ContentLayer } from '@/types/book';
import { 
  ArrowLeft, 
  Setting, 
  Loading,
  CircleCheck,
  List,
  Close
} from '@element-plus/icons-vue';

const router = useRouter();
const readerStore = useReaderStore();
const { saveProgress, loadProgress } = useProgress();

// 从 store 获取状态
const {
  activeBook,
  fontSize,
  lineHeight,
  backgroundColor,
  readerStyles
} = storeToRefs(readerStore);

// 本地状态
const showSettings = ref(false);
const showToc = ref(false);
const contentContainer = ref<HTMLElement>();
const initialLoading = ref(true);
const loadingProgress = ref(0);

// 所有章节数据
interface ChapterData {
  chapterId: number;
  title: string;
  layers: ContentLayer[];
}

const allChapters = ref<ChapterData[]>([]);
const currentVisibleChapterId = ref(0);
const progressRestored = ref(false);
let saveProgressTimer: number | null = null;

// 计算属性
const chapters = computed(() => activeBook.value?.chapters || []);

const currentChapterTitle = computed(() => {
  const chapter = chapters.value.find(c => c.id === currentVisibleChapterId.value);
  return chapter?.title || '';
});

const contentWrapperStyle = computed(() => ({
  fontSize: readerStyles.value.fontSize,
  lineHeight: readerStyles.value.lineHeight,
  color: readerStyles.value.color,
  maxWidth: readerStyles.value.maxWidth,
  margin: '0 auto',
  padding: '5% 5%'
}));

// 方法
function goBack() {
  router.push('/');
}

function toggleToc() {
  showToc.value = !showToc.value;
}

function handleFontSizeChange(value: number) {
  readerStore.setFontSize(value);
}

function handleLineHeightChange(value: number) {
  readerStore.setLineHeight(value);
}

function setBackgroundColor(color: string) {
  readerStore.setBackgroundColor(color);
}

/**
 * 加载全书所有章节
 */
async function loadAllChapters() {
  if (!activeBook.value) return;

  initialLoading.value = true;
  loadingProgress.value = 0;
  allChapters.value = [];

  const totalChapters = chapters.value.length;

  try {
    console.log('[UnifiedReader] 开始加载全书，共', totalChapters, '章');
    
    for (let i = 0; i < totalChapters; i++) {
      const chapter = chapters.value[i];
      
      // 加载章节
      await readerStore.loadChapter(i);
      
      // 添加到列表
      allChapters.value.push({
        chapterId: i,
        title: chapter.title,
        layers: [...readerStore.currentLayers]
      });

      // 更新进度
      loadingProgress.value = Math.round(((i + 1) / totalChapters) * 100);
    }
    
    console.log('[UnifiedReader] 全书加载完成，共', allChapters.value.length, '章');
    
    // 先关闭加载状态，让内容显示出来
    initialLoading.value = false;
    
    // 等待 DOM 渲染
    await nextTick();
    console.log('[UnifiedReader] DOM 渲染完成，准备恢复进度');
    
    // 再等待一段时间确保所有内容都渲染完成
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 恢复进度
    await restoreProgress();
    
  } catch (error) {
    console.error('[UnifiedReader] 加载全书失败:', error);
    initialLoading.value = false;
  }
}

/**
 * 处理滚动事件
 */
function handleScroll() {
  updateVisibleChapter();
  debounceSaveProgress();
}

/**
 * 更新当前可见的章节ID
 */
function updateVisibleChapter() {
  if (!contentContainer.value) return;

  const container = contentContainer.value;
  const sections = container.querySelectorAll('.chapter-section');
  
  let visibleChapterId = currentVisibleChapterId.value;
  
  sections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // 如果章节在视口中间位置
    if (rect.top < containerRect.height / 2 && rect.bottom > containerRect.height / 2) {
      const chapterId = parseInt(section.getAttribute('data-chapter-id') || '0');
      visibleChapterId = chapterId;
    }
  });

  if (visibleChapterId !== currentVisibleChapterId.value) {
    currentVisibleChapterId.value = visibleChapterId;
  }
}

/**
 * 跳转到指定章节
 */
async function jumpToChapter(chapterId: number) {
  await nextTick();
  const section = contentContainer.value?.querySelector(`[data-chapter-id="${chapterId}"]`);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
    showToc.value = false;
  }
}

/**
 * 防抖保存进度
 */
function debounceSaveProgress() {
  if (saveProgressTimer) {
    clearTimeout(saveProgressTimer);
  }
  
  saveProgressTimer = window.setTimeout(() => {
    saveCurrentProgress();
  }, 1000); // 1秒后保存
}

/**
 * 保存当前阅读进度
 */
async function saveCurrentProgress() {
  if (!activeBook.value || !contentContainer.value) return;
  
  try {
    const scrollTop = contentContainer.value.scrollTop;
    const chapterTitle = currentChapterTitle.value || `第 ${currentVisibleChapterId.value + 1} 章`;
    
    await saveProgress(
      activeBook.value.id!,
      currentVisibleChapterId.value,
      scrollTop,
      chapterTitle
    );
    console.log('[UnifiedReader] 进度已保存:', {
      bookId: activeBook.value.id,
      chapterId: currentVisibleChapterId.value,
      chapterTitle,
      scrollTop
    });
  } catch (error) {
    console.error('[UnifiedReader] 保存进度失败:', error);
  }
}

/**
 * 恢复阅读进度
 */
async function restoreProgress() {
  if (!activeBook.value) {
    console.log('[UnifiedReader] ❌ 没有活动书籍');
    return;
  }
  
  if (!contentContainer.value) {
    console.log('[UnifiedReader] ❌ 内容容器未找到');
    return;
  }
  
  if (progressRestored.value) {
    console.log('[UnifiedReader] ⏭️ 进度已恢复，跳过');
    return;
  }
  
  try {
    console.log('[UnifiedReader] 📖 开始恢复进度，书籍ID:', activeBook.value.id);
    const progress = await loadProgress(activeBook.value.id!);
    
    if (!progress) {
      console.log('[UnifiedReader] ℹ️ 没有保存的进度，从头开始阅读');
      progressRestored.value = true;
      return;
    }
    
    console.log('[UnifiedReader] 📍 找到保存的进度:', {
      chapterIndex: progress.chapterIndex,
      chapterTitle: progress.chapterTitle,
      position: progress.position,
      updateTime: new Date(progress.updateTime).toLocaleString()
    });
    
    // 检查容器状态
    const containerInfo = {
      scrollHeight: contentContainer.value.scrollHeight,
      clientHeight: contentContainer.value.clientHeight,
      scrollTop: contentContainer.value.scrollTop,
      targetPosition: progress.position
    };
    console.log('[UnifiedReader] 📏 容器信息:', containerInfo);
    
    if (containerInfo.scrollHeight <= containerInfo.clientHeight) {
      console.warn('[UnifiedReader] ⚠️ 容器高度异常，内容可能未完全渲染');
    }
    
    // 滚动到保存的位置
    if (typeof progress.position === 'number') {
      console.log('[UnifiedReader] 🎯 开始滚动到位置:', progress.position);
      
      // 第一次尝试
      contentContainer.value.scrollTop = progress.position;
      await nextTick();
      
      let actualScrollTop = contentContainer.value.scrollTop;
      console.log('[UnifiedReader] 📍 第一次滚动后位置:', actualScrollTop);
      
      // 如果位置不准确，重试
      const tolerance = 50; // 允许 50px 的误差
      if (Math.abs(actualScrollTop - progress.position) > tolerance) {
        console.log('[UnifiedReader] 🔄 位置不准确，等待后重试...');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        contentContainer.value.scrollTop = progress.position;
        await nextTick();
        
        actualScrollTop = contentContainer.value.scrollTop;
        console.log('[UnifiedReader] 📍 第二次滚动后位置:', actualScrollTop);
        
        // 如果还是不准确，再试一次
        if (Math.abs(actualScrollTop - progress.position) > tolerance) {
          console.log('[UnifiedReader] 🔄 再次重试...');
          await new Promise(resolve => setTimeout(resolve, 300));
          
          contentContainer.value.scrollTop = progress.position;
          await nextTick();
          
          actualScrollTop = contentContainer.value.scrollTop;
          console.log('[UnifiedReader] 📍 第三次滚动后位置:', actualScrollTop);
        }
      }
      
      // 最终验证
      const finalDiff = Math.abs(actualScrollTop - progress.position);
      if (finalDiff > tolerance) {
        console.warn('[UnifiedReader] ⚠️ 滚动位置偏差较大:', finalDiff, 'px');
      } else {
        console.log('[UnifiedReader] ✅ 滚动位置准确');
      }
    }
    
    // 更新当前章节
    currentVisibleChapterId.value = progress.chapterIndex;
    console.log('[UnifiedReader] 📑 当前章节设置为:', progress.chapterIndex, '-', progress.chapterTitle);
    
    progressRestored.value = true;
    console.log('[UnifiedReader] ✅ 进度恢复完成！');
    
  } catch (error) {
    console.error('[UnifiedReader] ❌ 恢复进度失败:', error);
  }
}

// 生命周期
onMounted(() => {
  loadAllChapters();
});

onUnmounted(() => {
  // 保存最后的进度
  if (saveProgressTimer) {
    clearTimeout(saveProgressTimer);
  }
  saveCurrentProgress();
});
</script>

<style scoped>
.unified-reader {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  transition: background-color 0.3s ease;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2% 5%;
  background: rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
  z-index: 10;
}

.chapter-info {
  flex: 1;
  text-align: center;
  font-weight: 600;
  font-size: 16px;
}

.current-chapter {
  max-width: 50%;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 2%;
}

/* 目录侧边栏 */
.toc-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 300px;
  height: 100%;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.toc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5%;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.toc-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.toc-content {
  flex: 1;
  overflow-y: auto;
  padding: 3%;
}

.toc-item {
  display: flex;
  align-items: center;
  padding: 3%;
  margin-bottom: 2%;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toc-item:hover {
  background: rgba(102, 126, 234, 0.1);
}

.toc-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.toc-number {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  margin-right: 3%;
}

.toc-item.active .toc-number {
  background: rgba(255, 255, 255, 0.2);
}

.toc-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.toc-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

/* 动画 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.content-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  padding: 0 10%;
}

.loading .el-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.loading .el-progress {
  width: 100%;
  margin-top: 2rem;
}

.content-wrapper {
  transition: all 0.3s ease;
}

.chapter-section {
  margin-bottom: 10%;
}

.chapter-title {
  font-size: 1.8em;
  font-weight: 700;
  text-align: center;
  margin: 5% 0;
  color: inherit;
}

.content-layer {
  margin-bottom: 2em;
}

.paragraph {
  margin: 0;
  text-align: justify;
  line-height: inherit;
  text-indent: 2em;
}

.layer-image {
  margin: 2em 0;
  text-align: center;
}

.layer-image img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.end-notice {
  text-align: center;
  padding: 10% 0;
  color: #67c23a;
}

.end-notice .el-icon {
  font-size: 4rem;
  margin-bottom: 2rem;
}

.end-notice p {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 2rem;
}

/* 设置面板 */
.settings-panel {
  padding: 5%;
}

.setting-item {
  margin-bottom: 8%;
}

.setting-item label {
  display: block;
  margin-bottom: 3%;
  font-weight: 500;
  color: #303133;
}

.color-options {
  display: flex;
  gap: 3%;
}

.color-option {
  flex: 1;
  padding: 3%;
  border: 2px solid transparent;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
}

.color-option:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.color-option.active {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.2);
}

/* 响应式 */
@media (max-width: 768px) {
  .toolbar {
    padding: 3% 4%;
  }

  .chapter-info {
    font-size: 14px;
  }

  .current-chapter {
    max-width: 40%;
  }

  .toc-sidebar {
    width: 80%;
  }
}
</style>
