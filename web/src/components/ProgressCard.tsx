import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Download, ExternalLink } from 'lucide-react'
import type { DownloadProgress } from '../api/client'
import { api } from '../api/client'

interface Props {
  taskId: string
  title: string
  onComplete?: () => void
}

export function ProgressCard({ taskId, title, onComplete }: Props) {
  const [progress, setProgress] = useState<DownloadProgress>({
    status: 'downloading',
    percent: 0,
    speed: '',
    eta: '',
    filename: '',
  })

  useEffect(() => {
    const unsub = api.subscribeProgress(taskId, (data) => {
      setProgress(data)
      if (data.status === 'completed' && onComplete) {
        onComplete()
      }
    })
    return unsub
  }, [taskId])

  const isDone = progress.status === 'completed'
  const isFailed = progress.status === 'failed'

  return (
    <div className="card fade-in" style={{ borderColor: isDone ? 'rgba(52, 211, 153, 0.3)' : isFailed ? 'rgba(248, 113, 113, 0.3)' : 'var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
        {isDone ? (
          <CheckCircle size={20} color="var(--success)" />
        ) : isFailed ? (
          <XCircle size={20} color="var(--error)" />
        ) : (
          <Download size={20} color="var(--accent)" className={progress.status === 'downloading' ? 'pulse' : ''} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '1px' }}>
            {isDone ? 'Download complete' :
             isFailed ? 'Download failed' :
             progress.speed ? `${progress.speed} • ETA ${progress.eta}` :
             'Starting...'}
          </div>
        </div>
        {isDone && progress.filename && (
          <a
            href={api.getFileUrl(progress.filename)}
            download
            style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', textDecoration: 'none' }}
          >
            <ExternalLink size={14} /> Save
          </a>
        )}
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${isDone ? 100 : isFailed ? progress.percent : progress.percent}%`,
            background: isFailed ? 'var(--error)' : undefined,
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
          {isFailed ? 'Failed' : isDone ? 'Complete' : 'Downloading'}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
          {Math.round(isDone ? 100 : progress.percent)}%
        </span>
      </div>
    </div>
  )
}
