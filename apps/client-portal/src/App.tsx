import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  BarChart3, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download, FileCheck2,
  Files, FolderKanban, LayoutDashboard, LoaderCircle, Menu,
  UploadCloud, UserRound, X,
} from 'lucide-react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { authApi, reportsApi, storageApi, submissionsApi, type ApiUser, type Report, type Submission, type SubmissionFile } from './services/api'
import './App.css'

const navigation = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Upload data', to: '/upload', icon: UploadCloud },
  { label: 'My submissions', to: '/submissions', icon: Files },
  { label: 'Completed reports', to: '/reports', icon: FileCheck2 },
  { label: 'Profile', to: '/profile', icon: UserRound },
]

function Logo() {
  return <div className="brand-mark"><span className="brand-symbol"><i /><i /><i /></span><span>DataBridge</span></div>
}

function AuthGate() {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [checking, setChecking] = useState(Boolean(localStorage.getItem('databridge_token')))
  const location = useLocation()

  useEffect(() => {
    let active = true
    const expireSession = () => setUser(null)
    window.addEventListener('databridge-session-expired', expireSession)
    const token = localStorage.getItem('databridge_token')
    if (!token) {
      setChecking(false)
      return () => {
        active = false
        window.removeEventListener('databridge-session-expired', expireSession)
      }
    }
    authApi.me().then((account) => {
      if (active && account.role === 'contributor') setUser(account)
      else if (active) authApi.clearSession()
    }).catch(() => {
      if (active) authApi.clearSession()
    }).finally(() => {
      if (active) setChecking(false)
    })
    return () => {
      active = false
      window.removeEventListener('databridge-session-expired', expireSession)
    }
  }, [])

  if (checking) return <LoadingPage label="Checking your session" />
  if (!user) {
    if (location.pathname === '/') return <PortalSelection />
    const signup = location.pathname === '/signup'
    return <AuthPage initialSignup={signup} onAuthenticated={setUser} />
  }
  if (user.mustChangePassword) return <PasswordChangePage onComplete={() => setUser({ ...user, mustChangePassword: false })} />
  if (location.pathname === '/login' || location.pathname === '/signup') return <Navigate to="/" replace />
  return <Shell user={user} onSignedOut={() => setUser(null)} />
}

function PasswordChangePage({ onComplete }: { onComplete: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await authApi.changePassword(String(form.get('currentPassword') ?? ''), String(form.get('newPassword') ?? ''))
      onComplete()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change password')
    } finally {
      setBusy(false)
    }
  }
  return <main className="auth-page"><div className="auth-brand"><Logo /><p>Set a private password before continuing to DataBridge.</p></div><form className="card upload-card auth-card" onSubmit={(event) => void submit(event)}><div className="upload-section-heading"><div className="upload-icon"><UserRound size={20} /></div><div><h1>Choose a new password</h1><p>Your administrator issued a temporary password for this account.</p></div></div><label className="field-label">Temporary password<input name="currentPassword" type="password" required /></label><label className="field-label">New password<input name="newPassword" type="password" minLength={12} required /><span>Use at least 12 characters.</span></label>{error && <p className="form-message error-message" role="alert">{error}</p>}<button className="primary-button upload-submit" type="submit" disabled={busy}>{busy && <LoaderCircle className="spinning" size={17} />}Save new password</button></form></main>
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
          <Link className="primary-button" to="/login">Sign in to client portal</Link>
          <Link className="portal-choice-secondary" to="/signup">Create a client account</Link>
        </article>
        <article className="portal-choice analytics-choice">
          <div className="portal-choice-icon"><BarChart3 size={23} /></div>
          <p className="eyebrow">FOR ANALYSTS</p>
          <h2>Analytics workspace</h2>
          <p>Review client submissions, manage assignments, and download uploaded source files.</p>
          <a className="primary-button purple" href={analyticsPortalUrl()}>Sign in to analytics</a>
          <span className="portal-choice-note">Analyst accounts are provisioned by your DataBridge administrator.</span>
        </article>
      </div>
    </section>
  </main>
}

function AuthPage({ initialSignup, onAuthenticated }: { initialSignup: boolean; onAuthenticated: (user: ApiUser) => void }) {
  const [signup, setSignup] = useState(initialSignup)
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const [error, setError] = useState(() => location.search.includes('notice=access-changed')
    ? 'Your account access has changed. Please sign in here to continue to the client portal.'
    : '')
  const [signupChallenge, setSignupChallenge] = useState<{ id: string; email: string } | null>(null)
  const [signupPassword, setSignupPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [mfaStep, setMfaStep] = useState<{ type: 'setup'; token: string } | { type: 'challenge'; token: string } | null>(null)
  const navigate = useNavigate()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    try {
      if (signup) {
        setSignupPassword(password)
        const challenge = await authApi.register({
          email,
          password,
          displayName: String(data.get('displayName') ?? '').trim(),
          organization: String(data.get('organization') ?? '').trim() || undefined,
          countryCode: String(data.get('countryCode') ?? '').trim().toUpperCase() || undefined,
        })
        setSignupChallenge({ id: challenge.challengeId, email: challenge.email })
        return
      }
      const result = await authApi.login(email, password)
      if (result.user.role !== 'contributor') {
        throw new Error('This account does not have client portal access.')
      }
      if (result.mfaSetupRequired && result.setupToken) setMfaStep({ type: 'setup', token: result.setupToken })
      else if (result.mfaRequired && result.mfaToken) setMfaStep({ type: 'challenge', token: result.mfaToken })
      else throw new Error('The server returned an incomplete authentication response.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to authenticate')
    } finally {
      setBusy(false)
    }
  }

  async function verifySignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authApi.verifySignup(signupChallenge!.id, verificationCode)
      const loginResult = await authApi.login(signupChallenge!.email, signupPassword)
      if (loginResult.mfaSetupRequired && loginResult.setupToken) setMfaStep({ type: 'setup', token: loginResult.setupToken })
      else if (loginResult.mfaRequired && loginResult.mfaToken) setMfaStep({ type: 'challenge', token: loginResult.mfaToken })
      else throw new Error('The server returned an incomplete authentication response.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to verify your email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand"><Logo /><p>Securely share project data and follow it through review.</p></div>
      {mfaStep ? <MfaAuth step={mfaStep} onAuthenticated={(account) => { onAuthenticated(account); navigate('/', { replace: true }) }} /> : signupChallenge ? <form className="card upload-card auth-card" onSubmit={verifySignup}>
        <div className="upload-section-heading"><div className="upload-icon"><CheckCircle2 size={20} /></div><div><h1>Verify your email</h1><p>Check your inbox for the six-digit code sent to {signupChallenge.email}.</p></div></div>
        <label className="field-label">Verification code<input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" placeholder="Enter 6-digit code" required /><span>Codes expire after 10 minutes.</span></label>
        {error && <p className="form-message error-message" role="alert">{error}</p>}
        <button className="primary-button upload-submit" type="submit" disabled={busy || verificationCode.length !== 6}>{busy && <LoaderCircle className="spinning" size={17} />}Verify email</button>
        <p className="auth-switch">Did not receive it? <button type="button" onClick={async () => { try { await authApi.resendSignup(signupChallenge.id); setError('A new verification code was sent.') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to resend the code') } }}>Resend code</button></p>
      </form> : <form className="card upload-card auth-card" onSubmit={submit}>
        <div className="upload-section-heading"><div className="upload-icon"><UserRound size={20} /></div><div><h1>{signup ? 'Create your account' : 'Welcome back'}</h1><p>{signup ? 'Create a client portal account to get started.' : 'Sign in to your client portal.'}</p></div></div>
        {signup && <label className="field-label">Full name<input name="displayName" autoComplete="name" required maxLength={120} /></label>}
        <label className="field-label">Email<input name="email" type="email" autoComplete="email" required /></label>
        {signup && <label className="field-label">Organization <span>(optional)</span><input name="organization" autoComplete="organization" maxLength={160} /></label>}
        {signup && <label className="field-label">Country code <span>(optional, 2 letters)</span><input name="countryCode" maxLength={2} pattern="[A-Za-z]{2}" /></label>}
        <label className="field-label">Password<input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : undefined} />{signup && <span>Use at least 12 characters.</span>}</label>
        {error && <p className="form-message error-message" role="alert">{error}</p>}
        <button className="primary-button upload-submit" type="submit" disabled={busy}>{busy && <LoaderCircle className="spinning" size={17} />}{signup ? 'Create account' : 'Sign in'}</button>
        <p className="auth-switch">{signup ? 'Already registered?' : 'New to DataBridge?'} <button type="button" onClick={() => { setSignup((value) => !value); setError(''); navigate(signup ? '/login' : '/signup') }}>{signup ? 'Sign in' : 'Create an account'}</button></p>
      </form>}
      <Link className="portal-back-link" to="/"><ChevronLeft size={14} aria-hidden="true" />Back to workspace selection</Link>
    </main>
  )
}

function MfaAuth({ step, onAuthenticated }: { step: { type: 'setup'; token: string } | { type: 'challenge'; token: string }; onAuthenticated: (user: ApiUser) => void }) {
  const [uri, setUri] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [completedUser, setCompletedUser] = useState<ApiUser | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (step.type === 'setup') authApi.mfaSetup(step.token).then((result) => setUri(result.otpauthUri)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load MFA setup'))
  }, [step])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (step.type === 'setup') {
        const result = await authApi.verifyMfaSetup(step.token, code)
        setRecoveryCodes(result.recoveryCodes)
        setCompletedUser(result.user)
      } else {
        const result = await authApi.verifyMfa(step.token, code || undefined, recoveryCode || undefined)
        onAuthenticated(result.user)
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify MFA') } finally { setBusy(false) }
  }
  if (recoveryCodes) return <div className="card upload-card auth-card"><div className="upload-section-heading"><div className="upload-icon"><CheckCircle2 size={20} /></div><div><h1>Save your recovery codes</h1><p>These codes are shown once. Store them somewhere safe before continuing.</p></div></div><div className="recovery-codes">{recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div><button className="primary-button upload-submit" type="button" onClick={() => completedUser && onAuthenticated(completedUser)}>Continue</button></div>
  return <form className="card upload-card auth-card" onSubmit={submit}><div className="upload-section-heading"><div className="upload-icon"><UserRound size={20} /></div><div><h1>{step.type === 'setup' ? 'Set up two-factor authentication' : 'Verify your identity'}</h1><p>{step.type === 'setup' ? 'Scan this QR code in Google Authenticator, then enter the six-digit code.' : 'Enter the code from Google Authenticator or use a recovery code.'}</p></div></div>{step.type === 'setup' && (uri ? <><QRCodeSVG value={uri} size={180} /><label className="field-label">Manual setup key<input value={uri} readOnly /></label></> : <p>Loading setup code…</p>)}<label className="field-label">Authenticator code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" placeholder="6-digit code" required={!recoveryCode} /></label>{step.type === 'challenge' && <label className="field-label">Recovery code <span>(optional)</span><input value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.trim())} autoComplete="off" required={!code} /></label>}{error && <p className="form-message error-message" role="alert">{error}</p>}<button className="primary-button upload-submit" type="submit" disabled={busy || (!code && !recoveryCode)}>{busy && <LoaderCircle className="spinning" size={17} />}{step.type === 'setup' ? 'Enable MFA' : 'Verify and sign in'}</button></form>
}

function Shell({ user, onSignedOut }: { user: ApiUser; onSignedOut: () => void }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileMenu, setProfileMenu] = useState(false)
  const name = user.displayName || user.email
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

  async function signOut() {
    try {
      await authApi.logout()
    } finally {
      onSignedOut()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand"><Logo /><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
        <nav className="primary-nav" aria-label="Primary navigation">
          <p className="nav-heading">Client portal</p>
          {navigation.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)}>
              <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="collapse-button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}<span>Collapse</span>
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="topbar-actions">
            <div className="profile-wrap">
              <button className="profile-button" aria-expanded={profileMenu} onClick={() => setProfileMenu((value) => !value)}>
                <span className="avatar">{initials}</span><span className="profile-copy"><strong>{name}</strong><small>{user.organization || 'Client portal'}</small></span><ChevronDown size={15} />
              </button>
              {profileMenu && <div className="dropdown profile-dropdown"><button onClick={() => { setProfileMenu(false); navigate('/profile') }}><UserRound size={17} />Profile</button><button className="danger" onClick={() => void signOut()}>Sign out</button></div>}
            </div>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/submissions" element={<SubmissionsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/profile" element={<ProfilePage user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
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
  const navigate = useNavigate()
  const loadSubmissions = () => submissionsApi.list()
  const { data: submissions, error, loading } = useRemoteData(loadSubmissions)
  const items = submissions ?? []
  const completed = items.filter((item) => item.status === 'completed').length
  const active = items.filter((item) => !['completed', 'rejected', 'failed'].includes(item.status)).length
  const totalFiles = items.reduce((count, item) => count + item.fileCount, 0)
  return <>
    <div className="page-heading"><div><p className="eyebrow">CLIENT PORTAL</p><h1>Dashboard</h1><p>Latest activity across your submissions.</p></div><button className="primary-button" onClick={() => navigate('/upload')}><UploadCloud size={18} />Upload data</button></div>
    {error && <ErrorBanner message={error} />}
    <section className="metrics-grid" aria-label="Submission summary">
      <Metric label="Total submissions" value={loading ? '—' : String(items.length)} note="All your submissions" tone="blue" icon={<Files />} />
      <Metric label="Files submitted" value={loading ? '—' : String(totalFiles)} note="Across all submissions" tone="cyan" icon={<FolderKanban />} />
      <Metric label="In progress" value={loading ? '—' : String(active)} note="Awaiting review or analysis" tone="amber" icon={<UploadCloud />} />
      <Metric label="Completed" value={loading ? '—' : String(completed)} note="Reports ready when published" tone="green" icon={<FileCheck2 />} />
    </section>
    <section className="card activity-card">
      <div className="card-header"><div><h2>Recent submissions</h2><p>Live status from your client portal account</p></div><button className="text-button" onClick={() => navigate('/submissions')}>View all</button></div>
      {loading ? <LoadingPage label="Loading submissions" /> : items.length ? <div className="submission-list">{items.slice(0, 5).map((item) => <SubmissionRow key={item.id} submission={item} />)}</div> : <EmptyState title="No submissions yet" message="Upload your first dataset to start a submission." action="Upload data" onAction={() => navigate('/upload')} />}
    </section>
  </>
}

function UploadPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [success, setSuccess] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const navigate = useNavigate()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setError('')
    setSuccess('')
    if (!files.length) {
      setError('Choose at least one file to upload.')
      return
    }
    const form = new FormData(formElement)
    const projectName = String(form.get('projectName') ?? '').trim()
    if (!projectName) {
      setError('Enter a project name.')
      return
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024 * 1024)) {
      setError('Each file must be 5 GB or smaller.')
      return
    }
    setBusy(true)
    let submissionId = ''
    try {
      const submission = await submissionsApi.create({
        projectName,
        site: String(form.get('site') ?? '') || undefined,
        countryCode: String(form.get('countryCode') ?? '').toUpperCase() || undefined,
        cameraId: String(form.get('cameraId') ?? '') || undefined,
        description: String(form.get('description') ?? '') || undefined,
      })
      submissionId = submission.id
      for (const [index, file] of files.entries()) {
        setProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`)
        const signedUpload = await storageApi.presignedUpload(submission.id, {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          contentLength: file.size,
        })
        const uploadUrl = browserStorageUrl(signedUpload.uploadUrl)
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })
        if (!response.ok) throw new Error(`Upload failed for ${file.name} (HTTP ${response.status}).`)
        await storageApi.completeUpload(submission.id, {
          fileId: signedUpload.fileId,
          key: signedUpload.key,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          contentLength: file.size,
        })
      }
      setSuccess(`Submission created and ${files.length} file${files.length === 1 ? '' : 's'} uploaded successfully.`)
      setFiles([])
      formElement.reset()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to complete the upload.'
      if (!submissionId) {
        setError(message)
      } else {
        try {
          await submissionsApi.remove(submissionId)
          setError(`${message} The incomplete submission was removed; you can try again.`)
        } catch (cleanupReason) {
          const cleanupMessage = cleanupReason instanceof Error ? cleanupReason.message : 'Unable to clean up the incomplete submission.'
          setError(`${message} Submission ${submissionId} could not be removed automatically: ${cleanupMessage}`)
        }
      }
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return <div className="upload-page">
    <div className="page-heading"><div><p className="eyebrow">CLIENT PORTAL</p><h1>Upload data</h1><p>Add your project details and files for review.</p></div></div>
    <form className="card upload-card" onSubmit={submit}>
      <div className="upload-section-heading"><div className="upload-icon"><UploadCloud size={21} /></div><div><h2>Submission details</h2><p>Tell us about the data you are sharing.</p></div></div>
      <div className="upload-fields">
        <label className="field-label">Project name<input name="projectName" required maxLength={160} /></label>
        <label className="field-label">Site or location <span>(optional)</span><input name="site" maxLength={160} /></label>
        <label className="field-label">Country code <span>(optional, 2 letters)</span><input name="countryCode" maxLength={2} pattern="[A-Za-z]{2}" /></label>
        <label className="field-label">Camera or device ID <span>(optional)</span><input name="cameraId" maxLength={120} /></label>
        <label className="field-label field-wide">Description <span>(optional)</span><textarea name="description" rows={3} maxLength={2000} /></label>
      </div>
      <div className="upload-section-heading files-heading"><div className="upload-icon"><Files size={20} /></div><div><h2>Files</h2><p>Select one or more files, up to 5 GB each.</p></div></div>
      <label className="file-picker"><input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><UploadCloud size={22} /><strong>Choose files to upload</strong><span>Files transfer directly to secure object storage.</span></label>
      {files.length > 0 && <ul className="selected-files">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}><span>{file.name}</span><small>{formatFileSize(file.size)}</small></li>)}</ul>}
      {error && <ErrorBanner message={error} />}
      {success && <p className="form-message success-message" role="status"><CheckCircle2 size={17} />{success}</p>}
      {progress && <p className="upload-progress" role="status"><LoaderCircle className="spinning" size={16} />{progress}</p>}
      <div className="upload-actions"><span>Submission status will appear in My submissions.</span><button className="primary-button" type="submit" disabled={busy}>{busy && <LoaderCircle className="spinning" size={17} />}Submit data</button></div>
    </form>
    {success && <button className="text-button" onClick={() => navigate('/submissions')}>View my submissions</button>}
  </div>
}

function SubmissionsPage() {
  const { data, error, loading } = useRemoteData(() => submissionsApi.list())
  return <div className="page-shell"><PageHeading eyebrow="CLIENT PORTAL" title="My submissions" description="Track the status and files for each submission." />
    {error && <ErrorBanner message={error} />}
    <section className="card activity-card">{loading ? <LoadingPage label="Loading submissions" /> : data?.length ? <div className="submission-list">{data.map((item) => <div key={item.id}><SubmissionRow submission={item} /><SubmissionFiles submissionId={item.id} fileCount={item.fileCount} /></div>)}</div> : <EmptyState title="No submissions yet" message="Your submitted projects will appear here." />}</section>
  </div>
}

function ReportsPage() {
  const { data, error, loading } = useRemoteData(() => reportsApi.list())
  const [downloadError, setDownloadError] = useState('')
  async function download(report: Report) {
    try {
      const { downloadUrl } = await storageApi.presignedReportDownload(report.id)
      window.location.assign(browserStorageUrl(downloadUrl))
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : 'Unable to download report')
    }
  }
  return <div className="page-shell"><PageHeading eyebrow="CLIENT PORTAL" title="Completed reports" description="Download reports published for your completed submissions." />
    {(error || downloadError) && <ErrorBanner message={error || downloadError} />}
    <section className="card activity-card">{loading ? <LoadingPage label="Loading reports" /> : data?.length ? <div className="submission-list">{data.map((report) => <div className="submission-row" key={report.id}><div className="file-avatar"><FileCheck2 size={19} /></div><div className="submission-main"><strong>{report.fileName}</strong><span>{report.projectName} · {formatDate(report.publishedAt)}</span></div><button className="secondary-button" onClick={() => void download(report)}>Download</button></div>)}</div> : <EmptyState title="No reports available" message="Published reports will appear here when the analysis team completes them." />}</section>
  </div>
}

function ProfilePage({ user }: { user: ApiUser }) {
  return <div className="page-shell"><PageHeading eyebrow="CLIENT PORTAL" title="Profile" description="Account details associated with your client portal." />
    <section className="card upload-card profile-card">
      <div className="profile-field"><span>Name</span><strong>{user.displayName}</strong></div>
      <div className="profile-field"><span>Email</span><strong>{user.email}</strong></div>
      <div className="profile-field"><span>Organization</span><strong>{user.organization || 'Not provided'}</strong></div>
      <div className="profile-field"><span>Country code</span><strong>{user.countryCode || 'Not provided'}</strong></div>
    </section>
  </div>
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></div>
}

function Metric({ label, value, note, tone, icon }: { label: string; value: string; note: string; tone: string; icon: ReactNode }) {
  return <article className={`metric-card tone-${tone}`}><div className="metric-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>
}

function SubmissionRow({ submission }: { submission: Submission }) {
  return <div className="submission-row"><div className="file-avatar"><FileCheck2 size={19} /></div><div className="submission-main"><strong>{submission.projectName}</strong><span>{submission.site ? `${submission.site} · ` : ''}{formatDate(submission.createdAt)}</span></div><span className="submission-files">{submission.fileCount} {submission.fileCount === 1 ? 'file' : 'files'}</span><span className={`status-badge ${statusTone(submission.status)}`}>{formatStatus(submission.status)}</span><ChevronRight size={17} className="row-arrow" /></div>
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
      setFiles(await storageApi.submissionFiles(submissionId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load uploaded files')
    } finally {
      setLoading(false)
    }
  }

  async function downloadFile(fileId: string) {
    try {
      const { downloadUrl } = await storageApi.presignedFileDownload(fileId)
      window.location.assign(browserStorageUrl(downloadUrl))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to download file')
    }
  }

  return <div className="source-files client-source-files">
    <button className="text-button" aria-expanded={expanded} onClick={() => void toggleFiles()}>
      {expanded ? 'Hide files' : `View files (${fileCount})`}
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

function EmptyState({ title, message, action, onAction }: { title: string; message: string; action?: string; onAction?: () => void }) {
  return <div className="empty-card"><div className="empty-icon"><FolderKanban size={28} /></div><h2>{title}</h2><p>{message}</p>{action && onAction && <button className="secondary-button" onClick={onAction}>{action}</button>}</div>
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

function browserStorageUrl(value: string) {
  const signedUrl = new URL(value)
  return ['s3mock', 'localhost', '127.0.0.1'].includes(signedUrl.hostname)
    ? `${window.location.origin}/s3-upload${signedUrl.pathname}${signedUrl.search}`
    : value
}

function analyticsPortalUrl() {
  const configuredUrl = import.meta.env.VITE_ANALYTICS_PORTAL_URL
  if (configuredUrl) return configuredUrl
  return `${window.location.origin}/analytics`
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

export default function App() {
  return <BrowserRouter><AuthGate /></BrowserRouter>
}
