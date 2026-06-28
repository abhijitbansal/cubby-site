# cubby-site

The public companion website for **Cubby**, served at **<https://gotcubby.com>**.

This repo is plain static HTML/CSS hosted on **GitHub Pages**. It does two
jobs and nothing else:

1. **Human pages** — the marketing, privacy, and support pages App Store
   Connect links to (`/privacy.html`, `/support.html`).
2. **App ↔ domain glue** — the **Apple App Site Association (AASA)** file that
   makes Cubby's NFC/QR **Universal Links** (`https://gotcubby.com/b/<id>` and
   `/r/<id>`) open the app instead of Safari.

It holds **no inventory data**. Your bins, items, and photos live on-device in
the app — see [What the app is for](#what-the-app-is-for).

> This repo is intentionally **public** so free-tier GitHub Pages can serve it.
> The app source stays in a separate **private** repo — see
> [Associated iOS app repo](#associated-ios-app-repo).

---

## What the app is for

**Cubby** is a private, fully on-device inventory app for iPhone & iPad. The
problem it solves: a basement (or garage, or closet) full of identical storage
tubs where you can't remember which bin holds what.

- **Tag racks & bins** with an NFC tag and a printed QR label. Cubby writes the
  tag for you in one tap.
- **Tap or scan to open a bin** — hold the phone to its NFC tag (works from the
  lock screen, app closed), scan the QR, or type a short human code (`BIN-12`).
- **Add items with the camera** — on-device Vision suggests a name; a sharpness
  check rejects blurry shots.
- **Search across everything** — item names, notes, bins, and racks in one field.
- **Print your own labels** — lay out QR labels for whole racks and print over
  AirPrint.
- **Private by architecture** — no accounts, no cloud, no analytics. Optional
  sync uses the user's own iCloud.

Hierarchy is simply **racks → bins → items**. Requires iOS 26+; tap-to-open
needs NFC (iPhone), while QR + short codes work everywhere including iPad.

---

## How the site gets its content

There is **no build step, no generator, and no JavaScript** (the CSP sets
`script-src 'none'`). Every page is hand-authored static HTML that shares one
stylesheet and self-hosted fonts. To change the site you edit the HTML directly.

```
cubby-site/
├── index.html          # landing page — "what it does" / "how it works"
├── privacy.html        # privacy policy (linked from App Store Connect)
├── support.html        # FAQ + support email (linked from App Store Connect)
├── assets/
│   ├── style.css       # the single shared stylesheet
│   ├── icon.svg        # app/site icon, favicon, OG image
│   └── fonts/*.woff2   # self-hosted fonts (no third-party requests)
├── CNAME               # custom domain: gotcubby.com
├── .nojekyll           # disables Jekyll so /.well-known/ is published (critical)
├── .well-known/
│   └── apple-app-site-association   # the AASA (no extension, valid JSON)
└── DEPLOY.md           # full DNS + HTTPS + certificate runbook
```

### What the site does *not* serve

The `/b/<id>` and `/r/<id>` URLs are **Universal Links claimed by the app**, not
pages in this repo — there are no `b/` or `r/` directories, and those paths 404
in a browser by design. When the AASA is correctly served over HTTPS, iOS routes
those URLs straight into Cubby (handled by the app's `DeepLinkRouter`).

### Deploying / updating

GitHub Pages serves the repo root of `main`. Edit, commit, push — Pages
redeploys within a minute or two:

```bash
git add -A && git commit -m "docs: update site copy" && git push
```

First-time setup (DNS, the HTTPS certificate sequencing that gates Universal
Links, and on-device verification) is documented in detail in **[DEPLOY.md](DEPLOY.md)**.
Read it before debugging "tags don't open the app" — that's almost always the
TLS certificate not being live yet, not an app bug.

> Keep `.nojekyll` and `CNAME` forever. Deleting `.nojekyll` makes Jekyll strip
> `/.well-known/` (AASA 404s → Universal Links break); deleting `CNAME` drops the
> custom domain.

### Local preview

Serve over HTTP rather than `file://` so the CSP and relative paths behave:

```bash
python3 -m http.server 8000   # then open http://localhost:8000/
```

---

## Associated iOS app repo

| | |
|---|---|
| **App repo** | `abhijitbansal/cubby` (private) — local: `../cubby` |
| **App** | Cubby for iPhone & iPad (SwiftUI, XcodeGen) |
| **Bundle ID** | `com.abhijitbansal.Cubby` |
| **Team ID** | `XDTAU7RN57` |
| **This repo** | `abhijitbansal/cubby-site` (public) → <https://gotcubby.com> |

The two repos are coupled by a small contract that **must stay in sync** — a
mismatch silently breaks Universal Links:

| Site side (this repo) | App side (`cubby` repo) | Must match on |
|---|---|---|
| AASA `appIDs[0]` = `XDTAU7RN57.com.abhijitbansal.Cubby` | `Cubby.entitlements` → `applinks:gotcubby.com`; `project.yml` Team `XDTAU7RN57` | Team ID + bundle ID |
| AASA `components` = `/b/*`, `/r/*` | `DeepLinkRouter.swift` builds `/b/<uuid>` and `/r/<uuid>` on host `gotcubby.com` | host + path scheme |
| `CNAME` = `gotcubby.com` | `DeepLinkRouter.domain = "gotcubby.com"` | the domain string |
| `/privacy.html`, `/support.html` | URLs entered in App Store Connect | page paths |

The app also accepts a custom scheme (`cubby://b/<uuid>`, `cubby://r/<uuid>`) for
in-app routing; only the `https://gotcubby.com/...` form depends on this repo's
AASA.

> **If you change the app ID, Team ID, or link paths:** update the AASA here
> **and** the app's `Associated Domains` entitlement / `DeepLinkRouter` together,
> then re-run the verification steps in [DEPLOY.md §4](DEPLOY.md).

---

## License / ownership

© 2026 Abhijit Bansal. Support: <contact@abhijitbansal.com>.
