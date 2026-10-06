export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---\s*/u, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gu, '$1 $2')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/^>\s?/gmu, '')
    .replace(/```[\w-]*\n?/gu, '')
    .replace(/```/gu, '')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/(\*\*|__)(.*?)\1/gu, '$2')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/gu, '$1')
    .replace(/(?<!_)_([^_\n]+)_(?!_)/gu, '$1')
    .replace(/~~(.*?)~~/gu, '$1')
    .replace(/^[\t ]*[-*+]\s+/gmu, '• ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}
