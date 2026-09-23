import type { ReactNode } from 'react';
import { JsonLd, organizationJsonLd } from '@calliarc/nextjs-seo-kit';
import { site } from '../site.config';

// Site-wide defaults. Deliberately no canonical here: pages set their own.
export const metadata = site.baseMetadata({
  titleTemplate: '%s | Example Co',
  description: 'Example app for @calliarc/nextjs-seo-kit',
  images: '/og.png',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={organizationJsonLd(site, { logo: '/logo.png', sameAs: ['https://github.com/calliarc'] })} />
        {children}
      </body>
    </html>
  );
}
