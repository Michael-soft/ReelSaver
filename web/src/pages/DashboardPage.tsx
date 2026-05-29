import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Download, Music, List, Eraser, Smartphone, History,
  TrendingUp, HardDrive, CheckCircle, Clock, ArrowRight,
} from 'lucide-react'
import { api, formatFileSize, formatDate, formatDuration } from '../api/client'
import type { User } from '../App'

interface DashboardPageProps {
  user: User
}

const PLATFORMS = [
  { name: 'YouTube', color: '#ff0000', icon: '▶', hint: 'youtube.com' },
  { name: 'Instagram', color: '#e1306c', icon: '📷', hint: 'instagram.com' },
  { name: 'TikTok', color: '#010101', icon: '♪', hint: 'tiktok.com' },
  { name: 'Twitter / X', color: '#1da1f2', icon: '✕', hint: 'twitter.com or x.com' },
  { name: 'Facebook', color: '#1877f2', icon: 'f', hint: 'facebook.com' },
  { name: 'SoundCloud', color: '#ff5500', icon: '☁', hint: 'soundcloud.com' },
  { name: 'Vimeo', color: '#1ab7ea', icon: 'V', hint: 'vimeo.com' },
  { name: '1000+ more', color: '#7c3aed', icon: '+', hint: 'Any yt-dlp supported site' },
]

const QUICK_ACTIONS = [
  { label: 'Download Video', icon: Download, color: '#7c3aed', to: '/app/download' },
  { label: 'Extract Audio', icon: Music, color: '#0ea5e9', to: '/app/download' },
  { label: 'Playlist', icon: List, color: '#10b981', to: '/app/playlist' },
  { label: 'Remove Watermark', icon: Eraser, color: '#f59e0b', to: '/app/watermark' },
  { label: 'WA Status Saver', icon: Smartphone, color: '#25d366', to: '/app/whatsapp' },
  { label: 'History', icon: History, color: '#6366f1', to: '/app/history' },
]

function greeting(name: string) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name} 👋`
}

export function DashboardPage({ user }: DashboardPageProps) {
  const navigate = useNavigate()
  const [urlInput, setUrlInput] = useState('')

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    staleTime: 15000,
  })

  const { data: diskUsage } = useQuery({
    queryKey: ['disk-usage'],
    queryFn: api.getDiskUsage,
    staleTime: 30000,
  })

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.username || 'there'

  function handleQuickDownload() {
    const u = urlInput.trim()
    if (!u) return
    navigate(`/app/download?url=${encodeURIComponent(u)}`)
  }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>

      {/* Greeting */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text)' }}>
          {greeting(displayName)}
        </h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9375rem' }}>
          Download media from YouTube, Instagram, TikTok and 1000+ platforms.
        </p>
      </div>

      {/* Quick download bar */}
      <div className="card" style={{
        padding: '1.25rem',
        marginBottom: '1.5rem',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(167,139,250,0.06))',
        border: '1px solid rgba(124,58,237,0.2)',
      }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          Quick Download
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            className="input-base"
            placeholder="Paste any video URL here…"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuickDownload()}
            style={{ flex: 1 }}
          />
          <button
            className="btn-primary"
            onClick={handleQuickDownload}
            disabled={!urlInput.trim()}
            style={{ whiteSpace: 'nowrap' }}
          >
            <Download size={15} /> Download
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}>
        {[
          {
            icon: TrendingUp, color: '#7c3aed',
            label: 'Total', value: stats?.total ?? '—',
          },
          {
            icon: CheckCircle, color: '#10b981',
            label: 'Completed', value: stats?.completed ?? '—',
          },
          {
            icon: HardDrive, color: '#0ea5e9',
            label: 'Storage used', value: diskUsage ? formatFileSize(diskUsage.totalSize) || '0 B' : '—',
          },
          {
            icon: Clock, color: '#f59e0b',
            label: 'Active now', value: stats?.downloading ?? 0,
          },
        ].map(({ icon: Icon, color, label, value }) => (
          <div key={label} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: `${color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 0.5rem',
            }}>
              <Icon size={18} color={color} />
            </div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

        {/* Quick actions */}
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
            Quick Actions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {QUICK_ACTIONS.map(({ label, icon: Icon, color, to }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.625rem 0.75rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px', cursor: 'pointer',
                  color: 'var(--text)', fontSize: '0.8125rem', fontWeight: 500,
                  textAlign: 'left', transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = color
                  ;(e.currentTarget as HTMLButtonElement).style.background = `${color}10`
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'
                }}
              >
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  background: `${color}1a`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={14} color={color} />
                </div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Supported platforms */}
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
            Supported Platforms
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {PLATFORMS.map(p => (
              <div
                key={p.name}
                title={p.hint}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                }}
              >
                <div style={{
                  width: '26px', height: '26px', borderRadius: '7px',
                  background: `${p.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, color: p.color, flexShrink: 0,
                }}>
                  {p.icon}
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent downloads */}
      {stats && stats.recent && stats.recent.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Recent Downloads
            </div>
            <button
              onClick={() => navigate('/app/history')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--accent)', fontSize: '0.8125rem', fontWeight: 500,
              }}
            >
              View all <ArrowRight size={13} />
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {stats.recent.map((item, i) => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '0.75rem 1rem',
                  borderBottom: i < stats.recent.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Thumbnail */}
                <div style={{
                  width: '52px', height: '36px',
                  borderRadius: '6px', overflow: 'hidden', flexShrink: 0,
                  background: 'var(--surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <Download size={16} color="var(--muted)" />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.title || item.url}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{formatDate(item.created_at)}</span>
                    {item.filesize && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>· {formatFileSize(item.filesize)}</span>
                    )}
                    {item.duration && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>· {formatDuration(item.duration)}</span>
                    )}
                  </div>
                </div>

                {/* Status chip */}
                <div style={{
                  flexShrink: 0,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '99px', fontSize: '0.6875rem', fontWeight: 600,
                  background: item.status === 'completed'
                    ? 'rgba(52,211,153,0.15)'
                    : item.status === 'failed'
                    ? 'rgba(248,113,113,0.15)'
                    : 'rgba(124,58,237,0.15)',
                  color: item.status === 'completed'
                    ? 'var(--success)'
                    : item.status === 'failed'
                    ? 'var(--error)'
                    : 'var(--accent)',
                }}>
                  {item.status === 'completed' ? '✓ Done' : item.status === 'failed' ? '✕ Failed' : '↓ Active'}
                </div>

                {/* Download link if file available */}
                {item.status === 'completed' && item.filename && (
                  <a
                    href={api.getFileUrl(item.filename)}
                    download={item.filename}
                    title="Download file"
                    style={{
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', borderRadius: '8px',
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      color: 'var(--muted)', textDecoration: 'none',
                    }}
                  >
                    <Download size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: '2rem' }} />
    </div>
  )
}
