<template>
  <div class="upload-container">
    <el-card class="upload-card">
      <div class="header">
        <h2 class="upload-title">上传书籍</h2>
<!--        <el-button class="brand-btn" @click="goBack">返回书城</el-button>-->
      </div>
      <el-form label-width="90px" class="form">
        <el-form-item label="书籍文件">
          <div class="file-picker" @click="onClickBookSelect">
            <el-icon class="file-icon"><FolderOpened /></el-icon>
            <span class="file-text">{{ fileText }}</span>
          </div>
          <input ref="bookInput" type="file" accept=".epub,.txt" @change="onPickBookFile" style="display:none" />
        </el-form-item>
        <el-form-item label="封面图片">
          <div class="cover-picker" @click="onClickCoverSelect">
            <img v-if="coverPreview" :src="coverPreview" alt="cover" />
            <div v-else class="cover-plus">
              <el-icon><Plus /></el-icon>
            </div>
          </div>
          <input ref="coverInput" type="file" accept="image/*" @change="onPickCoverFile" style="display:none" />
        </el-form-item>
        <el-form-item label="书名">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="作者">
          <el-input v-model="form.author" placeholder="留空默认为 佚名" />
        </el-form-item>
        <el-form-item label="标签">
          <div class="tag-picker">
            <el-checkbox-group v-model="form.tags">
              <el-checkbox v-for="t in availableTags" :key="t" :label="t">{{ t }}</el-checkbox>
            </el-checkbox-group>
            <div v-if="availableTags.length === 0" class="tag-empty">暂无可选标签</div>
          </div>
        </el-form-item>
        <el-form-item label="简介">
          <el-input type="textarea" v-model="form.description" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="submitUpload">上传并解析</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const emit = defineEmits<{ (e: 'uploaded'): void }>();
import { ElMessage } from 'element-plus';
import { FolderOpened, Plus } from '@element-plus/icons-vue';
import ePub from 'epubjs';
import { listAllTags, uploadBook } from '@/api/book';
import { db } from '@/db';

const router = useRouter();

const form = ref({
  file: null as File | null,
  cover: null as File | null,
  title: '',
  author: '',
  tags: [] as string[],
  description: ''
});

const availableTags = ref<string[]>([]);

async function loadTags() {
  try {
    const res = await listAllTags();
    if (res.data?.code === 200 && Array.isArray(res.data.data)) {
      availableTags.value = res.data.data
        .map((x: any) => String(x?.tagName || '').trim())
        .filter(Boolean);
    }
  } catch {}
}

onMounted(() => {
  loadTags();
});
const submitting = ref(false);
const bookInput = ref<HTMLInputElement | null>(null);
const coverInput = ref<HTMLInputElement | null>(null);
const coverPreview = ref<string>('');
const fileText = computed(() => form.value.file?.name || '选择书籍文件');

function onPickBookFile(e: Event) {
  const input = e.target as HTMLInputElement;
  form.value.file = input.files && input.files[0] ? input.files[0] : null;
}
function onPickCoverFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files && input.files[0] ? input.files[0] : null;
  form.value.cover = file;
  if (coverPreview.value) coverPreview.value = '';
  if (file) {
    const reader = new FileReader();
    reader.onload = () => (coverPreview.value = reader.result as string);
    reader.readAsDataURL(file);
  }
}
function onClickBookSelect() { bookInput.value?.click(); }
function onClickCoverSelect() { coverInput.value?.click(); }
function goBack() {
  localStorage.setItem('bookshelf_default_tab', 'store');
  emit('uploaded');
  if (router.currentRoute.value.path !== '/') {
    router.push('/');
  }
}

async function generateTitleCoverFile(title: string): Promise<File> {
  const width = 600;
  const height = 800;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#8b7355');
  grad.addColorStop(1, '#6b5640');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(40, 60, width - 80, height - 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const t = (title || '未命名').trim();
  const maxWidth = width - 140;
  const words = t.split('');
  const lines: string[] = [];
  let line = '';
  for (const ch of words) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const showLines = lines.slice(0, 4);
  const lineHeight = 72;
  const startY = height / 2 - ((showLines.length - 1) * lineHeight) / 2;
  showLines.forEach((l, i) => {
    ctx.fillText(l, width / 2, startY + i * lineHeight);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });

  return new File([blob], `cover_${Date.now()}.png`, { type: 'image/png' });
}

async function fileToPreview(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractEpubCoverFile(file: File): Promise<File | null> {
  try {
    const ab = await file.arrayBuffer();
    const book: any = ePub(ab);
    await book.ready;
    const coverUrl: string | null = await book.coverUrl();
    if (!coverUrl) return null;
    const resp = await fetch(coverUrl);
    const blob = await resp.blob();
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `cover_${Date.now()}.${ext}`, { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

function tryDecodeText(ab: ArrayBuffer, label: string, fatal: boolean) {
  const decoder = new TextDecoder(label, { fatal });
  return decoder.decode(new Uint8Array(ab));
}

async function normalizeTxtToUtf8File(file: File): Promise<File> {
  const ab = await file.arrayBuffer();

  // 优先判断是否已经是 UTF-8
  try {
    tryDecodeText(ab, 'utf-8', true);
    return file;
  } catch {}

  // 尝试常见中文编码
  const candidates = ['gb18030', 'gbk'];
  let text: string | null = null;
  for (const label of candidates) {
    try {
      text = tryDecodeText(ab, label, false);
      break;
    } catch {}
  }

  if (text == null) {
    // 最后兜底：非 fatal 的 utf-8（可能仍乱码，但避免直接失败）
    text = tryDecodeText(ab, 'utf-8', false);
  }

  const bytes = new TextEncoder().encode(text);
  return new File([bytes], file.name, { type: file.type || 'text/plain' });
}

async function submitUpload() {
  const file = form.value.file;
  let cover = form.value.cover;
  const title = form.value.title.trim();
  const author = (form.value.author || '佚名').trim();
  const description = form.value.description.trim();

  if (!file || !title) {
    ElMessage.error('请完善文件和书名');
    return;
  }

  const MAX_BOOK_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_BOOK_SIZE) {
    ElMessage.error('书籍文件过大（最大 10MB），请更换文件或调整后端上传限制');
    return;
  }

  const lowerName = file.name.toLowerCase();
  const isEpub = lowerName.endsWith('.epub');
  const isTxt = lowerName.endsWith('.txt');

  let uploadFile = file;
  if (isTxt) {
    try {
      uploadFile = await normalizeTxtToUtf8File(file);
    } catch {
      ElMessage.error('TXT 编码处理失败，请尝试将文件转为 UTF-8 后再上传');
      return;
    }
  }

  if (!cover) {
    if (isEpub) {
      cover = await extractEpubCoverFile(file);
    }
    if (!cover) {
      try {
        cover = await generateTitleCoverFile(title);
      } catch {
        ElMessage.error('封面生成失败，请手动上传封面');
        return;
      }
    }
    try {
      coverPreview.value = await fileToPreview(cover);
    } catch {}
  }

  if (!cover) {
    ElMessage.error('请上传封面图片');
    return;
  }

  const tempId = -Date.now();
  try {
    submitting.value = true;

    await db.serverBooks.put({
      serverBookId: tempId,
      title,
      author,
      description: description || undefined,
      addTime: Date.now(),
      localFileName: file.name,
      status: 0
    });

    const tags = Array.from(new Set((form.value.tags || []).map(s => String(s).trim()).filter(Boolean)));
    const res = await uploadBook({
      file: uploadFile,
      cover: cover || undefined,
      title,
      author,
      description: description || undefined,
      tags
    });

    if (res.data?.code === 200 && res.data.data) {
      const uploadVO = res.data.data;
      const bookInfo = uploadVO.bookInfo || uploadVO;
      const chapters = uploadVO.bookChapter || [];

      const serverBookId = Number(bookInfo.bookid || bookInfo.id);
      const coverUrl = bookInfo.cover_url || bookInfo.coverUrl;

      await db.serverBooks.delete(tempId);
      await db.serverBooks.put({
        serverBookId,
        title: bookInfo.title || title,
        author: bookInfo.author || author,
        coverUrl: coverUrl || undefined,
        description: bookInfo.description || description || undefined,
        tags: Array.isArray(bookInfo.tags) ? bookInfo.tags.join(',') : (bookInfo.tags || (tags.length ? tags.join(',') : undefined)),
        publisher: bookInfo.publisher || undefined,
        status: typeof bookInfo.status === 'number' ? bookInfo.status : undefined,
        addTime: Date.now(),
        localFileName: file.name
      });

      const mapped = chapters.map((c: any) => ({
        chapterId: Number(c.id),
        serverBookId,
        chapterTitle: c.chapterTitle,
        sortOrder: Number(c.sortOrder || 0),
        updateTime: c.updateTime ? Date.parse(c.updateTime) : undefined
      }));
      if (mapped.length) {
        await db.serverChapters.bulkPut(mapped);
      }

      ElMessage.success('上传成功');
      goBack();
    } else {
      await db.serverBooks.delete(tempId);
      ElMessage.error(res.data?.msg || '上传失败');
    }
  } catch (e: any) {
    try { await db.serverBooks.delete(tempId); } catch {}

    const msg = e?.response?.data?.msg || e?.response?.data?.message || e?.message;
    if (msg && String(msg).toLowerCase().includes('network')) {
      ElMessage.error('网络错误：请确认书城后端(8082)正在运行，且文件大小不超过 10MB');
      return;
    }
    ElMessage.error(msg ? String(msg) : '上传失败');
  } finally {
    submitting.value = false;
  }
}
</script>
<style scoped>
.upload-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #faf8f5 0%, #f3efe9 100%);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px 5%;
}
.upload-card {
  width: 700px;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  padding: 32px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.upload-title {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin: 0;
}
.form :deep(.el-button.el-button--primary) {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  border: none;
}

.brand-btn {
  background: linear-gradient(135deg, #8b7355 0%, #6b5640 100%);
  border: none;
  color: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(102,126,234,.35);
}
.brand-btn:hover { filter: brightness(1.05); }

.form :deep(.el-form-item__label) {
  color: #606266;
  font-weight: 600;
}
.file-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255,255,255,0.95);
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
  border: 1px solid rgba(0,0,0,0.06);
  cursor: pointer;
}
.file-icon { color: #8b7355; font-size: 20px; }
.file-text { color: #303133; font-weight: 600; }

.tag-picker {
  width: 100%;
}

.tag-picker :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.08);
  background: rgba(255,255,255,0.95);
}

.tag-empty {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}

.cover-picker {
  width: 160px; height: 160px;
  border-radius: 16px;
  background: rgba(255,255,255,0.95);
  border: 3px solid rgba(102,126,234,0.3);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  overflow: hidden; cursor: pointer; position: relative;
}
.cover-picker img { width: 100%; height: 100%; object-fit: cover; }
.cover-plus { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #8b7355; }
.cover-plus .el-icon { font-size: 36px; }
</style>