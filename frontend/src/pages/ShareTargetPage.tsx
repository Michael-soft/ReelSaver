import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export function ShareTargetPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const url = params.get('url') || params.get('text') || params.get('title') || ''
    const clean = url.trim()
    if (clean) {
      navigate(`/app?url=${encodeURIComponent(clean)}`, { replace: true })
    } else {
      navigate('/app', { replace: true })
    }
  }, [navigate])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg)', gap: '1rem',
    }}>
      <Loader2 size={32} className="spinner" color="var(--accent)" />
      <p style={{ color: 'var(--muted)', fontSize: '0.9375rem' }}>Opening in ReelSaver…</p>
    </div>
  )
}
