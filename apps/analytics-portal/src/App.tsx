import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, FileCheck2, Files, FolderKanban,
  LayoutDashboard, LoaderCircle, LogOut, Menu, MoreHorizontal, Trash2, UserRoundCheck, UserRoundX, Users,
  UploadCloud, X, KeyRound,
} from 'lucide-react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { analyticsApi, type AdminUser, type AnalyticsSubmission, type AnalyticsUser, type SubmissionFile } from './services/analyticsApi'
import './App.css'

const navigation = [
  { label: 'Dashboard', to: '/analytics', icon: LayoutDashboard },
  { label: 'Submission inbox', to: '/analytics/inbox', icon: Files },
  { label: 'My assignments', to: '/analytics/assignments', icon: Users },
  { label: 'Completed analysis', to: '/analytics/completed', icon: FileCheck2 },
]
const accessChangedMessage = 'Your account access has changed. Please sign in again through the portal for your new role.'

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
      else if (active) {
        analyticsApi.clearSession()
        window.location.replace(clientPortalLoginUrl())
      }
    }).catch((reason) => {
      if (active) {
        analyticsApi.clearSession()
        window.location.replace(reason instanceof Error && reason.message === accessChangedMessage ? clientPortalLoginUrl() : clientPortalUrl())
      }
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
  if (user.mustChangePassword && location.pathname !== '/analytics/password') return <Navigate to="/analytics/password" replace />
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
  const [mfaStep, setMfaStep] = useState<{ type: 'setup'; token: string } | { type: 'challenge'; token: string } | null>(null)
  const navigate = useNavigate()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)
    try {
      const result = await analyticsApi.login(String(data.get('email') ?? '').trim(), String(data.get('password') ?? ''))
      if (!['analyst', 'administrator'].includes(result.user.role)) {
        throw new Error('This account does not have analytics workspace access.')
      }
      if (result.mfaSetupRequired && result.setupToken) setMfaStep({ type: 'setup', token: result.setupToken })
      else if (result.mfaRequired && result.mfaToken) setMfaStep({ type: 'challenge', token: result.mfaToken })
      else throw new Error('The server returned an incomplete authentication response.')
    } catch (reason) {
      if (reason instanceof Error && reason.message === 'This account does not have analytics workspace access.') {
        window.location.replace(clientPortalLoginUrl())
        return
      }
      setError(reason instanceof Error ? reason.message : 'Unable to sign in')
    } finally {
      setBusy(false)
    }
  }
  if (mfaStep) return <main className="auth-page"><div className="auth-brand"><Logo /><p>Secure your analytics workspace.</p></div><MfaAuth step={mfaStep} onAuthenticated={(user) => { onAuthenticated(user); navigate('/analytics', { replace: true }) }} /></main>
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
        {user.role === 'administrator' && <><p className="nav-heading">Administration</p><NavLink to="/analytics/admin/users" title={collapsed ? 'User administration' : undefined} onClick={() => setMobileOpen(false)}><Users size={19} strokeWidth={1.8} /><span>User administration</span></NavLink></>}
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
        <Route path="/analytics/password" element={<PasswordChange />} />
        {user.role === 'administrator' && <Route path="/analytics/admin/users" element={<AdminUsers currentUserId={user.id} />} />}
        <Route path="*" element={<Navigate to="/analytics" replace />} />
      </Routes></main>
    </div>
  </div>
}

function AdminUsers({ currentUserId }: { currentUserId: string }) {
  const [refresh, setRefresh] = useState(0)
  const { data, error, loading } = useRemoteData(() => analyticsApi.adminUsers(), refresh)
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [createError, setCreateError] = useState('')
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [actionMenuPosition, setActionMenuPosition] = useState({ top: 0, left: 0 })
  const [copiedCredential, setCopiedCredential] = useState(false)
  const users = data ?? []
  const filters = [
    { id: 'all', label: 'All users' },
    { id: 'active', label: 'Active' },
    { id: 'suspended', label: 'Deactivated' },
    { id: 'deleted', label: 'Deleted' },
    { id: 'analyst', label: 'Analysts' },
    { id: 'contributor', label: 'Contributors' },
    { id: 'administrator', label: 'Administrators' },
  ]
  const filteredUsers = users.filter((target) => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery = !normalizedQuery || [target.displayName, target.email, target.organization].some((value) => value?.toLowerCase().includes(normalizedQuery))
    const matchesFilter = filter === 'all' || target.status === filter || target.role === filter
    return matchesQuery && matchesFilter
  })

  async function changeStatus(target: AdminUser, status: 'active' | 'suspended') {
    setActionError('')
    setBusyId(target.id)
    try {
      await analyticsApi.updateUserStatus(target.id, status)
      setRefresh((value) => value + 1)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Unable to update user status')
    } finally {
      setBusyId('')
    }
  }

  async function deleteUser(target: AdminUser) {
    const reason = window.prompt(`Explain why ${target.email} is being permanently deleted:`)
    if (!reason?.trim()) return
    if (window.prompt(`Type DELETE to confirm deletion of ${target.email}:`) !== 'DELETE') return
    setActionError('')
    setBusyId(target.id)
    try {
      await analyticsApi.deleteUser(target.id, reason.trim())
      setRefresh((value) => value + 1)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete user')
    } finally {
      setBusyId('')
    }
  }

  async function resetPassword(target: AdminUser) {
    if (!window.confirm(`Issue a new temporary password for ${target.email}?`)) return
    setActionError('')
    setCredentials(null)
    setBusyId(target.id)
    try {
      const result = await analyticsApi.resetUserPassword(target.id)
      setCredentials({ email: result.email, password: result.temporaryPassword })
      setActionMenuId(null)
      setRefresh((value) => value + 1)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Unable to reset password')
    } finally {
      setBusyId('')
    }
  }

  async function resetMfa(target: AdminUser) {
      if (!window.confirm(`Reset Google Authenticator MFA for ${target.email}? They will set it up again at their next sign in.`)) return
      setActionError('')
      setBusyId(target.id)
      try {
        await analyticsApi.resetMfa(target.id)
        setActionMenuId(null)
        setRefresh((value) => value + 1)
      } catch (reason) {
        setActionError(reason instanceof Error ? reason.message : 'Unable to reset MFA')
      } finally {
        setBusyId('')
      }
  }

  async function copyCredential() {
    if (!credentials) return
    await navigator.clipboard.writeText(`Email: ${credentials.email}\nTemporary password: ${credentials.password}`)
    setCopiedCredential(true)
    window.setTimeout(() => setCopiedCredential(false), 1600)
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setCreateError('')
    setCredentials(null)
    const form = new FormData(formElement)
    try {
      const created = await analyticsApi.createUser({
        email: String(form.get('email') ?? '').trim(),
        displayName: String(form.get('displayName') ?? '').trim(),
        organization: String(form.get('organization') ?? '').trim() || undefined,
        role: String(form.get('role') ?? 'contributor') as AdminUser['role'],
      })
      setCredentials({ email: created.email, password: created.temporaryPassword })
      formElement.reset()
      setRefresh((value) => value + 1)
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : 'Unable to create user')
    }
  }

  return <div className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>User administration</h1><p>Deactivate accounts or permanently anonymize them so the email can be registered again.</p></div></div>
    {(error || actionError || createError) && <ErrorBanner message={error || actionError || createError} />}
    {credentials && <section className="card admin-credentials-card"><div><span className="admin-card-kicker">SECURE HANDOFF</span><h2>Temporary credentials</h2><p>Share these once through a secure channel. The user must change the password after signing in.</p></div><div className="credential-grid"><div><span className="credential-label">Email</span><strong>{credentials.email}</strong></div><div><span className="credential-label">Temporary password</span><code>{credentials.password}</code></div><button className="secondary-button credential-copy-button" type="button" onClick={() => void copyCredential()}>{copiedCredential ? <><Check size={15} />Copied</> : <><Copy size={15} />Copy details</>}</button></div></section>}
    <section className="card admin-create-card"><div className="admin-card-header"><div><span className="admin-card-kicker">ACCOUNT PROVISIONING</span><h2>Create user</h2><p>Issue a controlled temporary login. The user will choose a private password at first sign-in.</p></div><span className="admin-card-badge">Admin only</span></div><form className="admin-create-form" onSubmit={(event) => void createUser(event)}><label className="field-label">Full name<input name="displayName" placeholder="e.g. Alex Morgan" required /></label><label className="field-label">Work email<input name="email" type="email" placeholder="alex@company.com" required /></label><label className="field-label">Organization<input name="organization" placeholder="Optional" /></label><label className="field-label">Role<select name="role" defaultValue="contributor"><option value="contributor">Contributor</option><option value="analyst">Analyst</option><option value="administrator">Administrator</option></select></label><button className="primary-button purple admin-create-button" type="submit">Create user</button></form></section>
    <section className="card admin-users-card">
      <div className="admin-directory-header"><div><span className="admin-card-kicker">DIRECTORY</span><h2>All users <span>{filteredUsers.length}</span></h2></div><label className="admin-search"><span>Search users</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, organization" /></label></div>
      <div className="admin-filter-tabs" role="tablist">{filters.map((item) => <button key={item.id} className={filter === item.id ? 'is-active' : ''} type="button" onClick={() => setFilter(item.id)}>{item.label}<span>{users.filter((target) => item.id === 'all' || target.status === item.id || target.role === item.id).length}</span></button>)}</div>
      {loading ? <LoadingPage label="Loading users" /> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>
        {filteredUsers.map((target) => <tr key={target.id}><td><strong>{target.displayName || target.email}</strong><small>{target.email}{target.organization ? ` · ${target.organization}` : ''}</small></td><td><select value={target.role} disabled={target.id === currentUserId || target.status === 'deleted' || busyId === target.id} onChange={(event) => void analyticsApi.updateUserRole(target.id, event.target.value as AdminUser['role']).then(() => setRefresh((value) => value + 1)).catch((reason) => setActionError(reason instanceof Error ? reason.message : 'Unable to update role'))}><option value="contributor">Contributor</option><option value="analyst">Analyst</option><option value="administrator">Administrator</option></select></td><td><span className={`admin-status ${target.status}`}>{target.status === 'suspended' ? 'Deactivated' : target.status}</span></td><td>{formatDate(target.createdAt)}</td><td><div className="admin-row-actions">{target.id !== currentUserId && target.status !== 'deleted' ? <><button className="icon-button admin-more-button" type="button" aria-label={`Manage ${target.email}`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const menuHeight = 178; const menuWidth = 224; setActionMenuPosition({ top: rect.bottom + menuHeight > window.innerHeight ? rect.top - menuHeight - 8 : rect.bottom + 8, left: Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)) }); setActionMenuId(actionMenuId === target.id ? null : target.id) }}><MoreHorizontal size={18} /></button>{actionMenuId === target.id && <div className="admin-action-menu" style={{ top: actionMenuPosition.top, left: actionMenuPosition.left }}><div className="admin-action-menu-title">Account actions</div><div className="admin-action-menu-group"><button type="button" onClick={() => void resetPassword(target)}><KeyRound size={15} />Reset password</button><button type="button" onClick={() => void resetMfa(target)}><KeyRound size={15} />Reset MFA</button>{target.status === 'suspended' ? <button type="button" onClick={() => void changeStatus(target, 'active')}><UserRoundCheck size={15} />Reactivate account</button> : <button type="button" onClick={() => void changeStatus(target, 'suspended')}><UserRoundX size={15} />Deactivate account</button>}</div><div className="admin-action-menu-group admin-action-menu-danger"><button type="button" onClick={() => void deleteUser(target)}><Trash2 size={15} />Delete account</button></div></div>}</> : <span className="admin-current-user">Current account</span>}</div></td></tr>)}
        {!filteredUsers.length && <tr><td className="admin-empty-row" colSpan={5}>No users match this search or filter.</td></tr>}
      </tbody></table></div>}
    </section>
  </div>
}

function PasswordChange() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await analyticsApi.changePassword(String(form.get('currentPassword') ?? ''), String(form.get('newPassword') ?? ''))
      navigate('/analytics', { replace: true })
      window.location.reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change password')
    } finally {
      setBusy(false)
    }
  }
  return <main className="auth-page"><div className="auth-brand"><Logo /><p>Set a private password before continuing to DataBridge.</p></div><form className="card upload-card auth-card" onSubmit={(event) => void submit(event)}><div className="upload-section-heading"><div className="upload-icon"><Users size={20} /></div><div><h1>Choose a new password</h1><p>Your administrator issued a temporary password for this account.</p></div></div><label className="field-label">Temporary password<input name="currentPassword" type="password" required /></label><label className="field-label">New password<input name="newPassword" type="password" minLength={12} required /><span>Use at least 12 characters.</span></label>{error && <ErrorBanner message={error} />}<button className="primary-button upload-submit purple" type="submit" disabled={busy}>{busy && <LoaderCircle className="spinning" size={17} />}Save new password</button></form></main>
}

function MfaAuth({ step, onAuthenticated }: { step: { type: 'setup'; token: string } | { type: 'challenge'; token: string }; onAuthenticated: (user: AnalyticsUser) => void }) {
  const [uri, setUri] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [completedUser, setCompletedUser] = useState<AnalyticsUser | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (step.type === 'setup') analyticsApi.mfaSetup(step.token).then((result) => setUri(result.otpauthUri)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load MFA setup')) }, [step])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (step.type === 'setup') {
        const result = await analyticsApi.verifyMfaSetup(step.token, code)
        setRecoveryCodes(result.recoveryCodes); setCompletedUser(result.user)
      } else {
        const result = await analyticsApi.verifyMfa(step.token, code || undefined, recoveryCode || undefined)
        onAuthenticated(result.user)
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify MFA') } finally { setBusy(false) }
  }
  if (recoveryCodes) return <div className="card upload-card auth-card"><div className="upload-section-heading"><div className="upload-icon"><Check size={20} /></div><div><h1>Save your recovery codes</h1><p>These codes are shown once. Store them somewhere safe before continuing.</p></div></div><div className="recovery-codes">{recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div><button className="primary-button upload-submit purple" type="button" onClick={() => completedUser && onAuthenticated(completedUser)}>Continue</button></div>
  return <form className="card upload-card auth-card" onSubmit={submit}><div className="upload-section-heading"><div className="upload-icon"><KeyRound size={20} /></div><div><h1>{step.type === 'setup' ? 'Set up two-factor authentication' : 'Verify your identity'}</h1><p>{step.type === 'setup' ? 'Scan this QR code in Google Authenticator, then enter the six-digit code.' : 'Enter the code from Google Authenticator or use a recovery code.'}</p></div></div>{step.type === 'setup' && (uri ? <><QRCodeSVG value={uri} size={180} /><label className="field-label">Manual setup URI<input value={uri} readOnly /></label></> : <p>Loading setup code…</p>)}<label className="field-label">Authenticator code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" placeholder="6-digit code" required={!recoveryCode} /></label>{step.type === 'challenge' && <label className="field-label">Recovery code <span>(optional)</span><input value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.trim())} required={!code} /></label>}{error && <ErrorBanner message={error} />}<button className="primary-button upload-submit purple" type="submit" disabled={busy || (!code && !recoveryCode)}>{busy && <LoaderCircle className="spinning" size={17} />}{step.type === 'setup' ? 'Enable MFA' : 'Verify and sign in'}</button></form>
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

function clientPortalLoginUrl() {
  return new URL('login?notice=access-changed', clientPortalUrl()).toString()
}

export default function App() {
  return <BrowserRouter><AuthGate /></BrowserRouter>
}
