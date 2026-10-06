# ButtonPost

**Write once. Publish everywhere.**

ButtonPost is a personal-first, open-source multi-platform publishing tool. Write one source post, select destinations, press one button, and get an independent result for every platform.

The product is intentionally **not** a content-variant generator. Platform adapters can perform mechanical compatibility work (Markdown to plain text, HTML cleanup, media upload, field mapping), but the source content remains one post.

## MVP status

The first runnable slice supports:

- **X** through the official X API, including up to 4 source images per post.
- **DEV Community** through the official Forem article API, including public source images and a cover image.
- Parallel publishing with per-platform published / draft / failed / skipped results.
- A server-side publish key so a deployed personal instance is not an open publishing endpoint.

Phase 2 adds a **Local Runner** so browser-automated platforms can execute on the user's own computer without sending browser cookies to Vercel. Xiaohongshu login/check and image-note publishing now run locally through the user's own Chrome session.

## Local setup

Requires Node.js 22+.

```bash
cp .env.example .env.local
npm install
npm run dev

# In another terminal, for local/browser publishers:
# Google Chrome must be installed locally.
npm run runner
```

Open `http://localhost:3000`.

### Environment variables

```bash
BUTTONPOST_SECRET=your-private-publish-key
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_TOKEN_SECRET=...
# Alternative OAuth 2.0 user-context token:
X_USER_ACCESS_TOKEN=
X_MAX_LENGTH=280
DEVTO_API_KEY=...
DEVTO_TAGS=ai,webdev
DEVTO_DRAFT_ONLY=false
# Vercel Blob: preferred OIDC setup
BLOB_STORE_ID=store_...
# Alternative legacy credential:
BLOB_READ_WRITE_TOKEN=...
```

`X_USER_ACCESS_TOKEN` must be an OAuth 2.0 **user-context** token allowed to create posts; the application-only Bearer Token will be rejected. For the quickest manual test, configure OAuth 1.0a with `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, and `X_ACCESS_TOKEN_SECRET`. `DEVTO_API_KEY` must belong to the DEV author account.

For safe DEV testing, set `DEVTO_DRAFT_ONLY=true` before clicking Publish Everywhere. ButtonPost reports that result as `draft`; set it to `false` when you want the same action to publish publicly.

### Shared images for X + DEV

Local source images are uploaded directly from the browser to a **public Vercel Blob store** before server publishers run. This avoids pushing large image bodies through the ButtonPost server function.

- X fetches the Blob images server-side, uploads up to the first 4 to X Media, then attaches their media IDs to the post.
- DEV uses the first image as `main_image`; any remaining images are appended to the article Markdown.
- Blob URLs must remain public because DEV articles reference them after publication.
- ButtonPost supports Vercel Blob **OIDC** (`VERCEL_OIDC_TOKEN + BLOB_STORE_ID`) and the legacy `BLOB_READ_WRITE_TOKEN`.
- On Vercel, OIDC is preferred: the rotating OIDC token is supplied by Vercel at runtime, while the connected Blob Store contributes `BLOB_STORE_ID`.
- The browser receives neither the OIDC token nor the Blob read/write token. ButtonPost exchanges the Publish key for a short-lived media-only ticket, then issues a constrained presigned upload.

Connect a **public** Blob store to the ButtonPost Vercel project. A correctly linked OIDC store should make `BLOB_STORE_ID` available to the project. Text-only X / DEV publishing continues to work without Blob storage.

## Architecture

```text
One source post + source images
             |
      +------+------+
      |             |
      v             v
 Server API      Local Runner
 X / DEV        Xiaohongshu
      \             /
       per-platform results
```

See [`docs/architecture.md`](docs/architecture.md), [`docs/media.md`](docs/media.md), and [`docs/platform-matrix.md`](docs/platform-matrix.md).

## Development

```bash
npm run typecheck
npm test
npm run build
```

The X + DEV API pipeline and Local Runner pairing/auth flow are verified. Xiaohongshu image-note publishing is now the first browser publisher integrated into `Publish everywhere`. See [`docs/local-runner.md`](docs/local-runner.md).

## Open-source references

ButtonPost's architecture is informed by Postiz and Wechatsync. See [`docs/upstream-notes.md`](docs/upstream-notes.md) for evaluated commits and licensing notes.

## License

AGPL-3.0. See [`LICENSE`](LICENSE).
