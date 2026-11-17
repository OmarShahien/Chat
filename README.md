# Chat Web

Private real-time web messenger with Google sign-in, contacts, direct & group chats, voice notes, photo/file sharing, and per-chat passcode locks.

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

`npm run build` writes the deployable app to `dist/`.

## Deployment (GitHub Pages)

The site is published by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
from the `dist/` artifact.

> ### Required repository setting
>
> **Settings → Pages → Build and deployment → Source must be "GitHub Actions".**
>
> The repo root `index.html` is the *development* entry point; it loads
> `/src/main.tsx` (raw TypeScript) and only runs under `npm run dev`. If Pages is set
> to **"Deploy from a branch"**, it publishes that raw source instead of the build.
> The browser then fails to execute `src/main.tsx`, `#root` stays empty, and the site
> shows a **blank screen**.
>
> If Pages is left on branch mode, a deployment can still report success while the
> live site is broken. To catch that, the workflow verifies `dist/index.html` before
> publishing and checks the live URL afterwards.

### Verifying a deployment

```bash
curl -s https://omarshahien.github.io/Chat/ | grep assets/
```

The published HTML must reference `assets/index-*.js`. If it references
`src/main.tsx`, Pages is serving the branch instead of the build.

## Behaviour notes

### 1-time pictures

A view-once photo can be opened **once per viewer**: after it is shown the media
reference is dropped and the card switches to an "Opened" state, so it cannot be
reopened from the chat.

Web pages cannot truly prevent an OS-level screenshot. Inside a 1-time picture the
app blurs the image whenever the window loses focus (which is when screenshot
overlays appear), blocks the common capture shortcuts and the context menu, and
disables drag/save. This defeats casual capture but is not a hard guarantee —
only a native app can enforce that.

### Notifications

Desktop notifications are off by default and must be enabled in
**Settings → Notifications** (the browser asks for permission once). A
notification is raised only when a message arrives for a chat you are not
currently reading, or while the tab is in the background. The unread count is
also shown in the tab title.
