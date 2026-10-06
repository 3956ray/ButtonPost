# Shared source images

ButtonPost keeps one source image set and maps it mechanically to each selected destination.

## Transport

- **X**: source files upload to public Vercel Blob, the X adapter fetches the bytes, uploads at most the first four images to X Media, then attaches the returned media IDs to the post.
- **DEV Community**: source files upload to public Vercel Blob. The first image becomes the article `main_image`; any remaining source images are appended to the Markdown body.
- **Xiaohongshu**: source files do **not** go through Vercel Blob. The browser sends them directly to the Local Runner at `127.0.0.1`.

## Why Blob is public

The Forem/DEV API expects image fields to be URLs, and the article body keeps those URLs after publication. Therefore ButtonPost uses a public Blob store for server-published media.

Do not delete an image from Blob while a DEV article still references it.

## Upload authorization

Blob credentials remain server-side. ButtonPost supports two Vercel Blob authentication modes:

- preferred: Vercel OIDC with `VERCEL_OIDC_TOKEN + BLOB_STORE_ID`;
- fallback: legacy `BLOB_READ_WRITE_TOKEN`.

The upload itself uses a constrained presigned URL:

1. Browser sends the normal ButtonPost publish key to `/api/media/ticket`.
2. ButtonPost returns a five-minute media-only HMAC ticket.
3. The browser sends that ticket to the media upload route.
4. The route validates it and asks Vercel Blob for a five-minute, pathname-scoped `put` delegation.
5. The browser uploads directly to Vercel Blob using the resulting presigned upload.

Neither the long-lived `BUTTONPOST_SECRET` nor Blob credentials are exposed to the browser.

## Limits

- ButtonPost source picker: up to 9 images.
- Blob upload: 25 MB per image.
- X: first 4 source images are attached.
- DEV: first source image is the cover; remaining source images are inserted into the article.
- Xiaohongshu: all selected source images are sent to the Local Runner, subject to the platform adapter's limits.
