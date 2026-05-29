import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Download, History, Settings, Terminal, ListVideo, LogOut, Menu, X, Eraser, Smartphone, Sun, Moon, LayoutDashboard } from 'lucide-react'
import type { User } from '../App'
import { useTheme } from '../hooks/useTheme'
import { useDownloadQueue } from '../contexts/DownloadQueueContext'

interface LayoutProps {
  children: React.ReactNode
  user: User
}

export function Layout({ children, user }: LayoutProps) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.username || user.email || 'User'
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { toggle, isDark } = useTheme()
  const { activeCount } = useDownloadQueue()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const ThemeToggle = () => (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      {isDark
        ? <><Sun size={14} color="#fbbf24" /> Light</>
        : <><Moon size={14} color="#7c3aed" /> Dark</>
      }
    </button>
  )

  return (
    <div className="app-shell">
      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="icon-btn"
        >
          <Menu size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '28px', height: '28px',
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Download size={15} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>ReelSaver</span>
        </div>
        {/* Theme toggle in mobile topbar */}
        <ThemeToggle />
      </header>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo + close */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.25rem 0.875rem 1.25rem',
          marginBottom: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '34px', height: '34px',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Download size={18} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text)' }}>ReelSaver</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '-2px' }}>Media Downloader</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="icon-btn sidebar-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav links */}
        <NavLink to="/app" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={17} /> Dashboard
        </NavLink>
        <NavLink to="/app/download" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Download size={17} />
          <span style={{ flex: 1 }}>Download</span>
          {activeCount > 0 && (
            <span style={{
              minWidth: '18px', height: '18px', borderRadius: '99px',
              background: 'var(--accent)', color: 'white',
              fontSize: '0.6875rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px',
            }}>
              {activeCount}
            </span>
          )}
        </NavLink>
        <NavLink to="/app/playlist" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <ListVideo size={17} /> Playlist
        </NavLink>
        <NavLink to="/app/watermark" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Eraser size={17} /> Remove Watermark
        </NavLink>
        <NavLink to="/app/whatsapp" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Smartphone size={17} /> WA Status Saver
        </NavLink>
        <NavLink to="/app/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <History size={17} /> History
        </NavLink>
        <NavLink to="/app/command" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Terminal size={17} /> Command
        </NavLink>
        <NavLink to="/app/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Settings size={17} /> Settings
        </NavLink>

        {/* Bottom section */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>

          {/* Theme toggle — in sidebar */}
          <div style={{ padding: '0 0.25rem 0.75rem' }}>
            <button
              type="button"
              onClick={toggle}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isDark ? <Moon size={15} /> : <Sun size={15} color="#d97706" />}
                {isDark ? 'Dark mode' : 'Light mode'}
              </span>
              {/* Animated pill indicator */}
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                width: '38px', height: '22px',
                background: isDark ? 'var(--accent)' : 'var(--border)',
                borderRadius: '99px',
                padding: '2px',
                transition: 'background 0.2s',
              }}>
                <span style={{
                  width: '18px', height: '18px',
                  borderRadius: '50%',
                  background: 'white',
                  transform: isDark ? 'translateX(16px)' : 'translateX(0)',
                  transition: 'transform 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                }} />
              </span>
            </button>
          </div>

          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.875rem', marginBottom: '0.25rem' }}>
            {user.profile_image_url ? (
              <img
                src={user.profile_image_url}
                alt={displayName}
                style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
              }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{
                fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {displayName}
              </div>
              {user.email && (
                <div style={{
                  fontSize: '0.7rem', color: 'var(--muted)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {user.email}
                </div>
              )}
            </div>
          </div>
          <a href="/auth/logout" className="logout-link">
            <LogOut size={16} /> Log out
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="app-main">
        {children}
      </main>
    </div>
  )
}
