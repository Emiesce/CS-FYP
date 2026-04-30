import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Allow image domains for avatars in the future */
  images: {
    unoptimized: true,
  },
  /* Expose the backend WebSocket URL to the browser bundle.
   * Set NEXT_PUBLIC_BACKEND_WS_URL=ws://your-server in production. */
  env: {
    NEXT_PUBLIC_BACKEND_WS_URL:
      process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000",
  },
  /* Proxy exam API requests to the FastAPI backend during development */
  async rewrites() {
    return [
      {
        source: "/api/exams/:path*",
        destination: "http://localhost:8000/api/exams/:path*",
      },
    ];
  },
};

export default nextConfig;
