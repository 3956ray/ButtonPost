# Local Runner

ButtonPost uses a local runner for destinations that need browser automation, QR login, local media files, or a user's existing browser session.

## Why local

API publishers such as X and DEV can run on the ButtonPost server. Browser-driven platforms should not require uploading long-lived browser cookies to Vercel.

```text
https://buttonpost.vercel.app
            |
            | browser request
            v
http://127.0.0.1:27123
            |
            v
local platform adapter
```

Modern browsers gate local/loopback access behind local-network permissions. The runner answers CORS and private-network preflights, and the web client marks the request as targeting loopback when the browser supports that field.

## Pairing

Run:

```bash
npm run runner
```

The terminal prints a runner token. Paste that token into the Local Runner panel. ButtonPost verifies it with `POST /v1/echo`.

The token is stored in browser local storage and is never sent to ButtonPost's Vercel API.

## HTTP contract

### GET /health

No token required. Used only for local discovery.

### POST /v1/echo

Requires `Authorization: Bearer <runner-token>`. Used for pairing and connectivity testing.

### POST /v1/publish

Reserved for local publisher jobs. The Phase 2 foundation intentionally returns `501` until the first real adapter is installed.

## Security boundaries

- Default bind address is `127.0.0.1`, not `0.0.0.0`.
- Only configured web origins receive CORS access.
- Privileged endpoints require a timing-safe bearer-token check.
- Request bodies are capped at 1 MiB in the foundation server.
- Browser cookies and platform credentials remain local.

## Next: Xiaohongshu

Xiaohongshu authentication is the first real adapter capability.

- A named local account maps to a dedicated Chrome profile.
- **Connect Xiaohongshu** opens local Chrome in headed mode so the user can complete QR/login interactively.
- **Check login** opens the same profile in headless mode and verifies the creator publish page does not redirect back to login.
- No Xiaohongshu cookie or Chrome profile is sent to Vercel.

Publishing remains disabled until authentication is validated separately. The next increment adds image-note publishing before video support.

The browser behavior is independently implemented in Node.js using Patchright. The MIT-licensed `dreammis/social-auto-upload` Xiaohongshu flow is used as a reference for creator URLs, login-state checks, and the overall lifecycle.
