const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
const authBaseUrl = import.meta.env.VITE_AUTH_API_BASE_URL ?? '/auth-api'

export interface ApiUser {
  id: string
  email: string
  role: 'contributor' | 'analyst' | 'administrator'
  displayName?: string
  organization?: string | null
  countryCode?: string | null
  phone?: string | null
  avatarUrl?: string | null
}

export interface Submission {
  id: string
  projectName: string
  site?: string | null
  countryCode?: string | null
  status: string
  createdAt: string
  fileCount: number
}

export interface SubmissionFile {
  id: string
  fileName: string
  contentType: string
  fileSize: number
  createdAt: string
}

async function request<T>(baseUrl: string, path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('databridge_token')
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const body = await response.json().catch(() => ({ error: 'The server returned an invalid response' }))
  if (response.status === 401 && !path.includes('/auth/login')) {
    localStorage.removeItem('databridge_token')
    window.dispatchEvent(new Event('databridge-session-expired'))
  }
  if (!response.ok) throw new Error(body.error ?? body.detail ?? 'The request failed')
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
    return request<{ user: ApiUser }>(authBaseUrl, '/auth/register', { method: 'POST', body: JSON.stringify(data) })
  },
  async login(email: string, password: string) {
    const result = await request<{ token: string; user: ApiUser }>(authBaseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem('databridge_token', result.token)
    return result.user
  },
  me() {
    return request<ApiUser>(authBaseUrl, '/me')
  },
  async logout() {
    try {
      await request<void>(authBaseUrl, '/auth/logout', { method: 'POST' })
    } finally {
      localStorage.removeItem('databridge_token')
    }
  },
  clearSession() {
    localStorage.removeItem('databridge_token')
  },
}

export const storageApi = {
  presignedUpload(submissionId: string, data: { fileName: string; contentType?: string; contentLength?: number }) {
    const query = new URLSearchParams({ submission_id: submissionId })
    return request<{ fileId: string; bucket: string; key: string; uploadUrl: string; expiresIn: number }>(apiBaseUrl, `/storage/presigned-upload?${query}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  completeUpload(submissionId: string, data: {
    fileId: string
    key: string
    fileName: string
    contentType: string
    contentLength: number
  }) {
    const query = new URLSearchParams({ submission_id: submissionId })
    return request<{ fileId: string }>(apiBaseUrl, `/storage/complete-upload?${query}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  presignedReportDownload(reportId: string) {
    const query = new URLSearchParams({ report_id: reportId })
    return request<{ downloadUrl: string; expiresIn: number }>(apiBaseUrl, `/storage/presigned-report-download?${query}`, {
      method: 'POST',
    })
  },
  submissionFiles(submissionId: string) {
    return request<SubmissionFile[]>(apiBaseUrl, `/submissions/${submissionId}/files`)
  },
  presignedFileDownload(fileId: string) {
    const query = new URLSearchParams({ file_id: fileId })
    return request<{ downloadUrl: string; expiresIn: number }>(apiBaseUrl, `/storage/presigned-download?${query}`, {
      method: 'POST',
    })
  },
}

export const submissionsApi = {
  create(data: {
    projectName: string
    site?: string
    countryCode?: string
    cameraId?: string
    description?: string
  }) {
    return request<Submission>(apiBaseUrl, '/submissions', { method: 'POST', body: JSON.stringify(data) })
  },
  list() {
    return request<Submission[]>(apiBaseUrl, '/submissions')
  },
  remove(submissionId: string) {
    return request<void>(apiBaseUrl, `/submissions/${submissionId}`, { method: 'DELETE' })
  },
}

export interface Report {
  id: string
  fileName: string
  publishedAt: string
  submissionId: string
  projectName: string
}

export const reportsApi = {
  list() {
    return request<Report[]>(apiBaseUrl, '/reports')
  },
}
