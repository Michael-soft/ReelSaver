import { useState, useEffect, useRef } from 'react'
import { Save, CheckCircle, Loader2, Upload, RefreshCw, Info } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Settings } from '../api/client'
import { api } from '../api/client'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '1.75rem 0 0.75rem' }}>
      {children}
    </h2>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem',
      padding: '0.875rem 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        {description && <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '2px' }}>{description}</div>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle" style={{ flexShrink: 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )
}

export function SettingsPage() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<Settings>({
    proxy: '',
    rateLimit: '',
    concurrentDownloads: '3',
    cookieFile: '',
    sponsorBlock: 'false',
    embedThumbnail: 'true',
    embedMetadata: 'true',
    defaultMediaType: 'video',
    defaultQuality: 'best',
    defaultAudioFormat: 'mp3',
  })

  // Cookie upload state
  const cookieInputRef = useRef<HTMLInputElement>(null)
  const [cookieUploading, setCookieUploading] = useState(false)
  const [cookieStatus, setCookieStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  // yt-dlp update state
  const [updating, setUpdating] = useState(false)
  const [updateResult, setUpdateResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  })

  const { data: ytdlpVersion } = useQuery({
    queryKey: ['ytdlp-version'],
    queryFn: api.getYtdlpVersion,
    staleTime: 60000,
  })

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: () => api.saveSettings(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const set = (key: keyof Settings, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const toggle = (key: keyof Settings) =>
    set(key, form[key] === 'true' ? 'false' : 'true')

  async function handleCookieUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCookieUploading(true)
    setCookieStatus(null)
    try {
      await api.uploadCookieFile(file)
      setCookieStatus({ ok: true, msg: 'cookies.txt uploaded and saved.' })
      qc.invalidateQueries({ queryKey: ['settings'] })
    } catch (err) {
      setCookieStatus({ ok: false, msg: (err as Error).message })
    } finally {
      setCookieUploading(false)
      if (cookieInputRef.current) cookieInputRef.current.value = ''
    }
  }

  async function handleUpdateYtdlp() {
    setUpdating(true)
    setUpdateResult(null)
    try {
      const res = await api.updateYtdlp()
      if (res.success) {
        setUpdateResult({ ok: true, msg: `Updated to v${res.version}` })
        qc.invalidateQueries({ queryKey: ['ytdlp-version'] })
      } else {
        setUpdateResult({ ok: false, msg: res.error || 'Update failed' })
      }
    } catch (err) {
      setUpdateResult({ ok: false, msg: (err as Error).message })
    } finally {
      setUpdating(false)
    }
  }

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Loading…</div>
  }

  return (
    <div style={{ maxWidth: '620px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text)' }}>Settings</h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9375rem' }}>Configure download preferences</p>
        </div>
        <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 size={15} className="spinner" />
          ) : saved ? (
            <CheckCircle size={15} />
          ) : (
            <Save size={15} />
          )}
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      <SectionTitle>Defaults</SectionTitle>
      <div className="card">
        <SettingRow label="Default media type">
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {['video', 'audio'].map(t => (
              <button
                key={t}
                className={`chip ${form.defaultMediaType === t ? 'selected' : ''}`}
                onClick={() => set('defaultMediaType', t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Default quality">
          <select className="select-base" value={form.defaultQuality} onChange={e => set('defaultQuality', e.target.value)}>
            <option value="best">Best</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
            <option value="360p">360p</option>
          </select>
        </SettingRow>
        <SettingRow label="Default audio format">
          <select className="select-base" value={form.defaultAudioFormat} onChange={e => set('defaultAudioFormat', e.target.value)}>
            {['mp3', 'm4a', 'opus', 'flac', 'wav', 'ogg'].map(f => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
        </SettingRow>
      </div>

      <SectionTitle>Post-processing</SectionTitle>
      <div className="card">
        <SettingRow label="Embed thumbnail" description="Add video thumbnail as cover art">
          <Toggle checked={form.embedThumbnail === 'true'} onChange={() => toggle('embedThumbnail')} />
        </SettingRow>
        <SettingRow label="Embed metadata" description="Write title, artist, and other tags">
          <Toggle checked={form.embedMetadata === 'true'} onChange={() => toggle('embedMetadata')} />
        </SettingRow>
        <SettingRow label="SponsorBlock" description="Automatically remove sponsor segments from YouTube videos">
          <Toggle checked={form.sponsorBlock === 'true'} onChange={() => toggle('sponsorBlock')} />
        </SettingRow>
      </div>

      <SectionTitle>Network</SectionTitle>
      <div className="card">
        <SettingRow label="Proxy" description="HTTP, HTTPS, or SOCKS5 proxy URL">
          <input
            className="input-base"
            style={{ width: '220px' }}
            placeholder="http://proxy:port"
            value={form.proxy}
            onChange={e => set('proxy', e.target.value)}
          />
        </SettingRow>
        <SettingRow label="Rate limit" description="Maximum download speed (e.g. 2M, 500K)">
          <input
            className="input-base"
            style={{ width: '140px' }}
            placeholder="e.g. 2M"
            value={form.rateLimit}
            onChange={e => set('rateLimit', e.target.value)}
          />
        </SettingRow>
        <SettingRow label="Concurrent downloads" description="Maximum parallel downloads">
          <select className="select-base" value={form.concurrentDownloads} onChange={e => set('concurrentDownloads', e.target.value)}>
            {['1', '2', '3', '5', '10'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </SettingRow>

        {/* Cookie file upload */}
        <div style={{ padding: '0.875rem 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', marginBottom: cookieStatus ? '0.625rem' : 0 }}>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text)' }}>Cookie file</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '2px' }}>
                Upload a Netscape-format cookies.txt for age-restricted or private content
              </div>
              {form.cookieFile && (
                <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={11} /> Active: {form.cookieFile}
                </div>
              )}
            </div>
            <div style={{ flexShrink: 0 }}>
              <input
                ref={cookieInputRef}
                type="file"
                accept=".txt,text/plain"
                style={{ display: 'none' }}
                onChange={handleCookieUpload}
              />
              <button
                className="btn-secondary"
                style={{ minWidth: 'unset' }}
                onClick={() => cookieInputRef.current?.click()}
                disabled={cookieUploading}
              >
                {cookieUploading ? <Loader2 size={14} className="spinner" /> : <Upload size={14} />}
                {cookieUploading ? 'Uploading…' : 'Upload .txt'}
              </button>
            </div>
          </div>
          {cookieStatus && (
            <div style={{
              fontSize: '0.8125rem',
              color: cookieStatus.ok ? 'var(--success)' : 'var(--error)',
              display: 'flex', alignItems: 'center', gap: '0.375rem',
            }}>
              {cookieStatus.ok ? <CheckCircle size={13} /> : <Info size={13} />}
              {cookieStatus.msg}
            </div>
          )}
        </div>
      </div>

      <SectionTitle>Maintenance</SectionTitle>
      <div className="card">
        <div style={{ padding: '0.875rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text)' }}>yt-dlp version</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '2px' }}>
                Keep yt-dlp updated to fix broken extractors
              </div>
              {ytdlpVersion && (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                  Current: {ytdlpVersion.version}
                </div>
              )}
              {updateResult && (
                <div style={{
                  fontSize: '0.8125rem', marginTop: '0.375rem',
                  color: updateResult.ok ? 'var(--success)' : 'var(--error)',
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                }}>
                  {updateResult.ok ? <CheckCircle size={13} /> : <Info size={13} />}
                  {updateResult.msg}
                </div>
              )}
            </div>
            <button
              className="btn-secondary"
              style={{ flexShrink: 0, minWidth: 'unset' }}
              onClick={handleUpdateYtdlp}
              disabled={updating}
            >
              {updating ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
              {updating ? 'Updating…' : 'Update'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: '2rem' }} />
    </div>
  )
}
