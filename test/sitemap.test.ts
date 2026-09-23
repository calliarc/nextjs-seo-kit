import { describe, expect, it } from 'vitest';
import { buildRobots, buildSitemap, defineSiteConfig } from '../src';

const site = defineSiteConfig({ siteUrl: 'https://www.example.com', trailingSlash: true });

describe('buildSitemap', () => {
  it('produces absolute normalized URLs and dedupes', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const out = buildSitemap(site, [
      '/',
      'about',
      '/about/',
      'example.com/privacy-policy',
      'https://example.com/privacy-policy?utm=1',
      { path: '/blog', lastModified: d, changeFrequency: 'weekly', priority: 0.8, images: ['/og.png'] },
      { path: '/de', languages: { en: '/', de: '/de' } },
    ]);
    expect(out).toEqual([
      { url: 'https://www.example.com/' },
      { url: 'https://www.example.com/about/' },
      { url: 'https://www.example.com/privacy-policy/' },
      {
        url: 'https://www.example.com/blog/',
        lastModified: d,
        changeFrequency: 'weekly',
        priority: 0.8,
        images: ['https://www.example.com/og.png'],
      },
      {
        url: 'https://www.example.com/de/',
        alternates: { languages: { en: 'https://www.example.com/', de: 'https://www.example.com/de/' } },
      },
    ]);
  });

  it('can keep duplicates', () => {
    expect(buildSitemap(site, ['/a', '/a/'], { dedupe: false })).toHaveLength(2);
  });

  it('validates priority and rejects external URLs', () => {
    expect(() => buildSitemap(site, [{ path: '/a', priority: 2 }])).toThrow(/between 0 and 1/);
    expect(() => buildSitemap(site, [{ path: '/a', priority: Number.NaN }])).toThrow(/between 0 and 1/);
    expect(() => buildSitemap(site, ['https://other.com/'])).toThrow(/not on/);
  });

  it('is available as a bound helper', () => {
    expect(site.sitemap([])).toEqual([]);
  });
});

describe('buildRobots', () => {
  it('defaults to allow all with an absolute sitemap', () => {
    expect(buildRobots(site)).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://www.example.com/sitemap.xml',
    });
  });

  it('supports disallow, multiple sitemaps, host and custom rules', () => {
    expect(
      buildRobots(site, {
        disallow: ['admin', '/api/'],
        sitemaps: ['/sitemap.xml', 'https://cdn.other.net/s.xml'],
        host: true,
      }),
    ).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
      sitemap: ['https://www.example.com/sitemap.xml', 'https://cdn.other.net/s.xml'],
      host: 'https://www.example.com',
    });
    expect(buildRobots(site, { rules: [{ userAgent: 'GPTBot', disallow: '/' }], sitemaps: false })).toEqual({
      rules: [{ userAgent: 'GPTBot', disallow: '/' }],
    });
  });

  it('supports disallowAll for staging', () => {
    expect(site.robots({ disallowAll: true, sitemaps: false })).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
});
