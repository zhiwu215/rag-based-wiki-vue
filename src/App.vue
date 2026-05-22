<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isAuthPage = computed(() => route.path === '/login' || route.path === '/register')

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

const apiKeyDialogVisible = ref(false)
const apiKeyInput = ref(localStorage.getItem('dashscope_api_key') || '')
const savedApiKey = ref(localStorage.getItem('dashscope_api_key') || '')

function openApiKeyDialog() {
  apiKeyInput.value = savedApiKey.value
  apiKeyDialogVisible.value = true
}

function saveApiKey() {
  const key = apiKeyInput.value.trim()
  if (key) {
    localStorage.setItem('dashscope_api_key', key)
  } else {
    localStorage.removeItem('dashscope_api_key')
  }
  savedApiKey.value = key
  apiKeyDialogVisible.value = false
}
</script>

<template>
  <div v-if="!isAuthPage" class="top-nav">
    <span class="nav-title">知识库管理</span>
    <div class="nav-right">
      <el-button size="small" @click="openApiKeyDialog">
        {{ savedApiKey ? '已配置 API Key' : '设置 API Key' }}
      </el-button>
      <span class="username">{{ authStore.user?.username }}</span>
      <el-button size="small" @click="handleLogout">退出登录</el-button>
    </div>
  </div>

  <div :class="{ 'main-content': !isAuthPage }">
    <router-view />
  </div>

  <el-dialog v-model="apiKeyDialogVisible" title="设置 DashScope API Key" width="500px">
    <el-form>
      <el-form-item label="API Key">
        <el-input
          v-model="apiKeyInput"
          placeholder="请输入您的阿里云百炼 DashScope API Key"
          clearable
        />
      </el-form-item>
    </el-form>
    <p class="api-key-hint">
      前往
      <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noopener">
        阿里云百炼控制台
      </a>
      获取 API Key（注册/登录后在「模型工具 → API Key 管理」中创建）
    </p>
    <template #footer>
      <el-button @click="apiKeyDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveApiKey">保存</el-button>
    </template>
  </el-dialog>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 48px;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e5e5e5;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.nav-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.username {
  font-size: 14px;
  color: #666;
}

.main-content {
  height: calc(100vh - 48px);
}

.api-key-hint {
  font-size: 13px;
  color: #909399;
  margin: 0 0 4px;
  padding-left: 4px;
}

.api-key-hint a {
  color: #409eff;
  text-decoration: none;
}

.api-key-hint a:hover {
  text-decoration: underline;
}
</style>
