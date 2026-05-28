import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Download, X } from 'lucide-react'
import type { DownloadProgress } from '../api/client'
import { api } from '../api/client'

interface Props {
  taskId: string
  title: string
  onComplete?: () => void
}

interface ProgressState extends DownloadProgress {
  error?: string
}

export function ProgressCard({ taskId, title, onComplete }: Props) {
  const [progress, setProgress] = useState<ProgressState>({
    status: 'downloading',
    percent: 0,
    speed: '',
    eta: '',
    filename: '',
  })
  const [cancelling, setCancelling] = useState(false)
  const [autoTriggered, setAutoTriggered] = useState(false)
  const downloadLinkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const unsub = api.subscribeProgress(taskId, (data) => {
      setProgress(data as ProgressState)
      if (data.status === 'completed' && onComplete) {
        onComplete()
      }
    })
    return unsub
  }, [taskId])

  // Auto-trigger device download when server finishes
  useEffect(() => {
    if (progress.status === 'completed' && progress.filename && !autoTriggered) {
      setAutoTriggered(true)
      setTimeout(() => {
        downloadLinkRef.current?.click()
      }, 400)
    }
  }, [progress.status, progress.filename, autoTriggered])

  const isDone = progress.status === 'completed'
  const isFailed = progress.status === 'failed'
  const isRunning = progress.status === 'downloading'

  async function handleCancel() {
    if (cancelling) return
    setCancelling(true)
    try {
      await api.cancelDownload(taskId)
    } catch (_) {}
    setCancelling(false)
  }

  const fileUrl = progress.filename ? api.getFileUrl(progress.filename) : ''
  const displayName = progress.filename
    ? decodeURIComponent(progress.filename.replace(/\+/g, ' '))
    : title

  return (
    <div className="card fade-in" style={{
      borderColor: isDone
        ? 'rgba(52, 211, 153, 0.35)'
        : isFailed
        ? 'rgba(248, 113, 113, 0.35)'
        : 'var(--border)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {isDone ? (
          <CheckCircle size={20} color="var(--success)" style={{ flexShrink: 0, marginTop: '1px' }} />
        ) : isFailed ? (
          <XCircle size={20} color="var(--error)" style={{ flexShrink: 0, marginTop: '1px' }} />
        ) : (
          <Download size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '1px' }}
            className={isRunning ? 'pulse' : ''} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: isFailed ? 'var(--error)' : isDone ? 'var(--success)' : 'var(--muted)',
            marginTop: '2px',
          }}>
            {isDone
              ? '✓ Ready — saving to your device…'
              : isFailed
              ? (progress.error || 'Download failed')
              : progress.speed
              ? `${progress.speed}  ·  ETA ${progress.eta}`
              : 'Starting…'}
          </div>
        </div>

        {isRunning && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            title="Cancel download"
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              borderRadius: '8px',
              padding: '0.3rem 0.55rem',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              fontSize: '0.75rem',
            }}
          >
            <X size={12} /> {cancelling ? '…' : 'Cancel'}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${isDone ? 100 : progress.percent}%`,
            background: isFailed ? 'var(--error)' : undefined,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', marginBottom: isDone && fileUrl ? '0.875rem' : 0 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
          {isFailed ? 'Failed' : isDone ? 'Complete' : 'Downloading…'}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>
          {Math.round(isDone ? 100 : progress.percent)}%
        </span>
      </div>

      {/* Save-to-device button — shown after completion */}
      {isDone && fileUrl && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {/* Hidden link that auto-triggers */}
          <a
            ref={downloadLinkRef}
            href={fileUrl}
            download={progress.filename || true}
            style={{ display: 'none' }}
            aria-hidden
          />
          {/* Visible save button */}
          <a
            href={fileUrl}
            download={progress.filename || true}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.55rem 1.1rem',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark, #5b21b6))',
              color: 'white', borderRadius: '10px', textDecoration: 'none',
              fontSize: '0.875rem', fontWeight: 600,
              boxShadow: '0 2px 8px rgba(124,58,237,0.35)',
            }}
          >
            <Download size={14} /> Save to Device
          </a>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', alignSelf: 'center' }}>
            {displayName}
          </span>
        </div>
      )}
    </div>
  )
}
