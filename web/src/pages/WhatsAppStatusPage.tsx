import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Smartphone,
  FolderOpen,
  Image as ImgIcon,
  Video,
  Download,
  Share2,
  RefreshCw,
  CheckSquare,
  Square,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  Search,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

type MediaKind = 'image' | 'video'

interface StatusItem {
  id: string
  name: string
  kind: MediaKind
  objectUrl: string   // revoked on unmount
  size: number
  lastModified: number
  file: File
}

// ─── IndexedDB handle persistence ───────────────────────────────────────────

const IDB_NAME = 'reelsaver-wa'
const IDB_STORE = 'handles'
const IDB_KEY = 'whatsapp-statuses-dir'

async function openIdb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

async function saveHandle(h: FileSystemDirectoryHandle) {
  const db = await openIdb()
  const tx = db.transaction(IDB_STORE, 'readwrite')
  tx.objectStore(IDB_STORE).put(h, IDB_KEY)
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIdb()
    return new Promise((res) => {
      const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => res(req.result ?? null)
      req.onerror = () => res(null)
    })
  } catch {
    return null
  }
}

// ─── Video thumbnail capture ─────────────────────────────────────────────────

function captureVideoThumbnail(url: string): Promise<string> {
  return new Promise((resolve) => {
    const vid = document.createElement('video')
    vid.muted = true
    vid.preload = 'metadata'
    vid.src = url
    vid.onloadeddata = () => {
      vid.currentTime = Math.min(0.3, vid.duration * 0.1 || 0.3)
    }
    vid.onseeked = () => {
      const c = document.createElement('canvas')
      c.width = 320
      c.height = 180
      c.getContext('2d')?.drawImage(vid, 0, 0, 320, 180)
      resolve(c.toDataURL('image/jpeg', 0.65))
    }
    vid.onerror = () => resolve('')
    setTimeout(() => resolve(''), 4000)
  })
}

// ─── File extensions ─────────────────────────────────────────────────────────

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const VID_EXTS = new Set(['.mp4', '.3gp', '.mov', '.mkv', '.avi', '.webm'])

function getKind(name: string): MediaKind | null {
  const ext = ('.' + name.split('.').pop()).toLowerCase()
  if (IMG_EXTS.has(ext)) return 'image'
  if (VID_EXTS.has(ext)) return 'video'
  return null
}

// ─── Format helpers ───────────────────────────────────────────────────────────

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

// ─── Unsupported browser guard ────────────────────────────────────────────────

const isSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

// ─── Component ───────────────────────────────────────────────────────────────

export function WhatsAppStatusPage() {
  const [items, setItems] = useState<StatusItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [dirName, setDirName] = useState('')

  const [tab, setTab] = useState<MediaKind>('image')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<number | null>(null) // index in filtered list

  const videoThumbsRef = useRef<Map<string, string>>(new Map())
  const [, forceRender] = useState(0) // bump to re-render after thumbs loaded
  const objUrlsRef = useRef<string[]>([])

  // Cleanup object URLs on unmount
  useEffect(() => () => {
    objUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
  }, [])

  // Try to restore saved handle on mount
  useEffect(() => {
    if (!isSupported) return
    loadHandle().then(async (h) => {
      if (!h) return
      try {
        const perm = await (h as any).queryPermission({ mode: 'read' })
        if (perm === 'granted') {
          setDirHandle(h)
          setDirName(h.name)
        }
      } catch { /* expired, ignore */ }
    })
  }, [])

  // Load files whenever dirHandle changes
  useEffect(() => {
    if (dirHandle) loadFiles(dirHandle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirHandle])

  const loadFiles = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setLoading(true)
    setLoadError('')
    setSelected(new Set())

    // Revoke old object URLs
    objUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
    objUrlsRef.current = []
    videoThumbsRef.current.clear()

    try {
      const newItems: StatusItem[] = []

      // Ensure read permission
      let perm = await (handle as any).queryPermission({ mode: 'read' })
      if (perm !== 'granted') {
        perm = await (handle as any).requestPermission({ mode: 'read' })
      }
      if (perm !== 'granted') {
        setLoadError('Read permission denied. Please try picking the folder again.')
        setLoading(false)
        return
      }

      for await (const entry of (handle as any).values()) {
        if (entry.kind !== 'file') continue
        const kind = getKind(entry.name)
        if (!kind) continue

        const file = await entry.getFile() as File
        const objectUrl = URL.createObjectURL(file)
        objUrlsRef.current.push(objectUrl)
        newItems.push({
          id: `${entry.name}-${file.lastModified}`,
          name: entry.name,
          kind,
          objectUrl,
          size: file.size,
          lastModified: file.lastModified,
          file,
        })
      }

      newItems.sort((a, b) => b.lastModified - a.lastModified)
      setItems(newItems)

      // Generate video thumbnails async
      newItems.filter(i => i.kind === 'video').forEach(async (it) => {
        const thumb = await captureVideoThumbnail(it.objectUrl)
        if (thumb) {
          videoThumbsRef.current.set(it.id, thumb)
          forceRender(n => n + 1)
        }
      })
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to read folder')
    } finally {
      setLoading(false)
    }
  }, [])

  const pickDirectory = useCallback(async () => {
    if (!isSupported) return
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'read', startIn: 'downloads' })
      await saveHandle(handle)
      setDirHandle(handle)
      setDirName(handle.name)
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setLoadError(e?.message || 'Could not open folder')
      }
    }
  }, [])

  const refresh = useCallback(() => {
    if (dirHandle) loadFiles(dirHandle)
  }, [dirHandle, loadFiles])

  // ── Selection helpers ───────────────────────────────────────────────────────

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectAll = (list: StatusItem[]) => setSelected(new Set(list.map(i => i.id)))
  const clearSel = () => setSelected(new Set())

  // ── Download helpers ────────────────────────────────────────────────────────

  function downloadItem(item: StatusItem) {
    const a = document.createElement('a')
    a.href = item.objectUrl
    a.download = item.name
    a.click()
  }

  async function downloadSelected(list: StatusItem[]) {
    const toSave = list.filter(i => selected.has(i.id))
    for (const item of toSave) {
      downloadItem(item)
      await new Promise(r => setTimeout(r, 150)) // slight delay between downloads
    }
  }

  async function shareItem(item: StatusItem) {
    if (!navigator.share) {
      downloadItem(item)
      return
    }
    try {
      await navigator.share({
        files: [new File([item.file], item.name, { type: item.file.type || 'application/octet-stream' })],
        title: 'WhatsApp Status',
      })
    } catch (e: any) {
      if (e?.name !== 'AbortError') downloadItem(item)
    }
  }

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = items.filter(i =>
    i.kind === tab && (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  )
  const images = items.filter(i => i.kind === 'image')
  const videos = items.filter(i => i.kind === 'video')

  // ── Lightbox navigation ─────────────────────────────────────────────────────

  const closeLightbox = () => setLightbox(null)
  const lbItem = lightbox !== null ? filtered[lightbox] : null

  const lbPrev = () => setLightbox(n => (n !== null ? (n - 1 + filtered.length) % filtered.length : null))
  const lbNext = () => setLightbox(n => (n !== null ? (n + 1) % filtered.length : null))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightbox === null) return
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') lbPrev()
      if (e.key === 'ArrowRight') lbNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, filtered.length])

  // ─── UI ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: '42px', height: '42px',
          background: 'rgba(37, 211, 102, 0.15)',
          border: '1px solid rgba(37, 211, 102, 0.3)',
          borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Smartphone size={20} color="#25d366" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
            WhatsApp Status Saver
          </h1>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: 'var(--muted)' }}>
            Browse, save & share statuses from your WhatsApp folder
          </p>
        </div>
        {dirHandle && (
          <button type="button" onClick={refresh} className="btn-secondary"
            style={{ marginLeft: 'auto', flexShrink: 0 }}
            title="Refresh">
            <RefreshCw size={15} /> Refresh
          </button>
        )}
      </div>

      {/* Browser not supported */}
      {!isSupported && <UnsupportedBanner />}

      {/* Setup guide shown when no folder is picked yet */}
      {isSupported && !dirHandle && <SetupGuide onPick={pickDirectory} />}

      {/* Error banner */}
      {loadError && (
        <div style={{
          display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: '10px', color: 'var(--error)', fontSize: '0.875rem',
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{loadError}</span>
          <button type="button" onClick={() => setLoadError('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Active folder + stats bar */}
      {isSupported && dirHandle && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          flexWrap: 'wrap',
          padding: '0.65rem 0.875rem',
          background: 'rgba(37,211,102,0.08)',
          border: '1px solid rgba(37,211,102,0.2)',
          borderRadius: '10px',
          marginBottom: '1.25rem',
          fontSize: '0.8125rem',
        }}>
          <FolderOpen size={15} color="#25d366" />
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{dirName}</span>
          <span style={{ color: 'var(--muted)' }}>
            {images.length} image{images.length !== 1 ? 's' : ''} · {videos.length} video{videos.length !== 1 ? 's' : ''}
          </span>
          <button type="button" onClick={pickDirectory}
            style={{
              marginLeft: 'auto',
              background: 'none', border: '1px solid rgba(37,211,102,0.35)',
              color: '#25d366', borderRadius: '8px', padding: '0.3rem 0.75rem',
              fontSize: '0.8125rem', cursor: 'pointer',
            }}>
            Change folder
          </button>
        </div>
      )}

      {/* Tabs + toolbar */}
      {dirHandle && items.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Tab label="Images" count={images.length} active={tab === 'image'} icon={<ImgIcon size={15} />} onClick={() => { setTab('image'); clearSel() }} />
            <Tab label="Videos" count={videos.length} active={tab === 'video'} icon={<Video size={15} />} onClick={() => { setTab('video'); clearSel() }} />

            {/* Search */}
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search files…"
                className="input-base"
                style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.8125rem', width: '180px' }}
              />
            </div>
          </div>

          {/* Bulk-select toolbar (shows when any selected) */}
          {selected.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.6rem 0.875rem', marginBottom: '0.875rem',
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: '10px', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-light)' }}>
                {selected.size} selected
              </span>
              <button type="button" className="btn-secondary"
                style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
                onClick={() => downloadSelected(filtered)}>
                <Download size={13} /> Save all
              </button>
              <button type="button" onClick={clearSel}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.75rem', padding: '3rem 1rem', color: 'var(--muted)',
        }}>
          <RefreshCw size={28} className="spinner" color="#25d366" />
          <span>Scanning folder…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && dirHandle && filtered.length === 0 && items.length > 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted)' }}>
          <ImgIcon size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <p style={{ margin: 0 }}>
            {search ? `No ${tab}s matching "${search}"` : `No ${tab}s found in this folder.`}
          </p>
        </div>
      )}

      {!loading && dirHandle && items.length === 0 && !loadError && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted)' }}>
          <FolderOpen size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--text)' }}>
            Folder is empty or no statuses found
          </p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
            Make sure you selected the <strong>.Statuses</strong> folder inside WhatsApp.
          </p>
          <button type="button" className="btn-secondary" onClick={pickDirectory}>
            <FolderOpen size={15} /> Pick a different folder
          </button>
        </div>
      )}

      {/* Media grid */}
      {!loading && filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '0.75rem',
        }}>
          {filtered.map((item, idx) => (
            <MediaCard
              key={item.id}
              item={item}
              thumb={item.kind === 'video' ? videoThumbsRef.current.get(item.id) : undefined}
              selected={selected.has(item.id)}
              onSelect={() => toggleSelect(item.id)}
              onOpen={() => setLightbox(idx)}
              onDownload={() => downloadItem(item)}
              onShare={() => shareItem(item)}
            />
          ))}
        </div>
      )}

      {/* Select-all row */}
      {!loading && filtered.length > 1 && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary"
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
            onClick={() => selected.size === filtered.length ? clearSel() : selectAll(filtered)}>
            <CheckSquare size={13} />
            {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lbItem && lightbox !== null && (
        <Lightbox
          item={lbItem}
          index={lightbox}
          total={filtered.length}
          onClose={closeLightbox}
          onPrev={lbPrev}
          onNext={lbNext}
          onDownload={() => downloadItem(lbItem)}
          onShare={() => shareItem(lbItem)}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Tab({ label, count, active, icon, onClick }: {
  label: string; count: number; active: boolean; icon: React.ReactNode; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.5rem 1.1rem',
      background: active ? 'rgba(37,211,102,0.15)' : 'var(--surface)',
      border: `1px solid ${active ? 'rgba(37,211,102,0.5)' : 'var(--border)'}`,
      borderRadius: '10px',
      color: active ? '#25d366' : 'var(--muted)',
      fontWeight: active ? 700 : 500,
      fontSize: '0.875rem',
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}>
      {icon}
      {label}
      <span style={{
        minWidth: '20px', height: '20px',
        background: active ? 'rgba(37,211,102,0.25)' : 'var(--surface2)',
        borderRadius: '999px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.7rem', fontWeight: 700,
        color: active ? '#25d366' : 'var(--muted)',
        padding: '0 4px',
      }}>
        {count}
      </span>
    </button>
  )
}

function MediaCard({ item, thumb, selected, onSelect, onOpen, onDownload, onShare }: {
  item: StatusItem
  thumb?: string
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onDownload: () => void
  onShare: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        border: selected
          ? '2px solid #25d366'
          : hovered ? '2px solid var(--border)' : '2px solid transparent',
        background: 'var(--surface)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.1s',
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        aspectRatio: item.kind === 'video' ? '16/9' : '1/1',
      }}
    >
      {/* Media preview */}
      {item.kind === 'image' ? (
        <img
          src={item.objectUrl}
          alt={item.name}
          loading="lazy"
          onClick={onOpen}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div onClick={onOpen} style={{ width: '100%', height: '100%', position: 'relative', background: '#111' }}>
          {thumb ? (
            <img src={thumb} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Video size={28} color="var(--muted)" />
            </div>
          )}
          <div style={{
            position: 'absolute', bottom: '0.4rem', left: '0.4rem',
            background: 'rgba(0,0,0,0.7)', borderRadius: '5px',
            padding: '2px 5px', fontSize: '0.6875rem', color: 'white',
            display: 'flex', alignItems: 'center', gap: '3px',
          }}>
            <Video size={10} /> {fmtSize(item.size)}
          </div>
        </div>
      )}

      {/* Overlay on hover / selected */}
      {(hovered || selected) && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '0.5rem',
          gap: '0.3rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button"
              onClick={e => { e.stopPropagation(); onSelect() }}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
              {selected ? <CheckSquare size={18} color="#25d366" /> : <Square size={18} />}
            </button>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <IconBtn title="Save" onClick={e => { e.stopPropagation(); onDownload() }}>
                <Download size={14} />
              </IconBtn>
              {!!navigator.share && (
                <IconBtn title="Share" onClick={e => { e.stopPropagation(); onShare() }}>
                  <Share2 size={14} />
                </IconBtn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, onClick, title }: {
  children: React.ReactNode; onClick: React.MouseEventHandler; title: string
}) {
  return (
    <button type="button" title={title} onClick={onClick} style={{
      width: '28px', height: '28px',
      background: 'rgba(255,255,255,0.18)',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '7px',
      color: 'white',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 0,
    }}>
      {children}
    </button>
  )
}

function Lightbox({ item, index, total, onClose, onPrev, onNext, onDownload, onShare }: {
  item: StatusItem
  index: number
  total: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onDownload: () => void
  onShare: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      {/* Close */}
      <button type="button" onClick={onClose}
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'rgba(255,255,255,0.15)', border: 'none',
          width: '40px', height: '40px', borderRadius: '50%',
          color: 'white', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}>
        <X size={20} />
      </button>

      {/* Counter */}
      <div style={{
        position: 'absolute', top: '1.1rem', left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem',
      }}>
        {index + 1} / {total}
      </div>

      {/* Prev */}
      {total > 1 && (
        <button type="button"
          onClick={e => { e.stopPropagation(); onPrev() }}
          style={{
            position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.15)', border: 'none',
            width: '44px', height: '44px', borderRadius: '50%',
            color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}>
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Media */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 'min(720px, 92vw)',
          maxHeight: '82vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '0.75rem',
        }}
      >
        {item.kind === 'image' ? (
          <img
            src={item.objectUrl}
            alt={item.name}
            style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: '10px' }}
          />
        ) : (
          <video
            src={item.objectUrl}
            controls
            autoPlay
            style={{ maxWidth: '100%', maxHeight: '72vh', borderRadius: '10px' }}
          />
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.5rem 1rem',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '10px', width: '100%', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: 'white', fontSize: '0.8125rem', fontWeight: 600, wordBreak: 'break-all' }}>{item.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{fmtSize(item.size)} · {fmtDate(item.lastModified)}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button type="button" className="btn-secondary"
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }}
              onClick={onDownload}>
              <Download size={14} /> Save
            </button>
            {!!navigator.share && (
              <button type="button" className="btn-secondary"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }}
                onClick={onShare}>
                <Share2 size={14} /> Share
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Next */}
      {total > 1 && (
        <button type="button"
          onClick={e => { e.stopPropagation(); onNext() }}
          style={{
            position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.15)', border: 'none',
            width: '44px', height: '44px', borderRadius: '50%',
            color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}>
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  )
}

function SetupGuide({ onPick }: { onPick: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
        <Info size={18} color="#25d366" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.3rem' }}>
            How to access WhatsApp statuses
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Click the button below then navigate to the WhatsApp Statuses folder on your device.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <button type="button" className="btn-primary"
          style={{ background: 'linear-gradient(135deg, #128c7e, #25d366)' }}
          onClick={onPick}>
          <FolderOpen size={16} /> Open WhatsApp Statuses Folder
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(o => !o)}>
          {open ? 'Hide' : 'Show'} folder path guide
        </button>
      </div>

      {open && (
        <div style={{
          background: 'var(--surface2)', borderRadius: '10px',
          padding: '1rem', fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.75,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>📱 Android (Chrome / Edge)</div>
          <ol style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
            <li>Tap <b>"Open WhatsApp Statuses Folder"</b> above</li>
            <li>In the file picker, navigate to <code style={{ background: 'var(--border)', borderRadius: '4px', padding: '1px 4px' }}>Android → media → com.whatsapp → WhatsApp → Media → .Statuses</code></li>
            <li>Tap <b>Allow</b> when prompted for read access</li>
            <li>Your statuses will appear automatically</li>
          </ol>

          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>💡 Note for older Android</div>
          <p style={{ margin: '0 0 0.75rem' }}>On Android 9 or below: navigate to <code style={{ background: 'var(--border)', borderRadius: '4px', padding: '1px 4px' }}>WhatsApp → Media → .Statuses</code> (no <code>Android/media/</code> prefix).</p>

          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>🖥️ Desktop (Chrome / Edge)</div>
          <p style={{ margin: 0 }}>
            If you have WhatsApp Desktop or a mirrored device, pick the <code style={{ background: 'var(--border)', borderRadius: '4px', padding: '1px 4px' }}>.Statuses</code> folder
            wherever it lives on your computer. On Windows it is often under{' '}
            <code style={{ background: 'var(--border)', borderRadius: '4px', padding: '1px 4px' }}>%APPDATA%\WhatsApp\Media\.Statuses</code>.
          </p>
        </div>
      )}
    </div>
  )
}

function UnsupportedBanner() {
  return (
    <div style={{
      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
      padding: '1rem 1.25rem', marginBottom: '1.5rem',
      background: 'rgba(251,191,36,0.1)',
      border: '1px solid rgba(251,191,36,0.35)',
      borderRadius: '12px',
    }}>
      <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: '1px' }} />
      <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
          Browser not supported
        </div>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          The WhatsApp Status Saver requires the <strong>File System Access API</strong>.
          Please open this page in <strong>Chrome</strong> or <strong>Edge</strong> (v86+) on Android or desktop.
          Safari and Firefox do not support this API.
        </p>
      </div>
    </div>
  )
}
