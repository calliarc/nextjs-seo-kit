import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  defineSiteConfig,
  JsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from '../src';

const site = defineSiteConfig({ siteUrl: 'https://www.example.com', siteName: 'Example', trailingSlash: true });
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

describe('serializeJsonLd', () => {
  it('escapes characters that could break out of the script tag', () => {
    const input = { name: '</script><script>alert(1)</script>', c: '<!-- & -->', ls: `a${LS}b${PS}c` };
    const out = serializeJsonLd(input);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('&');
    expect(out).not.toContain(LS);
    expect(out).not.toContain(PS);
    expect(out).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(out)).toEqual(input);
  });

  it('throws on unserializable values', () => {
    expect(() => serializeJsonLd(undefined)).toThrow(/cannot be serialized/);
  });
});

describe('JsonLd component', () => {
  it('renders a safe script tag', () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: { '@type': 'Thing', name: '</script>x' }, id: 'ld', nonce: 'n' }),
    );
    expect(html).toBe(
      '<script type="application/ld+json" id="ld" nonce="n">{"@type":"Thing","name":"\\u003c/script\\u003ex"}</script>',
    );
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it('supports arrays', () => {
    const html = renderToStaticMarkup(createElement(JsonLd, { data: [{ '@type': 'A' }, { '@type': 'B' }] }));
    expect(html).toContain('[{"@type":"A"},{"@type":"B"}]');
  });
});

describe('organizationJsonLd', () => {
  it('builds with defaults from site config', () => {
    expect(organizationJsonLd(site, { logo: '/logo.png', sameAs: ['https://github.com/example'] })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://www.example.com/#organization',
      name: 'Example',
      url: 'https://www.example.com/',
      logo: 'https://www.example.com/logo.png',
      sameAs: ['https://github.com/example'],
    });
  });

  it('supports contact points and type override', () => {
    const o = organizationJsonLd(site, {
      type: 'LocalBusiness',
      contactPoint: [{ contactType: 'sales', email: 's@example.com' }],
    });
    expect(o['@type']).toBe('LocalBusiness');
    expect(o.contactPoint).toEqual([{ '@type': 'ContactPoint', contactType: 'sales', email: 's@example.com' }]);
    expect('sameAs' in o).toBe(false);
  });

  it('requires a name', () => {
    expect(() => organizationJsonLd(defineSiteConfig({ siteUrl: 'https://example.com' }))).toThrow(/needs a name/);
  });
});

describe('breadcrumbJsonLd', () => {
  it('uses absolute canonical URLs and positions', () => {
    expect(
      breadcrumbJsonLd(site, [{ name: 'Home', path: '/' }, { name: 'Blog', path: 'blog' }, { name: 'Post' }]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.example.com/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://www.example.com/blog/' },
        { '@type': 'ListItem', position: 3, name: 'Post' },
      ],
    });
  });

  it('validates items', () => {
    expect(() => breadcrumbJsonLd(site, [])).toThrow(/at least one/);
    expect(() => breadcrumbJsonLd(site, [{ name: 'A' }, { name: 'B', path: '/b' }])).toThrow(/needs a path/);
    expect(() => breadcrumbJsonLd(site, [{ name: '', path: '/' }])).toThrow(/missing a name/);
  });
});

describe('articleJsonLd', () => {
  it('builds an Article', () => {
    expect(
      articleJsonLd(site, {
        path: '/blog/hello?utm=1',
        headline: 'Hello',
        description: 'D',
        images: ['/og.png'],
        datePublished: new Date('2026-01-01T00:00:00Z'),
        authors: ['Jane', { name: 'Team', type: 'Organization', url: '/team' }],
        publisher: { name: 'Example', logo: '/logo.png' },
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Hello',
      description: 'D',
      url: 'https://www.example.com/blog/hello/',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://www.example.com/blog/hello/' },
      image: ['https://www.example.com/og.png'],
      datePublished: '2026-01-01T00:00:00.000Z',
      dateModified: '2026-01-01T00:00:00.000Z',
      author: [
        { '@type': 'Person', name: 'Jane' },
        { '@type': 'Organization', name: 'Team', url: 'https://www.example.com/team/' },
      ],
      publisher: {
        '@type': 'Organization',
        name: 'Example',
        logo: { '@type': 'ImageObject', url: 'https://www.example.com/logo.png' },
      },
    });
  });

  it('defaults publisher to siteName, supports BlogPosting and publisher:false', () => {
    const a = articleJsonLd(site, {
      path: '/p',
      headline: 'H',
      datePublished: '2026-01-01',
      dateModified: '2026-02-01',
      type: 'BlogPosting',
    });
    expect(a['@type']).toBe('BlogPosting');
    expect(a.publisher).toEqual({ '@type': 'Organization', name: 'Example' });
    expect(a.dateModified).toBe('2026-02-01');
    const b = articleJsonLd(site, { path: '/p', headline: 'H', datePublished: '2026-01-01', publisher: false });
    expect('publisher' in b).toBe(false);
  });

  it('validates required fields', () => {
    expect(() => articleJsonLd(site, { path: '/p', headline: '', datePublished: '2026-01-01' })).toThrow(/headline/);
    expect(() => articleJsonLd(site, { path: '/p', headline: 'H', datePublished: '' })).toThrow(/datePublished/);
  });
});
