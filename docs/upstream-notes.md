# Upstream references

ButtonPost is an independent repository whose design is informed by open-source projects and commercial publishing products.

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

## social-auto-upload

- Repository: `dreammis/social-auto-upload`
- Evaluation baseline: `0012d2c` on `main`
- License: MIT
- Useful concepts: Patchright browser automation, QR login, storage-state/cookie validation, local media upload, scheduled publishing, account isolation, unified CLI/Skill contracts.
- The first ButtonPost Local Runner adapter will use its Xiaohongshu implementation as a reference. If source is copied rather than independently reimplemented, preserve the MIT copyright and permission notice.

## Commercial benchmark

- `yixiaoer.cn` is used as a product benchmark for mature Chinese multi-platform workflows such as account management, batch publishing, scheduling, materials, task status, and team features.
- Commercial product behavior is not treated as an implementation source.

## Rule for ButtonPost

Do not copy upstream source casually. When code is actually reused, preserve the required copyright/license notices and document the origin at file or component level. New ButtonPost code should use ButtonPost's repository license unless a reused component requires different treatment.
