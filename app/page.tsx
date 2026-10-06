import { LocalRunnerCard } from '@/components/local-runner-card'
import { PublisherForm } from '@/components/publisher-form'
import { getPlatformMetadata } from '@/lib/publishers/registry'

export default function HomePage() {
  const platforms = getPlatformMetadata()

  return (
    <main className="shell">
      <header className="hero">
        <div className="brand-row">
          <span className="brand-mark">B</span>
          <span className="brand-name">ButtonPost</span>
        </div>
        <h1>Write once. Publish everywhere.</h1>
        <p>
          One source post. Platform-specific formatting only. Publish to every selected destination in one action.
        </p>
      </header>

      <PublisherForm platforms={platforms} />
      <LocalRunnerCard />

      <footer className="footer">
        <span>MVP 0.4 · shared text + images</span>
        <a href="https://github.com/3956ray/ButtonPost" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </main>
  )
}
