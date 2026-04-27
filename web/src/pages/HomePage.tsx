import { Link } from 'react-router-dom'
import { Download, Zap, ListVideo, History, Terminal, Globe, Shield, ArrowRight } from 'lucide-react'
import { PublicNav } from '../components/PublicNav'
import { PublicFooter } from '../components/PublicFooter'

interface HomePageProps {
  isAuthenticated?: boolean
}

export function HomePage({ isAuthenticated = false }: HomePageProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <PublicNav isAuthenticated={isAuthenticated} />

      {/* Hero */}
      <section style={{
        padding: '5rem 2rem 4rem',
        background: 'radial-gradient(ellipse at top, rgba(124, 58, 237, 0.18), transparent 60%)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.9rem',
            background: 'rgba(167, 139, 250, 0.12)',
            border: '1px solid rgba(167, 139, 250, 0.25)',
            borderRadius: '999px',
            fontSize: '0.8125rem',
            color: 'var(--accent-light)',
            fontWeight: 500,
            marginBottom: '1.5rem',
          }}>
            <Globe size={13} /> Powered by yt-dlp · 1000+ sites supported
          </div>

          <h1 style={{
            fontSize: 'clamp(2.25rem, 5vw, 3.75rem)',
            lineHeight: 1.1,
            fontWeight: 800,
            color: 'var(--text)',
            margin: '0 0 1.25rem',
            letterSpacing: '-0.02em',
          }}>
            Save videos and audio from{' '}
            <span style={{
              background: 'linear-gradient(135deg, #c4b5fd, #7c3aed)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              anywhere on the web
            </span>
          </h1>

          <p style={{
            fontSize: '1.125rem',
            color: 'var(--muted)',
            maxWidth: '620px',
            margin: '0 auto 2.25rem',
            lineHeight: 1.6,
          }}>
            ReelSaver is a fast, no-nonsense downloader for YouTube, Twitter, Instagram,
            TikTok and over a thousand other platforms. Paste a link, pick a format, done.
          </p>

          <div style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {isAuthenticated ? (
              <Link to="/" style={primaryBtnStyle}>
                Open dashboard <ArrowRight size={17} />
              </Link>
            ) : (
              <>
                <Link to="/login?mode=register" style={primaryBtnStyle}>
                  Create free account <ArrowRight size={17} />
                </Link>
                <Link to="/login" style={secondaryBtnStyle}>
                  Sign in
                </Link>
              </>
            )}
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '1.25rem' }}>
            Free to use · No credit card required
          </p>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '4rem 2rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={sectionTitleStyle}>Everything you need in one place</h2>
          <p style={sectionSubtitleStyle}>
            Built for people who actually download a lot of videos.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.25rem',
            marginTop: '2.5rem',
          }}>
            <FeatureCard
              icon={<Download size={22} />}
              title="One-click downloads"
              text="Paste a URL, pick the quality and format, and download. Video, audio-only, or both."
            />
            <FeatureCard
              icon={<ListVideo size={22} />}
              title="Bulk playlists"
              text="Pull entire playlists and channels at once. Select exactly which items to grab."
            />
            <FeatureCard
              icon={<History size={22} />}
              title="Searchable history"
              text="Every download is saved with metadata. Search, filter, and re-download anytime."
            />
            <FeatureCard
              icon={<Terminal size={22} />}
              title="Custom commands"
              text="Power users can pass any yt-dlp flag and save command templates for reuse."
            />
            <FeatureCard
              icon={<Zap size={22} />}
              title="Fast and concurrent"
              text="Configurable rate limits and parallel downloads. Doesn't fight your bandwidth."
            />
            <FeatureCard
              icon={<Shield size={22} />}
              title="Private by default"
              text="Your downloads and history stay tied to your account. No tracking, no resale."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '4rem 2rem', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={sectionTitleStyle}>How it works</h2>
          <p style={sectionSubtitleStyle}>Three steps. No setup, no tooling.</p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
            marginTop: '2.5rem',
          }}>
            <Step n={1} title="Sign in" text="Create a free account with email and password, or continue with Google." />
            <Step n={2} title="Paste a link" text="Drop in a video, playlist or channel URL from any supported site." />
            <Step n={3} title="Download" text="Choose your format and quality, then save the file straight to your device." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '4rem 2rem' }}>
        <div style={{
          maxWidth: '720px',
          margin: '0 auto',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.18), rgba(167, 139, 250, 0.08))',
          border: '1px solid rgba(167, 139, 250, 0.25)',
          borderRadius: '20px',
          padding: '3rem 2rem',
        }}>
          <h2 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 0.75rem',
          }}>
            Ready to save your first video?
          </h2>
          <p style={{ color: 'var(--muted)', marginBottom: '1.75rem' }}>
            Sign up in under a minute. It's free.
          </p>
          {isAuthenticated ? (
            <Link to="/" style={primaryBtnStyle}>
              Open dashboard <ArrowRight size={17} />
            </Link>
          ) : (
            <Link to="/login?mode=register" style={primaryBtnStyle}>
              Get started <ArrowRight size={17} />
            </Link>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div style={{
      padding: '1.5rem',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
    }}>
      <div style={{
        width: '42px', height: '42px',
        background: 'rgba(124, 58, 237, 0.15)',
        borderRadius: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent-light)',
        marginBottom: '0.875rem',
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 0.4rem' }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
        {text}
      </p>
    </div>
  )
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '40px', height: '40px',
        background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
        borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: '1rem',
        marginBottom: '0.875rem',
      }}>
        {n}
      </div>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 0.4rem' }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
        {text}
      </p>
    </div>
  )
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.85rem 1.5rem',
  background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
  color: 'white',
  textDecoration: 'none',
  fontSize: '1rem',
  fontWeight: 600,
  borderRadius: '12px',
  border: 'none',
  cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.85rem 1.5rem',
  background: 'transparent',
  color: 'var(--text)',
  textDecoration: 'none',
  fontSize: '1rem',
  fontWeight: 600,
  borderRadius: '12px',
  border: '1px solid var(--border)',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 'clamp(1.5rem, 3vw, 2.125rem)',
  fontWeight: 700,
  color: 'var(--text)',
  margin: '0 0 0.5rem',
  textAlign: 'center',
  letterSpacing: '-0.01em',
}

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: 'var(--muted)',
  textAlign: 'center',
  margin: 0,
}
