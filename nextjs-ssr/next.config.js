/** @type {import('next').NextConfig} */
const path = require('path');
const fs = require('fs');

// Load .env from parent directory (content-local-ai)
const parentEnvPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(parentEnvPath)) {
  require('dotenv').config({ path: parentEnvPath });
  console.log('✅ Loaded .env from parent directory:', parentEnvPath);
} else {
  // Fallback to local .env if exists
  const localEnvPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(localEnvPath)) {
    require('dotenv').config({ path: localEnvPath });
    console.log('✅ Loaded .env from local directory:', localEnvPath);
  } else {
    console.log('⚠️  No .env file found (using system environment variables)');
  }
}

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Environment variables that should be available on the server
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ORIGINAL_SITE_URL: process.env.ORIGINAL_SITE_URL || 'https://www.packaginginsights.com',
    FIXED_ORIGIN_PATH: process.env.FIXED_ORIGIN_PATH || '/video/drinktec-2025-sidel-debuts-laser-blowing.html',
    USE_FIXED_ORIGIN: process.env.USE_FIXED_ORIGIN !== 'false' ? 'true' : 'false',
  },
  // Headers for SEO
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
