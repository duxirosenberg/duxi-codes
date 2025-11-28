/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const captableUrl = process.env.CAPTABLE_APP_URL || 'http://localhost:5174';
    return [
      {
        source: '/captable',
        destination: `${captableUrl}/captable/`,
      },
      {
        source: '/captable/:path*',
        destination: `${captableUrl}/captable/:path*`,
      },
    ];
  },
}

module.exports = nextConfig

