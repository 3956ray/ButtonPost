import type { Metadata } from 'next'
import './globals.css'
import './editorial.css'

export const metadata: Metadata = {
  title: 'ButtonPost',
  description: 'Write once. Publish everywhere.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
