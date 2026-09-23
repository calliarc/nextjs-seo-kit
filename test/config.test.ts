import { describe, expect, it } from 'vitest';
import { defineSiteConfig, SeoKitError } from '../src';

describe('defineSiteConfig', () => {
  it('accepts an https origin and normalizes it', () => {
    const site = defineSiteConfig({ siteUrl: 'https://Example.COM/' });
    expect(site.origin).toBe('https://example.com');
    expect(site.hostname).toBe('example.com');
    expect(site.preferWww).toBe(false);
    expect(site.trailingSlash).toBe(false);
    expect(site.alternateHosts).toEqual(['www.example.com']);
    expect(site.knownHosts).toEqual(['example.com', 'www.example.com']);
  });

  it('trims whitespace (e.g. from env files)', () => {
    expect(defineSiteConfig({ siteUrl: '  https://example.com\n' }).origin).toBe('https://example.com');
  });

  it('throws a helpful error for a host without scheme (the doubled-URL bug)', () => {
    expect(() => defineSiteConfig({ siteUrl: 'example.com' })).toThrow(SeoKitError);
    expect(() => defineSiteConfig({ siteUrl: 'example.com' })).toThrow(
      /missing "https:\/\/".*Did you mean "https:\/\/example.com"/,
    );
    expect(() => defineSiteConfig({ siteUrl: 'www.example.com/' })).toThrow(/Did you mean "https:\/\/www.example.com"/);
    expect(() => defineSiteConfig({ siteUrl: '//example.com' })).toThrow(/Did you mean "https:\/\/example.com"/);
    expect(() => defineSiteConfig({ siteUrl: 'example.com:3000' })).toThrow(/missing "https:\/\/"/);
  });

  it('rejects malformed schemes', () => {
    expect(() => defineSiteConfig({ siteUrl: 'https:/example.com' })).toThrow(/missing "https:\/\/"/);
    expect(() => defineSiteConfig({ siteUrl: 'https:example.com' })).toThrow(SeoKitError);
    expect(() => defineSiteConfig({ siteUrl: 'ftp://example.com' })).toThrow(/must use https/);
  });

  it('rejects http except for localhost', () => {
    expect(() => defineSiteConfig({ siteUrl: 'http://example.com' })).toThrow(/must use https.*https:\/\/example.com/);
    const local = defineSiteConfig({ siteUrl: 'http://localhost:3000' });
    expect(local.origin).toBe('http://localhost:3000');
    expect(local.isLocal).toBe(true);
    expect(local.alternateHosts).toEqual([]);
    expect(defineSiteConfig({ siteUrl: 'http://127.0.0.1:8080' }).origin).toBe('http://127.0.0.1:8080');
  });

  it('rejects empty / missing values', () => {
    expect(() => defineSiteConfig({ siteUrl: '' })).toThrow(/required/);
    expect(() => defineSiteConfig({ siteUrl: undefined as unknown as string })).toThrow(/environment variable/);
    expect(() => defineSiteConfig(null as never)).toThrow(SeoKitError);
  });

  it('rejects paths, query strings, hashes and credentials', () => {
    expect(() => defineSiteConfig({ siteUrl: 'https://example.com/blog' })).toThrow(/origin only/);
    expect(() => defineSiteConfig({ siteUrl: 'https://example.com/?a=1' })).toThrow(/query string/);
    expect(() => defineSiteConfig({ siteUrl: 'https://example.com#x' })).toThrow(/query string or hash/);
    expect(() => defineSiteConfig({ siteUrl: 'https://u:p@example.com' })).toThrow(/credentials/);
  });

  it('applies preferWww in both directions', () => {
    expect(defineSiteConfig({ siteUrl: 'https://example.com', preferWww: true }).origin).toBe('https://www.example.com');
    const bare = defineSiteConfig({ siteUrl: 'https://www.example.com', preferWww: false });
    expect(bare.origin).toBe('https://example.com');
    expect(bare.alternateHosts).toEqual(['www.example.com']);
    const www = defineSiteConfig({ siteUrl: 'https://www.example.com' });
    expect(www.preferWww).toBe(true);
    expect(www.alternateHosts).toEqual(['example.com']);
  });

  it('keeps ports', () => {
    expect(defineSiteConfig({ siteUrl: 'https://example.com:8443' }).origin).toBe('https://example.com:8443');
  });

  it('handles additionalHosts', () => {
    const site = defineSiteConfig({
      siteUrl: 'https://www.example.com',
      additionalHosts: ['old-example.com', 'https://Example.org/', 'www.example.com'],
    });
    expect(site.alternateHosts).toEqual(['example.com', 'old-example.com', 'example.org']);
    expect(() => defineSiteConfig({ siteUrl: 'https://example.com', additionalHosts: ['not a host'] })).toThrow(
      /valid hostname/,
    );
  });

  it('normalizes the twitter handle and validates options', () => {
    expect(defineSiteConfig({ siteUrl: 'https://example.com', twitterHandle: 'example' }).twitterHandle).toBe('@example');
    expect(() => defineSiteConfig({ siteUrl: 'https://example.com', trailingSlash: 'yes' as never })).toThrow(/boolean/);
    expect(() => defineSiteConfig({ siteUrl: 'https://example.com', doubledHostPaths: 'x' as never })).toThrow(/repair/);
    expect(() => defineSiteConfig({ siteUrl: 'https://example.com', allowedQueryParams: [''] })).toThrow(
      /allowedQueryParams/,
    );
  });

  it('returns a frozen object with bound helpers', () => {
    const site = defineSiteConfig({ siteUrl: 'https://example.com' });
    expect(Object.isFrozen(site)).toBe(true);
    expect(site.canonical('about')).toBe('https://example.com/about');
    expect(site.canonical()).toBe('https://example.com/');
    expect(site.absoluteUrl('/og.png')).toBe('https://example.com/og.png');
    expect(site.relativePath('about')).toBe('/about');
    expect(site.normalizePath('/example.com/x').repairedDoubledHost).toBe(true);
  });
});
