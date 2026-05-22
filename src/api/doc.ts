import http from './index'

export interface DocDTO {
  id: number
  kbId: number
  filename: string
  fileType: string
  status: string
  errorMessage: string | null
  fileSize: number
  created: string
}

export function listDocuments(kbId: number) {
  return http.get<DocDTO[]>(`/knowledge-bases/${kbId}/documents`)
}

export function uploadDocument(kbId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return http.post<DocDTO>(`/knowledge-bases/${kbId}/documents`, formData, {
    timeout: 120000,
  })
}

export function deleteDocument(id: number, kbId: number) {
  return http.delete<void>(`/documents/${id}`, { params: { kbId } })
}
