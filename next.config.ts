import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase body size limit for API routes
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
  
  // For App Router
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;