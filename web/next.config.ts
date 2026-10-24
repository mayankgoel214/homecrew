import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Phones reach the dev server through an HTTPS tunnel (camera needs HTTPS).
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok-free.dev"],
  // Proxy the FastAPI backend so the phone only needs one tunnel and there's no CORS.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
  experimental: {
    // Gemma vision calls can take a while; don't let the proxy cut them off.
    proxyTimeout: 120_000,
  },
};

export default nextConfig;
