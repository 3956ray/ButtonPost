import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import busboy from 'busboy'

const MAX_IMAGES = 9
const MAX_IMAGE_BYTES = 25 * 1024 * 1024

function safeFilename(value, index) {
  const name = path.basename(value || 'image')
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120)
  return String(index + 1).padStart(2, '0') + '-' + (cleaned || 'image')
}

async function readImagePostMultipart(
  req,
  {
    platformLabel,
    tempPrefix,
    requireImages,
    allowedImageTypes = null,
  },
) {
  const contentType = String(req.headers['content-type'] || '')
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new Error(platformLabel + ' publishing requires multipart/form-data.')
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), tempPrefix))
  const fields = {}
  const imagePaths = []
  const writes = []
  let parseError = null

  try {
    await new Promise((resolve, reject) => {
      const parser = busboy({
        headers: req.headers,
        limits: {
          files: MAX_IMAGES,
          fileSize: MAX_IMAGE_BYTES,
          fields: 10,
          fieldSize: 1024 * 1024,
        },
      })

      parser.on('field', (name, value) => {
        if (['account', 'title', 'content'].includes(name)) fields[name] = value
      })

      parser.on('file', (name, file, info) => {
        const index = imagePaths.length

        if (name !== 'images') {
          file.resume()
          return
        }

        const mimeType = String(info.mimeType || '')
        const allowed =
          mimeType.startsWith('image/') &&
          (!allowedImageTypes || allowedImageTypes.includes(mimeType))

        if (!allowed) {
          parseError = new Error(
            platformLabel +
              ' does not support image type ' +
              (mimeType || 'unknown') +
              ' in ButtonPost.',
          )
          file.resume()
          return
        }

        const outputPath = path.join(tempDir, safeFilename(info.filename, index))
        imagePaths.push(outputPath)

        file.on('limit', () => {
          parseError = new Error(
            'One of the selected images exceeds the 25 MB per-image limit.',
          )
        })

        writes.push(pipeline(file, createWriteStream(outputPath)))
      })

      parser.on('filesLimit', () => {
        parseError = new Error(
          platformLabel + ' accepts at most 9 images per ButtonPost request.',
        )
      })
      parser.on('error', reject)
      parser.on('close', resolve)
      req.pipe(parser)
    })

    await Promise.all(writes)

    if (parseError) throw parseError
    if (requireImages && !imagePaths.length) {
      throw new Error(platformLabel + ' publishing requires at least one image.')
    }

    return {
      fields,
      imagePaths,
      async cleanup() {
        await rm(tempDir, { recursive: true, force: true })
      },
    }
  } catch (cause) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw cause
  }
}

export function readXiaohongshuNoteMultipart(req) {
  return readImagePostMultipart(req, {
    platformLabel: 'Xiaohongshu image-note',
    tempPrefix: 'buttonpost-xhs-',
    requireImages: true,
  })
}

export function readJikePostMultipart(req) {
  return readImagePostMultipart(req, {
    platformLabel: 'Jike',
    tempPrefix: 'buttonpost-jike-',
    requireImages: false,
    allowedImageTypes: ['image/jpeg', 'image/png'],
  })
}


export function readLearnBlockchainArticleMultipart(req) {
  return readImagePostMultipart(req, {
    platformLabel: 'LearnBlockchain article',
    tempPrefix: 'buttonpost-lbc-',
    requireImages: false,
  })
}
