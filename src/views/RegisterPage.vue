<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { warmup } from '@/api/auth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const warmingUp = ref(true)

onMounted(async () => {
  try {
    await warmup()
  } catch {
    // 预热失败不影响正常使用
  } finally {
    warmingUp.value = false
  }
})

async function handleRegister() {
  if (!username.value || !password.value || !confirmPassword.value) {
    ElMessage.warning('请填写所有字段')
    return
  }
  if (username.value.length < 3) {
    ElMessage.warning('用户名至少 3 位')
    return
  }
  if (password.value.length < 6) {
    ElMessage.warning('密码至少 6 位')
    return
  }
  if (password.value !== confirmPassword.value) {
    ElMessage.warning('两次密码不一致')
    return
  }

  loading.value = true
  try {
    await authStore.register(username.value, password.value)
    ElMessage.success('注册成功')
    router.push('/')
  } catch {
    // 错误已在 axios 拦截器中处理
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-container">
    <el-card class="register-card">
      <h2 class="register-title">注册账号</h2>
      <el-form @submit.prevent="handleRegister">
        <el-form-item>
          <el-input
            v-model="username"
            placeholder="用户名（至少 3 位）"
            size="large"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="password"
            type="password"
            placeholder="密码（至少 6 位）"
            size="large"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="confirmPassword"
            type="password"
            placeholder="确认密码"
            size="large"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading || warmingUp"
            style="width: 100%"
            native-type="submit"
          >
            {{ warmingUp ? '正在唤醒服务...' : '注册' }}
          </el-button>
        </el-form-item>
      </el-form>
      <p class="register-link">
        已有账号？<router-link to="/login">去登录</router-link>
      </p>
    </el-card>
  </div>
</template>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f5f7fa;
}

.register-card {
  width: 400px;
}

.register-title {
  text-align: center;
  margin-bottom: 24px;
  color: #303133;
}

.register-link {
  text-align: center;
  color: #909399;
  font-size: 14px;
}
</style>
