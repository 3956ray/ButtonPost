import Link from 'next/link'
import type { ReactNode } from 'react'

type LegalPageProps = {
  eyebrow: string
  title: string
  intro: string
  children: ReactNode
}

export function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: LegalPageProps) {
  return (
    <main className="legal-shell">
      <nav className="legal-nav">
        <Link className="auth-home" href="/">← ButtonPost</Link>
        <div className="legal-nav-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund">Billing & refunds</Link>
        </div>
      </nav>

      <header className="legal-hero">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <span className="legal-date">Last updated: October 8, 2026</span>
      </header>

      <div className="legal-content">{children}</div>

      <footer className="legal-footer">
        <span>ButtonPost private beta</span>
        <a
          href="https://github.com/3956ray/ButtonPost"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </footer>
    </main>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}
