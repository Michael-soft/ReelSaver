import { Clock, Eye, User, Globe } from 'lucide-react'
import type { VideoInfo } from '../api/client'
import { formatDuration } from '../api/client'

interface Props {
  info: VideoInfo
}

export function VideoInfoCard({ info }: Props) {
  return (
    <div className="card fade-in" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      {info.thumbnail && (
        <img
          src={info.thumbnail}
          alt={info.title}
          style={{
            width: '140px',
            height: '90px',
            objectFit: 'cover',
            borderRadius: '0.5rem',
            flexShrink: 0,
            background: 'var(--surface2)',
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{
          margin: '0 0 0.375rem',
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {info.title}
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {info.uploader && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <User size={13} /> {info.uploader}
            </span>
          )}
          {info.duration && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={13} /> {formatDuration(info.duration)}
            </span>
          )}
          {info.view_count && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Eye size={13} /> {info.view_count.toLocaleString()} views
            </span>
          )}
          {info.extractor && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Globe size={13} /> {info.extractor}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
