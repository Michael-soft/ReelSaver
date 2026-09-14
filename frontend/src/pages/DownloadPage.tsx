import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Download, Loader2, AlertCircle, Clipboard } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { VideoInfo } from '../api/client'
import { api } from '../api/client'
import { VideoInfoCard } from '../components/VideoInfoCard'
import { DownloadOptions } from '../components/DownloadOptions'
import { ProgressCard } from '../components/ProgressCard'
import { useDownloadQueue } from '../contexts/DownloadQueueContext'

interface ActiveDownload {
  taskId: string
  title: string
  thumbnail?: string
}

export function DownloadPage() {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const { addDownload } = useDownloadQueue()

  const [url, setUrl] = useState('')
  const [fetchedUrl, setFetchedUrl] = useState('')
  const [mediaType, setMediaType] = useState('video')
  const [quality, setQuality] = useState('best')
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [videoFormat, setVideoFormat] = useState('mp4')
  const [selectedFormatId, setSelectedFormatId] = useState('')
  const [embedThumbnail, setEmbedThumbnail] = useState(true)
  const [embedSubtitle, setEmbedSubtitle] = useState(false)
  const [embedMetadata, setEmbedMetadata] = useState(true)
  const [sponsorBlock, setSponsorBlock] = useState(false)
  const [formatMode, setFormatMode] = useState<'preset' | 'custom'>('preset')
  const [activeDownloads, setActiveDownloads] = useState<ActiveDownload[]>([])
  const [pasteSuccess, setPasteSuccess] = useState(false)

  // Pre-fill URL from query param (share target or quick download from dashboard)
  useEffect(() => {
    const u = searchParams.get('url')
    if (u) {
      setUrl(u)
      setFetchedUrl(u)
    }
  }, [searchParams])

  useQuery({ queryKey: ['settings'], queryFn: api.getSettings })

  const { data: info, isLoading: infoLoading, error: infoError } = useQuery({
    queryKey: ['info', fetchedUrl],
    queryFn: () => api.getInfo(fetchedUrl),
    enabled: !!fetchedUrl,
    retry: false,
    staleTime: 60000,
  })

  const downloadMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.startDownload>[0]) => api.startDownload(data),
    onSuccess: (res, vars) => {
      const title = (info as VideoInfo)?.title || vars.url
      const thumbnail = (info as VideoInfo)?.thumbnail
      setActiveDownloads(prev => [...prev, { taskId: res.taskId, title, thumbnail }])
      addDownload(res.taskId, title, thumbnail)
    },
  })

  const handleFetch = useCallback(() => {
    const trimmed = url.trim()
    if (!trimmed) return
    setFetchedUrl(trimmed)
    setSelectedFormatId('')
    setFormatMode('preset')
  }, [url])

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const trimmed = text.trim()
      if (trimmed) {
        setUrl(trimmed)
        setFetchedUrl(trimmed)
        setPasteSuccess(true)
        setTimeout(() => setPasteSuccess(false), 2000)
      }
    } catch (_) {
      // clipboard API blocked — ignore silently
    }
  }

  const handleDownload = () => {
    if (!fetchedUrl) return
    downloadMutation.mutate({
      url: fetchedUrl,
      title: (info as VideoInfo)?.title,
      thumbnail: (info as VideoInfo)?.thumbnail,
      uploader: (info as VideoInfo)?.uploader,
      duration: (info as VideoInfo)?.duration,
      mediaType,
      quality,
      audioFormat,
      videoFormat,
      formatId: formatMode === 'custom' ? selectedFormatId : undefined,
      embedThumbnail,
      embedSubtitle,
      embedMetadata,
      sponsorBlock,
    })
  }

  const handleRemoveDownload = (taskId: string) => {
    setActiveDownloads(prev => prev.filter(d => d.taskId !== taskId))
    qc.invalidateQueries({ queryKey: ['history'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
  }

  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: api.getStats, staleTime: 10000 })
  const stats = statsQuery.data

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text)' }}>
          Download
        </h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9375rem' }}>
          Download video or audio from YouTube, Twitter, Instagram, and 1000+ more.
        </p>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total downloads', value: stats.total },
            { label: 'Completed', value: stats.completed },
            { label: 'Videos / Audio', value: `${stats.videoCount} / ${stats.audioCount}` },
          ].map(stat => (
            <div key={stat.label} className="card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-light)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* URL Input + paste button */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            className="input-base"
            style={{ paddingLeft: '2.75rem' }}
            placeholder="Paste video URL here…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFetch()}
          />
          <Search size={16} style={{
            position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--muted)',
          }} />
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={handlePaste}
          title="Paste from clipboard"
          style={{ flexShrink: 0, minWidth: 'unset', padding: '0 0.875rem' }}
        >
          <Clipboard size={15} />
          {pasteSuccess ? 'Pasted!' : 'Paste'}
        </button>
        <button className="btn-primary" onClick={handleFetch} disabled={!url.trim() || infoLoading} style={{ flexShrink: 0 }}>
          {infoLoading ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
          Fetch
        </button>
      </div>

      {infoError && (
        <div style={{
          display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
          background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)',
          borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem',
          color: 'var(--error)', fontSize: '0.875rem',
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{(infoError as Error).message}</span>
        </div>
      )}

      {info && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1rem' }}>
          <VideoInfoCard info={info} />
          <DownloadOptions
            info={info}
            mediaType={mediaType} setMediaType={setMediaType}
            quality={quality} setQuality={setQuality}
            audioFormat={audioFormat} setAudioFormat={setAudioFormat}
            videoFormat={videoFormat} setVideoFormat={setVideoFormat}
            selectedFormatId={selectedFormatId} setSelectedFormatId={setSelectedFormatId}
            embedThumbnail={embedThumbnail} setEmbedThumbnail={setEmbedThumbnail}
            embedSubtitle={embedSubtitle} setEmbedSubtitle={setEmbedSubtitle}
            embedMetadata={embedMetadata} setEmbedMetadata={setEmbedMetadata}
            sponsorBlock={sponsorBlock} setSponsorBlock={setSponsorBlock}
            formatMode={formatMode} setFormatMode={setFormatMode}
          />
        </div>
      )}

      {fetchedUrl && !infoLoading && (
        <button
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginBottom: '1.5rem' }}
          onClick={handleDownload}
          disabled={downloadMutation.isPending}
        >
          {downloadMutation.isPending ? <Loader2 size={16} className="spinner" /> : <Download size={16} />}
          Download
        </button>
      )}

      {downloadMutation.isError && (
        <div style={{
          display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
          background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)',
          borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem',
          color: 'var(--error)', fontSize: '0.875rem',
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{(downloadMutation.error as Error).message}</span>
        </div>
      )}

      {activeDownloads.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem', color: 'var(--text)' }}>
            Active Downloads
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeDownloads.map(d => (
              <ProgressCard
                key={d.taskId}
                taskId={d.taskId}
                title={d.title}
                onComplete={() => setTimeout(() => handleRemoveDownload(d.taskId), 6000)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
