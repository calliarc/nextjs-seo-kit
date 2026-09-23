import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import { withSeoKit } from '@calliarc/nextjs-seo-kit';
import { site } from './site.config';

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Only needed inside this monorepo, where the package is linked from ../..
  turbopack: { root: path.join(here, '..', '..') },
  outputFileTracingRoot: path.join(here, '..', '..'),
};

// Sets trailingSlash from site.config and appends www + doubled-host redirects.
export default withSeoKit(site, nextConfig);
