import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Slim production container (per `38`): self-contained server.js bundle.
  // Monorepo: trace from the workspace root so pnpm-linked deps are included.
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
  // Per `26-themes-storefront.md` and `31 §3.3` — RSC + Cache Components
  experimental: {
    // dynamicIO: true, // Next.js 16 Cache Components when stable
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**.shopio.app' }, { protocol: 'https', hostname: 'cdn.shopio.com' }],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
