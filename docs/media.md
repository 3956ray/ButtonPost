# Shared source images

ButtonPost keeps one source image set and maps it mechanically to each selected destination.

## Transport

- **X**: source files upload to public Vercel Blob, the X adapter fetches the bytes, uploads at most the first four images to X Media, then attaches the returned media IDs to the post.
- **DEV Community**: source files upload to public Vercel Blob. The first image becomes the article `main_image`; all source images are appended to the Markdown body.
- **Xiaohongshu**: source files do **not** go through Vercel Blob. The browser sends them directly to the Local Runner at `127.0.0.1`.

## Why Blob is public

The Forem/DEV API expects image fields to be URLs, and the article body keeps those URLs after publication. Therefore ButtonPost uses a public Blob store for server-published media.

Do not delete an image from Blob while a DEV article still references it.

## Upload authorization

The Blob read/write token remains server-side.

1. Browser sends the normal ButtonPost publish key to `/api/media/ticket`.
2. ButtonPost returns a five-minute media-only HMAC ticket.
3. The browser gives that ticket to the Vercel Blob client upload handler.
4. The handler verifies the ticket before issuing the scoped Blob client token.

The long-lived `BUTTONPOST_SECRET` is not embedded in the Blob client payload.

## Limits

- ButtonPost source picker: up to 9 images.
- Blob upload: 25 MB per image.
- X: first 4 source images are attached.
- DEV: all source images are inserted into the article.
- Xiaohongshu: all selected source images are sent to the Local Runner, subject to the platform adapter's limits.
