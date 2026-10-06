export function splitForXThread(text: string, limit: number): string[] {
  const source = text.replace(/\r\n/g, '\n').trim()
  if (!source) return []
  if (source.length <= limit) return [source]

  const chunks: string[] = []
  let remaining = source

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit + 1)
    const minimumPreferredCut = Math.floor(limit * 0.55)

    const candidates = [
      window.lastIndexOf('\n\n', limit),
      window.lastIndexOf('\n', limit),
      ...['。', '！', '？', '.', '!', '?', '；', ';', '，', ',', ' '].map(
        (boundary) => window.lastIndexOf(boundary, limit),
      ),
    ].filter((index) => index >= minimumPreferredCut)

    const bestBoundary = candidates.length ? Math.max(...candidates) : -1
    let cut = bestBoundary >= 0 ? bestBoundary + 1 : limit

    let chunk = remaining.slice(0, cut).trim()
    if (!chunk) {
      cut = limit
      chunk = remaining.slice(0, cut)
    }

    chunks.push(chunk)
    remaining = remaining.slice(cut).trimStart()
  }

  if (remaining.trim()) chunks.push(remaining.trim())
  return chunks
}
