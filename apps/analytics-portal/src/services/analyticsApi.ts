const apiBaseUrl = import.meta.env.VITE_ANALYTICS_API_BASE_URL ?? '/api'

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
  const body = await response.json().catch(() => ({ detail: 'The service returned an invalid response' }))
  if (!response.ok) throw new Error(body.detail ?? 'The request failed')
  return body as T
}

export const analyticsApi = {
  submissions() {
    return request<unknown[]>('/submissions')
  },
  myAssignments() {
    return request<unknown[]>('/assignments/mine')
  },
}
