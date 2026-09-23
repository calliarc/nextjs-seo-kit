import { describe, expect, it } from 'vitest';
import { baseMetadata, buildMetadata, defineSiteConfig } from '../src';

const site = defineSiteConfig({
  siteUrl: 'https://www.example.com',
  siteName: 'Example',
  locale: 'en_US',
  twitterHandle: '@example',
  trailingSlash: true,
});

describe('buildMetadata', () => {
  it('builds canonical, openGraph and twitter with absolute URLs', () => {
    const m = buildMetadata(site, {
      path: 'example.com/privacy-policy',
      title: 'Privacy policy',
      description: 'How we handle data',
      images: '/og/privacy.png',
    });
    expect(String(m.metadataBase)).toBe('https://www.example.com/');
    expect(m.title).toBe('Privacy policy');
    expect(m.description).toBe('How we handle data');
    expect(m.alternates).toEqual({ canonical: 'https://www.example.com/privacy-policy/' });
    expect(m.openGraph).toEqual({
      url: 'https://www.example.com/privacy-policy/',
      title: 'Privacy policy',
      description: 'How we handle data',
      siteName: 'Example',
      locale: 'en_US',
      type: 'website',
      images: [{ url: 'https://www.example.com/og/privacy.png' }],
    });
    expect(m.twitter).toEqual({
      card: 'summary_large_image',
      site: '@example',
      title: 'Privacy policy',
      description: 'How we handle data',
      images: ['https://www.example.com/og/privacy.png'],
    });
    expect(m.robots).toBeUndefined();
  });

  it('uses a summary card without images and omits undefined fields', () => {
    const m = buildMetadata(site, { path: '/' });
    expect(m.title).toBeUndefined();
    expect('description' in m).toBe(false);
    expect(m.twitter).toEqual({ card: 'summary', site: '@example' });
    expect(m.openGraph).toEqual({
      url: 'https://www.example.com/',
      siteName: 'Example',
      locale: 'en_US',
      type: 'website',
    });
  });

  it('handles title objects', () => {
    const a = buildMetadata(site, { path: '/', title: { absolute: 'Home' } });
    expect((a.openGraph as { title: string }).title).toBe('Home');
    const d = buildMetadata(site, { path: '/', title: { default: 'D', template: '%s | X' } });
    expect((d.openGraph as { title: string }).title).toBe('D');
  });

  it('supports image objects, external images and multiple images', () => {
    const m = buildMetadata(site, {
      path: '/a',
      images: [{ url: 'og.png', width: 1200, height: 630, alt: 'A' }, 'https://cdn.other.net/b.png'],
    });
    expect((m.openGraph as { images: unknown }).images).toEqual([
      { url: 'https://www.example.com/og.png', width: 1200, height: 630, alt: 'A' },
      { url: 'https://cdn.other.net/b.png' },
    ]);
  });

  it('adds article fields, noindex, languages and overrides', () => {
    const published = new Date('2026-01-02T03:04:05Z');
    const m = buildMetadata(site, {
      path: '/blog/post?utm=1',
      type: 'article',
      publishedTime: published,
      modifiedTime: '2026-02-01',
      authors: ['Jane'],
      noindex: true,
      languages: { 'de-DE': '/de/blog/post', en: 'https://example.com/blog/post' },
      openGraph: { title: 'Override' },
      twitter: { creator: '@jane' },
    });
    expect(m.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-01-02T03:04:05.000Z',
      modifiedTime: '2026-02-01',
      authors: ['Jane'],
      title: 'Override',
      url: 'https://www.example.com/blog/post/',
    });
    expect(m.twitter).toMatchObject({ creator: '@jane' });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.alternates).toEqual({
      canonical: 'https://www.example.com/blog/post/',
      languages: {
        'de-DE': 'https://www.example.com/de/blog/post/',
        en: 'https://www.example.com/blog/post/',
      },
    });
  });

  it('keeps allow-listed query params', () => {
    const m = buildMetadata(site, { path: '/blog?page=2&utm=x', allowedQueryParams: ['page'] });
    expect(m.alternates?.canonical).toBe('https://www.example.com/blog/?page=2');
  });

  it('refuses a canonical on another host', () => {
    expect(() => buildMetadata(site, { path: 'https://other.com/x' })).toThrow(/not on/);
  });

  it('is available as a bound helper', () => {
    expect(site.buildMetadata({ path: '/x' }).alternates?.canonical).toBe('https://www.example.com/x/');
  });
});

describe('baseMetadata', () => {
  it('sets metadataBase and title template but never a canonical', () => {
    const m = baseMetadata(site, { titleTemplate: '%s | Example', description: 'D', images: '/og.png' });
    expect(String(m.metadataBase)).toBe('https://www.example.com/');
    expect(m.title).toEqual({ default: 'Example', template: '%s | Example' });
    expect(m.alternates).toBeUndefined();
    expect(m.openGraph).toMatchObject({ siteName: 'Example', images: [{ url: 'https://www.example.com/og.png' }] });
    expect(m.twitter).toEqual({
      card: 'summary_large_image',
      site: '@example',
      images: ['https://www.example.com/og.png'],
    });
  });

  it('works with minimal config', () => {
    const m = baseMetadata(defineSiteConfig({ siteUrl: 'https://example.com' }));
    expect(m.title).toBeUndefined();
    expect(m.twitter).toEqual({ card: 'summary' });
    expect(site.baseMetadata().title).toBe('Example');
  });
});
