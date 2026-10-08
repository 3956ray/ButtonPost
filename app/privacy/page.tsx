import { LegalPage, LegalSection } from '@/components/legal-page'

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="ButtonPost privacy policy"
      intro="This policy describes what ButtonPost stores during the private beta, what stays on your device, and how account deletion works."
    >
      <LegalSection title="What ButtonPost stores">
        <p>
          ButtonPost stores the minimum cloud data needed to operate accounts,
          platform connections, publishing authorization, billing, and abuse
          protection.
        </p>
        <ul>
          <li>
            Account identity from Supabase Auth, including your email address and
            basic profile metadata returned by your sign-in provider.
          </li>
          <li>
            Platform connection metadata such as platform name, connection
            status, external account id, and username.
          </li>
          <li>
            X OAuth user credentials and DEV API keys encrypted at rest before
            they are written to the database.
          </li>
          <li>
            Paddle customer/subscription identifiers, plan, subscription status,
            billing period end, and cancellation state. ButtonPost does not store
            your payment card number.
          </li>
          <li>
            Short-lived rate-limit records containing your ButtonPost user id,
            protected action scope, and timestamp.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Your posts and browser history">
        <p>
          Draft text and ButtonPost publication history are local-first. The
          current private beta stores them in your browser rather than syncing
          the full post body into the ButtonPost database.
        </p>
        <p>
          Content selected for X or DEV publishing is sent to the ButtonPost
          server only when you explicitly publish. ButtonPost processes that
          content to perform the requested publish action.
        </p>
      </LegalSection>

      <LegalSection title="Local Runner data">
        <p>
          Browser sessions for Local Runner destinations such as Xiaohongshu,
          Jike, and LearnBlockchain stay on your computer. ButtonPost does not
          upload those browser cookies to Supabase or Vercel.
        </p>
        <p>
          Local Runner profiles live under <code>~/.buttonpost</code>. Deleting
          your ButtonPost cloud account does not remove files from your own
          computer.
        </p>
      </LegalSection>

      <LegalSection title="Uploaded media">
        <p>
          Images uploaded for X or DEV cloud publishing are stored in Vercel
          Blob under an opaque, account-scoped namespace. New media URLs do not
          expose your Supabase user id.
        </p>
        <p>
          During the private beta, ButtonPost does not apply an automatic media
          retention window. Account deletion removes cloud media that was
          uploaded after account-scoped media ownership was introduced. Older
          development/test blobs created before user ownership cannot be
          reliably attributed and are handled as legacy test data.
        </p>
      </LegalSection>

      <LegalSection title="Services used by ButtonPost">
        <ul>
          <li>Supabase for authentication and account-scoped database storage.</li>
          <li>Vercel for application hosting and Blob media storage.</li>
          <li>Paddle for checkout, subscription billing, invoices, and the customer portal.</li>
          <li>X and DEV Community when you connect and publish to those services.</li>
        </ul>
        <p>
          Those providers process information under their own policies when you
          use their services.
        </p>
      </LegalSection>

      <LegalSection title="Account deletion">
        <p>
          You can request permanent deletion from Settings → Account. ButtonPost
          first removes account-scoped cloud media, then cancels an active Paddle
          subscription, then deletes the Supabase Auth user. Database rows linked
          to that Auth user are deleted through foreign-key cascades, including
          profiles, subscription entitlement, runner device records, platform
          connections, and encrypted platform secrets.
        </p>
        <p>
          The browser also clears ButtonPost localStorage after a successful
          deletion. Local Runner files on your computer remain under your
          control.
        </p>
      </LegalSection>

      <LegalSection title="Security and support">
        <p>
          ButtonPost uses authenticated sessions, row-level security,
          account-scoped encrypted credentials, short-lived media authorization,
          and rate limits. No internet service can guarantee absolute security.
        </p>
        <p>
          For private-beta support, email{' '}
          <a href="mailto:support@buttonpost.app">support@buttonpost.app</a>.
          Do not send passwords, API keys, payment card information, webhook
          secrets, or other sensitive credentials by email or in a public issue.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
