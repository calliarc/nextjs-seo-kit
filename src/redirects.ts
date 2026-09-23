import type { SiteConfig } from './config';

/** Subset of Next's `Redirect` type (kept local so this module has no runtime dependency on next). */
export interface SeoRedirect {
  source: string;
  destination: string;
  permanent: boolean;
  has?: Array<{ type: 'host'; value: string } | { type: 'header' | 'cookie' | 'query'; key: string; value?: string }>;
  missing?: SeoRedirect['has'];
  basePath?: false;
  locale?: false;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** path-to-regexp treats `:`, `(`, `)`, `*`, `+`, `?`, `{`, `}` as special. */
const escapePathSegment = (s: string) => s.replace(/[:()*+?{}\\]/g, '\\$&');

/**
 * Redirect every alternate host (the other www variant plus `additionalHosts`) to the canonical
 * origin with a permanent (308) redirect. Path and query string are preserved.
 *
 * Note: this only fires for hosts that actually reach your Next.js server. On Vercel/Netlify/Cloudflare
 * you can (and should) also configure the domain redirect at the platform level.
 */
export function hostRedirects(site: SiteConfig): SeoRedirect[] {
  if (site.isLocal) return [];
  return site.alternateHosts.flatMap((host) =>
    pathRules('', `${site.origin}`, site.trailingSlash).map((rule) => ({
      ...rule,
      has: [{ type: 'host' as const, value: escapeRegex(host) }],
    })),
  );
}

// Same file/page split Next.js uses for its own trailingSlash redirects.
const FILE_PARAM = ':file((?:[^/]+/)*[^/]+\\.\\w+)';
const PAGE_PARAM = ':page((?:[^/]+/)*[^/.]+)';

/**
 * Rules that move `${prefix}/<rest>` to `${destOrigin}/<rest>` in a single hop.
 * With `trailingSlash: true`, Next strips the slash from `:path*` captures, so pages get it re-added
 * explicitly while files (`/sitemap.xml`) do not.
 */
function pathRules(prefix: string, destOrigin: string, trailingSlash: boolean): SeoRedirect[] {
  // Explicit root rule: an empty `:path*` would otherwise produce an empty Location header.
  const root: SeoRedirect = { source: prefix || '/', destination: `${destOrigin}/`, permanent: true };
  if (!trailingSlash) {
    return [root, { source: `${prefix}/:path*`, destination: `${destOrigin}/:path*`, permanent: true }];
  }
  return [
    root,
    { source: `${prefix}/${FILE_PARAM}`, destination: `${destOrigin}/:file`, permanent: true },
    { source: `${prefix}/${PAGE_PARAM}`, destination: `${destOrigin}/:page/`, permanent: true },
    { source: `${prefix}/:path*`, destination: `${destOrigin}/:path*`, permanent: true },
  ];
}

/**
 * Redirect doubled-host paths such as `/example.com/privacy-policy` (produced by links written as
 * `href="example.com/privacy-policy"`) to `/privacy-policy`, for every known host.
 */
export function doubledHostRedirects(site: SiteConfig): SeoRedirect[] {
  return site.knownHosts.flatMap((host) => pathRules(`/${escapePathSegment(host)}`, '', site.trailingSlash));
}

export interface SeoRedirectsOptions {
  /** www / non-www / alias host normalization. @default true */
  host?: boolean;
  /** `/example.com/:path*` -> `/:path*`. @default true */
  doubledHost?: boolean;
}

/** All redirect presets, ready to return from `redirects()` in next.config. */
export function seoRedirects(site: SiteConfig, options: SeoRedirectsOptions = {}): SeoRedirect[] {
  return [
    ...(options.doubledHost ?? true ? doubledHostRedirects(site) : []),
    ...(options.host ?? true ? hostRedirects(site) : []),
  ];
}

type Redirects = () => Promise<SeoRedirect[]> | SeoRedirect[];
interface NextConfigLike {
  trailingSlash?: boolean;
  redirects?: Redirects;
  [key: string]: unknown;
}

/**
 * Wrap a Next.js config: sets `trailingSlash` from the site config (so canonicals and Next's own
 * trailing-slash redirects always agree) and appends the redirect presets after your own redirects.
 *
 * @example
 * // next.config.ts
 * export default withSeoKit(site, { reactStrictMode: true });
 */
export function withSeoKit<T extends object>(
  site: SiteConfig,
  nextConfig: T = {} as T,
  options: SeoRedirectsOptions = {},
): T & { trailingSlash: boolean; redirects: () => Promise<SeoRedirect[]> } {
  const cfg = nextConfig as T & NextConfigLike;
  if (cfg.trailingSlash !== undefined && cfg.trailingSlash !== site.trailingSlash) {
    throw new Error(
      `[nextjs-seo-kit] next.config trailingSlash (${String(cfg.trailingSlash)}) does not match defineSiteConfig trailingSlash (${String(site.trailingSlash)}). ` +
        'Set it in one place (defineSiteConfig) so canonicals match the URLs Next.js serves.',
    );
  }
  const userRedirects = cfg.redirects;
  return {
    ...nextConfig,
    trailingSlash: site.trailingSlash,
    async redirects() {
      const own = userRedirects ? await userRedirects() : [];
      return [...own, ...seoRedirects(site, options)];
    },
  };
}
