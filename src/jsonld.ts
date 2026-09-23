import type { SiteConfig } from './config';
import { SeoKitError } from './errors';
import { absoluteUrl, canonical } from './url';

export type JsonLdObject = { '@context'?: string; '@type': string | string[] } & Record<string, unknown>;

function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined).map(clean) as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out[k] = clean(v);
    }
    return out as T;
  }
  return value;
}

const iso = (d: string | Date | undefined) => (d instanceof Date ? d.toISOString() : d);

export interface OrganizationInput {
  /** Defaults to `site.siteName`. */
  name?: string;
  /** Defaults to the site root. */
  url?: string;
  /** Path or URL of the logo. */
  logo?: string;
  description?: string;
  /** Social profile URLs. */
  sameAs?: string[];
  email?: string;
  telephone?: string;
  contactPoint?: Array<{ contactType: string; email?: string; telephone?: string; areaServed?: string | string[]; availableLanguage?: string | string[] }>;
  /** Override `@type`, e.g. `"LocalBusiness"`. */
  type?: string;
}

/** schema.org `Organization`. */
export function organizationJsonLd(site: SiteConfig, input: OrganizationInput = {}): JsonLdObject {
  const name = input.name ?? site.siteName;
  if (!name) throw new SeoKitError('organizationJsonLd() needs a name (pass name or set siteName in defineSiteConfig).');
  return clean({
    '@context': 'https://schema.org',
    '@type': input.type ?? 'Organization',
    '@id': `${canonical(site, '/')}#organization`,
    name,
    url: input.url ? absoluteUrl(site, input.url) : canonical(site, '/'),
    logo: input.logo ? absoluteUrl(site, input.logo) : undefined,
    description: input.description,
    sameAs: input.sameAs,
    email: input.email,
    telephone: input.telephone,
    contactPoint: input.contactPoint?.map((c) => ({ '@type': 'ContactPoint', ...c })),
  });
}

export interface BreadcrumbItem {
  name: string;
  /** Path of the crumb. May be omitted for the last (current) item. */
  path?: string;
}

/** schema.org `BreadcrumbList` with absolute, canonical item URLs. */
export function breadcrumbJsonLd(site: SiteConfig, items: BreadcrumbItem[]): JsonLdObject {
  if (!Array.isArray(items) || items.length === 0) throw new SeoKitError('breadcrumbJsonLd() needs at least one item.');
  return clean({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => {
      if (!item.name) throw new SeoKitError(`breadcrumbJsonLd() item ${i + 1} is missing a name.`);
      if (item.path === undefined && i !== items.length - 1) {
        throw new SeoKitError(`breadcrumbJsonLd() item "${item.name}" needs a path (only the last item may omit it).`);
      }
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.path === undefined ? undefined : canonical(site, item.path),
      };
    }),
  });
}

export interface ArticleAuthor {
  name: string;
  url?: string;
  type?: 'Person' | 'Organization';
}

export interface ArticleInput {
  path: string;
  headline: string;
  description?: string;
  images?: string[];
  datePublished: string | Date;
  dateModified?: string | Date;
  authors?: Array<string | ArticleAuthor>;
  /** Publisher; defaults to `site.siteName` as an Organization. `false` to omit. */
  publisher?: { name: string; logo?: string } | false;
  type?: 'Article' | 'BlogPosting' | 'NewsArticle' | 'TechArticle';
}

/** schema.org `Article` (or `BlogPosting` / `NewsArticle`). */
export function articleJsonLd(site: SiteConfig, input: ArticleInput): JsonLdObject {
  if (!input.headline) throw new SeoKitError('articleJsonLd() needs a headline.');
  if (!input.datePublished) throw new SeoKitError('articleJsonLd() needs datePublished.');
  const url = canonical(site, input.path);
  const publisher =
    input.publisher === false
      ? undefined
      : (input.publisher ?? (site.siteName ? { name: site.siteName } : undefined));
  return clean({
    '@context': 'https://schema.org',
    '@type': input.type ?? 'Article',
    headline: input.headline,
    description: input.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: input.images?.map((i) => absoluteUrl(site, i)),
    datePublished: iso(input.datePublished),
    dateModified: iso(input.dateModified ?? input.datePublished),
    author: input.authors?.map((a) =>
      typeof a === 'string'
        ? { '@type': 'Person', name: a }
        : { '@type': a.type ?? 'Person', name: a.name, url: a.url ? absoluteUrl(site, a.url) : undefined },
    ),
    publisher: publisher
      ? {
          '@type': 'Organization',
          name: publisher.name,
          logo: publisher.logo ? { '@type': 'ImageObject', url: absoluteUrl(site, publisher.logo) } : undefined,
        }
      : undefined,
  });
}

/**
 * Serialize JSON-LD for embedding in `<script type="application/ld+json">`.
 * Escapes `<`, `>`, `&` and U+2028/U+2029 so user content can never close the script tag
 * (`</script>`) or start an HTML comment.
 */
export function serializeJsonLd(data: unknown): string {
  const json = JSON.stringify(data);
  if (json === undefined) throw new SeoKitError('serializeJsonLd() received a value that cannot be serialized to JSON.');
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\u2029');
}
