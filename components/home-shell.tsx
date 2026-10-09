import Link from 'next/link'
import { LocalRunnerCard } from '@/components/local-runner-card'
import { PublisherForm } from '@/components/publisher-form'
import type { PlatformId, PlatformMetadata } from '@/lib/publishers/types'

export type HomeAuthView = {
  configured: boolean
  userId: string | null
  email: string | null
  connectedPlatforms: PlatformId[]
}

type Props = { auth: HomeAuthView; platforms: PlatformMetadata[] }

function DistributionArtwork() {
  return (
    <div className="distribution-art" aria-label="One post, distributed to five platforms">
      <div className="distribution-art-top">
        <span>THE DISTRIBUTION EFFECT</span>
        <span className="art-top-index">05 CHANNELS / 01 SOURCE</span>
      </div>
      <div className="distribution-art-content">
        <div className="source-note">
          <span className="source-note-meta">
            <span className="source-note-indicator" /> YOUR WORDS
          </span>
          <strong>One good idea deserves to travel.</strong>
          <span className="source-note-lines" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="source-note-footer">SOURCE / 001 <span>↗</span></span>
        </div>
        <div className="distribution-connection" aria-hidden="true">
          <span className="distribution-connection-dot" />
          <span className="distribution-connection-line" />
        </div>
        <div className="distribution-channels">
          <span className="distribution-channel"><b>𝕏</b><span>X</span><i /></span>
          <span className="distribution-channel"><b>D</b><span>DEV</span><i /></span>
          <span className="distribution-channel"><b>XH</b><span>Xiaohongshu</span><i /></span>
          <span className="distribution-channel"><b>JK</b><span>Jike</span><i /></span>
          <span className="distribution-channel"><b>LB</b><span>LearnBlockchain</span><i /></span>
        </div>
      </div>
      <div className="distribution-art-bottom">
        <span>ONE CLICK. MULTIPLE DESTINATIONS.</span>
        <span className="distribution-art-star" aria-hidden="true">✳</span>
      </div>
    </div>
  )
}

export function HomeShell({ auth, platforms }: Props) {
  const signedIn = Boolean(auth.userId)
  return (
    <main className={'shell ' + (signedIn ? 'shell--signed-in' : 'shell--visitor')}>
      <a className="skip-link" href="#workspace-title">Skip to publishing editor</a>
      <header className="site-header">
        <div className="brand-lockup">
          <Link className="brand-home" href="/" aria-label="ButtonPost home">
            <span className="brand-mark" aria-hidden="true">
              <span className="brand-mark-letter">B</span>
              <span className="brand-mark-signal" />
            </span>
            <span className="brand-name">ButtonPost<span className="brand-name-stop">.</span></span>
          </Link>
          <span className="brand-version">BETA / 01</span>
        </div>

        <nav className="site-nav" aria-label="Main navigation">
          <Link className="site-nav-link" href="/pricing">Pricing</Link>
          {signedIn ? (
            <>
              <Link className="site-nav-link" href="/settings/connections">Connections</Link>
              <details className="profile-menu">
                <summary className="profile-trigger" aria-label="Account menu">
                  <span className="profile-avatar">{(auth.email ?? 'B').charAt(0).toUpperCase()}</span>
                  <span className="profile-trigger-text">Account</span>
                  <span className="profile-chevron" aria-hidden="true">⌄</span>
                </summary>
                <div className="profile-popover">
                  <span className="profile-email" title={auth.email ?? undefined}>{auth.email ?? 'Signed in'}</span>
                  <Link href="/settings/connections">Connections <span aria-hidden="true">↗</span></Link>
                  <Link href="/settings/account">Account settings <span aria-hidden="true">↗</span></Link>
                  <Link href="/settings/billing">Billing <span aria-hidden="true">↗</span></Link>
                  <form action="/auth/signout" method="post">
                    <button type="submit">Sign out <span aria-hidden="true">↗</span></button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <Link className="site-nav-signin" href="/login">Sign in <span aria-hidden="true">↗</span></Link>
          )}
        </nav>
      </header>

      <section className={'hero ' + (signedIn ? 'hero--workspace' : 'hero--welcome')} aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="hero-kicker-line" /> THE THOUGHTFUL WAY TO SHARE</div>
          <h1 id="hero-title">
            <span>Write once.</span>
            <span>Publish <em>everywhere.</em></span>
          </h1>
          <p>
            Your ideas deserve more than copy and paste. Write one original post,
            choose your platforms, and share without repeating yourself.
          </p>
          {!signedIn && auth.configured ? (
            <div className="hero-onboarding">
              <Link className="hero-onboarding-primary" href="/login?next=/">
                Start publishing <span aria-hidden="true">↗</span>
              </Link>
              <span>No installation needed for X and DEV.</span>
            </div>
          ) : signedIn && auth.connectedPlatforms.length === 0 ? (
            <div className="hero-onboarding">
              <Link className="hero-onboarding-primary" href="/settings/connections">
                Connect your first platform <span aria-hidden="true">↗</span>
              </Link>
              <span>X and DEV work directly from the web.</span>
            </div>
          ) : null}
          {!signedIn ? (
            <div className="hero-trustline">
              <span className="hero-trustline-dots" aria-hidden="true"><i /><i /><i /></span>
              YOUR CONTENT. YOUR ACCOUNTS. YOUR CONTROL.
            </div>
          ) : null}
        </div>
        {!signedIn ? <DistributionArtwork /> : null}
      </section>

      <PublisherForm
        platforms={platforms}
        connectedPlatforms={auth.connectedPlatforms}
        signedIn={signedIn}
      />

      <LocalRunnerCard />

      <footer className="footer">
        <div className="footer-brand">
          <span className="footer-brand-title">ButtonPost<span>.</span></span>
          <span>Less friction. More ideas in motion.</span>
          <span>© 2026 ButtonPost · Open source · MVP 0.9</span>
        </div>
        <div className="footer-links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/refund">Billing & refunds</a>
          <a href="mailto:support@buttonpost.app">Support</a>
          <a href="https://github.com/3956ray/ButtonPost" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      </footer>
    </main>
  )
}
