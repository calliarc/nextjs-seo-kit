import { describe, expect, it } from 'vitest';
import { defineSiteConfig } from '../src';
import { createSeoMiddleware, createSeoProxy, getSeoRedirect } from '../src/proxy';

const site = defineSiteConfig({ siteUrl: 'https://www.example.com' });
const slash = defineSiteConfig({ siteUrl: 'https://example.com', trailingSlash: true });

function req(url: string, headers: Record<string, string> = {}) {
  const u = new URL(url);
  return { url, headers: new Headers({ host: u.host, ...headers }) };
}

describe('getSeoRedirect', () => {
  it('redirects the alternate host, keeping path and query', () => {
    expect(getSeoRedirect(site, req('https://example.com/a/b?x=1'))?.href).toBe('https://www.example.com/a/b?x=1');
    expect(getSeoRedirect(site, req('http://example.com/'))?.href).toBe('https://www.example.com/');
  });

  it('uses x-forwarded-host when present', () => {
    expect(getSeoRedirect(site, req('http://internal:3000/a', { 'x-forwarded-host': 'example.com' }))?.href).toBe(
      'https://www.example.com/a',
    );
    expect(
      getSeoRedirect(site, req('https://www.example.com/a', { 'x-forwarded-host': 'www.example.com, proxy' })),
    ).toBeNull();
  });

  it('does not touch the canonical host or unknown hosts', () => {
    expect(getSeoRedirect(site, req('https://www.example.com/a'))).toBeNull();
    expect(getSeoRedirect(site, req('http://localhost:3000/a'))).toBeNull();
    expect(getSeoRedirect(site, req('https://my-app-git-branch.vercel.app/a'))).toBeNull();
  });

  it('repairs doubled-host paths on any host', () => {
    expect(getSeoRedirect(site, req('https://www.example.com/example.com/privacy-policy'))?.href).toBe(
      'https://www.example.com/privacy-policy',
    );
    expect(getSeoRedirect(site, req('http://localhost:3000/www.example.com/a?q=1'))?.href).toBe(
      'http://localhost:3000/a?q=1',
    );
    expect(getSeoRedirect(site, req('https://example.com/example.com/a'))?.href).toBe('https://www.example.com/a');
    expect(getSeoRedirect(site, req('https://www.example.com/example.com'))?.href).toBe('https://www.example.com/');
  });

  it('collapses duplicate slashes and applies the site trailing-slash style in the same hop', () => {
    expect(getSeoRedirect(site, req('https://www.example.com//a//b/'))?.href).toBe('https://www.example.com/a/b');
    expect(getSeoRedirect(site, req('https://www.example.com/example.com/a/'))?.href).toBe('https://www.example.com/a');
    expect(getSeoRedirect(slash, req('https://example.com/example.com/a'))?.href).toBe('https://example.com/a/');
    expect(getSeoRedirect(slash, req('https://example.com/example.com/sitemap.xml'))?.href).toBe(
      'https://example.com/sitemap.xml',
    );
    expect(getSeoRedirect(slash, req('https://example.com//api//x'))?.href).toBe('https://example.com/api/x');
  });

  it('optionally enforces trailing slashes, skipping files and internals', () => {
    const opts = { trailingSlash: true };
    expect(getSeoRedirect(slash, req('https://example.com/about'), opts)?.href).toBe('https://example.com/about/');
    expect(getSeoRedirect(slash, req('https://example.com/about/'), opts)).toBeNull();
    expect(getSeoRedirect(slash, req('https://example.com/robots.txt'), opts)).toBeNull();
    expect(getSeoRedirect(slash, req('https://example.com/_next/static/x'), opts)).toBeNull();
    expect(getSeoRedirect(slash, req('https://example.com/api/x'), opts)).toBeNull();
    expect(getSeoRedirect(site, req('https://www.example.com/about/'), opts)?.href).toBe('https://www.example.com/about');
    expect(getSeoRedirect(slash, req('https://example.com/'), opts)).toBeNull();
    expect(getSeoRedirect(slash, req('https://www.example.com/a?b=1'), opts)?.href).toBe('https://example.com/a/?b=1');
  });

  it('respects options', () => {
    expect(getSeoRedirect(site, req('https://example.com/a'), { host: false })).toBeNull();
    expect(getSeoRedirect(site, req('https://www.example.com/example.com/a'), { doubledHost: false })).toBeNull();
    expect(getSeoRedirect(site, req('https://example.com/a'), { skip: (p) => p.startsWith('/a') })).toBeNull();
  });
});

describe('createSeoProxy', () => {
  it('returns a redirect Response or undefined', () => {
    const proxy = createSeoProxy(site);
    const res = proxy(new Request('https://example.com/x?y=1'));
    expect(res?.status).toBe(308);
    expect(res?.headers.get('location')).toBe('https://www.example.com/x?y=1');
    expect(proxy(new Request('https://www.example.com/x'))).toBeUndefined();
  });

  it('supports a custom status and the middleware alias', () => {
    expect(createSeoMiddleware).toBe(createSeoProxy);
    expect(createSeoProxy(site, { status: 301 })(req('https://example.com/'))?.status).toBe(301);
  });
});
