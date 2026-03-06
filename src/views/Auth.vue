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
  background:
    linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6)),
    url('/bookshelf-bg.jpg') center/cover fixed;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 5%;
}

.auth-card {
  width: 600px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
  padding: 24px;
}

.auth-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
}

.logo-icon {
  font-size: 36px;
  color: #667eea;
}

.auth-title {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.auth-subtitle {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

.auth-tabs :deep(.el-tabs__nav) {
  display: flex;
  justify-content: center;
}

.auth-tabs :deep(.el-tabs__item) {
  font-weight: 600;
}

.auth-tabs :deep(.el-form) {
  padding-top: 12px;
}

.auth-tabs :deep(.el-form-item) {
  margin-bottom: 14px;
}

.auth-tabs :deep(.el-button.el-button--primary) {
  position: relative;
  padding: 12px 24px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
  box-shadow: 0 6px 18px rgba(102, 126, 234, 0.35);
  transition: transform .15s ease, box-shadow .2s ease, filter .2s ease;
  overflow: hidden;
}
.auth-tabs :deep(.el-button.el-button--primary:hover) {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(102, 126, 234, 0.45);
  filter: brightness(1.05);
}
.auth-tabs :deep(.el-button.el-button--primary:active) {
  transform: translateY(0);
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.3);
  filter: brightness(0.98);
}
.auth-tabs :deep(.el-button.el-button--primary)::before {
  content: "";
  position: absolute;
  top: 0;
  left: -150%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  transform: skewX(-20deg);
  transition: left .6s ease;
}
.auth-tabs :deep(.el-button.el-button--primary:hover)::before {
  left: 150%;
}

.avatar-upload {
  display: flex;
  justify-content: center;
}
.avatar-circle {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: rgba(255,255,255,0.9);
  border: 3px solid rgba(102, 126, 234, 0.3);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  overflow: hidden;
  position: relative;
  cursor: pointer;
}
.avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-plus {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667eea;
}
.avatar-plus-icon {
  font-size: 32px;
}
</style>