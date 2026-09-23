import type { SiteConfig } from './config';
import { isFilePath, normalizePath } from './url';

export interface SeoProxyOptions {
  /** Redirect alternate hosts (www / non-www / aliases) to the canonical host. @default true */
  host?: boolean;
  /** Redirect `/example.com/page` and `//page` to `/page`. @default true */
  doubledHost?: boolean;
  /**
   * Enforce the trailing-slash policy here. Usually unnecessary: Next's `trailingSlash` option
   * (set by `withSeoKit`) already redirects. Enable only if you cannot use that option.
   * @default false
   */
  trailingSlash?: boolean;
  /** HTTP status for redirects. @default 308 */
  status?: 301 | 302 | 307 | 308;
  /** Return true to leave a pathname alone. `/_next/*` and `/api/*` are always skipped for trailing slashes. */
  skip?: (pathname: string) => boolean;
}

/** Minimal request shape: works with `NextRequest` and the standard `Request`. */
export interface RequestLike {
  url: string;
  headers: { get(name: string): string | null };
}

function requestHost(request: RequestLike, url: URL): string {
  const raw = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  return (raw.split(',')[0] ?? '').trim().toLowerCase().replace(/:\d+$/, '');
}

/**
 * Compute the redirect target for a request, or `null` if the URL is already canonical.
 * Unknown hosts (localhost, preview deployments) are never redirected to production.
 */
export function getSeoRedirect(site: SiteConfig, request: RequestLike, options: SeoProxyOptions = {}): URL | null {
  const url = new URL(request.url);
  const host = requestHost(request, url);
  if (options.skip?.(url.pathname)) return null;

  let target = new URL(url.href);
  let changed = false;

  if ((options.host ?? true) && !site.isLocal && site.alternateHosts.includes(host)) {
    target = new URL(`${url.pathname}${url.search}${url.hash}`, site.origin);
    changed = true;
  }

  if (options.doubledHost ?? true) {
    const hasDoubleSlash = /\/\/+/.test(url.pathname);
    let repaired = false;
    let pathname = url.pathname;
    try {
      const normalized = normalizePath({ ...site, doubledHostPaths: 'repair' }, url.pathname);
      repaired = normalized.repairedDoubledHost;
      pathname = normalized.pathname;
    } catch {
      /* leave malformed paths to Next */
    }
    if (repaired || hasDoubleSlash) {
      // We are redirecting anyway, so go straight to the site's trailing-slash style (one hop),
      // except for API routes whose slash handling is up to the app.
      if (pathname.startsWith('/api/') || pathname === '/api') {
        pathname = pathname.replace(/\/+$/, '') + (url.pathname.endsWith('/') ? '/' : '');
      }
      target.pathname = pathname;
      changed = true;
    }
  }

  if (options.trailingSlash) {
    const p = target.pathname;
    const internal = p.startsWith('/_next') || p.startsWith('/api/') || p === '/api' || p.startsWith('/.well-known');
    if (!internal && p !== '/') {
      const bare = p.replace(/\/+$/, '');
      const wanted = site.trailingSlash && !isFilePath(bare) ? `${bare}/` : bare;
      if (wanted !== p) {
        target.pathname = wanted;
        changed = true;
      }
    }
  }

  return changed && target.href !== url.href ? target : null;
}

/**
 * Create a Next.js proxy (Next 16+, `proxy.ts`) or middleware (Next 14/15, `middleware.ts`) handler.
 * It returns a redirect `Response` or `undefined` (continue), so it can be composed:
 *
 * @example
 * // proxy.ts (Next 16+)
 * export const proxy = createSeoProxy(site);
 * // middleware.ts (Next 14/15)
 * export const middleware = createSeoProxy(site);
 */
export function createSeoProxy(site: SiteConfig, options: SeoProxyOptions = {}) {
  const status = options.status ?? 308;
  return function seoProxy(request: RequestLike): Response | undefined {
    const target = getSeoRedirect(site, request, options);
    if (!target) return undefined;
    return new Response(null, { status, headers: { Location: target.href } });
  };
}

/** Alias of `createSeoProxy` for projects still on `middleware.ts`. */
export const createSeoMiddleware = createSeoProxy;
