import { PublicNav } from '../components/PublicNav'
import { PublicFooter } from '../components/PublicFooter'
import { LegalPage, LegalSection } from '../components/LegalPage'

interface PrivacyPageProps {
  isAuthenticated?: boolean
}

export function PrivacyPage({ isAuthenticated = false }: PrivacyPageProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <PublicNav isAuthenticated={isAuthenticated} />
      <LegalPage title="Privacy Policy" updated="April 27, 2026">
        <p>
          This Privacy Policy explains what information ReelSaver ("we", "us") collects when
          you use the service, why we collect it, and the choices you have. We aim to keep
          this short and in plain English.
        </p>

        <LegalSection title="1. Information we collect">
          <p>We collect only what we need to operate the service:</p>
          <ul>
            <li>
              <strong>Account information.</strong> When you register, we store your username,
              an optional email address, and a hashed password. If you sign in with Google,
              we receive your Google account ID and email address.
            </li>
            <li>
              <strong>Usage data.</strong> We store the URLs you submit for download, the
              file metadata returned by yt-dlp (title, duration, format, size), and the
              timestamps of your downloads.
            </li>
            <li>
              <strong>Settings.</strong> Preferences you configure (proxy, rate limit,
              concurrent downloads, command templates) are saved against your account.
            </li>
            <li>
              <strong>Session cookies.</strong> A signed session cookie is set after sign-in
              to keep you logged in.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="2. How we use the information">
          <ul>
            <li>To authenticate you and protect your account.</li>
            <li>To run the downloads you request and show you their progress and history.</li>
            <li>To diagnose errors and improve the reliability of the service.</li>
          </ul>
          <p>We do not sell your personal information and we do not use it for advertising.</p>
        </LegalSection>

        <LegalSection title="3. Third parties">
          <p>The service relies on a small number of third-party providers:</p>
          <ul>
            <li><strong>Supabase</strong> — hosts the PostgreSQL database that stores your account and history.</li>
            <li><strong>Replit</strong> — hosts the application.</li>
            <li><strong>Google</strong> — used only when you choose "Continue with Google" to sign in.</li>
            <li><strong>yt-dlp</strong> — connects to the source platforms you submit URLs from.</li>
          </ul>
          <p>
            Each of these providers has its own privacy policy that applies to data we
            transmit to them.
          </p>
        </LegalSection>

        <LegalSection title="4. Downloads">
          <p>
            Files you download through ReelSaver are saved to the server's downloads area
            so they can be served back to you, and may be removed periodically. We do not
            inspect the contents of those files.
          </p>
        </LegalSection>

        <LegalSection title="5. Data retention">
          <p>
            Your account data and download history remain until you delete them or close
            your account. You can delete history items from the History page at any time.
            To delete your entire account, contact us using the email address below.
          </p>
        </LegalSection>

        <LegalSection title="6. Security">
          <p>
            Passwords are stored using one-way hashing (Werkzeug PBKDF2). Connections to
            the service and to our database are encrypted in transit (TLS / SSL). No
            system is perfectly secure, so please use a strong, unique password.
          </p>
        </LegalSection>

        <LegalSection title="7. Your rights">
          <p>
            Depending on where you live, you may have the right to access, correct, or
            delete personal data we hold about you, and to object to or restrict certain
            processing. To exercise those rights, contact us.
          </p>
        </LegalSection>

        <LegalSection title="8. Children">
          <p>
            ReelSaver is not directed to children under 13 (or the equivalent minimum age in
            your country). We do not knowingly collect data from children. If you believe a
            child has used the service, please contact us so we can remove the account.
          </p>
        </LegalSection>

        <LegalSection title="9. Changes">
          <p>
            We may update this Privacy Policy from time to time. Material changes will be
            reflected on this page with an updated "Last updated" date.
          </p>
        </LegalSection>

        <LegalSection title="10. Contact">
          <p>
            Questions or requests about this Privacy Policy can be sent via the contact
            address shown in the project repository at{' '}
            <a href="https://github.com/Michael-soft/ReelSaver" target="_blank" rel="noopener noreferrer">
              github.com/Michael-soft/ReelSaver
            </a>.
          </p>
        </LegalSection>
      </LegalPage>
      <PublicFooter />
    </div>
  )
}
