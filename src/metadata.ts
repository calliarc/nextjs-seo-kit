import type { Metadata } from 'next';
import type { SiteConfig } from './config';
import { absoluteUrl, canonical, type CanonicalOptions } from './url';

export interface SeoImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
}

export type SeoImageInput = string | SeoImage;

export interface BuildMetadataInput extends CanonicalOptions {
  /** Path of the page, e.g. `/blog/hello-world`. Used for the canonical and `og:url`. */
  path: string;
  title?: Metadata['title'];
  description?: string;
  /** One or more images for Open Graph and Twitter. Relative paths are made absolute. */
  images?: SeoImageInput | SeoImageInput[];
  /** Open Graph type. @default "website" */
  type?: 'website' | 'article';
  /** Article dates / authors (only used when `type` is `"article"`). */
  publishedTime?: string | Date;
  modifiedTime?: string | Date;
  authors?: string[];
  /** Adds `robots: { index: false, follow: true }`. */
  noindex?: boolean;
  /** hreflang alternates: `{ "en-US": "/en/page", "de-DE": "/de/page" }`. Values are canonicalized. */
  languages?: Record<string, string>;
  /** Shallow-merged over the generated `openGraph` object. */
  openGraph?: Metadata['openGraph'];
  /** Shallow-merged over the generated `twitter` object. */
  twitter?: Metadata['twitter'];
}

function toIso(value: string | Date | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function plainTitle(title: Metadata['title']): string | undefined {
  if (title == null) return undefined;
  if (typeof title === 'string') return title;
  if ('absolute' in title && title.absolute) return title.absolute;
  if ('default' in title) return title.default;
  return undefined;
}

export function normalizeImages(site: SiteConfig, images: SeoImageInput | SeoImageInput[] | undefined): SeoImage[] | undefined {
  if (images === undefined) return undefined;
  const list = Array.isArray(images) ? images : [images];
  return list.map((img) => (typeof img === 'string' ? { url: absoluteUrl(site, img) } : { ...img, url: absoluteUrl(site, img.url) }));
}

function compact<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) if (obj[key] === undefined) delete obj[key];
  return obj;
}

/**
 * Build a Next.js `Metadata` object for a page with an absolute canonical,
 * matching `og:url`, and Twitter card tags.
 *
 * @example
 * export const metadata = buildMetadata(site, { path: '/about', title: 'About', description: '...' });
 */
export function buildMetadata(site: SiteConfig, input: BuildMetadataInput): Metadata {
  const url = canonical(site, input.path, input);
  const images = normalizeImages(site, input.images);
  const ogTitle = plainTitle(input.title);
  const type = input.type ?? 'website';

  let languages: Record<string, string> | undefined;
  if (input.languages) {
    languages = {};
    for (const [lang, path] of Object.entries(input.languages)) languages[lang] = canonical(site, path, input);
  }

  const openGraph = compact({
    url,
    title: ogTitle,
    description: input.description,
    siteName: site.siteName,
    locale: site.locale,
    type,
    images,
    ...(type === 'article'
      ? compact({
          publishedTime: toIso(input.publishedTime),
          modifiedTime: toIso(input.modifiedTime),
          authors: input.authors,
        })
      : {}),
    ...(input.openGraph ?? {}),
  }) as Metadata['openGraph'];

  const twitter = compact({
    card: images && images.length > 0 ? 'summary_large_image' : 'summary',
    site: site.twitterHandle,
    title: ogTitle,
    description: input.description,
    images: images?.map((i) => i.url),
    ...(input.twitter ?? {}),
  }) as Metadata['twitter'];

  const metadata: Metadata = {
    metadataBase: new URL(site.origin),
    alternates: languages ? { canonical: url, languages } : { canonical: url },
    openGraph,
    twitter,
  };
  if (input.title !== undefined) metadata.title = input.title;
  if (input.description !== undefined) metadata.description = input.description;
  if (input.noindex) metadata.robots = { index: false, follow: true };
  return metadata;
}

export interface BaseMetadataInput {
  /** Title used when a page does not set one. */
  defaultTitle?: string;
  /** e.g. `"%s | Example"` */
  titleTemplate?: string;
  description?: string;
  images?: SeoImageInput | SeoImageInput[];
}

/**
 * Metadata for the root `layout.tsx`: `metadataBase`, title template, site-wide Open Graph / Twitter
 * defaults. It deliberately sets **no canonical**: a canonical in the root layout is inherited by
 * every page that forgets its own, pointing all of them at the home page.
 */
export function baseMetadata(site: SiteConfig, input: BaseMetadataInput = {}): Metadata {
  const images = normalizeImages(site, input.images);
  const defaultTitle = input.defaultTitle ?? site.siteName;
  const metadata: Metadata = {
    metadataBase: new URL(site.origin),
    openGraph: compact({
      siteName: site.siteName,
      locale: site.locale,
      type: 'website',
      title: defaultTitle,
      description: input.description,
      images,
    }) as Metadata['openGraph'],
    twitter: compact({
      card: images && images.length > 0 ? 'summary_large_image' : 'summary',
      site: site.twitterHandle,
      images: images?.map((i) => i.url),
    }) as Metadata['twitter'],
  };
  if (defaultTitle !== undefined) {
    metadata.title = input.titleTemplate ? { default: defaultTitle, template: input.titleTemplate } : defaultTitle;
  }
  if (input.description !== undefined) metadata.description = input.description;
  return metadata;
}
