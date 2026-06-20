import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the flood rasters into the serverless functions that read them at
  // runtime (Vercel can't auto-detect fs reads of these .tif files).
  outputFileTracingIncludes: {
    "/api/flood-tile/[z]/[x]/[y]": ["./flood-data/**"],
    "/api/flood-at": ["./flood-data/**"],
    "/api/flood-overlay": ["./flood-data/**"],
  },
};

export default nextConfig;
