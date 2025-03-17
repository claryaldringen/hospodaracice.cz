import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gvqm7qg0dumnn0iw.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default nextConfig;
