/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "export",
  images: {
    unoptimized: true
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["*"]
    }
  }
};

module.exports = nextConfig;
