/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/captable',
        destination: `${process.env.CAPTABLE_APP_URL}/captable/`,
      },
      {
        source: '/captable/:path*',
        destination: `${process.env.CAPTABLE_APP_URL}/captable/:path*`,
      },
    ];
  },
}

module.exports = nextConfig

