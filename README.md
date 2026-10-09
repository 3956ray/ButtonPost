# ButtonPost

**Write once. Post everywhere.**

ButtonPost is a personal-first, open-source multi-platform publishing tool. Write one source post, select destinations, press one button, and get an independent result for every platform.

The product is intentionally **not** a content-variant generator. Platform adapters can perform mechanical compatibility work (Markdown to plain text, HTML cleanup, media upload, field mapping), but the source content remains one post.

## Web-first MVP (no installation needed)

Visit [buttonpost.app](https://buttonpost.app), sign in, and connect X (OAuth) or DEV Community (personal API key) in **Connections**. Write your content, select connected destinations, and publish. **No Local Runner or command line is needed for X and DEV.**

For browser-based destinations (Xiaohongshu, Jike, LearnBlockchain), the optional Local Runner uses your existing Chrome login on your own computer. They become selectable only after both Runner pairing and platform login are verified. See [How to install the optional Runner](docs/runner-install.md) for portable Mac/Windows launchers, developer setup, and [AI-assisted installation](docs/agent-runner-setup.md).

Publishing results are tracked separately per platform. You can reuse previous content and prepare a **failed-only retry** from Publication History, which excludes already published destinations and requires a final click to publish again. This is important because an apparent network failure can still have published remotely.

## MVP functionality

The first runnable slice supports:

- **X** through the official X API, including up to 4 source images per first post and automatic reply threads when the source exceeds the single-post limit.
- **DEV Community** through the official Forem article API, including public source images and a cover image.
- Parallel publishing with per-platform published / draft / failed / skipped results.
- Authenticated, per-user X/DEV connections and encrypted stored credentials (Supabase).
- Publication history with per-platform results and failed-only retry preparation (browser-local storage).
- Optional local Chrome Runner for Xiaohongshu, Jike, and LearnBlockchain, with review-before-publish.

The Local Runner runs on your own computer without uploading browser cookies to Vercel. **You do not need it to publish from the web to X/DEV.** Runner downloads are produced by [GitHub Actions](.github/workflows/runner-release.yml) for signed-off release tags. They are portable, currently unsigned beta launchers—not yet native signed app installers.

## For contributors: run the full stack locally

Requires Node.js 22+. Ordinary cloud users do not need Node.js.

```bash
cp .env.example .env.local
npm install
npm run dev

# Optional, only for local/browser publishers:
# Google Chrome must be installed locally.
npm run runner
```

Open `http://localhost:3000`.

### Server environment (maintainers only)

Use [`.env.example`](.env.example) for current variables. Hosted end users **never** supply secrets or Node.js environment variables.

Key settings for a self-hosted ButtonPost server:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
BUTTONPOST_APP_URL=http://localhost:3000
BUTTONPOST_SECRET=...                       # server-side media ticket signing secret
BUTTONPOST_CREDENTIAL_ENCRYPTION_KEY=...    # AES-GCM key for encrypted platform credentials
X_API_KEY=...                               # your X OAuth application
X_API_SECRET=...
DEVTO_TAGS=ai,webdev
DEVTO_DRAFT_ONLY=true                       # create DEV drafts during initial testing
BLOB_STORE_ID=...                           # or BLOB_READ_WRITE_TOKEN
PADDLE_ENV=sandbox                          # Paddle is not live yet
```

Users connect X through OAuth and enter their DEV Community API key in **Connections**. Never commit secrets or ask users to paste them into public issues. Keep `DEVTO_DRAFT_ONLY=true` when first testing.

### Shared images for X + DEV

Local source images are uploaded directly from the browser to a **public Vercel Blob store** before server publishers run. This avoids pushing large image bodies through the ButtonPost server function.

- X fetches the Blob images server-side, uploads up to the first 4 to X Media, then attaches their media IDs to the post.
- DEV uses the first image as `main_image`; any remaining images are appended to the article Markdown.
- Blob URLs must remain public because DEV articles reference them after publication.
- ButtonPost supports Vercel Blob **OIDC** (`VERCEL_OIDC_TOKEN + BLOB_STORE_ID`) and the legacy `BLOB_READ_WRITE_TOKEN`.
- On Vercel, OIDC is preferred: the rotating OIDC token is supplied by Vercel at runtime, while the connected Blob Store contributes `BLOB_STORE_ID`.
- The browser receives neither the OIDC token nor the Blob read/write token. ButtonPost authenticates the user's Supabase session before issuing a short-lived media-only ticket and constrained presigned upload.

Connect a **public** Blob store to the ButtonPost Vercel project. A correctly linked OIDC store should make `BLOB_STORE_ID` available to the project. Text-only X / DEV publishing continues to work without Blob storage.

## Architecture

```text
One source post + source images
             |
      +------+------+
      |             |
      v             v
 Server API      Local Runner
 X / DEV       Xiaohongshu / Jike / LearnBlockchain
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

CI runs type checking, unit/integration tests and the production build. Portable Local Runner packages are validated separately on macOS and Windows. See [`docs/local-runner.md`](docs/local-runner.md) and [`docs/runner-install.md`](docs/runner-install.md).

## Open-source references

ButtonPost's architecture is informed by Postiz and Wechatsync. See [`docs/upstream-notes.md`](docs/upstream-notes.md) for evaluated commits and licensing notes.

## License

AGPL-3.0. See [`LICENSE`](LICENSE).


### Publish safety gate

Current hosted cloud publishing uses Supabase sign-in, per-user encrypted platform credentials and server-side authorization; it does not ask end users for a shared Publish key. The separate Local Runner uses a private token bound to the local computer. The portable launcher automatically pairs via a URL fragment on first start; the fragment is cleared from the browser address immediately. See [Runner security and setup](docs/runner-install.md).
