import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Layout } from './components/Layout'
import { useTheme } from './hooks/useTheme'
import { DownloadQueueProvider } from './contexts/DownloadQueueContext'
import { DownloadPage } from './pages/DownloadPage'
import { DashboardPage } from './pages/DashboardPage'
import { PlaylistPage } from './pages/PlaylistPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { CommandPage } from './pages/CommandPage'
import { WatermarkPage } from './pages/WatermarkPage'
import { WhatsAppStatusPage } from './pages/WhatsAppStatusPage'
import { ShareTargetPage } from './pages/ShareTargetPage'
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
  useTheme()

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

  useEffect(() => { refreshUser() }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg)',
        flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{
          width: '44px', height: '44px',
          background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
          borderRadius: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading ReelSaver…</span>
      </div>
    )
  }

  const isAuth = !!user

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/privacy" element={<PrivacyPage isAuthenticated={isAuth} />} />
        <Route path="/terms" element={<TermsPage isAuthenticated={isAuth} />} />
        <Route path="/share-target" element={<ShareTargetPage />} />

        {isAuth && user ? (
          <>
            <Route path="/app" element={
              <DownloadQueueProvider>
                <Layout user={user}><DashboardPage user={user} /></Layout>
              </DownloadQueueProvider>
            } />
            <Route path="/app/download" element={
              <DownloadQueueProvider>
                <Layout user={user}><DownloadPage /></Layout>
              </DownloadQueueProvider>
            } />
            <Route path="/app/playlist" element={
              <DownloadQueueProvider>
                <Layout user={user}><PlaylistPage /></Layout>
              </DownloadQueueProvider>
            } />
            <Route path="/app/watermark" element={
              <DownloadQueueProvider>
                <Layout user={user}><WatermarkPage /></Layout>
              </DownloadQueueProvider>
            } />
            <Route path="/app/whatsapp" element={
              <DownloadQueueProvider>
                <Layout user={user}><WhatsAppStatusPage /></Layout>
              </DownloadQueueProvider>
            } />
            <Route path="/app/history" element={
              <DownloadQueueProvider>
                <Layout user={user}><HistoryPage /></Layout>
              </DownloadQueueProvider>
            } />
            <Route path="/app/command" element={
              <DownloadQueueProvider>
                <Layout user={user}><CommandPage /></Layout>
              </DownloadQueueProvider>
            } />
            <Route path="/app/settings" element={
              <DownloadQueueProvider>
                <Layout user={user}><SettingsPage /></Layout>
              </DownloadQueueProvider>
            } />
            <Route path="/" element={<HomePage isAuthenticated />} />
            <Route path="/login" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage onAuthenticated={refreshUser} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}
