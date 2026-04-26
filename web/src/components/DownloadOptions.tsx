import type { VideoInfo } from '../api/client'

interface Props {
  info: VideoInfo | null
  mediaType: string
  setMediaType: (v: string) => void
  quality: string
  setQuality: (v: string) => void
  audioFormat: string
  setAudioFormat: (v: string) => void
  videoFormat: string
  setVideoFormat: (v: string) => void
  selectedFormatId: string
  setSelectedFormatId: (v: string) => void
  embedThumbnail: boolean
  setEmbedThumbnail: (v: boolean) => void
  embedSubtitle: boolean
  setEmbedSubtitle: (v: boolean) => void
  embedMetadata: boolean
  setEmbedMetadata: (v: boolean) => void
  sponsorBlock: boolean
  setSponsorBlock: (v: boolean) => void
  formatMode: 'preset' | 'custom'
  setFormatMode: (v: 'preset' | 'custom') => void
}

const videoQualities = [
  { value: 'best', label: 'Best Quality' },
  { value: '4k', label: '4K (2160p)' },
  { value: '1440p', label: '1440p' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' },
]

const audioQualities = [
  { value: 'best', label: 'Best Quality' },
  { value: '320k', label: '320 kbps' },
  { value: '256k', label: '256 kbps' },
  { value: '192k', label: '192 kbps' },
  { value: '128k', label: '128 kbps' },
]

const audioFormats = ['mp3', 'm4a', 'opus', 'flac', 'wav', 'ogg']
const videoFormats = ['mp4', 'mkv', 'webm']

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.625rem 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{label}</span>
      {children}
    </div>
  )
}

export function DownloadOptions({
  info, mediaType, setMediaType, quality, setQuality,
  audioFormat, setAudioFormat, videoFormat, setVideoFormat,
  selectedFormatId, setSelectedFormatId,
  embedThumbnail, setEmbedThumbnail,
  embedSubtitle, setEmbedSubtitle,
  embedMetadata, setEmbedMetadata,
  sponsorBlock, setSponsorBlock,
  formatMode, setFormatMode,
}: Props) {
  return (
    <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          className={`chip ${mediaType === 'video' ? 'selected' : ''}`}
          onClick={() => setMediaType('video')}
        >
          Video
        </button>
        <button
          className={`chip ${mediaType === 'audio' ? 'selected' : ''}`}
          onClick={() => setMediaType('audio')}
        >
          Audio only
        </button>
      </div>

      {/* Format mode toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button
          className={`chip ${formatMode === 'preset' ? 'selected' : ''}`}
          onClick={() => setFormatMode('preset')}
        >
          Preset
        </button>
        {info && info.formats.length > 0 && (
          <button
            className={`chip ${formatMode === 'custom' ? 'selected' : ''}`}
            onClick={() => setFormatMode('custom')}
          >
            Choose format
          </button>
        )}
      </div>

      {formatMode === 'preset' ? (
        <>
          <SettingRow label={mediaType === 'audio' ? 'Audio quality' : 'Video quality'}>
            <select
              className="select-base"
              value={quality}
              onChange={e => setQuality(e.target.value)}
            >
              {(mediaType === 'audio' ? audioQualities : videoQualities).map(q => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </SettingRow>

          {mediaType === 'audio' ? (
            <SettingRow label="Audio format">
              <select className="select-base" value={audioFormat} onChange={e => setAudioFormat(e.target.value)}>
                {audioFormats.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </SettingRow>
          ) : (
            <SettingRow label="Video container">
              <select className="select-base" value={videoFormat} onChange={e => setVideoFormat(e.target.value)}>
                {videoFormats.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </SettingRow>
          )}
        </>
      ) : (
        info && info.formats.length > 0 && (
          <div style={{ marginTop: '0.25rem' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
              Select a specific format:
            </div>
            <div style={{
              maxHeight: '200px', overflowY: 'auto',
              border: '1px solid var(--border)', borderRadius: '0.5rem',
            }}>
              {info.formats.map(f => (
                <div
                  key={f.format_id}
                  onClick={() => setSelectedFormatId(f.format_id)}
                  style={{
                    padding: '0.5rem 0.875rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: selectedFormatId === f.format_id ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                    transition: 'background 0.15s',
                    display: 'flex', gap: '0.75rem', alignItems: 'center',
                  }}
                >
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600, minWidth: '60px',
                    color: selectedFormatId === f.format_id ? 'var(--accent-light)' : 'var(--text)',
                  }}>
                    {f.format_id}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                    {[
                      f.resolution || f.format_note,
                      f.ext?.toUpperCase(),
                      f.vcodec && f.vcodec !== 'none' ? `v:${f.vcodec.split('.')[0]}` : '',
                      f.acodec && f.acodec !== 'none' ? `a:${f.acodec}` : '',
                      f.filesize ? `${(f.filesize / 1024 / 1024).toFixed(1)}MB` : '',
                    ].filter(Boolean).join(' • ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      <div style={{ marginTop: '0.5rem' }}>
        <SettingRow label="Embed thumbnail">
          <Toggle checked={embedThumbnail} onChange={setEmbedThumbnail} />
        </SettingRow>
        <SettingRow label="Embed metadata">
          <Toggle checked={embedMetadata} onChange={setEmbedMetadata} />
        </SettingRow>
        {mediaType === 'video' && (
          <SettingRow label="Embed subtitles">
            <Toggle checked={embedSubtitle} onChange={setEmbedSubtitle} />
          </SettingRow>
        )}
        <SettingRow label="SponsorBlock (skip sponsors)">
          <Toggle checked={sponsorBlock} onChange={setSponsorBlock} />
        </SettingRow>
      </div>
    </div>
  )
}
