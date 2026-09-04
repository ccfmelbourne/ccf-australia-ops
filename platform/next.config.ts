import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Actions default to a 1MB body limit, well under a real
      // mobile receipt photo -- that gap caused a raw platform error
      // instead of receipt-storage.ts's own graceful rejection (found
      // live). Vercel's own hard 4.5MB payload ceiling is the real
      // limiting factor in production; this just clears it for local dev.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
