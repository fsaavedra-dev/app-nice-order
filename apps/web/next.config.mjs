/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpilar paquetes locales del monorepo
  transpilePackages: ['@nice-order/shared-types'],

  // Omitir bloqueos por TypeScript durante el build en CI/CD
  typescript: {
    ignoreBuildErrors: true,
  },

  // Omitir bloqueos por ESLint durante el build en CI/CD
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;