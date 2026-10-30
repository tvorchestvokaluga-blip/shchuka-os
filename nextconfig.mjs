/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://135.106.152.109/api' },
  typescript: { ignoreBuildErrors: true },
};

export default config;
