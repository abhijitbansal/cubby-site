# Deploying the Cubby site (gotcubby.com) by hand

This is the companion static site for Cubby. It serves three jobs:

1. The marketing / privacy / support pages (App Store Connect links to
   `https://gotcubby.com/privacy.html` and `https://gotcubby.com/support.html`).
2. The **Apple App Site Association (AASA)** file at
   `https://gotcubby.com/.well-known/apple-app-site-association`, which is what
   makes **Universal Links** (`https://gotcubby.com/b/<id>` and `/r/<id>`) open
   the app instead of Safari.
3. The apex custom domain itself.

It is hosted on **GitHub Pages** from a **public** repo (`abhijitbansal/cubby-site`).
The app code repo can stay private; free-tier Pages needs the *site* repo to be public.

> **The single most important thing in this document:** Universal Links / AASA
> will **not** work until HTTPS is fully live on the apex domain with a valid
> Let's Encrypt certificate **and the AASA is served over HTTPS with no
> redirect**. The certificate can take **up to ~24 hours** to issue after DNS
> resolves. During that window the app's tag-tap behaviour is *expected* to
> fail — see [§3](#3-https--certificate-sequencing-read-this-before-you-debug-the-app).
> Do not waste time debugging the app while you are really just waiting on the cert.

Files in this directory that exist specifically for deployment:

| File | Why it must be there |
|---|---|
| `CNAME` | Contains exactly `gotcubby.com`. Tells GitHub Pages the custom domain. |
| `.nojekyll` | **Critical.** Disables Jekyll. Jekyll strips files/dirs starting with a dot or underscore — without this, `/.well-known/` is deleted from the published site and the AASA 404s. |
| `.well-known/apple-app-site-association` | The AASA. **No file extension.** Valid JSON. |

---

## 1. DNS at the registrar (point the apex at GitHub Pages)

Log in to wherever `gotcubby.com` is registered and open its DNS records.

### 1a. Apex A records (IPv4) — VERIFIED against GitHub's docs

> Source verified on 2026-06-28 from
> <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>.
> Re-check this page before you create the records — GitHub does occasionally
> rotate these IPs, and stale IPs are a classic cause of a dead custom domain.

Create **four** `A` records on the apex (host `@`, i.e. `gotcubby.com`):

```
@   A   185.199.108.153
@   A   185.199.109.153
@   A   185.199.110.153
@   A   185.199.111.153
```

### 1b. Apex AAAA records (IPv6) — recommended

Create the matching **four** `AAAA` records on the apex (host `@`):

```
@   AAAA   2606:50c0:8000::153
@   AAAA   2606:50c0:8001::153
@   AAAA   2606:50c0:8002::153
@   AAAA   2606:50c0:8003::153
```

### 1c. `www` subdomain CNAME — optional

If you want `www.gotcubby.com` to work too, point it at the GitHub Pages user
host (NOT at the apex):

```
www   CNAME   abhijitbansal.github.io.
```

GitHub will then redirect between apex and `www` automatically once the domain
is configured. (Do not put a CNAME on the apex `@` itself — apex CNAMEs are
invalid; that's exactly why the apex uses A/AAAA records above.)

### 1d. Watch out for

- **Existing conflicting records.** Delete any old `A`, `AAAA`, `CNAME`, or
  parking-page / forwarding records on `@` and `www` before adding these.
  Registrar "domain forwarding" / "web forwarding" features will hijack the
  apex — turn them off.
- **TTL.** Lower the TTL (e.g. 300–600s) before changing records if you can, so
  mistakes are cheap to fix.
- **Propagation.** DNS changes can take minutes to a few hours to be visible
  globally. Verify with:

  ```bash
  dig +short gotcubby.com A
  dig +short gotcubby.com AAAA
  # expect the four 185.199.x.153 and four 2606:50c0:800x::153 addresses
  ```

---

## 2. GitHub Pages setup

### 2a. Push the site repo

This `cubby-site/` directory is the source of truth. Publish its **contents**
(not the parent `cubby/` repo) to a public repo named `cubby-site`.

```bash
# from inside this directory: /Users/abhijitbansal/projects/cubby/cubby-site
git init
git add -A          # includes .nojekyll, CNAME, and .well-known/ (all tracked)
git commit -m "chore: cubby companion site + AASA"
git branch -M main
gh repo create abhijitbansal/cubby-site --public --source=. --remote=origin --push
# or, if the repo already exists:
#   git remote add origin git@github.com:abhijitbansal/cubby-site.git
#   git push -u origin main
```

> Sanity-check before pushing that the dotfiles are actually staged — they are
> easy to miss:
>
> ```bash
> git ls-files | grep -E 'nojekyll|well-known'
> # must list .nojekyll and .well-known/apple-app-site-association
> ```

### 2b. Turn on Pages

In the browser: **github.com/abhijitbansal/cubby-site → Settings → Pages**.

1. **Build and deployment → Source:** "Deploy from a branch".
2. **Branch:** `main`, folder `/ (root)`. Save.
3. **Custom domain:** because the repo contains a `CNAME` file, GitHub should
   auto-populate `gotcubby.com` here. If it's blank, type `gotcubby.com` and
   Save (GitHub will commit/refresh the `CNAME` file to match).
4. GitHub runs a **DNS check** against the domain. Once your records from §1
   have propagated, this shows a green "DNS check successful".

### 2c. Confirm the plain site is up (HTTP first)

Before worrying about HTTPS, confirm Pages is serving the content at all:

```bash
curl -sI http://gotcubby.com/ | head -n 1     # expect: HTTP/1.1 200 (or a redirect to https once the cert exists)
```

---

## 3. HTTPS / certificate sequencing (READ THIS BEFORE YOU DEBUG THE APP)

**This is the part that trips everyone up. Universal Links depend on it.**

The order of operations is strict and partly out of your hands:

1. DNS must resolve to GitHub's IPs (§1) **first**.
2. **Only then** does GitHub ask Let's Encrypt to issue a certificate for
   `gotcubby.com`. This is automatic — you don't do anything — but it can take
   **anywhere from a few minutes to ~24 hours**.
3. Until that certificate is issued, in **Settings → Pages** the
   **"Enforce HTTPS" checkbox stays greyed out / disabled.** That greyed-out
   checkbox is your live status indicator: *cert not ready yet.*
4. When the cert is issued, "Enforce HTTPS" becomes enableable. **Enable it.**
   Now `http://` requests 301-redirect to `https://`, and `https://gotcubby.com`
   serves with a valid cert.

### Why this gates the whole app

- iOS fetches the **AASA over HTTPS only.** No valid cert → iOS can't fetch the
  AASA → the `applinks:gotcubby.com` entitlement never associates → tapping an
  NFC tag or a `https://gotcubby.com/b/<id>` link opens **Safari**, not Cubby.
- `.com` is **not** in the HSTS preload list the way `.app` domains are (every
  `.app` is HTTPS-only and preloaded by design). For `.com` you must make sure
  HTTPS is actually live and enforced yourself — **HTTPS is still required for
  AASA either way.** Don't assume the `.com` "just works" over plain HTTP; it
  won't for Universal Links.

### The practical rule

> If the app isn't opening from tags, **first check whether the cert is live**
> (is "Enforce HTTPS" still greyed out? does `curl -sI https://gotcubby.com/`
> succeed?). If the cert isn't ready, **stop** — there is nothing to fix in the
> app or the entitlements yet. Wait, re-check, and only debug the app after
> HTTPS is confirmed live.

If the cert seems stuck for well over 24h after DNS is correct: in
Settings → Pages, remove the custom domain, Save, re-add `gotcubby.com`, Save.
That re-triggers certificate provisioning. (Verify DNS is still correct first.)

---

## 4. Verification

### 4a. Verify the AASA is served correctly

This is the single command that tells you whether Universal Links can work:

```bash
curl -sviL https://gotcubby.com/.well-known/apple-app-site-association 2>&1 | sed -n '1,40p'
```

A **correct** response means **all** of the following:

- **HTTP 200** (not 404, not 301/302). Use `-I`/verbose to confirm there is **no
  redirect** — the AASA must be served directly over HTTPS at this exact path.
  (`-L` above would follow a redirect; if you see a `Location:` hop to reach it,
  that's a problem — fix it so the path returns 200 directly.)
- Fetched over **HTTPS** with a **valid certificate** (curl does not print a TLS
  error). If you must, `curl -v` and confirm the TLS handshake succeeds.
- The **body is valid JSON** and exactly matches the committed file:

  ```json
  {
    "applinks": {
      "details": [
        {
          "appIDs": ["XDTAU7RN57.com.abhijitbansal.Cubby"],
          "components": [
            { "/": "/b/*" },
            { "/": "/r/*" }
          ]
        }
      ]
    }
  }
  ```

- **Content-Type does not matter on modern iOS.** GitHub Pages serves this file
  with `application/octet-stream` (no extension), and that is fine — current iOS
  does not require `application/json` for the AASA. Do not chase the content-type.

Pipe it through a JSON parser to be sure the body parses:

```bash
curl -s https://gotcubby.com/.well-known/apple-app-site-association | python3 -m json.tool
# should pretty-print the JSON above with no error
```

Quick checklist for the AASA response:

| Check | Must be |
|---|---|
| Status | `200` |
| Scheme | `https` with valid cert |
| Redirect to reach the path | none (direct 200) |
| Body | valid JSON, matches committed file |
| `appIDs[0]` | `XDTAU7RN57.com.abhijitbansal.Cubby` |
| `components` paths | `/b/*` and `/r/*` |
| Content-Type | irrelevant on modern iOS |

Also confirm the human-facing pages App Store Connect will link:

```bash
curl -sI https://gotcubby.com/privacy.html | head -n 1   # HTTP/2 200
curl -sI https://gotcubby.com/support.html | head -n 1   # HTTP/2 200
```

### 4b. Confirm the association on-device (developer mode)

Once the cert is live and 4a passes, verify the app side on a real device
(NFC/Universal Links don't work in the Simulator):

1. Build/install Cubby on the device with the
   `Associated Domains` entitlement containing **`applinks:gotcubby.com`**.
2. For testing, temporarily use the developer-mode form, which **bypasses
   Apple's AASA CDN cache** (Apple normally caches the AASA via its CDN, so a
   freshly published file may not be picked up for hours otherwise):

   ```
   applinks:gotcubby.com?mode=developer
   ```

   On the device, enable **Settings → Developer → Associated Domains
   Development** (Developer menu appears once the device is in developer mode).
3. Test the link resolution:
   - In Notes/Messages, tap a link like `https://gotcubby.com/b/<some-uuid>` —
     it should open **Cubby** (routed through `DeepLinkRouter`), not Safari.
   - Tap a written NFC tag (whose NDEF URI is `https://gotcubby.com/b/<uuid>`)
     with the app closed — it should cold-launch straight into the bin.
   - A QR encoding the same URL, scanned in-app, should resolve identically.
4. If links still open Safari **after** 4a passes and HTTPS is enforced:
   - Confirm the entitlement host matches the AASA host and the tag host
     **exactly** (`gotcubby.com`, no `www`, no trailing path differences).
   - Remember the CDN cache: without `?mode=developer`, allow time for Apple's
     CDN to pick up the AASA, or delete + reinstall the app to force a re-fetch.
   - Re-run 4a — a regressed cert or a sneaky redirect breaks association.

> Before shipping to the App Store, switch the entitlement back from
> `applinks:gotcubby.com?mode=developer` to plain `applinks:gotcubby.com`.
> `?mode=developer` is for local testing only.

---

## 5. Updating the site later

Edit files here, commit, and push to `main`; GitHub Pages redeploys
automatically within a minute or two.

```bash
git add -A && git commit -m "docs: update site copy" && git push
```

If you ever change the **app ID, Team ID, or the link path scheme**, update
`.well-known/apple-app-site-association` here **and** the app's
`Associated Domains` entitlement together, then re-run all of §4. A mismatch
between the two silently breaks Universal Links.

> Keep `.nojekyll` and `CNAME` in the repo forever. Deleting either one will
> break the site (`CNAME`) or the AASA (`.nojekyll` → `/.well-known/` stripped).
