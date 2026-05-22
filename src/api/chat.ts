import http from './index'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export interface ConversationDTO {
  id: number
  kbId: number
  title: string
  created: string
  updated: string
  messageCount: number
}

export interface ChatMessageDTO {
  id: number
  role: string
  content: string
  sources: string | null
  tokenCount: number
  created: string
}

export interface SourceRefDTO {
  documentName: string
  chunkIndex: number
  content: string
}

export interface SendMessageRequest {
  conversationId: number | null
  message: string
}

export interface SSEEvent {
  type: 'token' | 'done' | 'error'
  content?: string
  message?: string
  conversationId?: number
}

const CONV_STORAGE_PREFIX = 'wiki_conv_'

export function saveConvIdForKb(kbId: number, convId: number) {
  localStorage.setItem(CONV_STORAGE_PREFIX + kbId, String(convId))
}

export function getSavedConvId(kbId: number): number | null {
  const v = localStorage.getItem(CONV_STORAGE_PREFIX + kbId)
  return v ? Number(v) : null
}

export function clearAllSavedConvIds() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CONV_STORAGE_PREFIX))
  keys.forEach(k => localStorage.removeItem(k))
}

export function getConvIdFromRoute(): number | null {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('conv')
  return id ? Number(id) : null
}

export function updateConvIdInRoute(convId: number) {
  const url = new URL(window.location.href)
  url.searchParams.set('conv', String(convId))
  window.history.replaceState({}, '', url.toString())
}

export function listConversations(kbId: number) {
  return http.get<ConversationDTO[]>(`/knowledge-bases/${kbId}/conversations`)
}

export function listMessages(conversationId: number) {
  return http.get<ChatMessageDTO[]>(`/conversations/${conversationId}/messages`)
}

export function sendMessage(
  kbId: number,
  request: SendMessageRequest,
  onToken: (token: string) => void,
  onDone: (conversationId: number) => void,
  onError: (message: string) => void,
): AbortController {
  const controller = new AbortController()
  const token = localStorage.getItem('token')
  const apiKey = localStorage.getItem('dashscope_api_key')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  fetch(`${API_BASE}/knowledge-bases/${kbId}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text()
        onError(text || '请求失败')
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        onError('无法读取响应流')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.substring(5).trim()
            try {
              const event: SSEEvent = JSON.parse(data)
              if (event.type === 'token' && event.content) {
                onToken(event.content)
              } else if (event.type === 'done') {
                onDone(event.conversationId || 0)
              } else if (event.type === 'error') {
                onError(event.message || '服务器错误')
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message || '网络错误')
      }
    })

  return controller
}
