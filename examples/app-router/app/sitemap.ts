import type { MetadataRoute } from 'next';
import { site } from '../site.config';

export default function sitemap(): MetadataRoute.Sitemap {
  return site.sitemap([
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    '/privacy-policy',
    { path: '/blog/hello-world', lastModified: '2026-01-15' },
  ]);
}
