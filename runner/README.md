# ButtonPost Local Runner

The Local Runner is the execution bridge for platforms that need your own browser session, local files, QR login, or browser automation.

Phase 2 starts with a deliberately small contract:

- `GET /health` — discover the runner from ButtonPost Web.
- `POST /v1/echo` — verify pairing with a local-only runner token.
- `GET /v1/platforms/xiaohongshu/status` — validate a locally stored Xiaohongshu login.
- `POST /v1/platforms/xiaohongshu/login` — open local Chrome and wait for interactive login.
- `POST /v1/publish` — reserved for local platform publishing; currently returns `501`.

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

## Xiaohongshu authentication

After updating ButtonPost, run:

```bash
npm install
npm run runner
```

Google Chrome must be installed locally. ButtonPost uses Patchright with a dedicated Chrome profile under:

```text
~/.buttonpost/profiles/xiaohongshu/<account-name>
```

In ButtonPost Web:

1. connect the Local Runner;
2. choose an account name such as `default` or `main`;
3. click **Connect Xiaohongshu**;
4. finish login in the Chrome window that opens;
5. return to ButtonPost when the status becomes **Connected**.

No content is published during authentication.

The flow is independently implemented in Node.js while using the MIT-licensed `dreammis/social-auto-upload` project as a behavioral reference for login-state validation and creator-page navigation.

## Next

The next increment adds Xiaohongshu image-note publishing, including local image transfer, title/body/tags, progress, and result reporting.
