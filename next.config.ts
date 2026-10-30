import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {},
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // @ts-ignore
  allowedDevOrigins: ['3000-cs-82de8a06-5ca7-43e5-94b7-ff800b584b82.cs-asia-southeast1-kelp.cloudshell.dev'],
  trailingSlash: true,
  webpack: (config) => {
    const modules = config.resolve.modules || ['node_modules'];
    if (process.platform === 'win32') {
      modules.unshift('C:/Users/Diamond Technology/tectonic/node_modules');
    }
    config.resolve.modules = modules;
    return config;
  },
};

export default nextConfig;
