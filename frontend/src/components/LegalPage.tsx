import type { ReactNode } from 'react'

interface LegalPageProps {
  title: string
  updated: string
  children: ReactNode
}

export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <main style={{
      flex: 1,
      padding: '3rem 2rem',
      background: 'var(--bg)',
    }}>
      <article style={{
        maxWidth: '760px',
        margin: '0 auto',
        color: 'var(--text)',
        fontSize: '0.9375rem',
        lineHeight: 1.7,
      }}>
        <h1 style={{
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
          fontWeight: 700,
          margin: '0 0 0.4rem',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: 0, marginBottom: '2.25rem' }}>
          Last updated {updated}
        </p>
        <div className="legal-body">{children}</div>
      </article>
    </main>
  )
}

interface LegalSectionProps {
  title: string
  children: ReactNode
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section style={{ marginTop: '2rem' }}>
      <h2 style={{
        fontSize: '1.125rem',
        fontWeight: 600,
        margin: '0 0 0.6rem',
        color: 'var(--text)',
      }}>
        {title}
      </h2>
      <div style={{ color: 'var(--text)' }}>{children}</div>
    </section>
  )
}
