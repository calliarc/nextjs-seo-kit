import type { Metadata } from 'next';
import { articleJsonLd, breadcrumbJsonLd, JsonLd } from '@calliarc/nextjs-seo-kit';
import { site } from '../../../site.config';

const posts = {
  'hello-world': { title: 'Hello world', description: 'First post', date: '2026-01-15' },
} as const;
type Slug = keyof typeof posts;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = posts[slug as Slug];
  return site.buildMetadata({
    path: `/blog/${slug}`,
    title: post.title,
    description: post.description,
    type: 'article',
    publishedTime: post.date,
    images: `/og/${slug}.png`,
  });
}

export default async function Post({ params }: Props) {
  const { slug } = await params;
  const post = posts[slug as Slug];
  return (
    <main>
      <JsonLd
        data={[
          articleJsonLd(site, {
            path: `/blog/${slug}`,
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            authors: ['Jane Doe'],
            images: [`/og/${slug}.png`],
          }),
          breadcrumbJsonLd(site, [
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: post.title },
          ]),
        ]}
      />
      <h1>{post.title}</h1>
      <p>{post.description}</p>
    </main>
  );
}
