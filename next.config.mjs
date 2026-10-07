/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['node-cron'],
  allowedDevOrigins: [
    '*.ngrok-free.dev',
    '*.ngrok-free.app',
    '*.ngrok.io',
    '*.ngrok.app',
  ],
};

export default nextConfig;
