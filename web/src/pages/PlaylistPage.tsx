import { useState } from 'react'
import { Search, Download, Loader2, CheckSquare, Square, ListVideo, AlertCircle } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import type { PlaylistItem } from '../api/client'
import { api, formatDuration } from '../api/client'
import { ProgressCard } from '../components/ProgressCard'

interface ActiveDownload {
  taskId: string
  title: string
}

export function PlaylistPage() {
  const [url, setUrl] = useState('')
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mediaType, setMediaType] = useState('video')
  const [quality, setQuality] = useState('best')
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [activeDownloads, setActiveDownloads] = useState<ActiveDownload[]>([])

  const fetchPlaylist = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    setItems([])
    setSelected(new Set())
    try {
      const res = await api.getPlaylist(trimmed)
      setItems(res.items)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const downloadMutation = useMutation({
    mutationFn: (item: PlaylistItem) =>
      api.startDownload({
        url: item.url,
        title: item.title,
        thumbnail: item.thumbnail,
        uploader: item.uploader,
        duration: item.duration,
        mediaType,
        quality,
        audioFormat,
      }),
    onSuccess: (res, item) => {
      setActiveDownloads(prev => [...prev, { taskId: res.taskId, title: item.title }])
    },
  })

  const handleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map(i => i.id)))
    }
  }

  const handleToggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDownloadSelected = async () => {
    const toDownload = items.filter(i => selected.has(i.id))
    for (const item of toDownload) {
      await downloadMutation.mutateAsync(item)
    }
  }

  const handleDownloadAll = async () => {
    for (const item of items) {
      await downloadMutation.mutateAsync(item)
    }
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text)' }}>
          Playlist
        </h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9375rem' }}>
          Fetch a playlist and select which videos to download.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            className="input-base"
            style={{ paddingLeft: '2.75rem' }}
            placeholder="Paste playlist URL..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchPlaylist()}
          />
          <ListVideo size={16} style={{
            position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--muted)',
          }} />
        </div>
        <button className="btn-primary" onClick={fetchPlaylist} disabled={!url.trim() || loading}>
          {loading ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
          Fetch
        </button>
      </div>

      {error && (
        <div style={{
          display: 'flex', gap: '0.5rem', alignItems: 'center',
          background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)',
          borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem',
          color: 'var(--error)', fontSize: '0.875rem',
        }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Options */}
          <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className={`chip ${mediaType === 'video' ? 'selected' : ''}`} onClick={() => setMediaType('video')}>Video</button>
              <button className={`chip ${mediaType === 'audio' ? 'selected' : ''}`} onClick={() => setMediaType('audio')}>Audio</button>
            </div>
            <select className="select-base" value={quality} onChange={e => setQuality(e.target.value)}>
              <option value="best">Best quality</option>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
            </select>
            {mediaType === 'audio' && (
              <select className="select-base" value={audioFormat} onChange={e => setAudioFormat(e.target.value)}>
                {['mp3', 'm4a', 'opus', 'flac'].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            )}
          </div>

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '0.75rem', padding: '0.5rem 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={handleSelectAll}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', padding: 0 }}
              >
                {selected.size === items.length ? <CheckSquare size={16} color="var(--accent)" /> : <Square size={16} />}
                {selected.size === items.length ? 'Deselect all' : 'Select all'}
              </button>
              <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                {items.length} videos {selected.size > 0 ? `• ${selected.size} selected` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {selected.size > 0 && (
                <button className="btn-primary" onClick={handleDownloadSelected} disabled={downloadMutation.isPending}>
                  <Download size={14} /> Download {selected.size}
                </button>
              )}
              <button className="btn-secondary" onClick={handleDownloadAll} disabled={downloadMutation.isPending}>
                <Download size={14} /> All
              </button>
            </div>
          </div>

          {/* Playlist items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {items.map((item, i) => (
              <div
                key={item.id || i}
                className="card"
                style={{
                  display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem',
                  cursor: 'pointer',
                  borderColor: selected.has(item.id) ? 'rgba(124, 58, 237, 0.4)' : 'var(--border)',
                  background: selected.has(item.id) ? 'rgba(124, 58, 237, 0.05)' : 'var(--surface)',
                  transition: 'all 0.15s',
                }}
                onClick={() => item.id && handleToggle(item.id)}
              >
                <div style={{ flexShrink: 0, color: selected.has(item.id) ? 'var(--accent)' : 'var(--border)' }}>
                  {selected.has(item.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt=""
                    style={{ width: '72px', height: '45px', objectFit: 'cover', borderRadius: '0.375rem', flexShrink: 0 }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {i + 1}. {item.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                    {[item.uploader, formatDuration(item.duration)].filter(Boolean).join(' • ')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {activeDownloads.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem', color: 'var(--text)' }}>Active Downloads</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {activeDownloads.map(d => (
                  <ProgressCard key={d.taskId} taskId={d.taskId} title={d.title} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
