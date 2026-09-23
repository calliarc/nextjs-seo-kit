import { describe, expect, it } from 'vitest';
import { defineSiteConfig, doubledHostRedirects, hostRedirects, seoRedirects, withSeoKit } from '../src';

const www = defineSiteConfig({ siteUrl: 'https://www.example.com' });
const bare = defineSiteConfig({ siteUrl: 'https://example.com', additionalHosts: ['old-example.net'] });

describe('hostRedirects', () => {
  it('redirects the bare host to www', () => {
    expect(hostRedirects(www)).toEqual([
      {
        source: '/',
        has: [{ type: 'host', value: 'example\\.com' }],
        destination: 'https://www.example.com/',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'example\\.com' }],
        destination: 'https://www.example.com/:path*',
        permanent: true,
      },
    ]);
  });

  it('redirects www and aliases to the bare host', () => {
    expect(hostRedirects(bare).map((r) => [r.has?.[0], r.source, r.destination])).toEqual([
      [{ type: 'host', value: 'www\\.example\\.com' }, '/', 'https://example.com/'],
      [{ type: 'host', value: 'www\\.example\\.com' }, '/:path*', 'https://example.com/:path*'],
      [{ type: 'host', value: 'old-example\\.net' }, '/', 'https://example.com/'],
      [{ type: 'host', value: 'old-example\\.net' }, '/:path*', 'https://example.com/:path*'],
    ]);
  });

  it('re-adds the trailing slash for pages but not files when trailingSlash is true', () => {
    const site = defineSiteConfig({ siteUrl: 'https://example.com', trailingSlash: true });
    expect(hostRedirects(site).map((r) => [r.source, r.destination])).toEqual([
      ['/', 'https://example.com/'],
      ['/:file((?:[^/]+/)*[^/]+\\.\\w+)', 'https://example.com/:file'],
      ['/:page((?:[^/]+/)*[^/.]+)', 'https://example.com/:page/'],
      ['/:path*', 'https://example.com/:path*'],
    ]);
  });

  it('does nothing for localhost', () => {
    expect(hostRedirects(defineSiteConfig({ siteUrl: 'http://localhost:3000' }))).toEqual([]);
  });
});

describe('doubledHostRedirects', () => {
  it('covers every known host', () => {
    expect(doubledHostRedirects(www)).toEqual([
      { source: '/www.example.com', destination: '/', permanent: true },
      { source: '/www.example.com/:path*', destination: '/:path*', permanent: true },
      { source: '/example.com', destination: '/', permanent: true },
      { source: '/example.com/:path*', destination: '/:path*', permanent: true },
    ]);
    const slash = defineSiteConfig({ siteUrl: 'https://example.com', trailingSlash: true });
    expect(doubledHostRedirects(slash).slice(0, 4).map((r) => [r.source, r.destination])).toEqual([
      ['/example.com', '/'],
      ['/example.com/:file((?:[^/]+/)*[^/]+\\.\\w+)', '/:file'],
      ['/example.com/:page((?:[^/]+/)*[^/.]+)', '/:page/'],
      ['/example.com/:path*', '/:path*'],
    ]);
  });

  it('works for local sites', () => {
    const local = defineSiteConfig({ siteUrl: 'http://localhost:3000' });
    expect(doubledHostRedirects(local).map((r) => r.source)).toEqual(['/localhost', '/localhost/:path*']);
  });
});

describe('seoRedirects / withSeoKit', () => {
  it('can disable parts', () => {
    expect(seoRedirects(www)).toHaveLength(6);
    expect(seoRedirects(www, { host: false })).toHaveLength(4);
    expect(seoRedirects(www, { doubledHost: false })).toHaveLength(2);
  });

  it('sets trailingSlash and appends presets after user redirects', async () => {
    const site = defineSiteConfig({ siteUrl: 'https://example.com', trailingSlash: true });
    const cfg = withSeoKit(site, {
      reactStrictMode: true,
      redirects: async () => [{ source: '/old', destination: '/new', permanent: true }],
    });
    expect(cfg.trailingSlash).toBe(true);
    expect(cfg.reactStrictMode).toBe(true);
    const r = await cfg.redirects();
    expect(r[0]).toEqual({ source: '/old', destination: '/new', permanent: true });
    expect(r).toHaveLength(1 + 8 + 4);
  });

  it('works without a user config', async () => {
    const cfg = withSeoKit(www);
    expect(cfg.trailingSlash).toBe(false);
    expect(await cfg.redirects()).toEqual(seoRedirects(www));
  });

  it('throws when trailingSlash disagrees', () => {
    expect(() => withSeoKit(www, { trailingSlash: true })).toThrow(/does not match/);
    expect(withSeoKit(www, { trailingSlash: false }).trailingSlash).toBe(false);
  });
});
