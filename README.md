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

## Database rules (required for multiplayer games)

`database.rules.json` is the source of truth for the Firebase Realtime Database
rules; `firebase.json` / `.firebaserc` point the CLI at the `chatt-cdbf2` project.

> **In-chat games need these rules deployed.**
>
> A game lives at `messages/<chatId>/<messageId>/game`, and that message is
> *created by the host*. If the rules only let a message's sender write it, the
> second player can never claim a seat or make a move — the host can play alone
> and the join silently fails. The rules here grant any **chat member** write
> access to the per-message subtrees the app actually uses (receipts, reactions,
> votes, stars, deleted-for-me, view-once openings and `game`).

Deploy them with:

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only database --project chatt-cdbf2
```

Or paste the contents of `database.rules.json` into
**Firebase Console → Realtime Database → Rules → Publish**.

The join flow now reports *why* it failed (`seat-taken`, `finished`, `denied`,
…) instead of doing nothing, so if a join is refused the toast names the cause.
