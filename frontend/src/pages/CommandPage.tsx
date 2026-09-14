import { useState } from 'react'
import { Plus, Trash2, Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Template } from '../api/client'
import { api } from '../api/client'

export function CommandPage() {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState<{ stdout: string; stderr: string; returncode: number } | null>(null)
  const [newName, setNewName] = useState('')
  const [newCmd, setNewCmd] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
  })

  const runMutation = useMutation({
    mutationFn: () => api.runCommand({ url, command }),
    onSuccess: (data) => setOutput(data),
  })

  const createMutation = useMutation({
    mutationFn: () => api.createTemplate({ name: newName, command: newCmd }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setNewName('')
      setNewCmd('')
      setShowAdd(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })

  const applyTemplate = (t: Template) => {
    setCommand(t.command)
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text)' }}>
          Custom Command
        </h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9375rem' }}>
          Run custom yt-dlp flags. Save frequently-used commands as templates.
        </p>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Templates
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {templates.map((t: Template) => (
              <div
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '0.5rem', padding: '0.375rem 0.625rem 0.375rem 0.875rem',
                  fontSize: '0.8125rem',
                }}
              >
                <button
                  onClick={() => applyTemplate(t)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0, fontWeight: 500 }}
                >
                  {t.name}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(t.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0 2px', display: 'flex', alignItems: 'center' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Command input */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.5rem' }}>
            URL
          </label>
          <input
            className="input-base"
            placeholder="Video URL..."
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.5rem' }}>
            yt-dlp flags
          </label>
          <input
            className="input-base"
            placeholder="--extract-audio --audio-format mp3 ..."
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runMutation.mutate()}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.375rem' }}>
            Allowed: --extract-audio, --audio-format, --audio-quality, --format, --remux-video, --embed-thumbnail, --embed-metadata, --limit-rate, --sponsorblock-remove, --proxy, --embed-subs
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => runMutation.mutate()}
            disabled={!url.trim() || runMutation.isPending}
          >
            {runMutation.isPending ? <Loader2 size={15} className="spinner" /> : <Play size={15} />}
            Run
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus size={15} /> Save as template
          </button>
        </div>
      </div>

      {/* Save template form */}
      {showAdd && (
        <div className="card fade-in" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 160px' }}>
              <label style={{ fontSize: '0.8125rem', color: 'var(--muted)', display: 'block', marginBottom: '0.375rem' }}>Template name</label>
              <input className="input-base" placeholder="My template" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8125rem', color: 'var(--muted)', display: 'block', marginBottom: '0.375rem' }}>Flags</label>
              <input className="input-base" placeholder="--extract-audio ..." value={newCmd} onChange={e => setNewCmd(e.target.value)} />
            </div>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || !newCmd.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 size={14} className="spinner" /> : <Plus size={14} />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Output */}
      {output && (
        <div className="card fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {output.returncode === 0
              ? <CheckCircle size={16} color="var(--success)" />
              : <AlertCircle size={16} color="var(--error)" />}
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: output.returncode === 0 ? 'var(--success)' : 'var(--error)' }}>
              {output.returncode === 0 ? 'Completed successfully' : `Failed (exit ${output.returncode})`}
            </span>
          </div>
          {output.stdout && (
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.375rem', fontWeight: 600 }}>OUTPUT</div>
              <pre style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '0.5rem',
                padding: '0.875rem', fontSize: '0.8125rem', color: 'var(--text)',
                overflow: 'auto', maxHeight: '300px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {output.stdout}
              </pre>
            </div>
          )}
          {output.stderr && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.375rem', fontWeight: 600 }}>ERRORS</div>
              <pre style={{
                background: 'rgba(248, 113, 113, 0.05)', border: '1px solid rgba(248, 113, 113, 0.2)', borderRadius: '0.5rem',
                padding: '0.875rem', fontSize: '0.8125rem', color: 'var(--error)',
                overflow: 'auto', maxHeight: '200px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {output.stderr}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
