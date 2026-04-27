import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Layout } from './components/Layout'
import { DownloadPage } from './pages/DownloadPage'
import { PlaylistPage } from './pages/PlaylistPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { CommandPage } from './pages/CommandPage'
import { WatermarkPage } from './pages/WatermarkPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'

export interface User {
  id: string
  username: string | null
  email: string | null
  first_name: string | null
  last_name: string | null
  profile_image_url: string | null
  auth_provider: string
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = () => {
    return fetch('/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setUser(data)
        setLoading(false)
      })
      .catch(() => {
        setUser(null)
        setLoading(false)
      })
  }

  useEffect(() => {
    refreshUser()
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--muted)',
        fontSize: '0.95rem',
      }}>
        Loading...
      </div>
    )
  }

  const isAuth = !!user

  return (
    <BrowserRouter>
      <Routes>
        {/* Public legal pages — always accessible */}
        <Route path="/privacy" element={<PrivacyPage isAuthenticated={isAuth} />} />
        <Route path="/terms" element={<TermsPage isAuthenticated={isAuth} />} />

        {isAuth && user ? (
          <>
            {/* Authenticated app — sidebar layout */}
            <Route path="/app" element={<Layout user={user}><DownloadPage /></Layout>} />
            <Route path="/app/playlist" element={<Layout user={user}><PlaylistPage /></Layout>} />
            <Route path="/app/watermark" element={<Layout user={user}><WatermarkPage /></Layout>} />
            <Route path="/app/history" element={<Layout user={user}><HistoryPage /></Layout>} />
            <Route path="/app/command" element={<Layout user={user}><CommandPage /></Layout>} />
            <Route path="/app/settings" element={<Layout user={user}><SettingsPage /></Layout>} />

            {/* Marketing home is still reachable when signed in */}
            <Route path="/" element={<HomePage isAuthenticated />} />
            <Route path="/login" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </>
        ) : (
          <>
            {/* Public marketing + auth */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage onAuthenticated={refreshUser} />} />
            {/* Anything else (e.g. /app/*) → bounce to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}
