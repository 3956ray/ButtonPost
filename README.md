# ButtonPost

**Write once. Publish everywhere.**

ButtonPost is a personal-first, open-source multi-platform publishing tool. Write one source post, select destinations, press one button, and get an independent result for every platform.

The product is intentionally **not** a content-variant generator. Platform adapters can perform mechanical compatibility work (Markdown to plain text, HTML cleanup, media upload, field mapping), but the source content remains one post.

## MVP status

The first runnable slice supports:

- **X** through the official X API v2 create-post endpoint.
- **DEV Community** through the official Forem article API.
- Parallel publishing with per-platform success / failure / skipped results.
- A server-side publish key so a deployed personal instance is not an open publishing endpoint.

Next targets: 即刻, 登链社区, Indie Hackers through a local browser-extension runtime.

## Local setup

Requires Node.js 22+.

```bash
cp .env.example .env.local
npm install
npm run dev
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
```

`X_USER_ACCESS_TOKEN` must be an OAuth 2.0 **user-context** token allowed to create posts; the application-only Bearer Token will be rejected. For the quickest manual test, configure OAuth 1.0a with `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, and `X_ACCESS_TOKEN_SECRET`. `DEVTO_API_KEY` must belong to the DEV author account.

For safe DEV testing, set `DEVTO_DRAFT_ONLY=true` before clicking Publish Everywhere.

## Architecture

```text
One source post
      |
      v
Publisher registry
   /       \
X API     DEV API
   \       /
 per-platform results
```

See [`docs/architecture.md`](docs/architecture.md) and [`docs/platform-matrix.md`](docs/platform-matrix.md).

## Development

```bash
npm run typecheck
npm test
npm run build
```

The repository intentionally starts small. Persistence, media upload, account OAuth, scheduling, and the browser publisher are added only after the base publish pipeline is verified.

## Open-source references

ButtonPost's architecture is informed by Postiz and Wechatsync. See [`docs/upstream-notes.md`](docs/upstream-notes.md) for evaluated commits and licensing notes.

## License

AGPL-3.0. See [`LICENSE`](LICENSE).
