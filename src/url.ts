import type { SiteConfig } from './config';
import { SeoKitError } from './errors';

export interface CanonicalOptions {
  /** Override `site.allowedQueryParams` for this call. */
  allowedQueryParams?: readonly string[];
}

export interface NormalizedPath {
  /** Normalized pathname, always starting with `/`. */
  pathname: string;
  /** Query string including `?`, or empty string. */
  search: string;
  /** Hash including `#`, or empty string. */
  hash: string;
  /** True when a doubled host segment (e.g. `/example.com/`) was removed. */
  repairedDoubledHost: boolean;
}

type Parsed = { kind: 'external'; url: string } | ({ kind: 'internal' } & NormalizedPath);

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;
/** Same rule Next.js uses for `trailingSlash`: a last segment with an extension is a file. */
const FILE_SEGMENT_RE = /\.\w+$/;
const DUMMY_ORIGIN = 'http://n';

function stripPort(host: string): string {
  if (host.startsWith('[')) return host.replace(/(\]):\d+$/, '$1');
  return host.replace(/:\d+$/, '');
}

function isKnownHost(site: SiteConfig, segment: string | undefined): boolean {
  if (!segment) return false;
  let value = segment;
  try {
    value = decodeURIComponent(segment);
  } catch {
    /* keep raw */
  }
  return site.knownHosts.includes(stripPort(value.toLowerCase()).replace(/\.$/, ''));
}

/** True when the last path segment looks like a file (`/sitemap.xml`, `/og.png`). */
export function isFilePath(pathname: string): boolean {
  const last = pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  return FILE_SEGMENT_RE.test(last);
}

function applyTrailingSlash(pathname: string, trailingSlash: boolean): string {
  if (pathname === '/') return pathname;
  const bare = pathname.replace(/\/+$/, '') || '/';
  if (bare === '/') return '/';
  if (trailingSlash && !isFilePath(bare)) return `${bare}/`;
  return bare;
}

function splitRest(input: string): { path: string; search: string; hash: string } {
  const hashIndex = input.indexOf('#');
  const beforeHash = hashIndex === -1 ? input : input.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : input.slice(hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  const path = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const search = queryIndex === -1 ? '' : beforeHash.slice(queryIndex);
  return { path, search, hash };
}

function parse(site: SiteConfig, input: string | URL, fnName: string): Parsed {
  if (input instanceof URL) input = input.href;
  if (typeof input !== 'string') {
    throw new SeoKitError(`${fnName}() expects a path string such as "/about", got ${input === null ? 'null' : typeof input}.`);
  }
  let s = input.trim().replace(/\\/g, '/');

  const scheme = SCHEME_RE.exec(s);
  if (scheme) {
    const name = scheme[1]!.toLowerCase();
    if (name === 'http' || name === 'https') {
      let url: URL;
      try {
        url = new URL(s);
      } catch {
        throw new SeoKitError(`${fnName}() could not parse "${input}" as a URL.`);
      }
      if (!isKnownHost(site, url.host)) return { kind: 'external', url: url.href };
      // Same site (any www variant / alias): keep only path + query + hash.
      s = s.replace(/^[a-z]+:\/*[^/?#]*/i, '') || '/';
    } else if (isKnownHost(site, s.split('/')[0])) {
      // "example.com:3000/page" parses as scheme "example.com"; it is really a host-prefixed path.
      s = `/${s}`;
    } else {
      throw new SeoKitError(`${fnName}() only handles http(s) URLs and paths, got "${input}".`);
    }
  } else if (s.startsWith('//')) {
    const first = s.slice(2).split(/[/?#]/)[0] ?? '';
    if (!isKnownHost(site, first) && first.includes('.')) {
      // Protocol-relative URL to another host, e.g. //cdn.example.net/og.png
      return { kind: 'external', url: new URL(`https:${s}`).href };
    }
  }

  const { path, search, hash } = splitRest(s);

  // Collapse duplicate slashes and make the path absolute: "about//team" -> "/about/team".
  const segments = path.split('/').filter((seg) => seg !== '');
  let repaired = false;
  // Repair doubled-host paths: "/example.com/page", "example.com/page", "/https:/example.com/page".
  for (;;) {
    if (isKnownHost(site, segments[0])) {
      segments.shift();
      repaired = true;
      continue;
    }
    if (/^https?:$/i.test(segments[0] ?? '') && isKnownHost(site, segments[1])) {
      segments.splice(0, 2);
      repaired = true;
      continue;
    }
    break;
  }
  if (repaired && site.doubledHostPaths === 'throw') {
    throw new SeoKitError(
      `"${input}" contains the site host as a path segment. This usually means a link was written as ` +
        `"${site.hostname}/..." instead of "https://${site.hostname}/..." or "/...". Fix the link or set doubledHostPaths: "repair".`,
    );
  }

  const hadTrailing = /\/$/.test(path) && segments.length > 0;
  let pathname = `/${segments.join('/')}${hadTrailing ? '/' : ''}`;
  // Resolve "." / ".." and percent-encode spaces and non-ASCII characters consistently.
  pathname = new URL(pathname, DUMMY_ORIGIN).pathname;
  pathname = applyTrailingSlash(pathname, site.trailingSlash);

  return { kind: 'internal', pathname, search, hash, repairedDoubledHost: repaired };
}

function filterQuery(search: string, allowed: readonly string[] | 'all'): string {
  if (!search || search === '?') return '';
  const params = new URLSearchParams(search);
  if (allowed !== 'all') {
    for (const key of [...new Set(params.keys())]) {
      if (!allowed.includes(key)) params.delete(key);
    }
  }
  const out = params.toString();
  return out ? `?${out}` : '';
}

/**
 * Normalize a site-relative path: leading slash, no duplicate slashes, doubled host removed,
 * trailing slash policy applied. Query and hash are returned separately (unfiltered).
 *
 * @throws {SeoKitError} for URLs pointing at another host.
 */
export function normalizePath(site: SiteConfig, input: string | URL): NormalizedPath {
  const parsed = parse(site, input, 'normalizePath');
  if (parsed.kind === 'external') {
    throw new SeoKitError(`normalizePath() received an external URL "${parsed.url}". Only paths on ${site.origin} can be normalized.`);
  }
  const { kind: _kind, ...rest } = parsed;
  return rest;
}

/**
 * Return the absolute canonical URL for a path on this site.
 * Query parameters are removed unless allow-listed, the hash is always removed.
 *
 * @example canonical(site, "about") // "https://www.example.com/about"
 * @example canonical(site, "/example.com/privacy-policy") // "https://www.example.com/privacy-policy"
 * @throws {SeoKitError} for URLs on other hosts (a canonical must point at your own site).
 */
export function canonical(site: SiteConfig, path: string | URL = '/', options: CanonicalOptions = {}): string {
  const parsed = parse(site, path, 'canonical');
  if (parsed.kind === 'external') {
    throw new SeoKitError(
      `canonical() received "${parsed.url}", which is not on ${site.origin}. ` +
        'Pass a path such as "/about". If this host belongs to you, add it to additionalHosts.',
    );
  }
  const search = filterQuery(parsed.search, options.allowedQueryParams ?? site.allowedQueryParams);
  return `${site.origin}${parsed.pathname}${search}`;
}

/**
 * Return an absolute URL for a path on this site (links, images, feeds).
 * Unlike `canonical()`, the query string and hash are kept, and external URLs are returned unchanged
 * (protocol-relative ones are upgraded to https).
 */
export function absoluteUrl(site: SiteConfig, path: string | URL): string {
  const parsed = parse(site, path, 'absoluteUrl');
  if (parsed.kind === 'external') return parsed.url;
  return `${site.origin}${parsed.pathname}${filterQuery(parsed.search, 'all')}${parsed.hash}`;
}

/** Normalized site-relative href (`/about/`), handy for `<Link href>`. Keeps query and hash. */
export function relativePath(site: SiteConfig, path: string | URL): string {
  const parsed = parse(site, path, 'relativePath');
  if (parsed.kind === 'external') return parsed.url;
  return `${parsed.pathname}${filterQuery(parsed.search, 'all')}${parsed.hash}`;
}

/** True when a path starts with the site's own host, e.g. `/example.com/page` or `example.com/page`. */
export function isDoubledHostPath(site: SiteConfig, path: string): boolean {
  const { path: p } = splitRest(path.trim().replace(/\\/g, '/'));
  const segments = p.split('/').filter(Boolean);
  if (SCHEME_RE.test(p) && /^https?:\/\//i.test(p)) return false;
  return isKnownHost(site, segments[0]) || (/^https?:$/i.test(segments[0] ?? '') && isKnownHost(site, segments[1]));
}
