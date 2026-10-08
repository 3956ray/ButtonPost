# ButtonPost MVP beta acceptance checks

This checklist is the final release gate for the cloud-first MVP and the optional local helper. Automated CI and standalone ZIP smoke tests are **not substitutes** for authenticating real platform accounts and exercising the actual Chrome editor.

## Release gate A — zero-install cloud publishing

- [ ] In a fresh/incognito browser, open the production site while signed out. The primary action should be **Start publishing**, not **Install Runner**.
- [ ] Sign in, connect X through official OAuth, and publish a text-only post. Confirm the post appears in X and ButtonPost records its result.
- [ ] Connect DEV Community with a valid personal API key. Create a DEV draft first (`DEVTO_DRAFT_ONLY=true` in the test environment), then confirm the draft exists on DEV.
- [ ] Use the same source post for both X and DEV. Verify both statuses are independent and only one cloud publish batch is charged.
- [ ] With Runner completely offline, confirm X/DEV remain selectable and usable; local browser destinations are disabled and not preselected.
- [ ] On a narrow mobile screen, confirm sign-in and cloud composer remain operable without a local installation prompt blocking publication.

## Release gate B — safe failure recovery

- [ ] Induce a failure in one selected destination without breaking another. Both statuses must persist in Publication History.
- [ ] Click **Retry failed platforms** immediately from results and also from history. Only failed destinations should be selected; successful ones must not be selected again.
- [ ] Verify source title and body are restored. Original files can only be restored for the most recent in-session publish attempt; otherwise users must reattach media before retrying.
- [ ] The button must *not* send another request automatically. The user explicitly verifies the remote platform didn't publish despite a timeout and clicks **Publish everywhere** again.
- [ ] Refresh the page and use the history retry entry. Ensure a failed destination whose account has since disconnected is not silently reselected.
- [ ] `pending`, `reviewing`, `skipped`, `published`, and `draft` results are not considered eligible for automatic retry preparation.

## Release gate C — optional Runner on real user devices

Test with an **Apple Silicon Mac**, **Intel Mac** and **Windows 64-bit** machine. The GitHub Actions portable ZIP workflow already tests each packaged Node runtime and local HTTP contract independently of the repository, but the following steps require actual end-user GUI environments:

- [ ] Download the appropriate verified ZIP artifact from the same commit, confirm its SHA-256 checksum, and extract it outside the source repository.
- [ ] With Node.js and the ButtonPost source repository *absent* from the test machine, double-click the included `Start-ButtonPost-Runner` launcher. (Google Chrome is the only separate required application.)
- [ ] Verify the local server binds to `127.0.0.1:27123`; the browser opens ButtonPost on first run; the URL fragment is removed from the address bar; and `/v1/echo` pairs successfully.
- [ ] Start/stop the Runner twice. Verify its pairing token remains stable and the Chrome profile persists, without users needing to paste credentials again.
- [ ] Log into Xiaohongshu, Jike and LearnBlockchain individually. Verify each platform only becomes selectable after its own signed-in status check passes.
- [ ] Publish an image note on Xiaohongshu and a text/image post on Jike and LearnBlockchain, reviewing the filled Chrome editor before approving the final post. Confirm each result.
- [ ] Stop Runner and verify local checkboxes become unavailable on a fresh load while cloud publishing continues.
- [ ] Confirm OS security warnings are understandable. Do not ask users to globally disable Gatekeeper, SmartScreen, antivirus or browser private-network protections.
- [ ] Verify the app works when launched from a path containing whitespace and non-ASCII username characters.

## Release gate D — production-specific checks

- [ ] Confirm production Vercel site points to intended Supabase Auth and storage environment and opens sign-in / connections correctly.
- [ ] Ensure user tokens, Chrome cookies and pairing URL fragments never appear in public logs, GitHub issues or support screenshots.
- [ ] Confirm rate limits, account deletion and existing billing UX were not regressed. **Paddle Live remains explicitly out of scope** until approval.
- [ ] Check the production deploy's error logs following a controlled publish.
- [ ] Only after user-device checks pass, create a `runner-v*` tag from reviewed `main` and publish downloadable ZIPs via GitHub Releases. Portable builds are unsigned beta software, not native signed installers.

## Test evidence

Record for every scenario: date/time, operating system, browser version, device architecture, tested commit, pass/fail, reproduction steps, and sanitized screenshot/log. **Never attach passwords, bearer tokens, OAuth codes, session cookies or private pairing URLs.**

Project rule: no new publishing platform, scheduling, analytics, or Paddle Live change is needed to pass this release gate.
