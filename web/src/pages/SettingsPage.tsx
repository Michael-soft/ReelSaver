import { useState, useEffect } from 'react'
import { Save, CheckCircle, Loader2 } from 'lucide-react'
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
      <div>
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

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
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

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Loading...</div>
  }

  return (
    <div style={{ maxWidth: '620px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text)' }}>Settings</h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9375rem' }}>Configure download preferences</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
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
            style={{ width: '240px' }}
            placeholder="http://proxy:port"
            value={form.proxy}
            onChange={e => set('proxy', e.target.value)}
          />
        </SettingRow>
        <SettingRow label="Rate limit" description="Maximum download speed (e.g. 2M, 500K)">
          <input
            className="input-base"
            style={{ width: '160px' }}
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
        <SettingRow label="Cookie file" description="Path to a cookies.txt file for restricted content" >
          <input
            className="input-base"
            style={{ width: '240px' }}
            placeholder="/path/to/cookies.txt"
            value={form.cookieFile}
            onChange={e => set('cookieFile', e.target.value)}
          />
        </SettingRow>
      </div>

      <div style={{ height: '2rem' }} />
    </div>
  )
}
