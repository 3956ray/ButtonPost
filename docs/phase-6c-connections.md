# Phase 6C — Per-user X / DEV connections

ButtonPost no longer treats deployment-level X/DEV user credentials as the publishing identity.

## X

ButtonPost uses the existing X application consumer key/secret:

```env
X_API_KEY=
X_API_SECRET=
```

Users authorize ButtonPost through X's 3-legged OAuth 1.0a flow. Configure the X Developer App with this production callback URL:

```text
https://buttonpost.vercel.app/api/connections/x/callback
```

For a dedicated preview test, add that preview deployment's exact callback URL temporarily.

The resulting user access token and access secret are AES-256-GCM encrypted before they are written to `platform_secrets`.

## DEV Community

DEV publishing still uses a user-generated API key. Users create it in DEV Settings → Extensions, then paste it into ButtonPost Connections.

ButtonPost verifies the key with:

```text
GET https://dev.to/api/users/me
Accept: application/vnd.forem.api-v1+json
api-key: <user key>
```

The verified key is then encrypted before storage.

## Publish authorization

`POST /api/publish` and `POST /api/media/ticket` now require a valid Supabase user session. The old browser-entered Publish key is removed from the product UI.

`BUTTONPOST_SECRET` remains server-only as an HMAC signer for short-lived Vercel Blob upload tickets; it is no longer a shared user credential.
