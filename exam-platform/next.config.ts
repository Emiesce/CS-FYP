import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Allow image domains for avatars in the future */
  images: {
    unoptimized: true,
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
