# Upstream references

ButtonPost is an independent repository whose design is informed by two open-source projects.

## Postiz

- Repository: `gitroomhq/postiz-app`
- Workspace evaluation baseline: `3964536`
- License: AGPL-3.0
- Useful concepts: provider registry, publication workflow, X and DEV integrations, scheduling, per-platform results, extension-backed providers.

## Wechatsync

- Repository: `wechatsync/Wechatsync`
- Workspace evaluation baseline: `a98e428` on `v2`
- Repository license: GPL-3.0
- Useful concepts: browser-authenticated publishing, adapter registry, per-platform preprocessing, image upload, extension/CLI bridge.

## Rule for ButtonPost

Do not copy upstream source casually. When code is actually reused, preserve the required copyright/license notices and document the origin at file or component level. New ButtonPost code should use ButtonPost's repository license unless a reused component requires different treatment.
