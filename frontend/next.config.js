/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Transpile monaco-editor for Next.js compatibility
  transpilePackages: ['@monaco-editor/react', 'monaco-editor'],
  webpack: (config, { isServer }) => {
    // Fix for Monaco Editor workers
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    // Fix for sockjs-client: provide browser-only fallbacks
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
