import { useEffect, useState } from 'react'
import { Eraser, Download, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { api, formatFileSize } from '../api/client'
import type { DownloadProgress } from '../api/client'

interface ActiveDownload {
  taskId: string
  url: string
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  percent: number
  speed: string
  eta: string
  filename: string
  filesize?: number
  error?: string
}

const SUPPORTED = [
  { name: 'TikTok', host: 'tiktok.com' },
  { name: 'Instagram Reels', host: 'instagram.com' },
  { name: 'Twitter / X', host: 'twitter.com / x.com' },
  { name: 'Facebook', host: 'facebook.com' },
  { name: 'Snapchat', host: 'snapchat.com' },
]

export function WatermarkPage() {
  const [url, setUrl] = useState('')
  const [items, setItems] = useState<ActiveDownload[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const closers: Array<() => void> = []
    items.forEach(item => {
      if (item.status !== 'downloading' && item.status !== 'pending') return
      const close = api.subscribeProgress(item.taskId, (data: DownloadProgress & { error?: string }) => {
        setItems(prev => prev.map(it => it.taskId === item.taskId ? {
          ...it,
          status: (data.status as ActiveDownload['status']) || it.status,
          percent: data.percent ?? it.percent,
          speed: data.speed ?? it.speed,
          eta: data.eta ?? it.eta,
          filename: data.filename || it.filename,
          error: data.error || it.error,
        } : it))
      })
      closers.push(close)
    })
    return () => closers.forEach(c => c())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map(i => i.taskId).join(',')])

  async function cancel(taskId: string) {
    try {
      await api.cancelDownload(taskId)
    } catch (_) {}
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please paste a video URL.')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.startDownload({
        url: trimmed,
        mediaType: 'video',
        quality: 'best',
        videoFormat: 'mp4',
        embedThumbnail: false,
        embedSubtitle: false,
        embedMetadata: false,
        sponsorBlock: false,
        noWatermark: true,
      })
      setItems(prev => [{
        taskId: res.taskId,
        url: trimmed,
        status: 'downloading',
        percent: 0,
        speed: '',
        eta: '',
        filename: '',
      }, ...prev])
      setUrl('')
    } catch (err) {
      setError((err as Error).message || 'Failed to start download')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div style={{
          width: '40px', height: '40px',
          background: 'rgba(124, 58, 237, 0.18)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-light)',
        }}>
          <Eraser size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
            Remove Watermark
          </h1>
          <p style={{ margin: '0.15rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Download videos without the platform's watermark.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            Paste a video URL
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/..."
              className="input-base"
              style={{ flex: 1, minWidth: '240px' }}
            />
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <Loader2 size={16} className="spinner" /> : <Download size={16} />}
              {submitting ? 'Starting...' : 'Download clean'}
            </button>
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              padding: '0.625rem 0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '0.8125rem',
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}
        </form>

        <div style={{
          marginTop: '1.25rem',
          padding: '0.85rem 1rem',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          fontSize: '0.8125rem',
          color: 'var(--muted)',
          lineHeight: 1.5,
        }}>
          Works best for short-form video platforms. We download the original
          stream that doesn't have the platform overlay burned in. Some videos
          may still include creator-added watermarks — those can't be removed
          without re-encoding.
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Supported platforms
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {SUPPORTED.map(s => (
            <span key={s.name} className="chip selected">{s.name}</span>
          ))}
        </div>
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' }}>
            Recent downloads
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map(item => (
              <div key={item.taskId} className="card" style={{ padding: '1rem' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: 500,
                    }}>
                      {item.filename || item.url}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                      {item.status === 'downloading' && (
                        <>
                          {item.percent.toFixed(1)}% · {item.speed} · ETA {item.eta}
                        </>
                      )}
                      {item.status === 'completed' && (
                        <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={13} /> Done {item.filesize ? `· ${formatFileSize(item.filesize)}` : ''}
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span style={{ color: 'var(--error)' }}>
                          {item.error || 'Download failed'}
                        </span>
                      )}
                      {item.status === 'pending' && 'Queued...'}
                    </div>
                  </div>
                  {item.status === 'downloading' && (
                    <button
                      type="button"
                      onClick={() => cancel(item.taskId)}
                      className="btn-secondary"
                      style={{ fontSize: '0.8125rem' }}
                    >
                      <X size={13} /> Cancel
                    </button>
                  )}
                  {item.status === 'completed' && item.filename && (
                    <a
                      href={api.getFileUrl(item.filename.split('/').pop() || '')}
                      download
                      className="btn-secondary"
                      style={{ textDecoration: 'none' }}
                    >
                      <Download size={14} /> Save
                    </a>
                  )}
                </div>
                {item.status === 'downloading' && (
                  <div className="progress-bar" style={{ marginTop: '0.75rem' }}>
                    <div className="progress-fill" style={{ width: `${item.percent}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
