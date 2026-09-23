import Link from 'next/link';
import { site } from '../site.config';

export const metadata = site.buildMetadata({ path: '/', title: { absolute: 'Example Co' } });

export default function Home() {
  return (
    <main>
      <h1>Example Co</h1>
      <ul>
        {/* relativePath() repairs hrefs such as "example.com/privacy-policy" that would otherwise double the host. */}
        <li>
          <Link href={site.relativePath('example.com/privacy-policy')}>Privacy policy</Link>
        </li>
        <li>
          <Link href={site.relativePath('/blog/hello-world')}>Hello world</Link>
        </li>
      </ul>
    </main>
  );
}
