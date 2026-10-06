# ButtonPost architecture

> Write once. Publish everywhere.

ButtonPost keeps one source post and sends it through platform adapters. Adapters may normalize formatting, upload media, authenticate, and translate the source model into a platform payload, but they do not rewrite the author's ideas into platform-specific variants.

## Core flow

```text
Source Post
  title + Markdown + media
          |
          v
Platform registry
          |
    +-----+-----+
    |           |
 API adapter   Browser adapter
    |           |
 X / DEV      Jike / LearnBlockchain / others
    |           |
    +-----+-----+
          |
          v
Per-platform publication result
```

## Source model

The MVP deliberately keeps the model small:

```ts
type SourcePost = {
  title: string
  content: string
}
```

Media and persistence are the next additions. Platform-specific content variants are explicitly out of scope for the core model.

## Adapter contract

Every publisher exposes configuration status, validation, and publhing. Formatting is internal to the adapter. A failure on one destination must not prevent other destinations from publishing.

## API vs browser publishers

- API publishers are preferred whenever a stable official API exists.
- Browser publishers will run through a local Chrome extension and the user's own authenticated browser session.
- Browser support is planned after the X + DEV API path proves the end-to-end workflow.

## Security baseline

Publisher credentials stay server-side. The MVP publish endpoint is protected by `BUTTONPOST_SECRET`; production refuses publishing if that variable is missing. This is temporary protection for a personal MVP, not the final authentication system.
