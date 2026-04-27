import { PublicNav } from '../components/PublicNav'
import { PublicFooter } from '../components/PublicFooter'
import { LegalPage, LegalSection } from '../components/LegalPage'

interface TermsPageProps {
  isAuthenticated?: boolean
}

export function TermsPage({ isAuthenticated = false }: TermsPageProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <PublicNav isAuthenticated={isAuthenticated} />
      <LegalPage title="Terms of Service" updated="April 27, 2026">
        <p>
          These Terms of Service ("Terms") govern your use of ReelSaver (the "service").
          By creating an account or using the service you agree to these Terms. If you do
          not agree, do not use the service.
        </p>

        <LegalSection title="1. The service">
          <p>
            ReelSaver is a web interface for the open-source <code>yt-dlp</code> downloader.
            It lets you submit URLs to public online media platforms and saves the resulting
            files for you to download.
          </p>
        </LegalSection>

        <LegalSection title="2. Eligibility and accounts">
          <ul>
            <li>You must be at least 13 years old, or the age of digital consent in your country, to use ReelSaver.</li>
            <li>You are responsible for keeping your password confidential and for everything that happens under your account.</li>
            <li>You may not register accounts using automated means or impersonate another person.</li>
          </ul>
        </LegalSection>

        <LegalSection title="3. Acceptable use">
          <p>You agree to use ReelSaver only for lawful purposes. You must not:</p>
          <ul>
            <li>Download content you do not have the legal right to download.</li>
            <li>Infringe copyright, trademark, privacy, publicity, or other rights.</li>
            <li>Bypass or circumvent technical protection measures (DRM) on any platform.</li>
            <li>Use the service to harass, defame, or harm others.</li>
            <li>Attempt to overload, attack, or reverse-engineer the service or its infrastructure.</li>
            <li>Resell, sublicense, or commercially redistribute the service without permission.</li>
          </ul>
          <p>
            You are solely responsible for the URLs you submit and for complying with the
            terms of service of the source platforms (e.g. YouTube, Twitter, Instagram).
          </p>
        </LegalSection>

        <LegalSection title="4. Intellectual property">
          <p>
            ReelSaver does not claim ownership of any content you download. All copyrights
            and other rights in downloaded content remain with their respective owners.
            ReelSaver itself, including its name, design, and source code where applicable,
            is owned by its authors.
          </p>
        </LegalSection>

        <LegalSection title="5. Service availability">
          <p>
            The service is provided on an "as is" and "as available" basis. We may change,
            suspend, or discontinue any part of the service at any time, with or without
            notice. We do not guarantee uptime, throughput, or that any specific source
            platform will continue to be supported.
          </p>
        </LegalSection>

        <LegalSection title="6. Termination">
          <p>
            We may suspend or terminate your account at any time if you violate these Terms
            or use the service in a way that we believe is harmful or illegal. You may
            stop using the service at any time.
          </p>
        </LegalSection>

        <LegalSection title="7. Disclaimer of warranties">
          <p>
            To the fullest extent permitted by law, the service is provided without
            warranties of any kind, express or implied, including merchantability, fitness
            for a particular purpose, and non-infringement.
          </p>
        </LegalSection>

        <LegalSection title="8. Limitation of liability">
          <p>
            To the fullest extent permitted by law, ReelSaver and its authors shall not be
            liable for any indirect, incidental, special, consequential, or punitive
            damages, or any loss of profits, data, or goodwill, arising out of or in
            connection with your use of the service.
          </p>
        </LegalSection>

        <LegalSection title="9. Indemnification">
          <p>
            You agree to indemnify and hold ReelSaver and its authors harmless from any
            claim or demand, including reasonable legal fees, made by any third party due
            to or arising out of your use of the service or your violation of these Terms.
          </p>
        </LegalSection>

        <LegalSection title="10. Changes to these Terms">
          <p>
            We may update these Terms from time to time. The updated version will be
            posted on this page with a new "Last updated" date. Continued use of the
            service after the changes take effect means you accept the new Terms.
          </p>
        </LegalSection>

        <LegalSection title="11. Contact">
          <p>
            Questions about these Terms can be sent via the contact address shown in the
            project repository at{' '}
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
