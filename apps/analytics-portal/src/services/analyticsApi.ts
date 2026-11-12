const apiBaseUrl = import.meta.env.VITE_ANALYTICS_API_BASE_URL ?? '/analytics-api'
const authBaseUrl = import.meta.env.VITE_AUTH_API_BASE_URL ?? '/auth-api'

export interface AnalyticsUser {
  id: string
  email: string
  role: 'analyst' | 'administrator' | 'contributor'
  displayName?: string
  organization?: string | null
  mustChangePassword?: boolean
}

export interface AnalyticsSubmission {
  id: string
  projectName: string
  site: string | null
  countryCode: string | null
  status: string
  createdAt: string
  clientEmail: string
  clientName: string | null
  fileCount: number
  analystId: string | null
}

export interface Analyst {
  id: string
  displayName: string
  email: string
}

export interface SubmissionFile {
  id: string
  fileName: string
  contentType: string
  fileSize: number
  createdAt: string
}

export interface AdminUser {
  id: string
  email: string
  role: 'contributor' | 'analyst' | 'administrator'
  status: 'active' | 'invited' | 'suspended' | 'deleted'
  displayName?: string | null
  organization?: string | null
  createdAt: string
  updatedAt: string
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
  const body = await response.json().catch(() => ({ detail: 'The service returned an invalid response' }))
  if (response.status === 401 && !path.includes('/auth/login')) {
    localStorage.removeItem('databridge_token')
    window.dispatchEvent(new Event('databridge-session-expired'))
  }
  if (!response.ok) throw new Error(body.detail ?? 'The request failed')
  return body as T
}

export const analyticsApi = {
  async login(email: string, password: string) {
    const result = await request<{ token: string; user: AnalyticsUser }>(authBaseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (!['analyst', 'administrator'].includes(result.user.role)) {
      localStorage.setItem('databridge_token', result.token)
      try {
        await request<void>(authBaseUrl, '/auth/logout', { method: 'POST' })
      } finally {
        localStorage.removeItem('databridge_token')
      }
      throw new Error('This account does not have analytics workspace access.')
    }
    localStorage.setItem('databridge_token', result.token)
    return result.user
  },
  me() {
    return request<AnalyticsUser>(authBaseUrl, '/me')
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
  submissions() {
    return request<AnalyticsSubmission[]>(apiBaseUrl, '/submissions')
  },
  submissionFiles(submissionId: string) {
    return request<SubmissionFile[]>(authBaseUrl, `/submissions/${submissionId}/files`)
  },
  presignedFileDownload(fileId: string) {
    const query = new URLSearchParams({ file_id: fileId })
    return request<{ downloadUrl: string; expiresIn: number }>(authBaseUrl, `/storage/presigned-download?${query}`, {
      method: 'POST',
    })
  },
  myAssignments() {
    return request<AnalyticsSubmission[]>(apiBaseUrl, '/assignments/mine')
  },
  analysts() {
    return request<Analyst[]>(apiBaseUrl, '/analysts')
  },
  updateStatus(submissionId: string, status: string) {
    return request<{ id: string; status: string }>(apiBaseUrl, `/submissions/${submissionId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  assign(submissionId: string, analystId: string) {
    return request(apiBaseUrl, `/submissions/${submissionId}/assignment`, {
      method: 'POST',
      body: JSON.stringify({ analystId }),
    })
  },
  adminUsers() {
    return request<AdminUser[]>(authBaseUrl, '/admin/users')
  },
  updateUserStatus(userId: string, status: 'active' | 'suspended') {
    return request<{ id: string; status: string }>(authBaseUrl, `/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteUser(userId: string, reason: string) {
    return request<{ id: string; status: string }>(authBaseUrl, `/admin/users/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmation: 'DELETE', reason }),
    })
  },
  createUser(data: { email: string; displayName: string; role: AdminUser['role']; organization?: string }) {
    return request<AdminUser & { temporaryPassword: string; mustChangePassword: boolean }>(authBaseUrl, '/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateUserRole(userId: string, role: AdminUser['role']) {
    return request<{ id: string; role: string }>(authBaseUrl, `/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  },
  resetUserPassword(userId: string) {
    return request<{ id: string; email: string; temporaryPassword: string; mustChangePassword: boolean }>(authBaseUrl, `/admin/users/${userId}/reset-password`, {
      method: 'POST',
    })
  },
  changePassword(currentPassword: string, newPassword: string) {
    return request<{ status: string }>(authBaseUrl, '/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  },
}
