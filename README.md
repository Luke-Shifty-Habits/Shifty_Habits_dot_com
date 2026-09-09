# Shifty Habits — website

The marketing site for **Shifty Habits**, a habit tracker for shift workers that
follows a rotating roster or repeating cycle instead of a fixed calendar week.

- **Live site:** https://luke-shifty-habits.github.io/Shifty_Habits_dot_com/
- **The app on Google Play:** https://play.google.com/store/apps/details?id=com.shiftyhabits.app

This repository holds **only the website**. The app itself lives in a separate,
private repository — bug reports about the app belong on Google Play or at
ShiftyHabits@gmail.com, not in this issue tracker.

## What's here

Hand-written static HTML and CSS. There is no build step, no framework, no
package manager and no JavaScript at all — open `index.html` in a browser and
what you see is what ships.

```
index.html      the whole site, one page
styles.css      all styling; dark theme, custom properties at the top
favicon.svg     the brand mark, a gradient square
images/         WebP screenshots, the Open Graph card, the Apple touch icon
robots.txt      opens the site to search and AI crawlers alike; points at the sitemap
sitemap.xml     one URL, for Google Search Console
llms.txt        a plain-language summary for AI assistants (llmstxt.org convention)
.nojekyll       tells GitHub Pages to serve the files as-is
```

## Deploying

GitHub Pages serves the root of `main`. Pushing to `main` publishes; there is no
action or workflow in between. Settings → Pages → Source is *Deploy from a
branch*, `main` / `/ (root)`.

## Editing

**Copy** lives in `index.html`. The nine FAQ entries are duplicated on purpose:
each appears once as visible HTML and once inside the `FAQPage` JSON-LD block in
`<head>`. **Change both, or the structured data starts describing a page that no
longer exists** — a mismatch between marked-up and visible FAQ content is a
reason for Google to drop the rich result entirely.

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

## Moving to a custom domain

The canonical URL appears in **four** files. Change all of them in one commit —
a canonical tag pointing at a URL that no longer resolves is worse than having
none, because it tells Google the real page is somewhere that 404s.

1. `index.html` — `<link rel="canonical">`, `og:url`, `og:image`,
   `twitter:image`, and the `url`, `image` and `screenshot` fields in the
   `SoftwareApplication` JSON-LD.
2. `sitemap.xml` — the `<loc>`.
3. `robots.txt` — the `Sitemap:` line and the comment at the top.
4. `llms.txt` — the two site links.

Then add a `CNAME` file at the repo root containing the bare domain (e.g.
`shiftyhabits.com`). Settings → Pages writes that file for you if you add the
domain through the UI, which is the less error-prone route.

At the DNS provider, point the apex at GitHub's four A records
(`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`)
and their AAAA equivalents, and point `www` at `luke-shifty-habits.github.io`
with a CNAME. Then enable *Enforce HTTPS* in Settings → Pages once the
certificate has been issued, which can take up to an hour.

Afterwards, re-submit the sitemap in Google Search Console under the new
property. GitHub redirects the old Pages URL to the custom domain automatically,
so existing links keep working.
