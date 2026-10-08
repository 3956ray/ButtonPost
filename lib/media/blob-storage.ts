import 'server-only'
import { del, list } from '@vercel/blob'
import { mediaPrefixForUser } from '@/lib/security/media-ticket'

const DELETE_BATCH_SIZE = 100

export function blobStorageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_STORE_ID,
  )
}

export async function deleteUserCloudMedia(userId: string) {
  if (!blobStorageConfigured()) {
    return { deleted: 0 }
  }

  const prefix = mediaPrefixForUser(userId)
  if (!prefix) {
    throw new Error('Media ownership signing is not configured.')
  }

  let cursor: string | undefined
  let deleted = 0

  do {
    const result = await list({
      prefix,
      cursor,
      limit: DELETE_BATCH_SIZE,
    })

    if (result.blobs.length) {
      await del(result.blobs.map((blob) => blob.url))
      deleted += result.blobs.length
    }

    cursor = result.cursor
  } while (cursor)

  return { deleted }
}
