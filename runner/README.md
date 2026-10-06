# ButtonPost Local Runner

The Local Runner is the execution bridge for platforms that need your own browser session, local files, QR login, or browser automation.

Phase 2 starts with a deliberately small contract:

- `GET /health` — discover the runner from ButtonPost Web.
- `POST /v1/echo` — verify pairing with a local-only runner token.
- `POST /v1/publish` — reserved for local platform adapters; currently returns `501`.

## Start

From the ButtonPost repository root:

```bash
npm run runner
```

The runner listens on:

```text
http://127.0.0.1:27123
```

It prints a one-time token when it starts. Paste that token into the **Local Runner** panel in ButtonPost and click **Connect runner**.

The token is stored in your browser's local storage. It is not sent to the ButtonPost Vercel backend.

## Optional environment variables

```bash
BUTTONPOST_RUNNER_HOST=127.0.0.1
BUTTONPOST_RUNNER_PORT=27123
BUTTONPOST_RUNNER_TOKEN=choose-a-stable-local-token
BUTTONPOST_ALLOWED_ORIGINS=https://buttonpost.vercel.app,http://localhost:3000
```

If you set `BUTTONPOST_RUNNER_TOKEN`, the same token can be reused after restarts.

## Security

The runner binds to loopback by default, rejects unknown browser origins, requires a bearer token for privileged endpoints, and opts into browser private-network preflights.

Do not bind the runner to `0.0.0.0` unless you understand the network exposure.

## Next adapter

The first real local publisher will be Xiaohongshu. Its browser flow will be informed by the MIT-licensed `dreammis/social-auto-upload` implementation, especially its QR login, cookie validation, Patchright browser flow, media upload, and scheduling patterns.
