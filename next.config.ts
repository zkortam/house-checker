import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The LLM runs through the local Claude Code CLI (child_process), so server routes use the Node runtime.
  serverExternalPackages: [],
  // Recorded DataSF responses (HC_DEMO_RECORDINGS=1) are read from disk at runtime; ship them with the API routes.
  outputFileTracingIncludes: { '/api/**/*': ['./tests/server/recordings/**/*'] },
};

export default nextConfig;
