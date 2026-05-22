<script setup lang="ts">
import { ref, nextTick, watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Promotion, CopyDocument } from '@element-plus/icons-vue'
import { getKnowledgeBase, type KbDTO } from '@/api/kb'
import { sendMessage, listMessages, getConvIdFromRoute, updateConvIdInRoute, saveConvIdForKb, getSavedConvId, type ChatMessageDTO, type SourceRefDTO } from '@/api/chat'
import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import markdown from 'highlight.js/lib/languages/markdown'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('markdown', markdown)

marked.setOptions({
  highlight: function (code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
})

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceRefDTO[]
  isStreaming: boolean
}

const route = useRoute()
const router = useRouter()
const kbId = Number(route.params.id)

const kb = ref<KbDTO | null>(null)
const messages = ref<Message[]>([])
const inputText = ref('')
const isStreaming = ref(false)
const loading = ref(false)
const conversationId = ref<number | null>(null)
let abortController: AbortController | null = null

const chatContainer = ref<HTMLElement>()
const showScrollBtn = ref(false)

const exampleQuestions = [
  '这个知识库包含哪些内容？',
  '请总结文档中的关键信息',
  '文档中提到了哪些重要概念？',
]

async function loadKb() {
  try {
    kb.value = await getKnowledgeBase(kbId)
  } catch {
    ElMessage.error('知识库不存在')
    router.push('/')
  }
}

async function loadHistory(convId: number) {
  try {
    const msgs = await listMessages(convId)
    messages.value = msgs.map((m: ChatMessageDTO) => ({
      id: String(m.id),
      role: m.role as 'user' | 'assistant',
      content: m.content,
      sources: m.sources ? JSON.parse(m.sources) : undefined,
      isStreaming: false,
    }))
  } catch {
    // ignore
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

function onScroll() {
  if (chatContainer.value) {
    const { scrollTop, scrollHeight, clientHeight } = chatContainer.value
    showScrollBtn.value = scrollHeight - scrollTop - clientHeight > 150
  }
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return

  inputText.value = ''

  const userMsg: Message = {
    id: 'user-' + Date.now(),
    role: 'user',
    content: text,
    isStreaming: false,
  }
  messages.value.push(userMsg)
  scrollToBottom()

  const aiMsg: Message = {
    id: 'ai-' + Date.now(),
    role: 'assistant',
    content: '',
    isStreaming: true,
  }
  messages.value.push(aiMsg)
  scrollToBottom()

  isStreaming.value = true

  abortController = sendMessage(
    kbId,
    { conversationId: conversationId.value, message: text },
    (token: string) => {
      aiMsg.content += token
      scrollToBottom()
    },
    (convId: number) => {
      if (!conversationId.value && convId) {
        conversationId.value = convId
        updateConvIdInRoute(convId)
        saveConvIdForKb(kbId, convId)
      }
      aiMsg.isStreaming = false
      isStreaming.value = false
      abortController = null
      scrollToBottom()
    },
    (errorMsg: string) => {
      aiMsg.isStreaming = false
      isStreaming.value = false
      abortController = null
      if (!aiMsg.content) {
        aiMsg.content = '错误: ' + errorMsg
      }
    },
  )
}

function handleStop() {
  if (abortController) {
    abortController.abort()
  }
  const lastMsg = messages.value[messages.value.length - 1]
  if (lastMsg && lastMsg.isStreaming) {
    lastMsg.isStreaming = false
    if (!lastMsg.content) {
      lastMsg.content = '已停止生成'
    }
  }
  isStreaming.value = false
}

function handleRegenerate() {
  const lastUserMsg = [...messages.value].reverse().find((m) => m.role === 'user')
  if (!lastUserMsg) return

  // Remove last AI response
  const lastAiIdx = messages.value.findLastIndex((m) => m.role === 'assistant')
  if (lastAiIdx >= 0) {
    messages.value.splice(lastAiIdx, 1)
  }

  inputText.value = lastUserMsg.content
  handleSend()
}

function copyContent(content: string) {
  navigator.clipboard.writeText(content).then(() => {
    ElMessage.success('已复制')
  })
}

function copyCode(code: string) {
  navigator.clipboard.writeText(code).then(() => {
    ElMessage.success('代码已复制')
  })
}

function goBack() {
  router.push(`/knowledge-base/${kbId}`)
}

function newConversation() {
  conversationId.value = null
  messages.value = []
  const url = new URL(window.location.href)
  url.searchParams.delete('conv')
  window.history.replaceState({}, '', url.toString())
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string
  } catch {
    return content
  }
}

onMounted(async () => {
  await loadKb()
  let convId = getConvIdFromRoute()
  if (!convId) {
    convId = getSavedConvId(kbId)
    if (convId) {
      updateConvIdInRoute(convId)
    }
  }
  if (convId) {
    conversationId.value = convId
    await loadHistory(convId)
    scrollToBottom()
  }
})

defineExpose({})
</script>

<template>
  <div class="chat-page">
    <!-- Header -->
    <header class="chat-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <span v-if="kb" class="kb-name">{{ kb.name }}</span>
      </div>
      <el-button @click="newConversation" :disabled="messages.length === 0">新对话</el-button>
    </header>

    <!-- Messages Area -->
    <div ref="chatContainer" class="chat-messages" @scroll="onScroll">
      <div v-if="messages.length === 0" class="chat-empty">
        <h2>向知识库提问</h2>
        <p class="empty-hint">基于知识库文档内容，AI 将为您提供准确回答</p>
        <div class="example-questions">
          <el-button
            v-for="q in exampleQuestions"
            :key="q"
            class="example-btn"
            @click="inputText = q; handleSend()"
          >
            {{ q }}
          </el-button>
        </div>
      </div>

      <div v-for="msg in messages" :key="msg.id" class="message-wrapper">
        <!-- User Message -->
        <div v-if="msg.role === 'user'" class="message-row user-row">
          <div class="message-bubble user-bubble">
            <div class="bubble-content">{{ msg.content }}</div>
          </div>
        </div>

        <!-- AI Message -->
        <div v-else class="message-row ai-row">
          <div class="message-bubble ai-bubble">
            <div
              class="bubble-content markdown-body"
              v-html="renderMarkdown(msg.content) || (msg.isStreaming ? '<span class=\'thinking-dot\'></span>' : '')"
            ></div>

            <!-- Thinking animation -->
            <div v-if="msg.isStreaming && !msg.content" class="thinking-indicator">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>

            <!-- Sources -->
            <div v-if="msg.sources && msg.sources.length > 0 && !msg.isStreaming" class="sources-section">
              <div class="sources-title">参考来源</div>
              <div v-for="(src, idx) in msg.sources" :key="idx" class="source-item">
                <span class="source-doc">{{ src.documentName }}</span>
                <span class="source-chunk">段落 {{ src.chunkIndex }}</span>
                <p class="source-text">{{ src.content.length > 100 ? src.content.substring(0, 100) + '...' : src.content }}</p>
              </div>
            </div>

            <!-- Actions -->
            <div v-if="!msg.isStreaming && msg.content" class="bubble-actions">
              <el-button size="small" text :icon="CopyDocument" @click="copyContent(msg.content)">复制</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Scroll to bottom button -->
      <transition name="fade">
        <div v-if="showScrollBtn" class="scroll-to-bottom" @click="scrollToBottom">
          <span>↓</span>
        </div>
      </transition>
    </div>

    <!-- Input Area -->
    <footer class="chat-input-area">
      <div class="input-wrapper">
        <textarea
          v-model="inputText"
          class="chat-textarea"
          :rows="1"
          placeholder="输入您的问题... (Enter 发送, Shift+Enter 换行)"
          @keydown="handleKeydown"
          :disabled="isStreaming"
        ></textarea>
        <div class="input-actions">
          <el-button
            v-if="isStreaming"
            type="danger"
            @click="handleStop"
          >
            停止
          </el-button>
          <el-button
            v-else
            type="primary"
            :icon="Promotion"
            :disabled="!inputText.trim()"
            @click="handleSend"
          >
            发送
          </el-button>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 900px;
  margin: 0 auto;
}

/* Header */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e5e5e5;
  background: #fff;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.kb-name {
  font-size: 16px;
  font-weight: 600;
}

/* Messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  position: relative;
}

/* Empty state */
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.chat-empty h2 {
  margin-bottom: 8px;
  color: #333;
}

.empty-hint {
  color: #999;
  margin-bottom: 24px;
}

.example-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.example-btn {
  max-width: 300px;
}

/* Message rows */
.message-wrapper {
  margin-bottom: 20px;
}

.message-row {
  display: flex;
  max-width: 85%;
}

.user-row {
  margin-left: auto;
  justify-content: flex-end;
}

.ai-row {
  margin-right: auto;
}

/* Bubbles */
.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.6;
}

.user-bubble {
  background: #409eff;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.ai-bubble {
  background: #f5f5f5;
  border-bottom-left-radius: 4px;
}

/* Markdown body */
.markdown-body {
  word-break: break-word;
}

.markdown-body :deep(pre) {
  position: relative;
  background: #282c34;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  margin: 8px 0;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 14px;
  line-height: 1.5;
}

.markdown-body :deep(code) {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 14px;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #f5f5f5;
}

.markdown-body :deep(blockquote) {
  border-left: 4px solid #409eff;
  padding-left: 12px;
  margin: 8px 0;
  color: #666;
}

/* Thinking indicator */
.thinking-indicator {
  display: flex;
  gap: 6px;
  padding: 8px 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #bbb;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
.dot:nth-child(3) { animation-delay: 0s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Sources */
.sources-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
}

.sources-title {
  font-size: 13px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.source-item {
  padding: 6px 8px;
  margin-bottom: 6px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
}

.source-doc {
  font-size: 12px;
  font-weight: 500;
  color: #409eff;
  margin-right: 8px;
}

.source-chunk {
  font-size: 11px;
  color: #999;
}

.source-text {
  font-size: 12px;
  color: #666;
  margin: 4px 0 0;
}

/* Bubble actions */
.bubble-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 8px;
}

/* Scroll to bottom */
.scroll-to-bottom {
  position: sticky;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 36px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  font-size: 18px;
  z-index: 10;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Input */
.chat-input-area {
  padding: 12px 20px;
  border-top: 1px solid #e5e5e5;
  background: #fff;
  flex-shrink: 0;
}

.input-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.chat-textarea {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  min-height: 42px;
  max-height: 150px;
}

.chat-textarea:focus {
  border-color: #409eff;
}

.input-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
