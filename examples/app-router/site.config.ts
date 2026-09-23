import { defineSiteConfig } from '@calliarc/nextjs-seo-kit';

// One source of truth for every absolute URL the site emits.
// In a real project: siteUrl: process.env.NEXT_PUBLIC_SITE_URL!
export const site = defineSiteConfig({
  siteUrl: 'https://www.example.com',
  trailingSlash: true,
  siteName: 'Example Co',
  locale: 'en_US',
  twitterHandle: '@example',
});
