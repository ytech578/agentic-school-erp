import type { NextConfig } from "next";
import path from "path";

const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || "";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),

  typescript: {
    ignoreBuildErrors: true,
  },

  // CDN: Serve static assets from a CDN when NEXT_PUBLIC_CDN_URL is set
  assetPrefix: CDN_URL || undefined,

  // Compress output for smaller bundle sizes
  compress: true,

  // Disable telemetry in production/CI
  env: {
    NEXT_TELEMETRY_DISABLED: "1",
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.INTERNAL_API_URL || "http://127.0.0.1:4000"}/api/v1/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        // Public folder static files (images, fonts, icons)
        source: "/:file(.*\\.(?:ico|png|jpg|jpeg|svg|webp|gif|woff2?|ttf|eot))",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // HTML pages — short cache, allow revalidation
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
