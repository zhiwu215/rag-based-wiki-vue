<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Edit, Delete, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listKnowledgeBases, createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase } from '@/api/kb'
import type { KbDTO } from '@/api/kb'
import { clearAllSavedConvIds } from '@/api/chat'

const router = useRouter()

const kbs = ref<KbDTO[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const submitting = ref(false)
const editingId = ref<number | null>(null)
const form = ref({ name: '', description: '' })

const dialogTitle = computed(() => (editingId.value ? '编辑知识库' : '新建知识库'))

async function loadKbs() {
  loading.value = true
  try {
    kbs.value = await listKnowledgeBases()
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  editingId.value = null
  form.value = { name: '', description: '' }
  dialogVisible.value = true
}

function openEditDialog(kb: KbDTO) {
  editingId.value = kb.id
  form.value = { name: kb.name, description: kb.description }
  dialogVisible.value = true
}

async function handleSubmit() {
  submitting.value = true
  try {
    if (editingId.value) {
      await updateKnowledgeBase(editingId.value, form.value)
      ElMessage.success('更新成功')
    } else {
      await createKnowledgeBase(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await loadKbs()
  } finally {
    submitting.value = false
  }
}

async function handleDelete(kb: KbDTO) {
  try {
    await ElMessageBox.confirm(`确定删除知识库「${kb.name}」吗？此操作不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
    await deleteKnowledgeBase(kb.id)
    ElMessage.success('删除成功')
    await loadKbs()
  } catch {
    // 用户取消
  }
}

function goToDocuments(kb: KbDTO) {
  router.push(`/knowledge-base/${kb.id}`)
}

function goToChat(kb: KbDTO) {
  router.push(`/knowledge-base/${kb.id}/chat`)
}

onMounted(() => {
  clearAllSavedConvIds()
  loadKbs()
})
</script>

<template>
  <div class="kb-container">
    <div class="kb-header">
      <h1>我的知识库</h1>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建知识库</el-button>
    </div>

    <div v-loading="loading" class="kb-content">
      <template v-if="!loading && kbs.length === 0">
        <el-empty description="还没有知识库，点击上方按钮创建" />
      </template>

      <div v-else class="kb-grid">
        <el-card
          v-for="kb in kbs"
          :key="kb.id"
          class="kb-card"
          shadow="hover"
          @click="goToDocuments(kb)"
        >
          <template #header>
            <div class="kb-card-header">
              <span class="kb-name">{{ kb.name }}</span>
              <div class="kb-card-actions">
                <el-button :icon="Edit" circle size="small" @click.stop="openEditDialog(kb)" />
                <el-button
                  type="danger"
                  :icon="Delete"
                  circle
                  size="small"
                  @click.stop="handleDelete(kb)"
                />
              </div>
            </div>
          </template>
          <p class="kb-desc">{{ kb.description || '暂无描述' }}</p>
          <div class="kb-meta">
            <span>{{ kb.documentCount }} 个文档</span>
            <span>{{ new Date(kb.created).toLocaleDateString() }}</span>
          </div>
          <el-button
            type="primary"
            :icon="ChatDotRound"
            size="small"
            class="chat-btn"
            @click.stop="goToChat(kb)"
          >
            AI 问答
          </el-button>
        </el-card>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="100" placeholder="请输入知识库名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="可选，简要描述知识库内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.kb-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.kb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.kb-header h1 {
  margin: 0;
  font-size: 24px;
}

.kb-content {
  min-height: 200px;
}

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.kb-card {
  cursor: pointer;
}

.kb-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kb-name {
  font-weight: 600;
  font-size: 16px;
}

.kb-card-actions {
  display: flex;
  gap: 4px;
}

.kb-desc {
  color: #666;
  margin-bottom: 12px;
  min-height: 40px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kb-meta {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #999;
}

.chat-btn {
  margin-top: 8px;
  width: 100%;
}
</style>
