import http from './index'

export interface KbDTO {
  id: number
  name: string
  description: string
  documentCount: number
  created: string
}

export function listKnowledgeBases() {
  return http.get<KbDTO[]>('/knowledge-bases')
}

export function getKnowledgeBase(id: number) {
  return http.get<KbDTO>(`/knowledge-bases/${id}`)
}

export function createKnowledgeBase(data: { name: string; description?: string }) {
  return http.post<KbDTO>('/knowledge-bases', data)
}

export function updateKnowledgeBase(id: number, data: { name: string; description?: string }) {
  return http.put<KbDTO>(`/knowledge-bases/${id}`, data)
}

export function deleteKnowledgeBase(id: number) {
  return http.delete<void>(`/knowledge-bases/${id}`)
}
