/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api' },
  typescript: { ignoreBuildErrors: true },
};

export default config;
