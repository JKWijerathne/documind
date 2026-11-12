import type { NextConfig } from "next";

const apiUrl = (
  process.env.DOCUMIND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    proxyTimeout: 120_000,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      {
        source: "/backend/api/documents",
        destination: `${apiUrl}/api/documents/`,
      },
      {
        source: "/backend/api/chat",
        destination: `${apiUrl}/api/chat/`,
      },
      {
        source: "/backend/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
