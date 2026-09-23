import { SeoKitError } from './errors';
import { buildMetadata, baseMetadata, type BaseMetadataInput, type BuildMetadataInput } from './metadata';
import { buildRobots, buildSitemap, type RobotsOptions, type SitemapEntry, type SitemapOptions } from './sitemap';
import { absoluteUrl, canonical, normalizePath, relativePath, type CanonicalOptions, type NormalizedPath } from './url';
import type { Metadata, MetadataRoute } from 'next';

export type DoubledHostMode = 'repair' | 'throw';

export interface SiteConfigInput {
  /**
   * Absolute origin of the production site, e.g. `https://www.example.com`.
   * Must include `https://`. `http://` is only accepted for localhost / loopback addresses.
   */
  siteUrl: string;
  /**
   * Whether page URLs end with a slash (`/about/`). Mirror Next's `trailingSlash` option.
   * @default false
   */
  trailingSlash?: boolean;
  /**
   * Force the `www.` (true) or bare (false) host. When omitted, the host of `siteUrl` wins.
   * If it disagrees with `siteUrl`, the host is rewritten to match this preference.
   */
  preferWww?: boolean;
  /** Human readable site name used for Open Graph `siteName` and Organization JSON-LD. */
  siteName?: string;
  /** Default Open Graph locale, e.g. `en_US`. */
  locale?: string;
  /** Twitter / X handle for `twitter:site`, e.g. `@example`. */
  twitterHandle?: string;
  /**
   * Query parameters that are allowed to survive in canonical URLs (e.g. `["page"]`).
   * Everything else, plus the `#hash`, is stripped.
   * @default []
   */
  allowedQueryParams?: string[];
  /**
   * Extra hostnames that belong to this site (old domains, apex aliases).
   * They are recognized when repairing doubled-host paths and redirected by the host presets.
   */
  additionalHosts?: string[];
  /**
   * What to do with a path such as `/example.com/page` (a link that was written without `https://`).
   * `repair` (default) strips the host segment, `throw` raises an error so the bug is caught in CI.
   */
  doubledHostPaths?: DoubledHostMode;
}

export interface SiteConfig {
  /** Canonical origin without trailing slash, e.g. `https://www.example.com`. */
  readonly origin: string;
  /** Same as `origin`; kept for readability in user code. */
  readonly siteUrl: string;
  readonly protocol: 'https:' | 'http:';
  /** Canonical hostname (no port), lowercase. */
  readonly hostname: string;
  /** Canonical host including port if any. */
  readonly host: string;
  readonly trailingSlash: boolean;
  readonly preferWww: boolean;
  readonly siteName?: string;
  readonly locale?: string;
  readonly twitterHandle?: string;
  readonly allowedQueryParams: readonly string[];
  /** Hostnames that should redirect to `hostname` (the other www variant plus `additionalHosts`). */
  readonly alternateHosts: readonly string[];
  /** `hostname` plus `alternateHosts`. Used to detect doubled-host paths. */
  readonly knownHosts: readonly string[];
  readonly doubledHostPaths: DoubledHostMode;
  /** True for localhost / loopback / IP sites (no www handling, http allowed). */
  readonly isLocal: boolean;
}

/** The value returned by `defineSiteConfig()`: the resolved config plus helpers bound to it. */
export interface Site extends SiteConfig {
  canonical(path?: string | URL, options?: CanonicalOptions): string;
  absoluteUrl(path: string | URL): string;
  relativePath(path: string | URL): string;
  normalizePath(path: string | URL): NormalizedPath;
  buildMetadata(input: BuildMetadataInput): Metadata;
  baseMetadata(input?: BaseMetadataInput): Metadata;
  sitemap(entries: ReadonlyArray<string | SitemapEntry>, options?: SitemapOptions): MetadataRoute.Sitemap;
  robots(options?: RobotsOptions): MetadataRoute.Robots;
}

const LOCAL_HOST_RE = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|0\.0\.0\.0)$/i;
const IP_RE = /^(\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:.]+\])$/i;
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

function suggestion(raw: string): string {
  const stripped = raw.replace(/^[a-z][a-z0-9+.-]*:\/*/i, '').replace(/^\/+/, '');
  const hostPart = stripped.split(/[/?#]/)[0] ?? stripped;
  return `https://${hostPart}`;
}

function toHostname(value: string, label: string): string {
  const cleaned = value.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0]!.replace(/:\d+$/, '');
  if (!cleaned || !(HOSTNAME_RE.test(cleaned) || IP_RE.test(cleaned) || LOCAL_HOST_RE.test(cleaned))) {
    throw new SeoKitError(`${label} "${value}" is not a valid hostname.`);
  }
  return cleaned;
}

/**
 * Validate and normalize the site configuration. Call it once (e.g. in `site.config.ts`) and pass
 * the result to every helper.
 *
 * @throws {SeoKitError} when `siteUrl` is not an absolute https origin. The most common mistake,
 * `"example.com"` without a scheme, is what produces broken URLs like
 * `https://example.com/example.com/page` in the first place.
 */
export function defineSiteConfig(input: SiteConfigInput): Site {
  if (!input || typeof input !== 'object') {
    throw new SeoKitError('defineSiteConfig() expects an object, e.g. defineSiteConfig({ siteUrl: "https://www.example.com" }).');
  }
  const { siteUrl } = input;
  if (typeof siteUrl !== 'string' || siteUrl.trim() === '') {
    throw new SeoKitError(
      'siteUrl is required and must be a non-empty string such as "https://www.example.com". ' +
        'If you read it from an environment variable, make sure the variable is set at build time.',
    );
  }
  const raw = siteUrl.trim();

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new SeoKitError(
      `siteUrl "${raw}" is not an absolute URL (missing "https://"). Did you mean "${suggestion(raw)}"? ` +
        'A siteUrl without a scheme is treated as a relative path by browsers and crawlers, ' +
        'which produces doubled URLs such as "https://example.com/example.com/page".',
    );
  }
  if (!/^https?:\/\/[^/]/i.test(raw)) {
    throw new SeoKitError(`siteUrl "${raw}" must use https://. Did you mean "${suggestion(raw)}"?`);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SeoKitError(`siteUrl "${raw}" could not be parsed as a URL. Expected something like "https://www.example.com".`);
  }

  const isLocal = LOCAL_HOST_RE.test(url.hostname);
  if (url.protocol === 'http:' && !isLocal) {
    throw new SeoKitError(`siteUrl "${raw}" must use https://. Did you mean "${suggestion(raw)}"? (http:// is only allowed for localhost.)`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new SeoKitError(`siteUrl "${raw}" must use https://. Did you mean "${suggestion(raw)}"?`);
  }
  if (url.username || url.password) {
    throw new SeoKitError(`siteUrl must not contain credentials.`);
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new SeoKitError(
      `siteUrl "${raw}" must be an origin only (no path). Got path "${url.pathname}". Use "${url.origin}" and pass paths to canonical().`,
    );
  }
  if (url.search || url.hash || /[?#]/.test(raw)) {
    throw new SeoKitError(`siteUrl "${raw}" must not contain a query string or hash. Use "${url.origin}".`);
  }

  const isIp = IP_RE.test(url.hostname);
  const noWwwHandling = isLocal || isIp;
  let hostname = url.hostname.toLowerCase();
  const hasWww = hostname.startsWith('www.');
  const preferWww = noWwwHandling ? false : (input.preferWww ?? hasWww);
  if (!noWwwHandling) {
    if (preferWww && !hasWww) hostname = `www.${hostname}`;
    if (!preferWww && hasWww) hostname = hostname.slice(4);
  }
  const host = url.port ? `${hostname}:${url.port}` : hostname;
  const origin = `${url.protocol}//${host}`;

  const alternates = new Set<string>();
  if (!noWwwHandling) {
    alternates.add(preferWww ? hostname.slice(4) : `www.${hostname}`);
  }
  for (const extra of input.additionalHosts ?? []) {
    const h = toHostname(extra, 'additionalHosts entry');
    if (h !== hostname) alternates.add(h);
  }

  const trailingSlash = input.trailingSlash ?? false;
  if (typeof trailingSlash !== 'boolean') {
    throw new SeoKitError('trailingSlash must be a boolean (mirror the trailingSlash option in next.config).');
  }
  const doubledHostPaths = input.doubledHostPaths ?? 'repair';
  if (doubledHostPaths !== 'repair' && doubledHostPaths !== 'throw') {
    throw new SeoKitError('doubledHostPaths must be "repair" or "throw".');
  }
  const allowedQueryParams = [...(input.allowedQueryParams ?? [])];
  if (!allowedQueryParams.every((p) => typeof p === 'string' && p.length > 0)) {
    throw new SeoKitError('allowedQueryParams must be an array of non-empty strings.');
  }

  let twitterHandle = input.twitterHandle?.trim();
  if (twitterHandle && !twitterHandle.startsWith('@')) twitterHandle = `@${twitterHandle}`;

  const alternateHosts = Object.freeze([...alternates]);
  const config: SiteConfig = Object.freeze({
    origin,
    siteUrl: origin,
    protocol: url.protocol as 'https:' | 'http:',
    hostname,
    host,
    trailingSlash,
    preferWww,
    siteName: input.siteName,
    locale: input.locale,
    twitterHandle: twitterHandle || undefined,
    allowedQueryParams: Object.freeze(allowedQueryParams),
    alternateHosts,
    knownHosts: Object.freeze([hostname, ...alternateHosts]),
    doubledHostPaths,
    isLocal: noWwwHandling,
  });
  const site: Site = Object.freeze({
    ...config,
    canonical: (path: string | URL = '/', options?: CanonicalOptions) => canonical(config, path, options),
    absoluteUrl: (path: string | URL) => absoluteUrl(config, path),
    relativePath: (path: string | URL) => relativePath(config, path),
    normalizePath: (path: string | URL) => normalizePath(config, path),
    buildMetadata: (i: BuildMetadataInput) => buildMetadata(config, i),
    baseMetadata: (i?: BaseMetadataInput) => baseMetadata(config, i),
    sitemap: (entries: ReadonlyArray<string | SitemapEntry>, options?: SitemapOptions) => buildSitemap(config, entries, options),
    robots: (options?: RobotsOptions) => buildRobots(config, options),
  });
  return site;
}
