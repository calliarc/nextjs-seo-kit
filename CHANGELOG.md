# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-23

First working release.

### Added

- One site-URL config used by canonicals, sitemap and Open Graph tags
- Helpers that always generate absolute canonical URLs
- Redirect presets for www/non-www and trailing slashes
- Guards against doubled paths such as /example.com/page
- Sitemap and robots.txt generation
- JSON-LD helpers for Organization, Breadcrumb and Article
- Optional proxy (Next.js 16 `proxy.ts`) / middleware (Next.js 14-15 `middleware.ts`) helper for host and path normalization
- Zero runtime dependencies, ESM + CommonJS, full TypeScript types

[Unreleased]: https://github.com/calliarc/nextjs-seo-kit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/calliarc/nextjs-seo-kit/releases/tag/v0.1.0
