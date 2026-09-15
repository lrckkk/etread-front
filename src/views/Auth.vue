<template>
  <div class="auth-container">
    <el-card class="auth-card">
      <div class="auth-header">
        <el-icon class="logo-icon"><Reading /></el-icon>
        <h1 class="auth-title">账户登录/注册</h1>
        <p class="auth-subtitle">欢迎回来，继续你的阅读之旅</p>
      </div>
      <el-tabs v-model="activeTab" class="auth-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form @submit.prevent="onLogin">
            <el-form-item label="账户">
              <el-input v-model="loginAccount" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="loginPassword" type="password" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="onLogin" :loading="loading">登录</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="注册" name="register">
          <el-form @submit.prevent="onRegister">
            <el-form-item label="账户">
              <el-input v-model="regAccount" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="regPassword" type="password" />
            </el-form-item>
            <el-form-item label="昵称">
              <el-input v-model="regNickname" />
            </el-form-item>
            <el-form-item label="头像">
              <div class="avatar-upload">
                <input ref="avatarInput" type="file" accept="image/*" @change="onAvatarChange" style="display:none" />
                <div class="avatar-circle" @click="onAvatarClick">
                  <img v-if="regAvatarPreview" :src="regAvatarPreview" alt="avatar" />
                  <div v-else class="avatar-plus">
                    <el-icon class="avatar-plus-icon"><Plus /></el-icon>
                  </div>
                </div>
              </div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="onRegister" :loading="loading">注册</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Reading, Plus } from '@element-plus/icons-vue';
import { login, register } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

const router = useRouter();
const auth = useAuthStore();
const activeTab = ref('login');

const loginAccount = ref('');
const loginPassword = ref('');

const regAccount = ref('');
const regPassword = ref('');
const regNickname = ref('');
const regAvatarFile = ref<File | null>(null);
const regAvatarPreview = ref<string>('');
const avatarInput = ref<HTMLInputElement | null>(null);

const loading = ref(false);

function onAvatarChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files && input.files[0] ? input.files[0] : null;
  regAvatarFile.value = file;
  if (regAvatarPreview.value) {
    URL.revokeObjectURL(regAvatarPreview.value);
    regAvatarPreview.value = '';
  }
  if (file) {
    regAvatarPreview.value = URL.createObjectURL(file);
  }
}

function onAvatarClick() {
  avatarInput.value?.click();
}

async function onLogin() {
  const account = loginAccount.value.trim();
  const password = loginPassword.value;
  if (!account || account.length < 3 || account.length > 20) {
    ElMessage.error('请输入有效账户（3-20位）');
    return;
  }
  if (!password || password.length < 6 || password.length > 20) {
    ElMessage.error('请输入有效密码（6-20位）');
    return;
  }
  try {
    loading.value = true;
    const res = await login(account, password);
    const data = res.data;
    if (data.code === 200 && data.data) {
      auth.setUser(data.data);
      ElMessage.success('登录成功');
      router.push('/');
    } else {
      ElMessage.error('账号或密码错误');
    }
  } finally {
    loading.value = false;
  }
}

async function onRegister() {
  const account = regAccount.value.trim();
  const password = regPassword.value;
  const nickname = regNickname.value.trim();
  if (!account || account.length < 8 || account.length > 20) {
    ElMessage.error('请输入有效账户（8-20位）');
    return;
  }
  if (!password || password.length < 6 || password.length > 20) {
    ElMessage.error('请输入有效密码（6-20位）');
    return;
  }
  if (!nickname || nickname.length < 3 || nickname.length > 20) {
    ElMessage.error('请输入有效昵称（3-20位）');
    return;
  }
  try {
    loading.value = true;
    const res = await register(account, password, nickname, regAvatarFile.value || undefined);
    const data = res.data;
    if (data.code === 200 && data.data) {
      auth.setUser(data.data);
      ElMessage.success('注册成功');
      router.push('/');
    } else {
      ElMessage.error(data.msg || '注册失败');
    }
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f3efe9 0%, #e8e2d9 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 5%;
}

.auth-card {
  width: 440px;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 16px 48px rgba(61, 54, 48, 0.12);
  padding: 40px;
}

.auth-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
}

.logo-icon {
  font-size: 42px;
  color: var(--primary-color);
}

.auth-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.auth-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 4px 0 0 0;
}

.auth-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.auth-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  padding: 0 28px;
}

.auth-tabs :deep(.el-tabs__item.is-active) {
  color: var(--primary-color);
}

.auth-tabs :deep(.el-tabs__active-bar) {
  background: var(--primary-color);
  height: 3px;
  border-radius: 2px;
}

.auth-tabs :deep(.el-form) {
  padding-top: 20px;
}

.auth-tabs :deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--text-regular);
}

.auth-tabs :deep(.el-button.el-button--primary) {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  border: none;
  font-size: 15px;
  font-weight: 600;
}

.auth-tabs :deep(.el-button.el-button--primary:hover) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 115, 85, 0.3);
}

.avatar-upload {
  display: flex;
  justify-content: center;
}

.avatar-circle {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: var(--bg-card-soft);
  border: 2px dashed rgba(139, 115, 85, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: all var(--transition-normal);
}

.avatar-circle:hover {
  border-color: var(--primary-color);
  background: rgba(139, 115, 85, 0.05);
}

.avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-plus {
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-plus-icon {
  font-size: 28px;
  color: var(--text-placeholder);
}

.auth-tabs :deep(.el-input__wrapper),
.auth-tabs :deep(.el-textarea__inner) {
  border-radius: 10px;
}

.auth-tabs :deep(.el-form-item) {
  margin-bottom: 18px;
}
</style>