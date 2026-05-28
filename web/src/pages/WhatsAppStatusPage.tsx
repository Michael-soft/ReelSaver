import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Smartphone, FolderOpen, Image as ImgIcon, Video, Download,
  Share2, RefreshCw, CheckSquare, Square, X, ChevronLeft,
  ChevronRight, Info, Search,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaKind = 'image' | 'video'

interface StatusItem {
  id: string
  name: string
  kind: MediaKind
  objectUrl: string
  size: number
  lastModified: number
  file: File
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const VID_EXTS = new Set(['.mp4', '.3gp', '.mov', '.mkv', '.avi', '.webm'])

function getKind(name: string): MediaKind | null {
  const ext = ('.' + name.split('.').pop()).toLowerCase()
  if (IMG_EXTS.has(ext)) return 'image'
  if (VID_EXTS.has(ext)) return 'video'
  return null
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function captureVideoThumbnail(url: string): Promise<string> {
  return new Promise((resolve) => {
    const vid = document.createElement('video')
    vid.muted = true
    vid.preload = 'metadata'
    vid.crossOrigin = 'anonymous'
    vid.src = url
    vid.onloadeddata = () => {
      vid.currentTime = Math.min(0.3, (vid.duration || 1) * 0.1)
    }
    vid.onseeked = () => {
      try {
        const c = document.createElement('canvas')
        c.width = 320; c.height = 180
        c.getContext('2d')?.drawImage(vid, 0, 0, 320, 180)
        resolve(c.toDataURL('image/jpeg', 0.65))
      } catch { resolve('') }
    }
    vid.onerror = () => resolve('')
    setTimeout(() => resolve(''), 5000)
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WhatsAppStatusPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [items, setItems]           = useState<StatusItem[]>([])
  const [loading, setLoading]       = useState(false)
  const [folderName, setFolderName] = useState('')
  const [tab, setTab]               = useState<MediaKind>('image')
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [lightbox, setLightbox]     = useState<number | null>(null)

  const videoThumbsRef = useRef<Map<string, string>>(new Map())
  const [, forceRender] = useState(0)
  const objUrlsRef = useRef<string[]>([])

  // Revoke object URLs on unmount
  useEffect(() => () => {
    objUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
  }, [])

  // ── Handle file input change ─────────────────────────────────────────────

  const handleFiles = useCallback((fileList: FileList) => {
    setLoading(true)
    setSelected(new Set())

    // Revoke old object URLs
    objUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
    objUrlsRef.current = []
    videoThumbsRef.current.clear()

    const newItems: StatusItem[] = []
    const files = Array.from(fileList)

    // Detect folder name from webkitRelativePath
    const firstPath = files[0]?.webkitRelativePath || ''
    setFolderName(firstPath.split('/')[0] || 'Selected folder')

    for (const file of files) {
      const kind = getKind(file.name)
      if (!kind) continue
      const objectUrl = URL.createObjectURL(file)
      objUrlsRef.current.push(objectUrl)
      newItems.push({
        id: `${file.name}-${file.lastModified}`,
        name: file.name,
        kind,
        objectUrl,
        size: file.size,
        lastModified: file.lastModified || Date.now(),
        file,
      })
    }

    newItems.sort((a, b) => b.lastModified - a.lastModified)
    setItems(newItems)
    setLoading(false)

    // Generate video thumbnails async
    newItems.filter(i => i.kind === 'video').forEach(async (it) => {
      const thumb = await captureVideoThumbnail(it.objectUrl)
      if (thumb) {
        videoThumbsRef.current.set(it.id, thumb)
        forceRender(n => n + 1)
      }
    })
  }, [])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files
    if (fl && fl.length > 0) handleFiles(fl)
    // Reset input so the same folder can be re-picked
    e.target.value = ''
  }, [handleFiles])

  const pickFolder = () => fileInputRef.current?.click()

  // ── Selection ────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectAll  = (list: StatusItem[]) => setSelected(new Set(list.map(i => i.id)))
  const clearSel   = () => setSelected(new Set())

  // ── Save / Share ─────────────────────────────────────────────────────────

  function downloadItem(item: StatusItem) {
    const a = document.createElement('a')
    a.href = item.objectUrl
    a.download = item.name
    a.click()
  }

  async function downloadSelected(list: StatusItem[]) {
    for (const item of list.filter(i => selected.has(i.id))) {
      downloadItem(item)
      await new Promise(r => setTimeout(r, 150))
    }
  }

  async function shareItem(item: StatusItem) {
    if (!navigator.share) { downloadItem(item); return }
    try {
      await navigator.share({
        files: [new File([item.file], item.name, { type: item.file.type || 'application/octet-stream' })],
        title: 'WhatsApp Status',
      })
    } catch (e: any) {
      if (e?.name !== 'AbortError') downloadItem(item)
    }
  }

  // ── Filtered lists ───────────────────────────────────────────────────────

  const filtered = items.filter(i =>
    i.kind === tab && (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  )
  const images = items.filter(i => i.kind === 'image')
  const videos = items.filter(i => i.kind === 'video')

  // ── Lightbox ─────────────────────────────────────────────────────────────

  const lbItem = lightbox !== null ? filtered[lightbox] : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightbox === null) return
      if (e.key === 'Escape')      setLightbox(null)
      if (e.key === 'ArrowLeft')   setLightbox(n => n !== null ? (n - 1 + filtered.length) % filtered.length : null)
      if (e.key === 'ArrowRight')  setLightbox(n => n !== null ? (n + 1) % filtered.length : null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, filtered.length])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* Hidden folder input — works everywhere, including iframes */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-ignore — webkitdirectory is non-standard but universally supported
        webkitdirectory=""
        multiple
        accept="image/*,video/*,.3gp"
        style={{ display: 'none' }}
        onChange={onInputChange}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{
          width: '42px', height: '42px', flexShrink: 0,
          background: 'rgba(37,211,102,0.14)', border: '1px solid rgba(37,211,102,0.3)',
          borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Smartphone size={20} color="#25d366" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
            WhatsApp Status Saver
          </h1>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: 'var(--muted)' }}>
            Open your WhatsApp .Statuses folder to browse, save and share
          </p>
        </div>
        {items.length > 0 && (
          <button type="button" onClick={pickFolder} className="btn-secondary" style={{ flexShrink: 0 }}>
            <RefreshCw size={15} /> Change folder
          </button>
        )}
      </div>

      {/* First-time setup */}
      {items.length === 0 && !loading && <SetupCard onPick={pickFolder} />}

      {/* Active folder banner */}
      {folderName && items.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          padding: '0.65rem 1rem', marginBottom: '1.25rem',
          background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.22)',
          borderRadius: '10px', fontSize: '0.8125rem',
        }}>
          <FolderOpen size={15} color="#25d366" />
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{folderName}</span>
          <span style={{ color: 'var(--muted)' }}>
            {images.length} image{images.length !== 1 ? 's' : ''} · {videos.length} video{videos.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '3rem 1rem', color: 'var(--muted)' }}>
          <RefreshCw size={28} className="spinner" color="#25d366" />
          <span>Loading statuses…</span>
        </div>
      )}

      {/* Tabs + toolbar */}
      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <WaTab label="Images" count={images.length} active={tab === 'image'} icon={<ImgIcon size={14} />} onClick={() => { setTab('image'); clearSel() }} />
          <WaTab label="Videos" count={videos.length} active={tab === 'video'} icon={<Video size={14} />}   onClick={() => { setTab('video'); clearSel() }} />
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…" className="input-base"
              style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.8125rem', width: '160px' }}
            />
          </div>
        </div>
      )}

      {/* Bulk-action bar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          padding: '0.6rem 0.875rem', marginBottom: '0.875rem',
          background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: '10px',
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#25d366' }}>{selected.size} selected</span>
          <button type="button" className="btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }} onClick={() => downloadSelected(filtered)}>
            <Download size={13} /> Save all
          </button>
          <button type="button" onClick={clearSel} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length > 0 && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted)' }}>
          <ImgIcon size={32} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
          <p style={{ margin: 0 }}>{search ? `No ${tab}s matching "${search}"` : `No ${tab}s in this folder`}</p>
        </div>
      )}

      {/* Media grid */}
      {!loading && filtered.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '0.625rem',
          }}>
            {filtered.map((item, idx) => (
              <MediaCard
                key={item.id}
                item={item}
                thumb={videoThumbsRef.current.get(item.id)}
                selected={selected.has(item.id)}
                onSelect={() => toggleSelect(item.id)}
                onOpen={() => setLightbox(idx)}
                onDownload={() => downloadItem(item)}
                onShare={() => shareItem(item)}
              />
            ))}
          </div>

          {/* Select-all row */}
          {filtered.length > 1 && (
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary"
                style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
                onClick={() => selected.size === filtered.length ? clearSel() : selectAll(filtered)}>
                <CheckSquare size={13} />
                {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lbItem && lightbox !== null && (
        <Lightbox
          item={lbItem} index={lightbox} total={filtered.length}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(n => n !== null ? (n - 1 + filtered.length) % filtered.length : null)}
          onNext={() => setLightbox(n => n !== null ? (n + 1) % filtered.length : null)}
          onDownload={() => downloadItem(lbItem)}
          onShare={() => shareItem(lbItem)}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WaTab({ label, count, active, icon, onClick }: {
  label: string; count: number; active: boolean; icon: React.ReactNode; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.5rem 1rem',
      background: active ? 'rgba(37,211,102,0.14)' : 'var(--surface)',
      border: `1px solid ${active ? 'rgba(37,211,102,0.45)' : 'var(--border)'}`,
      borderRadius: '10px', cursor: 'pointer',
      color: active ? '#25d366' : 'var(--muted)',
      fontWeight: active ? 700 : 500, fontSize: '0.875rem',
      transition: 'all 0.15s',
    }}>
      {icon} {label}
      <span style={{
        minWidth: '20px', height: '20px', padding: '0 4px',
        background: active ? 'rgba(37,211,102,0.22)' : 'var(--surface2)',
        borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.7rem', fontWeight: 700, color: active ? '#25d366' : 'var(--muted)',
      }}>{count}</span>
    </button>
  )
}

function MediaCard({ item, thumb, selected, onSelect, onOpen, onDownload, onShare }: {
  item: StatusItem; thumb?: string; selected: boolean
  onSelect: () => void; onOpen: () => void; onDownload: () => void; onShare: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const show = hovered || selected

  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', borderRadius: '12px', overflow: 'hidden',
        border: `2px solid ${selected ? '#25d366' : hovered ? 'var(--border)' : 'transparent'}`,
        background: 'var(--surface)', cursor: 'pointer',
        aspectRatio: item.kind === 'video' ? '16/9' : '1/1',
        transition: 'border-color 0.15s, transform 0.1s',
        transform: hovered ? 'scale(1.025)' : 'scale(1)',
      }}
    >
      {item.kind === 'image' ? (
        <img src={item.objectUrl} alt={item.name} loading="lazy" onClick={onOpen}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div onClick={onOpen} style={{ width: '100%', height: '100%', background: '#111', position: 'relative' }}>
          {thumb
            ? <img src={thumb} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video size={28} color="var(--muted)" />
              </div>
          }
          <div style={{
            position: 'absolute', bottom: '0.35rem', left: '0.4rem',
            background: 'rgba(0,0,0,0.65)', borderRadius: '4px', padding: '1px 5px',
            fontSize: '0.65rem', color: 'white', display: 'flex', alignItems: 'center', gap: '3px',
          }}>
            <Video size={9} /> {fmtSize(item.size)}
          </div>
        </div>
      )}

      {show && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 52%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '0.4rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" onClick={e => { e.stopPropagation(); onSelect() }}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
              {selected ? <CheckSquare size={17} color="#25d366" /> : <Square size={17} />}
            </button>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <GlassBtn title="Save" onClick={e => { e.stopPropagation(); onDownload() }}><Download size={13} /></GlassBtn>
              {!!navigator.share && <GlassBtn title="Share" onClick={e => { e.stopPropagation(); onShare() }}><Share2 size={13} /></GlassBtn>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GlassBtn({ children, onClick, title }: {
  children: React.ReactNode; onClick: React.MouseEventHandler; title: string
}) {
  return (
    <button type="button" title={title} onClick={onClick} style={{
      width: '27px', height: '27px',
      background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255,255,255,0.2)', borderRadius: '7px',
      color: 'white', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    }}>{children}</button>
  )
}

function Lightbox({ item, index, total, onClose, onPrev, onNext, onDownload, onShare }: {
  item: StatusItem; index: number; total: number
  onClose: () => void; onPrev: () => void; onNext: () => void
  onDownload: () => void; onShare: () => void
}) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
    }}>
      <button type="button" onClick={onClose} style={{
        position: 'absolute', top: '1rem', right: '1rem',
        background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: '50%',
        width: '40px', height: '40px', color: 'white', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
      }}><X size={20} /></button>

      <div style={{
        position: 'absolute', top: '1.1rem', left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem',
      }}>{index + 1} / {total}</div>

      {total > 1 && <>
        <NavBtn side="left" onClick={e => { e.stopPropagation(); onPrev() }}><ChevronLeft size={22} /></NavBtn>
        <NavBtn side="right" onClick={e => { e.stopPropagation(); onNext() }}><ChevronRight size={22} /></NavBtn>
      </>}

      <div onClick={e => e.stopPropagation()} style={{
        maxWidth: 'min(720px, 92vw)', maxHeight: '82vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
      }}>
        {item.kind === 'image'
          ? <img src={item.objectUrl} alt={item.name} style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: '10px' }} />
          : <video src={item.objectUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '72vh', borderRadius: '10px' }} />
        }
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.08)',
          borderRadius: '10px', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600, wordBreak: 'break-all' }}>{item.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>{fmtSize(item.size)} · {fmtDate(item.lastModified)}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }} onClick={onDownload}>
              <Download size={13} /> Save
            </button>
            {!!navigator.share && (
              <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }} onClick={onShare}>
                <Share2 size={13} /> Share
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function NavBtn({ side, children, onClick }: { side: 'left' | 'right'; children: React.ReactNode; onClick: React.MouseEventHandler }) {
  return (
    <button type="button" onClick={onClick} style={{
      position: 'absolute', [side]: '0.75rem', top: '50%', transform: 'translateY(-50%)',
      background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: '50%',
      width: '44px', height: '44px', color: 'white', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
    }}>{children}</button>
  )
}

function SetupCard({ onPick }: { onPick: () => void }) {
  const [showGuide, setShowGuide] = useState(false)

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Info size={18} color="#25d366" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.3rem' }}>Select your WhatsApp Statuses folder</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Click below, navigate to the WhatsApp <code style={{ background: 'var(--border)', borderRadius: '4px', padding: '1px 5px' }}>.Statuses</code> folder, and select it. Your statuses will appear here to save or share.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button type="button" onClick={onPick}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1.5rem', fontSize: '0.9375rem', fontWeight: 600,
            background: 'linear-gradient(135deg, #128c7e, #25d366)',
            color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer',
          }}>
          <FolderOpen size={17} /> Open WhatsApp Statuses Folder
        </button>
        <button type="button" className="btn-secondary" onClick={() => setShowGuide(g => !g)}>
          {showGuide ? 'Hide' : 'Where is this folder?'}
        </button>
      </div>

      {showGuide && (
        <div style={{
          background: 'var(--surface2)', borderRadius: '10px',
          padding: '1rem 1.1rem', fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.8,
        }}>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 600, color: 'var(--text)' }}>📱 Android (Chrome or Samsung Internet)</p>
          <ol style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
            <li>Tap <strong>Open WhatsApp Statuses Folder</strong></li>
            <li>In the picker, browse to:<br />
              <code style={{ background: 'var(--border)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.8rem' }}>
                Android / media / com.whatsapp / WhatsApp / Media / .Statuses
              </code>
            </li>
            <li>Tap <strong>Upload</strong> or <strong>Select</strong></li>
          </ol>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--text)' }}>📱 Older Android (pre-Android 11)</p>
          <p style={{ margin: '0 0 0.75rem' }}>
            Path is: <code style={{ background: 'var(--border)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.8rem' }}>WhatsApp / Media / .Statuses</code>
          </p>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--text)' }}>💡 Tip</p>
          <p style={{ margin: 0 }}>Hidden folders (starting with <code>.</code>) may not appear. In your file manager, enable <strong>Show hidden files</strong> first.</p>
        </div>
      )}
    </div>
  )
}
