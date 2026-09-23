import { site } from '../../site.config';

export const metadata = site.buildMetadata({
  path: '/privacy-policy',
  title: 'Privacy policy',
  description: 'How Example Co handles your data.',
});

export default function PrivacyPolicy() {
  return (
    <main>
      <h1>Privacy policy</h1>
      <p>Canonical: {site.canonical('/privacy-policy')}</p>
    </main>
  );
}
