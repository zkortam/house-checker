import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The LLM runs through the local Claude Code CLI (child_process), so server routes use the Node runtime.
  serverExternalPackages: [],
};

export default nextConfig;
