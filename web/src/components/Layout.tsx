import { NavLink } from 'react-router-dom'
import { Download, History, Settings, Terminal, ListVideo, LogOut } from 'lucide-react'
import type { User } from '../App'

interface LayoutProps {
  children: React.ReactNode
  user: User
}

export function Layout({ children, user }: LayoutProps) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.username || user.email || 'User'

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px',
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.25rem 0.75rem',
        gap: '0.25rem',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '0.25rem 0.875rem 1.25rem', marginBottom: '0.5rem' }}>
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
              <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text)' }}>Seal</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '-2px' }}>Media Downloader</div>
            </div>
          </div>
        </div>

        <NavLink to="/app" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Download size={17} />
          Download
        </NavLink>
        <NavLink to="/app/playlist" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <ListVideo size={17} />
          Playlist
        </NavLink>
        <NavLink to="/app/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <History size={17} />
          History
        </NavLink>
        <NavLink to="/app/command" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Terminal size={17} />
          Command
        </NavLink>
        <NavLink to="/app/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Settings size={17} />
          Settings
        </NavLink>

        {/* User section at bottom */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.875rem', marginBottom: '0.25rem' }}>
            {user.profile_image_url ? (
              <img
                src={user.profile_image_url}
                alt={displayName}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 600,
                flexShrink: 0,
              }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {displayName}
              </div>
              {user.email && (
                <div style={{
                  fontSize: '0.7rem',
                  color: 'var(--muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {user.email}
                </div>
              )}
            </div>
          </div>
          <a
            href="/auth/logout"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.875rem',
              borderRadius: '8px',
              color: 'var(--muted)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--border)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = ''
              ;(e.currentTarget as HTMLElement).style.color = 'var(--muted)'
            }}
          >
            <LogOut size={16} />
            Log out
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        marginLeft: '220px',
        flex: 1,
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: '2rem',
        maxWidth: 'calc(100vw - 220px)',
      }}>
        {children}
      </main>
    </div>
  )
}
