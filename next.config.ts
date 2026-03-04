import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gvqm7qg0dumnn0iw.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default nextConfig;
