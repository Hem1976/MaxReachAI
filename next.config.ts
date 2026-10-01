import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native addon and mjml relies on dynamic requires,
  // so both must stay outside the bundler and run as plain Node modules.
  serverExternalPackages: ["better-sqlite3", "mjml"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    proxyClientMaxBodySize: "10mb",
  },
  // Next.js 16 blocks dev assets from other origins by default.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "10.*.*.*",
    "172.*.*.*",
    "192.168.*.*",
  ],
};

export default nextConfig;
