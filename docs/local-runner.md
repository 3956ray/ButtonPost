# Local Runner

ButtonPost uses a local runner for destinations that need browser automation, QR login, local media files, or a user's existing browser session.

## Why local

API publishers such as X and DEV can run on the ButtonPost server. Browser-driven platforms should not require uploading long-lived browser cookies to Vercel.

```text
https://buttonpost.app
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

For users, install an optional [portable Mac/Windows Runner](runner-install.md) from a tested GitHub `runner-v*` release. On first start, the launcher opens ButtonPost with a fragment-only private pairing link. The browser removes the fragment immediately and stores the local token for subsequent visits.

For developers: `npm run runner` still works. The terminal prints a private token which can be entered in *Manual pairing*. The token persists in the user's local `~/.buttonpost/runner-token` file across restarts.

ButtonPost verifies the paired runner with `POST /v1/echo`.

The token is stored in browser local storage and is never sent to ButtonPost's Vercel API.

## HTTP contract

### GET /health

No token required. Used only for local discovery.

### POST /v1/echo

Requires `Authorization: Bearer <runner-token>`. Used for pairing and connectivity testing.

### POST /v1/platforms/xiaohongshu/publish-note

Requires the runner bearer token and multipart form data:

- `account`
- `title`
- `content`
- one or more `images`

The runner writes images to a temporary local directory, publishes through the connected Xiaohongshu Chrome profile, then deletes the temporary files.

### POST /v1/publish

Reserved for future generic local routing.

## Security boundaries

- Default bind address is `127.0.0.1`, not `0.0.0.0`.
- Only configured web origins receive CORS access.
- Privileged endpoints require a timing-safe bearer-token check.
- JSON request bodies are capped at 1 MiB. Xiaohongshu multipart publishing separately limits requests to 9 image files and 25 MB per image.
- Browser cookies and platform credentials remain local.

## Xiaohongshu

Xiaohongshu authentication is the first real adapter capability.

- A named local account maps to a dedicated Chrome profile.
- **Connect Xiaohongshu** opens local Chrome in headed mode so the user can complete QR/login interactively.
- **Check login** opens the same profile in headless mode and verifies the creator publish page does not redirect back to login.
- No Xiaohongshu cookie or Chrome profile is sent to Vercel.

After authentication is validated, ButtonPost Web can send title/body/images directly to the Local Runner and publish an image note through the same local Chrome profile. The first publishing tests run headed by default so browser behavior stays visible.

The browser behavior is independently implemented in Node.js using Patchright. The MIT-licensed `dreammis/social-auto-upload` Xiaohongshu flow is used as a reference for creator URLs, login-state checks, and the overall lifecycle.
