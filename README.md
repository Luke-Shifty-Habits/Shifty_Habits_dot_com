# Shifty Habits — website

The marketing site for **Shifty Habits**, a habit tracker for shift workers that
follows a rotating roster or repeating cycle instead of a fixed calendar week.

- **Live site:** https://shiftyhabits.com/
- **The app on Google Play:** https://play.google.com/store/apps/details?id=com.shiftyhabits.app

This repository holds **only the website**. The app itself lives in a separate,
private repository — bug reports about the app belong on Google Play or at
ShiftyHabits@gmail.com, not in this issue tracker.

## What's here

Hand-written static HTML and CSS. There is no build step, no framework, no
package manager and no JavaScript at all — open `index.html` in a browser and
what you see is what ships.

```
index.html      the landing page
guides/         one directory per guide, each an index.html so the URL is clean
privacy/        the app's privacy policy, linked from the app and Play Console
about/          the author page every guide byline links to (Person JSON-LD, @id …/about/#luke)
styles.css      all styling; dark-only (see "Light mode"), custom properties at the top
favicon.ico     the app icon at 16/32/48px, for browser tabs and Google's search results
site.webmanifest  names the 192/512px icons for Android's "Add to home screen"
images/         WebP screenshots, the Open Graph card, the Apple touch icon
robots.txt      opens the site to search and AI crawlers alike; points at the sitemap
sitemap.xml     every page, for Google Search Console
7c3e9a41….txt   the IndexNow key; see "Telling search engines about changes"
llms.txt        a plain-language summary for AI assistants (llmstxt.org convention)
.nojekyll       tells GitHub Pages to serve the files as-is
```

Each guide lives at `guides/<slug>/index.html` rather than `guides/<slug>.html`, so
the served URL is `/guides/<slug>/` with no extension.

**Every guide credits Luke the same way**: the byline and the author note link
to `about/`, and the Article JSON-LD `author` carries `"@id":
"https://shiftyhabits.com/about/#luke"` plus the Play developer page and LinkedIn in `sameAs`.
Copy an existing guide's head and foot to keep that intact. Health claims
(sleep, light, caffeine) should link a published source inline and in a
`Sources` section, mirrored in the Article's `citation` array; the night shift
guide is the worked example.

**A new guide has to be added in four places**, or it is invisible: the
`guides/` hub list, the landing page's `#guides` section, `sitemap.xml`, and
`llms.txt`. If it answers a question searchers ask, add that question to the
"Questions shift workers ask" list at the bottom of the hub too. Nothing enforces this — there is no build step to check it — so the
validation script in the commit history is worth re-running after any change.
It checks HTML nesting, JSON-LD validity, FAQ parity, canonical-to-sitemap
agreement and every local link.

Since there is no templating, the header and footer are copy-pasted into every
page. That is the accepted cost of having no build step; if the site grows past
a dozen pages, that trade stops being worth it.

## The icon

Every icon on the site is the app's own launcher icon, the red/teal crescent and
clock: `assets/images/icon.png` in the app repo. A blue/amber version ("Variant
C") is being A/B tested on the Play listing, so if that wins, regenerate these
from the new icon and swap them in:

- `favicon.ico` (16, 32 and 48px) and `images/icon-192.png`, linked from every page
- `images/icon-512.png`, used only by `site.webmanifest`
- `images/logo-mark.png` (64px), the header's brand mark, set in `styles.css`
- `images/apple-touch-icon.png` (180px), deliberately left square and opaque, since
  iOS rounds the corners itself and fills any transparency with black
- `images/og-card.jpg`, the social preview card, which shows the icon too

The source icon is a full square with black corners outside the rounded tile and
no transparency. Every size except the Apple one gets a rounded mask, radius
about 20% of the width, so those corners don't show as black.

## The privacy policy

`privacy/index.html` **is** the app's privacy policy: the page the app's
Settings, About screen and consent sheet open, and the URL registered in Play
Console. It used to live as `PRIVACY.md` in the app repo with a Google Doc as
the published copy; it moved here so there is one text, publicly versioned, and
nothing to paste between the two.

Everything it says is a claim the app's code has to keep true, so **a change to
what the app collects, sends or reads is a change to this page**, landed
alongside the app change and with the "Last updated" date moved. The privacy
section on the landing page and the privacy block in `llms.txt` summarise it,
so edit them in the same pass.

App builds released before the move still open the Google Doc and can't be
updated, so that document must stay shared. It now just points here.

## Light mode: there isn't one

**The site is dark-only.** `styles.css` defines a single palette in `:root`
and has no `@media (prefers-color-scheme: light)` block, and there is no
`<meta name="color-scheme">`. So a phone or desktop set to light mode still
gets the dark page. That is a known gap, not a decision. The app itself has
had a light theme since 1.0.16, so a visitor in light mode sees a site that
doesn't match the app they're about to install.

If it's added, three things go beyond the custom properties:

- **The header background** is a hard-coded `rgba(10, 14, 26, 0.88)`, not a
  variable, so it would stay dark on a light page. It isn't the only literal.
  The roster-pattern dots hard-code their fills (the Off dot is a dark
  `#2a3350`), there's a stray `color: #fff`, and the glows and shadows are
  tuned for a dark background. Grep `styles.css` for `#` and `rgba(` outside
  `:root`.
- **The screenshots in `images/` are dark-mode captures.** A light page full of
  dark phone screens may look worse than an all-dark page. Either capture a
  light set and swap them with `<picture>` + `media="(prefers-color-scheme:
  light)"`, or keep the dark screenshots and frame them deliberately.
- **`color-scheme: light dark`** belongs on `:root` too, so form controls and
  scrollbars follow.

No JavaScript is needed, since the media query does the switching, so the CSP
doesn't change.

## Deploying

GitHub Pages serves the root of `main`. Pushing to `main` publishes; there is no
action or workflow in between. Settings → Pages → Source is *Deploy from a
branch*, `main` / `/ (root)`.

## Telling search engines about changes

Google reads `sitemap.xml` on its own schedule (it is submitted in Search
Console), so keeping each page's `<lastmod>` honest is enough there.

Bing, and the engines that share its index (DuckDuckGo, Yahoo, Ecosia, ChatGPT
search) as well as Yandex and Naver, are told directly through
[IndexNow](https://www.indexnow.org/). The key file
`7c3e9a41d82f4b6e95a0c1f7d4e28b63.txt` at the site root proves the site owns the
key: its name and its content are the key, and **it must stay where it is**,
since every ping is rejected once that file 404s. The key is not a secret; it
is public by design.

After pushing a new or substantially changed page, and once Pages has deployed
it, ping the changed URLs. The command is one line on purpose: backslash line
continuations break when pasted into some terminals. It needs a Unix-style shell
(macOS, Linux, Git Bash or WSL), since PowerShell and Command Prompt don't treat
the single quotes as quotes.

```
curl -sS -w '\nHTTP %{http_code}\n' -X POST https://api.indexnow.org/indexnow -H "Content-Type: application/json; charset=utf-8" -d '{"host":"shiftyhabits.com","key":"7c3e9a41d82f4b6e95a0c1f7d4e28b63","keyLocation":"https://shiftyhabits.com/7c3e9a41d82f4b6e95a0c1f7d4e28b63.txt","urlList":["https://shiftyhabits.com/guides/<slug>/"]}'
```

To ping several pages at once, list them all in `urlList`, separated by commas.

`200` or `202` means accepted. Ping only pages that actually changed — pinging
unchanged URLs over and over is treated as spam and can get the key ignored.

## Editing

**Copy** lives in `index.html`. The FAQ entries are duplicated on purpose:
each appears once as visible HTML and once inside the `FAQPage` JSON-LD block in
`<head>`. Every guide has its own FAQ block built the same way. **Change both, or the structured data starts describing a page that no
longer exists** — a mismatch between marked-up and visible FAQ content is a
reason for Google to drop the rich result entirely.

**Meta descriptions** (`<meta name="description">`) must stay between 25 and
160 characters. Bing Webmaster Tools reports anything longer as an error, and
both Bing and Google cut it off in results anyway. The Open Graph and JSON-LD
descriptions are not held to this limit.

**Images** are WebP, resized to roughly twice their display size and no larger.
The originals are full-resolution PNG phone screenshots, about 1.5 MB each; do
not commit those. Every `<img>` carries explicit `width`/`height` matching the
file's real pixel dimensions, so the browser reserves the space before the image
arrives — if you swap an image, update those numbers, or the page will shift as
it loads and take the Core Web Vitals score with it.

**The Open Graph card** (`images/og-card.jpg`) is deliberately JPEG rather than
WebP: some social and chat link-preview scrapers still cannot decode WebP, and a
preview card that fails to render is worse than a slightly larger file.

## Security

The site is static, with no JavaScript, no forms, no cookies and no third-party
requests. A `Content-Security-Policy` is declared as a `<meta>` tag in
`index.html` rather than as a response header, because GitHub Pages does not let
you set headers. It is `default-src 'none'` with narrow exceptions for
same-origin images and CSS.

Two consequences worth knowing:

- The JSON-LD blocks are unaffected. A `<script type="application/ld+json">` is
  a data block the HTML parser never executes, so CSP never evaluates it and the
  structured data is still read by crawlers.
- `frame-ancestors` cannot be set from a `<meta>` tag, only from a header, so
  clickjacking protection is not available here. For a page with no forms and
  nothing to click but outbound links, that is an accepted risk rather than a
  gap to close.

If a script is ever added, widen the CSP deliberately, and with a hash rather
than `'unsafe-inline'`.

## The domain

The site is served at **https://shiftyhabits.com/** — the apex, not `www`.
`www.shiftyhabits.com` redirects to it, which is GitHub's own behaviour once
both are pointed here; the apex is canonical because the app's package name
(`com.shiftyhabits.app`) and the Play listing both read that way.

`CNAME` at the repo root holds the bare domain. GitHub Pages reads that file —
it is the mapping from hostname to repository, and without it a request that
resolves correctly still 404s, because the Pages IPs serve many sites and
nothing else says which one answers for this host. Settings → Pages rewrites
this file if the domain is changed through the UI, so the file and the setting
are two views of one thing rather than two things to keep in sync.

DNS at the registrar: the apex has GitHub's four A records
(`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`)
and their four AAAA equivalents; `www` is a CNAME to
`luke-shifty-habits.github.io`. **On Cloudflare these records must be DNS-only
(grey cloud), not proxied** — Pages issues its own Let's Encrypt certificate and
cannot complete the ACME challenge through the proxy, which presents as a
redirect loop or certificate error that looks like a Pages fault and is not.

### If the domain ever changes again

The canonical URL appears in **four** files, and they must move in one commit —
a canonical tag naming a URL that no longer resolves is worse than none at all,
because it tells Google the real page is somewhere that 404s.

1. `index.html` — `<link rel="canonical">`, `og:url`, `og:image`,
   `twitter:image`, and the `url`, `image` and `screenshot` fields in the
   `SoftwareApplication` JSON-LD.
2. `sitemap.xml` — the `<loc>`.
3. `robots.txt` — the `Sitemap:` line and the comment at the top.
4. `llms.txt` — the site link.

Plus `CNAME`, the DNS records, and a re-submitted sitemap in Google Search
Console under the new property.
