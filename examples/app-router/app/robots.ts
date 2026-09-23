import type { MetadataRoute } from 'next';
import { site } from '../site.config';

export default function robots(): MetadataRoute.Robots {
  // For staging deployments: site.robots({ disallowAll: true })
  return site.robots({ disallow: ['/api/'] });
}
