# Install ButtonPost Local Runner

**You do not need this helper to publish to X or DEV Community.** Just sign into [ButtonPost](https://buttonpost.app), connect your platform account, and publish from the website.

For browser-based platforms (Xiaohongshu, Jike, LearnBlockchain), ButtonPost uses an **optional local helper**. Your session cookies stay on your computer rather than being uploaded to ButtonPost's server.

## For non-developers: portable downloads (Mac / Windows)

1. Open [ButtonPost Runner GitHub Releases](https://github.com/3956ray/ButtonPost/releases).
2. Choose the latest **runner-v** release. Download the ZIP for your system:
   - Apple Silicon Mac (M1/M2/M3/M4 or later): **macos-arm64**
   - Intel Mac: **macos-x64**
   - Windows 64-bit: **windows-x64**
3. Extract the ZIP into a folder you control. Install Google Chrome if necessary.
4. Double-click **Start-ButtonPost-Runner.command** (Mac) or **Start-ButtonPost-Runner.cmd** (Windows).
5. On first start, your browser opens `https://buttonpost.app` with a **fragment-only pairing link**. ButtonPost immediately removes this fragment from the address bar and stores the local pairing secret only in browser storage. If your browser did not open, copy the *Pairing link* printed in the Runner window into the same browser where you use ButtonPost.
6. In ButtonPost, connect your local platform account once. Leave the Runner window open during publishing.

**Availability:** GitHub release packages appear only after a maintainer builds, smoke-tests and publishes a `runner-v*` release. Until then, use the developer setup below. A build workflow in `.github/workflows/runner-release.yml` prepares ZIP packages on macOS and Windows; it does not install software without your action.

### Important beta limitations

- These ZIPs are *portable launchers*, not signed/notarized Mac DMGs or Windows installers. Depending on OS security settings, you may need to explicitly approve running the downloaded file. Never disable system-wide protection.
- The helper runs locally on `127.0.0.1:27123` and only allows trusted ButtonPost origins; keep the window open while publishing. No background service is installed.
- The first run requires Google Chrome. Browser-based sites can change their editor and login behavior at any time.
- The token is saved at `~/.buttonpost/runner-token` (on Windows, inside your home directory's `.buttonpost` folder). Session profiles are saved under `~/.buttonpost/profiles`. Never share the token, pairing link, or profiles.
- The pairing secret is carried in a URL **fragment**, which is not transmitted in the HTTP request to ButtonPost, but it is visible briefly in your address bar and may be visible to installed browser extensions. The page clears it immediately after loading. Use a trusted browser.
- Auto-pair is a *first-run convenience*, not permission to automate posting. Platform publishing still uses review-before-send where supported.

## For developers / early testers

Requires Node.js 22+, Git, and Google Chrome:

```bash
git clone https://github.com/3956ray/ButtonPost.git
cd ButtonPost
npm install
npm run runner
```

The CLI starts a runner with a **persistent** private token. Copy the token printed in the terminal into the *Manual pairing / developer setup* area of ButtonPost Web. You only need to do this once per browser profile.

### Updates

For a newer portable release, close Runner, download/extract the new ZIP and start it. Your tokens and Chrome session profiles are outside the application folder and remain intact.

## For AI-agent users

Read [Agent-assisted setup instructions](agent-runner-setup.md). An agent with authorized **local computer/terminal access** can install and test the helper. A chat-only agent cannot run commands on your computer. Do not paste platform passwords, session cookies, token files, or private pairing links into an AI chat.

## Troubleshooting

If pairing fails, check Chrome availability, ensure the runner window is open, allow your browser's local network/loopback permission, and visit `http://127.0.0.1:27123/health` (should display `ok: true`). Do not expose the runner on `0.0.0.0`.

If a browser platform is disabled in ButtonPost, verify that both the local Runner and the platform login have been connected. X/DEV still work independently of the Runner.
