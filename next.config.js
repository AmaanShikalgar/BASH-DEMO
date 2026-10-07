/** @type {import('next').NextConfig} */
const BACKEND_URL =
  process.env.BACKEND_URL || "https://ticket-book-verify.preview.emergentagent.com";

const nextConfig = {
  reactStrictMode: true,
  // Proxy /api/* to the FastAPI backend so the browser never hits CORS issues.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

module.exports = nextConfig;
