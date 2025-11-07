import type { NextConfig } from 'next';

const minioHost = process.env.MINIO_ENDPOINT ?? 'storage.yourschool.com';
const minioProtocol = process.env.MINIO_USE_SSL === 'false' ? 'http' : 'https';
const minioPort = process.env.MINIO_PORT ?? '';

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: minioProtocol as 'http' | 'https',
        hostname: minioHost,
        port: minioPort === '' ? undefined : minioPort,
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'minioapi.mws.web.id',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
