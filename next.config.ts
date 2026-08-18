import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // For easier multi-tab SSE connections and speech API
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
