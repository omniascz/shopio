/**
 * robots.txt — per `19-marketing-seo.md`. Catalog + PDPs crawlable; private
 * surfaces (checkout, account, order confirmations) excluded.
 */

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/s/',
        disallow: ['/s/*/checkout', '/s/*/ucet', '/s/*/orders/'],
      },
    ],
  };
}
