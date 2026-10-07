# ButtonPost Local Runner

The Local Runner is the execution bridge for platforms that need your own browser session, local files, QR login, or browser automation.

Phase 2 starts with a deliberately small contract:

- `GET /health` — discover the runner from ButtonPost Web.
- `POST /v1/echo` — verify pairing with a local-only runner token.
- `GET /v1/platforms/xiaohongshu/status` — validate a locally stored Xiaohongshu login.
- `POST /v1/platforms/xiaohongshu/login` — open local Chrome and wait for interactive login.
- `POST /v1/platforms/xiaohongshu/publish-note` — receive title/body/images from ButtonPost Web and publish through the local Chrome profile.
- `GET /v1/platforms/jike/status` — validate a locally stored Jike login.
- `POST /v1/platforms/jike/login` — open Jike Web in local Chrome and wait for interactive login.
- `POST /v1/platforms/jike/publish-post` — fill the Jike composer, upload optional JPEG/PNG images, then wait for manual Send.
- `GET /v1/platforms/learnblockchain/status` — validate a locally stored LearnBlockchain login.
- `POST /v1/platforms/learnblockchain/login` — open 登链社区 in local Chrome and wait for interactive login.
- `POST /v1/platforms/learnblockchain/publish-article` — open the signed-in article editor, fill title/Markdown/images when detected, then wait for manual publish.
- `GET /v1/platforms/indiehackers/status` — validate the saved Indie Hackers session through the protected new-post editor.
- `POST /v1/platforms/indiehackers/login` — open Indie Hackers sign-in locally and wait for authenticated `/post/new` access.
- `POST /v1/platforms/indiehackers/publish-post` — fill the new-post editor and wait for the user to submit manually.
- `POST /v1/publish` — reserved for future generic local routing.

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
# Optional. Default is false so publishing is visible.
BUTTONPOST_XHS_HEADLESS=false
# GitHub OAuth for LearnBlockchain can require multi-page/mobile verification.
BUTTONPOST_LBC_LOGIN_TIMEOUT_MINUTES=15
# Default false: fill the editor, then wait for you to review and click Publish.
BUTTONPOST_XHS_AUTO_PUBLISH=false
# Manual review window before ButtonPost gives up waiting.
BUTTONPOST_XHS_REVIEW_TIMEOUT_MINUTES=30
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

## Xiaohongshu image-note publishing

Select **Xiaohongshu · 小红书** in ButtonPost, attach at least one image, and click **Publish everywhere**.

The browser sends the selected images directly to the Local Runner as multipart data. They are written to a temporary local directory, used by Patchright/Chrome for upload, and deleted after the publish attempt. They are not proxied through Vercel.

Current MVP behavior:

- source title is mechanically limited to the first 20 characters for Xiaohongshu;
- Markdown source content is mechanically normalized to plain text;
- up to 9 images are accepted by ButtonPost, with a 25 MB per-image runner limit;
- publishing uses the connected local account profile;
- the Chrome window is visible by default;
- **review-before-publish is the default**: ButtonPost fills the post and then waits up to 30 minutes for you to edit hashtags/formatting and click Publish manually;
- set `BUTTONPOST_XHS_AUTO_PUBLISH=true` only when you explicitly want fully automatic publishing;
- success/failure is returned as a separate platform result.

Tags, scheduling, cover selection, video, and final-note URL lookup come later.


## Jike authentication

Jike uses the same local-session pattern as Xiaohongshu, with an independent Chrome profile:

```text
~/.buttonpost/profiles/jike/<account-name>
```

In ButtonPost Web:

1. connect Local Runner v0.4.0 or later;
2. choose a local account name;
3. click **Connect Jike**;
4. complete login in the Chrome window at `https://web.okjike.com/`;
5. ButtonPost closes the login window only after a positive logged-in UI marker is detected;
6. use **Check login** to validate the saved session later.

## Jike publishing

Select **Jike · 即刻** in ButtonPost and click **Publish everywhere**.

ButtonPost:

1. opens the saved Jike profile at `https://web.okjike.com/following`;
2. writes the same normalized source text into Jike's Lexical `contenteditable` using a synthetic paste event so paragraph breaks are preserved;
3. uploads selected JPEG/PNG images directly through the Local Runner (up to 9);
4. leaves Chrome open so you can select a circle and review text/images;
5. waits for **you** to click Jike's **发送** button;
6. listens for Jike's successful `POST /1.0/originalPosts/create` response as the primary confirmation; DOM/feed detection remains a fallback;
7. returns `published` (with a post URL when the API response contains the id) and updates Publication History.

The default review window is 30 minutes. Configure it with:

```bash
BUTTONPOST_JIKE_REVIEW_TIMEOUT_MINUTES=30
```

Jike publishing never sends its browser session or local image files through Vercel.


## LearnBlockchain authentication

Phase 4 starts the 登链社区 adapter with a non-publishing login lifecycle.

The browser profile is isolated at:

```text
~/.buttonpost/profiles/learnblockchain/<account-name>
```

In ButtonPost Web:

1. connect Local Runner v0.6.0 or later;
2. choose an account name;
3. click **Connect LearnBlockchain**;
4. complete login in the local Chrome window;
5. ButtonPost waits for a positive authenticated UI marker such as the **写文章** action or signed-in profile/avatar;
6. later use **Check login** to validate the saved session.

No article is created or published in this step. Once the login lifecycle is verified against the user's real account, the next increment will open the site's Markdown article editor, fill the source title/body, preserve review controls such as category/tags, and wait for manual publish.


### LearnBlockchain GitHub OAuth

LearnBlockchain's GitHub sign-in can navigate through or replace several browser pages and may pause for mobile/device verification. Runner v0.6.1+ tracks the entire persistent Chrome context rather than a single original page:

- GitHub OAuth tabs/windows are kept alive during verification;
- closing/replacing the initial LearnBlockchain page no longer cancels the login;
- OAuth pages are never treated as proof of LearnBlockchain authentication;
- login succeeds only after a page returns to `learnblockchain.cn` and a signed-in UI marker is visible;
- after confirmation, ButtonPost waits briefly for cookies/session storage to settle before closing Chrome.

The default login window is 15 minutes and can be changed with `BUTTONPOST_LBC_LOGIN_TIMEOUT_MINUTES`.


## LearnBlockchain article publishing

Runner v0.7.0 adds the first article-publishing MVP for 登链社区.

ButtonPost does not hard-code an editor URL. It opens the signed-in LearnBlockchain home page and follows the visible **写文章 / 发布文章 / 投稿** action so route changes are less brittle.

The flow is:

1. verify the saved LearnBlockchain session;
2. open the site's article editor;
3. fill the source title without rewriting it;
4. fill the original Markdown source;
5. if an image file input is detected, upload the selected local source images directly from the Local Runner;
6. leave article type, category, tags, cover, visibility, formatting, and final review to the user;
7. wait for the user to click the final Publish action;
8. primarily confirm success from `POST /api/post/article`; fall back to navigation to `/article/<id>`;
9. return the article id/URL to ButtonPost Publication History when available.

The default review window is 30 minutes:

```bash
BUTTONPOST_LBC_REVIEW_TIMEOUT_MINUTES=30
```

If the current LearnBlockchain editor no longer exposes a detectable image file input, ButtonPost keeps the text/title filled and explicitly asks the user to add the selected images manually before the final publish. The publish action is never clicked automatically in this MVP.


### LearnBlockchain CodeMirror compatibility

Runner v0.7.1 fixes the real LearnBlockchain editor shape observed in production: the visible Markdown editor is a CodeMirror 5 wrapper (`.CodeMirror`), not a directly fillable input.

ButtonPost now:

1. uses the CodeMirror instance directly when the wrapper exposes one;
2. otherwise focuses CodeMirror's internal textarea and inserts the complete Markdown through keyboard input;
3. never calls Playwright `fill()` on the outer CodeMirror `div`;
4. verifies that rendered editor content is non-empty before entering review mode.


### LearnBlockchain body images

Runner v0.7.2 stops treating the first generic file input as proof that an article image was inserted.

For every selected source image ButtonPost now:

1. targets an explicit editor upload action when the page exposes one;
2. otherwise ranks available file inputs and avoids likely cover/avatar inputs;
3. watches the page's upload responses for a persistent `img.learnblockchain.cn` URL;
4. checks whether LearnBlockchain inserted a Markdown/HTML image reference itself;
5. if the upload succeeded but the editor did not insert the reference, appends the Markdown image reference to the article body mechanically;
6. warns during review if an image could not be inserted, without auto-publishing.

This keeps the final article portable and avoids reporting an image as successful merely because `setInputFiles()` returned without throwing.


### LearnBlockchain direct body-image upload

Runner v0.7.3 uses the authenticated LearnBlockchain browser session to call the platform's own editor image upload endpoint directly:

```text
POST /image/upload
multipart field: file
```

The returned persistent image URL is then appended mechanically to the Markdown body as:

```md
![filename](https://...)
```

ButtonPost accepts both the newer CDN-style `img.learnblockchain.cn/...` response and the Tipask-compatible `/image/show/...` response. The existing toolbar/file-input automation remains only as a fallback for customized installations.


## Indie Hackers authentication and publishing

Runner v0.8.0 adds Indie Hackers as a Local Runner destination.

The browser profile is stored at:

```text
~/.buttonpost/profiles/indiehackers/<account-name>
```

Authentication is validated by access to the protected new-post editor at:

```text
https://www.indiehackers.com/post/new
```

The user enters Indie Hackers credentials directly on `indiehackers.com`; ButtonPost does not read or persist the password.

For publishing, ButtonPost:

1. verifies the saved Indie Hackers session;
2. opens the protected new-post editor;
3. discovers the visible title/body controls rather than depending on one hard-coded selector;
4. fills the same source title/body mechanically;
5. if the current editor exposes an image file input, attempts local image upload and otherwise leaves an explicit manual-review warning;
6. leaves group/topic/community context, links, formatting, images, and final submission to the user;
7. waits for the user to click the final **Post / Publish** action;
8. confirms success when the browser leaves `/post/new` for an Indie Hackers `/post/...` URL and returns that URL to Publication History.

The review timeout defaults to 30 minutes and can be changed with:

```bash
BUTTONPOST_IH_REVIEW_TIMEOUT_MINUTES=30
```

This MVP intentionally does not perform unattended community posting.


### Indie Hackers current-site compatibility (Runner v0.8.1)

The current Indie Hackers site no longer treats `/post/new` as a reliable login or composer URL; for some signed-in accounts it returns a 404 page.

ButtonPost now separates two concepts:

- **authenticated** — the Indie Hackers home page shows a signed-in account state;
- **postingAllowed** — the signed-in UI actually exposes a New Post / Create Post / Start a Discussion control.

The runner no longer navigates directly to `/post/new` for login checks or publishing. It starts from the real homepage, discovers the current posting entry from visible UI controls (including the navigation menu), and only then fills the detected editor.

If the account is signed in but no posting control is available, ButtonPost reports that the account is connected but posting access is not currently available. This is intentionally different from an authentication failure.
