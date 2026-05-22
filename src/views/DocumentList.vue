<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Upload, Delete, ChatDotRound } from '@element-plus/icons-vue'
import { listDocuments, uploadDocument, deleteDocument, type DocDTO } from '@/api/doc'
import { getKnowledgeBase, type KbDTO } from '@/api/kb'
import { getSavedConvId } from '@/api/chat'

const route = useRoute()
const router = useRouter()
const kbId = Number(route.params.id)

const kb = ref<KbDTO | null>(null)
const docs = ref<DocDTO[]>([])
const loading = ref(false)
const uploading = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadData() {
  loading.value = true
  try {
    const [kbData, docData] = await Promise.all([
      getKnowledgeBase(kbId),
      listDocuments(kbId),
    ])
    kb.value = kbData
    docs.value = docData
    schedulePoll()
  } finally {
    loading.value = false
  }
}

function schedulePoll() {
  clearPoll()
  const hasPending = docs.value.some(d => d.status === 'PARSING')
  if (hasPending) {
    pollTimer = setInterval(async () => {
      try {
        docs.value = await listDocuments(kbId)
        if (!docs.value.some(d => d.status === 'PARSING')) {
          clearPoll()
        }
      } catch {
        clearPoll()
      }
    }, 3000)
  }
}

function clearPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const fileInput = ref<HTMLInputElement>()

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'pdf' && ext !== 'md' && ext !== 'markdown') {
    ElMessage.error('仅支持 PDF 和 Markdown 文件')
    input.value = ''
    return
  }
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 50MB')
    input.value = ''
    return
  }

  uploading.value = true
  try {
    await uploadDocument(kbId, file)
    ElMessage.success('上传成功')
    input.value = ''
    await loadData()
  } catch {
    input.value = ''
  } finally {
    uploading.value = false
  }
}

async function handleDelete(doc: DocDTO) {
  try {
    await ElMessageBox.confirm(`确定删除文档「${doc.filename}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
    await deleteDocument(doc.id, kbId)
    ElMessage.success('删除成功')
    await loadData()
  } catch {
    // 用户取消
  }
}

function goBack() {
  router.push('/')
}

function goToChat() {
  const convId = getSavedConvId(kbId)
  const query = convId ? `?conv=${convId}` : ''
  router.push(`/knowledge-base/${kbId}/chat${query}`)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PARSING: '解析中',
    READY: '就绪',
    ERROR: '失败',
  }
  return map[status] || status
}

onMounted(() => {
  loadData()
})

onUnmounted(() => {
  clearPoll()
})
</script>

<template>
  <div class="doc-container">
    <div class="doc-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <div v-if="kb" class="kb-info">
        <h1>{{ kb.name }}</h1>
        <span class="kb-desc">{{ kb.description || '暂无描述' }}</span>
        <span class="kb-count">{{ kb.documentCount }} 个文档</span>
      </div>
    </div>

    <div class="doc-toolbar">
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,.md,.markdown"
        style="display: none"
        @change="handleFileChange"
      />
      <el-button type="primary" :icon="Upload" :loading="uploading" @click="triggerUpload">
        {{ uploading ? '上传中...' : '上传文档' }}
      </el-button>
      <el-button type="success" :icon="ChatDotRound" @click="goToChat">
        AI 问答
      </el-button>
      <span class="upload-hint">支持 PDF、Markdown 文件，最大 50MB</span>
    </div>

    <div v-loading="loading || uploading" class="doc-content">
      <template v-if="!loading && docs.length === 0">
        <el-empty description="还没有文档，点击上方按钮上传" />
      </template>

      <el-table v-else :data="docs" style="width: 100%">
        <el-table-column prop="filename" label="文件名" min-width="200">
          <template #default="{ row }">
            <span class="doc-filename">{{ row.filename }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="fileType" label="类型" width="110" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'READY' ? 'success' : row.status === 'ERROR' ? 'danger' : 'warning'"
              size="small"
            >
              {{ statusLabel(row.status) }}
            </el-tag>
            <el-tooltip v-if="row.status === 'ERROR' && row.errorMessage" :content="row.errorMessage">
              <span class="error-icon">?</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">
            {{ formatFileSize(row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column label="上传时间" width="180">
          <template #default="{ row }">
            {{ new Date(row.created).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" :icon="Delete" circle size="small" @click="handleDelete(row)" />
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.doc-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.doc-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}

.kb-info h1 {
  margin: 0 0 4px;
  font-size: 24px;
}

.kb-info .kb-desc {
  color: #666;
  margin-right: 16px;
}

.kb-info .kb-count {
  color: #999;
  font-size: 14px;
}

.doc-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.upload-hint {
  color: #999;
  font-size: 13px;
}

.doc-content {
  min-height: 200px;
}

.doc-filename {
  font-weight: 500;
}

.error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  border-radius: 50%;
  background: #f56c6c;
  color: #fff;
  font-size: 11px;
  cursor: help;
  vertical-align: middle;
}
</style>
