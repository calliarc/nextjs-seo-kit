import type { MetadataRoute } from 'next';
import type { SiteConfig } from './config';
import { SeoKitError } from './errors';
import { absoluteUrl, canonical } from './url';

type SitemapItem = MetadataRoute.Sitemap[number];

export interface SitemapEntry {
  path: string;
  lastModified?: string | Date;
  changeFrequency?: SitemapItem['changeFrequency'];
  /** 0.0 - 1.0 */
  priority?: number;
  /** Image URLs or paths (made absolute). Rendered by Next.js 15+. */
  images?: string[];
  /** hreflang alternates, values are paths or URLs on this site. */
  languages?: Record<string, string>;
}

export interface SitemapOptions {
  /** Drop entries that normalize to the same URL (first one wins). @default true */
  dedupe?: boolean;
}

/**
 * Build a `MetadataRoute.Sitemap` (the return value of `app/sitemap.ts`) with absolute,
 * normalized canonical URLs.
 */
export function buildSitemap(
  site: SiteConfig,
  entries: ReadonlyArray<string | SitemapEntry>,
  options: SitemapOptions = {},
): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  const out: MetadataRoute.Sitemap = [];
  for (const raw of entries) {
    const entry: SitemapEntry = typeof raw === 'string' ? { path: raw } : raw;
    const url = canonical(site, entry.path);
    if ((options.dedupe ?? true) && seen.has(url)) continue;
    seen.add(url);
    if (entry.priority !== undefined && !(entry.priority >= 0 && entry.priority <= 1)) {
      throw new SeoKitError(`Sitemap priority for "${entry.path}" must be between 0 and 1, got ${entry.priority}.`);
    }
    const item: SitemapItem = { url };
    if (entry.lastModified !== undefined) item.lastModified = entry.lastModified;
    if (entry.changeFrequency !== undefined) item.changeFrequency = entry.changeFrequency;
    if (entry.priority !== undefined) item.priority = entry.priority;
    // `images` is part of MetadataRoute.Sitemap since Next 15; Next 14 ignores it.
    if (entry.images?.length) (item as { images?: string[] }).images = entry.images.map((i) => absoluteUrl(site, i));
    if (entry.languages) {
      const languages: Record<string, string> = {};
      for (const [lang, p] of Object.entries(entry.languages)) languages[lang] = canonical(site, p);
      item.alternates = { languages };
    }
    out.push(item);
  }
  return out;
}

type RobotsRule = MetadataRoute.Robots['rules'];

export interface RobotsOptions {
  /** Custom rules. Defaults to `{ userAgent: "*", allow: "/", disallow }`. */
  rules?: RobotsRule;
  /** Paths to disallow for all user agents when `rules` is not given. */
  disallow?: string[];
  /** Block everything (staging / preview deployments). */
  disallowAll?: boolean;
  /** Sitemap paths or URLs. `false` to omit. @default ["/sitemap.xml"] */
  sitemaps?: string[] | false;
  /** Emit the (non-standard) `Host:` line with the canonical origin. @default false */
  host?: boolean;
}

/** Build a `MetadataRoute.Robots` (the return value of `app/robots.ts`) with an absolute sitemap URL. */
export function buildRobots(site: SiteConfig, options: RobotsOptions = {}): MetadataRoute.Robots {
  let rules: RobotsRule;
  if (options.disallowAll) {
    rules = { userAgent: '*', disallow: '/' };
  } else if (options.rules) {
    rules = options.rules;
  } else {
    rules = { userAgent: '*', allow: '/' };
    if (options.disallow?.length) rules.disallow = options.disallow.map((p) => (p.startsWith('/') ? p : `/${p}`));
  }
  const robots: MetadataRoute.Robots = { rules };
  if (options.sitemaps !== false) {
    const list = (options.sitemaps ?? ['/sitemap.xml']).map((s) => absoluteUrl(site, s));
    robots.sitemap = list.length === 1 ? list[0] : list;
  }
  if (options.host) robots.host = site.origin;
  return robots;
}
