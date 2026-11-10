import { useState, type ReactNode } from 'react'
import {
  Bell, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, FileCheck2, Files,
  FolderKanban, LayoutDashboard, Menu, Search, Settings, UploadCloud, UserRound,
  Users, X,
} from 'lucide-react'
import { BrowserRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'

const contributorNav = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Upload data', to: '/upload', icon: UploadCloud },
  { label: 'My submissions', to: '/submissions', icon: Files },
  { label: 'Completed reports', to: '/reports', icon: FileCheck2 },
  { label: 'Profile', to: '/profile', icon: UserRound },
]

const analyticsNav = [
  { label: 'Dashboard', to: '/analytics', icon: LayoutDashboard },
  { label: 'Submission inbox', to: '/analytics/inbox', icon: Files },
  { label: 'My assignments', to: '/analytics/assignments', icon: FolderKanban },
  { label: 'All projects', to: '/analytics/projects', icon: FolderKanban },
  { label: 'Completed analysis', to: '/analytics/completed', icon: FileCheck2 },
  { label: 'Administration', to: '/analytics/admin', icon: Settings },
]

function Logo() {
  return <div className="brand-mark"><span className="brand-symbol"><i /><i /><i /></span><span>DataBridge</span></div>
}

function Shell() {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [workspaceMenu, setWorkspaceMenu] = useState(false)
  const [profileMenu, setProfileMenu] = useState(false)
  const analytics = window.location.pathname.startsWith('/analytics')
  const nav = analytics ? analyticsNav : contributorNav

  const switchWorkspace = (destination: 'contributor' | 'analytics') => {
    setWorkspaceMenu(false)
    navigate(destination === 'analytics' ? '/analytics' : '/')
  }

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''} ${analytics ? 'analytics-theme' : ''}`}>
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand"><Logo /><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
        <nav className="primary-nav" aria-label="Primary navigation">
          <p className="nav-heading">Workspace</p>
          {nav.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/' || to === '/analytics'} title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)}>
              <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="help-link"><CircleHelp size={19} /><span>Help & support</span></button>
          <button className="collapse-button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}<span>Collapse</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="global-search"><Search size={18} /><input aria-label="Global search" placeholder={analytics ? 'Search submissions, projects...' : 'Search submissions and reports...'} /><kbd>⌘ K</kbd></div>
          <div className="topbar-actions">
            <div className="workspace-switcher">
              <button className="workspace-button" aria-expanded={workspaceMenu} onClick={() => setWorkspaceMenu((value) => !value)}>
                <span className="workspace-avatar">{analytics ? 'DA' : 'CP'}</span><span>{analytics ? 'Analytics workspace' : 'Contributor portal'}</span><ChevronDown size={15} />
              </button>
              {workspaceMenu && <div className="dropdown workspace-dropdown"><p>Switch workspace</p><button onClick={() => switchWorkspace('contributor')}><UserRound size={17} />Contributor portal</button><button onClick={() => switchWorkspace('analytics')}><Users size={17} />Analytics workspace</button></div>}
            </div>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><span /></button>
            <div className="profile-wrap">
              <button className="profile-button" aria-expanded={profileMenu} onClick={() => setProfileMenu((value) => !value)}>
                <span className="avatar">KS</span><span className="profile-copy"><strong>Karthick S.</strong><small>{analytics ? 'Data analyst' : 'Contributor'}</small></span><ChevronDown size={15} />
              </button>
              {profileMenu && <div className="dropdown profile-dropdown"><button><UserRound size={17} />View profile</button><button><Settings size={17} />Account settings</button><button className="danger">Sign out</button></div>}
            </div>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<ContributorDashboard />} />
            <Route path="/upload" element={<PageShell title="Upload data" description="Add a new data submission for review." />} />
            <Route path="/submissions" element={<PageShell title="My submissions" description="Track every file set you have submitted." />} />
            <Route path="/reports" element={<PageShell title="Completed reports" description="Download analysis reports published by your team." />} />
            <Route path="/profile" element={<PageShell title="Profile" description="Manage your contributor profile and preferences." />} />
            <Route path="/analytics/*" element={<AnalyticsDashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function ContributorDashboard() {
  const navigate = useNavigate()
  return <>
    <div className="page-heading">
      <div><p className="eyebrow">MONDAY, 7 NOVEMBER</p><h1>Good morning, Karthick</h1><p>Here is the latest activity across your data submissions.</p></div>
      <button className="primary-button" onClick={() => navigate('/upload')}><UploadCloud size={18} />Upload data</button>
    </div>
    <section className="metrics-grid" aria-label="Submission summary">
      <Metric label="Assigned projects" value="8" note="Across 4 countries" tone="blue" icon={<FolderKanban />} />
      <Metric label="Total submissions" value="24" note="+3 this month" tone="cyan" icon={<Files />} />
      <Metric label="Under analysis" value="6" note="Average 3.2 days" tone="amber" icon={<Users />} />
      <Metric label="Completed" value="14" note="58% completion rate" tone="green" icon={<FileCheck2 />} />
    </section>
    <div className="dashboard-grid">
      <section className="card activity-card">
        <div className="card-header"><div><h2>Recent submissions</h2><p>Your latest uploads and their current status</p></div><button className="text-button" onClick={() => navigate('/submissions')}>View all</button></div>
        <div className="submission-list">
          <Submission id="DB-1048" project="Urban mobility study" date="Today, 09:42" files="12 files · 1.8 GB" status="Under analysis" statusTone="amber" />
          <Submission id="DB-1041" project="Road safety survey" date="5 Nov, 16:18" files="8 files · 842 MB" status="Received" statusTone="cyan" />
          <Submission id="DB-1037" project="Coastal habitat mapping" date="3 Nov, 11:05" files="24 files · 3.4 GB" status="Completed" statusTone="green" />
        </div>
      </section>
      <section className="card quick-card"><div className="quick-upload-icon"><UploadCloud size={24} /></div><h2>Submit new data</h2><p>Upload field recordings, reports, images, and structured datasets.</p><button className="secondary-button" onClick={() => navigate('/upload')}>Start submission</button><div className="support-note"><span>Supported formats</span><strong>MP4, MOV, PDF, XLSX, CSV, JPG +</strong></div></section>
    </div>
  </>
}

function Metric({ label, value, note, tone, icon }: { label: string; value: string; note: string; tone: string; icon: ReactNode }) {
  return <article className={`metric-card tone-${tone}`}><div className="metric-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>
}

function Submission({ id, project, date, files, status, statusTone }: { id: string; project: string; date: string; files: string; status: string; statusTone: string }) {
  return <div className="submission-row"><div className="file-avatar"><FileCheck2 size={19} /></div><div className="submission-main"><strong>{project}</strong><span>{id} · {date}</span></div><span className="submission-files">{files}</span><span className={`status-badge ${statusTone}`}>{status}</span><ChevronRight size={17} className="row-arrow" /></div>
}

function AnalyticsDashboard() {
  const path = window.location.pathname
  const title = path.includes('/inbox') ? 'Submission inbox' : path.includes('/assignments') ? 'My assignments' : path.includes('/projects') ? 'All projects' : path.includes('/completed') ? 'Completed analysis' : path.includes('/admin') ? 'Administration' : 'Analytics overview'
  if (path !== '/analytics') return <PageShell title={title} description="This workspace is ready for operational data integration." />
  return <>
    <div className="page-heading"><div><p className="eyebrow">OPERATIONS</p><h1>Analytics overview</h1><p>Monitor submissions and team capacity across all active projects.</p></div><button className="primary-button purple"><FileCheck2 size={18} />Export report</button></div>
    <section className="metrics-grid">
      <Metric label="Total submissions" value="248" note="+12.5% from last period" tone="purple" icon={<Files />} />
      <Metric label="New submissions" value="32" note="8 received today" tone="blue" icon={<UploadCloud />} />
      <Metric label="Awaiting assignment" value="18" note="Needs review" tone="amber" icon={<Users />} />
      <Metric label="In progress" value="41" note="Across 12 analysts" tone="violet" icon={<FolderKanban />} />
    </section>
    <div className="dashboard-grid analytics-grid">
      <section className="card chart-card"><div className="card-header"><div><h2>Submission volume</h2><p>Last 30 days</p></div><button className="period-button">30 days <ChevronDown size={14} /></button></div><VolumeChart /></section>
      <section className="card status-card"><div className="card-header"><div><h2>Submission status</h2><p>Current pipeline</p></div></div><StatusChart /></section>
    </div>
  </>
}

function VolumeChart() {
  const bars = [42, 58, 46, 72, 61, 78, 54, 84, 67, 91, 74, 88]
  return <div className="bar-chart" aria-label="Submission volume chart">{bars.map((height, index) => <div key={index}><span style={{ height: `${height}%` }} /><small>{index % 2 === 0 ? `${index + 1} Nov` : ''}</small></div>)}</div>
}

function StatusChart() {
  return <div className="donut-layout"><div className="donut"><div><strong>248</strong><span>Total</span></div></div><div className="chart-legend"><Legend color="purple" label="Completed" value="112" /><Legend color="blue" label="In analysis" value="41" /><Legend color="amber" label="Awaiting" value="18" /><Legend color="gray" label="Submitted" value="77" /></div></div>
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return <div><span className={`legend-dot ${color}`} /><span>{label}</span><strong>{value}</strong></div>
}

function PageShell({ title, description }: { title: string; description: string }) {
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">DATABRIDGE</p><h1>{title}</h1><p>{description}</p></div></div><section className="empty-card card"><div className="empty-icon"><FolderKanban size={28} /></div><h2>{title}</h2><p>Workspace content is ready to connect to live project data.</p></section></div>
}

export default function App() {
  return <BrowserRouter><Shell /></BrowserRouter>
}
