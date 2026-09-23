# Next.js SEO Kit

Correct canonicals, sitemaps, redirects and www/trailing-slash handling for Next.js.

[![CI](https://github.com/calliarc/nextjs-seo-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/calliarc/nextjs-seo-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/calliarc/nextjs-seo-kit?include_prereleases&sort=semver)](https://github.com/calliarc/nextjs-seo-kit/releases)
[![Built by CalliArc](https://img.shields.io/badge/built%20by-CalliArc-0a66c2)](https://www.calliarc.com/)

> **Status:** v0.1.0, first release. The API may still change before 1.0. Feedback and issues are welcome.

## Features

- One site-URL config used by canonicals, sitemap and Open Graph tags
- Helpers that always generate absolute canonical URLs
- Redirect presets for www/non-www and trailing slashes
- Guards against doubled paths such as /example.com/page
- Sitemap and robots.txt generation
- JSON-LD helpers for Organization, Breadcrumb and Article
- Optional proxy (Next.js 16 `proxy.ts`) / middleware (Next.js 14-15 `middleware.ts`) helper for host and path normalization
- Zero runtime dependencies, ESM + CommonJS, full TypeScript types

## Why this exists

This kit started from a real production Next.js site whose Google Search Console filled up with
"Alternate page with proper canonical tag" and "Duplicate without user-selected canonical" reports.
The cause was a handful of small URL mistakes that add up:

- **Doubled URLs.** Links were written as `href="example.com/privacy-policy"`, without `https://` or a
  leading slash. Browsers resolve that relative to the current page, so crawlers found
  `https://example.com/example.com/privacy-policy/`, and every page linking that way produced a new
  duplicate. The same thing happens when `siteUrl` / `metadataBase` is set to `example.com` without
  a scheme.
- **Mixed hosts.** Some links, sitemaps and canonicals used `www.example.com`, others `example.com`.
- **Inconsistent trailing slashes.** Canonicals said `/about`, Next.js served `/about/` (or the reverse),
  so the canonical pointed at a redirect.

Each fix is easy on its own. The hard part is keeping canonicals, `og:url`, sitemap entries, JSON-LD,
redirects and Next's `trailingSlash` option in agreement. This package derives all of them from
**one validated config**, so they cannot drift apart.

## Install

```bash
npm install @calliarc/nextjs-seo-kit
```

Requires Next.js 14 or newer (App Router) and React 18 or newer.

## Quick start

### 1. One config for the whole site

```ts
// site.config.ts
import { defineSiteConfig } from '@calliarc/nextjs-seo-kit';

export const site = defineSiteConfig({
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.example.com',
  trailingSlash: true, // must match what Next serves; withSeoKit() sets it for you
  siteName: 'Example Co',
  locale: 'en_US',
  twitterHandle: '@example',
});
```

`defineSiteConfig` throws at build time for the classic mistake:

```text
[nextjs-seo-kit] siteUrl "example.com" is not an absolute URL (missing "https://").
Did you mean "https://example.com"? ...
```

### 2. next.config: trailing slash + redirects

```ts
// next.config.ts
import type { NextConfig } from 'next';
import { withSeoKit } from '@calliarc/nextjs-seo-kit';
import { site } from './site.config';

const nextConfig: NextConfig = { reactStrictMode: true };

// Sets `trailingSlash` from site.config and appends redirects for
// example.com -> www.example.com and /example.com/:path* -> /:path*
export default withSeoKit(site, nextConfig);
```

### 3. Page metadata

```tsx
// app/layout.tsx: site-wide defaults, deliberately *no* canonical
export const metadata = site.baseMetadata({ titleTemplate: '%s | Example Co', images: '/og.png' });

// app/privacy-policy/page.tsx
export const metadata = site.buildMetadata({
  path: '/privacy-policy',
  title: 'Privacy policy',
  description: 'How we handle your data.',
});
// -> alternates.canonical and openGraph.url = "https://www.example.com/privacy-policy/"
```

> Do not put `alternates.canonical` in the root layout. Pages without their own canonical inherit
> it, which points every one of them at the home page. `baseMetadata()` leaves it out on purpose.

### 4. Sitemap and robots.txt

```ts
// app/sitemap.ts
export default function sitemap() {
  return site.sitemap(['/', '/about', { path: '/blog/hello', lastModified: '2026-01-15' }]);
}

// app/robots.ts
export default function robots() {
  return site.robots({ disallow: ['/api/'] }); // Sitemap: https://www.example.com/sitemap.xml
}
```

### 5. JSON-LD

```tsx
import { JsonLd, articleJsonLd, breadcrumbJsonLd } from '@calliarc/nextjs-seo-kit';

<JsonLd
  data={[
    articleJsonLd(site, { path: '/blog/hello', headline: 'Hello', datePublished: '2026-01-15', authors: ['Jane'] }),
    breadcrumbJsonLd(site, [{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: 'Hello' }]),
  ]}
/>;
```

### 6. Optional: proxy / middleware

The `next.config` redirects are enough for most sites. Add the proxy when you also want
`/https:/example.com/...` or `//double//slashes` repaired, or you need `x-forwarded-host` awareness
behind a reverse proxy.

```ts
// proxy.ts (Next.js 16+)
import { createSeoProxy } from '@calliarc/nextjs-seo-kit/proxy';
import { site } from './site.config';

export const proxy = createSeoProxy(site);
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

On Next.js 14 or 15, name the file `middleware.ts` and export `middleware` instead
(`export const middleware = createSeoProxy(site)`; `createSeoMiddleware` is an alias). The handler
returns a redirect `Response` or `undefined`, so you can compose it with your own logic:
`return seo(request) ?? myOtherLogic(request)`.

A full working app is in [examples/app-router](examples/app-router).

## API reference

All helpers take the value returned by `defineSiteConfig()` as their first argument. The most common
ones are also available as bound methods on it (`site.canonical('/x')`).

### `defineSiteConfig(options): Site`

| Option               | Type                    | Default          | Description                                                                                    |
| -------------------- | ----------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `siteUrl`            | `string`                | required         | Absolute `https://` origin. `http://` only for localhost. No path, query or hash.              |
| `trailingSlash`      | `boolean`               | `false`          | URL style for pages. Files (`/sitemap.xml`, `/og.png`) never get a slash, as in Next.js.       |
| `preferWww`          | `boolean`               | host of siteUrl  | Force `www.` or bare host. Rewrites the siteUrl host if they disagree.                         |
| `siteName`           | `string`                |                  | Used for `og:site_name`, Organization and Article publisher.                                   |
| `locale`             | `string`                |                  | `og:locale`, e.g. `en_US`.                                                                     |
| `twitterHandle`      | `string`                |                  | `twitter:site`; `@` is added if missing.                                                       |
| `allowedQueryParams` | `string[]`              | `[]`             | Query params kept in canonicals (e.g. `['page']`). Everything else and the `#hash` is dropped. |
| `additionalHosts`    | `string[]`              | `[]`             | Other hostnames of this site (old domains). Redirected and recognized in doubled paths.        |
| `doubledHostPaths`   | `'repair' \| 'throw'`   | `'repair'`       | `throw` makes `/example.com/page` inputs fail loudly, e.g. in CI.                              |

Throws `SeoKitError` with a suggestion for invalid input. The result is frozen and exposes
`origin`, `hostname`, `alternateHosts`, `knownHosts` and the bound helpers `canonical`, `absoluteUrl`,
`relativePath`, `normalizePath`, `buildMetadata`, `baseMetadata`, `sitemap` and `robots`.

### URLs

| Function                                      | Returns                                                                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `canonical(site, path?, { allowedQueryParams? })` | Absolute canonical URL. Adds leading slash, collapses `//`, resolves `..`, repairs doubled hosts, applies trailing slash, strips query/hash. Throws for other hosts. |
| `absoluteUrl(site, path)`                     | Absolute URL that keeps query and hash. External URLs pass through; `//cdn...` becomes `https://cdn...`.                                  |
| `relativePath(site, path)`                    | Normalized site-relative href for `<Link>`, e.g. `relativePath(site, 'example.com/privacy')` gives `/privacy/`.                          |
| `normalizePath(site, path)`                   | `{ pathname, search, hash, repairedDoubledHost }`.                                                                                       |
| `isDoubledHostPath(site, path)`               | `true` for `/example.com/page`, `www.example.com/page`, `/https:/example.com/page`.                                                      |
| `isFilePath(path)`                            | `true` when the last segment has an extension (same rule as Next's `trailingSlash`).                                                     |

Examples with `siteUrl: 'https://www.example.com'`:

```ts
canonical(site, 'about');                          // https://www.example.com/about
canonical(site, '/example.com/privacy-policy/');   // https://www.example.com/privacy-policy
canonical(site, 'http://example.com/a?utm=x#top'); // https://www.example.com/a
canonical(site, '/blog?page=2', { allowedQueryParams: ['page'] }); // https://www.example.com/blog?page=2
canonical(site, 'https://other.com/');             // throws: a canonical must point at your own site
```

### Metadata

- `buildMetadata(site, { path, title?, description?, images?, type?, publishedTime?, modifiedTime?, authors?, noindex?, languages?, allowedQueryParams?, openGraph?, twitter? }): Metadata`
  returns `metadataBase`, `alternates.canonical` (plus hreflang `languages`), `openGraph` (`url`, `title`,
  `description`, `siteName`, `locale`, `type`, absolute `images`) and `twitter` (`summary_large_image` when
  there are images). `openGraph` / `twitter` overrides are shallow-merged last.
- `baseMetadata(site, { defaultTitle?, titleTemplate?, description?, images? }): Metadata` for the root
  layout. Never sets a canonical.

### Sitemap and robots

- `buildSitemap(site, entries, { dedupe = true })` where an entry is a path string or
  `{ path, lastModified?, changeFrequency?, priority?, images?, languages? }`. URLs are canonicalized and
  duplicates (after normalization) removed. Priority is validated to be 0-1. Sitemap `images` are
  rendered by Next.js 15 and newer.
- `buildRobots(site, { rules?, disallow?, disallowAll?, sitemaps = ['/sitemap.xml'] | false, host? })`.
  `disallowAll: true` is handy for staging deployments.

### Redirects (next.config)

- `withSeoKit(site, nextConfig?, { host?, doubledHost? })` sets `trailingSlash` and appends the presets
  after your own `redirects()`. It throws if `nextConfig.trailingSlash` disagrees with the site config.
- `seoRedirects(site, options?)` returns all presets, if you prefer to wire `redirects()` yourself.
- `hostRedirects(site)` sends every alternate host to the canonical origin (308, path and query preserved,
  using `has: [{ type: 'host' }]`).
- `doubledHostRedirects(site)` sends `/example.com/:path*` and `/www.example.com/:path*` to `/:path*`.

With `trailingSlash: true` the presets re-add the slash for pages but not for files, so each redirect
lands on the final URL. Next's built-in trailing-slash redirect can add one extra hop in front.

About trailing slashes: Next.js already redirects `/about` to `/about/` (or the reverse) based on its
`trailingSlash` option, so the kit does not add its own trailing-slash redirects. `withSeoKit` sets
that option from your site config so canonicals always match what Next serves.

Host redirects only fire for hosts that reach your Next.js server. On Vercel, Netlify or Cloudflare,
also configure the www/non-www redirect at the domain level. It is faster and covers static assets.

### Proxy / middleware (`@calliarc/nextjs-seo-kit/proxy`)

- `createSeoProxy(site, options?)` (alias `createSeoMiddleware`) returns `(request) => Response | undefined`.
- `getSeoRedirect(site, request, options?)` returns the target `URL` or `null`.

| Option          | Default | Description                                                                                     |
| --------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `host`          | `true`  | Redirect alternate hosts (checks `x-forwarded-host`, then `host`). Unknown hosts (localhost, preview deployments) are left alone. |
| `doubledHost`   | `true`  | Repair `/example.com/...`, `/https:/example.com/...` and `//double//slashes`.                  |
| `trailingSlash` | `false` | Enforce the trailing-slash policy here too (skips `/_next`, `/api`, `/.well-known` and files). Only needed if you cannot use Next's option. |
| `status`        | `308`   | Redirect status.                                                                                |
| `skip`          | none    | `(pathname) => boolean` to exclude paths.                                                       |

It uses only the standard `Request` / `Response` APIs, so it works on the Edge and Node.js runtimes.

### JSON-LD

- `organizationJsonLd(site, { name?, url?, logo?, description?, sameAs?, email?, telephone?, contactPoint?, type? })`
- `breadcrumbJsonLd(site, [{ name, path? }])` (only the last item may omit `path`)
- `articleJsonLd(site, { path, headline, datePublished, dateModified?, description?, images?, authors?, publisher?, type? })`,
  where `type` is `Article`, `BlogPosting`, `NewsArticle` or `TechArticle`
- `<JsonLd data={obj | obj[]} id? nonce? />` is a Server Component-safe `<script type="application/ld+json">`
- `serializeJsonLd(data)` escapes `<`, `>`, `&`, U+2028 and U+2029, so content such as `</script>` in a
  title can never break out of the script tag

All URLs inside JSON-LD go through `canonical()` / `absoluteUrl()`.

## Tech stack

- TypeScript (strict), no runtime dependencies
- Next.js (App Router) 14, 15 and 16 as a peer dependency
- ESM + CommonJS builds with type declarations via [tsup](https://tsup.egoist.dev/)
- [Vitest](https://vitest.dev/) tests
- GitHub Actions for CI and npm publishing with provenance
- Published as an npm package

## Development

```bash
npm install
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # dist/ (ESM, CJS, .d.ts)
```

The example app links the local build:

```bash
npm run build
cd examples/app-router && npm install && npm run build
```

Releases: bump `version` in `package.json`, then create a GitHub release tagged `v<version>`. The
`Publish to npm` workflow runs the tests and publishes with provenance. It needs an `NPM_TOKEN`
repository secret (or npm trusted publishing).

## Roadmap

- [x] Initial release
- [x] Documentation and examples
- [x] CI and automated tests
- [ ] `hreflang` / i18n helpers beyond `languages`
- [ ] More JSON-LD types (FAQPage, Product, WebSite with SearchAction)
- [ ] CLI to scan a built site for doubled-host links and canonical mismatches

Have an idea? [Open an issue](https://github.com/calliarc/nextjs-seo-kit/issues).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © 2026 CalliArc

---

Built and maintained by [CalliArc](https://www.calliarc.com/). Need help with custom software development? [Talk to our team](https://www.calliarc.com/services/custom-software-development/).
