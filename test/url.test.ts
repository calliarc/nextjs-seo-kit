import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  canonical,
  defineSiteConfig,
  isDoubledHostPath,
  isFilePath,
  normalizePath,
  relativePath,
} from '../src';

const site = defineSiteConfig({ siteUrl: 'https://www.example.com' });
const slash = defineSiteConfig({ siteUrl: 'https://example.com', trailingSlash: true });

describe('canonical', () => {
  it.each([
    ['/', 'https://www.example.com/'],
    ['', 'https://www.example.com/'],
    ['/about', 'https://www.example.com/about'],
    ['about', 'https://www.example.com/about'],
    ['/about/', 'https://www.example.com/about'],
    ['//about//team///', 'https://www.example.com/about/team'],
    ['  /about  ', 'https://www.example.com/about'],
    ['\\about\\team', 'https://www.example.com/about/team'],
    ['/a/./b/../c', 'https://www.example.com/a/c'],
    ['/../../etc', 'https://www.example.com/etc'],
    ['/About', 'https://www.example.com/About'],
    ['/hello world', 'https://www.example.com/hello%20world'],
    ['/über', 'https://www.example.com/%C3%BCber'],
    ['/%C3%BCber', 'https://www.example.com/%C3%BCber'],
    ['/sitemap.xml', 'https://www.example.com/sitemap.xml'],
  ])('canonical(%j) -> %s', (input, expected) => {
    expect(canonical(site, input)).toBe(expected);
  });

  it('defaults to the root', () => {
    expect(canonical(site)).toBe('https://www.example.com/');
  });

  it('strips query and hash by default', () => {
    expect(canonical(site, '/blog?utm_source=x&page=2#top')).toBe('https://www.example.com/blog');
    expect(canonical(site, '/blog#top')).toBe('https://www.example.com/blog');
    expect(canonical(site, '?a=1')).toBe('https://www.example.com/');
  });

  it('keeps allow-listed query params (config and per call)', () => {
    const paged = defineSiteConfig({ siteUrl: 'https://example.com', allowedQueryParams: ['page'] });
    expect(canonical(paged, '/blog?utm_source=x&page=2#top')).toBe('https://example.com/blog?page=2');
    expect(canonical(paged, '/blog?utm_source=x')).toBe('https://example.com/blog');
    expect(canonical(site, '/search?q=a b&x=1', { allowedQueryParams: ['q'] })).toBe('https://www.example.com/search?q=a+b');
    expect(canonical(paged, '/blog?page=2', { allowedQueryParams: [] })).toBe('https://example.com/blog');
  });

  it('repairs doubled-host paths', () => {
    expect(canonical(site, '/www.example.com/privacy-policy')).toBe('https://www.example.com/privacy-policy');
    expect(canonical(site, '/example.com/privacy-policy/')).toBe('https://www.example.com/privacy-policy');
    expect(canonical(site, 'example.com/privacy-policy')).toBe('https://www.example.com/privacy-policy');
    expect(canonical(site, 'www.example.com')).toBe('https://www.example.com/');
    expect(canonical(site, '/EXAMPLE.com/x')).toBe('https://www.example.com/x');
    expect(canonical(site, '/example.com/example.com/x')).toBe('https://www.example.com/x');
    expect(canonical(site, '/https:/example.com/x')).toBe('https://www.example.com/x');
    expect(canonical(site, 'example.com:3000/x')).toBe('https://www.example.com/x');
    expect(canonical(site, '//example.com/x')).toBe('https://www.example.com/x');
    expect(canonical(site, '/example.com./x')).toBe('https://www.example.com/x');
    expect(canonical(site, '/example%2Ecom/x')).toBe('https://www.example.com/x');
  });

  it('does not treat unrelated dotted segments as hosts', () => {
    expect(canonical(site, '/docs/example.com/x')).toBe('https://www.example.com/docs/example.com/x');
    expect(canonical(site, '/other.com/x')).toBe('https://www.example.com/other.com/x');
    expect(canonical(site, '/v1.2/notes')).toBe('https://www.example.com/v1.2/notes');
  });

  it('can throw on doubled-host paths instead of repairing', () => {
    const strict = defineSiteConfig({ siteUrl: 'https://example.com', doubledHostPaths: 'throw' });
    expect(() => canonical(strict, '/example.com/page')).toThrow(/instead of "https:\/\/example.com/);
    expect(canonical(strict, 'https://example.com/page')).toBe('https://example.com/page');
  });

  it('accepts absolute URLs on the same site (any www variant, http or https)', () => {
    expect(canonical(site, 'https://www.example.com/a?x=1#h')).toBe('https://www.example.com/a');
    expect(canonical(site, 'http://example.com/a/')).toBe('https://www.example.com/a');
    expect(canonical(site, 'HTTPS://WWW.EXAMPLE.COM')).toBe('https://www.example.com/');
    expect(canonical(site, new URL('https://example.com/u'))).toBe('https://www.example.com/u');
  });

  it('accepts additionalHosts as the same site', () => {
    const s = defineSiteConfig({ siteUrl: 'https://example.com', additionalHosts: ['old.example.net'] });
    expect(canonical(s, 'https://old.example.net/a')).toBe('https://example.com/a');
    expect(canonical(s, '/old.example.net/a')).toBe('https://example.com/a');
  });

  it('rejects external URLs and other schemes', () => {
    expect(() => canonical(site, 'https://evil.com/a')).toThrow(/not on https:\/\/www.example.com/);
    expect(() => canonical(site, '//cdn.other.net/a')).toThrow(/not on/);
    expect(() => canonical(site, 'mailto:a@b.c')).toThrow(/only handles http/);
    expect(() => canonical(site, 'javascript:alert(1)')).toThrow(/only handles http/);
    expect(() => canonical(site, 42 as never)).toThrow(/expects a path string/);
    expect(() => canonical(site, null as never)).toThrow(/got null/);
  });

  describe('trailingSlash: true', () => {
    it.each([
      ['/', 'https://example.com/'],
      ['/about', 'https://example.com/about/'],
      ['/about/', 'https://example.com/about/'],
      ['/about//', 'https://example.com/about/'],
      ['/sitemap.xml', 'https://example.com/sitemap.xml'],
      ['/sitemap.xml/', 'https://example.com/sitemap.xml'],
      ['/img/og.png', 'https://example.com/img/og.png'],
      ['/example.com/privacy-policy', 'https://example.com/privacy-policy/'],
      ['/blog?page=2', 'https://example.com/blog/'],
    ])('canonical(%j) -> %s', (input, expected) => {
      expect(canonical(slash, input)).toBe(expected);
    });
  });
});

describe('absoluteUrl', () => {
  it('keeps query and hash', () => {
    expect(absoluteUrl(site, '/a?x=1&y=2#h')).toBe('https://www.example.com/a?x=1&y=2#h');
    expect(absoluteUrl(slash, 'blog?x=1')).toBe('https://example.com/blog/?x=1');
  });
  it('repairs doubled hosts and normalizes slashes', () => {
    expect(absoluteUrl(site, 'example.com/og.png')).toBe('https://www.example.com/og.png');
    expect(absoluteUrl(site, '//img//og.png')).toBe('https://www.example.com/img/og.png');
  });
  it('passes external URLs through and upgrades protocol-relative ones', () => {
    expect(absoluteUrl(site, 'https://cdn.other.net/a.png?v=1')).toBe('https://cdn.other.net/a.png?v=1');
    expect(absoluteUrl(site, '//cdn.other.net/a.png')).toBe('https://cdn.other.net/a.png');
  });
  it('rewrites same-site absolute URLs to the canonical host', () => {
    expect(absoluteUrl(site, 'http://example.com/a#b')).toBe('https://www.example.com/a#b');
  });
});

describe('relativePath / normalizePath', () => {
  it('returns site-relative hrefs', () => {
    expect(relativePath(slash, 'example.com/privacy-policy')).toBe('/privacy-policy/');
    expect(relativePath(site, 'https://example.com/a?b=1')).toBe('/a?b=1');
    expect(relativePath(site, 'https://other.com/a')).toBe('https://other.com/a');
  });
  it('reports doubled-host repairs', () => {
    expect(normalizePath(site, '/example.com/x?y=1#z')).toEqual({
      pathname: '/x',
      search: '?y=1',
      hash: '#z',
      repairedDoubledHost: true,
    });
    expect(normalizePath(site, '/x')).toEqual({ pathname: '/x', search: '', hash: '', repairedDoubledHost: false });
    expect(() => normalizePath(site, 'https://other.com')).toThrow(/external/);
  });
});

describe('isDoubledHostPath / isFilePath', () => {
  it('detects doubled hosts', () => {
    expect(isDoubledHostPath(site, '/example.com/x')).toBe(true);
    expect(isDoubledHostPath(site, 'www.example.com/x')).toBe(true);
    expect(isDoubledHostPath(site, '/https:/www.example.com/x')).toBe(true);
    expect(isDoubledHostPath(site, '/x/example.com')).toBe(false);
    expect(isDoubledHostPath(site, 'https://example.com/x')).toBe(false);
    expect(isDoubledHostPath(site, '/')).toBe(false);
  });
  it('detects file paths like Next.js does', () => {
    expect(isFilePath('/robots.txt')).toBe(true);
    expect(isFilePath('/a/b.webmanifest/')).toBe(true);
    expect(isFilePath('/about')).toBe(false);
    expect(isFilePath('/')).toBe(false);
  });
});
