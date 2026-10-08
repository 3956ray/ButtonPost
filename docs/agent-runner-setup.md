# ButtonPost · AI-assisted Local Runner setup

This is an optional workflow for **local coding agents** (such as Codex Desktop or an agent with approved terminal access). A chatbot without device access should guide the user, not pretend it installed something.

## Copy to your local AI agent

> Help me set up ButtonPost Local Runner from https://github.com/3956ray/ButtonPost on my personal computer.
>
> First verify that the repository belongs to `3956ray` and inspect `docs/runner-install.md`, the release contents, and the published SHA-256 checksum. Explain what you plan to download or execute before requesting my permission.
>
> Prefer a verified GitHub `runner-v*` portable release matching my CPU and OS. Do not run a remote `curl | sh` command, bypass Gatekeeper/SmartScreen, change firewall settings, request admin rights, or turn off security controls. If no release exists, use the documented Node.js 22 developer workflow only with my permission.
>
> Install Google Chrome if missing, but ask before making changes. Keep all browser session profiles and the runner token on my computer; never display, upload, paste, or commit them to a chat, repository or remote server. The ButtonPost launcher uses a URL fragment on first start to pair locally with https://buttonpost.app.
>
> Run the helper on `127.0.0.1:27123`. Verify `/health` and help me sign into the platform through the opened browser. Do **not** publish content without my final confirmation. Report what succeeded and the specific setup step needing my input.

This prompt deliberately requires user approval for local changes. A generic share link to an AI chat cannot install software by itself.
