import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Layout } from './components/Layout'
import { DownloadPage } from './pages/DownloadPage'
import { PlaylistPage } from './pages/PlaylistPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { CommandPage } from './pages/CommandPage'
import { LandingPage } from './pages/LandingPage'

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

  if (!user) {
    return <LandingPage onAuthenticated={refreshUser} />
  }

  return (
    <BrowserRouter>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<DownloadPage />} />
          <Route path="/playlist" element={<PlaylistPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/command" element={<CommandPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
