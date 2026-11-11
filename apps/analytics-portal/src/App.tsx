import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  BarChart3, ChevronDown, ChevronLeft, ChevronRight, Download, FileCheck2, Files, FolderKanban,
  LayoutDashboard, LoaderCircle, LogOut, Menu, Users, UploadCloud, X,
} from 'lucide-react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { analyticsApi, type AnalyticsSubmission, type AnalyticsUser, type SubmissionFile } from './services/analyticsApi'
import './App.css'

const navigation = [
  { label: 'Dashboard', to: '/analytics', icon: LayoutDashboard },
  { label: 'Submission inbox', to: '/analytics/inbox', icon: Files },
  { label: 'My assignments', to: '/analytics/assignments', icon: Users },
  { label: 'Completed analysis', to: '/analytics/completed', icon: FileCheck2 },
]

function Logo() {
  return <div className="brand-mark"><span className="brand-symbol"><i /><i /><i /></span><span>DataBridge</span></div>
}

function AuthGate() {
  const [user, setUser] = useState<AnalyticsUser | null>(null)
  const [checking, setChecking] = useState(Boolean(localStorage.getItem('databridge_token')))
  const location = useLocation()
  useEffect(() => {
    let active = true
    const expireSession = () => setUser(null)
    window.addEventListener('databridge-session-expired', expireSession)
    if (!localStorage.getItem('databridge_token')) {
      setChecking(false)
      return () => {
        active = false
        window.removeEventListener('databridge-session-expired', expireSession)
      }
    }
    analyticsApi.me().then((account) => {
      if (active && ['analyst', 'administrator'].includes(account.role)) setUser(account)
      else if (active) analyticsApi.clearSession()
    }).catch(() => {
      if (active) analyticsApi.clearSession()
    }).finally(() => {
      if (active) setChecking(false)
    })
    return () => {
      active = false
      window.removeEventListener('databridge-session-expired', expireSession)
    }
  }, [])
  if (checking) return <LoadingPage label="Checking your session" />
  if (!user) return location.pathname === '/' ? <PortalSelection /> : <LoginPage onAuthenticated={setUser} />
  if (location.pathname === '/login' || location.pathname === '/') return <Navigate to="/analytics" replace />
  return <Shell user={user} onSignedOut={() => setUser(null)} />
}

function PortalSelection() {
  return <main className="portal-selection">
    <header className="portal-selection-header"><Logo /></header>
    <section className="portal-selection-content">
      <p className="eyebrow">WELCOME TO DATABRIDGE</p>
      <h1>Choose your workspace</h1>
      <p className="portal-selection-intro">Continue to the workspace that matches your role.</p>
      <div className="portal-choice-grid">
        <article className="portal-choice client-choice">
          <div className="portal-choice-icon"><UploadCloud size={23} /></div>
          <p className="eyebrow">FOR CLIENTS</p>
          <h2>Client portal</h2>
          <p>Submit project data, track review progress, and access your files and reports.</p>
          <a className="primary-button" href={clientPortalUrl()}>Continue to client portal</a>
          <a className="portal-choice-secondary" href={`${clientPortalUrl()}signup`}>Create a client account</a>
        </article>
        <article className="portal-choice analytics-choice">
          <div className="portal-choice-icon"><BarChart3 size={23} /></div>
          <p className="eyebrow">FOR ANALYSTS</p>
          <h2>Analytics workspace</h2>
          <p>Review client submissions, manage assignments, and download uploaded source files.</p>
          <a className="primary-button purple" href="/analytics">Sign in to analytics</a>
          <span className="portal-choice-note">Analyst accounts are provisioned by your DataBridge administrator.</span>
        </article>
      </div>
    </section>
  </main>
}

function LoginPage({ onAuthenticated }: { onAuthenticated: (user: AnalyticsUser) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)
    try {
      const user = await analyticsApi.login(String(data.get('email') ?? '').trim(), String(data.get('password') ?? ''))
      onAuthenticated(user)
      navigate('/analytics', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in')
    } finally {
      setBusy(false)
    }
  }
  return <main className="auth-page">
    <div className="auth-brand"><Logo /><p>Review incoming client submissions and coordinate analysis.</p></div>
    <form className="card upload-card auth-card" onSubmit={submit}>
      <div className="upload-section-heading"><div className="upload-icon"><Users size={20} /></div><div><h1>Analytics sign in</h1><p>Use your analyst account to access the workspace.</p></div></div>
      <label className="field-label">Work email<input name="email" type="email" autoComplete="username" required /></label>
      <label className="field-label">Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <ErrorBanner message={error} />}
      <button className="primary-button upload-submit purple" type="submit" disabled={busy}>{busy && <LoaderCircle className="spinning" size={17} />}Sign in</button>
      <p className="auth-switch">Analyst accounts are provisioned by your DataBridge administrator.</p>
    </form>
    <a className="portal-back-link" href={clientPortalUrl()}><ChevronLeft size={14} aria-hidden="true" />Back to workspace selection</a>
  </main>
}

function Shell({ user, onSignedOut }: { user: AnalyticsUser; onSignedOut: () => void }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileMenu, setProfileMenu] = useState(false)
  const navigate = useNavigate()
  const name = user.displayName || user.email
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  async function signOut() {
    try {
      await analyticsApi.logout()
    } finally {
      onSignedOut()
      navigate('/login', { replace: true })
    }
  }
  return <div className={`app-shell analytics-theme ${collapsed ? 'is-collapsed' : ''}`}>
    {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="sidebar-brand"><Logo /><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <nav className="primary-nav" aria-label="Analytics navigation"><p className="nav-heading">Analytics workspace</p>
        {navigation.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to === '/analytics'} title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)}><Icon size={19} strokeWidth={1.8} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="sidebar-footer"><button className="collapse-button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}<span>Collapse</span></button></div>
    </aside>
    <div className="app-main">
      <header className="topbar"><button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="topbar-actions"><div className="profile-wrap">
        <button className="profile-button" aria-expanded={profileMenu} onClick={() => setProfileMenu((value) => !value)}><span className="avatar">{initials}</span><span className="profile-copy"><strong>{name}</strong><small>{user.role === 'administrator' ? 'Administrator' : 'Analyst'}</small></span><ChevronDown size={15} /></button>
        {profileMenu && <div className="dropdown profile-dropdown"><div className="profile-menu-identity">{user.email}</div><button className="danger" onClick={() => void signOut()}><LogOut size={17} />Sign out</button></div>}
      </div></div></header>
      <main className="content"><Routes>
        <Route path="/analytics" element={<Dashboard />} />
        <Route path="/analytics/inbox" element={<SubmissionList mode="inbox" />} />
        <Route path="/analytics/assignments" element={<SubmissionList mode="assigned" />} />
        <Route path="/analytics/completed" element={<SubmissionList mode="completed" />} />
        <Route path="*" element={<Navigate to="/analytics" replace />} />
      </Routes></main>
    </div>
  </div>
}

function useRemoteData<T>(load: () => Promise<T>, reloadKey = 0) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    let active = true
    setLoading(true)
    loadRef.current().then((result) => { if (active) { setData(result); setError('') } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load data') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])
  return { data, error, loading }
}

function Dashboard() {
  const loadSubmissions = () => analyticsApi.submissions()
  const { data, error, loading } = useRemoteData(loadSubmissions)
  const submissions = data ?? []
  const awaiting = submissions.filter((item) => !item.analystId && !['completed', 'rejected', 'failed'].includes(item.status)).length
  const inProgress = submissions.filter((item) => ['assigned', 'under_analysis', 'awaiting_review'].includes(item.status)).length
  const completed = submissions.filter((item) => item.status === 'completed').length
  return <>
    <div className="page-heading"><div><p className="eyebrow">OPERATIONS</p><h1>Dashboard</h1><p>Live submission pipeline and analyst workload.</p></div><Link className="primary-button purple" to="/analytics/inbox"><Files size={18} />Open inbox</Link></div>
    {error && <ErrorBanner message={error} />}
    <section className="metrics-grid">
      <Metric label="Total submissions" value={loading ? '—' : String(submissions.length)} note="All client submissions" tone="purple" icon={<Files />} />
      <Metric label="Awaiting assignment" value={loading ? '—' : String(awaiting)} note="Not yet assigned" tone="amber" icon={<Users />} />
      <Metric label="In analysis" value={loading ? '—' : String(inProgress)} note="Assigned or under review" tone="blue" icon={<FolderKanban />} />
      <Metric label="Completed" value={loading ? '—' : String(completed)} note="Analysis completed" tone="violet" icon={<FileCheck2 />} />
    </section>
    <section className="card activity-card"><div className="card-header"><div><h2>Latest submissions</h2><p>Recent activity from client accounts</p></div><Link className="text-button" to="/analytics/inbox">View inbox</Link></div>
      {loading ? <LoadingPage label="Loading submissions" /> : submissions.length ? <div className="submission-list">{submissions.slice(0, 6).map((item) => <SubmissionRow key={item.id} submission={item} />)}</div> : <EmptyState title="No submissions yet" message="New client submissions will appear here." />}
    </section>
  </>
}

function SubmissionList({ mode }: { mode: 'inbox' | 'assigned' | 'completed' }) {
  const [refresh, setRefresh] = useState(0)
  const loadSubmissions = () => mode === 'assigned' ? analyticsApi.myAssignments() : analyticsApi.submissions()
  const { data, error, loading } = useRemoteData(loadSubmissions, refresh)
  const { data: analysts } = useRemoteData(() => analyticsApi.analysts())
  const [actionError, setActionError] = useState('')
  const all = data ?? []
  const rows = mode === 'completed' ? all.filter((item) => item.status === 'completed') : all
  const title = mode === 'inbox' ? 'Submission inbox' : mode === 'assigned' ? 'My assignments' : 'Completed analysis'
  async function updateStatus(item: AnalyticsSubmission, status: string) {
    setActionError('')
    try {
      await analyticsApi.updateStatus(item.id, status)
      setRefresh((value) => value + 1)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Unable to update status')
    }
  }
  async function assign(item: AnalyticsSubmission, analystId: string) {
    if (!analystId) return
    setActionError('')
    try {
      await analyticsApi.assign(item.id, analystId)
      setRefresh((value) => value + 1)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Unable to assign submission')
    }
  }
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">ANALYTICS WORKSPACE</p><h1>{title}</h1><p>{mode === 'inbox' ? 'All client submissions are shown here, regardless of assignment. Open a file list to download any client upload.' : mode === 'assigned' ? 'Submissions assigned to your analyst account. For uploads from all clients, open the submission inbox.' : 'Completed submissions from the live workflow.'}</p></div></div>
    {(error || actionError) && <ErrorBanner message={error || actionError} />}
    <section className="card activity-card">
      {loading ? <LoadingPage label="Loading submissions" /> : rows.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Project</th><th>Client</th><th>Received</th><th>Files</th><th>Status</th>{mode === 'inbox' && <th>Assignment</th>}</tr></thead><tbody>
        {rows.map((item) => <tr key={item.id}><td><strong>{item.projectName}</strong><small>{item.site || 'No site specified'}</small></td><td>{item.clientName || item.clientEmail}<small>{item.clientEmail}</small></td><td>{formatDate(item.createdAt)}</td><td><SubmissionFiles submissionId={item.id} fileCount={item.fileCount} /></td><td><select aria-label={`Status for ${item.projectName}`} value={item.status} onChange={(event) => void updateStatus(item, event.target.value)}>{statusOptions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></td>{mode === 'inbox' && <td><select aria-label={`Assign ${item.projectName}`} value={item.analystId || ''} onChange={(event) => void assign(item, event.target.value)}><option value="">Unassigned</option>{(analysts ?? []).map((analyst) => <option key={analyst.id} value={analyst.id}>{analyst.displayName}</option>)}</select></td>}</tr>)}
      </tbody></table></div> : <EmptyState title={mode === 'completed' ? 'No completed analysis' : 'No submissions found'} message={mode === 'completed' ? 'Completed work will appear here.' : 'Submissions will appear when clients upload data.'} />}
    </section>
  </div>
}

const statusOptions = ['submitted', 'validating', 'received', 'awaiting_assignment', 'assigned', 'under_analysis', 'awaiting_review', 'completed', 'failed', 'rejected', 'quarantined']

function SubmissionRow({ submission }: { submission: AnalyticsSubmission }) {
  return <div className="submission-row"><div className="file-avatar"><FileCheck2 size={19} /></div><div className="submission-main"><strong>{submission.projectName}</strong><span>{submission.clientName || submission.clientEmail} · {formatDate(submission.createdAt)}</span></div><span className="submission-files">{submission.fileCount} {submission.fileCount === 1 ? 'file' : 'files'}</span><span className={`status-badge ${statusTone(submission.status)}`}>{formatStatus(submission.status)}</span><ChevronRight size={17} className="row-arrow" /></div>
}

function SubmissionFiles({ submissionId, fileCount }: { submissionId: string; fileCount: number }) {
  const [expanded, setExpanded] = useState(false)
  const [files, setFiles] = useState<SubmissionFile[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggleFiles() {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    if (!nextExpanded || files || loading) return
    setLoading(true)
    setError('')
    try {
      setFiles(await analyticsApi.submissionFiles(submissionId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load uploaded files')
    } finally {
      setLoading(false)
    }
  }

  async function downloadFile(fileId: string) {
    try {
      const { downloadUrl } = await analyticsApi.presignedFileDownload(fileId)
      window.location.assign(browserStorageUrl(downloadUrl))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to download file')
    }
  }

  return <div className="source-files">
    <button className="text-button" aria-expanded={expanded} onClick={() => void toggleFiles()}>
      {expanded ? 'Hide files' : files ? `View files (${files.length})` : fileCount ? `View files (${fileCount})` : 'Check for uploaded files'}
    </button>
    {expanded && <div className="source-file-list">
      {loading && <span>Loading files…</span>}
      {error && <span className="source-file-error" role="alert">{error}</span>}
      {files?.map((file) => <div className="source-file-item" key={file.id}>
        <span><strong>{file.fileName}</strong><small>{formatFileSize(file.fileSize)}</small></span>
        <button className="secondary-button" onClick={() => void downloadFile(file.id)}><Download size={15} />Download</button>
      </div>)}
      {files?.length === 0 && <span>No uploaded files.</span>}
    </div>}
  </div>
}

function Metric({ label, value, note, tone, icon }: { label: string; value: string; note: string; tone: string; icon: ReactNode }) {
  return <article className={`metric-card tone-${tone}`}><div className="metric-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-card"><div className="empty-icon"><Files size={28} /></div><h2>{title}</h2><p>{message}</p></div>
}

function LoadingPage({ label }: { label: string }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spinning" size={20} />{label}</div>
}

function ErrorBanner({ message }: { message: string }) {
  return <p className="form-message error-message" role="alert">{message}</p>
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusTone(status: string) {
  if (status === 'completed') return 'green'
  if (['failed', 'rejected', 'quarantined'].includes(status)) return 'red'
  if (['under_analysis', 'assigned', 'awaiting_review'].includes(status)) return 'amber'
  return 'cyan'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = bytes / 1024
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function browserStorageUrl(value: string) {
  const signedUrl = new URL(value)
  return ['s3mock', 'localhost', '127.0.0.1'].includes(signedUrl.hostname)
    ? `${window.location.origin}/s3-upload${signedUrl.pathname}${signedUrl.search}`
    : value
}

function clientPortalUrl() {
  const configuredUrl = import.meta.env.VITE_CLIENT_PORTAL_URL
  if (configuredUrl) return configuredUrl

  return `${window.location.origin}/`
}

export default function App() {
  return <BrowserRouter><AuthGate /></BrowserRouter>
}
