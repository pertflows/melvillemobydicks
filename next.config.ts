import type { NextConfig } from 'next';

/**
 * Image hosts.
 *
 * Player photos and gallery images come from Supabase Storage. Next needs the
 * allowed hostname at build time, but the project URL is read at RUNTIME so
 * configuration can change without a rebuild - so the specific host may not be
 * known here.
 *
 * Allowing any `*.supabase.co` storage path covers that. It is a narrow
 * allowance: the pattern is pinned to the public storage path, and permitting
 * an image host only lets Next optimise images served from it.
 */
const supabaseHost = (() => {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    return url ? new URL(url).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      ...(supabaseHost
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseHost,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion'],
  },
};

export default nextConfig;
