import { useState } from 'react'
import { Search, Trash2, Download, ExternalLink, CheckSquare, Square, RefreshCw } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { DownloadRecord } from '../api/client'
import { api, formatDuration, formatFileSize, formatDate } from '../api/client'

export function HistoryPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['history', search, typeFilter, page],
    queryFn: () => api.getHistory({ search, type: typeFilter, page, perPage: 20 }),
    staleTime: 5000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteHistory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['history'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.clearHistory(ids),
    onSuccess: () => {
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['history'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const items = data?.items || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / 20)

  const handleToggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selected.size === items.length) setSelected(new Set())
    else setSelected(new Set(items.map(i => i.id)))
  }

  const statusColor = (status: string) => {
    if (status === 'completed') return 'badge-completed'
    if (status === 'failed') return 'badge-failed'
    if (status === 'downloading') return 'badge-downloading'
    return 'badge-pending'
  }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text)' }}>History</h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9375rem' }}>
            {total} total download{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
          {selected.size > 0 && (
            <button
              className="btn-danger"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 size={14} /> Delete {selected.size}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <input
            className="input-base"
            style={{ paddingLeft: '2.75rem' }}
            placeholder="Search history..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <Search size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {[['', 'All'], ['video', 'Video'], ['audio', 'Audio']].map(([val, label]) => (
            <button
              key={val}
              className={`chip ${typeFilter === val ? 'selected' : ''}`}
              onClick={() => { setTypeFilter(val); setPage(1); }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Loading...</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Download size={40} color="var(--border)" style={{ marginBottom: '0.75rem' }} />
          <div style={{ color: 'var(--muted)', fontSize: '0.9375rem' }}>No downloads found</div>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '0 0.75rem 0.5rem',
            fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <div style={{ width: '28px', flexShrink: 0, cursor: 'pointer' }} onClick={handleSelectAll}>
              {selected.size === items.length && items.length > 0
                ? <CheckSquare size={15} color="var(--accent)" />
                : <Square size={15} />}
            </div>
            <div style={{ flex: 1, marginLeft: '0.5rem' }}>Title</div>
            <div style={{ width: '70px', textAlign: 'right' }}>Type</div>
            <div style={{ width: '90px', textAlign: 'right' }}>Size</div>
            <div style={{ width: '90px', textAlign: 'right' }}>Date</div>
            <div style={{ width: '60px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1.5rem' }}>
            {items.map((item: DownloadRecord) => (
              <div
                key={item.id}
                className="card fade-in"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem',
                  borderColor: selected.has(item.id) ? 'rgba(124, 58, 237, 0.3)' : 'var(--border)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onClick={() => handleToggle(item.id)}
              >
                <div style={{ flexShrink: 0, color: selected.has(item.id) ? 'var(--accent)' : 'var(--border)' }}>
                  {selected.has(item.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                </div>
                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt=""
                    style={{ width: '56px', height: '36px', objectFit: 'cover', borderRadius: '0.375rem', flexShrink: 0 }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0, marginLeft: '0.25rem' }}>
                  <div style={{
                    fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.title || item.url}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span className={`badge ${statusColor(item.status)}`}>{item.status}</span>
                    {item.ext && <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{item.ext.toUpperCase()}</span>}
                    {item.duration && <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{formatDuration(item.duration)}</span>}
                  </div>
                </div>
                <div style={{ width: '70px', textAlign: 'right', flexShrink: 0 }}>
                  <span className={`badge ${item.media_type === 'audio' ? 'badge-audio' : 'badge-video'}`}>
                    {item.media_type}
                  </span>
                </div>
                <div style={{ width: '90px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--muted)', flexShrink: 0 }}>
                  {formatFileSize(item.filesize)}
                </div>
                <div style={{ width: '90px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--muted)', flexShrink: 0 }}>
                  {formatDate(item.created_at)}
                </div>
                <div style={{ width: '60px', display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', flexShrink: 0 }}
                  onClick={e => e.stopPropagation()}>
                  {item.filename && item.status === 'completed' && (
                    <a
                      href={api.getFileUrl(item.filename)}
                      download
                      style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}
                      title="Download file"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
                    onClick={() => deleteMutation.mutate(item.id)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </button>
              <span style={{ padding: '0.625rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                {page} / {totalPages}
              </span>
              <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
