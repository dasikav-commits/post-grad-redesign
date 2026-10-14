import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Codespaces can forward localhost requests with a different host.
      allowedOrigins:
        process.env.NODE_ENV === "development" ? ["localhost:3000"] : [],
    },
  },
};

export default nextConfig;
