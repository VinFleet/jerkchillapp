import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep CLAUDE.md as the hand-written product spec — don't let Next.js
  // append its own agent-rules block to it on every `next dev`.
  agentRules: false,
};

export default nextConfig;
