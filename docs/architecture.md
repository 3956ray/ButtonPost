# ButtonPost architecture

> Write once. Publish everywhere.

ButtonPost keeps one source post and sends it through platform adapters. Adapters may normalize formatting, upload media, authenticate, and translate the source model into a platform payload, but they do not rewrite the author's ideas into platform-specific variants.

## Core flow

```text
                         Source Post
                       title + Markdown
                              |
                 +------------+------------+
                 |                         |
                 v                         v
          Server publishers          Local publishers
             Vercel                   user's computer
                 |                         |
            X / DEV / ...            Local Runner
                                           |
                              +------------+------------+
                              |            |            |
                         Patchright     Extension      CLI
                              |            |            |
                         Xiaohongshu     Jike/...    Bilibili/...
                              |
                 per-platform publication result
```

## Source model

```ts
type SourcePost = {
  title: string
  content: string
}
```

Media and persistence are the next additions. Platform-specific content variants remain out of scope for the core model.

## Adapter contract

Every publisher exposes configuration status, validation, and publishing. Formatting is internal to the adapter. A failure on one destination must not prevent other destinations from publishing.

## Server vs local publishers

- Server publishers are preferred whenever a stable official API exists.
- Local publishers are used when a destination needs browser automation, QR login, local media, or a user's browser session.
- The Local Runner binds to `127.0.0.1` and is called by the ButtonPost page from the user's browser.
- Local platform cookies do not need to be uploaded to Vercel.

See [`local-runner.md`](local-runner.md).

## Security baseline

Server publisher credentials stay server-side. The MVP publish endpoint is protected by `BUTTONPOST_SECRET`.

Local publishers use a separate runner token. That token is stored in browser local storage and is sent only to the loopback runner. The runner rejects unknown web origins and does not bind to the LAN by default.

Both mechanisms are personal-MVP security boundaries, not the final account/authentication system.
