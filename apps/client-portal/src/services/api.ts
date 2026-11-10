const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

export interface ApiUser {
  id: string
  email: string
  role: 'contributor' | 'analyst' | 'administrator'
  displayName?: string
  organization?: string | null
  countryCode?: string | null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('databridge_token')
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const body = await response.json().catch(() => ({ error: 'The server returned an invalid response' }))
  if (!response.ok) throw new Error(body.error ?? 'The request failed')
  return body as T
}

export const authApi = {
  register(data: {
    email: string
    password: string
    displayName: string
    organization?: string
    countryCode?: string
  }) {
    return request<{ user: ApiUser }>('/auth/register', { method: 'POST', body: JSON.stringify(data) })
  },
  async login(email: string, password: string) {
    const result = await request<{ token: string; user: ApiUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem('databridge_token', result.token)
    return result.user
  },
  me() {
    return request<ApiUser>('/me')
  },
  logout() {
    localStorage.removeItem('databridge_token')
  },
}

export const storageApi = {
  presignedUpload(submissionId: string, data: { fileName: string; contentType?: string; contentLength?: number }) {
    const query = new URLSearchParams({ submission_id: submissionId })
    return request<{ fileId: string; bucket: string; key: string; uploadUrl: string; expiresIn: number }>(`/storage/presigned-upload?${query}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  presignedDownload(fileId: string) {
    const query = new URLSearchParams({ file_id: fileId })
    return request<{ downloadUrl: string; expiresIn: number }>(`/storage/presigned-download?${query}`, {
      method: 'POST',
    })
  },
}
