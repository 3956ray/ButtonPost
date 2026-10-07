# Local authentication model

ButtonPost treats authentication as a local interactive workflow rather than a platform-specific credential import.

## Rules

- Credentials are entered only into the platform or wallet UI inside local Chrome.
- ButtonPost does not request, read, transmit, or persist passwords, SMS codes, wallet seed phrases, private keys, or wallet approval signatures.
- ButtonPost persists the browser session/profile so a successful login can be reused.
- A provider page is never treated as proof of platform authentication. Success is confirmed only after the target platform itself shows a signed-in state.
- OAuth, QR, device verification, and wallet popups may open or replace multiple pages; the Local Runner follows the entire browser context.

## LearnBlockchain / 登链社区

The current login surface supports multiple paths:

| Login method | ButtonPost local-profile support | Notes |
| --- | --- | --- |
| GitHub | Yes | Multi-page OAuth/device verification is kept alive until callback completes. |
| Email + password | Yes | User types credentials directly into LearnBlockchain. |
| Phone + verification code | Yes | User completes verification directly in LearnBlockchain. |
| WeChat QR | Yes | User scans/approves; Runner waits for the target site to become authenticated. |
| MetaMask | Yes, with profile setup | MetaMask must be installed and unlocked in the dedicated ButtonPost Chrome profile. User approves connection/signature in MetaMask. |

The profile is stored under:

```text
~/.buttonpost/profiles/learnblockchain/<account-name>
```

### Why not reuse the user's normal Chrome profile by default?

ButtonPost deliberately isolates automation from the user's everyday browser because a normal Chrome profile may contain unrelated sessions, extensions, history, and secrets, and Chrome does not support concurrent automation against the same user-data directory safely.

A future **Browser Bridge** mode can attach to an already-open user Chrome profile for people who explicitly want to reuse an existing MetaMask installation. That mode should be opt-in and separate from the safer managed-profile default.
