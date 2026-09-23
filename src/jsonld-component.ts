import { createElement, type ReactElement } from 'react';
import { serializeJsonLd } from './jsonld';

export interface JsonLdProps {
  /** One JSON-LD object or an array of them. */
  data: object | object[];
  id?: string;
  /** CSP nonce, if your Content-Security-Policy requires one for inline scripts. */
  nonce?: string;
}

/**
 * Renders `<script type="application/ld+json">` with safely escaped content.
 * Works in Server Components (no client JavaScript).
 */
export function JsonLd({ data, id, nonce }: JsonLdProps): ReactElement {
  return createElement('script', {
    type: 'application/ld+json',
    id,
    nonce,
    dangerouslySetInnerHTML: { __html: serializeJsonLd(data) },
  });
}
