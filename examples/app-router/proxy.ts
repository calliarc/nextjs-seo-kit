// Next.js 16+ uses proxy.ts (formerly middleware.ts). On Next 14/15 rename this file to
// middleware.ts and export `middleware` instead of `proxy`.
import { createSeoProxy } from '@calliarc/nextjs-seo-kit/proxy';
import { site } from './site.config';

export const proxy = createSeoProxy(site);

export const config = {
  // Skip Next internals and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
